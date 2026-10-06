import type { UseFormReturn } from 'react-hook-form';
import { STORE_PROFILE_LIMITS as LIMITS } from 'simplycms/contracts/store-profile';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Textarea } from 'simplycms/ui/textarea';
import { Label } from 'simplycms/ui/label';
import { TextField } from '../catalog-dictionaries/form-fields';
import type { StoreProfileFormValues } from './settings-form-schema';

type Props = { readonly form: UseFormReturn<StoreProfileFormValues> };

/** Блоки «Профіль і SEO» та «Контакти». `maxLength` — з тих самих меж, що й сервер. */
export function ProfileFields({ form }: Props) {
  const t = useT();
  const {
    register,
    formState: { errors },
  } = form;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.settings.profile.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('admin.settings.profile.hint')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextField
            id="sp-name"
            label={t('admin.settings.field.name')}
            registration={register('name')}
            invalid={!!errors.name}
            errorText={t('validation.nameRequired')}
            maxLength={LIMITS.name}
          />
          <TextField
            id="sp-home-title"
            label={t('admin.settings.field.homeTitle')}
            registration={register('homeTitle')}
            placeholder={t('admin.settings.field.homeTitleHint')}
            maxLength={LIMITS.homeTitle}
          />
          <div className="space-y-2">
            <Label htmlFor="sp-description">
              {t('admin.settings.field.description')}
            </Label>
            <Textarea
              id="sp-description"
              maxLength={LIMITS.description}
              {...register('description')}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.settings.contacts.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextField
            id="sp-phone"
            label={t('admin.settings.field.phone')}
            registration={register('phone')}
            maxLength={LIMITS.phone}
          />
          <TextField
            id="sp-email"
            label={t('admin.settings.field.email')}
            registration={register('email')}
            invalid={!!errors.email}
            errorText={t('validation.emailFormat')}
            maxLength={LIMITS.email}
          />
          <TextField
            id="sp-address"
            label={t('admin.settings.field.address')}
            registration={register('address')}
            maxLength={LIMITS.address}
          />
          <TextField
            id="sp-hours"
            label={t('admin.settings.field.hours')}
            registration={register('hours')}
            maxLength={LIMITS.hours}
          />
        </CardContent>
      </Card>
    </>
  );
}
