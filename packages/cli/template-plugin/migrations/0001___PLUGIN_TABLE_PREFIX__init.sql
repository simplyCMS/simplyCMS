-- Власна таблиця плагіна. Межа даних — префікс plg_<name>_ (спека §7/§9).
--
-- 🔴 Імʼя ФАЙЛА теж несе плейсхолдер: після скаффолду це
-- `0001_plg_<name>_init.sql`, а не `0001_init.sql`. Інакше воно збіглося б
-- із baseline ядра, і `simplycms db:diff` зупинився б на колізії канонів
-- (одне імʼя, різний вміст), не скопіювавши в магазин навіть міграцій ядра.
create table if not exists __PLUGIN_TABLE_PREFIX__items (
  -- 🔴 Без DEFAULT: ключ генерує клієнт (crypto.randomUUID()) і шле в
  -- insert. Інакше оптимістичний рядок і серверний розійдуться ключами.
  id uuid primary key,
  title text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
