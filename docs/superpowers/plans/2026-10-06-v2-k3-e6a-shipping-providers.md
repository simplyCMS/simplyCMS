# V2-К3 · Етап Е6а: доставка — спосіб = провайдер + режим ціни, адмінка доставки на серверному шарі

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Адмінка доставки (способи, тарифи, зони, точки видачі) живе на `simplycms/admin-server` + `simplycms/admin-data`. Спосіб доставки описується провайдером («куди везти») і режимом ціни, який обирає власник («скільки коштує»). Замовлення зберігає знімок доставки, тож картка показує назву точки, а не uuid. Доведено живим прогоном: власник створює спосіб «за тарифами перевізника» і точку видачі, покупець оформлює замовлення обома способами.

**Architecture:** Провайдер — запис внутрішнього реєстру ядра (`core:address`, `core:pickup`). Його клієнтський опис лежить у T0 `contracts`, а серверна поведінка (перевірка пункту доставки, знімок) — у `simplycms/commerce`. Режим ціни (`rates | provider | carrier`) — колонка способу. Розгалуження йде в єдиному рушії `resolveShippingRate`, який ділять показ і запис («показане = записане»). Зони, тарифи й точки — ресурси фабрики `defineAdminResource`. Інваріанти (єдина дефолтна зона, системна точка-склад, точка належить способу самовивозу) тримають іменовані операції під advisory-lock.

**Tech Stack:** TanStack Start 1.167, `@tanstack/react-db` 0.5.3 + `@tanstack/query-db-collection` 1.3.4 (TanStack DB 0.11.3), Drizzle + власний `columnsToZod`, Zod 4, Vitest 5, PostgreSQL 17 (`pnpm test:schema`), Playwright (`pnpm live:smoke`).

**Spec:** [`docs/superpowers/specs/2026-10-06-commerce-providers-design.md`](../specs/2026-10-06-commerce-providers-design.md), частина 1. Серверний шар — [`2026-08-29-v2-k3-admin-server-layer-design.md`](../specs/2026-08-29-v2-k3-admin-server-layer-design.md) (К3-4′, К3-7, К3-13). Зразки — плани [Е4](2026-10-03-v2-k3-e4-catalog-dictionaries.md) (setDefault під advisory-lock, guarded remove, `insertOnly`, фабрика моку) і [Е5](2026-10-04-v2-k3-e5-orders.md) (`omit`, `maxLimit`, нова authz-операція, live-smoke крок).

**Передумова:** гілка `claude/k3-e6a-shipping-providers` від `main` (0.8.0), перший коміт — спека (`9b74610f`).

**Обсяг:** 7 легасі-файлів (`pages/{Shipping,ShippingMethods,ShippingMethodEdit,ShippingZones,ShippingZoneEdit,PickupPoints,PickupPointEdit}.tsx`). Лічильник `useSupabaseClient` у `src/admin/**`: 31 → **24**.

**Редакції:**
- ред.1 (2026-10-06) — рішення власника Е6а-1…Е6а-4, рішення архітектора Е6а-5…Е6а-15.
- ред.2 (2026-10-06) — аудит Codex (`gpt-6-sol`, read-only), REJECT: 5 blocker / 6 major. Кожну знахідку перевірено кодом, усі прийнято. Додано Е6а-16 (guard-хук фабрики), Е6а-17 (FK точок `RESTRICT`, захист залишків), Е6а-18 (режим ціни в квоті чекауту), Е6а-19 (розбір знімка без Zod у T1). Е6а-8, Е6а-12, Е6а-14 переглянуто; реєстр легасі й ратчет id — у задачах, що переписують сторінки; дані кроку `live:smoke` визначено.
- ред.3 (2026-10-06) — друге коло аудиту Codex, REJECT: 4 з 11 знахідок ред.1 закрито, 6 частково; нові — 2 blocker / 6 major / 1 minor, усі перевірено кодом і прийнято. Е6а-16 — пакетна сигнатура над `ActorDb`; Е6а-17 — FK залишку теж `RESTRICT` і порядок локів (гонка з `saveStockOp`); Е6а-20 (активна дефолтна зона); Е6а-21 (публічні шляхи нових модулів); гейт Task 1 звужено; `quote-checkout.ts` у Task 2; крок `live:smoke` створює окремий спосіб самовивозу; порожні тіла тестів заборонено.

## Ухвалені рішення етапу

