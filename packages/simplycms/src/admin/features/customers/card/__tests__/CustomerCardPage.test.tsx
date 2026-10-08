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
import { DOMAIN_ERROR_NAME } from 'simplycms/contracts/domain-errors';
import {
  CAT,
  VIP,
  USER_ID,
  card,
  clientRef,
  mocks,
  order,
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
const validation = (path: string, code: string) =>
  Object.assign(new Error('validation'), {
    name: DOMAIN_ERROR_NAME.validation,
    issues: [{ path: [path], code }],
  });

beforeEach(() => {
  stubDom();
  vi.clearAllMocks();
  mocks.getCustomerCard.mockResolvedValue(card());
  mocks.listUserCategories.mockResolvedValue([CAT, VIP]);
  mocks.listOrders.mockResolvedValue([]);
});
afterEach(cleanup);

describe('CustomerCardPage: перегляд', () => {
  it('провайдери, UTM, історія (правило / email адміна), статистика, аватар', async () => {
    mocks.getCustomerCard.mockResolvedValue(
      card({ avatarRef: 'avatars/u1.png' }),
    );
    renderCard();
    await screen.findByRole('heading', { name: /Іван Петренко/ });
    expect(screen.getByText(/credential/)).toBeTruthy();
    expect(screen.getByText(/google/)).toBeTruthy();
    expect(screen.getByText(/facebook/)).toBeTruthy();
    expect(screen.getByText(/autumn-sale/)).toBeTruthy();
    expect(screen.getByText(t('admin.users.card.historyRule'))).toBeTruthy();
    expect(screen.getByText(/boss@shop\.test/)).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    const img = document.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/media/avatars/u1.png');
  });

  it('останні замовлення: посилання на картку замовлення', async () => {
    mocks.listOrders.mockResolvedValue([order(1), order(2)]);
    renderCard();
    const link = await screen.findByRole('link', { name: 'ORD-2' });
    expect(link.getAttribute('href')).toBe(
      '/admin/orders/o0000002-0000-4000-8000-000000000001',
    );
  });

  it('stats: null → «—», картка відкривається', async () => {
    mocks.getCustomerCard.mockResolvedValue(card({ stats: null }));
    renderCard();
    await screen.findByRole('heading', { name: /Іван Петренко/ });
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('null з сервера → «не знайдено»', async () => {
    mocks.getCustomerCard.mockResolvedValue(null);
    renderCard();
    expect(await screen.findByText(t('admin.users.notFound'))).toBeTruthy();
  });

  it('збій завантаження → помилка з «Повторити», а не «не знайдено»', async () => {
    mocks.getCustomerCard.mockRejectedValueOnce(new Error('boom'));
    renderCard();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText(t('admin.users.notFound'))).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.users.card.retry') }),
    );
    await screen.findByRole('heading', { name: /Іван Петренко/ });
    expect(mocks.getCustomerCard).toHaveBeenCalledTimes(2);
  });
});

describe('CustomerCardPage: контакти', () => {
  it('ValidationError taken → повідомлення під email, тосту немає', async () => {
    mocks.updateCustomerContacts.mockRejectedValue(
      validation('email', 'taken'),
    );
    renderCard();
    const email = await screen.findByLabelText(t('admin.users.card.email'));
    fireEvent.change(email, { target: { value: 'busy@shop.test' } });
    fireEvent.click(screen.getByRole('button', { name: t('common.save') }));
    const alert = await screen.findByText(t('admin.validation.taken'));
    expect(alert).toBeTruthy();
    expect(ui.toastError).not.toHaveBeenCalled();
    expect(mocks.updateCustomerContacts).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        email: 'busy@shop.test',
      }),
    });
  });

  it('успіх: тост і інвалідація [profiles]', async () => {
    mocks.updateCustomerContacts.mockResolvedValue({});
    renderCard();
    await screen.findByLabelText(t('admin.users.card.email'));
    const spy = vi.spyOn(clientRef.current, 'invalidateQueries');
    fireEvent.change(screen.getByLabelText(t('common.firstName')), {
      target: { value: 'Петро' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('common.save') }));
    await waitFor(() => expect(ui.toastSuccess).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith({ queryKey: ['profiles'] });
  });
});

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
