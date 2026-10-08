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
const roleSwitch = () =>
  screen.findByRole('switch', { name: t('admin.users.adminAccess') });
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

describe('роль адміністратора', () => {
  it('перемикач шле { admin: false } й інвалідовує [profiles]', async () => {
    mocks.getCustomerCard.mockResolvedValue(card({ isAdmin: true }));
    mocks.setAdminRole.mockResolvedValue({});
    renderCard();
    const sw = await roleSwitch();
    const spy = vi.spyOn(clientRef.current, 'invalidateQueries');
    fireEvent.click(sw);
    await waitFor(() =>
      expect(mocks.setAdminRole).toHaveBeenCalledWith({
        data: { userId: USER_ID, admin: false },
      }),
    );
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ['profiles'] }),
    );
    // Картку перечитано після інвалідації префікса.
    await waitFor(() =>
      expect(mocks.getCustomerCard.mock.calls.length).toBeGreaterThan(1),
    );
  });

  it('409 admin_role_last → тост «останній адміністратор»', async () => {
    mocks.getCustomerCard.mockResolvedValue(card({ isAdmin: true }));
    mocks.setAdminRole.mockRejectedValue(
      conflict(ADMIN_STATE_CONSTRAINT.adminRoleLast),
    );
    renderCard();
    fireEvent.click(await roleSwitch());
    await waitFor(() =>
      expect(ui.toastError).toHaveBeenCalledWith(
        t('admin.errors.adminRoleLast'),
      ),
    );
  });

  it('вимкнений для себе й для забаненого', async () => {
    ui.currentUserId = USER_ID;
    renderCard();
    expect((await roleSwitch()).hasAttribute('disabled')).toBe(true);
    cleanup();
    ui.currentUserId = 'a0000000-0000-4000-8000-0000000000ff';
    mocks.getCustomerCard.mockResolvedValue(card({ bannedAt: new Date() }));
    renderCard();
    expect((await roleSwitch()).hasAttribute('disabled')).toBe(true);
  });
});

describe('бан', () => {
  it('діалог із причиною → setCustomerBan { banned: true, reason }', async () => {
    mocks.setCustomerBan.mockResolvedValue({});
    renderCard();
    await heading();
    const spy = vi.spyOn(clientRef.current, 'invalidateQueries');
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.users.card.ban') }),
    );
    fireEvent.change(
      await screen.findByLabelText(t('admin.users.card.banReason')),
      {
        target: { value: 'Шахрайство' },
      },
    );
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.users.card.banConfirm') }),
    );
    await waitFor(() =>
      expect(mocks.setCustomerBan).toHaveBeenCalledWith({
        data: { userId: USER_ID, banned: true, reason: 'Шахрайство' },
      }),
    );
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ['profiles'] }),
    );
  });

  it('банер «Заблоковано з …» і «Розблокувати»', async () => {
    mocks.getCustomerCard.mockResolvedValue(
      card({ bannedAt: new Date(Date.UTC(2026, 8, 1)), banReason: 'Спам' }),
    );
    mocks.setCustomerBan.mockResolvedValue({});
    renderCard();
    expect(await screen.findByText(/Заблоковано з/)).toBeTruthy();
    const spy = vi.spyOn(clientRef.current, 'invalidateQueries');
    expect(screen.getByText(/Спам/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.users.card.unban') }),
    );
    await waitFor(() =>
      expect(mocks.setCustomerBan).toHaveBeenCalledWith({
        data: { userId: USER_ID, banned: false },
      }),
    );
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ['profiles'] }),
    );
  });

  it('для адміна кнопок бану й видалення немає, є підказка', async () => {
    mocks.getCustomerCard.mockResolvedValue(card({ isAdmin: true }));
    renderCard();
    await heading();
    expect(
      screen.queryByRole('button', { name: t('admin.users.card.ban') }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: t('admin.users.card.delete') }),
    ).toBeNull();
    expect(screen.getByText(t('admin.errors.customerIsAdmin'))).toBeTruthy();
  });
});

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

  it('кнопка неактивна з іншим email, активна без урахування регістру', async () => {
    renderCard();
    const input = await open();
    expect(confirmBtn().hasAttribute('disabled')).toBe(true);
    fireEvent.change(input, { target: { value: 'other@shop.test' } });
    expect(confirmBtn().hasAttribute('disabled')).toBe(true);
    fireEvent.change(input, { target: { value: ' Buyer@Shop.TEST ' } });
    expect(confirmBtn().hasAttribute('disabled')).toBe(false);
  });

  it('успіх → [profiles], refetch замовлень, перехід на список, тост', async () => {
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

  it('ValidationError на confirmEmail → під полем, без тосту, діалог відкритий', async () => {
    mocks.deleteCustomer.mockRejectedValue(
      Object.assign(new Error('v'), {
        name: DOMAIN_ERROR_NAME.validation,
        issues: [{ path: ['confirmEmail'], code: 'invalid_value' }],
      }),
    );
    renderCard();
    const input = await open();
    fireEvent.change(input, { target: { value: 'buyer@shop.test' } });
    fireEvent.click(confirmBtn());
    expect(
      await screen.findByText(t('admin.validation.invalid_value')),
    ).toBeTruthy();
    expect(ui.toastError).not.toHaveBeenCalled();
    expect(ui.navigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/buyer@shop\.test/)).toBeTruthy();
    // Зміна вводу прибирає помилку поля.
    fireEvent.change(input, { target: { value: 'buyer@shop.tes' } });
    expect(screen.queryByText(t('admin.validation.invalid_value'))).toBeNull();
  });

  it('збій пост-кроку після видалення не показується як невдале видалення', async () => {
    mocks.deleteCustomer.mockResolvedValue({});
    renderCard();
    const input = await open();
    ui.navigate.mockRejectedValueOnce(new Error('nav'));
    fireEvent.change(input, { target: { value: 'buyer@shop.test' } });
    fireEvent.click(confirmBtn());
    await waitFor(() => expect(ui.toastSuccess).toHaveBeenCalled());
    expect(ui.toastError).not.toHaveBeenCalled();
  });

  it('закриття діалогу скидає введений email', async () => {
    renderCard();
    const input = await open();
    fireEvent.change(input, { target: { value: 'buyer@shop.test' } });
    fireEvent.click(screen.getByRole('button', { name: t('common.cancel') }));
    await waitFor(() =>
      expect(screen.queryByLabelText(/buyer@shop\.test/)).toBeNull(),
    );
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.users.card.delete') }),
    );
    expect(
      ((await screen.findByLabelText(/buyer@shop\.test/)) as HTMLInputElement)
        .value,
    ).toBe('');
  });
});