| № | Рішення | Причина |
|---|---|---|
| Е6а-1 | *(власник)* **Тарифи редагуються в картці способу**: таблиця «зона → тариф» з повним редагуванням усіх полів `shipping_rates`. Блок видно лише при `pricing = 'rates'`. Картка зони — лише назва, міста, області, активність, дефолт | Режим ціни налаштовується в картці способу, і тариф — його продовження. Легасі тарифів не редагував узагалі (додавав `flat`/0 і видаляв), тож це нова функціональність, а не порт |
| Е6а-2 | *(власник)* **Сторінку-огляд `Shipping.tsx` знесено.** `/admin/shipping` перенаправляє на `/admin/shipping/methods` | У меню її немає, одна картка веде сама на себе. Меню вже має три розділи |
| Е6а-3 | *(власник)* **Фіктивну опцію `online` прибрано.** У чекауті лишається лише накладений платіж; сервер приймає `paymentMethod: z.enum(['cash'])`, тип `'cash'` | До К5 опція `online` нічого не робить, а сервер її приймає (прямий POST кладе `online` у замовлення) |
| Е6а-4 | *(власник)* **Підпис режиму `carrier`** — «За тарифами перевізника» у списку способів і підсумку чекауту. У замовленні (вітрина, кабінет, адмінка) — «Доставка: за тарифами перевізника (оплата при отриманні)». `shipping_cost = 0`, `total = subtotal` | Покупець має розуміти, чому доставка не в сумі |
| Е6а-5 | *(архітектор)* **Схема — правкою BASELINE**, як Е3–Е5 (`schema.ts` + `migrations/0001_init.sql` + `drizzle/0000_init.sql` + snapshot + `demo/demo-seed.sql` + `pnpm template:sync`); `drizzle-kit generate` → «No schema changes». Формулювання спеки «→ `pnpm db:diff`» виправлено цим же комітом | D5: магазинів немає, демо-бази перестворюються. Новий `0004_*` для правки, що видаляє колонки й enum, лише ускладнив би канон |
| Е6а-6 | *(архітектор)* **Склад змін схеми:** `shipping_methods` — `−type`, `−plugin_name`, `+provider text NOT NULL` (без default), `+pricing shipping_pricing NOT NULL DEFAULT 'rates'`; enum `shipping_method_type` видаляється; enum `shipping_pricing = ('rates','provider','carrier')`; з `shipping_calculation_type` прибирається `'plugin'`; `orders` — `−delivery_method` | `provider` без default: спосіб без провайдера — дефект, і фікстури мають казати це явно. `delivery_method` дублював `code`, а відображення через мапу кодів ламається на будь-якому новому способі; його замінює знімок (Е6а-8) |
| Е6а-7 | *(архітектор)* **Провайдери.** T0 `contracts/shipping-providers.ts`: `SHIPPING_PROVIDER = { address: 'core:address', pickup: 'core:pickup' } as const`, `ShippingProviderId`, `ShippingPricing`, `SHIPPING_PROVIDERS: Record<ShippingProviderId, { destination: 'address' \| 'pickup-point'; supportsQuote: boolean }>` (обидва `supportsQuote: false`). Server-only `commerce/shipping-providers.ts` — `resolveDestination`. `provider` незмінний після створення (`insertOnly`) | Клієнту (форма способу, чекаут) потрібен лише опис; перевірка й знімок — серверні. Зміна провайдера осиротила б точки й тарифи |
| Е6а-8 | *(архітектор; ред.2 — див. Е6а-19)* **Знімок у `orders.shipping_data`** — T0 тип `ShippingSnapshot`: `{ methodName: string; provider: ShippingProviderId; pricing: ShippingPricing; destination: { kind: 'address'; city: string; address: string \| null } \| { kind: 'pickup-point'; pointId: string; name: string; address: string; city: string } }`. Пише `createOrder`; читають картка адмінки, `OrderSuccess`, `ProfileOrderDetail` через `parseShippingSnapshot(json): ShippingSnapshot \| null` (T1, Е6а-19) | Замовлення має читатись після перейменування чи видалення точки або способу. Закриває К3-Е5-2 |
| Е6а-9 | *(архітектор)* **`code` логікою не керує.** Самовивіз визначається за `SHIPPING_PROVIDERS[method.provider].destination === 'pickup-point'` у `validateShippingChoice`, `CheckoutDeliveryForm`, `useCheckoutQuote`, `Checkout.tsx`. `code` лишається унікальним ідентифікатором для людей | Спека, частина 1 |
| Е6а-10 | *(архітектор)* **Режим ціни в рушії.** `resolveShippingRate` розгалужується за `method.pricing`: `rates` — нинішній вибір тарифу; `carrier` — `{ cost: 0, pricing: 'carrier', … }` без тарифу; `provider` — `null` (недосяжно: адмінка не дає обрати `provider` без `supportsQuote`, сервер теж відмовляє). `ShippingCalculationResult` отримує `pricing`. `calculateShippingCost` втрачає гілку `'plugin'` | Одне правило для показу (`useShippingDirectory.rateFor`) і запису (`quoteShippingCost`, `recomputeOrderTotals`) |
| Е6а-11 | *(архітектор)* **Нова authz-операція `shipping.manage: { admin: 'any' }`** для всіх записів доставки. Читання адмінкою — нею ж | Доставка не каталог; прецедент `order.manage` (Е5-8) |
| Е6а-12 | *(архітектор; ред.2 — Е6а-16/17)* **Інваріанти — під advisory-lock `'shipping-config'`** (`lockCatalogTarget`, як Е4): `setDefaultShippingZone`; `removeShippingZones` відмовляє для дефолтної; спосіб із точками не видаляється (FK `RESTRICT`, Е6а-17); `removePickupPoints` відмовляє для `is_system` і для точки із залишком (Е6а-17); insert точки перевіряє, що `method_id` — спосіб із `destination === 'pickup-point'`; insert способу перевіряє `isShippingProviderId(provider)`; insert/update способу з `pricing = 'provider'` при `supportsQuote = false` — відмова. Перевірки insert/update — guard-хуком фабрики (Е6а-16), не лише UI. Відмови — `AdminConflictError('state', <constraint>)` з 409 і людським тостом. `pickup_points.is_system` — `readonly` | Легасі тримав ці інваріанти лише прихованою кнопкою. Generic `remove` без guard видалив би склад разом із залишками |
| Е6а-13 | *(архітектор)* **Публічний рядок способу (довідник вітрини) — без `config`** | Довідник читає аноном; у К5 `config` може містити секрети провайдера. Вбудовані провайдери `config` не використовують |
| Е6а-14 | *(архітектор; ред.2)* **Кеш поза колекціями.** Після кожної мутації доставки й точок інвалідуються `AGGREGATE.shippingDirectory.key` (чекаут), `AGGREGATE.stockInfo.key` (`useStock`, `core/hooks/useStock.ts:32`) і ключі `ENTITY.pickupPoints` (`usePickupPoints`/`usePickupPointsCount`), разом із write-back колекції | Правило `mutation-cache-sync` бачить лише колекцію; без цього власник додав точку, а картка товару й чекаут бачать стару до 1–5 хв |
| Е6а-16 | *(архітектор; ред.2 — аудит blocker 1)* **Guard-хук фабрики `defineAdminResource`:** опційні `lock?: string` і `guard?: (db: ActorDb, write: { kind: 'insert'; rows: Insert[] } \| { kind: 'update'; updates: { id: string; patch: Patch }[] }) => Promise<void>` — над ВСІМ пакетом (insert і update фабрики — масиви до 100, `resource-schemas.ts:117`). Порядок у транзакції операції: `lockCatalogTarget(db, lock)` ПЕРШИМ запитом → `guard` для всього пакета → запис. Невалідний будь-який елемент відкочує весь пакет. Guard відмовляє `throw` (`AdminConflictError('state', …)` із 409). Без `lock`/`guard` поведінка фабрики незмінна | `insert`/`update` фабрики кличуть `insertResourceRows`/`updateResourceRows` напряму (`resource.ts:119,130`), тож інваріанти запису ніде не перевіряються. Хук — загальний механізм; хвилі Е6 (знижки) потребуватимуть того самого |
| Е6а-17 | *(архітектор; ред.2 — аудит blocker 2; ред.3 — гонка з `saveStockOp`)* **Залишки не губляться видаленням — гарантує БД.** FK `pickup_points.method_id` і FK `stock_by_pickup_point.pickup_point_id` → `ON DELETE RESTRICT` (правка baseline): спосіб із точками й точку з будь-яким рядком залишку база не видаляє, мапінг `23503` дає `AdminConflictError('reference')` і тост «використовується». `removePickupPointsOp` під `SHIPPING_CONFIG_LOCK`: (1) `select … from stock_by_pickup_point where pickup_point_id = any($ids) order by id for update` — той самий рядковий лок, що бере резерв замовлення (`lockTargetStock`), тож оформлення в польоті дочекається або буде дочекане; (2) рядок із `quantity <> 0` або позиція з `stock_point_id ∈ ids and stock_reserved > 0` → `'pickup_point_has_stock'`; (3) видалити нульові рядки залишку; (4) видалити точки. Рядок залишку, вставлений `saveStockOp` після кроку (1) (інший advisory-key), тримає `FOR KEY SHARE` на точці — видалення дочекається його COMMIT і впаде на FK → `reference`. Шлях для власника — деактивація | Каскад точка → залишки знищує склад мовчки, позиції незавершених замовлень втрачають точку повернення (`order-stock.ts:92`), а перевірка в коді без FK не атомарна відносно `saveStockOp` (`stock/save.ts:87`, інший лок) |
| Е6а-18 | *(архітектор; ред.2 — аудит blocker 5)* **Режим ціни в квоті чекауту.** `CheckoutQuote` (`contracts/objects/order.ts:124`) отримує `shippingPricing: ShippingPricing`; `prepareCheckout` бере його з результату `quoteShippingCost`; `CheckoutQuoteDetails` при `carrier` показує «За тарифами перевізника» замість «Безкоштовно» | Інакше підсумок форматує 0 як «Безкоштовно» (`domain/shipping.ts:185`) |
| Е6а-19 | *(архітектор; ред.2 — аудит major 8)* **T0 лишається type-only.** `contracts/shipping-providers.ts` — типи (зокрема `ShippingSnapshot`) і прості константи (ред.3: окремого `shipping-snapshot.ts` у T0 немає, Е6а-21). `parseShippingSnapshot` — ручний type-guard без Zod у `domain/shipping-snapshot.ts` (T1, без IO, доступний вітрині й адмінці). Запис знімка будує код (`resolveDestination`), тож Zod на записі не потрібен | `contracts` — «0 runtime-залежностей», type-only (`packages/README.md:29`, `contracts/index.ts:2`); Zod у `contracts` і `domain` не імпортується |
| Е6а-20 | *(архітектор; ред.3 — аудит major 5)* **Дефолтна зона завжди активна.** Guard зон відмовляє деактивувати дефолтну (`'shipping_zone_default'`); `setDefaultShippingZoneOp` приймає лише активну ціль (`'shipping_zone_inactive'`) | Довідник бере лише активні зони (`shipping-directory.ts:72`), а fallback шукає дефолт серед них (`domain/shipping.ts:217`): вимкнена дефолтна мовчки лишає без доставки всі міста поза зонами |
| Е6а-21 | *(архітектор; ред.3 — аудит major 6)* **Публічні шляхи нових модулів.** Новий субшлях `simplycms/contracts/shipping-providers` (тип `ShippingSnapshot` теж тут; `contracts/shipping-snapshot.ts` НЕ створюється) — у `exports` і `publishConfig.exports` (прецедент `./contracts/order-status-codes`); `parseShippingSnapshot` — реекспорт із `domain/shipping.ts` (доступний через наявний `simplycms/domain` і його субшлях `shipping`) | T5-читачі імпортують лише пакетними субшляхами; барель `contracts` type-only |
| Е6а-15 | *(архітектор)* **Слот `admin.shipping.method.settings` видаляється** (тип у `plugins/types.ts`, документація в `plugins/hooks.ts`, рендер у легасі). Налаштування провайдерів плагінів К5 будує ядро з `configSchema`. Форма `configSchema` в Е6а не потрібна: у вбудованих провайдерів `config` немає | Споживачів у репо немає; тригер `type === 'plugin'` зникає разом із колонкою |

