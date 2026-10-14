// Запуск: OWNER_EMAIL=owner@example.com pnpm owner:invite [--print-link]
// 🔴 Host-файл під `simplycms update` (doctor №6 бачить дрейф) — не правити руками.
// Логіка (env з `.env.local`/`.env`, запрошення, доставка листа) — у ядрі,
// `simplycms/auth/owner-invite-cli`.
import { ownerInviteMain } from 'simplycms/auth/owner-invite-cli';

process.exitCode = await ownerInviteMain(process.argv.slice(2));
