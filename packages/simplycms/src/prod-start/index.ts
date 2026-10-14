/**
 * 🔴 Server-only (contracts/server-only): прод-старт магазину (К3-Е8, F5 рев'ю).
 * Накат міграцій під `MIGRATION_DATABASE_URL`, далі `process.execve` на
 * `server.mjs` без пароля власника схеми. У магазині — лише шим
 * `scripts/start.mjs` (host-файл під `simplycms update`), логіка — тут.
 *
 * Назва `prod-start`, а не `start`: декларація server-only матчить і резолвлений
 * шлях `simplycms/src/<тека>`, тож `start` зачепив би клієнтський `src/start.ts`
 * хоста в магазині, чия тека зветься `simplycms`.
 */
export { STRIPPED_ENV, scrubOwnerUrl } from './stripped-env';
export { runStart, type StartDeps, type StartMigrate } from './run-start';
export { startStore } from './start-store';
