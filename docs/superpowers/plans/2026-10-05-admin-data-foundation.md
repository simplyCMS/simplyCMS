# Фундамент даних адмінки перед К3-Е6а: TanStack DB 0.11.3 + власний генератор zod-схем

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Виконується командою `/виконай-задачу` (Крок 0 — звірка якорів `orient --plan`; Workflow 1 — імплементація; Workflow 2 — верифікація; відмітки `[X]` лише за реально зроблене).

**Goal:** Перевести шар даних адмінки на `@tanstack/react-db` 0.5.3 / `@tanstack/query-db-collection` 1.3.4 (`@tanstack/db` 0.11.3 транзитивно) без регресій у списках, пагінації й збереженні, а `defineAdminResource` — на власний генератор zod-схем `columnsToZod` замість `drizzle-zod`, з постійним гейтом паритету.

**Architecture:** Етап A — бамп трьох пакетів разом із ЗМІНОЮ серверного контракту subset (Date для `gt/gte/lt/lte`, `sortable`-колонки допустимі для цих чотирьох операторів): без цього «Показати ще» у списках товарів і замовлень падає на проді. Далі знімаються обходи TSDB-B1 і `gcTime: 0`, переписуються записи TSDB-1/2, лагодяться тести (правдиві стаби сервера, перевірки результату замість лічильників викликів), 36 викликів `useLiveQuery(fn, deps)` переходять в об'єктну форму. Етап B — `columnsToZod`: switch по `columnType` на 9 типів, невідомий — гучний throw; pick/omit/extend виконуються над ФОРМОЮ (shape) до обгортки; статичний тип ОГОЛОШУЄТЬСЯ з `InferInsertModel`/`InferSelectModel` через `z.object(shape).pipe(z.custom<Out>(() => true))` — один контрольований каст на межі генератора; розбіжність типу з рантаймом ловить постійний гейт паритету з мутаційним контролем.

**Tech Stack:** TanStack Start 1.167 (`createServerFn`, seroval), `@tanstack/react-db`/`@tanstack/db`/`@tanstack/query-db-collection`, Drizzle 0.45.2, Zod 4, Vitest 4 (5 після заходу оновлень — перевір `package.json`), PostgreSQL 17, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-04-deps-security-tooling-design.md` — розділи «Порядок виконання» (кроки 2 і 4), «Тема 4 · TanStack DB 0.11.3», «Тема 7 · Drizzle» → «Спайк Drizzle 1.0 RC» і «7б · Власний генератор zod-схем». Також `docs/architecture/upstream-workarounds.md` (TSDB-1…4, TSDB-B1, DZOD-1), `docs/architecture/test-contours.md` (§10 схемний контур, §11 гейти адмін-шару), `CLAUDE.md`.

**Цільовий шлях у репо:** `docs/superpowers/plans/2026-10-05-admin-data-foundation.md`.

## Ступінь обовʼязковості — читати ПЕРШИМ

- **КАНОН** (розбіжність → зупинка й звернення до власника): рішення спеки 1–6 теми 4 і п. 7б; Global Constraints; сигнатури в Interfaces; асерти Review Focus; порядок гейтів.
- **ОРІЄНТИР:** номери рядків, імена внутрішніх змінних, розкладка тестів. Якорі зібрані `git grep` на гілці `claude/deps-security-tooling-2026-10` (HEAD `bf7b1368`); після заходу оновлень (крок 1 спеки) рядки зсунуться — шукай за текстом.
- 🔴 Звіт «гейт зелений» — не доказ; доказ — вивід команди (вставляти в «Факти виконання»).
- 🔴 Крок «має бути ЗЕЛЕНИМ одразу» перевіряє припущення плану; червоний — зупинка й ескалація.
- 🔴 Тест, який «зелений одразу» без жодного RED-доказу, не приймається: або показати червоне на мутації/старій версії, або пояснити, чому неможливо.
- Задачі адресуються заголовками `## Task N:`.

## Протокол виконання

- **Стан гілки між Task 1 і Task 9 свідомо червоний** (бамп дає ~16 червоних тестів до їхнього виправлення). Не пушити; коміти локальні. Пуш і мерж — рішення власника.
- **Не стартувати Етап B, поки Етап A не пройшов свій гейт (Task 9).** Етап B не залежить від Етапу A кодово, але спільні гейти (`live:smoke`) мають бути зеленими на кожному етапі окремо, щоб регресію можна було приписати.
- Крок 3 спеки (`inputValidator` → `validator`, окремий план) може приземлитись МІЖ етапами: він міняє лише рядки `admin-server/index.ts`. Якщо приземлився — у цьому плані скрізь читай `validator` замість `inputValidator`.
- **Git.** Інший агент може комітити в тому ж дереві: перед кожним комітом `git status`, у коміт — лише власні файли (`git add <конкретні шляхи>`), ніколи `git add -A`.
- 🔴 `CLAUDE.md` — лише загальні правила: стан і етапи туди НЕ пишуться. Допустима одна правка — уточнення причини правила `collectionKey` (Task 6, Step 7).

## Global Constraints

- TypeScript 5.9 strict; Node `>=22.12`; коментарі й доки — українською; рядки UI — лише i18n (uk + en).
- 🔴 Ліміт **150 рядків** на новий або переписаний файл (`.github/instructions/coding-style.instructions.md`). Виняток лише `admin-server/index.ts`. У звіті кожної задачі з кодом — `wc -l` нових/переписаних файлів.
- 🔴 Точні піни в корені: `@tanstack/react-db` `0.5.3`, `@tanstack/query-db-collection` `1.3.4`; `@tanstack/db` — транзитивно `0.11.3` (прямої залежності НЕ додавати, К3-10′). Peer-діапазони ядра — тим самим стилем, що були (`~`), на нові мінори.
- Нова залежність — лише `drizzle-zod` у **devDependencies** (Task 11); з `dependencies` ядра він зникає (Task 13).
- Контракт id (ключ генерує викликач), `runAdmin`-каркас, exhaustiveness-гарди `AdminResourceColumnGuards` — не послаблювати.
- `pnpm lint` = 0 errors / 8 warnings (норма). Тір-зони, `server-fn-top-level`, `query-key-from-entity`, `no-collection-key-outside-admin-data` — не послаблювати.
- Тести поруч із кодом, у `__tests__/` теки ядра; харнес — `packages/simplycms/test-harness/pg/__tests__/`.
- Маркер `UPSTREAM:<ID>` без запису в реєстрі й запис без маркера — дефект реєстру; після Етапу A `git grep -n "UPSTREAM:TSDB-B1"` порожній, після Етапу B `git grep -n "UPSTREAM:DZOD-1"` порожній.
- Коміти: `chore(deps): …`, `feat(admin-server): …`, `fix(admin-data): …`, `test(…): …`, `refactor(admin): …`, `docs: …`.

## Команди тестів (прочитати до першого RED)

- Звичайні тести (дефолтний контур): `pnpm vitest run <шлях-або-фільтр>`.
- 🔴 **Харнес-файл (Postgres):** лише `PG_HARNESS_URL=<url> pnpm exec vitest run --config vitest.schema.config.ts <фільтр>`. Доказ валідного RED/GREEN — рядок `Test Files  N` у виводі.
  - `pnpm test:schema -- <файл>` прогін НЕ звужує (ганяє весь контур).
  - `pnpm vitest run <шлях харнес-файлу>` дає «No test files found» (кореневий конфіг виключає `test-harness/**`) — це НЕ червоний тест, а відсутність прогону.
- Усі тести адмін-шару: `pnpm vitest run packages/simplycms/src/admin packages/simplycms/src/admin-data packages/simplycms/src/admin-server`.

## Стенд (живий Postgres) — один раз перед Task 1

Контейнер мусить бути з `trust`-автентифікацією (інакше `test:schema` падає: роль `app_runtime` без пароля).

```bash
docker ps --format '{{.Names}} {{.Ports}}' | grep simplycms     # можливо, стенд уже піднятий (напр. simplycms-deps-pg на 55441)
# якщо немає придатного — новий, вільний порт:
docker run -d --name simplycms-admindata-pg -e POSTGRES_USER=pgtest -e POSTGRES_DB=postgres \
  -e POSTGRES_HOST_AUTH_METHOD=trust -p 55450:5432 pgvector/pgvector:pg17
export PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55450/postgres
pnpm db:demo            # ЧИСТА БД магазину; друкує DATABASE_URL в кінці (потрібен live:smoke-у не напряму — він сам викликає db:demo)
```

`pnpm live:smoke` = `db:demo → build → server → curl+SQL + Playwright`; потребує `PG_HARNESS_URL` і Chromium (`@playwright/test` із node_modules). Чужий контейнер не зупиняти й не чистити.

## Review Focus

Входи, які спека мовчки передбачає, але жоден тест етапу не перевіряв би без цього списку:

1. **Рівні `createdAt` на межі сторінки** (сід/масовий імпорт дають однакові мітки; Postgres має мікросекунди, JS `Date` — мілісекунди): «Показати ще» не губить і не дублює рядки, запит `and(gte(createdAt, v), lt(createdAt, v+1ms))` ловить рядок із µs-хвостом. Тест — Task 2 (харнес) + Task 9 (живий).
2. **Дозвіл розширено лише на `gt/gte/lt/lte` для `sortable`:** `eq/in/isNull` по `sortable`-але-не-`filterable` колонці (напр. `total`, `accessToken` у `omit`) досі відхиляються; діапазонний фільтр по неsortable/нефільтровній колонці (`statusId`, прихований `accessToken`) відхиляється. Тест — Task 2.
3. **Невалідний `Date`/`NaN`/`Infinity` як `value` діапазонного оператора** → 400 від валідатора, а не 500 з БД. Тест — Task 2.
4. **Збереження в картці → повернення до списку** показує повний набір (не обрізаний кеш неактивного ключа) і не «відкочує» щойно записаний рядок. Тест — Task 6 + Task 4.
5. **Граничні значення колонок у генераторі:** `integer` 2147483648 / −2147483649 / `NaN` / 1.5, `Invalid Date`, не-uuid, рядок довший за `varchar(n)`, `null` у `notNull`-колонці update-patch → 400, а не `22003`/500 з Postgres. Тест — Task 11.

