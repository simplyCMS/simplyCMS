// Запуск: OWNER_EMAIL=owner@example.com pnpm owner:invite [--print-link]
//
// 🔴 Контракт env — серверний (спека CLI v1 §7): скрипт читає лише
// `process.env`, а `.env.local`/`.env` служать способом його наповнити.
// Ключ підключення тут один — `DATABASE_URL`; окремого service-ключа
// немає.
import { closeDbPool } from 'simplycms/db';
import { loadEnvFiles } from './owner-invite-env.mjs';
import { runOwnerInviteCli } from './owner-invite-cli.mjs';

// Паритет із `server.mjs` (К1): реальний env > `.env.local` > `.env`, лапки,
// коментарі й `export` розбирає `parseEnv`.
loadEnvFiles();

// Розбір аргументів, перевірка env і код виходу — в ядрі (`runOwnerInviteCli`),
// щоб `--print-link` та вимогу `VITE_SITE_URL` можна було довести юнітом.
try {
  process.exitCode = await runOwnerInviteCli({
    argv: process.argv.slice(2),
    env: process.env,
  });
} finally {
  // Без цього процес висів би на відкритому пулі Postgres.
  await closeDbPool();
}
