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
// Task 5 (Е4): запис довідників. Insert-стаб повертає «серверний» рядок
// з полем, якого оптимістичний рядок не має (`createdAt`) — так видно, що
// в кеш ліг саме write-back, а не оптимістичний драфт.
const SERVER_CREATED_AT = new Date('2026-10-03');
const dict = vi.hoisted(() => {
  const echoInsert = () =>
    vi.fn(async ({ data }: { data: { id: string }[] }) =>
      data.map((r) => ({ ...r, createdAt: new Date('2026-10-03') })),
    );
  return {
    listPriceTypes: vi.fn(async () => [] as unknown[]),
    listSectionProperties: vi.fn(async () => []),
    listPropertyOptions: vi.fn(async () => []),
    listSectionPropertyAssignments: vi.fn(async () => []),
    insertSections: echoInsert(),
    insertPriceTypes: echoInsert(),
    insertSectionProperties: echoInsert(),
    insertPropertyOptions: echoInsert(),
    insertSectionPropertyAssignments: echoInsert(),
    removePriceTypes: vi.fn(async () => ({ count: 1 })),
  };
});
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listProducts,
    listProductPrices,
    listSections,
    insertSections: dict.insertSections,
    listPriceTypes: dict.listPriceTypes,
    insertPriceTypes: dict.insertPriceTypes,
    removePriceTypes: dict.removePriceTypes,
    listSectionPropertyAssignments: dict.listSectionPropertyAssignments,
    insertSectionPropertyAssignments: dict.insertSectionPropertyAssignments,
    listSectionProperties: dict.listSectionProperties,
    insertSectionProperties: dict.insertSectionProperties,
    listPropertyOptions: dict.listPropertyOptions,
    insertPropertyOptions: dict.insertPropertyOptions,
  }),
);

import { createMutableServer } from './support/mutable-server';
import { getCollection } from '../registry';
import { productsCollection } from '../collections/products';
import { productPricesCollection } from '../collections/product-prices';
import { sectionsCollection } from '../collections/sections';
import { priceTypesCollection } from '../collections/price-types';
import { sectionPropertiesCollection } from '../collections/section-properties';
import { propertyOptionsCollection } from '../collections/property-options';
import { sectionPropertyAssignmentsCollection } from '../collections/section-property-assignments';

