import React, { useState } from 'react';
import { Button } from 'simplycms/ui/button';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Mail, User, Loader2 } from 'lucide-react';
import { useT } from 'simplycms/i18n';
import { RegisterCheckEmail } from './RegisterCheckEmail';
import { RegisterPasswordField } from './RegisterPasswordField';
import { useRegisterSubmit } from './useRegisterSubmit';

/**
 * Форма реєстрації вкладки «Реєстрація». Зі SMTP (Р30) `signUp` повертає
 * `token: null`, і замість форми показується «перевірте пошту».
 *
 * 🔴 Стан «очікуємо лист» (`awaitingEmail`) належить батьківській сторінці, а не
 * формі: після `signUp` Better Auth перезапитує сесію, `Auth` на мить показує
 * спінер замість усього дерева, і форма розмонтовується — власний стан тоді
 * губився, а покупець бачив порожню форму без жодного пояснення.
 */
export function RegisterForm({
  awaitingEmail,
  onAwaitingVerification,
  onGoToLogin,
}: {
  awaitingEmail: string | null;
  onAwaitingVerification: (email: string) => void;
  onGoToLogin: (email: string) => void;
}) {
  const t = useT();
  const { isLoading, errors, submit } = useRegisterSubmit(
    onAwaitingVerification,
  );
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    void submit({
      firstName,
      lastName,
      email: registerEmail,
      password: registerPassword,
      confirmPassword,
    });
  };

  return awaitingEmail !== null ? (
    <RegisterCheckEmail email={awaitingEmail} onGoToLogin={onGoToLogin} />
  ) : (
    <form onSubmit={handleRegister} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">{t('common.firstName')}</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="firstName"
              type="text"
              placeholder={t('auth.firstNamePlaceholder')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={`pl-10 ${errors.firstName ? 'border-destructive' : ''}`}
              disabled={isLoading}
            />
          </div>
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">{t('common.lastName')}</Label>
          <Input
            id="lastName"
            type="text"
            placeholder={t('auth.lastNamePlaceholder')}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={errors.lastName ? 'border-destructive' : ''}
            disabled={isLoading}
          />
          {errors.lastName && (
            <p className="text-sm text-destructive">{errors.lastName}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="register-email"
            type="email"
            placeholder="your@email.com"
            value={registerEmail}
            onChange={(e) => setRegisterEmail(e.target.value)}
            className={`pl-10 ${errors.email ? 'border-destructive' : ''}`}
            disabled={isLoading}
          />
        </div>
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email}</p>
        )}
      </div>

      <RegisterPasswordField
        id="register-password"
        label={t('auth.password')}
        value={registerPassword}
        error={errors.password}
        disabled={isLoading}
        onChange={setRegisterPassword}
      />

      <RegisterPasswordField
        id="confirmPassword"
        label={t('auth.passwordConfirm')}
        value={confirmPassword}
        error={errors.confirmPassword}
        disabled={isLoading}
        onChange={setConfirmPassword}
      />

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('auth.register.pending')}
          </>
        ) : (
          t('auth.register.submit')
        )}
      </Button>
    </form>
  );
}
