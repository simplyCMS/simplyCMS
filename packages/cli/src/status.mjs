// simplycms status — етап магазину, стан перевірок і наступний скіл (Б §3.1).
// Каркас офлайн-частини: ті самі перевірки, що в `doctor` (спільний список і спільний
// `buildOfflineContext`) і онлайн-завдання (status-online.mjs), усе з одним таймаутом на команду.
// Коди виходу: 0 — гаразд, 3 — є що робити, інакше — стан невідомий (Е8-О8).
import { readCoreIntro } from './agent-files.mjs';
import { findStoreRoot } from './context.mjs';
import { DEPLOY_RECORD_PATH, readDeployRecord } from './deploy-record.mjs';
import { OFFLINE_CHECKS } from './doctor-checks.mjs';
import { buildOfflineContext } from './doctor.mjs';
import { extractBlockIntro, renderManagedBlock } from './managed-block.mjs';
import { deriveStage, nextSkill, statusExitCode } from './status-stage.mjs';
import { reason } from './online-state-checks.mjs';
import { createDeadline, runRaced, TIMED_OUT } from './status-deadline.mjs';
import { onlineTasks } from './status-online.mjs';
import { printHuman, renderHookState } from './status-render.mjs';

/** Бюджет на всю команду: хук сесії не має гальмувати старт агента. */
const STATUS_TIMEOUT_MS = 5000;

/** @param {string[]} argv */
function parseStatusArgs(argv) {
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

/** Запис розгортання або `null`; нечитний чи невалідний файл — у `unknown`, етап лишається `local`. */
function loadDeployRecord(storeRoot, unknown) {
  try {
    return readDeployRecord(storeRoot);
  } catch (error) {
    unknown.push(`${DEPLOY_RECORD_PATH}: ${reason(error)}`);
    return null;
  }
}

/**
 * Зібрати звіт. Перевірка, що кинула чи не вклалась у бюджет, потрапляє в `unknown` —
 * не зникає. Синхронну перевірку, що зависла наглухо, таймаут не перерве (потік один):
 * офлайн-перевірки читають лише локальні файли, а повільне — `import()` модулів у
 * `buildOfflineContext` та онлайн-завдання (БД, домен) — асинхронне.
 * @param {string | null} storeRoot `null` — теки магазину немає
 * `buildContext` і `online` — шви для тестів (повільний контекст, фейкові онлайн-завдання);
 * продукт завжди дає `buildOfflineContext` і `onlineTasks`.
 * @param {{ production?: boolean, checks?: typeof OFFLINE_CHECKS, buildContext?: typeof buildOfflineContext, online?: (ctx: Parameters<typeof onlineTasks>[0]) => { label: string, run: () => unknown }[], timeoutMs?: number }} [opts]
 */
export async function collectStatus(
  storeRoot,
  {
    production = false,
    checks = OFFLINE_CHECKS,
    buildContext = buildOfflineContext,
    online = onlineTasks,
    timeoutMs = STATUS_TIMEOUT_MS,
  } = {},
) {
  /** @type {string[]} */
  const unknown = [];
  /** @type {import('./ui.mjs').Check[]} */
  let results = [];
  const deployRecord =
    storeRoot === null ? null : loadDeployRecord(storeRoot, unknown);
  if (storeRoot !== null) {
    const deadline = createDeadline(timeoutMs);
    try {
      // 🔴 Контекст — за замовчуванням ЛИШЕ buildOfflineContext (спільний з doctor): власне складання
      // загубило б async-дані (`engines`), і №17 мовчки став би skip.
      const ctx = await deadline.race(buildContext(storeRoot, { production }));
      if (ctx === TIMED_OUT)
        unknown.push(`контекст перевірок: не вклався у ${timeoutMs} мс`);
      else {
        const tasks = [
          ...checks,
          ...online({ storeRoot, env: ctx.env, deployRecord }),
        ];
        const raced = await runRaced(tasks, ctx, deadline, timeoutMs);
        results = raced.checks;
        unknown.push(...raced.unknown);
      }
    } catch (error) {
      unknown.push(`контекст перевірок: ${reason(error)}`);
    } finally {
      deadline.clear();
    }
  }
  const stage = deriveStage({
    hasStoreRoot: storeRoot !== null,
    deployJson: deployRecord,
  });
  return {
    stage,
    checks: results,
    next: nextSkill({ stage, checks: results }),
    unknown,
  };
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
      `${intro}${renderHookState(report, storeRoot !== null && introMd === null).join('\n')}`,
    );
  } else printHuman(report);
  const code = statusExitCode(report);
  // Перевірка, що не вклалась, лишає живі дескриптори — без явного виходу процес
  // висів би до її завершення, зводячи нанівець бюджет.
  if (report.unknown.length > 0) process.exit(code);
  return code;
}
