// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from 'simplycms/i18n';
import type { ReactNode } from 'react';
import { AGGREGATE } from 'simplycms/contracts/entities';
import { catalogKeys, priceViewKey } from 'simplycms/react-query';
import { useSectionProducts } from '../pages/home/queries';

// Авто-cleanup RTL у репо вимкнено (globals: false) — знімаємо дерево самі.
afterEach(cleanup);

/**
 * Регрес фази 3 (пункт G): `useSectionProducts` (карусель головної) і
 * `useCatalogProductsQuery` (сторінка розділу) раніше ділили один сирий
 * ключ `['section-products', sectionId]` — кеш однієї сторінки міг
 * підмінити дані іншої для того самого розділу. Доводимо саме ізоляцію
 * кешу: рядок, покладений під ЧИННИЙ ключ сторінки розділу, не повинен
 * прилетіти як дані хука головної — той тепер живе під
 * `catalogKeys.sectionProducts(...)`.
 *
 * 🔴 Сентинел (`CATALOG_PAGE_SECTION_KEY`) — не історичний літерал
 * `['section-products', sectionId]`: тієї форми в коді вже немає, і тест
 * з нею довів би нуль (нічого не пише під неіснуючий ключ — звісно,
 * колізії нема). Сентинел відтворює ФОРМУЛУ, яку сьогодні рахує
 * `useCatalogProductsQuery` для сторінки розділу
 * (`pages/catalog/useCatalogProductsQuery.ts`) —
 * `[...AGGREGATE.catalogProducts.key, 'section', sectionId]`. Від ключа
 * каруселі (`catalogKeys.sectionProducts`, префікс `ENTITY.products`) він
 * тепер відрізняється ще на кроці 0 (`'catalog-products'` проти
 * `'products'`) — сильніша ізоляція, ніж хвостовий `null`, яким
 * розрізнялись форми до фіксу агрегату (фінальне рев'ю Е1а).
 */

const SECTION_ID = 'sec-1';

/** Чинний ключ сторінки розділу — див. коментар вище. */
const CATALOG_PAGE_SECTION_KEY = priceViewKey(
  [...AGGREGATE.catalogProducts.key, 'section', SECTION_ID],
  'guest',
);

/**
 * 🔴 Мокається серверна функція, а не клієнт БД: карусель головної
 * більше не ходить у базу з браузера — вона кличе `getSectionProducts`.
 */
const freshRow = {
  id: 'fresh-product',
  name: 'Свіжий товар',
  slug: 'fresh-product',
  images: [],
  short_description: null,
  stock_status: 'in_stock',
  section: { slug: 'panels' },
};

// Р29: вид цін глядача — гість (без AuthProvider сесія вічно «в дорозі»).
vi.mock('simplycms/core/hooks/useViewerPriceKey', () => ({
  useViewerPriceKey: () => 'guest',
}));

vi.mock('../server/home', () => ({
  getFeaturedProducts: vi.fn(),
  getNewProducts: vi.fn(),
  getRootSections: vi.fn(),
  getSectionProducts: vi.fn(async () => [freshRow]),
}));

describe('useSectionProducts — не ділить ключ кешу з каталогом розділу', () => {
  it('ігнорує дані, покладені під ключ сторінки розділу каталогу', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // Симулюємо кеш сторінки розділу каталогу під ЧИННИМ ключем.
    const catalogPageCacheSentinel = [{ id: 'catalog-page-product' }];
    qc.setQueryData(CATALOG_PAGE_SECTION_KEY, catalogPageCacheSentinel);

    function wrapper({ children }: { children: ReactNode }) {
      return (
        <I18nProvider locale="uk">
          <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        </I18nProvider>
      );
    }

    const { result } = renderHook(
      () =>
        useSectionProducts({
          id: SECTION_ID,
          name: 'Панелі',
          slug: 'panels',
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Дані хука — свої (fetched), а не підмінені сентинелом каталогу.
    expect(result.current.data).toEqual([freshRow]);
    expect(result.current.data).not.toEqual(catalogPageCacheSentinel);

    // Іменований ключ хука — фабрика react-query, не сирий рядок каталогу.
    expect(
      qc.getQueryData(
        priceViewKey(catalogKeys.sectionProducts(SECTION_ID, 'uk'), 'guest'),
      ),
    ).toEqual(result.current.data);
  });
});
