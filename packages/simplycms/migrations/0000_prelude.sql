-- 0000_prelude.sql — передумови baseline v2 (рішення B5″/B13).
--
-- Іде ПЕРШИМ і не генерується drizzle-kit: той емітить лише таблиці, енами,
-- індекси й політики, але не схеми, не функції й не ролі. А без них
-- `0001_init.sql` не накотиться взагалі: його політики посилаються на
-- `app.current_user_id()`, а речення `TO "app_user"` — на роль.
--
-- Ідемпотентність — обовʼязкова: файл котиться і на чисту БД, і повторно
-- (ролі в PostgreSQL кластерні, тож друга БД того самого кластера побачить
-- їх уже наявними).

-- ── Схема службових хелперів ────────────────────────────────────────────────
create schema if not exists app;

-- ── Читач актора ───────────────────────────────────────────────────────────
-- Єдине джерело «хто зараз діє» для RLS. GUC `app.user_id` виставляє
-- транзакційна обгортка `withActor` (`simplycms/db`, Task 6) через
-- `set_config(..., true)` — тобто значення живе рівно до COMMIT.
--
-- 🔴 SECURITY INVOKER (дефолт) — навмисно: SECURITY DEFINER без внутрішнього
-- гарда і був тим класом дірок, який B5″ прибирає. `search_path = ''`
-- знімає підміну через схему користувача; `pg_catalog` резолвиться неявно,
-- тож `current_setting` і тип `uuid` лишаються видимими.
--
-- `true` другим аргументом `current_setting` — «немає такого GUC ⇒ NULL, а
-- не помилка»: анонім не виставляє нічого, і політика мусить дати FALSE,
-- а не впасти.
create or replace function app.current_user_id() returns uuid
  language sql
  stable
  set search_path = ''
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- ── Ролі ───────────────────────────────────────────────────────────────────
-- Три ролі, жодна з BYPASSRLS і жодна не власник таблиць (власник —
-- міграційна роль деплою, під якою котиться цей файл).
--
--   app_runtime — та, під якою застосунок ЛОГІНИТЬСЯ в БД. Прямих грантів
--                 не має свідомо: забутий `SET LOCAL ROLE` дає
--                 `permission denied`, а не тихий обхід RLS (fail-closed;
--                 другий тихий режим відмови, відтворений спайком B5).
--   app_user    — права звичайного відвідувача/покупця; під нею працюють
--                 політики `TO app_user`.
--   app_admin   — адмінські мутації; вмикається лише ПІСЛЯ типізованої
--                 перевірки в TS (перший рубіж B5″).
--
-- Гранти по таблицях і сиквенсах — `0002_grants.sql` (Task 4).
-- 🔴 `app_runtime` — NOINHERIT, і це не стиль. З INHERIT (дефолт PostgreSQL)
-- членство віддавало б права `app_user` БЕЗ `SET ROLE` — тобто забутий
-- `SET LOCAL ROLE` знову працював би тихо, і весь fail-closed дизайн
-- зводився б нанівець. Права мусять зʼявлятись лише явним перемиканням.
--
-- 🔴 Атрибути приводяться до канону й тоді, коли роль уже є, а не тільки при створенні.
-- Ідемпотентність «if not exists ⇒ пропустити» лишає стару роль із чужими атрибутами: ролі в
-- PostgreSQL кластерні, тож у кластері з попереднім життям `app_user` цілком може вже існувати
-- з LOGIN. Канон описує ФОРМУ ролі, а не факт її наявності — інакше він нічого не гарантує
-- (спіймано на харнесі 2026-08-23).
-- 🔴 Тому роль накату — SUPERUSER: міняти атрибути SUPERUSER/BYPASSRLS (і в `no…`-бік) Postgres
-- дозволяє лише суперкористувачу, а щойно створена роль (без LOGIN) канону не відповідає, тож
-- `alter role` нижче на свіжому кластері виконується завжди. Керовані Postgres лише з CREATEROLE
-- не підтримуються (`docs/development/ENVIRONMENT.md`).
-- 🔴 Але `alter role`/`grant` — ЛИШЕ коли стан відрізняється від канону: рядок ролі живе в
-- спільному каталозі кластера (`pg_authid`), і безумовний запис у ньому з двох паралельних
-- накатів на різні БД того самого кластера дає `tuple concurrently updated`. Повторний накат на
-- підготовленому кластері в каталог ролей не пише нічого.
do $$
begin
  -- Пароль тут не задається: секрет живе в оточенні деплою, а не в
  -- закоміченому SQL. Деплой доробляє `alter role app_runtime password …`.
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_admin') then
    create role app_admin;
  end if;

  if exists (select 1 from pg_roles where rolname = 'app_runtime'
      and not (rolcanlogin and not rolinherit and not rolbypassrls
               and not rolsuper and not rolcreatedb and not rolcreaterole)) then
    alter role app_runtime login noinherit nobypassrls nosuperuser nocreatedb nocreaterole;
  end if;
  if exists (select 1 from pg_roles where rolname = 'app_user'
      and (rolcanlogin or rolinherit or rolbypassrls
           or rolsuper or rolcreatedb or rolcreaterole)) then
    alter role app_user nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole;
  end if;
  if exists (select 1 from pg_roles where rolname = 'app_admin'
      and (rolcanlogin or rolinherit or rolbypassrls
           or rolsuper or rolcreatedb or rolcreaterole)) then
    alter role app_admin nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole;
  end if;
