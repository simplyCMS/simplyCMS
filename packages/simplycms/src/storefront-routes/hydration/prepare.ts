import { ThemeRegistry } from 'simplycms/themes/ThemeRegistry';
import { readActiveThemeName } from '../active-theme';

/**
 * Прогрів клієнта ДО `hydrateRoot`: активна тема.
 *
 * Інакше route-компоненти суспендяться на `use(ThemeRegistry.load(...))` під час першого
 * клієнтського рендеру, і влиття стрімлених SSR-даних (`updateMatch`) б'є setState по ще не
 * змонтованому піддереву.
 *
 * Каталог `base` тут НЕ прогрівається (виміряно маркером ідентичності SSR-вузлів у
 * `live:smoke`): `head` маршрутів чекає `loadTranslator` усередині `router.hydrate()`, а
 * корінь без Suspense-межі, призупинившись, лишає SSR-DOM.
 *
 * Збій теми не блокує гідрацію: її обробить `use()`/error boundary.
 */
export async function prepareStorefrontHydration(): Promise<void> {
  await ThemeRegistry.load(readActiveThemeName() ?? 'default').catch(() => {
    // Помилку теми не блокуємо гідрацію: її покаже use()/error boundary.
  });
}
