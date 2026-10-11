/**
 * Журнал прогону `live:smoke`: повний вивід (включно зі збіркою, сід-скриптом і
 * сервером магазину) лягає у `.live-smoke/<timestamp>.log` і `.live-smoke/last.log`.
 *
 * 🔴 Чому окремим процесом, а не підміною `process.stdout.write`: дочірні
 * процеси (`pnpm build`, `demo-db`, `server.mjs`) пишуть у файловий дескриптор
 * напряму; підміна JS-потоку їх не бачить, а саме з них найчастіше видно
 * причину збою. Без журналу «флейк» не відрізнити від дефекту
 * (`docs/architecture/test-contours.md` § 13). Каталог git-ignored.
 */
import { spawn } from 'node:child_process';
import {
  createWriteStream,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';

/** Скільки журналів із позначкою часу лишати. */
export const KEEP_LOGS = 10;
/** Рядки, які варто винести в кінець: FAIL таблиці і фатальна помилка скрипта. */
const FAIL_LINE = /\| FAIL \||^\[live-smoke\]|live-smoke: \d+ FAIL/;

/** Лишає `keep` найновіших `<timestamp>.log` (`last.log` не чіпає). */
export function pruneLogs(dir, keep = KEEP_LOGS) {
  const stamped = readdirSync(dir)
    .filter((f) => /^\d{8}T\d{6}.*\.log$/.test(f))
    .sort();
  for (const old of stamped.slice(0, Math.max(0, stamped.length - keep)))
    rmSync(join(dir, old), { force: true });
}

/**
 * Запускає `script` дочірнім `node` з `LIVE_SMOKE_LOGGED=1`, тіпає вивід у
 * термінал і журнал, наприкінці друкує шлях і FAIL-рядки. Повертає код виходу.
 */
export function runLogged(root, script) {
  const dir = join(root, '.live-smoke');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const stamped = join(dir, `${stamp}.log`);
  const last = join(dir, 'last.log');
  const files = [createWriteStream(stamped), createWriteStream(last)];
  const child = spawn(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, LIVE_SMOKE_LOGGED: '1' },
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  const tee = (target) => (chunk) => {
    target.write(chunk);
    for (const f of files) f.write(chunk);
  };
  child.stdout.on('data', tee(process.stdout));
  child.stderr.on('data', tee(process.stderr));
  // Сигнали отримує дочірній процес сам (власний shutdown); батько чекає.
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => child.kill(signal));
  return new Promise((resolve) => {
    child.on('close', (code, signal) => {
      let pending = files.length;
      const done = () => {
        if (--pending > 0) return;
        const exit = code ?? (signal ? 1 : 0);
        console.log(`\n[live-smoke] журнал: ${stamped} (копія: ${last})`);
        if (exit !== 0) {
          const failed = readFileSync(stamped, 'utf8')
            .split('\n')
            .filter((l) => FAIL_LINE.test(l));
          console.log(
            failed.length > 0
              ? `[live-smoke] рядки збою:\n${failed.join('\n')}`
              : `[live-smoke] процес завершився з кодом ${exit} без рядків FAIL — дивись журнал`,
          );
        }
        pruneLogs(dir);
        resolve(exit);
      };
      for (const f of files) f.end(done);
    });
  });
}
