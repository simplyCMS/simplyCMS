// @vitest-environment jsdom
// (vitest.config: environment 'node' — без директиви renderHook упаде на
// document is not defined; патерн — як у on-demand-contract.test.tsx)
/**
 * Колекції каталогу (Task 5, Step 5): (1) push-down фільтра до
 * list-serverFn через subset-payload; (2) колекція БЕЗ `persistenceHandlers`
 * (ціни) — `insert` кидає, запис лише іменованою операцією; (3) eager
 * довідник (розділи) — preload тягне `listSections({ data: {} })` один раз.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { eq, useLiveQuery } from '@tanstack/react-db';
import type { ReactNode } from 'react';

// 🔴 vi.hoisted, не звичайний const (index.ts барелем тягне ВСІ файли
// колекцій — кожен імпортує щось із `simplycms/admin-server`; mock мусить
// нести повний набір імен, інакше нетипізовані undefined-биндінги.
const { listProducts, listProductPrices, listSections } = vi.hoisted(() => ({
  listProducts: vi.fn(async () => []),
  listProductPrices: vi.fn(async () => []),
  listSections: vi.fn(async () => []),
}));
vi.mock('simplycms/admin-server', () => ({
  listOrderStatuses: vi.fn(async () => []),
  insertOrderStatuses: vi.fn(),
  updateOrderStatuses: vi.fn(),
  removeOrderStatuses: vi.fn(),
  listProducts,
  insertProducts: vi.fn(),
  updateProducts: vi.fn(),
  removeProducts: vi.fn(),
  listProductModifications: vi.fn(async () => []),
  insertProductModifications: vi.fn(),
  updateProductModifications: vi.fn(),
  removeProductModifications: vi.fn(),
  listProductPrices,
  listStock: vi.fn(async () => []),
  listProductPropertyValues: vi.fn(async () => []),
  insertProductPropertyValues: vi.fn(),
  updateProductPropertyValues: vi.fn(),
  removeProductPropertyValues: vi.fn(),
  listModificationPropertyValues: vi.fn(async () => []),
  insertModificationPropertyValues: vi.fn(),
  updateModificationPropertyValues: vi.fn(),
  removeModificationPropertyValues: vi.fn(),
  listSections,
  listPriceTypes: vi.fn(async () => []),
  listSectionPropertyAssignments: vi.fn(async () => []),
  listSectionProperties: vi.fn(async () => []),
  listPropertyOptions: vi.fn(async () => []),
}));

import { getCollection } from '../registry';
import { productsCollection } from '../collections/products';
import { productPricesCollection } from '../collections/product-prices';
import { sectionsCollection } from '../collections/sections';

describe('колекції каталогу', () => {
  it('products: queryFn несе фільтр sectionId у subset-payload list-серверFn', async () => {
    const qc = new QueryClient();
    const products = getCollection(qc, productsCollection);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    listProducts.mockResolvedValueOnce([]);
    const { result } = renderHook(
      () =>
        useLiveQuery((q) =>
          q.from({ p: products }).where(({ p }) => eq(p.sectionId, 's1')),
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(listProducts).toHaveBeenCalledWith({
      data: {
        subset: expect.objectContaining({
          filters: [{ field: ['sectionId'], operator: 'eq', value: 's1' }],
        }),
      },
    });
  });

  it('ціни: collection.insert кидає (запис лише saveProductPrices)', () => {
    const c = getCollection(new QueryClient(), productPricesCollection);
    expect(() => c.insert({ id: 'x' } as never)).toThrow();
  });

  it('sections: eager — preload тягне listSections({ data: {} }) один раз', async () => {
    const c = getCollection(new QueryClient(), sectionsCollection);
    await c.preload();
    expect(listSections).toHaveBeenCalledTimes(1);
    expect(listSections).toHaveBeenCalledWith({ data: {} });
  });
});
