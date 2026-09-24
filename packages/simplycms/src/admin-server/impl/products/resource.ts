import { z } from 'zod';
import { products } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

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
  // m3 (рев'ю хвилі B): `images` — jsonb без власної форми в drizzle-zod,
  // те саме, що й у product-modifications/resource.ts.
  refine: { images: () => z.array(z.string()) },
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
  readonly: ['id', 'createdAt', 'updatedAt'],
});