**Поза Е6а (план каже це вголос):**
- провайдери плагінів, `configSchema`-форма, узагальнений `destination` у чекауті — К5;
- `working_hours`/`coordinates` точок — легасі їх теж не редагував;
- `profiles.default_shipping_method_id`/`default_pickup_point_id` — споживачів немає;
- зміна способу доставки в оформленому замовленні — межа Е5б-2 лишається.

## Ступінь обовʼязковості — читати ПЕРШИМ

- **КАНОН** (розбіжність → зупинка і звернення до архітектора): рішення Е6а-1…Е6а-15, Global Constraints, імена операцій і serverFn у блоках Interfaces, `ShippingSnapshot`, склад гейтів, асерти Review Focus.
- **ОРІЄНТИР** (виконавець адаптує сам і пише про це у звіті): якорі `файл:рядок`, імена внутрішніх компонентів і хуків, розкладка JSX, тексти i18n, крім рядків Е6а-4.
- 🔴 Звіт «гейт зелений» — не доказ. Доказ — вивід команди у звіті задачі.
- 🔴 Крок «має бути ЗЕЛЕНИМ одразу» перевіряє припущення плану. Червоний — знахідка: зупинка, не «полагодити тест».
- 🔴 Лок доводиться детерміновано хелперами Е4-12 (`holdLock`, `stillPending`); третя копія заборонена.
- Задачі адресуються заголовками `## Task N:`.

## Протокол виконання

- **Ролі.** Виконує сесія-оркестратор (subagent-driven). **Архітектор — сесія, що написала цей план**; звернення — `SendMessage` на імʼя з `ListAgents`. Ескалація ДО коду: розбіжність із КАНОНОМ; «зелений одразу» вийшов червоним; потрібне рішення, якого план не містить. Відповідь — рішення `Е6а-N`, вписане в таблицю окремим docs-комітом.
- **Рев'ю.** Після кожної задачі — рев'ю задачі (SDD). Після Task 9 — фінальне рев'ю гілки архітектором. Мерж і пуш — рішення власника.
- **Стенд.** `PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55434/postgres`. RED одного файлу харнеса — `pnpm exec vitest run --config vitest.schema.config.ts <фільтр>`.

## Global Constraints

- TypeScript 6.0 strict (`UPSTREAM:TSESL-1`). Node `>=22.12`.
- Коментарі й доки — українською; рядки інтерфейсу — лише i18n (`i18n/catalogs/{uk,en}/**`, обидва каталоги, парність — `catalog-integrity.test.ts`). Гроші — `useFormatPrice()`.
- `pnpm lint` = 0 errors / ≤ 8 warnings.
- 🔴 Ліміт 150 рядків на новий або переписаний файл; `wc -l` нових файлів — у звіті кожної задачі з UI. Виняток — `admin-server/index.ts` (К3-9′).
- Повний ланцюг: `pnpm install --frozen-lockfile → format:check → lint → build → typecheck → test → test:schema → build:packages → typecheck:template → test:packaging → pilot:pack --skip-build`.
- Мінімальний гейт задачі: `pnpm lint && pnpm typecheck && pnpm test`; + `pnpm test:schema`, якщо зачеплено `schema/`, `migrations/`, `commerce/`, `storefront/loaders/`, `admin-server/impl/**`, `auth/`, `test-harness/`; + `pnpm build:packages`, якщо зачеплено серверний код пакета або exports.
- К3-4′/К3-9′: `createServerFn` — лише топ-рівневий `const` в `admin-server/index.ts`; нутрощі — `admin-server/impl/**` через bare-специфікатор.
- К3-13: кожна адмін-операція — через `runAdmin(operation, fn)`; 409 ставиться до `throw`.
- К3-7: write-back замість self-invalidation; `mutation-cache-sync` без послаблень.
- Нові serverFn — у фабрику моку `admin-server/__tests__/support/admin-server-mock.ts`.
- Ключ `id` генерує викликач (`crypto.randomUUID()`); `DEFAULT gen_random_uuid()` у схему не повертати.
- Тіри: `contracts` = T0, `domain` = T1, `commerce`/`admin-server` = T2, `admin-data` = T4, `admin`/`checkout-ui`/`storefront-routes` = T5.
- Коміти: `feat(k3-e6a): …`, `test(k3-e6a): …`, `docs(k3-e6a): …`; без трейлерів `Co-Authored-By`/`Generated with`.

## Review Focus

