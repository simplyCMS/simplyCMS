// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider, createTranslator } from 'simplycms/i18n';
import AuthInvite from '../pages/AuthInvite';

/**
 * Прийняття запрошення поверх активної сесії покупця: вихід із неї — ДО входу
 * власника, штатним шляхом (`useAuth().signOut`), щоб клієнтський стан
 * попереднього користувача не перейшов у адмінку.
 */
const calls = vi.hoisted(() => ({
  order: [] as string[],
  user: { current: null as { id: string } | null },
  accept: vi.fn(),
  signOut: vi.fn(),
}));
const navigate = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useSearch: () => ({ email: 'owner@shop.ua', token: 'tok' }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({
    user: calls.user.current,
  }),
}));
vi.mock('simplycms/core/lib/auth-client', () => ({
  authClient: {
    signOut: async () => {
      calls.order.push('signOut');
      return calls.signOut();
    },
    signIn: {
      email: async () => {
        calls.order.push('signIn');
        return { error: null };
      },
    },
  },
}));
vi.mock('../server/invite', () => ({ acceptOwnerInvite: calls.accept }));

const t = createTranslator('uk', 'uk');

async function submitInvite() {
  render(
    <I18nProvider locale="uk">
      <AuthInvite />
    </I18nProvider>,
  );
  for (const input of document.querySelectorAll('input'))
    fireEvent.change(input, { target: { value: 'N3w-passw0rd!x' } });
  fireEvent.click(screen.getByRole('button', { name: /\S/ }));
  await vi.waitFor(() => expect(calls.accept).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  calls.order.length = 0;
  calls.accept.mockReset();
  calls.signOut.mockReset().mockReturnValue({ error: null });
  navigate.mockReset();
});
afterEach(() => cleanup());

describe('AuthInvite поверх чужої сесії', () => {
  it('активна сесія покупця → signOut ДО signIn власника', async () => {
    calls.user.current = { id: 'customer' };
    calls.accept.mockResolvedValue({ ok: true });
    await submitInvite();
    expect(calls.order).toEqual(['signOut', 'signIn']);
    expect(navigate).toHaveBeenCalledWith({ to: '/admin' });
  });

  it('без активної сесії → лише signIn', async () => {
    calls.user.current = null;
    calls.accept.mockResolvedValue({ ok: true });
    await submitInvite();
    expect(calls.order).toEqual(['signIn']);
  });

  it('запрошення відхилено → сесію покупця не чіпаємо', async () => {
    calls.user.current = { id: 'customer' };
    calls.accept.mockResolvedValue({ ok: false, reason: 'expired' });
    await submitInvite();
    expect(calls.order).toEqual([]);
    expect(screen.getByText(t('auth.invite.expired'))).toBeTruthy();
  });

  it.each([
    [
      '{ error }',
      () => calls.signOut.mockReturnValue({ error: { message: 'x' } }),
    ],
    [
      'виняток',
      () =>
        calls.signOut.mockImplementation(() => {
          throw new Error('net');
        }),
    ],
  ])(
    'збій виходу (%s) → signIn не кличемо, показуємо помилку',
    async (_n, arm) => {
      calls.user.current = { id: 'customer' };
      calls.accept.mockResolvedValue({ ok: true });
      arm();
      await submitInvite();
      expect(calls.order).toEqual(['signOut']);
      expect(navigate).not.toHaveBeenCalled();
      expect(screen.getByText(t('auth.invite.signInFailed'))).toBeTruthy();
    },
  );
});
