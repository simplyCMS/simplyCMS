import { REVIEW_MEDIA_ENTITY } from 'simplycms/domain/media';
import {
  productImageTranslations,
  productImages,
  productReviews,
  productTranslations,
  products,
} from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { mainImageSql } from 'simplycms/translations';
import { deleteModifications } from '../product-modifications/delete';
import { defineAdminResource } from '../resource';
import { removeResourceRows } from '../resource-write';

/**
 * Товар — перший on-demand ресурс (К3-5). ЛИШЕ ЧИТАННЯ колекцій і видалення
 * (М1, Task 17): створення й правки — команди агрегата (`products.create`,
 * `saveDescription`, `setPath`), бо рядок товару без перекладу основної мови й
 * адреси не комітиться (І4, І16), а узагальнений insert/update їх не пише.
 * filterable — рівно ті поля, якими фільтрує список адмінки (Е3-2) + id для картки.
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
  // М1 (Task 16): колекції адмінки читають НАЗВУ з перекладу основної мови (INNER JOIN),
  // а мініатюру — головне фото агрегата (`product_images`, порядок галереї вітрини).
  readModel: {
    translations: productTranslations,
    owner: productTranslations.productId,
    fields: { name: productTranslations.name },
    required: ['name'],
    computed: { mainImage: mainImageSql },
  },
  writable: [],
  readonly: [
    'id',
    'sectionId',
    'isActive',
    'isFeatured',
    'hasModifications',
    'sku',
    'stockStatus',
    'createdAt',
    'updatedAt',
    // `version` — оптимістична версія агрегата (М1, І14): її піднімає лише команда.
    'version',
  ],
  // М1 (Task 14): модифікації — ЄДИНИМ видалячем (`FOR UPDATE` за id) після знімків
  // медіа й до DELETE товару: порядок «корінь -> модифікації за id», як у fill.
  deleteRows: async (db, ids) => {
    await deleteModifications(db, { productIds: ids });
    return removeResourceRows(db, products, ids);
  },
  // Е6д-19: FK `product_reviews.product_id` — CASCADE; без опції фото
  // відгуків пережили б товар (публічні за URL, недосяжні для `deleteCustomer`).
  cascadeMedia: [
    {
      fk: productReviews.productId,
      column: productReviews.images,
      entityType: REVIEW_MEDIA_ENTITY,
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
