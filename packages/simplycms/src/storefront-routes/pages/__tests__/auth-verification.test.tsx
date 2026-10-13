// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { I18nProvider, createTranslator } from 'simplycms/i18n';

/**
 * Р30: з підтвердженням пошти `signUp` повертає `token: null` — сторінка
 * показує «перевірте пошту» і не веде як залогованого; вхід непідтвердженого
 * (код `EMAIL_NOT_VERIFIED`) має власне повідомлення.
 */
const h = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
  tab: 'register',
  loading: false,
}));

vi.mock('simplycms/core/lib/auth-client', () => ({
  authClient: {
    signUp: { email: h.signUp },
    signIn: { email: h.signIn },
    requestPasswordReset: vi.fn(),
  },
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, isLoading: h.loading }),
}));
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast: h.toast }),
}));
vi.mock('simplycms/themes/store-profile', () => ({
  useStoreProfile: () => ({ name: 'Магазин', contacts: {} }),
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => h.navigate,
  useSearch: () => ({ tab: h.tab }),
}));

import Auth from '../Auth';

const t = createTranslator('uk');
const type = (id: string, value: string) =>
  fireEvent.change(document.getElementById(id)!, { target: { value } });

const renderAuth = () =>
  render(
    <I18nProvider locale="uk">
      <Auth />
    </I18nProvider>,
  );

describe('Auth: підтвердження пошти (Р30)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.loading = false;
  });
  afterEach(cleanup);

  it('signUp -> { token: null }: показано «перевірте пошту», навігації немає', async () => {
    h.tab = 'register';
    h.signUp.mockResolvedValue({
      data: { token: null, user: { id: 'u1' } },
      error: null,
    });
    renderAuth();
    type('firstName', 'Іван');
    type('lastName', 'Тест');
    type('register-email', 'a@x.test');
    type('register-password', 'secret1');
    type('confirmPassword', 'secret1');
    fireEvent.click(
      screen.getByRole('button', { name: t('auth.register.submit') }),
    );

    await waitFor(() =>
      expect(screen.getByText(t('auth.register.checkEmail'))).toBeTruthy(),
    );
    expect(screen.getByText(t('auth.register.checkEmailHint'))).toBeTruthy();
    // M8: підказка про скидання пароля — однакова для будь-якої адреси.
    expect(screen.getByText(t('auth.register.noEmailHint'))).toBeTruthy();
    expect(
      screen.getByRole('button', { name: t('auth.forgot.link') }),
    ).toBeTruthy();
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: t('auth.register.success') }),
    );
  });

  it('«перевірте пошту» переживає спінер сесії, що розмонтовує форму', async () => {
    h.tab = 'register';
    h.signUp.mockResolvedValue({
      data: { token: null, user: { id: 'u1' } },
      error: null,
    });
    const view = renderAuth();
    type('firstName', 'Іван');
    type('lastName', 'Тест');
    type('register-email', 'a@x.test');
    type('register-password', 'secret1');
    type('confirmPassword', 'secret1');
    fireEvent.click(
      screen.getByRole('button', { name: t('auth.register.submit') }),
    );
    await screen.findByText(t('auth.register.checkEmail'));
    // Better Auth перезапитує сесію: `Auth` на мить віддає спінер замість дерева.
    h.loading = true;
    view.rerender(
      <I18nProvider locale="uk">
        <Auth />
      </I18nProvider>,
    );
    expect(screen.queryByText(t('auth.register.checkEmail'))).toBeNull();
    h.loading = false;
    view.rerender(
      <I18nProvider locale="uk">
        <Auth />
      </I18nProvider>,
    );
    expect(screen.getByText(t('auth.register.checkEmail'))).toBeTruthy();
  });

  it('перемикання вкладок скидає «перевірте пошту»: форма реєстрації знову доступна', async () => {
    h.tab = 'register';
    h.signUp.mockResolvedValue({
      data: { token: null, user: { id: 'u1' } },
      error: null,
    });
    renderAuth();
    type('firstName', 'Іван');
    type('lastName', 'Тест');
    type('register-email', 'a@x.test');
    type('register-password', 'secret1');
    type('confirmPassword', 'secret1');
    fireEvent.click(
      screen.getByRole('button', { name: t('auth.register.submit') }),
    );
    await screen.findByText(t('auth.register.checkEmail'));
    fireEvent.mouseDown(
      screen.getByRole('tab', { name: t('auth.login.tab') }),
      {
        button: 0,
      },
    );
    fireEvent.mouseDown(
      screen.getByRole('tab', { name: t('auth.register.title') }),
      { button: 0 },
    );
    await waitFor(() =>
      expect(document.getElementById('register-email')).not.toBeNull(),
    );
    expect(screen.queryByText(t('auth.register.checkEmail'))).toBeNull();
  });

  it('вхід: адреса з пробілами обрізається перед запитом', async () => {
    h.tab = 'login';
    h.signIn.mockResolvedValue({ data: { token: 't' }, error: null });
    renderAuth();
    // jsdom для type=email сам зрізає пробіли й маскував би перевірку trim.
    document.getElementById('login-email')!.setAttribute('type', 'text');
    type('login-email', '  a@x.test ');
    type('login-password', 'secret1');
    fireEvent.click(
      screen.getByRole('button', { name: t('auth.login.submit') }),
    );
    await waitFor(() => expect(h.signIn).toHaveBeenCalled());
    expect(h.signIn.mock.calls[0]![0].email).toBe('a@x.test');
  });

  it('підказка -> перехід на вхід переносить email з реєстрації', async () => {
    h.tab = 'register';
    h.signUp.mockResolvedValue({
      data: { token: null, user: { id: 'u1' } },
      error: null,
    });
    renderAuth();
    type('firstName', 'Іван');
    type('lastName', 'Тест');
    type('register-email', 'a@x.test');
    type('register-password', 'secret1');
    type('confirmPassword', 'secret1');
    fireEvent.click(
      screen.getByRole('button', { name: t('auth.register.submit') }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: t('auth.forgot.link') }),
    );
    await waitFor(() =>
      expect(
        (document.getElementById('login-email') as HTMLInputElement).value,
      ).toBe('a@x.test'),
    );
  });

  it('signUp з сесією (dev, драйвер log): навігація як і раніше', async () => {
    h.tab = 'register';
    h.signUp.mockResolvedValue({
      data: { token: 'tok', user: { id: 'u1' } },
      error: null,
    });
    renderAuth();
    type('firstName', 'Іван');
    type('lastName', 'Тест');
    type('register-email', 'a@x.test');
    type('register-password', 'secret1');
    type('confirmPassword', 'secret1');
    fireEvent.click(
      screen.getByRole('button', { name: t('auth.register.submit') }),
    );
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith({ to: '/' }));
    expect(screen.queryByText(t('auth.register.checkEmail'))).toBeNull();
  });

  it('вхід: EMAIL_NOT_VERIFIED -> окреме повідомлення, не «невірний пароль»', async () => {
    h.tab = 'login';
    h.signIn.mockResolvedValue({
      data: null,
      error: { code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' },
    });
    renderAuth();
    type('login-email', 'a@x.test');
    type('login-password', 'secret1');
    fireEvent.click(
      screen.getByRole('button', { name: t('auth.login.submit') }),
    );
    await waitFor(() => expect(h.toast).toHaveBeenCalled());
    const call = h.toast.mock.calls[0]![0] as { description: string };
    expect(call.description).toBe(t('auth.login.emailNotVerified'));
    expect(call.description).not.toBe(t('auth.login.badCredentials'));
  });
});
