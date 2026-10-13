import React, { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { authClient } from 'simplycms/core/lib/auth-client';
import { useToast } from 'simplycms/core/hooks/use-toast';
import { Button } from 'simplycms/ui/button';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Eye, EyeOff, Mail, Lock, User, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useT, type Translator } from 'simplycms/i18n';

const buildRegisterSchema = (t: Translator) =>
  z
    .object({
      firstName: z.string().min(2, t('validation.firstNameMin2')),
      lastName: z.string().min(2, t('validation.lastNameMin2')),
      email: z.string().email(t('validation.email')),
      password: z.string().min(6, t('validation.passwordMin6')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confirmPassword'],
    });

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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const registerSchema = useMemo(() => buildRegisterSchema(t), [t]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const result = registerSchema.safeParse({
        firstName,
        lastName,
        email: registerEmail,
        password: registerPassword,
        confirmPassword,
      });

      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.issues.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
        setIsLoading(false);
        return;
      }

      // Better Auth тримає одне поле `name`; на пару воно розбирається
      // серверним хуком провізії (`splitName` у `simplycms/auth`).
      const { data, error } = await authClient.signUp.email({
        email: registerEmail,
        password: registerPassword,
        name: `${firstName} ${lastName}`,
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: t('auth.register.failed'),
          description: error.message ?? t('auth.genericError'),
        });
      } else if (data?.token === null) {
        // Підтвердження пошти ввімкнене: акаунт створено без сесії. Навігація
        // «як залогіненого» повела б на сторінки, що вимагають входу.
        onAwaitingVerification(registerEmail);
      } else {
        toast({
          title: t('auth.register.success'),
          description: t('auth.register.created'),
        });
        navigate({ to: '/' });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('auth.genericError'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return awaitingEmail !== null ? (
    <div role="status" className="space-y-2 text-center">
      <p className="font-medium">{t('auth.register.checkEmail')}</p>
      <p className="text-sm text-muted-foreground">
        {t('auth.register.checkEmailHint')}
      </p>
      {/* Однаковий текст для будь-якої адреси: нічого не каже про існування акаунта. */}
      <p className="text-sm text-muted-foreground">
        {t('auth.register.noEmailHint')}
      </p>
      <Button
        type="button"
        variant="link"
        onClick={() => onGoToLogin(awaitingEmail)}
      >
        {t('auth.forgot.link')}
      </Button>
    </div>
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

      <div className="space-y-2">
        <Label htmlFor="register-password">{t('auth.password')}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="register-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="--------"
            value={registerPassword}
            onChange={(e) => setRegisterPassword(e.target.value)}
            className={`pl-10 pr-10 ${errors.password ? 'border-destructive' : ''}`}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('auth.passwordConfirm')}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="--------"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`pl-10 pr-10 ${errors.confirmPassword ? 'border-destructive' : ''}`}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">{errors.confirmPassword}</p>
        )}
      </div>

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
