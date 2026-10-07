import type { UseFormReturn } from 'react-hook-form';
import { useLiveQuery } from '@tanstack/react-db';
import { priceTypesCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { Label } from 'simplycms/ui/label';
import { Textarea } from 'simplycms/ui/textarea';
import { TextField } from '../../catalog-dictionaries/form-fields';
import { SelectField } from '../../shipping/methods/SelectField';
import {
  NO_PRICE_TYPE,
  type UserCategoryFormInput,
  type UserCategoryFormValues,
} from './user-category-form-schema';

interface Props {
  readonly form: UseFormReturn<
    UserCategoryFormInput,
    unknown,
    UserCategoryFormValues
  >;
}

/** Поля картки категорії покупців. */
export function UserCategoryFields({ form }: Props) {
  const t = useT();
  const priceTypes = useCollection(priceTypesCollection);
  const { data: types } = useLiveQuery({
    query: (q) => q.from({ p: priceTypes }).orderBy(({ p }) => p.sortOrder),
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  return (
    <>
      <TextField
        id="uc-name"
        label={t('common.name')}
        placeholder={t('admin.users.categories.namePlaceholder')}
        registration={register('name')}
        invalid={!!errors.name}
        errorText={t('validation.nameRequired')}
      />
      <TextField
        id="uc-code"
        label={t('common.code')}
        placeholder="retail"
        registration={register('code')}
        invalid={!!errors.code}
        errorText={t('admin.users.categories.codeHint')}
      />
      <div className="space-y-2">
        <Label htmlFor="uc-desc">{t('common.description')}</Label>
        <Textarea
          id="uc-desc"
          placeholder={t('admin.users.categories.descriptionPlaceholder')}
          {...register('description')}
        />
      </div>
      <SelectField
        control={control}
        name="priceTypeId"
        id="uc-price-type"
        label={t('admin.users.priceType')}
        note={t('admin.users.categories.priceTypeHint')}
        options={[
          { value: NO_PRICE_TYPE, text: t('common.byDefault') },
          ...types.map((p) => ({
            value: p.id,
            text: p.isDefault
              ? `${p.name} ${t('admin.users.categories.defaultSuffix')}`
              : p.name,
          })),
        ]}
      />
    </>
  );
}
