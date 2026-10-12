// Наповнення env скрипта owner:invite з `.env.local` і `.env` (К1).
//
// 🔴 Паритет із `server.mjs`: реальний env процесу > `.env.local` > `.env`,
// пишуться лише ВІДСУТНІ ключі. Розбір — штатний `parseEnv` з `node:util`, а не
// власний цикл: той лишав лапки в значенні (`DATABASE_URL="postgres://…"` →
// пул не підключався), коментар у кінці рядка і префікс `export` у ключі.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/**
 * @param {Record<string, string | undefined>} env цільовий env (за замовчуванням `process.env`)
 * @param {readonly string[]} files від найвищого пріоритету до найнижчого
 */
export function loadEnvFiles(
  env = process.env,
  files = ['.env.local', '.env'],
) {
  for (const file of files) {
    let raw;
    try {
      raw = readFileSync(file, 'utf8');
    } catch (error) {
      // Відсутній файл — норма; будь-яка інша помилка (права, тека замість
      // файла) не маскується під «файла немає».
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    for (const [key, value] of Object.entries(parseEnv(raw))) {
      if (!(key in env)) env[key] = value;
    }
  }
}
