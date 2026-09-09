import { useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { authClient } from 'simplycms/core/lib/auth-client';
import { useT } from 'simplycms/i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'simplycms/ui/card';
import { Button } from 'simplycms/ui/button';
import { SetPasswordForm } from '../components/SetPasswordForm';

/**
 * Встановлення нового пароля за одноразовим токеном (К1′б).
 *
 * 🔴 Контур змінився з GoTrue на Better Auth, і разом із ним — джерело
 * дозволу. Раніше сторінка вимагала СЕСІЮ, яку ставив серверний
 * `/auth/confirm` через `verifyOtp`; тепер вона працює з ТОКЕНОМ у query.
 * BA сам віддає його сюди: лист веде на `/api/auth/reset-password/<token>`,
 * той редиректить на `callbackURL` (`/auth/set-password`) з `?token=`.
 * Наслідок — сторінка синхронно знає, чи має право показувати форму, і
 * зайвого запиту «а чи є сесія» більше немає.
 */
export default function AuthSetPassword() {
  const navigate = useNavigate();
  const t = useT();
  const search = useSearch({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const token = search.token ?? null;

  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (password: string) => {
    if (!token) return;
    setSubmitError(null);

    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    if (error) {
      setSubmitError(t('auth.setPassword.error'));
      return;
    }

    // Після скидання сесії немає — BA гасить усі сесії користувача, тож
    // ведемо на вхід, а не в кабінет.
    navigate({ to: '/auth' });
  };

  return (
    <div className="mx-auto mt-16 w-full max-w-md px-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.setPassword.title')}</CardTitle>
          <CardDescription>
            {token
              ? t('auth.setPassword.description')
              : t('auth.setPassword.noSession')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {token ? (
            <SetPasswordForm error={submitError} onSubmit={handleSubmit} />
          ) : (
            <Button asChild className="w-full">
              <Link to="/auth">{t('auth.setPassword.backToAuth')}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
