// Запуск: OWNER_EMAIL=owner@example.com pnpm owner:invite [--print-link]
//
// 🔴 Контракт env — серверний (спека CLI v1 §7): скрипт читає лише
// `process.env`, а `.env.local`/`.env` служать способом його наповнити.
// Ключ підключення тут один — `DATABASE_URL`; окремого service-ключа
// немає.
import { readFileSync } from 'node:fs';
import { closeDbPool } from 'simplycms/db';
import { runOwnerInviteCli } from './owner-invite-core.mjs';

/** Дописує у `process.env` лише ВІДСУТНІ ключі: реальний env завжди виграє. */
function loadEnvFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trimStart();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const key = trimmed.slice(0, trimmed.indexOf('=')).trim();
    const value = trimmed.slice(trimmed.indexOf('=') + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

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
