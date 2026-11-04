import { resolveRequestLocale } from 'simplycms/domain';
import { loadUiCatalog, resolveUiLocale } from 'simplycms/i18n';
import { ThemeRegistry } from 'simplycms/themes/ThemeRegistry';
import { readActiveThemeName } from '../active-theme';
import { readClientLocaleSet } from '../locale/script';

/**
 * Прогрів клієнта ДО `hydrateRoot`: активна тема й частина `base` каталогу мови інтерфейсу
 * поточної сторінки.
 *
 * Навіщо: route-компоненти суспендяться на `use(ThemeRegistry.load(...))`, а корінь — на
 * `use(loadUiCatalog(...))`. Якщо проміс ще не виконаний під час першого клієнтського
 * рендеру, влиття стрімлених SSR-даних (`updateMatch`) б'є setState по ще не змонтованому
 * піддереву, а гідрація відкочується на клієнтський рендер. Каталог не потрібен `head()` —
 * той асинхронний і чекає сам; прогрів лише для компонентів.
 *
 * Мова — та сама `resolveRequestLocale`, що й у кореневому лоадері, від `location.pathname`
 * (на клієнті він іще з префіксом мови до `rewrite`). Для `/admin` це основна мова: свою
 * мову адмінка вантажить сама. Мови fallback тут немає — каталог ядра повний (§19.12(1)).
 *
 * Збій теми не блокує гідрацію (її обробить `use()`/error boundary). Збій каталогу НЕ
 * ковтається: його бачить `installStaleChunkGuard` (застарілий чанк після деплою).
 */
export async function prepareStorefrontHydration(): Promise<void> {
  const locales = readClientLocaleSet();
  const { locale } = resolveRequestLocale(window.location.pathname, locales);
  const ui = resolveUiLocale(locale, locales.primary);

  const theme = ThemeRegistry.load(readActiveThemeName() ?? 'default').catch(
    () => {
      // Помилку теми не блокуємо гідрацію: її покаже use()/error boundary.
    },
  );
  await Promise.all([theme, loadUiCatalog(ui, 'base')]);
}
