import type { LocaleSet } from 'simplycms/contracts';
import { NO_LOCALES, localeOfHref } from 'simplycms/domain';
import { loadUiCatalog, resolveUiLocalePair } from 'simplycms/i18n';
import { loadLocaleSetLazily } from './context';
import { getStorefrontRoot } from '../server/root';
import type { StorefrontRootData } from '../head/head';

/**
 * `beforeLoad` кореня: якщо запит прийшов без набору мов (нормалізація не
 * читала кеш мов — невітринний шлях, на якому все ж рендериться сторінка:
 * 404 під `/api`, `/assets`, адмінка), дочитати його з кешу мов. Контекст
 * роутера отримує справжній набір, тож лоадер і екрани помилок говорять мовою.
 */
export async function resolveRouterLocales(
  locales: LocaleSet,
): Promise<LocaleSet> {
  return locales === NO_LOCALES ? loadLocaleSetLazily() : locales;
}

/**
 * Дані кореня вітрини для лоадера `__root.tsx`: те, що віддає серверний
 * `getStorefrontRoot`, плюс мова сторінки (контент), мова інтерфейсу з моста
 * `resolveUiLocale` і набір опублікованих мов (для `<html lang>`,
 * `window.__SCMS_LOCALES__` і майбутніх hreflang).
 *
 * Набір мов приходить з контексту роутера, а не з ALS: лоадер на клієнті не
 * має серверного контексту, а на сервері не повинен залежати від нього.
 */
export async function loadStorefrontRoot(
  publicHref: string,
  locales: LocaleSet,
): Promise<StorefrontRootData> {
  if (locales === NO_LOCALES) {
    throw new Error(
      'simplycms: the root loader ran without a storefront locale set — the ' +
        'host root route must call resolveRouterLocales in beforeLoad',
    );
  }
  const locale = localeOfHref(publicHref, locales);
  // Інтерфейс — окрема вісь (І41): нормально інтерфейс тієї ж мови (опублікована мова має пакет,
  // §19.15), а в деградованому режимі (пакет `pl` зник) береться за основною. `<html lang>` і дані сторінки лишаються на `locale`.
  const ui = resolveUiLocalePair(locale, locales.primary);
  // Лоадер біжить і на SSR, і на клієнтській навігації: частину `base` мови інтерфейсу треба
  // дочекатись тут, щоб `use` у корені знайшов її вже завантаженою (Д2). Мови fallback тут
  // немає: каталог ядра повний для кожної мови (спека §19.12(1)), тож клієнт тягне один
  // каталог ядра; `ui.fallback` лишається в даних кореня для тем і плагінів.
  await loadUiCatalog(ui.locale, 'base');
  return {
    ...(await getStorefrontRoot()),
    locale,
    ui,
    languages: { primary: locales.primary, published: locales.published },
  };
}
