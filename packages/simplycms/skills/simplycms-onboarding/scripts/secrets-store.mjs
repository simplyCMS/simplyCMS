// Файл секретів магазину: формат KEY=VALUE, права 0600, шлях у .gitignore.
// Спільний для secrets-file.mjs, dokploy.mjs і клієнта Dokploy. Лише `node:*`:
// скіл у магазині виконується з node_modules/simplycms/skills/… без залежностей.
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, isAbsolute } from 'node:path';

/** Ключі, які скіл кладе у файл секретів (порожні, значення вносить власник або скрипти). */
export const SECRET_KEYS = [
  'DOKPLOY_URL',
  'DOKPLOY_API_KEY',
  'DATABASE_URL',
  'MIGRATION_DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'SMTP_URL',
  'MAIL_FROM',
];

/** Рядки блоку змінних; коментарі й порожні рядки зберігаються як є. */
export function parseEnv(text) {
  return (text ?? '').split('\n').map((line) => {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    return m ? { key: m[1], value: m[2], line } : { line };
  });
}

export const serializeEnv = (lines) =>
  lines.map((l) => (l.key ? `${l.key}=${l.value}` : l.line)).join('\n');

const readLines = (path) =>
  parseEnv(
    existsSync(path) ? readFileSync(path, 'utf8').replace(/\n$/, '') : '',
  );

/** Значення ключа або `undefined`; порожній рядок теж «немає». */
export function readSecret(path, key) {
  const value = readLines(path).find((l) => l.key === key)?.value;
  return value ? value : undefined;
}

/** Записує ключ; файл створюється з 0600, права перевстановлюються щоразу. */
export function setSecret(path, key, value) {
  const lines = readLines(path);
  const existing = lines.find((l) => l.key === key);
  if (existing) existing.value = value;
  else lines.push({ key, value });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${serializeEnv(lines)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}

/** Шлях у .gitignore поруч (cwd); поза деревом cwd git його й так не бачить. */
export function ensureGitignored(path, cwd = process.cwd()) {
  const rel = relative(cwd, path);
  if (isAbsolute(rel) || rel.startsWith('..')) return false;
  const ignore = join(cwd, '.gitignore');
  const text = existsSync(ignore) ? readFileSync(ignore, 'utf8') : '';
  if (text.split('\n').includes(rel)) return false;
  writeFileSync(
    ignore,
    `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${rel}\n`,
  );
  return true;
}
