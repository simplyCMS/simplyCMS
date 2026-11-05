import { useMemo } from 'react';
import { useRouteContext, useRouterState } from '@tanstack/react-router';
import {
  PLATFORM_FALLBACK_UI,
  createTranslator,
  resolveUiLocalePair,
  useUiCatalogs,
} from 'simplycms/i18n';
import type { Translator } from 'simplycms/i18n';
import type { RouterContext } from 'simplycms/runtime';
import { NO_LOCALES, localeOfHref } from 'simplycms/domain';

const BASE = ['base'] as const;

/**
 * Транслятор для екранів, що рендеряться ПОЗА `I18nProvider`: `NotFound` і
 * `errorComponent` кореня замінюють `RootComponent`, тож `useT()` там кинув би.
 *
 * Мова — від вихідного pathname (`location.publicHref` до `rewrite`) через ту ж
 * `resolveRequestLocale`, що й усюди; набір мов — з контексту кореневого матчу. Тому `/en/x`
 * без маршруту показує англійську «не знайдено», а не мову магазину. Ні на що
 * з браузерних глобалів хук не спирається: на сервері вони не існують.
 */
export function useRequestTranslator(): Translator {
  const publicHref = useRouterState({ select: (s) => s.location.publicHref });
  // Контекст матчу, а не `router.options`: `beforeLoad` кореня міг дочитати
  // набір мов, а опції роутера бачать лише початковий.
  const { locales }: RouterContext = useRouteContext({ strict: false });
  // Екран помилки говорить мовою ІНТЕРФЕЙСУ: нормально це мова сторінки, а `/pl/x` опублікованої мови, пакет якої зник
  // (деградований режим, §19.15), — основною.
  // Без мовного контексту (`beforeLoad` кореня впав, `NO_LOCALES`) пара не будується:
  // `resolveUiLocalePair('und', …)` кинула б усередині самого екрана помилки.
  const ui = useMemo(
    () =>
      locales === NO_LOCALES
        ? { locale: PLATFORM_FALLBACK_UI }
        : resolveUiLocalePair(
            localeOfHref(publicHref, locales),
            locales.primary,
          ),
    [publicHref, locales],
  );
  // Корінь міг упасти ДО завантаження каталогу, тож хук має право призупинитись (а не
  // кинути), поки `base` дозавантажується.
  const catalogs = useUiCatalogs(ui.locale, BASE);
  return useMemo(
    () => createTranslator(catalogs, ui.locale),
    [catalogs, ui.locale],
  );
}
