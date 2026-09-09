// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from '@testing-library/react';
import { I18nProvider, createTranslator } from 'simplycms/i18n';

// Очікувані рядки беремо з публічного транслятора, а не з каталогу напряму:
// підкаталог `catalogs/*` не в `exports` пакета (audit-exports це стереже).
const uk = createTranslator('uk');

/**
 * Сторінка встановлення нового пароля (К1′б, Better Auth).
 *
 * Дозвіл дає ТОКЕН у query — його кладе редірект
 * `/api/auth/reset-password/<token>` на `callbackURL`. Тому дві гілки:
 * токена немає (лінк недійсний) і токен є (валідна пара йде в
 * `authClient.resetPassword` разом із ним).
 */

const navigate = vi.fn();
const resetPassword = vi.fn();
let search: Record<string, string | undefined> = {};

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useSearch: () => search,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('simplycms/core/lib/auth-client', () => ({
  authClient: { resetPassword: (...args: unknown[]) => resetPassword(...args) },
}));

import AuthSetPassword from '../pages/AuthSetPassword';

function renderPage() {
  return render(
    <I18nProvider locale="uk">
      <AuthSetPassword />
    </I18nProvider>,
  );
}

/** Заповнює обидва поля пароля значеннями. */
function fillPasswords(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText(uk('auth.setPassword.password')), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText(uk('auth.setPassword.confirm')), {
    target: { value: confirm },
  });
  fireEvent.click(
    screen.getByRole('button', { name: uk('auth.setPassword.submit') }),
  );
}

describe('сторінка /auth/set-password', () => {
  beforeEach(() => {
    navigate.mockReset();
    resetPassword.mockReset();
    resetPassword.mockResolvedValue({ error: null });
    search = { token: 'reset-token' };
  });

  afterEach(() => cleanup());

  it('без токена показує повідомлення про недійсний лінк', async () => {
    search = {};
    renderPage();

    expect(
      await screen.findByText(uk('auth.setPassword.noSession')),
    ).toBeDefined();
    expect(screen.queryByLabelText(uk('auth.setPassword.password'))).toBeNull();
  });

  it('із токеном сабміт валідної пари йде в resetPassword і веде на /auth', async () => {
    renderPage();

    await screen.findByLabelText(uk('auth.setPassword.password'));
    fillPasswords('supersecret', 'supersecret');

    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith({
        newPassword: 'supersecret',
        token: 'reset-token',
      }),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/auth' }));
  });

  it('різні паролі не йдуть у Better Auth', async () => {
    renderPage();

    await screen.findByLabelText(uk('auth.setPassword.password'));
    fillPasswords('supersecret', 'other-secret');

    expect(
      await screen.findByText(uk('auth.setPassword.mismatch')),
    ).toBeDefined();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('помилка Better Auth показує текст помилки і не редиректить', async () => {
    resetPassword.mockResolvedValue({ error: { code: 'INVALID_TOKEN' } });
    renderPage();

    await screen.findByLabelText(uk('auth.setPassword.password'));
    fillPasswords('supersecret', 'supersecret');

    expect(await screen.findByText(uk('auth.setPassword.error'))).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });
});
