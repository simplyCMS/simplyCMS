// @vitest-environment jsdom
/**
 * Серіалізація черги на `propertyId` (Е3-19б) — три сценарії гонки, які
 * ЛОМАЛИСЬ до черги (кожна мутація колекції — окрема авто-транзакція
 * `@tanstack/db`, хендлери йшли ПАРАЛЕЛЬНО): (1) два `saveScalar` поспіль
 * без очікування; (2) toggle тієї самої опції тричі; (3) відхилення
 * першої операції не блокує другу.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

// 🔴 vi.hoisted, не звичайний const — admin-data барелем тягне ВСІ файли
// колекцій, кожен імпортує щось із `simplycms/admin-server`.
const {
  listProductPropertyValues,
  insertProductPropertyValues,
  updateProductPropertyValues,
  removeProductPropertyValues,
} = vi.hoisted(() => ({
  listProductPropertyValues: vi.fn(async () => [] as unknown[]),
  insertProductPropertyValues: vi.fn(
    async ({ data }: { data: unknown[] }) => data,
  ),
  updateProductPropertyValues: vi.fn(
    async ({ data }: { data: Array<{ id: string; patch: unknown }> }) =>
      data.map((p) => ({ id: p.id, ...(p.patch as object) })),
  ),
  removeProductPropertyValues: vi.fn(
    async (_args: { data: unknown[] }) => undefined,
  ),
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
  listProductModifications: vi.fn(async () => []),
  insertProductModifications: vi.fn(),
  updateProductModifications: vi.fn(),
  removeProductModifications: vi.fn(),
  setDefaultProductModification: vi.fn(),
  reorderProductModification: vi.fn(),
  listProductPrices: vi.fn(async () => []),
  saveProductPrices: vi.fn(),
  listStock: vi.fn(async () => []),
  saveStock: vi.fn(),
  listProductPropertyValues,
  insertProductPropertyValues,
  updateProductPropertyValues,
  removeProductPropertyValues,
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

import { usePropertyValues } from '../usePropertyValues';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('usePropertyValues: серіалізація черги на propertyId', () => {
  it('два saveScalar поспіль — insert, потім update ПІСЛЯ persist, без помилки', async () => {
    let insertedId: string | null = null;
    insertProductPropertyValues.mockImplementation(
      async ({ data }: { data: unknown[] }) => {
        await new Promise((r) => setTimeout(r, 5)); // затримка — імітує мережу
        insertedId = (data[0] as { id: string }).id;
        return data;
      },
    );
    updateProductPropertyValues.mockImplementation(
      async ({ data }: { data: Array<{ id: string; patch: unknown }> }) => {
        if (data[0]?.id !== insertedId)
          throw new Error('рядка ще не існує — невідомий id');
        return data.map((p) => ({ id: p.id, ...(p.patch as object) }));
      },
    );
    const { result } = renderHook(() => usePropertyValues('product', 'p1'), {
      wrapper,
    });
    // Дати on-demand колекції стати ready ДО гонки — інакше перший
    // insert() ще не встигає піти в 'ready'-стан і сама черга (не
    // серіалізація) стає джерелом шуму в тесті.
    // UPSTREAM:TSDB-B1 — docs/architecture/upstream-workarounds.md
    await waitFor(() => expect(result.current.rowsOf('propA')).toHaveLength(0));

    result.current.saveScalar('propA', {
      value: 'A',
      numericValue: null,
      optionId: null,
    });
    result.current.saveScalar('propA', {
      value: 'B',
      numericValue: null,
      optionId: null,
    });

    await waitFor(() =>
      expect(updateProductPropertyValues).toHaveBeenCalledTimes(1),
    );
    expect(insertProductPropertyValues).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.rowsOf('propA')).toHaveLength(1));
  });

  it('toggle тієї самої опції тричі — рівно один рядок, без 23505', async () => {
    const dbRows = new Map<
      string,
      { propertyId: string; optionId: string | null }
    >();
    insertProductPropertyValues.mockImplementation(
      async ({ data }: { data: unknown[] }) => {
        for (const raw of data) {
          const d = raw as {
            id: string;
            propertyId: string;
            optionId: string | null;
          };
          const dup = [...dbRows.values()].some(
            (r) => r.propertyId === d.propertyId && r.optionId === d.optionId,
          );
          if (dup)
            throw new Error(
              'duplicate key value violates unique constraint "x_owner_property_option"',
            );
          dbRows.set(d.id, d);
        }
        return data;
      },
    );
    removeProductPropertyValues.mockImplementation(
      async ({ data }: { data: unknown[] }) => {
        for (const { id } of data as Array<{ id: string }>) dbRows.delete(id);
      },
    );
    const { result } = renderHook(() => usePropertyValues('product', 'p1'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.rowsOf('propB')).toHaveLength(0));

    result.current.saveMulti('propB', ['A']);
    result.current.saveMulti('propB', []);
    result.current.saveMulti('propB', ['A']);

    await waitFor(() => expect(result.current.rowsOf('propB')).toHaveLength(1));
    expect(insertProductPropertyValues).toHaveBeenCalledTimes(2);
    expect(removeProductPropertyValues).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('відхилення першої операції не блокує чергу — друга виконується', async () => {
    insertProductPropertyValues
      .mockRejectedValueOnce(new Error('мережа впала'))
      .mockImplementation(async ({ data }: { data: unknown[] }) => data);
    const { result } = renderHook(() => usePropertyValues('product', 'p1'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.rowsOf('propA')).toHaveLength(0));

    result.current.saveScalar('propA', {
      value: 'A',
      numericValue: null,
      optionId: null,
    });
    result.current.saveScalar('propA', {
      value: 'B',
      numericValue: null,
      optionId: null,
    });

    await waitFor(() =>
      expect(insertProductPropertyValues).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.rowsOf('propA')).toHaveLength(1));
    expect(result.current.rowsOf('propA')[0]?.value).toBe('B');
  });
});
