# V2-К3 · Етап Е1б: серверний шар адмінки і перша колекція — РЕДАКЦІЯ 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дати адмінці серверний шар і довести весь механізм на одній сутності наскрізь — від `defineAdminResource` (операції + схеми) через явні топ-рівневі serverFn до живої сторінки на `useLiveQuery` з оптимістичними мутаціями й машинними гейтами.

**Architecture:** `admin-server` (T2) — єдиний, хто торкається БД: фабрика `defineAdminResource` віддає **plain async-операції** і **Zod-схеми** (drizzle-zod, server-side), а кожен serverFn оголошується **явним топ-рівневим `const`** (~4–6 рядків/сутність) — цього вимагає компілятор Start (К3-4′). Authz — наявні `requireOperation`+`dbRoleForSubject` через склейку `resolveRequestGrant`, строго ДО `withActor` (К3-13). `admin-data` (T4) тримає колекції TanStack DB **без `schema`** (тип — type-only з `simplycms/schema/types`, К3-9′), memoізовані по `QueryClient`, з ключами з реєстру `ENTITY`. Інваріант «дефолт рівно один» тримає БД частковими unique-індексами (К3-14) + іменовані операції.

**Tech Stack:** `@tanstack/react-db` 0.3.6 + `@tanstack/query-db-collection` 1.2.11 (обидва пінять `@tanstack/db` 0.8.6) · `drizzle-zod` 0.8.3 · TanStack Start 1.167 · TanStack Query 5.101 · Drizzle 0.45.2 · Zod 4.4.3 · TypeScript 5.9 strict · Vitest 4

**Spec:** [`2026-08-29-v2-k3-admin-server-layer-design.md`](../specs/2026-08-29-v2-k3-admin-server-layer-design.md) — 🔴 **читати З РЕВІЗІЄЮ 2026-08-31** (К3-4′, К3-9′, К3-10′, К3-13, К3-14); доказова база ревізії — [`2026-08-31-k3-e1b-redesign-research.md`](../research/2026-08-31-k3-e1b-redesign-research.md).

**Попередня редакція цього плану** (2026-08-30) відхилена подвійним аудитом (Codex REJECT + оркестратор): центральна конструкція «фабрика віддає CRUD-serverFn» нереалізовна компілятором Start; повний перелік дефектів — research-док §6. Git-історія файлу тримає стару редакцію.

**Обсяг:** друга половина Е1. Після неї **одна сторінка адмінки жива** на чистому Postgres. Решта сутностей — Е3 (каталог on-demand) і Е4–Е6 (хвилі); storage — Е2.

## Global Constraints

- TypeScript 5.9 strict; **не** оновлювати до 6/7.
- Коментарі й документація — **українською**; рядки інтерфейсу — тільки через i18n-каталоги.
- `pnpm lint` = **0 errors**. 🔴 Кількість warnings НЕ асертиться (докі розходяться: CLAUDE.md — 12, AGENTS.md — 13; живий прогін 2026-09-01 — 12): перед Task 0 виміряти `pnpm lint`, зафіксувати число в DoD-звіті, і воно не має зрости — усі warnings лише `react-hooks/*` і `no-unused-vars`.
- Порядок гейтів: `pnpm install --frozen-lockfile → format:check → lint → build → typecheck → test → test:schema → build:packages → typecheck:template → test:packaging`.
- `install --frozen-lockfile` — **перший** і не пропускається після будь-якої правки `package.json`.
- 🔴 **К3-4′:** `createServerFn` — ЛИШЕ топ-рівневий `const` з простим ідентифікатором. Фабрики serverFn не повертають. Гейт — Task 4.
- 🔴 **К3-9′:** модуль із serverFn експортує лише serverFn; операції/схеми — server-side; клієнт — type-only типи, колекції БЕЗ `schema`.
- 🔴 **К3-13:** порядок у кожній операції — `requireGrant(op)` → `withActor({ role: dbRoleForSubject(subject), userId })`. 403 — `setResponseStatus(403)` ДО `throw`; `Response` не кидати; клієнт розрізняє `error.name === 'AuthzError'`.
- 🔴 **Write-back замість self-invalidation:** persistence-хендлер пише результат сервера `writeUpsert`/`writeBatch` і повертає `{ refetch: false }`. Хендлери обробляють **усі** `transaction.mutations`, не `[0]`.
- `id` для Категорії A генерує клієнт (`crypto.randomUUID()`); fail-loud при `serverRow.id !== optimisticId` ДО write-back.
- 🔴 `queryKey` колекції = `entityKey(ENTITY.х).list()` — той самий префікс, що в решти запитів сутності.
- Кожен гейт має **негативний І позитивний** контроль, прогнаний вручну.
- 🔴 **Мінімальний гейт КОЖНОЇ задачі перед комітом: `pnpm lint && pnpm test`** (+ `test:schema`, якщо чіпала schema/migrations/harness). Урок Task 0 (знахідка сесії-імплементатора 2026-09-01): `pnpm test` не ганявся між Task 0 і Task 2, і червоний parity-тест прожив чотири задачі непоміченим.
- 🔴 **Інваріант `template:sync`:** задача, що чіпає джерела `SYNCED_DIRS` (`scripts/sync-create-store-template.mjs:63`: `packages/simplycms/migrations/`, `themes/default/`, `plugins/hello-world/`) або `SYNCED_FILES` (host-файли), зобовʼязана прогнати `pnpm template:sync` і закомітити копію в `packages/create-simplycms-store/template/` (+ `packages/cli/host/`) — інакше `tests/create-store-template-parity.test.ts` червоніє, а диф задачі цього не показує за побудовою (бракує файла, якого немає в дифі). В Е1б під це підпадає Task 0 (міграції) і Task 3 (host-файл); хвилі Е3–Е6 чіпатимуть теми.
- Тіри: `admin-server` = **T2** (upward-виняток `['db','auth']` — як у `storefront`), `admin-data` = **T4**, `admin` = T5.
- Коміти українською, `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Передумова оточення

```bash
export PG_HARNESS_URL='postgresql://pgtest@127.0.0.1:55433/postgres'
node -e "const pg=require('pg');const c=new pg.Client({connectionString:process.env.PG_HARNESS_URL});c.connect().then(()=>c.query('select 1')).then(()=>{console.log('OK');return c.end()}).catch(e=>{console.error('FAIL',e.message);process.exit(1)})"
```

🔴 Тести з `test-harness/**` — **тільки** через
`pnpm vitest run --config vitest.schema.config.ts <path>`; кореневий конфіг
цю теку виключає. Стенд — контейнер `simplycms-041-pg` (знімок, не контракт).

## Граф залежностей задач

```
Task 0 (baseline is_default) ─┐
Task 1 (deps-гейт + фікс deps)│  незалежні між собою
Task 2 (залежності npm)       │
Task 3 (RouterContext)        │
Task 4 (ESLint top-level)     ─┘
Task 5 (resolveRequestGrant) ← Task 4
Task 6 (subset + тір-зона)   ← Task 2
Task 7 (defineAdminResource) ← Task 5, Task 6
Task 8 (order_statuses: ops + serverFn + операції) ← Task 0, Task 7
Task 9 (admin-data: registry + колекція) ← Task 2, Task 8
Task 10 (сторінка + живий прогін) ← Task 3, Task 9
Task 11 (гейти кеш-синхронізації + Gate C + реєстр винятків + DoD) ← Task 10
```

## File Structure

**Створюються:**

| Файл | Відповідальність |
|---|---|
| `packages/simplycms/test-harness/pg/__tests__/aggregate-deps.test.ts` | Гейт повноти `deps`: перехоплення фактичного SQL, сценарії по гілках |
| `packages/simplycms/test-harness/pg/__tests__/single-default.test.ts` | Поведінковий контроль часткових unique-індексів (23505) |
| `packages/simplycms/test-harness/pg/__tests__/admin-order-statuses.test.ts` | Інтеграційні тести операцій `order_statuses` проти живої БД |
| `packages/simplycms/src/auth/authz-request.ts` | `resolveRequestGrant` + `requireGrant` (склейка сесія→scope, 403) |
| `packages/simplycms/src/auth/__tests__/authz-request.test.ts` | Юніти склейки (мок `@tanstack/react-start/server`) |
| `packages/simplycms/src/admin-server/subset.ts` | `SubsetInput` → Drizzle `where`/`orderBy` з allowlist; `subsetInputSchema` |
| `packages/simplycms/src/admin-server/resource.ts` | `defineAdminResource` — операції + схеми (БЕЗ serverFn) |
| `packages/simplycms/src/admin-server/resources/order-statuses.ts` | Ops першої сутності (server-only) |
| `packages/simplycms/src/admin-server/operations/order-status-default.ts` | `setDefaultOrderStatusOp` (інваріант) |
| `packages/simplycms/src/admin-server/operations/order-status-reorder.ts` | `reorderOrderStatusOp` (транзакційний swap) |
| `packages/simplycms/src/admin-server/operations/order-status-remove.ts` | `removeManyOrderStatusesOp` (атомарний guarded batch, FOR UPDATE) |
| `packages/simplycms/src/admin-server/index.ts` | 🔴 ЄДИНИЙ модуль serverFn: топ-рівневі const усіх functions сутності |
| `packages/simplycms/src/admin-server/__tests__/*.test.ts` | Юніти subset, фабрики, схем |
| `packages/simplycms/src/admin-data/registry.ts` | `CollectionDef<C>` + `getCollection`/`useCollection` (WeakMap, generic) |
| `packages/simplycms/src/admin-data/collections/order-statuses.ts` | Перша колекція (без `schema`, type-only `OrderStatus`) |
| `packages/simplycms/src/admin-data/index.ts` | Барель admin-data |
| `packages/simplycms/src/admin-data/__tests__/*.test.tsx` | Юніти реєстру і колекції (id-mismatch, batch) |
| `packages/simplycms/src/contracts/admin-server-first.ts` | Реєстр server-first винятків (К3-2) |
| `eslint-rules/server-fn-top-level.mjs` | Гейт К3-4′: `createServerFn` лише топ-рівнево |
| `eslint-rules/mutation-cache-sync.mjs` | Мутація в UI парує синк кешу |
| `tests/handler-canon.test.ts` | AST-гейт write-back у persistence-хендлерах |
| `tests/eslint-rules/server-fn-top-level.test.ts` | Машинні фікстури правила К3-4′ (Linter API, 8 кейсів) |
| `tests/eslint-rules/mutation-cache-sync.test.ts` | Машинні фікстури function-scope правила (Linter API, 10 кейсів) |
| `tests/tanstack-db-single-instance.test.ts` | Рівно один `@tanstack/db` у дереві |

**Змінюються:**

| Файл | Що саме |
|---|---|
| `packages/simplycms/migrations/0001_init.sql` | 🔴 ПРАВКА BASELINE (К3-14): 7 часткових unique-індексів `is_default` |
| `packages/simplycms/src/schema/schema.ts` | ті самі 7 індексів у Drizzle (дзеркало baseline) |
| `packages/simplycms/src/contracts/entities.ts` | `+ENTITY.pickupPoints` у deps `shippingDirectory` і `stockInfo` |
| `packages/simplycms/package.json` | peer: `@tanstack/react-db`, `@tanstack/query-db-collection` (вузько); deps: `drizzle-zod`; exports+publishConfig `./admin-server`, `./admin-data` |
| `packages/simplycms/src/runtime/index.ts` | `export type { RouterContext }` (без нового субшляху) |
| `packages/simplycms/src/runtime/router-context.ts` | сам тип (внутрішній модуль) |
| `packages/simplycms/src/auth/index.ts` | реекспорт `resolveRequestGrant`/`requireGrant`/`RequestGrant` |
| `packages/simplycms/tsup.config.ts` | профіль `admin-server` (splitting:false, entry `index.ts`); `admin-data` у `tiers` |
| `eslint.tier-zones.mjs` | зони `['src/admin-server',2,'admin-server',['db','auth']]` і `['src/admin-data',4,'admin-data',[]]` |
| `eslint.config.mjs` | підключення `server-fn-top-level` (глобально на ts/tsx пакета+host) і `mutation-cache-sync`; зона `query-key-from-entity` += `admin-data/**`; i18n-зона += `admin-data/**` |
| `tests/tier-boundary.test.ts` | негативний контроль двох нових зон |
| `packages/simplycms/src/admin/pages/OrderStatuses.tsx` | повне переписування на колекцію (create/update/delete/reorder/setDefault/тости) |
| `packages/simplycms/routes/admin/admin/order-statuses/index.tsx` | `loader` з `preload()` |
| `src/routes/__root.tsx` (+ канон `packages/cli/host`, шаблон через `template:sync`) | `RouterContext` реекспортом із `simplycms/runtime` |
| `packages/create-simplycms-store/template/package.json.tpl` | точні піни `@tanstack/react-db@0.3.6`, `@tanstack/query-db-collection@1.2.11` |
| `scripts/pilot-pack/gate-c.mjs` | stub-маркер `admin-server` (гейт не вхолосту; drizzle/pg-маркери вже стережуть витік) |

**Свідомо НЕ чіпаються:** решта 52 файли `src/admin/**` (хвилі Е3–Е6; ратчет `admin-inserts-need-id` і виїмка `admin/` у правилі ключів чинні), `handler-canon` BASELINE (порожній назавжди), сигнатури view-контракту тем.

---
# Частина 0 — фундамент (Tasks 0–4, незалежні)

**DoD частини 0:** `pnpm test:schema` зелений з новими індексами і deps-гейтом (負ативні контролі прогнані); `pnpm install --frozen-lockfile && pnpm lint && pnpm test` зелені; ESLint-гейт top-level доведений негативним контролем.

### Task 0: Часткові unique-індекси `is_default` — правка BASELINE (К3-14)

**Files:**
- Modify: `packages/simplycms/migrations/0001_init.sql`
- Modify: `packages/simplycms/src/schema/schema.ts`
- Modify: `packages/simplycms/drizzle/0000_init.sql` (🔴 4 джерела правди, не 2)
- Modify: `packages/simplycms/drizzle/meta/0000_snapshot.json`
- Create: `packages/simplycms/test-harness/pg/__tests__/single-default.test.ts`

**Interfaces:**
- Produces: інваріант «дефолтів НЕ БІЛЬШЕ одного» (at most one) на рівні БД
  для 7 таблиць — індекс забороняє ДВА `true`, не НУЛЬ; «принаймні один»
  (at least one) — контракт іменованих операцій (в Е1б — для
  `order_statuses`: setDefault + guarded remove; для решти таблиць —
  контракт їхніх хвиль, див. блок Legacy нижче).

🔴 **Форма — правка існуючого baseline, НЕ нова міграція** (уточнення
власника 2026-08-31, рамка B13: канон переписується, поки клієнтів немає).
Прецедент індексу — `idx_price_types_single_default` (`0001_init.sql:725`).

- [ ] **Step 1: Знайти точну форму прецеденту в обох джерелах**

```bash
grep -n "idx_price_types_single_default" packages/simplycms/migrations/0001_init.sql packages/simplycms/src/schema/schema.ts
```
Expected: рядок у SQL (`CREATE UNIQUE INDEX ... USING btree ("is_default" bool_ops) WHERE (is_default = true)`) і відповідний `uniqueIndex(...).where(...)` у Drizzle. Нові індекси — ТІЄЮ САМОЮ формою.

- [ ] **Step 2: Додати 7 індексів у `0001_init.sql`**

Кожен — поряд із `CREATE TABLE` своєї таблиці, глобальні:

```sql
CREATE UNIQUE INDEX "idx_order_statuses_single_default" ON "order_statuses" USING btree ("is_default" bool_ops) WHERE (is_default = true);
CREATE UNIQUE INDEX "idx_user_categories_single_default" ON "user_categories" USING btree ("is_default" bool_ops) WHERE (is_default = true);
CREATE UNIQUE INDEX "idx_languages_single_default" ON "languages" USING btree ("is_default" bool_ops) WHERE (is_default = true);
CREATE UNIQUE INDEX "idx_shipping_zones_single_default" ON "shipping_zones" USING btree ("is_default" bool_ops) WHERE (is_default = true);
```

scoped (дефолт «на батька»):

```sql
CREATE UNIQUE INDEX "idx_product_modifications_single_default" ON "product_modifications" USING btree ("product_id") WHERE (is_default = true);
CREATE UNIQUE INDEX "idx_user_addresses_single_default" ON "user_addresses" USING btree ("user_id") WHERE (is_default = true);
CREATE UNIQUE INDEX "idx_user_recipients_single_default" ON "user_recipients" USING btree ("user_id") WHERE (is_default = true);
```

🔴 **Legacy-шляхи запису НЕ адаптуються — вони мертві.** Стара адмінка
(`ProductModifications.tsx:111`, `ShippingZoneEdit.tsx:169`, …) пише
`is_default` без транзакційного unset, і під новим індексом такий шлях
падав би з `23505` — але на стеку v2 ці шляхи НЕ ВИКОНУЮТЬСЯ взагалі
(supabase-js без HTTP-посередника; 215 мертвих звернень — §1 спеки).
Індекс не ламає нічого працюючого. 🔴 КОНТРАКТ ХВИЛЬ Е3–Е6, який цим
встановлюється: сторінка таблиці з single-default індексом переписується
ЛИШЕ РАЗОМ зі своєю named setDefault-операцією (за зразком Task 8) —
інакше нова сторінка напореться на той самий `23505`. Продубльовано в
«Що НЕ входить».

🔴 Перед правкою звірити семантику кожної таблиці по чинному коду
(`rg "is_default" packages/simplycms/src --type ts -l`): якщо якась із
чотирьох «глобальних» насправді scoped — індекс міняється на scoped-форму,
рішення фіксується коментарем у SQL поруч з індексом.

- [ ] **Step 3: Ті самі 7 — у `schema.ts`** (дзеркало, форма з price_types)

- [ ] **Step 3б: Синхронізувати drizzle-baseline (канон data-access «❌ NEVER»)**

Точкова правка BASELINE — той самий виняток, що застосовано в Е0 і Е1а:
ті самі 7 індексів у `drizzle/0000_init.sql` і `drizzle/meta/0000_snapshot.json`
(форма — з наявного `idx_price_types_single_default` там же). Підтвердження
парності: `pnpm --filter simplycms exec drizzle-kit generate` мусить
відповісти **«No schema changes»** (якщо згенерував новий файл у `drizzle/`
— снапшот розсинхронений: полагодити снапшот, згенероване видалити).
Без цього кроку наступний `pnpm db:diff` дав би фантомну різницю.

- [ ] **Step 4: Накат канону і сідів**

```bash
pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/baseline.test.ts
```
Expected: PASS. Якщо `0003_seed.sql`/`demo-seed.sql` порушують новий
інваріант (два дефолти в одній із 7 таблиць) — накат впаде з `23505`;
тоді полагодити СІД (лишити один дефолт), не індекс.

- [ ] **Step 5: Поведінковий тест інваріанта**

```ts
// packages/simplycms/test-harness/pg/__tests__/single-default.test.ts
// (шапка resolveHarness/createTempDatabase/applySqlFiles(канон) — точна
// копія beforeAll/afterAll із baseline.test.ts; afterAll БЕЗ closeDbPool —
// цей тест не чіпає simplycms/db)
import { queryRows, queryInTransaction } from '../apply.mjs';

/**
 * 🔴 Параметризовано на ВСІ 7 індексів (рев'ю р3: два кейси доводили 2 з
 * 7, а `drizzle-kit generate` пропущений синхронно в усіх джерелах індекс
 * не помітить). NOT NULL-колонки — з 0001_init.sql кожної таблиці.
 *
 * 🔴 GLOBAL-кейс НЕ покладається на сід (перевірено: `shipping_zones` у
 * 0003_seed.sql відсутня взагалі, тож «другий» дефолт там пройшов би):
 * спершу reset (`is_default=false` усім), потім insert #1 (мусить пройти —
 * доводить, що індекс не заважає першому), потім insert #2 → 23505.
 * Коди — унікальні відносно сіду (UNIQUE code у languages/user_categories).
 */
