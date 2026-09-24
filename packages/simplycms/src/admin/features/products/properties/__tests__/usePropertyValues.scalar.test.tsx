// @vitest-environment jsdom
/**
 * `usePropertyValues.saveScalar` — два мутанти рев'ю (Е3-19), не покриті
 * `usePropertyValues.test.tsx`: (1) наявний рядок + НЕПОРОЖНЄ значення →
 * update, а не insert/remove; (2) порожнє значення БЕЗ наявного рядка →
 * нуль операцій (не false-positive insert/delete).
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
  updateProductPropertyValues: vi.fn(
    async ({ data }: { data: Array<{ id: string; patch: unknown }> }) =>
      data.map((p) => ({ id: p.id, ...(p.patch as object) })),
  ),
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

describe('usePropertyValues.saveScalar', () => {
  it('наявний рядок + непорожнє значення — update, не insert/remove', async () => {
    listProductPropertyValues.mockResolvedValueOnce([
      {
        id: 'v1',
        productId: 'p1',
        propertyId: 'propA',
        value: 'Старе',
        numericValue: null,
        optionId: null,
        createdAt: new Date(),
      },
    ]);
    const { result } = renderHook(() => usePropertyValues('product', 'p1'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.rowsOf('propA')).toHaveLength(1));

    result.current.saveScalar('propA', {
      value: 'Нове',
      numericValue: null,
      optionId: null,
    });

    await waitFor(() =>
      expect(updateProductPropertyValues).toHaveBeenCalledTimes(1),
    );
    const [{ data }] = updateProductPropertyValues.mock.calls[0] as [
      { data: Array<{ id: string; patch: { value: string } }> },
    ];
    expect(data[0]).toMatchObject({ id: 'v1', patch: { value: 'Нове' } });
    expect(insertProductPropertyValues).not.toHaveBeenCalled();
    expect(removeProductPropertyValues).not.toHaveBeenCalled();
  });

  it('порожнє значення без наявного рядка — нуль операцій', async () => {
    const { result } = renderHook(() => usePropertyValues('product', 'p1'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.rowsOf('propA')).toHaveLength(0));

    result.current.saveScalar('propA', {
      value: null,
      numericValue: null,
      optionId: null,
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(insertProductPropertyValues).not.toHaveBeenCalled();
    expect(updateProductPropertyValues).not.toHaveBeenCalled();
    expect(removeProductPropertyValues).not.toHaveBeenCalled();
  });

  it('select: вибір опції (value NULL, optionId заданий) — insert, НЕ трактується як порожньо', async () => {
    // Е3-13, ревізія: 'select' більше не пише назву опції в `value` —
    // «порожньо» тепер значить «немає ні value, ні optionId», інакше щойно
    // обрана опція виглядала б як видалення рядка.
    const { result } = renderHook(() => usePropertyValues('product', 'p1'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.rowsOf('propA')).toHaveLength(0));

    result.current.saveScalar('propA', {
      value: null,
      numericValue: null,
      optionId: 'o1',
    });

    await waitFor(() =>
      expect(insertProductPropertyValues).toHaveBeenCalledTimes(1),
    );
    const [{ data }] = insertProductPropertyValues.mock.calls[0] as [
      { data: Array<{ optionId: string | null }> },
    ];
    expect(data[0]?.optionId).toBe('o1');
    expect(removeProductPropertyValues).not.toHaveBeenCalled();
  });
});
