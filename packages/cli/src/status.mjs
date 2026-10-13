// simplycms status — етап магазину, стан перевірок і наступний скіл (Б §3.1, Task 19).
// Каркас офлайн-частини: ті самі перевірки, що в `doctor` (спільний список і спільний
// `buildOfflineContext`), але з таймаутом на всю команду; онлайн-дані додасть Task 21.
// Коди виходу: 0 — гаразд, 3 — є що робити, інакше — стан невідомий (Е8-О8).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readCoreIntro } from './agent-files.mjs';
import { findStoreRoot } from './context.mjs';
import { OFFLINE_CHECKS } from './doctor-checks.mjs';
import { buildOfflineContext } from './doctor.mjs';
import { extractBlockIntro, renderManagedBlock } from './managed-block.mjs';
import { deriveStage, nextSkill, statusExitCode } from './status-stage.mjs';
import {
  formatCheck,
  begin,
  finish,
  reportChecks,
  say,
  summarizeChecks,
} from './ui.mjs';

/** Бюджет на всю команду: хук сесії не має гальмувати старт агента. */
export const STATUS_TIMEOUT_MS = 5000;
/** Стеля стану в `--hook`: агент читає його на початку кожної сесії. */
const HOOK_STATE_MAX_LINES = 25;
const DEPLOY_RECORD = '.simplycms/deploy.json';

/** @param {string[]} argv */
export function parseStatusArgs(argv) {
  const flags = { json: false, hook: false, production: false };
  for (const arg of argv) {
    if (arg === '--json') flags.json = true;
    else if (arg === '--hook') flags.hook = true;
    else if (arg === '--production') flags.production = true;
    else throw new Error(`Невідомий аргумент status: ${arg}`);
  }
  if (flags.json && flags.hook)
    throw new Error('status: --json і --hook несумісні — обери один формат');
  // Хук запускає сесія без вибору режиму; прод-режим там означав би мовчазну зміну серйозності.
  if (flags.hook && flags.production)
    throw new Error('status: --production не поєднується з --hook');
  return flags;
}

const TIMED_OUT = Symbol('timed-out');

/** Один спільний дедлайн на всі асинхронні кроки; таймер не тримає процес. */
function createDeadline(ms) {
  let timer;
  const expired = new Promise((resolve) => {
    timer = setTimeout(resolve, ms, TIMED_OUT);
    timer.unref();
  });
  return {
    race: (promise) => Promise.race([promise, expired]),
    clear: () => clearTimeout(timer),
  };
}

const reason = (error) =>
  error instanceof Error ? error.message : String(error);

/** Запис розгортання або `null`; нечитний файл — у `unknown`, етап лишається `local`. */
function readDeployRecord(storeRoot, unknown) {
  const path = join(storeRoot, DEPLOY_RECORD);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (parsed !== null && typeof parsed === 'object') return parsed;
    throw new Error('очікується обʼєкт');
  } catch (error) {
    unknown.push(`${DEPLOY_RECORD}: ${reason(error)}`);
    return null;
  }
}

/**
 * Зібрати звіт. Перевірка, що кинула чи не вклалась у бюджет, потрапляє в `unknown` —
 * не зникає. Синхронну перевірку, що зависла наглухо, таймаут не перерве (потік один):
 * офлайн-перевірки читають лише локальні файли, а повільна частина — `import()`
 * модулів у `buildOfflineContext` — асинхронна.
 * @param {string | null} storeRoot `null` — теки магазину немає
 * @param {{ production?: boolean, checks?: typeof OFFLINE_CHECKS, timeoutMs?: number }} [opts]
 */
