/**
 * Скидання серверного кешу активної теми — ЄДИНА точка для всієї адмінки.
 *
 * Звертаємось по HTTP, а не імпортом обробника: ребро
 * `@simplycms/admin → @simplycms/storefront-routes` заборонене (T5 → T5).
 * Авторизація — cookie-сесія, guard `isAdmin` живе на боці роуту (403).
 *
 * Кидає на не-2xx і на мережевій помилці — мовчки ковтати відповідь не можна:
 * саме `catch {}` ховав те, що старий `/api/revalidate` взагалі не існує.
 */
export async function revalidateTheme(): Promise<void> {
  const response = await fetch('/api/revalidate-theme', { method: 'POST' });

  if (!response.ok) {
    throw new Error(`Сервер відповів ${response.status}`);
  }
}

/** Текст для toast-а, коли кеш вітрини скинути не вдалося (TTL — 5 хвилин). */
export function revalidateFailureDescription(error: unknown): string {
  const suffix = 'Зміни зʼявляться протягом 5 хвилин.';
  return error instanceof Error ? `${error.message}. ${suffix}` : suffix;
}
