-- Таблиця референс-плагіна faq (@simplycms/plugin-faq).
--
-- Межі спеки §7/§9 демонстративно дотримані:
--  * таблиця лише з префіксом plg_faq_ — чужих таблиць міграція не чіпає;
--  * product_id — link-поле БЕЗ foreign key у чужу таблицю products
--    (модель Medusa Module Links: звʼязок за значенням, не за FK);
--  * RLS-політики — лише на власну таблицю; is_admin() — публічна функція
--    ядра, дозволена до використання плагінами.
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

alter table public.plg_faq_items enable row level security;

-- Конвенція ядра: публічно видно лише активні записи; неактивні бачить
-- адмін (permissive-політики обʼєднуються через OR із політикою нижче).
create policy "plg_faq_items are viewable by everyone"
  on public.plg_faq_items
  for select
  using (is_active = true or public.is_admin());

create policy "plg_faq_items are managed by admins"
  on public.plg_faq_items
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Тримає updated_at чесним; update_updated_at_column() — публічний хелпер
-- ядра (та сама функція, що на core-таблицях).
create trigger update_plg_faq_items_updated_at
  before update on public.plg_faq_items
  for each row
  execute function public.update_updated_at_column();
