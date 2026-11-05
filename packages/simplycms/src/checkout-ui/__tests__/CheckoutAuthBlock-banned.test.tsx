// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from '@testing-library/react';

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
import { TestI18nProvider } from '../../../test-harness/i18n';

const CONTACTS = { phone: '+380671234567', email: null };

async function attemptBannedLogin(contacts: {
  phone: string | null;
  email: string | null;
}) {
  signInEmail.mockResolvedValue({
    data: null,
    error: { code: 'BANNED', message: 'Account is banned' },
  });
  render(
    <TestI18nProvider>
      <CheckoutAuthBlock defaultTab="login" storeContacts={contacts} />
    </TestI18nProvider>,
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
  return document.body.textContent ?? '';
}

describe('CheckoutAuthBlock: вхід забаненого', () => {
  afterEach(() => cleanup());

  it('показує переклад із телефоном магазину, без сирого тексту', async () => {
    const text = await attemptBannedLogin(CONTACTS);
    expect(text).toContain('+380671234567');
    expect(text).not.toContain('Account is banned');
  });

  it('без жодного контакту — базова фраза без двокрапки', async () => {
    const text = await attemptBannedLogin({ phone: null, email: null });
    expect(text).toContain('Акаунт заблоковано. Звʼяжіться з магазином');
    expect(text).not.toContain('магазином:');
  });
});
