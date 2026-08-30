-- Власна таблиця плагіна. Межа даних — префікс plg_<name>_ (спека §7/§9).
create table if not exists __PLUGIN_TABLE_PREFIX__items (
  -- 🔴 Без DEFAULT: ключ генерує клієнт (crypto.randomUUID()) і шле в
  -- insert. Інакше оптимістичний рядок і серверний розійдуться ключами.
  id uuid primary key,
  title text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