const U1 = 'a0000000-0000-4000-8000-000000000001';
const U2 = 'a0000000-0000-4000-8000-000000000002';
const P1 = '10000002-0000-4000-8000-000000000001'; // товар демо-сіду (без модифікацій)
const P2 = '10000002-0000-4000-8000-000000000004'; // інвертор (має модифікації)

/** [таблиця, INSERT #1 (проходить), INSERT #2 (23505)]. */
const GLOBAL: Array<[table: string, first: string, second: string]> = [
  ['order_statuses',
    `insert into public.order_statuses (id, name, code, is_default) values (gen_random_uuid(), 'Дефолт 1', 'dflt-1', true)`,
    `insert into public.order_statuses (id, name, code, is_default) values (gen_random_uuid(), 'Дефолт 2', 'dflt-2', true)`],
  ['user_categories',
    `insert into public.user_categories (id, name, code, is_default) values (gen_random_uuid(), 'Дефолт 1', 'dflt-1', true)`,
    `insert into public.user_categories (id, name, code, is_default) values (gen_random_uuid(), 'Дефолт 2', 'dflt-2', true)`],
  ['languages',
    `insert into public.languages (id, code, name, is_default) values (gen_random_uuid(), 'zz1', 'Дефолт 1', true)`,
    `insert into public.languages (id, code, name, is_default) values (gen_random_uuid(), 'zz2', 'Дефолт 2', true)`],
  ['shipping_zones',
    `insert into public.shipping_zones (id, name, is_default) values (gen_random_uuid(), 'Дефолт 1', true)`,
    `insert into public.shipping_zones (id, name, is_default) values (gen_random_uuid(), 'Дефолт 2', true)`],
];

/** [таблиця, INSERT для батька A, INSERT для батька B, ДРУГИЙ INSERT для батька A]. */
const SCOPED: Array<[table: string, a: string, b: string, aAgain: string]> = [
  ['user_recipients',
    `insert into public.user_recipients (id, user_id, first_name, last_name, phone, city, address, is_default) values (gen_random_uuid(), '${U1}', 'А', 'А', '+380000000001', 'Київ', 'вул. Тестова, 1', true)`,
    `insert into public.user_recipients (id, user_id, first_name, last_name, phone, city, address, is_default) values (gen_random_uuid(), '${U2}', 'Б', 'Б', '+380000000002', 'Львів', 'вул. Тестова, 2', true)`,
    `insert into public.user_recipients (id, user_id, first_name, last_name, phone, city, address, is_default) values (gen_random_uuid(), '${U1}', 'В', 'В', '+380000000003', 'Київ', 'вул. Тестова, 3', true)`],
  ['user_addresses',
    `insert into public.user_addresses (id, user_id, name, city, address, is_default) values (gen_random_uuid(), '${U1}', 'Дім', 'Київ', 'вул. Тестова, 1', true)`,
    `insert into public.user_addresses (id, user_id, name, city, address, is_default) values (gen_random_uuid(), '${U2}', 'Дім', 'Львів', 'вул. Тестова, 2', true)`,
    `insert into public.user_addresses (id, user_id, name, city, address, is_default) values (gen_random_uuid(), '${U1}', 'Офіс', 'Київ', 'вул. Тестова, 3', true)`],
  ['product_modifications',
    `insert into public.product_modifications (id, product_id, slug, name, is_default) values (gen_random_uuid(), '${P1}', 'dflt-a', 'A', true)`,
    // 🔴 P2 у демо-сіді ВЖЕ має дефолтну модифікацію — тут вставка з
    // is_default=false лише доводить, що індекс не заважає не-дефолтам.
    `insert into public.product_modifications (id, product_id, slug, name, is_default) values (gen_random_uuid(), '${P2}', 'extra-b', 'B', false)`,
    `insert into public.product_modifications (id, product_id, slug, name, is_default) values (gen_random_uuid(), '${P1}', 'dflt-a2', 'A2', true)`],
];

describe('К3-14: інваріант is_default тримає БД (усі 7 індексів)', () => {
  beforeAll(async () => {
    // Демо-сід — для товарів (P1/P2); користувачі — власна фікстура.
    await applySqlFiles(dbUrl, [DEMO_SEED]);
    await queryRows(dbUrl, `insert into public.users (id, name, email, email_verified)
      values ('${U1}', 'А', 'a@t.test', true), ('${U2}', 'Б', 'b@t.test', true)`);
  });

  it.each(GLOBAL)('%s: перший дефолт проходить, другий — 23505', async (table, first, second) => {
    await queryRows(dbUrl, `update public.${table} set is_default = false where is_default`);
    await queryRows(dbUrl, first); // індекс не заважає єдиному дефолту
    await expect(queryRows(dbUrl, second)).rejects.toMatchObject({ code: '23505' });
  });

  it.each(SCOPED)('%s: різні батьки — можна, той самий — 23505', async (_table, a, b, aAgain) => {
    await queryRows(dbUrl, a);
    await queryRows(dbUrl, b);
    await expect(queryRows(dbUrl, aAgain)).rejects.toMatchObject({ code: '23505' });
  });
});
```

(`DEMO_SEED` — той самий шлях, що в `aggregate-deps.test.ts`.)

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/single-default.test.ts`
Expected: PASS 7/7. **Негативний контроль:** тимчасово прибрати ОДИН
індекс (напр. `idx_languages_single_default`) з `0001_init.sql` → рівно
той кейс FAIL (не 23505) → повернути.

- [ ] **Step 6: Синк шаблону, повний контур і коміт**

🔴 `packages/simplycms/migrations/` — джерело `template:sync` (копія в
шаблоні магазину під парність-тестом у `pnpm test`). Без синку
`tests/create-store-template-parity.test.ts` червоніє, а диф Task 0 цього
не показує (бракує файла). Знахідка імплементації 2026-09-01.

```bash
pnpm template:sync
pnpm test:schema && pnpm lint && pnpm test
git add packages/simplycms/migrations packages/simplycms/src/schema packages/simplycms/drizzle packages/simplycms/test-harness packages/create-simplycms-store/template
git commit -m "feat(v2-k3): інваріант is_default — 7 часткових unique-індексів у baseline

К3-14 (амендмент 2026-08-31): за прецедентом idx_price_types_single_default
закрито всі таблиці патерну — 4 глобальні + 3 scoped. Правка baseline, не
міграція (B13). Інваріант тримали два нетранзакційні запити з браузера —
тепер другий дефолт відбиває БД кодом 23505.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 1: Гейт повноти `deps` — сценарії по гілках + фікс двох агрегатів

**Files:**
- Create: `packages/simplycms/test-harness/pg/__tests__/aggregate-deps.test.ts`
- Modify: `packages/simplycms/src/contracts/entities.ts` (deps двох агрегатів)

**Interfaces:**
- Consumes: `AGGREGATE`/`ENTITY` (Е1а); `withStorefrontDb`/`withCustomerDb` і внутрішні лоадери з `simplycms/storefront/loaders`; харнес `resolveHarness`/`applySqlFiles`/`queryRows`/`withUser`; `closeDbPool` із `simplycms/db`.
- Produces: доказ повноти `deps` кожного агрегату — Е3 будує інвалідацію саме з них.

🔴 **Дві відомі вади, які гейт мусить зловити першим прогоном** (перевірено
читанням коду, research-док §5): `pickup_points` читають і
`loadShippingDirectory` (`shipping.ts:70`), і `loadStockInfo`
(`stock-info.ts:72-75`, innerJoin) — в `deps` обох його немає.
**Порядок TDD тут навмисний:** спершу гейт (він ЧЕРВОНИЙ на цих двох),
потім фікс `entities.ts` → зелений.

🔴 **Конвенція викликів:** serverFn-обгортки в харнесі НЕ викликаються
(`getRequest()` без ALS падає — `price-type.ts:35`, `discounts.ts:47`;
конвенція зафіксована коментарем `storefront-client-queries.test.ts:1-6`).
Кличемо ЛИШЕ внутрішні лоадери під `withStorefrontDb`/`withCustomerDb`.

- [ ] **Step 1: Написати гейт**

```ts
// packages/simplycms/test-harness/pg/__tests__/aggregate-deps.test.ts
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import pg from 'pg';
import { AGGREGATE, ENTITY } from 'simplycms/contracts/entities';
import { closeDbPool } from 'simplycms/db';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles, createTempDatabase, dropTempDatabase,
  queryRows, randomDbName, withDbName, withUser,
} from '../apply.mjs';

const MIGRATIONS = join(import.meta.dirname, '../../../migrations');
const canonFiles = () =>
  readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort().map((n) => join(MIGRATIONS, n));
const DEMO_SEED = join(MIGRATIONS, 'demo/demo-seed.sql');

/**
 * Імена таблиць, які реально згадав SQL. Межі (перевірено на формах
 * Drizzle): ловить from/join з лапками й без, у підзапитах і після CTE;
 * НЕ ловить insert (агрегати описують ЧИТАННЯ) і кома-розділені from a,b
 * (Drizzle такого не генерує).
 */
function tablesInSql(sql: string): string[] {
  const re = /\b(?:from|join)\s+(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?/gi;
  return [...sql.matchAll(re)].map((m) => m[1].toLowerCase());
}

/** UUID демо-сіду (migrations/demo/demo-seed.sql — статичні за Е0). */
const MOD_ID = '10000003-0000-4000-8000-000000000001';       // модифікація «odnofazny»
const PRODUCT_NO_MODS = '10000002-0000-4000-8000-000000000001'; // панель 450w-mono
const PRODUCT_WITH_MODS = '10000002-0000-4000-8000-000000000004'; // інвертор 5kw
const RETAIL_PRICE_TYPE_ID = '00000003-0000-4000-8000-000000000001'; // 0003_seed.sql

/** Власні фікстури поверх сідів (raw SQL, патерн fixtures/showcase.ts). */
const FIXTURES = [
  // Користувач із профілем — для гілок user-контексту (демо-сід без людей).
  `insert into public.users (name, email, email_verified)
   values ('Гейт deps', 'deps-gate@example.test', true)`,
  `insert into public.profiles (id, user_id, email, first_name, category_id)
   select gen_random_uuid(), u.id, u.email, 'Гейт', c.id
     from public.users u cross join public.user_categories c
    where u.email = 'deps-gate@example.test' and c.code = 'retail'`,
  // Активна знижка — без неї loadDiscountGroups виходить після першого
  // запиту і 3 таблиці лишаються темними (discounts.ts:41).
  `insert into public.discount_groups (id, name, operator, is_active)
   values (gen_random_uuid(), 'Гейт deps: група', 'and', true)`,
  `insert into public.discounts (id, name, group_id, discount_type, discount_value, is_active, price_type_id)
   select gen_random_uuid(), 'Гейт deps: акція', g.id, 'percent', 10, true, '${RETAIL_PRICE_TYPE_ID}'::uuid
     from public.discount_groups g where g.name = 'Гейт deps: група'`,
  `insert into public.discount_conditions (id, discount_id, condition_type)
   select gen_random_uuid(), d.id, 'user_category' from public.discounts d where d.name = 'Гейт deps: акція'`,
  `insert into public.discount_targets (id, discount_id)
   select gen_random_uuid(), d.id from public.discounts d where d.name = 'Гейт deps: акція'`,
  // Сторінка опції: демо-сід не має has_page=true; наявна фікстура
  // tip-paneli НЕ годиться (товари mono без модифікацій — гілка 2b темна).
  `update public.section_properties set has_page = true where slug = 'tip-invertora'`,
];

describe('Е1б: deps агрегатів повні відносно фактичного SQL', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_aggregate_deps');
  let dbUrl = '';
  let userId = '';
  const seen = new Set<string>();
  let restore: (() => void) | null = null;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, [...canonFiles(), DEMO_SEED]);
    for (const sql of FIXTURES) await queryRows(dbUrl, sql);
    const [u] = await queryRows(dbUrl, `select id from public.users where email = 'deps-gate@example.test'`);
    userId = (u as { id: string }).id;
    // Як у всіх сусідніх тестах: app_runtime, і ЛИШЕ після сетапу.
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');

    const original = pg.Client.prototype.query;
    const spy = vi
      .spyOn(pg.Client.prototype, 'query')
      .mockImplementation(function (this: pg.Client, ...args: unknown[]) {
        const first = args[0] as string | { text?: string };
        const sql = typeof first === 'string' ? first : first?.text;
        if (sql) for (const t of tablesInSql(sql)) seen.add(t);
        return (original as (...a: unknown[]) => unknown).apply(this, args);
      });
    restore = () => spy.mockRestore();
  }, 180_000);

  afterAll(async () => {
    restore?.();
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  /**
   * 🔴 Реєстр РУЧНИЙ і це навмисно: автор агрегату свідомо каже, ЯК він
   * виконується — включно з гілками. Сценарії підібрані так, щоб union
   * SQL покрив усі deps (обґрунтування по гілках — research-док §5).
   */
  const INVOCATIONS: Record<keyof typeof AGGREGATE, () => Promise<void>> = {
    shippingDirectory: async () => {
      const m = await import('simplycms/storefront/loaders');
      await m.withStorefrontDb((db) => m.loadShippingDirectory(db));
    },
    stockInfo: async () => {
      const m = await import('simplycms/storefront/loaders');
      await m.withStorefrontDb(async (db) => {
        await m.loadStockInfo(db, { modificationId: MOD_ID }); // гілка modification
        await m.loadStockInfo(db, { productId: PRODUCT_NO_MODS }); // гілка product
      });
    },
    priceTypeContext: async () => {
      const m = await import('simplycms/storefront/loaders');
      await m.withStorefrontDb((db) => m.loadDefaultPriceTypeId(db));
      await m.withCustomerDb(userId, (db) => m.loadUserPriceTypeId(db, userId));
    },
    discountEnvironment: async () => {
      const m = await import('simplycms/storefront/loaders');
      await m.withStorefrontDb(async (db) => {
        await m.loadDefaultPriceTypeId(db);
        await m.loadDefaultUserCategoryId(db);
        await m.loadDiscountGroups(db, RETAIL_PRICE_TYPE_ID);
      });
      await m.withCustomerDb(userId, async (db) => {
        await m.loadUserPriceTypeId(db, userId);
        await m.loadUserCategoryId(db, userId);
      });
    },
    modificationData: async () => {
      const m = await import('simplycms/storefront/loaders');
      await m.withStorefrontDb(async (db) => {
        await m.loadProductModificationValues(db, PRODUCT_WITH_MODS);
        const ids = await m.loadModificationIds(db, PRODUCT_WITH_MODS);
        await m.loadModificationStock(db, ids);
      });
    },
    propertyOptionPage: async () => {
      const m = await import('simplycms/storefront/loaders');
      await m.withStorefrontDb((db) => m.loadPropertyOption(db, 'tip-invertora', 'on-grid'));
    },
    catalogProducts: async () => {
      const m = await import('simplycms/storefront/loaders');
      await m.withStorefrontDb((db) => m.loadCatalogProducts(db));
    },
  };

  it('кожен агрегат має запис у реєстрі викликів', () => {
    expect(Object.keys(INVOCATIONS).sort()).toEqual(Object.keys(AGGREGATE).sort());
  });

  it.each(Object.keys(AGGREGATE) as (keyof typeof AGGREGATE)[])(
    '%s: deps покривають усі прочитані таблиці',
    async (name) => {
      seen.clear();
      await INVOCATIONS[name]();
      // 🔴 Fail-open захист У КОЖНОМУ кейсі: лоадер, що вийшов раніше без
      // жодного SQL, не сміє давати зелень (сліпота цього класу вже була).
      expect(seen.size, `${name}: сценарій не виконав жодного запиту`).toBeGreaterThan(0);

      const declared = new Set<string>(AGGREGATE[name].deps);
      const known = new Set<string>(Object.values(ENTITY));
      const missing = [...seen].filter((t) => known.has(t) && !declared.has(t)).sort();
      expect(
        missing,
        `${name}: SQL читає таблиці поза deps — інвалідація буде неповною: ${missing.join(', ')}`,
      ).toEqual([]);
    },
  );
});
```

🔴 У фікстурі знижки `RETAIL_PRICE_TYPE_ID` — підставити ЛІТЕРАЛОМ
(рядок вище показує template-подібний запис лише для читабельності плану;
у файлі — звичайна конкатенація або літерал uuid).

- [ ] **Step 2: Запустити — очікуємо ЧЕРВОНИЙ на двох агрегатах**

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/aggregate-deps.test.ts`
Expected: FAIL — `shippingDirectory` і `stockInfo` з `pickup_points` у missing. 🔴 Це успіх гейта. Якщо впало інакше (сигнатура лоадера, відсутній експорт) — звірити фактичні експорти `storefront/loaders/index.ts` і поправити СЦЕНАРІЙ, не гейт.

- [ ] **Step 3: Фікс deps**

У `contracts/entities.ts`: `ENTITY.pickupPoints` додати в масиви
`shippingDirectory` і `stockInfo` (+ рядок у їхні докблоки: «pickup_points —
знахідка рантайм-гейта 2026-08-31»).

Run: той самий. Expected: PASS усі.

- [ ] **Step 4: Негативний контроль**

```bash
# Тимчасово прибрати ENTITY.products зі stockInfo.deps → FAIL з 'products'
# Повернути → PASS
```

- [ ] **Step 5: Гейти й коміт**

