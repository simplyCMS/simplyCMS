import { useCallback, useState } from 'react';
import { authClient } from 'simplycms/core/lib/auth-client';
import { useT } from 'simplycms/i18n';
import { useToast } from 'simplycms/ui/use-toast';

/**
 * Запит на скидання пароля — спільний для `/auth` і чекауту.
 *
 * 🔴 Відповідь навмисно однакова для існуючої й неіснуючої пошти — так її
 * будує сам Better Auth, і UI не має права цю рівність порушити: інакше
 * форма перетворюється на перелічувач зареєстрованих адрес.
 */
export function useForgotPassword() {
  const t = useT();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const requestReset = useCallback(
    async (email: string): Promise<void> => {
      if (!email) {
        toast({ variant: 'destructive', title: t('auth.forgot.needEmail') });
        return;
      }
      setPending(true);
      try {
        await authClient.requestPasswordReset({
          email,
          redirectTo: '/auth/set-password',
        });
      } finally {
        setPending(false);
      }
      toast({ title: t('auth.forgot.sent') });
    },
    [t, toast],
  );

  return { requestReset, pending };
}
