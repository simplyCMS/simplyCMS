// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider, createTranslator } from 'simplycms/i18n';
import type { OrderStatus } from 'simplycms/schema/types';

// jsdom без ResizeObserver (Radix Switch у діалозі).
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { listOrderStatuses, updateOrderStatuses, removeOrderStatuses } =
  vi.hoisted(() => ({
    listOrderStatuses: vi.fn(),
    updateOrderStatuses: vi.fn(),
    removeOrderStatuses: vi.fn(),
  }));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listOrderStatuses,
    updateOrderStatuses,
    removeOrderStatuses,
  }),
);

import OrderStatuses from '../../../pages/OrderStatuses';

const t = createTranslator('uk');

const row = (p: Partial<OrderStatus>): OrderStatus => ({
  id: '00000001-0000-4000-8000-000000000001',
  name: 'Новий',
  code: 'new',
  color: '#3B82F6',
  sortOrder: 0,
  isDefault: true,
  createdAt: new Date('2026-10-04'),
  ...p,
});
const NEW = row({});
const CUSTOM = row({
  id: '00000001-0000-4000-8000-000000000009',
  name: 'Власний',
  code: 'custom',
  sortOrder: 1,
  isDefault: false,
});

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider locale="uk">
        <OrderStatuses />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

const editButtonOf = (name: string) => {
  const rowEl = screen.getByText(name).closest('tr')!;
  return within(rowEl).getAllByRole('button').at(-2)!;
};

beforeEach(() => {
  listOrderStatuses.mockResolvedValue([NEW, CUSTOM]);
  updateOrderStatuses.mockImplementation(
    async ({ data }: { data: { id: string; patch: object }[] }) =>
      data.map(({ id, patch }) => ({ ...NEW, ...CUSTOM, id, ...patch })),
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('OrderStatuses: code незмінний (Е5-6)', () => {
  it('редагування: поле коду disabled, patch не несе code', async () => {
    renderPage();
    await screen.findByText('Власний');
    fireEvent.click(editButtonOf('Власний'));
    const code = (await screen.findByLabelText(
      t('admin.orders.statuses.codeRequired'),
    )) as HTMLInputElement;
    expect(code.disabled).toBe(true);
    expect(code.value).toBe('custom');
    expect(
      screen.getByText(t('admin.orders.statuses.codeImmutable')),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText(t('common.nameRequiredLabel')), {
      target: { value: 'Перейменований' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: t('common.save') }).closest('form')!,
    );
    await waitFor(() => expect(updateOrderStatuses).toHaveBeenCalled());
    const [{ data }] = updateOrderStatuses.mock.calls[0] as [
      { data: { patch: Record<string, unknown> }[] },
    ];
    expect(data[0].patch.name).toBe('Перейменований');
    expect('code' in data[0].patch).toBe(false);
  });

  it('системний статус: видалення вимкнене з поясненням', async () => {
    renderPage();
    await screen.findByText('Власний');
    const trash = (name: string) =>
      within(screen.getByText(name).closest('tr')!)
        .getAllByRole('button')
        .at(-1)! as HTMLButtonElement;
    expect(trash('Новий').disabled).toBe(true);
    expect(trash('Власний').disabled).toBe(false);
    expect(trash('Новий').title).toBe(t('admin.orders.statuses.systemLocked'));
  });
});
