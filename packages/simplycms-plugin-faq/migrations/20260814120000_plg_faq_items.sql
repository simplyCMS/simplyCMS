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

create policy "plg_faq_items are viewable by everyone"
  on public.plg_faq_items
  for select
  using (true);

create policy "plg_faq_items are managed by admins"
  on public.plg_faq_items
  for all
  using (public.is_admin())
  with check (public.is_admin());
