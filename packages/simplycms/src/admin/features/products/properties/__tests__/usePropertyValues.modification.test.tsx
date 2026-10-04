// @vitest-environment jsdom
/**
 * `usePropertyValues('modification', …)` (Е3-19) — окрема гілка від
 * `target='product'`: значення пишуться `insertModificationPropertyValues`
 * з `modificationId`, `insertProductPropertyValues` НЕ викликається, а
 * зріз читається за `modificationId`, не `productId`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';

// 🔴 vi.hoisted, не звичайний const — admin-data барелем тягне ВСІ файли
// колекцій, кожен імпортує щось із `simplycms/admin-server`.
const {
  listModificationPropertyValues,
  insertModificationPropertyValues,
  insertProductPropertyValues,
} = vi.hoisted(() => ({
  listModificationPropertyValues: vi.fn(async () => [] as unknown[]),
  insertModificationPropertyValues: vi.fn(
    async ({ data }: { data: unknown[] }) => data,
  ),
  insertProductPropertyValues: vi.fn(
    async ({ data }: { data: unknown[] }) => data,
  ),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    insertProductPropertyValues,
    listModificationPropertyValues,
    insertModificationPropertyValues,
  }),
);

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

describe("usePropertyValues target='modification'", () => {
  it('перше значення — insertModificationPropertyValues з modificationId, не product', async () => {
    const { result } = renderHook(
      () => usePropertyValues('modification', 'm1'),
      { wrapper },
    );

    result.current.saveScalar('propA', {
      value: 'Текст',
      numericValue: null,
      optionId: null,
    });

    await waitFor(() =>
      expect(insertModificationPropertyValues).toHaveBeenCalledTimes(1),
    );
    const [{ data }] = insertModificationPropertyValues.mock.calls[0] as [
      { data: Array<{ modificationId: string; propertyId: string }> },
    ];
    expect(data[0]?.modificationId).toBe('m1');
    expect(insertProductPropertyValues).not.toHaveBeenCalled();
  });

  it('зріз читається за modificationId — рядок іншого власника не потрапляє', async () => {
    listModificationPropertyValues.mockResolvedValueOnce([
      {
        id: 'v1',
        modificationId: 'm1',
        propertyId: 'propA',
        value: 'A',
        numericValue: null,
        optionId: null,
        createdAt: new Date(),
      },
      {
        id: 'v2',
        modificationId: 'm2',
        propertyId: 'propA',
        value: 'B',
        numericValue: null,
        optionId: null,
        createdAt: new Date(),
      },
    ]);
    const { result } = renderHook(
      () => usePropertyValues('modification', 'm1'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.rowsOf('propA')).toHaveLength(1));
    expect(result.current.rowsOf('propA')[0]?.id).toBe('v1');
  });
});