## Граф залежностей

```
ЕТАП A:  T1 бамп ─► T2 subset (Date+sortable) ─► T3 корінь 9 нерозібраних падінь ─► T4 ремонт тестів ─► T5 зняти B1 ─┐
                                                                                          T6 gcTime/TSDB-1 ─► T7 TSDB-2/3/4 ─┤
                                                                                                    T8 useLiveQuery obj-форма ┴─► T9 гейти + live:smoke + доки
ЕТАП B:  T10 columnsToZod ─► T11 гейт паритету ─► T12 buildResourceSchemas + типи + тести ─► T13 прибрати залежність, DZOD-1 ─► T14 гейти + live:smoke + доки
```

## Сирі числа спайків (еталон для порівняння)

**Спайк теми 4 (2026-10-04, тимчасовий worktree, код не збережено):**

| Вимір | Значення |
|---|---|
| База (0.8.6 / 0.3.6 / 1.2.11) | 330/330 тестів `admin` + `admin-data` зелені; typecheck чистий |
| Нові (0.11.3 / 0.5.3 / 1.3.4) без змін коду | typecheck чистий; **16 з 330 червоні** |
| Причина 1 (блокер) | `useLiveInfiniteQuery` після першої сторінки шле `and(gte(col, v), lt(col, v+1ms))` по першій колонці сортування (для `Date`; `@tanstack/db` 0.11.3 `src/types.ts`, `CursorExpressions.whereCurrent`); наш сервер відкидає двічі: `subsetInputSchema` (`subset.ts:59` `scalar` без `Date`) і `filterable` (orders `['id','statusId','userId']`, products без `createdAt`) |
| Причина 2 | тести-лічильники викликів: `catalog-collections` ×3, `on-demand-full-slice` ×2, `orders-collections-write` ×1 (після запису +N перезапитів) |
| Причина 3 | статичні стаби сервера (`mockResolvedValueOnce`, статичний `SEED`): `on-demand-active-slices`, `on-demand-stale-cache` ×2, `ProductEditPage-panel-switch`, `ProductsPage`, `useModifications`; ще ~9 у `admin/features/{orders,catalog-dictionaries}` — до кореня НЕ розібрані |
| Причина 4 | `subset-payload.test.ts` ×3: тест будував `{type:'ref'}` замість `new IR.PropRef([field])` |
| TSDB-B1 | без `preload()` тести `useProductSave`/`useStock` зелені на нових і червоні на старих; зонди `writeUpsert`/`insert`/`writeBatch` без синку: старі кидають `SyncNotInitializedError`, нові — ні |
| TSDB-1 | неактивний зріз після запису містить повний правильний набір (зонд зі `staleTime` 5 хв); чужий ключ під префіксом колекції ВИДАЛЯЄТЬСЯ, а не перезаписується |
| TSDB-2 | без індексу — довантаження префіксом `{limit: 5}` замість `{limit: 2, offset: 3}` + попередження бібліотеки (`db/src/query/live/ordered-source-loader.ts`) |
| Ціна | +N мережевих запитів після кожного збереження (N — активні запити колекції, зазвичай 1) |
| Побічне | `useLiveQuery(fn, deps)` задепрекована, зникне в 1.0 — 36 викликів поза тестами; стаби зі спільними посиланнями на рядок → `TransactionError: … changed in place` |

**Спайк теми 7 (Drizzle 1.0 RC.4 — для Етапу B):** 14 таблиць ресурсів, 9 типів колонок, **166 колонок** (uuid 46, text 37, timestamp(date) 20, varchar 11, boolean 11, integer 10, numeric(string) 10, jsonb 7, enum 3); прототип `columnsToZod` — 128 рядків; `resource-schemas.ts` 182 → 72 рядки, 0 `as` у генеричному шляху; усі 14 `expectTypeOf` без кастів на виклику; `test:schema` 352/352; парність із drizzle-zod — усі колонки 14 таблиць × insert/update/select × **30** граничних значень; мутація `z.int()` → `z.number()` валить **9** тестів. `drizzle-orm/zod` DZOD-1 не лікує (13 помилок без кастів: 3 у `resource-schemas.ts` + 10 у `expectTypeOf`).

---

# ЕТАП A — TanStack DB 0.11.3

## Task 1: Бамп трьох пакетів, прибрати виняток версійного паритету, зафіксувати червону базу

**Files:**
- Modify: `package.json` (корінь, ~рядки 70–71: `"@tanstack/query-db-collection": "1.2.11"`, `"@tanstack/react-db": "0.3.6"`), `packages/simplycms/package.json` (peer `~1.2.11` / `~0.3.6`, ~рядки 552–553), `packages/create-simplycms-store/template/package.json.tpl` (~50–51), `tests/pilot/store-template/package.json` (~43–44), `pnpm-lock.yaml`.
- Modify: тест версійного паритету з виняткам для цих двох пакетів — **знайти**: `git grep -n "react-db" -- tests` і `git grep -n "query-db-collection" -- tests` (його додано заходом оновлень, на HEAD плану його ще немає; якщо не знайдено — зафіксувати «винятку немає» у Фактах і йти далі).
- Modify (коментарі з версіями): `packages/simplycms/src/admin/features/orders/…/useOrderStatusesPage.ts:19` («Форма 0.3.6»), `admin/features/products/list/useProductsList.ts:33`, `admin/features/products/list/__tests__/ProductsPage.test.tsx:152` — лише якщо вони стають хибними (уточнюються в Task 8).

**Interfaces:**
- Produces: у корені `@tanstack/react-db` `0.5.3`, `@tanstack/query-db-collection` `1.3.4` (точні); peer ядра `~0.5.3` / `~1.3.4`; ті самі точні піни в шаблоні й оверлеї пілота; `node_modules/.pnpm/@tanstack+db@0.11.3_*` присутній.

- [ ] **Step 1: Базова лінія ДО бампа** (еталон, має бути ЗЕЛЕНИМ одразу): `pnpm vitest run packages/simplycms/src/admin packages/simplycms/src/admin-data` → записати `Tests N passed` (спайк: 330) і `pnpm typecheck` → 0. Вивід — у «Факти виконання».
- [ ] **Step 2: Бамп.** Правити чотири `package.json` (корінь і шаблон/оверлей — точні версії, ядро — `~`-діапазони). Версійний тест паритету: ВИДАЛИТИ виняток для двох пакетів, щоб тест вимагав збігу точних пінів шаблону з коренем (`tests/…`, знайдений у Files).
- [ ] **Step 3: `pnpm install`** (один раз — оновлює lock), далі `pnpm install --frozen-lockfile` має пройти без змін. `ls node_modules/.pnpm | grep -E '@tanstack\+(db|react-db|query-db-collection)@'` → лише нові версії (`db@0.11.3`).
- [ ] **Step 3а: Звірка API з вихідним кодом, а не за пам'яттю.** Прочитати в `node_modules/.pnpm/@tanstack+react-db@0.5.3*/…/src/useLiveQuery.ts` перевантаження `useLiveQuery`/`useLiveInfiniteQuery` (потрібні Task 8) і в `@tanstack+db@0.11.3*/…/src/types.ts` `CursorExpressions.whereCurrent`/`whereFrom` (потрібні Task 2): які вирази генеруються для колонок типу `Date`, `string`, `number`. Короткий конспект (5–10 рядків) — у «Факти виконання».
- [ ] **Step 4: Червона база.** `pnpm typecheck` (очікується чистий) і `pnpm vitest run packages/simplycms/src/admin packages/simplycms/src/admin-data` → записати ПОІМЕННИЙ перелік червоних (очікується 16 за спайком; фактичне число може відрізнятись — зафіксувати як є) у «Факти виконання» у вигляді таблиці `файл | тест | категорія (1–4 зі спайку / невідома)`. Це вхід Task 3–4.
- [ ] **Step 5: Коміт** (гілка свідомо червона): `chore(deps): TanStack DB 0.11.3 (react-db 0.5.3, query-db-collection 1.3.4)`.

**Acceptance:** `install --frozen-lockfile` чистий; typecheck 0; перелік червоних тестів зафіксовано; тест версійного паритету (якщо існує) без виняткових рядків для цих двох пакетів і зелений.

---

## Task 2: Серверний контракт subset — `Date` і `sortable` для `eq/gt/gte/lt/lte`

**Files:**
- Modify: `packages/simplycms/src/admin-server/impl/subset.ts` (схема `filterSchema.superRefine`, `toDrizzleSubset`, докстрінг модуля).
- Modify: `packages/simplycms/src/admin-server/impl/resource-config.ts` (коментар до `filterable`/`sortable`; типи не змінюються — `sortable` уже `Exclude<ColumnName<T>, O>`, тож прихована колонка недосяжна).
- Modify: `packages/simplycms/src/admin-data/subset-payload.ts` (коментар: Date проходить як є; `SERVER_OPERATORS` без змін).
- Test: `packages/simplycms/src/admin-server/impl/__tests__/subset.test.ts` (юніт; стиль — `PgDialect.sqlToQuery`, вже використовується); новий `packages/simplycms/src/admin-data/__tests__/subset-payload-wire.test.ts`; новий харнес `packages/simplycms/test-harness/pg/__tests__/admin-subset-cursor.test.ts` (шапка — як у `admin-catalog.test.ts`: `createTempDatabase` → канон → `app_runtime`; `closeDbPool()` у `afterAll` першим).

