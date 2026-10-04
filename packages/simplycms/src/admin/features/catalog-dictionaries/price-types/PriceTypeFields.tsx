import { Controller, type UseFormReturn } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import { SortOrderField, TextField } from '../form-fields';
import type {
  PriceTypeFormInput,
  PriceTypeFormValues,
} from './price-type-form-schema';

interface Props {
  readonly form: UseFormReturn<
    PriceTypeFormInput,
    unknown,
    PriceTypeFormValues
  >;
  /** Рядок уже дефолтний — перемикач заблокований (нуль дефолтів заборонений). */
  readonly lockedDefault: boolean;
}

/** Поля картки типу ціни: назва, код, порядок, «за замовчуванням». */
export function PriceTypeFields({ form, lockedDefault }: Props) {
  const t = useT();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  return (
    <>
      <TextField
        id="pt-name"
        label={t('common.name')}
        placeholder={t('admin.prices.namePlaceholder')}
        registration={register('name')}
        invalid={!!errors.name}
        errorText={t('validation.nameRequired')}
      />
      <div className="space-y-2">
        <Label htmlFor="pt-code">{t('common.code')}</Label>
        <Input
          id="pt-code"
          placeholder="retail"
          aria-invalid={!!errors.code}
          {...register('code')}
        />
        <p className="text-xs text-muted-foreground">
          {t('admin.prices.codeHint')}
        </p>
        {errors.code && (
          <p role="alert" className="text-xs text-destructive">
            {t('admin.prices.codeFormat')}
          </p>
        )}
      </div>
      <SortOrderField
        id="pt-sort"
        label={t('common.sortOrder')}
        registration={register('sortOrder')}
        invalid={!!errors.sortOrder}
      />
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="pt-default" className="text-base">
            {t('common.byDefault')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t('admin.prices.defaultHint')}
          </p>
        </div>
        <Controller
          control={control}
          name="isDefault"
          render={({ field }) => (
            <Switch
              id="pt-default"
              checked={field.value}
              onCheckedChange={field.onChange}
              // Нуль дефолтів заборонений: зняти можна лише призначивши
              // дефолтним ІНШИЙ тип.
              disabled={lockedDefault}
              title={lockedDefault ? t('admin.prices.defaultKeep') : undefined}
            />
          )}
        />
      </div>
    </>
  );
}
