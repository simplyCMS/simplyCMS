import { useT } from 'simplycms/i18n';
import { ProductForm } from './ProductForm';
import { useProductSave } from './useProductSave';
import type { ProductFormValues } from './product-form-schema';

const DEFAULT_VALUES: ProductFormValues = {
  name: '',
  slug: '',
  shortDescription: '',
  description: '',
  metaTitle: '',
  metaDescription: '',
  sectionId: '',
  isActive: true,
  isFeatured: false,
  hasModifications: false,
  sku: '',
  stockStatus: 'in_stock',
  images: [],
};

/**
 * Сторінка нового товару (Task 7): жодних панелей модифікацій/цін/
 * залишків/властивостей — як у легасі (`!isNew && …`), бо товару ще
 * немає в БД, писати сателіти нічому.
 */
export function NewProductPage() {
  const t = useT();
  const { create } = useProductSave();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.products.new')}</h1>
        <p className="text-muted-foreground">
          {t('admin.products.newSubtitle')}
        </p>
      </div>
      <ProductForm
        productId={null}
        defaultValues={DEFAULT_VALUES}
        onSubmit={create}
        submitLabel={t('common.create')}
      />
    </div>
  );
}
