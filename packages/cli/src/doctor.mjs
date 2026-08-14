// simplycms doctor — read-only діагностика магазину (§4.1 спеки): оффлайн-
// перевірки завжди; онлайн (doctor-online.mjs) — лише коли env є. Exit-код:
// 1 при будь-якому error; warn валить лише під --strict; skip не впливає.
import {
  findStoreRoot,
  readCliVersion,
  readStoreEnv,
  readStoreManifest,
} from './context.mjs';
import { schemaMigrationsPath } from './db-diff.mjs';
import { runOfflineChecks } from './doctor-checks.mjs';
import { runOnlineChecks } from './doctor-online.mjs';
import { CANON_HOST_DIR } from './host-drift.mjs';
import { begin, finish, reportChecks, summarizeChecks } from './ui.mjs';

/** @typedef {import('./ui.mjs').Check} Check */

const ROOT_TITLE = 'Корінь магазину знайдено';

/** @param {string[]} argv */
export function parseDoctorArgs(argv) {
  let strict = false;
  for (const arg of argv) {
    if (arg === '--strict') strict = true;
    else throw new Error(`Невідомий аргумент doctor: ${arg}`);
  }
  return { strict };
}

/** Чи є env для онлайн-перевірок (той самий набір, що й перевірка №5). */
export function hasSupabaseEnv(env) {
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  return Boolean(env.VITE_SUPABASE_URL && key);
}

/**
 * Exit-код за спекою: error → 1; warn — лише під --strict; skip не впливає.
 * @param {Check[]} checks
 */
export function computeExitCode(checks, { strict = false } = {}) {
  if (checks.some((check) => check.status === 'error')) return 1;
  if (strict && checks.some((check) => check.status === 'warn')) return 1;
  return 0;
}

/** @param {string[]} argv */
export async function run(argv) {
  const { strict } = parseDoctorArgs(argv);
  begin('simplycms doctor');
  let storeRoot;
  try {
    storeRoot = findStoreRoot();
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    reportChecks([{ id: 'root', title: ROOT_TITLE, status: 'error', details }]);
    process.exitCode = 1;
    finish('Магазин не знайдено — решта перевірок не має сенсу.');
    return;
  }
  const ctx = {
    storeRoot,
    manifest: readStoreManifest(storeRoot),
    env: readStoreEnv(storeRoot),
    cliVersion: readCliVersion(),
    // Канон дрейфу і шлях до міграцій ядра — спільні з update/db:diff:
    // джерело шляху одне, реалізації порівнянь — теж (host-drift/db-diff).
    hostDir: CANON_HOST_DIR,
    schemaMigrationsDir: schemaMigrationsPath(storeRoot),
  };
  const checks = [
    { id: 'root', title: ROOT_TITLE, status: 'ok', details: storeRoot },
    ...runOfflineChecks(ctx),
  ];
  if (hasSupabaseEnv(ctx.env)) checks.push(...(await runOnlineChecks(ctx)));
  reportChecks(checks);
  process.exitCode = computeExitCode(checks, { strict });
  finish(summarizeChecks(checks));
}
