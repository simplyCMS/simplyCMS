// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import type { LocaleSet } from '../locale/resolve';
import { routeTree } from '../../../../../src/routeTree.gen';

const getProduct = vi.hoisted(() => vi.fn(async () => null));
const getActiveTheme = vi.hoisted(() => vi.fn(async () => null));
vi.mock('../server/themes', () => ({ getActiveTheme }));
vi.mock('../server/products', () => ({
  getProduct,
  getMovedProductPath: async () => null,
  getModificationData: async () => ({ propertyValues: {}, stock: {} }),
}));

import { loadEntityPage } from '../pages/entity-route';

/**
 * Роут сутності не перехоплює чужі префікси (фікс-раунд, перевірка C): адреса сутності —
 * ОДИН сегмент, тому `/admin/<щось>`, `/api/…`, `/auth/…` поводяться як до цього роуту:
 * без оболонки вітрини, без лоадера сутності й без запиту до `url_paths`. Перевірка
 * на справжньому згенерованому дереві роутів.
 */
const LOCALES: LocaleSet = { primary: 'uk', published: ['uk'], known: ['uk'] };

const matched = (url: string): string[] => {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [url] }),
    context: {} as never,
  });
  return router.matchRoutes(router.latestLocation).map((m) => m.routeId);
};

describe('роут сутності: що він ловить', () => {
  it.each(['/admin/nope', '/admin/nope/deeper'])(
    '%s — як і до роуту сутності: лише адмінка, без оболонки вітрини',
    (url) => {
      expect(matched(url)).toEqual(['__root__', '/admin']);
    },
  );

  it.each(['/api/nope/x', '/auth/nope', '/profile/nope/x', '/foo/bar'])(
    '%s (кілька сегментів): лоадер сутності й запит до url_paths НЕ виконуються',
    async (url) => {
      const router = createRouter({
        routeTree,
        history: createMemoryHistory({ initialEntries: [url] }),
        context: { locales: LOCALES } as never,
      });
      await router.load();
      expect(getProduct).not.toHaveBeenCalled();
    },
  );

  it('односегментна адреса — роут сутності; статичні роути специфічніші', () => {
    expect(matched('/foo')).toContain('/_storefront/$path');
    expect(matched('/cart')).not.toContain('/_storefront/$path');
    expect(matched('/catalog')).not.toContain('/_storefront/$path');
    expect(matched('/admin')).not.toContain('/_storefront/$path');
  });

  it('службовий або не-slug сегмент — 404 лоадера БЕЗ запиту до БД', async () => {
    for (const path of ['my', 'cart', 'Foo', 'a_b']) {
      await expect(
        loadEntityPage({ path, publicHref: `/${path}`, locales: LOCALES }),
      ).rejects.toMatchObject({ isNotFound: true });
    }
    expect(getProduct).not.toHaveBeenCalled();
  });
});
