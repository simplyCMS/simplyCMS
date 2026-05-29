import React, { createContext, useContext, useState } from "react";
import { getSupabaseBrowserClient, type SupabaseClient } from "./client";

// DI-контекст браузерного Supabase-клієнта (замінює глобальний singleton).
// Клієнт інжектиться рантаймом/застосунком; хуки беруть його через useSupabaseClient().
const SupabaseContext = createContext<SupabaseClient | null>(null);

/** Браузерний клієнт для SSR-парності повертаємо лише на клієнті (як було з singleton). */
function resolveDefaultClient(): SupabaseClient {
  return typeof window !== "undefined"
    ? getSupabaseBrowserClient()
    : (null as unknown as SupabaseClient);
}

export function SupabaseProvider({
  client,
  children,
}: {
  client?: SupabaseClient;
  children: React.ReactNode;
}) {
  const [value] = useState<SupabaseClient>(() => client ?? resolveDefaultClient());
  return (
    <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>
  );
}

/**
 * Доступ до Supabase-клієнта через контекст.
 * Якщо провайдера немає (SSR/частковий рендер) — відкат до браузерної фабрики,
 * що зберігає попередню поведінку та дозволяє мокати клієнт у тестах.
 */
export function useSupabaseClient(): SupabaseClient {
  const ctx = useContext(SupabaseContext);
  return ctx ?? resolveDefaultClient();
}