1. **Власник видаляє спосіб «Самовивіз» із точками або точку, на якій лежить товар** → відмова з тостом; SQL після відмови: точки, рядки `stock_by_pickup_point` і тарифи на місці, кількості незмінні. Тест — Task 4 (Е6а-17).
2. **Власник перемикає спосіб із `rates` на `carrier`, коли тарифи вже є** → чекаут (список способів І підсумок квоти, Е6а-18) показує «За тарифами перевізника», замовлення має `shipping_cost = 0` і `total = subtotal`; тарифи зберігаються, але не діють; редагування позицій (Е5б) теж дає 0. Тест — Task 2 (рушій, `recomputeOrderTotals`) і Task 3 (UI).
3. **Дві вкладки одночасно роблять дефолтними різні зони** → рівно одна дефолтна, без 500. Тест — Task 4 (детермінований лок).
4. **Точку видачі перейменували або видалили після оформлення** → картка адмінки, `OrderSuccess` і кабінет показують назву й адресу на момент оформлення. Тест — Task 2 (знімок у БД незмінний після `update pickup_points set name`) і Task 3 (окремі рендер-тести ВСІХ трьох читачів зі знімка, де поточна назва точки інша, а `pickupPointId = null`).
5. **Власник додав точку видачі** → редактор залишків товару й чекаут бачать її без очікування `staleTime`. Тест — Task 5.

Додатково: покупець шле `pickupPointId` точки іншого способу самовивозу або адресний спосіб без міста → наявні відмови `pickup_point_invalid`/`shipping_unavailable` тепер ідуть через провайдера (Task 2); прямий POST `paymentMethod: 'online'` → 400 (Task 3); точку не можна привʼязати до адресного способу (Task 4).

## Граф залежностей задач

```
Task 1 (схема + T0) ─► Task 2 (рушій, провайдери, знімок) ─► Task 3 (чекаут, оплата, показ знімка)
  ─► Task 4 (authz + ресурси + інваріанти) ─► Task 5 (колекції + кеш) ─┬─► Task 6 (способи + тарифи)
                                                                     └─► Task 7 (зони, точки, знос огляду)
Task 6, 7 ─► Task 8 (гейти легасі) ─► Task 9 (live:smoke, доки)
```

🔴 Ланцюг Task 1 → 2 → 3 строго послідовний: Task 1 ламає споживачів `type`/`plugin_name`/`delivery_method`, і `pnpm typecheck` знову зелений лише після Task 3. Тому Task 4 іде після Task 3, хоча за змістом від нього не залежить. Task 6 і Task 7 незалежні між собою.

## File Structure

**Створюються:**
- `packages/simplycms/src/contracts/shipping-providers.ts`; `packages/simplycms/src/domain/shipping-snapshot.ts`; `test-harness/pg/__tests__/shipping-fk.test.ts`;
- `packages/simplycms/src/commerce/shipping-providers.ts`;
- `packages/simplycms/src/admin-server/impl/{shipping-methods,shipping-zones,shipping-rates,pickup-points}/**` (`resource.ts`, `remove.ts`, `set-default.ts` для зон, `guards.ts`);
- `packages/simplycms/src/admin-data/collections/{shipping-methods,shipping-zones,shipping-rates,pickup-points}.ts` + `admin-data/shipping-cache.ts`;
- `packages/simplycms/src/admin/features/shipping/{methods,zones,pickup-points}/**`;
- `packages/simplycms/test-harness/pg/__tests__/admin-shipping.test.ts`;
- `scripts/live-smoke/admin-shipping{,-sql}.mjs`.

**Змінюються:**
- схема й канон: `schema/schema.ts`, `migrations/{0001_init,demo/demo-seed}.sql`, `drizzle/**` + копії `template:sync`;
- контракти: `contracts/objects/{shipping,order}.ts`, `contracts/domain-errors.ts`;
- рушій і чекаут: `domain/shipping.ts`, `commerce/{shipping-choice,shipping-directory,shipping-types,index}.ts`, `storefront/loaders/{order-create,place-order,place-order-support,entities/*}.ts`, `admin-server/impl/order-items/totals.ts`;
- UI вітрини: `checkout-ui/{CheckoutDeliveryForm,CheckoutPaymentForm}.tsx`, `storefront-routes/pages/{Checkout,OrderSuccess,ProfileOrderDetail}.tsx`, `storefront-routes/pages/checkout/*`, `storefront-routes/server/checkout-input.ts`;
- UI адмінки: `admin/features/orders/detail/{OrderDeliveryCard,OrderCustomerCard}.tsx`, `admin/pages/{ShippingMethods,ShippingMethodEdit,ShippingZones,ShippingZoneEdit,PickupPoints,PickupPointEdit}.tsx` (стають реекспортами), `routes/admin/admin/shipping/index.tsx` (redirect);
- серверний шар і права: `auth/authz.ts`, `admin-server/{index,impl/index}.ts`, мок;
- плагіни: `plugins/{types,hooks}.ts`;
- i18n: `admin/shipping.ts`, `admin/errors.ts`, `checkout.ts`, `orders`;
- тести й фікстури: `test-harness/pg/__tests__/{fixtures/shipping,fixtures/commerce,fixtures/order-items-edit-data,checkout-flow,storefront-personal-data,admin-catalog-ops}.ts`, `tests/admin-server-first/registry.ts`, `tests/admin-inserts-need-id.test.ts`;
- live-smoke: `scripts/live-smoke/owner-steps.mjs`;
- доки.

**Видаляються:** `packages/simplycms/src/admin/pages/Shipping.tsx`.

---

## Task 1: Схема доставки й контракти T0 (Е6а-5…Е6а-8)

**Files:**
- Create: `packages/simplycms/src/contracts/shipping-providers.ts` (константи + типи, зокрема `ShippingSnapshot`; субшлях Е6а-21 у `package.json` `exports` і `publishConfig.exports`), `packages/simplycms/src/domain/shipping-snapshot.ts` (реекспорт із `domain/shipping.ts`; + `domain/__tests__/shipping-snapshot.test.ts`)
- Modify (мінімально, щоб `typecheck` закрився в Task 3): легасі-споживачі контрактних типів, що ламаються, — відомий `admin/pages/ShippingZoneEdit.tsx:66-72` (ключ `plugin` у `calculationTypeLabels`); решту знаходить `pnpm typecheck` і правиться тут же
- Modify: `packages/simplycms/src/schema/schema.ts:67-68,526-541,620,649,803` (FK `pickup_points.method_id` і `stock_by_pickup_point.pickup_point_id` → `restrict`, Е6а-17), `packages/simplycms/src/schema/README.md:53` (назва enum), `packages/simplycms/migrations/0001_init.sql`, `packages/simplycms/drizzle/{0000_init.sql,meta/0000_snapshot.json}`, `packages/simplycms/migrations/demo/demo-seed.sql:295-330`, `packages/simplycms/src/contracts/objects/shipping.ts`, фікстури харнеса (8 вставок `shipping_methods`: `fixtures/{shipping,commerce,order-items-edit-data}.ts`, `checkout-flow.test.ts`, `storefront-personal-data.test.ts`, `admin-catalog-ops.test.ts`), копії `template:sync`

