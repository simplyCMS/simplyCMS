// @vitest-environment jsdom
/** Картка покупця (Task 10, Е6г): перегляд, категорія, контакти, стани. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { createTranslator } from 'simplycms/i18n';
import {
  CAT,
  VIP,
  card,
  mocks,
  order,
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
    // Замовлення іншого покупця мок віддає теж: фільтр — це предикат `userId`.
    mocks.listOrders.mockResolvedValue([
      order(1),
      order(2),
      { ...order(3), userId: 'u0000000-0000-4000-8000-0000000000aa' },
    ]);
    renderCard();
    const link = await screen.findByRole('link', { name: 'ORD-2' });
    expect(screen.getByRole('link', { name: 'ORD-1' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'ORD-3' })).toBeNull();
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
