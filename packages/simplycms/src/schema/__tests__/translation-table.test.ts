import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { productTranslations } from '../schema';

// Форму таблиці перекладу тримає хелпер; зміну SQL доводить паритет baseline
// (`tests/schema-sources-parity.test.ts`), а тут — тип рядка, від якого залежить
// увесь код читання/запису перекладів.
describe('translationTable', () => {
  it('тип рядка: власник, мова, перекладні поля, хеші', () => {
    type Row = typeof productTranslations.$inferSelect;
    expectTypeOf<Row['productId']>().toEqualTypeOf<string>();
    expectTypeOf<Row['locale']>().toEqualTypeOf<string>();
    expectTypeOf<Row['name']>().toEqualTypeOf<string | null>();
    expectTypeOf<Row['sourceHashes']>().toEqualTypeOf<Record<string, string>>();
  });

  it('спільна форма: PK, FK мови RESTRICT, індекс мови, CHECK хешів', () => {
    const cfg = getTableConfig(productTranslations);
    expect(cfg.primaryKeys.map((k) => k.getName())).toEqual([
      'product_translations_pkey',
    ]);
    const locale = cfg.foreignKeys.find(
      (f) => f.getName() === 'product_translations_locale_fkey',
    );
    expect(locale?.onDelete).toBe('restrict');
    expect(cfg.indexes.map((i) => i.config.name)).toContain(
      'idx_product_translations_locale',
    );
    expect(cfg.checks.map((c) => c.name)).toContain(
      'product_translations_source_hashes_object',
    );
  });
});