```bash
pnpm lint && pnpm test    # entity-parity.test.ts стереже entities.ts — мусить бути зелений
git add packages/simplycms/test-harness packages/simplycms/src/contracts
git commit -m "test(v2-k3): рантайм-гейт повноти deps + фікс pickup_points у двох агрегатах

Гейт Е1а перевіряв існування залежності, не повноту. Рантайм-перехоплення
(spy на pg.Client.prototype.query) зі сценаріями по гілках зловило першим
прогоном: shippingDirectory і stockInfo читають pickup_points, якого не
було в deps. Виклики — лише внутрішні лоадери під withActor; fail-open
захист seen.size у кожному кейсі.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Залежності npm — 2 peer + піни + `drizzle-zod` + гейт одного інстанса

**Files:**
- Modify: `packages/simplycms/package.json`
- Modify: `package.json` (корінь: devDeps для збірки монорепо)
- Modify: `packages/create-simplycms-store/template/package.json.tpl`
- Create: `tests/tanstack-db-single-instance.test.ts`

**Interfaces:**
- Produces: `@tanstack/react-db`, `@tanstack/query-db-collection`, `drizzle-zod` доступні ядру; магазин отримує пару peer-ів точними пінами.

🔴 **Peer-ів ДВА, не три** (К3-10′): обидва адаптери несуть `@tanstack/db`
точним піном у власних `dependencies` (0.3.6 і 1.2.11 → `db@0.8.6`).
Розсинхрон = два інстанси `@tanstack/db` у дереві — колекція з одного,
підписки з іншого. Тому діапазони вузькі і є структурний гейт.

- [ ] **Step 1: peer + deps ядра**

У `packages/simplycms/package.json`:
```json
// peerDependencies. 🔴 ~, не ^: ^1.2.11 дозволив би 1.3.x з ІНШИМ точним
// піном @tanstack/db — і два інстанси в дереві стороннього магазину,
// де наш репозиторний single-instance гейт не діє.
"@tanstack/query-db-collection": "~1.2.11",
"@tanstack/react-db": "~0.3.6",
// dependencies (server-only, прецедент pg/better-auth; рішення власника):
"drizzle-zod": "^0.8.3"
```

У КОРЕНЕВОМУ `package.json` → `dependencies` (щоб монорепо збиралось; там
уже живуть `@tanstack/react-query`, `zod`):
```json
"@tanstack/query-db-collection": "1.2.11",
"@tanstack/react-db": "0.3.6"
```

У `template/package.json.tpl` — ТОЧНІ піни `"@tanstack/react-db": "0.3.6"`,
`"@tanstack/query-db-collection": "1.2.11"` (форма — як у сусідніх рядках шаблону).

```bash
pnpm install   # БЕЗ frozen — ми міняли манифести
```

- [ ] **Step 2: Гейт одного інстанса**

```ts
// tests/tanstack-db-single-instance.test.ts
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Два інстанси @tanstack/db у дереві — найгірший клас дефекту: колекція
 * створена одним, useLiveQuery підписується через інший, підписки одна
 * одну не бачать, симптом далеко від причини (К3-10′). Патерн гейта —
 * як tests/dts-toolchain.test.ts: структурна властивість дерева.
 */
describe('рівно один @tanstack/db у дереві', () => {
  it('усі resolved-версії @tanstack/db збігаються', () => {
    const out = execSync('pnpm ls -r --depth Infinity @tanstack/db --json', {
      encoding: 'utf8', cwd: process.cwd(),
    });
    // 🔴 СТРУКТУРНИЙ обхід, не regex по "version": вивід — масив
    // workspace-проєктів, КОЖЕН зі своєю версією пакета (0.4.1, 1.0.0…) —
    // сирий скан рахував би їх «другою версією» і фейлив здорове дерево
    // (знахідка Codex r2 проти redакції з regex-ом).
    // 🔴 Асертимо ФІЗИЧНИЙ інстанс (`path`), не лише семвер (рев'ю Task 2,
    // R6): pnpm ізолює снапшоти ще й peer-контекстом — два споживачі,
    // зарезолвлені на 0.8.6 проти різних typescript/react, дали б ДВА
    // модулі з однаковою version. `path` містить peer-суфікс теки
    // (`.pnpm/@tanstack+db@0.8.6_typescript@5.9.3/...`), тож ловить саме це.
    // 🔴 Не сканувати `node_modules/.pnpm` напряму: там живуть сироти від
    // негативних контролів (0.8.5 після відкату package.json) — хибний FAIL.
    const versions = new Set<string>();
    const paths = new Set<string>();
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      for (const [name, dep] of Object.entries(
        node as Record<string, { version?: string; path?: string; dependencies?: unknown }>,
      )) {
        if (name === '@tanstack/db' && dep?.version) {
          versions.add(dep.version);
          if (dep.path) paths.add(dep.path);
        }
        if (dep && typeof dep === 'object') walk((dep as { dependencies?: unknown }).dependencies);
      }
    };
    for (const project of JSON.parse(out) as Array<Record<string, unknown>>) {
      for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const)
        walk(project[key]);
    }
    expect(versions.size, 'у дереві немає @tanstack/db взагалі — гейт вхолосту').toBeGreaterThan(0);
    expect([...versions], 'дерево тримає кілька версій @tanstack/db').toHaveLength(1);
    expect(paths.size, 'pnpm ls не віддав path — гейт фізичного інстанса вхолосту').toBeGreaterThan(0);
    expect([...paths], 'дерево тримає кілька ФІЗИЧНИХ інстансів @tanstack/db (peer-контекст)').toHaveLength(1);
  });
});
```

Run: `pnpm vitest run tests/tanstack-db-single-instance.test.ts`
Expected: PASS. Негативний контроль: тимчасово поставити в корінь
`"@tanstack/db": "0.8.5"` + `pnpm install` → FAIL → відкотити **і
повторити `pnpm install`** (сирота `.pnpm/@tanstack+db@0.8.5_*` після
відкату — не помилка гейта, але сміття в дереві).

- [ ] **Step 3: Повні гейти встановлення і коміт**

```bash
pnpm install --frozen-lockfile && pnpm lint && pnpm test
git add package.json packages/simplycms/package.json packages/create-simplycms-store/template pnpm-lock.yaml tests/tanstack-db-single-instance.test.ts
git commit -m "chore(v2-k3): TanStack DB — 2 peer-и вузько + гейт одного інстанса; drizzle-zod у deps ядра

К3-10′: @tanstack/db не peer-иться — його точним піном несуть обидва
адаптери; розсинхрон версій дає два інстанси в дереві (підписки одна одну
не бачать), тому діапазони вузькі, у шаблоні точні піни, і структурний
гейт стереже єдиність. drizzle-zod — server-only dependency ядра за
прецедентом pg/better-auth.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `RouterContext` — тип у пакеті через НАЯВНИЙ барель `runtime`

**Files:**
- Create: `packages/simplycms/src/runtime/router-context.ts`
- Modify: `packages/simplycms/src/runtime/index.ts`
- Modify: `src/routes/__root.tsx` (+ канон `packages/cli/host/src/routes/__root.tsx` і шаблон — через `pnpm template:sync`)

**Interfaces:**
- Produces: `import type { RouterContext } from 'simplycms/runtime'` — Task 10 типізує `context.queryClient` у loader роуту ядра.

🔴 БЕЗ нового субшляху exports (рішення Q7): тип — `import type`, нуль
рантайм-ваги, наявний субшлях `./runtime` достатній. Нові записи в
exports/publishConfig/tsup НЕ додаються.

- [ ] **Step 1: Тип + реекспорт**

```ts
// packages/simplycms/src/runtime/router-context.ts
import type { QueryClient } from '@tanstack/react-query';

/**
 * Контекст роутера магазину. Живе в ПАКЕТІ: loader роут-файлів ядра
 * (routes/admin/**) типізує context.queryClient звідси — дотягтись до
 * host src/routes/__root.tsx вони не можуть (зворотний напрям). Host
 * лише реекспортує цей тип.
 */
export interface RouterContext {
  readonly queryClient: QueryClient;
}
```

У `runtime/index.ts` додати: `export type { RouterContext } from './router-context';`

- [ ] **Step 2: Host реекспортує**

У `src/routes/__root.tsx` замінити власне оголошення інтерфейсу на:

```tsx
import type { RouterContext } from 'simplycms/runtime';
export type { RouterContext };
```

(`createRootRouteWithContext<RouterContext>()` — без змін.)

- [ ] **Step 3: Синк, гейти, коміт**

```bash
pnpm template:sync
pnpm build && pnpm typecheck && pnpm test
git add packages/simplycms/src/runtime src packages/cli/host packages/create-simplycms-store/template
git commit -m "feat(v2-k3): RouterContext переїжджає в пакет (через наявний runtime-барель)

Борг Е1а: тип жив у host-файлі, роути ядра його не бачили. Новий субшлях
не заводиться — тип type-only, наявний simplycms/runtime достатній.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: ESLint-гейт К3-4′ — `createServerFn` лише топ-рівнево

**Files:**
- Create: `eslint-rules/server-fn-top-level.mjs`
- Create: `tests/eslint-rules/server-fn-top-level.test.ts`
- Modify: `eslint.config.mjs`

**Interfaces:**
- Produces: постійний запобіжник обох режимів провалу компілятора (throw на повільному шляху, МОВЧАЗНИЙ пропуск на fast-path).

- [ ] **Step 1: Правило**

```js
// eslint-rules/server-fn-top-level.mjs
/**
 * К3-4′: виклик createServerFn мусить бути ініціалізатором топ-рівневого
 * `const` з простим ідентифікатором — цього вимагає компілятор Start
 * (handleCreateServerFn.js:104-106). Гірше за помилку компілятора —
 * fast-path: для файлів, де детектовано лише serverFn, сканується ТІЛЬКИ
 * топ-рівень, тож нетоплевел-виклик МОВЧКИ лишається нетрансформованим і
 * серверний граф їде в клієнтський бандл. Це правило робить обидва режими
 * гучними на pnpm lint.
 */
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      notTopLevel:
        'createServerFn мусить бути топ-рівневим `const ім’я = createServerFn(...)` — ' +
        'інакше компілятор Start або впаде, або МОВЧКИ пропустить трансформацію (К3-4′).',
    },
  },
  create(context) {
    return {
      'CallExpression[callee.name="createServerFn"]'(node) {
        // Легальна форма: … → VariableDeclarator(id=Identifier) →
        // VariableDeclaration → Program | ExportNamedDeclaration→Program.
        // Виклик — корінь method-chain, тож піднімаємось крізь ланцюг
        // .inputValidator(...).handler(...) до declarator-а.
        // 🔴 Піднімаємось ЛИШЕ як `.object` MemberExpression або `.callee`
        // CallExpression (рев'ю р3): `wrap(createServerFn(...))` кладе
        // ланцюг в arguments — компілятор Start це відхиляє
        // (handleCreateServerFn: parentPath мусить бути declarator), а
        // безумовний прохід крізь CallExpression пропускав би wrapper.
        let cur = node;
        let p = node.parent;
        while (
          p &&
          ((p.type === 'MemberExpression' && p.object === cur) ||
            (p.type === 'CallExpression' && p.callee === cur))
        ) { cur = p; p = p.parent; }
        const ok =
          p?.type === 'VariableDeclarator' &&
          p.id?.type === 'Identifier' &&
          p.parent?.type === 'VariableDeclaration' &&
          p.parent.kind === 'const' && // let/var компілятор теж не приймає
          (p.parent.parent?.type === 'Program' ||
            (p.parent.parent?.type === 'ExportNamedDeclaration' &&
              p.parent.parent.parent?.type === 'Program'));
        if (!ok) context.report({ node, messageId: 'notTopLevel' });
      },
    };
  },
};
```

- [ ] **Step 2: Підключити у `eslint.config.mjs`**

Окремим блоком на `packages/simplycms/src/**/*.{ts,tsx}` +
`packages/simplycms/routes/**/*.tsx` + `src/**/*.{ts,tsx}` (plugins:
`simplycms-serverfn`, rule `'simplycms-serverfn/server-fn-top-level': 'error'`;
окреме імʼя плагіна — щоб не зливати опції з `query-key-from-entity`).

- [ ] **Step 3: Машинний тест правила (Linter API на синтетичних фікстурах)**

Прецедент підходу — `tests/tier-boundary/lint.ts` (ESLint годується
синтетичним кодом). ✅ Усі 8 кейсів емпірично зелені на ESLint 10.8 +
typescript-eslint 8 (прогін 2026-09-01, правило витягнуте з цього плану).

```ts
// tests/eslint-rules/server-fn-top-level.test.ts
import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from '../../eslint-rules/server-fn-top-level.mjs';

const linter = new Linter({ configType: 'flat' });
const config = [{
  files: ['**/*.ts'],
  languageOptions: { parser: tseslint.parser },
  plugins: { s: { rules: { 'server-fn-top-level': rule } } },
  rules: { 's/server-fn-top-level': 'error' },
}];
const lint = (code: string) =>
  linter.verify(`import { createServerFn } from '@tanstack/react-start';\n${code}`, config, { filename: 'f.ts' });

describe('server-fn-top-level (К3-4′)', () => {
  it.each([
    ['export const chain', `export const list = createServerFn({ method: 'GET' }).inputValidator(s).handler(h);`],
    ['const без export', `const list = createServerFn({ method: 'GET' }).handler(h);`],
  ])('легально: %s', (_n, code) => expect(lint(code)).toEqual([]));

  it.each([
    ['усередині функції', `function f() { const x = createServerFn({ method: 'GET' }).handler(h); return x; }`],
    ['let', `let y = createServerFn({ method: 'GET' }).handler(h);`],
    ['object property', `const o = { fn: createServerFn({ method: 'GET' }).handler(h) };`],
    ['wrapper-call', `const w = wrap(createServerFn({ method: 'GET' }).handler(h));`],
    ['Promise.resolve', `const pr = Promise.resolve(createServerFn({ method: 'GET' }).handler(h));`],
    ['export default', `export default createServerFn({ method: 'GET' }).handler(h);`],
  ])('офендер: %s', (_n, code) => {
    const msgs = lint(code);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].messageId).toBe('notTopLevel');
  });
});
```

Run: `pnpm vitest run tests/eslint-rules/server-fn-top-level.test.ts` → PASS 8/8.

- [ ] **Step 4: Смоук у реальній зоні**

```bash
pnpm lint                      # Expected: 0 errors (чинний код легальний)
# НЕГАТИВНІ (по одному, кожен → FAIL з notTopLevel):
#   function f() { const x = createServerFn({ method: 'GET' }); return x; }
#   let y = createServerFn({ method: 'GET' });
#   const o = { fn: createServerFn({ method: 'GET' }) };
#   const w = wrap(createServerFn({ method: 'GET' }).handler(h));
#   const pr = Promise.resolve(createServerFn({ method: 'GET' }).handler(h));
pnpm lint
# Прибрати → 0 errors, warnings без змін
```

- [ ] **Step 5: Гейти й коміт**

```bash
pnpm lint && pnpm test
git add eslint-rules/server-fn-top-level.mjs tests/eslint-rules eslint.config.mjs
git commit -m "test(v2-k3): гейт К3-4′ — createServerFn лише топ-рівневим const

Компілятор Start вимагає top-level присвоєння (handleCreateServerFn:104),
а fast-path для serverFn-файлів сканує лише топ-рівень — нетоплевел
виклик не падає, а мовчки лишається нетрансформованим. Правило робить
обидва режими гучними.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---
# Частина 1 — authz-склейка (Task 5)

**DoD частини 1:** `resolveRequestGrant`/`requireGrant` живуть у `simplycms/auth`, юніти зелені, `AuthzError` доїжджає як 403 (доведено юнітом на `setResponseStatus`).

### Task 5: `resolveRequestGrant` + `requireGrant` (К3-13)

**Files:**
- Create: `packages/simplycms/src/auth/authz-request.ts`
- Create: `packages/simplycms/src/auth/__tests__/authz-request.test.ts`
- Modify: `packages/simplycms/src/auth/index.ts`

**Interfaces:**
- Consumes: `readSessionSubject(headers)` (`auth/session.ts`), `requireOperation(subject, op): AuthScope` і `AuthzError` (`auth/authz.ts`), `getRequest`/`setResponseStatus` (`@tanstack/react-start/server`).
- Produces: `resolveRequestGrant(operation): Promise<RequestGrant>`; `requireGrant(operation): Promise<RequestGrant>` (те саме + 403 при відмові); `type RequestGrant = { subject: AuthzSubject; scope: AuthScope }`. Task 7 будує операції поверх `requireGrant`.

🔴 НЕ писати `assertAllowed`-подібних void-обгорток: `requireOperation` вже
існує і ПОВЕРТАЄ scope — викликач мусить бачити `'own'` (докблок
`authz.ts:110-118`). Склейка лише додає «субʼєкт із запиту» і HTTP-статус.

- [ ] **Step 1: Падаючий тест**

```ts
// packages/simplycms/src/auth/__tests__/authz-request.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Патерн мока Start-server — як у storefront-routes/__tests__/revalidate-theme.test.ts
const setResponseStatus = vi.fn();
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => ({ headers: new Headers() }),
  setResponseStatus: (...a: unknown[]) => setResponseStatus(...a),
}));

let subject: unknown = null;
vi.mock('../session', () => ({
  readSessionSubject: vi.fn(async () => subject),
}));

import { AuthzError } from '../authz';
import { requireGrant, resolveRequestGrant } from '../authz-request';

describe('authz-request (К3-13)', () => {
  beforeEach(() => { subject = null; setResponseStatus.mockClear(); });

  it('анонім на catalog.write — AuthzError', async () => {
    await expect(resolveRequestGrant('catalog.write')).rejects.toBeInstanceOf(AuthzError);
  });

  it('admin на catalog.write — scope any і той самий субʼєкт', async () => {
    subject = { userId: 'u1', roles: ['admin'], email: 'a@b', name: null };
    const grant = await resolveRequestGrant('catalog.write');
    expect(grant.scope).toBe('any');
    expect(grant.subject.userId).toBe('u1');
  });

  it('user на order.read — scope own (склейка НЕ зʼїдає scope)', async () => {
    subject = { userId: 'u2', roles: ['user'], email: 'c@d', name: null };
    const grant = await resolveRequestGrant('order.read');
    expect(grant.scope).toBe('own');
  });

  it('requireGrant при відмові ставить 403 ДО прокидання', async () => {
    await expect(requireGrant('catalog.write')).rejects.toBeInstanceOf(AuthzError);
    expect(setResponseStatus).toHaveBeenCalledWith(403);
  });

  it('requireGrant при дозволі статус не чіпає', async () => {
    subject = { userId: 'u1', roles: ['admin'], email: 'a@b', name: null };
    await requireGrant('catalog.write');
    expect(setResponseStatus).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm vitest run packages/simplycms/src/auth/__tests__/authz-request.test.ts`
Expected: FAIL — модуля немає.

- [ ] **Step 2: Реалізація**

```ts
// packages/simplycms/src/auth/authz-request.ts
import { getRequest, setResponseStatus } from '@tanstack/react-start/server';
import { AuthzError, requireOperation, type AuthScope, type AuthzSubject, type Operation } from './authz';
import { readSessionSubject } from './session';

/** Анонім: жодної ролі — матриця сама відмовляє всьому не-публічному. */
const GUEST: AuthzSubject = { userId: null, roles: [] };

export interface RequestGrant {
  readonly subject: AuthzSubject;
  readonly scope: AuthScope;
}

/**
 * Сесія поточного запиту → дозволений scope операції (перший рубіж B5″).
 *
 * 🔴 Викликається строго ДО withActor: субʼєкт — із СЕСІЇ, ніколи з
 * параметра клієнта; вкладених withActor не існує (readSessionSubject сам
 * ходить у user_roles власною короткою транзакцією — тому цей виклик
 * НЕ можна робити зсередини відкритої транзакції: другий pool.connect()
 * усередині першої = self-deadlock при вичерпаному пулі).
 *
 * 🔴 Повертає scope, не void: викликач зобовʼязаний ПОБАЧИТИ 'own' і
 * звузити запит (докблок requireOperation). Void-обгортки заборонені.
 */
export async function resolveRequestGrant(operation: Operation): Promise<RequestGrant> {
  const subject = (await readSessionSubject(getRequest().headers)) ?? GUEST;
  const scope = requireOperation(subject, operation); // кидає AuthzError
  return { subject, scope };
}

/**
 * Те саме + контракт помилок К3-13: 403 ставиться ДО прокидання, бо
 * сервер бере статус із getResponse().status ?? 500 у момент catch —
 * не з полів Error. Response не кидати ніколи: клієнтський fetcher
 * резолвить його json-тіло як успіх. Клієнт розрізняє відмову за
 * error.name === 'AuthzError' (seroval не зберігає instanceof).
 */
export async function requireGrant(operation: Operation): Promise<RequestGrant> {
  try {
    return await resolveRequestGrant(operation);
  } catch (error) {
    if (error instanceof AuthzError) setResponseStatus(403);
    throw error;
  }
}
```

