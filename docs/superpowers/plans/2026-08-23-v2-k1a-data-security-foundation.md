# План імплементації: V2-К1а — фундамент даних і безпеки v2 (адитивна половина К1′)

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.
>
> **Ревізія 1 (2026-08-23):** написано за результатами стратегічної сесії
> власника: спайк B5 прожито наскрізь (33/33 міграції на чистому PG 16,
> потрійний збіг MD5 дампа політик, SECDEF під явною роллю, pgbouncer у
> transaction-mode), проведено живий аудит політик і привілеїв. Рішення
> зафіксовані амендментом 2026-08-23 у спеці — **B3′, B5″, B13**.

**Goal:** Побудувати фундамент бекенд-контракту v2 **адитивно**: нова
baseline-схема чистого магазину (Drizzle, без `auth.users`, з таблицями
Better Auth), ролі+гранти як код, RLS-ядро з поведінковим гейтом без
Docker, db-рантайм із транзакційною обгорткою актора, серверний Better
Auth, TS-домен категорійних правил. Чинний Supabase-шар НЕ зноситься —
це К1′б (окремий план після цього).

**Architecture:** Спека
[`2026-08-19-backend-contract-v2-design.md`](../specs/2026-08-19-backend-contract-v2-design.md),
рішення B1–B13 з амендментом 2026-08-23 (розширений склад К1′ — §4 п.1).
Нові субшляхи пакета ядра: `simplycms/db`, `simplycms/auth` (ПК4 спеки К0 —
нові пакети не створюються). Модель безпеки B5″: перший рубіж — typed authz
у TS; другий — ролі БД (`app_user`/`app_admin`, обидві nologin, видаються
через `SET LOCAL ROLE` рантайм-ролі без прямих грантів — fail-closed) +
RLS-ядро лише на user-scoped таблицях, читач GUC — `app.current_user_id()`.

**Tech Stack:** drizzle-orm 0.45 / drizzle-kit 0.31 (уже в репо), `pg` 8
(уже в devDeps), better-auth (пін точної версії, НОВА залежність), локальний
PostgreSQL 16/17 без Docker (харнес), pgbouncer-сумісність доведена спайком.

**Spec:** [`2026-08-19-backend-contract-v2-design.md`](../specs/2026-08-19-backend-contract-v2-design.md)
(B3′/B5″/B13, §4-К1′). Роадмап: [`platform-roadmap.md`](../../tasks/platform-roadmap.md).

## Global Constraints

- 🔴 **Адитивність:** жодного знесення чинних Supabase-шляхів у ЦЬОМУ плані.
  `simplycms/supabase`, GoTrue-флоу, `supabase/types.ts`, `database.ts`,
  admin-guard у `start.ts` — живуть як є до К1′б. Єдиний дозволений «знос» —
  тека `supabase/migrations/` та її прямі споживачі (B13, Task 3) і старий
  `rls-parity` (замінюється новим гейтом, Task 2→5).
- 🔴 **Живу БД `alterenergy` НЕ ЧІПАТИ** (рішення власника 2026-08-23):
  жодних записів, жодних накатів; MCP — лише читання, і лише якщо треба
  щось довірити (еталон уже знято, потреби немає).
- 🔴 **Гейти після КОЖНОЇ задачі** канонічним порядком:
  `pnpm install --frozen-lockfile → format:check → lint → build → typecheck
  → test → build:packages → typecheck:template → test:packaging`; якщо
  задача міняла manifest-и — спершу `pnpm install` (регенерація lockfile).
  Після Task 4+ — додатково `pnpm test:schema`. `pnpm pilot:pack` — після
  Task 3 і Task 9 (він без БД, мусить лишатись зеленим).
- 🔴 **PG-харнес:** основний шлях — `PG_HARNESS_URL` (готовий кластер: CI
  service-контейнер `postgres:17`, або локальний інстанс розробника);
  фолбек — ефемерний кластер `initdb`+`pg_ctl` (🔴 не працює від root —
  через `su postgres`/runuser, де є непривілейований користувач). Пін
  мажора: гейт парності політик асертить `server_version` 17 (фікстура
  еталона знята з 17; на 16 збіг перевірено, але між мажорами
  `pg_get_expr` не гарантований — розбіжність версії має падати з ясним
  повідомленням, не з дифом політик).
