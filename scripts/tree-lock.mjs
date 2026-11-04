/**
 * Замок прогону на дерево репо: в одному дереві одночасно йде лише один
 * прогін-доказ (`pnpm gates`, `pnpm release`, `pnpm live:smoke`).
 *
 * 🔴 Чому: `dist/`, `packages/<пакет>/dist`, `routeTree.gen` і скретч pilot спільні на
 * дерево — два прогони перезаписують збірку один одному (сервер першого читає
 * чужі чанки). Ресурси, спільні на машину (БД, Mailpit), ізолюються
 * ідентичністю прогону, а не замком.
 *
 * Беруть лише вхідні точки; вкладені виклики (gates -> pilot-full -> pilot-pack)
 * замок не беруть — повторного входу немає. Самостійні `pnpm pilot` і `pnpm build`
 * замка не беруть: це свідома межа.
 */
import {
  closeSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';

export const LOCK_FILE = '.proof-run.lock';

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM — процес є, але чужий: вважаємо живим.
    return e.code !== 'ESRCH';
  }
};

const readHolder = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

/**
 * Бере замок дерева `root` для прогону `label`; кидає, якщо його тримає живий
 * процес. Повертає `release()` (також вішається на `exit`).
 */
export function acquireTreeLock(root, label, { pid = process.pid } = {}) {
  const path = join(root, LOCK_FILE);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const fd = openSync(path, 'wx');
      writeSync(
        fd,
        JSON.stringify({ pid, label, startedAt: new Date().toISOString() }),
      );
      closeSync(fd);
      const release = () => {
        // Лише свій замок: чужий (перехоплений після нашого падіння) не чіпаємо.
        if (readHolder(path)?.pid === pid) {
          try {
            unlinkSync(path);
          } catch {
            /* уже прибрано */
          }
        }
      };
      process.on('exit', release);
      return release;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const holder = readHolder(path);
      if (holder && alive(holder.pid) && holder.pid !== pid) {
        throw new Error(
          `у цьому дереві вже йде ${holder.label} (pid ${holder.pid}, з ${holder.startedAt}) — дочекайся або зупини його`,
        );
      }
      // Власник мертвий (або файл битий): перехоплюємо й пробуємо знову.
      try {
        unlinkSync(path);
      } catch {
        /* інший прогін встиг першим */
      }
    }
  }
  throw new Error(`не вдалося взяти замок ${path}`);
}
