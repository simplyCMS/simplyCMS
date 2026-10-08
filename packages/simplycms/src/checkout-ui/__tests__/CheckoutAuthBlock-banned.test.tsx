// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';

// Е6г-13: чекаут має власну форму входу — гілка BANNED обовʼязкова, інакше
// там показався б сирий `error.message`.

const signInEmail = vi.fn();

vi.mock('simplycms/core/lib/auth-client', () => ({
  authClient: { signIn: { email: (...a: unknown[]) => signInEmail(...a) } },
}));
vi.mock('simplycms/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { CheckoutAuthBlock } from '../CheckoutAuthBlock';

const CONTACTS = { phone: '+380671234567', email: null };

describe('CheckoutAuthBlock: вхід забаненого', () => {
  afterEach(() => cleanup());

  it('показує переклад із телефоном магазину, без сирого тексту', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { code: 'BANNED', message: 'Account is banned' },
    });
    render(
      <I18nProvider locale="uk">
        <CheckoutAuthBlock defaultTab="login" storeContacts={CONTACTS} />
      </I18nProvider>,
    );
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'a@b.test' },
    });
    fireEvent.change(document.getElementById('checkout-auth-password')!, {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Увійти' }).at(-1)!);
    await waitFor(() =>
      expect(document.body.textContent).toContain('Акаунт заблоковано'),
    );
    expect(document.body.textContent).toContain('+380671234567');
    expect(document.body.textContent).not.toContain('Account is banned');
  });
});
