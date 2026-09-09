// Мʼяка перевірка форми `ThemeModule.views` (контракт тем v3).
//
// Винесено з `validateThemeModule` окремим модулем за каноном розміру файлу;
// семантику заявлених view (обовʼязкові реквізити, крайні стани) доводить не
// цей код, а conformance-kit (`simplycms/themes/conformance`) — тут лише
// форма, за ідіомою блоку `fonts`.

/**
 * Відомі ключі `ThemeModule.views` — рівно пʼять канонічних сторінок вітрини.
 * Список публічний: на ньому тримається і валідація форми тут, і перелік
 * фікстур conformance-kit-а.
 */
export const THEME_VIEW_KEYS = [
  'Home',
  'Catalog',
  'CatalogSection',
  'ProductDetail',
  'Cart',
] as const;

/**
 * Кидає, якщо `views` не мапа відомих сторінок у React-компоненти.
 * Тема без `views` сюди не доходить — поле опційне й валідне відсутнім.
 */
export function validateThemeViews(themeName: string, views: unknown): void {
  // 🔴 `typeof [] === 'object'`, а масив views — це не мапа сторінок:
  // відсікаємо явно.
  if (typeof views !== 'object' || views === null || Array.isArray(views)) {
    throw new Error(
      `[theme] "${themeName}": views мають бути обʼєктом { <сторінка>: React-компонент }`,
    );
  }

  for (const [key, view] of Object.entries(views)) {
    if (!(THEME_VIEW_KEYS as readonly string[]).includes(key)) {
      throw new Error(
        `[theme] "${themeName}": невідомий views.${key}; дозволені: ${THEME_VIEW_KEYS.join(', ')}`,
      );
    }
    if (typeof view !== 'function') {
      throw new Error(
        `[theme] "${themeName}": views.${key} має бути React-компонентом`,
      );
    }
  }
}
