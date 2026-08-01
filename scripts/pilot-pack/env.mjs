/**
 * Env скретч-магазину: що саме потрапляє в його `.env` перед `vite build`.
 *
 * Винесено зі `scaffold.mjs` окремим модулем, бо джерело env залежить від
 * РЕЖИМУ пілота, а не від розкладки файлів магазину:
 *  - `pilot` / майбутній `pilot:e2e` — живі ключі (прогін реально ходить у БД);
 *  - `pilot:pack` — плейсхолдери (гейти пакувальності до БД не звертаються).
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

/**
 * Плейсхолдери для режиму `--pack-only`.
 *
 * Пакувальність (резолв tarball-ів, route tree з node_modules, bundle-guard,
 * Tailwind) не залежить від жодного рядка в БД: `vite build` лише вшиває
 * значення `VITE_*` у бандл, запитів не робить. Значення мають бути
 * СИНТАКСИЧНО валідними (URL + ключ), інакше фабрики Supabase падають ще на
 * етапі імпорту модуля.
 */
const PLACEHOLDER_SUPABASE = {
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_pilot_pack_placeholder',
};

/**
 * Джерело env для магазину.
 *
 * Локально — кореневий `.env.local` (живі ключі dev-проєкту). У CI його немає,
 * тож беруться secrets `PILOT_SUPABASE_URL`/`PILOT_SUPABASE_KEY`.
 *
 * 🔴 Вимога ключів — НЕ глобальна: живі ключі потрібні лише режимам, які
 * реально ходять у БД. `--pack-only` бере плейсхолдери, тож не залежить ні від
 * `.env.local`, ні від секретів CI.
 *
 * @param {number} port порт, на якому підніметься магазин (іде у VITE_SITE_URL)
 * @param {{ requireSupabase?: boolean }} [opts]
 */
export function resolvePilotEnv(port, { requireSupabase = true } = {}) {
  const siteUrl = `http://127.0.0.1:${port}`;
  if (!requireSupabase) {
    return { ...PLACEHOLDER_SUPABASE, VITE_SITE_URL: siteUrl };
  }

  const secretUrl = process.env.PILOT_SUPABASE_URL;
  const secretKey = process.env.PILOT_SUPABASE_KEY;
  const local =
    secretUrl && secretKey ? {} : parseDotEnv(join(REPO_ROOT, '.env.local'));

  const resolved =
    secretUrl && secretKey
      ? {
          VITE_SUPABASE_URL: secretUrl,
          VITE_SUPABASE_ANON_KEY: secretKey,
          VITE_SUPABASE_PUBLISHABLE_KEY: secretKey,
          VITE_SITE_URL: siteUrl,
        }
      : {
          VITE_SUPABASE_URL: local.VITE_SUPABASE_URL ?? '',
          VITE_SUPABASE_ANON_KEY: local.VITE_SUPABASE_ANON_KEY ?? '',
          VITE_SUPABASE_PUBLISHABLE_KEY:
            local.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
          VITE_SITE_URL: siteUrl,
        };

  const hasKey =
    resolved.VITE_SUPABASE_PUBLISHABLE_KEY || resolved.VITE_SUPABASE_ANON_KEY;
  if (!resolved.VITE_SUPABASE_URL || !hasKey) {
    throw new Error(
      'Немає ключів Supabase: очікую .env.local у корені або ' +
        'PILOT_SUPABASE_URL/PILOT_SUPABASE_KEY. Для гейтів пакувальності без ' +
        'БД використовуй `pnpm pilot:pack`.',
    );
  }
  return resolved;
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
