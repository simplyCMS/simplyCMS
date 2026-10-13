// Хук SessionStart Claude Code: друкує агенту стан магазину (`simplycms status --hook`).
// Шим навмисно без логіки: уся логіка живе в CLI магазину, а цей файл лише знаходить
// його і запускає — тому `simplycms update` може оновлювати її, не чіпаючи хука.
// Завжди завершується кодом 0: збій хука не має блокувати старт сесії.
import { spawnSync } from 'node:child_process';
import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const TIMEOUT_MS = 8000;

const unknown = (why) =>
  `УВАГА: стан невідомий (${why}). Виконай \`pnpm simplycms status\`.`;
const NOT_INSTALLED =
  'УВАГА: стан магазину невідомий — залежності не встановлено. Виконай `pnpm install`.';

/** Шлях до бінарника CLI за `bin.simplycms` його package.json, а не за внутрішнім шляхом. */
function resolveCli(root) {
  const pkgPath = createRequire(join(root, 'package.json')).resolve(
    '@simplycms/cli/package.json',
  );
  const bin = JSON.parse(readFileSync(pkgPath, 'utf8')).bin?.simplycms;
  return typeof bin === 'string' ? join(dirname(pkgPath), bin) : null;
}

/** Запуск CLI з виводом у тимчасові файли: пайп з великим виводом може завісити батька. */
function runStatus(root, cli) {
  const dir = mkdtempSync(join(tmpdir(), 'simplycms-hook-'));
  const out = join(dir, 'out');
  const err = join(dir, 'err');
  const outFd = openSync(out, 'w');
  const errFd = openSync(err, 'w');
  try {
    const run = spawnSync(process.execPath, [cli, 'status', '--hook'], {
      cwd: root,
      stdio: ['ignore', outFd, errFd],
      timeout: TIMEOUT_MS,
      killSignal: 'SIGKILL',
    });
    return { run, text: readFileSync(out, 'utf8').trim() };
  } finally {
    closeSync(outFd);
    closeSync(errFd);
    rmSync(dir, { recursive: true, force: true });
  }
}

function buildContext() {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  let cli;
  try {
    cli = resolveCli(root);
  } catch (error) {
    if (error?.code === 'MODULE_NOT_FOUND') return NOT_INSTALLED;
    return unknown(error.message);
  }
  if (cli === null) return unknown('у CLI немає bin.simplycms');
  const { run, text } = runStatus(root, cli);
  if (run.error?.code === 'ETIMEDOUT')
    return unknown(`таймаут ${TIMEOUT_MS / 1000} с`);
  if (run.error) return unknown(run.error.message);
  // 0 — гаразд, 3 — є що робити; усе інше (Е8-О8) — стан не встановлено.
  if (run.status !== 0 && run.status !== 3)
    return unknown(`код виходу ${run.status ?? run.signal}`);
  return text === '' ? unknown('порожній вивід status') : text;
}

let additionalContext;
try {
  additionalContext = buildContext();
} catch (error) {
  additionalContext = unknown(error.message);
}
process.stdout.write(
  `${JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext },
  })}\n`,
);
