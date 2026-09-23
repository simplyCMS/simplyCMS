// @vitest-environment jsdom
/**
 * `usePropertySchema` (Task 10, Step 1) — 4 мутанти рев'ю: (1) призначень
 * немає → жодного другого/третього запиту, rows=[]; (2) лише
 * text-властивості → опції не запитуються; (3) фільтр розділу й
 * `appliesTo` у subset-аргументі (`'all'` — без предиката appliesTo);
 * (4) rows у порядку `sortOrder` призначень.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';

// 🔴 vi.hoisted, не звичайний const — admin-data барелем тягне ВСІ файли
// колекцій, кожен імпортує щось із `simplycms/admin-server`.
const {
  listSectionPropertyAssignments,
  listSectionProperties,
  listPropertyOptions,
} = vi.hoisted(() => ({
  listSectionPropertyAssignments: vi.fn(
    async (_args: { data: unknown }) => [] as unknown[],
  ),
  listSectionProperties: vi.fn(async () => [] as unknown[]),
  listPropertyOptions: vi.fn(async () => [] as unknown[]),
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
  listSectionPropertyAssignments,
  listSectionProperties,
  listPropertyOptions,
}));

import { usePropertySchema } from '../usePropertySchema';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </QueryClientProvider>
  );
}

function assignment(
  id: string,
  propertyId: string,
  sortOrder: number,
  appliesTo = 'product',
) {
  return {
    id,
    sectionId: 'sec1',
    propertyId,
    sortOrder,
    appliesTo,
    createdAt: new Date(),
  };
}

function textProperty(id: string) {
  return {
    id,
    sectionId: 'sec1',
    name: id,
    slug: id,
    propertyType: 'text',
    isRequired: false,
    isFilterable: false,
    hasPage: false,
    sortOrder: 0,
    options: null,
    createdAt: new Date(),
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('usePropertySchema', () => {
  it('призначень немає — жодного другого запиту, rows=[]', async () => {
    const { result } = renderHook(() => usePropertySchema('sec1', 'all'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(listSectionProperties).not.toHaveBeenCalled();
    expect(listPropertyOptions).not.toHaveBeenCalled();
  });

  it('лише text-властивості — listPropertyOptions не викликано', async () => {
    listSectionPropertyAssignments.mockResolvedValueOnce([
      assignment('a1', 'p1', 0),
    ]);
    listSectionProperties.mockResolvedValueOnce([textProperty('p1')]);
    const { result } = renderHook(() => usePropertySchema('sec1', 'product'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(listPropertyOptions).not.toHaveBeenCalled();
  });

  it("фільтр sectionId завжди, appliesTo — лише коли не 'all'", async () => {
    renderHook(() => usePropertySchema('sec1', 'product'), { wrapper });
    await waitFor(() =>
      expect(listSectionPropertyAssignments).toHaveBeenCalledTimes(1),
    );
    const [{ data: dataProduct }] = listSectionPropertyAssignments.mock
      .calls[0] as [{ data: { subset?: { filters: unknown[] } } }];
    expect(dataProduct.subset?.filters).toContainEqual({
      field: ['sectionId'],
      operator: 'eq',
      value: 'sec1',
    });
    expect(dataProduct.subset?.filters).toContainEqual({
      field: ['appliesTo'],
      operator: 'eq',
      value: 'product',
    });

    vi.clearAllMocks();
    renderHook(() => usePropertySchema('sec1', 'all'), { wrapper });
    await waitFor(() =>
      expect(listSectionPropertyAssignments).toHaveBeenCalledTimes(1),
    );
    const [{ data: dataAll }] = listSectionPropertyAssignments.mock
      .calls[0] as [{ data: { subset?: { filters: unknown[] } } }];
    expect(dataAll.subset?.filters).toEqual([
      { field: ['sectionId'], operator: 'eq', value: 'sec1' },
    ]);
  });

  it('rows — у порядку sortOrder призначень, не порядку відповіді сервера', async () => {
    listSectionPropertyAssignments.mockResolvedValueOnce([
      assignment('a2', 'p2', 2),
      assignment('a0', 'p0', 0),
      assignment('a1', 'p1', 1),
    ]);
    listSectionProperties.mockResolvedValueOnce([
      textProperty('p0'),
      textProperty('p1'),
      textProperty('p2'),
    ]);
    const { result } = renderHook(() => usePropertySchema('sec1', 'all'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(3));
    expect(result.current.rows.map((r) => r.assignment.id)).toEqual([
      'a0',
      'a1',
      'a2',
    ]);
  });
});
