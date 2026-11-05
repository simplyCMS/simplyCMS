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
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { DOMAIN_ERROR_NAME } from 'simplycms/contracts/domain-errors';
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
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn(), info: vi.fn() },
}));

const m = vi.hoisted(() => ({
  listOrderStatuses: vi.fn(),
  getOrderStatus: vi.fn(),
  saveOrderStatus: vi.fn(),
  setDefaultOrderStatus: vi.fn(),
  removeOrderStatus: vi.fn(),
  reorderOrderStatus: vi.fn(),
  listLanguages: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import OrderStatuses from '../../../pages/OrderStatuses';
import { TestI18nProvider, ukT } from '../../../../../test-harness/i18n';

const t = ukT;

const row = (p: Partial<OrderStatus>): OrderStatus => ({
  id: '00000001-0000-4000-8000-000000000001',
  name: 'Новий',
  code: 'new',
  color: '#3B82F6',
  sortOrder: 0,
  isDefault: true,
  version: 2,
  ...p,
});
const NEW = row({});
const CUSTOM = row({
  id: '00000001-0000-4000-8000-000000000009',
  name: 'Власний',
  code: 'custom',
  sortOrder: 1,
  isDefault: false,
  version: 3,
});
const aggregateOf = (s: OrderStatus) => ({
  id: s.id,
  version: s.version,
  base: { color: s.color, code: s.code, sortOrder: s.sortOrder },
  texts: {
    uk: { name: s.name, status: 'current', fieldStatus: { name: 'current' } },
  },
});
const failure = (e: object) => Object.assign(new Error('x'), e);

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <TestI18nProvider>
        <OrderStatuses />
      </TestI18nProvider>
    </QueryClientProvider>,
  );
}

const buttonsOf = (name: string) =>
  within(screen.getByText(name).closest('tr')!).getAllByRole('button');

async function openEditor() {
  renderPage();
  await screen.findByText('Власний');
  fireEvent.click(buttonsOf('Власний').at(-2)!);
  return (await screen.findByLabelText(
    t('admin.orders.statuses.codeRequired'),
  )) as HTMLInputElement;
}

const rename = (value: string) => {
  fireEvent.change(screen.getByLabelText(t('common.nameRequiredLabel')), {
    target: { value },
  });
  fireEvent.submit(
    screen.getByRole('button', { name: t('common.save') }).closest('form')!,
  );
};

beforeEach(() => {
  m.listOrderStatuses.mockResolvedValue([NEW, CUSTOM]);
  m.getOrderStatus.mockResolvedValue(aggregateOf(CUSTOM));
  m.listLanguages.mockResolvedValue([
    { code: 'uk', name: 'Українська', isDefault: true, status: 'published' },
    { code: 'en', name: 'English', isDefault: false, status: 'published' },
  ]);
  m.saveOrderStatus.mockResolvedValue({ version: 4 });
  m.setDefaultOrderStatus.mockResolvedValue({ version: 5 });
  m.removeOrderStatus.mockResolvedValue({ id: CUSTOM.id });
  m.reorderOrderStatus.mockResolvedValue({ version: 4, swapped: true });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('діалог статусу: мови, код, версія', () => {
  it('показує вкладки мов; code disabled; збереження шле лише змінену мову з expectedVersion', async () => {
    const code = await openEditor();
    expect(code.disabled).toBe(true);
    expect(code.value).toBe('custom');
    expect(screen.getByText('English')).toBeTruthy();
    rename('Перейменований');
    await waitFor(() => expect(m.saveOrderStatus).toHaveBeenCalledTimes(1));
    expect(m.saveOrderStatus.mock.calls[0]![0]).toEqual({
      data: {
        id: CUSTOM.id,
        expectedVersion: 3,
        texts: { uk: { name: 'Перейменований' } },
      },
    });
  });

  it('412 при збереженні → ConflictDialog, введене не губиться', async () => {
    m.saveOrderStatus.mockRejectedValue(
      failure({ name: DOMAIN_ERROR_NAME.versionMismatch, currentVersion: 9 }),
    );
    await openEditor();
    rename('Перейменований');
    expect(
      await screen.findByText(t('admin.orders.statuses.conflict.title')),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText(t('common.nameRequiredLabel')) as HTMLInputElement)
        .value,
    ).toBe('Перейменований');
  });

  it('setDefault: 409 concurrent_change → повідомлення й перечитування списку', async () => {
    m.setDefaultOrderStatus.mockRejectedValue(
      failure({
        name: DOMAIN_ERROR_NAME.adminConflict,
        kind: 'state',
        constraint: ADMIN_STATE_CONSTRAINT.concurrentChange,
      }),
    );
    await openEditor();
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.submit(
      screen.getByRole('button', { name: t('common.save') }).closest('form')!,
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        t('admin.errors.concurrentChange'),
      ),
    );
    await waitFor(() => expect(m.listOrderStatuses).toHaveBeenCalledTimes(2));
    expect(m.setDefaultOrderStatus).toHaveBeenCalledTimes(1);
  });
});

describe('сторінка статусів: дії зі version рядка', () => {
  it('системний статус: видалення вимкнене з поясненням', async () => {
    renderPage();
    await screen.findByText('Власний');
    const trash = (name: string) =>
      buttonsOf(name).at(-1)! as HTMLButtonElement;
    expect(trash('Новий').disabled).toBe(true);
    expect(trash('Власний').disabled).toBe(false);
    expect(trash('Новий').title).toBe(t('admin.orders.statuses.systemLocked'));
  });

  it('видалення шле expectedVersion рядка', async () => {
    renderPage();
    await screen.findByText('Власний');
    fireEvent.click(buttonsOf('Власний').at(-1)!);
    fireEvent.click(
      await screen.findByRole('button', { name: t('common.delete') }),
    );
    await waitFor(() => expect(m.removeOrderStatus).toHaveBeenCalledTimes(1));
    expect(m.removeOrderStatus.mock.calls[0]![0]).toEqual({
      data: { id: CUSTOM.id, expectedVersion: 3 },
    });
  });

  it('412 від reorder → колекція перечитана, повтору запиту немає', async () => {
    m.reorderOrderStatus.mockRejectedValue(
      failure({ name: DOMAIN_ERROR_NAME.versionMismatch, currentVersion: 3 }),
    );
    renderPage();
    await screen.findByText('Власний');
    fireEvent.click(buttonsOf('Власний')[0]!);
    await waitFor(() => expect(m.listOrderStatuses).toHaveBeenCalledTimes(2));
    expect(m.reorderOrderStatus).toHaveBeenCalledTimes(1);
    expect(m.reorderOrderStatus.mock.calls[0]![0]).toEqual({
      data: { id: CUSTOM.id, direction: 'up', expectedVersion: 3 },
    });
  });
});

describe('діалог статусу: перезавантаження конфлікту й збій другої команди', () => {
  const conflict = () =>
    failure({ name: DOMAIN_ERROR_NAME.versionMismatch, currentVersion: 9 });

  it('збій перечитування (старі data лишаються) → форма не підміняється, діалог конфлікту не закривається мовчки', async () => {
    m.saveOrderStatus.mockRejectedValue(conflict());
    await openEditor();
    rename('Перейменований');
    await screen.findByText(t('admin.orders.statuses.conflict.title'));
    m.getOrderStatus.mockRejectedValue(new Error('network'));
    fireEvent.click(
      screen.getByRole('button', {
        name: t('admin.translations.conflict.reload'),
      }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        t('admin.translations.loadFailed'),
      ),
    );
    expect(
      (screen.getByLabelText(t('common.nameRequiredLabel')) as HTMLInputElement)
        .value,
    ).toBe('Перейменований');
  });

  it('після перезавантаження дефолт береться зі свіжого рядка списку', async () => {
    m.saveOrderStatus.mockRejectedValue(conflict());
    await openEditor();
    expect(
      (screen.getByRole('switch') as HTMLButtonElement).dataset.state,
    ).toBe('unchecked');
    rename('Перейменований');
    await screen.findByText(t('admin.orders.statuses.conflict.title'));
    m.listOrderStatuses.mockResolvedValue([
      { ...NEW, isDefault: false },
      { ...CUSTOM, isDefault: true, version: 9 },
    ]);
    m.getOrderStatus.mockResolvedValue(aggregateOf({ ...CUSTOM, version: 9 }));
    fireEvent.click(
      screen.getByRole('button', {
        name: t('admin.translations.conflict.reload'),
      }),
    );
    await waitFor(() =>
      expect(
        (screen.getByRole('switch') as HTMLButtonElement).dataset.state,
      ).toBe('checked'),
    );
  });

  it('save ОК → setDefault 409 → повторне «Зберегти» не шле той самий патч удруге', async () => {
    m.setDefaultOrderStatus.mockRejectedValue(
      failure({
        name: DOMAIN_ERROR_NAME.adminConflict,
        kind: 'state',
        constraint: ADMIN_STATE_CONSTRAINT.concurrentChange,
      }),
    );
    await openEditor();
    fireEvent.click(screen.getByRole('switch'));
    rename('Перейменований');
    await waitFor(() =>
      expect(m.setDefaultOrderStatus).toHaveBeenCalledTimes(1),
    );
    fireEvent.submit(
      screen.getByRole('button', { name: t('common.save') }).closest('form')!,
    );
    await waitFor(() =>
      expect(m.setDefaultOrderStatus).toHaveBeenCalledTimes(2),
    );
    expect(m.saveOrderStatus).toHaveBeenCalledTimes(1);
  });
});