export async function collectStatus(
  storeRoot,
  {
    production = false,
    checks = OFFLINE_CHECKS,
    timeoutMs = STATUS_TIMEOUT_MS,
  } = {},
) {
  /** @type {string[]} */
  const unknown = [];
  /** @type {import('./ui.mjs').Check[]} */
  const results = [];
  if (storeRoot !== null) {
    const deadline = createDeadline(timeoutMs);
    try {
      // 🔴 Контекст — ЛИШЕ через buildOfflineContext (спільний з doctor): власне складання
      // загубило б async-дані (`engines`), і №17 мовчки став би skip.
      const ctx = await deadline.race(
        buildOfflineContext(storeRoot, { production }),
      );
      if (ctx === TIMED_OUT)
        unknown.push(`контекст перевірок: не вклався у ${timeoutMs} мс`);
      else {
        const settled = await Promise.all(
          checks.map(async ({ label, run }) => {
            try {
              const result = await deadline.race(
                Promise.resolve().then(() => run(ctx)),
              );
              return result === TIMED_OUT
                ? { unknown: `${label}: не вклалась у ${timeoutMs} мс` }
                : { check: result };
            } catch (error) {
              return { unknown: `${label}: ${reason(error)}` };
            }
          }),
        );
        for (const item of settled) {
          if (item.check) results.push(item.check);
          else unknown.push(item.unknown);
        }
      }
    } catch (error) {
      unknown.push(`контекст перевірок: ${reason(error)}`);
    } finally {
      deadline.clear();
    }
  }
  const deployJson =
    storeRoot === null ? null : readDeployRecord(storeRoot, unknown);
  const stage = deriveStage({ hasStoreRoot: storeRoot !== null, deployJson });
  return {
    stage,
    checks: results,
    next: nextSkill({ stage, checks: results }),
    unknown,
  };
}

/** Стан для `--hook`: ≤25 рядків, проблеми першими, зайве зрізається з підказкою. */
function hookState(report, introMissing) {
  const { stage, checks, next, unknown } = report;
  const head = [
    `simplycms status — етап: ${stage}`,
    next === null
      ? 'Наступний скіл: не потрібен'
      : `Наступний скіл: ${next.skill} — ${next.reason}`,
    `Перевірки: ${summarizeChecks(checks)}`,
  ];
  if (introMissing)
    head.push(
      'УВАГА: node_modules/simplycms/agent/intro.md немає — pnpm install',
    );
  const order = { error: 0, warn: 1 };
  const problems = checks
    .filter((check) => check.status in order)
    .sort((a, b) => order[a.status] - order[b.status])
    .flatMap((check) => formatCheck(check).split('\n'));
  const tail = unknown.map((item) => `? не вдалося перевірити: ${item}`);
  const lines = [...head, ...problems, ...tail];
  if (lines.length <= HOOK_STATE_MAX_LINES) return lines;
  const kept = lines.slice(0, HOOK_STATE_MAX_LINES - 1);
  return [
    ...kept,
    `… ще ${lines.length - kept.length} рядків — pnpm simplycms status`,
  ];
}

function printHuman(report) {
  begin('simplycms status');
  say.info(`Етап: ${report.stage}`);
  reportChecks(report.checks);
  for (const item of report.unknown) say.warn(`Не вдалося перевірити: ${item}`);
  if (report.next)
    say.step(`Наступний скіл: ${report.next.skill} — ${report.next.reason}`);
  finish(summarizeChecks(report.checks));
}

/** @param {string[]} argv */
export async function run(argv) {
  const { json, hook, production } = parseStatusArgs(argv);
  let storeRoot = null;
  try {
    storeRoot = findStoreRoot();
  } catch {
    // Немає магазину — це етап `not-created`, а не помилка.
  }
  const report = await collectStatus(storeRoot, { production });
  if (json) console.log(JSON.stringify(report));
  else if (hook) {
    const introMd = storeRoot === null ? null : readCoreIntro(storeRoot);
    const intro =
      introMd === null
        ? ''
        : `${extractBlockIntro(renderManagedBlock(introMd))}\n\n`;
    console.log(
      `${intro}${hookState(report, storeRoot !== null && introMd === null).join('\n')}`,
    );
  } else printHuman(report);
  const code = statusExitCode(report);
  // Перевірка, що не вклалась, лишає живі дескриптори — без явного виходу процес
  // висів би до її завершення, зводячи нанівець бюджет.
  if (report.unknown.length > 0) process.exit(code);
  return code;
}
