import { Controller, type UseFormReturn } from 'react-hook-form';
import type { DiscountGroup } from 'simplycms/schema/types';
import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import { Textarea } from 'simplycms/ui/textarea';
import { TextField } from '../../catalog-dictionaries/form-fields';
import { SelectField } from '../../shipping/methods/SelectField';
import { DateRangeFields } from '../DateRangeFields';
import { GROUP_OPERATORS, OPERATOR_LONG } from '../discount-labels';
import {
  ROOT_GROUP,
  type DiscountGroupFormInput,
  type DiscountGroupFormValues,
} from './discount-group-form-schema';

interface Props {
  readonly form: UseFormReturn<
    DiscountGroupFormInput,
    unknown,
    DiscountGroupFormValues
  >;
  /** Кандидати в батьки — вже без самої групи і її піддерева. */
  readonly parents: readonly DiscountGroup[];
}

/** Поля картки групи знижок. */
export function DiscountGroupFields({ form, parents }: Props) {
  const t = useT();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  return (
    <>
      <TextField
        id="dg-name"
        label={t('common.name')}
        placeholder={t('admin.discounts.groupNamePlaceholder')}
        registration={register('name')}
        invalid={!!errors.name}
        errorText={t('validation.nameRequired')}
      />
      <div className="space-y-2">
        <Label htmlFor="dg-desc">{t('common.description')}</Label>
        <Textarea id="dg-desc" {...register('description')} />
      </div>
      <SelectField
        control={control}
        name="operator"
        id="dg-operator"
        label={t('admin.discounts.opLabel')}
        options={GROUP_OPERATORS.map((op) => ({
          value: op,
          text: t(OPERATOR_LONG[op]),
        }))}
      />
      <SelectField
        control={control}
        name="parentGroupId"
        id="dg-parent"
        label={t('admin.discounts.parentGroup')}
        options={[
          { value: ROOT_GROUP, text: t('admin.discounts.rootLevel') },
          ...parents.map((g) => ({ value: g.id, text: g.name })),
        ]}
      />
      <div className="space-y-2">
        <Label htmlFor="dg-priority">
          {t('admin.discounts.priorityLabel')}
        </Label>
        <Input
          id="dg-priority"
          type="number"
          aria-invalid={!!errors.priority}
          {...register('priority')}
        />
      </div>
      <DateRangeFields
        idPrefix="dg-dates"
        from={register('startsAt')}
        to={register('endsAt')}
        invalid={!!errors.endsAt}
      />
      <div className="flex items-center justify-between rounded-lg border p-4">
        <Label htmlFor="dg-active" className="text-base">
          {t('common.activeF')}
        </Label>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch
              id="dg-active"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
    </>
  );
}
