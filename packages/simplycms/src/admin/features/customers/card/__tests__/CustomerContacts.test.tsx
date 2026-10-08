// @vitest-environment jsdom
/** Картка покупця (Task 10, Е6г): перегляд, категорія, контакти, стани. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'simplycms/i18n';
import { DOMAIN_ERROR_NAME } from 'simplycms/contracts/domain-errors';
import {
  CAT,
  VIP,
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

  it('клієнтська валідація: переклад, а не англійський текст Zod', async () => {
    renderCard();
    const email = await screen.findByLabelText(t('admin.users.card.email'));
    fireEvent.change(screen.getByLabelText(t('common.firstName')), {
      target: { value: '' },
    });
    fireEvent.change(email, { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: t('common.save') }));
    expect(await screen.findByText(t('validation.nameRequired'))).toBeTruthy();
    expect(screen.getByText(t('validation.emailFormat'))).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Too small|Invalid/);
    expect(mocks.updateCustomerContacts).not.toHaveBeenCalled();
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
