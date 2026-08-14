-- ЗГЕНЕРОВАНО: node scripts/pilot-seed.mjs — РУКАМИ НЕ ПРАВИТИ.
-- Джерело правди: scripts/pilot-pack/seed-fixtures.mjs
-- Парність файлу й фікстур стереже tests/pilot-seed.test.ts.
--
-- Детерміністичний сід пілота (`pnpm pilot:e2e`): рівно стільки даних,
-- скільки треба Gate B, щоб асертити КОНКРЕТНІ назви товарів у SSR-HTML.
-- Застосовується локальним стеком після міграцій (`[db.seed]` у config.toml).

-- 1. Активна тема (без неї getActiveThemeSSR не резолвиться).
update public.themes set is_active = false where name <> 'default';
insert into public.themes (name, display_name, version, is_active)
values ('default', 'Default Theme', '0.1.0', true)
on conflict (name) do update set is_active = true;

-- 2. Кореневі секції (parent_id IS NULL) — каруселі головної.
insert into public.sections (slug, name, description, sort_order, is_active)
values
  ('pilot-seed-panels', 'Pilot Seed Panels', 'Секція сіду пілота: панелі.', 10, true),
  ('pilot-seed-inverters', 'Pilot Seed Inverters', 'Секція сіду пілота: інвертори.', 20, true),
  ('pilot-seed-batteries', 'Pilot Seed Batteries', 'Секція сіду пілота: акумулятори.', 30, true)
on conflict (slug) do nothing;

-- 3. Товари: прив'язані до секцій, без модифікацій (ціна — на товарі).
insert into public.products (
  slug, name, section_id, is_active, is_featured, has_modifications,
  stock_status, images
)
select v.slug, v.name, s.id, true, v.is_featured, false, 'in_stock',
       '[]'::jsonb
from (values
  ('pilot-seed-panel-alpha', 'Pilot Seed Panel Alpha', 'pilot-seed-panels', true),
  ('pilot-seed-panel-beta', 'Pilot Seed Panel Beta', 'pilot-seed-panels', false),
  ('pilot-seed-inverter-gamma', 'Pilot Seed Inverter Gamma', 'pilot-seed-inverters', true),
  ('pilot-seed-battery-delta', 'Pilot Seed Battery Delta', 'pilot-seed-batteries', false)
) as v(slug, name, section_slug, is_featured)
join public.sections s on s.slug = v.section_slug
on conflict (slug) do nothing;

-- 4. Ціни для типу за замовчуванням — саме їх бере анонімний SSR.
insert into public.product_prices (
  price_type_id, product_id, modification_id, price, old_price
)
select pt.id, p.id, null, v.price, v.old_price
from (values
  ('pilot-seed-panel-alpha', 4200::numeric, 4800::numeric),
  ('pilot-seed-panel-beta', 5100::numeric, null::numeric),
  ('pilot-seed-inverter-gamma', 18300::numeric, null::numeric),
  ('pilot-seed-battery-delta', 26500::numeric, 29900::numeric)
) as v(slug, price, old_price)
join public.products p on p.slug = v.slug
cross join (
  select id from public.price_types where code = 'retail' limit 1
) pt
on conflict do nothing;

-- 5. Плагін із конфіга магазину — щоб адмінка бачила його одразу.
insert into public.plugins (
  name, display_name, version, description, author, is_active, hooks
)
values (
  'hello-world', 'Hello World', '0.1.0', 'Demo plugin: a dashboard widget proving the plugin contour works.',
  'SimplyCMS', true, '[{"name":"admin.dashboard.widgets"}]'::jsonb
)
on conflict (name) do nothing;
