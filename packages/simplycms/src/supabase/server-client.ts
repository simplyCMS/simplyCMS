import { createServerClient } from '@supabase/ssr';
import { parseCookieHeader } from '@supabase/ssr';
import { getRequestHeader, setCookie } from '@tanstack/react-start/server';
import type { Database } from './database';
import { resolveSupabaseKeys } from './keys';

/**
 * Factory для створення серверного Supabase-клієнта в TanStack Start.
 *
 * Читає cookies через getRequestHeader('cookie') (request ALS-контекст),
 * записує через setCookie() — обовʼязково для session refresh
 * і token rotation @supabase/ssr.
 *
 * `cookieHeader` можна передати явно (напр. з request у global request
 * middleware), щоб не залежати від ALS getRequestHeader.
 *
 * Викликати лише всередині createServerFn handler або middleware.
 *
 * Контракт серверного env (спека CLI v1, §7): env читається ЛИШЕ з
 * `process.env` і ЛИШЕ в рантаймі (усередині фабрики, не на модуль-рівні) —
 * тому ротація Supabase-ключів = перезапуск процесу, без перезбірки.
 * `process.env` наповнюють `vite.config.ts` (dev) та `server.mjs` (prod).
 *
 * `Db` — типи БД магазину. За замовчуванням — baseline core-схеми пакета;
 * host зі своїми (плагінними) таблицями підставляє власний згенерований
 * `Database` із `supabase/types.ts`: `createServerSupabase<HostDatabase>()`.
 */
export function createServerSupabase<Db extends Database = Database>(
  cookieHeader?: string,
) {
  const { url, key } = resolveSupabaseKeys(process.env);

  return createServerClient<Db>(url, key, {
    cookies: {
      getAll() {
        const header = cookieHeader ?? getRequestHeader('cookie') ?? '';
        return parseCookieHeader(header).map(({ name, value }) => ({
          name,
          value: value ?? '',
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          setCookie(name, value, options);
        });
      },
    },
  });
}
