import { useState } from 'react';
import { useT } from 'simplycms/i18n';
import { PluginSlot } from 'simplycms/plugins/PluginSlot';
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
  // К3-Е6д-1: id нового товару наперед — фото привʼязуються до нього ще до
  // збереження, і той самий id йде в insert (ресурс звіряє власника файлу).
  const [newId] = useState(() => crypto.randomUUID());

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
        entityId={newId}
        defaultValues={DEFAULT_VALUES}
        onSubmit={(values, binding) => create(values, binding, newId)}
        submitLabel={t('common.create')}
      >
        <PluginSlot
          name="admin.product.form.after"
          context={{ productId: null }}
        />
      </ProductForm>
    </div>
  );
}