У `auth/index.ts` (блок session/authz-експортів):
`export { requireGrant, resolveRequestGrant } from './authz-request';`
`export type { RequestGrant } from './authz-request';`

- [ ] **Step 3: Зелений прогін + лінт + коміт**

Run: `pnpm vitest run packages/simplycms/src/auth/__tests__/authz-request.test.ts` → PASS 5/5; `pnpm lint && pnpm typecheck` → PASS.

```bash
git add packages/simplycms/src/auth
git commit -m "feat(v2-k3): resolveRequestGrant/requireGrant — перше підключення requireOperation (К3-13)

Склейка сесія→scope над НАЯВНИМИ requireOperation і dbRoleForSubject
(жоден serverFn досі їх не кликав). requireGrant ставить 403 ДО throw —
сервер бере статус із response.status у момент catch. Void-дублікатів
на кшталт assertAllowed немає: scope мусить доїхати до викликача.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---
# Частина 2 — серверний шар (Tasks 6–8)

**DoD частини 2:** серверний шар доводиться `test:schema` і юнітами БЕЗ жодного клієнтського коду; `pnpm build:packages && pnpm test:packaging && pnpm pilot:pack` зелені (Gate C стереже `impl` у `SERVER_PAYLOAD` і бачить розділення entry у dist; присутність стаба в бандлі — Task 10, бо клієнта ще немає).

### Task 6: Тека `admin-server`, тір-зона, `subset.ts`

**Files:**
- Create: `packages/simplycms/src/admin-server/subset.ts`
- Create: `packages/simplycms/src/admin-server/__tests__/subset.test.ts`
- Modify: `eslint.tier-zones.mjs`, `tests/tier-boundary.test.ts`

**Interfaces:**
- Produces: `toDrizzleSubset(table, allow, input)` → `{ where?, orderBy?, limit?, offset? }`; `subsetInputSchema` (Zod, СТРОГИЙ — для inputValidator list-serverFn); типи `SubsetAllow`, `SubsetInput`.

🔴 `subset.ts` — єдина причина існування фабрики: трансляція предикатів у
SQL з allowlist в ОДНОМУ місці (34 копії = 34 шанси на інʼєкцію; той
самий мотив, що `plugin-sdk/server/guard.ts`).

- [ ] **Step 1: Тір-зона (ДО коду — щоб перший же файл писався під нею)**

У `eslint.tier-zones.mjs`, поруч із `['src/storefront', 2, …]`:

```js
// Серверний шар адмінки (Е1б) — T2. Winяток upward той самий, що в
// storefront: єдиний канал до Postgres — withActor (db), перший рубіж —
// requireGrant (auth). Ширшого не давати.
['src/admin-server', 2, 'admin-server', ['db', 'auth']],
```

У `tests/tier-boundary.test.ts` → `./tier-boundary/zones` додати зону:
forbidden-приклад `simplycms/storefront` (T2 поза винятком), allowed —
`simplycms/db` (виняток) — за формою сусідніх записів ZONES.

Run: `pnpm vitest run tests/tier-boundary.test.ts` → PASS (зона ловить і bare, і відносну форму).

- [ ] **Step 2: Падаючий тест subset**

```ts
// packages/simplycms/src/admin-server/__tests__/subset.test.ts
import { describe, expect, it } from 'vitest';
import { orderStatuses } from 'simplycms/schema';
import { subsetInputSchema, toDrizzleSubset, type SubsetInput } from '../subset';

const ALLOW = { filterable: ['code', 'isDefault'], sortable: ['sortOrder'] } as const;

describe('subset: трансляція предикатів колекції у Drizzle', () => {
  it('колонка поза allowlist — кидає', () => {
    expect(() => toDrizzleSubset(orderStatuses, ALLOW, {
      filters: [{ field: ['name'], operator: 'eq', value: 'x' }],
    })).toThrow(/name/);
  });

  it('сортування поза allowlist — кидає', () => {
    expect(() => toDrizzleSubset(orderStatuses, ALLOW, {
      sorts: [{ field: ['createdAt'], direction: 'asc' }],
    })).toThrow(/createdAt/);
  });

  it('невідомий оператор — кидає, не ігнорується', () => {
    // Рантайм-негатив: 'like' поза union-типом SubsetInput, тож у strict TS
    // потрібен явний каст (рев'ю р3) — це саме те, що прийшло б із мережі
    // повз типи, і що toDrizzleSubset мусить відбити сам.
    const invalid = {
      filters: [{ field: ['code'], operator: 'like', value: 'x' }],
    } as unknown as SubsetInput;
    expect(() => toDrizzleSubset(orderStatuses, ALLOW, invalid)).toThrow(/like/);
  });

  it('дозволене — проходить; порожнє — порожній subset', () => {
    const s = toDrizzleSubset(orderStatuses, ALLOW, {
      filters: [{ field: ['code'], operator: 'eq', value: 'new' }],
      sorts: [{ field: ['sortOrder'], direction: 'asc' }],
      limit: 10,
    });
    expect(s.where).toBeDefined();
    expect(s.limit).toBe(10);
    expect(toDrizzleSubset(orderStatuses, ALLOW, {}).where).toBeUndefined();
  });

  it('R9: форма value привʼязана до оператора (400, не 500 з БД)', () => {
    const parse = (f: object) => subsetInputSchema.safeParse({ subset: { filters: [f] } }).success;
    expect(parse({ field: ['code'], operator: 'in', value: 'x' })).toBe(false);        // скаляр замість масиву
    expect(parse({ field: ['code'], operator: 'in', value: [] })).toBe(false);         // порожній масив
    expect(parse({ field: ['code'], operator: 'eq', value: ['a', 'b'] })).toBe(false); // масив замість скаляра
    expect(parse({ field: ['code'], operator: 'in', value: ['a', 'b'] })).toBe(true);
    expect(parse({ field: ['code'], operator: 'eq', value: null })).toBe(true);
  });

  it('напрям поза asc/desc при прямому виклику — кидає, не мовчазний asc', () => {
    expect(() => toDrizzleSubset(orderStatuses, ALLOW, {
      sorts: [{ field: ['sortOrder'], direction: 'sideways' }],
    } as unknown as SubsetInput)).toThrow(/напрям/);
  });

  it('allowlist з неіснуючою колонкою — чітка помилка з іменем таблиці', () => {
    expect(() => toDrizzleSubset(orderStatuses, { filterable: ['colour'], sortable: [] }, {
      filters: [{ field: ['colour'], operator: 'eq', value: 'x' }],
    })).toThrow(/colour.*order_statuses/);
  });

  it('subsetInputSchema — строгий: limit обмежений, сміття не проходить', () => {
    expect(subsetInputSchema.safeParse({ subset: { limit: 100_000 } }).success).toBe(false);
    expect(subsetInputSchema.safeParse({ subset: { filters: 'x' } }).success).toBe(false);
    expect(subsetInputSchema.safeParse({}).success).toBe(true);
    expect(subsetInputSchema.safeParse({
      subset: { filters: [{ field: ['code'], operator: 'eq', value: 'new' }], limit: 50 },
    }).success).toBe(true);
  });
});
```

Run: `pnpm vitest run packages/simplycms/src/admin-server/__tests__/subset.test.ts`
Expected: FAIL — модуля немає.

- [ ] **Step 3: Реалізація**

```ts
// packages/simplycms/src/admin-server/subset.ts
import { and, asc, desc, eq, getTableName, gt, gte, inArray, lt, lte, type SQL } from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Єдине місце, де рядок із клієнта стає частиною SQL. field звіряється з
 * allowlist РЕСУРСУ (не зі схемою: фільтр по всіх колонках = повний
 * контроль форми запиту клієнтом); значення завжди йде параметром.
 * Оператори — рівно ті, що вміє push-down query-collection
 * (parseLoadSubsetOptions): eq, gt, gte, lt, lte, in. Невідомий — КИДАЄ.
 * `or` свідомо відкладений до Е3 (каталог) — тут його не вмикати.
 */
// 🔴 Не `as const`: eq/gt/… — це інтерфейс BinaryOperator із трьома
// перевантаженнями, inArray — окрема generic-функція; спільна мапа
// типізується лише через звужену сигнатуру (TS2349 інакше). Вхід уже
// звірений allowlist-ом ДО того, як дійде до SQL-функції.
type SubsetOperatorFn = (column: never, value: never) => SQL;
const OPERATORS: Record<'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in', SubsetOperatorFn> =
  { eq, gt, gte, lt, lte, in: inArray };

export interface SubsetAllow {
  readonly filterable: readonly string[];
  readonly sortable: readonly string[];
}

const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const filterSchema = z
  .object({
    field: z.array(z.string().min(1)).min(1),
    operator: z.enum(['eq', 'gt', 'gte', 'lt', 'lte', 'in']),
    value: z.unknown(),
  })
  // 🔴 R9 (рев'ю Task 6): форма value привʼязана до оператора ТУТ, на
  // межі, — інакше `in` зі скаляром чи `eq` з масивом доїжджають до
  // bindIfParam і повертаються 500 з БД замість 400 від валідатора.
  .superRefine((f, ctx) => {
    if (f.operator === 'in') {
      const r = z.array(scalar).min(1).safeParse(f.value);
      if (!r.success)
        ctx.addIssue({ code: 'custom', path: ['value'], message: "operator 'in' вимагає непорожній масив скалярів" });
    } else if (!scalar.safeParse(f.value).success) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: `operator '${f.operator}' вимагає скаляр` });
    }
  });
const sortSchema = z.object({
  field: z.array(z.string().min(1)).min(1),
  direction: z.enum(['asc', 'desc']),
});

