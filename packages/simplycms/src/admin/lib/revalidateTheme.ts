import { useCallback } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useT, type Translator } from 'simplycms/i18n';

/**
 * Скидання серверного кешу активної теми — ЄДИНА точка для всієї адмінки.
 *
 * Звертаємось по HTTP, а не імпортом обробника: ребро
 * `simplycms/admin → simplycms/storefront-routes` заборонене (T5 → T5).
 * Авторизація — cookie-сесія, guard `isAdmin` живе на боці роуту (403).
 *
 * Кидає на не-2xx і на мережевій помилці — мовчки ковтати відповідь не можна:
 * саме `catch {}` ховав те, що старий `/api/revalidate` взагалі не існує.
 */
export async function revalidateTheme(t: Translator): Promise<void> {
  const response = await fetch('/api/revalidate-theme', { method: 'POST' });

  if (!response.ok) {
    throw new Error(
      t('admin.common.revalidate.serverError', { status: response.status }),
    );
  }
}

/**
 * Скидання ОБОХ кешів активної теми — серверного і клієнтського.
 *
 * 🔴 Самого `revalidateTheme()` не досить, і це не теорія: каркасний роут
 * `_storefront` має `staleTime: 5 * 60_000`, тож після активації теми
 * TanStack Router до п'яти хвилин віддає закешований `themeName` із лоадера.
 * Перехід із адмінки на вітрину В МЕЖАХ застосунку показував стару тему, а
 * тост казав «Зміни застосовані на сайті» — тобто брехав. Ловилось лише
 * hard-refresh-ем (спіймано живою перевіркою 2026-08-04).
 *
 * Що фікс НЕ покриває свідомо: інша вкладка з уже відкритою вітриною
 * побачить зміну після власного перезавантаження або коли спливе її
 * `staleTime`. Синхронізація вкладок вимагала б каналу реального часу — для
 * перемикання теми це невиправдана складність.
 */
export function useRevalidateStorefront(): () => Promise<void> {
  const t = useT();
  const router = useRouter();

  return useCallback(async () => {
    await revalidateTheme(t);
    await router.invalidate();
  }, [router, t]);
}

/** Текст для toast-а, коли кеш вітрини скинути не вдалося (TTL — 5 хвилин). */
export function revalidateFailureDescription(
  t: Translator,
  error: unknown,
): string {
  const suffix = t('admin.common.revalidate.delay');
  return error instanceof Error ? `${error.message}. ${suffix}` : suffix;
}
