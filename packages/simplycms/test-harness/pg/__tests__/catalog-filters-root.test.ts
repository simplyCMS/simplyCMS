// Фільтри каталогу БЕЗ розділу (Task 11, 0.15.0): об'єднання фільтровних
// характеристик активних розділів, лише тих, що мають значення в активних
// товарах. Довести відбір, дедуплікацію й порядок можна лише живим SQL.
//
// Стан до хвилі мультимовності: дизайн `2026-10-14-multilingual-wave-design.md`
// §8 переводить каталог на сервер і замінює `/catalog` — тут мінімально
// коректний корінь, нічого понад.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import {
  loadSectionFilterProperties,
  loadSectionFilters,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import {
  applyCanon,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';
import { productGraphSql } from './fixtures/product-graph';

const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SEC_A = uid(0xa1);
const SEC_B = uid(0xa2);
const SEC_OFF = uid(0xa3);
const PROD_ON = uid(0xc1);
const PROD_OFF = uid(0xc2);
const MOD_ON = uid(0xd1);

interface PropSpec {
  n: number;
  name: string;
  type: string;
  filterable?: boolean;
  /** `[розділ, sort_order]` призначень. */
  assign: Array<[string, number]>;
}

const PROPS: PropSpec[] = [
  { n: 1, name: 'Бета', type: 'boolean', assign: [[SEC_A, 1]] },
  { n: 2, name: 'Альфа', type: 'boolean', assign: [[SEC_B, 1]] },
  // Спільна для двох розділів: у вибірці один раз, з мінімальним sort_order.
  {
    n: 3,
    name: 'Спільна',
    type: 'number',
    assign: [
      [SEC_A, 5],
      [SEC_B, 2],
    ],
  },
  // Значення лише через активну модифікацію активного товару.
  { n: 4, name: 'Через модифікацію', type: 'select', assign: [[SEC_B, 3]] },
  // Негативні контролі: кожна має бути відсутня на корені.
  { n: 5, name: 'Порожня', type: 'number', assign: [[SEC_A, 6]] },
  {
    n: 6,
    name: 'Лише неактивний розділ',
    type: 'number',
    assign: [[SEC_OFF, 1]],
  },
  { n: 7, name: 'Лише неактивний товар', type: 'number', assign: [[SEC_A, 7]] },
  {
    n: 8,
    name: 'Нефільтровна',
    type: 'boolean',
    filterable: false,
    assign: [[SEC_A, 8]],
  },
];
const pid = (n: number) => uid(0xb00 + n);

describe('фільтри каталогу без розділу', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_filter_root');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applyCanon(dbUrl);
    const statements = [
      `insert into public.sections (id, name, slug, is_active) values
        ('${SEC_A}', 'А', 'root-a', true), ('${SEC_B}', 'Б', 'root-b', true),
        ('${SEC_OFF}', 'Вимкнений', 'root-off', false)`,
      productGraphSql({
        id: PROD_ON,
        name: 'Активний',
        slug: 'root-on',
        isActive: true,
        modifications: [{ id: MOD_ON, slug: 'root-mod', name: 'Мод' }],
      }),
      productGraphSql({
        id: PROD_OFF,
        name: 'Неактивний',
        slug: 'root-off-p',
        isActive: false,
      }),
    ];
    for (const p of PROPS) {
      statements.push(
        `insert into public.section_properties (id, name, slug, property_type, is_filterable)
         values ('${pid(p.n)}', '${p.name}', 'root-p${p.n}', '${p.type}', ${p.filterable ?? true})`,
      );
      for (const [section, sort] of p.assign) {
        statements.push(
          `insert into public.section_property_assignments (id, section_id, property_id, sort_order)
           values (gen_random_uuid(), '${section}', '${pid(p.n)}', ${sort})`,
        );
      }
    }
    const value = (
      owner: 'product' | 'modification',
      n: number,
      ownerId: string,
    ) =>
      `insert into public.${owner}_property_values (id, ${owner}_id, property_id, value)
       values (gen_random_uuid(), '${ownerId}', '${pid(n)}', '1')`;
    statements.push(
      value('product', 1, PROD_ON),
      value('product', 2, PROD_ON),
      value('product', 3, PROD_ON),
      value('modification', 4, MOD_ON),
      value('product', 6, PROD_ON), // значення є, але розділ неактивний
      value('product', 7, PROD_OFF), // значення лише в неактивному товарі
      value('product', 8, PROD_ON), // значення є, але нефільтровна
      `insert into public.property_options (id, property_id, name, slug, sort_order)
       values (gen_random_uuid(), '${pid(4)}', 'Опція', 'root-opt', 1)`,
    );
    for (const statement of statements) await queryRows(dbUrl, statement);
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('loadSectionFilters(null): об’єднання без дублів, у стабільному порядку, лише зі значеннями', async () => {
    const { properties, optionsByProperty } = await withStorefrontDb((db) =>
      loadSectionFilters(db, null),
    );

    // min sort_order: Альфа 1, Бета 1 (нічия → за назвою), Спільна 2, далі 3.
    expect(properties.map((p) => p.name)).toEqual([
      'Альфа',
      'Бета',
      'Спільна',
      'Через модифікацію',
    ]);
    expect(optionsByProperty[pid(4)]?.map((o) => o.name)).toEqual(['Опція']);
  });

  it('loadSectionFilterProperties(null): number/range/boolean, ті самі правила', async () => {
    const rows = await withStorefrontDb((db) =>
      loadSectionFilterProperties(db, null),
    );

    expect(rows.map((r) => r.name)).toEqual(['Альфа', 'Бета', 'Спільна']);
  });

  it('з розділом поведінка не змінилась: порожні властивості лишаються', async () => {
    const rows = await withStorefrontDb((db) =>
      loadSectionFilterProperties(db, SEC_A),
    );

    expect(rows.map((r) => r.name)).toEqual([
      'Бета',
      'Спільна',
      'Порожня',
      'Лише неактивний товар',
    ]);
  });
});