**Interfaces:**
- Produces: `SHIPPING_PROVIDER`, `ShippingProviderId = 'core:address' | 'core:pickup'`, `ShippingPricing = 'rates' | 'provider' | 'carrier'`, `SHIPPING_PRICINGS` (кортеж), `SHIPPING_PROVIDERS` (Е6а-7), `isShippingProviderId(x: string): x is ShippingProviderId`; тип `ShippingSnapshot` (T0); `parseShippingSnapshot(json: unknown): ShippingSnapshot | null` у `domain/shipping-snapshot.ts` — ручний type-guard без Zod (Е6а-19), невалідне або `{}` → `null`, без throw.
- Контракт `ShippingMethod` (`contracts/objects/shipping.ts`): `−type`, `−plugin_name`, `+provider: ShippingProviderId`, `+pricing: ShippingPricing`; `ShippingCalculationType` без `'plugin'`; `ShippingCalculationResult` `+pricing: ShippingPricing`; поля `pluginData` видаляються.
- Схема: Е6а-6 дослівно. Демо-сід: самовивіз — `provider 'core:pickup'`, `pricing 'rates'`.

- [ ] **Step 1: Юніт `parseShippingSnapshot` (червоний)** — кейси: валідний `pickup-point` → обʼєкт; валідний `address` з `address: null` → обʼєкт; `{}` → `null`; невідомий `provider` → `null`; `pricing: 'plugin'` → `null`.
- [ ] **Step 2: Контракти T0** за Interfaces. Run: `pnpm vitest run packages/simplycms/src/domain/__tests__/shipping-snapshot.test.ts` → PASS.
- [ ] **Step 3: Правка baseline** (Е6а-5/6) + фікстури + демо-сід; `pnpm template:sync`. Коментар у `schema.ts` біля `provider`: чому без default.
- [ ] **Step 4: Перевірка канону**

Run: `pnpm exec drizzle-kit generate` (конфіг пакета) → `No schema changes`; `pnpm test:schema` → PASS; `pnpm db:demo` → без помилок.
Expected: компілятор ламає споживачів `type`/`plugin_name`/`delivery_method` — це очікувано; `pnpm typecheck` у цій задачі НЕ гейт (його закриває Task 3). 🔴 Повний `pnpm test:schema` теж НЕ гейт Task 1: `checkout-flow.test.ts` кличе `placeOrderFor`, а `order-create.ts:64` ще пише `deliveryMethod` до Task 2. Гейт задачі — канон без оформлення: `pnpm exec vitest run --config vitest.schema.config.ts baseline grants-parity id-defaults explicit-ids single-default demo-seed seed-determinism shipping-fk && pnpm vitest run packages/simplycms/src/domain`. Новий `shipping-fk.test.ts`: `delete` способу з точкою → `23503`; `delete` точки з рядком залишку (і з нульовим) → `23503`.

- [ ] **Step 5: Коміт** — `feat(k3-e6a): схема доставки provider+pricing і контракти знімка`.

---

## Task 2: Рушій ціни, провайдери, знімок у замовленні (Е6а-8…Е6а-10, Е6а-13)

**Files:**
- Create: `packages/simplycms/src/commerce/shipping-providers.ts`
- Modify: `packages/simplycms/src/contracts/objects/order.ts:124` (`CheckoutQuote.shippingPricing`), `storefront/loaders/{prepare-checkout,quote-checkout}.ts` (`quote-checkout.ts:52` будує `CheckoutQuote`; `pricing` іде через `PreparedCheckout`), `packages/simplycms/src/domain/shipping.ts:28-135`, `domain/__tests__/shipping.test.ts`, `commerce/{shipping-choice,shipping-directory,shipping-types,index}.ts`, `storefront/loaders/{order-create,place-order,place-order-support,entities/new-order,entities/order}.ts`, `admin-server/impl/order-items/totals.ts`, `test-harness/pg/__tests__/{commerce-shipping,checkout-flow,shipping-directory}.test.ts`

**Interfaces:**
- Consumes: Task 1.
- `resolveShippingRate(context, rates): ShippingCalculationResult | null` — Е6а-10.
- `resolveDestination(db, method: ShippingMethodRow, input: { deliveryCity: string | null; deliveryAddress: string | null; pickupPointId: string | null }): Promise<{ snapshot: ShippingSnapshot['destination']; point: PickupPointRow | null } | 'shipping_unavailable' | 'pickup_point_invalid'>` у `commerce/shipping-providers.ts`. Правила дослівно з нинішнього `validateShippingChoice:54-71`, але за провайдером.
- `quoteShippingCost(choice, subtotal): { cost: number; pricing: ShippingPricing } | null`; `prepareCheckout` кладе `pricing` у `CheckoutQuote.shippingPricing` (Е6а-18).
- `validateShippingChoice` повертає `ShippingChoice` з новим полем `snapshot: ShippingSnapshot` (`methodName = method.name`, `provider`, `pricing`, `destination`).
- `NewOrderInput`: `−shippingMethodCode`, `+shippingSnapshot: ShippingSnapshot`; `createOrder` пише `shippingData: input.shippingSnapshot`, `delivery_method` більше не пише.
- Довідник вітрини (`loadShippingDirectory`) віддає методи без `config` (Е6а-13); тип `ShippingMethodRow` для вітрини — без `config`.

- [ ] **Step 1: Юніти рушія (червоні)** — `domain/__tests__/shipping.test.ts`:

```ts
it('pricing carrier → cost 0 і pricing carrier, тарифи ігноруються', () => {
  expect(resolveShippingRate(ctx({ pricing: 'carrier' }), [flatRate(150)]))
    .toMatchObject({ cost: 0, pricing: 'carrier' });
});
it('pricing rates → перший застосовний тариф, pricing rates', () => {});
it('pricing provider → null (вбудовані провайдери не рахують)', () => {});
```

- [ ] **Step 2: Харнес (червоний)** — `commerce-shipping.test.ts` / `checkout-flow.test.ts`: (а) `placeOrderFor` самовивозом → `shipping_data` дорівнює знімку з назвою й адресою точки, `delivery_method` колонки немає; (б) адресний спосіб `carrier` → `shipping_cost = 0`, `total = subtotal`, знімок `kind: 'address'`; (в) `pickupPointId` точки ІНШОГО способу самовивозу → `pickup_point_invalid`; (г) `recomputeOrderTotals` для замовлення способу `carrier` після зміни кількості → `shipping_cost = 0` (Review Focus 2); (д) після `update pickup_points set name = 'Інша'` рядок `orders.shipping_data` незмінний (Review Focus 4); (е) `quoteCheckoutFor` для способу `carrier` → `quote.shippingPricing === 'carrier'`, `shippingCost === 0`.
- [ ] **Step 3: Реалізація** за Interfaces; `code === 'pickup'` у `shipping-choice.ts` зникає (Е6а-9).
- [ ] **Step 4: Зелене** — Run: `pnpm test:schema && pnpm vitest run packages/simplycms/src/domain packages/simplycms/src/commerce` → PASS (тут повний `test:schema` уже гейт).
- [ ] **Step 5: Коміт** — `feat(k3-e6a): режим ціни в рушії, провайдери і знімок доставки в замовленні`.

---

## Task 3: Чекаут, оплата, показ знімка (Е6а-3, Е6а-4, Е6а-8, Е6а-9)

