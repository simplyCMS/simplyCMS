import { z } from 'zod';
import { SLUG_RE } from 'simplycms/domain';
import {
  productImageTranslations,
  productImages,
  productModifications,
} from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * 🔴 isDefault — readonly (контракт хвиль Е1б для таблиць із single-default
 * індексом `idx_product_modifications_single_default`): прапорець ставить
 * лише setDefaultModification (Task 4). sortOrder — writable: клієнт рахує
 * max+1 з уже завантаженого зрізу товару; переставляння — reorder (Task 4).
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
  // m3 (рев'ю хвилі B): `images` — jsonb без власної форми в генераторі схем
  // (`.$type<string[]>()` бачить лише Drizzle, не генератор Zod-схем) —
  // без рефайнменту insert `{}`/update `'str'` проходили б як валідний
  // `any`. Функція, не голий ZodType — `resource-schemas.ts` пояснює чому.
  // Д5: slug модифікації — частина URL, формат перевіряє й сервер.
  refine: {
    images: () => z.array(z.string()),
    slug: (s: z.ZodString) => s.regex(SLUG_RE),
  },
  writable: [
    'productId',
    'slug',
    'name',
    'sku',
    'images',
    'sortOrder',
    'stockStatus',
  ],
  readonly: ['id', 'isDefault', 'createdAt', 'updatedAt'],
  // К3-Е6д-1: прибране з галереї фото стирає файл після COMMIT.
  media: { entityType: 'product_modification', columns: ['images'] },
  // М1 (Task 12): фото модифікації (`product_images.modification_id`) каскадно
  // зникають; їхні файли належать товару, а не модифікації.
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
