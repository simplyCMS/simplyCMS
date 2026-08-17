/**
 * Гард demo-датасету діагностичного стенда (задача §2 блок C, план Р8).
 *
 * 🔴 Що саме доводиться: (а) колонка поза allowlist-ом у вивід НЕ потрапляє;
 * (б) заборонених таблиць (профілі/замовлення/персональні дані) у виводі
 * немає й бути не може — датасет із такою таблицею падає гучно; (в) кожен
 * insert ідемпотентний (`on conflict … do update`); (г) екранування лапок,
 * зворотних слешів, юнікоду, NULL, чисел, boolean, jsonb і дат; (д)
 * генерація детермінована — двічі байт-у-байт, і не залежить від порядку
 * вхідних рядків.
 *
 * Живої БД тест не потребує: під ним чиста функція над фікстурою.
 */
import { describe, expect, it } from 'vitest';
import { generateSeedSql } from '../scripts/dev-stand/generate-seed.mjs';
import { TABLE_SPECS } from '../scripts/dev-stand/table-specs.mjs';
import { quote, toSqlLiteral } from '../scripts/dev-stand/sql-literal.mjs';
import {
  SAMPLE_DATASET,
  SAMPLE_IDS,
} from './fixtures/dev-stand/catalog-sample.mjs';

const FORBIDDEN_TABLES = [
  'profiles',
  'orders',
  'order_items',
  'user_addresses',
  'user_recipients',
  'user_category_history',
  'service_requests',
];

describe('dev-stand: allowlist і санітизація', () => {
  const sql = generateSeedSql(SAMPLE_DATASET);

  it('колонки поза allowlist-ом у вивід не потрапляють', () => {
    expect(sql).not.toContain('owner_email');
    expect(sql).not.toContain('created_at');
    expect(sql).not.toContain('updated_at');
    expect(sql).not.toContain('owner@example.test');
  });

  it('жодної згадки заборонених таблиць у виводі', () => {
    for (const table of FORBIDDEN_TABLES) expect(sql).not.toContain(table);
  });

  it('allowlist таблиць не містить персональних сутностей', () => {
    const tables = TABLE_SPECS.map((spec) => spec.table);
    for (const table of FORBIDDEN_TABLES) expect(tables).not.toContain(table);
  });

  it('невідома таблиця у датасеті — гучна відмова, не мовчазний пропуск', () => {
    expect(() =>
      generateSeedSql({ ...SAMPLE_DATASET, profiles: [{ id: 'x' }] }),
    ).toThrow(/поза allowlist-ом/);
  });

  it('порожній датасет — гучна відмова', () => {
    expect(() => generateSeedSql({})).toThrow(/Порожній датасет/);
  });
});

describe('dev-stand: ідемпотентна форма SQL', () => {
  const sql = generateSeedSql(SAMPLE_DATASET);

  it('кожен insert має on conflict … do update set', () => {
    const inserts = sql.match(/insert into public\./g) ?? [];
    const upserts = sql.match(/on conflict \(.+\) do update set/g) ?? [];
    expect(inserts.length).toBe(5);
    expect(upserts.length).toBe(inserts.length);
  });

  it('ціль конфлікту цін дзеркалить виразний unique-індекс схеми', () => {
    expect(sql).toContain(
      "on conflict (price_type_id, product_id, coalesce(modification_id, '00000000-0000-0000-0000-000000000000'::uuid)) do update set",
    );
  });

  it('price_type_id підставляється локальним підзапитом, не id з дампу', () => {
    expect(sql).toContain(
      '(select id from public.price_types order by is_default desc, sort_order, code limit 1)',
    );
  });

  it('батьківська секція йде перед дочірньою', () => {
    expect(sql.indexOf(SAMPLE_IDS.ROOT_ID)).toBeLessThan(
      sql.indexOf(SAMPLE_IDS.CHILD_ID),
    );
  });

  it('таблиці — у топологічному порядку (батьки перед дітьми)', () => {
    const order = TABLE_SPECS.map((spec) =>
      sql.indexOf(`insert into public.${spec.table} (`),
    ).filter((index) => index >= 0);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe('dev-stand: екранування літералів', () => {
  const sql = generateSeedSql(SAMPLE_DATASET);

  it('одинарні лапки подвоюються', () => {
    expect(quote("O'Brien")).toBe("'O''Brien'");
    expect(sql).toContain("'O''Brien Panels'");
  });

  it('зворотний слеш лишається як є, а файл вимикає escape-режим', () => {
    expect(quote('a\\b')).toBe("'a\\b'");
    expect(sql).toContain('set standard_conforming_strings = on;');
    expect(sql).toContain("450 Вт \\ O''Brien ☀️");
  });

  it('NULL, числа, boolean і дати', () => {
    expect(toSqlLiteral(null)).toBe('null');
    expect(toSqlLiteral(undefined)).toBe('null');
    expect(toSqlLiteral(42)).toBe('42');
    expect(toSqlLiteral(true)).toBe('true');
    expect(toSqlLiteral(false)).toBe('false');
    expect(toSqlLiteral(new Date('2024-01-01T00:00:00.000Z'))).toBe(
      "'2024-01-01T00:00:00.000Z'::timestamptz",
    );
    expect(() => toSqlLiteral(Number.NaN)).toThrow(/Нечислове/);
    expect(() => toSqlLiteral(Symbol('x'))).toThrow(/Непідтримуваний тип/);
  });

  it('jsonb — валідний літерал, порожнє значення лишається null', () => {
    expect(toSqlLiteral({ a: "it's" }, { json: true })).toBe(
      '\'{"a":"it\'\'s"}\'::jsonb',
    );
    expect(toSqlLiteral(null, { json: true })).toBe('null');
    expect(sql).toContain(
      '\'[{"url":"https://cdn.example.test/panel.webp","alt":"Панель"}]\'::jsonb',
    );
  });

  it('NUL-байт — гучна відмова', () => {
    expect(() => quote('a\u0000b')).toThrow(/NUL/);
  });
});

describe('dev-stand: детермінізм', () => {
  it('двічі — байт-у-байт', () => {
    expect(generateSeedSql(SAMPLE_DATASET)).toBe(
      generateSeedSql(SAMPLE_DATASET),
    );
  });

  it('порядок вхідних рядків на вивід не впливає', () => {
    const reversed = {
      ...SAMPLE_DATASET,
      sections: [...SAMPLE_DATASET.sections].reverse(),
    };
    expect(generateSeedSql(reversed)).toBe(generateSeedSql(SAMPLE_DATASET));
  });

  it('дублікат за унікальним ключем не подвоює рядок', () => {
    const doubled = {
      ...SAMPLE_DATASET,
      products: [...SAMPLE_DATASET.products, ...SAMPLE_DATASET.products],
    };
    const sql = generateSeedSql(doubled);
    expect(sql.match(/panel-mono-450/g)?.length).toBe(1);
  });
});