**Files:**
- Modify: `checkout-ui/{CheckoutDeliveryForm,CheckoutPaymentForm,CheckoutQuoteDetails}.tsx` (+ тести), `admin-server/impl/orders/resource.ts:48`, `admin-server/impl/__tests__/orders-config.ts:21`, `admin-data/__tests__/support/orders-server-stub.ts:76` (без `deliveryMethod`), `storefront-routes/__tests__/order-success-token.test.tsx:47` (фікстура `delivery_method`), `storefront-routes/pages/{Checkout,OrderSuccess,ProfileOrderDetail}.tsx`, `storefront-routes/pages/checkout/{useCheckoutQuote,quote-state,build-quote-input}.ts`, `storefront-routes/server/checkout-input.ts`, `contracts/objects/order.ts:73`, `core/hooks/useShippingDirectory.ts`, `admin/features/orders/detail/{OrderDeliveryCard,OrderCustomerCard}.tsx`, i18n `checkout.ts`, `orders`, `admin/orders.ts`; тести `CheckoutDeliveryForm.test.tsx`, `order-success-guest-token.test.tsx`, `profile-order-cancel-button.test.tsx`

**Interfaces:**
- Consumes: `SHIPPING_PROVIDERS`, `parseShippingSnapshot`, `ShippingCalculationResult.pricing`.
- Новий спільний компонент показу знімка — ОРІЄНТИР: `ShippingSnapshotLines` (T5, `checkout-ui` або `storefront-routes`), який використовують `OrderSuccess` і `ProfileOrderDetail`; адмінська картка має власний рядок (T5 адмінки не імпортує вітрину, якщо тір-зони це забороняють).
- i18n (КАНОН Е6а-4): `checkout.shipping.carrier` = «За тарифами перевізника»; `orders.shipping.carrierNote` = «за тарифами перевізника (оплата при отриманні)».

- [ ] **Step 1: Тести (червоні):**
  - `CheckoutDeliveryForm`: спосіб `core:pickup` з довільним `code` показує вибір точки; `carrier` показує «За тарифами перевізника» замість суми;
  - `CheckoutPaymentForm`: рівно одна опція `cash`;
  - `OrderDeliveryCard`, `OrderSuccess`, `ProfileOrderDetail` — кожен окремо: `pickupPointId = null` + знімок із назвою «Склад у Києві» при поточній назві точки «Інша» → показано «Склад у Києві» і адресу зі знімка (Review Focus 4);
  - `OrderSuccess`: знімок `carrier` → примітка Е6а-4;
  - `CheckoutQuoteDetails`: `shippingCost = 0`, `shippingPricing = 'carrier'` → «За тарифами перевізника», не «Безкоштовно» (Е6а-18);
  - `checkoutInputSchema.safeParse({ …, paymentMethod: 'online' }).success === false`.
- [ ] **Step 2: Реалізація.** Мапа `METHOD_KEYS` (`pickup|nova_poshta|courier`) зникає — назва способу береться зі знімка.
- [ ] **Step 3: Зелене** — Run: `pnpm lint && pnpm typecheck && pnpm test` → PASS (тут `typecheck` уже гейт: усі споживачі Task 1 полагоджені). `wc -l` змінених файлів UI — у звіт.
- [ ] **Step 4: Коміт** — `feat(k3-e6a): чекаут за провайдером, режим carrier, знімок у замовленні, без фіктивної оплати online`.

---

## Task 4: Права, ресурси доставки й інваріанти (Е6а-11, Е6а-12)

**Files:**
- Create: `admin-server/impl/shipping-methods/{resource,remove,guards}.ts`, `admin-server/impl/shipping-zones/{resource,set-default,remove}.ts`, `admin-server/impl/shipping-rates/resource.ts`, `admin-server/impl/pickup-points/{resource,remove,guards}.ts`, `test-harness/pg/__tests__/admin-shipping.test.ts`
- Modify: `admin-server/impl/{resource,resource-config}.ts` (guard-хук Е6а-16; якщо `resource.ts` переросте 150 рядків — винести виконання запису в окремий модуль) + юніт фабрики, `auth/authz.ts` (+ тести матриці), `contracts/domain-errors.ts`, `admin-server/impl/index.ts`, `admin-server/index.ts`, мок, `admin/lib/admin-error.ts`, i18n `admin/errors.ts`

**Interfaces:**
- `SHIPPING_CONFIG_LOCK = 'shipping-config'` (усі операції нижче беруть його ПЕРШИМ запитом транзакції через `lockCatalogTarget`).
- Фабрика (Е6а-16): `lock?: string`, `guard?: (db: ActorDb, write: { kind: 'insert'; rows: Insert[] } | { kind: 'update'; updates: { id: string; patch: Patch }[] }) => Promise<void>`; порядок «lock → guard усього пакета → запис» в одній транзакції `run`.
- `shippingMethodsOps`: `lock: SHIPPING_CONFIG_LOCK`, `guard` (provider з реєстру, `pricing provider` лише з `supportsQuote`), `operation: 'shipping.manage'`, `mode: 'eager'`, `insertOnly: ['provider']`, `writable`: `code, name, description, pricing, isActive, sortOrder, icon, config`, `touch: 'updatedAt'`; `refine.code` — regex як у типів цін. Insert/update з `pricing: 'provider'` при `!SHIPPING_PROVIDERS[provider].supportsQuote` → `AdminConflictError('state', 'shipping_pricing_unsupported')` — через `guards.ts`, а не лише UI.
- `shippingZonesOps`: eager; `lock` + `guard` (Е6а-20: не деактивувати дефолтну); `isDefault` — `readonly`. `setDefaultShippingZoneOp({ data: { id } }) → { rows }` — патерн `price-types/set-default.ts` + відмова для неактивної цілі (`'shipping_zone_inactive'`). `removeShippingZonesOp` — відмова для дефолтної (`'shipping_zone_default'`).
- `shippingRatesOps`: `mode: 'on-demand'`, `filterable: ['methodId', 'zoneId']`, `sortable: ['sortOrder']`, усі поля тарифу `writable`, `methodId`/`zoneId` — `insertOnly`.
- `pickupPointsOps`: eager; `lock` + `guard`; `isSystem` — `readonly`; `methodId` — `insertOnly` і перевіряється guard-ом: спосіб із `destination === 'pickup-point'`, інакше `'pickup_point_method_invalid'`. `removePickupPointsOp` — відмова для `is_system` (`'pickup_point_system'`) і для точки із залишком (`'pickup_point_has_stock'`); порядок кроків — Е6а-17 дослівно.
- `removeShippingMethodsOp` — guarded batch під локом; спосіб із точками відмовляє через FK `RESTRICT` → `AdminConflictError('reference')` (Review Focus 1).
- serverFn: `list/insert/update/remove` для чотирьох сутностей (remove — лише іменовані guarded-операції), `setDefaultShippingZone`.

- [ ] **Step 1: Харнес-тест (червоний)** — шапка як `admin-catalog-dictionaries.test.ts`:

