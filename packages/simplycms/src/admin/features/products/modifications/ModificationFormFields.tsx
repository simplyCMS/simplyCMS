import { useFormContext } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import { ImageUpload } from '../../../components/ImageUpload';
import { StockStatusSelect } from '../stock/StockStatusSelect';
import { TranslationStatusBadge } from '../../translations/TranslationStatusBadge';
import { useProductCard } from '../edit/product-card-context';
import { useTranslationContext } from '../../translations/translation-context';
import type { ModificationFormValues } from './modification-form-schema';

interface Props {
  /** Товар-власник файлів: фото модифікації — файли ТОВАРУ (`entity_type = 'product'`). */
  readonly productId: string;
  readonly modId: string;
}

/**
 * Поля модифікації: назва й токен за кожною мовою (основна — обовʼязкова назва,
 * `mod-name`/`mod-slug`), SKU, дефолт, фото. Порожній токен основної мови
 * сервер виводить із назви.
 */
export function ModificationFormFields({ productId, modId }: Props) {
  const t = useT();
  const { languages, primary } = useTranslationContext();
  const card = useProductCard();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ModificationFormValues>();

  return (
    <>
      {languages.map((l) => {
        const main = l.code === primary;
        const nameError = errors.names?.[l.code];
        const tokenError = errors.tokens?.[l.code];
        return (
          <div key={l.code} className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor={main ? 'mod-name' : `mod-name-${l.code}`}
                className="flex items-center gap-2"
              >
                {main ? t('common.nameRequiredLabel') : t('common.name')} (
                {l.code})
                {!main && (
                  <TranslationStatusBadge
                    status={
                      card.statusOfModificationName?.(modId, l.code) ??
                      'current'
                    }
                  />
                )}
              </Label>
              <Input
                id={main ? 'mod-name' : `mod-name-${l.code}`}
                {...register(`names.${l.code}`)}
                placeholder={t('admin.products.mods.namePlaceholder')}
                aria-invalid={!!nameError}
              />
              {nameError && (
                <p role="alert" className="text-xs text-destructive">
                  {t('admin.products.nameError')}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={main ? 'mod-slug' : `mod-slug-${l.code}`}>
                {t('admin.products.mods.tokenLabel')} ({l.code})
              </Label>
              <Input
                id={main ? 'mod-slug' : `mod-slug-${l.code}`}
                {...register(`tokens.${l.code}`)}
                placeholder="100w"
                aria-invalid={!!tokenError}
              />
              <p
                role={tokenError ? 'alert' : undefined}
                className={
                  tokenError
                    ? 'text-xs text-destructive'
                    : 'text-xs text-muted-foreground'
                }
              >
                {t('admin.products.slugHint')}
              </p>
            </div>
          </div>
        );
      })}

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
          entityType="product"
          entityId={productId}
          maxImages={10}
          key={modId}
        />
      </div>
    </>
  );
}
