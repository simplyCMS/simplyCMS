import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Р29: кожен публічний serverFn вітрини, що віддає `product_prices`, іде
 * через `withViewerDb` (глядач із сесії + `private, no-store` залогіненому) і
 * передає лоадеру САМЕ набір видів, який той дав. Повернення одного з них на
 * `withStorefrontDb` знову віддало б гостю всі прайси — і тест це ловить.
 */
const VIEWER = { ids: ['retail'] };
const TX = { tx: true };

const loaders = vi.hoisted(() => ({
  withViewerDb: vi.fn(),
  withStorefrontDb: vi.fn(),
  loadProduct: vi.fn(),
  loadCatalogProducts: vi.fn(),
  loadPropertyOption: vi.fn(),
  loadHomePageData: vi.fn(),
  loadHomeProducts: vi.fn(),
  loadOneSectionProducts: vi.fn(),
}));

// Білдер — тотожність над хендлером: перевіряємо тіло serverFn, не RPC Start.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      handler: (fn: unknown) => fn,
    };
    return builder;
  },
}));
vi.mock('simplycms/storefront/loaders', () => loaders);

import { getProduct } from '../server/products';
import { getCatalogProducts } from '../server/catalog';
import { getPropertyOption } from '../server/properties';
import {
  getFeaturedProducts,
  getHomePageData,
  getNewProducts,
  getSectionProducts,
} from '../server/home';

type Call = (arg: { data?: unknown }) => Promise<unknown>;
const call = (fn: unknown, data?: unknown) => (fn as Call)({ data });
const SECTION = { id: 's1', name: 'Панелі', slug: 'paneli' };

beforeEach(() => {
  for (const fn of Object.values(loaders)) fn.mockReset();
  loaders.withViewerDb.mockImplementation(
    async (fn: (db: unknown, viewer: unknown) => unknown) => fn(TX, VIEWER),
  );
});

describe('serverFn вітрини з цінами — через withViewerDb (Р29)', () => {
  it.each([
    [
      'getProduct',
      () => call(getProduct, { slug: 'x' }),
      'loadProduct',
      [TX, 'x', VIEWER],
    ],
    [
      'getCatalogProducts',
      () => call(getCatalogProducts, { sectionId: 's1' }),
      'loadCatalogProducts',
      [TX, VIEWER, 's1'],
    ],
    [
      'getPropertyOption',
      () => call(getPropertyOption, { propertySlug: 'p', optionSlug: 'o' }),
      'loadPropertyOption',
      [TX, 'p', 'o', VIEWER],
    ],
    [
      'getHomePageData',
      () => call(getHomePageData),
      'loadHomePageData',
      [TX, VIEWER],
    ],
    [
      'getFeaturedProducts',
      () => call(getFeaturedProducts),
      'loadHomeProducts',
      [TX, true, VIEWER],
    ],
    [
      'getNewProducts',
      () => call(getNewProducts),
      'loadHomeProducts',
      [TX, false, VIEWER],
    ],
    [
      'getSectionProducts',
      () => call(getSectionProducts, SECTION),
      'loadOneSectionProducts',
      [TX, SECTION, VIEWER],
    ],
  ] as const)('%s', async (_name, run, loader, args) => {
    await run();
    expect(loaders.withViewerDb).toHaveBeenCalledTimes(1);
    expect(loaders.withStorefrontDb).not.toHaveBeenCalled();
    expect(loaders[loader]).toHaveBeenCalledWith(...args);
  });
});