```ts
describe('admin: доставка (Е6а, Task 4)', () => {
  it('remove способу з точками → AdminConflictError reference; SQL: точки, залишки, тарифи й кількості незмінні', async () => {
    const before = await snapshotShipping(dbUrl); // точки, stock_by_pickup_point, shipping_rates методу
    await expect(removeShippingMethodsOp({ data: [{ id: PICKUP }] }))
      .rejects.toMatchObject({ name: 'AdminConflictError', kind: 'reference' });
    expect(await snapshotShipping(dbUrl)).toEqual(before);
  });
  it('remove точки з quantity <> 0 → pickup_point_has_stock; рядки залишку незмінні', async () => {});
  it('remove точки, на яку посилається позиція зі stock_reserved > 0 → pickup_point_has_stock', async () => {});
  it('remove точки лише з нульовими рядками залишку → видалено разом із рядками', async () => {});
  it('гонка: незакомічений insert рядка залишку на точку (окреме зʼєднання) → remove стоїть (stillPending); COMMIT → AdminConflictError reference; рядок і точка на місці', async () => {});
  it('змішаний batch insertPickupPoints [валідна, з адресним methodId] → відмова; ЖОДНОГО рядка не вставлено', async () => {});
  it('update зони { isActive: false } для дефолтної → shipping_zone_default; setDefault неактивної → shipping_zone_inactive', async () => {});
  it('remove системної точки → pickup_point_system; точка на місці', async () => {});
  it('прямий insertPickupPoints з methodId адресного способу → pickup_point_method_invalid; рядка немає', async () => {});
  it('прямий insertShippingMethods з provider "nova-poshta:x" → відмова; рядка немає', async () => {});
  it('спосіб core:address з pricing provider (insert і update) → shipping_pricing_unsupported; рядок незмінний', async () => {});
  it('provider незмінний: update з provider → ключ відкинуто схемою, provider у БД старий', async () => {});
  it('setDefault зони: стара дефолтна знята, нова стоїть; no-op для вже дефолтної', async () => {});
  it('remove дефолтної зони → shipping_zone_default; зона й тарифи на місці', async () => {});
  it('setDefault стоїть, поки зовнішній тримає SHIPPING_CONFIG_LOCK (holdAdvisoryLock/stillPending Е4-12)', async () => {});
  it('guard виконується ПІСЛЯ lock: insert точки стоїть, поки зовнішній тримає лок', async () => {});
  it('не-адмін → AuthzError, нічого не змінено', async () => {});
});
```

Кожен кейс відмови має SQL-асерт стану ПІСЛЯ відмови (Review Focus 1), а не лише `rejects`. `snapshotShipping` — хелпер у файлі тесту (ОРІЄНТИР). 🔴 Порожні тіла вище — лише перелік кейсів: до запуску RED кожен `it` написаний повністю (виклик операції, точний `kind`/`constraint`, SQL-стан після), і звіт показує, що кожен падає з ОЧІКУВАНОЇ причини (немає операції/guard), а не проходить порожнім.

Негативний контроль (вивід у звіт): прибрати `lockCatalogTarget` із `setDefaultShippingZoneOp` → тест локу червоніє; повернути FK на `cascade` → червоніє перший кейс; прибрати виклик `guard` у фабриці → червоніють кейси прямого insert.

- [ ] **Step 2: Реалізація** за Interfaces; тости для семи нових `constraint` (`shipping_pricing_unsupported`, `shipping_provider_unknown`, `shipping_zone_default`, `shipping_zone_inactive`, `pickup_point_method_invalid`, `pickup_point_system`, `pickup_point_has_stock`) — у `adminErrorKey` + i18n.
- [ ] **Step 3: Зелене** — Run: `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages && pnpm pilot:pack --skip-build` → PASS; Gate C зелений.
- [ ] **Step 4: Коміт** — `feat(k3-e6a): ресурси доставки з інваріантами під shipping-config lock`.

---

## Task 5: Колекції доставки й кеш поза ними (Е6а-14)

**Files:**
- Create: `admin-data/collections/{shipping-methods,shipping-zones,shipping-rates,pickup-points}.ts`, `admin-data/shipping-cache.ts`, `admin-data/__tests__/shipping-collections.test.tsx`
- Modify: `admin-data/index.ts`

**Interfaces:**
- Колекції за зразком `collections/price-types.ts` (eager) і `orders` (on-demand для `shipping_rates`); ENTITY-ключі вже існують (`entities.ts:29,41-43`).
- `invalidateShippingConsumers(queryClient: QueryClient): Promise<void>` у `admin-data/shipping-cache.ts` — інвалідує `AGGREGATE.shippingDirectory.key`, `AGGREGATE.stockInfo.key` і ключі `ENTITY.pickupPoints` (`usePickupPoints`/`usePickupPointsCount`). Кличеться в `persistenceHandlers` кожної з чотирьох колекцій ПІСЛЯ write-back і в хуках іменованих операцій.

- [ ] **Step 1: Тест (червоний)** — для insert, update і remove точки через колекцію окремо: `isInvalidated === true` для ключа активних точок, `AGGREGATE.shippingDirectory.key` і запиту `[...AGGREGATE.stockInfo.key, null, PRODUCT]` (Review Focus 5); write-back без refetch колекції.
- [ ] **Step 2: Реалізація.**
- [ ] **Step 3: Зелене** — Run: `pnpm lint && pnpm typecheck && pnpm test` → PASS.
- [ ] **Step 4: Коміт** — `feat(k3-e6a): колекції доставки і інвалідація довідника та складів`.

---

## Task 6: Способи доставки і тарифи (Е6а-1, Е6а-7, Е6а-15)

**Files:**
- Create: `admin/features/shipping/methods/**` (`ShippingMethodsPage`, `ShippingMethodEditPage`, поля форми, `useShippingMethodCard`, `ShippingRatesTable` + рядок/діалог тарифу, `__tests__/`)
- Modify: `admin/pages/{ShippingMethods,ShippingMethodEdit}.tsx` → однорядкові реекспорти (як `PriceTypeEdit.tsx`); `plugins/{types,hooks,index}.ts` (Е6а-15; `index.ts:45` реекспортує константу слота); i18n `admin/shipping.ts`; `tests/admin-server-first/registry.ts` (−2 записи) і `tests/admin-inserts-need-id.test.ts` (`KNOWN_WITHOUT_ID` 12 → 11) — у ЦІЙ задачі, інакше `pnpm test` червоний («немає протухлих записів»)

**Interfaces:**
- Consumes: колекції Task 5, `SHIPPING_PROVIDERS`, `SHIPPING_PRICINGS`.
- Список: назва, провайдер, режим ціни, активність (перемикач), порядок; видалення — `AlertDialog` + `removeShippingMethods`, тост на 409.
- Картка: провайдер (лише при створенні; потім — показ), назва, код, опис, режим ціни (опція `provider` недоступна, коли `supportsQuote = false`), іконка, порядок, активність. Блок «Тарифи» (Е6а-1) — лише при `pricing = 'rates'` і для збереженого способу: рядки «зона → тариф» з усіма полями `shipping_rates`, додавання вимагає вибору зони.

- [ ] **Step 1: Тести компонентів (червоні)** — `pricing = carrier` → блоку тарифів немає; новий спосіб → поле провайдера активне, збережений → лише показ; тариф редагується (base_cost, free_from_amount) і пишеться через колекцію з `id` від `crypto.randomUUID()`.
- [ ] **Step 2: Реалізація** за патерном `catalog-dictionaries/price-types` (`useSeedOnce`, `reportTxError`, `isPersisted`).
- [ ] **Step 3: Зелене** — Run: `pnpm lint && pnpm typecheck && pnpm test` → PASS; `wc -l` нових файлів ≤ 150.
- [ ] **Step 4: Коміт** — `feat(k3-e6a): адмінка способів доставки з тарифами за зонами`.

