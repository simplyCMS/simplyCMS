// Прод-старт: `node scripts/start.mjs` (скрипт `start:prod`). Накочує міграції
// під `MIGRATION_DATABASE_URL`, далі `process.execve` підміняє цей процес на
// `server.mjs` без пароля власника схеми в оточенні.
//
// 🔴 Читає лише `process.env` і `.env*` НЕ читає (Е8-Б1): у проді env дає
// Dokploy, а локальний накат — `pnpm simplycms db:apply`, який `.env.local`
// читає. Так пароль власника з `.env.local` не може опинитися в процесі.
import { resolveDriverEnv } from 'simplycms/env';
import { applyMigrations } from 'simplycms/migrate';
import { runStart } from './start-core.mjs';

const code = await runStart({
  env: process.env,
  cwd: process.cwd(),
  migrate: applyMigrations,
  resolveDriverEnv,
  execve: process.execve?.bind(process),
  log: (message) => console.log(message),
});
if (code) process.exit(code);
