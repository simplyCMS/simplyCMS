// Мінімальна версія Claude Code для хука старту сесії (doctor №18). Запис хука —
// exec-форма з полем `args`, яке з'явилося в Claude Code 2.1.139; на старішій версії
// хук мовчки не спрацює. Агента в магазині може вести й не Claude Code, тому
// недоступний бінарник чи нерозпізнаний вивід — не привід для попередження.
import { spawnSync } from 'node:child_process';

export const MIN_CLAUDE_VERSION = '2.1.139';
const VERSION_TIMEOUT_MS = 2000;

/** `2.1.296 (Claude Code)` → `[2, 1, 296]`; не розпізнано → `null`. */
export function parseClaudeVersion(output) {
  const match = /^\s*(\d+)\.(\d+)\.(\d+)/.exec(String(output));
  return match ? match.slice(1).map(Number) : null;
}

/** Чиста функція: версія `[major, minor, patch]` строго менша за мінімальну. */
export function isOlderThanMinimum(version, minimum = MIN_CLAUDE_VERSION) {
  const min = parseClaudeVersion(minimum);
  for (let i = 0; i < 3; i++) {
    if (version[i] !== min[i]) return version[i] < min[i];
  }
  return false;
}

/**
 * Попередження про застарілий Claude Code або `null` (бінарника немає, вивід
 * не розпізнано, версія достатня). Без shell: лише `claude --version` із таймаутом.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string | null}
 */
export function claudeVersionWarning(env = process.env) {
  const run = spawnSync('claude', ['--version'], {
    env,
    encoding: 'utf8',
    timeout: VERSION_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (run.error || run.status !== 0) return null;
  const version = parseClaudeVersion(run.stdout);
  if (version === null || !isOlderThanMinimum(version)) return null;
  return `хук старту сесії потребує Claude Code ≥ ${MIN_CLAUDE_VERSION}; онови Claude Code`;
}
