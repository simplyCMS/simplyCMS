import { beforeEach, describe, expect, it, vi } from 'vitest';

// Кеш активної теми — спільний `activeThemeCache`; тут міряємо саме
// обгортку `loadActiveTheme`: скільки разів вона реально ходить у БД.
// Покоління — «БД» у змінній: мутація адмінки = збільшення лічильника.
let reads = 0;
const gens = vi.hoisted(() => ({ active: 0 }));

vi.mock('../../../site/cache-generations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../site/cache-generations')>()),
  readGenerations: async () => new Map([['active-theme', BigInt(gens.active)]]),
}));

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
  gens.active += 1;
});

describe('loadActiveTheme і спільний кеш теми', () => {
  it('повторне читання в межах TTL віддається з кешу', async () => {
    const first = await loadActiveTheme();
    expect(await loadActiveTheme()).toBe(first);
    expect(reads).toBe(1);
  });

  it('після збільшення покоління активної теми читання йде в БД', async () => {
    await loadActiveTheme();
    gens.active += 1;
    const next = await loadActiveTheme();
    expect(reads).toBe(2);
    expect(next?.name).toBe('theme-2');
  });
});
