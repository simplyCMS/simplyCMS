import { Controller, type UseFormReturn } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import {
  SortOrderField,
  TextField,
} from '../../catalog-dictionaries/form-fields';
import { SelectField, type SelectOption } from '../methods/SelectField';
import {
  NO_ZONE,
  type PickupPointFormInput,
  type PickupPointFormValues,
} from './pickup-point-form-schema';

interface Props {
  readonly form: UseFormReturn<
    PickupPointFormInput,
    unknown,
    PickupPointFormValues
  >;
  /** Лише способи самовивозу (`destination === 'pickup-point'`). */
  readonly methodOptions: readonly SelectOption[];
  readonly zoneOptions: readonly SelectOption[];
  /** Спосіб обирають лише при створенні (`insertOnly`), далі — показ. */
  readonly isNew: boolean;
}

/** Поля картки точки видачі. */
export function PickupPointFields({
  form,
  methodOptions,
  zoneOptions,
  isNew,
}: Props) {
  const t = useT();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  return (
    <>
      <SelectField
        control={control}
        name="methodId"
        id="pp-method"
        label={t('admin.shipping.points.method')}
        disabled={!isNew}
        options={methodOptions}
        note={
          errors.methodId
            ? t('admin.shipping.points.methodRequired')
            : isNew
              ? undefined
              : t('admin.shipping.points.methodLocked')
        }
        noteIsError={!!errors.methodId}
      />
      <TextField
        id="pp-name"
        label={t('common.name')}
        placeholder={t('admin.shipping.points.namePlaceholder')}
        registration={register('name')}
        invalid={!!errors.name}
        errorText={t('validation.nameRequired')}
      />
      <TextField
        id="pp-city"
        label={t('common.city')}
        placeholder={t('admin.shipping.points.cityPlaceholder')}
        registration={register('city')}
        invalid={!!errors.city}
        errorText={t('validation.cityRequired')}
      />
      <TextField
        id="pp-address"
        label={t('common.address')}
        placeholder={t('admin.shipping.points.addressPlaceholder')}
        registration={register('address')}
        invalid={!!errors.address}
        errorText={t('validation.addressRequired')}
      />
      <TextField
        id="pp-phone"
        label={t('common.phone')}
        registration={register('phone')}
      />
      <SelectField
        control={control}
        name="zoneId"
        id="pp-zone"
        label={t('admin.shipping.points.zoneLabel')}
        note={t('admin.shipping.points.zoneHint')}
        options={[
          { value: NO_ZONE, text: t('admin.shipping.points.noZone') },
          ...zoneOptions,
        ]}
      />
      <SortOrderField
        id="pp-sort"
        label={t('common.order')}
        registration={register('sortOrder')}
        invalid={!!errors.sortOrder}
      />
      <div className="flex items-center justify-between rounded-lg border p-4">
        <Label htmlFor="pp-active" className="text-base">
          {t('admin.shipping.points.showAtCheckout')}
        </Label>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch
              id="pp-active"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
    </>
  );
}
