import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import {
  SHIPPING_PRICINGS,
  SHIPPING_PROVIDER,
  SHIPPING_PROVIDERS,
  isShippingProviderId,
} from 'simplycms/contracts/shipping-providers';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import { Textarea } from 'simplycms/ui/textarea';
import {
  SortOrderField,
  TextField,
} from '../../catalog-dictionaries/form-fields';
import { SelectField } from './SelectField';
import { PRICING_LABEL, PROVIDER_LABEL } from './shipping-labels';
import type {
  ShippingMethodFormInput,
  ShippingMethodFormValues,
} from './shipping-method-form-schema';

interface Props {
  readonly form: UseFormReturn<
    ShippingMethodFormInput,
    unknown,
    ShippingMethodFormValues
  >;
  /** Провайдер обирають лише при створенні (`insertOnly`), далі — показ. */
  readonly isNew: boolean;
}

/** Поля картки способу доставки. */
export function ShippingMethodFields({ form, isNew }: Props) {
  const t = useT();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const provider = useWatch({ control, name: 'provider' });
  const quote =
    isShippingProviderId(provider) &&
    SHIPPING_PROVIDERS[provider].supportsQuote;
  return (
    <>
      <SelectField
        control={control}
        name="provider"
        id="sm-provider"
        label={t('admin.shipping.methods.provider')}
        disabled={!isNew}
        note={isNew ? undefined : t('admin.shipping.methods.providerLocked')}
        options={Object.values(SHIPPING_PROVIDER).map((p) => ({
          value: p,
          text: t(PROVIDER_LABEL[p]),
        }))}
      />
      <TextField
        id="sm-name"
        label={t('common.name')}
        placeholder={t('admin.shipping.methods.namePlaceholder')}
        registration={register('name')}
        invalid={!!errors.name}
        errorText={t('validation.nameRequired')}
      />
      <TextField
        id="sm-code"
        label={t('common.code')}
        placeholder="courier"
        registration={register('code')}
        invalid={!!errors.code}
        errorText={t('admin.shipping.methods.codeFormat')}
      />
      <div className="space-y-2">
        <Label htmlFor="sm-desc">{t('common.description')}</Label>
        <Textarea id="sm-desc" {...register('description')} />
      </div>
      <SelectField
        control={control}
        name="pricing"
        id="sm-pricing"
        label={t('admin.shipping.methods.pricing')}
        options={SHIPPING_PRICINGS.map((p) => ({
          value: p,
          text: t(PRICING_LABEL[p]),
          // Е6а-12: режим `provider` лише для провайдера з `supportsQuote`.
          disabled: p === 'provider' && !quote,
        }))}
      />
      <TextField
        id="sm-icon"
        label={t('admin.shipping.methods.icon')}
        placeholder="Truck"
        registration={register('icon')}
      />
      <SortOrderField
        id="sm-sort"
        label={t('common.sortOrder')}
        registration={register('sortOrder')}
        invalid={!!errors.sortOrder}
      />
      <div className="flex items-center justify-between rounded-lg border p-4">
        <Label htmlFor="sm-active" className="text-base">
          {t('common.activeF')}
        </Label>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch
              id="sm-active"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
    </>
  );
}