**Interfaces:**
- `subsetInputSchema` (експорт той самий): `value` для `operator ∈ {gt,gte,lt,lte}` = скаляр (`string|number|boolean|null`) **або `Date` з `Number.isFinite(d.getTime())`**; для `eq`/`in`/`isNull` — як було (Date заборонено); `NaN`/`±Infinity` числа — відхиляти для діапазонних операторів (`Number.isFinite`).
- `toDrizzleSubset(table, allow, input)` (сигнатура без змін): правило колонки за оператором — `in|isNull` → `allow.filterable`; `eq|gt|gte|lt|lte` → `allow.filterable ∪ allow.sortable`; `sorts` → `allow.sortable` (як було). Повідомлення відмови називає колонку й оператор.
- 🔴 **Рішення архітектора (2026-10-05), не відкрите питання:** `eq` по `sortable` дозволено, бо курсор «рівних значень» для НЕ-Date колонок генерує саме `eq(col, v)` — `@tanstack/db` 0.11.3 `src/types.ts`, `CursorExpressions.whereCurrent`: «Example: eq(col1, v1) or for Dates: and(gte(col1, v1), lt(col1, v1+1ms))». Аргумент безпеки той самий: значення відсортованої колонки клієнт і так бачить у видачі. `Date` — ЛИШЕ для `gt/gte/lt/lte` (для дат бібліотека `eq` не шле).
- 🔴 `SubsetAllow` НЕ змінюється (`filterable`, `sortable`): розширення — у логіці, не в конфігах ресурсів. Конфіги `products/resource.ts` і `orders/resource.ts` не правляться.

- [ ] **Step 1: Розслідування — Date через межу serverFn (до коду).** Списки — `createServerFn({ method: 'GET' })` (`admin-server/index.ts` `listProducts` ~:107, `listOrders` ~:313). Клієнт Start кодує payload GET через seroval: `node_modules/.pnpm/@tanstack+start-client-core@*/…/src/client-rpc/serverFnFetcher.ts` (`serialize` → `toJSONAsync` → `JSON.stringify`, ~рядки 145–206), сервер декодує в `start-server-core` `server-functions-handler.ts`. Очікування: `Date` переживає межу як `Date` (seroval підтримує нативно). Довести ТЕСТОМ (Step 2, wire-тест), не припущенням.
  - **Правило вибору:** якщо Date doїжджає як `Date` → схема приймає `z.date()` (рішення вище). Якщо ні (приходить рядок/`{}`) → фолбек: `toSubsetPayload` лишає Date як є, а `toDrizzleSubset` для колонки з `columnType === 'PgTimestamp'` приймає СТРОГИЙ ISO-рядок і конструює `Date` (інакше 400); відхилення від плану записати у «Факти виконання».
- [ ] **Step 2: Тести (червоні).**
  - `subset-payload-wire.test.ts`: `it('Date у value переживає seroval-цикл і проходить subsetInputSchema')` — `toSubsetPayload` (з `LoadSubsetOptions`, що містить `and(gte(createdAt, d), lt(createdAt, d+1ms))`; будувати через `@tanstack/react-db` `gte/lt/and` + `new IR…` як у `subset-payload.test.ts`) → `toJSONAsync` → `JSON.parse/stringify` → `fromJSON` (`seroval` — devDependency ядра) → `subsetInputSchema.parse` успішний, `value instanceof Date`, `getTime()` збережено.
  - `subset.test.ts` (додати блок «Date і sortable-колонки»): (а) `gte`/`lt` з Date по `sortable`-but-not-`filterable` колонці — проходить, SQL містить обидва параметри; (б) `in`/`isNull` по такій колонці — кидає з іменем колонки; `eq` зі скаляром по такій колонці — проходить; (в) `gt` по колонці, що не sortable і не filterable (напр. `statusId` для `orders` без filterable) — кидає; (г) `Invalid Date`, `NaN`, `Infinity` у `gt` — `subsetInputSchema` відхиляє (`success: false`); (д) Date у `eq`/`in`/`isNull` — відхиляє; (е) колонка з `omit` (використати `ordersConfig` з `impl/__tests__/orders-config.ts` + `omit: ['accessToken']` через `defineAdminResource`, або прямий `allow` без `accessToken`) — `gt` по `accessToken` кидає.
  - Харнес `admin-subset-cursor.test.ts` (два ресурси, реальні `productsOps.list` і `ordersOps.list`): засіяти рядки з ОДНАКОВИМ `created_at` (µs-хвіст: `update … set created_at = '2026-01-01 00:00:00.123456+00'`), один на `−1ms`, один на `+1ms`; запит точної «межі» `filters: [gte(createdAt, v), lt(createdAt, v+1ms)]` (поле `['createdAt']`, оператори `gte`/`lt`, `value` — `Date`) повертає РІВНО рядки з міткою `v`; повна пагінація `sorts: [createdAt desc]`, `limit: 3`, склейка `offset`-сторінок — без дублів і втрат (як `admin-catalog.test.ts` «Review Focus 3»). Окремий `it` на контрольний кейс: `eq`/`in` по `createdAt` відхилено.
  - Запуск RED: `pnpm vitest run packages/simplycms/src/admin-server/impl/__tests__/subset.test.ts packages/simplycms/src/admin-data/__tests__/subset-payload-wire.test.ts` і `PG_HARNESS_URL=… pnpm exec vitest run --config vitest.schema.config.ts admin-subset-cursor` (`Test Files 1`) → нові кейси FAIL.
