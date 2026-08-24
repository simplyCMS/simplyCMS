-- packages/simplycms/migrations/demo/demo-seed.sql
--
-- 🔴 ДЕМО-ДАНІ, НЕ КАНОН. Мета — зробити магазин ВИДНИМ одразу після
-- підняття БД: непорожній каталог, кілька товарів із цінами й
-- модифікаціями, банери. Канон (`0000_prelude.sql` … `0003_seed.sql`)
-- лишається мінімальним навмисно (рішення B13) — цей файл котиться ОКРЕМО,
-- поверх канону, вручну або скриптом `pnpm db:demo` (`scripts/demo-db.mjs`),
-- і НІКОЛИ не бере участі в `simplycms db:diff` чи в складі канону, який
-- звіряє `pnpm test:schema` (доказ — `demo-seed.test.ts` того ж контуру).
--
-- Домен — магазин сонячних панелей та електрообладнання (той самий, що й у
-- фікстурах пілота, `scripts/pilot-pack/seed-fixtures.mjs`).
--
-- 🔴 БЕЗ користувачів, замовлень і персональних даних — лише публічний
-- каталог: секції, товари, ціни, властивості, банери. Ідемпотентність —
-- `on conflict do nothing` там, де є природний унікальний ключ; для
-- `banners`, де такого ключа немає, — `where not exists (...)` по title.

-- ── 1. Секції каталогу (дерево: батьківська + дві дочірні) ─────────────────
insert into public.sections (slug, name, description, sort_order, is_active)
values (
  'sonyachna-energetyka',
  'Сонячна енергетика',
  'Обладнання для автономного та мережевого сонячного живлення.',
  10,
  true
)
on conflict (slug) do nothing;

insert into public.sections (slug, name, description, parent_id, sort_order, is_active)
select v.slug, v.name, v.description, p.id, v.sort_order, true
from (
  values
    ('sonyachni-paneli', 'Сонячні панелі', 'Моно- та бі-фаціальні панелі для дому й бізнесу.', 10),
    ('invertory', 'Інвертори', 'Мережеві та гібридні інвертори.', 20)
) as v(slug, name, description, sort_order)
join public.sections p on p.slug = 'sonyachna-energetyka'
on conflict (slug) do nothing;

insert into public.sections (slug, name, description, sort_order, is_active)
values (
  'akumulyatory',
  'Акумулятори та накопичувачі',
  'LiFePO4-акумулятори й домашні станції накопичення енергії.',
  20,
  true
)
on conflict (slug) do nothing;

-- ── 2. Товари ────────────────────────────────────────────────────────────
insert into public.products (
  slug, name, short_description, description, section_id, sku,
  is_active, is_featured, has_modifications, stock_status, images
)
select
  v.slug, v.name, v.short_description, v.description, s.id, v.sku,
  true, v.is_featured, v.has_modifications, 'in_stock', '[]'::jsonb
from (
  values
    ('sonyachna-panel-450w-mono', 'Сонячна панель 450 Вт монокристалічна',
     'Висока ефективність для дахових систем.',
     'Монокристалічна сонячна панель потужністю 450 Вт із ККД понад 21%. Підходить для житлових і комерційних дахових установок.',
     'sonyachni-paneli', 'SP-450M', true, false),
    ('sonyachna-panel-550w-mono', 'Сонячна панель 550 Вт монокристалічна',
     'Панель підвищеної потужності.',
     'Монокристалічна панель 550 Вт для великих дахових масивів — менше панелей на той самий обсяг генерації.',
     'sonyachni-paneli', 'SP-550M', false, false),
    ('sonyachna-panel-600w-bifacial', 'Сонячна панель 600 Вт бі-фаціальна',
     'Генерація з обох сторін панелі.',
     'Бі-фаціальна панель 600 Вт: додаткова генерація від відбитого світла з тильної сторони, до +15% річної віддачі.',
     'sonyachni-paneli', 'SP-600B', true, false),
    ('invertor-merezhevyi-5kw', 'Мережевий інвертор 5 кВт',
     'On-grid інвертор для мережевих систем.',
     'Мережевий інвертор 5 кВт із ККД до 98%, доступний в однофазному та трифазному виконанні.',
     'invertory', 'INV-5K', true, true),
    ('invertor-gibrydnyi-8kw', 'Гібридний інвертор 8 кВт',
     'Робота з мережею та акумулятором одночасно.',
     'Гібридний інвертор 8 кВт: автономна робота від акумулятора, підзарядка від мережі, підтримка резервного живлення.',
     'invertory', 'INV-8H', true, false),
    ('akumulyator-lifepo4-100ah', 'Акумулятор LiFePO4 100 Аг',
     'Літій-залізо-фосфатний акумулятор 100 Аг.',
     'LiFePO4-акумулятор 100 Аг, ресурс понад 6000 циклів, вбудована BMS. Доступний у чорному та сірому корпусі.',
     'akumulyatory', 'BAT-100', false, true),
    ('akumulyator-lifepo4-200ah', 'Акумулятор LiFePO4 200 Аг',
     'Літій-залізо-фосфатний акумулятор 200 Аг.',
     'LiFePO4-акумулятор 200 Аг для систем накопичення середньої потужності, ресурс понад 6000 циклів.',
     'akumulyatory', 'BAT-200', false, false),
    ('stantsiya-nakopychennya-10kwh', 'Домашня станція накопичення енергії 10 кВт·год',
     'Комплексне рішення для автономності дому.',
     'Домашня станція накопичення 10 кВт·год: акумулятор, інвертор і контролер в одному корпусі, підтримка резервного живлення.',
     'akumulyatory', 'ESS-10', true, false)
) as v(slug, name, short_description, description, section_slug, sku, is_featured, has_modifications)
join public.sections s on s.slug = v.section_slug
on conflict (slug) do nothing;

