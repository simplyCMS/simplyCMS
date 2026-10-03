import type { z } from 'zod';
import { sections } from 'simplycms/schema';
import { SLUG_RE } from 'simplycms/domain';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Розділи каталогу (Е4, Task 3). Операція — catalog.write (Е3-6): адмінка
 * бачить і неактивні розділи.
 *
 * 🔴 Е4-3: `parentId` — readonly, розділи — плоский список (новий розділ
 * має `parent_id NULL`, поле в payload мовчки зрізається). Дерево — окрема
 * продуктова фіча, не тихий побічний ефект форми.
 * 🔴 Е4-7: slug перевіряє і сервер — форма не єдиний рубіж.
 * `touch`: тригера updated_at у каноні немає (Е3-9).
 */
export const sectionsOps = defineAdminResource({
  entity: ENTITY.sections,
  table: sections,
  operation: 'catalog.write',
  mode: 'eager',
  filterable: ['id', 'parentId', 'isActive'],
  sortable: ['name', 'sortOrder'],
  defaultOrder: { column: 'name', direction: 'asc' },
  touch: 'updatedAt',
  refine: { slug: (s: z.ZodString) => s.regex(SLUG_RE) },
  writable: [
    'slug',
    'name',
    'description',
    'imageUrl',
    'sortOrder',
    'isActive',
    'metaTitle',
    'metaDescription',
  ],
  readonly: ['id', 'parentId', 'createdAt', 'updatedAt'],
});