- [ ] **Step 3: Реалізація** у `subset.ts` за Interfaces; докстрінг модуля: чому `sortable` допустимі для діапазонних операторів («значення відсортованої колонки клієнт і так бачить — безпеки не знижує»), чому `eq/in/isNull` лишаються під `filterable`.
- [ ] **Step 4: GREEN** — ті самі команди (`Test Files 1` для харнеса), плюс весь `impl/__tests__` і `pnpm test:schema` цілком.
- [ ] **Step 5: Мутаційний контроль (обов'язковий, вивід у Факти).** Тимчасово повернути правило «діапазонні оператори — лише `filterable`» → юніт (а) і харнес-кейс межі ЧЕРВОНІЮТЬ; повернути правку. Окремо: тимчасово заборонити `eq` по `sortable` → юніт (б, `eq`-частина) червоніє; тимчасово дозволити `in` по `sortable` → юніт (б, `in`-частина) червоніє.
- [ ] **Step 6: Харнес для non-Date курсора.** Окремий `it` у `admin-subset-cursor.test.ts`: межа сторінки по НЕ-Date `sortable`-колонці (напр. `name` у products, якщо вона в `sortable`; інакше будь-яка рядкова/числова sortable-колонка ресурсу) — `eq(col, v)` повертає рівно рядки з `v`.
- [ ] **Step 7: Коміт** `feat(admin-server): subset приймає Date і sortable-колонки для курсора (eq/gt/gte/lt/lte)`.

**Acceptance:** списки товарів і замовлень пагінуються через курсор «рівних значень» на харнесі; мутація без дозволу червонить; Review Focus 1–3 покрито тестами.

---

## Task 3: Корінь 9 нерозібраних падінь (діагностика ПЕРЕД виправленням)

**Files:** лише читання й тимчасові `console`-зонди (не комітити); результат — таблиця в «Факти виконання». Кандидати: `packages/simplycms/src/admin/features/orders/**/__tests__/*` (`OrderDetailPage`, `OrderStatusControl`, `OrdersPage`, `OrderItems*`, `AddOrderItemDialog*`), `admin/features/catalog-dictionaries/**/__tests__/*` (`PropertyOptionsTable`, `PropertiesPage`, `PropertyEditPage`, `PropertyOptionEditPage`, `SectionsPage`, `SectionEditPage`, `SectionPropertyAssignmentsPanel`, `AddAssignmentDialog`, `PriceTypesPage`, `PriceTypeEditPage`, `usePriceTypeDefault`). Фактичний список — з Task 1 Step 4.

**Interfaces:** Produces — таблиця `тест | симптом | КОРІНЬ | клас (A: тест-стаб/лічильник; B: реальна зміна поведінки бібліотеки; C: продакшн-дефект нашого коду) | дія`.

- [ ] **Step 1:** Для кожного червоного тесту, що НЕ належить до категорій 1–4 спайку, ізольований прогін (`pnpm vitest run <файл> -t "<назва>"`), прочитати повне повідомлення, знайти ТРИГЕР у вихідному коді нових пакетів (`query-db-collection/src/query.ts` `updateCacheData`/`startSyncIfIdle`, `db/src/query/live/*`), не в припущеннях. Гіпотези зі спайку (перезапит «відкочує» запис статичним стабом; `TransactionError: … changed in place` від спільних посилань на рядок) перевірити на конкретному тесті, не поширювати оптом.
- [ ] **Step 2:** Класифікація. **Клас C (продакшн-дефект) — окремий червоний тест на цей дефект у харнесі/юніті ДО правки коду, правка в цьому ж Task, окремий коміт `fix(admin): …`.** Клас A/B — передаються в Task 4 списком із дією.
- [ ] **Step 3:** Якщо хоч один тест неможливо привести до кореня за розумний час — зупинка й ескалація власнику (не ставити `skip`/збільшувати таймаути).
- [ ] **Step 4: Коміт** лише якщо були клас-C правки (`fix(admin): …`); інакше — запис у Факти без коміту.

**Acceptance:** кожен червоний тест має КОРІНЬ і клас; жодного «імовірно»; для кожного класу C є червоний-потім-зелений тест.

---

## Task 4: Ремонт тестів за категоріями

**Files (за спайком; точні — з таблиці Task 1/3):**
- Категорія 4: `packages/simplycms/src/admin-data/__tests__/subset-payload.test.ts` (3 тести: використовувати `new IR.PropRef([field])` — клас/конструктор із `@tanstack/db`, перевірити експорт у 0.11.3 — замість `{type:'ref'}`).
- Категорія 2 (лічильники → результат): `admin-data/__tests__/catalog-collections.test.tsx` (×3: рядки ~88, ~117 та суміжні; дивитися `toHaveBeenCalledTimes`), `admin-data/__tests__/on-demand-full-slice.test.tsx` (×2: «insert … без refetch» ~182, «після unmount/повторного mount…» ~211), `admin-data/__tests__/orders-collections-write.test.tsx` (~30).
- Категорія 3 (правдиві стаби): `admin-data/__tests__/on-demand-active-slices.test.tsx`, `on-demand-stale-cache.test.tsx` (×2), `admin/features/products/edit/__tests__/ProductEditPage-panel-switch.test.tsx`, `admin/features/products/list/__tests__/ProductsPage.test.tsx`, `admin/features/products/modifications/__tests__/useModifications.test.tsx`; плюс те, що дав Task 3 (клас A). Підтримка: `admin-data/__tests__/support/{orders-server-stub.ts,orders-setup.tsx}` (вже «чесний» стаб з фільтрами/сортуванням — зразок).

**Interfaces:**
- Produces: спільний хелпер «сервер зі змінним станом» для on-demand тестів — **лише якщо** ≥3 тести потребують однакового; тоді `admin-data/__tests__/support/mutable-server.ts` (≤150 рядків): `createMutableServer<R extends {id: string}>(seed: R[]) → { rows: R[]; list(payload): R[] /* застосовує filters/sorts/limit/offset за контрактом impl/resource.ts */; upsert(row): void; remove(id): void; calls: Payload[] }`. Стаб повертає КОПІЇ рядків, не спільні посилання (`TransactionError: … changed in place`). Інакше — правки місцеві, без хелпера.

- [ ] **Step 1 (категорія 4):** виправити тест; GREEN.
- [ ] **Step 2 (категорія 2):** кожну перевірку «`toHaveBeenCalledTimes(N)`» замінити перевіркою РЕЗУЛЬТАТУ (`waitFor` на вміст зрізу/кеш-ключа) — поведінка «після запису рядок видно й він правильний». Верхню межу перезапитів дозволено лишати лише як окрему явну перевірку з коментарем «ціна TSDB-1: +N запитів після запису», якщо вона відображає контракт.
- [ ] **Step 3 (категорія 3):** замінити `mockResolvedValueOnce`/статичний `SEED` стабом зі змінним станом: `insert/update` handler серверFn змінює `server.rows`, наступний `list` це бачить. Перевірити, що тест ВСЕ ЩЕ дискримінативний (Step 4).
- [ ] **Step 4: Дискримінативність (обов'язково).** Для кожного переписаного тесту — мутація, під якою він мусить бути червоним (напр. write-back не пише в кеш / сервер не оновлює стан), і вивід RED у Факти. Тест, що лишається зеленим під мутацією, не приймається.
- [ ] **Step 5:** `pnpm vitest run packages/simplycms/src/admin packages/simplycms/src/admin-data packages/simplycms/src/admin-server` → усе зелене, кількість тестів ≥ базової (330) мінус свідомо видалені (перелічити).
- [ ] **Step 6: Коміт(и)** `test(admin-data): …` — по категорії.

**Acceptance:** жоден тест не перевіряє «кількість викликів» там, де цікавить результат; жоден стаб не повертає спільних посилань; усі тести адмін-шару зелені на 0.11.3.

---

## Task 5: Зняти обхід TSDB-B1 (`preload()`)

**Files:**
- Modify: `packages/simplycms/src/admin/features/products/edit/useProductSave.ts` (~:31–39: видалити `await products.preload();` і коментар-обґрунтування + маркер).
- Modify: `packages/simplycms/src/admin/features/products/stock/useStock.ts` (~:51–63: видалити `await mods.preload();` і `await products.preload();`, лишити `writeUpsert`; коментар переписати — чому достатньо `writeUpsert`).
- Modify: `packages/simplycms/routes/admin/admin/products/index.tsx:8` — маркер `UPSTREAM:TSDB-B1` ПРИБРАТИ, `preload()` eager-довідника розділів ЛИШИТИ (це прогрів, а не обхід B1; коментар переписати без маркера).
- Modify (лише коментарі-маркери): `admin/features/products/modifications/__tests__/useModifications.test.tsx:82`, `admin/features/products/properties/__tests__/usePropertyValues.queue.test.tsx:86` — `waitFor` ЛИШИТИ (причина ширша — Е3-19: серіалізація черги), маркер прибрати, посилання змінити на Е3-19.
- Modify: `docs/architecture/upstream-workarounds.md` (TSDB-B1 → «Закриті»).
- Test: `admin/features/products/edit/__tests__/useProductSave.test.tsx` (сценарій «нова картка без змонтованого списку»), `admin/features/products/stock/__tests__/useStock.test.tsx` — уже існують; перевірити, що вони НЕ спираються на `preload` у моках.

- [ ] **Step 1: RED-на-старому / GREEN-на-новому (доказ дискримінативності).** На 0.11.3 без `preload()`: `pnpm vitest run packages/simplycms/src/admin/features/products/edit/__tests__/useProductSave.test.tsx packages/simplycms/src/admin/features/products/stock/__tests__/useStock.test.tsx` → ЗЕЛЕНІ. Доказ, що тести ловлять дефект: у тимчасовому worktree на коміті ДО Task 1 (`git worktree add /tmp/claude-1000/…/old-tsdb <sha-до-Task-1>` — потребує `pnpm install`; не комітити) прибрати `preload()` і побачити RED з `SyncNotInitializedError`/«must be in ready state». Прибрати worktree (`git worktree remove`).
- [ ] **Step 2: Правки коду й маркерів** за Files. `git grep -n "UPSTREAM:TSDB-B1"` → порожньо (поза `docs/`).
- [ ] **Step 3: Реєстр.** Запис TSDB-B1 перенести в «Закриті» (формат TSDB-5: заголовок `(ЗАКРИТО 2026-10-05)`, висновок, версія `query-db-collection` 1.3.4: write-утиліти обгорнуті `startSyncIfIdle()` — `query-db-collection/src/query.ts:3503-3520`, мутації самі кличуть `_sync.startSync()`; перевірка зондами: `writeUpsert`/`insert`/`writeBatch` на колекції без синку). Первісний текст — у `<details>`, як у TSDB-5.
- [ ] **Step 4:** `pnpm lint && pnpm typecheck && pnpm vitest run packages/simplycms/src/admin` зелені.
- [ ] **Step 5: Коміт** `refactor(admin): прибрано preload()-обхід TSDB-B1; запис закрито в реєстрі`.

**Acceptance:** `git grep -n "preload()" -- packages/simplycms/src/admin` — лише eager-прогрів у роут-лоадері та тести; B1 закрито в реєстрі.

---

## Task 6: Зняти `gcTime: 0`; переписати TSDB-1; нові тести ізоляції

**Files:**
- Modify: `packages/simplycms/src/admin-data/on-demand-options.ts` (видалити `gcTime: 0`; з `Omit<…, 'gcTime'>` лишити `'gcTime'` у забороні? — **лишити** `gcTime` у `Omit`, щоб колекція не могла його перевизначати поза фабрикою; докстрінг переписати: фабрика тримає `syncMode`, індекс сортування (TSDB-2), більше НЕ тримає `gcTime`).
- Modify: `packages/simplycms/src/admin-data/__tests__/on-demand-factory-only.test.ts` (якщо перевіряє `gcTime` у фабриці — оновити).
- Modify: `packages/simplycms/src/admin-data/__tests__/on-demand-infinite-gc.test.tsx` (тест «Е3-17 (4) … gcTime:0» — переосмислити: сторінки не губляться на ререндер; без твердження про `gcTime`; перейменувати).
- Modify: `packages/simplycms/src/admin-data/__tests__/collection-key-storefront-isolation.test.ts` (додати on-demand-варіант контрольного кейсу).
- Create: `packages/simplycms/src/admin-data/__tests__/on-demand-inactive-key.test.tsx` (≤150 рядків; новий тест вмісту кеш-ключа неактивного зрізу).
- Modify: `docs/architecture/upstream-workarounds.md` (TSDB-1), `CLAUDE.md` (Step 7), маркери: `eslint-rules/no-collection-key-outside-admin-data.mjs:13`, `eslint-rules/query-key-from-entity.mjs:50`, `packages/simplycms/src/contracts/entities.ts:93` (перевірити, що посилання на TSDB-1 лишається правдивим після переписування запису).

**Interfaces:**
- `onDemandCollectionOptions<T>(config)` — публічна сигнатура БЕЗ змін; рантайм: `queryCollectionOptions({ ...rest, syncMode: 'on-demand', …індекс })` без `gcTime`.

- [ ] **Step 1: Новий тест вмісту неактивного ключа (RED-доказ через старий стек).** `on-demand-inactive-key.test.tsx`: `QueryClient` зі `staleTime: 5 * 60_000`; on-demand колекція через `onDemandCollectionOptions` із serverFn-стабом зі змінним станом (Task 4); сценарій — змонтувати зріз A (список, `useLiveQuery` без where) → дочекатись → розмонтувати A → змонтувати зріз B (картка `eq(id, X)`) → змінити рядок X через `collection.update` (write-back) → прочитати `qc.getQueryData(<ключ A>)`. 🔴 Спочатку ВИМІРЯТИ, що саме дає 0.11.3: `undefined` (запис видалено з кешу, `query.ts:3168+`) чи повний правильний набір — спека (TSDB-1) стверджує обидва варіанти в різних місцях; зафіксувати ТОЧНУ виміряну поведінку одним `expect` + друге твердження незалежно від варіанта: після повторного монтування A (`useLiveQuery`) `data` = ПОВНИЙ набір з оновленим рядком X (не обрізаний). Заборонено писати `expect(a === undefined || sameSet(a))` без виміру.
- [ ] **Step 2: RED-доказ дискримінативності.** У тимчасовому worktree на коміті ДО Task 1 (старі пакети) із `gcTime` видаленим з фабрики — тест мусить червоніти (A показує стейл/обрізаний набір, як у симптомі «лише перейменований товар»). Вивід — у Факти; worktree прибрати. Без цього доказу Step 3 не починати.
- [ ] **Step 3: Зняти `gcTime: 0`** у фабриці; оновити докстрінг і `Omit`. GREEN: новий тест, `on-demand-stale-cache.test.tsx` (старий Е3-17 тест на нових версіях НЕ дискримінує — лишити як регрес, але не як доказ), `on-demand-infinite-gc`.
- [ ] **Step 4: On-demand-варіант контрольного кейсу ізоляції** (`collection-key-storefront-isolation.test.ts`): ключ вітрини `entityKey(ENTITY.products).variant('featured')` після write-back по `onDemandCollectionOptions`-колекції зі змонтованим `useLiveQuery`/активним `preload` ЦІЛИЙ (як і в eager-кейсі); контроль: ключ `[...collectionKey(ENTITY.products), 'featured']` — за спекою ВИДАЛЯЄТЬСЯ з кешу на 0.11.3 (`getQueryData` → `undefined`); пінити виміряне. Існуючий eager-кейс перевірити на нових версіях і, якщо його «ПЕРЕЗАПИСАНО» змінилось, привести до виміряного. Коментар у файлі: eager-кейс на on-demand нічого не доводив (спека) — тепер є прямий.
- [ ] **Step 5: Переписати запис TSDB-1** у реєстрі: «Перевірено на версії» → `query-db-collection` 1.3.4 / `db` 0.11.3 — 2026-10-05; симптом (а) знято бібліотекою (неактивні записи видаляються/перезавантажуються, `query.ts:3168+`), обхід `gcTime: 0` прибрано; лишається Е3-15′ (ізоляція ключів — тепер чужий ключ ВИДАЛЯЄТЬСЯ, а не перезаписується) і нова ЦІНА: +N мережевих запитів після кожного запису; «Перевірка виправлення» — нові тести (`on-demand-inactive-key`, on-demand-контроль ізоляції); «Коли виправлять» — що прибирати, якщо бібліотека перестане видаляти чужі ключі. Перша згадка в шапці реєстру (приклад `gcTime: 0` як «шкідливого» обхіду) — лишити як історичний приклад або замінити, щоб не вводила в оману.
- [ ] **Step 6:** `git grep -n "gcTime" -- packages docs/architecture docs/tasks CLAUDE.md .github` → лише згадки в `Omit`, історичних описах і закритих записах; `docs/tasks/platform-roadmap.md:439` (опис Е3-16/17 з `gcTime: 0`) — додати примітку «знято 2026-10-05 (TanStack DB 0.11.3)» без переписування історії.
- [ ] **Step 7: `CLAUDE.md`** (рядок ~235, правило `collectionKey`): уточнити причину — write-back робить префіксний пошук ключа; на 0.11.3 чужі ключі під префіксом ВИДАЛЯЮТЬСЯ (раніше перезаписувались) — висновок (розділення вітрини й адмінки) не змінюється. Одне речення, жодного стану/етапів.
- [ ] **Step 8:** `pnpm lint && pnpm typecheck && pnpm vitest run packages/simplycms/src/admin-data` зелені (ESLint-правила з маркерами не змінюються).
- [ ] **Step 9: Коміт** `fix(admin-data): знято gcTime: 0, TSDB-1 переписано; тести неактивного ключа й ізоляції on-demand`.

**Acceptance:** `gcTime` відсутній у фабриці; новий тест червоніє на старому стеку без `gcTime: 0` і зелений на новому; контрольний кейс ізоляції існує для on-demand; запис TSDB-1 відображає новий стан і ціну.

---

## Task 7: TSDB-2 (тест 2б), TSDB-3, TSDB-4 — переписати й перевірити

**Files:**
- Modify: `packages/simplycms/src/admin-data/__tests__/on-demand-contract.test.tsx` (кейс `(2б)` ~:135–155, маркер `UPSTREAM:TSDB-2` ~:153; кейс `(2)` ~:111 — перевірити).
- Modify: `packages/simplycms/src/admin-data/on-demand-options.ts` (коментар маркера TSDB-2), `admin-data/collections/{orders,products}.ts` (коментарі про індекс — якщо стали хибними).
- Modify: `docs/architecture/upstream-workarounds.md` (TSDB-2, TSDB-3, TSDB-4).
- Modify (за результатом): `packages/simplycms/src/admin-data/subset-payload.ts` (TSDB-3/TSDB-4 маркери).

**Interfaces:** Produces — тест `(2б)`: «без індексу сторінки довантажуються префіксом `{orderBy, limit: offset+limit}` без `offset` (+ попередження бібліотеки); з індексом — `{limit, offset}`».

- [ ] **Step 1: Виміряти** на 0.11.3 (спека: без індексу `{limit: 5}` замість `{limit: 2, offset: 3}` для сторінки 2 з `pageSize: 2`; джерело — `db/src/query/live/ordered-source-loader.ts`): які `loadSubset`-payload-и приходять у стаб при другій сторінці БЕЗ індексу (`sortIndex: false` у фабриці) і З індексом; чи є `console.warn` бібліотеки (перехопити `vi.spyOn(console, 'warn')`).
- [ ] **Step 2: Переписати `(2б)`:** назва «(2б) БЕЗ індексу — друга сторінка довантажується префіксом (limit росте, offset відсутній) з попередженням; З індексом — limit+offset (контраст до кейсу 2)»; асерти на виміряні payload-и (не на «не вантажиться»). RED-доказ: тимчасово ввімкнути індекс у контрольному кейсі — асерт префікса червоніє.
- [ ] **Step 3: Реєстр.** TSDB-2: симптом «мовчки не довантажує» застарів → «довантажує префіксом, що росте, з попередженням» (оптимізація, а не коректність); оновити «Корінь» (`ordered-source-loader.ts`), «Перевірка виправлення» (кейс 2б), «Коли виправлять». Статус `lишається як оптимізація` (рішення спеки). TSDB-3 і TSDB-4 — виконати «Перевірку виправлення» з їхніх записів на 0.11.3 (`parseLoadSubsetOptions({limit:3, offset:3})` повертає `offset`? `import type { LoadSubsetOptions } from '@tanstack/query-db-collection'` компілюється?) — спека каже «не виправлено»; **якщо виміряно інакше — зупинка й ескалація**; інакше оновити лише «Перевірено на версії» (дата 2026-10-05 + версії).
- [ ] **Step 4:** `pnpm vitest run packages/simplycms/src/admin-data` зелені; `pnpm typecheck`.
- [ ] **Step 5: Коміт** `test(admin-data): TSDB-2 — префікс без індексу, offset з індексом; реєстр TSDB-2/3/4`.

---

## Task 8: 36 викликів `useLiveQuery(fn, deps)` → об'єктна форма

**Files (поза тестами; перелік перевірити `git grep`):**
`admin/features/catalog-dictionaries/assignments/SectionPropertyAssignmentsPanel.tsx` (2), `…/properties/{PropertyOptionsTable,usePropertyCard}.tsx|ts` (по 1), `…/properties/usePropertyOptionCard.ts` (2), `admin/features/orders/detail/{OrderModificationPicker.tsx,OrderStatusControl.tsx,useOrderLocked.ts}` (по 1), `…/useOrderDetail.ts` (2), `admin/features/orders/list/OrdersStatusFilter.tsx`, `admin/features/products/edit/{ProductEditPage.tsx,ProductSidebar.tsx}`, `…/list/ProductsFilters.tsx`, `…/modifications/{ModificationStatusControl,ModificationsTable (2),useModifications}`, `…/prices/usePrices.ts` (2), `…/properties/usePropertySchema.ts` (3), `…/properties/usePropertyValueTx.ts` (2), `…/simple/SimpleProductPanel.tsx`, `…/stock/useStock.ts`. Усі шляхи — відносно `packages/simplycms/src/`. Уже в об'єктній формі (`useLiveQuery({ query: … })`): `PriceTypesPage`, `usePriceTypeCard`, `PropertiesPage`, `SectionsPage`, `useSectionCard`, `useOrderStatusesPage` — зразок.
- Також `admin/features/orders/list/useOrdersList.ts` і `admin/features/products/list/useProductsList.ts` (`useLiveInfiniteQuery(fn, { pageSize }, deps?)`) — див. Step 1.
- Create: `packages/simplycms/src/admin-data/__tests__/live-query-object-form.test.ts` (статичний ратчет, ≤150 рядків; стиль — `tests/admin-inserts-need-id.test.ts`/`on-demand-factory-only.test.ts`).

**Interfaces:**
- Форма: `useLiveQuery({ query: (q) => q.from(...)… })`. Залежності від змінних (`orderId`, `productId`, фільтри) — за виведеною ідентичністю запиту (на 0.5.3), а не масивом deps.

- [ ] **Step 1: Звірка API (Task 1 Step 3а).** З `react-db@0.5.3/src/useLiveQuery.ts`: (а) точна форма config-об'єкта (`query`, опції); (б) чи реактивні змінні у замиканні `query` перераховуються без deps (виведена ідентичність запиту) — якщо ні, форма вимагає явного механізму: використати той, що пропонує бібліотека, і зафіксувати; (в) чи `useLiveInfiniteQuery` третій аргумент `deps` теж deprecated (`warnDeprecatedDepsArray`; коментар у `useProductsList.ts:33`) — якщо так, мігрувати й ці два виклики (спека каже лише про `useLiveQuery`; записати факт у Факти).
- [ ] **Step 2: Ратчет-тест (RED).** `live-query-object-form.test.ts`: сканує `packages/simplycms/src/**` (без `__tests__`, `*.test.*`) регуляркою на функціональну форму (`/useLiveQuery\(\s*\(?\s*\w*\s*\)?\s*=>/` і `/useLiveQuery\(\s*[A-Za-z_]+\s*,/`) → порожньо; негативний контроль: рядок-фікстура з `useLiveQuery((q) => …)` ЛОВИТЬСЯ тією ж регуляркою (тест тестує сканер). RED на HEAD (≈36 збігів) — вивід у Факти; кількість збігів порівняти зі спекою (36).
- [ ] **Step 3: Міграція** кожного виклику; семантику не міняти (ті самі `where/orderBy/select`). Тести-споживачі, що мокають `useLiveQuery` (якщо є), оновити.
- [ ] **Step 4:** `pnpm vitest run packages/simplycms/src/admin packages/simplycms/src/admin-data` зелені; `pnpm typecheck`; `pnpm lint` (0/8); у виводі тестів — жодного `warnDeprecatedDepsArray`/deprecation-попередження бібліотеки (`pnpm vitest run … 2>&1 | rg -i deprecat` порожньо).
- [ ] **Step 5: Коміт** `refactor(admin): useLiveQuery({ query }) замість задепрекованої форми (fn, deps)`.

**Acceptance:** ратчет-тест зелений з доведеним RED; жодних deprecation-попереджень; поведінка списків/карток незмінна (тести зелені).

---

## Task 9: Гейти Етапу A, `live:smoke` (списки, пагінація, збереження), доки

**Files:**
- Create: `scripts/live-smoke/admin-lists-pagination.mjs` (≤150 рядків); Modify: `scripts/live-smoke/owner-steps.mjs` (виклик після кроку каталогу `admin-catalog.mjs`, усередині того самого `try`; шапка-коментар із переліком кроків), `scripts/live-smoke/admin-sql.mjs` (SQL-хелпери за потреби).
- Modify: `docs/tasks/v2-state-map.md`, `docs/tasks/platform-roadmap.md` (рядок «крок 2 треку оновлень виконано»; шапка «📍 Поточний стан» — не переписувати, лише відмітка), `CHANGELOG.md` (`[Unreleased]`: TanStack DB, зміна контракту subset), `docs/superpowers/specs/2026-10-04-deps-security-tooling-design.md` (відмітка «виконано» у розділі теми 4 — лише статус-рядок), цей план («Факти виконання»).

- [ ] **Step 1: Крок живого прогону пагінації** (кожен рядок — `check(…)`, патерн `admin-order-edit.mjs`): SQL-засів понад одну сторінку (`PRODUCTS_PAGE_SIZE = 50`, `ORDERS_PAGE_SIZE = 50` — `useProductsList.ts:9`, `useOrdersList.ts:13`): ≥ 55 товарів, ≥ 3 з них з ОДНАКОВИМ `created_at` на межі 50/51; ≥ 55 замовлень (клон наявного замовлення SQL-ом з новими id/`order_number`/`access_token` — підігнати під NOT NULL/UNIQUE) із рівними `created_at` на межі. Для кожного списку (`/admin/products`, `/admin/orders`): рівно 50 рядків → клік «Показати ще» (`admin.products.loadMore` / `admin.orders.loadMore`) → рядків > 50, ВСІ id унікальні, множина id = множина з SQL (жодної втрати/дубля на межі рівних міток). Додатково підписатись на `page.on('response')`: жодної відповіді `_serverFn` зі статусом ≥ 400 за час кроку (до фіксу Task 2 це був би 400/500 від `subsetInputSchema`/allowlist).
- [ ] **Step 2: Збереження на реальному сервері** (доповнити наявні кроки, не дублювати): `admin-catalog.mjs` (створення товару — раніше йшло через `preload()`; збереження, склад — `useStock.save` ×2 гілки: товар і модифікація), `admin-order-edit.mjs` (позиції замовлення); після збереження в картці повернутись до списку і перевірити, що рядок оновлено, а решта не зникла (симптом TSDB-1). Якщо наявні кроки це вже покривають — лише явно відзначити в Фактах, які саме `check(…)`.
- [ ] **Step 3: Ручний прогін** (ПУНКТ — ФАКТ): у браузері відкрити `/admin/products`, «Показати ще» двічі, відкрити картку, змінити назву, повернутись; те саме для замовлень; зміна фільтра статусу в списку замовлень.
- [ ] **Step 4: Повний ланцюг гейтів (канонічний порядок):**
  ```bash
  pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm build && pnpm typecheck \
   && pnpm test && PG_HARNESS_URL=$PG_HARNESS_URL pnpm test:schema && pnpm build:packages \
   && pnpm typecheck:template && pnpm test:packaging && pnpm pilot:pack --skip-build
  PG_HARNESS_URL=$PG_HARNESS_URL pnpm live:smoke
  ```
  Нормa: lint 0 errors / 8 warnings; `test:schema` — усі файли зелені (у спайку 352/352 — порівняти); `live:smoke: ЗЕЛЕНИЙ`. Вивід кожної команди (хвіст із підсумком) — у Факти.
- [ ] **Step 5: Доки** — `v2-state-map.md` (де згадується колекції/`gcTime`/B1 — актуалізувати), `CHANGELOG.md`, відмітка в спеці. `CLAUDE.md` стану не отримує.
- [ ] **Step 6: Коміт** `docs: фундамент даних адмінки — Етап A (TanStack DB 0.11.3), живий прогін пагінації`.

**DoD Етапу A:** (1) всі гейти зелені з виводом у Фактах; (2) `live:smoke` включає пагінацію обох списків і збереження; (3) `git grep -n "UPSTREAM:TSDB-B1"` порожній, `gcTime` не в фабриці, TSDB-1/2/3/4 мають актуальні записи; (4) 0 викликів `useLiveQuery(fn, deps)` поза тестами; (5) тест версійного паритету без винятків для двох пакетів; (6) нові/переписані файли ≤150 рядків.

---

# ЕТАП B — власний генератор zod-схем

## Рішення плану: еталон паритету

**Обрано: `drizzle-zod` `0.8.3` (точний пін) як `devDependency` пакета `simplycms` + малий ЗАМОРОЖЕНИЙ «намір» для 9 типів колонок.**

- *Чому не лише заморожені очікування:* 166 колонок × 3 режими × ≥30 значень — це ~15 тис. тверджень; руками їх не підтримати, а при додаванні таблиці/колонки (Е6а й далі) еталон-живий дає покриття автоматично, а заморожений — мовчки ні. Живий еталон також ловить зсув семантики optional/nullable (формула drizzle-zod `insertConditions`/`updateConditions`), яку ми свідомо відтворюємо.
- *Чому ще й заморожений намір:* drizzle-zod не оновлювався з 2025-08 і піде з графа при міграції на Drizzle 1.0 (тема 7в: тоді еталон замінюється на `drizzle-orm/zod` або знімається). Блок `frozen intent` (≈15 тверджень: `integer 2147483648 → відхилено`, `varchar(n) довжини n+1 → відхилено`, `numeric` лише string, `Invalid Date → відхилено`, `uuid`) тримає КОНТРАКТ незалежно від еталона: якщо обидва колись помиляться однаково — намір це зловить.
- *Ціна:* devDependency не їде в tarball-и й у магазини; `scripts/audit-deps` ігнорує `__tests__` (`collect.mjs` `TEST_RE`).
- Якщо виконавець бачить блокер (напр. `drizzle-zod` не резолвиться з пакета під pnpm-ізоляцією) — зупинка й ескалація; фолбек — повністю заморожена таблиця очікувань, згенерована ОДИН раз скриптом проти drizzle-zod і закомічена як JSON-фікстура.

## Task 10: Генератор `columnsToZod`

**Files:**
- Create: `packages/simplycms/src/admin-server/impl/columns-to-zod.ts` (≤150 рядків).
- Test: `packages/simplycms/src/admin-server/impl/__tests__/columns-to-zod.test.ts` (юніти по типах, на синтетичній таблиці з усіма 9 типами + генерована-завжди колонка).

**Interfaces:**
```ts
export type SchemaMode = 'insert' | 'update' | 'select';
/** Форма (shape) схем колонок таблиці за режимом; refine — ФУНКЦІЇ (schema) => ZodType, як у ResourceRefine. */
export function columnsToZod(
  table: Table,
  mode: SchemaMode,
  refine?: Record<string, (schema: never) => z.ZodType>,
): Record<string, z.ZodType>;
/** Базова схема однієї колонки за `columnType`; невідомий тип — throw з іменем колонки й типом. */
export function columnSchema(column: Column): z.ZodType;
```
- Правила типів (дзеркало `drizzle-zod` 0.8.3 `index.mjs` `columnToSchema`/`numberColumnToSchema`/`stringColumnToSchema`): `PgUUID` → `z.uuid()`; `PgText` → `z.string()`; `PgVarchar` → `z.string().max(column.length)` (якщо `length` задано); `PgBoolean` → `z.boolean()`; `PgInteger` → `z.int().gte(-2147483648).lte(2147483647)`; `PgTimestamp` (mode date) → `z.date()`; `PgNumeric` (mode string) → `z.string()`; `PgJsonb` → union `string | number | boolean | null | record(string, any) | array(any)` (та сама форма, що `jsonSchema` у drizzle-zod; типізований `jsonb` рефайниться ресурсом); `PgEnumColumn` → `z.enum(column.enumValues)`. Розпізнавання — через `is(column, PgVarchar)` тощо з `drizzle-orm`/`drizzle-orm/pg-core`, не зіставленням рядків, де можливо; будь-який інший тип → `throw new Error('[admin-server] columnsToZod: тип колонки <тип> ("<таблиця>.<колонка>") не підтримано')`.
- Optional/nullable (як `selectConditions`/`insertConditions`/`updateConditions` drizzle-zod): `nullable` = `!column.notNull` у всіх режимах; `optional`: insert = `!notNull || (notNull && hasDefault)`, update = завжди, select = ніколи. `refine` — функція над БАЗОВОЮ схемою колонки, nullable/optional навішуються ПОВЕРХ результату (🔴 інакше колонка без `.notNull()` стала б обовʼязковою в patch — див. `resource.test.ts` «patch БЕЗ images — ok»). Колонки `generated.type === 'always'` / `generatedIdentity.type === 'always'` — пропускаються в insert/update (як `never` у drizzle-zod; у схемі ядра таких немає — тест на синтетичній таблиці).

- [ ] **Step 1: Тести (червоні).** Один `it` на тип × режим: uuid валідний/невалідний; text; varchar (`n` проходить, `n+1` ні); boolean; integer (межі int32, `1.5`, `NaN`, `Infinity`); timestamp (`Date` ок, `new Date('x')`, рядок, число — ні); numeric (рядок ок, число ні); jsonb (`{}`, `[]`, рядок ок; `undefined` ні); enum (член ок, чужий ні); nullable/optional за режимами (`notNull` без default → обов'язкова в insert; з default → optional; update — всі optional; select — без optional); refine-функція зберігає nullable/optional; невідомий тип (синтетична колонка `pgInterval`/`pgPoint`) → throw з іменем колонки; `generatedAlwaysAs`-колонка відсутня в insert/update. RED: `pnpm vitest run packages/simplycms/src/admin-server/impl/__tests__/columns-to-zod.test.ts` → FAIL (модуля немає).
- [ ] **Step 2: Реалізація** за Interfaces. Каст `enumValues` (`[string, ...string[]]`) і доступ до `length`/`mode` — через `is(...)`/звуження класу, без `as never`/`as unknown as`; якщо неминучий — один точковий каст із коментарем-причиною всередині `columnSchema`.
- [ ] **Step 3: GREEN** тієї ж команди; `wc -l columns-to-zod.ts` ≤150.
- [ ] **Step 4: Коміт** `feat(admin-server): columnsToZod — власний генератор zod-схем колонок (9 типів, невідомий — throw)`.

---

## Task 11: Постійний гейт паритету з мутаційним контролем

**Files:**
- Modify: `packages/simplycms/package.json` (`devDependencies`: `"drizzle-zod": "0.8.3"`; з `dependencies` НЕ прибирати до Task 13), `pnpm-lock.yaml`.
- Create: `packages/simplycms/src/admin-server/impl/__tests__/columns-to-zod-parity.test.ts` (≤150 рядків; допоміжне — `__tests__/support/parity-values.ts`, `parity-diff.ts` за потреби).
- Інвентар таблиць: імпортувати КОНФІГИ ресурсів (`impl/*/resource.ts`, `property-values/resources.ts`) або їхні `table`-и — тест сам знаходить усі 14 ресурсних таблиць (не статичний список, щоб нова таблиця Е6а автоматично потрапляла в гейт); `getTableColumns(table)`.

**Interfaces:**
- `diffAgainstReference(generate: typeof columnsToZod): string[]` (локально в тесті) — для кожної `(table, mode, column)` і кожного значення з `VALUES` порівнює `generate(...)[col].safeParse(v).success` з `createInsertSchema|createUpdateSchema|createSelectSchema(table).shape[col].safeParse(v).success`; при `success` — також `Object.is`/`deepEqual` результату `data`; повертає перелік розбіжностей (порожній = паритет).
- `VALUES` ≈ 30+ значень: `undefined`, `null`, `''`, `'x'`, рядок довжини 255/256/10_001, валідний/невалідний/порожній uuid, `0`, `1`, `-1`, `1.5`, `2147483647`, **`2147483648`**, `-2147483648`, `-2147483649`, `Number.MAX_SAFE_INTEGER`, `NaN`, `Infinity`, `true`, `'true'`, `1`-як-boolean, `new Date()`, **`new Date('invalid')`**, ISO-рядок, `{}`, `[]`, `['a']`, `{ a: 1 }`, `'1.50'`, `1.5`-як-numeric, Symbol-не-серіалізовне (поза межами), enum-значення (з `column.enumValues`) і чужий рядок; плюс для кожної `varchar(n)` — рядки `n` і `n+1`.

- [ ] **Step 1: Інвентар-тест (RED/факт).** `it('9 типів колонок у ресурсних таблицях і жодного невідомого')`: множина `column.columnType` усіх колонок усіх ресурсних таблиць = `{PgUUID, PgText, PgVarchar, PgBoolean, PgInteger, PgTimestamp, PgNumeric, PgJsonb, PgEnumColumn}` (спека: 9 типів, 166 колонок у 14 таблицях — порівняти й записати фактичні числа в Факти; розбіжність — зупинка).
- [ ] **Step 2: Тест паритету:** `it('columnsToZod збігається з drizzle-zod: усі колонки × insert/update/select × VALUES')` → `expect(diffAgainstReference(columnsToZod)).toEqual([])`. Для колонок із `refine`-ом ресурсу (`products.images`, `product_modifications.images`) порівнювати з `createXSchema(table, refine)` тим самим refine.
- [ ] **Step 3: `frozen intent`** (≈15 `it`, без drizzle-zod): ключові твердження з Task 10 Step 1 на колонках реальних таблиць (`orders.total` numeric → лише рядок; `products.name` varchar; будь-яка `integer`-колонка 2147483648 → відхилено; `created_at` Invalid Date → відхилено; `notNull` без default в insert → обов'язкова).
- [ ] **Step 4: Мутаційний контроль — ПОСТІЙНИЙ мета-тест.** `it('гейт ловить розбіжність: мутований генератор дає непорожній diff')` для ≥4 мутацій, що застосовуються обгорткою над `columnsToZod` (замінює схему колонок певного типу в повернутій формі): (м1) integer `z.int()` → `z.number()`; (м2) прибрати `.nullable()` у select; (м3) прибрати `max(n)` у varchar; (м4) `z.date()` → `z.any()`. Кожен → `diffAgainstReference(mutated).length > 0`. Спека: м1 валить 9 тестів — порівняти кількість розбіжностей/колонок.
- [ ] **Step 5: Ручна мутація реалізації** (вивід у Факти): тимчасово `z.int()` → `z.number()` у `columns-to-zod.ts` → паритет-тест RED з іменами колонок; повернути.
- [ ] **Step 6:** `pnpm install` (lock), `pnpm install --frozen-lockfile` чистий; GREEN: `pnpm vitest run packages/simplycms/src/admin-server/impl/__tests__/columns-to-zod-parity.test.ts`.
- [ ] **Step 7: Коміт** `test(admin-server): постійний гейт паритету columnsToZod з drizzle-zod (devDependency) + мутаційний контроль`.

**Acceptance:** гейт перебирає всі ресурсні таблиці автоматично; мета-тест доводить, що він здатен червоніти; чесна межа (оголошений тип vs рантайм) задокументована коментарем у шапці тесту: гейт — ЄДИНИЙ механізм, що ловить розбіжність `InferInsertModel/InferSelectModel` з рантайм-формою.

---

## Task 12: `buildResourceSchemas` на `columnsToZod`; прибрати `SafePick` і касти; переписати тести

**Files:**
- Modify (переписати, ≤150 рядків; було 182): `packages/simplycms/src/admin-server/impl/resource-schemas.ts`.
- Modify: `packages/simplycms/src/admin-server/impl/resource-config.ts` (коментар до `refine` без «drizzle-zod»; `ResourceRefine` лишається ФУНКЦІЯМИ), `…/resource.ts` (виклик `buildResourceSchemas` без змін сигнатури; перевірити `Row`/`as Row[]`), `…/resource-write.ts`, `…/resource-list.ts` (маркер DZOD-1 — Task 13), `products/resource.ts:21`, `product-modifications/resource.ts:21`, `schema/json.ts:5` (коментарі «drizzle-zod» → «генератор схем»).
- Modify (переписати): `packages/simplycms/src/admin-server/impl/__tests__/resource-omit.test.ts` (`ZodPipe` не має `.shape`: тест «rowSchema не має accessToken» ~:74–77 → через `parse`/ключі виводу: `Object.keys(ops.rowSchema.parse(fullRow))` або `ops.rowShapeKeys`, див. Interfaces).
- Modify: `packages/simplycms/src/admin-server/impl/__tests__/resource.test.ts` (`expectTypeOf`-кейси БЕЗ кастів на місцях виклику; ~13 за `grep -c expectTypeOf`, спека каже 14 — порахувати й зафіксувати).

**Interfaces:**
- `buildResourceSchemas<T, W, I, O>(table, writable, refine?, insertOnly = [], omit = [])` — сигнатура й генерики БЕЗ змін; повертає `{ rowSchema, insertSchema, updateSchema, removeSchema }`.
- Внутрішній хелпер (єдина межа касту, у `resource-schemas.ts` або `columns-to-zod.ts`): `declared<Out>(shape: Record<string, z.ZodType>): z.ZodType<Out>` ≡ `z.object(shape).pipe(z.custom<Out>(() => true))`. 🔴 Pick/omit/extend виконуються НАД `shape` (звичайний `Pick` ключів) ДО `declared`; `.extend({ id: z.uuid() })` — додається в `shape` insert-рядка; patch-схема = `declared(pickedUpdateShape).refine(p => Object.keys(p).length > 0, { message: 'patch не може бути порожнім' })`. `insertSchema = z.array(insertRow).min(1).max(100)`, `updateSchema = z.array(z.object({ id: z.uuid(), patch })).min(1).max(100)`, `removeSchema` — як було.
- Оголошені типи: insert-рядок = `Pick<InferInsertModel<T>, W | I> & { id: string }`; patch = `Partial<Pick<InferInsertModel<T>, W>>`; row = `Omit<InferSelectModel<T>, O>`. Для `z.infer<typeof ops.insertSchema>[number]` тести Task `resource.test.ts` (`not.toHaveProperty('isDefault')`, `toHaveProperty('propertyType')` тощо) мають лишитись зеленими без змін ТВЕРДЖЕНЬ.
- Для тесту `omit`: `rowSchema` НЕ має `.shape` — додати до результату фабрики тільки якщо потрібно (наприклад, `rowKeys: readonly string[]`); інакше тест переписати на `parse`-вивід (бажано: мінімальна поверхня, `parse` приймає `Row`-подібний об'єкт; 🔴 `z.object` у strip-режимі викидає невідомі ключі — саме це й доводить відсутність `accessToken`).

- [ ] **Step 1: Спочатку тести (RED).** Переписати `resource-omit.test.ts` («rowSchema не має accessToken» — через parse: фікстура з `accessToken` і `orderNumber` → вивід без `accessToken`, з `orderNumber`); у `resource.test.ts` прибрати касти на місцях виклику (якщо вони є) і перевірити, що `pnpm typecheck` на ЦЬОМУ етапі червоний саме на місцях, де старий `buildResourceSchemas` не дає типів без кастів (RED типів), або зафіксувати, що касти були лише всередині фабрики.
- [ ] **Step 2: Реалізація:** переписати `resource-schemas.ts` на `columnsToZod` + `declared` за Interfaces; видалити `SafePick`, `plainInsert/plainUpdate`, касти `as never`/`as unknown as`, `import … from 'drizzle-zod'`. Експорт `ColumnName`/`ResourceRefine` — без змін.
- [ ] **Step 3: `resource-write.ts`** — оцінити, чи генератор знімає касти (`parsed as never`, `ctx.picked as never`, `as unknown as unknown[]`): ці касти про дженерик-таблицю Drizzle, а не про zod — ймовірно залишаються; прибрати лише ті, що реально стають зайвими (компіляція чиста), решту лишити з коментарем без маркера DZOD-1. Рішення — у Факти.
- [ ] **Step 4: GREEN:** `pnpm typecheck`; `pnpm vitest run packages/simplycms/src/admin-server` (усі `resource*.test.ts`, паритет Task 11, `subset`); усі `expectTypeOf` у `resource.test.ts` і `resource-omit.test.ts` компілюються БЕЗ кастів на місцях виклику; `@ts-expect-error`-контролі (`AdminResourceColumnGuards`) досі спрацьовують (негативні контролі типів не мовчать).
- [ ] **Step 5:** `PG_HARNESS_URL=… pnpm test:schema` (спайк: 352/352; нові файли додадуть) — харнес-тести `admin-catalog*`, `admin-orders`, `admin-order-statuses` — реальні insert/update через нову схему.
- [ ] **Step 6:** `pnpm build:packages` — декларації через `tsc -p tsconfig.dts.json`: перевірити, що експортований тип `defineAdminResource`/`AdminResourceOps` емітується без `TS2742` («inferred type cannot be named») і `TS2589`; якщо `declared<Out>` ламає емісію — явно анотувати повернення (`ZodType<Out>`) у публічних місцях.
- [ ] **Step 7: Коміт** `refactor(admin-server): buildResourceSchemas на columnsToZod; без SafePick і кастів drizzle-zod`.

**Acceptance:** `resource-schemas.ts` ≤150 рядків; 0 `as` у генеричному шляху схем; `git grep -n "from 'drizzle-zod'" -- packages/simplycms/src` лише в тесті паритету; усі `expectTypeOf` без кастів на виклику.

---

## Task 13: Прибрати `drizzle-zod` з `dependencies` і декларації межі; закрити DZOD-1

**Files:**
- Modify: `packages/simplycms/package.json` (`dependencies`: видалити `"drizzle-zod": "^0.8.3"` (~:590); `devDependencies` лишається з Task 11), `pnpm-lock.yaml`.
- Modify: `packages/simplycms/src/contracts/server-only.ts` (~:78: видалити `{ name: 'drizzle-zod' }` з `SERVER_ONLY_DEPS`).
- Modify: `tests/plugin-trust-boundary.test.ts` (~:175: фікстура `"import { createSelectSchema } from 'drizzle-zod';"` → іншу серверну залежність зі списку, напр. `"import { drizzle } from 'drizzle-orm/node-postgres';"`).
- Modify: маркери `UPSTREAM:DZOD-1` у `admin-server/impl/order-items/editable.ts:49`, `orders/change-status.ts:52`, `resource-list.ts:32` — ці касти (`.select(proj as never).from(...)`) — інтринсивне обмеження генеричної проєкції Drizzle, НЕ drizzle-zod: замінити коментар на звичайне пояснення БЕЗ маркера (див. «Відкриті питання» №2).
- Modify: `docs/architecture/upstream-workarounds.md` (DZOD-1 → «Закриті»), `CLAUDE.md` рядок ~122 («TanStack DB, drizzle-zod, typescript-eslint, tsdown…») — перелік бібліотек у реєстрі лишається правдивим (закриті записи залишаються), правка не потрібна; перевірити.
- Modify: `CHANGELOG.md` (`[Unreleased]`).

- [ ] **Step 1: Перевірка читачів `SERVER_ONLY_DEPS`** до правки: `git grep -n "SERVER_ONLY_DEPS\|serverOnlyDepSpecifier" -- . ':!docs'` — прочитати кожного споживача (eslint-групи плагінів, `tests/dist-server-boundary.test.ts`, Gate C пілота `SERVER_PAYLOAD`, `tests/plugin-trust-boundary.test.ts`), переконатися, що список виведений програмно (спека: «сім читачів»), а не продубльований.
- [ ] **Step 2: Правки** за Files. `pnpm install` (lock) → `pnpm install --frozen-lockfile`.
- [ ] **Step 3: Гейти меж:** `pnpm vitest run tests/plugin-trust-boundary.test.ts tests/tier-boundary.test.ts tests/audit-deps.test.ts` зелені; `pnpm lint` 0/8; після `pnpm build:packages` — `pnpm vitest run tests/dist-server-boundary.test.ts tests/dts-toolchain.test.ts`; `pnpm test:packaging` (tarball-parity: `drizzle-zod` більше не в `dependencies` опублікованого `simplycms`).
- [ ] **Step 4: Реєстр.** DZOD-1 → «Закриті» (формат TSDB-5; висновок: замінено власним генератором `columnsToZod` (Етап B), гейт паритету — `columns-to-zod-parity.test.ts`; `drizzle-orm/zod` 1.0.0-rc.4 DZOD-1 не лікував — 13 помилок без кастів; `drizzle-zod` лишився devDependency як еталон паритету; при міграції на Drizzle 1.0 (тема 7в) еталон замінити на `drizzle-orm/zod` або зняти). `git grep -n "UPSTREAM:DZOD-1"` порожній (поза `docs/`).
- [ ] **Step 5: Коміт** `chore(deps): drizzle-zod лише devDependency (еталон паритету); DZOD-1 закрито`.

**Acceptance:** `git grep -n "drizzle-zod"` (без `docs/superpowers`, `pnpm-lock.yaml`) → лише `package.json` devDependencies, тест паритету, закритий запис реєстру, CHANGELOG; усі межові гейти зелені.

---

## Task 14: Гейти Етапу B, `live:smoke`, доки

**Files:** `docs/tasks/v2-state-map.md`, `docs/tasks/platform-roadmap.md` (відмітка «крок 4 треку оновлень виконано»), `docs/architecture/test-contours.md` (§11: постійний гейт паритету генератора схем — ЩО доводить і яка межа (оголошений тип vs рантайм)), `docs/superpowers/specs/2026-10-04-deps-security-tooling-design.md` (статус-рядок 7б), `CHANGELOG.md`, цей план («Факти виконання»).

- [ ] **Step 1: Повний ланцюг** (команда з Task 9 Step 4) + `live:smoke`: створення/збереження товару, залишки, довідники, замовлення — усе йде через нові схеми на реальному сервері (`admin-catalog.mjs`, `admin-dictionaries.mjs`, `admin-order-edit.mjs`). Вивід — у Факти.
- [ ] **Step 2: Ручний прогін** («пункт — факт»): у формі товару вказати некоректні значення (занадто довга назва, від'ємний/надвеликий залишок, пусте обов'язкове поле) — тост/помилка валідації (400), не 500; нормальне збереження працює.
- [ ] **Step 3: Доки** — `test-contours.md` §11 (новий гейт), `v2-state-map.md` (де описано `drizzle-zod`/`defineAdminResource` — актуалізувати), `CHANGELOG.md`, відмітка в спеці. `CLAUDE.md` — перевірити, що жодне ПРАВИЛО не змінилось (стану не писати).
- [ ] **Step 4: Коміт** `docs: фундамент даних адмінки — Етап B (columnsToZod), гейт паритету`.

**DoD Етапу B:** (1) гейт паритету зелений і з доведеним RED на мутації (вивід у Фактах); (2) усі `expectTypeOf` компілюються без кастів на виклику; (3) `resource-schemas.ts` ≤150 рядків; (4) `drizzle-zod` — лише devDependency; DZOD-1 закрито; (5) повний ланцюг + `live:smoke` зелені; lint 0/8; (6) доки оновлено.

---

## Відкриті питання для виконавця

1. ~~`eq` по `sortable`~~ — **вирішено архітектором**, див. Task 2 Interfaces.
2. **Маркери DZOD-1 на кастах генеричної проєкції** (`resource-list.ts`, `order-items/editable.ts`, `orders/change-status.ts`) — **вирішено архітектором:** спершу встановити корінь кожного касту. Якщо каст компенсує обмеження типізації Drizzle для `T extends Table`/`PgTable` (обхід бібліотеки) — **новий запис `DRZ-2`** у `docs/architecture/upstream-workarounds.md` за форматом реєстру (корінь з якорем на вихідний код `drizzle-orm`, «Перевірка виправлення» — прибрати касти й прогнати typecheck) і маркери `UPSTREAM:DRZ-2` на всіх цих місцях; DZOD-1 не перевикористовувати. Звичайний коментар — лише якщо каст компенсує обмеження САМОГО TypeScript без участі типів бібліотеки (довести прикладом без Drizzle).
3. **`useLiveInfiniteQuery(fn, opts, deps)`** — чи теж задепрекований у 0.5.3 (Task 8 Step 1): **за замовчуванням** мігрувати, якщо бібліотека це вимагає/попереджає.
4. **Фолбек Date через ISO-рядок** (Task 2 Step 1) — лише якщо вимір покаже, що seroval Date не переносить; тоді рішення згодити з власником перед реалізацією, бо воно змінює форму payload.

## Нотатки до спеки (суперечності й прогалини, знайдені при складанні плану)

- «16 з 330 червоні» vs перелік: 3+2+1+1+2+1+1+1 = 12 названих + 3 `subset-payload` = 15 + «ще ~9» = ~24 > 16. Реальний перелік — Task 1 Step 4; не вважати «16» точним.
- TSDB-1: у «Фактах» «неактивні записи видаляються з кешу», а у вердикті «неактивний зріз містить повний правильний набір» — потрібен вимір (Task 6 Step 1).
- «14 `expectTypeOf` у `resource.test.ts`»: за `grep` у файлі їх 13 (+2 у `resource-omit.test.ts`).
- Спека не каже про `eq` на sortable (питання №1) і про `useLiveInfiniteQuery` deps (питання №3).
- 7б: «`drizzle-zod` лишається devDependency … або тест порівнюється із зафіксованими очікуваннями — вибір у плані» — вибір зроблено в «Рішення плану».

---

## Факти виконання

_(заповнює виконавець: коміти `git log --oneline <база>..HEAD`; вивід гейтів; таблиця червоних тестів (Task 1/3); виміри (Task 2 Step 1, Task 6 Step 1, Task 7 Step 1); RED-докази мутацій; відхилення від плану з обґрунтуванням; `wc -l` нових файлів.)_