/** Форма subset одного list-запиту. */
export const subsetShapeSchema = z.object({
  filters: z.array(filterSchema).max(20).optional(),
  sorts: z.array(sortSchema).max(5).optional(),
  // 🔴 limit обмежений: відкритий endpoint під адмін-роллю не сміє
  // приймати «віддай мільйон» (закриває дірку z.unknown() старої редакції).
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type SubsetInput = z.infer<typeof subsetShapeSchema>;

/** Вхід list-serverFn: { subset? } — саме це йде в inputValidator. */
export const subsetInputSchema = z.object({ subset: subsetShapeSchema.optional() });
export type SubsetPayload = z.infer<typeof subsetInputSchema>;

export function toDrizzleSubset(table: Table, allow: SubsetAllow, input: SubsetInput) {
  const columns = table as unknown as Record<string, never>;

  /** Колонка з allowlist мусить існувати в таблиці — одрук автора ресурсу
   *  падає тут чіткою помилкою, а не невиразно всередині SQL-білдера. */
  const column = (name: string) => {
    const col = columns[name];
    if (col === undefined)
      throw new Error(`[admin-server] колонки "${name}" немає в таблиці ${getTableName(table)}`);
    return col;
  };

  const conditions: SQL[] = (input.filters ?? []).map((f) => {
    const name = f.field.join('.');
    if (!allow.filterable.includes(name))
      throw new Error(`[admin-server] фільтр по недозволеній колонці: ${name}`);
    const op = OPERATORS[f.operator as keyof typeof OPERATORS];
    if (!op) throw new Error(`[admin-server] невідомий оператор: ${f.operator}`);
    return op(column(name), f.value as never);
  });

  const orderBy = (input.sorts ?? []).map((s) => {
    const name = s.field.join('.');
    if (!allow.sortable.includes(name))
      throw new Error(`[admin-server] сортування по недозволеній колонці: ${name}`);
    // Заява модуля «невідоме → кидає» діє і при прямому виклику повз схему.
    if (s.direction !== 'asc' && s.direction !== 'desc')
      throw new Error(`[admin-server] невідомий напрям сортування: ${String(s.direction)}`);
    return (s.direction === 'desc' ? desc : asc)(column(name));
  });

  return {
    where: conditions.length === 0 ? undefined : and(...conditions),
    orderBy: orderBy.length === 0 ? undefined : orderBy,
    limit: input.limit,
    offset: input.offset,
  };
}
```

Run: тест → PASS 8/8. Потім `pnpm lint` → 0 errors (зона жива, файл під нею).

- [ ] **Step 4: Гейти й коміт**

```bash
pnpm lint && pnpm test
git add packages/simplycms/src/admin-server eslint.tier-zones.mjs tests/tier-boundary.test.ts
git commit -m "feat(v2-k3): admin-server (T2, виняток db+auth) + subset зі строгим Zod-входом

Тір-зона — ПЕРЕД першим файлом теки. subset — єдине місце трансляції
предикатів у SQL: allowlist колонок, закритий enum операторів, limit
з межею (замість z.unknown() старої редакції). or — свідомо Е3.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: `defineAdminResource` — операції + схеми (К3-4′)

**Files:**
- Create: `packages/simplycms/src/admin-server/resource.ts`
- Create: `packages/simplycms/src/admin-server/__tests__/resource.test.ts`

**Interfaces:**
- Consumes: `requireGrant` (`simplycms/auth`), `dbRoleForSubject` (`simplycms/auth`), `withActor` (`simplycms/db`), `toDrizzleSubset`/`subsetInputSchema` (Task 6), `createInsertSchema`/`createSelectSchema`/`createUpdateSchema` (`drizzle-zod`).
- Produces: `defineAdminResource(config)` → `AdminResourceOps`:
  - `list: (ctx: { data: SubsetPayload }) => Promise<Row[]>`
  - `insert: (ctx: { data: InsertRow[] }) => Promise<Row[]>` — 🔴 масиви (batch)
  - `update: (ctx: { data: { id: string; patch: Patch }[] }) => Promise<Row[]>`
  - `remove: (ctx: { data: { id: string }[] }) => Promise<{ count: number }>`
  - схеми: `subsetSchema`, `insertSchema` (масив, id обовʼязковий), `updateSchema`, `removeSchema`, `rowSchema`
  Кожна операція — ГОТОВИЙ handler для `.handler(ops.х)` (сигнатура `({ data }) => …`).

🔴 serverFn фабрика НЕ створює (К3-4′) — Task 8 оголошує їх явно.
🔴 Compile-time exhaustiveness — вимога спеки, БЕЗ `as never`-обходу.

- [ ] **Step 1: Падаючий тест**

```ts
// packages/simplycms/src/admin-server/__tests__/resource.test.ts
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { orderStatuses } from 'simplycms/schema';

// Операції торкаються auth/db лише в рантаймі хендлера — мокаємо обидва
// канали, форму схем перевіряємо без БД.
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({ subject: { userId: 'u1', roles: ['admin'] }, scope: 'any' })),
}));
vi.mock('simplycms/db', () => ({
  withActor: vi.fn(async (_actor, fn) => fn({} as never, {} as never)),
}));

import { defineAdminResource } from '../resource';

const ops = defineAdminResource({
  entity: 'order_statuses',
  table: orderStatuses,
  operation: 'catalog.write',
  mode: 'eager',
  filterable: ['code', 'isDefault'],
  sortable: ['sortOrder', 'name'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  writable: ['name', 'code', 'color', 'sortOrder'],
  readonly: ['id', 'isDefault', 'createdAt'],
});

describe('defineAdminResource (К3-4′)', () => {
  it("scope 'own' — фабрична операція кидає, а не мовчки віддає все", async () => {
    // Рев'ю р2: втрата scope нейтралізувала б resolveRequestGrant для
    // Е3–Е6. Фабрика мусить бути admin-only fail-loud.
    const { requireGrant } = await import('simplycms/auth');
    (requireGrant as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      subject: { userId: 'u2', roles: ['user'] }, scope: 'own',
    });
    await expect(ops.list({ data: {} })).rejects.toThrow(/own/);
  });

  it('віддає операції-хендлери і схеми, НЕ serverFn', () => {
    for (const k of ['list', 'insert', 'update', 'remove'] as const)
      expect(typeof ops[k]).toBe('function');
    for (const k of ['subsetSchema', 'insertSchema', 'updateSchema', 'removeSchema', 'rowSchema'] as const)
      expect(ops[k]).toBeDefined();
    // serverFn мав би .url/__executeServer — операція plain-функція без них.
    expect('url' in (ops.list as object)).toBe(false);
  });

  it('insertSchema — масив, id обовʼязковий (Е0), readonly зрізаються', () => {
    const noId = ops.insertSchema.safeParse([{ name: 'X', code: 'x' }]);
    expect(noId.success).toBe(false);
    const withExtra = ops.insertSchema.safeParse([
      { id: crypto.randomUUID(), name: 'X', code: 'x', isDefault: true, createdAt: 'boom' },
    ]);
    // strip: readonly-ключі не доїжджають у БД навіть якщо прислані.
    expect(withExtra.success).toBe(true);
    if (withExtra.success) {
      expect('isDefault' in withExtra.data[0]).toBe(false);
      expect('createdAt' in withExtra.data[0]).toBe(false);
    }
  });

  it('updateSchema: patch не приймає id і readonly', () => {
    const parsed = ops.updateSchema.safeParse([
      { id: crypto.randomUUID(), patch: { name: 'Y', isDefault: true } },
    ]);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect('isDefault' in parsed.data[0].patch).toBe(false);
  });

  it('exhaustiveness: пропуск І перетин — помилки ТИПУ', () => {
    // Пропущений 'color' → __missingColumns: "color".
    // @ts-expect-error — color не покритий
    defineAdminResource({
      entity: 'order_statuses', table: orderStatuses, operation: 'catalog.write',
      mode: 'eager', filterable: [], sortable: [],
      writable: ['name', 'code', 'sortOrder'],
      readonly: ['id', 'isDefault', 'createdAt'],
    });
    // 'createdAt' в ОБОХ списках → __overlappingColumns: "createdAt"
    // (знахідка рев'ю ред.2: перетин давав клієнту право перезаписати
    // мітку створення, а тип мовчав).
    // @ts-expect-error — createdAt і writable, і readonly
    defineAdminResource({
      entity: 'order_statuses', table: orderStatuses, operation: 'catalog.write',
      mode: 'eager', filterable: [], sortable: [],
      writable: ['name', 'code', 'color', 'sortOrder', 'createdAt'],
      readonly: ['id', 'isDefault', 'createdAt'],
    });
    expectTypeOf(ops.list).toBeFunction();
  });
});
```

Run: `pnpm vitest run packages/simplycms/src/admin-server/__tests__/resource.test.ts`
Expected: FAIL — модуля немає.

- [ ] **Step 2: Реалізація**

```ts
// packages/simplycms/src/admin-server/resource.ts
import { eq, inArray, asc, desc, type Table } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';
import { requireGrant, dbRoleForSubject, type Operation } from 'simplycms/auth';
import { withActor, type ActorDb } from 'simplycms/db';
import { subsetInputSchema, toDrizzleSubset, type SubsetAllow, type SubsetPayload } from './subset';

/** Імена колонок Drizzle-таблиці (TS-ключі, camelCase). */
type ColumnName<T extends Table> = Extract<keyof T['_']['columns'], string>;

/**
 * Фабрика ОПЕРАЦІЙ і схем ресурсу адмінки (К3-4′). serverFn НЕ створює:
 * компілятор Start вимагає топ-рівневих const (а fast-path нетоплевел
 * виклик мовчки пропускає) — обгортки пише Task-модуль сутності явно.
 *
 * 🔴 Розріз «фабрика vs іменована операція» — ПО ОПЕРАЦІЯХ: усе з
 * доменним інваріантом (setDefault, reorder, remove-з-перевіркою)
 * пишеться руками в operations/. DSL запитів немає — складніше за
 * subset = useLiveQuery на клієнті або іменована операція.
 *
 * 🔴 Exhaustiveness (вимога спеки): кожна колонка мусить бути у
 * writable АБО readonly — інакше конфіг не типізується (фантомне поле
 * __missingColumns називає пропущені).
 */
export function defineAdminResource<
  T extends Table,
  const W extends ColumnName<T>,
  const R extends ColumnName<T>,
>(
  config: {
    entity: string;
    table: T;
    operation: Operation;
    mode: 'eager' | 'on-demand';
    filterable: readonly ColumnName<T>[];
    sortable: readonly ColumnName<T>[];
    defaultOrder?: { column: ColumnName<T>; direction: 'asc' | 'desc' };
    writable: readonly W[];
    readonly: readonly R[];
  } & ([Exclude<ColumnName<T>, W | R>] extends [never]
    ? unknown
    : { __missingColumns: Exclude<ColumnName<T>, W | R> }) &
    // 🔴 Перетин теж заборонений: колонка в ОБОХ списках — writable
    //   виграв би мовчки (напр., createdAt став би перезаписуваним).
    ([Extract<W, R>] extends [never]
      ? unknown
      : { __overlappingColumns: Extract<W, R> }),
) {
  const allow: SubsetAllow = { filterable: config.filterable, sortable: config.sortable };
  const columns = config.table as unknown as Record<string, never>;
  const pickWritable = Object.fromEntries(config.writable.map((c) => [c, true])) as {
    [K in W]: true;
  };

  const rowSchema = createSelectSchema(config.table);
  const insertRowSchema = createInsertSchema(config.table)
    .pick(pickWritable)
    .extend({ id: z.uuid() }); // 🔴 Е0: ключ генерує клієнт. z.uuid() — єдина форма в плані (канон Zod 4)
  const patchSchema = createUpdateSchema(config.table).pick(pickWritable);

  const insertSchema = z.array(insertRowSchema).min(1).max(100);
  const updateSchema = z.array(z.object({ id: z.uuid(), patch: patchSchema })).min(1).max(100);
  const removeSchema = z.array(z.object({ id: z.uuid() })).min(1).max(100);

  /**
   * Спільна склейка К3-13: перший рубіж → роль від субʼєкта → транзакція.
   *
   * 🔴 Grant НЕ відкидається (рев'ю р2: `const { subject } = …` зʼїдав
   * scope, який Task 5 спеціально повертає). Фабрика обслуговує ЛИШЕ
   * admin-поверхню: scope 'own' тут структурно непідтримуваний (немає
   * owner-колонки), тож fail-loud — 'own'-ресурси (orders/profiles у
   * Е4+) пишуться іменованими операціями, які scope ЧЕСНО звужують.
   */
  const run = async <Out>(
    fn: (db: ActorDb, grant: Awaited<ReturnType<typeof requireGrant>>) => Promise<Out>,
  ): Promise<Out> => {
    const grant = await requireGrant(config.operation);
    if (grant.scope !== 'any')
      throw new Error(
        `[admin-server] ${config.entity}: операція ${config.operation} дала scope '${grant.scope}' — фабрика обслуговує лише admin-scope 'any'; own-звуження пишеться іменованою операцією`,
      );
    return withActor(
      { role: dbRoleForSubject(grant.subject), userId: grant.subject.userId ?? undefined },
      (db) => fn(db, grant),
    );
  };

  return {
    entity: config.entity,
    mode: config.mode,
    rowSchema, insertSchema, updateSchema, removeSchema,
    subsetSchema: subsetInputSchema,

    list: async ({ data }: { data: SubsetPayload }) =>
      run(async (db, _grant) => {
        const s = toDrizzleSubset(config.table, allow, data.subset ?? {});
        let q = db.select().from(config.table as never).$dynamic();
        if (s.where) q = q.where(s.where);
        if (s.orderBy) q = q.orderBy(...s.orderBy);
        else if (config.defaultOrder) {
          // 🔴 defaultOrder ЗАСТОСОВУЄТЬСЯ (мертвий параметр старої редакції).
          const col = columns[config.defaultOrder.column];
          if (col === undefined)
            throw new Error(`[admin-server] ${config.entity}: defaultOrder.column "${config.defaultOrder.column}" немає в таблиці`);
          q = q.orderBy(config.defaultOrder.direction === 'desc' ? desc(col) : asc(col));
        }
        if (s.limit !== undefined) q = q.limit(s.limit);
        if (s.offset !== undefined) q = q.offset(s.offset);
        return q;
      }),

    insert: async ({ data }: { data: z.infer<typeof insertSchema> }) =>
      run(async (db) =>
        // 🔴 batch: УСІ рядки транзакції, не [0] — інакше решта оптимістичних
        // мутацій «підтвердяться» локально без запису в БД.
        db.insert(config.table).values(data as never).returning(),
      ),

    update: async ({ data }: { data: z.infer<typeof updateSchema> }) =>
      run(async (db) => {
        const out = [];
        for (const { id, patch } of data) {
          const [row] = await db
            .update(config.table).set(patch as never)
            .where(eq(columns['id'], id as never)).returning();
          if (!row) throw new Error(`[admin-server] ${config.entity}: рядка ${id} не існує`);
          out.push(row);
        }
        return out;
      }),

    remove: async ({ data }: { data: z.infer<typeof removeSchema> }) =>
      run(async (db) => {
        const ids = data.map((d) => d.id);
        const rows = await db
          .delete(config.table)
          .where(inArray(columns['id'], ids as never)).returning();
        return { count: rows.length };
      }),
  };
}

export type AdminResourceOps<T extends Table> = ReturnType<typeof defineAdminResource<T, ColumnName<T>, ColumnName<T>>>;
```

🔴 `z.uuid()` — форма Zod 4 (не `z.string().uuid()`); якщо typecheck
свариться — звірити з фактичним експортом встановленого zod і вжити чинну.

Run: тест → PASS 5/5; `pnpm typecheck` → PASS (включно з `@ts-expect-error`-кейсами).

- [ ] **Step 3: Коміт**

```bash
git add packages/simplycms/src/admin-server
git commit -m "feat(v2-k3): defineAdminResource — операції і схеми, БЕЗ serverFn (К3-4′)

Фабрика віддає готові хендлери ({data})=>… і drizzle-zod-схеми; batch
масивами; defaultOrder застосований; exhaustiveness колонок — умовним
типом без as never; склейка requireGrant→dbRoleForSubject→withActor —
одна на всі операції, auth строго ДО транзакції (К3-13).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: `order_statuses` — ops, іменовані операції, явні serverFn, entry

**Files:**
- Create: `packages/simplycms/src/admin-server/resources/order-statuses.ts`
- Create: `packages/simplycms/src/admin-server/operations/order-status-default.ts`
- Create: `packages/simplycms/src/admin-server/operations/order-status-reorder.ts`
- Create: `packages/simplycms/src/admin-server/operations/order-status-remove.ts`
- Create: `packages/simplycms/src/admin-server/index.ts`
- Create: `packages/simplycms/test-harness/pg/__tests__/admin-order-statuses.test.ts`
- Modify: `packages/simplycms/package.json` (exports + publishConfig `./admin-server`)
- Modify: `packages/simplycms/tsup.config.ts`
- Modify: `scripts/pilot-pack/gate-c.mjs`

**Interfaces:**
- Consumes: Task 7 (`defineAdminResource`), Task 5 (`requireGrant`), Task 0 (індекс `idx_order_statuses_single_default`).
- Produces (для Task 9/10): serverFn з `simplycms/admin-server`:
  `listOrderStatuses({ data: SubsetPayload })` · `insertOrderStatuses({ data: InsertRow[] })` · `updateOrderStatuses({ data: {id,patch}[] })` · `removeOrderStatuses({ data: {id}[] })` · `setDefaultOrderStatus({ data: { id } })` · `reorderOrderStatus({ data: { id, direction: 'up'|'down' } })`.

🔴 **Розріз по інваріантах** (критерій К3-4′): `isDefault` НЕ у `writable`
(зміна дефолту — лише `setDefault`); `remove` теж іменований — «не
видалити останній дефолт» тримається сьогодні лише UI-`disabled`, а
частковий індекс забороняє ДВА дефолти, не НУЛЬ; `reorder` — swap двох
рядків в одній транзакції (стара сторінка робила два запити з браузера).

- [ ] **Step 1: Ресурс (server-only)**

```ts
// packages/simplycms/src/admin-server/resources/order-statuses.ts
import { orderStatuses } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * 🔴 isDefault — у readonly: інваріант «дефолт рівно один» не проходить
 * через generic-write (форма сторінки має чекбокс — він кличе setDefault
 * ОКРЕМИМ викликом після insert/update). sortOrder — writable: клієнт
 * (eager-колекція = повна копія) рахує max+1 сам.
 */
export const orderStatusesOps = defineAdminResource({
  entity: ENTITY.orderStatuses,
  table: orderStatuses,
  operation: 'catalog.write',
  mode: 'eager',
  filterable: ['code', 'isDefault'],
  sortable: ['sortOrder', 'name'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  writable: ['name', 'code', 'color', 'sortOrder'],
  readonly: ['id', 'isDefault', 'createdAt'],
});
```

- [ ] **Step 2: Іменовані операції (server-only; кожна — готовий handler)**

```ts
// packages/simplycms/src/admin-server/operations/order-status-default.ts
import { eq, ne, and } from 'drizzle-orm';
import { z } from 'zod';
import { orderStatuses } from 'simplycms/schema';
import { requireGrant, dbRoleForSubject } from 'simplycms/auth';
import { withActor } from 'simplycms/db';

export const setDefaultInput = z.object({ id: z.uuid() });

/**
 * Дефолт рівно один. 🔴 Порядок під частковим unique-індексом (Task 0):
 * СПОЧАТКУ зняти з інших, ПОТІМ поставити цільовий — зворотний порядок
 * дав би два true одночасно і 23505. Вікна «нуль дефолтів» назовні немає:
 * обидва кроки в одній транзакції withActor; неіснуючий id → returning
 * порожній → throw → ROLLBACK повертає і знятий прапорець.
 */
export const setDefaultOrderStatusOp = async ({ data }: { data: z.infer<typeof setDefaultInput> }) => {
  const { subject } = await requireGrant('catalog.write');
  return withActor({ role: dbRoleForSubject(subject), userId: subject.userId ?? undefined }, async (db) => {
    await db.update(orderStatuses).set({ isDefault: false })
      .where(and(eq(orderStatuses.isDefault, true), ne(orderStatuses.id, data.id)));
    const [row] = await db.update(orderStatuses).set({ isDefault: true })
      .where(eq(orderStatuses.id, data.id)).returning();
    if (!row) throw new Error(`[admin-server] статусу ${data.id} не існує`);
    return row;
  });
};
```

```ts
// packages/simplycms/src/admin-server/operations/order-status-reorder.ts
import { asc, desc, eq, gt, lt } from 'drizzle-orm';
import { z } from 'zod';
import { orderStatuses } from 'simplycms/schema';
import { requireGrant, dbRoleForSubject } from 'simplycms/auth';
import { withActor } from 'simplycms/db';

export const reorderInput = z.object({ id: z.uuid(), direction: z.enum(['up', 'down']) });

/**
 * Swap sort_order із сусідом — В ОДНІЙ транзакції (стара сторінка робила
 * два запити з браузера: перший пройшов/другий упав = два однакові
 * sort_order). Сусід шукається В БД за фактичним sort_order, не в
 * клієнтському кеші. Краю (немає сусіда) — no-op, повертає обидва
 * незмінені рядки порожнім масивом swap.
 */
export const reorderOrderStatusOp = async ({ data }: { data: z.infer<typeof reorderInput> }) => {
  const { subject } = await requireGrant('catalog.write');
  return withActor({ role: dbRoleForSubject(subject), userId: subject.userId ?? undefined }, async (db) => {
    // FOR UPDATE (рев'ю р2): конкурентні overlapping-swap без локів могли
    // б лишити дубльовані sort_order.
    const [current] = await db.select().from(orderStatuses)
      .where(eq(orderStatuses.id, data.id)).for('update');
    if (!current) throw new Error(`[admin-server] статусу ${data.id} не існує`);
    const [neighbor] = await db.select().from(orderStatuses)
      .where(data.direction === 'up'
        ? lt(orderStatuses.sortOrder, current.sortOrder)
        : gt(orderStatuses.sortOrder, current.sortOrder))
      .orderBy(data.direction === 'up' ? desc(orderStatuses.sortOrder) : asc(orderStatuses.sortOrder))
      .limit(1).for('update');
    if (!neighbor) return { swapped: [] as (typeof current)[] };
    const swapped = [
      (await db.update(orderStatuses).set({ sortOrder: neighbor.sortOrder })
        .where(eq(orderStatuses.id, current.id)).returning())[0],
      (await db.update(orderStatuses).set({ sortOrder: current.sortOrder })
        .where(eq(orderStatuses.id, neighbor.id)).returning())[0],
    ];
    return { swapped };
  });
};
```

```ts
// packages/simplycms/src/admin-server/operations/order-status-remove.ts
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { orderStatuses } from 'simplycms/schema';
import { requireGrant, dbRoleForSubject } from 'simplycms/auth';
import { withActor } from 'simplycms/db';

export const removeStatusInput = z.object({ id: z.uuid() });
export const removeManyInput = z.array(removeStatusInput).min(1).max(100);

/**
 * 🔴 remove для ЦІЄЇ сутності — іменований: «не видалити дефолтний» —
 * доменний інваріант, який частковий індекс не покриває (він забороняє
 * ДВА дефолти, не НУЛЬ), а сьогодні його тримає лише disabled-кнопка UI.
 *
 * 🔴 АТОМАРНО і без TOCTOU (рев'ю р2): один requireGrant, ОДНА
 * транзакція на весь batch; рядки беруться `FOR UPDATE` — конкурентний
 * setDefault чекає на лок і не зробить рядок дефолтним між перевіркою і
 * delete; будь-яка відмова відкочує ВЕСЬ batch — БД і оптимістичний стан
 * колекції не розходяться (TanStack DB теж відкочує транзакцію цілком).
 */
export const removeManyOrderStatusesOp = async ({ data }: { data: z.infer<typeof removeManyInput> }) => {
  const { subject } = await requireGrant('catalog.write');
  return withActor({ role: dbRoleForSubject(subject), userId: subject.userId ?? undefined }, async (db) => {
    const ids = data.map((d) => d.id);
    const rows = await db.select().from(orderStatuses)
      .where(inArray(orderStatuses.id, ids)).for('update');
    if (rows.length !== ids.length) {
      const found = new Set(rows.map((r) => r.id));
      const missing = ids.filter((id) => !found.has(id));
      throw new Error(`[admin-server] статусів не існує: ${missing.join(', ')}`);
    }
    const def = rows.find((r) => r.isDefault);
    if (def) throw new Error('[admin-server] дефолтний статус видалити не можна — призначте інший дефолт');
    const deleted = await db.delete(orderStatuses)
      .where(inArray(orderStatuses.id, ids)).returning();
    return { count: deleted.length };
  });
};
```

- [ ] **Step 3: `impl`-барель нутрощів + ЄДИНИЙ serverFn-модуль (К3-4′/К3-9′)**

```ts
// packages/simplycms/src/admin-server/impl.ts
/**
 * 🔴 Server-only барель нутрощів — ДЗЕРКАЛО механіки
 * `storefront-routes/server/*` ↔ `storefront/loaders`: index.ts імпортує
 * звідси BARE-специфікатором `simplycms/admin-server/impl`, tsup лишає
 * його зовнішнім, тож у dist це ОКРЕМИЙ модуль. Саме на цьому тримається
 * розрізнювальна здатність Gate C: нетрансформований index тягне impl —
 * і payload-маркер червоніє; трансформований стаб імпорту не має (DCE).
 * Однаковий префікс id стаба й нутрощів такої здатності не дає — це
 * знахідка рев'ю ред.2.
 */
export { orderStatusesOps } from './resources/order-statuses';
export { setDefaultInput, setDefaultOrderStatusOp } from './operations/order-status-default';
export { reorderInput, reorderOrderStatusOp } from './operations/order-status-reorder';
export {
  removeStatusInput, removeManyInput, removeManyOrderStatusesOp,
} from './operations/order-status-remove';
```

```ts
// packages/simplycms/src/admin-server/index.ts
import { createServerFn } from '@tanstack/react-start';
// 🔴 BARE-специфікатор, не './impl': відносний імпорт tsup заінлайнив би,
// і розрізнення «стаб vs нетрансформований» у dist зникло б (див. impl.ts).
import {
  orderStatusesOps,
  setDefaultInput, setDefaultOrderStatusOp,
  reorderInput, reorderOrderStatusOp,
  removeManyInput, removeManyOrderStatusesOp,
} from 'simplycms/admin-server/impl';

/**
 * 🔴 Публічна поверхня admin-server: ЛИШЕ serverFn (К3-9′ п.1). Жодного
 * живого не-serverFn експорту: клієнтська трансформація Start вирізає
 * inputValidator і handler та чистить осиротілі імпорти DCE-проходом —
 * але лише доки їх не тримає інший живий експорт. Схеми/операції назовні
 * НЕ реекспортуються.
 */
export const listOrderStatuses = createServerFn({ method: 'GET' })
  .inputValidator(orderStatusesOps.subsetSchema)
  .handler(orderStatusesOps.list);

export const insertOrderStatuses = createServerFn({ method: 'POST' })
  .inputValidator(orderStatusesOps.insertSchema)
  .handler(orderStatusesOps.insert);

export const updateOrderStatuses = createServerFn({ method: 'POST' })
  .inputValidator(orderStatusesOps.updateSchema)
  .handler(orderStatusesOps.update);

// 🔴 remove ЦІЄЇ сутності — guarded-операція, не фабричний ops.remove:
// «не видалити дефолтний» — доменний інваріант (критерій К3-4′).
export const removeOrderStatuses = createServerFn({ method: 'POST' })
  .inputValidator(removeManyInput)
  .handler(removeManyOrderStatusesOp);

export const setDefaultOrderStatus = createServerFn({ method: 'POST' })
  .inputValidator(setDefaultInput)
  .handler(setDefaultOrderStatusOp);

export const reorderOrderStatus = createServerFn({ method: 'POST' })
  .inputValidator(reorderInput)
  .handler(reorderOrderStatusOp);
```

- [ ] **Step 4: Інтеграційні тести проти живої БД — ОПЕРАЦІЙ, не serverFn**

```ts
// packages/simplycms/test-harness/pg/__tests__/admin-order-statuses.test.ts
// Шапка: resolveHarness → createTempDatabase → applySqlFiles(канон) →
// process.env.DATABASE_URL = withUser(dbUrl,'app_runtime') → afterAll із
// closeDbPool() ПЕРШИМ (точна копія패 патерну aggregate-deps.test.ts).
// 🔴 serverFn тут не викликаються (getRequest без ALS падає) — мокаємо
// requireGrant модульним моком і кличемо operations/ops напряму:
import { vi } from 'vitest';
// (мок ОГОЛОШУЄТЬСЯ до імпортів операцій — vitest hoist-ить vi.mock)
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({ subject: { userId: null, roles: ['admin'] }, scope: 'any' })),
}));