- 🔴 **Негативні контролі обовʼязкові** (Task 5): без них поведінковий тест
  зелений і брехливий — виміряно спайком (урок №4 роадмапу).
- 🔴 **better-auth — пін точної версії** (B3: CVE-поверхня), мінімум
  плагінів; `pg`/`drizzle-orm` версії не бампати в цьому плані.
- Коментарі українською; TS strict 5.9; файли ≤150 рядків; нові кириличні
  UI-рядки — лише через i18n-каталоги (тут UI не очікується).
- 🔴 Схемна робота НЕ йде через `supabase db push`/MCP `apply_migration` —
  все локально: drizzle-kit + харнес.

## Довідка якорів (звірено 2026-08-23; розходження → довіряй коду)

- Supabase-фабрики: `packages/simplycms/src/supabase/server-client.ts:28`,
  `anon-client.ts:23`, `browser-client.ts:12,25`, `SupabaseProvider.tsx:21,48`,
  `keys.ts:27`; споживачі — `src/server/engine.ts:33`, `src/start.ts:47`.
- `auth.users`: реекспорт `packages/simplycms/src/schema/auth-users.ts`
  (`usersInAuth` з `drizzle-orm/supabase`); FK у `schema.ts` — `userRoles:121`,
  `wishlists:142`, `comparisons:164`, `serviceRequests:414`, `profiles:633`,
  `orders:791`; дзеркала в `relations.ts:58,64,78,104,170,236,309`.
- `handle_new_user`: остання редакція —
  `supabase/migrations/20260804082403_first_user_no_auto_admin.sql`
  (перший signup НЕ адмін; admin — лише owner-invite або наявний адмін).
- Owner-invite: `packages/create-simplycms-store/template/scripts/owner-invite-core.mjs:9-53`
  (`inviteUserByEmail`/`listUsers`/`generateLink`).
- RPC із клієнта (9 викликів, 7 імен; всі шляхи від
  `packages/simplycms/src/`): `get_stock_info`
  (`packages/simplycms/src/data-supabase/catalogRepository.ts:168`,
  `packages/simplycms/src/storefront-routes/pages/product-detail/useModificationData.ts:84`,
  `packages/simplycms/src/core/hooks/useStock.ts:28`),
  `check_all_users_category_rules`
  (`packages/simplycms/src/admin/pages/UserCategoryRules.tsx:114-116`),
  `get_user_stats` / `toggle_user_admin` / `admin_update_user_category`
  (`packages/simplycms/src/admin/pages/UserEdit.tsx:137,170,197`),
  `get_active_pickup_points_count`
  (`packages/simplycms/src/core/hooks/useStock.ts:72`),
  `get_product_ratings`
  (`packages/simplycms/src/core/hooks/useProductReviews.ts:196`).
- Тулчейн: `packages/simplycms/drizzle.config.ts` (читає `DATABASE_URL`,
  `schemaFilter: ['public']`), `scripts/db-diff.mjs` (drizzle-kit generate →
  копія в `supabase/migrations/`), `scripts/db-migrate.mjs:29-36` (Supabase
  CLI — помре в К1′б/К6′), `packages/simplycms/scripts/dump-rls.mjs:13-16`
  (`DATABASE_URL`, прямий `pg`).
- Інвентар живого еталона (знято 2026-08-23): 40 таблиць public, 8 енамів
  (`app_role`, `discount_*`×3, `property_type`, `shipping_*`×2,
  `stock_status`), 17 функцій; з них тригерно-механічні
  (`update_updated_at_column`, `generate_order_number`,
  `generate_guest_order_access_token`, `validate_review_rating`) — кандидати
  жити в baseline; бізнесові (`check_category_rules`,
  `check_all_users_category_rules`, `check_category_on_order_complete`,
  `decrease_stock_on_order`, `get_user_stats`, `admin_update_user_category`,
  `toggle_user_admin`, `get_stock_info`, `get_product_ratings`,
  `get_active_pickup_points_count`) — НЕ їдуть у baseline (виводяться в TS;
  до К2/К3 клієнт кличе їх на СТАРОМУ стеку, який цей план не чіпає);
  `is_admin`/`has_role` — помирають разом з адмін-політиками (B5″).

