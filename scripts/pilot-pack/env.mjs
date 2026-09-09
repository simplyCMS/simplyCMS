/**
 * Env скретч-магазину: що саме потрапляє в його `.env` перед `vite build`.
 *
 * 🔴 Контракт магазину (0.4.1) — рівно три ключі: `VITE_SITE_URL` (клієнтський,
 * запікається в бандл), `DATABASE_URL` і `BETTER_AUTH_SECRET` (серверні,
 * читаються з `process.env` у рантаймі). Supabase-ключів тут більше немає —
 * і це не косметика: доти пілот підставляв ФІКТИВНІ ключі Supabase, тож
 * лишався зеленим саме на тому класі регресії, який ловить реальний магазин.
 *
 * Джерело env залежить від РЕЖИМУ пілота, а не від розкладки файлів магазину:
 *  - `pilot` — живі значення з кореневого `.env.local` (прогін ходить у БД);
 *  - `pilot:pack` — значення без БД (гейти пакувальності до неї не звертаються).
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

/**
 * Значення для режиму `--pack-only`.
 *
 * Пакувальність (резолв tarball-ів, route tree з node_modules, bundle-guard,
 * Tailwind) не залежить від жодного рядка в БД: `vite build` лише вшиває
 * `VITE_*` у бандл, запитів не робить, а серверні ключі читаються аж у
 * рантаймі. Значення мусять бути СИНТАКСИЧНО валідними — DSN, який `pg` вміє
 * розібрати, і секрет непорожньої довжини, — інакше збірка впаде не на тому,
 * що перевіряється. Живого сервера цей режим не піднімає, тож підключення за
 * цим DSN ніхто не відкриває.
 */
const PACK_ONLY_ENV = {
  DATABASE_URL: 'postgresql://app_runtime:pilot-pack@127.0.0.1:5432/postgres',
  BETTER_AUTH_SECRET: 'pilot-pack-secret-not-used-outside-this-scratch-store',
};

/**
 * Джерело env для магазину.
 *
 * Локально — кореневий `.env.local` (живі значення dev-стенда). Змінні
 * `PILOT_DATABASE_URL`/`PILOT_BETTER_AUTH_SECRET` мають пріоритет над ним —
 * щоб пілота можна було направити на іншу базу, не чіпаючи `.env.local`.
 *
 * 🔴 CI-job-и для пілота немає (рішення власника 2026-08-01: гейт не має
 * залежати від зовнішнього стану БД), тож ці змінні — суто локальний
 * інструмент, а не мапінг GitHub-секретів.
 *
 * @param {number} port порт, на якому підніметься магазин (іде у VITE_SITE_URL)
 * @param {{ requireDb?: boolean }} [opts]
 */
export function resolvePilotEnv(port, { requireDb = true } = {}) {
  const siteUrl = `http://127.0.0.1:${port}`;
  if (!requireDb) return { ...PACK_ONLY_ENV, VITE_SITE_URL: siteUrl };

  const local = parseDotEnv(join(REPO_ROOT, '.env.local'));
  const databaseUrl = process.env.PILOT_DATABASE_URL || local.DATABASE_URL;
  const secret =
    process.env.PILOT_BETTER_AUTH_SECRET || local.BETTER_AUTH_SECRET;

  const missing = [];
  if (!databaseUrl) missing.push('DATABASE_URL');
  if (!secret) missing.push('BETTER_AUTH_SECRET');
  if (missing.length > 0) {
    throw new Error(
      `Немає серверних ключів магазину (${missing.join(', ')}): очікую ` +
        '.env.local у корені або PILOT_DATABASE_URL/PILOT_BETTER_AUTH_SECRET. ' +
        'Для гейтів пакувальності без БД використовуй `pnpm pilot:pack`.',
    );
  }
  return {
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: secret,
    VITE_SITE_URL: siteUrl,
  };
}

/** Мінімальний парсер `.env` (без залежностей: KEY=VALUE, `#` — коментар). */
function parseDotEnv(path) {
  /** @type {Record<string,string>} */
  const out = {};
  let raw = '';
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    out[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}