import {
  orderStatusesOps, setDefaultOrderStatusOp,
  reorderOrderStatusOp, removeManyOrderStatusesOp,
} from 'simplycms/admin-server/impl';
// 🔴 impl — службовий server-only субшлях (дзеркало ./storefront/loaders):
// у тестах харнеса легальний; клієнтський код його не імпортує ніколи
// (Gate C: payload-маркер).

describe('order_statuses: операції проти живої БД', () => {
  it('setDefault переносить прапорець в одній транзакції', async () => {
    const before = await queryRows(dbUrl, `select id, is_default from public.order_statuses order by sort_order`);
    const target = before.find((r) => !r.is_default)!;
    await setDefaultOrderStatusOp({ data: { id: target.id } });
    const after = await queryRows(dbUrl, `select id, is_default from public.order_statuses`);
    expect(after.filter((r) => r.is_default)).toHaveLength(1);
    expect(after.find((r) => r.is_default)!.id).toBe(target.id);
  });

  it('setDefault на неіснуючий id — магазин НЕ лишається без дефолту', async () => {
    await expect(setDefaultOrderStatusOp({ data: { id: crypto.randomUUID() } })).rejects.toThrow();
    const after = await queryRows(dbUrl, `select is_default from public.order_statuses`);
    expect(after.filter((r) => r.is_default)).toHaveLength(1);
  });

  it('reorder свапає сусідів; на краю — no-op', async () => {
    const list = await queryRows(dbUrl, `select id, sort_order from public.order_statuses order by sort_order`);
    await reorderOrderStatusOp({ data: { id: list[1].id, direction: 'up' } });
    const after = await queryRows(dbUrl, `select id from public.order_statuses order by sort_order`);
    expect(after[0].id).toBe(list[1].id);
    const top = await reorderOrderStatusOp({ data: { id: list[1].id, direction: 'up' } });
    expect(top.swapped).toHaveLength(0);
  });

  it('remove: batch [звичайний, дефолтний] — АТОМАРНА відмова, нічого не видалено', async () => {
    const rows = await queryRows(dbUrl, `select id, is_default from public.order_statuses`);
    const def = rows.find((r) => r.is_default)!;
    const plain = rows.find((r) => !r.is_default)!;
    await expect(
      removeManyOrderStatusesOp({ data: [{ id: plain.id }, { id: def.id }] }),
    ).rejects.toThrow(/дефолтний/);
    const after = await queryRows(dbUrl, `select id from public.order_statuses`);
    expect(after.map((r) => r.id)).toContain(plain.id); // не видалений — rollback усього batch
    // Недефолтний окремо — ок.
    await removeManyOrderStatusesOp({ data: [{ id: plain.id }] });
  });

  it('фабричний insert: batch масивом, id від клієнта, returning усі', async () => {
    const a = crypto.randomUUID(); const b = crypto.randomUUID();
    const out = await orderStatusesOps.insert({ data: [
      { id: a, name: 'Тест А', code: 'test-a', color: '#111111', sortOrder: 90 },
      { id: b, name: 'Тест Б', code: 'test-b', color: '#222222', sortOrder: 91 },
    ]});
    expect(out.map((r) => r.id).sort()).toEqual([a, b].sort());
  });

  it('list: defaultOrder застосовано без явного sorts', async () => {
    const rows = await orderStatusesOps.list({ data: {} });
    const orders = rows.map((r) => r.sortOrder);
    expect([...orders].sort((x, y) => x - y)).toEqual(orders);
  });
});
```

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/admin-order-statuses.test.ts`
Expected: спершу FAIL (модулів немає на момент написання — TDD), після Steps 1–3 → PASS 6/6.

- [ ] **Step 5: exports + tsup + Gate C**

`package.json` (обидві мапи): `"./admin-server": "./src/admin-server/index.ts"`
**і** `"./admin-server/impl": "./src/admin-server/impl.ts"` (службовий
server-only субшлях — дзеркало ролі `./storefront/loaders`; у публічну
документацію не виноситься); publishConfig — обидва з dist-дзеркалами.

`tsup.config.ts` — ОКРЕМИЙ профіль (перед `db`):
```ts
// serverFn-шар адмінки (Е1б, К3-9′): ДВА entry. index — serverFn-стаби
// (імпортує impl BARE-специфікатором, tsup лишає його зовнішнім);
// impl — server-only нутрощі (фабрика/операції/схеми інлайняться сюди,
// splitting:false). Саме ця пара дає Gate C розрізнення «стаб vs
// нетрансформований модуль» — механіка та сама, що server/ ↔ loaders/.
// БЕЗ platform:'node' — index імпортує клієнтський граф (стаби).
profile('admin-server', ['src/admin-server/index.ts', 'src/admin-server/impl.ts'], { splitting: false }),
```

`scripts/pilot-pack/gate-c.mjs` — ДВІ правки:
```js
// У SERVER_PAYLOAD (поруч із /storefront\/loaders\//):
// Нутрощі admin-server: у клієнті їх не може бути ЗА ЖОДНИХ умов.
// Нетрансформований index тягне impl живим імпортом — маркер червоніє
// навіть якби drizzle туди не доїхав (делегуюча операція без drizzle).
/simplycms\/dist\/admin-server\/impl/,
```
```js
// Окремий стаб-маркер: форма dist/admin-server/ не матчить SERVER_FN_STUB
// (той вимагає сегмент /server/ ПІСЛЯ теки). 🔴 index, НЕ impl.
const ADMIN_SERVER_STUB = /simplycms\/dist\/admin-server\/index/;
```
🔴 **На межі Task 8 присутність стаба в клієнтських чанках асертити НЕ
МОЖНА** (розвилка R10 імплементації): жоден клієнтський файл ще не
імпортує `simplycms/admin-server` — сторінка переводиться в Task 10, і
Vite не кладе в бандл модуль без імпорту. Тому в Task 8 Gate C отримує:
(а) leak-половину безумовно — `impl` у `SERVER_PAYLOAD`; (б) доказ, що
tsup РОЗДІЛИВ entry — існування `dist/admin-server/index.js` і
`dist/admin-server/impl.js` у встановленому пакеті; (в) лічильник
`ADMIN_SERVER_STUB` як INFO (0 очікувано). Сувора присутність стаба —
обовʼязковий крок Task 10 (Step 4б), щойно сторінка споживає serverFn.
Чинні `/drizzle-orm/` і `pg` лишаються другим рубежем.

- [ ] **Step 6: Гейти й коміт**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages && pnpm test:packaging && pnpm pilot:pack
git add packages/simplycms scripts/pilot-pack/gate-c.mjs
git commit -m "feat(v2-k3): order_statuses — ops + 3 іменовані операції + явні serverFn

Перша сутність наскрізь: фабричні list/insert/update/remove (batch,
defaultOrder) + setDefault (порядок unset→set під частковим індексом) +
reorder (транзакційний swap замість двох запитів із браузера) + remove
(дефолтний захищений сервером, не disabled-кнопкою). serverFn — шість
топ-рівневих const у єдиному модулі поверхні; tsup-профіль splitting:false;
Gate C отримав стаб-маркер admin-server.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---
# Частина 3 — клієнтський шар і гейти (Tasks 9–11)

**DoD частини 3:** = DoD етапу (нижче).

### Task 9: `admin-data` — типізований реєстр + колекція `order_statuses`

**Files:**
- Create: `packages/simplycms/src/admin-data/registry.ts`, `index.ts`
- Create: `packages/simplycms/src/admin-data/collections/order-statuses.ts`
- Create: `packages/simplycms/src/admin-data/__tests__/registry.test.tsx`
- Create: `packages/simplycms/src/admin-data/__tests__/order-statuses-collection.test.ts`
- Modify: `eslint.tier-zones.mjs` (+ `tests/tier-boundary.test.ts`), `eslint.config.mjs` (зони `query-key-from-entity` та i18n += `admin-data`), `packages/simplycms/package.json` (обидві мапи `./admin-data`), `tsup.config.ts` (entry у профіль `tiers`)

**Interfaces:**
- Consumes: serverFn Task 8; `entityKey`/`ENTITY` (Е1а); `type OrderStatus` з `simplycms/schema/types` (**type-only**).
- Produces: `CollectionDef<C>`; `getCollection<C>(queryClient, def): C`; `useCollection<C>(def): C`; `orderStatusesCollection` (typed def). Task 10 споживає всі три.

🔴 К3-9′ п.3: колекція БЕЗ `schema` (вона валідує лише оптимістичні
insert/update, дані queryFn — ні; а імпорт drizzle-zod-схеми тягнув би
drizzle у клієнт — заборонено Gate C). Тип рядка — generic.

- [ ] **Step 1: Падаючі тести реєстру**

```tsx
// @vitest-environment jsdom
// (vitest.config: environment 'node' — без директиви renderHook упаде
// на document is not defined; патерн — як у сусідніх hook-тестах репо)
// packages/simplycms/src/admin-data/__tests__/registry.test.tsx
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getCollection, useCollection, type CollectionDef } from '../registry';

const probeDef: CollectionDef<{ marker: string }> = {
  id: 'probe',
  create: () => ({ marker: Math.random().toString(36) }),
};

const wrap = (client: QueryClient) =>
  function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

describe('admin-data/registry', () => {
  it('той самий QueryClient — той самий інстанс (typed, без ре-створення)', () => {
    const client = new QueryClient();
    const { result, rerender } = renderHook(() => useCollection(probeDef), { wrapper: wrap(client) });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(getCollection(client, probeDef)).toBe(first);
  });

  it('різні QueryClient — різні інстанси (нуль протікання між запитами)', () => {
    const a = getCollection(new QueryClient(), probeDef);
    const b = getCollection(new QueryClient(), probeDef);
    expect(a).not.toBe(b);
  });
});
```

Run: `pnpm vitest run packages/simplycms/src/admin-data/__tests__/registry.test.tsx` → FAIL (модуля немає).

- [ ] **Step 2: Реєстр**

```ts
// packages/simplycms/src/admin-data/registry.ts
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

/**
 * Реєстр колекцій, ключований QueryClient (патерн business-scope з
 * офіційного query-adapter.md). WeakMap, не singleton: на сервері кожен
 * запит має власний QueryClient (Е1а), спільний інстанс протік би між
 * користувачами; WeakMap заразом прибирає записи разом із клієнтом.
 *
 * 🔴 Generic C зберігає конкретний тип колекції наскрізь — типізовані
 * рядки в useLiveQuery і typed utils (стирання через
 * ReturnType<typeof createCollection> — дефект старої редакції).
 */
export interface CollectionDef<C> {
  readonly id: string;
  readonly create: (queryClient: QueryClient) => C;
}

const byClient = new WeakMap<QueryClient, Map<string, unknown>>();

export function getCollection<C>(client: QueryClient, def: CollectionDef<C>): C {
  let byId = byClient.get(client);
  if (!byId) byClient.set(client, (byId = new Map()));
  let collection = byId.get(def.id) as C | undefined;
  if (!collection) byId.set(def.id, (collection = def.create(client)));
  return collection;
}

/** Хук-обгортка: клієнт із контексту. Інстанс стабільний у межах клієнта. */
export function useCollection<C>(def: CollectionDef<C>): C {
  return getCollection(useQueryClient(), def);
}
```

Run: тест → PASS 2/2.

- [ ] **Step 3: Падаючий тест колекції (id-mismatch + batch)**

```ts
// packages/simplycms/src/admin-data/__tests__/order-statuses-collection.test.ts
import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const insertMock = vi.fn(async ({ data }: { data: { id: string }[] }) =>
  data.map((r) => ({ isDefault: false, createdAt: '2026-01-01', color: null, sortOrder: 0, ...r })));
vi.mock('simplycms/admin-server', () => ({
  listOrderStatuses: vi.fn(async () => []),
  insertOrderStatuses: insertMock,
  updateOrderStatuses: vi.fn(async ({ data }) => data.map((d: { id: string }) => ({ id: d.id }))),
  removeOrderStatuses: vi.fn(async () => ({ count: 1 })),
  setDefaultOrderStatus: vi.fn(),
  reorderOrderStatus: vi.fn(),
}));

import { getCollection } from '../registry';
import { orderStatusesCollection } from '../collections/order-statuses';

describe('колекція order_statuses', () => {
  it('id колекції — з ENTITY (значення "order_statuses" з реєстру, не довільне)', () => {
    expect(orderStatusesCollection.id).toBe('order_statuses');
  });

  it('batch-insert шле ВСІ мутації транзакції одним викликом', async () => {
    const c = getCollection(new QueryClient(), orderStatusesCollection);
    // 🔴 Sync-контекст ОБОВʼЯЗКОВИЙ до мутацій: createCollection у 0.8.6
    // стартує sync лише при явному startSync===true (collection/index.js:115),
    // query-адаптер його не передає, а writeUpsert/writeBatch без контексту
    // кидає SyncNotInitializedError (manual-sync.js:122). Прод-шлях це
    // робить preload-ом у loader (Task 10) — тест дзеркалить його.
    await c.preload();
    const rows = [
      { id: crypto.randomUUID(), name: 'А', code: 'a', color: '#111111', sortOrder: 1 },
      { id: crypto.randomUUID(), name: 'Б', code: 'b', color: '#222222', sortOrder: 2 },
    ];
    const tx = c.insert(rows as never);
    await tx.isPersisted.promise;
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0].data).toHaveLength(2);
  });

  it('live-стан живий: оптимістичний рядок видимий СИНХРОННО, після персисту — серверні значення', async () => {
    // Позитивний контроль (рев'ю ред.2): без нього мок serverFn звів би
    // тест до перевірки хендлерів, а заявляє він інтеграцію з колекцією.
    const c = getCollection(new QueryClient(), orderStatusesCollection);
    await c.preload(); // sync-контекст (див. коментар у batch-тесті)
    const id = crypto.randomUUID();
    const tx = c.insert({ id, name: 'Live', code: 'live', color: null, sortOrder: 5 } as never);
    expect(c.has(id), 'оптимістичний рядок не зʼявився в тому ж тіку').toBe(true);
    await tx.isPersisted.promise;
    expect(c.has(id), 'після персисту рядок зник').toBe(true);
    expect(c.get(id)?.createdAt, 'write-back не доніс серверних полів').toBe('2026-01-01');
  });

  it('розходження ключів — fail-loud ДО write-back, рядків-двійників немає', async () => {
    insertMock.mockImplementationOnce(async () => [{ id: 'server-generated', name: 'X', code: 'x', color: null, sortOrder: 0, isDefault: false, createdAt: '2026-01-01' }]);
    const c = getCollection(new QueryClient(), orderStatusesCollection);
    await c.preload(); // sync-контекст (див. коментар у batch-тесті)
    const optimisticId = crypto.randomUUID();
    const tx = c.insert({ id: optimisticId, name: 'X', code: 'x', color: null, sortOrder: 0 } as never);
    await expect(tx.isPersisted.promise).rejects.toThrow(/id/);
    expect(c.has(optimisticId), 'оптимістичний рядок лишився').toBe(false);
    expect(c.has('server-generated'), 'серверний двійник потрапив').toBe(false);
  });
});
```

Run: → FAIL (модуля немає).

- [ ] **Step 4: Колекція**

```ts
// packages/simplycms/src/admin-data/collections/order-statuses.ts
import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import type { OrderStatus } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertOrderStatuses, listOrderStatuses,
  removeOrderStatuses, updateOrderStatuses,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';

const key = entityKey(ENTITY.orderStatuses);

/**
 * Довідник статусів — режим eager (К3-5): обмежений розмір, повна
 * колекція в памʼяті. 🔴 queryKey = entityKey(...).list() — той самий
 * префікс, що в решти запитів сутності (Б-2). schema НЕ передається
 * (К3-9′ п.3): тип — generic OrderStatus, рантайм-валідація — на сервері.
 */
function create(queryClient: QueryClient) {
  const collection = createCollection(
    queryCollectionOptions<OrderStatus>({
      id: ENTITY.orderStatuses,
      queryClient,
      queryKey: key.list(),
      getKey: (row) => row.id,
      queryFn: async () => listOrderStatuses({ data: {} }),

      onInsert: async ({ transaction }) => {
        // 🔴 batch: УСІ мутації транзакції (дефект [0] старої редакції).
        const drafts = transaction.mutations.map((m) => m.modified);
        const rows = await insertOrderStatuses({ data: drafts as never });
        // 🔴 Fail-loud ДО write-back: інакше в synced-store ляжуть ДВА
        // рядки — серверний під своїм ключем і оптимістичний під
        // клієнтським, що зникне на commit (урок favorites MetaHub).
        for (const [i, row] of rows.entries()) {
          if (row.id !== (drafts[i] as OrderStatus).id)
            throw new Error(`[admin-data] сервер повернув id "${row.id}" замість "${(drafts[i] as OrderStatus).id}" — write-back писав би не в той ключ`);
        }
        collection.utils.writeBatch(() => {
          for (const row of rows) collection.utils.writeUpsert(row);
        });
        return { refetch: false };
      },

      onUpdate: async ({ transaction }) => {
        const patches = transaction.mutations.map((m) => ({ id: m.key as string, patch: m.changes }));
        const rows = await updateOrderStatuses({ data: patches as never });
        collection.utils.writeBatch(() => {
          for (const row of rows) collection.utils.writeUpsert(row);
        });
        return { refetch: false };
      },

      onDelete: async ({ transaction }) => {
        const ids = transaction.mutations.map((m) => ({ id: m.key as string }));
        await removeOrderStatuses({ data: ids as never });
        collection.utils.writeBatch(() => {
          for (const { id } of ids) collection.utils.writeDelete(id);
        });
        return { refetch: false };
      },
    }),
  );
  return collection;
}

export type OrderStatusesCollection = ReturnType<typeof create>;
export const orderStatusesCollection: CollectionDef<OrderStatusesCollection> = {
  id: ENTITY.orderStatuses,
  create,
};
```

```ts
// packages/simplycms/src/admin-data/index.ts
export { getCollection, useCollection } from './registry';
export type { CollectionDef } from './registry';
export { orderStatusesCollection } from './collections/order-statuses';
export type { OrderStatusesCollection } from './collections/order-statuses';
```

Run: обидва тести → PASS.

🔴 `collection.delete(id)` → `onDelete` → serverFn `removeOrderStatuses`,
який у Task 8 збудований на GUARDED-операції (`removeManyOrderStatusesOp`
— кожен id зі своєю перевіркою `is_default`): серверна заборона
видалення дефолтного діє й на цьому шляху, фабричний `ops.remove` для
цієї сутності serverFn-ом не експортується.

- [ ] **Step 5: Зони + entry + гейти**

`eslint.tier-zones.mjs`:
```js
// Колекції адмінки (Е1б) — T4: над contracts/schema-типами, під
// сторінками. Окремо від src/admin (T5): колекція — module-level стан.
['src/admin-data', 4, 'admin-data', []],
```
`tests/tier-boundary.test.ts` — запис зони (forbidden: `simplycms/admin`,
allowed: `simplycms/contracts`).

