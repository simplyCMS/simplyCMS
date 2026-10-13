#!/usr/bin/env node
/**
 * Разовий bash-скрипт на сервері застосунків — без SSH.
 *
 *   prod-run.mjs --server <serverId> [--confirm] [--secrets ФАЙЛ] [скрипт.sh]   # або зі stdin
 *
 * Створює завдання Dokploy типу `server` (Dokploy виконує скрипт на хості своїм
 * SSH-ключем), запускає, чекає рядка завершення в лозі, друкує вивід без службових
 * рядків і ЗАВЖДИ видаляє завдання (`finally`). Тип `dokploy-server` не годиться: він
 * виконується в контейнері Dokploy на іншій машині. Для серверних типів виконується
 * поле `script`, а `command` лише обов'язкове.
 *
 * Секрети скрипт бере з оточення контейнерів (`printenv`), не з тексту завдання. Без
 * `--confirm` — прев'ю тексту скрипта і код 3: запуск виконує код на проді.
 */
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

import {
  credentials,
  dokploy,
  requireConfirm,
  takeFlag,
} from './dokploy-client.mjs';

const args = process.argv.slice(2);
const confirm = takeFlag(args, '--confirm', false);
const serverId = takeFlag(args, '--server');
const secrets = takeFlag(args, '--secrets');
const usage = (reason) => {
  console.error(
    `${reason}. Використання: prod-run --server ID [--confirm] [скрипт.sh | stdin]`,
  );
  process.exit(2);
};
if (!serverId) usage('Не задано --server');
let script;
try {
  script = readFileSync(args[0] ?? 0, 'utf8');
} catch {
  usage('Скрипт не прочитано');
}
if (!script.trim()) usage('Скрипт порожній');
requireConfirm(confirm, [
  `виконати на сервері ${serverId} скрипт:`,
  ...script
    .trimEnd()
    .split('\n')
    .map((l) => `  ${l}`),
]);

const TIMEOUT_MS = 60_000;
const POLL_MS = Number(process.env.PROD_RUN_POLL_MS ?? 2_000);
const name = `onboarding-run-${new Date().toISOString().replace(/[:.]/g, '-')}`;
// Службові рядки Dokploy навколо виводу скрипта.
const SERVICE_LINE =
  /Initializing schedule|Running script|^\s*PID:|Command executed successfully|Error executing command|❌/;
const DONE_OK = /Command executed successfully/;
const DONE_ERR = /Error executing command|❌/;
// Опис — перший рядок-коментар: видно в UI Dokploy, якщо завдання не вдалося прибрати.
const description =
  script
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('#') && !l.startsWith('#!'))
    ?.replace(/^#+\s*/, '')
    .slice(0, 200) ?? 'simplycms prod-run';

const creds = credentials(secrets);
const call = (path, opts) => dokploy(creds, path, opts);
const findScheduleId = async () =>
  (
    await call('schedule.list', {
      query: { id: serverId, scheduleType: 'server' },
    })
  ).find((s) => s.name === name)?.scheduleId;

let scheduleId;
let exitCode = 1;
try {
  const created = await call('schedule.create', {
    method: 'POST',
    body: {
      name,
      description,
      scheduleType: 'server',
      serverId,
      command: 'bash',
      script,
      shellType: 'bash',
      cronExpression: '0 0 1 1 *',
      enabled: false,
    },
  });
  scheduleId = created?.scheduleId ?? (await findScheduleId());
  if (!scheduleId) throw new Error('Dokploy не повернув scheduleId');
  const run = await call('schedule.runManually', {
    method: 'POST',
    body: { scheduleId },
  });
  if (!run?.deploymentId)
    throw new Error(`запуск без deploymentId (статус: ${run?.status ?? '?'})`);
  let log = '';
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    log = String(
      (await call('deployment.readLogs', {
        query: { deploymentId: run.deploymentId, tail: 10_000 },
      })) ?? '',
    );
    if (DONE_OK.test(log) || DONE_ERR.test(log)) break;
    await sleep(POLL_MS);
  }
  const output = log
    .split('\n')
    .filter((l) => !SERVICE_LINE.test(l))
    .join('\n')
    .trim();
  if (output) console.log(output);
  if (DONE_OK.test(log) && run.status !== 'error') exitCode = 0;
  else if (DONE_ERR.test(log) || run.status === 'error')
    console.error('скрипт завершився з помилкою');
  else console.error(`за ${TIMEOUT_MS / 1000} с у лозі немає рядка завершення`);
} catch (err) {
  console.error(`prod-run: ${err.message}`);
} finally {
  // Завдання з текстом скрипта не лишаємо в Dokploy за жодного результату.
  try {
    scheduleId ??= await findScheduleId();
    if (scheduleId)
      await call('schedule.delete', { method: 'POST', body: { scheduleId } });
  } catch (err) {
    console.error(
      `завдання ${name} не видалено — прибери вручну (schedule-delete): ${err.message}`,
    );
    exitCode = 1;
  }
}
process.exit(exitCode);
