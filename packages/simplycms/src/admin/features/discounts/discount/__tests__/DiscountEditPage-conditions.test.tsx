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
import { stubDom, wrapper } from '../../__tests__/render-support';
import {
  ALL_TARGET,
  cond,
  ROW,
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

describe('DiscountEditPage: умови за реєстром', () => {
  it('невідома умова: рядок «Невідома умова: {type}» без редагування; видалення → зберігається решта', async () => {
    m.getDiscount.mockResolvedValue({
      discount: ROW,
      targets: [ALL_TARGET],
      conditions: [cond('utm_magic', '=', 'x'), cond('min_quantity', '>=', 3)],
    });
    render(<DiscountEditPage />, { wrapper });
    await screen.findByText('Невідома умова: utm_magic');
    expect(screen.getByDisplayValue('3')).toBeTruthy();
    // Форма жива: зберегти з невідомою умовою не дає, а пояснює чому.
    submit(t('common.save'));
    await screen.findByText(t('admin.discounts.unknownConditionBlocks'));
    expect(m.saveDiscount).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getAllByRole('button', {
        name: t('admin.discounts.removeCondition'),
      })[0]!,
    );
    expect(screen.queryByText('Невідома умова: utm_magic')).toBeNull();
    submit(t('common.save'));
    await waitFor(() => expect(m.saveDiscount).toHaveBeenCalledTimes(1));
    expect(saved().conditions).toEqual([
      { conditionType: 'min_quantity', operator: '>=', value: 3 },
    ]);
  });
});
