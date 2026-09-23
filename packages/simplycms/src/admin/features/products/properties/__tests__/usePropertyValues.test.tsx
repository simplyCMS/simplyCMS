// @vitest-environment jsdom
/**
 * `usePropertyValues` (Task 10, Step 2): (а) multiselect `[A] → [A, B]` —
 * ОДНА вставка рядка `optionId: B`, жодного видалення; (б) `[A, B] → [B]` —
 * видалення рядка A, жодної вставки; (в) скаляр: порожнє значення при
 * наявному рядку → delete; (г) перше значення скаляра → insert з
 * клієнтським uuid (контракт id).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';

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
  updateProductPropertyValues: vi.fn(async () => [] as unknown[]),
  removeProductPropertyValues: vi.fn(async () => undefined),
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

function row(id: string, propertyId: string, optionId: string | null) {
  return {
    id,
    productId: 'p1',
    propertyId,
    value: optionId ?? 'Текст',
    numericValue: null,
    optionId,
    createdAt: new Date(),
  };
}

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

describe('usePropertyValues', () => {
  it('(г) перше значення скаляра — insert з клієнтським uuid', async () => {
    const { result } = renderHook(() => usePropertyValues('product', 'p1'), {
      wrapper,
    });

    result.current.saveScalar('propA', {
      value: 'Текст',
      numericValue: null,
      optionId: null,
    });

    await waitFor(() =>
      expect(insertProductPropertyValues).toHaveBeenCalledTimes(1),
    );
    const [{ data }] = insertProductPropertyValues.mock.calls[0] as [
      { data: Array<{ id: string; productId: string; propertyId: string }> },
    ];
    expect(data).toHaveLength(1);
    expect(data[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(data[0]?.productId).toBe('p1');
    expect(data[0]?.propertyId).toBe('propA');
    expect(removeProductPropertyValues).not.toHaveBeenCalled();
  });

  it('(в) порожнє значення при наявному рядку — delete, не update', async () => {
    listProductPropertyValues.mockResolvedValueOnce([row('v1', 'propA', null)]);
    const { result } = renderHook(() => usePropertyValues('product', 'p1'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.rowsOf('propA')).toHaveLength(1));

    result.current.saveScalar('propA', {
      value: null,
      numericValue: null,
      optionId: null,
    });

    await waitFor(() =>
      expect(removeProductPropertyValues).toHaveBeenCalledWith({
        data: [{ id: 'v1' }],
      }),
    );
    expect(updateProductPropertyValues).not.toHaveBeenCalled();
    expect(insertProductPropertyValues).not.toHaveBeenCalled();
  });

  it('(а) multiselect [A] → [A, B] — одна вставка B, жодного видалення', async () => {
    listProductPropertyValues.mockResolvedValueOnce([row('v1', 'propB', 'A')]);
    const { result } = renderHook(() => usePropertyValues('product', 'p1'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.rowsOf('propB')).toHaveLength(1));

    result.current.saveMulti('propB', ['A', 'B'], (id) => id);

    await waitFor(() =>
      expect(insertProductPropertyValues).toHaveBeenCalledTimes(1),
    );
    const [{ data }] = insertProductPropertyValues.mock.calls[0] as [
      { data: Array<{ optionId: string | null }> },
    ];
    expect(data).toHaveLength(1);
    expect(data[0]?.optionId).toBe('B');
    expect(removeProductPropertyValues).not.toHaveBeenCalled();
  });

  it('(б) multiselect [A, B] → [B] — видалення A, жодної вставки', async () => {
    listProductPropertyValues.mockResolvedValueOnce([
      row('v1', 'propB', 'A'),
      row('v2', 'propB', 'B'),
    ]);
    const { result } = renderHook(() => usePropertyValues('product', 'p1'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.rowsOf('propB')).toHaveLength(2));

    result.current.saveMulti('propB', ['B'], (id) => id);

    await waitFor(() =>
      expect(removeProductPropertyValues).toHaveBeenCalledWith({
        data: [{ id: 'v1' }],
      }),
    );
    expect(insertProductPropertyValues).not.toHaveBeenCalled();
  });
});
