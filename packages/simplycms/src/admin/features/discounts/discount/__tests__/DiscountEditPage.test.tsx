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
import { GROUP_ID, stubDom, wrapper } from '../../__tests__/render-support';
import {
  ROW,
  SECOND_0330,
  savedData,
  seedServer,
  submit,
  withKyivTimeZone,
} from './card-support';

withKyivTimeZone();
stubDom();

const { toastError, toastSuccess, navigate, params, search } = vi.hoisted(
  () => ({
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    navigate: vi.fn(),
    params: { discountId: 'new' },
    search: {} as { groupId?: string },
  }),
);
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => params,
  useSearch: () => search,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

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

import DiscountEditPage from '../DiscountEditPage';

const t = createTranslator('uk');
const saved = () => savedData(m);

beforeEach(() => {
  vi.clearAllMocks();
  params.discountId = ROW.id;
  delete search.groupId;
  seedServer(m);
});
afterEach(() => cleanup());

describe('DiscountEditPage: дати й цілі', () => {
  it('збереження без змін: startsAt — той самий момент (друга «03:30», ред.2 Е6в-22)', async () => {
    render(<DiscountEditPage />, { wrapper });
    await screen.findByDisplayValue('2026-10-25T03:30');
    submit(t('common.save'));
    await waitFor(() => expect(m.saveDiscount).toHaveBeenCalledTimes(1));
    const data = saved();
    expect((data.startsAt as Date).getTime()).toBe(SECOND_0330.getTime());
    expect(data).toMatchObject({
      id: ROW.id,
      groupId: ROW.groupId,
      discountValue: 10,
      priceTypeId: null,
      endsAt: null,
      targets: [{ targetType: 'all', targetId: null }],
      conditions: [],
    });
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it('нова знижка без цілей → повідомлення валідації, saveDiscount не викликано', async () => {
    params.discountId = 'new';
    search.groupId = GROUP_ID.summer;
    render(<DiscountEditPage />, { wrapper });
    fireEvent.change(screen.getByLabelText(t('common.name')), {
      target: { value: 'Нова' },
    });
    submit(t('common.create'));
    await screen.findByText(t('admin.discounts.targetsRequired'));
    expect(m.saveDiscount).not.toHaveBeenCalled();
    // «Усі товари» — і та сама форма зберігається.
    fireEvent.click(
      screen.getByRole('switch', { name: t('admin.discounts.allProducts') }),
    );
    submit(t('common.create'));
    await waitFor(() => expect(m.saveDiscount).toHaveBeenCalledTimes(1));
    expect(saved()).toMatchObject({
      name: 'Нова',
      groupId: GROUP_ID.summer,
      targets: [{ targetType: 'all', targetId: null }],
    });
    expect(saved().id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
