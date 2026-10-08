// @vitest-environment jsdom
/** Картка покупця (Task 10, Е6г): перегляд, категорія, контакти, стани. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createTranslator } from 'simplycms/i18n';
import {
  CAT,
  VIP,
  USER_ID,
  card,
  clientRef,
  mocks,
  renderCard,
  stubDom,
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
    Link: ({
      to,
      params,
      children,
    }: {
      to: string;
      params?: Record<string, string>;
      children: React.ReactNode;
    }) => (
      <a href={to.replace(/\$(\w+)/, (_, k: string) => params?.[k] ?? '')}>
        {children}
      </a>
    ),
  };
});
vi.mock('simplycms/core/hooks/useAuth', async () => {
  const { ui } = await import('./mocks');
  return { useAuth: () => ({ user: { id: ui.currentUserId } }) };
});

const t = createTranslator('uk');

beforeEach(() => {
  stubDom();
  vi.clearAllMocks();
  mocks.getCustomerCard.mockResolvedValue(card());
  mocks.listUserCategories.mockResolvedValue([CAT, VIP]);
  mocks.listOrders.mockResolvedValue([]);
});
afterEach(cleanup);

describe('CustomerCardPage: категорія', () => {
  it('закріплення: assignCustomerCategory з locked: true й інвалідація [profiles]', async () => {
    mocks.assignCustomerCategory.mockResolvedValue({});
    renderCard();
    await screen.findByRole('heading', { name: /Іван Петренко/ });
    const spy = vi.spyOn(clientRef.current, 'invalidateQueries');
    fireEvent.click(
      screen.getByRole('combobox', { name: t('admin.users.userCategory') }),
    );
    fireEvent.click(await screen.findByRole('option', { name: 'VIP' }));
    fireEvent.click(
      screen.getByRole('switch', { name: t('admin.users.card.lockCategory') }),
    );
    fireEvent.change(screen.getByLabelText(t('admin.users.card.reason')), {
      target: { value: 'Постійний клієнт' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.users.card.assign') }),
    );
    await waitFor(() =>
      expect(mocks.assignCustomerCategory).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          categoryId: VIP.id,
          reason: 'Постійний клієнт',
          locked: true,
        },
      }),
    );
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ['profiles'] }),
    );
    expect(
      within(document.body).queryByText(t('admin.users.card.reasonRequired')),
    ).toBeNull();
  });

  it('без причини сервер не кличеться', async () => {
    renderCard();
    await screen.findByRole('heading', { name: /Іван Петренко/ });
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.users.card.assign') }),
    );
    expect(
      await screen.findByText(t('admin.users.card.reasonRequired')),
    ).toBeTruthy();
    expect(mocks.assignCustomerCategory).not.toHaveBeenCalled();
  });
});
