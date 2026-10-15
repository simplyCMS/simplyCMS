// М1 Task 10: фікстурний хелпер графа товару. Доводить, що ОДИН виклик дає
// повний граф за контрактом майстра §3.1 (переклад основної мови, поточна
// адреса, токени модифікацій, значення з `value_kind`) і що запис іде під
// спільним замком `languages-set` (тригер SC004).
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { useAddressingDb } from './fixtures/addressing-db';
import {
  insertProductGraph,
  sqlRef,
  urlPathRowSql,
  type PgClientLike,
} from './fixtures/product-graph';

describe('insertProductGraph (М1 Task 10)', () => {
  const db = useAddressingDb('simplycms_product_graph');
  const { q } = db;
  const client: PgClientLike = { query: (sql) => q(sql) };

  const ids = {
    product: randomUUID(),
    modA: randomUUID(),
    modB: randomUUID(),
    pText: randomUUID(),
    pNumber: randomUUID(),
    pSelect: randomUUID(),
    pBool: randomUUID(),
    option: randomUUID(),
    vText: randomUUID(),
    vNumber: randomUUID(),
    vSelect: randomUUID(),
    vBool: randomUUID(),
    vModNumber: randomUUID(),
  };

  beforeAll(async () => {
    await db.language('en');
    for (const [id, slug, type] of [
      [ids.pText, 'pg-text', 'text'],
      [ids.pNumber, 'pg-number', 'number'],
      [ids.pSelect, 'pg-select', 'select'],
      [ids.pBool, 'pg-bool', 'boolean'],
    ]) {
      await q(
        `insert into public.section_properties (id, name, slug, property_type)
         values ($1, $2::text, $2::varchar, $3::property_type)`,
        [id, slug, type],
      );
    }
    await q(
      `insert into public.property_options (id, property_id, name, slug)
       values ($1, $2, 'Опція', 'pg-option')`,
      [ids.option, ids.pSelect],
    );
    await insertProductGraph(client, {
      id: ids.product,
      slug: 'pg-product',
      name: 'Товар графа',
      texts: { description: 'Опис' },
      translations: { en: { name: 'Graph product' } },
      images: ['key-1', 'key-2'],
      modifications: [
        {
          id: ids.modA,
          slug: 'pg-mod-a',
          name: 'Модифікація А',
          isDefault: true,
          images: ['mod-key'],
          values: [
            {
              id: ids.vModNumber,
              propertyId: ids.pNumber,
              kind: 'number',
              number: 7,
            },
          ],
        },
        { id: ids.modB, slug: 'pg-mod-b', name: 'Модифікація Б' },
      ],
      values: [
        {
          id: ids.vText,
          propertyId: ids.pText,
          kind: 'text',
          text: { uk: 'Текст', en: 'Text' },
        },
        {
          id: ids.vNumber,
          propertyId: ids.pNumber,
          kind: 'number',
          number: 450,
        },
        {
          id: ids.vSelect,
          propertyId: ids.pSelect,
          kind: 'select',
          optionId: ids.option,
        },
        { id: ids.vBool, propertyId: ids.pBool, kind: 'boolean', bool: true },
      ],
    });
  });

  it('є рядок перекладу основної мови з обовʼязковою назвою та іншою мовою', async () => {
    const rows = await q(
      `select locale, name, description from public.product_translations
        where product_id = $1 order by locale`,
      [ids.product],
    );
    expect(rows).toEqual([
      { locale: 'en', name: 'Graph product', description: null },
      { locale: 'uk', name: 'Товар графа', description: 'Опис' },
    ]);
  });

  it('url_paths: поточний шлях основної мови = slug', async () => {
    const rows = await q(
      `select locale, path, is_current from public.url_paths where product_id = $1`,
      [ids.product],
    );
    expect(rows).toEqual([
      { locale: 'uk', path: 'pg-product', is_current: true },
    ]);
  });

  it('по токену на кожну модифікацію та переклад назви модифікації', async () => {
    const tokens = await q(
      `select slug, scope_id, is_current from public.slug_tokens
        where scope_id = $1 order by slug`,
      [ids.product],
    );
    expect(tokens).toEqual([
      { slug: 'pg-mod-a', scope_id: ids.product, is_current: true },
      { slug: 'pg-mod-b', scope_id: ids.product, is_current: true },
    ]);
    const names = await q(
      `select name from public.product_modification_translations
        where product_id = $1 order by name`,
      [ids.product],
    );
    expect(names).toEqual([
      { name: 'Модифікація А' },
      { name: 'Модифікація Б' },
    ]);
  });

  it('текстове значення лежить у перекладах, value_kind заповнений у всіх значеннях', async () => {
    const texts = await q(
      `select locale, value from public.product_property_value_translations
        where value_id = $1 order by locale`,
      [ids.vText],
    );
    expect(texts).toEqual([
      { locale: 'en', value: 'Text' },
      { locale: 'uk', value: 'Текст' },
    ]);
    const kinds = await q(
      `select value_kind from public.product_property_values where product_id = $1
       union all
       select value_kind from public.modification_property_values where modification_id = $2`,
      [ids.product, ids.modA],
    );
    expect(kinds).toHaveLength(5);
    expect(kinds.every((r) => r.value_kind !== null)).toBe(true);
    const bool = await q(
      `select bool_value from public.product_property_values where id = $1`,
      [ids.vBool],
    );
    expect(bool).toEqual([{ bool_value: true }]);
  });

  it('зображення товару й модифікації — рядки product_images', async () => {
    const rows = await q(
      `select storage_key, modification_id from public.product_images
        where product_id = $1 order by modification_id nulls first, sort_order`,
      [ids.product],
    );
    expect(rows).toEqual([
      { storage_key: 'key-1', modification_id: null },
      { storage_key: 'key-2', modification_id: null },
      { storage_key: 'mod-key', modification_id: ids.modA },
    ]);
  });

  it('М1-TEMP: старі колонки дзеркалять джерело (читачі до Task 15/16)', async () => {
    const [row] = await q(
      `select p.slug, p.name, p.images, v.value
         from public.products p
         join public.product_property_values v on v.product_id = p.id
        where p.id = $1 and v.id = $2`,
      [ids.product, ids.vText],
    );
    expect(row).toEqual({
      slug: 'pg-product',
      name: 'Товар графа',
      images: ['key-1', 'key-2'],
      value: 'Текст',
    });
  });

  it('запис адреси без замка languages-set відхиляє SC004, хелпер його бере сам', async () => {
    const id = randomUUID();
    await insertProductGraph(client, {
      id,
      slug: 'pg-lock',
      name: 'L',
      addresses: false,
    });
    expect(
      await q(`select 1 from public.url_paths where product_id = $1`, [id]),
    ).toHaveLength(0);
    // Той самий рядок без замка: негативний контроль самого тригера, а не хелпера.
    await expect(
      q(
        urlPathRowSql({
          locale: 'uk',
          path: 'pg-lock',
          productId: id,
          isCurrent: true,
        }),
      ),
    ).rejects.toMatchObject({ code: 'SC004' });
    const other = randomUUID();
    await insertProductGraph(client, {
      id: other,
      slug: 'pg-lock-2',
      name: 'L2',
    });
    expect(
      await q(`select 1 from public.url_paths where product_id = $1`, [other]),
    ).toHaveLength(1);
  });

  it('значення поза графом: підзапит замість UUID працює (sqlRef)', async () => {
    const id = randomUUID();
    await insertProductGraph(client, {
      id,
      slug: 'pg-ref',
      name: 'Ref',
      values: [
        {
          id: randomUUID(),
          propertyId: sqlRef(
            `(select id from public.section_properties where slug = 'pg-number')`,
          ),
          kind: 'number',
          number: '1.5',
        },
      ],
    });
    expect(
      await q(
        `select numeric_value::text as n from public.product_property_values where product_id = $1`,
        [id],
      ),
    ).toEqual([{ n: '1.5000' }]);
  });
});

