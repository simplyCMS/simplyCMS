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
  GROUPS_WITH_GRANDCHILD,
  GROUP_ID,
  stateConflict,
  stubDom,
  wrapper,
} from '../../__tests__/render-support';

stubDom();

const { toastError, toastSuccess, navigate, params, search } = vi.hoisted(
  () => ({
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    navigate: vi.fn(),
    params: { groupId: 'new' },
    search: {} as { parentId?: string },
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
  insertDiscountGroups: vi.fn(),
  updateDiscountGroups: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import DiscountGroupEditPage from '../DiscountGroupEditPage';

const t = createTranslator('uk');

beforeEach(() => {
  vi.clearAllMocks();
  params.groupId = 'new';
  delete search.parentId;
  m.listDiscountGroups.mockResolvedValue(GROUPS_WITH_GRANDCHILD);
  m.insertDiscountGroups.mockImplementation(async ({ data }) => data);
});
afterEach(() => cleanup());

const openParentSelect = () =>
  fireEvent.keyDown(screen.getByLabelText(t('admin.discounts.parentGroup')), {
    key: 'Enter',
  });

describe('DiscountGroupEditPage', () => {
  it('select батька: без самої групи й усього її піддерева (онук теж), інші групи є', async () => {
    params.groupId = GROUP_ID.summer;
    render(<DiscountGroupEditPage />, { wrapper });
    await screen.findByDisplayValue('Літо');
    openParentSelect();
    await screen.findByRole('option', { name: t('admin.discounts.rootLevel') });
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names).toContain('Зима');
    for (const hidden of ['Літо', 'Взуття', 'Одяг', 'Кеди'])
      expect(names).not.toContain(hidden);
  });

  it('нова підгрупа з ?parentId: id від клієнта, батько з URL, порожні дати → null', async () => {
    search.parentId = GROUP_ID.winter;
    render(<DiscountGroupEditPage />, { wrapper });
    fireEvent.change(screen.getByLabelText(t('common.name')), {
      target: { value: 'Шапки' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('common.create') }));
    await waitFor(() => expect(m.insertDiscountGroups).toHaveBeenCalled());
    const [{ data }] = m.insertDiscountGroups.mock.calls[0] as [
      { data: Array<Record<string, unknown>> },
    ];
    expect(data[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(data[0]).toMatchObject({
      name: 'Шапки',
      parentGroupId: GROUP_ID.winter,
      operator: 'and',
      startsAt: null,
      endsAt: null,
    });
  });

  it('409 discount_group_cycle → тост, лишаємось на картці', async () => {
    params.groupId = GROUP_ID.shoes;
    m.updateDiscountGroups.mockRejectedValue(
      stateConflict('discount_group_cycle'),
    );
    render(<DiscountGroupEditPage />, { wrapper });
    await screen.findByDisplayValue('Взуття');
    fireEvent.change(screen.getByLabelText(t('common.name')), {
      target: { value: 'Взуття+' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('common.save') }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        t('admin.errors.discountGroupCycle'),
      ),
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});
