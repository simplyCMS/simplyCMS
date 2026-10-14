// Прод-старт: `node scripts/start.mjs` — єдина стартова команда платформи.
// 🔴 Host-файл під `simplycms update` (doctor №6 бачить дрейф) — не правити руками.
// Логіка (накат під MIGRATION_DATABASE_URL, execve на server.mjs без нього) — у
// ядрі, `simplycms/prod-start`; корінь магазину — тека над цим скриптом, не cwd.
import { startStore } from 'simplycms/prod-start';

const code = await startStore(new URL('..', import.meta.url));
if (code) process.exit(code);
