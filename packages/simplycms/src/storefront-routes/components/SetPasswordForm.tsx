import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useT } from 'simplycms/i18n';
import type { Translator } from 'simplycms/i18n';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'simplycms/ui/form';
import { Input } from 'simplycms/ui/input';
import { Button } from 'simplycms/ui/button';

/** Схема будується від транслятора — повідомлення валідації теж локалізовані. */
function buildSchema(t: Translator) {
  return z
    .object({
      password: z.string().min(8, t('auth.setPassword.tooShort')),
      confirm: z.string(),
    })
    .refine((data) => data.password === data.confirm, {
      message: t('auth.setPassword.mismatch'),
      path: ['confirm'],
    });
}

type SetPasswordValues = z.infer<ReturnType<typeof buildSchema>>;

/**
 * Форма нового пароля: валідація й поля. Сам виклик Supabase лишається у
 * сторінці — форма нічого не знає ні про клієнта, ні про навігацію.
 */
export function SetPasswordForm({
  error,
  onSubmit,
}: {
  error: string | null;
  onSubmit: (password: string) => Promise<void>;
}) {
  const t = useT();
  const schema = useMemo(() => buildSchema(t), [t]);
  const form = useForm<SetPasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => onSubmit(values.password))}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.setPassword.password')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.setPassword.confirm')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {t('auth.setPassword.submit')}
        </Button>
      </form>
    </Form>
  );
}