---

### Task 1: PG-харнес і гейт `test:schema` (інфраструктура)

**Files:**
- Create: `packages/simplycms/test-harness/pg/up.mjs` (резолв
  `PG_HARNESS_URL` → інакше ефемерний `initdb`+`pg_ctl`; повертає URL і
  teardown), `packages/simplycms/test-harness/pg/apply.mjs` (накат
  SQL-файлів по порядку, `ON_ERROR_STOP`), `vitest.schema.config.ts` (root),
  перший смоук `packages/simplycms/test-harness/pg/__tests__/harness.test.ts`
  (кластер доступний, `select version()`).
- Modify: `package.json` (root: скрипт `test:schema`),
  `.github/workflows/workflow.yml` (новий job `schema`: service-контейнер
  `postgres:17`, `PG_HARNESS_URL` в env; за прецедентом окремого job
  `packaging`), `vitest.config.ts` (виключити `test-harness/**/__tests__` з
  дефолтного прогону — гейт із передумовою живе окремим конфігом, та сама
  логіка, що з packaging-suite), `.env.example` (документувати
  `PG_HARNESS_URL` як опційний dev-ключ).

**Interfaces:**
- Produces: `test:schema` — окремий гейт, що потребує Postgres і НЕ
  потребує Docker локально; у CI — services-контейнер.

- [x] **Step 1:** `up.mjs`: якщо `PG_HARNESS_URL` заданий — перевірити
      конект і віддати як є; інакше ефемерний кластер у tmp-теці
      (`initdb --no-sync`, `pg_ctl -o '-p <вільний порт> -k <сокет-тека>'`);
      від root — явна помилка з підказкою про `su postgres`/`PG_HARNESS_URL`.
- [x] **Step 2:** `apply.mjs` + смоук-тест; `vitest.schema.config.ts` за
      зразком `vitest.packaging.config.ts`.
- [x] **Step 3:** CI job `schema` у `workflow.yml`; переконатись, що job
      `test` НЕ підхоплює нові тести (exclude).
- [x] **Step 4:** гейти канонічним порядком; `test:schema` зелений локально
      (фолбек-гілка) — у цьому середовищі через `su postgres`.

### Task 2: Схема v2 у Drizzle (B3′ + B5″ + бандли амендменту)

**Files:**
- Modify: `packages/simplycms/src/schema/schema.ts` (ядро задачі),
  `packages/simplycms/src/schema/relations.ts`.
- Create: `packages/simplycms/src/schema/auth.ts` (таблиці Better Auth:
  `users`/`sessions`/`accounts`/`verifications`, uuid-PK),
  `packages/simplycms/src/schema/media.ts` (таблиця медіа-метаданих К4).
- Delete: `packages/simplycms/src/schema/auth-users.ts` (реекспорт
  `usersInAuth` — помирає разом із схемою GoTrue),
  `packages/simplycms/src/schema/__tests__/rls-parity.test.ts` +
  `__tests__/fixtures/rls-policies.json` (текстова парність зі старим
  еталоном; поведінкова заміна — Task 5).

**Interfaces:**
- Produces: `schema.ts` описує ЦІЛЬОВУ модель v2: 40 доменних таблиць +
  auth-таблиці BA + медіа-метадані; FK шести таблиць → `users.id`;
  RLS-ядро ~20–25 політик (лише user-scoped таблиці зі списку B5″,
  initplan-форма `(select app.current_user_id())`, WITH CHECK, політики
  `to app_admin` — `using(true)`); admin/public-політики НЕ відтворюються
  (їх роботу робять гранти). B7-поля комерції (повернення/доставка для
  JSON-LD) — у відповідних таблицях. Індекси: під предикати політик
  (user_id-колонки), 32 FK-індекси еталона; 14 мертвих — не відтворювати.

- [x] **Step 1:** інвентаризація поточної `schema.ts` (1026 рядків) —
      зафіксувати список таблиць/енамів, що переносяться як є.
