// @vitest-environment jsdom
import { isRedirect, isNotFound } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LocaleSet } from '../locale/resolve';

const getProduct = vi.hoisted(() => vi.fn(async () => null));
type Moved = { path: string; mod: string | null } | null;
const getMovedProductPath = vi.hoisted(() =>
  vi.fn(async (): Promise<Moved> => ({ path: 'new-path', mod: null })),
);
vi.mock('../server/products', () => ({ getProduct, getMovedProductPath }));

import { loadEntityPage } from '../pages/entity-route';

/**
 * Фінальне рев'ю М1 (B M2): клієнтська навігація на ІСТОРИЧНУ адресу (кеш лістингу, «назад»)
 * дає редирект на поточну, а не «Товар не знайдено»: нормалізація з 301 працює лише на
 * серверному GET. На сервері другого запиту немає — історію вже перевірила нормалізація.
 */
const LOCALES: LocaleSet = {
  primary: 'uk',
  published: ['uk', 'en'],
  known: ['uk', 'en'],
};
const load = (href: string, search?: Record<string, unknown>) =>
  loadEntityPage({
    path: 'old-path',
    publicHref: href,
    locales: LOCALES,
    search,
  }).catch((e: unknown) => e);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('сторінка сутності: історична адреса на клієнтській навігації', () => {
  it('інша мова → редирект на поточну адресу цієї мови', async () => {
    const out = await load('/en/old-path');
    expect(isRedirect(out)).toBe(true);
    expect((out as { options: { href: string } }).options.href).toBe(
      '/en/new-path',
    );
    expect(getMovedProductPath).toHaveBeenCalledWith({
      data: { locale: 'en', path: 'old-path', mod: null },
    });
  });

  it('основна мова → редирект без префікса', async () => {
    const out = await load('/old-path');
    expect((out as { options: { href: string } }).options.href).toBe(
      '/new-path',
    );
  });

  it('query зберігається, історичний ?mod= — поточним токеном (те саме правило, що сервер, N2)', async () => {
    getMovedProductPath.mockResolvedValueOnce({ path: 'new-path', mod: 'red' });
    const out = await load('/en/old-path?mod=old-red&utm=x', {
      mod: 'old-red',
      utm: 'x',
    });
    expect(getMovedProductPath).toHaveBeenCalledWith({
      data: { locale: 'en', path: 'old-path', mod: 'old-red' },
    });
    expect((out as { options: { href: string } }).options.href).toBe(
      '/en/new-path?mod=red&utm=x',
    );
  });

  it('адреса невідома й в історії → 404', async () => {
    getMovedProductPath.mockResolvedValueOnce(null);
    expect(isNotFound(await load('/old-path'))).toBe(true);
  });

  it('на сервері (без window) — 404 без другого запиту', async () => {
    vi.stubGlobal('window', undefined);
    expect(isNotFound(await load('/old-path'))).toBe(true);
    expect(getMovedProductPath).not.toHaveBeenCalled();
  });
});
