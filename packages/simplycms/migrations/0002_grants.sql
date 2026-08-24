-- 0002_grants.sql — привілейна поверхня як код (рішення B5″, Task 4).
--
-- 🔴 Причина існування файлу. Живий аудит 2026-08-23 показав у репо НУЛЬ
-- GRANT-ів: 280 табличних грантів на дві ролі й EXECUTE на 13 SECDEF-функціях
-- існували виключно як неявний дефолт платформи Supabase. Тобто привілейну
-- поверхню — найчутливіший шар доступу — ніхто свідомо не обирав, вона не
-- проходила ревʼю і жоден гейт її не бачив. Тут вона стає текстом під гейтом
-- (`grants-parity.test.ts`).
--
-- 🔴 Правило, за яким складено матрицю: ГРАНТ каже, ЯКІ ОПЕРАЦІЇ роль сміє
-- робити з таблицею, RLS — над ЯКИМИ РЯДКАМИ. Для RLS-таблиць набір команд
-- гранта дорівнює обʼєднанню команд політик ТІЄЇ Ж ролі: більше — мертвий
-- привілей (право є, політики немає), менше — мертва політика. Обидва
-- розходження червонять гейт.
--
-- 🔴 Чого тут свідомо НЕМАЄ:
--   • грантів ролі `app_runtime` — вона лише LOGIN-роль, права дістає через
--     `SET LOCAL ROLE app_user|app_admin`. Забутий `SET LOCAL ROLE` дає
--     `permission denied`, а не тихий обхід RLS: це і є fail-closed (другий
--     тихий режим відмови, відтворений спайком B5);
--   • будь-якого `GRANT … TO PUBLIC`;
--   • `ALTER DEFAULT PRIVILEGES … GRANT …` — автогрант майбутнім таблицям
--     повернув би рівно ту дірку, яку цей файл закриває: нова таблиця
--     отримувала б права мовчки, повз ревʼю. Кожна таблиця вписується руками.

-- ── 1. Закрити мовчазні дефолти Postgres ───────────────────────────────────
-- `public` за замовчуванням дає USAGE ролі PUBLIC, а кожна нова функція —
-- EXECUTE ролі PUBLIC. Саме цей дефолт робив SECDEF-функції старого стека
-- викличними ким завгодно. Знімаємо і для наявних обʼєктів, і для майбутніх.
--
-- ALTER DEFAULT PRIVILEGES діє на обʼєкти, створені ПОТОЧНОЮ роллю, — тобто
-- міграційною роллю деплою, під якою котиться канон. Це рівно та роль, що
-- створює й майбутні таблиці (`simplycms db:diff`), тож покриття повне.
--
-- 🔴 TYPES свідомо не чіпаємо: на вже створені енами ALTER DEFAULT PRIVILEGES
-- не діє (ретроактивності немає), а майбутнім енамам зняття USAGE у PUBLIC
-- тихо зламало б INSERT під `app_user`. Тип — не канал доступу до даних.
revoke all on schema public from public;
revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from public;
revoke all on all functions in schema public from public;
revoke all on all functions in schema app from public;

alter default privileges in schema public revoke all on tables from public;
alter default privileges in schema public revoke all on sequences from public;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema app revoke execute on functions from public;

-- ── 2. Доступ до схем ──────────────────────────────────────────────────────
-- USAGE на схему сам по собі не дає жодного доступу до даних, тож
-- fail-closed для `app_runtime` зберігається: без `SET LOCAL ROLE` вона
-- впирається в `permission denied` уже на таблиці.
grant usage on schema public to app_runtime, app_user, app_admin;

-- Повтор гранта з `0000_prelude.sql` — свідомий: цей файл має читатись як
-- ПОВНИЙ зріз привілеїв, інакше ревʼюер мусить тримати в голові два місця.
grant execute on function app.current_user_id() to app_runtime, app_user, app_admin;

-- ── 3. app_user: каталог і довідники (читання вітрини) ─────────────────────
-- Вітрину бачить і анонім: він працює під тією ж `app_user`, просто без
-- GUC `app.user_id`. RLS на цих таблицях не ввімкнено — фільтрація за
-- `is_active` переїхала в запити (TS), бо це правило показу, а не безпеки.
grant select on table
  public.banners,
  public.discount_conditions,
  public.discount_groups,
  public.discount_targets,
  public.discounts,
  public.languages,
  public.modification_property_values,
  public.order_statuses,
  public.pickup_points,
  public.plugins,
  public.price_types,
  public.product_modifications,
  public.product_prices,
  public.product_property_values,
  public.products,
  public.property_options,
  public.section_properties,
  public.section_property_assignments,
  public.sections,
  public.services,
  public.shipping_methods,
  public.shipping_rates,
  public.shipping_zones,
  public.stock_by_pickup_point,
  public.system_settings,
  public.themes,
  public.user_categories
