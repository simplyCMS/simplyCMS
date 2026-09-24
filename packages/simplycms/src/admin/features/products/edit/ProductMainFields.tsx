import { useFormContext } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import { ImageUpload } from '../../../components/ImageUpload';
import { RichTextEditor } from '../../../components/RichTextEditor';
import type { ProductFormValues } from './product-form-schema';

interface Props {
  /** `null` — товар ще не створено (нова картка, зображення без привʼязки). */
  readonly productId: string | null;
}

/**
 * Назва/slug/опис/зображення — перша й друга картки легасі
 * `ProductEdit.tsx` без дизайнерських змін. Читає форму з контексту
 * `useFormContext` (обгортка `Form` у `ProductForm.tsx`).
 */
export function ProductMainFields({ productId }: Props) {
  const t = useT();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ProductFormValues>();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('common.basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">
                {t('common.nameRequiredLabel')}
              </Label>
              <Input
                id="product-name"
                {...register('name')}
                required
                aria-invalid={!!errors.name}
                aria-describedby={
                  errors.name ? 'product-name-error' : undefined
                }
              />
              {errors.name && (
                <p
                  id="product-name-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {t('admin.products.nameError')}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-slug">
                {t('admin.products.slugLabel')}
              </Label>
              <Input
                id="product-slug"
                {...register('slug')}
                required
                aria-invalid={!!errors.slug}
                aria-describedby="product-slug-error"
              />
              <p
                id="product-slug-error"
                role={errors.slug ? 'alert' : undefined}
                className={
                  errors.slug
                    ? 'text-xs text-destructive'
                    : 'text-xs text-muted-foreground'
                }
              >
                {t('admin.products.slugHint')}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-short-description">
              {t('admin.products.shortDescription')}
            </Label>
            <Input
              id="product-short-description"
              {...register('shortDescription')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-description">
              {t('admin.products.fullDescription')}
            </Label>
            <RichTextEditor
              content={watch('description')}
              onChange={(content) =>
                setValue('description', content, { shouldDirty: true })
              }
              placeholder={t('admin.products.descriptionPlaceholder')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.products.images')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div data-testid="product-images">
            <ImageUpload
              images={watch('images')}
              onImagesChange={(images) =>
                setValue('images', images, { shouldDirty: true })
              }
              entityType="product"
              entityId={productId}
              maxImages={10}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
