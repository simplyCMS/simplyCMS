import { getTableColumns, getTableName, is, sql } from 'drizzle-orm';
import { PgDialect, PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from 'simplycms/schema';
import {
  TRANSLATABLE,
  fieldFromWire,
  fieldToWire,
  withFallback,
} from '../index';

// Реєстр специфікацій — єдина адреса таблиць перекладів; цей тест звіряє його
// з реальною схемою, щоб розсинхрон був червоним тут, а не в SQL на проді.
const tables = new Map<string, PgTable>(
  (Object.values(schema) as unknown[])
    .filter((t): t is PgTable => is(t, PgTable))
    .map((t): [string, PgTable] => [getTableName(t), t]),
);

describe('TRANSLATABLE (реєстр специфікацій М1)', () => {
  it('product — точні значення з плану', () => {
    expect(TRANSLATABLE.product).toEqual({
      table: 'product_translations',
      fk: 'product_id',
      fields: [
        'name',
        'short_description',
        'description',
        'meta_title',
        'meta_description',
      ],
      required: ['name'],
      richHtml: ['description'],
    });
  });

  it.each(Object.entries(TRANSLATABLE))(
    '%s: таблиця, FK і всі поля існують у схемі',
    (_key, spec) => {
      const table = tables.get(spec.table);
      expect(table, spec.table).toBeDefined();
      const dbNames = Object.values(getTableColumns(table!)).map((c) => c.name);
      expect(dbNames).toEqual(
        expect.arrayContaining([
          spec.fk,
          'locale',
          'source_hashes',
          ...spec.fields,
        ]),
      );
      for (const r of spec.required) expect(spec.fields).toContain(r);
      for (const r of (spec as { richHtml?: readonly string[] }).richHtml ?? [])
        expect(spec.fields).toContain(r);
    },
  );

  it('імена полів дроту: snake ↔ camel, невідоме → null', () => {
    expect(fieldToWire('meta_description')).toBe('metaDescription');
    expect(fieldFromWire(TRANSLATABLE.product, 'shortDescription')).toBe(
      'short_description',
    );
    expect(fieldFromWire(TRANSLATABLE.product, 'short_description')).toBeNull();
    expect(fieldFromWire(TRANSLATABLE.product, 'slug')).toBeNull();
  });

  it('withFallback: coalesce(мова, джерело) на кожне поле і пара LEFT JOIN', () => {
    const dialect = new PgDialect();
    const fb = withFallback(TRANSLATABLE.product, 'en', 'uk');
    expect(dialect.sqlToQuery(fb.columns.name!).sql).toBe(
      'coalesce(t_loc.name, t_src.name)',
    );
    expect(Object.keys(fb.columns)).toEqual([...TRANSLATABLE.product.fields]);
    const q = dialect.sqlToQuery(fb.joinOn(sql`p.id`));
    expect(q.sql.replace(/\s+/g, ' ').trim()).toBe(
      'left join product_translations t_loc on t_loc.product_id = p.id and t_loc.locale = $1 left join product_translations t_src on t_src.product_id = p.id and t_src.locale = $2',
    );
    expect(q.params).toEqual(['en', 'uk']);
  });
});
