import { z } from 'zod';
import { SLUG_RE } from 'simplycms/domain';
import { REVIEW_MEDIA_ENTITY } from 'simplycms/domain/media';
import {
  productImageTranslations,
  productImages,
  productModifications,
  productReviews,
  products,
} from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { deleteModifications } from '../product-modifications/delete';
import { defineAdminResource } from '../resource';
import { removeResourceRows } from '../resource-write';

/**
 * Товар — перший on-demand ресурс (К3-5). filterable — рівно ті поля, якими
 * фільтрує список адмінки (Е3-2) + id для картки (findOne). stockStatus
 * writable: власник ставить «Під замовлення» вручну; автоматичний перехід
 * за кількістю робить saveStock (Е3-3), гвард on_order не чіпає.
 */
export const productsOps = defineAdminResource({
  entity: ENTITY.products,
  table: products,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['id', 'sectionId', 'isActive', 'isFeatured', 'stockStatus'],
  sortable: ['createdAt', 'updatedAt', 'name'],
  defaultOrder: { column: 'createdAt', direction: 'desc' },
  touch: 'updatedAt',
  // m3 (рев'ю хвилі B): `images` — jsonb без власної форми в генераторі схем,
  // те саме, що й у product-modifications/resource.ts.
  // Д5: slug товару — частина URL, формат перевіряє й сервер (як у розділу).
  refine: {
    images: () => z.array(z.string()),
    slug: (s: z.ZodString) => s.regex(SLUG_RE),
  },
  writable: [
    'sectionId',
    'slug',
    'name',
    'shortDescription',
    'description',
    'isActive',
    'isFeatured',
    'metaTitle',
    'metaDescription',
    'images',
    'hasModifications',
    'sku',
    'stockStatus',
    'returnPolicy',
    'shippingDetails',
  ],
  // Тема 9: `description` — розмітка редактора адмінки (санітизується при записі й віддачі).
  richHtml: { description: 'content' },
  // `version` — оптимістична версія агрегата (М1, І14): її піднімає лише команда
  // опису (Task 11), узагальнений CRUD її не пише.
  readonly: ['id', 'createdAt', 'updatedAt', 'version'],
  // М1 (Task 14): модифікації — ЄДИНИМ видалячем (`FOR UPDATE` за id) після знімків
  // медіа й до DELETE товару: порядок «корінь -> модифікації за id», як у fill.
  deleteRows: async (db, ids) => {
    await deleteModifications(db, { productIds: ids });
    return removeResourceRows(db, products, ids);
  },
  // К3-Е6д-1: фото товару — власник `product`; заміна/прибирання стирає файл.
  media: { entityType: 'product', columns: ['images'] },
  // Е6д-19: FK `product_reviews.product_id` — CASCADE; без опції фото
  // відгуків пережили б товар (публічні за URL, недосяжні для `deleteCustomer`).
  cascadeMedia: [
    {
      fk: productReviews.productId,
      column: productReviews.images,
      entityType: REVIEW_MEDIA_ENTITY,
    },
    // К3-Е6д-1: FK `product_modifications.product_id` — CASCADE.
    {
      fk: productModifications.productId,
      column: productModifications.images,
      entityType: 'product_modification',
    },
    // М1 (Task 12): фото й мовні перевизначення — рядки `product_images` /
    // `product_image_translations`; файли належать ТОВАРУ (media.entity_id = id товару).
    {
      fk: productImages.productId,
      column: productImages.storageKey,
      entityType: 'product',
      owner: productImages.productId,
    },
    {
      via: productImages.productId,
      fk: productImageTranslations.imageId,
      column: productImageTranslations.storageKey,
      entityType: 'product',
      owner: productImages.productId,
    },
  ],
});
