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
import { StoreProfileProvider } from 'simplycms/themes/store-profile';
import type { StorefrontProfile } from 'simplycms/contracts/store-profile';

// Е6г-13: код BANNED з auth-клієнта → переклад із контактами магазину, а не
// сирий `error.message` Better Auth.

const signInEmail = vi.fn();
const toast = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));
vi.mock('simplycms/core/lib/auth-client', () => ({
  authClient: { signIn: { email: (...a: unknown[]) => signInEmail(...a) } },
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}));

import Auth from '../pages/Auth';

const PROFILE: StorefrontProfile = {
  name: 'Крамниця',
  homeTitle: null,
  description: null,
  contacts: { phone: '+380671234567', email: null, address: null, hours: null },
  logoUrl: null,
  socials: [],
};

describe('Auth: вхід забаненого', () => {
  afterEach(() => cleanup());

  it('показує переклад із телефоном магазину, без сирого тексту', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { code: 'BANNED', message: 'Account is banned' },
    });
    render(
      <I18nProvider locale="uk">
        <StoreProfileProvider profile={PROFILE}>
          <Auth />
        </StoreProfileProvider>
      </I18nProvider>,
    );
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'a@b.test' },
    });
    fireEvent.change(document.getElementById('login-password')!, {
      target: { value: 'secret123' },
    });
    fireEvent.submit(document.getElementById('login-email')!.closest('form')!);
    await waitFor(() => expect(toast).toHaveBeenCalled());
    const { description } = toast.mock.calls[0]![0] as { description: string };
    expect(description).toContain('Акаунт заблоковано');
    expect(description).toContain('+380671234567');
    expect(description).not.toContain('Account is banned');
  });
});
