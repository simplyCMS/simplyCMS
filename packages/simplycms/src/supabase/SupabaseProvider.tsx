import React, { createContext, useContext, useState } from 'react';
import type { Database } from './database';
import {
  getSupabaseBrowserClient,
  type SupabaseClient,
} from './browser-client';

// DI-контекст браузерного Supabase-клієнта (замінює глобальний singleton).
// Клієнт інжектиться рантаймом/застосунком; хуки беруть його через useSupabaseClient().
// Контекст зберігає клієнт у baseline-типізації; звуження до host-типів —
// параметр `Db` на межі провайдера/хука (див. README, «Generic-місток»).
const SupabaseContext = createContext<SupabaseClient | null>(null);

/** Браузерний клієнт для SSR-парності повертаємо лише на клієнті (як було з singleton). */
function resolveDefaultClient(): SupabaseClient {
  return typeof window !== 'undefined'
    ? getSupabaseBrowserClient()
    : (null as unknown as SupabaseClient);
}

export function SupabaseProvider<Db extends Database = Database>({
  client,
  children,
}: {
  client?: SupabaseClient<Db>;
  children: React.ReactNode;
}) {
  const [value] = useState<SupabaseClient>(
    () =>
      (client as unknown as SupabaseClient | undefined) ??
      resolveDefaultClient(),
  );
  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
}

/**
 * Доступ до Supabase-клієнта через контекст.
 * Якщо провайдера немає (SSR/частковий рендер) — відкат до браузерної фабрики,
 * що зберігає попередню поведінку та дозволяє мокати клієнт у тестах.
 *
 * `Db` — типи БД магазину: host передає свій `Database`, щоб бачити плагінні
 * таблиці; пакети ядра лишаються на baseline (дефолтний параметр).
 */
export function useSupabaseClient<
  Db extends Database = Database,
>(): SupabaseClient<Db> {
  const ctx = useContext(SupabaseContext);
  return (ctx ?? resolveDefaultClient()) as unknown as SupabaseClient<Db>;
}