- [x] **Step 2:** `auth.ts` (BA-таблиці, uuid; конфіг генерації id — на
      боці BA у Task 7) + `media.ts` (entity_type/entity_id/storage_key/
      size_bytes/uploaded_by; іммутабельність власності — інваріант,
      стережеться поведінковим тестом у Task 5, не тригером).
- [x] **Step 3:** FK-retarget шести таблиць (якорі в довідці) + дзеркала в
      `relations.ts`; видалити `auth-users.ts`.
- [x] **Step 4:** RLS-ядро: переписати політики user-scoped таблиць у
      initplan-формі на `app.current_user_id()`; guest-orders кейс —
      політика читання за `app.order_token` GUC (заміна edge-функції
      `get-guest-order` — сам serverFn буде в К1′б/К2); решту політик НЕ
      переносити.
- [x] **Step 5:** B7-поля + індекси; `pnpm lint`/`typecheck`/`test` зелені
      (rls-parity уже видалений, нічого не порівнює).

### Task 3: Baseline + сід чистого магазину + перекомутація тулчейна (B13)

**Files:**
- Create: `packages/simplycms/migrations/0001_init.sql` (генерат drizzle-kit
  зі схеми Task 2 + ролі/гранти з Task 4 — фінальний порядок вирішується
  тут), `packages/simplycms/migrations/0002_seed.sql` (довідники чистого
  магазину: `order_statuses`, `languages`, `price_types`, `system_settings`,
  рядок теми default; ідемпотентний), `packages/simplycms/migrations/README.md`
  (канон: baseline+сід, плагінні `plg_*` докочуються поверх).
- Delete: `supabase/migrations/` (33 файли), стара канон-копія в
  `packages/simplycms/migrations/` (дзеркало 33 файлів).
- Modify: `scripts/db-diff.mjs` (ціль копії — нова канон-тека; знімання
  Supabase-специфіки), `packages/simplycms/scripts/dump-rls.mjs` (приймати
  URL харнеса), `scripts/sync-create-store-template.mjs` +
  `tests/create-store-template-parity.test.ts` (парність проти нового
  канону), `tests/cli-*` де асертяться канони міграцій,
  `scripts/db-migrate.mjs` (позначити decommissioned: явна помилка з
  поясненням «стек v2, використовуй міграції з канону» — знос у К1′б).

**Interfaces:**
- Produces: канон міграцій = `0000_prelude` + `0001_init` + `0002_grants` +
  `0003_seed`; `simplycms db:diff` рахує від baseline; жоден дефолтний гейт
  не посилається на видалені файли.

- [x] **Step 1:** згенерувати `0001_init` (drizzle-kit проти снапшотів);
      руками НЕ дописувати (виняток — блок ролей/грантів із Task 4, якщо
      порядок вимагатиме одного файлу: тоді явний маркер-коментар).
      🔴 Фактично файлів ЧОТИРИ, а не два: drizzle-kit не емітить схем,
      функцій і ролей, тож передумови винесені в `0000_prelude.sql` (перед
      генератом — політики `0001` посилаються на `app.current_user_id()` і
      на роль `app_user`), гранти — в `0002_grants.sql` (плейсхолдер
      Task 4), сід — у `0003_seed.sql`. `0001_init.sql` лишається
      байт-генератом без ручного дописування.
- [x] **Step 2:** накат усього канону на харнес — зелено, без шима
      (у baseline немає `auth.users`/`storage.*` — це і є доказ B13).
      Гейт — `test-harness/pg/__tests__/baseline.test.ts` (`test:schema`).
- [x] **Step 3:** видалення старої теки + перекомутація всіх споживачів
      (список у Files; повний радіус звірити orient-ом на місці).
- [x] **Step 4:** `pnpm pilot:pack` зелений; `pilot:e2e`/`db:migrate` —
      задокументовано як decommissioned-до-К6′ (роадмап, Task 9).

### Task 4: Ролі + гранти як код + гейт парності привілеїв

