# V2-К3 · Етап Е3: каталог адмінки on-demand — перший push-down, товар і сателіти наживо

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Оживити каталог адмінки на чистому Postgres — список товарів, картку товару з модифікаціями, цінами, залишками, властивостями й зображеннями — через першу **on-demand** колекцію TanStack DB із серверним push-down у Drizzle, і довести наскрізно живим прогоном «власник створив товар в адмінці → покупець бачить і купує його на вітрині».

**Architecture:** Серверний шар — той самий, що в Е1б (`defineAdminResource` → plain-операції + Zod-схеми; явні топ-рівневі `createServerFn` у `admin-server/index.ts`), але нутрощі розкладаються по сутностях (`admin-server/impl/<entity>/`, амендмент К3-9′ треку T), операції ходять через один хелпер `runAdmin` (перший рубіж + scope + мапінг конфліктів БД у 409), а інваріанти (дефолтна модифікація, порядок, набір цін, залишки зі статусом) — іменованими операціями. Клієнт — колекції `admin-data`: `products` і сателіти в режимі `syncMode: 'on-demand'` (предикат `useLiveQuery` → `LoadSubsetOptions` → `toSubsetPayload` → `subsetInputSchema` → Drizzle `where`), довідники `sections`/`price_types` — eager лише на читання. Гвардований перехід `stock_status` виноситься з вітрини в спільне server-only дерево `simplycms/inventory`, яке кличуть і воронка покупця, і залишки адмінки — одна копія правила.

**Tech Stack:** `@tanstack/react-db` 0.3.6 + `@tanstack/query-db-collection` 1.2.11 (обидва пінять `@tanstack/db` 0.8.6; `useLiveInfiniteQuery`, `syncMode: 'on-demand'`, `parseLoadSubsetOptions`) · `drizzle-zod` 0.8.3 · TanStack Start 1.167 · TanStack Query 5.101 · Drizzle 0.45.2 · Zod 4.4.3 · TypeScript 5.9 strict · Vitest 4 · Playwright (`pnpm live:smoke`)

**Spec:** [`2026-08-29-v2-k3-admin-server-layer-design.md`](../specs/2026-08-29-v2-k3-admin-server-layer-design.md) — 🔴 читати З РЕВІЗІЄЮ 2026-08-31 (К3-4′, К3-9′, К3-13, К3-14) і амендментом треку T (розкладка `./admin-server/impl/<entity>`). Попередні плани треку, чиї патерни тут повторюються: [Е1б](./2026-08-30-v2-k3-e1b-server-layer.md) (фабрика, колекція, сторінка `order-statuses`), [Е2](./2026-09-13-v2-k3-e2-storage-minimum.md) (порт сховища, `ImageUpload`, крок `live:smoke`). Розвилки, яких спека не закриває, вирішені власником 2026-09-22 — таблиця «Ухвалені рішення етапу».

**Обсяг:** Е3 з восьми етапів К3. Після нього живі `/admin/products` і `/admin/products/$productId` з усім деревом картки. Решта каталогу (сторінки розділів, типів цін, властивостей) — хвиля Е4; замовлення (разом з `AddProductToOrder`) — Е5.

---

## Ухвалені рішення етапу (власник, 2026-09-22; архітектор плану — там, де позначено)

| № | Рішення | Причина |
|---|---|---|
| Е3-1 | **Скоуп — товар + сателіти.** Переписуються `Products`, `ProductEdit`, `ProductModifications`, `ProductPricesEditor`, `StockByPointManager`, `ProductPropertyValues`, `AllProductProperties`, `SimpleProductFields`. Довідники `sections`, `price_types` — eager-колекції **лише на читання**; схема властивостей (`section_property_assignments`, `section_properties`, `property_options`) — on-demand колекції лише на читання, зріз по розділу. Сторінки редагування цих довідників — Е4 | Картка товару без розділу, типу ціни й схеми властивостей не рендериться, але їхні власні CRUD-сторінки — окрема хвиля. Читання ≠ керування: колекція на читання не має persistence-хендлерів, і `collection.insert` на ній кидає — випадкового запису повз Е4 бути не може |
| Е3-2 | **Список товарів: фільтри + «Показати ще», без текстового пошуку.** On-demand: фільтри розділ / активність / наявність (`eq`), сортування, `useLiveInfiniteQuery` (offset + peek-ahead). Загальної кількості немає. Пошук за назвою/SKU — контур П6 спеки пошуку | Push-down бібліотеки (`extractSimpleComparisons`) кидає на `like`/`ilike`/`or` — пошук вимагав би першого оператора поза стандартним контрактом і виперед­жав би спроєктований П6. `useLiveInfiniteQuery` — єдиний вбудований пагінатор; лічильник був би ще одним server-first винятком без потреби |
| Е3-3 | **Залишки — іменована операція `saveStock`.** Пише `stock_by_pickup_point` і в ТІЙ САМІЙ транзакції застосовує гвардований перехід `stock_status` (сума > 0 → з `out_of_stock` в `in_stock`; сума = 0 → з `in_stock`/NULL в `out_of_stock`; `on_order` не чіпається ніколи). Правило — одне на вітрину й адмінку | Тригерів у БД немає, `stock_status` — збережена колонка (`domain/inventory.ts:12-21`). Без перерахунку демо показало б «В наявності: 0 шт» — рівно клас дефекту, закритий К2-Е0 («бейдж = БД») |
| Е3-4 | **Живий прогін отримує адміна через `issueOwnerInvite`**, а не SQL у `user_roles`: крок `live:smoke` випускає запрошення (лист — заглушка, URL із результату), проходить `/auth/invite` → пароль → вхід у браузері | Доводить РЕАЛЬНИЙ флоу власника, а не лише адмінку. SMTP-доставка лишається поза контуром (борг №1 / К1а-6) |
| Е3-5 | 🔴 *(архітектор)* **Спільне server-only дерево `simplycms/inventory` (T2)** замість імпорту з `storefront/loaders` | `admin-server` → `storefront` — імпорт у межах T2, який тір-зона забороняє (`eslint.tier-zones.mjs`, виняток `admin-server` = `db/auth/storage`). Розширити виняток на `storefront` означало б дозволити адмінці весь граф вітрини; скопіювати гвард — дві копії правила (канон «одна копія», урок К2-Е0). Облік залишків — окремий домен, якому належать обидва споживачі |
| Е3-6 | *(архітектор)* **Уся адмін-поверхня каталогу, включно з ЧИТАННЯМ, — під `catalog.write`** | `catalog.read` дає `user: 'any'` (`auth/authz.ts:59`), а адмін-список показує неактивні товари й чернетки. Операції читання адмінки не є публічним каталогом |
| Е3-7 | *(архітектор)* **Конфлікти БД — контракт помилок, а не «Failed query».** `runAdmin` мапить `23505` (унікальність, напр. slug) і `23503` (посилання, напр. товар у замовленнях) у `AdminConflictError` зі статусом 409 (`setResponseStatus` ДО `throw`, як К3-13); клієнт розрізняє за `error.name` | Drizzle перезагортає помилку драйвера (борг К1а-5: текст Postgres лише в `.cause`). Без мапінгу власник бачить SQL-текст замість «такий slug уже є» / «товар є в замовленнях — деактивуйте його» |
| Е3-8 | *(архітектор)* **Offset-пагінація зі стабільним порядком:** `list()` фабрики ЗАВЖДИ дописує `id asc` останнім ключем сортування | `created_at` не унікальний (сід і масовий імпорт дають однакові мітки). Без тай-брейкера offset між сторінками дублює або губить рядки |
| Е3-9 | *(архітектор)* **`updated_at` веде фабрика:** опція `touch: 'updatedAt'` дописує `new Date()` у кожен `update` | Тригера `updated_at` немає (жодного `CREATE TRIGGER` у каноні); картка товару показує «Оновлено:», і воно мусить бути правдою |
| Е3-10 | *(архітектор)* **Набір цін — іменована операція `saveProductPrices`** (атомарна заміна набору для пари товар/модифікація), не три фабричні мутації | Кнопка «Зберегти ціни» — ОДИН акт; три окремі транзакції (insert/update/delete) дали б частково збережений набір. Композитний ключ `idx_product_prices_unique` з `COALESCE` не виражається фабричним upsert-ом |
| Е3-11 | *(архітектор)* **Автозбереження значень властивостей лишається** (UX-паритет): кожна зміна — оптимістичний `collection.insert/update` фабричних операцій | Модель «зберігай на зміну» вже є в легасі; переписування UX — не мета етапу. Унікальність тримає БД (див. Е3-13), клієнт бачить наявні рядки в колекції |
| Е3-12 | *(архітектор)* **Борги Е1а:** №4 (`detail()` slug vs uuid) — адмінка `detail()` НЕ вживає взагалі (колекції ключуються `list()` + demand-суфікс бібліотеки), борг документується як належний К2; №6 — `entityKey` отримує окремий `variant()` для не-FK кваліфікаторів; №8 — зона `query-key-from-entity` поширюється на референс-тему й референс-плагін | №4 проявляється лише при детальному ключі, якого адмінка не заводить; №6 і №8 — дешеві точкові фікси, які план Е1б прямо відклав «у каталог» |
| Е3-13 | 🔴 **(власник, 2026-09-22) Multiselect — рядок на опцію.** Правка baseline (рамка B13, як К3-14): унікальність значень стає `(власник, property_id, option_id) NULLS NOT DISTINCT` в обох таблицях значень; скалярна властивість — рівно один рядок (`option_id` NULL), multiselect — рядок на кожну обрану опцію. Картка вітрини зливає рядки однієї властивості в один запис view-моделі | Виміряно: `option_id` — `uuid` FK (`schema.ts:274,305`), а легасі писав туди CSV id — на чистому Postgres `22P02`, і `unique(product_id, property_id)` забороняв кілька рядків. Тобто multiselect був зламаний схемою, а не лише кодом. Рядок на опцію — реляційно чесно (FK на опцію живий), фільтри вітрини читають рядки списком і працюють без змін; контракт тем v3 (один елемент на властивість) не міняється |
| Е3-14 | *(архітектор)* **`isNull` входить у контракт subset** на обох боках (`toSubsetPayload` + `impl/subset.ts`) | Ціни й залишки РІВНЯ ТОВАРУ — рядки з `modification_id IS NULL`. `isNull` є у словнику push-down самої бібліотеки (`extractSimpleComparisons`); без нього довелося б тягнути ширший зріз і дофільтровувати в JS — тобто push-down на половину |
| Е3-15 | 🔴 *(архітектор, аудит 2026-09-23)* **Голий `entityKey(e).list()` — ЛИШЕ для колекцій `admin-data`** (спека К3-3: `[entity, 'list']` — колекція). Вітринні запити, що сьогодні кешуються під голим `.list()` (`sections`, `propertyOptions`, `sectionProperties`, `orderStatuses`), переходять на `variant(...)`; гейт забороняє голий `.list()` поза `admin-data` | Виміряно аудитом: вітрина й адмінка ділять ОДИН `QueryClient` (`src/router.tsx`), а eager-колекція без demand-суфікса пише рівно в `[entity,'list']`. Вітринний `useSectionsQuery` кешує там лише активні розділи в snake_case, адмін-колекція — усі розділи в camelCase: після адмінки покупець бачив би чернетки або зламаний рендер до спливання `staleTime` 5 хв. Для `order_statuses` це ЖИВИЙ дефект уже в `main` (колекція Е1б × `ProfileOrders.tsx:36`). Канон спеки не міняється — порушник вітрина |
| Е3-16 | 🔴 *(архітектор, виміряно спайком 2026-09-23)* **On-demand колекція, яку гортає `useLiveInfiniteQuery`, мусить мати індекс сортування:** `autoIndex: 'eager'` + `defaultIndexType: BTreeIndex` (з `@tanstack/react-db`) | Без індексу `fetchNextPage` НЕ робить другого `loadSubset` — видно лише рядки першої сторінки + peek, `hasNextPage` падає в `false`. З індексом друга сторінка йде окремим запитом `{ limit: 2, offset: 3, cursor }` і дає рівно 4 рядки (ізольований прогін на `@tanstack/db@0.8.6`). Offset-пагінація Е3-2 реалізовна без fallback |

**Поза Е3 (план це каже вголос):** текстовий пошук в адмінці (П6); CRUD розділів, типів цін, властивостей і опцій (Е4); `AddProductToOrder` і замовлення (Е5); видалення файлів зображень при видаленні товару та sweep орфанів (К4 — рядки `media` лишаються, обʼєкти прибирає sweep); інвалідація кешу вітрини в ІНШІЙ вкладці браузера (SSR свіжий на кожен запит; клієнтський кеш вітрини — `staleTime` 5 хв, карта інвалідації між вкладками — К2); віртуалізація таблиць.

---

## Ступінь обовʼязковості — читати ПЕРШИМ

🔴 Цей документ — план імплементації, а не специфікація до останнього рядка.
Правила ті самі, що в плані Е2 (розділ «Ступінь обовʼязковості»), коротко:

**КАНОН (розбіжність → зупинись і принеси замовникові):** контракти `id`,
серверного env, ключів кешу; межа клієнт/сервер (`contracts/server-only`),
тір-зони, ролі й транзакції (`requireGrant` → `withActor`); що саме доводить
кожен гейт; таблиця «Ухвалені рішення етапу»; «одна копія правила»; канон
150 рядків на НОВИЙ файл; коментарі українською, рядки інтерфейсу — в ОБИДВА
каталоги i18n; DoD кожної задачі й порядок задач.

**ОРІЄНТИР (виконавець адаптує сам):** імена локальних змінних, розкладка
на модулі всередині вказаної теки, якорі `файл:рядок` (шукати за текстом),
лічильники кейсів і рядків, формулювання коментарів і комітів.

🔴 **Звіт виконавця про зелений гейт — не доказ.** Гейти перевіряє той, хто
приймає задачу, повторним прогоном.

🔴 **Крок «має бути ЗЕЛЕНИМ одразу» перевіряє ПРИПУЩЕННЯ ПЛАНУ.** Червоне на
ньому — помилка плану (списку колонок, припущення про бібліотеку), а не
привід підганяти гейт. Такі кроки: Task 0 (увесь спайк), Task 3 Step 6
(exhaustiveness колонок), Task 12 Steps 1 і 3 (зона й повнота ратчету),
Task 9 Step 3 (фільтри вітрини на рядку-на-опцію без змін).

🔴 **Адресація задач — заголовками `## Task N:`** (рівно два дієзи):
`awk '/^## Task 3:/,/^## Task 4:/'`. Рівень заголовка не міняти.

## Global Constraints

- TypeScript 5.9 strict; **не** оновлювати до 6/7.
- Node `>=22.12`; нових порогів не заводити.
- Коментарі й документація — **українською**; рядки інтерфейсу — лише через i18n (`packages/simplycms/src/i18n/catalogs/{uk,en}/admin/products.ts` і сусіди); кириличний рядок у JSX `src/admin/**` валить лінт (i18n error-зона).
- `pnpm lint` = **0 errors / 10 warnings** (виміряно 2026-09-22). Число warnings не має зрости; може впасти — тоді оновити CLAUDE.md у Task 12.
- Порядок гейтів: `pnpm install --frozen-lockfile → format:check → lint → build → typecheck → test → test:schema → build:packages → typecheck:template → test:packaging`; плюс `pnpm pilot:pack --skip-build` (Gate C).
- 🔴 **Мінімальний гейт КОЖНОЇ задачі перед комітом:** `pnpm lint && pnpm test` (+ `pnpm test:schema`, якщо задача чіпала `schema/`, `migrations/`, `test-harness/` або серверні операції; + `pnpm build:packages`, якщо задача чіпала серверний код пакета — урок хвилі B: пакетний tsconfig (`noImplicitAny: false`, emit декларацій) ловить `const rows = []` → `never[]`, якого кореневий `pnpm typecheck` не бачить, а `test:packaging` зеленіє на СТЕЙЛ-`dist`). `pnpm exec prettier --write <змінені файли>` перед комітом — `format:check` у CI червоніє інакше (урок хвилі B Е2).
- 🔴 **К3-4′:** `createServerFn` — ЛИШЕ топ-рівневий `const` у `packages/simplycms/src/admin-server/index.ts`; фабрики serverFn не повертають (гейт `server-fn-top-level`).
- 🔴 **К3-9′:** `admin-server/index.ts` експортує лише serverFn; нутрощі — під `admin-server/impl/**` (server-only за `contracts/server-only`), імпорт у index — BARE-специфікатором `simplycms/admin-server/impl`; клієнт (`admin-data`, сторінки) бере типи рядків лише `import type` з `simplycms/schema/types`; колекції БЕЗ `schema`.
- 🔴 **К3-13:** кожна операція — `requireGrant(op)` → `withActor({ role: dbRoleForSubject(subject), userId })`; з Task 1 — лише через `runAdmin`. 403/409 — `setResponseStatus` ДО `throw`; `Response` не кидати.
- 🔴 **Write-back замість self-invalidation:** persistence-хендлер пише серверний рядок `writeUpsert`/`writeDelete` у `writeBatch` і повертає `{ refetch: false }`; хендлери обробляють УСІ `transaction.mutations`. Fail-loud на `serverRow.id !== optimisticId` ДО write-back.
- 🔴 **Контракт id:** INSERT у таблицю Категорії A передає `id` — клієнт `crypto.randomUUID()`, сервер `randomUUID()` з `node:crypto`.
- 🔴 `queryKey` колекції = `entityKey(ENTITY.x).list()`; demand-суфікс on-demand дописує бібліотека (`getLoadSubsetDemandKey`) — префікс зберігається. 🔴 Голий `.list()` належить ЛИШЕ колекціям `admin-data` (Е3-15); вітрина — `variant()`/`scoped()` або `.list()` з суфіксом.
- 🔴 **Сторінка таблиці з single-default індексом переписується лише разом зі своєю named setDefault-операцією** (контракт хвиль Е1б) — тут це `product_modifications`.
- 🔴 **Інваріант `template:sync`:** задача, що чіпає `SYNCED_DIRS`/`SYNCED_FILES`, — `pnpm template:sync` і коміт копій у ТІЙ САМІЙ задачі. За планом це рівно Task 9 (`migrations/0001_init.sql`); якщо інша задача зачепить `migrations/`, `themes/default/`, `plugins/hello-world/` чи host-файл — те саме правило.
- Тіри: `admin-server` = T2 (upward `db/auth/storage` + з Task 2 `inventory`), `admin-data` = T4, `admin` = T5, нове `inventory` = T2 (upward `db`).
- Коміти — conventional, скоуп `k3-e3`, опис українською малими: `feat(k3-e3): …`; трейлер `Co-Authored-By` — за конвенцією сесії-виконавця.

## Review Focus

Входи й стани, яких спека прямо не називає, але які першими вдарять по власнику магазину. Кожен має тест у задачі-власниці коду.

1. **Дубль slug при створенні/перейменуванні товару чи модифікації** → власник бачить «такий URL уже зайнятий», а не текст SQL; форма лишається відкритою з введеним. Тест — Task 1 (мапінг 23505 → `AdminConflictError`), Task 3 (харнес: дубль slug → 409-клас), Task 7 (сторінка: тост з i18n-ключем).
2. **Видалення товару, що є в замовленнях** (`order_items_product_id_fkey` — `ON DELETE no action`) → «товар є в замовленнях — деактивуйте його», товар лишається у списку (оптимістичне видалення відкочується). Тест — Task 3 (харнес: 23503 → конфлікт), Task 6 (сторінка: rollback + тост).
3. **Пагінація при однакових `created_at`** → «Показати ще» не дублює й не губить товари. Тест — Task 1 (тай-брейкер `id` у SQL), Task 3 (харнес: 7 товарів з однаковою міткою, три сторінки по 3 — рівно 7 різних id).
4. **Ціна з комою («12,50»), порожнє поле, від'ємна ціна** → кома приймається як десятковий роздільник, порожнє поле = «ціни цього типу немає» (рядок видаляється), від'ємне/нечислове — помилка валідації до БД. Тест — Task 4 (схема `saveProductPrices`: `-1`, `abc` → 400; `12.50` → ok), Task 8 (нормалізація коми в редакторі).
5. **Друга модифікація «за замовчуванням»** → попередня тихо перестає бути дефолтною, 23505 не вилітає ніколи. Тест — Task 4 (харнес: setDefault двічі поспіль, рівно один `is_default`), Task 8 (створення з прапорцем → insert, ПОТІМ setDefault).

---

## Граф залежностей задач

```
Task 0 (спайк on-demand + toSubsetPayload)          ─┐
Task 1 (runAdmin, розкладка impl, конфлікти, touch) ─┤ незалежні між собою
Task 2 (simplycms/inventory)                         ─┘
Task 3 (ресурси каталогу + serverFn)        ← Task 1
Task 4 (іменовані операції)                 ← Task 1, Task 2, Task 3
Task 5 (колекції admin-data)                ← Task 0, Task 3, Task 4
Task 6 (сторінка списку)                    ← Task 5
Task 7 (картка товару: форма, зображення)   ← Task 5
Task 8 (модифікації, ціни, залишки)         ← Task 7
Task 9 (схема multiselect, правка baseline) незалежна від UI (після Task 3 — ресурси значень)
Task 10 (значення властивостей)             ← Task 7, Task 9
Task 11 (борги ключів Е1а №6, №8)           незалежна (після Task 5 — щоб не конфліктувати в eslint.config.mjs)
Task 12 (гейти: зона й повнота ратчету, id, Gate C) ← Task 6, 7, 8, 10
Task 13 (live:smoke крок адміна + DoD + доки) ← Task 12
```

## File Structure

**Створюються:**

| Файл | Відповідальність |
|---|---|
| `packages/simplycms/src/admin-data/subset-payload.ts` | `toSubsetPayload(LoadSubsetOptions)` — єдиний перехід предиката live-query у вхід list-serverFn (фільтри/сорти/limit + `offset` окремо, бо `parseLoadSubsetOptions` його губить) |
| `packages/simplycms/src/admin-data/handlers.ts` | `persistenceHandlers()` — спільні onInsert/onUpdate/onDelete з write-back і fail-loud id (дедуплікація) |
| `packages/simplycms/src/admin-data/__tests__/on-demand-contract.test.tsx` | Спайк, що лишається контрактним тестом: push-down, offset другої сторінки, `findOne`, join |
| `packages/simplycms/src/admin-data/collections/{products,product-modifications,product-prices,stock-by-pickup-point,product-property-values,modification-property-values}.ts` | On-demand колекції товару й сателітів |
| `packages/simplycms/src/admin-data/collections/{sections,price-types,section-property-assignments,section-properties,property-options}.ts` | Колекції лише на читання |
| `packages/simplycms/src/admin-server/impl/run.ts` | `runAdmin(operation, fn)` — перший рубіж + scope + `withActor` + мапінг конфліктів |
| `packages/simplycms/src/admin-server/impl/errors.ts` | `AdminConflictError` + `toAdminConflict()` (23505/23503 → 409) |
| `packages/simplycms/src/admin-server/impl/resource-schemas.ts` | Побудова Zod-схем ресурсу (винесено з `resource.ts`, розвантаження) |
| `packages/simplycms/src/admin-server/impl/{products,product-modifications,product-prices,stock,property-values,catalog-read}/*.ts` | Ресурси й іменовані операції по сутностях |
| `packages/simplycms/src/inventory/{index,stock-status,quantity-status}.ts` | Спільний облік: `StockTarget`, `loadTargetStatus`, `setTargetStatus`, `syncStatusWithQuantity` |
| `packages/simplycms/test-harness/pg/__tests__/admin-catalog.test.ts` | Інтеграційні тести ресурсів каталогу проти живого Postgres |
| `packages/simplycms/test-harness/pg/__tests__/admin-catalog-ops.test.ts` | Інтеграційні тести іменованих операцій |
| `packages/simplycms/src/admin/features/products/**` | UI фічі (T5): список, форма, модифікації, ціни, залишки, властивості — файли ≤150 рядків |
| `tests/mutation-cache-sync-coverage.test.ts` | Гейт повноти ратчету `MUTATION_CACHE_SYNC_RATCHET` |
| `scripts/live-smoke/owner-invite.mts` | Випуск запрошення власника (tsx, імпорт `packages/simplycms/src/auth`) |
| `scripts/live-smoke/admin-catalog.mjs` | Крок живого прогону: адмін створює товар → вітрина |
| `packages/simplycms/src/domain/__tests__/money-input.test.ts` | Юніт трьох нових експортів `domain/money.ts` (сам файл — ЗМІНЮЄТЬСЯ, не створюється: у ньому вже `formatPrice`) |
| `packages/simplycms/src/admin/lib/admin-error.ts` (+ тест) | `adminErrorKey` — конфлікт БД → i18n-ключ (Е3-7), один на всі хвилі |
| `packages/simplycms/test-harness/pg/__tests__/property-values-multiselect.test.ts` | Інваріант «рядок на опцію» (Е3-13) проти живого Postgres |
| `packages/simplycms/src/storefront-routes/pages/product-detail/merge-property-values.ts` (+ тест) | Злиття рядків однієї властивості в один запис view-моделі |

**Змінюються:**

| Файл | Що саме |
|---|---|
| `packages/simplycms/src/admin-server/impl/resource.ts` | `run` → `runAdmin`; `touch`; тай-брейкер `id`; схеми — з `resource-schemas.ts` |
| `packages/simplycms/src/admin-server/impl/index.ts` | реекспорт нових сутностей; шляхи order-statuses/media після переносу |
| `packages/simplycms/src/admin-server/impl/{operations,resources}/*` | 🔴 ПЕРЕНОС у `impl/order-statuses/`, `impl/media/` (git mv) |
| `packages/simplycms/src/admin-server/index.ts` | топ-рівневі serverFn каталогу |
| `packages/simplycms/src/admin-data/index.ts`, `collections/order-statuses.ts` | нові колекції; order-statuses на `persistenceHandlers` |
| `packages/simplycms/src/storefront/loaders/{stock-status,stock-write,stock-release,stock-reservation}.ts` | імпорт з `simplycms/inventory`; `stock-status.ts` видаляється |
| `packages/simplycms/src/contracts/server-only.ts` | `'inventory'` у `SERVER_ONLY` |
| `packages/simplycms/src/contracts/entities.ts` | `variant()` (борг №6) |
| `packages/simplycms/package.json` | exports + publishConfig `./inventory` |
| `eslint.tier-zones.mjs` | зона `src/inventory`; `inventory` в upward `storefront` і `admin-server` |
| `eslint.config.mjs` | `MUTATION_CACHE_SYNC_RATCHET` += сторінки каталогу; зона `query-key-from-entity` += тема/плагін |
| `packages/simplycms/src/admin/pages/{Products,ProductEdit}.tsx` | тонкі реекспорти `admin/features/products` (або видалення з перенаправленням роутів) |
| `packages/simplycms/src/admin/components/{ProductModifications,ProductPricesEditor,StockByPointManager,ProductPropertyValues,AllProductProperties,SimpleProductFields}.tsx` | 🔴 ВИДАЛЯЮТЬСЯ — замінені фічею |
| `packages/simplycms/routes/admin/admin/products/{index,$productId}.tsx` | `loader` з прогрівом live-query |
| `packages/simplycms/src/i18n/catalogs/{uk,en}/admin/products.ts` | ключі конфліктів, «Показати ще», фільтри, SEO-лейбли (замість хардкоду «URL (slug)», «Meta Title») |
| `tests/admin-inserts-need-id.test.ts` | `KNOWN_WITHOUT_ID` ↓ (виміряти після Task 9) |
| `tests/tier-boundary.test.ts` | негативний контроль зони `inventory` |
| `packages/simplycms/src/admin-server/impl/subset.ts` | оператор `isNull` (Е3-14) |
| `packages/simplycms/migrations/0001_init.sql`, `src/schema/schema.ts`, `drizzle/0000_init.sql`, `drizzle/meta/0000_snapshot.json` | 🔴 ПРАВКА BASELINE (Е3-13): унікальність значень властивостей `(власник, property_id, option_id) NULLS NOT DISTINCT`; копії — `pnpm template:sync` |
| `packages/simplycms/src/storefront-routes/pages/product-detail/useProductContent.ts` | злиття рядків однієї властивості — `merge-property-values.ts` (новий, з тестом) |
| `packages/simplycms/src/admin/components/StockStatusSelect.tsx` | переноситься в `admin/features/products/stock/` (вміст без змін) |
| `scripts/live-smoke.mjs`, `scripts/live-smoke/{sql,avatar}.mjs` | виклик кроку адміна; `PNG` експортується з `avatar.mjs` |
| `packages/simplycms-theme-solarstore/src/components/Header.tsx` | ключ з `entityKey` замість `['sections-nav']` (борг №8) |
| `scripts/live-smoke/funnel.mjs` | виклик кроку адміна |
| `docs/tasks/platform-roadmap.md`, `docs/tasks/v2-state-map.md`, `docs/architecture/test-contours.md`, `CLAUDE.md` | DoD-доки |

