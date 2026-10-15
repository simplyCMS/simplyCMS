-- Власна таблиця плагіна. Межа даних — префікс plg_<name>_ (спека §7/§9).
--
-- 🔴 Імʼя ФАЙЛА теж несе плейсхолдери: після скаффолду це
-- `<YYYYMMDDHHmmss>_plg_<name>_init.sql` (UTC на момент скаффолду), а не
-- `0001_init.sql`. Префікс `plg_<name>_` — інакше імʼя збіглося б із baseline
-- ядра, і `simplycms db:diff` зупинився б на колізії канонів (одне імʼя,
-- різний вміст). Таймстамп, а не `0001_` — інакше за сортуванням файл ліг би
-- між `0001_init` і `0002_grants`, а `0002_grants` робить `revoke all on all
-- tables … from public`: таблиця плагіна втратила б гранти мовчки.
create table if not exists __PLUGIN_TABLE_PREFIX__items (
  -- 🔴 Без DEFAULT: ключ генерує клієнт (crypto.randomUUID()) і шле в
  -- insert. Інакше оптимістичний рядок і серверний розійдуться ключами.
  id uuid primary key,
  title text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Вітрина читає таблицю плагіна під `app_user`.
grant select on table __PLUGIN_TABLE_PREFIX__items to app_user;

-- Адмінка плагіна пише під `app_admin`.
grant select, insert, update, delete on table __PLUGIN_TABLE_PREFIX__items to app_admin;
