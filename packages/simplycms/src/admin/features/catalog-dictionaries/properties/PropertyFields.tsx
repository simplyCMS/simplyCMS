import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import {
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABEL,
  type PropertyFormInput,
  type PropertyFormValues,
} from './property-form-schema';

interface Props {
  readonly form: UseFormReturn<PropertyFormInput, unknown, PropertyFormValues>;
  /** Префікс id полів — діалог і картка можуть бути в одному DOM. */
  readonly idPrefix: string;
  /**
   * `true` — створення: тип обирається. `false` — редагування: тип лише
   * текстом із поясненням (Е4-5, insertOnly), контролу немає.
   */
  readonly typeEditable: boolean;
}

/** Поля властивості — спільні для діалогу створення і картки. */
export function PropertyFields({ form, idPrefix, typeEditable }: Props) {
  const t = useT();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const propertyType = useWatch({ control, name: 'propertyType' });
  const id = (name: string) => `${idPrefix}-${name}`;

  const toggle = (
    name: 'isRequired' | 'isFilterable' | 'hasPage',
    label: string,
  ) => (
    <div className="flex items-center gap-2">
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Switch
            id={id(name)}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />
      <Label htmlFor={id(name)}>{label}</Label>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={id('name')}>{t('common.name')}</Label>
          <Input
            id={id('name')}
            placeholder={t('admin.properties.namePlaceholder')}
            aria-invalid={!!errors.name}
            {...register('name')}
          />
          {errors.name && (
            <p role="alert" className="text-xs text-destructive">
              {t('validation.nameRequired')}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={id('slug')}>{t('admin.common.slug')}</Label>
          <Input
            id={id('slug')}
            aria-invalid={!!errors.slug}
            aria-describedby={id('slug-hint')}
            {...register('slug')}
          />
          <p
            id={id('slug-hint')}
            role={errors.slug ? 'alert' : undefined}
            className={
              errors.slug
                ? 'text-xs text-destructive'
                : 'text-xs text-muted-foreground'
            }
          >
            {t('admin.properties.slugHint')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {typeEditable ? (
            <>
              <Label htmlFor={id('type')}>
                {t('admin.properties.typeLabel')}
              </Label>
              <Controller
                control={control}
                name="propertyType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={id('type')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(PROPERTY_TYPE_LABEL[type])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </>
          ) : (
            <>
              <p className="text-sm font-medium leading-none">
                {t('admin.properties.typeLabel')}
              </p>
              <p className="text-sm py-2">
                {t(PROPERTY_TYPE_LABEL[propertyType])}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('admin.properties.typeImmutable')}
              </p>
            </>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={id('sort')}>{t('common.sortOrder')}</Label>
          <Input
            id={id('sort')}
            type="number"
            min="0"
            aria-invalid={!!errors.sortOrder}
            {...register('sortOrder')}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6 pt-2">
        {toggle('isRequired', t('admin.properties.required'))}
        {toggle('isFilterable', t('admin.properties.showInFilters'))}
        {toggle('hasPage', t('admin.properties.hasPage'))}
      </div>
    </div>
  );
}
