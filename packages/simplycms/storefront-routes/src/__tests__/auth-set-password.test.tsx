// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from '@testing-library/react';
import { I18nProvider, createTranslator } from '@simplycms/i18n';

// Очікувані рядки беремо з публічного транслятора, а не з каталогу напряму:
// підкаталог `catalogs/*` не в `exports` пакета (audit-exports це стереже).
const uk = createTranslator('uk');

/**
 * Сторінка встановлення пароля після invite-редіректу (спека 2026-08-03 §4.4).
 *
 * Користувач приходить сюди вже залогіненим — сесію поставив серверний
 * `/auth/confirm`. Тому перевіряємо дві гілки: сесії немає (протермінований
 * лінк) і сесія є (валідна пара паролів іде в `updateUser`).
 */

const navigate = vi.fn();
const updateUser = vi.fn();
const getSession = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@simplycms/supabase/SupabaseProvider', () => ({
  useSupabaseClient: () => ({ auth: { getSession, updateUser } }),
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
    updateUser.mockReset();
    updateUser.mockResolvedValue({ error: null });
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
  });

  afterEach(() => cleanup());

  it('без сесії показує повідомлення про недійсний лінк', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    renderPage();

    expect(
      await screen.findByText(uk('auth.setPassword.noSession')),
    ).toBeDefined();
    expect(screen.queryByLabelText(uk('auth.setPassword.password'))).toBeNull();
  });

  it('із сесією сабміт валідної пари викликає updateUser і веде в /admin', async () => {
    renderPage();

    await screen.findByLabelText(uk('auth.setPassword.password'));
    fillPasswords('supersecret', 'supersecret');

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith({ password: 'supersecret' }),
    );
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/admin' }),
    );
  });

  it('різні паролі не йдуть у Supabase', async () => {
    renderPage();

    await screen.findByLabelText(uk('auth.setPassword.password'));
    fillPasswords('supersecret', 'other-secret');

    expect(
      await screen.findByText(uk('auth.setPassword.mismatch')),
    ).toBeDefined();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('помилка Supabase показує текст помилки і не редиректить', async () => {
    updateUser.mockResolvedValue({ error: { message: 'weak password' } });
    renderPage();

    await screen.findByLabelText(uk('auth.setPassword.password'));
    fillPasswords('supersecret', 'supersecret');

    expect(await screen.findByText(uk('auth.setPassword.error'))).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });
});
