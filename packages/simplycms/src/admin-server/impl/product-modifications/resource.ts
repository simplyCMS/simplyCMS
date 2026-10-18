import { inArray } from 'drizzle-orm';
import {
  productImageTranslations,
  productImages,
  productModificationTranslations,
  productModifications,
} from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';
import { lockAggregateRoots } from '../products/aggregate/lock-order';
import { deleteModifications } from './delete';

/**
 * ЛИШЕ ЧИТАННЯ колекцій і видалення (М1, Task 17): модифікацію створює й править — разом
 * з `isDefault` і порядком — команда агрегата `products.saveDescription` (рядок без перекладу
 * основної мови й поточного токена не комітиться, І4, І16; версія агрегата піднімається).
 * Окремих операцій дефолту й порядку немає: вони йшли повз корінь агрегата і не піднімали
 * `products.version`.
 *
 * Узагальнений `remove` (з `lockOnRemove`) у проді serverFn не має — його кличуть лише тести
 * медіа-контуру. Лишається свідомо як захист фабрики: будь-хто, хто відкриє його назовні,
 * отримає видалення в порядку ієрархії замків (`lock-order.ts`, пункт (4)), а не обхід.
 */
export const productModificationsOps = defineAdminResource({
  entity: ENTITY.productModifications,
  table: productModifications,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['id', 'productId'],
  sortable: ['sortOrder', 'name'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  touch: 'updatedAt',
  // М1 (Task 16): назва модифікації для колекцій — з перекладу основної мови (INNER JOIN).
  readModel: {
    translations: productModificationTranslations,
    owner: productModificationTranslations.modificationId,
    fields: { name: productModificationTranslations.name },
    required: ['name'],
  },
  writable: [],
  readonly: [
    'id',
    'productId',
    'sku',
    'isDefault',
    'sortOrder',
    'stockStatus',
    'createdAt',
    'updatedAt',
  ],
  // М1 (Task 12): фото модифікації (`product_images.modification_id`) каскадно
  // зникають; їхні файли належать товару, а не модифікації.
  // М1: каскад фото модифікації серіалізується з командами агрегата товару: корені —
  // тим самим замком кореня агрегата (спільний `languages-set` -> NO KEY UPDATE за id).
  lockOnRemove: async (db, ids) => {
    if (ids.length === 0) return;
    const roots = await db
      .selectDistinct({ id: productModifications.productId })
      .from(productModifications)
      .where(inArray(productModifications.id, [...ids]));
    await lockAggregateRoots(
      db,
      roots.map((r) => r.id),
      'no key update',
    );
  },
  // М1 (Task 14): DELETE — лише єдиним видалячем модифікацій (`FOR UPDATE` за id).
  deleteRows: (db, ids) => deleteModifications(db, { ids }),
  cascadeMedia: [
    {
      fk: productImages.modificationId,
      column: productImages.storageKey,
      entityType: 'product',
      owner: productImages.productId,
    },
    {
      via: productImages.modificationId,
      fk: productImageTranslations.imageId,
      column: productImageTranslations.storageKey,
      entityType: 'product',
      owner: productImages.productId,
    },
  ],
});
