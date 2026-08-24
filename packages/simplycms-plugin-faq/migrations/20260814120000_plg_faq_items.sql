-- Таблиця референс-плагіна faq (@simplycms/plugin-faq).
--
-- Межі спеки §7/§9 демонстративно дотримані:
--  * таблиця лише з префіксом plg_faq_ — чужих таблиць міграція не чіпає;
--  * product_id — link-поле БЕЗ foreign key у чужу таблицю products
--    (модель Medusa Module Links: звʼязок за значенням, не за FK).
--
-- 🔴 Модель доступу — B5″ (контракт v2): права дають ГРАНТИ ролям
-- `app_user`/`app_admin`, а не RLS з `public.is_admin()`. Функції
-- `is_admin()` і `update_updated_at_column()` у канон-схемі v2 більше немає:
-- ідентичність приходить із серверної сесії, а роль транзакції вмикає
-- `withActor`. Плагін, який спробує повторити стару форму, дістане помилку
-- накату — і це правильно, бо мовчазна тиша означала б таблицю без прав.
create table if not exists public.plg_faq_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid,
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Читає вітрина (роль аноніма й покупця — та сама `app_user`). Видимість за
-- `is_active` — правило показу, тож фільтрує ЗАПИТ, як і в каталозі ядра.
grant select on table public.plg_faq_items to app_user;

-- Пише лише адмінський контур: порт SDK вмикає `app_admin` після серверної
-- перевірки ролі, тож іншого шляху до цих команд немає.
grant select, insert, update, delete on table public.plg_faq_items to app_admin;
