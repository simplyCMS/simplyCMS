import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ShippingRate, ShippingZone } from 'simplycms/schema/types';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'simplycms/ui/dialog';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import {
  SortOrderField,
  TextField,
} from '../../catalog-dictionaries/form-fields';
import {
  RATE_CALC_LABEL,
  SHIPPING_CALCULATION_TYPES,
} from './rate-calculation-types';
import { SelectField } from './SelectField';
import {
  RATE_DECIMAL_FIELDS,
  rateDefaults,
  shippingRateFormSchema,
  type ShippingRateFormInput,
  type ShippingRateFormValues,
} from './shipping-rate-form-schema';

interface Props {
  /** Редагований тариф; `null` — створення (тоді обирають зону). */
  readonly rate: ShippingRate | null;
  readonly zones: readonly ShippingZone[];
  readonly onClose: () => void;
  readonly onSave: (v: ShippingRateFormValues) => Promise<boolean>;
}

/** Діалог тарифу: усі поля `shipping_rates`; монтується заново на кожне відкриття. */
export function ShippingRateDialog({ rate, zones, onClose, onSave }: Props) {
  const t = useT();
  const form = useForm<ShippingRateFormInput, unknown, ShippingRateFormValues>({
    resolver: zodResolver(shippingRateFormSchema),
    defaultValues: rateDefaults(rate),
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const submit = form.handleSubmit(async (v) => {
    if (await onSave(v)) onClose();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t(
              rate
                ? 'admin.shipping.rates.editTitle'
                : 'admin.shipping.rates.add',
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <SelectField
            control={control}
            name="zoneId"
            id="sr-zone"
            label={t('admin.shipping.points.zone')}
            // Зона — `insertOnly`: перенос тарифу в іншу зону — новий тариф.
            disabled={!!rate}
            options={zones.map((z) => ({ value: z.id, text: z.name }))}
            note={errors.zoneId && t('admin.shipping.rates.zoneRequired')}
            noteIsError
          />
          <TextField
            id="sr-name"
            label={t('common.name')}
            registration={register('name')}
            invalid={!!errors.name}
            errorText={t('validation.nameRequired')}
          />
          <SelectField
            control={control}
            name="calculationType"
            id="sr-calc"
            label={t('admin.shipping.rates.calcType')}
            options={SHIPPING_CALCULATION_TYPES.map((c) => ({
              value: c,
              text: t(RATE_CALC_LABEL[c]),
            }))}
          />
          {RATE_DECIMAL_FIELDS.map(([name, label]) => (
            <TextField
              key={name}
              id={`sr-${name}`}
              label={t(label)}
              registration={register(name)}
              invalid={!!errors[name]}
              errorText={t('admin.shipping.rates.decimalFormat')}
            />
          ))}
          <TextField
            id="sr-days"
            label={t('admin.shipping.rates.estimatedDays')}
            registration={register('estimatedDays')}
            invalid={!!errors.estimatedDays}
          />
          <SortOrderField
            id="sr-sort"
            label={t('common.sortOrder')}
            registration={register('sortOrder')}
            invalid={!!errors.sortOrder}
          />
          <div className="flex items-center justify-between rounded-lg border p-4">
            <Label htmlFor="sr-active">{t('common.activeF')}</Label>
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  id="sr-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