**Свідомо НЕ чіпаються:** `ImageUpload`/`ImageGrid`/`ImageDropzone` (уже на порті з Е2 — лише монтуються), `StockStatusSelect` (без БД, лише переноситься імпорт), решта `src/admin/**` поза скоупом Е3-1, контракт view-моделей вітрини.

---

# Частина 0 — фундамент (Tasks 0–2, незалежні)

**DoD частини 0:** контрактний тест on-demand зелений (або, якщо бібліотека поводиться інакше, ніж припускає план, — зупинка з фактами для власника, див. Task 0 Step 7); order-statuses працює на `runAdmin` без регресу (харнес Е1б зелений); вітрина на `simplycms/inventory` без регресу (харнес воронки зелений); тір-зона `inventory` має негативний контроль.

## Task 0: Спайк on-demand, що стає контрактним тестом, і `toSubsetPayload`

**Чому першою.** Це єдина частина треку без зовнішнього зразка (спека §6), а
звіт по бібліотеці вже знайшов дві розбіжності її доків з кодом
(`parseLoadSubsetOptions` губить `offset`; `or` задокументований, але кидає).
Усі наступні задачі стоять на чотирьох припущеннях — їх доводимо ДО того, як
на них будувати.

**Files:**
- Create: `packages/simplycms/src/admin-data/subset-payload.ts`
- Create: `packages/simplycms/src/admin-data/__tests__/subset-payload.test.ts`
- Create: `packages/simplycms/src/admin-data/__tests__/on-demand-contract.test.tsx`

**Interfaces:**
- Consumes: `SubsetPayload`, `SubsetInput` (type-only) з `simplycms/admin-server/impl` (`impl/subset.ts`)
- Produces: `toSubsetPayload(opts: LoadSubsetOptions | undefined): SubsetPayload` — у Task 5 кожна on-demand колекція кличе її в `queryFn`

- [ ] **Step 1: Звірити експорти бібліотеки**

```bash
node -e "const m=require('@tanstack/query-db-collection');console.log(['parseLoadSubsetOptions','queryCollectionOptions'].map(k=>k+':'+typeof m[k]).join(' '))"
node -e "const m=require('@tanstack/react-db');console.log(['useLiveInfiniteQuery','useLiveQuery','createLiveQueryCollection','eq','and'].map(k=>k+':'+typeof m[k]).join(' '))"
```

Expected: усі `function`. Якщо `parseLoadSubsetOptions` не експортується з
`query-db-collection` — взяти його з `@tanstack/react-db` (реекспорт `@tanstack/db`);
окремої залежності на `@tanstack/db` НЕ додавати (К3-10′: дві peer-залежності, не три).

- [ ] **Step 2: Написати юніт `toSubsetPayload` (червоний)**

```ts
// packages/simplycms/src/admin-data/__tests__/subset-payload.test.ts
import { describe, expect, it } from 'vitest';
import { and, eq, gt, inArray } from '@tanstack/react-db';
import { toSubsetPayload } from '../subset-payload';

// Вирази будуються тими самими функціями, що й у useLiveQuery. Посилання
// на поле — PropRef; його форма (з аліасом чи без) і є тим, що доводить
// контрактний тест Step 4, тут — лише мапінг форми.
const ref = (field: string) =>
  ({ type: 'ref', path: [field] }) as unknown as Parameters<typeof eq>[0];

describe('toSubsetPayload', () => {
  it('без опцій — порожній payload (eager-сумісність)', () => {
    expect(toSubsetPayload(undefined)).toEqual({});
  });

  it('фільтри eq/in під and, сорт, limit і offset (offset бібліотека губить — ми ні)', () => {
    const payload = toSubsetPayload({
      where: and(eq(ref('sectionId'), 's1'), inArray(ref('stockStatus'), ['in_stock', 'on_order'])),
      orderBy: [
        {
          expression: ref('createdAt'),
          compareOptions: { direction: 'desc', nulls: 'last' },
        },
      ] as never,
      limit: 51,
      offset: 50,
    });
    expect(payload).toEqual({
      subset: {
        filters: [
          { field: ['sectionId'], operator: 'eq', value: 's1' },
          { field: ['stockStatus'], operator: 'in', value: ['in_stock', 'on_order'] },
        ],
        sorts: [{ field: ['createdAt'], direction: 'desc' }],
        limit: 51,
        offset: 50,
      },
    });
  });

  it('offset 0 не передається (перша сторінка = без offset)', () => {
    expect(toSubsetPayload({ limit: 10, offset: 0 })).toEqual({
      subset: { filters: [], sorts: [], limit: 10 },
    });
  });

  it('isNull проходить з явним value: null (рівень товару = modification_id IS NULL)', () => {
    expect(
      toSubsetPayload({ where: { type: 'func', name: 'isNull', args: [ref('modificationId')] } as never })
        .subset?.filters,
    ).toEqual([{ field: ['modificationId'], operator: 'isNull', value: null }]);
  });

  it('оператор поза контрактом сервера (not_eq) — throw на клієнті, не 400 з сервера', () => {
    expect(() =>
      toSubsetPayload({
        where: { type: 'func', name: 'not', args: [eq(ref('sectionId'), 's1')] } as never,
      }),
    ).toThrow(/поза контрактом/);
  });

  it('gt проходить як є', () => {
    expect(toSubsetPayload({ where: gt(ref('sortOrder'), 3) }).subset?.filters).toEqual([
      { field: ['sortOrder'], operator: 'gt', value: 3 },
    ]);
  });
});
```

Run: `pnpm test -- packages/simplycms/src/admin-data/__tests__/subset-payload.test.ts`
Expected: FAIL — `Cannot find module '../subset-payload'`.

- [ ] **Step 3: Реалізувати `toSubsetPayload`**

```ts
// packages/simplycms/src/admin-data/subset-payload.ts
import {
  parseLoadSubsetOptions,
  type LoadSubsetOptions,
} from '@tanstack/query-db-collection';
// 🔴 type-only: імпорт стирається, серверне дерево в бандл не їде (К3-9′ п.3;
// правило no-server-only-in-client пропускає саме `import type`).
import type {
  SubsetInput,
  SubsetPayload,
} from 'simplycms/admin-server/impl';

// 🔴 isNull — у контракті з Е3: ціни й залишки РІВНЯ ТОВАРУ — це рядки з
// modification_id IS NULL; без оператора їх довелося б довибирати фільтром
// у JS поверх ширшого зрізу. Серверний бік — Task 1 Step 6а.
const SERVER_OPERATORS = new Set(['eq', 'gt', 'gte', 'lt', 'lte', 'in', 'isNull']);
type ServerFilter = NonNullable<SubsetInput['filters']>[number];

/**
 * Предикат live-query → вхід list-serverFn. ЄДИНЕ місце цього переходу:
 * кожна on-demand колекція кличе саме його, тож контракт «що клієнт уміє
 * попросити» і «що сервер уміє виконати» (`impl/subset.ts`) звіряється тут.
 *
 * 🔴 Дві розбіжності бібліотеки з її ж доками (звірено з src 0.8.6):
 * `parseLoadSubsetOptions` повертає лише `{ filters, sorts, limit }` —
 * `offset` береться з opts напряму, інакше «Показати ще» вічно вантажить
 * першу сторінку; `or`/`like`/`ilike` бібліотека не парсить (throw) —
 * їх тут і немає. `not_*`/`isNull` вона парсить, але сервер їх не має —
 * відмова тут, до мережі, з назвою оператора.
 */
export function toSubsetPayload(
  opts: LoadSubsetOptions | undefined,
): SubsetPayload {
  if (!opts) return {};
  const { filters, sorts, limit } = parseLoadSubsetOptions(opts);
  return {
    subset: {
      filters: filters.map((f): ServerFilter => {
        if (!SERVER_OPERATORS.has(f.operator))
          throw new Error(
            `[admin-data] оператор "${f.operator}" поза контрактом серверного subset (eq/gt/gte/lt/lte/in/isNull)`,
          );
        return {
          field: f.field.map(String),
          operator: f.operator as ServerFilter['operator'],
          // isNull бібліотека віддає без value — на межі це явний null.
          value: f.operator === 'isNull' ? null : f.value,
        };
      }),
      // `nulls` свідомо не передається: сервер сортує дефолтом Postgres
      // (NULLS LAST для asc). Сортувальні колонки каталогу — NOT NULL.
      sorts: sorts.map((s) => ({
        field: s.field.map(String),
        direction: s.direction,
      })),
      ...(limit !== undefined && { limit }),
      ...(opts.offset !== undefined && opts.offset > 0 && { offset: opts.offset }),
    },
  };
}
```

🔴 Якщо `impl/index.ts` ще не реекспортує `SubsetInput`/`SubsetPayload` —
додати `export type { SubsetInput, SubsetPayload } from './subset';` (лише
типи, живих експортів не додавати).

Run: `pnpm test -- packages/simplycms/src/admin-data/__tests__/subset-payload.test.ts`
Expected: PASS. Якщо кейс PropRef-форми впав (бібліотека повертає поле з
аліасом, напр. `['p','sectionId']`) — НЕ підганяти: це відповідь Step 4.

- [ ] **Step 4: Написати контрактний тест on-demand (має бути ЗЕЛЕНИМ одразу — перевірка припущень плану)**

```tsx
// packages/simplycms/src/admin-data/__tests__/on-demand-contract.test.tsx
/**
 * Контракт on-demand, на якому стоїть Е3 (спайк, що лишається тестом).
 * Доводить без БД: (1) предикат useLiveQuery доходить до queryFn як
 * subset-payload з полями БЕЗ аліасу; (2) друга сторінка
 * useLiveInfiniteQuery несе offset; (3) findOne по id штовхає eq(id);
 * (4) leftJoin on-demand × eager резолвиться. Join on-demand × on-demand
 * свідомо НЕ вживається (схема властивостей — двома запитами, Task 10).
 * Червоне тут = бібліотека поводиться не так, як припускає план.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BTreeIndex,
  createCollection,
  eq,
  useLiveInfiniteQuery,
  useLiveQuery,
} from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { ReactNode } from 'react';
import { toSubsetPayload } from '../subset-payload';

type Row = { id: string; sectionId: string; createdAt: number; name: string };
type Sec = { id: string; name: string };

const rows: Row[] = Array.from({ length: 5 }, (_, i) => ({
  id: `p${i}`,
  sectionId: i % 2 ? 's1' : 's2',
  createdAt: 100 - i,
  name: `P${i}`,
}));

function setup({ indexed = true }: { indexed?: boolean } = {}) {
  const queryClient = new QueryClient();
  const calls: unknown[] = [];
  const products = createCollection(
    queryCollectionOptions<Row>({
      id: 'contract-products',
      queryClient,
      queryKey: ['contract-products', 'list'],
      syncMode: 'on-demand',
      // Е3-16: без індексу сортування useLiveInfiniteQuery не довантажує сторінки.
      ...(indexed && { autoIndex: 'eager' as const, defaultIndexType: BTreeIndex }),
      getKey: (r) => r.id,
      queryFn: async (ctx) => {
        const payload = toSubsetPayload(
          ctx.meta?.loadSubsetOptions as Parameters<typeof toSubsetPayload>[0],
        );
        calls.push(payload);
        // Мінімальний «сервер»: eq по полю + limit/offset.
        let out = rows;
        for (const f of payload.subset?.filters ?? [])
          out = out.filter((r) => r[f.field.join('.') as keyof Row] === f.value);
        const off = payload.subset?.offset ?? 0;
        return out.slice(off, payload.subset?.limit ? off + payload.subset.limit : undefined);
      },
    }),
  );
  const sections = createCollection(
    queryCollectionOptions<Sec>({
      id: 'contract-sections',
      queryClient,
      queryKey: ['contract-sections', 'list'],
      getKey: (r) => r.id,
      queryFn: async () => [
        { id: 's1', name: 'Секція 1' },
        { id: 's2', name: 'Секція 2' },
      ],
    }),
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { products, sections, calls, wrapper };
}

describe('on-demand контракт Е3', () => {
  it('(1) where eq доходить як filters з полем без аліасу', async () => {
    const { products, calls, wrapper } = setup();
    const { result } = renderHook(
      () =>
        useLiveQuery((q) =>
          q.from({ p: products }).where(({ p }) => eq(p.sectionId, 's1')),
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(calls).toContainEqual(
      expect.objectContaining({
        subset: expect.objectContaining({
          filters: [{ field: ['sectionId'], operator: 'eq', value: 's1' }],
        }),
      }),
    );
  });

  it('(2) друга сторінка useLiveInfiniteQuery несе offset (з індексом сортування — Е3-16)', async () => {
    const { products, calls, wrapper } = setup({ indexed: true });
    const { result } = renderHook(
      () =>
        useLiveInfiniteQuery(
          (q) => q.from({ p: products }).orderBy(({ p }) => p.createdAt, 'desc'),
          { pageSize: 2 },
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data).toHaveLength(4));
    const offsets = calls.map(
      (c) => (c as { subset?: { offset?: number } }).subset?.offset,
    );
    // Виміряно: перша сторінка — limit 3 (peek), друга — { limit: 2, offset: 3 }.
    expect(offsets).toContain(3);
  });

  it('(2б) БЕЗ індексу друга сторінка не вантажиться — фіксуємо, чому індекс обовʼязковий', async () => {
    const { products, calls, wrapper } = setup({ indexed: false });
    const { result } = renderHook(
      () =>
        useLiveInfiniteQuery(
          (q) => q.from({ p: products }).orderBy(({ p }) => p.createdAt, 'desc'),
          { pageSize: 2 },
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    await act(async () => {
      result.current.fetchNextPage();
    });
    await new Promise((r) => setTimeout(r, 200));
    // Якщо колись бібліотека почне вантажити й без індексу — тест червоніє і
    // Е3-16 можна переглянути; до того індекс — обовʼязкова частина колекції.
    expect(calls).toHaveLength(1);
  });

  it('(3) findOne по id штовхає eq(id)', async () => {
    const { products, calls, wrapper } = setup();
    const { result } = renderHook(
      () =>
        useLiveQuery((q) =>
          q
            .from({ p: products })
            .where(({ p }) => eq(p.id, 'p3'))
            .findOne(),
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data?.name).toBe('P3'));
    expect(JSON.stringify(calls)).toContain('"field":["id"]');
  });

  it('(4) leftJoin on-demand × eager дає назву секції', async () => {
    const { products, sections, wrapper } = setup();
    const { result } = renderHook(
      () =>
        useLiveQuery((q) =>
          q
            .from({ p: products })
            .leftJoin({ s: sections }, ({ p, s }) => eq(p.sectionId, s.id))
            .where(({ p }) => eq(p.sectionId, 's2'))
            .select(({ p, s }) => ({ id: p.id, section: s?.name })),
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(3));
    expect(result.current.data.every((r) => r.section === 'Секція 2')).toBe(true);
  });
});
```

Run: `pnpm test -- packages/simplycms/src/admin-data/__tests__/on-demand-contract.test.tsx`
Expected: PASS усі 5 (відтворено в ізоляції 2026-09-23 на `@tanstack/db@0.8.6`: (1),(3),(4) зелені; (2) зелений лише з індексом, (2б) фіксує поведінку без нього).

🔴 Кейс (5) «join on-demand × on-demand» НЕ пишеться: Task 10 будує схему
властивостей ДВОМА запитами (призначення розділу → властивості `where id
in`), саме тому, що звіт по бібліотеці підтвердив цей шлях лише висновком із
коду компілятора, а не документом. Двома запитами — детерміновано й без
залежності від лінивого join.

- [ ] **Step 5: Якщо (1) червоне через аліас у полі**

Факт — `field` приходить як `['p','sectionId']`. Виправлення — у ОДНОМУ місці,
`toSubsetPayload`: відкидати перший сегмент, якщо довжина > 1 і сегмент не є
колонкою (у каталозі вкладених полів немає — `subset.ts` джойнить `.`).
Додати юніт-кейс під цю форму. Решта кейсів має лишитись зеленою.

- [ ] **Step 6: Якщо (2) червоне попри індекс**

Не гадати причину — залогувати ПОВНИЙ `ctx.meta?.loadSubsetOptions` кожного
виклику `queryFn` (`limit`, `offset`, `cursor`, `where`) і фактичні id у
`result.current.data` після `fetchNextPage`. Відомий факт (аудит 2026-09-23):
offset бібліотека передає завжди (`subscription.ts`: `offset: offset ?? currentOffset`),
а причиною «3 рядки замість 4» був відсутній індекс сортування (Е3-16) — друга
сторінка тоді взагалі не запитується. Якщо з індексом (2) червоне — це нова
поведінка бібліотеки, і розвилка власника (К3-5-fallback: список на
`useLiveQuery` зі зростаючим `.limit(n)` — перевірено, працює, але перечитує
вже завантажені рядки), не локальне рішення.

- [ ] **Step 7: Точка зупинки**

Якщо після Steps 5–6 будь-який з (1)–(4) червоний — **СТОП**: звіт власнику
з фактичною поведінкою і посиланням на рядок src бібліотеки. Tasks 5–10
будуються на цих припущеннях; далі йти не можна. Tasks 1–4 (серверний шар)
від цього не залежать і можуть іти паралельно.

- [ ] **Step 8: Гейт і коміт**

```bash
pnpm exec prettier --write packages/simplycms/src/admin-data
pnpm lint && pnpm test
git add packages/simplycms/src/admin-data packages/simplycms/src/admin-server/impl/index.ts
git commit -m "test(k3-e3): контракт on-demand і toSubsetPayload — offset поза parseLoadSubsetOptions"
```

## Task 1: `runAdmin`, розкладка `impl/<entity>`, конфлікти БД, `touch` і тай-брейкер

**Files:**
- Create: `packages/simplycms/src/admin-server/impl/run.ts`
- Create: `packages/simplycms/src/admin-server/impl/errors.ts`
- Create: `packages/simplycms/src/admin-server/impl/resource-schemas.ts`
- Create: `packages/simplycms/src/admin-server/impl/__tests__/run.test.ts`
- Modify: `packages/simplycms/src/admin-server/impl/resource.ts`
- Move (`git mv`): `impl/resources/order-statuses.ts` → `impl/order-statuses/resource.ts`; `impl/operations/order-status-{default,reorder,remove}.ts` → `impl/order-statuses/{set-default,reorder,remove}.ts`; `impl/operations/media.ts` → `impl/media/operations.ts`
- Modify: `packages/simplycms/src/admin-server/impl/index.ts` (шляхи)
- Modify: `packages/simplycms/src/admin-server/impl/__tests__/resource.test.ts`, `packages/simplycms/test-harness/pg/__tests__/admin-order-statuses.test.ts` (шляхи моків/імпортів, якщо були відносними)

**Interfaces:**
- Produces:
  - `runAdmin<Out>(operation: Operation, fn: (db: ActorDb, grant: RequestGrant) => Promise<Out>): Promise<Out>` — `impl/run.ts`
  - `class AdminConflictError extends Error { name: 'AdminConflictError'; kind: 'unique' | 'reference'; constraint: string | null }` — `impl/errors.ts`
  - `defineAdminResource(config)` — нова опція `touch?: ColumnName<T>`; `list()` дописує `id asc`
  - `buildResourceSchemas(table, writable)` → `{ rowSchema, insertSchema, updateSchema, removeSchema }` — `impl/resource-schemas.ts`

- [ ] **Step 1: Перенести файли без зміни вмісту**

```bash
cd packages/simplycms/src/admin-server/impl
mkdir -p order-statuses media
git mv resources/order-statuses.ts order-statuses/resource.ts
git mv operations/order-status-default.ts order-statuses/set-default.ts
git mv operations/order-status-reorder.ts order-statuses/reorder.ts
git mv operations/order-status-remove.ts order-statuses/remove.ts
git mv operations/media.ts media/operations.ts
rmdir resources operations 2>/dev/null || true
```

Виправити відносні імпорти в перенесених файлах (`'../resource'` лишається
`'../resource'` — глибина та сама) і шляхи в `impl/index.ts`:

```ts
export { orderStatusesOps } from './order-statuses/resource';
export { setDefaultInput, setDefaultOrderStatusOp } from './order-statuses/set-default';
export { reorderInput, reorderOrderStatusOp } from './order-statuses/reorder';
export { removeStatusInput, removeManyInput, removeManyOrderStatusesOp } from './order-statuses/remove';
export { deleteMediaInput, deleteMediaOp, parseUploadForm, uploadMediaOp } from './media/operations';
export type { ParsedUpload } from './media/operations';
```

Run: `rg -n "impl/(resources|operations)/" packages tests scripts eslint*.mjs` → має бути порожньо
(тести в `impl/__tests__/media.test.ts` імпортують `../operations/media` — виправити на `../media/operations`).

Run: `pnpm lint && pnpm test && pnpm test:schema -- packages/simplycms/test-harness/pg/__tests__/admin-order-statuses.test.ts`
Expected: PASS (чистий перенос). Коміт окремо — щоб диф логіки нижче читався без шуму:

```bash
git add -A packages/simplycms/src/admin-server
git commit -m "refactor(k3-e3): розкладка admin-server/impl по сутностях (амендмент К3-9′)"
```

- [ ] **Step 2: Тест `runAdmin` і конфліктів (червоний)**

```ts
// packages/simplycms/src/admin-server/impl/__tests__/run.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const grant = vi.hoisted(() => ({
  value: { subject: { userId: 'u1', roles: ['admin'] }, scope: 'any' } as {
    subject: { userId: string | null; roles: string[] };
    scope: 'any' | 'own';
  },
}));
const status = vi.hoisted(() => ({ set: vi.fn() }));

vi.mock('simplycms/auth', () => ({
  requireGrant: vi.fn(async () => grant.value),
  dbRoleForSubject: () => 'app_admin',
}));
vi.mock('simplycms/db', () => ({
  withActor: vi.fn(async (_a: unknown, fn: (db: unknown) => unknown) => fn({})),
}));
vi.mock('@tanstack/react-start/server', () => ({
  setResponseStatus: status.set,
}));

import { runAdmin } from '../run';
import { AdminConflictError } from '../errors';

const pgError = (code: string, constraint: string) =>
  Object.assign(new Error('Failed query: insert …'), {
    cause: Object.assign(new Error('duplicate key'), { code, constraint }),
  });

describe('runAdmin', () => {
  beforeEach(() => {
    grant.value = { subject: { userId: 'u1', roles: ['admin'] }, scope: 'any' };
    status.set.mockClear();
  });

  it('scope own — fail-loud (адмін-поверхня обслуговує лише any)', async () => {
    grant.value = { ...grant.value, scope: 'own' };
    await expect(runAdmin('catalog.write', async () => 1)).rejects.toThrow(/scope 'own'/);
  });

  it('23505 → AdminConflictError unique + 409 ДО throw', async () => {
    const err = await runAdmin('catalog.write', async () => {
      throw pgError('23505', 'products_slug_key');
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdminConflictError);
    expect(err).toMatchObject({ name: 'AdminConflictError', kind: 'unique', constraint: 'products_slug_key' });
    expect(status.set).toHaveBeenCalledWith(409);
  });

  it('23503 → kind reference', async () => {
    const err = await runAdmin('catalog.write', async () => {
      throw pgError('23503', 'order_items_product_id_fkey');
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ kind: 'reference', constraint: 'order_items_product_id_fkey' });
  });

  it('інша помилка БД проходить без змін і без статусу', async () => {
    const original = pgError('22P02', 'x');
    await expect(
      runAdmin('catalog.write', async () => {
        throw original;
      }),
    ).rejects.toBe(original);
    expect(status.set).not.toHaveBeenCalled();
  });

  it('userId субʼєкта передається в withActor', async () => {
    const { withActor } = await import('simplycms/db');
    await runAdmin('catalog.write', async () => null);
    expect(withActor).toHaveBeenLastCalledWith(
      { role: 'app_admin', userId: 'u1' },
      expect.any(Function),
    );
  });
});
```

Run: `pnpm test -- packages/simplycms/src/admin-server/impl/__tests__/run.test.ts`
Expected: FAIL — модулів `../run`, `../errors` немає.

- [ ] **Step 3: Реалізувати `errors.ts` і `run.ts`**

```ts
// packages/simplycms/src/admin-server/impl/errors.ts
import { setResponseStatus } from '@tanstack/react-start/server';

/**
 * Конфлікт із даними, який власник може виправити сам (Е3-7): дубль
 * унікального значення або посилання, що тримає рядок. Окремий клас — щоб
 * клієнт показав зрозумілий тост за `error.name` (seroval не зберігає
 * instanceof, як і в AuthzError — К3-13).
 */
export class AdminConflictError extends Error {
  override readonly name = 'AdminConflictError';
  constructor(
    readonly kind: 'unique' | 'reference',
    readonly constraint: string | null,
  ) {
    super(`[admin-server] конфлікт ${kind}: ${constraint ?? 'невідоме обмеження'}`);
  }
}

const KIND_BY_CODE: Record<string, AdminConflictError['kind']> = {
  '23505': 'unique',
  '23503': 'reference',
};

/**
 * Drizzle перезагортає помилку драйвера (борг К1а-5): код Postgres — у
 * `.cause`. Повертає конфлікт або null (тоді помилка летить як є, 500).
 * 🔴 Статус ставиться ДО throw — сервер бере його з getResponse().status
 * у момент catch, не з полів Error (К3-13).
 */
export function toAdminConflict(error: unknown): AdminConflictError | null {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const { code, constraint } = (cause ?? {}) as { code?: string; constraint?: string };
  const kind = code ? KIND_BY_CODE[code] : undefined;
  if (!kind) return null;
  setResponseStatus(409);
  return new AdminConflictError(kind, constraint ?? null);
}
```