**Files:**
- Create: `packages/simplycms/migrations/roles.sql` (або блок у `0001_init`
  — рішення Task 3): `app_runtime` (login, БЕЗ прямих грантів),
  `app_user`/`app_admin` (nologin, `GRANT ... TO app_runtime`), функція
  `app.current_user_id()` (читач GUC `app.user_id`), явні GRANT-и по
  таблицях/сиквенсах для кожної ролі; `packages/simplycms/test-harness/pg/__tests__/grants-parity.test.ts`.

**Interfaces:**
- Produces: привілейна поверхня — код у репо під гейтом (дамп
  `information_schema.role_table_grants` + EXECUTE-ACL функцій ↔ очікування
  з файлу). Fail-closed за побудовою: забутий `SET LOCAL ROLE` під
  `app_runtime` = `permission denied`, а не тихий обхід RLS.

- [x] **Step 1:** спроектувати мінімальні набори: `app_user` — SELECT
      каталог/довідники + CRUD своїх user-scoped рядків; `app_admin` — повний
      CRUD доменних таблиць; жодного BYPASSRLS, жодного OWNER.
      🔴 Уточнення до формулювання «повний CRUD»: для RLS-таблиць набір
      команд гранта дорівнює ОБʼЄДНАННЮ команд політик тієї ж ролі —
      більше було б мертвим привілеєм, менше — мертвою політикою. Тому
      `orders`/`order_items` під `app_user` — лише SELECT+INSERT,
      `profiles` — SELECT+UPDATE, а `comparisons`/`wishlists` під
      `app_admin` не видані взагалі (політик на них немає). Розходження
      двох шарів асертить окремий кейс гейта.
      Сиквенсів у baseline немає (усі PK — uuid), тож блок `GRANT USAGE ON
      SEQUENCE` порожній — і цей факт теж під гейтом.
- [x] **Step 2:** гейт парності привілеїв у `test:schema`
      (`test-harness/pg/__tests__/grants-parity.test.ts` + декларація
      очікувань `__tests__/fixtures/grants.ts`, знімання стану —
      `test-harness/pg/introspect.mjs` через `aclexplode`).
- [x] **Step 3:** негативна перевірка: під `app_runtime` без `SET LOCAL ROLE`
      будь-який SELECT доменної таблиці — `permission denied`; поруч —
      позитивний контроль (той самий SELECT після `SET LOCAL ROLE app_user`
      проходить), інакше відмова не доводила б причини.

### Task 5: Поведінкова матриця RLS + негативні контролі (новий rls-гейт)

**Files:**
- Create: `packages/simplycms/test-harness/pg/__tests__/rls-behaviour.test.ts`
  (матриця «актор × таблиця × операція» по user-scoped таблицях: анонім /
  користувач A / користувач B / адмін / guest-token; WITH CHECK на чужий
  `user_id`; іммутабельність колонок власності `media`),
  `.../__tests__/rls-parity.test.ts` (нова текстова парність: дамп
  `pg_policies` з харнеса ↔ політики `schema.ts` — замикає ланцюг
  «baseline ↔ схема», який раніше тримався на живій БД).
  Фактично додано ще чотири файли-помічники (кожен ≤110 рядків):
  `test-harness/pg/actors.mjs` (транзакційна форма актора — тестова копія
  контракту, а не імпорт рантайму), `test-harness/pg/policies.mjs` (дамп
  `pg_policy` + нормалізація предикатів схеми ПРОБНОЮ політикою на тому ж
  сервері — інакше `pg_get_expr` довелося б звіряти з фікстурою, привʼязаною
  до мажора), `test-harness/pg/schema-policies.ts` (витяг політик із
  `getTableConfig`, а не парсинг тексту),
  `__tests__/fixtures/rls-actors.ts` (актори й дані матриці).
- Modify: `packages/simplycms/migrations/0000_prelude.sql` +
  дзеркало в `template/` (`pnpm template:sync`) — див. Step 2.

**Interfaces:**
- Produces: гейт, що червоніє на реальній помилці політики, а не на дрейфі
  тексту. 🔴 Три негативні контролі обовʼязкові: (1) та сама транзакція без
  `SET LOCAL ROLE` → `permission denied` (fail-closed дизайну Task 4);
  (2) роль із BYPASSRLS бачить чуже — тест-доказ, що матриця вимірює RLS;
  (3) `set_config(…, false)` — claims переживають COMMIT (доказ, чому
  `withActor` зобовʼязаний ставити `local=true`).

