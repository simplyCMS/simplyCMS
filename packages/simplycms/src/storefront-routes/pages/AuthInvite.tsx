import { useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { authClient } from 'simplycms/core/lib/auth-client';
import { useT, type MessageKey } from 'simplycms/i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'simplycms/ui/card';
import { Button } from 'simplycms/ui/button';
import { acceptOwnerInvite } from '../server/invite';
import type { AcceptInviteRejection } from 'simplycms/auth';
import { SetPasswordForm } from '../components/SetPasswordForm';

/**
 * Прийняття запрошення власника: `/auth/invite?email=&token=`.
 *
 * 🔴 Посилання з листа веде САМЕ сюди — доти сторінки не існувало взагалі, і
 * єдиний легальний шлях до першого адміна впирався в 404.
 *
 * 🔴 Токен НЕ перевіряється при відкритті сторінки: перевірка ГАСИТЬ його
 * (одноразовість), тож прев'ю-скан поштового клієнта спалив би запрошення ще
 * до того, як власник побачив форму. Тому перевірка й встановлення пароля —
 * один серверний виклик, і рівно на сабміт.
 */

/** Код відмови → ключ каталогу. Сирий текст BA в інтерфейс не потрапляє. */
const REJECTION_MESSAGE: Record<AcceptInviteRejection, MessageKey> = {
  'not-found': 'auth.invite.notFound',
  expired: 'auth.invite.expired',
  mismatch: 'auth.invite.mismatch',
  'password-rejected': 'auth.invite.passwordRejected',
};

export default function AuthInvite() {
  const t = useT();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const email = search.email ?? null;
  const token = search.token ?? null;

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (password: string) => {
    if (!email || !token) return;
    setError(null);

    const result = await acceptOwnerInvite({
      data: { email, token, password },
    });
    if (!result.ok) {
      setError(
        t(
          result.reason
            ? REJECTION_MESSAGE[result.reason]
            : 'auth.invite.notFound',
        ),
      );
      return;
    }

    // Пароль щойно встановлено — вхід робиться ним же, а не окремим токеном:
    // так власник потрапляє в адмінку тим самим шляхом, яким потім заходить
    // щодня, і зламаний вхід видно одразу, а не наступного разу.
    const signedIn = await authClient.signIn.email({ email, password });
    if (signedIn.error) {
      setError(t('auth.invite.signInFailed'));
      return;
    }
    navigate({ to: '/admin' });
  };

  return (
    <div className="mx-auto mt-16 w-full max-w-md px-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.invite.title')}</CardTitle>
          <CardDescription>
            {email && token
              ? t('auth.invite.description')
              : t('auth.invite.badLink')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {email && token ? (
            <SetPasswordForm error={error} onSubmit={handleSubmit} />
          ) : (
            <Button asChild className="w-full">
              <Link to="/auth">{t('auth.invite.backToAuth')}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