-- ── 3. Модифікації (варіанти двох товарів) ──────────────────────────────
insert into public.product_modifications (
  product_id, slug, name, sku, is_default, sort_order, stock_status, images
)
select p.id, v.slug, v.name, v.sku, v.is_default, v.sort_order, 'in_stock', '[]'::jsonb
from (
  values
    ('invertor-merezhevyi-5kw', 'odnofazny', 'Однофазний', 'INV-5K-1PH', true, 0),
    ('invertor-merezhevyi-5kw', 'tryfazny', 'Трифазний', 'INV-5K-3PH', false, 1),
    ('akumulyator-lifepo4-100ah', 'chornyi', 'Чорний корпус', 'BAT-100-BLK', true, 0),
    ('akumulyator-lifepo4-100ah', 'siryi', 'Сірий корпус', 'BAT-100-GRY', false, 1)
) as v(product_slug, slug, name, sku, is_default, sort_order)
join public.products p on p.slug = v.product_slug
on conflict (product_id, slug) do nothing;

-- ── 4. Ціни: товари без модифікацій (модифікація NULL) ──────────────────
insert into public.product_prices (price_type_id, product_id, modification_id, price, old_price)
select pt.id, p.id, null, v.price, v.old_price
from (
  values
    ('sonyachna-panel-450w-mono', 4800::numeric, null::numeric),
    ('sonyachna-panel-550w-mono', 5900::numeric, null::numeric),
    ('sonyachna-panel-600w-bifacial', 7200::numeric, 8100::numeric),
    ('invertor-gibrydnyi-8kw', 24500::numeric, null::numeric),
    ('akumulyator-lifepo4-200ah', 21000::numeric, null::numeric),
    ('stantsiya-nakopychennya-10kwh', 68000::numeric, 75000::numeric)
) as v(slug, price, old_price)
join public.products p on p.slug = v.slug
cross join (select id from public.price_types where code = 'retail' limit 1) pt
on conflict do nothing;

-- ── 5. Ціни: модифікації ─────────────────────────────────────────────────
insert into public.product_prices (price_type_id, product_id, modification_id, price, old_price)
select pt.id, m.product_id, m.id, v.price, null
from (
  values
    ('invertor-merezhevyi-5kw', 'odnofazny', 18300::numeric),
    ('invertor-merezhevyi-5kw', 'tryfazny', 21500::numeric),
    ('akumulyator-lifepo4-100ah', 'chornyi', 15400::numeric),
    ('akumulyator-lifepo4-100ah', 'siryi', 15600::numeric)
) as v(product_slug, mod_slug, price)
join public.products p on p.slug = v.product_slug
join public.product_modifications m on m.product_id = p.id and m.slug = v.mod_slug
cross join (select id from public.price_types where code = 'retail' limit 1) pt
on conflict do nothing;