---

## Task 7: Зони, точки видачі, знос огляду (Е6а-2, Е6а-12)

**Files:**
- Create: `admin/features/shipping/{zones,pickup-points}/**` (+ `__tests__/`)
- Modify: `admin/pages/{ShippingZones,ShippingZoneEdit,PickupPoints,PickupPointEdit}.tsx` → реекспорти; `routes/admin/admin/shipping/index.tsx` → redirect на `/admin/shipping/methods`; `tests/admin-server-first/registry.ts` (−5 записів, включно з `Shipping.tsx`) і `tests/admin-inserts-need-id.test.ts` (11 → 8) — у ЦІЙ задачі
- Delete: `admin/pages/Shipping.tsx`

**Interfaces:**
- Зона: назва, опис, міста й області (рядок через `,`/новий рядок → `text[]`), активність, порядок; «Зробити дефолтною» — `setDefaultShippingZone` + `writeBatch(writeUpsert)` (як `usePriceTypeDefault`). Дефолтну видалити не можна (кнопка вимкнена + 409 → тост).
- Точка: назва, місто, адреса, телефон, зона, активність, порядок, спосіб самовивозу (select лише зі способів `destination === 'pickup-point'`; при одному — автовибір). Системна точка: бейдж, видалення недоступне.

- [ ] **Step 1: Тести (червоні)** — системна точка не має кнопки видалення; select способу не містить адресних способів; setDefault оновлює бейдж в обох рядках без refetch.
- [ ] **Step 2: Реалізація.**
- [ ] **Step 3: Зелене** — Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → PASS (`build` — бо змінено route-файл).
- [ ] **Step 4: Коміт** — `feat(k3-e6a): зони й точки видачі на серверному шарі, огляд доставки знесено`.

---

## Task 8: Гейти легасі

**Files:**
- Modify: `admin/layouts/LegacySupabaseBoundary.tsx` (якщо перелічує шляхи). Реєстр і ратчет уже правлені в Task 6/7 (ред.2); тут — звірка й повний ланцюг

- [ ] **Step 1:** `rg -l useSupabaseClient packages/simplycms/src/admin | wc -l` → **24** (вивід у звіт); `rg -n "shipping" tests/admin-server-first/registry.ts` → порожньо.
- [ ] **Step 2: Повний ланцюг гейтів** (Global Constraints) → усі PASS; вивід — у звіт.
- [ ] **Step 3: Коміт** — `test(k3-e6a): реєстр легасі і ратчет id без доставки`.

---

## Task 9: Живий прогін і доки

**Files:**
- Create: `scripts/live-smoke/admin-shipping.mjs` (`runAdminShippingStep({ context, buyerPage, base, dbUrl, check })`), `scripts/live-smoke/admin-shipping-sql.mjs`
- Modify: `scripts/live-smoke/owner-steps.mjs`; доки: `docs/tasks/v2-state-map.md` (§1, нове §2.8, §3.1, §3.7 — К3-Е5-2 закрито, §6), `docs/tasks/platform-roadmap.md`, `docs/architecture/{plugins,data-layer}.md` (слот видалено; знімок доставки), `CHANGELOG.md`

**Interfaces:**
- Крок іде ПІСЛЯ наявних кроків власника і прибирає за собою створене. Воронка покупця й `resolveStockPoint` покладаються на рівно одну активну точку демо-сіду.
- Дані кроку (ред.2, аудит major 7) — створюються кроком і прибираються в `finally`:
  - товар для самовивозу — демо-товар з обліком залишку (SQL `admin-shipping-sql.mjs`); після створення нової точки власником крок кладе SQL-ом рядок `stock_by_pickup_point` цього товару на нову точку (кількість 5), бо `reserveStock` на точці без залишку відмовляє (`stock-reservation.ts:87`), а обрана точка не має fallback (`stock-write.ts:49`);
  - власник створює ОКРЕМИЙ спосіб «Самовивіз Е6а» (`core:pickup`, `rates`) з тарифом `flat` у зоні «Україна» і точку цього способу (спека, частина 1: «створює спосіб «Самовивіз» і спосіб «Кур'єр»»);
  - доказ setDefault: власник створює зону «Е6а-тест», робить її дефолтною (бейдж переходить), потім повертає дефолт «Україні» і видаляє тестову — ДО оформлення замовлень покупцем, бо тариф самовивозу живе в зоні «Україна».
- Власник у браузері: створює «Самовивіз Е6а» з точкою і тарифом та спосіб «Кур'єр» (`core:address`, `carrier`); пробує видалити «Самовивіз Е6а» → тост «використовується», спосіб на місці; пробує видалити нову точку, коли на ній лежить товар → тост, точка на місці.
- Покупець (окрема сторінка, як `admin-orders-buyer.mjs`): оформлює «Кур'єр» → SQL: `shipping_cost = 0`, `total = subtotal`, `shipping_data.pricing = 'carrier'`; оформлює самовивіз на нову точку → `shipping_data.destination.name` = назва точки; власник перейменовує точку → картка замовлення показує стару назву.
- Прибирання (`finally`, САМЕ в цьому порядку): (1) скасувати тестові замовлення й перевірити `stock_reserved = 0` їхніх позицій; (2) видалити SQL-ом тестовий рядок залишку; (3) деактивувати й видалити точку, тариф, «Самовивіз Е6а» і «Кур'єр». Тестові замовлення лишаються — `pickup_point_id`/`shipping_method_id` → NULL, знімок живий. Після кроку демо знову має рівно одну активну точку й один спосіб самовивозу.

- [ ] **Step 1: Крок `live:smoke`** — Run: `pnpm live:smoke` → 0 FAIL; вивід цілком — у «Факти виконання».
- [ ] **Step 2: Негативний контроль** — у `createOrder` тимчасово писати `shippingData: {}` → крок червоніє на знімку; вивід у звіт; відкотити.
- [ ] **Step 3: Регрес** — пари «підпис | результат» рядків попередніх кроків ідентичні прогону Е5б (`diff` порожній, крім нових рядків).
- [ ] **Step 4: Доки** за Files; лічильник легасі — 24.
- [ ] **Step 5: Повний ланцюг** → PASS; коміт — `docs(k3-e6a): живий прогін доставки, карта стану, changelog`.

## DoD етапу Е6а

1. `pnpm live:smoke` зелений з кроком доставки; негативний контроль Task 9 червоний.
2. Повний ланцюг гейтів зелений; `pnpm lint` = 0 errors / ≤ 8 warnings.
3. `useSupabaseClient` у `src/admin/**` — 24 файли; доставки серед них немає.
4. Review Focus 1–5 закриті тестами, названими в задачах.
5. Картка замовлення показує назву точки (К3-Е5-2 закрито); `orders.delivery_method` і фіктивної `online` немає.
6. Фінальне рев'ю гілки архітектором; коміти без трейлерів (`git log --format=%B main..HEAD | grep -ciE "co-authored|generated with"` = 0).

## Точка передачі

Після Е6а — хвилі Е6 за доменами (рішення власника 2026-10-06): система → знижки з категоріями покупців → покупці й `Dashboard` → контент. Провайдери плагінів — К5, детальний дизайн окремим брейнштормом після К3.