`eslint.config.mjs`: у files-блок правила `query-key-from-entity` додати
`'packages/simplycms/src/admin-data/**/*.{ts,tsx}'`; у i18n-зону — так само.

`package.json`: `"./admin-data": "./src/admin-data/index.ts"` +
publishConfig-дзеркало. `tsup.config.ts`: `'src/admin-data/index.ts'` у
масив entry профілю `tiers` (клієнтський React-тір, спільні чанки легальні).

```bash
pnpm lint && pnpm test && pnpm build:packages && pnpm test:packaging
```
Expected: PASS, 0 errors.

- [ ] **Step 6: Коміт**

```bash
git add packages/simplycms eslint.tier-zones.mjs eslint.config.mjs tests/tier-boundary.test.ts
git commit -m "feat(v2-k3): admin-data — типізований реєстр колекцій + order_statuses без schema

CollectionDef<C> зберігає тип наскрізь (WeakMap по QueryClient). Колекція
без schema (валідувала б лише optimistic-шлях, а тягла drizzle у клієнт) —
тип type-only OrderStatus. Batch у всіх хендлерах, fail-loud id-mismatch
ДО write-back, writeBatch+writeUpsert із refetch:false. Зони: тір T4,
query-key-from-entity та i18n накривають нову теку.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Сторінка `OrderStatuses` на `useLiveQuery` + живий прогін

**Files:**
- Modify: `packages/simplycms/src/admin/pages/OrderStatuses.tsx` (повне переписування, 537 рядків)
- Modify: `packages/simplycms/routes/admin/admin/order-statuses/index.tsx`

**Interfaces:**
- Consumes: `useCollection`/`getCollection`, `orderStatusesCollection` (`simplycms/admin-data`); `setDefaultOrderStatus`, `reorderOrderStatus` (`simplycms/admin-server`); `RouterContext` (`simplycms/runtime`); i18n-ключі `admin.orders.statuses.*` і `common.*` (усі вже в каталозі).

🔴 **Повний інвентар поведінки, яку НЕ МОЖНА загубити** (виміряно старою
сторінкою): create з `sortOrder = max+1`; редагування name/code/color;
чекбокс дефолту; delete з підтвердженням (дефолтний — disabled);
reorder стрілками (краї disabled); автогенерація code з name
(`generateCode`, вимикається після ручного редагування); 8 тостів
(`created/createFailed/statusUpdated/updateFailed/deleted/deleteFailed/
reorderFailed/requiredFields`); кольоровий кружечок; скелетон завантаження.

- [ ] **Step 1: Дані й мутації (ключові фрагменти)**

```tsx
// OrderStatuses.tsx — шар даних
import { useLiveQuery } from '@tanstack/react-db';
import { useCollection } from 'simplycms/admin-data';
import { orderStatusesCollection } from 'simplycms/admin-data';
import { reorderOrderStatus, setDefaultOrderStatus } from 'simplycms/admin-server';
import type { OrderStatus } from 'simplycms/schema/types';

const collection = useCollection(orderStatusesCollection);
// 🔴 Форма 0.3.6 — обʼєкт { query }; dependency-масиви legacy.
const { data: statuses, isLoading } = useLiveQuery({
  query: (q) => q.from({ s: collection }).orderBy(({ s }) => s.sortOrder, 'asc'),
});

/** create: клієнт рахує max+1 — eager-колекція і є повна копія. */
const handleCreate = (form: StatusFormData) => {
  if (!form.name.trim() || !form.code.trim()) {
    toast.error(t('admin.orders.statuses.requiredFields'));
    return;
  }
  const id = crypto.randomUUID(); // Е0: ключ генерує клієнт
  const sortOrder = (statuses ?? []).reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1;
  const tx = collection.insert({ id, name: form.name, code: form.code, color: form.color, sortOrder, isDefault: false, createdAt: new Date().toISOString() } as OrderStatus);
  // 🔴 Failure-state збережений (рев'ю р3, як у старій сторінці :104/:138):
  // діалог закривається ЛИШЕ після успішного персисту — при помилці
  // введене лишається у формі. Рядок у СПИСКУ все одно зʼявляється
  // миттєво (оптимістично) — DoD «створення миттєве» не страждає.
  // `isSubmitting` — заміна старого mutation.isPending на кнопці Save.
  setIsSubmitting(true);
  tx.isPersisted.promise
    .then(async () => {
      handleCloseDialog();
      // 🔴 Двофазність ЧЕСНА (рев'ю р2): insert уже закомічено, тож
      // падіння setDefault — НЕ createFailed. Рядок створено — кажемо
      // це, а про дефолт — окремою помилкою.
      toast.success(t('admin.orders.statuses.created'));
      if (form.is_default) {
        try { await applyDefault(id); }
        catch (e) { toast.error(t('admin.orders.statuses.updateFailed') + ' ' + (e as Error).message); }
      }
    })
    .catch((e: Error) => toast.error(t('admin.orders.statuses.createFailed') + ' ' + e.message))
    .finally(() => setIsSubmitting(false));
};

const handleUpdate = (id: string, form: StatusFormData) => {
  const tx = collection.update(id, (draft) => {
    draft.name = form.name; draft.code = form.code; draft.color = form.color;
  });
  setIsSubmitting(true);
  tx.isPersisted.promise
    .then(async () => {
      handleCloseDialog();
      // 🔴 Та сама чесна двофазність, що в create (рев'ю р3): update вже
      // закомічений окремим withActor — statusUpdated ДО default-фази,
      // її падіння — окремою помилкою, не «оновлення не вдалося».
      toast.success(t('common.statusUpdated'));
      if (form.is_default) {
        try { await applyDefault(id); }
        catch (e) { toast.error(t('admin.orders.statuses.updateFailed') + ' ' + (e as Error).message); }
      }
    })
    .catch((e: Error) => toast.error(t('admin.orders.statuses.updateFailed') + ' ' + e.message))
    .finally(() => setIsSubmitting(false));
};

const handleDelete = (id: string) => {
  const tx = collection.delete(id);
  tx.isPersisted.promise
    .then(() => toast.success(t('admin.orders.statuses.deleted')))
    .catch((e: Error) => toast.error(t('admin.orders.statuses.deleteFailed') + ' ' + e.message));
  setDeleteStatus(null);
};

/**
 * setDefault/reorder — серверні операції, що міняють N рядків: write-back
 * одного не описує стан → refetch. Це МЕЖА канону write-back, не виняток.
 */
const applyDefault = async (id: string) => {
  await setDefaultOrderStatus({ data: { id } });
  await collection.utils.refetch();
};
const handleReorder = async (id: string, direction: 'up' | 'down') => {
  try {
    await reorderOrderStatus({ data: { id, direction } });
    await collection.utils.refetch();
  } catch (e) {
    toast.error(t('admin.orders.statuses.reorderFailed') + ' ' + (e as Error).message);
  }
};
```

UI-частина (таблиця, діалоги, `generateCode`, кружечок кольору, disabled
на краях і на дефолтному delete, скелетон) — переноситься зі старої
версії 1:1 з трьома змінами: `const [isSubmitting, setIsSubmitting] =
useState(false)` замінює `createMutation.isPending || updateMutation.isPending`
на кнопці Save (`disabled={isSubmitting}`, стара :495); поля рядка тепер **camelCase**
(`sortOrder`/`isDefault`/`createdAt` — тип `OrderStatus` з Drizzle) і
чекбокс дефолту на редагуванні ДЕФОЛТНОГО рядка — disabled з
`title={t('admin.orders.statuses.autoAssign')}` (зняти дефолт без
призначення нового не можна — нуль дефолтів заборонений доменом).

- [ ] **Step 2: Guard secure context (К3-6) — у `beforeLoad` layout-роуту адмінки**

У `packages/simplycms/routes/admin/admin.tsx`, ПЕРШИМ рядком `beforeLoad`
(client-only, `ssr:false` — виконується рівно на старті адмінки):

```ts
// К3-6: crypto.randomUUID існує лише в secure context — адмінка на
// http:// не-localhost мовчки отримала б undefined на кожному create.
if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
  throw new Error(
    '[simplycms/admin] Адмінка вимагає secure context (https:// або localhost): crypto.randomUUID недоступний.',
  );
}
```

(Файл додається в Files цієї задачі: Modify `packages/simplycms/routes/admin/admin.tsx`.)

- [ ] **Step 3: Preload у loader роуту**

```tsx
// packages/simplycms/routes/admin/admin/order-statuses/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { getCollection, orderStatusesCollection } from 'simplycms/admin-data';
import OrderStatuses from 'simplycms/admin/pages/OrderStatuses';

export const Route = createFileRoute('/admin/order-statuses/')({
  // Батько /admin має ssr:false — loader КЛІЄНТСЬКИЙ; preload тут
  // стартує синк під час навігації, без спалаху порожньої таблиці.
  loader: async ({ context }) => {
    await getCollection(context.queryClient, orderStatusesCollection).preload();
    return null;
  },
  component: OrderStatuses,
});
```

(`context` типізується `RouterContext` з `simplycms/runtime` — Task 3.)

- [ ] **Step 4: Гейти**

```bash
pnpm lint && pnpm build && pnpm typecheck && pnpm test
```

- [ ] **Step 4б: Gate C — сувора присутність стаба (перенесено з Task 8, R10)**

Тепер сторінка імпортує `simplycms/admin-server`, тож стаб МУСИТЬ бути
в клієнтських чанках. У `scripts/pilot-pack/gate-c.mjs` перевести
лічильник `ADMIN_SERVER_STUB` з INFO в **обовʼязковий assert ≥ 1** поруч
із чинним `SERVER_FN_STUB`; leak-маркер `impl` лишається. Прогнати:

```bash
pnpm build:packages && pnpm pilot:pack
```
Expected: PASS; у виводі Gate C — `admin-server stub: N ≥ 1`, `impl` у
клієнті відсутній. **Негативний контроль:** тимчасово додати в
`OrderStatuses.tsx` `import { orderStatusesOps } from 'simplycms/admin-server/impl'`
(будь-яке вживання) → `pilot:pack` FAIL на leak-маркері → прибрати.
Expected: PASS, 0 errors. 🔴 Зелений лінт i18n-повноти сторінки НЕ
доводить (усі 8 рядків — у toast, які селектори не бачать за побудовою);
доводить ручна звірка інвентаря Step 1 із живим прогоном Step 5.

- [ ] **Step 5: ЖИВИЙ прогін — головний доказ етапу**

```bash
PG_HARNESS_URL="$PG_HARNESS_URL" pnpm db:demo
# адмін: v2-state-map.md §5 (issueOwnerInvite → пароль → вхід)
pnpm build && PORT=3141 pnpm start &
```

У браузері під адміном на `/admin/order-statuses`:
1. список рендериться з БД, порядок за `sortOrder`;
2. **створення** — рядок зʼявляється МИТТЄВО (до відповіді сервера), toast після персисту;
3. створення з чекбоксом дефолту — прапорець переїжджає (у старого зникає);
4. **видалення** — миттєво; спроба видалити дефолтний — кнопка disabled; via devtools-виклик serverFn напряму — 500 із текстом про дефолтний (сервер тримає, не UI);
5. **reorder** — стрілки міняють сусідів, порядок стабільний після F5;
6. консоль: нуль `console.error`;
7. **rollback**: зупинити сервер (`kill %1`) → створити рядок → рядок
   зʼявляється і сам ЗНИКАЄ, toast помилки; після рестарту сервера F5 —
   стан консистентний;
8. **редагування** — name/code/color: зміна видима миттєво, збережена
   після F5, діалог закрився після персисту;
9. **редагування з чекбоксом дефолту** — після збереження рівно один
   дефолт (у старого прапорець зник);
10. **rollback редагування** (сервер зупинений): зміна відкочується,
    **діалог лишається відкритим з введеними даними**, кнопка Save
    знову активна, toast `updateFailed`.

🔴 П. 7 і п. 10 — доказ того, заради чого оптимізм: авто-rollback
колекції і збережений failure-state форми (рев'ю р3/р4).

- [ ] **Step 6: Коміт**

```bash
git add packages/simplycms
git commit -m "feat(v2-k3): OrderStatuses на useLiveQuery — перша жива сторінка адмінки

Читання — живий запит колекції; create/update/delete — оптимістичні з
авто-rollback і тостами через isPersisted (лінт toast-рядків не бачить —
інвентар перенесено вручну: max+1, generateCode, disabled-межі, 8
тостів). setDefault/reorder — серверні операції з refetch (міняють N
рядків — межа канону write-back). preload у клієнтському loader.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Гейти кеш-синхронізації, реєстр винятків, повний ланцюг

**Files:**
- Create: `eslint-rules/mutation-cache-sync.mjs`
- Create: `tests/eslint-rules/mutation-cache-sync.test.ts`
- Create: `tests/handler-canon.test.ts`
- Create: `packages/simplycms/src/contracts/admin-server-first.ts` (+ тест `packages/simplycms/src/contracts/__tests__/admin-server-first.test.ts`)
- Modify: `eslint.config.mjs`

**Interfaces:**
- Produces: два незалежні гейти одного інваріанту (хуки ↔ persistence-хендлери) + реєстр К3-2.

- [ ] **Step 1: `handler-canon` — AST-гейт write-back (повна специфікація)**

```ts
// tests/handler-canon.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

/**
 * Кожен `return { refetch: false }` усередині onInsert/onUpdate/onDelete
 * мусить мати write-back (collection.utils.writeUpsert/writeUpdate/
 * writeInsert/writeDelete/writeBatch) СЕРЕД STATEMENT-ів, що передують
 * цьому return у його ланцюжку блоків (усі попередні сиблінги в кожному
 * батьківському Block аж до тіла хендлера).
 *
 * 🔴 Path-sensitive рівно настільки: `if (x) return {refetch:false}` без
 * write-back вище по ланцюжку — офендер; write-back у ЧУЖІЙ гілці не
 * рахується, бо він не передує return-у в його ланцюжку. Виняток —
 * коментар `// canon-exempt: <причина>` рядком вище return.
 * BASELINE порожній і лишається порожнім: гейт постійний.
 */
const ROOT = join(import.meta.dirname, '../packages/simplycms/src/admin-data');
const HANDLERS = new Set(['onInsert', 'onUpdate', 'onDelete']);
const WRITE_OPS = new Set(['writeUpsert', 'writeUpdate', 'writeInsert', 'writeDelete']);

function* tsFiles(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && e.name !== '__tests__') yield* tsFiles(p);
    else if (e.isFile() && /\.tsx?$/.test(e.name)) yield p;
  }
}

function offendersIn(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const out: string[] = [];

  const isRefetchFalse = (node: ts.Node): boolean =>
    ts.isReturnStatement(node) && !!node.expression &&
    ts.isObjectLiteralExpression(node.expression) &&
    node.expression.properties.some((p) =>
      ts.isPropertyAssignment(p) && p.name.getText() === 'refetch' &&
      p.initializer.kind === ts.SyntaxKind.FalseKeyword);

  const hasExempt = (node: ts.Node): boolean =>
    /canon-exempt:/.test(src.slice(Math.max(0, node.getFullStart() - 200), node.getStart()));

  /** Чи є в піддереві фактичний CallExpression collection.utils.write*(…). */
  const containsWriteCall = (n: ts.Node): boolean => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
        WRITE_OPS.has(n.expression.name.text)) return true;
    return ts.forEachChild(n, containsWriteCall) ?? false;
  };
  /**
   * Statement — справжній write-back: або прямий write*-виклик, або
   * `writeBatch(cb)`, чий callback САМ містить write*-виклик. Порожній
   * batch — не write-back.
   */
  const isRealWrite = (st: ts.ExpressionStatement): boolean => {
    const expr = st.expression;
    if (!ts.isCallExpression(expr) || !ts.isPropertyAccessExpression(expr.expression)) return false;
    const name = expr.expression.name.text;
    if (WRITE_OPS.has(name)) return true;
    if (name === 'writeBatch') {
      const cb = expr.arguments[0];
      return !!cb && containsWriteCall(cb);
    }
    return false;
  };

  const precededByWrite = (ret: ts.Node, boundary: ts.Node): boolean => {
    let cur: ts.Node = ret;
    while (cur !== boundary && cur.parent) {
      const parent = cur.parent;
      if (ts.isBlock(parent)) {
        for (const st of parent.statements) {
          if (st === cur) break;
          // 🔴 Зараховуємо лише БЕЗУМОВНИЙ write-statement (рев'ю р2:
          // `if (cond) writeUpsert(...)` — попередній сиблінг, але
          // write у чужій гілці; такий НЕ рахується — це IfStatement,
          // не ExpressionStatement). І лише за AST, не regex по тексту
          // (рев'ю р3): порожній `writeBatch(() => {})` чи слово в
          // коментарі/рядку — не write-back.
          if (ts.isExpressionStatement(st) && isRealWrite(st)) return true;
        }
      }
      cur = parent;
    }
    return false;
  };

  const visitHandlerBody = (body: ts.Node) => {
    const walk = (n: ts.Node) => {
      if (isRefetchFalse(n) && !hasExempt(n) && !precededByWrite(n, body))
        out.push(`${relative(process.cwd(), file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`);
      ts.forEachChild(n, walk);
    };
    walk(body);
  };

  const visit = (n: ts.Node) => {
    if ((ts.isPropertyAssignment(n) || ts.isMethodDeclaration(n)) &&
        HANDLERS.has(n.name.getText())) {
      const fn = ts.isPropertyAssignment(n) ? n.initializer : n;
      if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn) || ts.isMethodDeclaration(fn)) && fn.body)
        visitHandlerBody(fn.body);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

describe('handler-canon: refetch:false ⇒ write-back у своєму ланцюжку', () => {
  it('офендерів немає (BASELINE порожній назавжди)', () => {
    const offenders = [...tsFiles(ROOT)].flatMap(offendersIn);
    expect(offenders).toEqual([]);
  });
});
```

Run: `pnpm vitest run tests/handler-canon.test.ts` → PASS.
**Негативні контролі (УСІ ТРИ):** у `collections/order-statuses.ts`
тимчасово (1) прибрати `writeBatch`-блок в `onDelete` → FAIL; (2)
замінити його на `if (Math.random() > 2) collection.utils.writeDelete(ids[0].id);`
→ теж FAIL (умовний сиблінг); (3) замінити на порожній
`collection.utils.writeBatch(() => {});` → теж FAIL (рев'ю р3: batch без
write*-виклику всередині — не write-back)
→ повернути.

- [ ] **Step 2: `mutation-cache-sync` — правило на хуки**

```js
// eslint-rules/mutation-cache-sync.mjs
/**
 * Клієнтська мутація мусить лишати слід у кеші (урок №6 роадмапу:
 * колекція НЕ рефетчиться від invalidateQueries React Query).
 *
 * 🔴 Межа аналізу — ФУНКЦІЯ, не файл (рев'ю р3: файлова евристика
 * сліпа на змішаних сторінках — інший хендлер із синком «покривав» би
 * хендлер без нього, і негативний контроль на реальній сторінці був
 * фізично неможливий). Тригер — виклик serverFn, імпортованого з
 * 'simplycms/admin-server' (будь-яке імʼя, крім list*-читань), АБО
 * useMutation. Для кожного тригера береться найближча охоплююча функція
 * (стрілка/function/метод), і В НІЙ мусить бути синк:
 *   collection.utils.{refetch,writeUpsert,writeUpdate,writeDelete,writeBatch}
 *   АБО collection.insert/update/delete (оптимістичний шлях сам синкає)
 *   АБО invalidateQueries/setQueryData/refetchQueries (легасі React Query;
 *   але якщо файл імпортує simplycms/admin-data — цього НЕ досить,
 *   інвалідація колекцію не будить → invalidateOnly).
 * Виклики всередині persistence-хендлерів (onInsert/onUpdate/onDelete) —
 * поза правилом: їх стереже handler-canon. Виклик у loader (preload) —
 * теж поза правилом (читання). Opt-out — `// cache-sync-ok: <причина>`
 * рядком вище виклику.
 */
