// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createTranslator } from 'simplycms/i18n';
import {
  DISCOUNTS,
  GROUPS,
  GROUP_ID,
  stubDom,
  wrapper,
} from '../../__tests__/render-support';

stubDom();

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const m = vi.hoisted(() => ({
  listDiscountGroups: vi.fn(),
  listDiscounts: vi.fn(),
  updateDiscountGroups: vi.fn(),
  removeDiscountGroups: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import DiscountsPage from '../DiscountsPage';

const t = createTranslator('uk');

beforeEach(() => {
  vi.clearAllMocks();
  m.listDiscountGroups.mockResolvedValue(GROUPS);
  m.listDiscounts.mockResolvedValue(DISCOUNTS);
});
afterEach(() => cleanup());

describe('DiscountsPage', () => {
  it('дерево: вкладені групи й знижки під своєю групою; NULL типу ціни — «усі типи»', async () => {
    render(<DiscountsPage />, { wrapper });
    await screen.findByText('Кеди -10');
    for (const name of ['Літо', 'Взуття', 'Одяг', 'Зима', 'Пуховики'])
      expect(screen.getByText(name)).toBeTruthy();
    expect(
      screen.getAllByText(t('admin.discounts.allPriceTypes')),
    ).toHaveLength(DISCOUNTS.length);
  });

  it('видалення групи з 2 підгрупами й 3 знижками → «груп: 3, знижок: 3»; підтвердження → removeDiscountGroups', async () => {
    m.removeDiscountGroups.mockResolvedValue({
      removed: [GROUPS[0]!.id, GROUPS[1]!.id, GROUPS[2]!.id],
    });
    render(<DiscountsPage />, { wrapper });
    await screen.findByText('Кеди -10');
    fireEvent.click(
      screen.getByRole('button', {
        name: t('admin.discounts.deleteGroupLabel', { name: 'Літо' }),
      }),
    );
    await screen.findByText('Буде видалено груп: 3, знижок: 3');
    fireEvent.click(screen.getByRole('button', { name: t('common.delete') }));
    await waitFor(() =>
      expect(m.removeDiscountGroups).toHaveBeenCalledWith({
        data: [{ id: GROUP_ID.summer }],
      }),
    );
    await waitFor(() => expect(screen.queryByText('Кеди -10')).toBeNull());
    expect(screen.getByText('Пуховики')).toBeTruthy();
  });

  it('перемикач активності групи → updateDiscountGroups лише з isActive', async () => {
    m.updateDiscountGroups.mockImplementation(async () => [
      { ...GROUPS[3]!, isActive: false },
    ]);
    render(<DiscountsPage />, { wrapper });
    await screen.findByText('Пуховики');
    fireEvent.click(
      screen.getByRole('switch', {
        name: t('admin.discounts.toggleGroupLabel', { name: 'Зима' }),
      }),
    );
    await waitFor(() => expect(m.updateDiscountGroups).toHaveBeenCalled());
    const [{ data }] = m.updateDiscountGroups.mock.calls[0] as [
      { data: Array<{ id: string; patch: Record<string, unknown> }> },
    ];
    expect(data[0]).toMatchObject({
      id: GROUP_ID.winter,
      patch: { isActive: false },
    });
    expect(Object.keys(data[0]!.patch)).toEqual(['isActive']);
  });
});
