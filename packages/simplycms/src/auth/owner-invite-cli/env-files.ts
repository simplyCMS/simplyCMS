import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/**
 * Наповнення env `owner:invite` з `.env.local` і `.env` (К1).
 *
 * 🔴 Паритет із `server.mjs`: реальний env процесу > `.env.local` > `.env`,
 * пишуться лише ВІДСУТНІ ключі. Розбір — штатний `parseEnv` з `node:util`, а не
 * власний цикл: той лишав лапки в значенні (`DATABASE_URL="postgres://…"` →
 * пул не підключався), коментар у кінці рядка і префікс `export` у ключі.
 *
 * @param env цільовий env (за замовчуванням `process.env`)
 * @param files від найвищого пріоритету до найнижчого (відносно cwd)
 */
export function loadEnvFiles(
  env: Record<string, string | undefined> = process.env,
  files: readonly string[] = ['.env.local', '.env'],
): void {
  for (const file of files) {
    let raw: string;
    try {
      raw = readFileSync(file, 'utf8');
    } catch (error) {
      // Відсутній файл — норма; будь-яка інша помилка (права, тека замість
      // файла) не маскується під «файла немає».
      if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') continue;
      throw error;
    }
    for (const [key, value] of Object.entries(parseEnv(raw))) {
      if (!(key in env)) env[key] = value;
    }
  }
}
