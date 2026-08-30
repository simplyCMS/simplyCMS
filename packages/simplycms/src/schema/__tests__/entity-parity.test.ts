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
      .filter(
        ([key, table]) =>
          key !== table.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      )
      .map(([key, table]) => `${key} ≠ ${table}`);
    expect(wrong, `розбіжність ключа й таблиці: ${wrong.join(', ')}`).toEqual(
      [],
    );
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
        expect(known.has(dep), `${name}: залежність ${dep} поза ENTITY`).toBe(
          true,
        );
      }
    }
  });

  it('імена агрегатів не колізують ні з ENTITY, ні між собою', () => {
    // 🔴 Запобіжник, а не теоретична турбота: агрегат, названий іменем
    // таблиці (`AGGREGATE.x.key[0] === ENTITY.y`), мовчки зілляв би свій
    // кеш із ключами `entityKey(ENTITY.y)` — префіксна інвалідація однієї
    // сутності зачепила б і зовсім інший запит.
    const entityValues = new Set<string>(Object.values(ENTITY));
    const aggNames = Object.entries(AGGREGATE).map(
      ([name, agg]) => [name, agg.key[0]] as const,
    );

    const collidesWithEntity = aggNames
      .filter(([, aggName]) => entityValues.has(aggName))
      .map(([name, aggName]) => `${name} → ${aggName}`);
    expect(
      collidesWithEntity,
      `імʼя агрегату збігається зі значенням ENTITY: ${collidesWithEntity.join(', ')}`,
    ).toEqual([]);

    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const [name, aggName] of aggNames) {
      if (seen.has(aggName)) duplicates.push(`${name} → ${aggName}`);
      seen.add(aggName);
    }
    expect(
      duplicates,
      `дублікат імені агрегату: ${duplicates.join(', ')}`,
    ).toEqual([]);
  });
});
