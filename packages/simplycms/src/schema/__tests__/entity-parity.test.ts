import { describe, expect, it } from 'vitest';
import { getTableName, is, Table } from 'drizzle-orm';
import { AGGREGATE, ENTITY } from 'simplycms/contracts/entities';
import * as schema from '../schema';

/**
 * ENTITY тримає імена таблиць РЯДКАМИ (T0 без рантайм-залежностей), тож
 * звʼязок зі схемою треба доводити машинно: інакше перейменована таблиця
 * лишить у кеші ключ, якого в БД більше немає.
 *
 * 🔴 Скан — цикл, не `.filter((v): v is Table => …)`: `Object.values(schema)`
 * типізується Drizzle як union конкретних branded-типів
 * (`PgTableWithColumns<{name:"media";…}> | PgEnum<[...]> | …`), і generic
 * `Table` (дефолтний параметр) не є підтипом жодного з них, тож `.filter`
 * з предикатом падає TS2677. Звуження в `if` до цього обмеження не
 * доходить — предикат `is()` звужує потоком керування, не через
 * `S extends T` виводу типів `Array.prototype.filter`.
 */
const schemaTables = new Set<string>();
for (const value of Object.values(schema)) {
  if (is(value, Table)) {
    schemaTables.add(getTableName(value));
  }
}

describe('ENTITY ≡ Drizzle-схема', () => {
  it('кожне значення ENTITY існує в схемі', () => {
    const missing = Object.entries(ENTITY)
      .filter(([, table]) => !schemaTables.has(table))
      .map(([key, table]) => `${key} → ${table}`);
    expect(
      missing,
      `ENTITY називає таблиці, яких немає у схемі: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('ключ ENTITY — camelCase від імені таблиці', () => {
    const wrong = Object.entries(ENTITY)
      .filter(([key, table]) => key !== table.replace(/_([a-z])/g, (_, c) => c.toUpperCase()))
      .map(([key, table]) => `${key} ≠ ${table}`);
    expect(wrong, `розбіжність ключа й таблиці: ${wrong.join(', ')}`).toEqual([]);
  });

  it('скан схеми взагалі щось знайшов', () => {
    // Інакше обидва твердження вище зелені через поламаний скан.
    expect(schemaTables.size).toBeGreaterThanOrEqual(40);
  });

  it('кожна залежність агрегату існує в ENTITY', () => {
    // 🔴 `deps` агрегату — не декорація: з них Е1б будує інвалідацію.
    // Залежність поза ENTITY зробила б її мовчазно неповною.
    const known = new Set(Object.values(ENTITY));
    for (const [name, agg] of Object.entries(AGGREGATE)) {
      for (const dep of agg.deps) {
        expect(known.has(dep), `${name}: залежність ${dep} поза ENTITY`).toBe(true);
      }
    }
  });
});
