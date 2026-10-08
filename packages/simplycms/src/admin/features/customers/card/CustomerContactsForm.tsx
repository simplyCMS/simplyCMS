import { useT } from 'simplycms/i18n';
import type { AdminCustomerCard } from 'simplycms/contracts/objects';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { TextField } from '../../catalog-dictionaries/form-fields';
import { useUpdateContacts } from './useUpdateContacts';

/** Контакти й email покупця; серверна помилка `taken` показується під email. */
export default function CustomerContactsForm({
  card,
}: {
  readonly card: AdminCustomerCard;
}) {
  const t = useT();
  const { form, onSubmit } = useUpdateContacts(card);
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.users.contacts')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <TextField
            id="cc-first"
            label={t('common.firstName')}
            registration={register('firstName')}
            invalid={!!errors.firstName}
            errorText={
              errors.firstName?.message ?? t('validation.nameRequired')
            }
          />
          <TextField
            id="cc-last"
            label={t('common.lastName')}
            registration={register('lastName')}
          />
          <TextField
            id="cc-phone"
            label={t('common.phone')}
            registration={register('phone')}
          />
          <TextField
            id="cc-email"
            label={t('admin.users.card.email')}
            registration={register('email')}
            invalid={!!errors.email}
            errorText={
              errors.email?.message || t('admin.validation.invalid_format')
            }
          />
          <p className="text-xs text-muted-foreground">
            {t('admin.users.card.emailHint')}
          </p>
          <Button type="submit" disabled={isSubmitting}>
            {t('common.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
