// Запуск: OWNER_EMAIL=owner@example.com pnpm owner:invite
//
// 🔴 Контракт env — серверний (спека CLI v1 §7): скрипт читає лише
// `process.env`, а `.env.local`/`.env` служать способом його наповнити.
// Ключ підключення тут один — `DATABASE_URL`; service_role-ключа Supabase
// більше не існує.
import { readFileSync } from 'node:fs';
import { closeDbPool } from 'simplycms/db';
import { runOwnerInvite } from './owner-invite-core.mjs';

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

const email = process.env.OWNER_EMAIL;
const siteUrl = process.env.VITE_SITE_URL ?? 'http://localhost:3000';

const missing = [
  ...(process.env.DATABASE_URL ? [] : ['DATABASE_URL']),
  ...(email ? [] : ['OWNER_EMAIL']),
];
if (missing.length > 0) {
  console.error(
    `Потрібні змінні оточення: ${missing.join(', ')} ` +
      '(env процесу або .env.local магазину).',
  );
  process.exit(1);
}

try {
  await runOwnerInvite({
    email,
    siteUrl,
    storeName: process.env.VITE_STORE_NAME ?? 'SimplyCMS',
    log: (message) => console.log(message),
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  // Без цього процес висів би на відкритому пулі Postgres.
  await closeDbPool();
}
