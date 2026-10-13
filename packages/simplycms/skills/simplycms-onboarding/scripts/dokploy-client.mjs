// Клієнт API Dokploy і спільні помічники скриптів скіла онбордингу.
//
// Чому не MCP: `application-saveEnvironment` приймає ВЕСЬ блок змінних аргументом
// (секрети осідають в історії сесії), а читання через MCP віддає `[REDACTED]`, тож
// «дописати одну змінну» через нього світить або затирає решту. Тут читаємо й
// пишемо напряму, нічого секретного не друкуючи.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { readSecret } from './secrets-store.mjs';

export const DEFAULT_SECRETS = '.simplycms/secrets.env';

/** Знімає `--name value` / `--name` з args (мутує), повертає значення. */
export function takeFlag(args, name, hasValue = true) {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  return hasValue ? args.splice(i, 2)[1] : (args.splice(i, 1), true);
}

/** Облікові дані: оточення, інакше файл секретів. НЕ `~/.claude.json`. */
export function credentials(secretsPath) {
  const path = resolve(secretsPath ?? DEFAULT_SECRETS);
  const url = process.env.DOKPLOY_URL || readSecret(path, 'DOKPLOY_URL');
  const key =
    process.env.DOKPLOY_API_KEY || readSecret(path, 'DOKPLOY_API_KEY');
  if (!url || !key)
    throw new Error(
      `Немає DOKPLOY_URL / DOKPLOY_API_KEY: заповни їх у файлі секретів (${secretsPath ?? DEFAULT_SECRETS}) або в оточенні`,
    );
  const base = url.replace(/\/+$/, '');
  return { url: base, api: base.endsWith('/api') ? base : `${base}/api`, key };
}

/** Запит до tRPC-ендпоїнта Dokploy; у помилці — лише статус, без тіла відповіді. */
export async function dokploy(
  creds,
  path,
  { method = 'GET', query, body } = {},
) {
  const url = new URL(`${creds.api}/${path}`);
  for (const [k, v] of Object.entries(query ?? {}))
    url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: { 'x-api-key': creds.key, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Dokploy ${path}: HTTP ${res.status}`);
  return text ? JSON.parse(text) : null;
}

/**
 * Механічна згода: без `--confirm` друкує прев'ю (що буде змінено, лише імена) і
 * виходить кодом 3, нічого не змінивши. Викликати ДО першого мутуючого запиту.
 */
export function requireConfirm(confirm, previewLines) {
  if (confirm) return;
  console.log(
    "Прев'ю (нічого не змінено; додай --confirm після згоди власника):",
  );
  for (const line of previewLines) console.log(`  - ${line}`);
  process.exit(3);
}

/** Єдиний носій схеми `.simplycms/deploy.json` — CLI магазину, а не прямий файл. */
function cli(args, input) {
  const r = spawnSync(
    'node_modules/.bin/simplycms',
    ['deploy:record', ...args],
    {
      input,
      encoding: 'utf8',
    },
  );
  if (r.error)
    throw new Error(
      'simplycms не знайдено в node_modules/.bin: запускай з кореня магазину після pnpm install',
    );
  return r;
}

/** Запис розгортання або `null`, якщо його ще немає (код 3). */
export function readDeployRecord() {
  const r = cli(['get']);
  if (r.status === 3) return null;
  if (r.status !== 0)
    throw new Error('deploy:record get: помилка читання запису');
  return JSON.parse(r.stdout);
}

export function writeDeployRecord(record) {
  const r = cli(['set'], JSON.stringify(record));
  // stderr CLI несе лише назву поля без значення (валідатор), тож його можна показати.
  if (r.status !== 0) throw new Error(`deploy:record set: ${r.stderr.trim()}`);
}

/** applicationId: `--app` або запис розгортання. */
export function resolveAppId(appFlag) {
  const id = appFlag ?? readDeployRecord()?.dokploy.applicationId;
  if (!id)
    throw new Error(
      'Невідомий застосунок: задай --app або створи запис розгортання (dokploy.mjs provision)',
    );
  return id;
}
