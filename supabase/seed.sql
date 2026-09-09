-- ЗГЕНЕРОВАНО: node scripts/pilot-seed.mjs — РУКАМИ НЕ ПРАВИТИ.
-- Джерело правди: scripts/pilot-pack/seed-fixtures.mjs
-- Парність файлу й фікстур стереже tests/pilot-seed.test.ts.
--
-- 🔴 Споживача (`pnpm pilot:e2e`, локальний стек Supabase, Gate B асертив
-- КОНКРЕТНІ назви товарів у SSR-HTML) знесено разом зі стеком у 0.4.1 —
-- фікстури лишаються під парність-тестом до треку К6.

-- 1. Активна тема (без неї getActiveThemeSSR не резолвиться).
update public.themes set is_active = false where name <> 'default';
insert into public.themes (id, name, display_name, version, is_active)
values ('20000001-0000-4000-8000-000000000001', 'default', 'Default Theme', '0.1.0', true)
on conflict (name) do update set is_active = true;

-- 2. Кореневі секції (parent_id IS NULL) — каруселі головної.
insert into public.sections (id, slug, name, description, sort_order, is_active)
values
  ('20000002-0000-4000-8000-000000000001', 'pilot-seed-panels', 'Pilot Seed Panels', 'Секція сіду пілота: панелі.', 10, true),
  ('20000002-0000-4000-8000-000000000002', 'pilot-seed-inverters', 'Pilot Seed Inverters', 'Секція сіду пілота: інвертори.', 20, true),
  ('20000002-0000-4000-8000-000000000003', 'pilot-seed-batteries', 'Pilot Seed Batteries', 'Секція сіду пілота: акумулятори.', 30, true)
on conflict (slug) do nothing;

-- 3. Товари: прив'язані до секцій, без модифікацій (ціна — на товарі).
insert into public.products (
  id, slug, name, section_id, is_active, is_featured, has_modifications,
  stock_status, images
)
select v.id, v.slug, v.name, s.id, true, v.is_featured, false, 'in_stock',
       '[]'::jsonb
from (values
  ('20000003-0000-4000-8000-000000000001'::uuid, 'pilot-seed-panel-alpha', 'Pilot Seed Panel Alpha', 'pilot-seed-panels', true),
  ('20000003-0000-4000-8000-000000000002'::uuid, 'pilot-seed-panel-beta', 'Pilot Seed Panel Beta', 'pilot-seed-panels', false),
  ('20000003-0000-4000-8000-000000000003'::uuid, 'pilot-seed-inverter-gamma', 'Pilot Seed Inverter Gamma', 'pilot-seed-inverters', true),
  ('20000003-0000-4000-8000-000000000004'::uuid, 'pilot-seed-battery-delta', 'Pilot Seed Battery Delta', 'pilot-seed-batteries', false)
) as v(id, slug, name, section_slug, is_featured)
join public.sections s on s.slug = v.section_slug
on conflict (slug) do nothing;

-- 4. Ціни для типу за замовчуванням — саме їх бере анонімний SSR.
insert into public.product_prices (
  id, price_type_id, product_id, modification_id, price, old_price
)
select v.id, pt.id, p.id, null, v.price, v.old_price
from (values
  ('20000004-0000-4000-8000-000000000001'::uuid, 'pilot-seed-panel-alpha', 4200::numeric, 4800::numeric),
  ('20000004-0000-4000-8000-000000000002'::uuid, 'pilot-seed-panel-beta', 5100::numeric, null::numeric),
  ('20000004-0000-4000-8000-000000000003'::uuid, 'pilot-seed-inverter-gamma', 18300::numeric, null::numeric),
  ('20000004-0000-4000-8000-000000000004'::uuid, 'pilot-seed-battery-delta', 26500::numeric, 29900::numeric)
) as v(id, slug, price, old_price)
join public.products p on p.slug = v.slug
cross join (
  select id from public.price_types where code = 'retail' limit 1
) pt
on conflict do nothing;

-- 5. Плагін із конфіга магазину — щоб адмінка бачила його одразу.
insert into public.plugins (
  id, name, display_name, version, description, author, is_active, hooks
)
values (
  '20000005-0000-4000-8000-000000000001', 'hello-world', 'Hello World', '0.1.0', 'Demo plugin: a dashboard widget proving the plugin contour works.',
  'SimplyCMS', true, '[{"name":"admin.dashboard.widgets"}]'::jsonb
)
on conflict (name) do nothing;
