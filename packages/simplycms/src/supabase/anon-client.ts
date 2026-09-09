import { createClient } from '@supabase/supabase-js';
import type { Database } from './database';
import { resolveSupabaseKeys } from './keys';

/**
 * Анонімний Supabase-клієнт для публічних запитів без cookies.
 *
 * Використовується для кешованих server-side запитів (unstable_cache),
 * де cookie-based клієнт неприпустимий (кеш — cross-request).
 * Підходить для таблиць з RLS policy "viewable by everyone".
 *
 * НЕ використовуй для запитів що потребують авторизації.
 *
 * Контракт серверного env (спека CLI v1, §7): env читається ЛИШЕ з
 * `process.env` і ЛИШЕ в рантаймі (усередині фабрики, не на модуль-рівні) —
 * ротація ключів = перезапуск процесу, без перезбірки. У клієнтський бандл
 * цьому модулю не можна (голий `process.env` упаде в браузері) — витік
 * ловить Gate C пілота (`SERVER_PAYLOAD`).
 *
 * `Db` — типи БД магазину. За замовчуванням — baseline core-схеми пакета;
 * host зі своїми (плагінними) таблицями підставляє власний `Database`.
 */
export function createAnonSupabaseClient<Db extends Database = Database>() {
  const { url, key } = resolveSupabaseKeys(process.env);

  return createClient<Db>(url, key);
}