- [x] **Step 1:** фікстурні актори + мінімальні дані (не сід магазину —
      власні рядки тесту).
- [x] **Step 2:** матриця + негативні контролі; `pnpm test:schema` зелений.
      🔴 Негативний контроль №1 одразу знайшов РЕАЛЬНИЙ дефект канону, а не
      підтвердив дизайн: `0000_prelude.sql` виставляв атрибут NOINHERIT ролі,
      але не опції ЧЛЕНСТВА. З PostgreSQL 16 успадкування — властивість
      самого членства (`pg_auth_members.inherit_option`), і на кластері з
      попереднім життям (ролі кластерні, членство переживає `drop database`)
      `app_runtime` діставала права `app_user` БЕЗ `SET LOCAL ROLE` — тобто
      fail-closed зникав мовчки, не червонячи жодного гейта. Полагоджено
      `grant … with inherit false, set true` (ідемпотентно оновлює наявне
      членство); структурний асерт членства — у самому контролі.
- [x] **Step 3:** перевірити, що зміна предиката будь-якої політики в
      `schema.ts` без регенерації baseline червонить парність (жива
      перевірка гейта — один навмисний диф, відкат). Зроблено: предикат
      `wishlists_own_all` → `user_id is not null` дав червоний із точним
      іменем політики; після відкату — зелено. Так само перевірено
      чутливість усіх трьох негативних контролів (кожен тимчасово зламано —
      червонів рівно свій кейс — і повернуто).

### Task 6: db-рантайм — `simplycms/db` (клієнт, пул, withActor)

**Files:**
- Create: `packages/simplycms/src/db/{index.ts,client.ts,with-actor.ts}`
  (фабрика server-only: `pg.Pool` з `process.env.DATABASE_URL` У РАНТАЙМІ —
  контракт env §7 чинний; `withActor({userId?, role, orderToken?}, fn)` —
  транзакція + `set_config('app.user_id', …, true)` + `SET LOCAL ROLE` +
  drizzle-інстанс над клієнтом транзакції), `__tests__/with-actor.test.ts`
  (інтеграційні через харнес: ізоляція A/B, скидання після COMMIT).
- Modify: `packages/simplycms/package.json` (exports `./db`; `pg` і
  `drizzle-orm` — у runtime-залежності за контуром: `pg` перестає бути
  суто dev), `packages/simplycms/tsup.config.ts` (node-профіль для db),
  `eslint.config.mjs` (нова error-зона: імпорт `simplycms/db/client` поза
  `with-actor`/фабриками заборонений — зʼєднання ЛИШЕ через `withActor`;
  негативний контроль за зразком `tests/tier-boundary.test.ts`),
  `eslint.tier-zones.mjs` (тір T2 для `db`).

**Interfaces:**
- Produces: єдиний канал до Postgres для всього майбутнього
  serverFn-шару; обидва тихі режими відмови виключені машинно
  (`local=true` зашито; голий клієнт — лінт-помилка).

- [ ] **Step 1:** клієнт+пул+withActor ≤150 рядків/файл, server-only гард
      (за зразком `server-client.ts`).
- [ ] **Step 2:** інтеграційні тести через харнес у `test:schema`-контурі.
- [ ] **Step 3:** лінт-зона + негативний контроль; повні гейти + packaging
      (новий export у tarball-parity).

### Task 7: Better Auth — `simplycms/auth` (сервер, без перемикання клієнта)

**Files:**
- Create: `packages/simplycms/src/auth/{index.ts,instance.ts,hooks.ts,authz.ts}`:
  інстанс BA (drizzleAdapter над схемою Task 2, uuid-генерація id,
  email/password, cookie-сесії), `databaseHooks.user.create.after` —
  створення `profiles`+`user_roles` (порт логіки з
  `20260804082403_first_user_no_auto_admin.sql`: перший signup НЕ адмін;
  admin — лише invite/наявний адмін), invite власника (заміна механіки
  `owner-invite-core.mjs`: server-side invite + токен; лист — колбек,
  рендер тестовний юнітом, SMTP-доставка — борг оточення), authz-хелпери
  (`requireRole`, матриця «роль × операція», 🔴 місце під вимір scope
  `own`/`any` — дизайн-насіння зі спеки §8, не реалізація);
  `__tests__` (memory-адаптер: signUp/session/revoke/невірний пароль;
  харнес: повний цикл + звʼязка з `withActor` — id сесії → claims → RLS).
