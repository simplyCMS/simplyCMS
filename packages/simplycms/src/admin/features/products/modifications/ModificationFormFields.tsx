import { useFormContext } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import { ImageUpload } from '../../../components/ImageUpload';
import { StockStatusSelect } from '../stock/StockStatusSelect';
import type { ModificationFormValues } from './modification-form-schema';

interface Props {
  /** `null` — зображення ще без привʼязки до сутності (створення). */
  readonly modId: string | null;
}

/** Основні поля форми модифікації — виніс із `ModificationDialog.tsx` (канон 150 рядків). */
export function ModificationFormFields({ modId }: Props) {
  const t = useT();
  const { register, watch, setValue } =
    useFormContext<ModificationFormValues>();

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="mod-name">{t('common.nameRequiredLabel')}</Label>
          <Input
            id="mod-name"
            {...register('name')}
            placeholder={t('admin.products.mods.namePlaceholder')}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mod-slug">{t('admin.products.slugLabel')}</Label>
          <Input
            id="mod-slug"
            {...register('slug')}
            placeholder="100w"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mod-sku">{t('admin.products.mods.sku')}</Label>
        <Input id="mod-sku" {...register('sku')} placeholder="SP-100W-BLK" />
      </div>

      <StockStatusSelect
        value={watch('stockStatus')}
        onChange={(v) => setValue('stockStatus', v, { shouldDirty: true })}
      />

      <div className="flex items-center gap-2">
        <Switch
          id="mod-default"
          checked={watch('isDefault')}
          onCheckedChange={(v) =>
            setValue('isDefault', v, { shouldDirty: true })
          }
        />
        <Label htmlFor="mod-default">{t('common.byDefault')}</Label>
      </div>

      <div className="space-y-2">
        <Label>{t('common.image')}</Label>
        <ImageUpload
          images={watch('images')}
          onImagesChange={(images) =>
            setValue('images', images, { shouldDirty: true })
          }
          entityType="product_modification"
          entityId={modId}
          maxImages={10}
        />
      </div>
    </>
  );
}
