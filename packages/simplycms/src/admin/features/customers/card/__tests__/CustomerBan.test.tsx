// @vitest-environment jsdom
/** Картка покупця (Task 11, Е6г): роль, бан, видалення. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'simplycms/i18n';
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
