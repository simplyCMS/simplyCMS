import { useLiveQuery } from '@tanstack/react-db';
import { Controller, useFormContext } from 'react-hook-form';
import { sectionsCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Label } from 'simplycms/ui/label';
import { RadioGroup, RadioGroupItem } from 'simplycms/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import { Separator } from 'simplycms/ui/separator';
import { Switch } from 'simplycms/ui/switch';
import type { ProductFormValues } from './product-form-schema';

/**
 * Бокова панель (картка налаштувань легасі `ProductEdit.tsx`): розділ, тип
 * товару, активність, рекомендований. Інформаційна картка (ID, дати) —
 * окремий компонент `ProductMetaCard` (канон 150 рядків), рендериться
 * поруч у `ProductForm`.
 */
export function ProductSidebar() {
  const t = useT();
  const { control } = useFormContext<ProductFormValues>();
  const sections = useCollection(sectionsCollection);
  const { data: sectionRows } = useLiveQuery((q) =>
    q.from({ s: sections }).orderBy(({ s }) => s.name, 'asc'),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.nav.settings')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="product-section">
            {t('admin.products.sectionRequired')}
          </Label>
          <Controller
            control={control}
            name="sectionId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="product-section">
                  <SelectValue placeholder={t('admin.products.pickSection')} />
                </SelectTrigger>
                <SelectContent>
                  {sectionRows.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>{t('admin.products.type')}</Label>
          <Controller
            control={control}
            name="hasModifications"
            render={({ field }) => (
              <RadioGroup
                id="product-type"
                value={field.value ? 'with_modifications' : 'simple'}
                onValueChange={(v) =>
                  field.onChange(v === 'with_modifications')
                }
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="simple" id="type_simple" />
                  <Label
                    htmlFor="type_simple"
                    className="font-normal cursor-pointer"
                  >
                    {t('admin.products.typeSimple')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="with_modifications"
                    id="type_modifications"
                  />
                  <Label
                    htmlFor="type_modifications"
                    className="font-normal cursor-pointer"
                  >
                    {t('admin.products.typeWithMods')}
                  </Label>
                </div>
              </RadioGroup>
            )}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <Label htmlFor="product-active">{t('common.activeM')}</Label>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <Switch
                id="product-active"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="product-featured">
            {t('admin.products.featured')}
          </Label>
          <Controller
            control={control}
            name="isFeatured"
            render={({ field }) => (
              <Switch
                id="product-featured"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