end
$$;

-- Членство: `SET LOCAL ROLE app_user|app_admin` дозволене лише члену.
--
-- 🔴 `WITH INHERIT FALSE, SET TRUE` — не дублювання атрибута NOINHERIT вище, а
-- ДРУГА його половина. З PostgreSQL 16 успадкування — властивість САМОГО
-- членства (`pg_auth_members.inherit_option`), і за замовчуванням воно
-- береться з `rolinherit` члена НА МОМЕНТ гранта. У кластері з попереднім
-- життям (ролі кластерні, а членство переживає `drop database`) рядок міг
-- бути створений, коли `app_runtime` ще була INHERIT, — і повторний голий
-- `grant` його НЕ виправляє: він бачить членство наявним і мовчить. Наслідок
-- рівно той, який весь цей дизайн виключає: `app_runtime` дістає права
-- `app_user` без `SET LOCAL ROLE`, забутий `SET LOCAL ROLE` знову працює
-- тихо, і fail-closed зникає, не червонячи жодного гейта.
-- `SET TRUE` виписано явно, бо саме воно й дозволяє `SET LOCAL ROLE`.
-- Спіймано поведінковим гейтом RLS на харнесі 2026-08-23 (Task 5).
-- Грант — лише коли ВЛАСНОГО членства з потрібними опціями ще немає. «Власне» = рядок
-- `pg_auth_members` того грантора, яким Postgres запише цей `grant`; лише цей рядок `grant` з
-- опціями й оновлює. Чому не безумовно: тотожний повторний `grant` нічого не пише, але бере
-- `ShareUpdateExclusiveLock` на групову роль (`app_user`/`app_admin`) до коміту файлу, а цей замок
-- конфліктує сам із собою — паралельні накати на різні БД одного кластера серіалізувались би на
-- ролі (аж до `lock timeout`). Членство від ІНШИХ гранторів умова не читає й не виправляє (`grant`
-- чужого рядка не чіпає): чуже членство з INHERIT знімає fail-closed, сигнал про нього —
-- `doctor --online` (М5), див. `docs/architecture/data-layer.md` §1.
-- Евристика грантора (суперкористувач → бутстрап-суперкористувач, OID 10; інакше —
-- `current_user`) — правило PG 16+ (проєкт вимагає PG 17). Помилиться вона (напр. ADMIN
-- успадковано від іншої ролі) — «свого» рядка умова не знайде, і `grant` піде щоразу, тобто
-- деградує до безумовного `grant`, а не до відмови чи пропуску.
-- Читаються лише `pg_roles` і `pg_auth_members` — без секретів (`pg_authid`).
do $$
declare
  me oid := case when (select rolsuper from pg_roles where rolname = current_user)
               then 10 else (select oid from pg_roles where rolname = current_user) end;
begin
  if not exists (select 1 from pg_auth_members
      where roleid = 'app_user'::regrole and member = 'app_runtime'::regrole
        and grantor = me and not inherit_option and set_option) then
    grant app_user to app_runtime with inherit false, set true;
  end if;
  if not exists (select 1 from pg_auth_members
      where roleid = 'app_admin'::regrole and member = 'app_runtime'::regrole
        and grantor = me and not inherit_option and set_option) then
    grant app_admin to app_runtime with inherit false, set true;
  end if;
end
$$;

-- Доступ до самого хелпера — обом акторським ролям: предикат політики
-- обчислюється правами того, хто читає таблицю.
grant usage on schema app to app_runtime, app_user, app_admin;
grant execute on function app.current_user_id() to app_runtime, app_user, app_admin;
