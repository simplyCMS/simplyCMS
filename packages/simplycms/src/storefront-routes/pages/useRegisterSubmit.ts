import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { authClient } from 'simplycms/core/lib/auth-client';
import { useToast } from 'simplycms/core/hooks/use-toast';
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

export type RegisterValues = z.input<ReturnType<typeof buildRegisterSchema>>;

/**
 * Відправка форми реєстрації: валідація, `signUp`, розвилка «акаунт без сесії»
 * (підтвердження пошти, Р30) проти «увійшов». Окремо від розмітки форми — так
 * вона лишається описом полів, а не змішує їх із запитом.
 */
export function useRegisterSubmit(
  onAwaitingVerification: (email: string) => void,
) {
  const t = useT();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const registerSchema = useMemo(() => buildRegisterSchema(t), [t]);

  const submit = async (values: RegisterValues) => {
    setErrors({});
    setIsLoading(true);
    try {
      const result = registerSchema.safeParse(values);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.issues.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }

      // Better Auth тримає одне поле `name`; на пару воно розбирається
      // серверним хуком провізії (`splitName` у `simplycms/auth`).
      const { data, error } = await authClient.signUp.email({
        email: values.email,
        password: values.password,
        name: `${values.firstName} ${values.lastName}`,
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
        onAwaitingVerification(values.email);
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

  return { isLoading, errors, submit };
}
