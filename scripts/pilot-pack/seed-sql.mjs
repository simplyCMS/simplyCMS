/**
 * Рендер `supabase/seed.sql` із фікстур (`seed-fixtures.mjs`).
 *
 * 🔴 Споживача (`pnpm pilot:e2e`, локальний стек Supabase + `supabase db
 * reset`) знесено разом зі стеком у 0.4.1 — фікстури лишаються під
 * парність-тестом до треку К6. Сід писався ІДЕМПОТЕНТНИМ (жоден INSERT не мав
 * падати на повторі) і виконувався від суперюзера, тому RLS йому не заважав.
 *
 * 🔴 Е0 (контракт id, V2-К3): усі пʼять таблиць, у які пише цей сід
 * (`themes`, `sections`, `products`, `product_prices`, `plugins`) —
 * Категорія A (`DROP DEFAULT` на `id`, Task 4) — тож `id` треба слати явно
 * з клієнта. Значення — СТАБІЛЬНІ УУІД (той самий формат, що в
 * `packages/simplycms/migrations/0003_seed.sql` і `.../demo/demo-seed.sql`:
 * 8-символьний hex-префікс на таблицю + 12-цифровий порядковий номер
 * рядка), а не `crypto.randomUUID()` — сід перегенерується на кожен
 * `pnpm pilot:seed`, і випадковий id ламав би повторний докат на вже
 * засіяній БД (`on conflict` звіряється з тим самим значенням, не з новим).
 */

import {
  SEED_PLUGIN,
  SEED_PRICE_TYPE_CODE,
  SEED_PRODUCTS,
  SEED_SECTIONS,
  SEED_THEME,
} from './seed-fixtures.mjs';

/** SQL-літерал рядка (одинарні лапки подвоюються). */
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;

/** Префікс кожної сідованої таблиці (8 hex-символів) — свій, не з core/demo сідів. */
const ID_PREFIX = {
  themes: '20000001',
  sections: '20000002',
  products: '20000003',
  productPrices: '20000004',
  plugins: '20000005',
};

/** Стабільний UUID: `<префікс таблиці>-0000-4000-8000-<12-значний номер рядка>`. */
const seedId = (tablePrefix, rowNumber) =>
  `${tablePrefix}-0000-4000-8000-${String(rowNumber).padStart(12, '0')}`;

/** SQL-літерал numeric або NULL. */
const num = (value) => (value == null ? 'null::numeric' : `${value}::numeric`);

const HEADER = `-- ЗГЕНЕРОВАНО: node scripts/pilot-seed.mjs — РУКАМИ НЕ ПРАВИТИ.
-- Джерело правди: scripts/pilot-pack/seed-fixtures.mjs
-- Парність файлу й фікстур стереже tests/pilot-seed.test.ts.
--
-- 🔴 Споживача (\`pnpm pilot:e2e\`, локальний стек Supabase, Gate B асертив
-- КОНКРЕТНІ назви товарів у SSR-HTML) знесено разом зі стеком у 0.4.1 —
-- фікстури лишаються під парність-тестом до треку К6.`;

/** Активна тема: спершу гасимо решту — на \`is_active\` висить unique-індекс. */
function renderTheme() {
  const id = seedId(ID_PREFIX.themes, 1);
  return `-- 1. Активна тема (без неї getActiveThemeSSR не резолвиться).
update public.themes set is_active = false where name <> ${q(SEED_THEME)};
insert into public.themes (id, name, display_name, version, is_active)
values (${q(id)}, ${q(SEED_THEME)}, 'Default Theme', '0.1.0', true)
on conflict (name) do update set is_active = true;`;
}

function renderSections() {
  const rows = SEED_SECTIONS.map(
    (s, i) =>
      `  (${q(seedId(ID_PREFIX.sections, i + 1))}, ${q(s.slug)}, ${q(s.name)}, ${q(s.description)}, ${s.sortOrder}, true)`,
  ).join(',\n');
  return `-- 2. Кореневі секції (parent_id IS NULL) — каруселі головної.
insert into public.sections (id, slug, name, description, sort_order, is_active)
values
${rows}
on conflict (slug) do nothing;`;
}

function renderProducts() {
  const rows = SEED_PRODUCTS.map(
    (p, i) =>
      `  (${q(seedId(ID_PREFIX.products, i + 1))}::uuid, ${q(p.slug)}, ${q(p.name)}, ${q(p.sectionSlug)}, ${p.isFeatured})`,
  ).join(',\n');
  return `-- 3. Товари: прив'язані до секцій, без модифікацій (ціна — на товарі).
insert into public.products (
  id, slug, name, section_id, is_active, is_featured, has_modifications,
  stock_status, images
)
select v.id, v.slug, v.name, s.id, true, v.is_featured, false, 'in_stock',
       '[]'::jsonb
from (values
${rows}
) as v(id, slug, name, section_slug, is_featured)
join public.sections s on s.slug = v.section_slug
on conflict (slug) do nothing;`;
}

/**
 * Ціни за типом «за замовчуванням» (`price_types.code = 'retail'`).
 * `on conflict do nothing` без таргета покриває unique-індекс
 * `idx_product_prices_unique` (він на виразі з COALESCE, таргет не вкажеш).
 */
function renderPrices() {
  const rows = SEED_PRODUCTS.map(
    (p, i) =>
      `  (${q(seedId(ID_PREFIX.productPrices, i + 1))}::uuid, ${q(p.slug)}, ${num(p.price)}, ${num(p.oldPrice)})`,
  ).join(',\n');
  return `-- 4. Ціни для типу за замовчуванням — саме їх бере анонімний SSR.
insert into public.product_prices (
  id, price_type_id, product_id, modification_id, price, old_price
)
select v.id, pt.id, p.id, null, v.price, v.old_price
from (values
${rows}
) as v(id, slug, price, old_price)
join public.products p on p.slug = v.slug
cross join (
  select id from public.price_types where code = ${q(SEED_PRICE_TYPE_CODE)} limit 1
) pt
on conflict do nothing;`;
}

/** Рядок плагіна: інакше його дописав би лише вхід адміна (bootstrapPlugins). */
function renderPlugin() {
  const { name, displayName, version, description, author, hooks } =
    SEED_PLUGIN;
  const id = seedId(ID_PREFIX.plugins, 1);
  return `-- 5. Плагін із конфіга магазину — щоб адмінка бачила його одразу.
insert into public.plugins (
  id, name, display_name, version, description, author, is_active, hooks
)
values (
  ${q(id)}, ${q(name)}, ${q(displayName)}, ${q(version)}, ${q(description)},
  ${q(author)}, true, ${q(JSON.stringify(hooks))}::jsonb
)
on conflict (name) do nothing;`;
}

/** Повний текст `supabase/seed.sql`. */
export function renderSeedSql() {
  const blocks = [
    HEADER,
    renderTheme(),
    renderSections(),
    renderProducts(),
    renderPrices(),
    renderPlugin(),
  ];
  return `${blocks.join('\n\n')}\n`;
}
