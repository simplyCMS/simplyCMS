import type { PluginRow } from 'simplycms/admin-server';

/**
 * Рядок `listPlugins` для тестів. `displayName` — імʼя великими літерами,
 * щоб картку можна було знайти за доступною назвою групи.
 */
export function pluginRow(
  name: string,
  isActive: boolean,
  config: PluginRow['config'] = {},
): PluginRow {
  return {
    id: `id-${name}`,
    name,
    displayName: name.toUpperCase(),
    version: '1.0.0',
    description: null,
    author: null,
    isActive,
    config,
    updatedAt: new Date('2026-10-01T00:00:00Z'),
  };
}
