import type { ThemeRow } from 'simplycms/admin-server';

/**
 * Рядок `listThemes` для тестів. `displayName` — імʼя великими літерами,
 * щоб картку можна було знайти за доступною назвою групи.
 */
export function themeRow(
  name: string,
  isActive: boolean,
  settings: ThemeRow['settings'] = {},
): ThemeRow {
  return {
    id: `id-${name}`,
    name,
    displayName: name.toUpperCase(),
    version: '1.0.0',
    description: null,
    author: null,
    previewImage: null,
    isActive,
    settings,
  };
}
