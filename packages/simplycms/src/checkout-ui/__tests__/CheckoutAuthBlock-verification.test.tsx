// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from '@testing-library/react';
import { I18nProvider, createTranslator } from 'simplycms/i18n';

// Р30: зі SMTP signUp повертає `token: null` — чекаут не вважає покупця
// залогованим; вхід непідтвердженого має власне повідомлення.

const h = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  reset: vi.fn(),
}));
vi.mock('simplycms/core/lib/auth-client', () => ({
  authClient: {
    signUp: { email: h.signUp },
    signIn: { email: h.signIn },
    requestPasswordReset: h.reset,
  },
}));
vi.mock('simplycms/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { CheckoutAuthBlock } from '../CheckoutAuthBlock';

const t = createTranslator('uk', 'uk');
const CONTACTS = { phone: null, email: null };
const type = (id: string, value: string) =>
  fireEvent.change(document.getElementById(id)!, { target: { value } });

describe('CheckoutAuthBlock: підтвердження пошти (Р30)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('signUp -> { token: null }: «перевірте пошту» + підказка про скидання, onAuthSuccess не кличеться', async () => {
    h.signUp.mockResolvedValue({
      data: { token: null, user: { id: 'u1' } },
      error: null,
    });
    const onAuthSuccess = vi.fn();
    render(
      <I18nProvider locale="uk">
        <CheckoutAuthBlock
          defaultTab="register"
          storeContacts={CONTACTS}
          onAuthSuccess={onAuthSuccess}
        />
      </I18nProvider>,
    );
    type('checkout-auth-first-name', 'Іван');
    type('checkout-auth-last-name', 'Тест');
    type('checkout-auth-register-email', 'a@x.test');
    type('checkout-auth-register-password', 'secret1');
    fireEvent.click(
      screen
        .getAllByRole('button', { name: t('auth.register.submit') })
        .at(-1)!,
    );
    await waitFor(() =>
      expect(
        screen.getByText(t('checkout.auth.registerSuccessCheckEmail')),
      ).toBeTruthy(),
    );
    expect(onAuthSuccess).not.toHaveBeenCalled();
    // M8: однакова для будь-якої адреси підказка + шлях до «Забули пароль».
    expect(screen.getByText(t('auth.register.noEmailHint'))).toBeTruthy();
    expect(
      screen.getByRole('button', { name: t('auth.forgot.link') }),
    ).toBeTruthy();
  });

  it('підказка -> «Забули пароль?»: email з реєстрації вже у вході, клік викликає скидання з ним', async () => {
    h.signUp.mockResolvedValue({
      data: { token: null, user: { id: 'u1' } },
      error: null,
    });
    h.reset.mockResolvedValue({ data: { status: true }, error: null });
    render(
      <I18nProvider locale="uk">
        <CheckoutAuthBlock defaultTab="register" storeContacts={CONTACTS} />
      </I18nProvider>,
    );
    type('checkout-auth-first-name', 'Іван');
    type('checkout-auth-last-name', 'Тест');
    type('checkout-auth-register-email', 'a@x.test');
    type('checkout-auth-register-password', 'secret1');
    fireEvent.click(
      screen
        .getAllByRole('button', { name: t('auth.register.submit') })
        .at(-1)!,
    );
    const hint = await screen.findByRole('button', {
      name: t('auth.forgot.link'),
    });
    fireEvent.click(hint);
    // Перенесення адреси: вдруге вводити не треба.
    expect(
      (document.getElementById('checkout-auth-email') as HTMLInputElement)
        .value,
    ).toBe('a@x.test');
    fireEvent.click(
      screen.getByRole('button', { name: t('auth.forgot.link') }),
    );
    await waitFor(() =>
      expect(h.reset).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@x.test' }),
      ),
    );
  });

  it('вхід: EMAIL_NOT_VERIFIED -> окреме повідомлення, не «невірний пароль»', async () => {
    h.signIn.mockResolvedValue({
      data: null,
      error: { code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' },
    });
    render(
      <I18nProvider locale="uk">
        <CheckoutAuthBlock defaultTab="login" storeContacts={CONTACTS} />
      </I18nProvider>,
    );
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'a@b.test' },
    });
    type('checkout-auth-password', 'secret123');
    fireEvent.click(screen.getAllByRole('button', { name: 'Увійти' }).at(-1)!);
    await waitFor(() =>
      expect(document.body.textContent).toContain(
        t('auth.login.emailNotVerified'),
      ),
    );
    expect(document.body.textContent).not.toContain(
      t('checkout.auth.invalidCredentials'),
    );
  });

  it('вхід: адреса обрізається перед запитом, лише пробіли — запиту немає', async () => {
    h.signIn.mockResolvedValue({ data: { token: 't' }, error: null });
    render(
      <I18nProvider locale="uk">
        <CheckoutAuthBlock
          defaultTab="login"
          storeContacts={CONTACTS}
          onAuthSuccess={vi.fn()}
        />
      </I18nProvider>,
    );
    // Перший «Увійти» — вкладка, останній — кнопка сабміту.
    const submit = () =>
      fireEvent.click(
        screen.getAllByRole('button', { name: t('auth.login.submit') }).at(-1)!,
      );
    // jsdom для type=email сам зрізає пробіли й маскував би перевірку trim.
    document
      .getElementById('checkout-auth-email')!
      .setAttribute('type', 'text');
    type('checkout-auth-email', '   ');
    type('checkout-auth-password', 'secret1');
    submit();
    expect(h.signIn).not.toHaveBeenCalled();
    type('checkout-auth-email', '  a@x.test ');
    submit();
    await waitFor(() => expect(h.signIn).toHaveBeenCalled());
    expect(h.signIn.mock.calls[0]![0].email).toBe('a@x.test');
  });
});
