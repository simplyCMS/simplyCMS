// @vitest-environment jsdom
/**
 * `useModifications` (Task 8, Step 3): (а) Review Focus 5 — create з
 * `isDefault: true` → спершу `insertProductModifications`, ПОТІМ
 * `setDefaultProductModification({ data: { id } })` (isDefault readonly
 * у ресурсі, дефолт ставиться окремою операцією); (б) write-back
 * `applyDefault` оновлює прапорець у ДВОХ рядках колекції (знятий і
 * поставлений); (в) sortOrder нового = max+1 навіть коли наявні мають
 * однакові sortOrder (легасі писав sort_order індексом масиву); (г) рев'ю
 * C6 item 1 — `update()` НЕ переписує `stockStatus`, щойно виставлений
 * `ModificationStatusControl` напряму в живому рядку.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const {
  insertProductModifications,
  updateProductModifications,
  removeProductModifications,
  listProductModifications,
  setDefaultProductModification,
  reorderProductModification,
} = vi.hoisted(() => ({
  insertProductModifications: vi.fn(
    async ({ data }: { data: Array<{ id: string }> }) => data,
  ),
  updateProductModifications: vi.fn(),
  removeProductModifications: vi.fn(),
  listProductModifications: vi.fn(async () => [] as unknown[]),
  setDefaultProductModification: vi.fn(),
  reorderProductModification: vi.fn(),
}));
vi.mock('simplycms/admin-server', () => ({
  listOrderStatuses: vi.fn(async () => []),
  insertOrderStatuses: vi.fn(),
  updateOrderStatuses: vi.fn(),
  removeOrderStatuses: vi.fn(),
  setDefaultOrderStatus: vi.fn(),
  reorderOrderStatus: vi.fn(),
  listProducts: vi.fn(async () => []),
  insertProducts: vi.fn(),
  updateProducts: vi.fn(),
  removeProducts: vi.fn(),
  listProductModifications,
  insertProductModifications,
  updateProductModifications,
  removeProductModifications,
  setDefaultProductModification,
  reorderProductModification,
  listProductPrices: vi.fn(async () => []),
  saveProductPrices: vi.fn(),
  listStock: vi.fn(async () => []),
  saveStock: vi.fn(),
  listProductPropertyValues: vi.fn(async () => []),
  insertProductPropertyValues: vi.fn(),
  updateProductPropertyValues: vi.fn(),
  removeProductPropertyValues: vi.fn(),
  listModificationPropertyValues: vi.fn(async () => []),
  insertModificationPropertyValues: vi.fn(),
  updateModificationPropertyValues: vi.fn(),
  removeModificationPropertyValues: vi.fn(),
  listSections: vi.fn(async () => []),
  listPriceTypes: vi.fn(async () => []),
  listSectionPropertyAssignments: vi.fn(async () => []),
  listSectionProperties: vi.fn(async () => []),
  listPropertyOptions: vi.fn(async () => []),
}));

import {
  productModificationsCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useModifications } from '../useModifications';
import type { ModificationFormValues } from '../modification-form-schema';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const FORM: ModificationFormValues = {
  name: '100W',
  slug: '100w',
  sku: 'SP-100W',
  stockStatus: 'in_stock',
  isDefault: false,
  images: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe('useModifications', () => {
  it('(а) create з isDefault: true — insert, ПОТІМ setDefault (у цьому порядку)', async () => {
    const { result } = renderHook(() => useModifications('p1'), { wrapper });
    // Колекція мусить бути в ready-стані ДО insert (виміряно —
    // `useProductSave.create`, той самий клас, що спричинив `preload()` у
    // `useStock.save`): useLiveQuery цього хука стартує sync асинхронно.
    await waitFor(() => expect(result.current.modifications).toEqual([]));

    const callOrder: string[] = [];
    insertProductModifications.mockImplementationOnce(async ({ data }) => {
      callOrder.push('insert');
      return data;
    });
    setDefaultProductModification.mockImplementationOnce(async () => {
      callOrder.push('setDefault');
      return { rows: [] };
    });

    await result.current.create({ ...FORM, isDefault: true });

    expect(callOrder).toEqual(['insert', 'setDefault']);
    expect(insertProductModifications).toHaveBeenCalledTimes(1);
    const [{ data }] = insertProductModifications.mock.calls[0] as [
      { data: Array<{ id: string; isDefault: boolean }> },
    ];
    // Рядок insert несе isDefault: false — сервер його все одно strip-ить
    // (readonly), але клієнт не мусить брехати про стан ДО setDefault.
    expect(data[0]?.isDefault).toBe(false);
    expect(setDefaultProductModification).toHaveBeenCalledWith({
      data: { id: expect.any(String) },
    });
  });

  it('(б) applyDefault: write-back оновлює ОБИДВА рядки (знятий і поставлений)', async () => {
    listProductModifications.mockResolvedValueOnce([
      {
        id: 'm1',
        productId: 'p1',
        slug: 'a',
        name: 'A',
        sku: null,
        isDefault: true,
        images: [],
        sortOrder: 0,
        stockStatus: 'in_stock',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'm2',
        productId: 'p1',
        slug: 'b',
        name: 'B',
        sku: null,
        isDefault: false,
        images: [],
        sortOrder: 1,
        stockStatus: 'in_stock',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    setDefaultProductModification.mockResolvedValueOnce({
      rows: [
        { id: 'm1', isDefault: false },
        { id: 'm2', isDefault: true },
      ],
    });

    const { result } = renderHook(() => useModifications('p1'), { wrapper });
    await waitFor(() => expect(result.current.modifications).toHaveLength(2));

    await result.current.applyDefault('m2');

    await waitFor(() => {
      const byId = new Map(
        (result.current.modifications ?? []).map((m) => [m.id, m]),
      );
      expect(byId.get('m1')?.isDefault).toBe(false);
      expect(byId.get('m2')?.isDefault).toBe(true);
    });
  });

  it('(в) sortOrder нового = max+1 навіть коли наявні мають однакові sortOrder', async () => {
    listProductModifications.mockResolvedValueOnce([
      {
        id: 'm1',
        productId: 'p1',
        slug: 'a',
        name: 'A',
        sku: null,
        isDefault: false,
        images: [],
        sortOrder: 3,
        stockStatus: 'in_stock',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'm2',
        productId: 'p1',
        slug: 'b',
        name: 'B',
        sku: null,
        isDefault: false,
        images: [],
        sortOrder: 3,
        stockStatus: 'in_stock',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const { result } = renderHook(() => useModifications('p1'), { wrapper });
    await waitFor(() => expect(result.current.modifications).toHaveLength(2));

    await result.current.create(FORM);

    const [{ data }] = insertProductModifications.mock.calls[0] as [
      { data: Array<{ id: string; sortOrder: number }> },
    ];
    expect(data[0]?.sortOrder).toBe(4);
  });

  it('(г) update() не переписує stockStatus, виставлений ModificationStatusControl напряму', async () => {
    const row = {
      id: 'm1',
      productId: 'p1',
      slug: 'a',
      name: 'A',
      sku: null as string | null,
      isDefault: false,
      images: [] as string[],
      sortOrder: 0,
      stockStatus: 'in_stock' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    listProductModifications.mockResolvedValueOnce([row]);
    updateProductModifications.mockImplementation(
      async ({
        data,
      }: {
        data: Array<{ id: string; patch: Record<string, unknown> }>;
      }) =>
        data.map((p) => {
          Object.assign(row, p.patch);
          return { ...row };
        }),
    );

    const { result } = renderHook(
      () => ({
        mods: useCollection(productModificationsCollection),
        api: useModifications('p1'),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.api.modifications).toHaveLength(1),
    );

    // Симуляція `ModificationStatusControl`: миттєвий запис НАПРЯМУ в
    // колекцію, окрема транзакція від Save діалогу.
    const controlTx = result.current.mods.update('m1', (d) => {
      d.stockStatus = 'out_of_stock';
    });
    await controlTx.isPersisted.promise;
    expect(updateProductModifications).toHaveBeenCalledTimes(1);

    // Save діалогу: форма несе СТЕЙЛ 'in_stock' — значення на момент
    // відкриття діалогу, до того, як контрол переписав живий рядок.
    await result.current.api.update('m1', {
      ...FORM,
      stockStatus: 'in_stock',
    });

    expect(updateProductModifications).toHaveBeenCalledTimes(2);
    const [{ data: savePatch }] = updateProductModifications.mock.calls[1] as [
      { data: Array<{ id: string; patch: object }> },
    ];
    expect(savePatch[0]?.patch).not.toHaveProperty('stockStatus');
  });
});
