import { useLiveQuery } from '@tanstack/react-db';
import { Controller } from 'react-hook-form';
import {
  discountGroupsCollection,
  priceTypesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import { Textarea } from 'simplycms/ui/textarea';
import { TextField } from '../../catalog-dictionaries/form-fields';
import { SelectField } from '../../shipping/methods/SelectField';
import { DateRangeFields } from '../DateRangeFields';
import {
  ALL_PRICE_TYPES,
  DISCOUNT_TYPE_LABEL,
  DISCOUNT_TYPES,
} from '../discount-labels';
import type { DiscountForm } from './useDiscountCard';

/** Основні поля знижки: група, тип ціни (або всі), розмір, період, активність. */
export function DiscountMainFields({ form }: { readonly form: DiscountForm }) {
  const t = useT();
  const groupsCol = useCollection(discountGroupsCollection);
  const typesCol = useCollection(priceTypesCollection);
  const { data: groups } = useLiveQuery({
    query: (q) => q.from({ g: groupsCol }).orderBy(({ g }) => g.name, 'asc'),
  });
  const { data: types } = useLiveQuery({
    query: (q) =>
      q.from({ p: typesCol }).orderBy(({ p }) => p.sortOrder, 'asc'),
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  return (
    <>
      <TextField
        id="dc-name"
        label={t('common.name')}
        placeholder={t('admin.discounts.namePlaceholder')}
        registration={register('name')}
        invalid={!!errors.name}
        errorText={t('validation.nameRequired')}
      />
      <div className="space-y-2">
        <Label htmlFor="dc-desc">{t('common.description')}</Label>
        <Textarea id="dc-desc" {...register('description')} />
      </div>
      <SelectField
        control={control}
        name="groupId"
        id="dc-group"
        label={t('admin.discounts.group')}
        options={groups.map((g) => ({ value: g.id, text: g.name }))}
        note={errors.groupId ? t('validation.groupRequired') : undefined}
        noteIsError
      />
      <SelectField
        control={control}
        name="priceTypeId"
        id="dc-price-type"
        label={t('admin.discounts.priceType')}
        options={[
          { value: ALL_PRICE_TYPES, text: t('admin.discounts.allPriceTypes') },
          ...types.map((p) => ({ value: p.id, text: p.name })),
        ]}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          control={control}
          name="discountType"
          id="dc-type"
          label={t('admin.discounts.type')}
          options={DISCOUNT_TYPES.map((type) => ({
            value: type,
            text: t(DISCOUNT_TYPE_LABEL[type]),
          }))}
        />
        <div className="space-y-2">
          <Label htmlFor="dc-value">{t('common.value')}</Label>
          <Input
            id="dc-value"
            type="number"
            step="0.01"
            aria-invalid={!!errors.discountValue}
            {...register('discountValue')}
          />
          {errors.discountValue && (
            <p role="alert" className="text-xs text-destructive">
              {t('admin.discounts.valueInvalid')}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="dc-priority">
          {t('admin.discounts.priorityLabel')}
        </Label>
        <Input
          id="dc-priority"
          type="number"
          aria-invalid={!!errors.priority}
          {...register('priority')}
        />
      </div>
      <DateRangeFields
        idPrefix="dc-dates"
        from={register('startsAt')}
        to={register('endsAt')}
        invalid={!!errors.endsAt}
      />
      <div className="flex items-center justify-between rounded-lg border p-4">
        <Label htmlFor="dc-active" className="text-base">
          {t('common.activeF')}
        </Label>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch
              id="dc-active"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
    </>
  );
}
