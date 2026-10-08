// @vitest-environment jsdom
/** Картка покупця (Task 11, Е6г): роль, бан, видалення. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'simplycms/i18n';
import { DOMAIN_ERROR_NAME } from 'simplycms/contracts/domain-errors';
import { card, mocks, renderCard, stubDom, ui } from './render-support';

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