```ts
// packages/simplycms/src/admin-server/impl/run.ts
import {
  requireGrant,
  dbRoleForSubject,
  type Operation,
  type RequestGrant,
} from 'simplycms/auth';
import { withActor, type ActorDb } from 'simplycms/db';
import { toAdminConflict } from './errors';

/**
 * ЄДИНА склейка К3-13 для адмін-операцій — фабричних і іменованих
 * (дедуплікація: до Е3 кожна іменована операція повторювала
 * requireGrant → withActor власноруч і scope не читала взагалі).
 *
 * 🔴 scope: адмін-поверхня обслуговує лише 'any'. 'own'-звуження
 * (замовлення/профілі покупця, Е5+) пишеться операцією, яка приймає
 * grant і ЯВНО звужує запит, — через окремий хелпер, не цей.
 * 🔴 requireGrant — ДО withActor: він сам ходить у user_roles короткою
 * транзакцією, вкладеної бути не може.
 */
export async function runAdmin<Out>(
  operation: Operation,
  fn: (db: ActorDb, grant: RequestGrant) => Promise<Out>,
): Promise<Out> {
  const grant = await requireGrant(operation);
  if (grant.scope !== 'any')
    throw new Error(
      `[admin-server] операція ${operation} дала scope '${grant.scope}' — адмін-поверхня обслуговує лише 'any'`,
    );
  try {
    return await withActor(
      {
        role: dbRoleForSubject(grant.subject),
        userId: grant.subject.userId ?? undefined,
      },
      (db) => fn(db, grant),
    );
  } catch (error) {
    throw toAdminConflict(error) ?? error;
  }
}
```

Run: `pnpm test -- packages/simplycms/src/admin-server/impl/__tests__/run.test.ts`
Expected: PASS.

- [ ] **Step 4: Розвантажити `resource.ts` — схеми в `resource-schemas.ts`**

Перенести в `resource-schemas.ts` ДОСЛІВНО (разом із коментарями-хвостами
рев'ю про `SafePick`/`.pick()` — вони пояснюють причину касту й мусять
лишитись поруч із кастом) блок від `const rowSchema = createSelectSchema(…)`
до `const removeSchema = …` як функцію:

```ts
// packages/simplycms/src/admin-server/impl/resource-schemas.ts (форма; тіло — перенесене з resource.ts)
import type { Table } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';

export type ColumnName<T extends Table> = Extract<keyof T['_']['columns'], string>;

export function buildResourceSchemas<T extends Table, W extends ColumnName<T>>(
  table: T,
  writable: readonly W[],
) {
  const pickWritable = Object.fromEntries(writable.map((c) => [c, true])) as { [K in W]: true };
  // … перенесений блок rowSchema / insertSchemaFull / updateSchemaFull /
  //   InsertShape / UpdateShape / SafePick / insertRowSchema / patchSchema /
  //   insertSchema / updateSchema / removeSchema — БЕЗ ЗМІН …
  return { rowSchema, insertSchema, updateSchema, removeSchema };
}
```

`ColumnName` тепер експортується звідси, `resource.ts` імпортує його.
`expectTypeOf`-тести `resource.test.ts` (регресія `.pick()`) мусять лишитись
зеленими без правок — це і є доказ, що перенос не зламав статичні типи.

- [ ] **Step 5: `resource.ts` — `runAdmin`, `touch`, тай-брейкер (тести спершу)**

Додати в `resource.test.ts` (мок `withActor` уже є; `db`-фейк фіксує виклики):

```ts
// ID — будь-який uuid-літерал; products — `import { products } from 'simplycms/schema'`
// (тест і так імпортує таблицю order_statuses звідти ж).
const ID = '0e300000-0000-4000-8000-0000000000aa';
it('touch: update дописує updatedAt = Date', async () => {
  const set = vi.fn(() => ({ where: () => ({ returning: async () => [{ id: ID }] }) }));
  const { withActor } = await import('simplycms/db');
  vi.mocked(withActor).mockImplementationOnce(async (_a, fn) =>
    fn({ update: () => ({ set }) } as never, {} as never),
  );
  const ops = defineAdminResource({
    entity: 'products', table: products, operation: 'catalog.write', mode: 'on-demand',
    filterable: [], sortable: [], touch: 'updatedAt',
    writable: [/* усі writable products — як у Task 3 */],
    readonly: ['id', 'createdAt', 'updatedAt'],
  });
  await ops.update({ data: [{ id: ID, patch: { name: 'X' } }] });
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ name: 'X', updatedAt: expect.any(Date) }));
});
```

(Список `writable` для `products` — з Task 3 Step 2; exhaustiveness не
дасть скомпілювати тест з неповним списком.)

🔴 Доказ тай-брейкера (Е3-8) — ЮНІТОМ, не харнесом (аудит 2026-09-23):
Postgres на малій незмінній таблиці часто повертає той самий порядок і без
`id`, тож харнес-тест пагінації (Task 3) лишився б зеленим і без фіксу.

```ts
it('list: id asc — ОСТАННІЙ ключ сортування, і після defaultOrder, і після sorts', async () => {
  const orderBy = vi.fn(function (this: unknown) { return this; });
  const q = { where: () => q, orderBy, limit: () => q, offset: () => q, then: (r: (v: unknown[]) => unknown) => r([]) };
  const { withActor } = await import('simplycms/db');
  vi.mocked(withActor).mockImplementation(async (_a, fn) =>
    fn({ select: () => ({ from: () => ({ $dynamic: () => q }) }) } as never, {} as never),
  );
  await orderStatusesOps.list({ data: {} });
  await orderStatusesOps.list({ data: { subset: { sorts: [{ field: ['name'], direction: 'desc' }] } } });
  for (const call of orderBy.mock.calls) {
    const last = call.at(-1) as { queryChunks?: unknown[] };
    // asc(col) — SQL із чанком колонки id; звіряємо через рендер у рядок.
    expect(JSON.stringify(last)).toContain('"name":"id"');
  }
  expect(orderBy).toHaveBeenCalledTimes(2); // один виклик на запит — масив, не ланцюг
});
```

Негативний контроль: прибрати `order.push(asc(idCol))` → тест червоний.
(Форма перевірки `JSON.stringify(...).toContain('"name":"id"')` — орієнтир:
якщо серіалізація SQL-чанка Drizzle інша, звірити через
`db.select().from(t).orderBy(...).toSQL()` на справжній таблиці без БД —
`toSQL()` не ходить у мережу.)

Зміни в `resource.ts`:

```ts
// у config:
    /** Колонка, яку фабрика ставить у new Date() на кожен update (Е3-9:
     *  тригера updated_at у каноні немає). */
    touch?: ColumnName<T>;

// run(...) видаляється цілком; list/insert/update/remove кличуть:
//   runAdmin(config.operation, async (db) => { … })

// list(): після застосування orderBy/defaultOrder, ДО limit/offset:
        // 🔴 Е3-8: стабільний порядок для offset-пагінації. created_at не
        // унікальний; без тай-брейкера сторінки дублюють/гублять рядки.
        const idCol = columns['id'];
        if (idCol !== undefined) q = q.orderBy(...(s.orderBy ?? []), ...defaultOrderSql, asc(idCol));
```

Щоб `orderBy` викликався ОДИН раз (повторний `.orderBy()` у Drizzle
замінює, а не дописує), зібрати масив:

```ts
        const order: SQL[] = [];
        if (s.orderBy) order.push(...s.orderBy);
        else if (config.defaultOrder) {
          const col = columns[config.defaultOrder.column];
          if (col === undefined)
            throw new Error(`[admin-server] ${config.entity}: defaultOrder.column "${config.defaultOrder.column}" немає в таблиці`);
          order.push(config.defaultOrder.direction === 'desc' ? desc(col) : asc(col));
        }
        const idCol = columns['id'];
        if (idCol !== undefined) order.push(asc(idCol));
        if (order.length > 0) q = q.orderBy(...order);
```

`update()`:

```ts
            .set((config.touch ? { ...patch, [config.touch]: new Date() } : patch) as never)
```

Run: `pnpm test -- packages/simplycms/src/admin-server && pnpm test:schema -- packages/simplycms/test-harness/pg/__tests__/admin-order-statuses.test.ts`
Expected: PASS; `resource.ts` ≤ 150 рядків без коментарів-хвостів
(`wc -l` — орієнтир; хвости переїхали в `resource-schemas.ts`).

- [ ] **Step 6: Іменовані операції order-statuses — на `runAdmin`**

У трьох файлах `order-statuses/{set-default,reorder,remove}.ts` замінити

```ts
  const { subject } = await requireGrant('catalog.write');
  return withActor(
    { role: dbRoleForSubject(subject), userId: subject.userId ?? undefined },
    async (db) => {
```

на

```ts
  return runAdmin('catalog.write', async (db) => {
```

(закриваючі дужки — відповідно). Імпорти `requireGrant`/`dbRoleForSubject`/`withActor`
прибрати, додати `import { runAdmin } from '../run';`. `media/operations.ts` —
так само, операція `'media.write'`, якщо файл має ту саму склейку.

Run: `rg -n "requireGrant|withActor" packages/simplycms/src/admin-server/impl --glob '!**/__tests__/**'`
Expected: рівно `run.ts` (і `media/operations.ts`, якщо його склейка інша —
тоді коментар у файлі чому; перевірити `rg -n -A3 requireGrant` до заміни).

- [ ] **Step 6а: `isNull` у серверному subset (дзеркало Task 0)**

Тест у `impl/__tests__/subset.test.ts` (спершу, червоний):

```ts
it('isNull: колонка з allowlist → IS NULL без параметра', () => {
  const s = toDrizzleSubset(table, { filterable: ['parentId'], sortable: [] }, {
    filters: [{ field: ['parentId'], operator: 'isNull', value: null }],
  });
  expect(s.where).toBeDefined();
});
it('isNull з непорожнім value — 400 на межі (схема)', () => {
  expect(
    subsetShapeSchema.safeParse({ filters: [{ field: ['x'], operator: 'isNull', value: 1 }] }).success,
  ).toBe(false);
});
```

(`table` — тестова таблиця, яку файл уже вживає; якщо в неї немає nullable
колонки — узяти будь-яку з allowlist, SQL-форму доводить харнес Task 3.)

Зміни в `impl/subset.ts`: `operator: z.enum([... , 'isNull'])`; у
`superRefine` — гілка `isNull` вимагає `f.value === null`; у мапі
`OPERATORS` — `isNull: ((column: never) => isNull(column)) as SubsetOperatorFn`
(імпорт `isNull` з `drizzle-orm`); коментар модуля «Оператори — рівно ті…»
доповнити `isNull` з причиною (ціни/залишки рівня товару).

- [ ] **Step 7: Гейт і коміт**

```bash
pnpm exec prettier --write packages/simplycms/src/admin-server
pnpm lint && pnpm test && pnpm test:schema
git add -A packages/simplycms/src/admin-server packages/simplycms/test-harness
git commit -m "feat(k3-e3): runAdmin — одна склейка grant/scope/withActor, конфлікти 23505/23503 у 409, touch і тай-брейкер id"
```

## Task 2: Спільне server-only дерево `simplycms/inventory` (Е3-5)

**Files:**
- Create: `packages/simplycms/src/inventory/index.ts`
- Create: `packages/simplycms/src/inventory/stock-status.ts` (перенос `storefront/loaders/stock-status.ts` через `git mv`)
- Create: `packages/simplycms/src/inventory/quantity-status.ts`
- Create: `packages/simplycms/src/inventory/__tests__/quantity-status.test.ts`
- Modify: `packages/simplycms/src/storefront/loaders/{stock-write,stock-release,stock-reservation}.ts` (імпорт)
- Modify: `packages/simplycms/src/contracts/server-only.ts`, `packages/simplycms/package.json`, `eslint.tier-zones.mjs`, `tests/tier-boundary.test.ts`, `tests/dist-server-boundary.test.ts` (сентинел `inventory`)

**Interfaces:**
- Produces (з `simplycms/inventory`):
  - `interface StockTarget { productId: string | null; modificationId: string | null }`
  - `loadTargetStatus(db: ActorDb, target: StockTarget): Promise<StockStatus | null>` — без змін
  - `setTargetStatus(db: ActorDb, target: StockTarget, next: 'in_stock' | 'out_of_stock'): Promise<void>` — без змін
  - `syncStatusWithQuantity(db: ActorDb, target: StockTarget, total: number): Promise<void>` — нове: `total > 0 ? setTargetStatus(…,'in_stock') : setTargetStatus(…,'out_of_stock')`

- [ ] **Step 1: Перенести модуль і тип**

```bash
mkdir -p packages/simplycms/src/inventory
git mv packages/simplycms/src/storefront/loaders/stock-status.ts packages/simplycms/src/inventory/stock-status.ts
```

У `inventory/stock-status.ts`: `import type { ActorDb } from 'simplycms/db';`
(замість `./db` вітрини — перевірити, що `ActorDb` експортується з
`simplycms/db`; якщо `storefront/loaders/db.ts` лише реекспортує його — брати
з джерела). `StockTarget` перенести сюди з `stock-write.ts` (там —
`import type { StockTarget } from 'simplycms/inventory'` і реекспорт типу,
якщо його імпортують інші модулі вітрини: `rg -n "StockTarget" packages/simplycms/src`).

- [ ] **Step 2: Тест `syncStatusWithQuantity` (червоний)**

```ts
// packages/simplycms/src/inventory/__tests__/quantity-status.test.ts
import { describe, expect, it, vi } from 'vitest';

const setTargetStatus = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../stock-status', () => ({ setTargetStatus }));

import { syncStatusWithQuantity } from '../quantity-status';

const target = { productId: 'p1', modificationId: null };

describe('syncStatusWithQuantity (Е3-3)', () => {
  it('сума > 0 → запит переходу в in_stock (гвард сам пропустить лише з out_of_stock)', async () => {
    await syncStatusWithQuantity({} as never, target, 3);
    expect(setTargetStatus).toHaveBeenLastCalledWith({}, target, 'in_stock');
  });
  it('сума 0 → запит переходу в out_of_stock', async () => {
    await syncStatusWithQuantity({} as never, target, 0);
    expect(setTargetStatus).toHaveBeenLastCalledWith({}, target, 'out_of_stock');
  });
  it('відʼємна сума (облік on_order у мінус) → теж out_of_stock-запит; on_order гвард не чіпає', async () => {
    await syncStatusWithQuantity({} as never, target, -2);
    expect(setTargetStatus).toHaveBeenLastCalledWith({}, target, 'out_of_stock');
  });
});
```

Run: `pnpm test -- packages/simplycms/src/inventory` → FAIL (модуля немає).

- [ ] **Step 3: Реалізувати**

```ts
// packages/simplycms/src/inventory/quantity-status.ts
import type { ActorDb } from 'simplycms/db';
import { setTargetStatus, type StockTarget } from './stock-status';

/**
 * Статус цілі за фактичною сумою залишку — для ручного обліку адмінки
 * (Е3-3). Сам гвард живе в setTargetStatus: `on_order` не чіпається ніколи,
 * в `in_stock` піднімається лише з `out_of_stock`. Тобто ручне
 * `on_order` власника переживає будь-яке редагування кількості.
 */
export async function syncStatusWithQuantity(
  db: ActorDb,
  target: StockTarget,
  total: number,
): Promise<void> {
  // Дзеркало check-обмеження stock_product_or_modification: ціль без
  // жодного ключа — помилка викликача, а не «нічого не робити». Рядок
  // повідомлення — заодно сентинел dist-server-boundary (Step 4).
  if (!target.productId && !target.modificationId)
    throw new Error('[simplycms/inventory] ціль залишку без товару й модифікації');
  await setTargetStatus(db, target, total > 0 ? 'in_stock' : 'out_of_stock');
}
```

(+ кейс у `quantity-status.test.ts`: ціль `{ productId: null, modificationId: null }` → throw, `setTargetStatus` не викликано.)

```ts
// packages/simplycms/src/inventory/index.ts
/**
 * 🔴 Server-only (contracts/server-only): спільний облік залишків для
 * вітрини (резерв/повернення замовлення) і адмінки (ручний облік). Одна
 * копія гварду stock_status — рішення Е3-5.
 */
export { loadTargetStatus, setTargetStatus } from './stock-status';
export type { StockTarget } from './stock-status';
export { syncStatusWithQuantity } from './quantity-status';
// Хвиля B, M1 (перенесено з storefront/loaders/stock-write.ts): ОДИН предикат
// «обслуговуюча точка» (is_system OR is_active) і ОДИН порядок локів
// (pickup_points.sort_order, stock.id) для вітрини й адмінки.
export { lockTargetStock, servingQuantity } from './locked-stock';
export type { LockedStockRow } from './locked-stock';
```

Run: `pnpm test -- packages/simplycms/src/inventory` → PASS.

- [ ] **Step 4: Межа — декларація, exports, тір-зона**

`contracts/server-only.ts` — у `SERVER_ONLY` після `'storage'`:

```ts
  // Облік залишків (Е3-5): гвард stock_status пише в products /
  // product_modifications через ActorDb — сервер і тільки сервер.
  'inventory',
```

`packages/simplycms/package.json` — за зразком `./storage` у ОБОХ мапах
(`exports` і `publishConfig.exports`, скопіювати форму запису `./storage`
дослівно, замінивши імʼя): `"./inventory": "./src/inventory/index.ts"`.

`eslint.tier-zones.mjs`:

```js
  // Облік залишків (Е3-5) — T2. Upward `db`: гвард пише через ActorDb
  // (withActor — єдиний канал до Postgres), як у `storage`.
  ['src/inventory', 2, 'inventory', ['db']],
```

і `'inventory'` в upward-винятки `storefront` (`['db','auth','storage','inventory']`)
та `admin-server` (`['db','auth','storage','inventory']`) з коментарем «облік
залишків — спільний домен, класифікація дерева».

Storefront-імпорти: `from './stock-status'` → `from 'simplycms/inventory'`
(`stock-release.ts`, `stock-reservation.ts`; BARE — інакше бандлер заінлайнить
і межа `dist` стане невидимою, та сама причина, що в `admin-server/impl`).

🔴 **Сентинел dist-межі — обовʼязковий** (знахідка аудиту Codex 2026-09-23):
`tests/dist-server-boundary.test.ts` тримає `SENTINELS: Record<(typeof SERVER_ONLY)[number], string>`
і асертить збіг ключів із `SERVER_ONLY` — новий елемент декларації без
сентинела червонить і typecheck, і тест. Додати:

```ts
  inventory: '[simplycms/inventory] ціль залишку без товару й модифікації',
```

(рядок — повідомлення guard-а `syncStatusWithQuantity`, Step 3: літерал
доживає до `dist` дослівно, на відміну від імен.)

- [ ] **Step 5: Негативний контроль тір-зони**

У `tests/tier-boundary.test.ts` додати кейс за зразком наявних: файл у
`packages/simplycms/src/inventory/` з `import x from 'simplycms/storefront/loaders'`
→ очікувати помилку `no-restricted-imports`; і позитив — `import { withActor } from 'simplycms/db'` → чисто.

Run: `pnpm test -- tests/tier-boundary.test.ts` → PASS (новий кейс червонить
саме на заборону, перевірити, прибравши `['db']` з винятку — має впасти й позитив).

- [ ] **Step 6: Регрес вітрини і межі**

```bash
pnpm lint && pnpm test && pnpm test:schema
pnpm build:packages && ls packages/simplycms/dist/inventory/index.js
pnpm test:packaging
```

Expected: усе зелене; `dist/inventory/index.js` є у СЕРВЕРНІЙ збірці
(tsdown групує за `contracts/server-only` — перевірити
`tests/dist-server-boundary.test.ts` зеленим).

- [ ] **Step 7: Коміт**

```bash
pnpm exec prettier --write packages/simplycms/src/inventory packages/simplycms/src/storefront/loaders eslint.tier-zones.mjs tests/tier-boundary.test.ts
git add -A packages/simplycms/src/inventory packages/simplycms/src/storefront/loaders packages/simplycms/src/contracts/server-only.ts packages/simplycms/package.json eslint.tier-zones.mjs tests/tier-boundary.test.ts
git commit -m "feat(k3-e3): simplycms/inventory — одна копія гварду stock_status для вітрини й адмінки"
```

---

# Частина 1 — серверний шар каталогу (Tasks 3–4)

**DoD частини 1:** `pnpm test:schema` доводить проти живого Postgres: список
товарів із фільтрами й стабільною пагінацією, CRUD товару й модифікації з
клієнтськими id, конфлікти 23505/23503 як `AdminConflictError`, інваріант
дефолтної модифікації, атомарний набір цін, залишки з гвардом статусу.

## Task 3: Ресурси каталогу і топ-рівневі serverFn

**Files:**
- Create: `packages/simplycms/src/admin-server/impl/products/resource.ts`
- Create: `packages/simplycms/src/admin-server/impl/product-modifications/resource.ts`
- Create: `packages/simplycms/src/admin-server/impl/product-prices/resource.ts`
- Create: `packages/simplycms/src/admin-server/impl/stock/resource.ts`
- Create: `packages/simplycms/src/admin-server/impl/property-values/resources.ts`
- Create: `packages/simplycms/src/admin-server/impl/catalog-read/resources.ts`
- Modify: `packages/simplycms/src/admin-server/impl/index.ts`, `packages/simplycms/src/admin-server/index.ts`
- Create: `packages/simplycms/test-harness/pg/__tests__/admin-catalog.test.ts`

**Interfaces:**
- Consumes: `defineAdminResource` з опціями `touch` і тай-брейкером (Task 1), `runAdmin`, `AdminConflictError`
- Produces (у `impl/index.ts`, для Task 4, харнеса й serverFn): `productsOps`, `productModificationsOps`, `productPricesOps`, `stockOps`, `productPropertyValuesOps`, `modificationPropertyValuesOps`, `sectionsReadOps`, `priceTypesReadOps`, `sectionPropertyAssignmentsReadOps`, `sectionPropertiesReadOps`, `propertyOptionsReadOps`
- Produces (у `admin-server/index.ts`, для Task 5): serverFn
  `listProducts`, `insertProducts`, `updateProducts`, `removeProducts`,
  `listProductModifications`, `insertProductModifications`, `updateProductModifications`, `removeProductModifications`,
  `listProductPrices`, `listStock`,
  `listProductPropertyValues`, `insertProductPropertyValues`, `updateProductPropertyValues`, `removeProductPropertyValues`,
  `listModificationPropertyValues`, `insertModificationPropertyValues`, `updateModificationPropertyValues`, `removeModificationPropertyValues`,
  `listSections`, `listPriceTypes`, `listSectionPropertyAssignments`, `listSectionProperties`, `listPropertyOptions`
  — кожен приймає `{ data }` за схемою відповідного `ops.*Schema`

- [ ] **Step 1: Харнес-тест ресурсів (червоний)**

Шапка файла — ДОСЛІВНО з `admin-order-statuses.test.ts` (рядки 1–75:
імпорти `apply.mjs`/`up.mjs`, `canonFiles()`, `beforeAll` з `createTempDatabase`
→ канон → `DATABASE_URL = withUser(dbUrl,'app_runtime')`, `afterAll` з
`closeDbPool()` ПЕРШИМ), `randomDbName('simplycms_admin_catalog')`, плюс мок
статусу відповіді — поза HTTP-запитом Start-контексту немає, і
`setResponseStatus` з `toAdminConflict` інакше кинув би сам:

```ts
vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));

import {
  productsOps,
  productModificationsOps,
  sectionsReadOps,
  AdminConflictError,
} from 'simplycms/admin-server/impl';

const SECTION = '0e300000-0000-4000-8000-000000000001';
const at = new Date('2026-09-01T00:00:00Z');

// Фікстура розділу — ПРИВІЛЕЙОВАНИМ підключенням (dbUrl), не операцією:
// CRUD розділів — Е4, а тут потрібен лише рядок, на який посилається товар.
beforeAll(async () => {
  await queryRows(
    dbUrl,
    `insert into public.sections (id, slug, name) values ($1, 'e3-section', 'Розділ Е3')`,
    [SECTION],
  );
});

const product = (i: number) => ({
  id: crypto.randomUUID(),
  slug: `e3-product-${i}`,
  name: `Товар ${i}`,
  sectionId: SECTION,
});

describe('products: ресурс on-demand проти живої БД (Е3, Task 3)', () => {
  it('insert з клієнтським id і list з фільтром sectionId', async () => {
    const rows = await productsOps.insert({ data: [product(1), product(2)] });
    expect(rows.map((r) => r.slug).sort()).toEqual(['e3-product-1', 'e3-product-2']);
    const listed = await productsOps.list({
      data: { subset: { filters: [{ field: ['sectionId'], operator: 'eq', value: SECTION }] } },
    });
    expect(listed.length).toBeGreaterThanOrEqual(2);
    expect(listed.every((r) => r.sectionId === SECTION)).toBe(true);
  });

  // Регресійний смок, НЕ доказ інваріанта (доказ — юніт Task 1 Step 5): без
  // тай-брейкера Postgres на малій таблиці може дати той самий порядок.
  it('Review Focus 3: однакові created_at — три сторінки по 3 дають 7 різних id', async () => {
    const batch = Array.from({ length: 7 }, (_, i) => product(100 + i));
    await productsOps.insert({ data: batch });
    await queryRows(dbUrl, `update public.products set created_at = $1 where slug like 'e3-product-1__'`, [at]);
    const page = (offset: number) =>
      productsOps.list({
        data: {
          subset: {
            filters: [{ field: ['sectionId'], operator: 'eq', value: SECTION }],
            sorts: [{ field: ['createdAt'], direction: 'desc' }],
            limit: 3,
            ...(offset > 0 && { offset }),
          },
        },
      });
    const seen = (await Promise.all([page(0), page(3), page(6), page(9)]))
      .flat()
      .filter((r) => r.slug.startsWith('e3-product-1') && r.slug.length === 14)
      .map((r) => r.id);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(7);
  });

  it('touch: update ставить updated_at свіжішим за created_at', async () => {
    const [p] = await productsOps.insert({ data: [product(3)] });
    await queryRows(dbUrl, `update public.products set updated_at = $1 where id = $2`, [at, p!.id]);
    const [u] = await productsOps.update({ data: [{ id: p!.id, patch: { name: 'Нова назва' } }] });
    expect(u!.updatedAt.getTime()).toBeGreaterThan(at.getTime());
  });

  it('Review Focus 1: дубль slug → AdminConflictError unique з назвою обмеження', async () => {
    const err = await productsOps
      .insert({ data: [{ ...product(4), slug: 'e3-product-1' }] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdminConflictError);
    expect(err).toMatchObject({ kind: 'unique', constraint: 'products_slug_key' });
  });

  it('Review Focus 2: товар у замовленні → AdminConflictError reference, рядок живий', async () => {
    const [p] = await productsOps.insert({ data: [product(5)] });
    const orderId = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.orders (id, order_number, status, subtotal, total, first_name, last_name, email, phone, payment_method)
       values ($1, 'E3-1', 'new', 1, 1, 'Т', 'П', 't@example.test', '+380000000000', 'cash')`,
      [orderId],
    );
    await queryRows(
      dbUrl,
      `insert into public.order_items (id, order_id, product_id, name, price, quantity, total)
       values ($1, $2, $3, 'Товар 5', 1, 1, 1)`,
      [crypto.randomUUID(), orderId, p!.id],
    );
    const err = await productsOps.remove({ data: [{ id: p!.id }] }).catch((e: unknown) => e);
    expect(err).toMatchObject({ name: 'AdminConflictError', kind: 'reference' });
    expect(await queryRows(dbUrl, `select 1 from public.products where id = $1`, [p!.id])).toHaveLength(1);
  });

  it('Review Focus 1 для модифікації: дубль slug у товарі → конфлікт на product_modifications_product_slug_unique', async () => {
    const [p] = await productsOps.insert({ data: [product(7)] });
    const mod = (id: string) => ({ id, productId: p!.id, slug: 'same', name: 'M' });
    await productModificationsOps.insert({ data: [mod(crypto.randomUUID())] });
    const err = await productModificationsOps
      .insert({ data: [mod(crypto.randomUUID())] })
      .catch((e: unknown) => e);
    // 🔴 Імʼя НЕ за конвенцією *_slug_key — задане руками (schema.ts:445).
    expect(err).toMatchObject({ kind: 'unique', constraint: 'product_modifications_product_slug_unique' });
  });

  it('фільтр по недозволеній колонці відбито (allowlist ресурсу)', async () => {
    await expect(
      productsOps.list({
        data: { subset: { filters: [{ field: ['description'], operator: 'eq', value: 'x' }] } },
      }),
    ).rejects.toThrow(/недозволеній колонці/);
  });

  it('модифікація: insert без isDefault у writable — прапорець лишається false', async () => {
    const [p] = await productsOps.insert({ data: [product(6)] });
    const [m] = await productModificationsOps.insert({
      data: [{ id: crypto.randomUUID(), productId: p!.id, slug: 'm1', name: 'M1', isDefault: true } as never],
    });
    expect(m!.isDefault).toBe(false); // readonly-поле strip-нуте схемою
  });

  it('читальний ресурс розділів бачить і неактивні (адмін-поверхня)', async () => {
    await queryRows(dbUrl, `insert into public.sections (id, slug, name, is_active) values ($1, 'e3-hidden', 'Прихований', false)`, [
      crypto.randomUUID(),
    ]);
    const rows = await sectionsReadOps.list({ data: {} });
    expect(rows.some((r) => r.slug === 'e3-hidden')).toBe(true);
  });
});
```

🔴 Колонки `orders`/`order_items` у фікстурі — з `schema.ts` (NOT NULL без
DEFAULT); якщо insert падає `23502` — дописати відсутню колонку з тієї ж
таблиці, це уточнення фікстури, а не логіки.

Run: `pnpm test:schema -- packages/simplycms/test-harness/pg/__tests__/admin-catalog.test.ts`
Expected: FAIL — `productsOps` не експортується.

- [ ] **Step 2: Ресурси запису**

```ts
// packages/simplycms/src/admin-server/impl/products/resource.ts
import { products } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Товар — перший on-demand ресурс (К3-5). filterable — рівно ті поля, якими
 * фільтрує список адмінки (Е3-2) + id для картки (findOne). stockStatus
 * writable: власник ставить «Під замовлення» вручну; автоматичний перехід
 * за кількістю робить saveStock (Е3-3), гвард on_order не чіпає.
 */
export const productsOps = defineAdminResource({
  entity: ENTITY.products,
  table: products,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['id', 'sectionId', 'isActive', 'isFeatured', 'stockStatus'],
  sortable: ['createdAt', 'updatedAt', 'name'],
  defaultOrder: { column: 'createdAt', direction: 'desc' },
  touch: 'updatedAt',
  writable: [
    'sectionId', 'slug', 'name', 'shortDescription', 'description',
    'isActive', 'isFeatured', 'metaTitle', 'metaDescription', 'images',
    'hasModifications', 'sku', 'stockStatus', 'returnPolicy', 'shippingDetails',
  ],
  readonly: ['id', 'createdAt', 'updatedAt'],
});
```

```ts
// packages/simplycms/src/admin-server/impl/product-modifications/resource.ts
import { productModifications } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * 🔴 isDefault — readonly (контракт хвиль Е1б для таблиць із single-default
 * індексом `idx_product_modifications_single_default`): прапорець ставить
 * лише setDefaultModification (Task 4). sortOrder — writable: клієнт рахує
 * max+1 з уже завантаженого зрізу товару; переставляння — reorder (Task 4).
 */
