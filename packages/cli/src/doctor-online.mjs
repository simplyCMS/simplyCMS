// Онлайн-перевірки doctor (§4.1): доступність Supabase REST, активна тема й
// активні плагіни з БД серед зареєстрованих у конфізі. Голий fetch, без
// клієнтських бібліотек. Мережева помилка → стан «не вдалося перевірити» (§3),
// HTTP-помилка від живого REST → error (URL/ключ несправні).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { configPluginNames, configThemeKeys } from './config-edit.mjs';

/** @typedef {import('./ui.mjs').Check} Check */

const REST_TITLE = 'Supabase REST доступний';

/** GET до Supabase REST. Мережева помилка летить нагору — її ловить виклик. */
async function restGet(env, path) {
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  const base = env.VITE_SUPABASE_URL.replace(/\/+$/, '');
  const response = await fetch(`${base}${path}`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  return {
    status: response.status,
    data: response.ok ? await response.json() : null,
  };
}

/** Активні в БД імена мусять бути серед ключів конфігу — інакше деградація. */
function checkNamesInConfig(id, title, names, keys, hint) {
  if (keys === null)
    return {
      id,
      title,
      status: 'skip',
      details: 'simplycms.config.ts без якоря — див. оффлайн-перевірку конфігу',
    };
  const missing = names.filter((name) => !keys.includes(name));
  if (missing.length > 0)
    return {
      id,
      title,
      status: 'warn',
      details: `Активні в БД, але відсутні в конфізі: ${missing.join(', ')} — ${hint}`,
    };
  return { id, title, status: 'ok' };
}

/**
 * Обидва REST-запити по черзі; перша мережева/HTTP-помилка зупиняє решту —
 * діагностика вже у звіті, повторювати її на кожній таблиці немає сенсу.
 * @param {{ storeRoot: string; env: Record<string, string> }} ctx
 * @returns {Promise<Check[]>}
 */
export async function runOnlineChecks({ storeRoot, env }) {
  /** @type {Check[]} */
  const checks = [];
  const configPath = join(storeRoot, 'simplycms.config.ts');
  const source = existsSync(configPath)
    ? readFileSync(configPath, 'utf8')
    : null;
  const queries = [
    [
      'themes',
      'Активна тема зареєстрована в конфізі',
      configThemeKeys,
      'магазин деградує на тему default',
    ],
    [
      'plugins',
      'Активні плагіни зареєстровані в конфізі',
      configPluginNames,
      'хуки цих плагінів не виконуються',
    ],
  ];
  for (const [table, title, parse, hint] of queries) {
    let result;
    try {
      result = await restGet(
        env,
        `/rest/v1/${table}?select=name&is_active=eq.true`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      checks.push({
        id: 'rest',
        title: REST_TITLE,
        status: 'skip',
        details: `Мережева помилка: ${reason}`,
      });
      return checks;
    }
    if (result.data === null) {
      checks.push({
        id: 'rest',
        title: REST_TITLE,
        status: 'error',
        details: `HTTP ${result.status} від /rest/v1/${table} — перевір VITE_SUPABASE_URL і ключ`,
      });
      return checks;
    }
    if (checks.length === 0)
      checks.push({ id: 'rest', title: REST_TITLE, status: 'ok' });
    const names = result.data.map((row) => row.name);
    checks.push(
      checkNamesInConfig(
        table,
        title,
        names,
        source === null ? null : parse(source),
        hint,
      ),
    );
  }
  return checks;
}