/** Мінімальна поверхня колекції, яку перевіряють тести запису. */
type WritableCollection = {
  preload(): Promise<void>;
  insert(rows: never): { isPersisted: { promise: Promise<unknown> } };
  delete(id: string): { isPersisted: { promise: Promise<unknown> } };
  has(id: string): boolean;
  get(id: string): { createdAt?: unknown } | undefined;
};
type AnyDef = { id: string; create: (qc: QueryClient) => unknown };
const writable = (def: AnyDef) =>
  getCollection(new QueryClient(), def) as unknown as WritableCollection;

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

  it.each([
    ['sections', sectionsCollection, 'insertSections', listSections],
    [
      'price_types',
      priceTypesCollection,
      'insertPriceTypes',
      dict.listPriceTypes,
    ],
    [
      'section_properties',
      sectionPropertiesCollection,
      'insertSectionProperties',
      dict.listSectionProperties,
    ],
    [
      'property_options',
      propertyOptionsCollection,
      'insertPropertyOptions',
      dict.listPropertyOptions,
    ],
    [
      'section_property_assignments',
      sectionPropertyAssignmentsCollection,
      'insertSectionPropertyAssignments',
      dict.listSectionPropertyAssignments,
    ],
  ] as const)(
    '%s: insert викликає serverFn з УСІМА рядками транзакції і пише серверний рядок',
    async (_e, def, fn, list) => {
      const insert = dict[fn];
      insert.mockClear();
      // Сервер зі станом (TSDB-1): запис ревалідує зріз, тож list мусить
      // бачити те, що зберіг insert, інакше ревалідація затре write-back.
      const srv = createMutableServer<{ id: string }>([]);
      list.mockImplementation(srv.list as never);
      insert.mockImplementation((async ({ data }: { data: { id: string }[] }) =>
        data.map((r) =>
          srv.upsert({ ...r, createdAt: SERVER_CREATED_AT } as never),
        )) as never);
      const qc = new QueryClient();
      const c = getCollection(qc, def as AnyDef) as WritableCollection;
      // 🔴 Е4-13: без живого спостерігача драфт on-demand колекції лишається
      // видимим до наступного sync-коміту (@tanstack/db 0.8.6,
      // collection/state.js:686-745); сторінки завжди підписані — тест
      // відтворює їхню форму (Е4-13).
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      );
      const { result } = renderHook(
        () => useLiveQuery((q) => q.from({ r: c as never })),
        { wrapper },
      );
      await waitFor(() => expect(result.current.isReady).toBe(true));
      const listCalls = list.mock.calls.length;
      const ids = [crypto.randomUUID(), crypto.randomUUID()];
      // Дві мутації в ОДНІЙ транзакції (масив в одному insert).
      const tx = c.insert(
        ids.map((id, i) => ({ id, name: `N${i}`, slug: `n-${i}` })) as never,
      );
      await tx.isPersisted.promise;
      expect(insert).toHaveBeenCalledTimes(1);
      expect(insert.mock.calls[0]![0].data.map((r) => r.id)).toEqual(ids);
      for (const id of ids) {
        expect(c.has(id), `рядок ${id} зник після персисту`).toBe(true);
        expect(
          c.get(id)?.createdAt,
          'write-back не доніс серверний рядок',
        ).toEqual(SERVER_CREATED_AT);
      }
      // ціна TSDB-1: +N запитів після запису (по одному на живий зріз;
      // eager-довідники — 0). Верхня межа, не рівність.
      expect(list.mock.calls.length).toBeLessThanOrEqual(listCalls + 1);
      // Результат: ревалідація віддала стан сервера, рядки на місці.
      await new Promise((r) => setTimeout(r, 50));
      for (const id of ids) {
        expect(c.has(id), `рядок ${id} зник після ревалідації`).toBe(true);
        expect(c.get(id)?.createdAt).toEqual(SERVER_CREATED_AT);
      }
      list.mockImplementation((async () => []) as never);
    },
  );

  it('price_types: delete іде через removePriceTypes (guarded), не фабричний', async () => {
    const id = crypto.randomUUID();
    dict.listPriceTypes.mockResolvedValueOnce([
      { id, name: 'Роздріб', code: 'retail', isDefault: false, sortOrder: 0 },
    ]);
    dict.removePriceTypes.mockClear();
    const c = writable(priceTypesCollection);
    await c.preload();
    expect(c.has(id)).toBe(true);
    const tx = c.delete(id);
    await tx.isPersisted.promise;
    expect(dict.removePriceTypes).toHaveBeenCalledTimes(1);
    expect(dict.removePriceTypes).toHaveBeenCalledWith({ data: [{ id }] });
    expect(c.has(id)).toBe(false);
  });

  it('price_types: відмова сервера відкочує оптимістичне видалення', async () => {
    const id = crypto.randomUUID();
    dict.listPriceTypes.mockResolvedValueOnce([
      { id, name: 'Опт', code: 'wholesale', isDefault: true, sortOrder: 0 },
    ]);
    dict.removePriceTypes.mockRejectedValueOnce(
      new Error('не можна видалити дефолтний тип ціни'),
    );
    const c = writable(priceTypesCollection);
    await c.preload();
    const tx = c.delete(id);
    expect(c.has(id), 'оптимістичне видалення не спрацювало').toBe(false);
    await expect(tx.isPersisted.promise).rejects.toThrow(/дефолтний/);
    expect(c.has(id), 'рядок не повернувся після відмови').toBe(true);
  });
});
