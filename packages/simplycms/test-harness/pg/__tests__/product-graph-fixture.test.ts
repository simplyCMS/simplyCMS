// М1 Task 10: фікстурний хелпер графа товару. Доводить, що ОДИН виклик дає
// повний граф за контрактом майстра §3.1 (переклад основної мови, поточна
// адреса, токени модифікацій, значення з `value_kind`) і що запис іде під
// спільним замком `languages-set` (тригер SC004).
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { useAddressingDb } from './fixtures/addressing-db';
import { templatedTargets, writesProductTables } from './fixtures/writer-guard';
import {
  VALUE_OWNERS,
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
      `select locale, path, is_current from public.url_paths where product_id = $1 order by locale`,
      [ids.product],
    );
    // Поточна адреса в КОЖНІЙ мові draft/published — стан команд (тригер наявності, І16).
    expect(rows).toEqual([
      { locale: 'en', path: 'pg-product', is_current: true },
      { locale: 'uk', path: 'pg-product', is_current: true },
    ]);
  });

  it('по токену на кожну модифікацію та переклад назви модифікації', async () => {
    const tokens = await q(
      `select locale, slug, scope_id, is_current from public.slug_tokens
        where scope_id = $1 order by slug, locale`,
      [ids.product],
    );
    // Токен у кожній мові draft/published (тригер наявності, І16).
    expect(tokens).toEqual(
      ['pg-mod-a', 'pg-mod-b'].flatMap((slug) =>
        ['en', 'uk'].map((locale) => ({
          locale,
          slug,
          scope_id: ids.product,
          is_current: true,
        })),
      ),
    );
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

  it('у базових таблицях товару немає текстових колонок, фото й тексту значення (М1, Task 17)', async () => {
    const rows = await q(
      `select table_name || '.' || column_name as c from information_schema.columns
        where table_schema = 'public'
          and (table_name, column_name) in (
            ('products', 'slug'), ('products', 'name'), ('products', 'short_description'),
            ('products', 'description'), ('products', 'meta_title'), ('products', 'meta_description'),
            ('products', 'images'), ('products', 'return_policy'), ('products', 'shipping_details'),
            ('product_modifications', 'slug'), ('product_modifications', 'name'),
            ('product_modifications', 'images'), ('product_property_values', 'value'),
            ('modification_property_values', 'value'))`,
    );
    expect(rows).toEqual([]);
  });

  it('запис адреси без замка languages-set відхиляє SC004, хелпер його бере сам', async () => {
    // Той самий рядок без замка: негативний контроль самого тригера, а не хелпера.
    await expect(
      q(
        urlPathRowSql({
          locale: 'uk',
          path: 'pg-lock-old',
          productId: ids.product,
          isCurrent: false,
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
      await q(
        `select 1 from public.url_paths where product_id = $1 and locale = 'uk'`,
        [other],
      ),
    ).toHaveLength(1);
  });

  it('граф без адрес (`addresses: false`) і без власних адрес у транзакції — відмова на коміті (І16)', async () => {
    const id = randomUUID();
    await expect(
      insertProductGraph(client, {
        id,
        slug: 'pg-bare',
        name: 'B',
        addresses: false,
      }),
    ).rejects.toMatchObject({ code: '23514' });
    expect(
      await q(`select 1 from public.products where id = $1`, [id]),
    ).toEqual([]);
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
  const REGISTRIES =
    /insert\s+into\s+(public\.)?(url_paths|slug_tokens)\b|insert\(\s*[\w.]*(urlPaths|slugTokens)\b|insertInto\(\s*['"](url_paths|slug_tokens)['"]/i;
  const BUILDERS = (f: string) =>
    f.startsWith('pg/__tests__/fixtures/product-graph');
  // Цей файл і модуль гарда містять зразки заборонених форм як дані.
  const SELF = 'pg/__tests__/product-graph-fixture.test.ts';
  const GUARD = 'pg/__tests__/fixtures/writer-guard.ts';
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
  /**
   * Шаблонні імена таблиць, які гард розкрити не може, — лише тут і з причиною: інакше
   * це порушення (тихий пропуск такого шаблону вже раз пропустив запис повз билдер).
   */
  const DYNAMIC_TABLES: Record<string, string> = {
    'pg/__tests__/attach-current.test.ts':
      'пробні таблиці процедури attach_current_* (create table у самому тесті)',
    'pg/__tests__/fixtures/translatable-probe.ts':
      'пробні таблиці тригера джерела (create table у самій фікстурі)',
    'pg/__tests__/seed-determinism.test.ts':
      'текст повідомлення асерту (`insert into ${table} без колонки id`), не SQL',
  };
  const harnessFiles = () =>
    files(HARNESS)
      .map((f) => relative(HARNESS, f))
      .filter((f) => f !== SELF && f !== GUARD && !BUILDERS(f));
  const text = (f: string) => readFileSync(join(HARNESS, f), 'utf8');
  const offenders = (test: (t: string) => boolean, allowed: Set<string>) =>
    harnessFiles()
      .filter((f) => !allowed.has(f) && test(text(f)))
      .sort();

  it('вставки в таблиці товару — лише через fixtures/product-graph*.ts', () => {
    expect(offenders(writesProductTables, new Set())).toEqual([]);
  });

  it("шаблонне ім'я таблиці, яке гард не розкриває, — лише з причиною", () => {
    expect(
      offenders(
        (t) => templatedTargets(t).unexpandable.length > 0,
        new Set(Object.keys(DYNAMIC_TABLES)),
      ),
    ).toEqual([]);
  });

  it('перелік дозволених шаблонів не стухає (файл справді має такий шаблон)', () => {
    for (const f of Object.keys(DYNAMIC_TABLES))
      expect(templatedTargets(text(f)).unexpandable, f).not.toEqual([]);
  });

  it('вставки в url_paths/slug_tokens — лише тести реєстрів', () => {
    expect(offenders((t) => REGISTRIES.test(t), REGISTRY_TESTS)).toEqual([]);
  });

  // Негативний контроль самого гарда: кожна заборонена форма впізнається.
  it.each([
    'INSERT INTO public.products (id) values (1)',
    'insert into\n  public.products (id) values (1)',
    'insert  into   product_modifications (id)',
    'db.insert(schema.products).values(x)',
    'db.insert(\n productPropertyValues)',
    "insertInto('modification_property_values', row)",
  ])('гард впізнає форму %j', (sample) => {
    expect(writesProductTables(sample)).toBe(true);
  });

  it('гард ловить insertInto в іншій фікстурі (реальний прогін)', () => {
    const fake = 'pg/__tests__/fixtures/other-fixture.ts';
    const sample = "insertInto('products', {})";
    const hit = [fake].filter(
      (f) => !BUILDERS(f) && writesProductTables(sample),
    );
    expect(hit).toEqual([fake]);
  });

  // Task 17 fix-1 (A3): шаблонні імена — розкриття за власниками з одного джерела.
  it.each(VALUE_OWNERS)(
    'шаблон `${owner}_property_values` розкривається і в «%s_property_values»',
    (owner) => {
      const sample =
        'insert into public.${owner}_property_values (id) values (1)';
      expect(templatedTargets(sample).guarded).toContain(
        `${owner}_property_values`,
      );
      expect(writesProductTables(sample)).toBe(true);
    },
  );

  it('шаблон перекладів значень розкривається, але не є таблицею графа', () => {
    const sample =
      'insert into public.${kind}_property_value_translations (value_id) values (1)';
    expect(templatedTargets(sample)).toEqual({ guarded: [], unexpandable: [] });
  });

  it.each([
    'insert into public.${table} (id) values (1)',
    'insert into public.plg_${name}_items (id) values (1)',
    'insert into ${a}_${b}_property_values (id)',
  ])('нерозкривний шаблон %j — порушення, а не пропуск', (sample) => {
    expect(templatedTargets(sample).unexpandable).toHaveLength(1);
  });
});