- Modify: `packages/simplycms/package.json` (dependency `better-auth` —
  точний пін; exports `./auth`), lockfile.

**Interfaces:**
- Produces: робочий серверний auth-контур, ще НЕ підключений до
  `start.ts`/роутів (це К1′б). DoD спеки «BA тестується без Docker» —
  фактом (memory-адаптер).

- [ ] **Step 1:** `pnpm install` (нова залежність) → далі frozen-ланцюг.
- [ ] **Step 2:** інстанс + хуки + юніти на memory-адаптері.
- [ ] **Step 3:** інтеграція: signUp на харнесі → сесія → `withActor` з
      claims сесії → RLS віддає лише свої рядки (замикання «сесія→RLS»).
- [ ] **Step 4:** authz-хелпери + тести матриці; повні гейти.

### Task 8: Категорійні правила — з plpgsql у TS-домен

**Files:**
- Create: `packages/simplycms/src/domain/user-categories/{engine.ts,types.ts}`
  + `__tests__` (порт логіки `check_category_rules` з
  `supabase/migrations/20260204155230_*.sql` — з git-історії після Task 3:
  правила з пріоритетами, умови по статистиці покупця, історія переходів).

**Interfaces:**
- Produces: чиста T1-логіка (нуль runtime deps — тір `domain`), готова до
  вживання serverFn-ами К3. UI-перемикання (`UserCategoryRules.tsx`,
  `UserEdit.tsx` — RPC-виклики) — НЕ тут: клієнт до К3 живе на старому
  стеку. Найнебезпечніша діра старого стека (unguarded SECDEF) структурно
  не існує в baseline v2 (функцій просто немає — Task 3).

- [ ] **Step 1:** порт логіки + вичерпні юніти (оператори умов, пріоритети,
      «без переходу», історія).
- [ ] **Step 2:** повні гейти.

### Task 9: Типи з Drizzle (частина B12) + документація + роадмап

**Files:**
- Create: `packages/simplycms/src/schema/types.ts` (експорт
  `$inferSelect`/`$inferInsert` доменних таблиць — нове джерело типів для
  serverFn-шару К2/К3).
- Modify: `packages/simplycms/src/supabase/README.md` і
  `packages/simplycms/src/schema/README.md` (розмежування: legacy-типи
  `database.ts`/`supabase/types.ts` — заморожені до К1′б, нове — з Drizzle),
  `docs/tasks/platform-roadmap.md` (відмітки виконання, decommissioned-
  список), `docs/architecture/test-contours.md` (новий контур
  `test:schema` — що доводить, що ні).

**Interfaces:**
- Produces: єдине джерело типів для НОВОГО коду; чесна карта меж тестування.

- [ ] **Step 1:** типи + компіляційні тести (expectTypeOf на 2-3 таблицях).
- [ ] **Step 2:** доки + роадмап; повні гейти + `pnpm pilot:pack`.

---

## Поза цим планом (щоб виконавець не розширював скоуп)

- **К1′б (точка неповернення):** admin-guard на BA-сесіях, перемикання
  auth-роутів клієнта, знос `simplycms/supabase`-фабрик і GoTrue-флоу,
  `.env`-контракт без `VITE_SUPABASE_*` — окремий план після цього
  (тягне мінімальний зріз К2, бо вітрина мусить жити).
- Storage-порт `delete`/`transform` і драйвери local-fs/s3 — К4 (таблиця
  метаданих уже готова з Task 2).
- Переписування адмінки/вітрини, serverFn-шар, колекції — К2/К3.
- Борги оточення (доводяться лише у власника): browser-e2e на refresh
  cookie, SMTP-доставка invite-листа, живий прогін проти реального стека.
