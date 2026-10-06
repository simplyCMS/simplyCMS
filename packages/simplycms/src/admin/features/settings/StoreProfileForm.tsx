import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { StoreProfile } from 'simplycms/contracts/store-profile';
import { useT } from 'simplycms/i18n';
import { reportTxError } from '../../lib/report-tx-error';
import { SubmitButton } from '../catalog-dictionaries/CardPageHeader';
import { LogoCard } from './LogoCard';
import { ProfileFields } from './ProfileFields';
import { SocialsCard } from './SocialsCard';
import {
  fromProfile,
  storeProfileFormSchema,
  toProfile,
  type StoreProfileFormValues,
} from './settings-form-schema';

type Props = {
  readonly profile: StoreProfile;
  /** Зберігає профіль і повертає те, що записав сервер. */
  readonly onSave: (profile: StoreProfile) => Promise<StoreProfile>;
};

/**
 * Форма профілю магазину. Профіль приходить уже завантаженим (сторінка не
 * монтує форму раніше), тож `defaultValues` досить — повторного засіву з
 * кеша не треба; після збереження форма скидається до відповіді сервера.
 */
export function StoreProfileForm({ profile, onSave }: Props) {
  const t = useT();
  const form = useForm<StoreProfileFormValues>({
    resolver: zodResolver(storeProfileFormSchema),
    defaultValues: fromProfile(profile),
  });

  const logo = useWatch({ control: form.control, name: 'logo' });

  const submit = async (values: StoreProfileFormValues) => {
    try {
      const saved = await onSave(toProfile(values));
      form.reset(fromProfile(saved));
      toast.success(t('common.settingsSaved'));
    } catch (e) {
      reportTxError(t, e);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
      <ProfileFields form={form} />
      <LogoCard
        logo={logo}
        onChange={(logo) => form.setValue('logo', logo, { shouldDirty: true })}
      />
      <SocialsCard form={form} />
      <div className="flex justify-end">
        <SubmitButton pending={form.formState.isSubmitting}>
          {t('common.save')}
        </SubmitButton>
      </div>
    </form>
  );
}
