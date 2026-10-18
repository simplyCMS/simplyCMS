import { describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(),
}));
vi.mock('simplycms/db', () => ({ withActor: vi.fn() }));

import { defineAdminResource } from '../resource';

// Типи allowlist read-model (m4): `sortable`/`filterable`/`defaultOrder` можуть називати поле
// read-model, а `required`/`exclude` — лише реальні поля/колонки; одрук ловить typecheck
// (зайвий `@ts-expect-error` теж падає), а не тиша до зносу колонок у Task 17.
const items = pgTable('rm_items', {
  id: uuid().primaryKey().notNull(),
  mirror: text().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});
const itemTexts = pgTable('rm_item_texts', {
  itemId: uuid('item_id').notNull(),
  locale: text().notNull(),
  title: text(),
});

const base = {
  entity: 'rm_items',
  table: items,
  operation: 'catalog.write',
  mode: 'on-demand',
  writable: ['mirror'],
  readonly: ['id', 'createdAt'],
} as const;
const readModel = {
  translations: itemTexts,
  owner: itemTexts.itemId,
  fields: { title: itemTexts.title },
  required: ['title'],
  exclude: ['mirror'],
} as const;

describe('типи allowlist read-model', () => {
  it('поле read-model (якого немає серед колонок) можна називати в sortable / filterable / defaultOrder', () => {
    const ops = defineAdminResource({
      ...base,
      readModel,
      filterable: ['id', 'title'],
      sortable: ['title', 'createdAt'],
      defaultOrder: { column: 'title', direction: 'asc' },
    });
    expect(ops.entity).toBe('rm_items');
  });

  it('одрук у sortable / required / exclude — помилка компіляції', () => {
    defineAdminResource({
      ...base,
      readModel,
      filterable: ['id'],
      // @ts-expect-error — `titl` не колонка й не поле read-model
      sortable: ['titl'],
    });
    // @ts-expect-error — `titel` у `required` не названо серед `fields` (гард конфігу)
    defineAdminResource({
      ...base,
      readModel: { ...readModel, required: ['titel'] },
      filterable: ['id'],
      sortable: ['title'],
    });
    defineAdminResource({
      ...base,
      // @ts-expect-error — `mirorr` не колонка таблиці для `exclude`
      readModel: { ...readModel, exclude: ['mirorr'] },
      filterable: ['id'],
      sortable: ['createdAt'],
    });
  });
});
