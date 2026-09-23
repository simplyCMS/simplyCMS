import { ArrowLeft, Loader2 } from 'lucide-react';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { productsCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import type { Product } from 'simplycms/schema/types';
import { Button } from 'simplycms/ui/button';
import { PluginSlot } from 'simplycms/plugins/PluginSlot';
import { adminPath } from '../../../lib/adminLinks';
import { ModificationsPanel } from '../modifications/ModificationsPanel';
import { PropertyValuesPanel } from '../properties/PropertyValuesPanel';
import { SimpleProductPanel } from '../simple/SimpleProductPanel';
import { ProductForm } from './ProductForm';
import { useProductSave } from './useProductSave';
import type { ProductFormValues } from './product-form-schema';

interface Props {
  readonly productId: string;
}

/** БД → форма: `null` полів переведено в порожній рядок форми. */
function toFormValues(row: Product): ProductFormValues {
  return {
    name: row.name,
    slug: row.slug,
    shortDescription: row.shortDescription ?? '',
    description: row.description ?? '',
    metaTitle: row.metaTitle ?? '',
    metaDescription: row.metaDescription ?? '',
    sectionId: row.sectionId ?? '',
    isActive: row.isActive,
    isFeatured: row.isFeatured,
    hasModifications: row.hasModifications ?? false,
    sku: row.sku ?? '',
    stockStatus: row.stockStatus ?? 'in_stock',
    images: row.images ?? [],
  };
}

/**
 * Картка існуючого товару (Task 7): рядок — жива колекція (`findOne`).
 * 🔴 `productId`, що не є uuid (стара закладка), інакше дав би 400 зі
 * схеми `list`-serverFn (`id` — uuid-фільтр) — перевіряємо ДО запиту.
 * Панелі модифікацій/цін/залишків (Task 8) — СИБЛІНГИ `ProductForm`, не
 * нащадки її `<form>` (рев'ю хвилі C, BLOCKER — див. коментар
 * `ProductForm.tsx`). Перемикач панелі — за `data.hasModifications`
 * ЖИВОГО рядка колекції (Task 7 Step 3), не за незбереженим станом
 * форми: зміна перемикача типу товару без Save панель НЕ підмінює.
 * Значення властивостей ТОВАРУ (Task 10) — теж сиблінг, за живим
 * `data.sectionId`: `appliesTo='all'` для простого товару (усі
 * призначення розділу — легасі `AllProductProperties`), `'product'` для
 * товару з модифікаціями (легасі `ProductPropertyValues`).
 */
export function ProductEditPage({ productId }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const { update } = useProductSave();
  const products = useCollection(productsCollection);
  const isValidId = z.uuid().safeParse(productId).success;

  const { data, isLoading, isReady } = useLiveQuery(
    (q) =>
      isValidId
        ? q
            .from({ p: products })
            .where(({ p }) => eq(p.id, productId))
            .findOne()
        : undefined,
    [productId, isValidId],
  );

  const goBack = () => navigate({ to: adminPath('products') });

  if (!isValidId || (isReady && !data)) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <p className="text-muted-foreground">{t('admin.products.notFound')}</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {data.name || t('admin.products.editTitle')}
          </h1>
          <p className="text-muted-foreground">
            {t('admin.products.editSubtitle')}
          </p>
        </div>
      </div>
      <ProductForm
        productId={productId}
        defaultValues={toFormValues(data)}
        onSubmit={(values) => update(productId, values)}
        submitLabel={t('common.save')}
        meta={{ createdAt: data.createdAt, updatedAt: data.updatedAt }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {data.hasModifications ? (
              <ModificationsPanel
                productId={productId}
                sectionId={data.sectionId}
              />
            ) : (
              <SimpleProductPanel productId={productId} />
            )}
            <PropertyValuesPanel
              target="product"
              ownerId={productId}
              sectionId={data.sectionId}
              appliesTo={data.hasModifications ? 'product' : 'all'}
            />
            <PluginSlot
              name="admin.product.form.after"
              context={{ productId }}
            />
          </div>
        </div>
      </ProductForm>
    </div>
  );
}
