import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDriverEnv } from 'simplycms/env';
import { applyMigrations, readPrimaryLocale } from 'simplycms/migrate';
import { runStart } from './run-start';

/**
 * Проводка прод-старту для шима магазину `scripts/start.mjs`: справжні накат,
 * `process.execve` і лог у stderr. Шим лишається кількома рядками під
 * `simplycms update`, а поведінка оновлюється разом із ядром.
 *
 * 🔴 Читає лише `process.env`, `.env*` НЕ читає (Е8-Б1): у проді env дає
 * Dokploy, а локальний накат — `pnpm simplycms db:apply`. Так пароль власника з
 * `.env.local` не може опинитися в процесі.
 *
 * @param storeRoot корінь магазину — від розташування шима, не від cwd:
 *   `node /app/scripts/start.mjs` з іншої теки мусить працювати.
 */
export async function startStore(
  storeRoot: string | URL,
): Promise<number | void> {
  const cwd =
    typeof storeRoot === 'string' ? storeRoot : fileURLToPath(storeRoot);
  // server.mjs шукає `.env*` і `dist/` відносно cwd, а execve cwd зберігає.
  process.chdir(cwd);
  return runStart({
    env: process.env,
    cwd,
    migrate: applyMigrations,
    resolveDriverEnv,
    // Конфіг лежить у корені образу поруч зі скриптом; нечитабельний — як «мітки немає».
    readPrimaryLocale: () => {
      try {
        return readPrimaryLocale(
          readFileSync(join(cwd, 'simplycms.config.ts'), 'utf8'),
        );
      } catch {
        return null;
      }
    },
    execve: process.execve?.bind(process),
    log: (message) => console.error(message),
  });
}
