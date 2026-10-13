// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from 'simplycms/i18n';
import { stubDom } from '../../__tests__/render-support';
import { DISCOUNTS, GROUPS } from '../../__tests__/render-support';

stubDom();

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

const m = vi.hoisted(() => ({
  listDiscountGroups: vi.fn(),
  listDiscounts: vi.fn(),
  getDiscount: vi.fn(),
  saveDiscount: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import { useDiscountCard } from '../useDiscountCard';

const ID = DISCOUNTS[0]!.id;

/** Стабільний клієнт без повторів: помилка запиту має зʼявитись одразу. */
function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </QueryClientProvider>
  );
}

/** Те, що клієнт бачить після `domainErrorAdapter`: `Error` з `name`. */
const domainNotFound = () =>
  Object.assign(new Error('знижки не існує'), { name: 'NotFoundError' });

beforeEach(() => {
  vi.clearAllMocks();
  m.listDiscountGroups.mockResolvedValue(GROUPS);
  m.listDiscounts.mockResolvedValue(DISCOUNTS);
});
afterEach(() => cleanup());

describe('useDiscountCard: не знайдено ≠ збій запиту (Р26)', () => {
  it('доменне «не знайдено» → notFound: true, loadFailed: false', async () => {
    m.getDiscount.mockRejectedValue(domainNotFound());
    const { result } = renderHook(() => useDiscountCard(ID, undefined), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.loadFailed).toBe(false);
  });

  it('мережевий збій / 500 → notFound: false, loadFailed: true; повтор кличе запит знову', async () => {
    m.getDiscount.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useDiscountCard(ID, undefined), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.notFound).toBe(false);

    m.getDiscount.mockClear();
    result.current.retry();
    await waitFor(() => expect(m.getDiscount).toHaveBeenCalledTimes(1));
  });
});