// Єдиний записувач (fixtures/product-graph*.ts): пряма вставка в таблиці товару чи реєстри адрес повз хелпер
// повертає старий світ (товар без перекладу й адреси). Дозволені лише тести самих
// реєстрів — їм потрібні рядки довільної (хибної) форми для негативних контролів.
describe('єдиний записувач графа товару', () => {
  const HARNESS = join(import.meta.dirname, '../..');
  const PRODUCT_TABLES =
    /insert into (public\.)?(products|product_modifications|product_property_values|modification_property_values)\b|insert\((products|productModifications|productPropertyValues|modificationPropertyValues)\)/;
  const REGISTRIES =
    /insert into (public\.)?(url_paths|slug_tokens)\b|insert\((urlPaths|slugTokens)\)/;
  const REGISTRY_TESTS = new Set([
    'pg/__tests__/url-paths.test.ts',
    'pg/__tests__/slug-tokens.test.ts',
  ]);

  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? files(join(dir, e.name))
        : /\.(ts|mjs)$/.test(e.name)
          ? [join(dir, e.name)]
          : [],
    );
  const offenders = (re: RegExp, allowed: Set<string>) =>
    files(HARNESS)
      .map((f) => relative(HARNESS, f))
      .filter(
        (f) =>
          !allowed.has(f) && re.test(readFileSync(join(HARNESS, f), 'utf8')),
      )
      .sort();

  it('вставки в таблиці товару — лише через fixtures/product-graph*.ts', () => {
    expect(offenders(PRODUCT_TABLES, new Set())).toEqual([]);
  });

  it('вставки в url_paths/slug_tokens — лише тести реєстрів', () => {
    expect(offenders(REGISTRIES, REGISTRY_TESTS)).toEqual([]);
  });
});
