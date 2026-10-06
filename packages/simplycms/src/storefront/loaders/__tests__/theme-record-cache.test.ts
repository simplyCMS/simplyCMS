import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activeThemeCache } from 'simplycms/site';

// Кеш активної теми — спільний `activeThemeCache`; тут міряємо саме
// обгортку `loadActiveTheme`: скільки разів вона реально ходить у БД.
let reads = 0;

vi.mock('../db', () => ({
  withStorefrontDb: async () => {
    reads += 1;
    return {
      id: 'theme-1',
      name: `theme-${reads}`,
      display_name: 'Тема',
      version: '1.0.0',
      description: null,
      author: null,
      preview_image: null,
      is_active: true,
      settings: {},
      created_at: null,
      updated_at: null,
    };
  },
}));

import { loadActiveTheme } from '../theme-record';

beforeEach(() => {
  reads = 0;
  activeThemeCache.invalidate();
});

describe('loadActiveTheme і спільний кеш теми', () => {
  it('повторне читання в межах TTL віддається з кешу', async () => {
    const first = await loadActiveTheme();
    expect(await loadActiveTheme()).toBe(first);
    expect(reads).toBe(1);
  });

  it('після activeThemeCache.invalidate() читання йде в БД', async () => {
    await loadActiveTheme();
    activeThemeCache.invalidate();
    const next = await loadActiveTheme();
    expect(reads).toBe(2);
    expect(next?.name).toBe('theme-2');
  });
});
