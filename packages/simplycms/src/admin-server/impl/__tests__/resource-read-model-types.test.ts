import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { sql, type SQL } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(),
}));
vi.mock('simplycms/db', () => ({ withActor: vi.fn() }));

import { defineAdminResource } from '../resource';

// Типи read-model: `sortable`/`filterable`/`defaultOrder` можуть називати поле read-model,
// а `required` — лише реальні поля; одрук ловить typecheck (зайвий `@ts-expect-error` теж
// падає). Тип рядка `list`: колонки таблиці + поля перекладу + обчислені поля.
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
} as const;
/** Обчислене поле: тип даних — з SQL-виразу (як `mainImage: mainImageSql`). */
const firstPhoto = (_id: unknown): SQL<string | null> =>
  sql<string | null>`null`;

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

  it('рядок list без `exclude`: колонки таблиці на місці, поле перекладу — без null (required)', () => {
    const ops = defineAdminResource({
      ...base,
      readModel,
      filterable: ['id'],
      sortable: ['createdAt'],
    });
    type Row = Awaited<ReturnType<typeof ops.list>>[number];
    expect(ops.entity).toBe('rm_items');
    // Дефект, який стеріг цей тест: `Omit` з усіма колонками для конфігу без ключа.
    expectTypeOf<Row>().toHaveProperty('id').toEqualTypeOf<string>();
    expectTypeOf<Row>().toHaveProperty('mirror').toEqualTypeOf<string>();
    expectTypeOf<Row>().toHaveProperty('createdAt').toEqualTypeOf<Date>();
    expectTypeOf<Row>().toHaveProperty('title').toEqualTypeOf<string>();
  });

  it('обчислене поле: тип з SQL-виразу, без `required` — поле перекладу nullable', () => {
    const ops = defineAdminResource({
      ...base,
      readModel: {
        translations: itemTexts,
        owner: itemTexts.itemId,
        fields: { title: itemTexts.title },
        computed: { mainImage: firstPhoto },
      },
      filterable: ['id'],
      sortable: ['createdAt'],
    });
    type Row = Awaited<ReturnType<typeof ops.list>>[number];
    expect(ops.entity).toBe('rm_items');
    expectTypeOf<Row>()
      .toHaveProperty('mainImage')
      .toEqualTypeOf<string | null>();
    expectTypeOf<Row>().toHaveProperty('title').toEqualTypeOf<string | null>();
    expectTypeOf<Row>().toHaveProperty('mirror').toEqualTypeOf<string>();
  });

  it('одрук у sortable / required — помилка компіляції', () => {
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
  });
});