export const productModificationsOps = defineAdminResource({
  entity: ENTITY.productModifications,
  table: productModifications,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['id', 'productId'],
  sortable: ['sortOrder', 'name'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  touch: 'updatedAt',
  writable: ['productId', 'slug', 'name', 'sku', 'images', 'sortOrder', 'stockStatus'],
  readonly: ['id', 'isDefault', 'createdAt', 'updatedAt'],
});
```

```ts
// packages/simplycms/src/admin-server/impl/product-prices/resource.ts
import { productPrices } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Ціни — ЛИШЕ читання фабрикою; запис — атомарним набором
 * saveProductPrices (Е3-10). writable порожній: insert/update/remove цього
 * ресурсу serverFn-ами НЕ виставляються (index.ts).
 */
export const productPricesOps = defineAdminResource({
  entity: ENTITY.productPrices,
  table: productPrices,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['productId', 'modificationId', 'priceTypeId'],
  sortable: ['createdAt'],
  writable: [],
  readonly: ['id', 'priceTypeId', 'productId', 'modificationId', 'price', 'oldPrice', 'createdAt', 'updatedAt'],
});
```

```ts
// packages/simplycms/src/admin-server/impl/stock/resource.ts
import { stockByPickupPoint } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/** Залишки — читання фабрикою, запис — saveStock (Е3-3). */
export const stockOps = defineAdminResource({
  entity: ENTITY.stockByPickupPoint,
  table: stockByPickupPoint,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['productId', 'modificationId'],
  sortable: ['createdAt'],
  writable: [],
  readonly: ['id', 'pickupPointId', 'productId', 'modificationId', 'quantity', 'createdAt', 'updatedAt'],
});
```

```ts
// packages/simplycms/src/admin-server/impl/property-values/resources.ts
import { modificationPropertyValues, productPropertyValues } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Значення властивостей — автозбереження на зміну (Е3-11): фабричні
 * insert/update/remove. Унікальність тримає БД: (власник, властивість,
 * опція) NULLS NOT DISTINCT — скалярна властивість має рівно один рядок
 * (option_id NULL), multiselect — рядок на кожну обрану опцію (Е3-13).
 */
export const productPropertyValuesOps = defineAdminResource({
  entity: ENTITY.productPropertyValues,
  table: productPropertyValues,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['productId', 'propertyId'],
  sortable: ['createdAt'],
  writable: ['productId', 'propertyId', 'value', 'numericValue', 'optionId'],
  readonly: ['id', 'createdAt'],
});

export const modificationPropertyValuesOps = defineAdminResource({
  entity: ENTITY.modificationPropertyValues,
  table: modificationPropertyValues,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['modificationId', 'propertyId'],
  sortable: ['createdAt'],
  writable: ['modificationId', 'propertyId', 'value', 'numericValue', 'optionId'],
  readonly: ['id', 'createdAt'],
});
```

🔴 `optionId` — `uuid` з FK на `property_options` (`schema.ts:274,305`), а
легасі multiselect писав туди CSV id (`ProductPropertyValues.tsx:271-297`) —
на чистому Postgres це `22P02`, тобто multiselect зламаний і в легасі.
Рішення власника 2026-09-22 (Е3-13): **рядок на опцію** — Task 9 переписує
унікальність на `(власник, property_id, option_id) NULLS NOT DISTINCT`.
Коментар у цьому ресурсі — посилання на Е3-13, не на CSV.

- [ ] **Step 3: Ресурси на читання**

```ts
// packages/simplycms/src/admin-server/impl/catalog-read/resources.ts
import {
  priceTypes,
  propertyOptions,
  sectionProperties,
  sectionPropertyAssignments,
  sections,
} from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Довідники, які картка товару ЧИТАЄ, а керуються вони в Е4 (Е3-1).
 * writable порожній — serverFn запису не виставляються; exhaustiveness
 * фабрики змушує перелічити ВСІ колонки в readonly, тож нова колонка в
 * схемі червонить typecheck тут, а не зникає мовчки з адмінки.
 * Операція — catalog.write (Е3-6): адмінка бачить неактивні розділи.
 */
export const sectionsReadOps = defineAdminResource({
  entity: ENTITY.sections,
  table: sections,
  operation: 'catalog.write',
  mode: 'eager',
  filterable: ['id', 'parentId', 'isActive'],
  sortable: ['name', 'sortOrder'],
  defaultOrder: { column: 'name', direction: 'asc' },
  writable: [],
  readonly: [
    'id', 'slug', 'name', 'description', 'imageUrl', 'parentId', 'sortOrder',
    'isActive', 'metaTitle', 'metaDescription', 'createdAt', 'updatedAt',
  ],
});

export const priceTypesReadOps = defineAdminResource({
  entity: ENTITY.priceTypes,
  table: priceTypes,
  operation: 'catalog.write',
  mode: 'eager',
  filterable: ['id'],
  sortable: ['sortOrder'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  writable: [],
  readonly: ['id', 'name', 'code', 'isDefault', 'sortOrder', 'createdAt'],
});

export const sectionPropertyAssignmentsReadOps = defineAdminResource({
  entity: ENTITY.sectionPropertyAssignments,
  table: sectionPropertyAssignments,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['sectionId', 'appliesTo'],
  sortable: ['sortOrder'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  writable: [],
  readonly: ['id', 'sectionId', 'propertyId', 'sortOrder', 'createdAt', 'appliesTo'],
});

export const sectionPropertiesReadOps = defineAdminResource({
  entity: ENTITY.sectionProperties,
  table: sectionProperties,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['id'],
  sortable: ['sortOrder', 'name'],
  writable: [],
  readonly: [
    'id', 'sectionId', 'name', 'slug', 'propertyType', 'isRequired',
    'isFilterable', 'hasPage', 'sortOrder', 'options', 'createdAt',
  ],
});

export const propertyOptionsReadOps = defineAdminResource({
  entity: ENTITY.propertyOptions,
  table: propertyOptions,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['propertyId'],
  sortable: ['sortOrder'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  writable: [],
  readonly: [
    'id', 'propertyId', 'name', 'slug', 'sortOrder', 'createdAt',
    'description', 'imageUrl', 'metaTitle', 'metaDescription',
  ],
});
```

- [ ] **Step 4: Реекспорт нутрощів**

У `impl/index.ts` дописати (живі експорти лише в `impl`, не в стабі):

```ts
export { productsOps } from './products/resource';
export { productModificationsOps } from './product-modifications/resource';
export { productPricesOps } from './product-prices/resource';
export { stockOps } from './stock/resource';
export {
  productPropertyValuesOps,
  modificationPropertyValuesOps,
} from './property-values/resources';
export {
  sectionsReadOps,
  priceTypesReadOps,
  sectionPropertyAssignmentsReadOps,
  sectionPropertiesReadOps,
  propertyOptionsReadOps,
} from './catalog-read/resources';
export { AdminConflictError } from './errors';
```

- [ ] **Step 5: Топ-рівневі serverFn**

У `admin-server/index.ts` — за зразком order-statuses, кожен окремим
топ-рівневим `const` (гейт `server-fn-top-level` червонить на будь-яку
іншу форму). Повний перелік — блок `Produces` вище; шаблон трьох форм:

```ts
export const listProducts = createServerFn({ method: 'GET' })
  .inputValidator(productsOps.subsetSchema)
  .handler(productsOps.list);

export const insertProducts = createServerFn({ method: 'POST' })
  .inputValidator(productsOps.insertSchema)
  .handler(productsOps.insert);

export const updateProducts = createServerFn({ method: 'POST' })
  .inputValidator(productsOps.updateSchema)
  .handler(productsOps.update);

export const removeProducts = createServerFn({ method: 'POST' })
  .inputValidator(productsOps.removeSchema)
  .handler(productsOps.remove);
```

Для ресурсів лише на читання (`productPricesOps`, `stockOps`, п'ять
`*ReadOps`) — ЛИШЕ `list*`. Імпорти `*Ops` — у наявний bare-імпорт з
`'simplycms/admin-server/impl'`. `AdminConflictError` у стаб НЕ
реекспортувати (живий не-serverFn експорт — К3-9′ п.1).

🔴 `index.ts` переросте 150 рядків (~23 serverFn × 3–4 рядки). Це свідомий
виняток канону: К3-9′ вимагає ЄДИНОГО модуля serverFn, і розбиття його на
кілька змінило б межу, яку стереже Gate C (стаб-маркер
`dist/admin-server/index`). Коментар на початку файла — з цим
обґрунтуванням.

- [ ] **Step 6: Typecheck exhaustiveness (має бути ЗЕЛЕНИМ одразу)**

Run: `pnpm typecheck`
Expected: PASS. Помилка з `__missingColumns`/`__overlappingColumns` означає,
що список колонок у плані розійшовся зі `schema.ts` — виправити СПИСОК за
схемою (це припущення плану), не послаблювати тип.

- [ ] **Step 7: Харнес зелений, гейт, коміт**

```bash
pnpm test:schema -- packages/simplycms/test-harness/pg/__tests__/admin-catalog.test.ts
pnpm exec prettier --write packages/simplycms/src/admin-server packages/simplycms/test-harness
pnpm lint && pnpm test && pnpm test:schema
git add -A packages/simplycms/src/admin-server packages/simplycms/test-harness
git commit -m "feat(k3-e3): ресурси каталогу on-demand і serverFn — товар, модифікації, значення властивостей, довідники на читання"
```

## Task 4: Іменовані операції каталогу

**Files:**
- Create: `packages/simplycms/src/admin-server/impl/product-modifications/{set-default,reorder}.ts`
- Create: `packages/simplycms/src/admin-server/impl/catalog-lock.ts` (`lockCatalogTarget`, Step 1а)
- Create: `packages/simplycms/src/admin-server/impl/product-prices/save.ts`
- Create: `packages/simplycms/src/admin-server/impl/stock/save.ts`
- Modify: `packages/simplycms/src/domain/money.ts` (ДОПИСАТИ `MONEY_RE`/`isMoney`/`normalizeMoneyInput`; наявні `formatPrice` і сусіди не чіпати — Step 3)
- Modify: `packages/simplycms/src/admin-server/impl/index.ts`, `packages/simplycms/src/admin-server/index.ts`
- Create: `packages/simplycms/test-harness/pg/__tests__/admin-catalog-ops.test.ts`

**Interfaces:**
- Consumes: `runAdmin` (Task 1), `syncStatusWithQuantity`, `StockTarget` з `simplycms/inventory` (Task 2)
- Produces:
  - `setDefaultModificationInput = z.object({ id: z.uuid() })`; `setDefaultModificationOp → Promise<{ rows: ProductModification[] }>` (усі змінені рядки — і знятий, і поставлений)
  - `reorderModificationInput = z.object({ id: z.uuid(), direction: z.enum(['up','down']) })`; `reorderModificationOp → Promise<{ swapped: ProductModification[] }>`
  - `saveProductPricesInput`; `saveProductPricesOp → Promise<{ rows: ProductPrice[]; removedIds: string[] }>`
  - `saveStockInput`; `saveStockOp → Promise<{ rows: StockByPickupPoint[]; target: Product | ProductModification }>`
  - serverFn: `setDefaultProductModification`, `reorderProductModification`, `saveProductPrices`, `saveStock`

- [ ] **Step 1: Харнес-тести операцій (червоні)**

Шапка — як у Task 3 (свій `randomDbName('simplycms_admin_catalog_ops')`,
мок `requireGrant` і `setResponseStatus`). Фікстури — привілейованим SQL:

```ts
const SECTION = '0e300000-0000-4000-8000-000000000011';
const PRODUCT = '0e300000-0000-4000-8000-000000000012';
const POINT = '0e300000-0000-4000-8000-000000000013';

beforeAll(async () => {
  await queryRows(dbUrl, `insert into public.sections (id, slug, name) values ($1,'ops-s','S')`, [SECTION]);
  await queryRows(dbUrl, `insert into public.products (id, slug, name, section_id) values ($1,'ops-p','P',$2)`, [PRODUCT, SECTION]);
  await queryRows(
    dbUrl,
    `insert into public.pickup_points (id, name, city, address, is_active)
     values ($1,'Склад','Київ','вул. Тестова, 1', true)`,
    [POINT],
  );
});

const retail = async () =>
  ((await queryRows(dbUrl, `select id from public.price_types where code = 'retail'`)) as { id: string }[])[0]!.id;

const mod = async (slug: string) => {
  const [m] = await productModificationsOps.insert({
    data: [{ id: crypto.randomUUID(), productId: PRODUCT, slug, name: slug }],
  });
  return m!;
};

describe('іменовані операції каталогу (Е3, Task 4)', () => {
  it('Review Focus 5: setDefault двічі поспіль — рівно один дефолт на товар, без 23505', async () => {
    const a = await mod('a');
    const b = await mod('b');
    await setDefaultModificationOp({ data: { id: a.id } });
    const { rows } = await setDefaultModificationOp({ data: { id: b.id } });
    expect(rows.map((r) => [r.id, r.isDefault])).toEqual(
      expect.arrayContaining([[a.id, false], [b.id, true]]),
    );
    const defaults = await queryRows(
      dbUrl,
      `select id from public.product_modifications where product_id = $1 and is_default`,
      [PRODUCT],
    );
    expect(defaults).toEqual([{ id: b.id }]);
  });

  it('setDefault не чіпає дефолти ІНШИХ товарів', async () => {
    const other = crypto.randomUUID();
    await queryRows(dbUrl, `insert into public.products (id, slug, name) values ($1,'ops-other','O')`, [other]);
    const x = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.product_modifications (id, product_id, slug, name, is_default) values ($1,$2,'x','X',true)`,
      [x, other],
    );
    const c = await mod('c');
    await setDefaultModificationOp({ data: { id: c.id } });
    expect(await queryRows(dbUrl, `select is_default from public.product_modifications where id = $1`, [x])).toEqual([
      { is_default: true },
    ]);
  });

  it('reorder свапає в межах товару; на краю — no-op', async () => {
    const d = await mod('d');
    const { swapped } = await reorderModificationOp({ data: { id: d.id, direction: 'down' } });
    expect(swapped).toEqual([]);
    const up = await reorderModificationOp({ data: { id: d.id, direction: 'up' } });
    expect(up.swapped).toHaveLength(2);
    expect(up.swapped.every((r) => r.productId === PRODUCT)).toBe(true);
  });

  it('saveProductPrices: вставка, оновлення і видалення одним атомарним актом', async () => {
    const pt = await retail();
    const first = await saveProductPricesOp({
      data: { productId: PRODUCT, modificationId: null, prices: [{ priceTypeId: pt, price: '100.50', oldPrice: null }] },
    });
    expect(first.rows).toHaveLength(1);
    const second = await saveProductPricesOp({
      data: { productId: PRODUCT, modificationId: null, prices: [{ priceTypeId: pt, price: '90', oldPrice: '100.50' }] },
    });
    expect(second.rows[0]!.id).toBe(first.rows[0]!.id); // оновлено, не дубль
    const third = await saveProductPricesOp({ data: { productId: PRODUCT, modificationId: null, prices: [] } });
    expect(third.removedIds).toEqual([first.rows[0]!.id]);
  });

  it('Review Focus 4: відʼємна й нечислова ціна — відмова схеми ДО БД', () => {
    for (const price of ['-1', 'abc', '1.234', ''])
      expect(
        saveProductPricesInput.safeParse({
          productId: PRODUCT,
          modificationId: null,
          prices: [{ priceTypeId: PRODUCT, price, oldPrice: null }],
        }).success,
      ).toBe(false);
    expect(
      saveProductPricesInput.safeParse({
        productId: PRODUCT,
        modificationId: null,
        prices: [{ priceTypeId: PRODUCT, price: '12.50', oldPrice: null }],
      }).success,
    ).toBe(true);
  });

  it('saveStock: кількість 0 → out_of_stock; 3 → знову in_stock; on_order не чіпається', async () => {
    const target = { productId: PRODUCT, modificationId: null };
    const zero = await saveStockOp({ data: { ...target, quantities: [{ pickupPointId: POINT, quantity: 0 }] } });
    expect(zero.target.stockStatus).toBe('out_of_stock');
    const three = await saveStockOp({ data: { ...target, quantities: [{ pickupPointId: POINT, quantity: 3 }] } });
    expect(three.target.stockStatus).toBe('in_stock');
    expect(three.rows).toHaveLength(1); // upsert, не другий рядок
    await queryRows(dbUrl, `update public.products set stock_status = 'on_order' where id = $1`, [PRODUCT]);
    const again = await saveStockOp({ data: { ...target, quantities: [{ pickupPointId: POINT, quantity: 0 }] } });
    expect(again.target.stockStatus).toBe('on_order');
  });

  it('saveStock: рівно одна ціль — і товар, і модифікація разом відбиті схемою', () => {
    expect(
      saveStockInput.safeParse({ productId: PRODUCT, modificationId: PRODUCT, quantities: [] }).success,
    ).toBe(false);
  });

  // 🔴 Конкурентність (знахідка аудиту Codex 2026-09-23): дві вкладки / подвійний
  // клік по одній цілі. Без серіалізації друга транзакція падала б 23505 на
  // частковому unique-індексі (дефолт, перший рядок ціни/залишку).
  it('два одночасні setDefault різних модифікацій товару — обидва успішні, дефолт рівно один', async () => {
    const e = await mod('e');
    const f = await mod('f');
    await Promise.all([
      setDefaultModificationOp({ data: { id: e.id } }),
      setDefaultModificationOp({ data: { id: f.id } }),
    ]);
    const defaults = await queryRows(
      dbUrl,
      `select id from public.product_modifications where product_id = $1 and is_default`,
      [PRODUCT],
    );
    expect(defaults).toHaveLength(1);
  });

  it('два одночасні ПЕРШІ saveProductPrices однієї пари — обидва успішні, рядок один', async () => {
    const pt = await retail();
    const fresh = crypto.randomUUID();
    await queryRows(dbUrl, `insert into public.products (id, slug, name) values ($1,'ops-race','R')`, [fresh]);
    const input = (price: string) => ({
      data: { productId: fresh, modificationId: null, prices: [{ priceTypeId: pt, price, oldPrice: null }] },
    });
    await Promise.all([saveProductPricesOp(input('10')), saveProductPricesOp(input('20'))]);
    expect(await queryRows(dbUrl, `select 1 from public.product_prices where product_id = $1`, [fresh])).toHaveLength(1);
  });

  it('два одночасні ПЕРШІ saveStock однієї цілі — обидва успішні, рядок на точку один', async () => {
    const fresh = crypto.randomUUID();
    await queryRows(dbUrl, `insert into public.products (id, slug, name) values ($1,'ops-race-s','S')`, [fresh]);
    const input = (quantity: number) => ({
      data: { productId: fresh, modificationId: null, quantities: [{ pickupPointId: POINT, quantity }] },
    });
    await Promise.all([saveStockOp(input(1)), saveStockOp(input(2))]);
    expect(
      await queryRows(dbUrl, `select 1 from public.stock_by_pickup_point where product_id = $1`, [fresh]),
    ).toHaveLength(1);
  });
});
```

🔴 `Promise.all` двох операцій дає ДВІ транзакції лише якщо пул має ≥ 2
зʼєднання — перевірити налаштування пулу `simplycms/db` у харнесі; якщо
пул із одного зʼєднання, тест не доводить конкурентності (транзакції
пройдуть послідовно й зелені «за побудовою») — тоді підняти розмір пулу
для цього файла або відкрити другу транзакцію окремим клієнтом `pg`.
Негативний контроль: закоментувати виклик `lockCatalogTarget` у
`saveProductPricesOp` → тест про ціни мусить червоніти `23505`.

Імпорти з `simplycms/admin-server/impl`: `productModificationsOps`,
`setDefaultModificationOp`, `reorderModificationOp`, `saveProductPricesOp`,
`saveProductPricesInput`, `saveStockOp`, `saveStockInput`.

🔴 Колонки `pickup_points` у фікстурі — звірити зі `schema.ts` (NOT NULL без
DEFAULT); дописати, якщо insert падає `23502`.

Run: `pnpm test:schema -- packages/simplycms/test-harness/pg/__tests__/admin-catalog-ops.test.ts`
Expected: FAIL — операцій немає.

- [ ] **Step 1а: Серіалізація за ціллю — `lockCatalogTarget`**

```ts
// packages/simplycms/src/admin-server/impl/catalog-lock.ts
import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';

/**
 * Транзакційний advisory-lock, ключований ціллю операції (знахідка аудиту
 * Codex 2026-09-23): FOR UPDATE на НАЯВНИХ рядках не серіалізує першу
 * вставку (рядка ще немає — блокувати нічого), тож дві паралельні
 * транзакції падали б 23505 на частковому unique-індексі.
 *
 * 🔴 Чому advisory, а не FOR UPDATE рядка товару: вітрина при оформленні
 * блокує СПЕРШУ рядки залишку, ПОТІМ пише рядок товару (setTargetStatus);
 * адмінка, що блокувала б товар першим, дала б зворотний порядок і
 * дедлок 40P01. Advisory-lock у порядку рядкових локів не бере участі.
 * xact-варіант знімається на COMMIT/ROLLBACK сам — сумісний із pgbouncer
 * transaction-mode (спайк B5).
 */
export async function lockCatalogTarget(db: ActorDb, key: string): Promise<void> {
  await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
}
```

Ключі (простір імен — префікс операції, щоб різні операції над тією самою
ціллю не серіалізували одна одну без потреби): `mod-default:<productId>`,
`prices:<productId>:<modificationId|->`, `stock:<productId|->:<modificationId|->`.
🔴 Перевірити, що `app_admin` має право викликати `pg_advisory_xact_lock`
(функція `PUBLIC` за замовчуванням; якщо `0000_prelude.sql`/`0002_grants.sql`
відкликає `EXECUTE` у `PUBLIC` — це падіння `42501` у харнесі, і тоді
питання до власника, а не локальний грант).

- [ ] **Step 2: Дефолт і порядок модифікацій**

```ts
// packages/simplycms/src/admin-server/impl/product-modifications/set-default.ts
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { productModifications } from 'simplycms/schema';
import { runAdmin } from '../run';
import { lockCatalogTarget } from '../catalog-lock';

export const setDefaultModificationInput = z.object({ id: z.uuid() });

/**
 * Дефолт рівно один НА ТОВАР (індекс idx_product_modifications_single_default
 * по product_id). Порядок той самий, що в order-statuses: СПОЧАТКУ зняти з
 * інших модифікацій ЦЬОГО товару, ПОТІМ поставити — інакше 23505. Товар
 * береться з рядка під FOR UPDATE, не з клієнта. Повертає ВСІ змінені рядки
 * — клієнт робить write-back без refetch.
 */
export const setDefaultModificationOp = async ({
  data,
}: {
  data: z.infer<typeof setDefaultModificationInput>;
}) =>
  runAdmin('catalog.write', async (db) => {
    const [target] = await db
      .select({ productId: productModifications.productId })
      .from(productModifications)
      .where(eq(productModifications.id, data.id));
    if (!target) throw new Error(`[admin-server] модифікації ${data.id} не існує`);
    // Два одночасні setDefault різних модифікацій товару інакше обидва
    // «зняли б інших» ДО коміту сусіда і впали 23505 (Step 1а).
    await lockCatalogTarget(db, `mod-default:${target.productId}`);
    const now = new Date();
    const unset = await db
      .update(productModifications)
      .set({ isDefault: false, updatedAt: now })
      .where(
        and(
          eq(productModifications.productId, target.productId),
          eq(productModifications.isDefault, true),
          ne(productModifications.id, data.id),
        ),
      )
      .returning();
    const set = await db
      .update(productModifications)
      .set({ isDefault: true, updatedAt: now })
      .where(eq(productModifications.id, data.id))
      .returning();
    return { rows: [...unset, ...set] };
  });
```

`reorder.ts` — ДОСЛІВНА адаптація `order-statuses/reorder.ts` (детермінований
порядок локів `order by id for update` — урок 40P01 Е1б) з однією зміною:
сусід шукається лише серед модифікацій того самого товару:

```ts
      const [seen] = await db
        .select()
        .from(productModifications)
        .where(eq(productModifications.id, data.id));
      if (!seen) throw new Error(`[admin-server] модифікації ${data.id} не існує`);
      const [next] = await db
        .select({ id: productModifications.id })
        .from(productModifications)
        .where(
          and(
            eq(productModifications.productId, seen.productId),
            data.direction === 'up'
              ? lt(productModifications.sortOrder, seen.sortOrder)
              : gt(productModifications.sortOrder, seen.sortOrder),
          ),
        )
        .orderBy(
          data.direction === 'up'
            ? desc(productModifications.sortOrder)
            : asc(productModifications.sortOrder),
        )
        .limit(1);
```

Решта тіла (лок обох `inArray … orderBy(asc(id)).for('update')`, два
`update … returning`, `{ swapped }`) — як у джерелі, таблиця
`productModifications`, обгортка `runAdmin('catalog.write', …)`.
🔴 Однакові `sort_order` (легасі писав індекси масиву) дають «немає сусіда»
для обох рядків — перестановка між ними неможлива. Додати в харнес кейс:
два рядки з `sort_order = 0` → reorder повертає `[]`, і в коментарі до
операції — що нормалізацію порядку дає Task 8 (новий рядок отримує max+1).

- [ ] **Step 3: Набір цін**

🔴 `packages/simplycms/src/domain/money.ts` УЖЕ ІСНУЄ (`formatPrice`,
`FormatPriceOptions`, `CURRENCY_SYMBOLS` — ~17 споживачів у вітрині, кошику,
чекауті й адмінці). Файл НЕ створюється і НЕ перезаписується: три нові
експорти ДОПИСУЮТЬСЯ в кінець наявного файла (T1, чистий), нічого не
видаляючи:

```ts
// packages/simplycms/src/domain/money.ts — ДОПИСАТИ в кінець
/** Грошова сума як рядок numeric: невідʼємна, до двох знаків після крапки.
 *  Кома як роздільник НЕ приймається тут — її нормалізує форма (Task 8);
 *  на межі сервера формат один. */
// 10 цифр до коми — стеля numeric(12,2) у orders/order_items (хвиля B, m5):
// ціна, яку неможливо оформити (22003), не має бути збережена.
export const MONEY_RE = /^\d{1,10}(\.\d{1,2})?$/;
export const isMoney = (value: string): boolean => MONEY_RE.test(value);
/** «12,50» → «12.50»; пробіли всередині (розділювач тисяч) прибираються. */
export const normalizeMoneyInput = (raw: string): string =>
  raw.replace(/\s+/g, '').replace(',', '.');
```

(+ юніт `domain/__tests__/money.test.ts`: `12,50`→`12.50`, `1 200,5`→`1200.5`,
`isMoney('-1')===false`, `isMoney('1.234')===false`, `isMoney('0')===true`.)

```ts
// packages/simplycms/src/admin-server/impl/product-prices/save.ts
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { productPrices } from 'simplycms/schema';
import { MONEY_RE } from 'simplycms/domain/money';
import { runAdmin } from '../run';
import { lockCatalogTarget } from '../catalog-lock';

const money = z.string().regex(MONEY_RE);

export const saveProductPricesInput = z.object({
  productId: z.uuid(),
  modificationId: z.uuid().nullable(),
  prices: z
    .array(z.object({ priceTypeId: z.uuid(), price: money, oldPrice: money.nullable() }))
    .max(50)
    // 🔴 Один тип ціни — один рядок набору: дубль у вході дав би 23505
    // посеред транзакції замість чіткої 400.
    .refine((p) => new Set(p.map((x) => x.priceTypeId)).size === p.length, {
      message: 'тип ціни повторюється',
    }),
});

/**
 * Атомарна заміна набору цін пари товар/модифікація (Е3-10): типи з входу —
 * upsert, решта наявних — delete. Композитний ключ (price_type, product,
 * COALESCE(modification)) фабричним upsert-ом не виражається, тому рядки
 * пари блокуються FOR UPDATE і розбираються явно. id нових — сервер
 * (контракт id: ключ передає викликач INSERT, тут викликач — сервер).
 */
export const saveProductPricesOp = async ({
  data,
}: {
  data: z.infer<typeof saveProductPricesInput>;
}) =>
  runAdmin('catalog.write', async (db) => {
    // Перша вставка пари не має рядка під FOR UPDATE — серіалізуємо ціль (Step 1а).
    await lockCatalogTarget(db, `prices:${data.productId}:${data.modificationId ?? '-'}`);
    const scope = and(
      eq(productPrices.productId, data.productId),
      data.modificationId
        ? eq(productPrices.modificationId, data.modificationId)
        : isNull(productPrices.modificationId),
    );
    const existing = await db.select().from(productPrices).where(scope).for('update');
    const byType = new Map(existing.map((r) => [r.priceTypeId, r]));
    const wanted = new Set(data.prices.map((p) => p.priceTypeId));
    const removedIds = existing.filter((r) => !wanted.has(r.priceTypeId)).map((r) => r.id);
    if (removedIds.length > 0)
      await db.delete(productPrices).where(inArray(productPrices.id, removedIds));
    const now = new Date();
    const rows = [];
    for (const p of data.prices) {
      const row = byType.get(p.priceTypeId);
      const [saved] = row
        ? await db
            .update(productPrices)
            .set({ price: p.price, oldPrice: p.oldPrice, updatedAt: now })
            .where(eq(productPrices.id, row.id))
            .returning()
        : await db
            .insert(productPrices)
            .values({
              id: randomUUID(),
              productId: data.productId,
              modificationId: data.modificationId,
              priceTypeId: p.priceTypeId,
              price: p.price,
              oldPrice: p.oldPrice,
            })
            .returning();
      rows.push(saved!);
    }
    return { rows, removedIds };
  });
```

- [ ] **Step 4: Залишки з гвардом статусу**

```ts
// packages/simplycms/src/admin-server/impl/stock/save.ts
import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { pickupPoints, productModifications, products, stockByPickupPoint } from 'simplycms/schema';
import {
  lockTargetStock,
  servingQuantity,
  syncStatusWithQuantity,
  type StockTarget,
} from 'simplycms/inventory';
import { runAdmin } from '../run';
import { lockCatalogTarget } from '../catalog-lock';

export const saveStockInput = z
  .object({
    productId: z.uuid().nullable(),
    modificationId: z.uuid().nullable(),
    quantities: z
      .array(z.object({ pickupPointId: z.uuid(), quantity: z.number().int().min(0).max(1_000_000) }))
      .min(1) // порожній запит — не дія власника (хвиля B, M1)
      .max(200),
  })
  // Рівно одна ціль — дзеркало check-обмеження stock_product_or_modification.
  .refine((d) => (d.productId === null) !== (d.modificationId === null), {
    message: 'потрібна рівно одна ціль: товар АБО модифікація',
  });

const scopeOf = (t: StockTarget) =>
  t.modificationId
    ? eq(stockByPickupPoint.modificationId, t.modificationId)
    : and(eq(stockByPickupPoint.productId, t.productId as string), isNull(stockByPickupPoint.modificationId));

/**
 * Ручний облік (Е3-3): upsert кількостей по точках і в ТІЙ САМІЙ
 * транзакції — гвардований перехід stock_status за фактичною сумою (одна
 * копія правила з вітриною — simplycms/inventory). Повертає рядки залишку
 * і оновлену ціль — клієнт робить write-back в обидві колекції.
 */
export const saveStockOp = async ({ data }: { data: z.infer<typeof saveStockInput> }) =>
  runAdmin('catalog.write', async (db) => {
    const target: StockTarget = { productId: data.productId, modificationId: data.modificationId };
    // advisory — лише серіалізація адмін-проти-адмін (перша вставка).
    await lockCatalogTarget(db, `stock:${target.productId ?? '-'}:${target.modificationId ?? '-'}`);
    // 🔴 M2: ВСІ наявні рядки цілі (і неактивних точок — адмін пише й туди)
    // блокуються В ТОМУ САМОМУ ПОРЯДКУ, що й у вітрини (pickup_points.sort_order,
    // stock.id; lockTargetStock бере підмножину в тому ж порядку) — перетин
    // множин локів упорядкований однаково, 40P01 неможливий.
    const existing = await db
      .select({ row: stockByPickupPoint })
      .from(stockByPickupPoint)
      .innerJoin(pickupPoints, eq(pickupPoints.id, stockByPickupPoint.pickupPointId))
      .where(scopeOf(target))
      .orderBy(asc(pickupPoints.sortOrder), asc(stockByPickupPoint.id))
      .for('update', { of: stockByPickupPoint })
      .then((r) => r.map((x) => x.row));
    const byPoint = new Map(existing.map((r) => [r.pickupPointId, r]));
    const now = new Date();
    const rows = [];
    for (const q of data.quantities) {
      const row = byPoint.get(q.pickupPointId);
      const [saved] = row
        ? await db
            .update(stockByPickupPoint)
            .set({ quantity: q.quantity, updatedAt: now })
            .where(eq(stockByPickupPoint.id, row.id))
            .returning()
        : await db
            .insert(stockByPickupPoint)
            .values({ id: randomUUID(), pickupPointId: q.pickupPointId, ...target, quantity: q.quantity })
            .returning();
      rows.push(saved!);
    }
    // 🔴 M1: сума — лише по ОБСЛУГОВУЮЧИХ точках (is_system OR is_active),
    // тим самим lockTargetStock/servingQuantity, що й у вітрини. Інакше
    // залишок деактивованої точки підняв би статус у in_stock, а оформлення
    // впало б InsufficientStockError. Немає обслуговуючих рядків — облік
    // не ведеться (як reserveStock: rows.length === 0 → return): статус не чіпати.
    const serving = await lockTargetStock(db, target);
    if (serving.length > 0) await syncStatusWithQuantity(db, target, servingQuantity(serving));
    const [updated] = target.modificationId
      ? await db.select().from(productModifications).where(eq(productModifications.id, target.modificationId))
      : await db.select().from(products).where(eq(products.id, target.productId as string));
    if (!updated) throw new Error('[admin-server] ціль залишку не існує');
    return { rows, target: updated };
  });
```

🔴 Хвиля B (M1/M2) — харнес-кейси обовʼязкові: системна S qty 0 + ДЕАКТИВОВАНА P
qty 5, статус out_of_stock → «Зберегти» без змін → лишається out_of_stock;
ціль без обслуговуючих рядків → статус не змінено; мутація «прибрати
serving-фільтр» → червоне. Доказ advisory-lock — детермінований: окремий
pg-клієнт тримає `pg_advisory_xact_lock(hashtextextended('<ключ>', 0))`,
операція не резолвиться ~300 мс, після COMMIT — резолвиться; мутація «прибрати
lockCatalogTarget» → червоне (для mod-default:, prices:, stock:).

🔴 Точки, яких немає у вході, НЕ видаляються — форма завжди шле всі активні
точки; видалення рядка залишку не є дією власника (кількість 0 — є).
`insert … values({ ...target })` для товару кладе `modificationId: null` —
відповідає частковому індексу `unique_stock_product_per_point`.

- [ ] **Step 5: Експорти і serverFn**

`impl/index.ts`:

```ts
export { setDefaultModificationInput, setDefaultModificationOp } from './product-modifications/set-default';
export { reorderModificationInput, reorderModificationOp } from './product-modifications/reorder';
export { saveProductPricesInput, saveProductPricesOp } from './product-prices/save';
export { saveStockInput, saveStockOp } from './stock/save';
```

`admin-server/index.ts` — чотири топ-рівневі `createServerFn({ method: 'POST' })`
з `.inputValidator(<input>).handler(<op>)`: `setDefaultProductModification`,
`reorderProductModification`, `saveProductPrices`, `saveStock`.

🔴 Тір-зона: `impl/stock/save.ts` імпортує `simplycms/inventory` — легально
лише після Task 2 (upward-виняток `admin-server`). `simplycms/domain/money` —
T1, легально завжди.

- [ ] **Step 6: Зелений харнес, гейт, коміт**

```bash
pnpm test:schema -- packages/simplycms/test-harness/pg/__tests__/admin-catalog-ops.test.ts
pnpm exec prettier --write packages/simplycms/src packages/simplycms/test-harness
pnpm lint && pnpm test && pnpm test:schema
git add -A packages/simplycms/src packages/simplycms/test-harness
git commit -m "feat(k3-e3): іменовані операції каталогу — дефолт і порядок модифікацій, атомарний набір цін, залишки з гвардом статусу"
```

---

# Частина 2 — колекції `admin-data` (Task 5)

## Task 5: Колекції товару, сателітів і довідників

**Files:**
- Create: `packages/simplycms/src/admin-data/handlers.ts`
- Create: `packages/simplycms/src/admin-data/collections/{products,product-modifications,product-prices,stock-by-pickup-point,product-property-values,modification-property-values}.ts`
- Create: `packages/simplycms/src/admin-data/collections/{sections,price-types,section-property-assignments,section-properties,property-options}.ts`
- Modify: `packages/simplycms/src/admin-data/collections/order-statuses.ts` (на `persistenceHandlers`)
- Modify: `packages/simplycms/src/admin-data/index.ts`
- Create: `packages/simplycms/src/admin-data/__tests__/handlers.test.ts`
- Create: `packages/simplycms/src/admin-data/__tests__/catalog-collections.test.ts`
- Modify: `packages/simplycms/src/contracts/entities.ts` (`variant()`, Step 0) + тест
- Modify: `packages/simplycms/src/storefront-routes/pages/{catalog/useCatalogQueries.ts,Properties.tsx,ProfileOrders.tsx}` (Step 0)
- Create: `tests/bare-list-key.test.ts` (Step 0)

**Interfaces:**
- Consumes: serverFn з Tasks 3–4; `toSubsetPayload` (Task 0); типи рядків `Product`, `ProductModification`, `ProductPrice`, `StockByPickupPoint`, `ProductPropertyValue`, `ModificationPropertyValue`, `Section`, `PriceType`, `SectionPropertyAssignment`, `SectionProperty`, `PropertyOption` (`import type` з `simplycms/schema/types`)
- Produces (з `simplycms/admin-data`): `productsCollection`, `productModificationsCollection`, `productPricesCollection`, `stockCollection`, `productPropertyValuesCollection`, `modificationPropertyValuesCollection`, `sectionsCollection`, `priceTypesCollection`, `sectionPropertyAssignmentsCollection`, `sectionPropertiesCollection`, `propertyOptionsCollection` — кожна `CollectionDef<…>` для `useCollection`/`getCollection`; плюс `persistenceHandlers`

- [ ] **Step 0: Розвести ключі вітрини й колекцій (Е3-15) — ДО першої нової колекції**

1. `entityKey` отримує `variant()` (перенесено сюди з Task 11 — він потрібен
   раніше):

```ts
    /** Варіант форми/скоупу тієї самої сутності (не FK-зріз): окремий
     *  сегмент 'variant' — не зіткнеться ні з колекцією (list), ні з
     *  FK-relation тієї самої назви (борг Е1а №6). */
    variant: (qualifier: string, id?: string) =>
      (id === undefined ? [entity, 'variant', qualifier] : [entity, 'variant', qualifier, id]) as readonly string[],
```

   (+ тест у тесті `contracts/entities`: `variant('storefront')` ≠ `list()`,
   `variant('numeric','s1')` ≠ `scoped('numeric','s1')`, перший сегмент = `all()[0]`.)
2. Чотири вітринні запити з голим `.list()` → `variant('storefront')`:
   `useCatalogQueries.ts` (`sections.list()`, `propertyOptions.list()`),
   `Properties.tsx` (`sectionProperties.list()`), `ProfileOrders.tsx`
   (`orderStatuses.list()` — живий дефект Е1б). Разом — їхні
   `invalidateQueries`/`setQueryData`, якщо є (`git grep -n "<entity>.list()"`).
   `[...X.list(), 'featured']` (з суфіксом) НЕ чіпати — точного збігу немає.
3. Гейт `tests/bare-list-key.test.ts`: AST/regex-скан `packages/simplycms/src/**`
   (крім `admin-data/**` і `__tests__`) на `queryKey: <ідентифікатор>.list()` як
   ЦІЛИЙ ключ (не в spread) → офендерів 0. Негативний контроль: повернути
   `sections.list()` у `useCatalogQueries.ts` → тест червоний.
4. Негативний тест колізії (той, що зловив би дефект): в одному `QueryClient`
   `getCollection(qc, orderStatusesCollection).preload()` і
   `qc.getQueryData(entityKey(ENTITY.orderStatuses).variant('storefront'))`
   → `undefined` (колекція не пише у вітринний ключ).

Run: `pnpm lint && pnpm test` → зелені.

🔴 Після хвилі B (A1, m3): рядки з `simplycms/schema/types` уже несуть
`images: string[]` і `JsonValue` (`schema/json.ts`) — жодних кастів `unknown`
у колекціях; вхід `images` на сервері перевіряє `refine` ресурсу
(`z.array(z.string())`), тож клієнтський draft з іншою формою відбивається 400.

- [ ] **Step 1: Тест спільних хендлерів (червоний)**

Перенести в `handlers.test.ts` три кейси з `order-statuses-collection.test.ts`
(batch-insert одним викликом; write-back КОЖНОГО рядка; fail-loud на
розходженні id — серверний двійник не потрапляє в кеш), але проти колекції,
зібраної з `persistenceHandlers` над фейковими `insert/update/remove`. Кістяк:

```ts
import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { persistenceHandlers } from '../handlers';

type Row = { id: string; name: string };

function build(insert: (a: { data: never }) => Promise<Row[]>) {
  const collection = createCollection(
    queryCollectionOptions<Row>({
      id: 'handlers-test',
      queryClient: new QueryClient(),
      queryKey: ['handlers-test', 'list'],
      getKey: (r) => r.id,
      queryFn: async () => [],
      ...persistenceHandlers<Row>(() => collection, {
        entity: 'handlers-test',
        insert,
        update: vi.fn(async () => []),
        remove: vi.fn(async () => ({ count: 0 })),
      }),
    }),
  );
  return collection;
}

describe('persistenceHandlers', () => {
  it('batch insert — один виклик сервера на всю транзакцію', async () => {
    const insert = vi.fn(async ({ data }: { data: never }) => data as unknown as Row[]);
    const c = build(insert);
    await c.preload();
    const tx = c.insert([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
    await tx.isPersisted.promise;
    expect(insert).toHaveBeenCalledTimes(1);
    expect(c.get('b')?.name).toBe('B');
  });

  it('сервер повернув інший id — fail-loud, двійник не в кеші', async () => {
    const c = build(async () => [{ id: 'server', name: 'A' }]);
    await c.preload();
    const tx = c.insert({ id: 'client', name: 'A' });
    await expect(tx.isPersisted.promise).rejects.toThrow(/замість "client"/);
    expect(c.get('server')).toBeUndefined();
  });
});
```

Run: `pnpm test -- packages/simplycms/src/admin-data/__tests__/handlers.test.ts` → FAIL.

- [ ] **Step 2: `persistenceHandlers`**

```ts
// packages/simplycms/src/admin-data/handlers.ts
/**
 * Спільні persistence-хендлери колекцій адмінки (дедуплікація Е3): канон
 * write-back замість self-invalidation (К3-7) один раз, а не в кожній
 * колекції. Гейт handler-canon сканує САМЕ цей файл — onInsert/onUpdate/
 * onDelete тут, і кожен return { refetch: false } має write-back перед
 * собою.
 *
 * 🔴 `target` — геттер, не значення: колекція ще не існує в момент, коли
 * її опції збираються (хендлери посилаються на неї після створення).
 */
interface WriteBack<Row> {
  utils: {
    writeBatch(cb: () => void): void;
    writeUpsert(row: Row): void;
    writeDelete(key: string): void;
  };
}

interface ServerOps<Row> {
  readonly entity: string;
  readonly insert?: (args: { data: never }) => Promise<Row[]>;
  readonly update?: (args: { data: never }) => Promise<Row[]>;
  readonly remove?: (args: { data: never }) => Promise<unknown>;
}

interface MutationLike {
  readonly key: unknown;
  readonly modified: unknown;
  readonly changes: unknown;
}
interface HandlerArgs {
  readonly transaction: { readonly mutations: readonly MutationLike[] };
}

export function persistenceHandlers<Row extends { id: string }>(
  target: () => WriteBack<Row>,
  ops: ServerOps<Row>,
) {
  return {
    ...(ops.insert && {
      onInsert: async ({ transaction }: HandlerArgs) => {
        // 🔴 batch: УСІ мутації транзакції, не [0].
        const drafts = transaction.mutations.map((m) => m.modified as Row);
        const rows = await ops.insert!({ data: drafts as never });
        // 🔴 Fail-loud ДО write-back (урок favorites MetaHub, А-1).
        for (const [i, row] of rows.entries())
          if (row.id !== drafts[i]?.id)
            throw new Error(
              `[admin-data] ${ops.entity}: сервер повернув id "${row.id}" замість "${drafts[i]?.id}" — write-back писав би не в той ключ`,
            );
        target().utils.writeBatch(() => {
          for (const row of rows) target().utils.writeUpsert(row);
        });
        return { refetch: false };
      },
    }),
    ...(ops.update && {
      onUpdate: async ({ transaction }: HandlerArgs) => {
        const patches = transaction.mutations.map((m) => ({ id: m.key as string, patch: m.changes }));
        const rows = await ops.update!({ data: patches as never });
        target().utils.writeBatch(() => {
          for (const row of rows) target().utils.writeUpsert(row);
        });
        return { refetch: false };
      },
    }),
    ...(ops.remove && {
      onDelete: async ({ transaction }: HandlerArgs) => {
        const ids = transaction.mutations.map((m) => ({ id: m.key as string }));
        await ops.remove!({ data: ids as never });
        target().utils.writeBatch(() => {
          for (const { id } of ids) target().utils.writeDelete(id);
        });
        return { refetch: false };
      },
    }),
  };
}
```

🔴 Якщо `queryCollectionOptions` не приймає ці хендлери структурно (типи
`HandlerArgs` вужчі за бібліотечні `InsertMutationFnParams`) — типізувати
параметр бібліотечним типом (`import type { InsertMutationFnParams } from
'@tanstack/react-db'`), логіку не міняти. `handler-canon` після цього має
лишатись зеленим: `pnpm test -- tests/handler-canon.test.ts`.

Переписати `collections/order-statuses.ts` на `...persistenceHandlers<OrderStatus>(() => collection, { entity: ENTITY.orderStatuses, insert: insertOrderStatuses, update: updateOrderStatuses, remove: removeOrderStatuses })`;
`order-statuses-collection.test.ts` має лишитись зеленим БЕЗ правок — це
доказ еквівалентності.

Run: `pnpm test -- packages/simplycms/src/admin-data tests/handler-canon.test.ts` → PASS.

- [ ] **Step 3: On-demand колекції (форма — одна на всі шість)**

```ts
// packages/simplycms/src/admin-data/collections/products.ts
import { BTreeIndex, createCollection } from '@tanstack/react-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import type { QueryClient } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import type { Product } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import {
  insertProducts,
  listProducts,
  removeProducts,
  updateProducts,
} from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { persistenceHandlers } from '../handlers';
import { toSubsetPayload } from '../subset-payload';

/**
 * Каталог росте — on-demand (К3-5): у памʼяті лише зрізи, які реально
 * запитав живий запит (сторінка списку, картка за id). queryKey статичний
 * list(); demand-суфікс дописує бібліотека — префікс [products] спільний
 * для всіх зрізів (Б-2). preload() на такій колекції — no-op: прогрів
 * роуту робиться live-query (Task 6).
 */
function create(queryClient: QueryClient) {
  const collection = createCollection(
    queryCollectionOptions<Product>({
      id: ENTITY.products,
      queryClient,
      queryKey: entityKey(ENTITY.products).list(),
      syncMode: 'on-demand',
      // 🔴 Е3-16: список гортає useLiveInfiniteQuery — без індексу сортування
      // друга сторінка не запитується (виміряно спайком).
      autoIndex: 'eager',
      defaultIndexType: BTreeIndex,
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listProducts({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<typeof toSubsetPayload>[0],
          ),
        }),
      ...persistenceHandlers<Product>(() => collection, {
        entity: ENTITY.products,
        insert: insertProducts,
        update: updateProducts,
        remove: removeProducts,
      }),
    }),
  );
  return collection;
}

export type ProductsCollection = ReturnType<typeof create>;
export const productsCollection: CollectionDef<ProductsCollection> = {
  id: ENTITY.products,
  create,
};
```

Решта п'ять — тим самим шаблоном, відмінності лише в рядках:

| Файл | Тип рядка | ENTITY | list | insert/update/remove |
|---|---|---|---|---|
| `product-modifications.ts` | `ProductModification` | `productModifications` | `listProductModifications` | `insertProductModifications`/`updateProductModifications`/`removeProductModifications` |
| `product-prices.ts` | `ProductPrice` | `productPrices` | `listProductPrices` | — (без `persistenceHandlers`; запис — `saveProductPrices` + write-back на сторінці) |
| `stock-by-pickup-point.ts` | `StockByPickupPoint` | `stockByPickupPoint` | `listStock` | — (запис — `saveStock`) |
| `product-property-values.ts` | `ProductPropertyValue` | `productPropertyValues` | `listProductPropertyValues` | `insert…`/`update…`/`remove…ProductPropertyValues` |
| `modification-property-values.ts` | `ModificationPropertyValue` | `modificationPropertyValues` | `listModificationPropertyValues` | `insert…`/`update…`/`remove…ModificationPropertyValues` |

🔴 Колекція без хендлерів (ціни, залишки) на `collection.insert` кидає —
це й потрібно: запис тільки іменованою операцією.

- [ ] **Step 4: Колекції на читання**

Той самий шаблон без `persistenceHandlers`:

| Файл | Тип | ENTITY | list | syncMode |
|---|---|---|---|---|
| `sections.ts` | `Section` | `sections` | `listSections` | eager (без поля; `queryFn: () => listSections({ data: {} })`) |
| `price-types.ts` | `PriceType` | `priceTypes` | `listPriceTypes` | eager |
| `section-property-assignments.ts` | `SectionPropertyAssignment` | `sectionPropertyAssignments` | `listSectionPropertyAssignments` | on-demand |
| `section-properties.ts` | `SectionProperty` | `sectionProperties` | `listSectionProperties` | on-demand |
| `property-options.ts` | `PropertyOption` | `propertyOptions` | `listPropertyOptions` | on-demand |

🔴 `sections`/`price_types` — спільний префікс з Е4: коли хвиля Е4 додасть
їм запис, вона ДОПИСУЄ хендлери в ці самі файли, а не заводить другу
колекцію того самого `ENTITY` (одна таблиця — один префікс, DoD К3 п.3).

`admin-data/index.ts` — експортувати всі одинадцять `…Collection` і типи
`…Collection`-ів (як для order-statuses) плюс `persistenceHandlers`.

- [ ] **Step 5: Тест колекцій каталогу**

`catalog-collections.test.ts` — мок `simplycms/admin-server` (через
`vi.hoisted`, як у `order-statuses-collection.test.ts`) і три кейси:

```ts
it('products: queryFn несе фільтр sectionId у subset-payload list-serverFn', async () => {
  const qc = new QueryClient();
  const products = getCollection(qc, productsCollection);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  listProducts.mockResolvedValueOnce([]);
  const { result } = renderHook(
    () => useLiveQuery((q) => q.from({ p: products }).where(({ p }) => eq(p.sectionId, 's1'))),
    { wrapper },
  );
  await waitFor(() => expect(result.current.isReady).toBe(true));
  expect(listProducts).toHaveBeenCalledWith({
    data: {
      subset: expect.objectContaining({
        filters: [{ field: ['sectionId'], operator: 'eq', value: 's1' }],
      }),
    },
  });
});
it('ціни: collection.insert кидає (запис лише saveProductPrices)', async () => {
  const c = getCollection(new QueryClient(), productPricesCollection);
  expect(() => c.insert({ id: 'x' } as never)).toThrow();
});
it('sections: eager — preload тягне listSections({ data: {} }) один раз', async () => {
  const c = getCollection(new QueryClient(), sectionsCollection);
  await c.preload();
  expect(listSections).toHaveBeenCalledWith({ data: {} });
});
```

(Перший кейс — повний `renderHook` за зразком Task 0 Step 4, кейс (1).)

Run: `pnpm test -- packages/simplycms/src/admin-data` → PASS.

- [ ] **Step 6: Гейт і коміт**

```bash
pnpm exec prettier --write packages/simplycms/src/admin-data
pnpm lint && pnpm test
git add -A packages/simplycms/src/admin-data
git commit -m "feat(k3-e3): колекції каталогу — on-demand товар і сателіти, довідники на читання, спільні persistence-хендлери"
```

---

# Частина 3 — сторінки каталогу (Tasks 6–10)

**Спільне для Tasks 6–10.**

- Код UI фічі живе в `packages/simplycms/src/admin/features/products/**`
  (К3-9: фіча простежується вертикально за іменем — `admin-server/impl/products`,
  `admin-data/collections/products`, `admin/features/products`). Кожен НОВИЙ
  файл ≤ 150 рядків; легасі-файли з 500–670 рядків розкладаються, а не
  переносяться.
- Розмітка (Card/Table/Badge/Dialog, класи Tailwind, `PluginSlot`-и
  `admin.product.form.*`) переноситься з легасі-файлу БЕЗ дизайнерських
  змін — етап міняє шар даних, не вигляд. Хардкод-рядки, які легасі тримав
  повз i18n («URL (slug) *», «SEO», «Meta Title», «Meta Description»,
  плейсхолдери `100w`/`SP-100W-BLK`), при переносі стають ключами в
  `admin/products.ts` обох локалей.
- 🔴 Кожен контрол форми має `id` + `<Label htmlFor>` — з них будує
  селектори живий прогін (Task 13). Імена id фіксуються в задачах нижче.
- Конфлікти БД (Е3-7) — один хелпер `adminErrorKey` (Task 6 Step 2), жоден
  файл не розбирає `error.name` сам.
- Кожен файл фічі, що кличе serverFn запису або мутує колекцію, — у зоні
  `mutation-cache-sync` автоматично (Task 12 розширює зону на
  `admin/features/**`); до Task 12 правило для них не діє, тому сторінкові
  тести нижче перевіряють синк кешу явно.

## Task 6: Список товарів

**Files:**
- Create: `packages/simplycms/src/admin/lib/admin-error.ts` + `__tests__/admin-error.test.ts`
- Create: `packages/simplycms/src/admin/features/products/list/{ProductsPage,ProductsFilters,ProductsTable,useProductsList}.tsx`
- Create: `packages/simplycms/src/admin/features/products/list/__tests__/ProductsPage.test.tsx`
- Modify: `packages/simplycms/routes/admin/admin/products/index.tsx`
- Delete: `packages/simplycms/src/admin/pages/Products.tsx`
- Modify: `packages/simplycms/src/i18n/catalogs/{uk,en}/admin/{products,common}.ts`

**Interfaces:**
- Consumes: `productsCollection`, `sectionsCollection` (Task 5)
- Produces: `adminErrorKey(error: unknown): MessageKey | null` (`simplycms/admin/lib/admin-error`) — вживають Tasks 7–10; `default export ProductsPage`

- [ ] **Step 1: Звірити сигнатуру `useLiveInfiniteQuery`**

```bash
sed -n 1,80p node_modules/.pnpm/@tanstack+react-db@0.3.6*/node_modules/@tanstack/react-db/src/useLiveInfiniteQuery.ts | rg -n "export function|deps|pageSize"
```

Якщо третій аргумент `deps` є — фільтри передаються ним. Якщо ні —
`ProductsTable` отримує `key={filtersKey}` від сторінки (перемонтування
перебудовує запит); вибір зафіксувати коментарем у `useProductsList`.

- [ ] **Step 2: `adminErrorKey` (тест спершу)**

```ts
// packages/simplycms/src/admin/lib/__tests__/admin-error.test.ts
import { describe, expect, it } from 'vitest';
import { adminErrorKey } from '../admin-error';

const conflict = (kind: string, constraint: string | null) =>
  Object.assign(new Error('x'), { name: 'AdminConflictError', kind, constraint });

describe('adminErrorKey', () => {
  it('slug — окремий ключ, бо власник виправляє саме поле URL', () => {
    expect(adminErrorKey(conflict('unique', 'products_slug_key'))).toBe('admin.errors.slugTaken');
    // 🔴 Реальні імена (schema.ts:423,445): друге — НЕ за конвенцією *_slug_key.
    expect(adminErrorKey(conflict('unique', 'product_modifications_product_slug_unique'))).toBe(
      'admin.errors.slugTaken',
    );
  });
  it('інша унікальність — загальний ключ', () => {
    expect(adminErrorKey(conflict('unique', 'x_key'))).toBe('admin.errors.conflictUnique');
  });
  it('посилання — «є в замовленнях, деактивуйте»', () => {
    expect(adminErrorKey(conflict('reference', 'order_items_product_id_fkey'))).toBe(
      'admin.errors.conflictReference',
    );
  });
  it('не конфлікт — null (викликач показує свій загальний тост)', () => {
    expect(adminErrorKey(new Error('boom'))).toBeNull();
    expect(adminErrorKey(undefined)).toBeNull();
  });
});
```

```ts
// packages/simplycms/src/admin/lib/admin-error.ts
import type { MessageKey } from 'simplycms/i18n';

/**
 * Ключ повідомлення для конфлікту БД (Е3-7). Розрізняємо за полями, а не
 * instanceof: seroval десеріалізує помилку serverFn у голий Error з
 * накладеними властивостями (К3-13). Клас AdminConflictError живе в
 * server-only дереві — сюди він не імпортується навіть типом.
 */
export function adminErrorKey(error: unknown): MessageKey | null {
  const e = error as { name?: unknown; kind?: unknown; constraint?: unknown } | null;
  if (e?.name !== 'AdminConflictError') return null;
  if (e.kind === 'reference') return 'admin.errors.conflictReference';
  // Входження, не суфікс: product_modifications_product_slug_unique названо
  // руками, решта slug-обмежень — *_slug_key (аудит 2026-09-23).
  return typeof e.constraint === 'string' && e.constraint.includes('slug')
    ? 'admin.errors.slugTaken'
    : 'admin.errors.conflictUnique';
}
```

Ключі в `admin/common.ts` обох локалей:

```ts
  'admin.errors.slugTaken': 'Такий URL (slug) уже зайнятий — змініть його',
  'admin.errors.conflictUnique': 'Таке значення вже існує',
  'admin.errors.conflictReference':
    'Запис використовується (наприклад, у замовленнях) — деактивуйте його замість видалення',
```

(`en`: «This URL (slug) is already taken — change it», «This value already
exists», «The record is in use (e.g. in orders) — deactivate it instead of
deleting».)

- [ ] **Step 3: `useProductsList`**

```ts
// packages/simplycms/src/admin/features/products/list/useProductsList.ts
import { eq, useLiveInfiniteQuery } from '@tanstack/react-db';
import { productsCollection, sectionsCollection, useCollection } from 'simplycms/admin-data';
import type { StockStatus } from 'simplycms/contracts';

export const PRODUCTS_PAGE_SIZE = 50;

export interface ProductFilters {
  readonly sectionId?: string;
  readonly isActive?: boolean;
  readonly stockStatus?: StockStatus;
}

/**
 * Сторінка списку — on-demand зріз: фільтри йдуть push-down у Drizzle
 * (eq), розділ підтягується join-ом з eager-довідника. «Показати ще» —
 * offset + peek-ahead бібліотеки (Е3-2); загальної кількості свідомо немає.
 * 🔴 Жодного like/ilike/or: push-down їх не несе (Task 0), пошук — П6.
 */
export function useProductsList(filters: ProductFilters) {
  const products = useCollection(productsCollection);
  const sections = useCollection(sectionsCollection);
  return useLiveInfiniteQuery(
    (q) => {
      let query = q
        .from({ p: products })
        .leftJoin({ s: sections }, ({ p, s }) => eq(p.sectionId, s.id));
      if (filters.sectionId) query = query.where(({ p }) => eq(p.sectionId, filters.sectionId!));
      if (filters.isActive !== undefined)
        query = query.where(({ p }) => eq(p.isActive, filters.isActive!));
      if (filters.stockStatus)
        query = query.where(({ p }) => eq(p.stockStatus, filters.stockStatus!));
      return query
        .orderBy(({ p }) => p.createdAt, 'desc')
        .select(({ p, s }) => ({
          id: p.id,
          name: p.name,
          images: p.images,
          isActive: p.isActive,
          stockStatus: p.stockStatus,
          sectionName: s?.name,
        }));
    },
    { pageSize: PRODUCTS_PAGE_SIZE },
    [filters.sectionId, filters.isActive, filters.stockStatus],
  );
}
```

(Третій аргумент — за результатом Step 1.)

- [ ] **Step 4: Компоненти сторінки**

- `ProductsFilters.tsx` — три `Select` (розділ із `useLiveQuery` над
  `sectionsCollection`, «Усі/Активні/Неактивні», «Усі/В наявності/Немає/Під
  замовлення»); `id`: `products-filter-section`, `products-filter-active`,
  `products-filter-stock`. Стан фільтрів — `useState` у `ProductsPage`
  (синк з URL search — поза етапом).
- `ProductsTable.tsx` — розмітка таблиці з легасі `Products.tsx:108-190`
  (мініатюра, назва, розділ, бейдж активності, видалення) + рядок-кнопка
  «Показати ще» (`admin.products.loadMore`), видимий при `hasNextPage`,
  disabled при `isFetchingNextPage`. Мініатюра — `resolveMediaUrl(images[0])`
  з `simplycms/domain/media` (у колонці референс, не URL — Е2-1).
- Видалення — `AlertDialog` замість браузерного `confirm()` (як у
  `OrderStatuses.tsx`), дія:

```ts
  const handleDelete = (id: string) => {
    const tx = products.delete(id);
    tx.isPersisted.promise
      .then(() => toast.success(t('admin.products.deleted')))
      .catch((e: unknown) => {
        // Оптимістичне видалення вже відкотилось (рядок повернувся в список) —
        // лишилось пояснити чому. Review Focus 2.
        const key = adminErrorKey(e);
        toast.error(key ? t(key) : `${t('common.error')} ${(e as Error).message}`);
      });
  };
```

- Кнопка «Додати товар» → `navigate({ to: adminPath('products/$productId'), params: { productId: 'new' } })` (як у легасі).
- Нові i18n-ключі в `admin/products.ts` обох локалей: `admin.products.loadMore`
  («Показати ще» / «Show more»), `admin.products.filters.section`/`.active`/
  `.stock`, `admin.products.filters.all`, `admin.products.filters.activeOnly`,
  `admin.products.filters.inactiveOnly`.

- [ ] **Step 5: Роут**

```tsx
// packages/simplycms/routes/admin/admin/products/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { getCollection, sectionsCollection } from 'simplycms/admin-data';
import ProductsPage from 'simplycms/admin/features/products/list/ProductsPage';

export const Route = createFileRoute('/admin/products/')({
  // 🔴 Прогріваємо лише eager-довідник розділів: preload() on-demand колекції
  // — no-op (Б-1), а перша сторінка списку залежить від фільтрів компонента.
  loader: async ({ context }) => {
    await getCollection(context.queryClient, sectionsCollection).preload();
    return null;
  },
  component: ProductsPage,
});
```

🔴 Якщо субшлях `simplycms/admin/features/...` не резолвиться (exports-мапа
пакета не має `./admin/*`) — перевірити, як роут `order-statuses` імпортує
`simplycms/admin/pages/OrderStatuses`, і покласти `ProductsPage` туди ж або
реекспортувати з `admin/pages/Products.tsx` однорядковим `export { default } from '../features/products/list/ProductsPage';`.
Форма запису — за наявним патерном, не новою exports-гілкою.

- [ ] **Step 6: Тест сторінки**

`ProductsPage.test.tsx` — мок `simplycms/admin-server` (`listProducts`,
`listSections`, `removeProducts`) через `vi.hoisted`, рендер у
`QueryClientProvider` + `I18nProvider` (як тести `OrderStatuses`, якщо є;
інакше мінімальна обгортка з `simplycms/i18n`). Кейси:

1. Рендер першої сторінки: `listProducts` викликано з `subset.limit === 51` і
   `sorts[0].field === ['createdAt']`; видно назву розділу з join-а.
2. Фільтр розділу → новий виклик `listProducts` з
   `filters: [{ field: ['sectionId'], operator: 'eq', value: 's1' }]`.
3. «Показати ще» при 51 рядку відповіді → виклик з `offset: 50`.
4. Review Focus 2: `removeProducts` відхиляє
   `Object.assign(new Error('x'), { name: 'AdminConflictError', kind: 'reference', constraint: 'order_items_product_id_fkey' })`
   → рядок після rollback знову в таблиці, тост містить текст
   `admin.errors.conflictReference` (мок `sonner` — `vi.mock('sonner')`).

Run: `pnpm test -- packages/simplycms/src/admin/features/products/list packages/simplycms/src/admin/lib`
Expected: PASS.

- [ ] **Step 7: Гейт і коміт**

```bash
git rm packages/simplycms/src/admin/pages/Products.tsx   # якщо не лишився реекспортом (Step 5)
pnpm exec prettier --write packages/simplycms/src/admin packages/simplycms/routes/admin packages/simplycms/src/i18n
pnpm lint && pnpm test
git add -A packages/simplycms/src/admin packages/simplycms/routes/admin packages/simplycms/src/i18n
git commit -m "feat(k3-e3): список товарів на on-demand колекції — фільтри push-down, «Показати ще», конфлікти видалення"
```

## Task 7: Картка товару — форма, розділ, зображення, створення

**Files:**
- Create: `packages/simplycms/src/admin/features/products/edit/{ProductEditPage,NewProductPage,ProductForm,ProductMainFields,ProductSeoFields,ProductSidebar,product-form-schema,useProductSave}.tsx|ts`
- Create: `packages/simplycms/src/admin/features/products/edit/__tests__/{product-form-schema,useProductSave}.test.ts(x)`
- Modify: `packages/simplycms/routes/admin/admin/products/$productId.tsx`
- Delete: `packages/simplycms/src/admin/pages/ProductEdit.tsx` (або однорядковий реекспорт — як вирішено в Task 6 Step 5)

**Interfaces:**
- Consumes: `productsCollection`, `sectionsCollection`, `adminErrorKey`, `ImageUpload` (без змін, Е2)
- Produces:
  - `productFormSchema` (Zod) і `type ProductFormValues`
  - `toProductDraft(values: ProductFormValues, id: string, now: Date): Product` — повний оптимістичний рядок
  - `toProductPatch(values: ProductFormValues): Partial<Product>` — з правилом «товар із модифікаціями не має власних sku/stockStatus»
  - `ProductEditPage({ productId })` — рендерить панелі Tasks 8–10 через пропси `productId`, `sectionId`, `hasModifications`

- [ ] **Step 1: Схема форми і перетворення (тест спершу)**

```ts
// packages/simplycms/src/admin/features/products/edit/__tests__/product-form-schema.test.ts
import { describe, expect, it } from 'vitest';
import { productFormSchema, toProductDraft, toProductPatch } from '../product-form-schema';

const base = {
  name: 'Панель', slug: 'panel', shortDescription: '', description: '',
  metaTitle: '', metaDescription: '', sectionId: 's1', isActive: true,
  isFeatured: false, hasModifications: false, sku: 'SKU-1', stockStatus: 'in_stock' as const,
  images: [] as string[],
};

describe('productFormSchema', () => {
  it('slug — лише латиниця, цифри й дефіс', () => {
    expect(productFormSchema.safeParse({ ...base, slug: 'Панель 1' }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...base, slug: 'panel-1' }).success).toBe(true);
  });
  it('назва обовʼязкова (після trim)', () => {
    expect(productFormSchema.safeParse({ ...base, name: '   ' }).success).toBe(false);
  });
  it('порожні необовʼязкові рядки → null у patch (не "" у БД)', () => {
    expect(toProductPatch(base)).toMatchObject({ shortDescription: null, metaTitle: null });
  });
  it('товар із модифікаціями: sku null, stockStatus in_stock (правило легасі ProductEdit.tsx:169-176)', () => {
    expect(toProductPatch({ ...base, hasModifications: true })).toMatchObject({
      sku: null,
      stockStatus: 'in_stock',
    });
  });
  it('draft несе клієнтський id і повний рядок (оптимістична вставка)', () => {
    const now = new Date('2026-09-23T00:00:00Z');
    const d = toProductDraft(base, 'id-1', now);
    expect(d).toMatchObject({ id: 'id-1', createdAt: now, updatedAt: now, returnPolicy: null });
  });
});
```

```ts
// packages/simplycms/src/admin/features/products/edit/product-form-schema.ts
import { z } from 'zod';
import type { Product } from 'simplycms/schema/types';

const optionalText = z.string().trim();
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const productFormSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().regex(SLUG_RE),
  shortDescription: optionalText,
  description: optionalText,
  metaTitle: optionalText,
  metaDescription: optionalText,
  sectionId: z.string().min(1),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  hasModifications: z.boolean(),
  sku: optionalText,
  stockStatus: z.enum(['in_stock', 'out_of_stock', 'on_order']),
  images: z.array(z.string()),
});
export type ProductFormValues = z.infer<typeof productFormSchema>;

const orNull = (s: string) => (s === '' ? null : s);

/** Поля запису з форми. 🔴 Товар із модифікаціями не має власних sku й
 *  статусу — вони живуть на модифікаціях (правило легасі, не змінюється). */
export function toProductPatch(v: ProductFormValues) {
  return {
    name: v.name,
    slug: v.slug,
    shortDescription: orNull(v.shortDescription),
    description: orNull(v.description),
    metaTitle: orNull(v.metaTitle),
    metaDescription: orNull(v.metaDescription),
    sectionId: v.sectionId,
    isActive: v.isActive,
    isFeatured: v.isFeatured,
    hasModifications: v.hasModifications,
    images: v.images,
    sku: v.hasModifications ? null : orNull(v.sku),
    stockStatus: v.hasModifications ? ('in_stock' as const) : v.stockStatus,
  } satisfies Partial<Product>;
}

/** Повний оптимістичний рядок: колекція тримає Product, не NewProduct;
 *  зайві поля (createdAt, updatedAt) insert-схема сервера відкидає. */
export function toProductDraft(v: ProductFormValues, id: string, now: Date): Product {
  return {
    ...toProductPatch(v),
    id,
    createdAt: now,
    updatedAt: now,
    returnPolicy: null,
    shippingDetails: null,
  };
}
```

🔴 Якщо `Product` має колонки, яких тут немає, — typecheck назве їх
(повний рядок обовʼязковий); дописати з дефолтом схеми (`null`/значення
DEFAULT), це уточнення плану. `returnPolicy`/`shippingDetails` у формі не
редагуються (B7-override — поза етапом) — `toProductPatch` їх не несе, тож
update їх не затирає.

Run: `pnpm test -- packages/simplycms/src/admin/features/products/edit/__tests__/product-form-schema.test.ts` → PASS.

- [ ] **Step 2: `useProductSave`**

```ts
// packages/simplycms/src/admin/features/products/edit/useProductSave.ts
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { productsCollection, useCollection } from 'simplycms/admin-data';
import { adminPath } from 'simplycms/admin/lib/adminLinks';
import { adminErrorKey } from 'simplycms/admin/lib/admin-error';
import { useT } from 'simplycms/i18n';
import { toProductDraft, toProductPatch, type ProductFormValues } from './product-form-schema';

/**
 * Створення й збереження товару через колекцію (оптимізм + write-back
 * хендлерів Task 5). Діалог/сторінка чекає isPersisted — успіх показується
 * лише після підтвердження сервера. Review Focus 1: конфлікт slug — тост
 * з i18n, форма лишається з введеним (помилка не скидає стан).
 */
export function useProductSave() {
  const products = useCollection(productsCollection);
  const navigate = useNavigate();
  const t = useT();

  const fail = (e: unknown) => {
    const key = adminErrorKey(e);
    toast.error(key ? t(key) : `${t('common.error')} ${(e as Error).message}`);
  };

  const create = async (values: ProductFormValues) => {
    const id = crypto.randomUUID(); // контракт id: ключ генерує клієнт (К3-6)
    const tx = products.insert(toProductDraft(values, id, new Date()));
    try {
      await tx.isPersisted.promise;
      toast.success(t('admin.products.created'));
      await navigate({ to: adminPath('products/$productId'), params: { productId: id } });
    } catch (e) {
      fail(e);
    }
  };

  const update = async (id: string, values: ProductFormValues) => {
    const patch = toProductPatch(values);
    // 🔴 Updater мусить лишити слід у draft (А-4: порожній draft — тихий
    // no-op без запиту). Object.assign пише всі поля patch завжди.
    const tx = products.update(id, (draft) => {
      Object.assign(draft, patch);
    });
    try {
      await tx.isPersisted.promise;
      toast.success(t('admin.products.updated'));
    } catch (e) {
      fail(e);
    }
  };

  return { create, update };
}
```

(`adminPath` живе в `packages/simplycms/src/admin/lib/adminLinks.ts` — легасі
`ProductEdit.tsx` імпортує його відносно, `../lib/adminLinks`; з фічі —
відносним шляхом у межах `src/admin` або субшляхом, як вирішено в Task 6 Step 5.)

Тест `useProductSave.test.tsx` (мок `simplycms/admin-server`, мок `sonner`,
мок `useNavigate`): (а) create кличе `insertProducts` з рядком, де `id` —
uuid і `slug` з форми, після успіху — navigate на `$productId = id`;
(б) Review Focus 1: `insertProducts` відхиляє конфліктом
`products_slug_key` → `toast.error` з текстом `admin.errors.slugTaken`,
navigate НЕ викликано; (в) update кличе `updateProducts` з
`[{ id, patch }]`, де `patch.sku === null` при `hasModifications: true`.

- [ ] **Step 3: Сторінки й форма**

- `ProductForm.tsx` — `react-hook-form` + `zodResolver(productFormSchema)`
  (як `SetPasswordForm`), композиція `ProductMainFields` (назва `#product-name`,
  slug `#product-slug`, короткий опис `#product-short-description`, повний
  опис — `RichTextEditor`, зображення — `ImageUpload` у обгортці
  `<div data-testid="product-images">` з `entityType="product"`,
  `entityId={productId ?? null}`, `maxImages={10}`), `ProductSeoFields`
  (`#product-meta-title`, `#product-meta-description`), `ProductSidebar`
  (розділ `#product-section` — `Select` над `useLiveQuery` по
  `sectionsCollection`, сортування за назвою; активність `#product-active`;
  рекомендований `#product-featured`; тип товару `#product-type` —
  simple/with-mods). Автогенерація slug з назви для НОВОГО товару — як у
  легасі (якщо легасі її не мав — не додавати). Кнопка `type="submit"` з
  `common.create` / `common.save`. `PluginSlot`-и `admin.product.form.before/
  fields/after/sidebar` — на тих самих місцях, що в легасі.
- `NewProductPage.tsx` — `ProductForm` з дефолтами (`isActive: true`,
  `hasModifications: false`, `stockStatus: 'in_stock'`, решта порожня) і
  `onSubmit={create}`. Панелей модифікацій/цін/залишків/властивостей немає
  (як у легасі: `!isNew && …`).
- `ProductEditPage.tsx` — `useLiveQuery((q) => q.from({ p: products }).where(({ p }) => eq(p.id, productId)).findOne(), [productId])`;
  поки `isLoading` — скелетон; `isReady && !data` — «товар не знайдено»
  (`admin.products.notFound`) з кнопкою назад; інакше `ProductForm` з
  `defaultValues` із рядка (null → '') і `onSubmit={(v) => update(productId, v)}`,
  під формою — умовні панелі з легасі `ProductEdit.tsx:344-376`, але вже
  нових компонентів (Tasks 8–10):
  - `!hasModifications` → `SimpleProductPanel` (Task 8)
  - `sectionId && !hasModifications` → `PropertyValuesPanel` з `appliesTo='all'`, `target='product'` (Task 10)
  - `sectionId && hasModifications` → `PropertyValuesPanel` з `appliesTo='product'`, `target='product'` (Task 10)
  - `hasModifications` → `ModificationsPanel` (Task 8)
  🔴 `hasModifications`/`sectionId` для панелей — з ЗБЕРЕЖЕНОГО рядка
  колекції, не з незбереженої форми (панелі пишуть у БД одразу; показувати
  їх для типу, якого ще не збережено, — писати сателіти не тій моделі).
  До Tasks 8–10 панелі — заглушки-імпорти не створюються: задача 7 рендерить
  лише ті, що вже є; решту додають Tasks 8–10 рядком у `ProductEditPage`.
- `$productId.tsx`:

```tsx
export const Route = createFileRoute('/admin/products/$productId')({
  loader: async ({ context }) => {
    await Promise.all([
      getCollection(context.queryClient, sectionsCollection).preload(),
      getCollection(context.queryClient, priceTypesCollection).preload(),
    ]);
    return null;
  },
  component: function ProductRoute() {
    const { productId } = Route.useParams();
    return productId === 'new' ? <NewProductPage /> : <ProductEditPage productId={productId} />;
  },
});
```

🔴 Параметр `productId`, який не є uuid і не `new` (стара закладка), дасть
400 зі схеми list-serverFn (`id` — `uuid`-фільтр). Сторінка мусить
показати «не знайдено», а не впасти: у `ProductEditPage` перевірити
`z.uuid().safeParse(productId)` ДО `useLiveQuery` і одразу рендерити
not-found (+ тест).

Нові ключі i18n (`admin/products.ts`, обидві локалі):
`admin.products.notFound`, `admin.products.slugLabel` («URL (slug) *»),
`admin.products.seoTitle` («SEO»), `admin.products.metaTitle`,
`admin.products.metaDescription`, `admin.products.slugHint` (латиниця,
цифри, дефіс).

- [ ] **Step 4: Гейт і коміт**

```bash
pnpm exec prettier --write packages/simplycms/src/admin packages/simplycms/routes/admin packages/simplycms/src/i18n
pnpm lint && pnpm test && pnpm typecheck
git add -A packages/simplycms/src/admin packages/simplycms/routes/admin packages/simplycms/src/i18n
git commit -m "feat(k3-e3): картка товару на колекції — форма з Zod, розділ, зображення через порт, конфлікт slug"
```

## Task 8: Модифікації, ціни, залишки

**Files:**
- Create: `packages/simplycms/src/admin/features/products/modifications/{ModificationsPanel,ModificationsTable,ModificationDialog,useModifications}.tsx|ts`
- Create: `packages/simplycms/src/admin/features/products/prices/{PricesEditor,usePrices}.tsx|ts`
- Create: `packages/simplycms/src/admin/features/products/stock/{StockEditor,useStock}.tsx|ts`
- Create: `packages/simplycms/src/admin/features/products/simple/SimpleProductPanel.tsx`
- Create: `__tests__` поруч із кожним `use*.ts`
- Move: `packages/simplycms/src/admin/components/StockStatusSelect.tsx` → `admin/features/products/stock/StockStatusSelect.tsx` (`git mv`, вміст без змін)
- Delete: `packages/simplycms/src/admin/components/{ProductModifications,ProductPricesEditor,StockByPointManager,SimpleProductFields}.tsx`
- Modify: `ProductEditPage.tsx` (панелі)

**Interfaces:**
- Consumes: колекції `productModificationsCollection`, `productPricesCollection`, `stockCollection`, `priceTypesCollection`, `productsCollection`; serverFn `setDefaultProductModification`, `reorderProductModification`, `saveProductPrices`, `saveStock`; `normalizeMoneyInput`, `isMoney` з `simplycms/domain/money`
- Produces: `ModificationsPanel({ productId, sectionId })`, `PricesEditor({ productId, modificationId })`, `StockEditor({ productId, modificationId })`, `SimpleProductPanel({ productId, sku, stockStatus, onSkuChange, onStockStatusChange })`

- [ ] **Step 1: `usePrices` (тест спершу)**

Тест (мок `saveProductPrices`, колекції через `getCollection(qc, …)` з
моками list): (а) Review Focus 4: вхід `{ [retail]: '1 234,50', [wholesale]: '' }`
→ `saveProductPrices` отримує `prices: [{ priceTypeId: retail, price: '1234.50', oldPrice: null }]`
(порожнє = «цього типу немає», у вхід не йде); (б) `'-5'` → повертає
помилку валідації поля, serverFn НЕ викликано; (в) після відповіді
`{ rows, removedIds }` колекція цін містить `rows` і не містить
`removedIds` (write-back без refetch).

```ts
// packages/simplycms/src/admin/features/products/prices/usePrices.ts
import { and, eq, isNull, useLiveQuery } from '@tanstack/react-db';
import {
  priceTypesCollection,
  productPricesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { saveProductPrices } from 'simplycms/admin-server';
import { isMoney, normalizeMoneyInput } from 'simplycms/domain/money';

export type PriceDraft = Record<string, { price: string; oldPrice: string }>;

/**
 * Ціни пари товар/модифікація. Читання — on-demand зріз (productId eq +
 * modificationId eq/isNull, обидва push-down — isNull у контракті з Е3);
 * запис — ОДИН атомарний saveProductPrices (Е3-10) і write-back рядків.
 */
export function usePrices(productId: string, modificationId: string | null) {
  const prices = useCollection(productPricesCollection);
  const types = useCollection(priceTypesCollection);
  const { data: priceTypes } = useLiveQuery((q) =>
    q.from({ t: types }).orderBy(({ t }) => t.sortOrder, 'asc'),
  );
  const { data: rows } = useLiveQuery(
    (q) =>
      q.from({ p: prices }).where(({ p }) =>
        and(
          eq(p.productId, productId),
          modificationId ? eq(p.modificationId, modificationId) : isNull(p.modificationId),
        ),
      ),
    [productId, modificationId],
  );

  /** null — валідно й збережено; рядок — id типу ціни з невалідним полем. */
  const save = async (draft: PriceDraft): Promise<string | null> => {
    const input = [];
    for (const [priceTypeId, v] of Object.entries(draft)) {
      const price = normalizeMoneyInput(v.price);
      if (price === '') continue; // порожнє = ціни цього типу немає (Review Focus 4)
      const oldPrice = normalizeMoneyInput(v.oldPrice);
      if (!isMoney(price) || (oldPrice !== '' && !isMoney(oldPrice))) return priceTypeId;
      input.push({ priceTypeId, price, oldPrice: oldPrice === '' ? null : oldPrice });
    }
    const res = await saveProductPrices({
      data: { productId, modificationId, prices: input },
    });
    prices.utils.writeBatch(() => {
      for (const id of res.removedIds) prices.utils.writeDelete(id);
      for (const row of res.rows) prices.utils.writeUpsert(row);
    });
    return null;
  };

  return { priceTypes, rows, save };
}
```

`PricesEditor.tsx` — розмітка легасі `ProductPricesEditor.tsx` (таблиця типів
цін, два інпути на тип: `#price-<priceTypeId>`, `#old-price-<priceTypeId>`,
`inputMode="decimal"`, `type="text"` — кома мусить вводитись), стан
`PriceDraft` ініціалізується з `rows`; кнопка «Зберегти ціни»
(`admin.products.prices.save`) кличе `save`; невалідне поле — червоний
бордер + `admin.products.prices.invalid` («Некоректна ціна» / «Invalid price»),
новий ключ.

- [ ] **Step 2: `useStock` (тест спершу)**

Тест: (а) `saveStock` отримує `quantities` по всіх активних точках
(кількість з інпутів, порожнє = 0); (б) після відповіді `{ rows, target }`
колекція залишків містить `rows`, а `target` записано у
`productsCollection` (для товару) або `productModificationsCollection` (для
модифікації) — видимий новий `stockStatus` без refetch; (в) відʼємне /
дробове число → помилка поля, serverFn не викликано.

```ts
// packages/simplycms/src/admin/features/products/stock/useStock.ts (ядро save)
  const save = async (quantities: Record<string, string>) => {
    const parsed = Object.entries(quantities).map(([pickupPointId, raw]) => ({
      pickupPointId,
      quantity: raw.trim() === '' ? 0 : Number(raw),
    }));
    if (parsed.some((q) => !Number.isInteger(q.quantity) || q.quantity < 0)) return false;
    const res = await saveStock({
      data: { productId: modificationId ? null : productId, modificationId, quantities: parsed },
    });
    stock.utils.writeBatch(() => {
      for (const row of res.rows) stock.utils.writeUpsert(row);
    });
    // Статус цілі змінився гвардом на сервері (Е3-3) — пишемо рядок цілі
    // туди, звідки його читає картка, інакше бейдж показав би старий статус.
    if (modificationId) mods.utils.writeUpsert(res.target as ProductModification);
    else products.utils.writeUpsert(res.target as Product);
    return true;
  };
```

Читання залишків — `where(and(eq(s.productId, productId), isNull(s.modificationId)))`
для товару / `where(eq(s.modificationId, modificationId))` для модифікації.
Точки видачі — `usePickupPoints()` / `usePickupPointsCount()` з
`simplycms/core/hooks/useStock` (як легасі; це публічний контур вітрини,
він живий на v2). `StockEditor.tsx` — розмітка легасі
`StockByPointManager.tsx` (одна точка → один інпут `#stock-quantity`;
кілька → таблиця з `#stock-quantity-<pickupPointId>`), `showCard` — як у
легасі.

- [ ] **Step 3: Модифікації**

`useModifications(productId)`:

```ts
  const { data: modifications } = useLiveQuery(
    (q) =>
      q
        .from({ m: mods })
        .where(({ m }) => eq(m.productId, productId))
        .orderBy(({ m }) => m.sortOrder, 'asc'),
    [productId],
  );

  const applyDefault = async (id: string) => {
    const { rows } = await setDefaultProductModification({ data: { id } });
    // Write-back УСІХ змінених (знятий і поставлений) — без refetch.
    mods.utils.writeBatch(() => {
      for (const row of rows) mods.utils.writeUpsert(row);
    });
  };

  const reorder = async (id: string, direction: 'up' | 'down') => {
    const { swapped } = await reorderProductModification({ data: { id, direction } });
    mods.utils.writeBatch(() => {
      for (const row of swapped) mods.utils.writeUpsert(row);
    });
  };

  const create = async (form: ModificationFormValues) => {
    const id = crypto.randomUUID();
    // 🔴 max+1 з УЖЕ завантаженого зрізу товару — нормалізує легасі-порядок
    // (там sort_order писався індексом масиву, звідси дублікати).
    const sortOrder = Math.max(-1, ...(modifications ?? []).map((m) => m.sortOrder ?? 0)) + 1;
    const now = new Date();
    const tx = mods.insert({
      id, productId, slug: form.slug, name: form.name, sku: form.sku || null,
      images: form.images, sortOrder, stockStatus: form.stockStatus,
      isDefault: false, createdAt: now, updatedAt: now,
    });
    await tx.isPersisted.promise;
    // Review Focus 5: дефолт — ОКРЕМОЮ операцією ПІСЛЯ insert (isDefault
    // readonly у ресурсі); його відмова — окремий тост, створення вже є.
    if (form.isDefault) await applyDefault(id);
    return id;
  };
```

Тест `useModifications`: (а) create з `isDefault: true` → спершу
`insertProductModifications` (рядок з `isDefault: false`), ПОТІМ
`setDefaultProductModification({ data: { id } })`; (б) write-back
`applyDefault` оновлює прапорець у ДВОХ рядках колекції; (в) sortOrder
нового = max+1 навіть коли наявні мають однакові `sortOrder`.

`ModificationsTable.tsx` — розмітка легасі `ProductModifications.tsx:530-661`
(↑/↓ → `reorder`, мініатюра `resolveMediaUrl`, назва + бейдж
«за замовч.», SKU, дефолтна ціна, бейдж статусу, видалення через
`AlertDialog` + `adminErrorKey` у catch — модифікація в замовленнях дає
`order_items_modification_id_fkey`). Дефолтна ціна рядка — з
`productPricesCollection` зрізом `eq(productId)` (одним запитом на всю
таблицю, не N) і дефолтного типу з `priceTypesCollection`.

`ModificationDialog.tsx` — `react-hook-form` + Zod (`name`, `slug` за
`SLUG_RE` з Task 7, `sku`, `stockStatus` через перенесений
`StockStatusSelect`, `isDefault`, `images` через `ImageUpload` з
`entityType="product_modification"`); id контролів: `#mod-name`, `#mod-slug`,
`#mod-sku`, `#mod-default`. Для РЕДАГУВАННЯ — `Collapsible`-и з
`PricesEditor`, `StockEditor` (`showCard={false}`) і `PropertyValuesPanel`
(Task 10; до нього секція не рендериться), як у легасі. Update —
`mods.update(id, (d) => { d.name = …; d.slug = …; d.sku = …; d.images = …; d.stockStatus = …; })`
+ за потреби `applyDefault`; конфлікт slug → `adminErrorKey`.

`SimpleProductPanel.tsx` — композиція як легасі `SimpleProductFields.tsx`
(`PricesEditor` з `modificationId={null}`, `StockStatusSelect`, `StockEditor`).

- [ ] **Step 4: Підключити панелі в `ProductEditPage`, видалити легасі**

```bash
git mv packages/simplycms/src/admin/components/StockStatusSelect.tsx packages/simplycms/src/admin/features/products/stock/StockStatusSelect.tsx
git rm packages/simplycms/src/admin/components/{ProductModifications,ProductPricesEditor,StockByPointManager,SimpleProductFields}.tsx
rg -n "components/(ProductModifications|ProductPricesEditor|StockByPointManager|SimpleProductFields|StockStatusSelect)" packages
```

Expected: `rg` порожній (єдиний споживач легасі був `ProductEdit`, звіт
інвентаризації); інакше — перевести знайденого споживача на нові шляхи.

- [ ] **Step 5: Гейт і коміт**

```bash
pnpm exec prettier --write packages/simplycms/src/admin packages/simplycms/src/i18n
pnpm lint && pnpm test && pnpm typecheck
git add -A packages/simplycms/src/admin packages/simplycms/src/i18n
git commit -m "feat(k3-e3): модифікації, ціни й залишки на колекціях — дефолт і порядок операціями, атомарний набір цін, статус за кількістю"
```

## Task 9: Схема multiselect — рядок на опцію (Е3-13, правка baseline)

**Files:**
- Modify: `packages/simplycms/migrations/0001_init.sql`
- Modify: `packages/simplycms/src/schema/schema.ts`
- Modify: `packages/simplycms/drizzle/0000_init.sql`, `packages/simplycms/drizzle/meta/0000_snapshot.json` (4 джерела правди — як Task 0 плану Е1б)
- Create: `packages/simplycms/test-harness/pg/__tests__/property-values-multiselect.test.ts`
- Modify: `packages/simplycms/src/storefront-routes/pages/product-detail/useProductContent.ts` + новий `merge-property-values.ts` поруч і тест
- Run: `pnpm template:sync` (міграції — `SYNCED_DIRS`) і коміт копій

**Interfaces:**
- Produces: обмеження `product_property_values_owner_property_option_key` = `UNIQUE NULLS NOT DISTINCT (product_id, property_id, option_id)`, `modification_property_values_owner_property_option_key` = `UNIQUE NULLS NOT DISTINCT (modification_id, property_id, option_id)`; `mergePropertyValues(productRows, modRows): ProductPropertyValueViewModel[]`

- [ ] **Step 1: Харнес-тест інваріанта (червоний)**

```ts
// шапка — як admin-catalog.test.ts (канон, app_runtime не потрібен: тест
// перевіряє DDL привілейованим підключенням dbUrl)
describe('multiselect: рядок на опцію (Е3-13)', () => {
  it('скалярна властивість — рівно один рядок (option_id NULL не дублюється)', async () => {
    await insertValue({ optionId: null, value: 'a' });
    await expect(insertValue({ optionId: null, value: 'b' })).rejects.toMatchObject({ code: '23505' });
  });
  it('multiselect — рядок на кожну опцію; та сама опція двічі — 23505', async () => {
    await insertValue({ property: MULTI, optionId: OPT_A });
    await insertValue({ property: MULTI, optionId: OPT_B });
    await expect(insertValue({ property: MULTI, optionId: OPT_A })).rejects.toMatchObject({ code: '23505' });
  });
  it('те саме для modification_property_values', async () => { /* дзеркально з modification_id */ });
});
```

(`insertValue` — `queryRows(dbUrl, 'insert into public.product_property_values (id, product_id, property_id, option_id, value) values ($1,$2,$3,$4,$5)', …)`;
фікстури розділу, властивості й двох опцій — привілейованим SQL у
`beforeAll`. `queryRows` кидає помилку `pg` з полем `code` — якщо обгортка
його ховає, матчити по `message` з назвою обмеження.)

Run: `pnpm test:schema -- packages/simplycms/test-harness/pg/__tests__/property-values-multiselect.test.ts`
Expected: FAIL (друга опція multiselect падає на старому ключі).

- [ ] **Step 2: Правка чотирьох джерел**

`0001_init.sql` і `drizzle/0000_init.sql` (рядки обмежень — за текстом
`CONSTRAINT "product_property_values_product_id_property_id_key"` і
`CONSTRAINT "modification_property_values_modification_id_property_id_key"`):

```sql
	CONSTRAINT "product_property_values_owner_property_option_key" UNIQUE NULLS NOT DISTINCT("product_id","property_id","option_id")
```

```sql
	CONSTRAINT "modification_property_values_owner_property_option_key" UNIQUE NULLS NOT DISTINCT("modification_id","property_id","option_id")
```

і SQL-коментар над кожним: «Е3-13: multiselect — рядок на опцію; NULLS NOT
DISTINCT тримає скалярну властивість в одному рядку (option_id NULL)».

`schema.ts`:

```ts
	unique("product_property_values_owner_property_option_key")
		.on(table.productId, table.propertyId, table.optionId)
		.nullsNotDistinct(),
```

(і дзеркально для `modificationPropertyValues`). `0000_snapshot.json` — у
`uniqueConstraints` обох таблиць: нове імʼя, `columns` з `option_id`,
`"nullsNotDistinct": true`. Перевірка чотирьох джерел —
`pnpm test:schema` (baseline-парність) і
`rg -n "property_id_key\"" packages/simplycms/{migrations,drizzle,src/schema}` → порожньо.

🔴 `NULLS NOT DISTINCT` — Postgres 15+. Гейт перевіряє `[16, 17]`
(борг К1а-1) — підтримка є в обох.

- [ ] **Step 3: Вітрина — злиття рядків однієї властивості (тест спершу)**

```ts
// packages/simplycms/src/storefront-routes/pages/product-detail/__tests__/merge-property-values.test.ts
import { describe, expect, it } from 'vitest';
import { mergePropertyValues } from '../merge-property-values';

const row = (property_id: string, value: string, option_id: string | null = null) => ({
  property_id, value, numeric_value: null, option_id,
  option: option_id ? { id: option_id, slug: option_id } : null,
  property: { id: property_id, name: property_id, slug: property_id, property_type: 'multiselect', has_page: false },
});

describe('mergePropertyValues', () => {
  it('рядки однієї властивості зливаються: value через кому, option — перша', () => {
    const out = mergePropertyValues([row('color', 'Чорний', 'o1'), row('color', 'Білий', 'o2')], []);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ value: 'Чорний, Білий', option_id: null });
  });
  it('модифікація ПЕРЕКРИВАЄ властивість товару цілком (правило легасі)', () => {
    const out = mergePropertyValues([row('color', 'Чорний', 'o1')], [row('color', 'Білий', 'o2')]);
    expect(out).toEqual([expect.objectContaining({ value: 'Білий' })]);
  });
  it('кілька опцій із has_page: option обнулено — посилання на одну опцію не рендериться', () => {
    const withPage = (id: string, v: string) => ({ ...row('color', v, id), property: { ...row('color', v, id).property, has_page: true } });
    const [merged] = mergePropertyValues([withPage('o1', 'Чорний'), withPage('o2', 'Білий')], []);
    expect(merged).toMatchObject({ value: 'Чорний, Білий', option: null, option_id: null });
  });
  it('скалярні властивості — без змін', () => {
    expect(mergePropertyValues([row('power', '100')], [])[0]).toMatchObject({ value: '100' });
  });
});
```

```ts
// packages/simplycms/src/storefront-routes/pages/product-detail/merge-property-values.ts
import type { ProductPropertyValueViewModel } from 'simplycms/contracts/views';

const byProperty = (rows: readonly ProductPropertyValueViewModel[]) => {
  const map = new Map<string, ProductPropertyValueViewModel[]>();
  for (const r of rows) map.set(r.property_id, [...(map.get(r.property_id) ?? []), r]);
  return map;
};

/**
 * Характеристики картки: рядок на опцію (Е3-13) зводиться в ОДИН запис
 * view-моделі на властивість — контракт тем v3 (один елемент на
 * властивість) не змінюється. Модифікація перекриває властивість товару
 * цілком — те саме правило, що в легасі Map.set.
 */
export function mergePropertyValues(
  productRows: readonly ProductPropertyValueViewModel[],
  modRows: readonly ProductPropertyValueViewModel[],
): ProductPropertyValueViewModel[] {
  const merged = new Map(byProperty(productRows));
  for (const [id, rows] of byProperty(modRows)) merged.set(id, rows);
  return [...merged.values()].map((rows) =>
    rows.length === 1
      ? rows[0]!
      : {
          ...rows[0]!,
          value: rows.map((r) => r.value).filter(Boolean).join(', '),
          // 🔴 Кілька опцій — жодна не «головна»: ProductCharacteristics
          // малює <Link> на сторінку ОДНІЄЇ опції, коли has_page && option —
          // текст «Чорний, Білий» вів би лише на «Чорний» (аудит 2026-09-23).
          option: null,
          option_id: null,
        },
  );
}
```

У `useProductContent.ts` замінити блок `propMap` на
`return mergePropertyValues(productProps, modProps);`.

🔴 Фільтри каталогу (`catalog-filters.ts`, `catalog-products.ts`) рядки
читають списком — рядок на опцію для них природна форма (товар потрапляє
під фільтр КОЖНОЇ своєї опції). Перевірити харнесом вітрини
(`pnpm test:schema` — її лоадери мають власні тести) і нічого не міняти,
якщо зелене.

- [ ] **Step 4: Синк шаблону, гейт, коміт**

```bash
pnpm template:sync
pnpm exec prettier --write packages/simplycms/src packages/simplycms/test-harness
pnpm lint && pnpm test && pnpm test:schema
git add -A packages/simplycms packages/create-simplycms-store packages/cli
git commit -m "feat(k3-e3): multiselect — рядок на опцію (правка baseline, NULLS NOT DISTINCT), злиття на картці вітрини"
```

## Task 10: Значення властивостей

**Files:**
- Create: `packages/simplycms/src/admin/features/products/properties/{PropertyValuesPanel,PropertyInput,usePropertySchema,usePropertyValues}.tsx|ts`
- Create: `__tests__/usePropertyValues.test.tsx`
- Delete: `packages/simplycms/src/admin/components/{ProductPropertyValues,AllProductProperties}.tsx`
- Modify: `ProductEditPage.tsx`, `ModificationDialog.tsx` (підключення панелі)

**Interfaces:**
- Consumes: `sectionPropertyAssignmentsCollection`, `sectionPropertiesCollection`, `propertyOptionsCollection`, `productPropertyValuesCollection`, `modificationPropertyValuesCollection`; схема Task 9
- Produces: `PropertyValuesPanel({ target: 'product' | 'modification', ownerId: string, sectionId: string, appliesTo: 'product' | 'modification' | 'all' })`

Семантика — один компонент замість двох легасі:
- легасі `AllProductProperties` (простий товар) = `target='product', appliesTo='all'` (усі призначення, запис у `product_property_values`);
- легасі `ProductPropertyValues` для товару з модифікаціями = `target='product', appliesTo='product'`;
- для модифікації = `target='modification', appliesTo='modification'`.

- [ ] **Step 1: `usePropertySchema` — два запити, без join on-demand × on-demand**

```ts
  const { data: assignments } = useLiveQuery(
    (q) => {
      const base = q.from({ a: assignmentsCol }).where(({ a }) => eq(a.sectionId, sectionId));
      return (appliesTo === 'all' ? base : base.where(({ a }) => eq(a.appliesTo, appliesTo)))
        .orderBy(({ a }) => a.sortOrder, 'asc');
    },
    [sectionId, appliesTo],
  );
  const propertyIds = (assignments ?? []).map((a) => a.propertyId);
  const { data: properties } = useLiveQuery(
    (q) => q.from({ p: propertiesCol }).where(({ p }) => inArray(p.id, propertyIds)),
    [propertyIds.join(',')],
  );
  const choiceIds = (properties ?? [])
    .filter((p) => p.propertyType === 'select' || p.propertyType === 'multiselect')
    .map((p) => p.id);
  const { data: options } = useLiveQuery(
    (q) =>
      q
        .from({ o: optionsCol })
        .where(({ o }) => inArray(o.propertyId, choiceIds))
        .orderBy(({ o }) => o.sortOrder, 'asc'),
    [choiceIds.join(',')],
  );
```

🔴 `inArray` з ПОРОЖНІМ масивом серверна схема відбиває (`in` вимагає
непорожній масив — `subset.ts` superRefine). Коли `propertyIds`/`choiceIds`
порожні — запит не будувати: повернути `undefined` з query-функції, якщо
бібліотека це підтримує (перевірити `useLiveQuery` src: «disabled query»),
інакше винести другий/третій запит у дочірній компонент, що рендериться
лише при непорожньому списку. Тест на обидва стани обовʼязковий.

Результат хука — масив `{ assignment, property, options }` у порядку
призначень; властивість `appliesTo='modification'` при `target='product'`
(простий товар) показується з бейджем `admin.properties.appliesTo.modification`,
як у легасі.

- [ ] **Step 2: `usePropertyValues` — автозбереження (Е3-11) з рядком на опцію (Е3-13)**

```ts
  // Скалярні типи (text/number/range/boolean/color/select): рівно один рядок.
  const saveScalar = (propertyId: string, v: { value: string | null; numericValue: string | null; optionId: string | null }) => {
    const existing = rowsOf(propertyId)[0];
    const empty = v.value === null || v.value === '';
    if (existing && empty) return col.delete(existing.id);
    if (existing)
      return col.update(existing.id, (d) => {
        d.value = v.value;
        d.numericValue = v.numericValue;
        d.optionId = v.optionId;
      });
    if (!empty) return col.insert(draft(propertyId, v));
  };

  // Multiselect: бажаний набір опцій → вставити відсутні, видалити зайві.
  const saveMulti = (propertyId: string, optionIds: string[], nameOf: (id: string) => string) => {
    const current = rowsOf(propertyId);
    const have = new Set(current.map((r) => r.optionId));
    const toDelete = current.filter((r) => !r.optionId || !optionIds.includes(r.optionId));
    const toInsert = optionIds.filter((id) => !have.has(id));
    if (toDelete.length > 0) col.delete(toDelete.map((r) => r.id));
    if (toInsert.length > 0)
      col.insert(toInsert.map((optionId) => draft(propertyId, { value: nameOf(optionId), numericValue: null, optionId })));
  };
```

`draft()` — повний рядок з `id: crypto.randomUUID()`, власником
(`productId` або `modificationId` за `target`), `createdAt: new Date()`.
`col` — `productPropertyValuesCollection` або
`modificationPropertyValuesCollection` за `target`; `rowsOf(propertyId)` —
з `useLiveQuery` зрізу власника (`eq(v.productId, ownerId)` /
`eq(v.modificationId, ownerId)`). Числові типи: `numericValue` — рядок
(`numeric` у Drizzle — рядок), `String(Number(raw))` лише для скінченних
чисел, інакше поле не зберігається й підсвічується. Помилки транзакцій —
`tx.isPersisted.promise.catch` → `adminErrorKey` / загальний тост
(оптимістичний стан відкочується сам).

Тест `usePropertyValues`: (а) multiselect `[A] → [A, B]` → одна вставка
рядка з `optionId: B`, жодного видалення; (б) `[A, B] → [B]` → видалення
рядка A; (в) скаляр: порожнє значення при наявному рядку → delete;
(г) перше значення скаляра → insert з клієнтським uuid.

- [ ] **Step 3: Компоненти, підключення, видалення легасі**

`PropertyInput.tsx` — перемикач по `propertyType` з легасі
`ProductPropertyValues.tsx:323-449` (text/number/range/select/multiselect/
boolean/color), id контролу `#prop-<propertyId>`. `PropertyValuesPanel.tsx`
— картка з заголовком (ключі легасі `admin.properties.*`), стани «розділ не
вибрано» / «властивостей не налаштовано» — як у легасі.
Підключити в `ProductEditPage` (два варіанти з Task 7 Step 3) і в
`ModificationDialog` (`target='modification'`, `appliesTo='modification'`,
`ownerId={editing.id}`).

```bash
git rm packages/simplycms/src/admin/components/{ProductPropertyValues,AllProductProperties}.tsx
rg -n "components/(ProductPropertyValues|AllProductProperties)" packages   # порожньо
```

- [ ] **Step 4: Гейт і коміт**

```bash
pnpm exec prettier --write packages/simplycms/src/admin
pnpm lint && pnpm test && pnpm typecheck
git add -A packages/simplycms/src/admin
git commit -m "feat(k3-e3): значення властивостей на колекціях — автозбереження, multiselect рядком на опцію"
```

---

# Частина 4 — борги, гейти, живий прогін (Tasks 11–13)

## Task 11: Борги ключів Е1а №6 і №8 (Е3-12)

**Files:**
- Modify: `packages/simplycms/src/contracts/entities.ts` + його тест
- Modify: `packages/simplycms/src/storefront-routes/pages/catalog/useCatalogQueries.ts`, `packages/simplycms/src/storefront-routes/pages/Profile.tsx` (кваліфікатори не-FK)
- Modify: `eslint.config.mjs` (зона `query-key-from-entity`)
- Modify: `packages/simplycms-theme-solarstore/src/components/Header.tsx` (+ будь-які офендери, які покаже лінт у темі/плагіні)

**Interfaces:**
- Consumes: `entityKey(e).variant(qualifier: string, id?: string)` — створено в Task 5 Step 0 (Е3-15)

- [ ] **Step 1: Мігрувати не-FK кваліфікатори на `variant()` (сам `variant()` уже додав Task 5 Step 0)**

Тест нижче — уже в Task 5 Step 0; тут лише перевірити, що він є, і мігрувати
вживання. Форма `variant` — з Task 5 Step 0 (id опційний), не з сніпета нижче.

```ts
it('variant не перетинається з FK-зрізом тієї самої назви (борг Е1а №6)', () => {
  const k = entityKey(ENTITY.sectionProperties);
  expect(k.variant('numeric', 's1')).toEqual(['section_properties', 'variant', 'numeric', 's1']);
  expect(k.variant('numeric', 's1')).not.toEqual(k.scoped('numeric', 's1'));
  // Префікс сутності зберігається — інвалідація all() дістає і варіант.
  expect(k.variant('numeric', 's1').slice(0, 1)).toEqual(k.all());
});
```

```ts
    /** Зріз за FK: relation — назва звʼязку-батька ('section', 'product',
     *  'customer'). Для НЕ-FK кваліфікаторів — variant(). */
    scoped: (relation: string, parentId: string) => [entity, relation, parentId] as const,
    /** Варіант форми того самого зрізу (напр. лише числові властивості):
     *  окремий сегмент 'variant', щоб не зіткнутися з FK-relation тієї самої
     *  назви (борг Е1а №6). */
    variant: (qualifier: string, id: string) => [entity, 'variant', qualifier, id] as const,
```

Мігрувати два не-FK вживання (`rg -n "scoped\('(numeric|overview)'" packages/simplycms/src`):
`sectionProperties.scoped('numeric', …)` → `.variant('numeric', …)`,
`profiles.scoped('overview', …)` → `.variant('overview', …)`. Інвалідації цих
ключів (`rg -n "'numeric'|'overview'" packages/simplycms/src`) — оновити
в тому ж коміті.

- [ ] **Step 2: Зона правила ключів на тему й плагін (№8)**

У блок `query-key-from-entity` в `eslint.config.mjs` додати
`packages/simplycms-theme-solarstore/src/**/*.{ts,tsx}` і
`packages/simplycms-plugin-faq/src/**/*.{ts,tsx}`.

Run: `pnpm lint` → очікувано ЧЕРВОНИЙ на `Header.tsx` (`['sections-nav']`) —
це негативний контроль розширення. Виправити: тема не бачить `ENTITY`
напряму? — перевірити, чи `simplycms/contracts/entities` дозволений темі
(межа довіри тем — `docs/architecture/themes.md`); якщо так —
`queryKey: [...entityKey(ENTITY.sections).list(), 'root']` (той самий ключ,
яким ядро кешує `getRootSections()` — `rg -n "getRootSections" packages/simplycms/src`
показує його; дві копії ключа одного запиту в одному `QueryClient` — і є
дефект №8). Якщо тема не має права на `contracts` — зупинитись і принести
розвилку (послабити межу теми — рішення власника).

Плагін: `pnpm lint` покаже, чи є офендери; кожен — на `entityKey`
(таблиця плагіна `plg_faq_items` не в `ENTITY` → ключ з префіксом
`plugin.<name>` через наявний порт `usePluginTable`, якщо він сам формує
ключ; якщо офендерів немає — зона просто фіксує стан).

- [ ] **Step 3: Борг №4 — задокументувати, не кодувати**

У `docs/tasks/platform-roadmap.md` у пункті Е3: «№4 (`detail()` slug vs
uuid) — адмінка `detail()` не вживає (колекції ключуються `list()` +
demand-суфікс бібліотеки), тож на Е3 не проявився; борг належить К2
(вітрина ключує картку за slug)». Коміт разом із Task 13-доками або тут.

- [ ] **Step 4: Гейт і коміт**

```bash
pnpm exec prettier --write packages eslint.config.mjs
pnpm lint && pnpm test
git add -A packages eslint.config.mjs
git commit -m "fix(k3-e3): борги ключів Е1а — variant() для не-FK кваліфікаторів, зона правила ключів на тему й плагін"
```

## Task 12: Гейти етапу — повнота ратчету, ратчет id, Gate C

**Files:**
- Modify: `eslint.config.mjs` (зона `mutation-cache-sync` += `packages/simplycms/src/admin/features/**/*.{ts,tsx}`; експорт `MUTATION_CACHE_SYNC_RATCHET`)
- Create: `tests/mutation-cache-sync-coverage.test.ts`
- Modify: `tests/admin-inserts-need-id.test.ts` (`KNOWN_WITHOUT_ID`)
- Modify: `docs/architecture/test-contours.md`

- [ ] **Step 1: Зона правила на фічі**

Додати `packages/simplycms/src/admin/features/**/*.{ts,tsx}` у `files`
блоку `simplycms-cache-sync` поруч із `MUTATION_CACHE_SYNC_RATCHET`
(коментар: «фічі адмінки — у зоні за побудовою, окремий список лише для
файлів поза `features/`»). `export const MUTATION_CACHE_SYNC_RATCHET` —
щоб тест читав той самий список.

Run: `pnpm lint` → має бути ЗЕЛЕНИМ одразу: Tasks 6–10 писали синк кешу в
тій самій функції (write-back після кожного serverFn запису; `collection.*`
для оптимістичних шляхів). Червоне = місце, де синк забуто, — виправити
КОД (додати write-back), не виключати файл.

- [ ] **Step 2: Негативний контроль зони**

Тимчасово в `usePrices.ts` прибрати блок `prices.utils.writeBatch(...)` →
`pnpm lint` мусить червоніти `simplycms-cache-sync/…` саме на `save`.
Повернути. Зафіксувати вивід у DoD-звіті.

- [ ] **Step 3: Гейт повноти (має бути ЗЕЛЕНИМ одразу)**

```ts
// tests/mutation-cache-sync-coverage.test.ts
/**
 * Повнота ратчету mutation-cache-sync (борг Е3 з test-contours §…): кожен
 * файл src/admin/**, що імпортує serverFn чи колекції, мусить бути в зоні
 * правила — або під admin/features/** (за побудовою), або в
 * MUTATION_CACHE_SYNC_RATCHET, або в EXEMPT з причиною. Інакше сторінка,
 * переписана хвилею Е4–Е6 поза features/, мовчки лишилась би без гейта.
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { globSync } from 'tinyglobby';
import { describe, expect, it } from 'vitest';
import { MUTATION_CACHE_SYNC_RATCHET } from '../eslint.config.mjs';

const ROOT = 'packages/simplycms/src/admin';
const EXEMPT: Readonly<Record<string, string>> = {
  'packages/simplycms/src/admin/components/ImageUpload.tsx':
    'сховище файлів, не сутність кешу: результат — референс у стан форми власника',
};

const users = globSync(`${ROOT}/**/*.{ts,tsx}`, { ignore: ['**/__tests__/**'] }).filter((f) =>
  /from 'simplycms\/admin-(data|server)'/.test(readFileSync(f, 'utf8')),
);

describe('повнота зони mutation-cache-sync', () => {
  it('кожен споживач серверного шару — у зоні правила', () => {
    const outside = users.filter(
      (f) =>
        !f.startsWith(`${ROOT}/features/`) &&
        !MUTATION_CACHE_SYNC_RATCHET.includes(f) &&
        !(f in EXEMPT),
    );
    expect(outside).toEqual([]);
  });
  it('ратчет і виїмки без мертвих записів', () => {
    for (const f of [...MUTATION_CACHE_SYNC_RATCHET, ...Object.keys(EXEMPT)])
      expect(users.map((u) => relative('.', u))).toContain(f);
  });
});
```

(`tinyglobby` — перевірити, що вже в devDependencies: `rg -n tinyglobby package.json`;
якщо ні — взяти glob-хелпер, яким користуються сусідні тести
(`tests/storage-direct-calls.test.ts`), нову залежність не додавати.
Якщо імпорт `eslint.config.mjs` у vitest тягне плагіни з побічними
ефектами — винести список у `eslint.cache-sync-ratchet.mjs` і імпортувати
його і з конфігу, і з тесту.)

Негативний контроль: тимчасово додати в `admin/pages/Dashboard.tsx` рядок
`import { listProducts } from 'simplycms/admin-server';` → тест червоний з
цим файлом у `outside`. Повернути.

- [ ] **Step 4: Ратчет id**

Run: `pnpm test -- tests/admin-inserts-need-id.test.ts` — після видалення
легасі-файлів фактичне число вставок без `id` впало (Products/ProductEdit
create, ProductModifications, ProductPricesEditor, ProductPropertyValues,
AllProductProperties, StockByPointManager). Зменшити `KNOWN_WITHOUT_ID` до
ФАКТИЧНОГО числа, яке тест друкує (не вгадувати), з коментарем «Е3: −N
(каталог)».

- [ ] **Step 5: Gate C і пакування**

```bash
pnpm build:packages && pnpm typecheck:template && pnpm test:packaging
pnpm pilot:pack --skip-build
```

Expected: зелені. Gate C нового не потребує (`admin-server/impl` і
`inventory` під `SERVER_ONLY` — Gate C деривує `SERVER_PAYLOAD` з
декларації); `drizzle-orm`/`pg` у клієнтських чанках — 0.

- [ ] **Step 6: `test-contours.md`**

У §12 (таблиця гейтів К3) — рядок про `tests/mutation-cache-sync-coverage.test.ts`
(що ловить, крок `pnpm test`, межа: бачить лише статичний
`from 'simplycms/admin-(data|server)'`); у рядку `mutation-cache-sync`
прибрати «ратчет ручний — повноту ніщо не перевіряє (борг Е3)»; читачі
межі server-only — `inventory` у переліку (Task 2).

- [ ] **Step 7: Коміт**

```bash
pnpm exec prettier --write eslint.config.mjs tests
pnpm lint && pnpm test
git add -A eslint.config.mjs eslint.*.mjs tests docs/architecture/test-contours.md
git commit -m "test(k3-e3): повнота зони mutation-cache-sync, фічі адмінки в зоні за побудовою, ратчет id −каталог"
```

## Task 13: Живий прогін — власник створює товар, покупець його бачить; DoD і доки

**Files:**
- Create: `scripts/live-smoke/owner-invite.mts`
- Create: `scripts/live-smoke/admin-catalog.mjs`
- Modify: `scripts/live-smoke.mjs` (передати `browser` і env магазину в крок)
- Modify: `scripts/live-smoke/sql.mjs` (запити кроку)
- Modify: `docs/tasks/platform-roadmap.md`, `docs/tasks/v2-state-map.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `issueOwnerInvite`, `ownerInviteStore` (`packages/simplycms/src/auth/index.ts`); id контролів з Tasks 7–8; демо-сід (`pnpm db:demo`: розділ `sonyachni-paneli`, СИСТЕМНА точка видачі, тип ціни `retail`)
- Produces: `runAdminCatalogStep({ browser, base, dbUrl, storeEnv, check })`

- [ ] **Step 1: Випуск запрошення поза магазином**

```ts
// scripts/live-smoke/owner-invite.mts
/**
 * Випуск запрошення власника для живого прогону (Е3-4). .mts, бо tsx поза
 * пакетом бере CJS і падає на top-level await (v2-state-map §5). Лист —
 * заглушка: доставку SMTP контур не доводить (борг №1), URL — з результату.
 * Env — ТОЙ САМИЙ, яким стартує магазин (DATABASE_URL під app_runtime).
 */
const [email, siteUrl] = process.argv.slice(2);
if (!email || !siteUrl) throw new Error('usage: owner-invite.mts <email> <siteUrl>');
const auth = await import('../../packages/simplycms/src/auth/index.ts');
const result = await auth.issueOwnerInvite({
  email,
  store: auth.ownerInviteStore,
  siteUrl,
  sendEmail: async () => {},
});
await (await import('../../packages/simplycms/src/db/index.ts')).closeDbPool?.();
process.stdout.write(JSON.stringify({ url: result.url }));
```

(Імена `closeDbPool`/шлях `db/index.ts` — звірити `rg -n "export.*closeDbPool" packages/simplycms/src/db`;
без закриття пулу процес не завершиться.)

- [ ] **Step 2: Крок адміна**

```js
// scripts/live-smoke/admin-catalog.mjs
/**
 * Крок К3-Е3 — ЄДИНИЙ живий доказ каталогу адмінки: запрошення власника →
 * пароль → вхід → товар створено в адмінці (з ціною через кому, залишком і
 * зображенням) → він на вітрині з цією ціною, бейджем і картинкою → дубль
 * slug дає зрозумілий тост → видалення прибирає його з вітрини.
 * Окремий browser context: сесія покупця воронки не змішується з адмінською.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { sql } from './sql.mjs';
import { PNG } from './avatar.mjs';

const PASSWORD = 'live-smoke-owner-2026';

export async function runAdminCatalogStep({ browser, base, dbUrl, storeEnv, check }) {
  const email = `owner-${randomUUID().slice(0, 8)}@example.test`;
  const { url } = JSON.parse(
    execFileSync('pnpm', ['exec', 'tsx', join(import.meta.dirname, 'owner-invite.mts'), email, base], {
      env: { ...process.env, ...storeEnv },
      encoding: 'utf8',
    }),
  );
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    // 1. Запрошення → пароль → /admin.
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Повторіть пароль').fill(PASSWORD);
    await page.getByRole('button', { name: 'Зберегти і продовжити' }).click();
    await page.waitForURL(`${base}/admin`, { timeout: 15_000 });
    check('адмін: запрошення → пароль → /admin', true, email);

    // 2. Новий товар у демо-розділі.
    const [section] = await sql(dbUrl, `select id, slug, name from public.sections where slug = 'sonyachni-paneli'`);
    const slug = `live-e3-${randomUUID().slice(0, 6)}`;
    await page.goto(`${base}/admin/products/new`, { waitUntil: 'networkidle' });
    await page.locator('#product-name').fill('Живий товар Е3');
    await page.locator('#product-slug').fill(slug);
    await page.locator('#product-section').click();
    await page.getByRole('option', { name: section.name }).click();
    await page.getByRole('button', { name: 'Створити' }).click();
    await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    const productId = page.url().split('/').pop();
    const [row] = await sql(dbUrl, `select id, is_active from public.products where slug = $1`, [slug]);
    check('адмін: товар у БД з клієнтським id', row?.id === productId, `${row?.id} vs ${productId}`);

    // 3. Зображення (DoD К3 п.6), ціна з комою, залишок.
    await page.setInputFiles('[data-testid="product-images"] input[type="file"]', {
      name: 'product.png', mimeType: 'image/png', buffer: PNG,
    });
    await page.locator('[data-testid="product-images"] img[src^="/media/"]').first().waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Зберегти' }).first().click();
    const [retail] = await sql(dbUrl, `select id from public.price_types where code = 'retail'`);
    await page.locator(`#price-${retail.id}`).fill('1234,50');
    await page.getByRole('button', { name: /Зберегти ціни/ }).click();
    await page.locator('#stock-quantity').fill('3');
    await page.getByRole('button', { name: /Зберегти залишки|Зберегти/ }).last().click();
    const [price] = await sql(dbUrl, `select price from public.product_prices where product_id = $1`, [productId]);
    check('адмін: ціна з комою збережена як 1234.50', price?.price === '1234.50', String(price?.price));
    const [stock] = await sql(
      dbUrl,
      `select s.quantity, p.stock_status, p.images from public.stock_by_pickup_point s
       join public.products p on p.id = s.product_id where s.product_id = $1`,
      [productId],
    );
    check('адмін: залишок 3, статус in_stock', stock?.quantity === 3 && stock?.stock_status === 'in_stock', JSON.stringify(stock));
    check('адмін: у images референс, не URL', Array.isArray(stock?.images) && stock.images.length === 1 && !String(stock.images[0]).startsWith('/'), JSON.stringify(stock?.images));

    // 4. Вітрина бачить.
    const res = await page.goto(`${base}/catalog/${section.slug}/${slug}`, { waitUntil: 'networkidle' });
    const text = (await page.locator('main').textContent()) ?? '';
    check('вітрина: картка 200 з назвою', res?.status() === 200 && text.includes('Живий товар Е3'), String(res?.status()));
    check('вітрина: ціна 1234,50', /1\s?234[,.]50/.test(text.replace(/ /g, ' ')), text.match(/1\s?234[^ ]*/)?.[0] ?? '—');
    check('вітрина: бейдж «В наявності: 3 шт»', text.includes('В наявності: 3 шт'), '');
    const img = await page.locator('main img[src^="/media/"]').first().getAttribute('src');
    check('вітрина: зображення з /media', Boolean(img) && (await page.request.get(`${base}${img}`)).status() === 200, img ?? '—');

    // 5. Review Focus 1 наживо: дубль slug — зрозумілий тост, не SQL.
    await page.goto(`${base}/admin/products/new`, { waitUntil: 'networkidle' });
    await page.locator('#product-name').fill('Дубль');
    await page.locator('#product-slug').fill(slug);
    await page.locator('#product-section').click();
    await page.getByRole('option', { name: section.name }).click();
    await page.getByRole('button', { name: 'Створити' }).click();
    const toast = page.getByText('Такий URL (slug) уже зайнятий');
    check('адмін: дубль slug → тост i18n', await toast.isVisible({ timeout: 10_000 }).catch(() => false), '');

    // 6. Видалення прибирає з вітрини.
    await page.goto(`${base}/admin/products`, { waitUntil: 'networkidle' });
    await page.getByRole('row', { name: /Живий товар Е3/ }).getByRole('button').last().click();
    await page.getByRole('alertdialog').getByRole('button', { name: /Видалити/ }).click();
    // Детерміновано: рядок зник із таблиці = оптимістичне видалення
    // підтверджене сервером (rollback повернув би його назад).
    await page.getByRole('row', { name: /Живий товар Е3/ }).waitFor({ state: 'detached', timeout: 10_000 });
    const gone = await page.goto(`${base}/catalog/${section.slug}/${slug}`);
    const [left] = await sql(dbUrl, `select count(*)::int as n from public.products where slug = $1`, [slug]);
    check('адмін: видалення → вітрина 404, рядка немає', gone?.status() === 404 && left?.n === 0, `${gone?.status()} / ${left?.n}`);
  } finally {
    await context.close();
  }
}
```

🔴 Тексти кнопок/лейблів у кроці — це УКРАЇНСЬКІ значення i18n-ключів,
вжитих у Tasks 6–8 (`common.create`, `common.save`,
`admin.products.prices.save`, `admin.products.stock.save`,
`admin.errors.slugTaken`, `common.delete`). Звірити кожен з
`packages/simplycms/src/i18n/catalogs/uk/**` перед першим прогоном;
розбіжність — правка селектора кроку, не каталогу. `PNG` —
експортувати з `avatar.mjs` (зараз `const` модуля). Якщо неіснуючий товар
на вітрині віддає не 404, а 200 зі сторінкою «не знайдено» — порівнювати з
поведінкою, яку вже фіксує гейт вітрини, і записати фактичну.

- [ ] **Step 3: Підключити в оркестрацію**

У `scripts/live-smoke.mjs`: після `runFunnel(...)` —
`await runAdminCatalogStep({ browser, base, dbUrl, storeEnv: env, check })`,
де `env` — той самий обʼєкт, яким викликано `startStore(ROOT, port, env)`.
Коментар шапки файла — додати крок К3-Е3 у перелік.

- [ ] **Step 4: Живий прогін**

```bash
PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55434/postgres pnpm live:smoke
```

Expected: `live-smoke: ЗЕЛЕНИЙ`, нові рядки `адмін: …` / `вітрина: …` — усі
OK, `pageerror за весь прогін` — 0. Вивід цілком — у DoD-звіт і в
`v2-state-map.md` новим підрозділом §2.4 (форма — як §2.3).

- [ ] **Step 5: Ручний браузерний прогін того, чого смок не бачить**

На тому ж стенді (`pnpm build && pnpm start` проти демо-БД, адмін із
запрошення): (1) список — фільтр «Неактивні» порожній, «Показати ще» не
зʼявляється на 8 товарах; (2) товар із модифікаціями — створити дві, зробити
другу дефолтною (перша втрачає бейдж без перезавантаження), переставити ↑↓;
(3) ціни модифікації; (4) властивість multiselect (демо-сід має
властивості розділу — якщо multiselect немає, створити SQL-ом опції для
наявної властивості типу `multiselect` або змінити тип) — обрати дві
опції, перевірити на картці вітрини «А, Б»; (5) зупинити сервер і змінити
назву товару — оптимістична зміна відкочується з тостом. Результати — у
DoD-звіт списком «пункт — факт».

- [ ] **Step 6: Документація DoD**

- `docs/tasks/platform-roadmap.md` — Е3 `[x]` з підсумком (формат Е2),
  залишок файлів `src/admin/**` на `supabase-js` — ПЕРЕРАХУВАТИ
  (`rg -l "useSupabaseClient" packages/simplycms/src/admin | wc -l`), борг
  №4 — як у Task 11 Step 3 (ще раз звірити, що запис є); «Поточний стан» — дата й версія з
  `packages/simplycms/package.json`; рядок «Адмінка» таблиці «Що працює» —
  живі сторінки.
- `docs/tasks/v2-state-map.md` — §1 і §3.1 (живі сторінки каталогу), §2.4
  (прогін), §3.2 (зображення товару ЖИВЕ — DoD К3 п.6 закрито), §6 (порядок
  робіт: Е4 наступний; прибрати застаріле «Storage-порт К4 оживляє аватар»).
- `CLAUDE.md` — дерево `src/` (+ `inventory/`, `admin/features/`), перелік
  `SERVER_ONLY` читачів не змінюється за кількістю (сім), лічильник lint
  warnings (виміряти), рядок про адмінку («жива одна сторінка» → живі
  сторінки каталогу).

- [ ] **Step 7: Повний ланцюг гейтів і коміт**

```bash
pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm build && pnpm typecheck \
  && pnpm test && pnpm test:schema && pnpm build:packages && pnpm typecheck:template \
  && pnpm test:packaging && pnpm pilot:pack --skip-build
git add -A scripts docs CLAUDE.md
git commit -m "test(k3-e3): живий прогін каталогу адмінки — запрошення власника, товар із ціною, залишком і зображенням на вітрині"
```

---

## DoD етапу Е3

1. **Живий прогін** `pnpm live:smoke` зелений з кроком К3-Е3 (Task 13 Step 4): запрошення → вхід → товар створено → ціна з комою → залишок зі статусом → зображення (DoD К3 п.6) → вітрина показує → дубль slug зрозумілий → видалення прибирає з вітрини.
2. **Ручний прогін** Task 13 Step 5 — п'ять пунктів із фактами.
3. **`test:schema`**: ресурси каталогу (фільтри, стабільна пагінація, конфлікти), іменовані операції (дефолт, порядок, ціни, залишки з гвардом), multiselect-інваріант.
4. **Контракт on-demand** (Task 0) зелений — пʼять фактів бібліотеки закріплені тестом.
5. **Гейти з негативними контролями:** тір-зона `inventory` (Task 2), зона `mutation-cache-sync` на фічах (Task 12 Step 2), повнота ратчету (Task 12 Step 3), зона ключів на тему (Task 11 Step 2).
6. **Повний ланцюг гейтів** + `pilot:pack` зелені; `pnpm lint` = 0 errors, warnings ≤ 10.
7. **Нуль `useSupabaseClient`** у файлах скоупу Е3-1 (`rg -n useSupabaseClient packages/simplycms/src/admin/features` порожньо; легасі-файли видалені).
8. **Доки** оновлені (Task 13 Step 6).

## Відомо, не виправлено (свідомо, записано в хвилі B)

- `saveProductPrices` не перевіряє, що `modificationId` належить `productId` (впевненість 60).
- Дубль `pickupPointId` у вході `saveStock` → 409 (унікальний індекс) замість 400 зі схеми (50).
- Теоретичний дедлок `setDefault` ↔ `reorder` модифікацій одного товару (55).
- `scopeOf` у `stock/save.ts` дублює приватний `targetScope` з `inventory/locked-stock.ts` (architecture, 60).

## Точка передачі

Повернутись на валідацію з артефактами: вивід повного ланцюга; вивід
`live:smoke`; факти ручного прогону; виводи всіх негативних контролів;
`git log --oneline` етапу. Наступний план — **Е4: довідники каталогу**
(розділи, типи цін, властивості й опції — дописують запис у колекції
`sections`/`price_types`/схеми властивостей, заведені тут лише на читання).
