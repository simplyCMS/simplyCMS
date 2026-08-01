/**
 * Рендер `supabase/seed.sql` із фікстур (`seed-fixtures.mjs`).
 *
 * Сід ІДЕМПОТЕНТНИЙ: `supabase db reset` проганяє його щоразу, а `supabase
 * start` — при першому підйомі стеку, тож жоден INSERT не має падати на
 * повторі. Виконується він від суперюзера, тому RLS тут не заважає.
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

/** SQL-літерал numeric або NULL. */
const num = (value) => (value == null ? 'null::numeric' : `${value}::numeric`);

const HEADER = `-- ЗГЕНЕРОВАНО: node scripts/pilot-seed.mjs — РУКАМИ НЕ ПРАВИТИ.
-- Джерело правди: scripts/pilot-pack/seed-fixtures.mjs
-- Парність файлу й фікстур стереже tests/pilot-seed.test.ts.
--
-- Детерміністичний сід пілота (\`pnpm pilot:e2e\`): рівно стільки даних,
-- скільки треба Gate B, щоб асертити КОНКРЕТНІ назви товарів у SSR-HTML.
-- Застосовується локальним стеком після міграцій (\`[db.seed]\` у config.toml).`;

/** Активна тема: спершу гасимо решту — на \`is_active\` висить unique-індекс. */
function renderTheme() {
  return `-- 1. Активна тема (без неї getActiveThemeSSR не резолвиться).
update public.themes set is_active = false where name <> ${q(SEED_THEME)};
insert into public.themes (name, display_name, version, is_active)
values (${q(SEED_THEME)}, 'Default Theme', '0.1.0', true)
on conflict (name) do update set is_active = true;`;
}

function renderSections() {
  const rows = SEED_SECTIONS.map(
    (s) =>
      `  (${q(s.slug)}, ${q(s.name)}, ${q(s.description)}, ${s.sortOrder}, true)`,
  ).join(',\n');
  return `-- 2. Кореневі секції (parent_id IS NULL) — каруселі головної.
insert into public.sections (slug, name, description, sort_order, is_active)
values
${rows}
on conflict (slug) do nothing;`;
}

function renderProducts() {
  const rows = SEED_PRODUCTS.map(
    (p) =>
      `  (${q(p.slug)}, ${q(p.name)}, ${q(p.sectionSlug)}, ${p.isFeatured})`,
  ).join(',\n');
  return `-- 3. Товари: прив'язані до секцій, без модифікацій (ціна — на товарі).
insert into public.products (
  slug, name, section_id, is_active, is_featured, has_modifications,
  stock_status, images
)
select v.slug, v.name, s.id, true, v.is_featured, false, 'in_stock',
       '[]'::jsonb
from (values
${rows}
) as v(slug, name, section_slug, is_featured)
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
    (p) => `  (${q(p.slug)}, ${num(p.price)}, ${num(p.oldPrice)})`,
  ).join(',\n');
  return `-- 4. Ціни для типу за замовчуванням — саме їх бере анонімний SSR.
insert into public.product_prices (
  price_type_id, product_id, modification_id, price, old_price
)
select pt.id, p.id, null, v.price, v.old_price
from (values
${rows}
) as v(slug, price, old_price)
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
  return `-- 5. Плагін із конфіга магазину — щоб адмінка бачила його одразу.
insert into public.plugins (
  name, display_name, version, description, author, is_active, hooks
)
values (
  ${q(name)}, ${q(displayName)}, ${q(version)}, ${q(description)},
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
