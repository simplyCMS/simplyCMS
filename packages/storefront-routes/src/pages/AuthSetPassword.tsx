import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT } from 'simplycms/i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@simplycms/ui/card';
import { Button } from '@simplycms/ui/button';
import { Skeleton } from '@simplycms/ui/skeleton';
import { SetPasswordForm } from '../components/SetPasswordForm';

/** Стан перевірки сесії: до відповіді Supabase форму показувати не можна. */
type SessionStatus = 'checking' | 'ready' | 'missing';

/**
 * Встановлення пароля після invite-редіректу (спека 2026-08-03 §4.4).
 *
 * Користувач потрапляє сюди вже із сесією — її поставив серверний
 * `/auth/confirm` через `verifyOtp`. Тому сторінка не логінить, а лише
 * дописує пароль уже автентифікованому користувачу й веде його в адмінку.
 */
export default function AuthSetPassword() {
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const t = useT();

  const [status, setStatus] = useState<SessionStatus>('checking');
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setStatus(data.session ? 'ready' : 'missing');
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleSubmit = async (password: string) => {
    setSubmitError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSubmitError(t('auth.setPassword.error'));
      return;
    }
    navigate({ to: '/admin' });
  };

  if (status === 'checking') {
    return <Skeleton className="mx-auto mt-16 h-64 w-full max-w-md" />;
  }

  return (
    <div className="mx-auto mt-16 w-full max-w-md px-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.setPassword.title')}</CardTitle>
          <CardDescription>
            {status === 'missing'
              ? t('auth.setPassword.noSession')
              : t('auth.setPassword.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'missing' ? (
            <Button asChild className="w-full">
              <Link to="/auth">{t('auth.setPassword.backToAuth')}</Link>
            </Button>
          ) : (
            <SetPasswordForm error={submitError} onSubmit={handleSubmit} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