const SYNC_UTILS = new Set(['refetch', 'writeUpsert', 'writeUpdate', 'writeDelete', 'writeBatch']);
const OPTIMISTIC = new Set(['insert', 'update', 'delete']);
const QUERY_SYNC = new Set(['invalidateQueries', 'setQueryData', 'refetchQueries']);
const HANDLERS = new Set(['onInsert', 'onUpdate', 'onDelete']);
const FN_TYPES = new Set(['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration']);

export default {
  meta: { type: 'problem', schema: [], messages: {
    noSync: 'Мутація без сліду в кеші у ЦІЙ функції: додай collection-синк або поясни // cache-sync-ok (див. eslint-rules/mutation-cache-sync.mjs).',
    invalidateOnly: 'invalidateQueries не будить TanStack DB-колекцію — потрібен collection.utils.* синк у цій функції.',
  }},
  create(context) {
    const sourceCode = context.sourceCode;
    const serverFns = new Set();
    let usesAdminData = false;

    const enclosingFn = (node) => {
      let p = node.parent;
      while (p && !FN_TYPES.has(p.type)) p = p.parent;
      return p;
    };
    // 🔴 Persistence-виняток — по ВСІХ предках (рев'ю р4): serverFn у
    // вкладеному callback усередині onInsert має найближчою функцією той
    // callback, а не хендлер.
    const insidePersistenceHandler = (node) => {
      for (let p = node.parent; p; p = p.parent)
        if (p.type === 'Property' && HANDLERS.has(p.key?.name)) return true;
      return false;
    };
    // 🔴 Opt-out шукається перед STATEMENT-ом, не перед call (рев'ю р4):
    // між `// cache-sync-ok:` і `reorderOrderStatus(...)` стоїть токен
    // `await`, і getCommentsBefore(call) порожній. Причина обовʼязкова.
    const hasExempt = (node) => {
      let s = node;
      while (s.parent && !/Statement$|Declaration$/.test(s.parent.type)) s = s.parent;
      return sourceCode.getCommentsBefore(s).some((c) => /cache-sync-ok:\s*\S/.test(c.value));
    };

    const COLLECTION_FACTORIES = new Set(['useCollection', 'getCollection']);
    const isCollectionVar = (ident, at) => {
      for (let s = sourceCode.getScope(at); s; s = s.upper) {
        const v = s.set.get(ident.name);
        if (!v) continue;
        const init = v.defs[0]?.node?.init;
        return init?.type === 'CallExpression' && COLLECTION_FACTORIES.has(init.callee?.name);
      }
      return false;
    };

    // 🔴 Сканування НЕ заходить у вкладені функції (рев'ю р4): інакше
    // useMutation на рівні компонента «бачив» би синк сусіднього
    // хендлера, а це і є клас фолс-негативів файлової евристики.
    const scanFn = (root) => {
      let collectionSync = false, querySync = false;
      const walk = (n) => {
        if (!n || typeof n.type !== 'string') return;
        // Для config-обʼєкта useMutation — його прямі callbacks сканувати
        // ТРЕБА (вони і є тіло мутації), глибші вкладені — ні.
        if (n !== root && FN_TYPES.has(n.type) &&
            !(root.type === 'ObjectExpression' && n.parent?.type === 'Property' && n.parent.parent === root)) return;
        if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression') {
          const name = n.callee.property?.name;
          const obj = n.callee.object;
          if (SYNC_UTILS.has(name) && obj.type === 'MemberExpression' && obj.property?.name === 'utils') collectionSync = true;
          // Отримувач insert/update/delete — змінна, ініціалізована
          // useCollection(...)/getCollection(...): за ПОХОДЖЕННЯМ, не за
          // іменем (самоперевірка р5: `const statuses = useCollection(…)`
          // інакше не рахувався б, і сторінка діставала хибний noSync).
          if (OPTIMISTIC.has(name) && obj.type === 'Identifier' && isCollectionVar(obj, n)) collectionSync = true;
          if (QUERY_SYNC.has(name)) querySync = true;
        }
        for (const key of sourceCode.visitorKeys[n.type] ?? []) {
          const child = n[key];
          if (Array.isArray(child)) child.forEach(walk); else if (child) walk(child);
        }
      };
      walk(root.type === 'ObjectExpression' ? root : root.body);
      return { collectionSync, querySync };
    };

    /**
     * Що сканувати: для useMutation — його config-обʼєкт (mutationFn/
     * onSuccess/onSettled — усі callbacks там, і ТІЛЬКИ там); для виклику
     * serverFn — тіло найближчої охоплюючої функції без вкладених.
     */
    const check = (trigger, scope) => {
      if (hasExempt(trigger) || insidePersistenceHandler(trigger)) return;
      if (!scope) return;
      const { collectionSync, querySync } = scanFn(scope);
      if (!collectionSync && !querySync) context.report({ node: trigger, messageId: 'noSync' });
      else if (!collectionSync && querySync && usesAdminData) context.report({ node: trigger, messageId: 'invalidateOnly' });
    };

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'simplycms/admin-data') usesAdminData = true;
        if (node.source.value === 'simplycms/admin-server')
          for (const s of node.specifiers)
            if (s.type === 'ImportSpecifier' && !/^list/.test(s.imported.name)) serverFns.add(s.local.name);
      },
      'CallExpression[callee.name="useMutation"]'(node) {
        const cfg = node.arguments[0];
        check(node, cfg?.type === 'ObjectExpression' ? cfg : null);
      },
      'CallExpression[callee.type="Identifier"]'(node) {
        if (!serverFns.has(node.callee.name)) return;
        const fn = enclosingFn(node);
        // serverFn усередині callback-а useMutation-config (mutationFn/
        // onSuccess…) стереже тригер useMutation — інакше синк у сусідньому
        // onSuccess дав би хибний noSync на mutationFn (самоперевірка р4).
        const cfg = fn?.parent?.type === 'Property' ? fn.parent.parent : null;
        if (cfg?.type === 'ObjectExpression' && cfg.parent?.type === 'CallExpression' &&
            cfg.parent.callee?.name === 'useMutation') return;
        check(node, fn);
      },
    };
  },
};
```

Зона в `eslint.config.mjs`: `packages/simplycms/src/admin-data/**/*.{ts,tsx}`
(з `ignores: ['**/__tests__/**']` — як у зоні `query-key-from-entity`)
+ точковий ратчет переписаних сторінок — стартово
`packages/simplycms/src/admin/pages/OrderStatuses.tsx` (список росте з
хвилями Е3–Е6, патерн `PENDING_FILES` навпаки).

**Машинний тест правила** — гейт, а не ручний контроль. ✅ Усі 9 кейсів
емпірично зелені на ESLint 10.8 + typescript-eslint 8 (прогін
2026-09-01, правило витягнуте з цього плану); покривають знахідки р3/р4:
змішана сторінка, useMutation поруч із синком, serverFn у mutationFn +
onSuccess, opt-out через `await`, persistence-хендлери, loader, JSX-arrow.

```ts
// tests/eslint-rules/mutation-cache-sync.test.ts
import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from '../../eslint-rules/mutation-cache-sync.mjs';

const linter = new Linter({ configType: 'flat' });
const config = [{
  files: ['**/*.tsx', '**/*.ts'],
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
  plugins: { s: { rules: { 'mutation-cache-sync': rule } } },
  rules: { 's/mutation-cache-sync': 'error' },
}];
const HEAD = `import { useMutation } from '@tanstack/react-query';
import { useCollection, orderStatusesCollection } from 'simplycms/admin-data';
import { listOrderStatuses, insertOrderStatuses, setDefaultOrderStatus, reorderOrderStatus } from 'simplycms/admin-server';
`;
const lint = (code: string, head = HEAD) => linter.verify(head + code, config, { filename: 'f.tsx' });
const ids = (code: string, head?: string) => lint(code, head).map((m) => m.messageId);

describe('mutation-cache-sync (function-scope)', () => {
  it('сторінка Task 10 — чиста', () => {
    expect(ids(`export function Page() {
      const collection = useCollection(orderStatusesCollection);
      const handleCreate = (form) => { const tx = collection.insert({ id: 'x', ...form }); tx.isPersisted.promise.then(() => {}); };
      const handleUpdate = (id, form) => { collection.update(id, (d) => { d.name = form.name; }); };
      const handleDelete = (id) => { collection.delete(id); };
      const applyDefault = async (id) => { await setDefaultOrderStatus({ data: { id } }); await collection.utils.refetch(); };
      const handleReorder = async (id, dir) => { await reorderOrderStatus({ data: { id, dir } }); await collection.utils.refetch(); };
      return <button onClick={() => handleReorder('a', 'up')} />;
    }`)).toEqual([]);
  });

  it('прибраний refetch у handleReorder — noSync САМЕ там (сусідній синк не покриває)', () => {
    expect(ids(`export function Page() {
      const collection = useCollection(orderStatusesCollection);
      const applyDefault = async (id) => { await setDefaultOrderStatus({ data: { id } }); await collection.utils.refetch(); };
      const handleReorder = async (id) => { await reorderOrderStatus({ data: { id } }); };
      return null;
    }`)).toEqual(['noSync']);
  });

  it('useMutation без синку поруч із хендлером із синком — офендер', () => {
    expect(ids(`export function Page() {
      const collection = useCollection(orderStatusesCollection);
      const m = useMutation({ mutationFn: async (x) => fetch('/api', { body: x }) });
      const handleReorder = async (id) => { await reorderOrderStatus({ data: { id } }); await collection.utils.refetch(); };
      return null;
    }`)).toEqual(['noSync']);
  });

  it('useMutation(serverFn у mutationFn) + refetch в onSuccess — чисто', () => {
    expect(ids(`export function Page() {
      const collection = useCollection(orderStatusesCollection);
      const m = useMutation({ mutationFn: (id) => setDefaultOrderStatus({ data: { id } }), onSuccess: () => collection.utils.refetch() });
      return null;
    }`)).toEqual([]);
  });

  it('opt-out над await — працює лише з причиною', () => {
    const body = (comment: string) => `export function Page() {
      const handleReorder = async (id) => {
        ${'$'}{comment}
        await reorderOrderStatus({ data: { id } });
      };
      return null;
    }`;
    expect(ids(body('// cache-sync-ok: refetch робить викликач'))).toEqual([]);
    expect(ids(body('// cache-sync-ok:'))).toEqual(['noSync']);
  });

  it('колекція Task 9 (serverFn у persistence-хендлерах) — чиста', () => {
    expect(ids(`function create(queryClient) {
      const collection = createCollection(queryCollectionOptions({
        queryFn: async () => listOrderStatuses({ data: {} }),
        onInsert: async ({ transaction }) => {
          const rows = await insertOrderStatuses({ data: transaction.mutations.map((m) => m.modified) });
          collection.utils.writeBatch(() => { for (const row of rows) collection.utils.writeUpsert(row); });
          return { refetch: false };
        },
      }));
      return collection;
    }`, `import { insertOrderStatuses, listOrderStatuses } from 'simplycms/admin-server';\n`)).toEqual([]);
  });

  it('loader з list — поза правилом', () => {
    expect(ids(`export const Route = { loader: async () => { await listOrderStatuses({ data: {} }); return null; } };`,
      `import { listOrderStatuses } from 'simplycms/admin-server';\n`)).toEqual([]);
  });

  it('отримувач з іншим іменем (statuses = useCollection) — рахується синком', () => {
    expect(ids(`export function Page() {
      const statuses = useCollection(orderStatusesCollection);
      const handleCreate = (form) => { statuses.insert({ id: 'x', ...form }); };
      const m = useMutation({ mutationFn: (id) => setDefaultOrderStatus({ data: { id } }), onSuccess: () => statuses.utils.refetch() });
      return null;
    }`)).toEqual([]);
  });

  it('serverFn у JSX inline-arrow без синку — офендер', () => {
    expect(ids(`export function Page() { return <button onClick={() => setDefaultOrderStatus({ data: { id: 'a' } })} />; }`)).toEqual(['noSync']);
  });
});
```

Run: `pnpm vitest run tests/eslint-rules/mutation-cache-sync.test.ts` → PASS 9/9.

**Смоук у реальній зоні (після Task 10):** тимчасово прибрати
`collection.utils.refetch()` із `handleReorder` сторінки → `pnpm lint`
FAIL з `noSync` на `reorderOrderStatus`; повернути → 0 errors, warnings без змін.

- [ ] **Step 3: Реєстр server-first винятків (К3-2)**

```ts
// packages/simplycms/src/contracts/admin-server-first.ts
/**
 * Реєстр К3-2: сутності/екрани адмінки, що СВІДОМО лишаються server-first
 * (без TanStack DB-колекції). Мовчазні відхилення заборонені: колекція
 * для сутності звідси — дефект, і навпаки — сутність без колекції й без
 * запису тут на кінець Е6 — дефект (гейт повноти доросте разом із
 * хвилями; сьогодні тест стереже першу половину інваріанта).
 */
export const ADMIN_SERVER_FIRST = {
  priceValidator: 'обчислення, не сутність',
  dashboard: 'агрегати-лічильники',
  systemSettings: 'одиничний рядок — колекція з одного елемента безглузда',
} as const satisfies Readonly<Record<string, string>>;
```

```ts
// packages/simplycms/src/contracts/__tests__/admin-server-first.test.ts
import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_SERVER_FIRST } from '../admin-server-first';
import { ENTITY } from '../entities';

describe('реєстр server-first винятків (К3-2)', () => {
  it('колекція не існує для сутності з реєстру', () => {
    const collections = readdirSync(
      join(import.meta.dirname, '../../admin-data/collections'),
    ).map((f) => f.replace(/\.tsx?$/, '').replace(/-/g, '_'));
    for (const name of Object.keys(ADMIN_SERVER_FIRST))
      expect(collections, `${name} у реєстрі винятків — колекція заборонена`)
        .not.toContain(name.replace(/([A-Z])/g, '_$1').toLowerCase());
  });

  it('ключі реєстру не суперечать ENTITY-іменам колекцій', () => {
    expect(Object.keys(ADMIN_SERVER_FIRST).length).toBeGreaterThan(0);
    expect(Object.values(ENTITY)).not.toContain('price_validator');
  });
});
```

- [ ] **Step 4: Повний ланцюг + контролі + коміт**

```bash
pnpm install --frozen-lockfile && pnpm format:check && pnpm lint \
  && pnpm build && pnpm typecheck && pnpm test && pnpm test:schema \
  && pnpm build:packages && pnpm typecheck:template && pnpm test:packaging
pnpm pilot:pack
git add eslint-rules tests eslint.config.mjs packages/simplycms/src/contracts
git commit -m "test(v2-k3): гейти мутацій (handler-canon + mutation-cache-sync) і реєстр К3-2

Дві поверхні одного інваріанту: AST-гейт по ланцюжку блоків до
refetch:false (BASELINE порожній назавжди) і function-scope AST-правило
на хуки/виклики serverFn (межа — охоплююча функція без вкладених;
useMutation — його config). Реєстр server-first
винятків — мовчазні відхилення від «усе на колекціях» заборонені.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## DoD етапу Е1б (редакція 2)

1. **Повний ланцюг гейтів** (десять кроків) + `pnpm pilot:pack` зелені;
   `pnpm lint` = 0 errors, warnings не зросли відносно зафіксованих перед Task 0.
2. **Контролі прогнані вручну — пронумеровано ВІСІМ:**
   1) Task 0 — другий глобальний дефолт → 23505;
   2) Task 1 — прибрана залежність агрегату червонить deps-гейт;
   3) Task 2 — друга версія `@tanstack/db` червонить single-instance;
   4) Task 4 — машинний тест 8/8 + смоук: нетоплевел `createServerFn` червонить лінт;
   5) Task 6/9 — імпорт угору по тіру валить лінт (обидві нові зони, обидві форми специфікатора);
   6) Task 9 — id-mismatch кидає ДО write-back, двійників немає;
   7) Task 11 — `handler-canon` без write-back падає з файлом:рядком;
   8) Task 11 — `mutation-cache-sync`: машинний тест 9/9 + смоук на сторінці.
3. **Жива сторінка** `/admin/order-statuses`: усі 10 пунктів прогону
   Task 10 Step 5, включно з авто-rollback і серверною відмовою на
   видалення дефолтного.
4. **`test:schema`** доводить: інваріант дефолту (23505 + операції) і
   повноту `deps` усіх СЕМИ агрегатів (з `pickup_points` у двох).
5. **Gate C** зелений зі стаб-маркером `admin-server`; `/drizzle-orm/` і
   `pg` у клієнтських чанках відсутні.
6. **Спека звірена:** кожен пункт ревізії 2026-08-31 (К3-4′/К3-9′/К3-10′/
   К3-13/К3-14) має відповідний артефакт у коді (цей план — мапа).

## Що НЕ входить в Е1б

- Решта 52 файлів `src/admin/**` — хвилі Е3–Е6 (ратчет
  `admin-inserts-need-id` і виїмка `admin/` у правилі ключів чинні).
- `syncMode: 'on-demand'` і push-down — Е3; тут лише `eager`
  (`mode` у дескрипторі вже є — Е3 фабрику не міняє).
- Storage-порт і `ImageUpload` — Е2.
- Гейт повноти «сутність ⇒ колекція АБО реєстр винятків» на всі 34 —
  доростає з хвилями, закривається в Е6.
- Адаптація мертвих legacy-шляхів запису під нові індекси — сторінки
  supabase-js не виконуються на стеку v2; КОНТРАКТ хвиль Е3–Е6: сторінка
  single-default таблиці переписується разом зі своєю setDefault-операцією
  (Task 0, блок Legacy).
- К3-11 (контракт плагінів: `PluginTablePort.insert` вимагає `id`, DDL
  шаблонів без `gen_random_uuid()`) — окремим кроком до К5; Е0 вже зняв
  DEFAULT у референс-плагіна, решта — поза Е1б.
- Борги Е1а №4 (`detail()` slug/uuid), №6 (`scoped` у двох значеннях),
  №8 (зона правила ключів не дістає тем/плагінів) — проявляться на
  каталозі, тобто в Е3.

## Точка передачі

Після закриття DoD — повернутись на валідацію з чотирма артефактами:
вивід повного ланцюга; вивід УСІХ ВОСЬМИ контролів; запис/опис живого
прогону (особливо rollback п.7); `git log --oneline` етапу. Рев'ю нової
редакції перед виконанням — сесія `admin-server-layer` (адверсаріально,
бажано повторним прогоном Codex тим самим протоколом, що дав REJECT
старій редакції).

Наступний план — **Е2: Storage-мінімум** (`MediaProvider` + `local-fs`),
після нього **Е3: каталог on-demand** — перший push-down і три борги Е1а.
