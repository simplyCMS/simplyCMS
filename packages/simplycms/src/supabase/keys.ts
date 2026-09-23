/**
 * Єдина точка резолву URL + публічного ключа Supabase.
 *
 * Supabase перейменував anon-ключ на publishable-ключ, тому пріоритет має
 * `VITE_SUPABASE_PUBLISHABLE_KEY`, а `VITE_SUPABASE_ANON_KEY` лишається
 * legacy-fallback-ом для вже налаштованих інсталяцій.
 */

/** Джерело змінних оточення (сумісне з `import.meta.env`). */
export interface SupabaseEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

/** Резолвнута пара для фабрик Supabase-клієнтів. */
export interface SupabaseKeys {
  readonly url: string;
  readonly key: string;
}

/**
 * Резолвить URL і публічний ключ Supabase з переданого env.
 *
 * @throws Error з `.name === 'SupabaseEnvMissingError'` якщо немає URL або
 *   жодного з ключів. Іменована помилка — контракт для
 *   `admin/layouts/LegacySupabaseBoundary` (К3-Е3 Step 0): легасі-сторінки
 *   адмінки ловлять саме це ім'я й рендерять заглушку замість падіння
 *   всієї адмінки.
 */
export function resolveSupabaseKeys(env: SupabaseEnv): SupabaseKeys {
  const url = env.VITE_SUPABASE_URL;
  // `||`, а не `??`: оголошена-але-порожня змінна в .env — це відсутній ключ,
  // інакше порожній publishable перекрив би робочий legacy anon.
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    const error = new Error(
      '[simplycms/supabase] Відсутні змінні оточення: VITE_SUPABASE_URL та ' +
        'VITE_SUPABASE_PUBLISHABLE_KEY (legacy fallback — VITE_SUPABASE_ANON_KEY) ' +
        'обовʼязкові.',
    );
    error.name = 'SupabaseEnvMissingError';
    throw error;
  }

  return { url, key };
}
