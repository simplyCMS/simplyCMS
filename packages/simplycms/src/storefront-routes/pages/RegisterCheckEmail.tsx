import { Button } from 'simplycms/ui/button';
import { useT } from 'simplycms/i18n';

/**
 * Екран «перевірте пошту» після реєстрації з підтвердженням (Р30). Текст
 * однаковий для будь-якої адреси: нічого не каже про існування акаунта.
 */
export function RegisterCheckEmail({
  email,
  onGoToLogin,
}: {
  email: string;
  onGoToLogin: (email: string) => void;
}) {
  const t = useT();
  return (
    <div role="status" className="space-y-2 text-center">
      <p className="font-medium">{t('auth.register.checkEmail')}</p>
      <p className="text-sm text-muted-foreground">
        {t('auth.register.checkEmailHint')}
      </p>
      <p className="text-sm text-muted-foreground">
        {t('auth.register.noEmailHint')}
      </p>
      <Button type="button" variant="link" onClick={() => onGoToLogin(email)}>
        {t('auth.forgot.link')}
      </Button>
    </div>
  );
}