-- ── 6. Властивості секцій ────────────────────────────────────────────────
insert into public.section_properties (section_id, name, slug, property_type, is_filterable, sort_order)
select s.id, v.name, v.slug, v.property_type::property_type, true, v.sort_order
from (
  values
    ('sonyachni-paneli', 'Потужність, Вт', 'potuzhnist', 'number', 0),
    ('sonyachni-paneli', 'Тип панелі', 'tip-paneli', 'select', 1),
    ('invertory', 'Тип інвертора', 'tip-invertora', 'select', 0)
) as v(section_slug, name, slug, property_type, sort_order)
join public.sections s on s.slug = v.section_slug
on conflict (section_id, slug) do nothing;

insert into public.section_property_assignments (section_id, property_id, applies_to)
select sp.section_id, sp.id, 'product'
from public.section_properties sp
where sp.slug in ('potuzhnist', 'tip-paneli', 'tip-invertora')
on conflict (section_id, property_id) do nothing;

-- ── 7. Опції для властивостей-списків ────────────────────────────────────
insert into public.property_options (property_id, name, slug, sort_order)
select sp.id, v.name, v.slug, v.sort_order
from (
  values
    ('tip-paneli', 'Монокристалічна', 'mono', 0),
    ('tip-paneli', 'Бі-фаціальна', 'bifacial', 1),
    ('tip-invertora', 'Мережевий (on-grid)', 'on-grid', 0),
    ('tip-invertora', 'Гібридний', 'hybrid', 1)
) as v(property_slug, name, slug, sort_order)
join public.section_properties sp on sp.slug = v.property_slug
on conflict (property_id, slug) do nothing;

-- ── 8. Значення властивостей товарів ────────────────────────────────────
insert into public.product_property_values (product_id, property_id, numeric_value)
select p.id, sp.id, v.numeric_value
from (
  values
    ('sonyachna-panel-450w-mono', 450::numeric),
    ('sonyachna-panel-550w-mono', 550::numeric),
    ('sonyachna-panel-600w-bifacial', 600::numeric)
) as v(product_slug, numeric_value)
join public.products p on p.slug = v.product_slug
join public.section_properties sp on sp.slug = 'potuzhnist'
on conflict (product_id, property_id) do nothing;

insert into public.product_property_values (product_id, property_id, option_id)
select p.id, sp.id, po.id
from (
  values
    ('sonyachna-panel-450w-mono', 'mono'),
    ('sonyachna-panel-550w-mono', 'mono'),
    ('sonyachna-panel-600w-bifacial', 'bifacial')
) as v(product_slug, option_slug)
join public.products p on p.slug = v.product_slug
join public.section_properties sp on sp.slug = 'tip-paneli'
join public.property_options po on po.property_id = sp.id and po.slug = v.option_slug
on conflict (product_id, property_id) do nothing;

insert into public.product_property_values (product_id, property_id, option_id)
select p.id, sp.id, po.id
from (
  values
    ('invertor-merezhevyi-5kw', 'on-grid'),
    ('invertor-gibrydnyi-8kw', 'hybrid')
) as v(product_slug, option_slug)
join public.products p on p.slug = v.product_slug
join public.section_properties sp on sp.slug = 'tip-invertora'
join public.property_options po on po.property_id = sp.id and po.slug = v.option_slug
on conflict (product_id, property_id) do nothing;

-- ── 9. Банери (унікального ключа в таблиці немає — ґард по title) ────────
insert into public.banners (title, subtitle, image_url, placement, section_id, sort_order, is_active, buttons)
select
  'Сонячна енергія для вашого дому',
  'Комплектні рішення: панелі, інвертори, накопичувачі.',
  '/demo/banners/solar-home.jpg',
  'home',
  null,
  0,
  true,
  '[{"label": "До каталогу", "href": "/catalog"}]'::jsonb
where not exists (
  select 1 from public.banners where title = 'Сонячна енергія для вашого дому'
);

insert into public.banners (title, subtitle, image_url, placement, section_id, sort_order, is_active, buttons)
select
  'Знижки на бі-фаціальні панелі',
  'До -15% на серію 600 Вт цього місяця.',
  '/demo/banners/bifacial-sale.jpg',
  'home',
  s.id,
  1,
  true,
  '[{"label": "Переглянути", "href": "/catalog/sonyachni-paneli"}]'::jsonb
from public.sections s
where s.slug = 'sonyachni-paneli'
  and not exists (
    select 1 from public.banners where title = 'Знижки на бі-фаціальні панелі'
  );
