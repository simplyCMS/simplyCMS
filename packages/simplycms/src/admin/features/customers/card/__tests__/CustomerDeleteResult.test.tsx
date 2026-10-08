// @vitest-environment jsdom
/** Картка покупця (Task 11, Е6г): роль, бан, видалення. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'simplycms/i18n';
import {
  ADMIN_STATE_CONSTRAINT,
  DOMAIN_ERROR_NAME,
} from 'simplycms/contracts/domain-errors';
import {
  USER_ID,
  card,
  clientRef,
  mocks,
  renderCard,
  stubDom,
  ui,
} from './render-support';

vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock((await import('./mocks')).mocks),
);
vi.mock('sonner', async () => {
  const { ui } = await import('./mocks');
  return { toast: { error: ui.toastError, success: ui.toastSuccess } };
});
vi.mock('@tanstack/react-router', async () => {
  const { ui } = await import('./mocks');
  return {
    useNavigate: () => ui.navigate,
    useParams: () => ({ userId: 'u0000000-0000-4000-8000-000000000001' }),
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  };
});
vi.mock('simplycms/core/hooks/useAuth', async () => {
  const { ui } = await import('./mocks');
  return { useAuth: () => ({ user: { id: ui.currentUserId } }) };
});

const t = createTranslator('uk');
const conflict = (constraint: string) =>
  Object.assign(new Error('conflict'), {
    name: DOMAIN_ERROR_NAME.adminConflict,
    kind: 'state',
    constraint,
  });
const heading = () => screen.findByRole('heading', { name: /Іван Петренко/ });

beforeEach(() => {
  stubDom();
  vi.clearAllMocks();
  ui.currentUserId = 'a0000000-0000-4000-8000-0000000000ff';
  mocks.getCustomerCard.mockResolvedValue(card());
  mocks.listUserCategories.mockResolvedValue([]);
  mocks.listOrders.mockResolvedValue([]);
});
afterEach(cleanup);

describe('видалення', () => {
  const open = async () => {
    await heading();
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.users.card.delete') }),
    );
    return screen.findByLabelText(/buyer@shop\.test/);
  };
  const confirmBtn = () =>
    screen.getByRole('button', { name: t('admin.users.card.deleteConfirm') });

  it('успіх → інвалідація [profiles] і [orders] (колекція замовлень перечитується), перехід, тост', async () => {
    mocks.deleteCustomer.mockResolvedValue({});
    renderCard();
    const input = await open();
    await waitFor(() => expect(mocks.listOrders).toHaveBeenCalled());
    const ordersCalls = mocks.listOrders.mock.calls.length;
    const spy = vi.spyOn(clientRef.current, 'invalidateQueries');
    fireEvent.change(input, { target: { value: 'buyer@shop.test' } });
    fireEvent.click(confirmBtn());
    await waitFor(() =>
      expect(mocks.deleteCustomer).toHaveBeenCalledWith({
        data: { userId: USER_ID, confirmEmail: 'buyer@shop.test' },
      }),
    );
    await waitFor(() =>
      expect(ui.navigate).toHaveBeenCalledWith({ to: '/admin/users' }),
    );
    expect(ui.toastSuccess).toHaveBeenCalled();
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ['profiles'] }),
    );
    // Префікс [orders] накриває і дашборд (`[orders, 'admin-dashboard']`), і
    // колекцію замовлень (`[orders, 'list']`) — окремого refetch немає.
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ['orders'] }),
    );
    await waitFor(() =>
      expect(mocks.listOrders.mock.calls.length).toBeGreaterThan(ordersCalls),
    );
  });

  it('409 customer_is_admin → тост, діалог лишається, переходу немає', async () => {
    mocks.deleteCustomer.mockRejectedValue(
      conflict(ADMIN_STATE_CONSTRAINT.customerIsAdmin),
    );
    renderCard();
    const input = await open();
    fireEvent.change(input, { target: { value: 'buyer@shop.test' } });
    fireEvent.click(confirmBtn());
    await waitFor(() =>
      expect(ui.toastError).toHaveBeenCalledWith(
        t('admin.errors.customerIsAdmin'),
      ),
    );
    expect(ui.navigate).not.toHaveBeenCalled();
  });

  it('збій пост-кроку після видалення не показується як невдале видалення', async () => {
    mocks.deleteCustomer.mockResolvedValue({});
    renderCard();
    const input = await open();
    // vitest не доставляє `unhandledRejection` у слухач тесту, тож доводимо
    // контракт напряму: на проміс навігації чіпляють обробник відхилення.
    const nav = Promise.reject(new Error('nav'));
    const handled = vi.spyOn(nav, 'catch');
    ui.navigate.mockReturnValueOnce(nav);
    fireEvent.change(input, { target: { value: 'buyer@shop.test' } });
    fireEvent.click(confirmBtn());
    await waitFor(() => expect(ui.toastSuccess).toHaveBeenCalled());
    expect(handled).toHaveBeenCalledTimes(1);
    expect(ui.toastError).not.toHaveBeenCalled();
  });
});
