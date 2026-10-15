import { useMemo } from 'react';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { createTranslator } from 'simplycms/i18n';
import type { Translator } from 'simplycms/i18n';
import type { RouterContext } from 'simplycms/runtime';
import { localeOfHref } from './root-data';

/**
 * Транслятор для екранів, що рендеряться ПОЗА `I18nProvider`: `NotFound` і
 * `errorComponent` кореня замінюють `RootComponent`, тож `useT()` там кинув би.
 *
 * Мова — від вихідного pathname (`location.publicHref` до `rewrite`) через ту ж
 * `resolveRequestLocale`, що й усюди; набір мов — з контексту роутера. Тому `/en/x`
 * без маршруту показує англійську «не знайдено», а не мову магазину. Ні на що
 * з браузерних глобалів хук не спирається: на сервері вони не існують.
 */
export function useRequestTranslator(): Translator {
  const router = useRouter();
  const publicHref = useRouterState({ select: (s) => s.location.publicHref });
  const { locales }: RouterContext = router.options.context;
  return useMemo(
    () => createTranslator(localeOfHref(publicHref, locales), locales.primary),
    [publicHref, locales],
  );
}
