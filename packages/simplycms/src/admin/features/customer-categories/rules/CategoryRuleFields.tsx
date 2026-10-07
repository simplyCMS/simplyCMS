import { Controller, type UseFormReturn } from 'react-hook-form';
import type { UserCategory } from 'simplycms/schema/types';
import { useT } from 'simplycms/i18n';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import { Textarea } from 'simplycms/ui/textarea';
import { TextField } from '../../catalog-dictionaries/form-fields';
import { SelectField } from '../../shipping/methods/SelectField';
import {
  ANY_CATEGORY,
  type CategoryRuleFormInput,
  type CategoryRuleFormValues,
} from './category-rule-form-schema';

interface Props {
  readonly form: UseFormReturn<
    CategoryRuleFormInput,
    unknown,
    CategoryRuleFormValues
  >;
  readonly categories: readonly UserCategory[];
}

/** Основні поля правила: назва, пріоритет, активність, перехід «з → в». */
export function CategoryRuleFields({ form, categories }: Props) {
  const t = useT();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const options = categories.map((c) => ({ value: c.id, text: c.name }));
  return (
    <>
      <TextField
        id="cr-name"
        label={t('admin.users.rules.nameLabel')}
        placeholder={t('admin.users.rules.namePlaceholder')}
        registration={register('name')}
        invalid={!!errors.name}
        errorText={t('validation.nameRequired')}
      />
      <div className="space-y-2">
        <Label htmlFor="cr-desc">{t('common.description')}</Label>
        <Textarea
          id="cr-desc"
          placeholder={t('admin.users.rules.descriptionPlaceholder')}
          {...register('description')}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="cr-priority"
          label={t('common.priority')}
          registration={register('priority')}
          invalid={!!errors.priority}
        />
        <div className="flex items-center justify-between rounded-lg border p-4">
          <Label htmlFor="cr-active">{t('common.activeN')}</Label>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <Switch
                id="cr-active"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('admin.users.rules.priorityHint')}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          control={control}
          name="fromCategoryId"
          id="cr-from"
          label={t('admin.users.rules.fromCategory')}
          options={[
            { value: ANY_CATEGORY, text: t('admin.users.rules.anyCategory') },
            ...options,
          ]}
        />
        <SelectField
          control={control}
          name="toCategoryId"
          id="cr-to"
          label={t('admin.users.rules.toCategory')}
          placeholder={t('admin.users.pickCategory')}
          options={options}
          note={errors.toCategoryId ? t('admin.users.pickCategory') : undefined}
          noteIsError
        />
      </div>
    </>
  );
}
