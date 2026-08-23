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
-- 🔴 Атрибути виставляються БЕЗУМОВНО, а не тільки при створенні. Ідемпотентність
-- «if not exists ⇒ пропустити» лишає стару роль із чужими атрибутами: ролі в
-- PostgreSQL кластерні, тож у кластері з попереднім життям `app_user` цілком
-- може вже існувати з LOGIN. Канон описує ФОРМУ ролі, а не факт її наявності —
-- інакше він нічого не гарантує (спіймано на харнесі 2026-08-23).
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

  alter role app_runtime login noinherit nobypassrls nosuperuser nocreatedb nocreaterole;
  alter role app_user nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole;
  alter role app_admin nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole;
end
$$;

-- Членство: `SET LOCAL ROLE app_user|app_admin` дозволене лише члену.
grant app_user to app_runtime;
grant app_admin to app_runtime;

-- Доступ до самого хелпера — обом акторським ролям: предикат політики
-- обчислюється правами того, хто читає таблицю.
grant usage on schema app to app_runtime, app_user, app_admin;
grant execute on function app.current_user_id() to app_runtime, app_user, app_admin;
