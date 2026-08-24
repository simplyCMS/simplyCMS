-- 0003_seed.sql — довідники ЧИСТОГО магазину (рішення B13).
--
-- 🔴 Це не демо-дані. Тут рівно той мінімум, без якого порожня БД не здатна
-- прийняти першого власника й показати вітрину: статуси замовлень, мова,
-- тип ціни, категорія покупця, дві системні налаштування і рядок активної
-- теми. Товари, розділи, банери, точки самовивозу й тарифи доставки —
-- робота адміна, а не міграції.
--
-- Ідемпотентність обовʼязкова: файл котиться і на чисту БД, і повторно
-- (докат канону в магазині, що вже стартував). Скрізь `on conflict do
-- nothing` по природному унікальному ключу.

-- ── Статуси замовлень ──────────────────────────────────────────────────────
-- `code` — контракт із кодом воронки покупки; назви й кольори адмін міняє.
insert into public.order_statuses (name, code, color, sort_order, is_default)
values
  ('Новий', 'new', '#3B82F6', 0, true),
  ('Підтверджено', 'confirmed', '#10B981', 1, false),
  ('В обробці', 'processing', '#F59E0B', 2, false),
  ('Відправлено', 'shipped', '#8B5CF6', 3, false),
  ('Доставлено', 'delivered', '#22C55E', 4, false),
  ('Скасовано', 'cancelled', '#EF4444', 5, false)
on conflict (code) do nothing;

-- ── Мова ───────────────────────────────────────────────────────────────────
-- Магазин стартує україномовним (дефолт ядра); англійську додає адмін.
insert into public.languages (code, name, is_default, is_active)
values ('uk', 'Українська', true, true)
on conflict (code) do nothing;

-- ── Тип ціни ───────────────────────────────────────────────────────────────
-- 🔴 Хоча б один `is_default` мусить існувати: `product_prices` посилається
-- на тип, і без нього товар неможливо завести взагалі.
insert into public.price_types (name, code, is_default, sort_order)
values ('Роздрібна', 'retail', true, 0)
on conflict (code) do nothing;

-- ── Категорія покупця ──────────────────────────────────────────────────────
-- Тією ж причиною: профіль створюється з категорією за замовчуванням
-- (хук BA `user.create.after`, Task 7), а прайс-логіка бере з неї тип ціни.
insert into public.user_categories (name, code, is_default, price_type_id)
select
  'Роздріб',
  'retail',
  true,
  (select id from public.price_types where code = 'retail')
on conflict (code) do nothing;

-- ── Системні налаштування ──────────────────────────────────────────────────
insert into public.system_settings (key, value, description)
values
  ('active_theme', '"default"'::jsonb, 'Активна тема сайту'),
  (
    'stock_management',
    '{"decrease_on_order": false}'::jsonb,
    'Налаштування управління залишками'
  )
on conflict (key) do nothing;

-- ── Активна тема ───────────────────────────────────────────────────────────
-- Рядок у БД потрібен адмінці: вона читає список тем ЛИШЕ звідси, а модуль
-- теми приходить із конфігу магазину. `bootstrapThemes` дописав би його й
-- сам, але тоді чистий магазин до першого відкриття адмінки не мав би
-- активної теми взагалі.
insert into public.themes (name, display_name, version, description, author, is_active)
values (
  'default',
  'Default',
  '1.0.0',
  'Базова тема SimplyCMS',
  'SimplyCMS',
  true
)
on conflict (name) do nothing;
