// Резолв view канонічних сторінок вітрини (контракт тем v3).

import type { ThemeViews } from 'simplycms/themes/types';
import { useActiveThemeModule } from '../shells/useActiveThemeModule';

/** Канонічні view, які контейнер віддає на перевизначення темі. */
export type CanonicalViews = {
  [K in keyof ThemeViews]?: NonNullable<ThemeViews[K]>;
};

/**
 * Тема перевизначає лише ті сторінки, які заявила у `views`; решта лишається
 * канонічною. Рантайм-fallback-у на «частково заявлений» view немає навмисно
 * (V3): або сторінка цілком темова й проходить conformance, або канонічна.
 *
 * 🔴 Повертає МАПУ, а не сам компонент, і споживається як
 * `<views.ProductDetail …/>`. Компонент, покладений у локальну змінну,
 * eslint `react-hooks/static-components` (правила React Compiler) вважає
 * створеним під час рендеру — через властивість обʼєкта видно, що
 * ідентичність стала, і перемонтажу піддерева не буде.
 */
export function useStorefrontViews<TViews extends CanonicalViews>(
  canonical: TViews,
): TViews {
  const themeViews = useActiveThemeModule().views;
  if (!themeViews) return canonical;

  return Object.fromEntries(
    Object.entries(canonical).map(([key, view]) => [
      key,
      themeViews[key as keyof ThemeViews] ?? view,
    ]),
  ) as TViews;
}
