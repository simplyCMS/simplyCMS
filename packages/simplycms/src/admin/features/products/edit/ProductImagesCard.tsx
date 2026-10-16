import { useFormContext } from 'react-hook-form';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { ImageUpload } from '../../../components/ImageUpload';
import { useProductCard } from './product-card-context';
import { imageKeys, withScopedImages } from './product-images';
import type { ProductFormValues } from './product-form-schema';

/** Фото самого товару (без модифікацій): список ключів сховища ↔ `images` чернетки картки. */
export function ProductImagesCard() {
  const t = useT();
  const { watch, setValue } = useFormContext<ProductFormValues>();
  const card = useProductCard();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.products.images')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div data-testid="product-images">
          <ImageUpload
            images={imageKeys(watch('images'), undefined)}
            onImagesChange={(keys) =>
              setValue(
                'images',
                withScopedImages(watch('images'), undefined, keys),
                { shouldDirty: true },
              )
            }
            entityType="product"
            entityId={card.entityId}
            maxImages={10}
          />
        </div>
      </CardContent>
    </Card>
  );
}
