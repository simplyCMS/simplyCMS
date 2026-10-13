// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { I18nProvider, createTranslator } from 'simplycms/i18n';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  request: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('simplycms/core/lib/auth-client', () => ({
  authClient: { requestPasswordReset: h.request },
}));
vi.mock('simplycms/ui/use-toast', () => ({
  useToast: () => ({ toast: h.toast }),
}));

import { useForgotPassword } from '../useForgotPassword';

const t = createTranslator('uk');
const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider locale="uk">{children}</I18nProvider>
);

describe('useForgotPassword', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('порожній email (і лише пробіли): тост needEmail, запиту немає', async () => {
    const { result } = renderHook(() => useForgotPassword(), { wrapper });
    await act(() => result.current.requestReset('   '));
    expect(h.request).not.toHaveBeenCalled();
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: t('auth.forgot.needEmail') }),
    );
  });

  it('email обрізається, pending піднімається на час запиту й падає після', async () => {
    let finish!: () => void;
    h.request.mockReturnValue(new Promise<void>((r) => (finish = r)));
    const { result } = renderHook(() => useForgotPassword(), { wrapper });
    let done!: Promise<void>;
    act(() => {
      done = result.current.requestReset('  a@x.test ');
    });
    expect(result.current.pending).toBe(true);
    expect(h.request).toHaveBeenCalledWith({
      email: 'a@x.test',
      redirectTo: '/auth/set-password',
    });
    await act(async () => {
      finish();
      await done;
    });
    expect(result.current.pending).toBe(false);
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: t('auth.forgot.sent') }),
    );
  });
});