to app_user;

-- ── 4. app_user: власні рядки (звуження до своїх — робота RLS) ─────────────
grant select, insert, update, delete on table
  public.comparisons,
  public.product_reviews,
  public.user_addresses,
  public.user_recipients,
  public.wishlists
to app_user;

-- Замовлення не редагуються покупцем: скасування чи зміна — серверна
-- операція під `app_admin` (політик UPDATE/DELETE для `app_user` немає).
grant select, insert on table public.orders, public.order_items to app_user;

-- Профіль створює хук Better Auth (Task 7) під `app_admin`; покупець його
-- лише читає й редагує.
grant select, update on table public.profiles to app_user;

-- Заявку сміє лишити будь-хто (політика INSERT — `true`), бачити — лише свою.
grant select, insert on table public.service_requests to app_user;

-- Тільки читання: роль і історію категорії призначає система, не покупець.
grant select on table public.user_roles, public.user_category_history to app_user;

-- 🔴 `media` — SELECT + INSERT без UPDATE/DELETE. Незмінність колонок
-- власності (`entity_type`/`entity_id`/`storage_key`/`uploaded_by`) тримається
-- саме ВІДСУТНІСТЮ права, а не тригером: перепривʼязати чужий файл до своєї
-- сутності неможливо, бо команди немає (див. коментар у `schema/media.ts`).
grant select, insert on table public.media to app_user;

-- ── 5. app_admin: доменні таблиці адмінки ──────────────────────────────────
-- Вмикається лише ПІСЛЯ типізованої перевірки в TS (перший рубіж B5″).
grant select, insert, update, delete on table
  public.banners,
  public.category_rules,
  public.discount_conditions,
  public.discount_groups,
  public.discount_targets,
  public.discounts,
  public.languages,
  public.media,
  public.modification_property_values,
  public.order_items,
  public.order_statuses,
  public.orders,
  public.pickup_points,
  public.plugin_events,
  public.plugins,
  public.price_types,
  public.product_modifications,
  public.product_prices,
  public.product_property_values,
  public.product_reviews,
  public.products,
  public.profiles,
  public.property_options,
  public.section_properties,
  public.section_property_assignments,
  public.sections,
  public.service_requests,
  public.services,
  public.shipping_methods,
  public.shipping_rates,
  public.shipping_zones,
  public.stock_by_pickup_point,
  public.system_settings,
  public.themes,
  public.user_categories,
  public.user_category_history,
  public.user_roles
to app_admin;

-- Адреси й отримувачів адмін лише ЧИТАЄ (потрібно для обробки замовлення);
-- політик на запис для нього немає — грант це дзеркалить.
grant select on table public.user_addresses, public.user_recipients to app_admin;

-- 🔴 `comparisons` і `wishlists` адміну не видані взагалі: політик `app_admin`
-- на них немає, а список бажань покупця адмінці не потрібен ні для чого.

-- ── 6. Таблиці Better Auth ─────────────────────────────────────────────────
-- Читає й пише їх ЛИШЕ серверний auth-контур (Task 7) — покупець не сміє
-- бачити ні чужі сесії, ні хеші паролів, ні власний рядок `users` (його
-- публічна частина живе в `profiles`).
--
-- 🔴 Роль тут `app_admin` тому, що четвертої ролі контракт v2 не передбачає
-- (B5″ фіксує рівно `app_user`/`app_admin`). Наслідок, який Task 7 мусить
-- тримати вузьким: auth-операції — окремий короткий серверний шлях, а не
-- привід відкривати `app_admin` анонімному запиту загалом.
grant select, insert, update, delete on table
  public.users,
  public.sessions,
  public.accounts,
  public.verifications
to app_admin;

-- ── 7. Сиквенси ────────────────────────────────────────────────────────────
-- Їх у baseline немає: усі первинні ключі — `uuid` з `gen_random_uuid()`.
-- Тому й `GRANT USAGE ON SEQUENCE` тут порожній — це не пропуск, а факт
-- схеми, і він асертиться гейтом (поява сиквенса без гранта червонить).
