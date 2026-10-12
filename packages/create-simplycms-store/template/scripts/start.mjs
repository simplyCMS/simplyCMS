// Прод-старт: `node scripts/start.mjs` (скрипт `start:prod`). Накочує міграції
// під `MIGRATION_DATABASE_URL`, далі `process.execve` підміняє цей процес на
// `server.mjs` без пароля власника схеми в оточенні.
//
// 🔴 Читає лише `process.env` і `.env*` НЕ читає (Е8-Б1): у проді env дає
// Dokploy, а локальний накат — `pnpm simplycms db:apply`, який `.env.local`
// читає. Так пароль власника з `.env.local` не може опинитися в процесі.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDriverEnv } from 'simplycms/env';
import { applyMigrations } from 'simplycms/migrate';
import { runStart } from './start-core.mjs';

// Корінь магазину — від розташування скрипта, а не від cwd: `node /app/scripts/start.mjs`
// з іншої теки мусить працювати (міграції й server.mjs лежать у корені).
const STORE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// server.mjs шукає `.env*` і `dist/` відносно cwd, а execve cwd зберігає.
process.chdir(STORE_ROOT);

const code = await runStart({
  env: process.env,
  cwd: STORE_ROOT,
  migrate: applyMigrations,
  resolveDriverEnv,
  execve: process.execve?.bind(process),
  log: (message) => console.error(message),
});
if (code) process.exit(code);
