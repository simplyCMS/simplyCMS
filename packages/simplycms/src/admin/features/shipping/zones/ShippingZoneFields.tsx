import { Controller, type UseFormReturn } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import { Textarea } from 'simplycms/ui/textarea';
import {
  SortOrderField,
  TextField,
} from '../../catalog-dictionaries/form-fields';
import type {
  ShippingZoneFormInput,
  ShippingZoneFormValues,
} from './shipping-zone-form-schema';

interface Props {
  readonly form: UseFormReturn<
    ShippingZoneFormInput,
    unknown,
    ShippingZoneFormValues
  >;
  /** Дефолтна зона завжди активна (Е6а-20): перемикач заблоковано. */
  readonly lockedActive: boolean;
}

/** Поля картки зони доставки. */
export function ShippingZoneFields({ form, lockedActive }: Props) {
  const t = useT();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  return (
    <>
      <TextField
        id="sz-name"
        label={t('common.name')}
        placeholder={t('admin.shipping.zones.namePlaceholder')}
        registration={register('name')}
        invalid={!!errors.name}
        errorText={t('validation.nameRequired')}
      />
      <div className="space-y-2">
        <Label htmlFor="sz-desc">{t('common.description')}</Label>
        <Textarea id="sz-desc" {...register('description')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sz-cities">{t('admin.shipping.zones.cities')}</Label>
        <Textarea
          id="sz-cities"
          placeholder={t('admin.shipping.zones.citiesPlaceholder')}
          {...register('cities')}
        />
        <p className="text-xs text-muted-foreground">
          {t('admin.shipping.zones.citiesHint')}
        </p>
      </div>
      <TextField
        id="sz-regions"
        label={t('admin.shipping.zones.regions')}
        placeholder={t('admin.shipping.zones.regionsPlaceholder')}
        registration={register('regions')}
      />
      <SortOrderField
        id="sz-sort"
        label={t('admin.shipping.zones.priority')}
        registration={register('sortOrder')}
        invalid={!!errors.sortOrder}
      />
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label htmlFor="sz-active" className="text-base">
            {t('common.activeF')}
          </Label>
          {lockedActive && (
            <p className="text-xs text-muted-foreground">
              {t('admin.shipping.zones.defaultLocked')}
            </p>
          )}
        </div>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch
              id="sz-active"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
    </>
  );
}
