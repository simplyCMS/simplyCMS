# К2-Е0 «Санація живого контуру вітрини» + борги треку T — план імплементації (ред. 1.3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрити чотири патерни дефектів, доведені живим прогоном (гейт-текст
замість поведінки; N копій доменного правила; стан не в тій фазі рендеру;
список декларації без контролю) — так, щоб демо-магазин із `pnpm db:demo`
проходив картку → кошик → чекаут → рядок в `orders` зі списанням залишку —
і поверненням того ж залишку при скасуванні — без помилок консолі, з валідним sitemap і правдивим бейджем наявності; і щоб гейти
межі клієнт/сервер червоніли на вимкненому захисті й на усіченому списку.

**Architecture:** Дві хвилі одним планом. Хвиля 0 (Tasks 1–5) — борги треку T
у порядку T-1 → T-4 → T-3 → T-2 → T-5: один читач `importProtection()` замість
трьох копій блоку + DATA-тест (T-1); одразу за ним типізація й
`import.meta.dirname` у ВСІХ трьох конфігах і `engines.node >= 22.12.0` у ВСІХ
пʼятьох публікованих пакетах та в `template/package.json.tpl` (T-4, Р6 —
типізує рядок, який поклав T-1); сентинели дерев у
`dist-server-boundary` (T-3); мутаційний крок Import Protection у пілоті й
`pilot:pack` у CI (T-2); §12 без чисел (T-5, документує решту). Хвиля 1
(Tasks 6–14) — К2-Е0: контракт дат «`Date` у застосунку, текст лише на межі
виводу» (`mode: 'date'`); **демо-сід — єдиний власник активної доставки й
залишків** (харнес-фікстури лише додають негативні рядки, ідемпотентно);
`isPurchasable` у домені як єдине правило + write-side декремент під
`decrease_on_order` через `SELECT … FOR UPDATE` **з однієї детермінованої
точки** і scoped-ескалацію ролі в тій самій транзакції — і симетричне
повернення `releaseStock` у ту саму точку при скасуванні (той самий механізм
закриває тритранзакційне `cancelMyOrder`);
`placeOrder` → union з типами в T0 і серверним розрахунком цін і доставки;
кошик на `useSyncExternalStore`; `scripts/live-smoke.mjs` як DoD.

**Tech Stack:** TanStack Start 1.167 (Import Protection, `createServerFn`,
серіалізатор seroval з `Date` у `DefaultSerializable`), React 19
(`useSyncExternalStore`, `hydrateRoot`), Drizzle 0.45 + `pg` (`mode: 'date'`,
pool `options`, `.for('update', { of })`), Zod 4 (`satisfies z.ZodType<…>`),
vitest 4 + jsdom, `@playwright/test` 1.61, Postgres 17 (харнес `test-harness/pg`),
ESLint 10 + `eslint-plugin-jsx-a11y` (одне правило на зону воронки),
pnpm 11.20, Node ≥ 22.12 (вимога `@tanstack/react-start`).

**Spec:** [`docs/superpowers/specs/2026-09-03-k2-e0-storefront-live-contour-design.md`](../specs/2026-09-03-k2-e0-storefront-live-contour-design.md)
(рішення T-1…T-5, Е0-1…Е0-8; рішення власника — Додаток А; відкинуті
альтернативи з доказами — Додаток Б; рішення аудиту r2 — Додаток В; шість
рішень брейншторму ред. 1.3 — Додаток Г). Читати ОБИДВА документи.

> 🔴 **Ред. 1.2 (2026-09-04) — після аудиту r2** (Claude Fable, read-only, HEAD
> `f6f1ef5b`; 4 блокери, 10 major, 9 minor — усі підтверджені проти коду й
> бібліотек у `node_modules`). Що змінено: **(Б1, Б2)** харнес-тести write-side
> і воронки колізували з покупним сідом (залишки тих самих слагів, другий
> дефолт зони проти `idx_shipping_zones_single_default`) — тепер **сід іде
> ПЕРШИМ** серед задач із даними і є єдиною декларацією активної доставки,
> `fixtures/shipping.ts` ідемпотентна поверх сіду, `showcase.ts` і
> `storefront-client.ts` більше не вставляють `pickup`; **(Б3)**
> `admin/pages/OrderStatuses.tsx` — ЖИВА сторінка на `admin-data`, не legacy:
> `createdAt: new Date()`; **(Б4)** точка видачі в чекауті — `<select>`, не
> radio: live-smoke читає `#checkout-pickup-point`, а єдина точка обирається
> автоматично тим самим ефектом, що й метод; **(M1, M2)** `reserveStock` —
> `SELECT … FOR UPDATE OF stock_by_pickup_point`, фліп статусу за
> ЗАБЛОКОВАНИМ залишком, guard на позицію без цілі, сортування позицій проти
> дедлоку; **(M3)** `import.meta.dirname` у ТРЬОХ конфігах (шаблон і оверлей
> теж), `engines.node >= 22.12` у скаффолдері (Start вимагає саме це, `>=20`
> був хибним); **(M4)** негативний контроль Gate IP — `sed` по оверлею пілота,
> бо `template:sync` `vite.config.ts` не синхронізує; **(M5)** фікстура знижки
> — спільний білдер `fixtures/discounts.ts` для showcase і checkout-flow;
> **(M6)** live-smoke не чіпає `.env.local` (явний env уже достатній), гасить
> процеси на SIGINT/SIGTERM, `pageerror` перевіряє в кінці; **(M7)** мертва
> сьома формула `isProductAvailable` видаляється; **(M8, M9)** типи оформлення
> (`PlaceOrderInput`, `PlaceOrderRejection`, `PlaceOrderResult`, `PlacedOrder`)
> — у T0 `contracts/objects/order.ts`, Zod-схема — `satisfies`, каст зникає,
> дубль `CreatedOrder`/`PlacedOrder` злито; **(M10)** канон `data-access`
> отримує правило ескалації, а `cancelMyOrder` стає однією транзакцією;
> **спайк Task 6 знято** — `Date` є в `DefaultSerializable` `router-core`
> (`ssr/serializer/transformer.d.ts:18`), гейт поведінки — live-smoke на
> `order-success`; `decrease_on_order` у демо — `true` (DoD «зі списанням»
> став буквальним); крок `db:diff` у контракті дат знято (потребує живої БД,
> `mode` до DDL не доходить). Нумерація задач змінилась: 14 замість 15.
> 🔴 Після воркфлоу-верифікації ред. 1.2 (14 верифікаторів по задачах × 3
> скептики на знахідку; 25 підтверджених) внесено правки, зокрема: DDL
> `banners.image_url` → nullable (новий файл канону `0004`, бо `NULL` у
> сіді впав би з `23502`); харнес-тест сесійних опцій — self-contained
> (тимчасова БД + канон, інакше ролі `app_runtime` на голому кластері немає);
> `SHIPPING_FIXTURES` розщеплено на активну й негативну частини (повний набір
> поверх сіду давав другий активний тариф); `clearCart` переписаний під
> функціональний `setItems`; `PluginRecord` і `OrderListRow` отримують `Date`;
> `pilot:pack --skip-build` у CI з таймаутом 20 хв; уточнені якорі рядків.
> Другий раунд верифікації (змінені задачі × 3 скептики): негативний контроль
> Task 1 Step 6 відновлює файл із копії, а не `git checkout` (правка Step 4 ще
> не закомічена); чистий ре-білд Gate IP захоплює вивід і червонить
> попередження Vite про `__dirname` у конфізі магазину (єдиний гейт T-4 для
> шаблону); ціна на головній має гейт значення в харнесі; `reserveStock` —
> окремий модуль `stock-reservation.ts` (канон 150 рядків); усі шість імпортів
> форм у `Checkout.tsx` — з `simplycms/checkout-ui`. Третій раунд (змінені
> місця): вторинний ключ `id` у сортуванні головної (однаковий `created_at` у
> рядків одного `insert`), гейт ціни — по featured-набору; контекст кошика —
> `readonly CartItem[]` зі споживачем `CheckoutOrderSummary`; решта — якорі й
> лічильники в докблоках.

> 🔴 **Ред. 1.3 (2026-09-05) — брейншторм-сесія з власником.** Шість рішень:
> три ЗМЕНШУЮТЬ етап (Р2, Р3, Р4 — знімають DDL і розкладання по точках),
> три РОЗШИРЮЮТЬ (Р1, Р5, Р6 — повернення залишку, воронка замість однієї
> теки, всі пакети замість скаффолдера). **(Р1)** Скасування замовлення ПОВЕРТАЄ
> залишок: у ред. 1.2 списання було, повернення — ні, тобто інваріант
> асиметричний (демо-стенд після кількох скасувань показував нуль залишку при
> нулі продажів). Додається `releaseStock` у той самий модуль; `cancelMyOrder`
> в одній транзакції і скасовує, і повертає. **(Р2)** Списання й повернення —
> з ОДНІЄЇ детермінованої точки (`orders.pickup_point_id` → `is_system` →
> перша активна за `sort_order, id`) замість розкладання по кількох: точка
> замовлення вже записана в `orders` (`schema.ts:785`, чекаут її проносить
> `checkout-input.ts:39` → `checkout.ts:110` → `order-create.ts:118`), тож
> повернення точне БЕЗ таблиці резервів. **(Р3)** Банери демо — inline
> `data:`-SVG, а не DDL: `nullable` тягнув би за собою T0-контракт
> (`contracts/objects/banner.ts:14`), заморожений `supabase/database.ts:39`
> (на ньому типізується адмінка до К3), `BannerEdit.tsx:656` (вимагає фото) і
> `BannerSlider.tsx:130` (рендерить `<img>` беззастережно) — а тема банер без
> фото не показує, а ІГНОРУЄ (`HeroBanner.tsx:53`). **К2-Е0 стає етапом БЕЗ
> жодної зміни схеми БД** — міграція `0004` і крок `db:diff` зникають.
> **(Р4)** `decrease_on_order = true` — УМОВНИМ `update` у демо-сіді:
> предикат робить повторний накат НЕ-ПИСЬМОВИМ, коли значення вже `true`
> (той самий клас ідемпотентності, що `on conflict do nothing` у файлі), і
> не перезаписує значення, змінене власником після першого накату; канон
> `0003_seed.sql` не чіпається (А.4). **(Р5)** Правило доступних імен — на ВСЮ воронку (24 підписи
> `checkout-ui` + 13 `profile-ui` + хвости `catalog-ui`/`reviews-ui`, усі при
> нулі `htmlFor`), а гейт — зона `jsx-a11y/label-has-associated-control`, бо
> правило лише для `checkout-ui` лишало б два стандарти в одній воронці.
> **(Р6)** `engines.node >= 22.12.0` — на всі пʼять пакетів і шаблон: `>=20`
> стояв рівно там, де Start не тягнеться (`cli`, скаффолдер), а флагман і
> `package.json.tpl`, які його тягнуть, не декларували нічого.

## Ступінь обовʼязковості — читати ПЕРШИМ

🔴 Цей документ — план імплементації, а не специфікація до останнього рядка.
Дві категорії з різним статусом; плутати їх дорого в обидва боки.

**КАНОН — обовʼязковий. Розбіжність із ним — привід зупинитись і спитати,
а не вирішити самому:**

- контракти репо: дат (Е0-2), `id`, серверного env, ключів кешу React Query;
- межі: клієнт/сервер (`contracts/server-only`), тір-зони T0→T5, ролі й
  транзакції (ескалація, `withActor`), RLS і гранти;
- **що саме мусить доводити кожен гейт** — урок P1 §1 спеки: гейт не обіцяє
  більше, ніж перевіряє; якщо крок не може довести обіцяне, змінюється
  обіцянка, а не формулювання;
- рішення власника: Додаток А спеки (2026-09-03) і Додаток Г (2026-09-05);
- канон 150 рядків на файл; коментарі українською, що пояснюють ПРИЧИНУ;
  новий рядок інтерфейсу — в ОБИДВА каталоги i18n;
- DoD кожної задачі й порядок задач у хвилі.

**ОРІЄНТИР — виконавець змінює сам, якщо канон не постраждав, і НЕ приходить
за дозволом:**

- сніпети коду: імена локальних змінних, порядок аргументів, розкладка на
  модулі та їхні назви (канон тут — лише 150 рядків і межа server-only);
- якорі `файл:рядок` — вимір на момент написання плану; шукати за унікальним
  текстом, номер лише орієнтир;
- лічильники: скільки кейсів у тесті, скільки рядків стане у файлі;
- точні формулювання коментарів, повідомлень і тіла комітів.

**Правило вирішення конфлікту:** якщо код розійшовся з ОРІЄНТИРОМ — переважає
код, план мовчки адаптується. Якщо код розійшовся з КАНОНОМ — зупинись і
принеси розбіжність замовникові: можливо, змінився канон, і тоді правиться
спека, а не задача.

## Global Constraints

Діють у кожній задачі; у кроках не повторюються.

- **Без зворотної сумісності й перехідних шимів** (рамка V2/К0/К3): клієнтів
  і реальних магазинів немає; критерій — вартість експлуатації, не ціна
  переписування.
- **Без нових абстракцій поверх наявних; максимальне перевикористання**:
  `useSyncExternalStore`-патерн `plugins/HookRegistry.ts`; `domain/inventory`
  як єдине місце правила наявності; result-union як у
  `storefront-routes/server/profile-orders.ts` (`OrderCancelResult`);
  `resolveShippingRate`/`resolvePrice`/`resolveDiscount` з домену на сервері;
  `mode: 'date'` з `schema/auth.ts`; харнес `test-harness/pg` + `fixtures/`
  (демо-сід — база, фікстури — лише дельта); `scripts/pilot-pack/report.mjs::step`;
  `gate-b.mjs` для live-smoke; ескалація ролі — ОДИН механізм для списання
  залишку, його повернення і скасування замовлення; механізм ЗОН
  `eslint.config.mjs` (як у тір-правил та i18n-селекторів) — для гейта
  доступних імен.
- **Коментарі в коді — українською, пояснюють ПРИЧИНУ** (🔴 для
  неочевидного), не переказують код (`coding-style.instructions.md`).
- **Порядок гейтів** (CLAUDE.md): `pnpm install --frozen-lockfile →
  format:check → lint → build → typecheck → test → test:schema →
  build:packages → typecheck:template → test:packaging`; у релізі ще
  `pilot:pack`.
- **Мінімальний гейт кожної задачі перед комітом:** `pnpm format:check &&
  pnpm lint && pnpm test`. Задачі з харнесом — ще `pnpm test:schema`
  (потрібен Postgres: `docker start simplycms-review-pg` →
  `PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55434/postgres`, або
  ефемерний `initdb`). Задачі з `dist` — ще `pnpm build:packages && pnpm
  test:packaging`; Task 4 — ще `pnpm pilot:pack`.
- **`pnpm lint` = 0 errors / 12 warnings — норма**; новий error — червоне.
- **Контракт id:** кожен INSERT у 41 таблицю «Категорії A» передає `id`
  явно (`randomUUID()` на сервері; статичні UUID у сідах).
- **Контракт серверного env:** серверний код читає ЛИШЕ `process.env` і лише
  в рантаймі; `import.meta.env` — тільки клієнт.
- **Контракт ключів кешу:** сегмент 0 `queryKey` — з `simplycms/contracts/entities`.
- **i18n:** новий рядок інтерфейсу — ключ в ОБОХ каталогах (`uk` і `en`;
  парність стереже `tests/i18n-catalog-parity.test.ts`); кирилиця в JSX —
  помилка лінту.
- **Харнес-тести й демо-сід.** Тести, що накатують `demo/demo-seed.sql`,
  спираються на його дані (слаги, ціни, назви, доставку, залишки) як на базу
  і ДОДАЮТЬ лише те, чого сід не має. Фікстура, яка може котитись і поверх
  сіду, і поверх канону, — ідемпотентна (`on conflict … do nothing`,
  посилання за `code`/`is_default`, не за іменем).
- **Кожен коміт** — двома трейлерами атрибуції сесії-виконавця, дослівно:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` і
  `Claude-Session: https://claude.ai/code/session_<id сесії-виконавця>`.
  Команди `git commit` нижче показують лише тіло; перевірка —
  `git show -s --format=%B HEAD | tail -2`.
- **`$SCRATCH`** — scratchpad сесії-виконавця; у репо тимчасові файли не
  кладуться. Робота — у гілці `claude/k2-e0-storefront-live-contour` від
  `main` (PR #47 треку T уже змержено). Прямі коміти в `main` заборонені —
  мерж публікує пакети на npm.
- **Робоче дерево після кожного кроку з мутацією — чисте** (`git status
  --porcelain` порожній), окрім файлів, які крок навмисно змінює.

---

## Мапа файлів

**Створюються:**

| Файл | Відповідальність |
|---|---|
| `scripts/pilot-pack/gate-ip.mjs` | Мутаційний гейт: роут-витік (bare і відносний) валить `vite build` скретча з `[import-protection]`; чистий ре-білд після |
| `packages/simplycms/src/react-query/__tests__/cart-hydration.test.tsx` | Гідраційний негативний контроль: `renderToString` → jsdom → `hydrateRoot` з передзаповненим `localStorage`, нуль recoverable errors |
| `packages/simplycms/test-harness/pg/__tests__/db-session-options.test.ts` | `DateStyle`/`TimeZone` сесії детерміновані пулом |
| `packages/simplycms/test-harness/pg/__tests__/fixtures/discounts.ts` | Білдер `percentDiscountStatements()` — один ланцюг group → discount → condition → target для showcase і checkout-flow |
| `packages/simplycms/test-harness/pg/__tests__/order-stock.test.ts` | Декремент залишку при замовленні, переворот статусу за ЗАБЛОКОВАНИМ залишком, два конкурентні кейси, відмова при нестачі |
| `packages/simplycms/test-harness/pg/__tests__/checkout-flow.test.ts` | Кошик → `placeOrderFor` → рядок в `orders`; серверна ціна й знижка; три доменні відмови |
| `packages/simplycms/src/storefront/loaders/checkout-items.ts` | Серверне ціноутворення позицій: назви, статуси, секції, ціни за id — те саме середовище знижок, що `getDiscountEnvironment` |
| `packages/simplycms/src/storefront/loaders/entities/new-order.ts` | `NewOrderItem`, `NewOrderInput`, `CreatedOrder` — форми даних виїжджають з `order-create.ts` (145 рядків при каноні 150) |
| `packages/simplycms/src/storefront/loaders/stock-write.ts` | `StockTarget`, `StockLine`, `LockedStockRow`, `resolveStockPoint` (одна детермінована точка), `lockTargetStock` (`SELECT … FOR UPDATE`) |
| `packages/simplycms/src/storefront/loaders/stock-status.ts` | `setTargetStatus` — переворот `stock_status` цілі за ЗАБЛОКОВАНОЮ сумою залишку |
| `packages/simplycms/src/storefront/loaders/stock-reservation.ts` | `InsufficientStockError`, `reserveStock`, `releaseStock` — правила однієї позиції над заблокованими рядками |
| `packages/simplycms/src/storefront/loaders/order-stock.ts` | `loadStockManagement`, `reserveOrderStock`, `releaseOrderStock` — рівень замовлення, єдиний вхід для `createOrder` і `cancelMyOrder` |
| `packages/simplycms/src/storefront/loaders/place-order.ts` | `placeOrderFor` — уся логіка оформлення (валідація, ціни, доставка, запис) у server-only дереві; serverFn лишається тонким |
| `packages/simplycms/src/checkout-ui/__tests__/accessible-controls.ts` | Спільний ПОВЕДІНКОВИЙ асерт форм чекауту (`getByLabelText` справді знаходить контрол); структурний гейт на всю воронку дає ESLint-зона |
| `packages/simplycms/src/checkout-ui/__tests__/CheckoutDeliveryForm.test.tsx` | Empty-state без способів доставки; автовибір єдиної точки; доступні імена контролів |
| `packages/simplycms/src/checkout-ui/__tests__/CheckoutContactForm.test.tsx` | Доступні імена чотирьох полів контактів |
| `tests/env-contract.test.ts` | Пін контракту env: `.env.example` ↔ `doctor-checks.mjs` |
| `scripts/live-smoke.mjs` + `scripts/live-smoke/{sql,funnel}.mjs` | DoD як скрипт: оркестрація, прямий SQL (через `gate-b.mjs`) і браузерна воронка (кошик, бейдж, автовибір точки, оформлення зі списанням, скасування з поверненням, `pageerror`) — три файли, бо один вийшов би за канон 150 рядків |
| `tests/engines-node-floor.test.ts` | Пін порогу Node: жоден із пʼяти пакетів і шаблон не слабші за вимогу встановленого `@tanstack/react-start` (T-4) |

**Змінюються:**

| Файл | Що саме |
|---|---|
| `packages/simplycms/src/contracts/server-only.ts`, `contracts/README.md` | три хелпери → `importProtection()`; рядок README (T-1) |
| `vite.config.ts`, `packages/create-simplycms-store/template/vite.config.ts`, `tests/pilot/store-template/vite.config.ts` | один рядок `importProtection: importProtection(),`; `import.meta.dirname` у ВСІХ трьох (оверлей — включно з `#region pilot-only`); розширення `.ts` у кореневому (T-1, T-4) |
| `tests/import-protection-wiring.test.ts` | DATA-тест + анкерований рядок (T-1) |
| `scripts/pilot-pack/run.mjs`, `scripts/pilot-pack.mjs:16-17, 24, 33, 70-72`, `scripts/pilot-pack/build.mjs` | крок Gate IP наприкінці, `IP` у таблиці режимів і `describeScope` (T-2); `startStore(storeDir, port, extraEnv)` (Е0-8) |
| `.github/workflows/workflow.yml:95, 127-130, 175-181` | крок `pnpm pilot:pack --skip-build` у job `packaging`, таймаут 20 хв; коментар про пілот (T-2) |
| `tests/dist-server-boundary.test.ts` | `SENTINELS` (T-3) |
| `packages/create-simplycms-store/template/tsconfig.json`, `tsconfig.template.json` | `vite.config.ts` в `include` (T-4) |
| `packages/simplycms/package.json`, `packages/cli/package.json`, `packages/create-simplycms-store/package.json`, `packages/simplycms-theme-solarstore/package.json`, `packages/simplycms-plugin-faq/package.json`, `packages/create-simplycms-store/template/package.json.tpl` | `engines.node >= 22.12.0` у ВСІХ пʼяти публікованих пакетах і в шаблоні (T-4) |
| `vitest.config.ts` | `import.meta.dirname` (T-4) |
| `docs/architecture/test-contours.md` §12 | структурні твердження (T-5, Task 14) |
| `CLAUDE.md` | `pilot:pack` у CI і `IP` у Quick Reference (`:39`); env-тексти; `db:demo` покупний; `live:smoke` |
| `packages/simplycms/src/db/client.ts` | `options` пулу (Е0-2) |
| `packages/simplycms/src/schema/schema.ts`, `schema/media.ts` | `mode: 'string'` → `mode: 'date'` (Е0-2) |
| `packages/simplycms/src/storefront/seo/sitemap.ts`, `loaders/sitemap.ts`, `seo/__tests__/sitemap.test.ts`, `test-harness/pg/__tests__/storefront-loaders.test.ts` | `Date` + `toISOString()` на межі; чесні тести (Е0-2) |
| `packages/simplycms/src/storefront-routes/pages/{OrderSuccess,ProfileOrders,ProfileOrderDetail,Profile}.tsx` | `formatDate(date: Date)` (Е0-2) |
| `packages/simplycms/src/admin/pages/OrderStatuses.tsx`, `admin-data/__tests__/order-statuses-collection.test.ts:15,90,121,135`, `domain/discounts.ts` | `createdAt: new Date()` — жива сторінка на колекції; моки й асерти тесту на `Date`; `isWithinDateRange(Date \| null …)` (Е0-2) |
| `packages/simplycms/src/storefront/loaders/entities/order.ts:28`, `loaders/reviews.ts:23-24`, `contracts/objects/{banner,order,shipping,catalog,discount}.ts` | рядки й контракти з датами → `Date` (Е0-2) |
| `packages/simplycms/src/plugins/types.ts:70-77`, `plugins/server/registry-db.ts:63-64`, `plugins/__tests__/bootstrap.test.ts:42-43` | `PluginRecord.installed_at/updated_at: Date \| null`; `Plugin` (supabase-шар адмінки) лишається на рядках (Е0-2) |
| `packages/simplycms/src/storefront-routes/__tests__/home-n-plus-one.test.tsx:84-91` | фабрика `HomeProduct` з `price`/`old_price` (Е0-6) |
| `packages/simplycms/src/domain/README.md:27`, `contracts/entities.ts:170,196` | документація правила наявності й читань лістингу (Е0-3) |
| `.github/instructions/data-access.instructions.md` | розділи «Контракт дат» (Е0-2) і «Ескалація ролі покупцем» (Е0-3) |
| `packages/simplycms/migrations/demo/demo-seed.sql`, `test-harness/pg/__tests__/seed-determinism.test.ts:12,21,33` | доставка/зона/ОДНА системна точка (`is_system = true` — склад для замовлень без власної точки видачі)/тариф/залишки; `decrease_on_order = true` УМОВНИМ `update`; банери — inline `data:`-SVG замість неіснуючих файлів; лічильники піна (Е0-6) |
| `packages/simplycms/test-harness/pg/__tests__/fixtures/{shipping,showcase,storefront-client}.ts`, `storefront-showcase.test.ts` | одна декларація `pickup` — сід; фікстури ідемпотентні; лічильник точок (Е0-6) |
| `packages/simplycms/src/storefront/loaders/pricing.ts`, `loaders/entities/home-product.ts`, `loaders/home.ts`, `loaders/home-sections.ts`, `storefront-routes/pages/home/{types,toCardViewModel}.ts`, `storefront-routes/views/HomeView.tsx` | `loadPricesByProduct`; ціна на головній; посилання «Ф1» зняті (Е0-6) |
| `packages/simplycms/src/domain/inventory.ts`, `domain/__tests__/inventory.test.ts`, `contracts/objects/inventory.ts` | `isPurchasable`, `schemaOrgAvailability`; `stock_status: StockStatus \| null` (Е0-3) |
| `packages/simplycms/src/core/hooks/useStock.ts`, `core/index.ts` | мертва `isProductAvailable` видалена (Е0-3) |
| `packages/simplycms/src/storefront/loaders/{stock-info,stock,catalog-products}.ts` | споживачі правила; зайві читання залишків у лістингу зняті (Е0-3) |
| `packages/simplycms/routes/storefront/_storefront/catalog/$sectionSlug/$productSlug.tsx` | JSON-LD через `schemaOrgAvailability` (Е0-3) |
| `packages/simplycms/test-harness/pg/__tests__/fixtures/storefront-client.ts`, `storefront-client-queries.test.ts` | фікстура `tryfazny` → `out_of_stock` (Е0-3) |
| `packages/simplycms/src/storefront/loaders/db.ts`, `loaders/session.ts` | `OperatorEscalation` у `withCustomerDb`/`withOrderTokenDb`, прокидання через `withSessionDb` (Е0-3) |
| `packages/simplycms/src/storefront/loaders/order-create.ts`, `loaders/index.ts` | `createOrder(…, operator)` списує через `reserveOrderStock` (`order-stock.ts`); повертає `PlacedOrder`; реекспорти `stock-reservation`, `order-stock`, типи `entities/new-order`, `checkout-items`, `place-order` — 🔴 `stock-write` і `stock-status` НЕ реекспортуються (Е0-3, Е0-4) |
| `packages/simplycms/src/storefront-routes/server/profile-orders.ts`, `test-harness/pg/__tests__/storefront-personal-data.test.ts` | `cancelMyOrder` — одна транзакція з ескалацією, яка скасовує І ПОВЕРТАЄ залишок у ту саму точку (Е0-3) |
| `packages/simplycms/src/contracts/objects/order.ts` | `CheckoutItemInput`, `PlaceOrderInput`, `PlaceOrderRejection`, `PlacedOrder`, `PlaceOrderResult` (Е0-4) |
| `packages/simplycms/src/storefront-routes/server/{checkout,checkout-input}.ts` | тонкий serverFn; схема `satisfies` контракту (Е0-4) |
| `packages/simplycms/src/storefront-routes/pages/Checkout.tsx` | мапа `reason → MessageKey`, нова форма запиту, `FormMessage`, `canSubmit` (Е0-4) |
| `packages/simplycms/src/{checkout,profile,catalog,reviews}-ui/*.tsx` | empty-state, автовибір єдиної точки й `disabled` — у `checkout-ui`; `id`/`htmlFor` на КОЖНОМУ контролі ВСІЄЇ воронки: 24 підписи `checkout-ui`, 13 `profile-ui`, по одному-трьох у `catalog-ui`/`reviews-ui` (Е0-4) |
| `eslint.config.mjs`, `package.json`, `pnpm-lock.yaml` | зона `jsx-a11y/label-has-associated-control` (error) на пʼять `*-ui` тек воронки; devDep `eslint-plugin-jsx-a11y`; 🔴 лок перегенеровано В ТОМУ Ж кроці — інакше `--frozen-lockfile` валить увесь CI (урок PR #20) (Е0-4) |
| `packages/simplycms/src/i18n/catalogs/{uk,en}/checkout.ts` | ключі `checkout.rejected.*`, `checkout.noShippingMethods.*` (Е0-4) |
| `packages/simplycms/src/react-query/useCart.tsx`, `checkout-ui/CheckoutOrderSummary.tsx:11` | стор на `useSyncExternalStore`; контекст `readonly CartItem[]` (Е0-5) |
| `.github/instructions/optimization.instructions.md:54` | рецепт гідратації (Е0-5) |
| `.env.example`, `docs/tasks/v2-state-map.md` §1, §2, §3.4, §6 | env-тексти; датований прогін; закриті борги (Е0-7, Е0-8) |
| `docs/tasks/platform-roadmap.md` | К2-Е0 ✅, борги T ✅, борг 0.4.1-4 ✅ (Е0-8) |
| `package.json` | скрипт `live:smoke` (Е0-8) |

**Видаляються:** нічого файлом (три старі хелпери декларації зникають
усередині T-1; `CreatedOrder`, локальний `PlacedOrder` у `checkout-input.ts`
і `isProductAvailable` — усередині своїх задач).

---
## Хвиля 0 — борги треку T

### Task 1: `importProtection()` — один читач замість трьох копій (T-1)

**Files:**
- Modify: `packages/simplycms/src/contracts/server-only.ts:98-141`
- Modify: `vite.config.ts:5-11, 37-60`
- Modify: `packages/create-simplycms-store/template/vite.config.ts:5-9, 38-61`
- Modify: `tests/pilot/store-template/vite.config.ts` (той самий блок, що в шаблоні; парність — `tests/create-store-template-parity.test.ts`)
- Modify: `packages/simplycms/src/contracts/README.md:30` (рядок про `server-only`)
- Test: `tests/import-protection-wiring.test.ts` (переписати)

**Interfaces:**
- Produces: `importProtection(): ImportProtectionOptions` з
  `simplycms/contracts/server-only` — повний обʼєкт опції Start; тип —
  `NonNullable<NonNullable<Parameters<typeof tanstackStart>[0]>['importProtection']>`.
  Старі `serverOnlySpecifiers`/`serverOnlyFiles`/`serverOnlyExcludeFiles`
  видаляються разом із докблоками (читачів поза трьома конфігами — нуль;
  перевірено `git grep`).
- Consumes: `SERVER_ONLY`, `SERVER_ONLY_DEPS`, `serverOnlyDepSpecifier` (той самий файл).

- [ ] **Step 1: Переписати wiring-тест — спершу червоний**

Замінити вміст `tests/import-protection-wiring.test.ts` на:

```ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importProtection } from 'simplycms/contracts/server-only';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Гейт підключення Import Protection (трек T; переписаний К2-Е0, T-1).
 *
 * 🔴 Попередня версія перевіряла ТЕКСТ трьох конфігів неанкерованими
 * регексами — і зеленіла на закоментованому блоці та на `enabled: false`
 * (штатна опція Start, яка вимикає плагін цілком). Тепер дві половини:
 *   1. ДАНІ — сам обʼєкт, який конфіги передають плагіну, перевіряється
 *      викликом хелпера декларації, а не читанням файлу;
 *   2. ТЕКСТ — рівно один анкерований рядок на конфіг: конфіг передає саме
 *      цей обʼєкт і не має поруч `enabled:`.
 * Поведінку (що збірка справді падає) доводить Gate IP пілота — `pnpm
 * pilot:pack`, у CI job `packaging`.
 */

const CONFIGS = [
  ['хост', 'vite.config.ts', './packages/simplycms/src/contracts/server-only.ts'],
  [
    'шаблон магазину',
    'packages/create-simplycms-store/template/vite.config.ts',
    'simplycms/contracts/server-only',
  ],
  [
    'оверлей пілота',
    'tests/pilot/store-template/vite.config.ts',
    'simplycms/contracts/server-only',
  ],
] as const;

describe('Import Protection: дані декларації', () => {
  const options = importProtection();

  it('режим error, усі імпортери, жодного enabled', () => {
    expect(options.behavior).toBe('error');
    expect(options.include).toEqual(['**']);
    // 🔴 Відсутність ключа, а не `enabled !== false`: `enabled: undefined`
    // теж читається плагіном як «увімкнено», але ключ у обʼєкті — сигнал,
    // що хтось уже торкався перемикача.
    expect('enabled' in options).toBe(false);
  });

  it('client: три набори, і files несе дефолт Start вручну', () => {
    const client = options.client!;
    expect(client.specifiers!.length).toBeGreaterThanOrEqual(2);
    expect(client.files).toContain('**/*.server.*');
    expect(client.files!.length).toBe(2);
    expect(client.excludeFiles!.length).toBe(1);
  });

  it('specifiers ловлять server-only субшляхи й серверні залежності, пускають клієнтське', () => {
    const rx = (client: NonNullable<typeof options.client>) =>
      client.specifiers!.filter((p): p is RegExp => p instanceof RegExp);
    const denied = (s: string) => rx(options.client!).some((r) => r.test(s));
    expect(denied('simplycms/db')).toBe(true);
    expect(denied('simplycms/storefront/loaders')).toBe(true);
    expect(denied('simplycms/admin-server/impl')).toBe(true);
    expect(denied('better-auth')).toBe(true);
    expect(denied('better-auth/reactor')).toBe(true);
    expect(denied('better-auth/react')).toBe(false);
    expect(denied('simplycms/ui')).toBe(false);
    expect(denied('simplycms/admin-server')).toBe(false);
  });

  it('files ловлять server-only дерева і в src, і в dist; excludeFiles пускає лише ядро з node_modules', () => {
    const files = options.client!.files!.filter(
      (p): p is RegExp => p instanceof RegExp,
    );
    const deniedFile = (s: string) => files.some((r) => r.test(s));
    expect(deniedFile('packages/simplycms/src/db/index.ts')).toBe(true);
    expect(
      deniedFile(
        'node_modules/.pnpm/simplycms@0.4.1/node_modules/simplycms/dist/auth/index.js',
      ),
    ).toBe(true);
    expect(deniedFile('packages/simplycms/src/ui/button.tsx')).toBe(false);
    expect(deniedFile('packages/simplycms-theme-solarstore/src/index.ts')).toBe(false);

    const [exclude] = options.client!.excludeFiles as RegExp[];
    expect(exclude.test('node_modules/react/index.js')).toBe(true);
    expect(
      exclude.test(
        'node_modules/.pnpm/simplycms@0.4.1/node_modules/simplycms/src/db/client.ts',
      ),
    ).toBe(false);
  });
});

describe.each(CONFIGS)('Import Protection у конфізі: %s', (_l, file, specifier) => {
  const source = readFileSync(join(REPO, file), 'utf8');

  it('імпортує рівно хелпер importProtection з декларації', () => {
    const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(source).toMatch(
      new RegExp(`^import \\{ importProtection \\} from '${escaped}';$`, 'm'),
    );
  });

  it('передає обʼєкт декларації одним анкерованим рядком і не чіпає enabled', () => {
    // 🔴 Анкер `^\s*` — щоб `// importProtection: …` (закоментований) не
    // рахувався; `enabled:` у будь-якій формі — червоне.
    expect(source).toMatch(/^\s*importProtection: importProtection\(\),$/m);
    expect(source).not.toMatch(/^\s*enabled\s*:/m);
  });
});
```

🔴 Специфікатор хоста в `CONFIGS` — З розширенням `.ts`: Step 4 цієї ж
задачі переписує імпорт декларації в кореневому `vite.config.ts` саме на цю
форму (Vite попереджає про імпорт без розширення під `configLoader:
'native'`), тож розширення — частина T-1, і Task 2 його більше не чіпає.

- [ ] **Step 2: Запустити — має впасти на імпорті `importProtection`**

Run: `pnpm vitest run tests/import-protection-wiring.test.ts`
Expected: FAIL — `importProtection` is not exported / not a function.

- [ ] **Step 3: Замінити три хелпери одним у декларації**

У `packages/simplycms/src/contracts/server-only.ts` рядки 98–141 (три
експортовані хелпери з докблоками, до кінця файлу) замінити на:

```ts
import type { tanstackStart } from '@tanstack/react-start/plugin/vite';

/** Форма опції `importProtection` плагіна Start — з його ж сигнатури. */
export type ImportProtectionOptions = NonNullable<
  NonNullable<Parameters<typeof tanstackStart>[0]>['importProtection']
>;

/**
 * Читач 6 — Import Protection (Vite-плагін Start), КЛІЄНТСЬКЕ середовище.
 * Повний обʼєкт опції, який три `vite.config.ts` (хост, шаблон магазину,
 * оверлей пілота) передають плагіну ОДНИМ рядком. Складати його на місці
 * означало б три копії, які розходяться, — і саме така копія колись дала
 * гейт, що зеленів на `enabled: false`.
 *
 * 🔴 Три пастки Start, усі виміряні (2026-09-02):
 *   • за замовчуванням перевіряються лише імпортери в `src/` — тому
 *     `include: ['**']`: теми, плагіни й сам пакет ядра в node_modules
 *     інакше поза перевіркою;
 *   • `specifiers` ловлять bare-імпорт у магазині, але в монорепо alias
 *     `simplycms/*` резолвить специфікатор РАНІШЕ за перевірку — тому поруч
 *     є `files` по резолвленому шляху; форма `simplycms/(src|dist)` покриває
 *     і `packages/simplycms/src/…`, і `node_modules/simplycms/src/…`
 *     (`src` їде в tarball), а сторонні `simplycms-*` не чіпає (дефіс);
 *   • `files` і `excludeFiles` дефолт Start ЗАМІЩУЮТЬ (`pick(user,
 *     default)`), а `specifiers` — зливаються. Тому `'**/*.server.*'`
 *     дописано вручну (інакше конвенція Start мовчки зникла б у кожному
 *     магазині), а дефолтний `'**/node_modules/**'` замінено лукахедом, що
 *     виключає все в node_modules, КРІМ пакета ядра: сторонній плагін чи
 *     тема мають `simplycms` у залежностях, pnpm кладе симлінк на ядро
 *     ПОРУЧ (`node_modules/.pnpm/simplycms@x/node_modules/simplycms/src/…`),
 *     і відносний шлях звідти в `simplycms/src/db` обійшов би `specifiers`,
 *     а наш лінт чужого коду не бачить. Слеш у `simplycms/` обовʼязковий —
 *     `simplycms-theme-*` лишаються виключеними.
 *
 * `behavior: 'error'` для dev і build — рішення власника 2026-09-02.
 * Ключа `enabled` тут немає навмисно: його наявність у будь-якому конфізі —
 * червоне для `tests/import-protection-wiring.test.ts`.
 *
 * 🔴 `import type` з peer-пакета `@tanstack/react-start` — єдине зовнішнє
 * ребро T0, і воно лише типове: рантайм-залежностей контракти не отримують,
 * але споживач `.d.ts` цього субшляху мусить мати Start у дереві (магазин
 * має його за побудовою).
 */
export const importProtection = (): ImportProtectionOptions => ({
  behavior: 'error',
  include: ['**'],
  client: {
    specifiers: [
      new RegExp(`^simplycms/(${alternation})(/|$)`),
      ...SERVER_ONLY_DEPS.map(serverOnlyDepSpecifier),
    ],
    files: [
      new RegExp(`simplycms/(src|dist)/(${alternation})(/|\\.[tj]sx?$)`),
      '**/*.server.*',
    ],
    excludeFiles: [/^(?!.*node_modules\/simplycms\/).*node_modules\//],
  },
});
```

Імпорт типу поставити у верх файлу (перший рядок — `import type …`); решта
файлу без змін.

- [ ] **Step 4: Три конфіги — один рядок**

У кожному з трьох `vite.config.ts` замінити імпорт трьох хелперів на
`import { importProtection } from '<специфікатор>';` (хост —
`'./packages/simplycms/src/contracts/server-only.ts'`, шаблон і оверлей —
`'simplycms/contracts/server-only'`), а блок `importProtection: { … }` (від
`importProtection: {` до відповідної `},`) разом із коментарем над ним — на:

```ts
        // 🔴 Межа довіри клієнт/сервер у САМІЙ збірці магазину: Start валить
        // збірку (dev і build) з трасою імпорту. Обʼєкт опції — з єдиної
        // декларації ядра (там же пояснено три пастки Start); тут — один
        // рядок, і гейт `tests/import-protection-wiring.test.ts` стереже,
        // що він саме такий і без `enabled:` поруч.
        importProtection: importProtection(),
```

У оверлеї пілота — той самий блок (він побайтово збігається з шаблонним
поза `#region pilot-only`; парність асертить
`tests/create-store-template-parity.test.ts`).

- [ ] **Step 4а: README контрактів**

У `packages/simplycms/src/contracts/README.md:30` фрагмент «і три набори патернів
Import Protection магазину — `serverOnlySpecifiers()`, `serverOnlyFiles()`,
`serverOnlyExcludeFiles()`» → «і `importProtection()` — повний обʼєкт опції
Import Protection Start (читач 6), який три `vite.config.ts` передають одним
рядком; єдине зовнішнє ребро T0 — `import type` з peer-пакета
`@tanstack/react-start`».

- [ ] **Step 5: Зелено**

Run: `pnpm vitest run tests/import-protection-wiring.test.ts tests/create-store-template-parity.test.ts`
Expected: PASS (усі кейси обох файлів).

- [ ] **Step 6: Негативний контроль руками — обидва обходи тепер червоні**

🔴 Правка Step 4 ще НЕ закомічена (єдиний коміт задачі — Step 7), тож
`git checkout -- vite.config.ts` відкотив би її цілком, а не лише мутацію
`sed`; еталон — копія файлу після Step 4 у scratchpad.

```bash
cp vite.config.ts "$SCRATCH/vite.config.step4"
sed -i 's/^\(\s*\)importProtection: importProtection(),/\1\/\/ importProtection: importProtection(),/' vite.config.ts
pnpm vitest run tests/import-protection-wiring.test.ts 2>&1 | grep -E "✓|✗|×|passed|failed" | tail -4
cp "$SCRATCH/vite.config.step4" vite.config.ts
sed -i 's/^\(\s*\)importProtection: importProtection(),/\1importProtection: {\n\1  enabled: false,\n\1  ...importProtection(),\n\1},/' vite.config.ts
pnpm vitest run tests/import-protection-wiring.test.ts 2>&1 | grep -E "passed|failed" | tail -2
cp "$SCRATCH/vite.config.step4" vite.config.ts
diff -q vite.config.ts "$SCRATCH/vite.config.step4" && git status --porcelain
```

Expected: обидва прогони — `failed` (перший — на анкерованому рядку; другий —
і на анкерованому рядку, і на `enabled:`, який у багаторядковому обʼєкті
стоїть на початку власного рядка — саме так виглядає реальне вимкнення);
`diff -q` мовчить, у `git status` — лише файли Steps 1–4а цієї задачі.

- [ ] **Step 7: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm build
git add packages/simplycms/src/contracts/server-only.ts packages/simplycms/src/contracts/README.md vite.config.ts packages/create-simplycms-store/template/vite.config.ts tests/pilot/store-template/vite.config.ts tests/import-protection-wiring.test.ts
git commit -m "test(k2-e0): Import Protection — один читач importProtection() і DATA-гейт замість тексту

Три копії блоку в vite.config.ts злито в хелпер декларації; тест перевіряє
дані (behavior, include, три набори, відсутність enabled) і один анкерований
рядок на конфіг. Закоментований блок і enabled:false тепер червоні (T-1)."
```

---

### Task 2: Типізація конфігів, `import.meta.dirname` у ТРЬОХ конфігах, `engines.node` як у Start у ВСІХ пʼятьох пакетах і шаблоні (T-4, Р6)

**Files:**
- Modify: `packages/create-simplycms-store/template/tsconfig.json:22`
- Modify: `tsconfig.template.json` (блок `include`)
- Modify: `vitest.config.ts` (усі `resolve(__dirname, …)`)
- Modify: `vite.config.ts` (усі `__dirname`: `loadEnv(mode, __dirname, '')` і аліаси `resolve(__dirname, …)`; 🔴 номери рядків після Task 1 зсунуті — шукати за текстом)
- Modify: `packages/create-simplycms-store/template/vite.config.ts` (`loadEnv` і аліаси `@themes`/`@plugins`)
- Modify: `tests/pilot/store-template/vite.config.ts` (те саме + `resolve(__dirname, \`bundle-stats.${env}.json\`)` усередині `#region pilot-only`)
- Modify: `packages/create-simplycms-store/package.json:14-16` (`engines.node`: `">=20"` → `">=22.12.0"`)
- Modify: `packages/cli/package.json:29-31` (`engines.node`: `">=20"` → `">=22.12.0"`)
- Modify: `packages/simplycms/package.json:472` (блоку `engines` НЕМАЄ — додати після `"license": "MIT",`, перед `"repository"`)
- Modify: `packages/simplycms-theme-solarstore/package.json:30` (те саме — блоку немає)
- Modify: `packages/simplycms-plugin-faq/package.json:39` (те саме — блоку немає)
- Modify: `packages/create-simplycms-store/template/package.json.tpl:6` (блоку немає — додати після `packageManager`)
- Test: `tests/template-typecheck-coverage.test.ts` (існує; сам почервоніє без пари)
- Test: Create `tests/engines-node-floor.test.ts` (пін ШЕСТИ порогів проти
  встановленого `@tanstack/react-start`) — 🔴 ОКРЕМИЙ файл, а не кейс у
  `tests/create-store-template-parity.test.ts`, як планувала ред. 1.2: після Р6
  інваріант стосується пʼятьох пакетів ЯДРА, а той тест — про парність ШАБЛОНУ
  з монорепо (повне обґрунтування — Step 6)

**Interfaces:** нічого не продукує; споживає Task 1 (рядок `importProtection` у
конфізі шаблону тепер типізується проти `dist`).

🔴 Чому три конфіги, а не два (ред. 1.2): Vite у режимі `configLoader:
'bundle'` (дефолт) підставляє і `__dirname`, і `import.meta.dirname`
(`vite/src/node/config.ts`, блок `define`), а попередження про `__dirname` —
forward-compat до майбутнього дефолту `native`. Магазин збирається
ШАБЛОННИМ конфігом, тож DoD «Vite не попереджає» без шаблону й оверлею
стосувався б лише монорепо. `import.meta.dirname` потребує Node ≥ 20.11, але
реальний поріг магазину вищий: `@tanstack/react-start` вимагає `>=22.12.0`
(`node_modules/@tanstack/react-start/package.json`, перевірено на
встановленому `1.167.42`), Vite — `^20.19 || >=22.12`. 🔴 Заміряно по всіх
пʼятьох маніфестах: `engines.node: ">=20"` у скаффолдера й `@simplycms/cli` був
хибним ще до цієї задачі, а `simplycms`, `@simplycms/theme-solarstore` і
`@simplycms/plugin-faq` не заявляли порогу ВЗАГАЛІ — при тому що саме
`simplycms` тримає `@tanstack/react-start` у `peerDependencies`
(`packages/simplycms/package.json:518`, `^1.0.0`). Власні прогони новий поріг
не червонить: усі job-и CI ставлять `node-version: lts/*`
(`.github/workflows/workflow.yml`), тобто Node ≥ 22 — до `Unsupported engine`
там не дійде.

- [ ] **Step 1: Додати `vite.config.ts` у include шаблону — coverage-тест червоніє**

У `packages/create-simplycms-store/template/tsconfig.json` рядок
`"include": ["src", "routes.ts", "simplycms.config.ts"],` →
`"include": ["src", "routes.ts", "simplycms.config.ts", "vite.config.ts"],`.

Run: `pnpm vitest run tests/template-typecheck-coverage.test.ts`
Expected: FAIL — `uncovered: ["packages/create-simplycms-store/template/vite.config.ts"]`.

- [ ] **Step 2: Пара в `tsconfig.template.json`**

У блок `include` додати рядок
`"packages/create-simplycms-store/template/vite.config.ts",` (після
`…/simplycms.config.ts`). Над блоком — коментар:

```jsonc
  // 🔴 `vite.config.ts` шаблону — у програмі: трек T поклав у нього
  // типізований виклик декларації межі, а поза `include` він не типізувався
  // НІДЕ (кореневий tsconfig шаблон виключає) — та сама діра, що колись у
  // `routes.ts`. Пару в `template/tsconfig.json` стереже
  // `tests/template-typecheck-coverage.test.ts`.
```

Run: `pnpm vitest run tests/template-typecheck-coverage.test.ts && pnpm build:packages && pnpm typecheck:template`
Expected: PASS; `tsc -p tsconfig.template.json` — без помилок.

- [ ] **Step 3: Негативний контроль типізації шаблону**

```bash
sed -i "s/server: { entry: '.\/server.ts' },/server: { entry: 42 },/" packages/create-simplycms-store/template/vite.config.ts
pnpm typecheck:template 2>&1 | grep -c "error TS"
git checkout -- packages/create-simplycms-store/template/vite.config.ts
```

Expected: лічильник ≥ 1 (TS2322 на `entry`); після відкату — дерево чисте.

- [ ] **Step 4: `import.meta.dirname` у всіх конфігах**

`vitest.config.ts`: `const pkg = (p: string) => resolve(__dirname, 'packages', p);` →
`const pkg = (p: string) => resolve(import.meta.dirname, 'packages', p);`; так
само `resolve(__dirname, 'packages/simplycms/src')` і два `resolve(__dirname,
'themes'|'plugins')` → `import.meta.dirname`.

`vite.config.ts` (корінь): усі `__dirname` (`loadEnv(mode, __dirname, '')` і
аліаси `resolve(__dirname, …)`) → `import.meta.dirname`; розширення `.ts` в
імпорті декларації вже поставив Task 1 Step 4. 🔴 Номери рядків тут не
наводяться навмисно: Task 1 стиснув імпорт і блок Import Protection, і всі
рядки нижче зсунулись — шукати за текстом.

`packages/create-simplycms-store/template/vite.config.ts`: `__dirname` у
`loadEnv(mode, __dirname, '')` і в двох аліасах `@themes`/`@plugins` →
`import.meta.dirname`.

`tests/pilot/store-template/vite.config.ts`: те саме в `loadEnv` і аліасах І в
`resolve(__dirname, \`bundle-stats.${env}.json\`)` усередині `#region
pilot-only` — парність-тест вирізає регіон і порівнює решту з шаблоном
байт-у-байт, тож текст поза регіоном мусить збігатися з шаблонним.

🔴 Причина — коментарем над першим `import.meta.dirname` у КОЖНОМУ з трьох
`vite.config.ts` (у шаблоні й оверлеї — дослівно однаковий, інакше парність
червона):

```ts
// `import.meta.dirname`, не `__dirname`: конфіг — ESM у пакеті з
// `"type": "module"`; Vite попереджає про `__dirname` під майбутнім
// дефолтом `configLoader: 'native'`, а прямий імпорт конфігу в тестах
// падав саме на ньому (`ReferenceError: __dirname is not defined`).
// Node ≥ 20.11 для цього є за побудовою: Start вимагає ≥ 22.12.
```

Run: `pnpm build 2>&1 | grep -c "unsupported by \`configLoader: 'native'\`"; pnpm test 2>&1 | grep -c "unsupported by"`
Expected: `0` і `0`.

🔴 Це доводить лише монорепо. Що ШАБЛОННИЙ конфіг збирає магазин без цього
попередження, доводить Gate IP пілота (Task 4): його чистий ре-білд скретча
захоплює вивід `vite build` і червонить рядок `unsupported by \`configLoader:
'native'\`` — регрес у шаблоні чи оверлеї ловиться в `pnpm pilot:pack` і CI.

- [ ] **Step 5: Пін шести порогів — новий тест червоніє**

Create `tests/engines-node-floor.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { readPublishableManifests } from '../scripts/release/bump.mjs';

// 🔴 Скаффолдер і CLI обіцяли `>=20`, три інші пакети — нічого, тоді як Start
// у згенерованому магазині вимагає `>=22.12.0`: користувач на Node 20
// проходив `npm create` і падав на першому `pnpm dev`. Поріг пакета не може
// бути нижчим за поріг фреймворку, який цей пакет у магазин приводить.
// Еталон читається зі ВСТАНОВЛЕНОГО Start, а не з константи: бамп Start
// підіймає поріг сам, і тест червоніє замість тихого дрейфу.
// `createRequire` — бо файл ESM: голого `require` у ньому не існує.
const require = createRequire(import.meta.url);
const start = JSON.parse(
  readFileSync(require.resolve('@tanstack/react-start/package.json'), 'utf8'),
) as { engines: { node: string } };

// Порівняння СЕМАНТИЧНЕ, не рядкове: `'>=22.12.0' === floor` зламалось би на
// першому ж бампі Start, а «22.12» одним числом було б МЕНШЕ за «22.9».
// Відсутні компоненти діапазону — нулі (`>=22` ⇒ 22.0.0).
const floor = (range: string): [number, number, number] => {
  const match = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(range);
  if (!match) throw new Error(`не semver-поріг: ${range}`);
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
};

const notBelow = (range: string, reference: string): boolean => {
  const a = floor(range);
  const b = floor(reference);
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
};

describe('engines.node: не нижче за поріг @tanstack/react-start', () => {
  // 🔴 Набір береться з readPublishableManifests() (той самий дискавер, що й
  // у реліз-бампі), а не списком рядком: точний склад пʼяти пакетів уже
  // стереже tests/release-bump-coverage.test.ts, тож новий пакет потрапляє
  // під пін автоматично, а не мовчки зʼїжджає з порогу. Дискавер читає
  // відносний `packages/` — vitest працює з кореня репо, і саме так той тест
  // його вже кличе (рядок 19).
  it.each(
    readPublishableManifests().map(
      ({ manifest }) =>
        [manifest.name, manifest.engines?.node] as [string, string | undefined],
    ),
  )('%s заявляє поріг і він не нижчий за Start', (name, range) => {
    expect(range, `${name}: engines.node відсутній`).toBeDefined();
    expect(notBelow(range!, start.engines.node)).toBe(true);
  });

  // Шостий поріг — шаблон магазину. Файл із плейсхолдерами, але валідний JSON
  // як є (обидва плейсхолдери стоять ЗНАЧЕННЯМИ рядків), тож підстановка тут
  // не потрібна — так само його читає scripts/pilot-pack/create-pkg-checks.mjs.
  it('шаблон магазину (package.json.tpl) не нижчий за Start', () => {
    const tpl = JSON.parse(
      readFileSync(
        'packages/create-simplycms-store/template/package.json.tpl',
        'utf8',
      ),
    ) as { engines?: { node?: string } };
    expect(tpl.engines?.node).toBeDefined();
    expect(notBelow(tpl.engines!.node!, start.engines.node)).toBe(true);
  });
});
```

Run: `pnpm vitest run tests/engines-node-floor.test.ts`
Expected: FAIL — шість кейсів червоні: `@simplycms/cli` і
`create-simplycms-store` дають `>=20` (нижче за `>=22.12.0`), `simplycms`,
`@simplycms/theme-solarstore`, `@simplycms/plugin-faq` і шаблон — `undefined`.

- [ ] **Step 6: `engines.node` у ШЕСТИ файлах — два правляться, чотири додаються**

Два блоки вже є — міняється лише значення:
- `packages/cli/package.json:29-31`: `"node": ">=20"` → `"node": ">=22.12.0"`;
- `packages/create-simplycms-store/package.json:14-16`: те саме.

Чотирьох блоків немає — додати, НЕ ламаючи порядку ключів манифеста. Місце
береться з тих пакетів, що блок уже мають: у `@simplycms/cli` `engines` стоїть
між `"license"` і `"repository"`, і рівно та сама пара є в усіх трьох пакетах,
яким блок додається:
- `packages/simplycms/package.json` — після `"license": "MIT",` (рядок 472), перед `"repository"` (473);
- `packages/simplycms-theme-solarstore/package.json` — після рядка 30, перед 31;
- `packages/simplycms-plugin-faq/package.json` — після рядка 39, перед 40.

```json
  "engines": {
    "node": ">=22.12.0"
  },
```

🔴 Порядок ключів тут не косметика: `bumpTo` у `scripts/release/bump.mjs`
перезаписує манифест як `JSON.stringify(manifest, null, 2)`, тобто зберігає
порядок, отриманий із `JSON.parse` — блок, поставлений «куди попало», рівно
таким і поїде в реєстр на першому ж релізі. Місце обирається один раз, руками.

Шостий файл — шаблон магазину `packages/create-simplycms-store/template/package.json.tpl`.
🔴 Синтаксис перевірено ПЕРЕД правкою: попри розширення `.tpl` файл — валідний
JSON як є (`JSON.parse` бере його без підстановки, бо обидва плейсхолдери,
`__STORE_NAME__` і `__SIMPLYCMS_VERSION__`, стоять значеннями рядків). Пари
`license`/`repository` в ньому немає, тож блок кладеться після
`"packageManager": "pnpm@11.20.0",` (рядок 6), перед `"scripts"` — поруч із
єдиним іншим полем про тулчейн:

```json
  "engines": {
    "node": ">=22.12.0"
  },
```

🔴 Окремий рядок у `tests/create-store-template-parity.test.ts` НЕ потрібен, і
це вимір, а не економія:
- поріг самого шаблону вже пінить `tests/engines-node-floor.test.ts` (Step 5) —
  він читає той самий `package.json.tpl` напряму (парність-тест перед
  `JSON.parse` ще й підставляє плейсхолдери — `:117-119`; для поля `engines`
  підстановка нічого не змінює);
- парність-тест звіряє шаблон з оверлеєм пілота
  (`tests/pilot/store-template/package.json`) лише по полях, що змінюють
  ПОВЕДІНКУ pnpm у скретчі: `packageManager`, склад `dependencies`/
  `devDependencies`, відсутність npm-івського `overrides`. `engines` у це коло
  не входить — заміряно на цій машині: `pnpm install` у теці з
  `"engines": {"node": ">=99.0.0"}` друкує `[WARN] Unsupported engine` і
  виходить з кодом `0` (pnpm 11.20.0, `engine-strict` за замовчуванням
  вимкнений). Оверлей лишається без `engines` свідомо; рядок парності
  знадобиться лише тоді, коли скретч колись піде з `engine-strict=true`.

🔴 Не плутати з `engines.simplycms` — це діапазон сумісності з ЯДРОМ, і живе
він у двох інших місцях: у TS-маніфесті теми/плагіна
(`tests/cli-theme-conformance-run.test.ts:66`) і в записі маркетплейс-індексу
(`tests/marketplace-index.test.ts:45-47, 67` — `engineSchema` = `{ simplycms:
string }`). Інша сутність, інші файли; `scripts/release/manifest-version.mjs`
навмисно її не чіпає — його патерн бʼє лише по літералу `version:`
(`tests/release-bump-coverage.test.ts:102`).

Run: `pnpm vitest run tests/engines-node-floor.test.ts`
Expected: PASS (6/6); тимчасове повернення `">=20"` у будь-якому з шести —
FAIL саме на ньому.

- [ ] **Step 7: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm build && pnpm typecheck && pnpm build:packages && pnpm typecheck:template
git add packages/create-simplycms-store/template/tsconfig.json tsconfig.template.json vitest.config.ts vite.config.ts packages/create-simplycms-store/template/vite.config.ts tests/pilot/store-template/vite.config.ts packages/simplycms/package.json packages/cli/package.json packages/simplycms-theme-solarstore/package.json packages/simplycms-plugin-faq/package.json packages/create-simplycms-store/package.json packages/create-simplycms-store/template/package.json.tpl tests/engines-node-floor.test.ts
git commit -m "build(k2-e0): vite.config.ts шаблону під typecheck:template; import.meta.dirname у трьох конфігах; engines.node >=22.12.0

Шаблон типізується проти dist (негативний контроль — зіпсований тип entry
ловиться); coverage-тест вимагає пару include. Vite не попереджає про
__dirname ні в монорепо, ні в магазині зі шаблону. Поріг Node усіх пʼятьох
публікованих пакетів і шаблону магазину не нижчий за поріг Start (>=22.12.0):
два пакети мали хибний >=20, три не заявляли порогу взагалі; пін —
tests/engines-node-floor.test.ts, набір пакетів бере з readPublishableManifests
(T-4, Р6)."
```

---

### Task 3: Сентинели дерев у `dist-server-boundary` (T-3)

**Files:**
- Modify: `tests/dist-server-boundary.test.ts` (дописати блок після `describe`)

**Interfaces:**
- Consumes: `SERVER_ONLY`, `closure`, `distFiles`, `entryFiles()`, `subpathOf()`, `isServerOnlySubpath()`, `CORE` (той самий файл і `tests/lib/dist-graph.ts`; `closure(entries, unresolved?)` — другий аргумент опційний).
- Produces: нічого зовнішнього.

- [ ] **Step 0: Преflight унікальності — літерал живе ЛИШЕ у своєму дереві**

🔴 Codex r1 спіймав: `[simplycms] Sign-in required` є ще й у трьох клієнтських
`core/lib/{review-form,user-addresses,user-recipients}.ts` — сентинел, що
доживає до клієнтського `dist`, червонить гейт завжди. Кожен кандидат перед
внесенням у мапу — через цей преflight (нуль файлів поза деревом, тести
виключені):

```bash
P=packages/simplycms/src
for pair in "db|[simplycms/db]" "auth|[simplycms/auth]" "schema|wishlists_own_all" \
  "storefront|Disallow: /admin/" "storefront-routes/seo|public, max-age=3600, stale-while-revalidate=86400" \
  "admin-server/impl|patch не може бути порожнім"; do
  tree=${pair%%|*}; lit=${pair#*|}
  n=$(grep -rlF -- "$lit" $P | grep -v __tests__ | grep -vc "^$P/$tree/")
  printf '%-24s %-52s поза деревом: %s\n' "$tree" "$lit" "$n"
done
```

Expected: `0` у кожному рядку (перевірено 2026-09-03 на HEAD `4f48286` і
повторно 2026-09-04 на `f6f1ef5b`: усі шість — 0 поза деревом, ≥1 усередині).

- [ ] **Step 1: Написати блок сентинелів — спершу червоний на навмисно неповній мапі**

Дописати в кінець `tests/dist-server-boundary.test.ts`:

```ts
/**
 * Сентинели дерев — контроль САМОГО списку `SERVER_ONLY` (К2-Е0, T-3).
 *
 * 🔴 Усі шість читачів декларації похідні від списку: приберіть звідти
 * `'storefront'` — лоадери переїдуть у клієнтську групу збірки
 * (`tsdown.config.ts`), Import Protection і Gate C перестануть їх бачити,
 * а партиція вище лишиться зеленою, бо ітерує той самий усічений список.
 * Єдиний контроль, не похідний від списку, — літерал із ДЖЕРЕЛА кожного
 * дерева: він мусить (а) існувати в джерелі (інакше рефакторинг рядка
 * зробить сентинел порожнім мовчки), (б) бути в серверному замиканні
 * `dist`, (в) бути відсутнім у клієнтському. Мапа — свідома друга копія
 * списку: її ключі й `SERVER_ONLY` мусять збігатися.
 *
 * 🔴 Літерали — РЯДКИ коду, не ідентифікатори: клієнтська збірка магазину
 * мініфікує імена, а ці літерали в `dist` пакета лишаються дослівно.
 */
const SENTINELS: Record<(typeof SERVER_ONLY)[number], string> = {
  db: '[simplycms/db]',
  auth: '[simplycms/auth]',
  schema: 'wishlists_own_all',
  storefront: 'Disallow: /admin/',
  'storefront-routes/seo': 'public, max-age=3600, stale-while-revalidate=86400',
  'admin-server/impl': 'patch не може бути порожнім',
};

const SRC = resolve(CORE, 'src');

/** Усі `.ts`/`.tsx` під деревом джерел (без тестів). */
const sourceFilesOf = (tree: string): string[] => {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const next = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(next);
      } else if (/\.tsx?$/.test(entry.name)) out.push(next);
    }
  };
  walk(resolve(SRC, tree));
  return out;
};

describe('сентинели server-only дерев (контроль списку декларації)', () => {
  it('мапа сентинелів покриває рівно список SERVER_ONLY', () => {
    expect(Object.keys(SENTINELS).sort()).toEqual([...SERVER_ONLY].sort());
  });

  it.each(Object.entries(SENTINELS))(
    '%s: літерал є в джерелі дерева',
    (tree, literal) => {
      const hit = sourceFilesOf(tree).some((file) =>
        readFileSync(file, 'utf8').includes(literal),
      );
      expect(hit, `«${literal}» зник із packages/simplycms/src/${tree}`).toBe(true);
    },
  );

  it.each(Object.entries(SENTINELS))(
    '%s: літерал у серверному замиканні dist і відсутній у клієнтському',
    (_tree, literal) => {
      const entries = entryFiles();
      const server = closure(entries.filter((f) => isServerOnlySubpath(subpathOf(f))));
      const client = closure(entries.filter((f) => !isServerOnlySubpath(subpathOf(f))));
      const has = (set: Set<string>) =>
        [...set].some((f) => readFileSync(f, 'utf8').includes(literal));
      expect(has(server), `«${literal}» не знайдено в серверному dist`).toBe(true);
      expect(has(client), `«${literal}» ПРОТІК у клієнтський dist`).toBe(false);
    },
  );
});
```

🔴 `storefront → 'Disallow: /admin/'`: літерал живе в `storefront/seo/robots.ts`
(дерево `storefront`, entry `storefront/seo`) і ніде більше в `src` — тому саме
він, а не рядок із `loaders/session.ts`, який дублюють serverFn-модулі `core/lib`.

Додати в імпорти файлу `readdirSync` (з `node:fs`). 🔴 Перед запуском —
тимчасово прибрати з `SENTINELS` рядок `db:` (щоб побачити, що перший кейс
падає), запустити, повернути.

Run: `pnpm build:packages && pnpm vitest run --config vitest.packaging.config.ts tests/dist-server-boundary.test.ts`
Expected: з прибраним `db` — FAIL «мапа сентинелів…»; з повною мапою — PASS.

- [ ] **Step 2: Негативний контроль на усічення списку**

```bash
sed -i "s/^  'storefront',$/  \/\/ 'storefront',/" packages/simplycms/src/contracts/server-only.ts
pnpm build:packages && pnpm vitest run --config vitest.packaging.config.ts tests/dist-server-boundary.test.ts 2>&1 | grep -E "passed|failed" | tail -2
git checkout -- packages/simplycms/src/contracts/server-only.ts
pnpm build:packages
```

Expected: FAIL (щонайменше «мапа сентинелів…» і «Disallow: /admin/ ПРОТІК у
клієнтський dist»); після відкату й ре-білду — PASS.

- [ ] **Step 3: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm test:packaging
git add tests/dist-server-boundary.test.ts
git commit -m "test(k2-e0): сентинели server-only дерев — усічення SERVER_ONLY червонить packaging

Мапа літералів не похідна від списку: ключі = SERVER_ONLY, літерал є в
джерелі дерева, у серверному замиканні dist і відсутній у клієнтському.
Негативний контроль — закоментований 'storefront' валить гейт (T-3)."
```

---

### Task 4: Gate IP — мутаційний доказ межі в пілоті + `pilot:pack` у CI (T-2)

**Files:**
- Create: `scripts/pilot-pack/gate-ip.mjs`
- Modify: `scripts/pilot-pack/run.mjs:31-60`
- Modify: `scripts/pilot-pack.mjs:16-17, 24, 33, 70-72` (усі чотири текстові згадки набору гейтів і `describeScope`)
- Modify: `.github/workflows/workflow.yml:95, 127-130, 175-181`
- Modify: `CLAUDE.md` (Quick Reference `:39`; рядок job `packaging` у CI/CD-таблиці `:693`; два речення «Порядку гейтів» — `:155` і `:174-175`; 🔴 абзац «Пілот пакування в CI НЕ ганяється» `:700-704` — він стоїть двома рядками під тією ж таблицею й після задачі суперечив би їй)

**Interfaces:**
- Produces: `gateImportProtection(storeDir): { ok: boolean; details: string[] }`.
- Consumes: `execFileSync`/`spawnSync` з `node:child_process` (обидві збірки скретча гейт спавнить сам, щоб захопити вивід); `step` викликає `run.mjs`, не гейт.

- [ ] **Step 1: Написати гейт**

`scripts/pilot-pack/gate-ip.mjs`:

```js
/**
 * Gate IP — Import Protection ВАЛИТЬ збірку магазину на витоку (К2-Е0, T-2).
 *
 * 🔴 Це поведінковий доказ межі клієнт/сервер у РЕАЛЬНОМУ магазині з
 * tarball-ів: юніт `tests/import-protection-wiring.test.ts` перевіряє дані
 * й підключення, а що плагін справді зупиняє збірку — лише прогін. Дві
 * форми витоку, бо їх ловлять РІЗНІ механізми плагіна:
 *   • bare `simplycms/db` — `specifiers`;
 *   • відносна втеча в `node_modules/simplycms/src/db/client` — `files` з
 *     нашим `excludeFiles` (дефолтний виключав би весь node_modules).
 *
 * 🔴 Експорт у відносній формі — РЕАЛЬНИЙ (`resolveDatabaseUrl`): з
 * вигаданим ім'ям Rolldown падає на `MISSING_EXPORT` РАНІШЕ за межу, і
 * червона збірка доводить не те (спіймано на рев'ю 2026-09-03).
 *
 * 🔴 Vite спорожнює `dist/` на старті збірки, тож після червоних збірок
 * скретч перезбирається начисто — інакше `--keep` лишив би порожній dist.
 *
 * 🔴 Чистий ре-білд захоплює вивід: це єдине місце, де конфіг ШАБЛОНУ реально
 * збирає магазин, тож попередження Vite про `__dirname` у конфізі (T-4,
 * `configLoader: 'native'`) ловляться саме тут, а не лише в монорепо.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LEAK_ROUTE = 'src/routes/my/__leak.tsx';
const MARKER = '[import-protection] Import denied';

const LEAKS = [
  {
    label: 'bare simplycms/db (specifiers)',
    source: `import { createFileRoute } from '@tanstack/react-router';
import { withActor } from 'simplycms/db';
export const Route = createFileRoute('/my/__leak')({
  component: () => <div>{typeof withActor}</div>,
});
`,
  },
  {
    label: 'відносна втеча в node_modules/simplycms/src/db/client (files + excludeFiles)',
    source: `import { createFileRoute } from '@tanstack/react-router';
import { resolveDatabaseUrl } from '../../../node_modules/simplycms/src/db/client';
export const Route = createFileRoute('/my/__leak')({
  component: () => <div>{typeof resolveDatabaseUrl}</div>,
});
`,
  },
];

/** `vite build`, який МУСИТЬ упасти; віддає stderr+stdout для пошуку маркера. */
function buildExpectingFailure(storeDir) {
  try {
    execFileSync(join(storeDir, 'node_modules/.bin/vite'), ['build'], {
      cwd: storeDir,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' },
      encoding: 'utf8',
    });
    return { failed: false, output: '' };
  } catch (error) {
    return {
      failed: true,
      output: `${error.stdout ?? ''}${error.stderr ?? ''}`,
    };
  }
}

/** Чиста `vite build`: падіння тут — поламка пілота, не доказ; повертає stdout+stderr. */
function buildCapturing(storeDir) {
  const result = spawnSync(join(storeDir, 'node_modules/.bin/vite'), ['build'], {
    cwd: storeDir,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  if (result.status !== 0) {
    throw new Error(`чистий ре-білд скретча впав:\n${result.stdout}${result.stderr}`);
  }
  return `${result.stdout}${result.stderr}`;
}

/**
 * @param {string} storeDir
 * @returns {{ ok: boolean; details: string[] }}
 */
export function gateImportProtection(storeDir) {
  const details = [];
  let ok = true;
  const routeFile = join(storeDir, LEAK_ROUTE);
  mkdirSync(join(storeDir, 'src/routes/my'), { recursive: true });

  try {
    for (const leak of LEAKS) {
      writeFileSync(routeFile, leak.source);
      const { failed, output } = buildExpectingFailure(storeDir);
      const denied = failed && output.includes(MARKER);
      // Червона збірка без маркера — це НЕ доказ межі, а інша поламка.
      const passed = denied;
      details.push(
        `${passed ? 'OK  ' : 'FAIL'} ${leak.label} — ${
          failed ? (denied ? 'збірка впала з маркером' : 'збірка впала БЕЗ маркера Import Protection') : 'збірка ПРОЙШЛА — витік не зупинено'
        }`,
      );
      if (!passed) ok = false;
    }
  } finally {
    rmSync(routeFile, { force: true });
    // Чистий ре-білд: Vite спорожнив dist на кожній червоній збірці.
    const rebuilt = buildCapturing(storeDir);
    details.push('OK   роут-витік прибрано, скретч перезібрано начисто');
    // Попередження Vite про `__dirname`/імпорт без розширення у конфізі
    // магазину — регрес T-4, який монорепний `pnpm build` не бачить.
    const warned = rebuilt.includes("unsupported by `configLoader: 'native'`");
    details.push(
      `${warned ? 'FAIL' : 'OK  '} конфіг магазину без попереджень Vite про configLoader: 'native'`,
    );
    if (warned) ok = false;
  }
  return { ok, details };
}
```

- [ ] **Step 2: Крок у пілоті — наприкінці, після Gate B**

У `scripts/pilot-pack/run.mjs`: імпорт
`import { gateImportProtection } from './gate-ip.mjs';` і після рядка
`if (!opts.packOnly) results.push(await gateServer(opts));` (перед `return
results;`):

```js
  // 🔴 Останнім: кожна червона збірка спорожнює dist скретча, а Gate C/D і
  // Gate B читають його. Гейт сам перезбирає скретч наприкінці.
  step('Gate IP — Import Protection валить витік у збірці магазину');
  results.push(['IP', gateImportProtection(opts.storeDir)]);
```

Також у `scripts/pilot-pack.mjs::describeScope()` обидва рядки доповнити
`+ IP`: `'гейти A/C/D/IP + CLI/TOOL'` і `'гейти A-D/IP + CLI/TOOL (E знято)'`;
у таблиці режимів у шапці того ж файлу (`:16-17`) колонка «Гейти» →
`A, C, D, IP, CLI, TOOL` і `A-D, IP, CLI, TOOL`; там же прозовий перелік
«A/C/D, CLI і TOOL (…) до БД не звертаються» (`:24`) → «A/C/D, IP, CLI і TOOL
(…)», і приклад `--pack-only   # gates A, C, D, CLI, TOOL (без БД)` (`:33`) →
`… A, C, D, IP, CLI, TOOL …` — усі чотири згадки набору гейтів у файлі
синхронні з рантайм-рядком.

Run: `pnpm pilot:pack 2>&1 | tail -25`
Expected: `Gate IP: PASS` з чотирма `OK`: два витоки зупинено, ре-білд, конфіг
магазину без попереджень Vite; решта гейтів PASS.

- [ ] **Step 3: Негативний контроль гейта — вимкнений захист має дати FAIL**

🔴 Ред. 1.2: правити ОВЕРЛЕЙ пілота, а не шаблон — скретч отримує
`vite.config.ts` саме з `tests/pilot/store-template/` (`scaffold.mjs:79`
копіює оверлей поверх шаблону), а `pnpm template:sync` статичні файли
шаблону не чіпає взагалі (`sync-create-store-template.mjs:22-24`). Парність
шаблон↔оверлей у цьому кроці не ганяється — вона й має бути червоною, доки
мутація не відкочена.

```bash
sed -i 's/^\(\s*\)importProtection: importProtection(),/\1importProtection: { enabled: false },/' tests/pilot/store-template/vite.config.ts
pnpm pilot:pack 2>&1 | grep -A3 "Gate IP"
git checkout -- tests/pilot/store-template/vite.config.ts
git status --porcelain
```

Expected: `Gate IP: FAIL` з двома рядками «збірка ПРОЙШЛА — витік не зупинено»;
дерево після відкату чисте.

- [ ] **Step 4: `pilot:pack` у CI job `packaging` + коментар**

У `.github/workflows/workflow.yml` після кроку `Tarball parity`:

```yaml
      # 🔴 Пілот пакування БЕЗ бази (рішення власника 2026-09-03, К2-Е0 T-2):
      # єдиний поведінковий доказ межі клієнт/сервер у реальному магазині з
      # tarball-ів — Gate C (серверного вантажу немає в чанках) і Gate IP
      # (витік ВАЛИТЬ збірку). Детермінований; +≈3–5 хв: install скретча і
      # три збірки скретча (дві червоні + чиста) поверх основної.
      # `--skip-build`: dist пакетів уже свіжий після кроку `Build packages`
      # вище — без прапорця пілот повторив би `build:packages` (кеп купи 3 ГБ).
      - name: Pilot (pack-only)
        run: pnpm pilot:pack --skip-build
```

У тому ж job `packaging` `timeout-minutes: 10` (`:95`) → `20`: до кроку
додаються install скретча і чотири збірки магазину.

Блок коментаря наприкінці файлу (рядки про «Пілот пакування … у CI НЕ
ганяється») переписати:

```yaml
# 🔴 `pnpm pilot` (Gate B проти живої БД) у CI НЕ ганяється — рішення власника
# (2026-08-01): зовнішній стан бази дрейфує без регресії коду. `pnpm
# pilot:pack` (без БД) у CI Є з 2026-09-03 — job `packaging` вище. Прогін
# `pilot` перед релізом — відповідальність розробника; команди — у CLAUDE.md.
```

У `CLAUDE.md`: у таблиці CI/CD рядок job `packaging` → кроки
`install → build:packages → typecheck:template → test:packaging → pilot:pack --skip-build`; у
розділі «Порядок гейтів» речення «у CI він не ганяється» про `pilot:pack` →
«з 2026-09-03 ганяється і в CI (job `packaging`); `pilot` з Gate B — ні»; там
же речення «ловив її лише `pnpm pilot:pack`, якого в CI немає» (`:174-175`) →
«ловив її лише `pnpm pilot:pack`, якого на той час у CI не було (з 2026-09-03
він у job `packaging`)»; у Quick Reference (`:39`) `pnpm pilot:pack #
tarball-пілот: гейти A/C/D + CLI/TOOL` → `гейти A/C/D/IP + CLI/TOOL`.

🔴 Четверте місце — абзац «**Пілот пакування в CI НЕ ганяється**» (`:700-704`),
і пропустити його не можна: він стоїть за два рядки ПІД тією самою таблицею
CI/CD, рядок якої цей крок міняє, тож інакше один розділ казав би водночас
«`pilot:pack` — крок job `packaging`» і «пілот пакування в CI не ганяється».
Звузити рівно так, як коментар `workflow.yml` вище: заголовок → «🔴 **`pnpm
pilot` (Gate B проти живої БД) у CI НЕ ганяється**»; `pnpm pilot:pack` зняти
з переліку «відповідальність розробника» (`:703`) і назвати кроком job
`packaging` з 2026-09-03; останнє речення (`:704`) → «Передрелізний гейт у CI
— детерміністичний tarball-parity плюс `pilot:pack --skip-build`». Дата й
авторство рішення 2026-08-01 лишаються: воно не скасоване, а звужене
(роадмап, борг №2 — `docs/tasks/platform-roadmap.md:491-500`).

Run: `pnpm test` (тести читають `workflow.yml`: `template-typecheck-coverage`).
Expected: PASS.

- [ ] **Step 5: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test
git add scripts/pilot-pack/gate-ip.mjs scripts/pilot-pack/run.mjs scripts/pilot-pack.mjs .github/workflows/workflow.yml CLAUDE.md
git commit -m "test(k2-e0): Gate IP — витік валить збірку скретча; pilot:pack у CI

Мутаційний крок у пілоті: bare simplycms/db і відносна втеча в
node_modules/simplycms/src/db/client з реальним експортом мусять дати
[import-protection] Import denied; після — чистий ре-білд. pilot:pack — у job
packaging (рішення власника 2026-09-03; борг №2 звужено до pilot з Gate B)."
```

---

### Task 5: §12 `test-contours.md` — структурні твердження замість чисел (T-5)

**Files:**
- Modify: `docs/architecture/test-contours.md` §12 (рядки 661–850)

**Interfaces:** нічого; документує Tasks 1, 3, 4.

- [ ] **Step 1: Таблиця читачів + сьомий рядок; текст про пастки — у декларацію**

У таблиці «Читач | Що доводить | Негативний контроль» §12:
- рядок Import Protection → негативний контроль: «`tests/import-protection-wiring.test.ts` (дані + анкерований рядок; `enabled: false` — червоне) і **Gate IP** пілота (`pnpm pilot:pack`, у CI): bare `simplycms/db` і відносна втеча в `node_modules/simplycms/src/db/client` валять `vite build` скретча з `[import-protection]`»;
- новий сьомий рядок: «`tests/dist-server-boundary.test.ts`, блок сентинелів | контроль САМОГО списку `SERVER_ONLY`: мапа літералів не похідна від списку, кожен є в джерелі дерева, у серверному `dist` і відсутній у клієнтському | закоментований рядок `'storefront'` у декларації → червоний packaging».

Абзац «🔴 ТРИ пастки Import Protection» скоротити до одного речення з
посиланням: «Три пастки Start (include за замовчуванням лише `src/`; alias
резолвить раніше за `specifiers`; `files`/`excludeFiles` заміщують дефолт) —
задокументовані в докблоці `importProtection()` у `contracts/server-only.ts`
разом із моделлю загрози; тут не дублюються». Наступний за ним окремий
абзац «🔴 Модель загрози, заради якої звужено `excludeFiles`» (`:686-694`)
прибрати цілком — він дослівно дублює модель загрози з того самого докблоку,
і речення «тут не дублюються» інакше було б хибним у тому ж розділі.

- [ ] **Step 2: Живий прогін і маркери — без чисел, що дрейфують**

У підрозділі «Живий прогін 2026-09-03»: замінити абзац «Межа в бою. Нуль
збігів по 20 маркерах … у ВСІХ 241 чанку …» і три таблиці маркерів
(«13 доказових», «4 слабкі», «3 без контролю») на:

> **Межа в бою.** Доказ — гейт, не таблиця: сентинел кожного server-only
> дерева (`tests/dist-server-boundary.test.ts`, блок `SENTINELS`) є в
> серверному `dist` і відсутній у клієнтському; у скретч-магазині Gate C
> не знаходить серверного вантажу, а Gate IP доводить, що витік валить
> збірку. Правило вибору маркера лишається чинним і задокументоване в
> тому ж тесті: клієнтська збірка мініфікує ІМЕНА, тож доказовий маркер —
> лише рядковий ЛІТЕРАЛ (ідентифікатор дає хибний нуль). Ручний перелік
> із 20 маркерів і його числа (перший вимір 2026-09-02, повторний
> 2026-09-03) — в історії git цього файлу; у чинному тексті їх немає
> навмисно (урок №8 роадмапу).

Абзаци «Правило вибору маркера…», «Методика цифр…», «Три хибні результати»
залишити (вони структурні), але прибрати з них числа файлів/рядків:
«216 файлів `dist/server` — це ≈89 000 рядків…» → «серверна збірка НЕ
мініфікована (читабельні імена, банери `#region`), клієнтська — мініфікована
з перейменуванням ідентифікаторів; на це вказує різниця в кількості рядків
на два порядки при майже тому самому обсязі байтів»; таблицю
«ідентифікатор проти співмодульного літерала» лишити як ілюстрацію з
приміткою «числа — вимір на дату, не контракт».

Рядок про розмір `dist/client/assets` → «Дельта `sideEffects: false` — близько
1,2–1,6 КБ: порядок величини, не число — між збірками дрейфують і абсолютний
розмір, і сама дельта (виміри 2026-09-03 дали −1 228 і −1 556 байтів)».

- [ ] **Step 3: Коміт**

```bash
pnpm format:check
git add docs/architecture/test-contours.md
git commit -m "docs(k2-e0): §12 — доказ межі як гейт (сентинели, Gate IP), числа — лише порядок величини

Таблиця читачів отримала сьомий рядок (контроль списку); три пастки Start —
у докблоці декларації; ручні таблиці маркерів і лічильники знято з чинного
тексту (урок №8) (T-5)."
```

---
## Хвиля 1 — К2-Е0

> 🔴 **Порядок хвилі 1 (ред. 1.2):** дати (Task 6) → **покупний демо-сід і
> єдина декларація доставки в харнесі (Task 7)** → правило наявності на
> читанні (Task 8) → write-side з ескалацією (Task 9) → сервер чекауту
> (Task 10) → UI чекауту (Task 11) → кошик (Task 12) → env (Task 13) →
> live-smoke і документи (Task 14). Сід іде ПЕРЕД тестами write-side і
> воронки, бо саме він — база їхніх фікстур; переставляти не можна.
> Спайку «чи доїжджає `Date` через serverFn» немає: `Date` входить у
> `DefaultSerializable` серіалізатора Start (`@tanstack/router-core`
> `dist/esm/ssr/serializer/transformer.d.ts:18`), тобто і loader-payload, і
> RPC serverFn проносять його як `Date`, а `strict`-перевірка типів
> `createServerFn` уже на `pnpm typecheck` відкинула б несеріалізовний тип.
> Поведінковий гейт — live-smoke Task 14: `order-success` форматує `Date`
> через `Intl`, і рядок замість `Date` там дав би `RangeError` у `pageerror`.

### Task 6: Контракт дат — `Date` у застосунку, текст лише на межі (Е0-2)

**Files:**
- Modify: `packages/simplycms/src/db/client.ts` (блок `pool ??= new pg.Pool({…})`, `:82`)
- Modify: `packages/simplycms/src/schema/schema.ts` (62 колонки), `packages/simplycms/src/schema/media.ts:52`
- Modify: `packages/simplycms/src/domain/discounts.ts` (`isWithinDateRange` — параметри `Date | null`)
- Modify: `packages/simplycms/src/storefront/loaders/sitemap.ts:14-30`, `packages/simplycms/src/storefront/seo/sitemap.ts:51-64`
- Modify: `packages/simplycms/src/storefront-routes/pages/{OrderSuccess,ProfileOrders,ProfileOrderDetail,Profile}.tsx` (функція `formatDate`)
- Modify: `packages/simplycms/src/storefront/loaders/{profile.ts:72,orders.ts:111,theme-record.ts:80-81}`, `plugin-sdk/server/config-db.ts:52`, `storefront/loaders/entities/banner.ts:79`
- Modify: `packages/simplycms/src/admin/pages/OrderStatuses.tsx:104`, `admin-data/__tests__/order-statuses-collection.test.ts:15,90,121,135`
- Modify: `packages/simplycms/src/storefront/loaders/entities/order.ts:28`, `loaders/reviews.ts:23-24`, `contracts/objects/{banner,order,shipping,catalog,discount}.ts` (поля дат)
- Modify: `packages/simplycms/src/plugins/types.ts:70-77`, `plugins/server/registry-db.ts:63-64`, `plugins/__tests__/bootstrap.test.ts:42-43`
- Test: `packages/simplycms/src/storefront/seo/__tests__/sitemap.test.ts`, `packages/simplycms/test-harness/pg/__tests__/storefront-loaders.test.ts:192-193`
- Create: `packages/simplycms/test-harness/pg/__tests__/db-session-options.test.ts`
- Modify: `.github/instructions/data-access.instructions.md` (новий розділ «Контракт дат» перед «Типи та валідація»)

**Interfaces:**
- Produces: усі `createdAt`/`updatedAt` доменної схеми — `Date` (тип виводиться `InferSelectModel`); `SitemapSection.updated_at: Date`, `SitemapProduct.updated_at: Date`; `entry(loc, lastmod?: Date, …)` у `seo/sitemap.ts`.
- Consumes: нічого нового.

- [ ] **Step 1: Юніт sitemap — фікстури `Date`, асерт W3C — спершу червоний**

У `packages/simplycms/src/storefront/seo/__tests__/sitemap.test.ts`:
`DATA` → `updated_at: new Date('2026-07-01T00:00:00Z')` (і решта дві дати так
само); кейс `'lastmod береться з рядка БД'` замінити на:

```ts
  it('lastmod — W3C Datetime (toISOString), а не текст драйвера', () => {
    // 🔴 sitemaps.org вимагає W3C Datetime; текст Postgres
    // (`2026-07-01 00:00:00+00`) роботи відкидають. Межа виводу — єдине
    // місце, де Date стає рядком.
    expect(xml).toContain('<lastmod>2026-07-01T00:00:00.000Z</lastmod>');
    expect(xml).toContain('<lastmod>2026-07-02T00:00:00.000Z</lastmod>');
    for (const m of xml.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)) {
      expect(m[1]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  });
```

У кейсі «спецсимволи» — `updated_at: new Date('2026-07-02T00:00:00Z')`.

Run: `pnpm vitest run packages/simplycms/src/storefront/seo/__tests__/sitemap.test.ts`
Expected: FAIL (TS: `Date` не присвоюється `string`; або рантайм — `<lastmod>` з `toString()` дати).

- [ ] **Step 2: Пул — детерміновані `DateStyle`/`TimeZone`**

У `packages/simplycms/src/db/client.ts` в `new pg.Pool({ … })`:

```ts
  pool ??= new pg.Pool({
    connectionString: resolveDatabaseUrl(process.env),
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    // 🔴 Текст, яким драйвер віддає timestamptz, — властивість КЛАСТЕРА
    // (GUC DateStyle/TimeZone), не коду: під `SQL,DMY` `new Date()` у V8
    // читає `01/07/2026` як 7 січня. Startup-опції роблять його
    // детермінованим для кожного зʼєднання пулу; парсер дат Drizzle
    // (`mode: 'date'`) далі працює з передбачуваним входом. Гейт —
    // test-harness/pg/__tests__/db-session-options.test.ts.
    options: '-c DateStyle=ISO,YMD -c TimeZone=UTC',
  });
```

- [ ] **Step 3: Харнес-тест сесійних опцій**

`packages/simplycms/test-harness/pg/__tests__/db-session-options.test.ts`:

```ts
// Детермінованість текстового формату дат — властивість пулу, не кластера
// (К2-Е0, Е0-2). Без startup-опцій формат залежав би від DateStyle/TimeZone
// того Postgres, де живе магазин.
//
// 🔴 Self-contained, як with-actor.test.ts: роль `app_runtime` створює канон
// (`0000_prelude.sql`), на голому кластері (ефемерний initdb, свіжий
// service-контейнер CI) її немає — без тимчасової БД з накатаним каноном
// `connect()` падає з «role "app_runtime" does not exist».
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { withStorefrontDb } from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles, createTempDatabase, dropTempDatabase,
  randomDbName, withDbName, withUser,
} from '../apply.mjs';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');

describe('пул: DateStyle/TimeZone зʼєднання', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_session_opts');
  let dbUrl = '';

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(
      dbUrl,
      readdirSync(CANON_DIR).filter((n) => n.endsWith('.sql')).sort().map((n) => join(CANON_DIR, n)),
    );
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    await dropTempDatabase(harness.url, dbName);
    await harness.teardown();
  });

  it('кожне зʼєднання пулу — ISO, YMD і UTC незалежно від дефолтів кластера', async () => {
    const rows = await withStorefrontDb(async (db) => {
      const style = await db.execute(sql`show DateStyle`);
      const tz = await db.execute(sql`show TimeZone`);
      return { style: style.rows[0], tz: tz.rows[0] };
    });
    expect(rows.style).toEqual({ DateStyle: 'ISO, YMD' });
    expect(rows.tz).toEqual({ TimeZone: 'UTC' });
  });
});
```

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/db-session-options.test.ts`
Expected: PASS. (🔴 Запускати лише з `--config vitest.schema.config.ts` —
кореневий конфіг харнес виключає й дасть «No test files found».)

- [ ] **Step 4: Схема — `mode: 'date'` на 62 + 1 колонках**

```bash
sed -i "s/mode: 'string'/mode: 'date'/g" packages/simplycms/src/schema/schema.ts packages/simplycms/src/schema/media.ts
grep -c "mode: 'date'" packages/simplycms/src/schema/schema.ts   # очікувано 62
grep -c "mode: 'string'" packages/simplycms/src/schema/schema.ts packages/simplycms/src/schema/media.ts   # очікувано 0 і 0
```

У шапку `schema.ts` (блок `//`-коментарів рядків 4–37 — файл не має
`/** */`-докблоку, тож і абзац — тим самим префіксом) додати:

```ts
// 🔴 Контракт дат (К2-Е0, Е0-2): усі timestamp — `mode: 'date'`, як у
// `./auth.ts`. `mode: 'string'` віддавав не ISO, а сирий текст Postgres
// (`drizzle-orm/node-postgres` підкладає identity-парсер для timestamptz), і
// він доїжджав до `<lastmod>` sitemap і в браузер. У застосунку дата — `Date`;
// рядком вона стає лише на межі виводу (`toISOString()` у sitemap, `Intl` в
// UI). Через loader-payload і RPC serverFn `Date` проходить як `Date`: він у
// `DefaultSerializable` серіалізатора Start (`@tanstack/router-core`,
// `ssr/serializer/transformer.d.ts`). Точність — мілісекунди: мікросекунди
// Postgres драйвер відкидає (`pg-core/columns/timestamp.js` → `new Date()`),
// місць, де це критично, у коді немає (аудит r1). DDL від `mode` не залежить.
```

🔴 Кроку `pnpm db:diff` тут НЕМАЄ (ред. 1.2): він потребує живої
`DATABASE_URL` з накатаним каноном, а `mode` — властивість TS-типу, до DDL
не доходить; DDL стереже `pnpm test:schema` (`id-defaults`, `baseline`).

Run: `pnpm typecheck 2>&1 | grep -c "error TS"` — це **список споживачів**
для кроку 5.

- [ ] **Step 5: Споживачі — тип `Date`, форматування на межі**

За списком `pnpm typecheck` (очікувані місця; правило одне — тип стає `Date`,
конверсія в рядок лише там, де рядок виходить назовні):

1. `storefront/loaders/sitemap.ts`: `readonly updated_at: Date;` в обох
   інтерфейсах.
2. `storefront/seo/sitemap.ts`: `function entry(loc: string, lastmod?: Date, …)`
   і `if (lastmod) parts.push(\`    <lastmod>${lastmod.toISOString()}</lastmod>\`);`
   — 🔴 з коментарем: «Єдине місце, де дата стає рядком: W3C Datetime для
   sitemaps.org; текст драйвера роботи відкидають».
3. Контракти й рядки лоадерів з датами, типізовані `string`: `contracts/objects/*.ts`
   (`banner.ts:22-23` `date_from`/`date_to` і `:32-33`, `order.ts:37-38`,
   `shipping.ts:18-19,31,52,71`, `catalog.ts:29-30`, `discount.ts:31-32,44-45`),
   `storefront/loaders/entities/order.ts:28` (`OrderListRow.created_at`;
   `OrderDetailRow extends OrderListRow` — саме їх читають чотири сторінки з п.4),
   `storefront/loaders/reviews.ts:23-24` (`ProductReviewRow`): → `Date`
   (`Date | null`, де було `string | null`). Не додавати `String(...)`. Legacy
   `src/admin/**` це не ламає: сторінки доставки роблять `as unknown as
   ShippingMethod` (`ShippingMethods.tsx:67` та ін.) — типи там не звіряються.
4. `storefront-routes/pages/{OrderSuccess,ProfileOrders,ProfileOrderDetail,Profile}.tsx`:
   `const formatDate = (date: Date) => new Intl.DateTimeFormat('uk-UA', {…}).format(date);`
   (без `new Date(dateString)`).
5. `admin-server/impl/**`, `admin-data/**` — типи рядків із `simplycms/schema/types`
   стають `Date` автоматично.
6. Будь-який `new Date(row.created_at)` у `packages/simplycms/src` поза
   `src/admin/**` — прибрати обгортку (значення вже `Date`):
   `grep -rn "new Date(.*\(created_at\|updated_at\|_at\))" packages/simplycms/src | grep -v "src/admin/"`
   (знаходить `storefront-routes/pages/catalog/filtering.ts:95` і
   `reviews-ui/ReviewCard.tsx:69`). Окремий випадок поза цим регексом —
   `storefront/loaders/entities/banner.ts:79-80` (`isBannerVisible`:
   `new Date(banner.date_from)`/`date_to`) — порівнювати `Date` напряму.
7. 🔴 ЗАПИСИ ISO-рядків у Date-колонки — тепер помилка типу, бо колонка чекає
   `Date`: `storefront/loaders/profile.ts:72`, `storefront/loaders/orders.ts:111`,
   `storefront/loaders/theme-record.ts:80-81`, `plugin-sdk/server/config-db.ts:52`
   — передавати `new Date()`. Пошук:
   `grep -rn "toISOString()" packages/simplycms/src --include='*.ts' | grep -v "seo/sitemap\|src/admin/\|order-create.ts:61\|pluginRepository"`
   (`order-create.ts:61` — номер замовлення, лишається; `plugins/pluginRepository.ts`
   — supabase-js-шар адмінки, не чіпати).
8. Домен `resolveDiscount` перевіряє вікно дії через
   `isWithinDateRange(discount.starts_at, discount.ends_at, now)`
   (`domain/discounts.ts:176,229`): після контракту `starts_at`/`ends_at: Date |
   null` привести параметри хелпера до `Date | null` і порівнювати `Date`
   напряму, без `new Date(x)`.
9. 🔴 `admin/pages/OrderStatuses.tsx:104` — ЖИВА сторінка адмінки на
   колекції `simplycms/admin-data` з типом `OrderStatus` зі
   `simplycms/schema/types` (не legacy `supabase-js`; ред. 1.2 виправляє
   помилкову позначку ред. 1.1): `createdAt: new Date().toISOString()` →
   `createdAt: new Date()` — інакше `as OrderStatus` дає TS2352 (string і
   Date не порівнювані). У `admin-data/__tests__/order-statuses-collection.test.ts`
   УСІ літерали `'2026-01-01'` (`:15`, `:90`, `:121`, `:135`) → моки
   `createdAt: new Date('2026-01-01')`, асерти `toEqual(new Date('2026-01-01'))`
   — одна конвенція на файл, а не мішана.
   Колекція без runtime-схеми (`admin-data/collections/order-statuses.ts:25`)
   типізується з `schema/types` автоматично.
10. 🔴 Плагіни — два типи, два шари. `plugins/types.ts:31-44` `Plugin`
    (`installed_at`/`updated_at: string`) обслуговує supabase-js-шар адмінки
    (`PluginSettings.tsx`) і лишається на рядках; `PluginRecord` (`:70-77`) —
    тип Drizzle-читання (`registry-db.ts::selectActivePlugins`) — додає
    `'installed_at' | 'updated_at'` до `Omit<Plugin, …>` і перевизначає їх як
    `Date | null` (колонки `plugins.installedAt`/`updatedAt` — `defaultNow()`
    без `notNull`). У `registry-db.ts:63-64` прибрати `?? ''` (рядок → `Date |
    null` напряму); у `plugins/__tests__/bootstrap.test.ts:42-43` фікстура →
    `new Date('2026-01-01T00:00:00Z')`. Через `listActivePlugins`
    (`plugins/server/index.ts:36`) `Date` проходить як `Date`.

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 6: Харнес: `updated_at` — `Date`, не «якийсь рядок»**

У `packages/simplycms/test-harness/pg/__tests__/storefront-loaders.test.ts:192-193`:

```ts
    // `updated_at` — Date (контракт К2-Е0): рядком він стає лише в
    // `<lastmod>` через toISOString(). Регекс ФОРМАТУ драйвера тут пінив би
    // GUC кластера, а не код.
    expect(data.products[0].updated_at).toBeInstanceOf(Date);
```

Run: `pnpm test:schema`
Expected: PASS (включно з новим `db-session-options`).

- [ ] **Step 7: Інструкція `data-access` — розділ «Контракт дат»**

У `.github/instructions/data-access.instructions.md` після розділу «Контракт id»
(перед «Типи та валідація») додати:

```markdown
### Контракт дат (К2-Е0, 2026-09-04)

Усі `timestamp` доменної схеми — `mode: 'date'`: у застосунку дата — `Date`.
Рядком вона стає ЛИШЕ на межі виводу, там, де формат диктує зовнішній контракт:
`toISOString()` у `storefront/seo/sitemap.ts` (W3C Datetime), `Intl.DateTimeFormat`
у UI. Пул `simplycms/db` ставить `DateStyle=ISO,YMD`/`TimeZone=UTC` на кожне
зʼєднання — текст драйвера не залежить від кластера. Через loader-payload і
serverFn `Date` проходить як `Date` (`DefaultSerializable` Start). 🔴 `new
Date(рядок)` у коді вітрини — сигнал, що межу перетнули не там. Гейти:
`seo/__tests__/sitemap.test.ts` (W3C-регекс), `test-harness/pg/__tests__/
storefront-loaders.test.ts` (`instanceof Date`), `db-session-options.test.ts`,
live-smoke (`order-success` форматує `Date`).
```

- [ ] **Step 8: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm build && pnpm typecheck && pnpm test && pnpm test:schema
git add -A packages/simplycms/src packages/simplycms/test-harness .github/instructions/data-access.instructions.md
git commit -m "feat(k2-e0): контракт дат — Date у застосунку, текст лише на межі виводу

62+1 колонки схеми на mode:'date' (механізм із auth.ts; DDL без змін), пул із
DateStyle=ISO,YMD/TimeZone=UTC (гейт харнеса), <lastmod> через toISOString
(юніт із Date-фікстурами й W3C-регексом; лоадер — instanceof Date). Сторінки
кабінету й жива сторінка статусів адмінки працюють із Date без парсингу
тексту драйвера; Date проходить serverFn як Date (DefaultSerializable) (Е0-2)."
```

---
### Task 7: Покупний демо-сід — єдиний власник доставки й залишків; ціна на головній (Е0-6)

**Files:**
- Modify: `packages/simplycms/migrations/demo/demo-seed.sql` (шапка; секція 9; нова секція 10)
- Modify: `packages/simplycms/test-harness/pg/__tests__/seed-determinism.test.ts:12,21,33`
- Modify: `packages/simplycms/test-harness/pg/__tests__/demo-seed.test.ts:50-59` (лічильники нових таблиць під кейсом ідемпотентності)
- Modify: `packages/simplycms/test-harness/pg/__tests__/fixtures/shipping.ts` (ідемпотентність поверх сіду)
- Modify: `packages/simplycms/test-harness/pg/__tests__/fixtures/showcase.ts:110-111`, `fixtures/storefront-client.ts:1-5, 21-25`
- Modify: `packages/simplycms/test-harness/pg/__tests__/storefront-showcase.test.ts:252`
- Modify: `packages/simplycms/src/storefront/loaders/pricing.ts` (`loadPricesByProduct`)
- Modify: `packages/simplycms/src/storefront/loaders/entities/home-product.ts`, `loaders/home.ts:64-80`, `loaders/home-sections.ts:23-70`, `storefront-routes/pages/home/{types,toCardViewModel}.ts`, `storefront-routes/views/HomeView.tsx:17`, `storefront-routes/__tests__/home-n-plus-one.test.tsx:84-91`
- Sync: `pnpm template:sync` (копія сіду в шаблоні)

**Interfaces:**
- Produces: демо-сід везе активний метод `pickup` (`type: 'system'`), дефолтну зону, ОДНУ **системну** точку видачі (`is_system = true` — вона ж склад правила Р2), безкоштовний `flat`-тариф, залишки на цій точці для двох панелей і `decrease_on_order = true`; `banners.image_url` — inline `data:image/svg+xml` плейсхолдер (схема **не змінюється**: колонка лишається `text NOT NULL`); `SHIPPING_FIXTURES = [...ACTIVE_SHIPPING_FIXTURES, ...HIDDEN_SHIPPING_FIXTURES]` — активна частина ідемпотентна поверх сіду, негативна — придатна для композиції з сідом; `loadPricesByProduct(db, productIds): Promise<Record<string, PriceEntry[]>>`; `HomeProductRow.price: number | null`, `HomeProductRow.old_price: number | null`.
- Consumes: `resolvePrice` (`simplycms/domain/pricing`), `loadDefaultPriceTypeId`, `priceColumns`/`groupPricesByProduct` (`./entities/price`).

🔴 **Етап БЕЗ жодної зміни схеми БД (ред. 1.3, рішення Р3).** Ця задача була
єдиним носієм DDL у К2-Е0 — і його знято. Ред. 1.2 робила `banners.image_url`
nullable міграцією `0004`; це відкидається, бо nullable ламало б три чинні
контракти одразу: `BannerSlider.tsx:130` рендерить `<img src={banner.image_url}>`
**беззастережно** (бита картинка), `contracts/objects/banner.ts:14` і заморожений
`supabase/database.ts` оголошують `image_url: string` (baseline адмінки став би
брехливим до К3), а тема-еталон від NULL не виграє взагалі —
`themes/default/components/HeroBanner.tsx:52-54` шукає `banners.find((item) =>
item.desktop_image_url || item.image_url)` і банер без фото просто **ігнорує**,
тобто демо-мета «зробити магазин видним» не досягається. Тому колонка лишається
`text NOT NULL` (`0001_init.sql:13`, `schema.ts:1040`), а видимість дає
data-URI-плейсхолдер у самому сіді. Наслідок: канон і далі — рівно чотири файли,
`baseline.test.ts`, `create-store-template-parity.test.ts` і
`migrations/README.md` цю задачу не зачіпають, кроку `db:diff` тут немає.
Нових грантів етап теж не потребує: `stock_by_pickup_point` уже повністю
відкрита `app_admin` (`0002_grants.sql:156`).
Побічно цим закривається відомий борг демо-даних: 404 на
`/demo/banners/solar-home.jpg` записаний у двох місцях
(`docs/architecture/test-contours.md` §12, таблиця живого прогону 2026-09-03;
`docs/tasks/v2-state-map.md` §2.1). 🔴 Обидва — ДАТОВАНІ записи прогонів, тож
заднім числом їх не правлять: новий стан фіксує датований прогін Task 14.

🔴 Чому сід — власник (ред. 1.2). До цієї задачі активний `pickup` вставляли
три фікстури харнесу незалежно (`fixtures/shipping.ts:26`, `showcase.ts:110`,
`storefront-client.ts:24`), а `fixtures/shipping.ts:31` ще й дефолтну зону.
Сід з доставкою став би пʼятою декларацією і зламав би два нові тести (другий
дефолт зони проти `idx_shipping_zones_single_default`; залишки тих самих
слагів). Тому активна доставка декларується ОДИН раз — у сіді, який і так
накатують ШІСТЬ тестів харнесу (`demo-seed`, `single-default`,
`aggregate-deps`, `storefront-showcase`, `storefront-client-queries`,
`storefront-loaders`; сьомий, `seed-determinism`, читає файл статично, без
БД); фікстури лишають собі лише негативні й специфічні рядки, а та, що
котиться й на чистому каноні
(`shipping-directory.test.ts`), стає ідемпотентною.

- [ ] **Step 1: Пін детермінізму — спершу червоний**

У `seed-determinism.test.ts:21` `15` → `20` (пʼять нових `insert into` з явним
списком колонок: спосіб доставки, зона, точка видачі, тариф, залишки;
`update` тумблера в лічильник не входить), у коментарі `:12` «15 у
`demo/demo-seed.sql`» → «20», у докблоці `insertColumnLists` (`:33`) «усі 21
insert» → «усі 26 insert» (6 + 20).

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/seed-determinism.test.ts`
Expected: FAIL (у файлі ще 15).

- [ ] **Step 2: Сід — доставка, системна точка, залишки, тумблер, банери-плейсхолдери**

У шапці `demo-seed.sql` (після абзацу «БЕЗ користувачів…») додати:

```sql
-- 🔴 К2-Е0 (2026-09-05): демо-магазин мусить бути ПОКУПНИМ — доходити до
-- рядка в `orders` живим прогоном (`pnpm live:smoke`) ЗІ СПИСАННЯМ залишку.
-- Тому тут є один спосіб доставки, одна СИСТЕМНА точка видачі
-- (`is_system = true` — вона ж склад, з якого списують і на який повертають
-- залишок), безкоштовний тариф, залишки для частини товарів (решта —
-- «статус без обліку»: обидві гілки правила наявності в одному сіді) і
-- тумблер `decrease_on_order = true`. Канон `0003_seed.sql` доставки як не
-- віз, так і не везе — її заводить магазин. 🔴 Це ЄДИНА декларація активної
-- доставки для харнесу: фікстури тестів додають лише вимкнені/специфічні
-- рядки, ідемпотентно (`fixtures/shipping.ts`).
--
-- 🔴 Банери: `image_url` — inline `data:image/svg+xml`, а не шлях до файлу.
-- Причина не в схемі (колонка була й лишається `text NOT NULL`), а в тому,
-- що файлів статики демо не везе НІ монорепо (`public/` має рівно
-- `favicon.ico` і `placeholder.svg`), НІ шаблон магазину — теки
-- `template/public/` не існує взагалі. Тобто `/demo/banners/*.jpg` були
-- гарантованим 404 у кожному магазині, піднятому `pnpm db:demo`.
```

У переліку префіксів id тієї ж шапки дописати: `shipping_methods 1000000a,
pickup_points 1000000b, shipping_rates 1000000c, stock_by_pickup_point
1000000d, shipping_zones 1000000e`.

**Секція 9 — банери.** Обидва `'/demo/banners/….jpg'` (`:234`, `:249`)
замінюються на плейсхолдери. Над секцією — коментар про межі формату:

```sql
-- 🔴 Плейсхолдер-SVG інлайном. Чотири обмеження, які не можна порушити:
-- (1) усередині SVG — ЛИШЕ подвійні лапки: одинарна в SQL-літералі вимагала
--     б подвоєння ('') і зробила б рядок нечитабельним;
-- (2) жодного `#` — у data-URI він відкриває фрагмент і відрізав би решту
--     розмітки, тому кольори НАЗВАНІ (`darkslateblue`), а не hex;
-- (3) жодного `%` (percent-escape) і `&` (XML-сутність) — звідси абсолютні
--     розміри `width="1200"`, а не `width="100%"`;
-- (4) `charset=utf-8` — через кириличний підпис. Формально XML і без нього
--     дефолтиться на UTF-8, але явний параметр знімає залежність від того,
--     який шар вирішує кодування (URL-декодер чи XML-парсер).
-- Один рядок ~250 символів: розбивати перенесенням не можна (перенос усе-
-- редині SQL-літерала кладе в значення справжній `\n`), тож він свідомо
-- довший за решту файлу.
```

Рядок першого банера (`:234`):

```sql
  'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400"><rect width="1200" height="400" fill="darkslateblue"/><text x="600" y="215" fill="white" font-size="48" text-anchor="middle">Сонячна енергія</text></svg>',
```

Рядок другого (`:249`):

```sql
  'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400"><rect width="1200" height="400" fill="darkgoldenrod"/><text x="600" y="215" fill="white" font-size="48" text-anchor="middle">Бі-фаціальні панелі</text></svg>',
```

🔴 Підпис усередині SVG — скорочений заголовок банера, а не декор: сам
заголовок обидва споживачі малюють оверлеєм поверх картинки
(`BannerSlider.tsx` — `banner.title`), тож у зображенні він потрібен рівно
для того, щоб плейсхолдер читався як плейсхолдер саме цього банера.
Обидва споживачі задають зображенню розмір через CSS (`BannerSlider` —
`absolute inset-0 w-full h-full object-cover`, `HeroBanner` — `h-full w-full
object-cover` у круглій підложці), тому SVG без інтринсік-розмірів, лише з
`viewBox`, малюється коректно в обох. React SSR екранує значення атрибута
(`<` → `&lt;`), а парсер браузера розекранує назад — HTML-межу рядок
проходить без втрат. Заборона на `&` — не про неї, а про XML: голий `&`
всередині SVG це помилка розбору (сутність без імені).

🔴 Що плейсхолдер справді МАЛЮЄТЬСЯ, не доводить жоден гейт цієї задачі —
ні SQL, ні TS картинку не рендерять. Тому перевірка ока — окремим пунктом
Step 5. Якщо кирилиця в data-URI десь не доїде (percent-декодування
підпису), найдешевший відкат — прибрати `<text>` зовсім: заголовок обидва
споживачі й так малюють оверлеєм, тож плейсхолдер лишиться робочим і без
підпису.

Наприкінці файлу — секція 10:

```sql
-- ── 10. Доставка й залишки (К2-Е0): магазин, у якому можна купити ─────────
insert into public.shipping_methods (id, code, name, description, type, is_active, sort_order)
values ('1000000a-0000-4000-8000-000000000001'::uuid, 'pickup', 'Самовивіз',
        'Забрати зі складу у Києві', 'system', true, 0)
on conflict (code) do nothing;

-- 🔴 `shipping_rates.zone_id` — NOT NULL: одна дефолтна зона на всю країну;
-- `findShippingZoneIn` дефолтну зону пропускає й повертає її лише як fallback,
-- тож тариф застосовується без прив'язки до міста (правило домену, не сіду).
-- Дефолт — не більше одного (`idx_shipping_zones_single_default`), тому
-- конфлікт — по частковому індексу, а не по id.
insert into public.shipping_zones (id, name, description, is_active, is_default, sort_order)
values ('1000000e-0000-4000-8000-000000000001'::uuid, 'Україна', 'Дефолтна зона демо', true, true, 0)
on conflict (is_default) where (is_default = true) do nothing;

-- 🔴 `is_system = true` — не косметика, а опора write-side. Списання й
-- повернення залишку йдуть у точку самого замовлення (`orders.pickup_point_id`);
-- якщо її немає (кур'єрська доставка) — у системну точку; якщо немає й
-- такої — у першу активну за (sort_order, id). Демо має рівно одну точку,
-- тож усі три гілки правила приземляються в один рядок, і залишки нижче
-- лежать саме на ньому. Побічний наслідок, свідомо прийнятий: адмінка не
-- дасть її видалити (`PickupPoints.tsx:178` — кнопки видалення для
-- системної точки в списку просто немає; `PickupPointEdit.tsx:202` пояснює
-- це підписом `admin.shipping.points.systemLocked` — «Системна точка — не
-- може бути видалена»), і це правильно.
insert into public.pickup_points (id, method_id, name, address, city, is_active, is_system, sort_order)
select '1000000b-0000-4000-8000-000000000001'::uuid, m.id,
       'Склад у Києві', 'вул. Сонячна, 1', 'Київ', true, true, 0
  from public.shipping_methods m where m.code = 'pickup'
on conflict (id) do nothing;

insert into public.shipping_rates (id, method_id, zone_id, name, calculation_type, base_cost, is_active, sort_order)
select '1000000c-0000-4000-8000-000000000001'::uuid, m.id, z.id,
       'Безкоштовно зі складу', 'flat', 0, true, 0
  from public.shipping_methods m, public.shipping_zones z
 where m.code = 'pickup' and z.is_default = true
on conflict (id) do nothing;

-- Залишки лише для двох панелей: решта каталогу лишається «в наявності за
-- статусом без обліку» — так живий прогін бачить обидві гілки правила.
-- Точка резолвиться join-ом за іменем, а не константою-UUID: константа
-- вдруге в файлі порушила б і конвенцію шапки («батьківські рядки — за
-- натуральним ключем»), і пін унікальності UUID-літералів.
insert into public.stock_by_pickup_point (id, pickup_point_id, product_id, modification_id, quantity)
select v.id, pp.id, p.id, null, v.quantity
from (
  values
    ('1000000d-0000-4000-8000-000000000001'::uuid, 'sonyachna-panel-450w-mono', 5),
    ('1000000d-0000-4000-8000-000000000002'::uuid, 'sonyachna-panel-550w-mono', 3)
) as v(id, product_slug, quantity)
join public.products p on p.slug = v.product_slug
join public.pickup_points pp on pp.name = 'Склад у Києві'
on conflict (pickup_point_id, product_id) where product_id is not null and modification_id is null do nothing;

-- 🔴 Демо веде облік: списання при оформленні увімкнене, щоб live-smoke
-- доводив write-side правила наявності, а не лише читання. Це `update`
-- канонічного рядка `0003_seed.sql` (де `'{"decrease_on_order": false}'`),
-- не `insert` — пін детермінізму його не рахує. Предикат — по ПОТОЧНОМУ
-- значенню, а не просто по ключу: повторний накат файлу по рядку, який уже
-- `true`, не пише НІЧОГО — та сама ідемпотентність, що й `on conflict do
-- nothing` вище. 🔴 Межа, названа чесно: власника, який вимкнув облік уже
-- ПІСЛЯ сіду, повторний накат демо поверне до `true` — від цього предикат
-- не рятує. Прийнятно саме тому, що файл — ДЕМО (`pnpm db:demo` піднімає
-- НОВУ базу), а не міграція чинного магазину. Канон не чіпаємо: чистий
-- магазин і далі стартує з обліком вимкненим.
update public.system_settings
   set value = jsonb_set(value, '{decrease_on_order}', 'true'::jsonb)
 where key = 'stock_management'
   and value->>'decrease_on_order' = 'false';
```

Звірено зі `schema.ts`: `shipping_methods_code_key` (unique на `code`, `:510`) →
`on conflict (code)`; `shippingMethodType` містить `'system'`,
`shippingCalculationType` — `'flat'`; `shipping_rates`: `method_id`, `zone_id`
(NOT NULL), `name`, `calculation_type`, `base_cost`, `is_active`, `sort_order`
— решта з дефолтами; `pickup_points.is_system` — `boolean default false not
null` (`schema.ts:585`); предикат часткового індексу `unique_stock_product_per_point`
— `((product_id IS NOT NULL) AND (modification_id IS NULL))`, форма `on
conflict … where …` вище йому відповідає; `idx_shipping_zones_single_default`
— `(is_default) where (is_default = true)`. Пін у кроці 1 — **20**: рівно
пʼять `insert into` цієї секції; `update` — поза лічильником.
🔴 `single-default.test.ts` від дефолтної зони сіду не червоніє: його
GLOBAL-кейс спершу робить `update … set is_default = false where is_default`
і лише потім вставляє свою пару (перевірено — тіло `it.each(GLOBAL)`).

- [ ] **Step 3: Фікстури харнесу — одна декларація активної доставки**

`fixtures/shipping.ts` — масив розщеплюється на дві частини з єдиним
джерелом для чинного споживача:

```ts
/**
 * 🔴 Дві частини (К2-Е0). АКТИВНІ рядки потрібні лише на чистому каноні
 * (`shipping-directory.test.ts`): демо-сід везе власні `pickup`, дефолтну
 * зону, точку й безкоштовний тариф, тож поверх сіду активна частина — no-op
 * (метод/зона — `on conflict`, тариф і точка — `where not exists` за іменем).
 * НЕГАТИВНІ рядки (вимкнений метод, вимкнена зона, вимкнений тариф, закрита
 * точка) безпечні в обох контурах — саме їх композують тести поверх сіду.
 * Повний набір поверх сіду НЕ застосовувати: другий активний тариф на ту
 * саму пару метод+зона зробив би вартість доставки залежною від порядку
 * читання рядків з однаковим sort_order.
 */
export const ACTIVE_SHIPPING_FIXTURES: string[] = [ /* метод, дефолтна зона, активний тариф, активна точка */ ];
export const HIDDEN_SHIPPING_FIXTURES: string[] = [ /* вимкнений метод, вимкнена зона, вимкнений тариф, закрита точка */ ];
export const SHIPPING_FIXTURES: string[] = [...ACTIVE_SHIPPING_FIXTURES, ...HIDDEN_SHIPPING_FIXTURES];
```

Стейтменти активної частини: метод — `on conflict (code) do nothing`;
дефолтна зона — `on conflict (is_default) where (is_default = true) do
nothing`; активний тариф — `where m.code = '${ACTIVE_METHOD_CODE}' and
z.is_default = true and not exists (select 1 from public.shipping_rates where
name = 'Основний тариф')`; активна точка — `and not exists (select 1 from
public.pickup_points where name = '${ACTIVE_POINT_NAME}')`. Негативна частина:
вимкнений метод — тим самим `on conflict (code)` (у спільному `insert` із
активним його не тримати — розділити); вимкнена зона — без конфлікту;
вимкнений тариф — `z.is_default = true` замість імені зони; закрита точка —
без змін. Констант не видаляти (`shipping-directory.test.ts` асертить імена
на чистому каноні, де їх і створює активна частина; він і далі застосовує
`SHIPPING_FIXTURES` цілком).

`fixtures/showcase.ts:110-111` — стейтмент `insert into public.shipping_methods
… 'pickup' …` ВИДАЛИТИ; над точками коментар «Метод `pickup` — із демо-сіду;
тут лише дві точки: відкрита й закрита». `fixtures/storefront-client.ts:21-25`
— так само видалити вставку методу; докблок `:3-5` → «🔴 Поверх демо-сіду й
фікстур `./storefront`: сід має залишки лише для простих товарів, тож
наявність модифікацій і характеристики картки перевірялися б на порожній
множині — тому тут складський рядок для модифікації й характеристика на ній».

`demo-seed.test.ts` — у `counts()` (`:50-59`) дописати лічильники нових
таблиць (`shipping_methods`, `shipping_zones`, `shipping_rates`,
`pickup_points`, `stock_by_pickup_point`). 🔴 Не косметика: кейс
«ідемпотентний: повторний докат демо-файлу не міняє лічильники» (`:116`)
сьогодні рахує лише каталог, тож жодна з пʼяти нових вставок під ним не
стоїть — а саме в них уперше зʼявляються дві нетривіальні форми `on
conflict` (інференс часткових індексів зон і залишків), де помилка дає
тихий дубль, а не помилку. Без цих лічильників слово «ідемпотентність» у
шапці сіду для секції 10 — віра, а не гейт.

`storefront-showcase.test.ts:252` `expect(points).toBe(1)` → `toBe(2)` з
коментарем «системна демо-точка + відкрита фікстурна; закрита не рахується».
🔴 Це єдиний лічильник точок у харнесі, який зсуває сід: перевірено —
`loadActivePickupPointsCount` (`stock-info.ts:118`) фільтрує лише
`is_active`, а `is_system` не звужує ні його, ні `loadPickupPoints`
(`pickup-points.ts:14-19`), тож системна точка сіду видима як звичайна;
`storefront-client-queries`, `storefront-loaders` і `aggregate-deps` кількість
точок не асертять узагалі.

Run: `pnpm test:schema`
Expected: PASS (усі шестеро, хто накатує сід: `demo-seed`, `single-default`,
`aggregate-deps`, `storefront-showcase`, `storefront-client-queries`,
`storefront-loaders`; статичний `seed-determinism`; і `shipping-directory` на
чистому каноні).

- [ ] **Step 4: `loadPricesByProduct` і ціна на головній — той самий резолв, що в каталозі**

`packages/simplycms/src/storefront/loaders/pricing.ts` — додати:

```ts
/** Ціни кількох товарів одним запитом — для головної й серверного резолву позицій чекауту. */
export async function loadPricesByProduct(
  db: ActorDb,
  productIds: string[],
): Promise<Record<string, PriceEntry[]>> {
  if (productIds.length === 0) return {};
  const rows = await db
    .select(priceColumns)
    .from(productPrices)
    .where(inArray(productPrices.productId, productIds));
  return groupPricesByProduct(rows);
}
```

(імпорти: `inArray` з `drizzle-orm`, `productPrices` зі схеми, `priceColumns`,
`groupPricesByProduct` з `./entities/price`, `PriceEntry` з `simplycms/contracts`).

`entities/home-product.ts`: у `HomeProductRow` додати `price: number | null;
old_price: number | null;`; `toHomeProduct(row, sectionSlug, price: ResolvedPrice)`
кладе `price: price.price, old_price: price.oldPrice` (`ResolvedPrice` — з
`simplycms/domain/pricing`).

`loaders/home.ts::loadHomeProducts` і `loaders/home-sections.ts::loadSectionProducts`
(та `loadOneSectionProducts`, якщо мапить окремо): після вибірки рядків —

```ts
  // Ціна — ТИМ САМИМ доменним резолвом, що в каталозі (`product-list-item`):
  // окремий MIN(price)-агрегат був би другим способом рахувати ціну.
  const prices = await loadPricesByProduct(db, rows.map((r) => r.id));
  const defaultPriceType = await loadDefaultPriceTypeId(db);
  const priceOf = (id: string) =>
    resolvePrice(prices[id] ?? [], defaultPriceType, defaultPriceType, null);
```

і `toHomeProduct(row, …, priceOf(row.id))`.

`pages/home/types.ts::HomeProduct` — `price: number | null; old_price: number | null;`;
`toCardViewModel.ts` — `price: product.price, old_price: product.old_price`, докблок
замінити на «Ціна приходить із лоадера головної тим самим резолвом, що в
каталозі (К2-Е0)». Фабрика `product()` у
`storefront-routes/__tests__/home-n-plus-one.test.tsx:84-91` типізована як
`(): HomeProduct` — додати `price: null, old_price: null` (інакше TS2741 у
`pnpm typecheck`). 🔴 Зняти посилання «звіт Ф1, ризик №4» тут і «звіт Ф1» у
`views/HomeView.tsx:17` — документа не існує.

🔴 Детермінований порядок при однаковому `created_at`: усі рядки одного
`insert … select` дістають один `now()` (8 товарів сіду; 8 фікстурних у
`fixtures/storefront.ts`), тож `ORDER BY created_at DESC LIMIT 12` без
вторинного ключа відсікає «які трапляться». Додати `asc(products.id)` другим
ключем у `loadHomeProducts` (`home.ts:77`, `.orderBy(desc(products.createdAt))`)
і у вікно `row_number() over
(partition by … order by created_at desc, id)` у `loadSectionProducts`
(`home-sections.ts:40-42`) — це правило показу головної, не лише тесту.

Гейт ЗНАЧЕННЯ, не лише типу: у `test-harness/pg/__tests__/storefront-loaders.test.ts`
(накатує демо-сід і `FIXTURE_STATEMENTS`) додати кейс — `loadHomeProducts(db,
true)` (featured: пʼять сідових товарів; фікстурні у добірку не входять —
вісім наповнювачів мають `is_featured = false`, а «чернетка» з `is_featured =
true` відсіюється фільтром `is_active`, `fixtures/storefront.ts:35-39`; тож
набір під лімітом 12 детермінований незалежно від порядку) містить
`sonyachna-panel-450w-mono` з `price: 4800, old_price: null` і
`sonyachna-panel-600w-bifacial` з `price: 7200, old_price: 8100` (ціни
`product_prices` сіду за дефолтним типом ціни), а
`loadOneSectionProducts(db, sectionRef)` для розділу `sonyachni-paneli` (його
`SectionRef` — з БД за slug; 🔴 розділ панелей ДОЧІРНІЙ до
`sonyachna-energetyka`, тож кореневі бакети `loadSectionProducts` цих товарів
не містять) віддає ті самі значення. Докблок `homeProductColumns`
(`entities/home-product.ts:5`) — прибрати «і ціни картці не потрібні»: ціна
тепер приходить окремим `loadPricesByProduct`.

Run: `pnpm typecheck && pnpm test && pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/storefront-loaders.test.ts`
Expected: PASS.

- [ ] **Step 5: Синхронізація шаблону і гейти**

```bash
pnpm template:sync && git status --porcelain
pnpm format:check && pnpm lint && pnpm test && pnpm test:schema
# 🔴 Око: db:demo друкує готовий DATABASE_URL — узяти його в .env.local,
# підняти `pnpm dev` і відкрити `/`.
pnpm db:demo
```

Expected: у дифі — рівно
`packages/create-simplycms-store/template/supabase/migrations/demo/demo-seed.sql`
(парність — `tests/create-store-template-parity.test.ts`, кейс «тека
`packages/simplycms/migrations` байт-ідентична»); склад канону там не
змінюється, бо DDL етап не везе; усе зелене. На `/` — банер суцільним
кольоровим прямокутником із підписом і НУЛЬ 404 у мережевій панелі (раніше
там був `/demo/banners/solar-home.jpg`). 🔴 Це не гейт, а єдиний доказ
data-URI-плейсхолдера: автоматики, яка рендерить `<img>`, етап не має —
браузерний контур повертає трек К6.

- [ ] **Step 6: Коміт**

```bash
git add -A packages/simplycms/migrations packages/create-simplycms-store/template packages/simplycms/test-harness/pg/__tests__ packages/simplycms/src/storefront packages/simplycms/src/storefront-routes/pages/home packages/simplycms/src/storefront-routes/views/HomeView.tsx packages/simplycms/src/storefront-routes/__tests__/home-n-plus-one.test.tsx
git commit -m "feat(k2-e0): покупний демо-сід — доставка, системна точка, залишки, decrease_on_order; ціна на головній

Демо доходить до рядка в orders зі списанням; обидві гілки правила наявності
в одному сіді; сід — єдина декларація активної доставки для харнесу, фікстури
розщеплено на активну (ідемпотентну поверх сіду) і негативну частини. Точка
видачі — системна (is_system), вона ж склад списання й повернення залишку.
Тумблер decrease_on_order піднімається умовним UPDATE (повтор накату не пише
нічого). Банери — inline data:image/svg+xml замість неіснуючих файлів
статики: схема БД не змінюється жодним рядком. Пін
детермінізму 20, копія сіду в шаблоні синхронна. Картки головної отримують
ціну тим самим resolvePrice, що каталог (Е0-6)."
```

---

### Task 8: Наявність — `isPurchasable` як єдине правило на читанні (Е0-3, read-side)

**Files:**
- Modify: `packages/simplycms/src/domain/inventory.ts`
- Modify: `packages/simplycms/src/contracts/objects/inventory.ts:28,32` (`stock_status: StockStatus | null`)
- Modify: `packages/simplycms/src/core/hooks/useStock.ts:67-75`, `core/index.ts:40` (видалити `isProductAvailable`)
- Modify: `packages/simplycms/src/storefront/loaders/stock-info.ts:82`, `stock.ts:97`, `catalog-products.ts:23,102-103,133-141`
- Modify: `packages/simplycms/src/domain/README.md:27`, `contracts/entities.ts:170,196` (документація правила й читань)
- Modify: `packages/simplycms/routes/storefront/_storefront/catalog/$sectionSlug/$productSlug.tsx:59-62`
- Modify: `packages/simplycms/test-harness/pg/__tests__/fixtures/storefront-client.ts`, `storefront-client-queries.test.ts:174-175`
- Test: `packages/simplycms/src/domain/__tests__/inventory.test.ts`

**Interfaces:**
- Produces: `isPurchasable(status: StockStatus | null | undefined): boolean`;
  `schemaOrgAvailability(status): 'https://schema.org/InStock' | 'https://schema.org/BackOrder' | 'https://schema.org/OutOfStock'`;
  `calculateProductAvailability(product: ProductAvailabilityInput): boolean` (другий параметр знято);
  `enrichProductsWithAvailability(products)` (другий параметр знято).
- Consumes: `StockStatus` з `simplycms/contracts` (`objects/inventory.ts:3`).

- [ ] **Step 1: Юніти домену — нові кейси, спершу червоні**

Замінити вміст `packages/simplycms/src/domain/__tests__/inventory.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  calculateProductAvailability,
  enrichProductsWithAvailability,
  isPurchasable,
  schemaOrgAvailability,
} from '../inventory';
import type { ProductAvailabilityInput } from '../inventory';

describe('isPurchasable — статус є джерелом правди (К2-Е0, Е0-3)', () => {
  it('in_stock — доступний навіть без жодного рядка залишків', () => {
    expect(isPurchasable('in_stock')).toBe(true);
  });
  it('null (статус не заданий) — доступний, як і DEFAULT схеми', () => {
    expect(isPurchasable(null)).toBe(true);
    expect(isPurchasable(undefined)).toBe(true);
  });
  it('on_order — доступний під замовлення', () => {
    expect(isPurchasable('on_order')).toBe(true);
  });
  it('out_of_stock — недоступний, навіть якщо залишки хтось забув обнулити', () => {
    expect(isPurchasable('out_of_stock')).toBe(false);
  });
});

describe('schemaOrgAvailability', () => {
  it('три статуси → три URL schema.org; on_order — BackOrder, не OutOfStock', () => {
    expect(schemaOrgAvailability('in_stock')).toBe('https://schema.org/InStock');
    expect(schemaOrgAvailability('on_order')).toBe('https://schema.org/BackOrder');
    expect(schemaOrgAvailability('out_of_stock')).toBe('https://schema.org/OutOfStock');
    expect(schemaOrgAvailability(null)).toBe('https://schema.org/InStock');
  });
});

describe('calculateProductAvailability', () => {
  it('простий товар: статус, а не кількість', () => {
    const inStock: ProductAvailabilityInput = {
      id: 'p1', stock_status: 'in_stock', has_modifications: false,
    };
    const out: ProductAvailabilityInput = {
      id: 'p2', stock_status: 'out_of_stock', has_modifications: false,
      stock_by_pickup_point: [{ quantity: 3 }],
    };
    expect(calculateProductAvailability(inStock)).toBe(true);
    expect(calculateProductAvailability(out)).toBe(false);
  });

  it('товар із модифікаціями: доступний, якщо доступна будь-яка', () => {
    const p: ProductAvailabilityInput = {
      id: 'p1', stock_status: 'out_of_stock', has_modifications: true,
      product_modifications: [
        { id: 'm1', stock_status: 'out_of_stock', is_default: true, sort_order: 0 },
        { id: 'm2', stock_status: 'in_stock', is_default: false, sort_order: 1 },
      ],
    };
    expect(calculateProductAvailability(p)).toBe(true);
  });

  it('товар із модифікаціями, усі out_of_stock — недоступний', () => {
    const p: ProductAvailabilityInput = {
      id: 'p1', stock_status: 'in_stock', has_modifications: true,
      product_modifications: [
        { id: 'm1', stock_status: 'out_of_stock', is_default: true, sort_order: 0 },
      ],
    };
    expect(calculateProductAvailability(p)).toBe(false);
  });
});

describe('enrichProductsWithAvailability', () => {
  it('додає прапорець isAvailable за статусом', () => {
    const res = enrichProductsWithAvailability([
      { id: 'p1', stock_status: 'on_order', has_modifications: false },
      { id: 'p2', stock_status: 'out_of_stock', has_modifications: false },
    ]);
    expect(res.map((p) => p.isAvailable)).toEqual([true, false]);
  });
});
```

Run: `pnpm vitest run packages/simplycms/src/domain/__tests__/inventory.test.ts`
Expected: FAIL (`isPurchasable` не експортується; старі сигнатури).

- [ ] **Step 2: Домен — одне правило; контракт — вужчий тип**

У `contracts/objects/inventory.ts` (`:28` і `:32`) `stock_status: string | null`
→ `stock_status: StockStatus | null` (тип оголошено в цьому ж файлі, `:3`;
`catalog.ts:11,22` уже типізований так).

Замінити вміст `packages/simplycms/src/domain/inventory.ts`:

```ts
// Pure-правило наявності — ЄДИНЕ місце, де вирішується «можна купити».
// Перенесено з core/hooks/useProductsWithStock; переписано К2-Е0 (Е0-3).

import type { ProductAvailabilityInput, StockStatus } from 'simplycms/contracts';

export type { ProductAvailabilityInput, StockData } from 'simplycms/contracts';

/**
 * 🔴 Статус — джерело правди на читанні; кількість по точках — його деталь.
 *
 * До К2-Е0 у коді жило СІМ формул: три — перенос plpgsql `get_stock_info`
 * («qty > 0 або on_order»), дві — лише статус, JSON-LD — своя, і мертва
 * `isProductAvailable` у `core/hooks/useStock` («in_stock → qty > 0»). Перша
 * дає «Немає в наявності» кожному магазину, що не веде обліку по точках (а
 * DEFAULT статусу в схемі — `in_stock`, тобто канон обіцяє протилежне).
 * Правдивість статусу при обліку тримає write-side: `createOrder` списує
 * залишок під `FOR UPDATE` і переводить статус в `out_of_stock` на нулі
 * (`storefront/loaders/order-create.ts`).
 */
export function isPurchasable(status: StockStatus | null | undefined): boolean {
  return status !== 'out_of_stock';
}

/** Значення `availability` для schema.org Offer — з того самого статусу. */
export function schemaOrgAvailability(
  status: StockStatus | null | undefined,
):
  | 'https://schema.org/InStock'
  | 'https://schema.org/BackOrder'
  | 'https://schema.org/OutOfStock' {
  if (status === 'out_of_stock') return 'https://schema.org/OutOfStock';
  if (status === 'on_order') return 'https://schema.org/BackOrder';
  return 'https://schema.org/InStock';
}

/**
 * Доступність товару: для товару з модифікаціями — доступна будь-яка
 * модифікація; для простого — статус самого товару.
 */
export function calculateProductAvailability(
  product: ProductAvailabilityInput,
): boolean {
  const mods = product.product_modifications || [];
  const hasModifications = product.has_modifications ?? true;
  if (hasModifications && mods.length > 0) {
    return mods.some((m) => isPurchasable(m.stock_status));
  }
  return isPurchasable(product.stock_status);
}

/** Збагачує товари полем isAvailable. */
export function enrichProductsWithAvailability<
  T extends ProductAvailabilityInput,
>(products: T[]): (T & { isAvailable: boolean })[] {
  return products.map((product) => ({
    ...product,
    isAvailable: calculateProductAvailability(product),
  }));
}
```

Run: `pnpm vitest run packages/simplycms/src/domain/__tests__/inventory.test.ts`
Expected: PASS.

- [ ] **Step 3: Споживачі лоадерів і мертва сьома формула**

`storefront/loaders/stock-info.ts`: імпорт `import { isPurchasable } from 'simplycms/domain/inventory';`
і `isAvailable: isPurchasable(stockStatus),` (замість `totalQuantity > 0 || stockStatus === 'on_order'`);
у докблоці `loadStockInfo` абзац «Правило доступності збережено дослівно…» →
«Доступність — `isPurchasable` (домен): статус, не кількість; `totalQuantity`
і `byPoint` — деталь показу».

`storefront/loaders/stock.ts:97`: `isAvailable: isPurchasable(row.stock_status),`
(той самий імпорт); докблок `loadModificationStock` — те саме речення.

`storefront/loaders/catalog-products.ts`: виклик `calculateProductAvailability({…}, { modificationStock, productStock })`
(`:133-141`) → без другого аргумента; рядки `:102-103`
(`loadStockByModification`/`loadStockByProduct`) і імпорт `:23` — видалити:
у цьому файлі їх читала лише доступність (перевірено `grep`). Два докоментарі
в `contracts/entities.ts:170,196` описують `loadCatalogProductsWhere` як
читача `stock_by_pickup_point` через `loadStockByModification`/`loadStockByProduct`
— переписати на «доступність — зі `stock_status` рядка, без окремого читання
залишків». `domain/README.md:27` («та сама семантика, що в RPC `get_stock_info`»)
→ «`isPurchasable`, `schemaOrgAvailability`, `calculateProductAvailability`,
`enrichProductsWithAvailability` — статус є джерелом правди, кількість — деталь
показу (К2-Е0)».

🔴 `core/hooks/useStock.ts:67-75` — `isProductAvailable(stockStatus, totalQuantity)`
(`in_stock → qty > 0`, правило, протилежне новому) ВИДАЛИТИ разом із
реекспортом у `core/index.ts:40`: викликів у репо нуль (`orient`), а
експортована контр-формула поруч із «єдиним правилом» — саме той дрейф, який
етап закриває. Реекспорти `getStockStatusLabel`/`getStockStatusColor` і типів
лишаються.

- [ ] **Step 4: JSON-LD — з того самого правила**

У `$productSlug.tsx`: імпорт `import { schemaOrgAvailability } from 'simplycms/domain/inventory';`
і `availability: schemaOrgAvailability(product.stock_status),` замість
тернарного `in_stock ? InStock : OutOfStock` (`:59-62`).

- [ ] **Step 5: Харнес — фікстуру перенацілити, а не інвертувати**

У `fixtures/storefront-client.ts` коментар над `OUT_OF_STOCK_MOD_SLUG` →
«Модифікація зі статусом `out_of_stock` — негативний контроль наявності
(К2-Е0: статус, не кількість)», а в `CLIENT_FIXTURE_STATEMENTS` додати
стейтмент (після вставки залишку):

```ts
  // Негативний контроль правила «статус — джерело правди»: без цього рядка
  // модифікація без залишку була б ДОСТУПНОЮ (DEFAULT статусу — in_stock).
  `update public.product_modifications m
      set stock_status = 'out_of_stock'
     from public.products p
    where p.id = m.product_id
      and p.slug = '${MODIFIED_PRODUCT_SLUG}'
      and m.slug = '${OUT_OF_STOCK_MOD_SLUG}'`,
```

У `storefront-client-queries.test.ts:174-175` коментар → «🔴 Модифікація
`out_of_stock` мусить бути в мапі й недоступною — за СТАТУСОМ, не за нулем
залишку»; асерт лишається `{ totalQuantity: 0, isAvailable: false }`.
`storefront-showcase.test.ts:236-250` — без змін (доступна модифікація з
залишком → `true`).

Run: `pnpm typecheck && pnpm test && pnpm test:schema`
Expected: PASS.

- [ ] **Step 6: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm test:schema
git add -A packages/simplycms/src/domain packages/simplycms/src/contracts/objects/inventory.ts packages/simplycms/src/contracts/entities.ts packages/simplycms/src/storefront/loaders packages/simplycms/src/core packages/simplycms/routes packages/simplycms/test-harness
git commit -m "feat(k2-e0): isPurchasable — єдине правило наявності; JSON-LD BackOrder

Статус є джерелом правди на читанні (DEFAULT схеми — in_stock), кількість —
деталь показу. Сім формул зведено до домену, мертва isProductAvailable
видалена, контракт звужено до StockStatus; фікстура харнеса перенацілена на
out_of_stock замість інверсії, щоб негативний контроль лишився (Е0-3)."
```

---

### Task 9: Write-side — списання й повернення залишку в ОДНІЙ точці під `FOR UPDATE` (Е0-3)

**Files:**
- Modify: `packages/simplycms/src/storefront/loaders/db.ts:31-49` (`OperatorEscalation` у двох обгортках)
- Modify: `packages/simplycms/src/storefront/loaders/session.ts:29-34` (прокидання `operator`)
- Create: `packages/simplycms/src/storefront/loaders/entities/new-order.ts` (`NewOrderItem`, `NewOrderInput`, `CreatedOrder` — переїзд типів заради канону 150 рядків)
- Create: `packages/simplycms/src/storefront/loaders/stock-write.ts` (`StockTarget`, `StockLine`, `LockedStockRow`, `resolveStockPoint`, `lockTargetStock` — 112 рядків)
- Create: `packages/simplycms/src/storefront/loaders/stock-status.ts` (`setTargetStatus` — 51)
- Create: `packages/simplycms/src/storefront/loaders/stock-reservation.ts` (`InsufficientStockError`, `reserveStock`, `releaseStock` — 113)
- Create: `packages/simplycms/src/storefront/loaders/order-stock.ts` (`loadStockManagement`, `reserveOrderStock`, `releaseOrderStock` — 87)
- Modify: `packages/simplycms/src/storefront/loaders/order-create.ts` (типи виїжджають; пʼятий параметр `operator`; виклик `reserveOrderStock`), `loaders/orders.ts:113` (`lockOrderStatus`), `loaders/index.ts` (реекспорти)
- Modify: `packages/simplycms/src/storefront-routes/server/profile-orders.ts:50-80` (одна транзакція + повернення залишку), `server/checkout.ts:41-54` (лише сигнатура `run`)
- Modify: `packages/simplycms/test-harness/pg/__tests__/storefront-personal-data.test.ts:24,184-186,205-207,226-258`
- Modify: `.github/instructions/data-access.instructions.md` («Storefront (SSR)» — правило ескалації)
- Create: `packages/simplycms/test-harness/pg/__tests__/order-stock.test.ts`

**Interfaces:**
- Produces:
  - `type OperatorEscalation = <T>(fn: (db: ActorDb) => Promise<T>) => Promise<T>` (`loaders/db.ts`);
  - `withCustomerDb(userId, fn: (db, operator) => …)`, `withOrderTokenDb(token, fn: (db, operator) => …)`, `withSessionDb(fn: (db, userId, operator) => …)` — новий аргумент опційний для чинних викликачів;
  - `createOrder(db, userId, accessToken, input, operator: OperatorEscalation): Promise<CreatedOrder>` (5-й параметр обовʼязковий);
  - `class InsufficientStockError extends Error { readonly productId; readonly modificationId }`;
  - `loadStockManagement(db): Promise<{ decrease_on_order: boolean }>` (`order-stock.ts`);
  - `resolveStockPoint(db, pickupPointId: string | null): Promise<string | null>` (`stock-write.ts`);
  - `reserveOrderStock(db, lines: StockLine[], pickupPointId: string | null): Promise<void>`,
    `releaseOrderStock(db, orderId: string): Promise<void>` (`order-stock.ts`);
  - `lockOrderStatus(db, orderId): Promise<{ statusId: string | null } | null>` (`orders.ts`).
- Consumes: `withActor` (`fn(db, client)`, `db/with-actor.ts:41-44`), `Actor` з `simplycms/db` (`db/index.ts:10-11`); демо-сід Task 7 (метод `pickup`, СИСТЕМНА точка «Склад у Києві» з `is_system = true`, залишки `450w=5`, `550w=3`, `decrease_on_order = true` умовним апдейтом).

🔴 **DDL етап не потребує — і це перевірено, а не припущено.** `app_admin`
має `select, insert, update, delete` на `stock_by_pickup_point`
(`0002_grants.sql:156`, той самий блок дає `products` — `:145` — і
`product_modifications` — `:141`), а `app_user` має на цю таблицю рівно
`select` (`0002_grants.sql:87`). Тобто механізм списання й повернення
збирається на чинних грантах і чинній схемі: жодної міграції, жодного
`db:diff`, жодної правки `schema.ts`.

🔴 **Чому `SELECT … FOR UPDATE`, а не guarded UPDATE.** Guarded UPDATE
(`where quantity >= take`) захищає від оверселу, але переворот статусу
рахувався б від залишку, прочитаного ДО блокування: два паралельні
замовлення по одиниці на залишок 2 обидва бачили б «лишається 1», жоден не
фліпав, і магазин мав би нуль на складі при `in_stock` — саме той стан, який
Е0-3 забороняє. Блокування рядків до читання робить прочитане правдивим
(під READ COMMITTED заблокований `FOR UPDATE` після чужого коміту віддає
оновлену версію рядка), тож і арифметика, і фліп — від реального залишку;
guard і гілка «0 оновлених рядків» зникають. Drizzle: `.for('update', { of:
stockByPickupPoint })` (`pg-core/query-builders/select.js:722`, діалект
емітить `for update of "stock_by_pickup_point"` — `pg-core/dialect.js:291`;
блокуються лише рядки залишків, не точок).

🔴 **Списання й повернення йдуть в ОДНУ детерміновану точку (рішення Р2).**
Розкладка по кількох точках «у порядку показу» знята: вона робила повернення
при скасуванні неможливим без окремої таблиці резервів (магазин не знає, з
яких саме точок узяли), а сам порядок був довільним правилом показу, а не
обліку. Точка резолвиться `resolveStockPoint` за трьома кроками:
1. `orders.pickup_point_id`, якщо він є (`schema.ts:785`, uuid nullable, FK
   `orders_pickup_point_id_fkey`; чекаут уже проносить це поле:
   `checkout-input.ts:39` → `checkout.ts:110` → `order-create.ts:118`);
2. інакше — точка з `pickup_points.is_system = true` (`schema.ts:585`,
   `boolean default false not null`; на write-path читача сьогодні немає,
   адмінка прапорець уже знає — `PickupPointEdit.tsx:191`);
3. інакше — перша активна за `(sort_order, id)`.
Повернення йде В ТУ САМУ точку тим самим правилом: для замовлення точка вже
записана в `orders`, тож повернення точне без таблиці резервів. Наслідок
семантики, свідомо прийнятий власником: залишок 3+2 у двох точках **не
продасть 4** — точка є одиницею обліку, а не сумою по магазину.

🔴 **Названа межа цієї точності — видалена точка видачі.** FK
`orders_pickup_point_id_fkey` — `ON DELETE set null` (`0001_init.sql:651`), а
`stock_by_pickup_point_pickup_point_id_fkey` — `ON DELETE cascade`
(`0001_init.sql:684`). Тож якщо магазин видалив НЕсистемну точку вже після
оформлення (`PickupPoints.tsx:178` це дозволяє; системну — ні), звʼязок
замовлення з нею рветься, її рядки залишків зникають каскадом, і скасування
такого замовлення повертає кількість у резолвлену запасну точку — системну
або першу активну. Етап це не лагодить і не має: колонка, яку не обнуляє
видалення, — це DDL, а К2-Е0 без DDL за рішенням Р3. Межа названа явно;
шлях без DDL, якщо власник захоче точності й тут, — писати id точки списання
в наявний `orders.shipping_data` (jsonb) і читати його першим у
`releaseOrderStock`.

🔴 **Що означає «рядка залишків немає» (оверсел).** Питання не косметичне:
після Task 8 покупність визначає СТАТУС, і фліп статусу — єдина ниточка від
кількості до вітрини. Рішення таке:
- **немає жодного рядка `stock_by_pickup_point` по ЖОДНІЙ точці, яка може
  обслужити замовлення** (`is_active` або `is_system`) — магазин обліку цієї
  цілі не веде (сьогоднішня поведінка, і саме на ній тримається демо-сід:
  залишки заведено двом панелям із восьми). Тихий вихід, замовлення
  проходить, статус не чіпається;
- **рядки на обслуговуючих точках є, але не на резолвленій** — облік
  ведеться, а точка видачі його не покриває. Це `InsufficientStockError`, а
  не тихий продаж: інакше замовлення без самовивозу (резолв у системну точку)
  списувало б із повітря, поки залишок лежить на роздрібній точці.

Тому блокований `SELECT` бере рядки цілі по ВСІХ точках, які взагалі можуть
обслужити замовлення (`is_active` або `is_system`), а списується рівно ОДИН —
рядок резолвленої точки. Той самий знімок дає і чесний фліп: статус
перевертається за СУМОЮ по точках, а не за однією точкою (інакше товар із
залишком на сусідній точці зникав би з продажу разом із першою спорожнілою).

🔴 Обидві гілки міряються саме по ОБСЛУГОВУЮЧИХ точках, а не по всіх, — і це
названа межа, а не недогляд: залишок, що лежить ЛИШЕ на закритій несистемній
точці, дає першу гілку (тихий вихід), а не другу. Так write-side узгоджений
із читанням — read-side такий залишок уже вважає неіснуючим
(`stock-info.ts:76` фільтрує `is_active`), тож правило тут не суворіше за те,
що бачить покупець на картці.

🔴 **Чому повернення при скасуванні обовʼязкове саме тут (рішення Р1).**
Етап вмикає write-side декремент; без симетричного повернення інваріант
асиметричний — демо-магазин після кількох скасувань показує нуль залишку при
нулі продажів. Тому `releaseStock` живе в тому ж модулі, що й `reserveStock`,
і `cancelMyOrder` в ОДНІЙ транзакції і скасовує, і повертає.

- [ ] **Step 1: Харнес-тест — спершу червоний**

`packages/simplycms/test-harness/pg/__tests__/order-stock.test.ts`:

```ts
// Write-side правила наявності (К2-Е0, Е0-3) ПОВЕРХ покупного демо-сіду
// (Task 7): метод `pickup`, СИСТЕМНА точка «Склад у Києві», залишки 450w=5 і
// 550w=3, decrease_on_order=true — з сіду; тест додає лише те, чого сід не має
// (дві власні точки для перевірки «одна точка, а не сума», залишки для товарів
// без сідового обліку).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import {
  InsufficientStockError,
  createOrder,
  loadOrderDetail,
  releaseOrderStock,
  withOrderTokenDb,
  type NewOrderInput,
} from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles, createTempDatabase, dropTempDatabase, queryRows,
  randomDbName, withDbName, withUser,
} from '../apply.mjs';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../migrations');
/** Панель із сідовим залишком 5 на системній точці. */
const SEEDED_SLUG = 'sonyachna-panel-450w-mono';
/** Панель із сідовим залишком 3 — оформлення й скасування. */
const CANCEL_SLUG = 'sonyachna-panel-550w-mono';
/** Панель без сідового залишку — залишки на ДВОХ тестових точках. */
const TWO_POINTS_SLUG = 'sonyachna-panel-600w-bifacial';
/** Товари без сідового залишку — конкурентні кейси (на системній точці). */
const RACE_SLUG = 'stantsiya-nakopychennya-10kwh';
const FLIP_RACE_SLUG = 'akumulyator-lifepo4-200ah';
/** Товар без жодного рядка залишків — обліку немає. */
const UNTRACKED_SLUG = 'invertor-gibrydnyi-8kw';
/** Залишки на СИСТЕМНІЙ і на тестовій точці — третя ланка правила точки. */
const FALLBACK_SLUG = 'akumulyator-lifepo4-100ah';
// sort_order 10/11 — свідомо ДАЛІ за сідову точку (0): порядок показу без тайів.
const POINT_A = 'Тестова точка A';
const POINT_B = 'Тестова точка B';

interface IdRow { id: string }
interface QtyRow { quantity: number }
interface StatusRow { stock_status: string }

const baseInput = (
  productId: string, quantity: number, methodId: string, pickupPointId: string | null,
): NewOrderInput => ({
  firstName: 'Тест', lastName: 'Покупець', email: 'buyer@example.test', phone: '+380000000000',
  shippingMethodId: methodId, deliveryCity: null, deliveryAddress: null, pickupPointId,
  paymentMethod: 'cash', notes: null, subtotal: 100 * quantity, shippingCost: 0,
  total: 100 * quantity, hasDifferentRecipient: false, recipientFirstName: null,
  recipientLastName: null, recipientPhone: null, recipientEmail: null,
  savedRecipientId: null, savedAddressId: null,
  items: [{ productId, modificationId: null, name: 'Позиція', price: 100, quantity, basePrice: null, discountData: null }],
});

describe('замовлення списує залишок і повертає його при скасуванні', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_order_stock');
  let dbUrl = '';
  let methodId = '';
  let pointA = '';
  const ids: Record<string, string> = {};

  const idOf = async (slug: string): Promise<string> =>
    ((await queryRows(dbUrl, `select id from public.products where slug = $1`, [slug])) as IdRow[])[0].id;
  const quantities = async (productId: string): Promise<number[]> =>
    ((await queryRows(dbUrl,
      `select s.quantity from public.stock_by_pickup_point s
         join public.pickup_points pp on pp.id = s.pickup_point_id
        where s.product_id = $1 order by pp.sort_order, s.id`, [productId])) as QtyRow[])
      .map((r) => Number(r.quantity));
  const statusOf = async (productId: string): Promise<string> =>
    ((await queryRows(dbUrl, `select stock_status from public.products where id = $1`, [productId])) as StatusRow[])[0].stock_status;
  const ordersCount = async (): Promise<number> =>
    ((await queryRows(dbUrl, `select count(*)::int as c from public.orders`)) as { c: number }[])[0].c;
  const place = (productId: string, quantity: number, pickupPointId: string | null = null) => {
    const token = crypto.randomUUID();
    return withOrderTokenDb(token, (db, operator) =>
      createOrder(db, null, token, baseInput(productId, quantity, methodId, pickupPointId), operator));
  };

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, [
      ...readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith('.sql')).sort().map((n) => join(MIGRATIONS_DIR, n)),
      join(MIGRATIONS_DIR, 'demo/demo-seed.sql'),
    ]);
    [{ id: methodId }] = (await queryRows(dbUrl, `select id from public.shipping_methods where code = 'pickup'`)) as IdRow[];
    for (const slug of [SEEDED_SLUG, CANCEL_SLUG, TWO_POINTS_SLUG, RACE_SLUG, FLIP_RACE_SLUG, UNTRACKED_SLUG, FALLBACK_SLUG])
      ids[slug] = await idOf(slug);
    await queryRows(dbUrl,
      `insert into public.pickup_points (id, method_id, name, address, city, is_active, sort_order)
       values (gen_random_uuid(), $1, '${POINT_A}', 'вул. А, 1', 'Київ', true, 10),
              (gen_random_uuid(), $1, '${POINT_B}', 'вул. Б, 2', 'Київ', true, 11)`, [methodId]);
    [{ id: pointA }] = (await queryRows(dbUrl,
      `select id from public.pickup_points where name = '${POINT_A}'`)) as IdRow[];
    // Конкурентні кейси — на СИСТЕМНІЙ точці (замовлення без самовивозу
    // резолвиться саме туди); двоточковий кейс — на тестових точках; кейс
    // третьої ланки правила — на обох одразу, щоб було видно, ЯКУ з активних
    // точок вибрав резолв, коли системної немає.
    await queryRows(dbUrl,
      `insert into public.stock_by_pickup_point (id, pickup_point_id, product_id, modification_id, quantity)
       select gen_random_uuid(), pp.id, v.product_id::uuid, null, v.quantity
         from (values ($1, '${POINT_A}', 3), ($1, '${POINT_B}', 2), ($2, 'SYSTEM', 3),
                      ($3, 'SYSTEM', 2), ($4, 'SYSTEM', 2), ($4, '${POINT_A}', 2))
              as v(product_id, point_name, quantity)
         join public.pickup_points pp
           on (v.point_name = 'SYSTEM' and pp.is_system) or pp.name = v.point_name`,
      [ids[TWO_POINTS_SLUG], ids[RACE_SLUG], ids[FLIP_RACE_SLUG], ids[FALLBACK_SLUG]]);
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    // 🔴 Ключ прибирається, як у решті 15 харнес-тестів: `fileParallelism:
    // false` не дає ізоляції процесу, тож лишений `DATABASE_URL` тек би в
    // наступний файл сюїти.
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('передумова: демо-сід вмикає облік', async () => {
    const [{ value }] = (await queryRows(dbUrl, `select value from public.system_settings where key = 'stock_management'`)) as { value: { decrease_on_order: boolean } }[];
    expect(value.decrease_on_order).toBe(true);
  });

  it('передумова: демо-сід має рівно одну СИСТЕМНУ точку', async () => {
    // 🔴 Саме на ній тримається крок 2 резолву: без неї замовлення без
    // самовивозу пішло б у «першу активну», тобто в довільну роздрібну точку.
    const rows = await queryRows(dbUrl, `select name from public.pickup_points where is_system`);
    expect(rows).toHaveLength(1);
  });

  it('списує із сідового залишку і не чіпає статус, доки залишок є', async () => {
    const order = await place(ids[SEEDED_SLUG], 3);
    expect(order.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await quantities(ids[SEEDED_SLUG])).toEqual([2]);
    expect(await statusOf(ids[SEEDED_SLUG])).toBe('in_stock');
  });

  it('на нулі переводить статус в out_of_stock', async () => {
    await place(ids[SEEDED_SLUG], 2);
    expect(await quantities(ids[SEEDED_SLUG])).toEqual([0]);
    expect(await statusOf(ids[SEEDED_SLUG])).toBe('out_of_stock');
  });

  it('🔴 нестача — відмова, і рядка в orders НЕМАЄ (транзакція відкочена)', async () => {
    const before = await ordersCount();
    await expect(place(ids[SEEDED_SLUG], 1)).rejects.toBeInstanceOf(InsufficientStockError);
    expect(await ordersCount()).toBe(before);
  });

  it('🔴 скасування ПОВЕРТАЄ залишок і статус: стан той самий, що до замовлення', async () => {
    const before = await quantities(ids[CANCEL_SLUG]);
    const beforeStatus = await statusOf(ids[CANCEL_SLUG]);
    const order = await place(ids[CANCEL_SLUG], 3);
    expect(await quantities(ids[CANCEL_SLUG])).toEqual([0]);
    expect(await statusOf(ids[CANCEL_SLUG])).toBe('out_of_stock');

    // Те саме, що робить `cancelMyOrder`, і в тому самому порядку: спершу
    // читання ПІД АКТОРОМ (право доводить RLS), і лише потім ескалація в тій
    // же транзакції. Сам serverFn потребує сесії Better Auth — його
    // орчестрацію тримають typecheck і live-smoke.
    await withOrderTokenDb(order.accessToken as string, async (db, operator) => {
      expect(await loadOrderDetail(db, order.id)).not.toBeNull();
      await operator((odb) => releaseOrderStock(odb, order.id));
    });

    expect(await quantities(ids[CANCEL_SLUG])).toEqual(before);
    expect(await statusOf(ids[CANCEL_SLUG])).toBe(beforeStatus);
  });

  it('🔴 замовлення без самовивозу йде в СИСТЕМНУ точку: рядка там немає — відмова, а не тихий продаж', async () => {
    const before = await ordersCount();
    await expect(place(ids[TWO_POINTS_SLUG], 1)).rejects.toBeInstanceOf(InsufficientStockError);
    expect(await ordersCount()).toBe(before);
    expect(await quantities(ids[TWO_POINTS_SLUG])).toEqual([3, 2]);
  });

  it('🔴 одна точка не збирає залишок із сусідньої: 3+2 не продасть 4', async () => {
    await expect(place(ids[TWO_POINTS_SLUG], 4, pointA)).rejects.toBeInstanceOf(InsufficientStockError);
    expect(await quantities(ids[TWO_POINTS_SLUG])).toEqual([3, 2]);
  });

  it('списує рівно з названої точки; статус тримається СУМОЮ по точках', async () => {
    await place(ids[TWO_POINTS_SLUG], 3, pointA);
    expect(await quantities(ids[TWO_POINTS_SLUG])).toEqual([0, 2]);
    expect(await statusOf(ids[TWO_POINTS_SLUG])).toBe('in_stock');
  });

  it('🔴 два конкурентні по 2 на залишок 3 — рівно одне проходить (FOR UPDATE)', async () => {
    // Послідовні кейси зеленіли б і для «SELECT → безумовний UPDATE», який
    // оверселить при перетині транзакцій; тут дві транзакції справді перетинаються.
    const settled = await Promise.allSettled([place(ids[RACE_SLUG], 2), place(ids[RACE_SLUG], 2)]);
    const ok = settled.filter((r) => r.status === 'fulfilled').length;
    const rejected = settled.filter((r) => r.status === 'rejected' && r.reason instanceof InsufficientStockError).length;
    expect([ok, rejected]).toEqual([1, 1]);
    expect(await quantities(ids[RACE_SLUG])).toEqual([1]);
    expect(await statusOf(ids[RACE_SLUG])).toBe('in_stock');
  });

  it('🔴 два конкурентні по 1 на залишок 2 — обидва проходять, статус out_of_stock', async () => {
    // Pre-read без блокування дав би «лишається 1» ОБОМ і жодного фліпу:
    // нуль на складі при in_stock. Саме цей кейс пінить читання під FOR UPDATE.
    const settled = await Promise.allSettled([place(ids[FLIP_RACE_SLUG], 1), place(ids[FLIP_RACE_SLUG], 1)]);
    expect(settled.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await quantities(ids[FLIP_RACE_SLUG])).toEqual([0]);
    expect(await statusOf(ids[FLIP_RACE_SLUG])).toBe('out_of_stock');
  });

  it('товар без рядків залишків — обліку немає, замовлення проходить, статус не змінюється', async () => {
    const order = await place(ids[UNTRACKED_SLUG], 5);
    expect(order.orderNumber).toMatch(/^\d{6}-[0-9A-F]{6}$/);
    expect(await statusOf(ids[UNTRACKED_SLUG])).toBe('in_stock');
  });

  it('🔴 без системної точки резолв падає в ПЕРШУ АКТИВНУ за (sort_order, id)', async () => {
    // Третя ланка правила Р2 — єдина, яку демо-сід сам не відтворює: у ньому
    // рівно одна точка, і вона системна. Прапорець знімається на час кейса,
    // лишаються три активні точки, і найменший sort_order у сідової (0 проти
    // 10 і 11) — тож списання мусить піти саме в неї, а не в тестову.
    await queryRows(dbUrl, `update public.pickup_points set is_system = false`);
    try {
      await place(ids[FALLBACK_SLUG], 1);
      expect(await quantities(ids[FALLBACK_SLUG])).toEqual([1, 2]);
    } finally {
      await queryRows(dbUrl,
        `update public.pickup_points set is_system = true where name = 'Склад у Києві'`);
    }
  });
});
```

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/order-stock.test.ts`
Expected: FAIL (`operator` не існує; `InsufficientStockError` і `releaseOrderStock` не експортуються).

- [ ] **Step 2: Scoped-ескалація в обгортках `loaders/db.ts` і прокидання через `withSessionDb`**

У `packages/simplycms/src/storefront/loaders/db.ts` замінити `withCustomerDb`
і `withOrderTokenDb` та додати тип і фабрику (`Actor`, `ActorRole` уже
експортуються з `simplycms/db`, `db/index.ts:11`):

```ts
import { withActor, type Actor, type ActorDb } from 'simplycms/db';
import type pg from 'pg';

/**
 * Службова дія магазину ВСЕРЕДИНІ транзакції покупця — під `app_admin`,
 * з негайним поверненням до ролі актора.
 *
 * 🔴 Навіщо, коли є `withStoreOperatorDb`: списання залишку мусить бути в
 * ТІЙ САМІЙ транзакції, що й вставка замовлення (інакше замовлення без
 * списання або списання без замовлення), а скасування з поверненням залишку
 * — у тій самій, що й перевірка права (інакше між «перевірив» і «записав» —
 * вікно). `app_user` за `0002_grants.sql` має на
 * `products` (`:78`) і `stock_by_pickup_point` (`:87`) лише SELECT і не має
 * UPDATE на `orders` (`:104`) — і це правильно: покупець не пише в облік і не редагує
 * замовлення. Тому роль перемикається рівно на час службової дії тим самим
 * `SET LOCAL ROLE`, яким її ставить `withActor`; runtime-роль має `set true`
 * на обидві (`0000_prelude.sql:94-95`), а членство Postgres перевіряє проти
 * session user, не проти поточної ролі.
 *
 * Правило використання — те саме, що в `withStoreOperatorDb`, лише всередині
 * однієї транзакції: викликати ПІСЛЯ того, як RLS уже прийняла читання чи
 * запис покупця в цій транзакції, і лише для обліку магазину — ніколи для
 * читання чи запису чужих рядків. Функція недоступна поза обгортками нижче:
 * її створює сама транзакція, тож «ескалація з нізвідки» неможлива за
 * побудовою. Канон — `data-access.instructions.md`, «Ескалація ролі покупцем».
 */
export type OperatorEscalation = <T>(
  fn: (db: ActorDb) => Promise<T>,
) => Promise<T>;

function escalationFor(
  client: pg.PoolClient,
  db: ActorDb,
  actor: Actor,
): OperatorEscalation {
  return async (fn) => {
    await client.query('set local role app_admin');
    try {
      return await fn(db);
    } finally {
      await restoreRoleQuietly(client, actor);
    }
  };
}

/**
 * Повернення ролі актора, яке не підміняє собою первинну помилку.
 *
 * 🔴 Саме `finally`, а не success-path: `InsufficientStockError` кидається
 * чистим JS ПІСЛЯ успішного `SELECT … FOR UPDATE`, тобто транзакція в цей
 * момент ЖИВА — без повернення ролі решта транзакції лишилася б під
 * `app_admin`, і ескалація пережила б `fn`, хоч контракт обіцяє «рівно на
 * час `fn`».
 *
 * 🔴 І саме ТИХО — точно як `rollbackQuietly` (`db/with-actor.ts:81-87`):
 * якщо `fn` упав ЗАПИТОМ, транзакція вже aborted, і `set local role` кинув
 * би 25P02, замаскувавши першопричину. Гасити помилку тут безпечно: таку
 * транзакцію `withActor` однаково відкотить, а ROLLBACK сам скидає
 * `SET LOCAL ROLE`. Імʼя ролі — з валідованого `Actor`.
 */
async function restoreRoleQuietly(
  client: pg.PoolClient,
  actor: Actor,
): Promise<void> {
  try {
    await client.query(`set local role ${actor.role}`);
  } catch {
    // Свідомо тихо — див. докблок вище.
  }
}

export function withCustomerDb<T>(
  userId: string,
  fn: (db: ActorDb, operator: OperatorEscalation) => Promise<T>,
): Promise<T> {
  const actor: Actor = { role: 'app_user', userId };
  return withActor(actor, (db, client) =>
    fn(db, escalationFor(client, db, actor)),
  );
}

export function withOrderTokenDb<T>(
  orderToken: string,
  fn: (db: ActorDb, operator: OperatorEscalation) => Promise<T>,
): Promise<T> {
  const actor: Actor = { role: 'app_user', orderToken };
  return withActor(actor, (db, client) =>
    fn(db, escalationFor(client, db, actor)),
  );
}
```

Докблоки над `withCustomerDb`/`withOrderTokenDb` лишаються (перенести над
новими сигнатурами). У докблоці `withStoreOperatorDb` дописати речення: «Для
дій, які ініціює ПОКУПЕЦЬ у власній транзакції, — не ця обгортка, а
`operator` з `withCustomerDb`/`withOrderTokenDb`/`withSessionDb`». Чинні
викликачі з одним параметром `fn` не змінюються.

`session.ts:29-34`:

```ts
export async function withSessionDb<T>(
  fn: (db: ActorDb, userId: string, operator: OperatorEscalation) => Promise<T>,
): Promise<T> {
  const userId = await requireSessionUserId();
  return withCustomerDb(userId, (db, operator) => fn(db, userId, operator));
}
```

(імпорт типу `OperatorEscalation` з `./db`). Чинні викликачі
(`server/profile.ts`, `server/order-view.ts`, `server/profile-orders.ts`)
беруть один-два параметри й лишаються як є.

- [ ] **Step 3: Розвантажити `order-create.ts` під канон 150 рядків**

🔴 Крок не косметичний, а вимушений і виміряний: `order-create.ts` — рівно
145 рядків (`wc -l`), а Step 5 додає туди ~12 (імпорт, пʼятий параметр,
абзац докблока, виклик списання) — тобто 157 при канонічній межі 150
(`coding-style.instructions.md:43`). Виносяться ЧИСТІ форми даних, яким і
місце в `entities/` поруч із рештою рядкових типів.

Створити `packages/simplycms/src/storefront/loaders/entities/new-order.ts` і
перенести туди без змін `NewOrderItem` (`order-create.ts:8-17`),
`NewOrderInput` (`:19-42`) і `CreatedOrder` (`:44-50`) разом із їхніми
докблоками; імпорт `JsonValue` — з `./property` (той самий відносний рівень).
В `order-create.ts` замість них — `import type { CreatedOrder, NewOrderInput }
from './entities/new-order';` (сам `NewOrderItem` там більше не згадується).
🔴 Разом із типами з `order-create.ts` ЙДЕ і `import type { JsonValue } from
'./entities/property'` (`:4`): його єдиний споживач — `NewOrderItem.discountData`,
тож після переїзду він стає мертвим і валить `no-unused-vars`.

У `loaders/index.ts` — поруч із рештою явних експортів `entities/`:

```ts
export type {
  NewOrderItem,
  NewOrderInput,
  CreatedOrder,
} from './entities/new-order';
```

🔴 Без цього рядка `export * from './order-create'` (`index.ts:12`) перестав
би віддавати ці типи, і `server/checkout.ts:9` (`type NewOrderInput`) та
харнес-тести зламалися б на порожньому місці.

🔴 Наслідок для Task 10 — уже зведений у ред. 1.3, тут лишається орієнтиром:
після цього кроку `NewOrderItem`, `NewOrderInput` і `CreatedOrder` живуть в
`entities/new-order.ts`, тож Task 10 і імпортує їх звідти, і видаляє
`CreatedOrder` саме там. Анотація повернення `createOrder` при цьому
лишається в `order-create.ts` — у новий файл переїжджають лише форми даних,
не функція.

- [ ] **Step 4: `stock-write.ts` і `stock-status.ts` — точка, блокування рядків, статус цілі**

🔴 Модулів чотири, а не один, і межа між ними — не смак, а канон 150 рядків
на файл (`coding-style.instructions.md:43`): разом із правилами списання й
повернення це ~365 рядків. Розкладка — по відповідальності: «де лежить
залишок» (`stock-write.ts`, 112 рядків), «статус цілі» (`stock-status.ts`,
51), «правила однієї позиції» (`stock-reservation.ts`, 113, Step 5) і «рівень
замовлення» (`order-stock.ts`, 87, Step 5). Циклів між ними немає: залежності
йдуть лише згори вниз — `order-stock` → `stock-reservation` → `stock-status` →
`stock-write`, і жоден нижній модуль не знає про верхні.

Створити `packages/simplycms/src/storefront/loaders/stock-write.ts`:

```ts
import { and, asc, desc, eq, isNull, or, type SQL } from 'drizzle-orm';
import { pickupPoints, stockByPickupPoint } from 'simplycms/schema';
import type { ActorDb } from './db';

/**
 * Адресація обліку залишків (К2-Е0, Е0-3): яка точка обслуговує замовлення
 * і як заблокувати рядки цілі в цій транзакції. Переворот статусу —
 * `./stock-status`, правила «скільки списати й повернути» —
 * `./stock-reservation`.
 */

/** Ціль обліку: модифікація має пріоритет над простим товаром. */
export interface StockTarget {
  productId: string | null;
  modificationId: string | null;
}

/** Позиція замовлення в тому вигляді, який потрібен обліку. */
export interface StockLine extends StockTarget {
  quantity: number;
}

/** Рядок залишку, заблокований `FOR UPDATE` у поточній транзакції. */
export interface LockedStockRow {
  id: string;
  pointId: string;
  quantity: number;
}

/**
 * Точка, яка обслуговує це замовлення, — рівно ОДНА і детермінована.
 *
 * Порядок: (1) точка самовивозу самого замовлення; (2) системна точка
 * (`is_system` — склад магазину, звідки їдуть курʼєрські замовлення);
 * (3) перша активна за `(sort_order, id)`.
 *
 * 🔴 `is_system` навмисно НЕ фільтрується по `is_active`: `is_active` керує
 * тим, чи пропонувати точку покупцеві як самовивіз (`loadPickupPoints`), а
 * не тим, чи існує склад. Системна точка обслуговує облік і тоді, коли
 * магазин прибрав її з вибору самовивозу.
 *
 * 🔴 `null` означає «точок немає взагалі» — облік у такому магазині вести
 * нічим, і write-side не вигадує його за магазин.
 */
export async function resolveStockPoint(
  db: ActorDb,
  pickupPointId: string | null,
): Promise<string | null> {
  if (pickupPointId) return pickupPointId;
  const [row] = await db
    .select({ id: pickupPoints.id })
    .from(pickupPoints)
    .where(or(eq(pickupPoints.isSystem, true), eq(pickupPoints.isActive, true)))
    .orderBy(
      desc(pickupPoints.isSystem),
      asc(pickupPoints.sortOrder),
      asc(pickupPoints.id),
    )
    .limit(1);
  return row?.id ?? null;
}

/** Предикат цілі: модифікація або простий товар (`modification_id is null`). */
function targetScope(target: StockTarget): SQL | undefined {
  return target.modificationId
    ? eq(stockByPickupPoint.modificationId, target.modificationId)
    : and(
        eq(stockByPickupPoint.productId, target.productId as string),
        isNull(stockByPickupPoint.modificationId),
      );
}

/**
 * Залишки цілі по точках, які взагалі можуть обслужити замовлення, —
 * заблоковані `FOR UPDATE OF stock_by_pickup_point`.
 *
 * 🔴 Беруться ВСІ такі рядки, хоч списується рівно один: цей самий знімок
 * відповідає на два питання, на які інакше довелося б відповідати окремими
 * (і вже неблокованими) запитами — «чи веде магазин облік цієї цілі взагалі»
 * і «яка сума по точках після операції» (від неї фліп статусу). Предикат
 * точок — той самий, що в `resolveStockPoint`, інакше сума рахувалася б по
 * рядках, які нікого не обслуговують.
 *
 * 🔴 `of: stockByPickupPoint` обовʼязкове: у запиті є join на `pickup_points`,
 * а блокувати треба лише залишки (діалект емітить `for update of
 * "stock_by_pickup_point"`). Порядок `(sort_order, id)` — однаковий у всіх
 * транзакціях, тож рядки однієї цілі захоплюються в тій самій послідовності.
 */
export async function lockTargetStock(
  db: ActorDb,
  target: StockTarget,
): Promise<LockedStockRow[]> {
  return db
    .select({
      id: stockByPickupPoint.id,
      pointId: stockByPickupPoint.pickupPointId,
      quantity: stockByPickupPoint.quantity,
    })
    .from(stockByPickupPoint)
    .innerJoin(
      pickupPoints,
      eq(pickupPoints.id, stockByPickupPoint.pickupPointId),
    )
    .where(
      and(
        targetScope(target),
        or(eq(pickupPoints.isSystem, true), eq(pickupPoints.isActive, true)),
      ),
    )
    .orderBy(asc(pickupPoints.sortOrder), asc(stockByPickupPoint.id))
    .for('update', { of: stockByPickupPoint });
}
```

Далі — `packages/simplycms/src/storefront/loaders/stock-status.ts`:

```ts
import { and, eq, isNull, or } from 'drizzle-orm';
import { productModifications, products } from 'simplycms/schema';
import type { ActorDb } from './db';
import type { StockTarget } from './stock-write';

/**
 * Переводить статус цілі — ГВАРДОВАНО.
 *
 * 🔴 `on_order` не чіпається ніколи: «під замовлення» — рішення магазину, що
 * товар продається й на нулі (`isPurchasable('on_order') === true`, Task 8),
 * і безумовний фліп затер би його. Тому в `out_of_stock` переходять лише
 * `in_stock` і NULL, а назад в `in_stock` — лише `out_of_stock`.
 *
 * 🔴 Матриця сама по собі пари взаємно оберненою НЕ робить: `in_stock` і
 * NULL зводяться в `out_of_stock` в один стан. Умову «повернути рівно те, що
 * було» тримає ВИКЛИКАЧ — `releaseStock` фліпає назад лише з нуля (див. його
 * гвард), інакше скасування старого замовлення підняло б у продаж товар,
 * який магазин зняв вручну.
 *
 * 🔴 `updatedAt` — `Date`, а не ISO-рядок: після «Контракту дат» (Е0-2) усі
 * timestamp схеми — `mode: 'date'`, тож запис рядка сюди — помилка типу.
 */
export async function setTargetStatus(
  db: ActorDb,
  target: StockTarget,
  next: 'in_stock' | 'out_of_stock',
): Promise<void> {
  const updatedAt = new Date();
  if (target.modificationId) {
    const col = productModifications.stockStatus;
    const from =
      next === 'out_of_stock'
        ? or(isNull(col), eq(col, 'in_stock'))
        : eq(col, 'out_of_stock');
    await db
      .update(productModifications)
      .set({ stockStatus: next, updatedAt })
      .where(and(eq(productModifications.id, target.modificationId), from));
    return;
  }
  if (!target.productId) return;
  const col = products.stockStatus;
  const from =
    next === 'out_of_stock'
      ? or(isNull(col), eq(col, 'in_stock'))
      : eq(col, 'out_of_stock');
  await db
    .update(products)
    .set({ stockStatus: next, updatedAt })
    .where(and(eq(products.id, target.productId), from));
}
```

🔴 `stock-write.ts` і `stock-status.ts` у `loaders/index.ts` **не**
реекспортуються: назовні потрібні лише правила (`./stock-reservation`) і
рівень замовлення (`./order-stock`), а `lockTargetStock` та `setTargetStatus`
— внутрішні примітиви, які в публічному API лише запрошували б обійти
правила (та сама логіка, що й у коментарі `index.ts:31-37` про мапи колонок).

- [ ] **Step 5: `stock-reservation.ts` і `order-stock.ts` — списання й повернення; `createOrder` кличе списання**

Створити `packages/simplycms/src/storefront/loaders/stock-reservation.ts` —
правила ОДНІЄЇ позиції:

```ts
import { eq } from 'drizzle-orm';
import { stockByPickupPoint } from 'simplycms/schema';
import type { ActorDb } from './db';
import { setTargetStatus } from './stock-status';
import { lockTargetStock, type StockLine } from './stock-write';

/** Нестача залишку: транзакція відкочується, замовлення не створюється. */
export class InsufficientStockError extends Error {
  constructor(
    readonly productId: string | null,
    readonly modificationId: string | null,
  ) {
    super('[simplycms/orders] insufficient stock');
    this.name = 'InsufficientStockError';
  }
}

/**
 * Списує позицію з ОДНІЄЇ точки — тієї, що обслуговує замовлення.
 *
 * 🔴 Викликається ПІД `app_admin` (operator) у транзакції замовлення.
 * Рядки залишків беруться `FOR UPDATE`: доки транзакція не завершилась, вони
 * наші, тож і достатність, і переворот статусу рахуються від РЕАЛЬНОГО
 * залишку, а не від знімка до чужого коміту (два паралельні замовлення по
 * одиниці на залишок 2 інакше лишили б нуль при `in_stock`).
 *
 * Дві різні відсутності — два різні наслідки, і плутати їх не можна:
 * жодного рядка по жодній ОБСЛУГОВУЮЧІЙ точці (`is_active` або `is_system` —
 * предикат `lockTargetStock`) — магазин обліку цієї цілі НЕ веде, вихід без
 * змін; рядки на обслуговуючих точках є, але не на нашій (або їх там менше)
 * — облік ведеться, а точка не покриває, тобто `InsufficientStockError`, а
 * не тихий продаж із повітря. Залишок, що лежить лише на закритій точці,
 * навмисно потрапляє в ПЕРШУ гілку: read-side його теж не бачить
 * (`stock-info.ts:76`).
 *
 * Коли сума по точках стає 0 — статус переводиться в `out_of_stock`: саме
 * так read-side правило `isPurchasable` (статус, не кількість) лишається
 * правдивим для магазину, що веде облік. Фліп саме за СУМОЮ, а не за нашою
 * точкою: товар із залишком на сусідній точці інакше зникав би з продажу
 * разом із першою спорожнілою.
 */
export async function reserveStock(
  db: ActorDb,
  line: StockLine,
  pointId: string,
): Promise<void> {
  // Позиція без цілі обліку (ні товару, ні модифікації) — нічого списувати.
  if (!line.modificationId && !line.productId) return;
  const rows = await lockTargetStock(db, line);
  if (rows.length === 0) return;

  const row = rows.find((candidate) => candidate.pointId === pointId);
  if (!row || row.quantity < line.quantity) {
    throw new InsufficientStockError(line.productId, line.modificationId);
  }

  await db
    .update(stockByPickupPoint)
    .set({
      quantity: row.quantity - line.quantity,
      updatedAt: new Date(),
    })
    .where(eq(stockByPickupPoint.id, row.id));

  const left =
    rows.reduce((sum, item) => sum + item.quantity, 0) - line.quantity;
  if (left === 0) await setTargetStatus(db, line, 'out_of_stock');
}

/**
 * Повертає позицію В ТУ САМУ точку — дзеркало `reserveStock`.
 *
 * 🔴 Не кидає, якщо рядка на точці більше немає: точку могли закрити або
 * прибрати рядок обліку між замовленням і скасуванням, а скасування — право
 * покупця, і воно не сміє впасти через стан складу. Повертати в такому разі
 * нікуди, і вигадувати рядок замість магазину write-side не буде. Випадок
 * «точку ВИДАЛИЛИ після оформлення» сюди не доходить: `releaseOrderStock`
 * резолвить уже іншу точку, і кількість ляже на неї — названа межа правила
 * Р2 вище.
 *
 * 🔴 Дзеркало не абсолютне, і це свідомо: кількість повертається завжди, а
 * статус — лише з нуля (гвард нижче).
 */
export async function releaseStock(
  db: ActorDb,
  line: StockLine,
  pointId: string,
): Promise<void> {
  if (!line.modificationId && !line.productId) return;
  const rows = await lockTargetStock(db, line);
  if (rows.length === 0) return;
  const row = rows.find((candidate) => candidate.pointId === pointId);
  if (!row) return;

  // Сума ДО повернення — із того самого заблокованого знімка.
  const before = rows.reduce((sum, item) => sum + item.quantity, 0);

  await db
    .update(stockByPickupPoint)
    .set({
      quantity: row.quantity + line.quantity,
      updatedAt: new Date(),
    })
    .where(eq(stockByPickupPoint.id, row.id));

  // 🔴 Фліп назад — ЛИШЕ коли до повернення сума по точках була нулем: інакше
  // `out_of_stock` поставив не цей облік, а магазин (зняв товар з продажу при
  // ненульовому залишку), і скасування старого замовлення тихо скасувало б це
  // рішення. Дзеркальний вигляд `if (before + line.quantity > 0)` умовою не є
  // взагалі: `quantity` позиції завжди ≥ 1 (`order_items_positive_quantity`,
  // `schema.ts:247`), тобто такий гвард істинний завжди.
  if (before === 0) await setTargetStatus(db, line, 'in_stock');
}
```

Далі — `packages/simplycms/src/storefront/loaders/order-stock.ts`: тумблер
обліку, однаковий порядок блокувань і дві «замовленнєві» обгортки. У
`loaders/index.ts` — `export * from './stock-reservation';` і
`export * from './order-stock';`:

```ts
import { eq } from 'drizzle-orm';
import { orderItems, orders, systemSettings } from 'simplycms/schema';
import type { ActorDb } from './db';
import { releaseStock, reserveStock } from './stock-reservation';
import {
  resolveStockPoint,
  type StockLine,
  type StockTarget,
} from './stock-write';

/** Налаштування обліку: чи списувати залишок при оформленні. */
export async function loadStockManagement(
  db: ActorDb,
): Promise<{ decrease_on_order: boolean }> {
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, 'stock_management'))
    .limit(1);
  const value = (row?.value ?? {}) as { decrease_on_order?: unknown };
  return { decrease_on_order: value.decrease_on_order === true };
}

/**
 * Однаковий порядок блокувань у всіх транзакціях: два кошики з тими самими
 * товарами в різному порядку інакше могли б зійтися в дедлок (40P01).
 * Той самий порядок — і на поверненні.
 */
function sortForLock<T extends StockTarget>(lines: T[]): T[] {
  return [...lines].sort((a, b) =>
    `${a.productId}/${a.modificationId}`.localeCompare(
      `${b.productId}/${b.modificationId}`,
    ),
  );
}

/** Списати залишок усього замовлення — під ескалацією, у його транзакції. */
export async function reserveOrderStock(
  db: ActorDb,
  lines: StockLine[],
  pickupPointId: string | null,
): Promise<void> {
  const { decrease_on_order } = await loadStockManagement(db);
  if (!decrease_on_order) return;
  const pointId = await resolveStockPoint(db, pickupPointId);
  if (!pointId) return;
  for (const line of sortForLock(lines)) await reserveStock(db, line, pointId);
}

/**
 * Повернути залишок усього замовлення — під ескалацією, у транзакції
 * скасування.
 *
 * 🔴 Позиції й точка читаються З БАЗИ за `orderId`, а не приймаються
 * параметром: на скасуванні кошика в руках немає, а `orders.pickup_point_id`
 * — це і є та сама точка, у яку списували. Тому повернення точне без
 * окремої таблиці резервів. Той самий тумблер `decrease_on_order`, що й на
 * списанні: магазин без обліку скасуванням нічого не чіпає.
 */
export async function releaseOrderStock(
  db: ActorDb,
  orderId: string,
): Promise<void> {
  const { decrease_on_order } = await loadStockManagement(db);
  if (!decrease_on_order) return;

  const [order] = await db
    .select({ pickupPointId: orders.pickupPointId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return;

  const pointId = await resolveStockPoint(db, order.pickupPointId);
  if (!pointId) return;

  const lines = await db
    .select({
      productId: orderItems.productId,
      modificationId: orderItems.modificationId,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const line of sortForLock(lines)) await releaseStock(db, line, pointId);
}
```

У `order-create.ts`: імпорт `import { reserveOrderStock } from
'./order-stock';`, тип `OperatorEscalation` — у наявний
`import type { ActorDb } from './db';`; сигнатуру `createOrder` розширити
пʼятим параметром `operator: OperatorEscalation`, а після вставки
`orderItems` (перед `return`):

```ts
  // 🔴 Списання — ПІСЛЯ того, як RLS прийняла вставку замовлення й позицій
  // покупцем: право на цю транзакцію вже доведено, а службова дія йде під
  // операторською роллю в ТІЙ САМІЙ транзакції (див. `escalationFor`).
  // `NewOrderItem` структурно є `StockLine`, тож перекладати нічого.
  await operator((odb) =>
    reserveOrderStock(odb, input.items, input.pickupPointId),
  );
```

🔴 `InsufficientStockError`, кинутий усередині `operator`, виходить назовні
через `finally`: `restoreRoleQuietly` віддає роль актора (на цьому кидку
транзакція ще жива), а далі `withActor` відкочує її цілком, тож рядка в
`orders` не лишиться (кейс «нестача — відмова» це й пінить).

Викликачі `createOrder` без `operator` — передати його з обгортки:
`storefront-personal-data.test.ts:185,206,228` →
`withCustomerDb(userA, (db, operator) => createOrder(db, userA, null, orderInput('alice'), operator))`
(і так само для гостя з `withOrderTokenDb`); у `checkout.ts` `run` приймає
`fn(db, operator)` і передає `operator` у `createOrder` — лише щоб `typecheck`
був зелений (`run` цілком переписується в Task 10). У його імпорті з
`simplycms/storefront/loaders` (`:3-11`) до `type ActorDb` додається
`type OperatorEscalation`:

```ts
    const run = <T>(
      fn: (db: ActorDb, operator: OperatorEscalation) => Promise<T>,
    ): Promise<T> =>
      userId === null
        ? withOrderTokenDb(accessToken as string, fn)
        : withCustomerDb(userId, fn);

    return run(async (db, operator) => {
      const savedRecipientId = await resolveRecipient(db, userId, input);
      return createOrder(
        db,
        userId,
        accessToken,
        toOrderInput(input, savedRecipientId),
        operator,
      );
    });
```

Run: `pnpm typecheck && pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/order-stock.test.ts`
Expected: PASS (13 кейсів).

- [ ] **Step 6: Негативний контроль ролі — списання без ескалації падає**

Тимчасово в `createOrder` замінити `await operator((odb) => reserveOrderStock(…))`
на `await reserveOrderStock(db, input.items, input.pickupPointId);`
і прогнати той самий тест.

Expected: кейс «списує із сідового залишку» FAIL із `permission denied for
table stock_by_pickup_point` вже на `SELECT … FOR UPDATE` (блокування вимагає
права UPDATE, а `app_user` має на цю таблицю лише SELECT —
`0002_grants.sql:87`) — доказ, що покупець у облік не пише і ескалація не
декоративна. Повернути правку ВРУЧНУ (`order-create.ts` — трекований файл з
іншими змінами задачі, `git checkout` відкотив би все), тест знову PASS.

- [ ] **Step 7: `cancelMyOrder` — одна транзакція: право, повернення залишку, статус**

Спершу — блокування рядка замовлення. У `loaders/orders.ts` (після
`setOrderStatus`, файл лишається в межах канону: 113 → ~139 рядків):

```ts
/**
 * Блокує рядок замовлення й віддає його поточний статус.
 *
 * 🔴 Виконується під `app_admin` (ескалація): `select … for update` вимагає
 * права UPDATE, якого `app_user` на `orders` не має за побудовою
 * (`0002_grants.sql:104`).
 *
 * 🔴 Потрібне саме блокування, а не «ще одна перевірка статусу»: подвійний
 * клік по «Скасувати» дає ДВІ паралельні транзакції, і під READ COMMITTED
 * обидві прочитали б `new` — залишок повернувся б ДВІЧІ. Заблокований рядок
 * пропускає рівно одну; друга бачить уже змінений `status_id` і виходить.
 */
export async function lockOrderStatus(
  db: ActorDb,
  orderId: string,
): Promise<{ statusId: string | null } | null> {
  const [row] = await db
    .select({ statusId: orders.statusId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)
    .for('update');

  return row ?? null;
}
```

Далі — `storefront-routes/server/profile-orders.ts:50-80`:

```ts
/**
 * Скасувати власне замовлення — ОДНІЄЮ транзакцією.
 *
 * 🔴 Право доводиться читанням під актором покупця (RLS віддасть рядок лише
 * власнику), запис — ескалацією в ТІЙ САМІЙ транзакції. Три транзакції ред.
 * до К2-Е0 лишали вікно між «перевірив» і «записав», а тепер вікна немає за
 * побудовою: між перевіркою і записом транзакція не завершується.
 *
 * 🔴 Порядок усередині ескалації обовʼязковий: блокування рядка замовлення →
 * повернення залишку → статус. Повернення ПІСЛЯ статусу лишало б стан, у
 * якому замовлення вже скасоване, а склад ще ні.
 */
export const cancelMyOrder = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ orderId: z.string().uuid() }))
  .handler(async ({ data: input }): Promise<OrderCancelResult> => {
    const { orderId } = input as { orderId: string };
    return withSessionDb(async (db, _userId, operator) => {
      const own = await loadOrderDetail(db, orderId);
      if (!own) return { ok: false, reason: 'not_found' };
      if (own.status?.code !== CANCELLABLE_FROM) {
        return { ok: false, reason: 'not_cancellable' };
      }
      const cancelled = await loadStatusByCode(db, CANCELLED);
      if (!cancelled) return { ok: false, reason: 'status_missing' };

      const done = await operator(async (odb) => {
        const locked = await lockOrderStatus(odb, orderId);
        // Хтось випередив (подвійний клік, адмінка) — повернення НЕ повторюємо.
        if (!locked || locked.statusId !== own.status_id) return false;
        await releaseOrderStock(odb, orderId);
        await setOrderStatus(odb, orderId, cancelled.id);
        return true;
      });

      return done ? { ok: true } : { ok: false, reason: 'not_cancellable' };
    });
  });
```

З імпортів прибрати `withStoreOperatorDb`, додати `lockOrderStatus` і
`releaseOrderStock` (`withStorefrontDb` лишається для `getOrderStatuses`).
🔴 `loadStatusByCode` тепер читається під актором покупця, а не окремою
транзакцією вітрини: `order_statuses` — публічний довідник із грантом SELECT
для `app_user` (`0002_grants.sql:71`), тож зайва транзакція була лише
історією.

У `storefront-personal-data.test.ts` позитивна гілка скасування (`:251-253`,
`await withStoreOperatorDb((db) => setOrderStatus(...))`) →
`withCustomerDb(userA, (db, operator) => operator((odb) => setOrderStatus(odb, created.id, cancelled!.id)))`,
а імпорт `withStoreOperatorDb` (`:24`) — прибрати (інших входжень у файлі
немає); негативний контроль (прямий `setOrderStatus` під `app_user` →
`permission denied` у `cause`, `:226-249`) лишається як є.

Run: `pnpm typecheck && pnpm test:schema`
Expected: PASS.

- [ ] **Step 8: Канон `data-access` — правило ескалації**

У `.github/instructions/data-access.instructions.md`, розділ «Storefront (SSR)»,
після пункту про `withStorefrontDb` додати:

```markdown
- 🔴 **Ескалація ролі покупцем.** Службова дія, яку **ініціює покупець** у
  власній транзакції (списання залишку при оформленні, повернення залишку й
  скасування свого замовлення), виконується через `operator(fn)` — другий
  аргумент `fn` у `withCustomerDb`/`withOrderTokenDb` (третій у
  `withSessionDb`): `SET LOCAL ROLE app_admin` рівно на час `fn`, ПІСЛЯ того,
  як RLS уже прийняла читання чи запис покупця в цій транзакції, і лише над
  обліком магазину. Дія, яку **ініціює сервер або адмінка** (реєстр плагінів,
  конфіг плагіна, модерація), — `withStoreOperatorDb`. Дві транзакції «спершу
  перевірити, потім писати з іншої ролі» — заборонена форма: між ними вікно.
  Дію, яку можна натиснути двічі, всередині ескалації додатково прикриває
  блокування рядка (`lockOrderStatus`), бо READ COMMITTED сам по собі двох
  однакових скасувань не розрізняє. Гейти —
  `test-harness/pg/__tests__/order-stock.test.ts` (його позитивні кейси
  проходять ЛИШЕ під ескалацією: без `operator` списання падає вже на
  `SELECT … FOR UPDATE` з `permission denied`, бо `app_user` має на
  `stock_by_pickup_point` тільки SELECT — `0002_grants.sql:87`);
  `storefront-personal-data.test.ts` — комітований негативний контроль
  сусідньої межі: `setOrderStatus` під `app_user` → `permission denied` у
  `cause`.
```

- [ ] **Step 9: Гейти й коміт**

```bash
wc -l packages/simplycms/src/storefront/loaders/{order-create,orders,stock-write,stock-status,stock-reservation,order-stock}.ts packages/simplycms/src/storefront/loaders/entities/new-order.ts
pnpm format:check && pnpm lint && pnpm test && pnpm test:schema
git add packages/simplycms/src/storefront/loaders/db.ts packages/simplycms/src/storefront/loaders/session.ts packages/simplycms/src/storefront/loaders/entities/new-order.ts packages/simplycms/src/storefront/loaders/stock-write.ts packages/simplycms/src/storefront/loaders/stock-status.ts packages/simplycms/src/storefront/loaders/stock-reservation.ts packages/simplycms/src/storefront/loaders/order-stock.ts packages/simplycms/src/storefront/loaders/order-create.ts packages/simplycms/src/storefront/loaders/orders.ts packages/simplycms/src/storefront/loaders/index.ts packages/simplycms/src/storefront-routes/server/checkout.ts packages/simplycms/src/storefront-routes/server/profile-orders.ts packages/simplycms/test-harness/pg/__tests__/order-stock.test.ts packages/simplycms/test-harness/pg/__tests__/storefront-personal-data.test.ts .github/instructions/data-access.instructions.md
git commit -m "feat(k2-e0): замовлення списує залишок в одній точці під FOR UPDATE; скасування повертає його тією ж транзакцією

Точка обліку — детермінована: точка самовивозу замовлення, інакше системна,
інакше перша активна; списання й повернення йдуть у ту саму точку, тож
резервів окремою таблицею не треба. Ескалація до app_admin — scoped, усередині
транзакції покупця, після RLS-прийнятого запису; app_user на облік не пише
(негативний контроль — permission denied без ескалації). Залишки читаються під
FOR UPDATE, тож арифметика й переворот статусу — від реального залишку (два
конкурентні по 1 на залишок 2 → out_of_stock); нестача — InsufficientStockError
і відкат без рядка в orders. cancelMyOrder з трьох транзакцій став однією і
повертає залишок під блокуванням рядка замовлення (подвійний клік не повертає
двічі). Схему й гранти етап не чіпає: app_admin уже має повний доступ до
stock_by_pickup_point. Правило — у data-access (Е0-3)."
```

- [ ] **DoD Task 9:** `pnpm test:schema` зелений, у ньому `order-stock.test.ts`
  — 13 кейсів; `wc -l` кожного зачепленого модуля ≤ 150 (очікувані: `stock-write`
  112, `stock-status` 51, `stock-reservation` 113, `order-stock` 87,
  `entities/new-order` ~48, `order-create` ~115, `orders` ~139 — розбіжність у
  кілька рядків після `prettier` нормальна, вихід за 150 — ні); негативний
  контроль Step 6 показав `permission denied` і повернутий; `grep -rn
  "withStoreOperatorDb" packages/simplycms/src/storefront-routes` порожній.

---

### Task 10: Чекаут — сервер рахує і відмовляє доменно; контракт у T0 (Е0-4, сервер)

**Files:**
- Modify: `packages/simplycms/src/contracts/objects/order.ts` (після `CreateOrderInput`, `:41-49`)
- Modify: `packages/simplycms/src/storefront-routes/server/checkout-input.ts`
- Modify: `packages/simplycms/src/storefront-routes/server/checkout.ts`
- Create: `packages/simplycms/src/storefront/loaders/checkout-items.ts`
- Create: `packages/simplycms/src/storefront/loaders/place-order.ts`
- Modify: `packages/simplycms/src/storefront/loaders/entities/new-order.ts` (інтерфейс `CreatedOrder` видаляється — його місце займає `PlacedOrder` з T0; сам файл створює Task 9 Step 3)
- Modify: `packages/simplycms/src/storefront/loaders/order-create.ts` (тип повернення `createOrder` → `PlacedOrder`; `CreatedOrder` зникає з `import type … from './entities/new-order'`, натомість `import type { PlacedOrder } from 'simplycms/contracts'`)
- Modify: `packages/simplycms/src/storefront/loaders/index.ts` (реекспорт двох нових модулів + зняти `CreatedOrder` з блоку `export type … from './entities/new-order'`, доданого Task 9 Step 3)
- Modify: `packages/simplycms/src/storefront-routes/pages/Checkout.tsx:170-262`
- Modify: `packages/simplycms/src/i18n/catalogs/{uk,en}/checkout.ts`
- Create: `packages/simplycms/test-harness/pg/__tests__/fixtures/discounts.ts`
- Modify: `packages/simplycms/test-harness/pg/__tests__/fixtures/showcase.ts:72-99` (блок «Знижки» — на білдер)
- Create: `packages/simplycms/test-harness/pg/__tests__/checkout-flow.test.ts`

**Interfaces:**
- Produces (T0, `simplycms/contracts`):
  - `interface CheckoutItemInput { productId: string; modificationId: string | null; quantity: number }`;
  - `interface PlaceOrderInput` — усі поля форми оформлення, `items: CheckoutItemInput[]`, без цін і `shippingCost`;
  - `type PlaceOrderRejection = 'shipping_unavailable' | 'pickup_point_invalid' | 'not_purchasable'`;
  - `interface PlacedOrder { id; orderNumber; accessToken: string | null }` (єдиний — замість `CreatedOrder` у лоадерах і локального `PlacedOrder` у `checkout-input.ts`);
  - `type PlaceOrderResult = { ok: true; order: PlacedOrder } | { ok: false; reason: PlaceOrderRejection }`.
- Produces (T2, `simplycms/storefront/loaders`):
  - `placeOrderFor(input: PlaceOrderInput, userId: string | null): Promise<PlaceOrderResult>` — уся логіка оформлення в server-only дереві;
  - `priceCheckoutItems(db, userId, items): Promise<NewOrderItem[] | Extract<PlaceOrderRejection, 'not_purchasable'>>` — серверне ціноутворення в тому самому середовищі знижок, що `getDiscountEnvironment`;
  - `createOrder(...)` повертає `PlacedOrder`.
- Produces (T5): `checkoutInputSchema … satisfies z.ZodType<PlaceOrderInput>`; тонкий serverFn `placeOrder`.
- Produces (харнес): `percentDiscountStatements(spec): string[]` у `fixtures/discounts.ts`.
- Consumes: `isPurchasable` (Task 8); `createOrder(…, operator)`, `InsufficientStockError`, `OperatorEscalation` (Task 9); `loadPricesByProduct` (Task 7); `resolvePrice`, `resolveDiscount`, `resolveShippingRate`, `findShippingZoneIn`; `loadShippingDirectory`, `loadDiscountGroups`, `loadUserCategoryId`, `loadDefaultUserCategoryId`, `loadUserPriceTypeId`, `loadDefaultPriceTypeId`; демо-сід Task 7 і `HIDDEN_SHIPPING_FIXTURES` (вимкнений метод; повний `SHIPPING_FIXTURES` поверх сіду поклав би другий активний тариф на пару `pickup` + дефолтна зона).

🔴 Чому типи в T0, а не дзеркало в T2 (ред. 1.2). Zod — рантайм-залежність,
недопустима в T0 і T1, тож схема лишається в T5 (`checkout-input.ts`: її
читає і `inputValidator`, і сторінка). Але ТИП запиту потрібен трьом шарам:
серверу (`placeOrderFor`), схемі (перевірка форми) і клієнту (мапа
`reason → i18n`). Ручна копія типу в server-only дереві з `data as
PlaceOrderInput` у хендлері ховала б дрейф двох копій, а клієнт не мав би
легального місця для `PlaceOrderRejection`. Тому канонічний тип — у
`contracts/objects/order.ts` (прецедент — `CreateOrderInput` там же), а схема
оголошує `satisfies z.ZodType<PlaceOrderInput>`: компілятор не пропустить ані
відсутнє поле, ані інший тип, і каст зникає.

- [ ] **Step 1: Білдер знижок — спільний для showcase і воронки**

`packages/simplycms/test-harness/pg/__tests__/fixtures/discounts.ts`:

```ts
// Один ланцюг знижки для харнесу (К2-Е0): group → discount → умова за
// категорією → ціль. До цього файлу showcase тримав його інлайном, а тест
// воронки скопіював би вдруге.

export interface PercentDiscountSpec {
  /** Група знижок; створюється, якщо ще немає (кілька знижок в одній групі). */
  group: string;
  name: string;
  percent: number;
  isActive?: boolean;
  /** Код типу ціни, до якого прив'язана знижка. */
  priceTypeCode?: string;
  /** Код категорії покупця для умови `user_category in […]`; без нього — для всіх. */
  categoryCode?: string;
  target: { type: 'all' } | { type: 'product'; slug: string };
}

export function percentDiscountStatements(s: PercentDiscountSpec): string[] {
  const priceType = s.priceTypeCode ?? 'retail';
  const out = [
    `insert into public.discount_groups (id, name, operator, is_active)
     select gen_random_uuid(), '${s.group}', 'and', true
      where not exists (select 1 from public.discount_groups where name = '${s.group}')`,
    `insert into public.discounts
       (id, name, group_id, discount_type, discount_value, is_active, price_type_id)
     select gen_random_uuid(), '${s.name}', g.id, 'percent', ${s.percent}, ${s.isActive ?? true}, pt.id
       from public.discount_groups g
       cross join public.price_types pt
      where g.name = '${s.group}' and pt.code = '${priceType}'`,
  ];
  if (s.categoryCode) {
    out.push(
      `insert into public.discount_conditions (id, discount_id, condition_type, operator, value)
       select gen_random_uuid(), d.id, 'user_category', 'in',
              to_jsonb(array[(select id::text from public.user_categories where code = '${s.categoryCode}')])
         from public.discounts d where d.name = '${s.name}'`,
    );
  }
  out.push(
    s.target.type === 'all'
      ? `insert into public.discount_targets (id, discount_id, target_type, target_id)
         select gen_random_uuid(), d.id, 'all', null from public.discounts d
          where d.name = '${s.name}'`
      : `insert into public.discount_targets (id, discount_id, target_type, target_id)
         select gen_random_uuid(), d.id, 'product', p.id
           from public.discounts d cross join public.products p
          where d.name = '${s.name}' and p.slug = '${s.target.slug}'`,
  );
  return out;
}
```

У `fixtures/showcase.ts:72-99` пʼять стейтментів блоку «Знижки» замінити на:

```ts
  // ── Знижки — через спільний білдер (fixtures/discounts.ts) ──────────────
  ...percentDiscountStatements({
    group: 'Акції магазину', name: TARGETED_DISCOUNT, percent: DISCOUNT_PERCENT,
    categoryCode: WHOLESALE_CODE, target: { type: 'all' },
  }),
  ...percentDiscountStatements({
    group: 'Акції магазину', name: DISABLED_DISCOUNT, percent: 90, isActive: false,
    target: { type: 'all' },
  }),
```

(вимкнена знижка отримує ціль `all`, якої раніше не мала — на асерти
showcase це не впливає: вона неактивна). Форма звірена зі схемою:
`discount_target_type` — `product | modification | section | all`
(`schema.ts:52`), умова — `condition_type 'user_category'`, `operator 'in'`,
`value` — jsonb-масив id (як у showcase до цього).

Run: `pnpm test:schema` (showcase має лишитись зеленим на білдері).
Expected: PASS.

- [ ] **Step 2: Харнес-тест воронки — спершу червоний**

`packages/simplycms/test-harness/pg/__tests__/checkout-flow.test.ts` —
логіка `placeOrder` без RPC (serverFn поза HTTP не виконується), поверх
покупного демо-сіду:

```ts
// Воронка: кошик → placeOrderFor → рядок в orders; серверна ціна й знижка;
// доменні відмови (К2-Е0, Е0-4). Ціни й доставку рахує СЕРВЕР — у вхідних
// даних їх немає. База — покупний демо-сід (Task 7): метод `pickup`, точка
// «Склад у Києві», дефолтна зона, безкоштовний тариф; вимкнений метод — із
// HIDDEN_SHIPPING_FIXTURES (лише негативна частина: активну доставку дає сід,
// повний набір додав би другий активний тариф на ту саму пару метод+зона);
// решта негативних рядків — тест-локальні.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import type { PlaceOrderInput } from 'simplycms/contracts';
import { placeOrderFor } from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles, createTempDatabase, dropTempDatabase, queryRows,
  randomDbName, withDbName, withUser,
} from '../apply.mjs';
import { HIDDEN_METHOD_CODE, HIDDEN_SHIPPING_FIXTURES } from './fixtures/shipping';
import { percentDiscountStatements } from './fixtures/discounts';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../migrations');
const PANEL_SLUG = 'sonyachna-panel-450w-mono';
const OUT_OF_STOCK_SLUG = 'sonyachna-panel-550w-mono';
interface IdRow { id: string }

const input = (overrides: Partial<PlaceOrderInput>): PlaceOrderInput => ({
  firstName: 'Тест', lastName: 'Покупець', email: 'buyer@example.test', phone: '+380000000000',
  shippingMethodId: '', deliveryCity: null, deliveryAddress: null, pickupPointId: null,
  paymentMethod: 'cash', notes: null, hasDifferentRecipient: false,
  recipientFirstName: null, recipientLastName: null, recipientPhone: null, recipientEmail: null,
  recipientCity: null, recipientAddress: null, recipientNotes: null, saveRecipient: false,
  savedRecipientId: null, savedAddressId: null, items: [],
  ...overrides,
});

describe('placeOrderFor: воронка й доменні відмови', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_checkout');
  let dbUrl = '';
  let pickup = '';
  let hidden = '';
  let courier = '';
  let norate = '';
  let point = '';
  let panel = '';
  let outOfStock = '';

  const one = async (sql: string, params: unknown[] = []): Promise<string> =>
    ((await queryRows(dbUrl, sql, params)) as IdRow[])[0].id;
  const ordersCount = async (): Promise<number> =>
    ((await queryRows(dbUrl, `select count(*)::int as c from public.orders`)) as { c: number }[])[0].c;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, [
      ...readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith('.sql')).sort().map((n) => join(MIGRATIONS_DIR, n)),
      join(MIGRATIONS_DIR, 'demo/demo-seed.sql'),
    ]);
    // Негативна частина фікстури поверх сіду: вимкнений метод, зона, тариф, закрита точка.
    for (const statement of HIDDEN_SHIPPING_FIXTURES) await queryRows(dbUrl, statement);
    // Тест-локальні негативні методи: курʼєр із тарифом на дефолтній зоні
    // (точка чужого методу) і активний метод без жодного тарифу.
    await queryRows(dbUrl, `insert into public.shipping_methods (id, code, name, is_active)
      values (gen_random_uuid(), 'courier', 'Курʼєр', true), (gen_random_uuid(), 'norate', 'Без тарифу', true)`);
    await queryRows(dbUrl, `insert into public.shipping_rates (id, method_id, zone_id, name, calculation_type, base_cost, is_active, sort_order)
      select gen_random_uuid(), m.id, z.id, 'Тариф курʼєра', 'flat', 100, true, 0
        from public.shipping_methods m, public.shipping_zones z
       where m.code = 'courier' and z.is_default = true`);
    pickup = await one(`select id from public.shipping_methods where code = 'pickup'`);
    hidden = await one(`select id from public.shipping_methods where code = $1`, [HIDDEN_METHOD_CODE]);
    courier = await one(`select id from public.shipping_methods where code = 'courier'`);
    norate = await one(`select id from public.shipping_methods where code = 'norate'`);
    point = await one(`select id from public.pickup_points where name = 'Склад у Києві'`);
    panel = await one(`select id from public.products where slug = $1`, [PANEL_SLUG]);
    outOfStock = await one(`select id from public.products where slug = $1`, [OUT_OF_STOCK_SLUG]);
    await queryRows(dbUrl, `update public.products set stock_status = 'out_of_stock' where id = $1`, [outOfStock]);
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    await dropTempDatabase(harness.url, dbName);
    await harness.teardown();
  });

  it('гість: замовлення з серверною ціною позиції та доставкою', async () => {
    const result = await placeOrderFor(
      input({ shippingMethodId: pickup, pickupPointId: point,
        items: [{ productId: panel, modificationId: null, quantity: 2 }] }),
      null,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = (await queryRows(dbUrl,
      `select o.subtotal, o.shipping_cost, o.total, i.price, i.name
         from public.orders o join public.order_items i on i.order_id = o.id where o.id = $1`,
      [result.order.id])) as { subtotal: string; shipping_cost: string; total: string; price: string; name: string }[];
    // 4800 — ціна з product_prices демо-сіду, не з запиту (запит ціни не несе).
    expect(row.price).toBe('4800.00');
    expect(row.subtotal).toBe('9600.00');
    expect(row.shipping_cost).toBe('0.00');
    expect(row.total).toBe('9600.00');
    expect(row.name).toBe('Сонячна панель 450 Вт монокристалічна');
  });

  it('неактивний спосіб доставки — shipping_unavailable, рядка немає', async () => {
    const before = await ordersCount();
    const result = await placeOrderFor(
      input({ shippingMethodId: hidden, items: [{ productId: panel, modificationId: null, quantity: 1 }] }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'shipping_unavailable' });
    expect(await ordersCount()).toBe(before);
  });

  it('точка видачі чужого методу — pickup_point_invalid', async () => {
    const result = await placeOrderFor(
      input({ shippingMethodId: courier, pickupPointId: point, items: [{ productId: panel, modificationId: null, quantity: 1 }] }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'pickup_point_invalid' });
  });

  it('pickup-метод без точки видачі — pickup_point_invalid', async () => {
    const result = await placeOrderFor(
      input({ shippingMethodId: pickup, pickupPointId: null, items: [{ productId: panel, modificationId: null, quantity: 1 }] }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'pickup_point_invalid' });
  });

  it('активний метод без застосовного тарифу — shipping_unavailable, а не безкоштовно', async () => {
    const result = await placeOrderFor(
      input({ shippingMethodId: norate, items: [{ productId: panel, modificationId: null, quantity: 1 }] }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'shipping_unavailable' });
  });

  it('гість отримує знижку категорії за замовчуванням — як у getDiscountEnvironment', async () => {
    // Без дзеркала getDiscountEnvironment гість платив би 4800, а картка показує 4320.
    for (const statement of percentDiscountStatements({
      group: 'Роздрібна акція', name: 'Знижка на панель 450', percent: 10,
      categoryCode: 'retail', target: { type: 'product', slug: PANEL_SLUG },
    })) await queryRows(dbUrl, statement);
    const result = await placeOrderFor(
      input({ shippingMethodId: pickup, pickupPointId: point,
        items: [{ productId: panel, modificationId: null, quantity: 1 }] }),
      null,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = (await queryRows(dbUrl, `select price, base_price from public.order_items where order_id = $1`, [result.order.id])) as { price: string; base_price: string | null }[];
    expect(row.price).toBe('4320.00');
    expect(row.base_price).toBe('4800.00');
  });

  it('позиція out_of_stock — not_purchasable', async () => {
    const result = await placeOrderFor(
      input({ shippingMethodId: pickup, pickupPointId: point,
        items: [{ productId: outOfStock, modificationId: null, quantity: 1 }] }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'not_purchasable' });
  });

  it('нестача залишку в транзакції — not_purchasable без рядка в orders', async () => {
    // Сідовий залишок 450w — 5; два попередні замовлення списали 3. Запит на 10
    // проходить читання (статус in_stock), але падає у списанні → відкат.
    const before = await ordersCount();
    const result = await placeOrderFor(
      input({ shippingMethodId: pickup, pickupPointId: point,
        items: [{ productId: panel, modificationId: null, quantity: 10 }] }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'not_purchasable' });
    expect(await ordersCount()).toBe(before);
  });
});
```

Run: `pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/checkout-flow.test.ts`
Expected: FAIL (`placeOrderFor` не існує; `PlaceOrderInput` не експортується).

- [ ] **Step 3: Контракт у T0 і схема `satisfies`**

У `packages/simplycms/src/contracts/objects/order.ts` після `CreateOrderInput`:

```ts
/** Позиція запиту оформлення — ЛИШЕ ідентичність і кількість (К2-Е0, Е0-4). */
export interface CheckoutItemInput {
  productId: string;
  modificationId: string | null;
  quantity: number;
}

/**
 * Запит оформлення замовлення — канонічний ТИП (T0). Zod-схема живе в T5
 * (`storefront-routes/server/checkout-input.ts`) і оголошує
 * `satisfies z.ZodType<PlaceOrderInput>`: одна форма для валідатора,
 * сторінки й сервера. Цін і вартості доставки тут немає — їх рахує сервер.
 */
export interface PlaceOrderInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  shippingMethodId: string;
  deliveryCity: string | null;
  deliveryAddress: string | null;
  pickupPointId: string | null;
  paymentMethod: 'cash' | 'online';
  notes: string | null;
  hasDifferentRecipient: boolean;
  recipientFirstName: string | null;
  recipientLastName: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  recipientCity: string | null;
  recipientAddress: string | null;
  recipientNotes: string | null;
  /** Зберегти нового отримувача в книгу покупця. */
  saveRecipient: boolean;
  /** Обраний зі списку отримувач; `null` — новий або без отримувача. */
  savedRecipientId: string | null;
  savedAddressId: string | null;
  items: CheckoutItemInput[];
}

/** Доменні відмови оформлення — КОДОМ; текст — у каталозі повідомлень. */
export type PlaceOrderRejection =
  | 'shipping_unavailable'
  | 'pickup_point_invalid'
  | 'not_purchasable';

/** Що повертається після успішного оформлення. */
export interface PlacedOrder {
  id: string;
  orderNumber: string;
  /** Токен гостьового замовлення; для залогіненого — `null`. */
  accessToken: string | null;
}

export type PlaceOrderResult =
  | { ok: true; order: PlacedOrder }
  | { ok: false; reason: PlaceOrderRejection };
```

`checkout-input.ts` — переписати цілком:

```ts
import { z } from 'zod';
import type { PlaceOrderInput } from 'simplycms/contracts';

/**
 * Схема оформлення — ЄДИНЕ джерело валідації запиту.
 *
 * 🔴 Живе окремим модулем без жодного серверного імпорту: її читає і
 * `inputValidator` серверної функції, і сама сторінка. Форма — контракт T0
 * `PlaceOrderInput`; `satisfies` не пропустить ані відсутнє поле, ані інший
 * тип, тож дзеркальних копій типу немає.
 *
 * Позиція кошика — ЛИШЕ ідентичність і кількість (К2-Е0, Е0-4): усе, що
 * приїхало б із кошика як «істина», можна підмінити в запиті (борг 0.4.1-4).
 */
export const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  modificationId: z.string().uuid().nullable(),
  quantity: z.number().int().positive(),
});

export const checkoutInputSchema = z.object({
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  email: z.string().max(255),
  phone: z.string().max(50),
  shippingMethodId: z.string().uuid(),
  deliveryCity: z.string().nullable(),
  deliveryAddress: z.string().nullable(),
  pickupPointId: z.string().uuid().nullable(),
  paymentMethod: z.enum(['cash', 'online']),
  notes: z.string().max(5000).nullable(),
  hasDifferentRecipient: z.boolean(),
  recipientFirstName: z.string().nullable(),
  recipientLastName: z.string().nullable(),
  recipientPhone: z.string().nullable(),
  recipientEmail: z.string().nullable(),
  recipientCity: z.string().nullable(),
  recipientAddress: z.string().nullable(),
  recipientNotes: z.string().nullable(),
  saveRecipient: z.boolean(),
  savedRecipientId: z.string().uuid().nullable(),
  savedAddressId: z.string().uuid().nullable(),
  items: z.array(checkoutItemSchema).min(1),
}) satisfies z.ZodType<PlaceOrderInput>;
```

(зникають `shippingCost`, ціни позицій, `discountData`, імпорт `JsonValue` з
лоадерів і локальний `PlacedOrder`).

`entities/new-order.ts` (файл створює Task 9 Step 3, туди ж переїхали типи):
інтерфейс `CreatedOrder` видалити — його місце займає `PlacedOrder` з T0. В
`order-create.ts` — прибрати `CreatedOrder` з `import type { CreatedOrder,
NewOrderInput } from './entities/new-order'`, додати `import type { PlacedOrder }
from 'simplycms/contracts'` і повертати `Promise<PlacedOrder>`. У
`loaders/index.ts` — зняти `CreatedOrder` з блоку реекспорту
`./entities/new-order` (інакше TS2305 на неіснуючому типі). `checkout.ts`
більше не імпортує `PlacedOrder` із `./checkout-input`.

- [ ] **Step 4: Серверне ціноутворення й валідація**

`packages/simplycms/src/storefront/loaders/checkout-items.ts`:

```ts
import { inArray } from 'drizzle-orm';
import { productModifications, products } from 'simplycms/schema';
import type { CheckoutItemInput, PlaceOrderRejection } from 'simplycms/contracts';
import { resolveDiscount } from 'simplycms/domain/discounts';
import { isPurchasable } from 'simplycms/domain/inventory';
import { resolvePrice } from 'simplycms/domain/pricing';
import type { ActorDb } from './db';
import { loadDefaultUserCategoryId, loadUserCategoryId } from './categories';
import { loadDiscountGroups } from './discounts';
import type { NewOrderItem } from './entities/new-order';
import type { JsonValue } from './entities/property';
import { loadDefaultPriceTypeId, loadPricesByProduct } from './pricing';
import { loadUserPriceTypeId } from './profile';

/**
 * Серверне ціноутворення позицій (К2-Е0, Е0-4).
 *
 * 🔴 Той самий ланцюг, що на картці товару, і те саме СЕРЕДОВИЩЕ знижок, що
 * будує `core/lib/discounts.ts::getDiscountEnvironment`: тип ціни і категорія
 * — персональні, з відкатом на ДЕФОЛТНІ (гість і покупець без категорії
 * дістають категорію за замовчуванням, не `null`); групи знижок читаються за
 * ефективним типом ціни (`loadDiscountGroups(db, priceTypeId)`). Інакше
 * чекаут рахував би інші знижки, ніж каталог (B2 аудиту r1). Кошик несе лише
 * id і кількість — назва, ціна і статус беруться з БД у цій же транзакції.
 *
 * 🔴 `cartTotal` тут — реальна сума базових цін усього запиту; картка товару
 * передає `0` (`product-detail/pricing.ts`), бо кошика не знає. Знижки з
 * умовою на суму кошика тому законно зʼявляються лише в чекауті — істина
 * про ціну позиції замовлення саме тут.
 */
export async function priceCheckoutItems(
  db: ActorDb,
  userId: string | null,
  items: CheckoutItemInput[],
): Promise<NewOrderItem[] | Extract<PlaceOrderRejection, 'not_purchasable'>> {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const modIds = items.map((i) => i.modificationId).filter((id): id is string => id !== null);

  const productRows = await db
    .select({ id: products.id, name: products.name, section_id: products.sectionId,
      stock_status: products.stockStatus, is_active: products.isActive })
    .from(products)
    .where(inArray(products.id, productIds));
  const modRows = modIds.length
    ? await db
        .select({ id: productModifications.id, product_id: productModifications.productId,
          name: productModifications.name, stock_status: productModifications.stockStatus })
        .from(productModifications)
        .where(inArray(productModifications.id, modIds))
    : [];
  const prices = await loadPricesByProduct(db, productIds);
  const defaultPriceType = await loadDefaultPriceTypeId(db);
  const defaultCategory = await loadDefaultUserCategoryId(db);
  const userPriceType = userId ? await loadUserPriceTypeId(db, userId) : null;
  const userCategory = userId ? await loadUserCategoryId(db, userId) : null;
  const priceTypeId = userPriceType ?? defaultPriceType;
  const userCategoryId = userCategory ?? defaultCategory;
  const groups = priceTypeId ? await loadDiscountGroups(db, priceTypeId) : [];

  const byProduct = new Map(productRows.map((p) => [p.id, p]));
  const byMod = new Map(modRows.map((m) => [m.id, m]));
  const cartTotal = items.reduce((sum, item) => {
    const base = resolvePrice(prices[item.productId] ?? [], priceTypeId, defaultPriceType, item.modificationId).price ?? 0;
    return sum + base * item.quantity;
  }, 0);

  const result: NewOrderItem[] = [];
  for (const item of items) {
    const product = byProduct.get(item.productId);
    const mod = item.modificationId ? byMod.get(item.modificationId) : null;
    if (!product || !product.is_active) return 'not_purchasable';
    if (item.modificationId && (!mod || mod.product_id !== item.productId)) return 'not_purchasable';
    if (!isPurchasable(mod ? mod.stock_status : product.stock_status)) return 'not_purchasable';

    const { price: basePrice } = resolvePrice(prices[item.productId] ?? [], priceTypeId, defaultPriceType, item.modificationId);
    if (basePrice === null) return 'not_purchasable';

    const discount = resolveDiscount(basePrice, groups, {
      userId, userCategoryId, quantity: item.quantity, cartTotal,
      productId: item.productId, modificationId: item.modificationId,
      sectionId: product.section_id, isLoggedIn: userId !== null, now: new Date(),
    });

    result.push({
      productId: item.productId,
      modificationId: item.modificationId,
      name: mod ? `${product.name} - ${mod.name}` : product.name,
      price: discount.finalPrice,
      quantity: item.quantity,
      basePrice: discount.totalDiscount > 0 ? basePrice : null,
      discountData: discount.totalDiscount > 0
        ? { applied: discount.appliedDiscounts as unknown as JsonValue }
        : null,
    });
  }
  return result;
}
```

Сигнатури `loadDiscountGroups(db, priceTypeId)` (`loaders/discounts.ts:31`),
`loadUserCategoryId(db, userId)`/`loadDefaultUserCategoryId(db)`
(`loaders/categories.ts:14,34`), `loadUserPriceTypeId(db, userId)`
(`loaders/profile.ts:84`) — ті самі, що кличе `getDiscountEnvironment`
(`core/lib/discounts.ts:49-63`); поля `DiscountContext` — з
`contracts/objects/discount.ts:50-60`.

`packages/simplycms/src/storefront/loaders/place-order.ts` — уся логіка
оформлення (сюди ж переїжджають `resolveRecipient` і `toOrderInput` із
`checkout.ts`):

```ts
import { randomUUID } from 'node:crypto';
import type { PlaceOrderInput, PlaceOrderResult } from 'simplycms/contracts';
import { findShippingZoneIn, resolveShippingRate } from 'simplycms/domain/shipping';
import { withCustomerDb, withOrderTokenDb, type ActorDb, type OperatorEscalation } from './db';
import { priceCheckoutItems } from './checkout-items';
import type { NewOrderInput, NewOrderItem } from './entities/new-order';
import { createOrder } from './order-create';
import { createRecipient } from './recipients';
import { InsufficientStockError } from './stock-reservation';
import { loadShippingDirectory } from './shipping';

/**
 * Логіка оформлення без RPC-обгортки — щоб харнес доводив воронку напряму.
 *
 * 🔴 Живе в server-only дереві `storefront` (декларація межі), а не другим
 * експортом поруч із serverFn: у клієнтському модулі не-serverFn експорт
 * лишається живим і тягне лоадери в клієнтський граф — Import Protection
 * валить збірку магазину (той самий клас, що описано в `core/lib/price-type.ts`).
 *
 * 🔴 ОДНА транзакція на все: довідники, ціни, отримувач, запис. Дві
 * послідовні (спершу читання, потім запис) залишали б вікно, у якому ціна,
 * тариф чи залишок змінюються між ними (B3 аудиту r1). Відмови — значеннями
 * (до жодного запису), нестача залишку — винятком з відкатом усередині
 * `createOrder` (списання — під ескалацією, див. `escalationFor`).
 */
export async function placeOrderFor(
  input: PlaceOrderInput,
  userId: string | null,
): Promise<PlaceOrderResult> {
  const accessToken = userId === null ? randomUUID() : null;
  const run = <T>(fn: (db: ActorDb, operator: OperatorEscalation) => Promise<T>): Promise<T> =>
    userId === null
      ? withOrderTokenDb(accessToken as string, fn)
      : withCustomerDb(userId, fn);

  try {
    return await run(async (db, operator) => {
      const directory = await loadShippingDirectory(db);
      const method = directory.methods.find(
        (m) => m.id === input.shippingMethodId && m.is_active,
      );
      if (!method) return { ok: false, reason: 'shipping_unavailable' } as const;

      // Pickup — за КОДОМ методу, як і UI (`CheckoutDeliveryForm`: `code === 'pickup'`):
      // pickup вимагає активну точку ЦЬОГО методу; не-pickup точки не приймає.
      const isPickup = method.code === 'pickup';
      const point = input.pickupPointId
        ? directory.pickupPoints.find(
            (p) => p.id === input.pickupPointId && p.method_id === method.id && p.is_active,
          )
        : null;
      if (isPickup && !point) return { ok: false, reason: 'pickup_point_invalid' } as const;
      if (!isPickup && input.pickupPointId) return { ok: false, reason: 'pickup_point_invalid' } as const;

      const items = await priceCheckoutItems(db, userId, input.items);
      if (items === 'not_purchasable') return { ok: false, reason: 'not_purchasable' } as const;

      const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const zone = findShippingZoneIn(directory.zones, input.deliveryCity ?? '');
      const rate = resolveShippingRate({ method, zone, cart: { items: [], subtotal } }, directory.rates);
      // `null` — жодного застосовного тарифу: це НЕ «безкоштовно», а відмова.
      if (rate === null) return { ok: false, reason: 'shipping_unavailable' } as const;

      const savedRecipientId = await resolveRecipient(db, userId, input);
      const order = await createOrder(db, userId, accessToken,
        toOrderInput(input, savedRecipientId, { items, subtotal, shippingCost: rate.cost }), operator);
      return { ok: true, order } as const;
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) return { ok: false, reason: 'not_purchasable' };
    throw error;
  }
}
```

`resolveRecipient(db, userId, input: PlaceOrderInput)` — тіло з `checkout.ts`
без змін; `toOrderInput(input, savedRecipientId, prepared: { items:
NewOrderItem[]; subtotal: number; shippingCost: number }): NewOrderInput` —
замість `input.items`/`input.shippingCost`/локального `subtotal` брати з
`prepared`, `total: prepared.subtotal + prepared.shippingCost`. Імпорти в
`place-order.ts` — ВІДНОСНІ всередині дерева; форму `resolveShippingRate({
method, zone, cart: { items: [], subtotal } }, rates)` клієнт уже використовує
в `core/hooks/useShippingDirectory.ts:54-57` — сервер дзеркалить її
один-в-один. Поле `method_id`/`is_active` у `PickupPointRow` — з контракту
`PickupPoint` (`loaders/pickup-points.ts:11`), звірити назви перед запуском.
У `loaders/index.ts` — `export * from './checkout-items';` і `export * from './place-order';`.

`storefront-routes/server/checkout.ts` стає тонким serverFn — РІВНО один
експорт і жодної звичайної функції (урок `core/lib/price-type.ts`):

```ts
import { createServerFn } from '@tanstack/react-start';
import { optionalSessionUserId, placeOrderFor } from 'simplycms/storefront/loaders';
import { checkoutInputSchema } from './checkout-input';

/**
 * Оформлення замовлення — тонка RPC-обгортка над `placeOrderFor`
 * (server-only дерево). Ідентичність — лише з серверної сесії.
 */
export const placeOrder = createServerFn({ method: 'POST' })
  .inputValidator(checkoutInputSchema)
  .handler(async ({ data }) => placeOrderFor(data, await optionalSessionUserId()));
```

(`data` типізований схемою й присвоюється `PlaceOrderInput` без касту — це і
є перевірка `satisfies` у дії.)

Run: `pnpm typecheck && pnpm vitest run --config vitest.schema.config.ts packages/simplycms/test-harness/pg/__tests__/checkout-flow.test.ts`
Expected: PASS (8 кейсів).

- [ ] **Step 5: Клієнт — новий запит і мапа відмов**

`Checkout.tsx`: імпорти `import type { PlaceOrderRejection } from 'simplycms/contracts';`
і `type MessageKey` з `simplycms/i18n`; на модуль-рівні:

```ts
/** Код відмови сервера → ключ каталогу (як CheckoutAuthBlock мапить коди Better Auth). */
const REJECTION_KEY: Record<PlaceOrderRejection, MessageKey> = {
  shipping_unavailable: 'checkout.rejected.shipping_unavailable',
  pickup_point_invalid: 'checkout.rejected.pickup_point_invalid',
  not_purchasable: 'checkout.rejected.not_purchasable',
};
```

У `onSubmit` виклик `placeOrder({ data: {…} })` — прибрати `shippingCost`,
`items` → `items.map((item) => ({ productId: item.productId, modificationId:
item.modificationId, quantity: item.quantity }))` (без
`name/price/basePrice/discountData`); результат:

```ts
      const result = await placeOrder({ data: { … } });
      if (!result.ok) {
        toast({
          title: t('checkout.failed'),
          description: t(REJECTION_KEY[result.reason]),
          variant: 'destructive',
        });
        return;
      }
      const { order } = result;
```

(`clearCart`, toast успіху й `navigate` — без змін.) `CartItem.productId` —
`string`; якщо тип допускає порожній рядок — фільтрувати `items.filter((i) => i.productId)`.

Каталоги: у `uk/checkout.ts` після `'checkout.retry'`:

```ts
  // Доменні відмови оформлення — код із сервера, текст тут (К2-Е0)
  'checkout.rejected.shipping_unavailable': 'Обраний спосіб доставки недоступний — оберіть інший',
  'checkout.rejected.pickup_point_invalid': 'Оберіть точку видачі для цього способу доставки',
  'checkout.rejected.not_purchasable': 'Частина товарів у кошику зараз недоступна — перевірте кошик',
```

у `en/checkout.ts` — дзеркало: `'Selected shipping method is unavailable — pick another'`,
`'Pick a pickup point for this shipping method'`, `'Some items in your cart are unavailable — review the cart'`.

Run: `pnpm typecheck && pnpm test`
Expected: PASS (включно з `i18n-catalog-parity`).

- [ ] **Step 6: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm test:schema
git add -A packages/simplycms/src/contracts/objects/order.ts packages/simplycms/src/storefront-routes/server packages/simplycms/src/storefront/loaders packages/simplycms/src/storefront-routes/pages/Checkout.tsx packages/simplycms/src/i18n/catalogs packages/simplycms/test-harness/pg/__tests__/fixtures packages/simplycms/test-harness/pg/__tests__/checkout-flow.test.ts
git commit -m "feat(k2-e0): placeOrder — сервер рахує ціни й доставку, відмовляє доменним кодом; контракт у T0

Кошик несе лише id і кількість; ціна — resolvePrice+resolveDiscount у
середовищі getDiscountEnvironment, доставка — resolveShippingRate у
транзакції; метод/точка валідуються; результат — union {ok, reason}, типи в
contracts, Zod-схема satisfies контракт, клієнт мапить код на каталог.
Знижки харнесу — спільний білдер. Закриває борг 0.4.1-4 цілком; харнес
доводить воронку до рядка в orders і три коди відмови в шести сценаріях (Е0-4)."
```

---
### Task 11: Чекаут — empty-state, видима валідація, доступні контроли, автовибір точки (Е0-4, UI)

**Files:**
- Modify: `packages/simplycms/src/checkout-ui/CheckoutDeliveryForm.tsx:17-22, 191-197, 227-236, 266-292, 327-343`
- Modify: `packages/simplycms/src/checkout-ui/CheckoutContactForm.tsx:31-70`
- Modify: `packages/simplycms/src/checkout-ui/CheckoutRecipientForm.tsx` (лейбли `:226,284,297,312,324,338,349,363`), `CheckoutOrderSummary.tsx:10-17, 101-110, 113-119`, `CheckoutAuthBlock.tsx:201-303`, `CheckoutPaymentForm.tsx:44-70`
- Modify: `packages/simplycms/src/checkout-ui/{AddressSelectorPopup,RecipientSelectorPopup}.tsx` (`:87,94` і `:92,99` — контроли БЕЗ лейбла, їм `aria-label`)
- Modify: `packages/simplycms/src/profile-ui/{AddressesList,RecipientsList,AvatarUpload}.tsx` (13 лейблів)
- Modify: `packages/simplycms/src/catalog-ui/{ModificationSelector,FilterSidebar}.tsx` (1 лейбл-заголовок + 4 поля без лейбла)
- Modify: `packages/simplycms/src/reviews-ui/ReviewForm.tsx:63, 96, 113`
- Modify: `packages/simplycms/src/storefront-routes/pages/Checkout.tsx` (`canSubmit` у `CheckoutOrderSummary`; `FormMessage` для `shippingMethodId`; імпорти форм з `simplycms/checkout-ui`)
- Modify: `packages/simplycms/src/i18n/catalogs/{uk,en}/checkout.ts`
- Modify: `eslint.config.mjs` (зона `jsx-a11y/label-has-associated-control`), `package.json` (devDependency), `pnpm-lock.yaml` (перегенерований)
- Create: `packages/simplycms/src/checkout-ui/__tests__/accessible-controls.ts`
- Create: `packages/simplycms/src/checkout-ui/__tests__/CheckoutDeliveryForm.test.tsx`
- Create: `packages/simplycms/src/checkout-ui/__tests__/CheckoutContactForm.test.tsx`

**Interfaces:**
- Produces: проп `CheckoutDeliveryFormProps.onAvailabilityChange?: (hasMethods: boolean) => void`; проп `CheckoutOrderSummaryProps.canSubmit: boolean`; i18n `checkout.noShippingMethods.title|description`; правило `id`/`htmlFor` для КОЖНОГО лейбла пʼяти тек воронки, що підписує контрол (у чекауті префікс `checkout-`; чотири лейбли-заголовки натомість перестають бути `<label>` — крок 5), `<select>` точки — `checkout-pickup-point`; автовибір єдиної точки видачі; структурний гейт `jsx-a11y/label-has-associated-control` на зону воронки в `eslint.config.mjs`.
- Consumes: `FormField`/`FormItem`/`FormMessage` з `simplycms/ui/form`.

🔴 Правило доступних імен — одне на всю **воронку**, а не лише на чекаут
(рішення Р5, ред. 1.3). Виміряно `grep` по `packages/simplycms/src/<тека>/*.tsx`
(2026-09-05):

| Тека | `<label>` | з `htmlFor` | контролів `input|select|textarea` |
|---|---|---|---|
| `checkout-ui` | 24 | 0 | 28 |
| `profile-ui` | 13 | 0 | 13 |
| `catalog-ui` | 5 | 4 | 8 |
| `reviews-ui` | 4 | 1 | 2 |
| `cart-ui` | 0 | 0 | 0 (форм немає) |

Тобто **41 лейбл** у зоні не звʼязаний із жодним полем: ні скрінрідер, ні
`getByLabelText`/`getByLabel` Playwright його не бачать (B5 аудиту r1 лікував
чотири поля контактів — 10 % проблеми). `cart-ui` входить у зону наперед: там
сьогодні нуль форм, і саме тому гейт мусить стояти ДО того, як там зʼявиться
перша.

🔴 Доказ, що механічної правки без гейта замало і що дефолт правила гейтом
**не є**: `eslint-plugin-jsx-a11y@6.10.2` під ESLint 10.8.0 прогнано по копії
зони (5 тек, поточний код).

| Конфігурація правила | Помилок на зоні |
|---|---|
| `assert: 'either'` (дефолт) | **5** |
| `assert: 'nesting'` | 5 |
| `assert: 'htmlFor'`, `depth: 2` (дефолт) | 41, з них 2 — «must have accessible text» |
| `assert: 'htmlFor'`, `depth: 3` | **41**, усі — «must be associated with a control» |

Дефолт пропускає 36 із 41, бо будь-який `JSXExpressionContainer` усередині
лейбла (`<label>{t('…')}</label>` — форма ВСІХ лейблів воронки) правило
трактує як «можливо, контрол вкладений» і мовчить. Ловить воно лише три
лейбли з голим рядковим дитям (`>Email<`) і два з текстом глибше двох рівнів.
Тому конфігурація зони — `{ assert: 'htmlFor', depth: 3 }`: `htmlFor` —
єдиний режим, що дає справжній гейт; `depth: 3` знімає дві помилки «must have
accessible text» на лейблах-обгортках radio/checkbox, де підпис лежить у
`label > div > span` (`CheckoutPaymentForm:44`, `CheckoutRecipientForm:226`).

🔴 Наслідок вибору `htmlFor`, який треба знати заздалегідь: radio/checkbox,
обгорнуті в `<label>`, ПІД гейт підпадають (виміряно: `CheckoutDeliveryForm:227`,
`CheckoutPaymentForm:44`, `CheckoutRecipientForm:226`, `RecipientsList:354`,
`AddressesList:268`) — їм теж потрібні `id` + `htmlFor`. Це не надмірність:
HTML дозволяє обидві форми звʼязку одночасно, а явний `for` робить radio
адресовним для `getByLabelText`, чого сама обгортка не дає.

🔴 Сліпа зона правила, яку гейт НЕ закриває: воно спрацьовує на `<label>`,
тож контрол **узагалі без лейбла** для нього невидимий. У зоні таких девʼять:
`AddressSelectorPopup.tsx:87,94` і `RecipientSelectorPopup.tsx:92,99` (пошук +
сортування), `FilterSidebar.tsx:230,241,354,368` (числові діапазони ціни й
властивостей), `AvatarUpload.tsx:62` (прихований `disabled` `input[type=file]`).
Їх закриває механічна правка кроку 5 (`aria-label`), а не гейт — і це записано
тут, щоб зелений лінт не читався як «уся воронка доступна».

- [ ] **Step 1: Спільний асерт доступності і юніти — спершу червоні**

`packages/simplycms/src/checkout-ui/__tests__/accessible-controls.ts`:

```ts
import { expect } from 'vitest';

/**
 * Кожен текстовий контрол форми має `id` і `<label for>` (К2-Е0, Е0-4):
 * без цього скрінрідери й `getByLabel` Playwright поля не знаходять, а
 * лейбл-сусід без `htmlFor` — не звʼязок. Radio/checkbox тут не рахуються:
 * їхній звʼязок стереже ESLint-зона (крок 3), а поведінковий асерт по DOM
 * тримає саме текстові поля — ті, що заповнює live-smoke.
 */
export function expectLabelledControls(container: HTMLElement): void {
  const controls = container.querySelectorAll<HTMLElement>(
    'input:not([type=radio]):not([type=checkbox]):not([type=button]):not([type=submit]), select, textarea',
  );
  expect(controls.length).toBeGreaterThan(0);
  for (const control of controls) {
    expect(control.id, `контрол без id: ${control.outerHTML.slice(0, 80)}`).not.toBe('');
    expect(
      container.querySelector(`label[for="${control.id}"]`),
      `немає label[for="${control.id}"]`,
    ).not.toBeNull();
  }
}
```

`packages/simplycms/src/checkout-ui/__tests__/CheckoutDeliveryForm.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Довідник — керований з тесту: порожній (стан демо-магазину без доставки до
// К2-Е0: форма мовчала, submit лишався активним) або один pickup з однією
// точкою (стан покупного демо: точку треба обрати самому — ще одна «стіна»).
const directory = vi.hoisted(() => ({
  methods: [] as unknown[], pickupPoints: [] as unknown[],
}));
vi.mock('simplycms/core/hooks/useShippingDirectory', () => ({
  useShippingDirectory: () => ({
    methods: directory.methods, pickupPoints: directory.pickupPoints,
    zones: [], rates: [], isLoading: false, rateFor: () => ({ cost: 0 }),
  }),
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('simplycms/core/hooks/useAddressBook', () => ({
  useAddressBook: () => ({ addresses: [], save: vi.fn() }),
}));
vi.mock('simplycms/react-query', async (orig) => ({
  ...(await orig()),
  useEngine: () => ({ config: { locale: 'uk-UA', currency: 'UAH' } }),
}));

import { I18nProvider } from 'simplycms/i18n';
import { CheckoutDeliveryForm } from '../CheckoutDeliveryForm';
import { expectLabelledControls } from './accessible-controls';

const PICKUP = { id: 'm1', code: 'pickup', name: 'Самовивіз', description: null, icon: null, type: 'system', is_active: true, sort_order: 0 };
const POINT = { id: 'p1', method_id: 'm1', name: 'Склад', address: 'вул. 1', city: 'Київ', is_active: true, sort_order: 0 };

const renderForm = (values: Record<string, string | boolean>, extra: Record<string, unknown> = {}) => {
  const onChange = vi.fn();
  const onAvailabilityChange = vi.fn();
  render(
    <I18nProvider locale="uk">
      <CheckoutDeliveryForm
        values={values}
        onChange={onChange}
        subtotal={100}
        onShippingCostChange={vi.fn()}
        onAvailabilityChange={onAvailabilityChange}
        {...extra}
      />
    </I18nProvider>,
  );
  return { onChange, onAvailabilityChange };
};

describe('CheckoutDeliveryForm', () => {
  it('без способів доставки — empty-state, submit неможливий, жодного radio', () => {
    directory.methods = []; directory.pickupPoints = [];
    const { onAvailabilityChange } = renderForm({});
    expect(screen.getByText('Доставка не налаштована')).toBeTruthy();
    expect(onAvailabilityChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('єдина точка pickup обирається сама; контроли мають лейбли', () => {
    directory.methods = [PICKUP]; directory.pickupPoints = [POINT];
    const { onChange, onAvailabilityChange } = renderForm({ shippingMethodId: 'm1' });
    expect(onAvailabilityChange).toHaveBeenLastCalledWith(true);
    expect(onChange).toHaveBeenCalledWith('pickupPointId', 'p1');
    expect(screen.getByLabelText(/Оберіть пункт самовивозу/)).toBeTruthy();
    expectLabelledControls(document.body);
  });
});
```

(Обʼєкти `PICKUP`/`POINT` — мінімальні поля, які читає рендер; якщо тип
`ShippingMethodRow`/`PickupPointRow` вимагає ще щось — дописати в фікстуру
тесту, не в компонент. Регекс `/Оберіть пункт самовивозу/` збігається з
чинним `checkout.delivery.pickupPointLabel` — `'Оберіть пункт самовивозу *'`.)

`packages/simplycms/src/checkout-ui/__tests__/CheckoutContactForm.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, it, vi } from 'vitest';
import { I18nProvider } from 'simplycms/i18n';
import { CheckoutContactForm } from '../CheckoutContactForm';
import { expectLabelledControls } from './accessible-controls';

describe('CheckoutContactForm', () => {
  it('чотири поля контактів мають id і label[for] — селектори live-smoke і скрінрідери', () => {
    const { container } = render(
      <I18nProvider locale="uk">
        <CheckoutContactForm
          values={{ firstName: '', lastName: '', email: '', phone: '' }}
          onChange={vi.fn()}
        />
      </I18nProvider>,
    );
    expectLabelledControls(container);
  });
});
```

Run: `pnpm vitest run packages/simplycms/src/checkout-ui`
Expected: FAIL (тексту немає; пропа немає; контроли без `id`).

- [ ] **Step 2: Empty-state за патерном CartView + сигнал батькові + автовибір точки**

У `CheckoutDeliveryForm.tsx`: додати проп `onAvailabilityChange?: (hasMethods: boolean) => void`;
поруч з автовибором методу (`:191-195`) — два ефекти:

```tsx
  useEffect(() => {
    onAvailabilityChange?.(methods.length > 0);
  }, [methods.length, onAvailabilityChange]);

  useEffect(() => {
    // Єдина точка видачі обирається сама — тим самим правилом, що й перший
    // метод вище: плейсхолдер «Оберіть пункт» при одній точці лишав submit,
    // який сервер відкидає з `pickup_point_invalid`.
    if (isPickup && pickupPoints.length === 1 && !values.pickupPointId) {
      onChange('pickupPointId', pickupPoints[0].id);
    }
  }, [isPickup, pickupPoints, values.pickupPointId, onChange]);
```

після гілки `if (methodsLoading) {…}` (`:197`) — перед основним `return`:

```tsx
  // 🔴 Порожній довідник — стан, у якому оформити замовлення НЕМОЖЛИВО, і
  // покупець мусить це бачити: до К2-Е0 сітка `methods.map` рендерилась
  // порожньою, поле для помилки валідації не існувало, а submit лишався
  // активним і мовчав. Той самий блокуючий патерн, що в CartView для
  // порожнього кошика.
  if (methods.length === 0) {
    return (
      <div className="border rounded-lg p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Truck className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">
          {t('checkout.noShippingMethods.title')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('checkout.noShippingMethods.description')}
        </p>
      </div>
    );
  }
```

(усі хуки — вище цього `return`, інакше `react-hooks/rules-of-hooks`.
`Truck` уже імпортований — `CheckoutDeliveryForm.tsx:2`.)

Каталоги: `uk` — `'checkout.noShippingMethods.title': 'Доставка не налаштована'`,
`'checkout.noShippingMethods.description': 'Магазин ще не додав жодного способу доставки. Оформлення стане доступним, щойно він зʼявиться.'`;
`en` — `'Shipping is not set up'`, `'The store has not added any shipping method yet. Checkout becomes available as soon as one appears.'`.

- [ ] **Step 3: Гейт `jsx-a11y/label-has-associated-control` на зону воронки — спершу червоний**

🔴 Плагін і lockfile — В ОДНОМУ кроці. `pnpm install --frozen-lockfile` — ПЕРШИЙ
гейт ланцюга, і жоден інший не звіряє `pnpm-lock.yaml` з манифестами; локально
`pnpm install` мовчки лагодить розсинхрон, а на PR усі job-и падають із
`ERR_PNPM_OUTDATED_LOCKFILE` ще до першого кроку (урок PR #20, зафіксований у
CLAUDE.md — там це коштувало повного червоного CI на правці, де просто забули
перегенерувати lockfile).

```bash
pnpm add -D -w eslint-plugin-jsx-a11y@6.10.2   # у корінь монорепо; lockfile оновиться тут же
git status --short pnpm-lock.yaml              # має зʼявитися у змінених
```

🔴 Версія пінується точно (`6.10.2`, latest на 2026-09-05), бо її
`peerDependencies` — `eslint: '^3 || … || ^9'`, а в репо ESLint **10.8.0**:
peer не збігається. Що це означає практично, перевірено, а не припущено:
`npm install` без `--legacy-peer-deps` таку пару відмовляється ставити; pnpm 11
ставить із ворнінгом (`strict-peer-dependencies` за замовчуванням вимкнено і в
`pnpm-workspace.yaml` репо не вмикається); саме правило під ESLint 10.8.0
працює — прогін по копії зони дав рівно ті 41/5 помилок, що в таблиці вище.
Якщо pnpm колись переведуть у strict-режим — лікується
`peerDependencyRules.allowedVersions` у `pnpm-workspace.yaml`, а не відкотом
гейта.

`eslint.config.mjs` — імпорт поруч із рештою плагінів (`import jsxA11y from
'eslint-plugin-jsx-a11y';`), константа зони поруч із `I18N_MIGRATED_FILES` і
блок конфігу після зони `query-key-from-entity`:

```js
// Доступні імена контролів воронки (К2-Е0, Е0-4, рішення Р5): у пʼяти теках
// воронки 41 `<label>` не звʼязаний ні з чим — скрінрідер і `getByLabelText`
// поля не знаходять. `cart-ui` у зоні наперед: форм там сьогодні нуль, і гейт
// має стояти ДО появи першої.
//
// 🔴 `src/admin/**` тут НЕМАЄ навмисно — з тієї ж причини, що й у зоні
// `query-key-from-entity` вище: ~52 файли адмінки переписуються треком К3,
// правити їхні лейбли зараз означало б робити роботу двічі.
const A11Y_LABEL_ZONE = [
  'packages/simplycms/src/checkout-ui/**/*.tsx',
  'packages/simplycms/src/profile-ui/**/*.tsx',
  'packages/simplycms/src/catalog-ui/**/*.tsx',
  'packages/simplycms/src/reviews-ui/**/*.tsx',
  'packages/simplycms/src/cart-ui/**/*.tsx',
];

// …

  // Зона доступних імен. Імʼя правила (`jsx-a11y/label-has-associated-control`)
  // унікальне, тож пастки flat config-у «опції правила ЗАМІЩУЮТЬСЯ, а не
  // доливаються» тут немає: зона перетинається з i18n-зоною й із
  // `query-key-from-entity`, але жодна з них цього правила не ставить.
  //
  // 🔴 `assert: 'htmlFor'`, а не дефолт: з дефолтним `'either'` правило на
  // цьому коді дає 5 помилок замість 41 — будь-який `{t('…')}` усередині
  // лейбла воно вважає «можливо, контрол вкладений» і мовчить (виміряно
  // прогоном 6.10.2 під ESLint 10.8.0). `depth: 3` — щоб лейбли-обгортки
  // radio/checkbox, де підпис лежить у `label > div > span`, не червоніли
  // окремим повідомленням «must have accessible text».
  //
  // 🔴 Правило бачить лише `<label>`: контрол БЕЗ лейбла для нього невидимий
  // (у зоні таких 9 — попапи чекауту, числові діапазони фільтра, прихований
  // avatar-input). Зелений лінт доступності воронки не доводить.
  {
    files: A11Y_LABEL_ZONE,
    ignores: ['**/__tests__/**'],
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      'jsx-a11y/label-has-associated-control': [
        'error',
        { assert: 'htmlFor', depth: 3 },
      ],
    },
  },
```

Run: `pnpm lint`
Expected: FAIL — рівно **41** помилка `jsx-a11y/label-has-associated-control`
(24 `checkout-ui`, 13 `profile-ui`, 1 `catalog-ui`, 3 `reviews-ui`), усі з
текстом «A form label must be associated with a control». Інші лічильники
лінта не рухаються: норма репо — 0 errors / 12 warnings.

- [ ] **Step 4: Доступні імена — шість форм чекауту (24 лейбли)**

Правило: `<label htmlFor="checkout-<поле>">` + `<input id="checkout-<поле>">`
(`<select>`/`<textarea>` — так само). Ідентифікатори (номери рядків — до
вставки кроку 2, вона зсуває `CheckoutDeliveryForm`):

| Форма | Контроли → `id` |
|---|---|
| `CheckoutContactForm` (`:31-70`) | `checkout-first-name`, `checkout-last-name`, `checkout-email`, `checkout-phone` |
| `CheckoutDeliveryForm` | radio методу (`:235`) → `checkout-shipping-${method.id}`; `<select>` точки (`:273`) → `checkout-pickup-point`; місто (`:330`) → `checkout-city`; адреса (`:342`) → `checkout-address` |
| `CheckoutPaymentForm` (`:44-70`) | radio способу оплати → `checkout-payment-${method.id}` |
| `CheckoutRecipientForm` | checkbox «інший отримувач» (`:226/227`) → `checkout-different-recipient`; поля `:284…363` → `checkout-recipient-first-name`, `-last-name`, `-phone`, `-email`, `-city`, `-address`, `-notes` (textarea) |
| `CheckoutOrderSummary` (`:101-110`) | textarea приміток → `checkout-notes` |
| `CheckoutAuthBlock` (`:201-303`) | шість полів входу й реєстрації: `checkout-auth-email`, `checkout-auth-password`, `checkout-auth-first-name`, `checkout-auth-last-name`, `checkout-auth-register-email`, `checkout-auth-register-password` — вкладки `login`/`register` взаємовиключні (`activeTab === …`, `:198,255`), тож у DOM вони не зустрічаються; імена все одно різні, щоб `getByLabelText` не залежав від активної вкладки |

🔴 `id` усередині `.map()` (radio доставки й оплати) деривується з `method.id`,
а не з лічильника — інакше два рендери списку дали б однакові `id`. Той самий
патерн уже вживається в `catalog-ui/ModificationSelector.tsx:75,89`
(`htmlFor={mod.id}` / `id={mod.id}`) — він і є зразком.

🔴 Юніт-гейта на `CheckoutAuthBlock` немає (потребує моків auth-клієнта), тож
цей файл проходиться вручну за таблицею — але ESLint-зона кроку 3 його
покриває, і саме вона ловить пропущене поле.

- [ ] **Step 5: Доступні імена — решта воронки (17 лейблів) + негативний контроль**

`profile-ui` (13): `AddressesList.tsx:233,245,257` → `address-name`,
`address-city`, `address-line` (третій лейбл — `common.address`, не
«вулиця»); checkbox «за замовчуванням» (`:268/270`) → `address-default`. `RecipientsList.tsx:272,283,296,309,321,332,343` →
`recipient-first-name`, `-last-name`, `-phone`, `-email`, `-city`, `-address`,
`-notes`; checkbox (`:354/358`) → `recipient-default`.

🔴 Чотири лейбли зони не адресують жодного контролу — їм потрібен не
`htmlFor`, а **перестати бути `<label>`**: підпис, що нічого не підписує, це
й є дефект, який правило називає.
- `profile-ui/AvatarUpload.tsx:42` — заголовок блоку аватара (сам
  `input[type=file]` на `:62` прихований і `disabled`) → `<span>` + `aria-label`
  на прихованому полі;
- `catalog-ui/ModificationSelector.tsx:61` — заголовок групи radio → `<span>`,
  а групі дати `role="group"` + `aria-labelledby` на цей `id`;
- `reviews-ui/ReviewForm.tsx:63` — підпис над `StarRating` (там кнопки, не
  контрол) → те саме: `<span id="review-rating-label">` + `aria-labelledby`;
- `reviews-ui/ReviewForm.tsx:113` — підпис над слотом `renderImageUpload`
  (компонент магазину, `id` якого ядро не контролює) → `<span>`.

`reviews-ui/ReviewForm.tsx:96` — окремий випадок: контролом є `<textarea>`
(`:102`) ЛИШЕ коли слот `renderEditor` не переданий. Тому `<label
htmlFor="review-content">` рендериться в тій самій гілці, що й `<textarea
id="review-content">`, а в гілці слота лишається `<span>`; інакше `htmlFor`
вказував би в порожнечу — лінт цього не бачить (він перевіряє наявність
атрибута, не існування цілі), а скрінрідер бачить.

`catalog-ui/FilterSidebar.tsx:230,241,354,368` і попапи чекауту
(`AddressSelectorPopup.tsx:87,94`, `RecipientSelectorPopup.tsx:92,99`) —
контроли БЕЗ лейбла, правилу невидимі: дати `aria-label` з наявних i18n-ключів
(жодного нового кириличного літерала — теки під i18n-error-зоною).

Негативний контроль зони (обовʼязковий — зелений лінт скоупінг зони не
доводить, урок env-контракту):

```bash
# прибрати htmlFor рівно в одному лейблі одного файла зони
sed -i 's/ htmlFor="checkout-email"//' packages/simplycms/src/checkout-ui/CheckoutContactForm.tsx
pnpm lint   # Expected: FAIL — 1 error jsx-a11y/label-has-associated-control
git checkout -- packages/simplycms/src/checkout-ui/CheckoutContactForm.tsx
pnpm lint   # Expected: PASS — 0 errors / 12 warnings
```

Run: `pnpm lint`
Expected: PASS (0 errors / 12 warnings — норма репо).

- [ ] **Step 6: Submit блокується; помилка `shippingRequired` видима; імпорти з `checkout-ui`**

`CheckoutOrderSummary.tsx`: проп `canSubmit: boolean` (в інтерфейс `:10-17` і
деструктуризацію), кнопка `disabled={isSubmitting || !canSubmit}` (`:117`).

`Checkout.tsx`: `const [hasShippingMethods, setHasShippingMethods] = useState(true);`
→ `<CheckoutDeliveryForm … onAvailabilityChange={setHasShippingMethods} />`,
`<CheckoutOrderSummary … canSubmit={hasShippingMethods} />`. Під
`<CheckoutDeliveryForm …/>` — видима помилка поля, якого форма не рендерить:

```tsx
              <FormField
                control={form.control}
                name="shippingMethodId"
                render={() => (
                  <FormItem>
                    {/* Поля-радіо живуть у CheckoutDeliveryForm; повідомлення
                        `validation.shippingRequired` до К2-Е0 не мало де
                        зʼявитись — тому лише FormMessage. */}
                    <FormMessage />
                  </FormItem>
                )}
              />
```

(`FormField`, `FormItem`, `FormMessage` — з `simplycms/ui/form`, як у
`storefront-routes/components/SetPasswordForm.tsx:7-14`. 🔴 Імпорт `Form` із
цього ж модуля в `Checkout.tsx` уже є — `:8`; три імені дописуються В НЬОГО,
а не другим рядком імпорту з того самого специфікатора.)

🔴 Усі шість імпортів форм чекауту в `Checkout.tsx` (`:15-20`:
`CheckoutAuthBlock`, `CheckoutContactForm`, `CheckoutDeliveryForm`,
`CheckoutPaymentForm`, `CheckoutOrderSummary`, `CheckoutRecipientForm`)
сьогодні йдуть через re-export-шими `simplycms/core/components/checkout/*`,
які канон (`architecture-core`, NEVER) забороняє. Перевести всі шість на
`simplycms/checkout-ui` — джерело (лише шлях імпорту, поведінка та сама);
самі файли-шими не видаляти — їх знімає розселення `core`, поза К2-Е0.

Run: `pnpm vitest run packages/simplycms/src/checkout-ui packages/simplycms/src/storefront-routes && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Гейти й коміт**

🔴 `pnpm install --frozen-lockfile` іде ПЕРШИМ саме тут: крок 3 додав
devDependency, і без перегенерованого `pnpm-lock.yaml` цей гейт червоніє
локально рівно так само, як CI (див. крок 3).

```bash
pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm test
git add -A eslint.config.mjs package.json pnpm-lock.yaml \
  packages/simplycms/src/checkout-ui packages/simplycms/src/profile-ui \
  packages/simplycms/src/catalog-ui packages/simplycms/src/reviews-ui \
  packages/simplycms/src/storefront-routes/pages/Checkout.tsx \
  packages/simplycms/src/i18n/catalogs
git commit -m "feat(k2-e0): чекаут — empty-state без доставки, видима помилка, заблокований submit, автовибір точки; доступні імена всієї воронки під ESLint-гейтом

Порожній довідник показує блокуючий стан (патерн CartView), submit вимкнено,
validation.shippingRequired рендериться через FormMessage; єдина точка
видачі обирається тим самим правилом, що й метод. 41 лейбл пʼяти тек воронки
отримав htmlFor (або перестав бути лейблом там, де підписує не контрол), а
регрес стереже jsx-a11y/label-has-associated-control у режимі htmlFor —
дефолтний either на цьому коді пропускає 36 із 41 (Е0-4)."
```

- [ ] **DoD Task 11:** `pnpm vitest run packages/simplycms/src/checkout-ui`
зелений (два нові тест-файли плюс спільний асерт `accessible-controls.ts`);
`pnpm typecheck` зелений; `pnpm lint` — 0 errors / 12 warnings із
УВІМКНЕНОЮ зоною `A11Y_LABEL_ZONE`; негативний контроль кроку 5 показав
FAIL→PASS; `pnpm install --frozen-lockfile` проходить (lockfile у коміті);
жоден новий кириличний літерал не зʼявився (i18n-error-зона покриває всі пʼять
тек воронки).

🔴 Борг, який ця задача НЕ закриває і свідомо лишає: ДЕСЯТЬ із торкнутих
файлів уже за каноном «файл ≤ 150 рядків», і кроки 2/4/5/6 їх ще подовжують —
`profile-ui/RecipientsList.tsx` (448), `checkout-ui/CheckoutRecipientForm.tsx`
(427), `CheckoutDeliveryForm.tsx` (399), `catalog-ui/FilterSidebar.tsx` (390),
`profile-ui/AddressesList.tsx` (358), `storefront-routes/pages/Checkout.tsx`
(353), `CheckoutAuthBlock.tsx` (339), `RecipientSelectorPopup.tsx` (187),
`AddressSelectorPopup.tsx` (177), `catalog-ui/ModificationSelector.tsx` (171).
Розділення — окрема робота поза К2-Е0; тут воно змішало б функціональну правку
з рефакторингом і зробило б рев'ю нечитним.

---

### Task 12: Кошик — `useSyncExternalStore` замість читання `localStorage` у рендері (Е0-5)

**Files:**
- Modify: `packages/simplycms/src/react-query/useCart.tsx:46-80, 137-139`, `checkout-ui/CheckoutOrderSummary.tsx:11` (`items: readonly CartItem[]`)
- Create: `packages/simplycms/src/react-query/__tests__/cart-hydration.test.tsx`
- Modify: `.github/instructions/optimization.instructions.md:54`

**Interfaces:**
- Produces: публічний API `useCart()` без змін (`items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, isOpen, setIsOpen`).
- Consumes: нічого нового.

- [ ] **Step 1: Гідраційний негативний контроль — спершу червоний**

`packages/simplycms/src/react-query/__tests__/cart-hydration.test.tsx`:

```tsx
// Гідраційний паритет кошика (К2-Е0, Е0-5). Сервер кошика не знає (він у
// localStorage), клієнт — знає з першого рендеру: до фіксу бейдж зʼявлявся
// в рендері гідратації як зайвий вузол → React #418 на кожній SSR-сторінці.
//
// 🔴 Дефолтне середовище vitest — node (без window): серверний прохід
// робиться в ньому, а DOM для клієнтського проходу ставиться вручну ПІСЛЯ
// (техніка `exposeDom` з packages/cli/src/theme-conformance-dom.mjs).
import { describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';

const STORED = JSON.stringify([
  { productId: 'p1', modificationId: null, name: 'A', price: 100, quantity: 2 },
]);

function exposeDom(window: JSDOM['window']): void {
  for (const key of Object.getOwnPropertyNames(window)) {
    if (key in globalThis) continue;
    Object.defineProperty(globalThis, key, { configurable: true, get: () => window[key as keyof typeof window] });
  }
  for (const [key, value] of Object.entries({
    window, self: window, document: window.document, navigator: window.navigator,
    localStorage: window.localStorage,
  })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
}

describe('кошик: SSR-розмітка гідрується без розбіжностей при непорожньому localStorage', () => {
  it('нуль recoverable errors, бейдж зʼявляється ПІСЛЯ гідратації', async () => {
    const { CartProvider, useCart } = await import('../useCart');
    function Badge() {
      const { totalItems } = useCart();
      return totalItems > 0 ? <span data-badge="">{totalItems}</span> : null;
    }
    const tree = (
      <CartProvider>
        <div id="root"><Badge /></div>
      </CartProvider>
    );

    // 1. Сервер: window немає, кошик порожній.
    const html = renderToString(tree);
    expect(html).not.toContain('data-badge');

    // 2. Клієнт: DOM + непорожній localStorage до першого рендеру.
    const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, { url: 'http://localhost/' });
    exposeDom(dom.window);
    window.localStorage.setItem('simplycms-cart', STORED);
    const { hydrateRoot } = await import('react-dom/client');
    const recoverable: unknown[] = [];
    const container = document.body;
    await act(async () => {
      hydrateRoot(container, tree, { onRecoverableError: (e) => recoverable.push(e) });
    });

    expect(recoverable, `React повідомив про розбіжність: ${recoverable.map(String).join('\n')}`).toEqual([]);
    expect(container.querySelector('[data-badge]')?.textContent).toBe('2');
  });
});
```

Run: `pnpm vitest run packages/simplycms/src/react-query/__tests__/cart-hydration.test.tsx`
Expected: FAIL — `recoverable` містить помилку гідратації (React #418 /
«Hydration failed…»).

- [ ] **Step 2: Стор замість `useState` + ефектів**

У `useCart.tsx` замінити блок від `const CART_STORAGE_KEY` до кінця ефекту
збереження (рядки ~44–80) на:

```ts
const CART_STORAGE_KEY = 'simplycms-cart';
const EMPTY: readonly CartItem[] = [];

/**
 * Зовнішній стор кошика (К2-Е0, Е0-5) — за патерном `plugins/HookRegistry`.
 *
 * 🔴 Чому не `useState` з lazy-ініціалізатором: він читав localStorage у
 * ПЕРШОМУ клієнтському рендері, тобто в рендері гідратації; сервер віддавав
 * порожній кошик, клієнт — повний, і бейдж у шапці ставав зайвим DOM-вузлом
 * (React #418 на кожній SSR-сторінці з товаром у кошику).
 * `useSyncExternalStore` дає React серверний снапшот (порожньо) на гідратацію
 * і клієнтський — одразу після; бейдж зʼявляється без розбіжності.
 *
 * Снапшот кешується: `getSnapshot` мусить віддавати ту саму референцію, доки
 * стор не змінився — `JSON.parse` на кожен виклик дав би нескінченний рендер.
 * Перечитування localStorage — при переході 0→1 підписників (тести й
 * перемонтування) і на `storage`-подію (інша вкладка).
 */
let snapshot: readonly CartItem[] = EMPTY;
const listeners = new Set<() => void>();

const read = (): readonly CartItem[] => {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed as CartItem[];
    }
  } catch (e) {
    console.error('Failed to load cart from localStorage:', e);
  }
  return EMPTY;
};

const onStorage = (event: StorageEvent): void => {
  if (event.key !== null && event.key !== CART_STORAGE_KEY) return;
  snapshot = read();
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void): (() => void) => {
  if (listeners.size === 0) {
    snapshot = read();
    window.addEventListener('storage', onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
};
const getSnapshot = (): readonly CartItem[] => snapshot;
const getServerSnapshot = (): readonly CartItem[] => EMPTY;

const write = (next: readonly CartItem[]): void => {
  snapshot = next;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.error('Failed to save cart to localStorage:', e);
  }
  listeners.forEach((l) => l());
};

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isOpen, setIsOpen] = useState(false);
  const setItems = (update: (prev: readonly CartItem[]) => readonly CartItem[]) =>
    write(update(snapshot));
```

Далі `addItem`/`removeItem`/`updateQuantity` без змін (вони кличуть
`setItems(prev => …)` — тепер це `write`). 🔴 `clearCart` сьогодні кличе
`setItems([])` ЗНАЧЕННЯМ (`useCart.tsx:137-139`), а новий `setItems` приймає
лише функцію — інакше `TypeError: update is not a function` на кнопці
«Очистити кошик» (`CartSlots.tsx:42-49`) і в `cart-slots.test.tsx`; тому
`const clearCart = useCallback(() => setItems(() => EMPTY), []);`. `items` у контексті —
тип `readonly CartItem[]` (референція снапшоту стабільна між рендерами;
`[...items]` на кожен рендер ламала б deps ефектів у споживачів — напр.
редирект з порожнього кошика в `Checkout.tsx`); `pnpm typecheck` покаже
сигнатури з мутабельним `CartItem[]` — єдиний відомий споживач
`checkout-ui/CheckoutOrderSummary.tsx:11` → `items: readonly CartItem[]`. Імпорт
`useSyncExternalStore` з `react`; прибрати `useEffect`, `useRef` з імпорту,
якщо більше не використовуються.

Run: `pnpm vitest run packages/simplycms/src/react-query packages/simplycms/src/storefront-routes/__tests__/cart-slots.test.tsx packages/simplycms/src/storefront-routes/__tests__/product-slots.test.tsx`
Expected: PASS (гідраційний тест зелений; тести слотів, що сідять
localStorage між рендерами і роблять `cleanup()` в `afterEach`, — зелені
завдяки перечитуванню на 0→1).

- [ ] **Step 3: Інструкція — рецепт гідратації**

`.github/instructions/optimization.instructions.md:54`:
`- \`suppressHydrationWarning\` для елементів з різним SSR/client рендером (dark mode, cart count).`
→

```markdown
- Стан, якого сервер не знає (localStorage: кошик), читати через
  `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` з порожнім
  серверним снапшотом (зразок — `react-query/useCart.tsx`, `plugins/HookRegistry.ts`).
  🔴 `suppressHydrationWarning` лишається для елемента, чиї АТРИБУТИ законно
  різняться між SSR і клієнтом (dark mode: `attribute="class"` на `<html>` у
  `src/routes/__root.tsx`), але не рятує умовно ПРИСУТНІЙ вузол (бейдж
  лічильника): він гасить розбіжність атрибутів/тексту одного елемента, а
  зайвий вузол дає React #418 попри нього. Гейт —
  `react-query/__tests__/cart-hydration.test.tsx`.
```

- [ ] **Step 4: Гейти й коміт**

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
git add packages/simplycms/src/react-query/useCart.tsx packages/simplycms/src/react-query/__tests__/cart-hydration.test.tsx packages/simplycms/src/checkout-ui/CheckoutOrderSummary.tsx .github/instructions/optimization.instructions.md
git commit -m "fix(k2-e0): кошик на useSyncExternalStore — гідратація без React #418

Серверний снапшот порожній, клієнтський — після гідратації; перечитування
localStorage на 0→1 підписників і storage-подію. Негативний контроль:
renderToString → jsdom → hydrateRoot без recoverable errors. Рецепт в
optimization.instructions виправлено (Е0-5)."
```

---
### Task 13: Env-контракт як тест; тексти про `BETTER_AUTH_URL` (Е0-7)

**Files:**
- Create: `tests/env-contract.test.ts`
- Modify: `.env.example:37-40`, `CLAUDE.md` («Environment Variables»)

**Interfaces:** нічого; `auth/env.ts:47` НЕ змінюється (fallback на
`VITE_SITE_URL` спростовано — Додаток Б спеки).

- [ ] **Step 1: Тест-пін — спершу переконатись, що він зелений на чинних файлах**

`tests/env-contract.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Пін контракту env магазину (К2-Е0, Е0-7): три документи (.env.example,
 * doctor, CLAUDE.md) уже розходились — карта стану показувала чотири ключі.
 * Машинно перевіряються два з них; CLAUDE.md — прозою, з посиланням сюди.
 */
const ROOT = resolve(import.meta.dirname, '..');
const CONTRACT = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'VITE_SITE_URL'] as const;
const SERVER_ONLY = ['DATABASE_URL', 'BETTER_AUTH_SECRET'] as const;

describe('контракт env магазину', () => {
  it('.env.example: активні ключі — рівно контракт', () => {
    const active = readFileSync(resolve(ROOT, '.env.example'), 'utf8')
      .split('\n')
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => line.split('=')[0]);
    expect(active.sort()).toEqual([...CONTRACT].sort());
  });

  it('doctor вимагає рівно серверну підмножину контракту', () => {
    const src = readFileSync(resolve(ROOT, 'packages/cli/src/doctor-checks.mjs'), 'utf8');
    const m = /const REQUIRED_ENV_VARS = \[([^\]]*)\]/.exec(src);
    expect(m, 'REQUIRED_ENV_VARS не знайдено').not.toBeNull();
    const required = m![1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
    expect(required.sort()).toEqual([...SERVER_ONLY].sort());
  });

  it('BETTER_AUTH_URL — опційний і задокументований як такий', () => {
    const example = readFileSync(resolve(ROOT, '.env.example'), 'utf8');
    expect(example).toMatch(/^# BETTER_AUTH_URL=/m);
    expect(example).toMatch(/INVALID_ORIGIN/);
  });
});
```

Run: `pnpm vitest run tests/env-contract.test.ts`
Expected: третій кейс FAIL (у `.env.example` немає слова `INVALID_ORIGIN`), перші два — PASS.

- [ ] **Step 2: Тексти**

`.env.example` рядки 37–40 →

```
# Public base URL of the app — used for OAuth callbacks and links in emails.
# Optional in dev: without it Better Auth derives the base from the request
# (the startup WARN "Base URL is not set" is expected). Recommended in prod:
# with a string baseURL Better Auth trusts EXACTLY that origin and rejects
# others with 403 INVALID_ORIGIN — set it to the origin browsers really use.
# BETTER_AUTH_URL=https://your-domain.com
```

`CLAUDE.md`, «Environment Variables», пункт `BETTER_AUTH_SECRET`: після
«Опційний сусід — `BETTER_AUTH_URL` (без нього базовий URL береться із самого
запиту)» додати: «— у dev це очікуваний WARN Better Auth; у проді
`BETTER_AUTH_URL` рекомендований: з рядковим baseURL Better Auth довіряє рівно
цьому origin і відкидає інші з 403 `INVALID_ORIGIN`. Контракт стереже
`tests/env-contract.test.ts`».

Run: `pnpm vitest run tests/env-contract.test.ts`
Expected: PASS.

- [ ] **Step 3: Коміт**

```bash
pnpm format:check && pnpm lint && pnpm test
git add tests/env-contract.test.ts .env.example CLAUDE.md
git commit -m "test(k2-e0): пін контракту env (.env.example ↔ doctor); BETTER_AUTH_URL — опційний у dev, рекомендований у проді

Fallback baseURL на VITE_SITE_URL відкинуто (Better Auth довіряє рівно цьому
origin — дев на іншому порту отримав би 403). Три ключі — машинно (Е0-7)."
```

---

### Task 14: `scripts/live-smoke.mjs` — DoD як скрипт (Е0-8) + фінальна синхронізація

**Files:**
- Create: `scripts/live-smoke.mjs` (оркестрація), `scripts/live-smoke/sql.mjs` (прямий SQL), `scripts/live-smoke/funnel.mjs` (браузерна воронка)
- Modify: `scripts/pilot-pack/build.mjs:74-80` (`startStore(storeDir, port, extraEnv = {})`)
- Modify: `package.json` (скрипт `live:smoke`)
- Modify: `CLAUDE.md` (Quick Reference: `live:smoke`, `db:demo` — покупний демо; «Database Commands»: те саме про `db:demo`; «Project Structure», тека `scripts/`; «Tech Stack»: поріг Node; лінт-зони: шоста зона a11y), `docs/architecture/test-contours.md` §12 (рядок «живий прогін = `pnpm live:smoke`»), `docs/tasks/v2-state-map.md` §1, §2, §3.4, §5, §6, `docs/tasks/platform-roadmap.md` (лише позначки завершення: К2-Е0 → ✅; борги T; борг 0.4.1-4; рядок таблиці «Магазин на чистому Postgres» — опис ред. 1.3 у роадмапі вже стоїть)

**Interfaces:**
- Consumes: `gateHttp` з `scripts/pilot-pack/gate-b.mjs` (усередині читає товари через `expectedProducts`); `startStore`, `freePort` з `scripts/pilot-pack/build.mjs`; `withDbName` з `packages/simplycms/test-harness/pg/apply.mjs`; `@playwright/test` (devDependency `1.61.1`, вже в дереві); `id`-и контролів чекауту з Task 11; `id`-и форми реєстрації з `Auth.tsx` (`#firstName`, `#lastName`, `#register-email`, `#register-password`, `#confirmPassword` — уже є); поведінка `cancelMyOrder` з Task 9 (скасування і `releaseStock` — в ОДНІЙ транзакції); 🔴 форма демо-сіду з Task 7: **рівно одна** активна точка видачі, і вона ж помічена `is_system = true` — на ній тримаються і автовибір точки з Task 11, і асерт форми демо нижче.
- Produces: команда `PG_HARNESS_URL=… pnpm live:smoke` з нульовим кодом виходу на зеленому прогоні; `runFunnel({ page, base, dbUrl, check })`; `sql`, `stockSnapshot`, `ordersCount`, `orderStatusCode`, `activePickupPoints`.

🔴 Ред. 1.2: скрипт НЕ підміняє `.env.local` розробника — після M9 (r1) env
уже передається явно і в `pnpm build`, і в `startStore`, а `loadEnv`
(`vite.config.ts`) і `server.mjs` беруть файл лише для ВІДСУТНІХ ключів,
тож `process.env` виграє за побудовою; підміна файлу з бекапом у `finally`
лишалась єдиним місцем, де SIGINT міг знищити чужий env. Точка видачі —
`<select>`, не radio; після Task 11 єдина точка обирається сама, і smoke це
ДОВОДИТЬ, читаючи значення `#checkout-pickup-point`. Асерт `pageerror` — у
кінці, після всіх сторінок: `order-success` і сторінки кабінету форматують
`Date` через `Intl` (Task 6 робить `formatDate(date: Date)` в усіх чотирьох —
`OrderSuccess`, `ProfileOrders`, `ProfileOrderDetail`, `Profile`), тож рядок
замість `Date` через serverFn дав би тут `RangeError` (єдиний поведінковий
гейт контракту дат на межі RPC).

🔴 **Ред. 1.3 — скрипт доводить і ПОВЕРНЕННЯ залишку (Р1), а це тягне
реєстрацію покупця.** Скасування живе за сесією за побудовою: `cancelMyOrder`
(`storefront-routes/server/profile-orders.ts:60`) бере власника з
`withSessionDb`, тобто з cookie Better Auth, і гість своє замовлення
скасувати не може взагалі — `placeOrder` кладе гостю `user_id = null` і видає
`access_token` (`server/checkout.ts:38-44`), а сторінки кабінету лежать під
`_protected`. Тому воронка живого прогону починається з реєстрації через ту
саму форму, що й у покупця (`/auth`, вкладка «Реєстрація»): вона ж провізіює
профіль (`auth/provision.ts:15`), а отже додатково доводить, що чекаут
префілюється профілем. Обхід «покликати serverFn повз UI» відкинуто: він
перевіряв би не той контур, у якому дефект.

🔴 **Межа доказу, названа чесно.** Демо-сід (Task 7) везе залишок **5** на
панель, а прогін купує одну штуку, тож `stock_status` тут не фліпається — і
рівність «після скасування = до замовлення» по статусу тривіальна.
Ескалацію статусу в обидва боки (`in_stock` → `out_of_stock` → `in_stock`)
доводить харнес-тест Task 9
(`packages/simplycms/test-harness/pg/__tests__/order-stock.test.ts`), а
live-smoke доводить те, чого харнес не бачить: що ту саму арифметику робить
РЕАЛЬНИЙ контур — браузер, serverFn, транзакція покупця з ескалацією.
Купувати весь залишок кліками «Додати в кошик» свідомо не робимо: `addItem`
відкриває дровер (`react-query/useCart.tsx:102`), і цикл кліків залежав би
від оверлею, а не від правила наявності.

- [ ] **Step 0: `startStore` приймає явний env**

У `scripts/pilot-pack/build.mjs` сигнатура `startStore(storeDir, port)` →
`startStore(storeDir, port, extraEnv = {})`, а `env: { ...process.env, PORT:
String(port), HOST: '127.0.0.1' }` → `env: { ...process.env, ...extraEnv, PORT:
String(port), HOST: '127.0.0.1' }`. 🔴 Причина (M9 аудиту r1): `server.mjs`
наповнює `process.env` із `.env.local` лише для ВІДСУТНІХ ключів, тож
`DATABASE_URL` із shell чи CI перекрив би тестову БД, а прямий SQL скрипта
дивився б в іншу базу. Пілот викликає без третього аргумента — без змін.

- [ ] **Step 1: Три файли замість одного — і чому саме так**

🔴 Канон `coding-style` — до 150 рядків на файл. У ред. 1.2 скрипт був один
(≈145 рядків) і вже впирався в межу; крок доказу Р1 (реєстрація + скасування
+ знімки залишку до/після) додає ≈35 рядків, тобто одним файлом канон
порушується. Розкладка — та сама, що в `scripts/pilot-pack/*` (там 25 модулів
рівно з цієї причини), і межа різання не довільна: **оркестрація** (БД,
збірка, сервер, таблиця виводу) / **прямий SQL** (єдине джерело «що насправді
в базі») / **браузерна воронка** (єдиний споживач Playwright). Обсяг:
`sql.mjs` — 78 рядків, `funnel.mjs` — 141, `live-smoke.mjs` — 105; кожен
читається окремо. 🔴 `funnel.mjs` найближчий до межі: якщо при реалізації він
переросте 150, першою виїжджає `register` (`scripts/live-smoke/register.mjs`)
— вона самодостатня й ні від чого в воронці не залежить.

`scripts/live-smoke/sql.mjs`:

```js
/**
 * Прямий SQL живого прогону — єдине джерело «що насправді в базі».
 *
 * Окремим модулем (канон 150 рядків, розкладка як у `scripts/pilot-pack/*`):
 * оркестрація і браузерна воронка звертаються сюди, а не пишуть запити самі.
 * Підключення — адмінське (`PG_HARNESS_URL`, той самий доступ, що й у
 * `pnpm db:demo`), тому преамбула `set local role` тут не потрібна: власник
 * кластера RLS не підпадає (`force row level security` канон не вмикає).
 */
import pg from 'pg';

/** Один запит окремим зʼєднанням: прогін короткий, пул тут зайвий. */
export async function sql(url, text, values = []) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query(text, values)).rows;
  } finally {
    await client.end();
  }
}

/**
 * Знімок наявності товару: статус + залишок ПО КОЖНІЙ точці видачі.
 *
 * 🔴 Мапа по точках, а не сума: списання й повернення йдуть в ОДНУ
 * детерміновану точку (Е0-3: `orders.pickup_point_id` → системна → перша
 * активна), і «повернулось як було» — це рівність саме мап, а не сум.
 */
export async function stockSnapshot(url, slug) {
  const [product] = await sql(
    url,
    `select p.id, p.stock_status, s.slug as section
       from public.products p
       join public.sections s on s.id = p.section_id
      where p.slug = $1`,
    [slug],
  );
  if (!product) throw new Error(`[live-smoke] у демо-БД немає товару «${slug}»`);
  const rows = await sql(
    url,
    `select pickup_point_id, quantity from public.stock_by_pickup_point
      where product_id = $1 order by pickup_point_id`,
    [product.id],
  );
  const byPoint = Object.fromEntries(
    rows.map((r) => [r.pickup_point_id, Number(r.quantity)]),
  );
  const total = Object.values(byPoint).reduce((sum, q) => sum + q, 0);
  return { section: product.section, status: product.stock_status, byPoint, total };
}

/** Скільки рядків у `orders` — до і після оформлення. */
export async function ordersCount(url) {
  const [{ c }] = await sql(url, 'select count(*)::int as c from public.orders');
  return c;
}

/** Код статусу замовлення — доказ, що скасування доїхало до БД. */
export async function orderStatusCode(url, orderId) {
  const [row] = await sql(
    url,
    `select st.code from public.orders o
       join public.order_statuses st on st.id = o.status_id
      where o.id = $1`,
    [orderId],
  );
  return row?.code ?? null;
}

/** Активні точки видачі демо — форма, від якої залежать автовибір і Е0-3. */
export async function activePickupPoints(url) {
  return sql(
    url,
    `select id, is_system from public.pickup_points
      where is_active order by sort_order, id`,
  );
}
```

`scripts/live-smoke/funnel.mjs`:

```js
/**
 * Браузерна воронка живого прогону: реєстрація → картка → кошик → чекаут →
 * СКАСУВАННЯ. Єдиний споживач Playwright; оркестрація його не імпортує.
 *
 * 🔴 Реєстрація — не декор: скасування замовлення живе за сесією
 * (`cancelMyOrder` → `withSessionDb`), а гість зі своїм `access_token`
 * кабінету не має. Заодно доводиться префіл чекауту з профілю.
 */
import { randomUUID } from 'node:crypto';
import {
  activePickupPoints,
  ordersCount,
  orderStatusCode,
  stockSnapshot,
} from './sql.mjs';

const PRODUCT_SLUG = 'sonyachna-panel-450w-mono';
const PASSWORD = 'live-smoke-2026';
/** id контролів чекауту — `id`/`htmlFor` з Task 11 (checkout-ui). */
const FIELD = {
  firstName: '#checkout-first-name',
  phone: '#checkout-phone',
  pickupPoint: '#checkout-pickup-point',
};

/** Реєстрація тією самою формою, що й у покупця (вкладка «Реєстрація»). */
async function register(page, base) {
  const email = `live-smoke-${randomUUID().slice(0, 8)}@example.test`;
  await page.goto(`${base}/auth`, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Реєстрація' }).click();
  await page.locator('#firstName').fill('Тест');
  await page.locator('#lastName').fill('Покупець');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-password').fill(PASSWORD);
  await page.locator('#confirmPassword').fill(PASSWORD);
  await page.getByRole('button', { name: /Зареєструватися/ }).click();
  // Успішна реєстрація логінить і веде на головну (`Auth.tsx`).
  await page.waitForURL(`${base}/`, { timeout: 15_000 });
  return email;
}

/**
 * Уся воронка одним викликом: `page` — сторінка Playwright, `base` — URL
 * піднятого магазину, `dbUrl` — та сама БД прямим SQL, `check` — збирач
 * фактів оркестрації (вердикт + ФАКТ, як у гейтах пілота).
 */
export async function runFunnel({ page, base, dbUrl, check }) {
  await register(page, base);
  const before = await stockSnapshot(dbUrl, PRODUCT_SLUG);

  // 1. Картка: бейдж і JSON-LD проти БД (те, чого curl не бачить).
  await page.goto(`${base}/catalog/${before.section}/${PRODUCT_SLUG}`, {
    waitUntil: 'networkidle',
  });
  const badge =
    (await page
      .locator('text=/В наявності|Немає в наявності|Під замовлення/')
      .first()
      .textContent()) ?? '';
  check(
    'бейдж = БД',
    before.status === 'in_stock'
      ? badge.includes('В наявності') && !badge.includes('Немає')
      : true,
    `stock_status=${before.status}, залишок ${before.total}, бейдж «${badge.trim()}»`,
  );
  const jsonLd = await page
    .locator('script[type="application/ld+json"]')
    .first()
    .textContent();
  check(
    'JSON-LD availability',
    (jsonLd ?? '').includes('schema.org/InStock'),
    (jsonLd ?? '').match(/schema\.org\/\w+/)?.[0] ?? '—',
  );

  // 2. Кошик і сторінки з НЕПОРОЖНІМ кошиком (гідратація — Е0-5).
  await page.getByRole('button', { name: /Додати в кошик/ }).first().click();
  for (const path of ['/', '/catalog', '/cart']) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  }

  // 3. Чекаут → рядок в `orders` зі списанням.
  const ordersBefore = await ordersCount(dbUrl);
  await page.goto(`${base}/checkout`, { waitUntil: 'networkidle' });
  // 🔴 Спершу дочекатись префілу з профілю: `getProfileSettings` заповнює
  // форму в `useEffect`, тож `fill` до нього був би затертий після нього.
  // 🔴 Саме `?? ''`: доки поля ще немає в DOM, `?.value` — `undefined`, і
  // предикат `?.value !== ''` пройшов би ЩЕ ДО рендеру форми — чекання
  // виродилось би в no-op рівно в тому випадку, заради якого існує.
  await page.waitForFunction(
    (sel) => (document.querySelector(sel)?.value ?? '') !== '',
    FIELD.firstName,
  );
  check(
    'чекаут префілено профілем покупця',
    (await page.locator(FIELD.firstName).inputValue()) === 'Тест',
    await page.locator(FIELD.firstName).inputValue(),
  );
  await page.locator(FIELD.phone).fill('+380501234567');
  // Демо-метод — pickup з однією точкою: метод і точку форма обирає сама
  // (Task 11); smoke це доводить, а не клікає замість покупця.
  const points = await activePickupPoints(dbUrl);
  check(
    'демо: одна активна точка видачі, вона ж системна',
    points.length === 1 && points[0].is_system === true,
    `точок ${points.length}, is_system ${points.map((p) => p.is_system).join(',')}`,
  );
  const pickedPoint = await page.locator(FIELD.pickupPoint).inputValue();
  check('єдина точка видачі обрана автоматично', pickedPoint !== '', pickedPoint || 'порожньо');
  await page.getByRole('button', { name: /Підтвердити замовлення/ }).click();
  await page.waitForURL(/\/order-success\//, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  const orderId = /\/order-success\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? '';
  const ordersAfter = await ordersCount(dbUrl);
  const placed = await stockSnapshot(dbUrl, PRODUCT_SLUG);
  check('orders +1', ordersAfter === ordersBefore + 1, `${ordersBefore} → ${ordersAfter}`);
  // Демо вмикає decrease_on_order (Task 7): списання — безумовне очікування.
  check(
    'списання залишку',
    placed.total === before.total - 1,
    `${before.total} → ${placed.total}, точка ${pickedPoint}`,
  );

  // 4. Скасування в кабінеті → ПОВЕРНЕННЯ залишку (Р1, Task 9).
  await page.goto(`${base}/profile/orders/${orderId}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Скасувати', exact: true }).click();
  await page.getByRole('button', { name: /Так, скасувати/ }).click();
  await page.waitForURL(/\/profile\/orders$/, { timeout: 15_000 });
  const released = await stockSnapshot(dbUrl, PRODUCT_SLUG);
  const statusCode = await orderStatusCode(dbUrl, orderId);
  check('замовлення скасовано', statusCode === 'cancelled', `status → ${statusCode}`);
  // 🔴 Рівність ЗНІМКІВ, а не сум: повертається та сама точка, і статус теж
  // мусить відкотитись (асиметрія «списали й не повернули» — саме той стан,
  // через який демо показував нуль залишку при нулі продажів).
  check(
    'повернення залишку і статусу',
    JSON.stringify(released) === JSON.stringify(before),
    `${placed.total} → ${released.total}, stock_status ${placed.status} → ${released.status}`,
  );
}
```

`scripts/live-smoke.mjs`:

```js
#!/usr/bin/env node
/**
 * Живий прогін вітрини — DoD К2-Е0 як скрипт, не як таблиця (Е0-8).
 *
 * Що доводить і чим: (1) curl+SQL — той самий `gateHttp` пілота (SSR, sitemap,
 * robots, health, guard); (2) браузер — те, чого curl не бачить: реєстрація
 * покупця, бейдж наявності після гідратації, JSON-LD, автовибір єдиної точки
 * видачі, сама воронка картка → кошик → чекаут → рядок в `orders` ЗІ
 * СПИСАННЯМ, скасування в кабінеті З ПОВЕРНЕННЯМ залишку і статусу, і нуль
 * `pageerror` на всіх сторінках включно з `order-success` і кабінетом (усі
 * форматують `Date` через `Intl`). Друкує таблицю — §12 test-contours.md
 * посилається сюди замість рукопису.
 *
 * Потребує: Postgres (`PG_HARNESS_URL`, адмін-доступ до кластера — як
 * `pnpm db:demo`) і Chromium для Playwright (`pnpm exec playwright install
 * chromium` — on-demand, як jsdom для theme:conformance). Не CI — місце в
 * гейтах релізу (окреме рішення) і в К6 як Gate B на Postgres.
 *
 * 🔴 `.env.local` не чіпається: env збірки й сервера — явний параметр, а
 * `loadEnv`/`server.mjs` беруть файл лише для відсутніх ключів.
 *
 *   PG_HARNESS_URL=postgresql://user@127.0.0.1:5432/postgres pnpm live:smoke
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { startStore, freePort } from './pilot-pack/build.mjs';
import { gateHttp } from './pilot-pack/gate-b.mjs';
import { runFunnel } from './live-smoke/funnel.mjs';
import { withDbName } from '../packages/simplycms/test-harness/pg/apply.mjs';

const ROOT = join(import.meta.dirname, '..');
const DB_NAME = 'simplycms_live_smoke';

const adminUrl = process.env.PG_HARNESS_URL;
if (!adminUrl) throw new Error('[live-smoke] потрібен PG_HARNESS_URL (адмін-доступ до кластера, як для pnpm db:demo)');

const rows = [];
const check = (label, passed, fact) => { rows.push([label, passed ? 'OK' : 'FAIL', fact]); };

async function main() {
  // 1. Чиста демо-БД (той самий скрипт, що й у доках; існуючу дропає сам).
  execFileSync('node', ['scripts/demo-db.mjs', '--url', adminUrl, '--name', DB_NAME], { cwd: ROOT, stdio: 'inherit' });
  const dbUrl = withDbName(adminUrl, DB_NAME);
  const port = await freePort();
  // 🔴 Явний env для збірки й сервера: shell/CI можуть нести власні
  // DATABASE_URL/BETTER_AUTH_URL, а server.mjs і loadEnv беруть .env.local
  // лише для відсутніх ключів (M9 аудиту r1) — process.env виграє.
  const env = {
    DATABASE_URL: dbUrl,
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
    VITE_SITE_URL: `http://127.0.0.1:${port}`,
  };

  let server;
  let browser;
  const shutdown = async () => {
    // 🔴 Один шлях прибирання для finally і для сигналів: падіння чи Ctrl+C
    // не лишають ні Chromium, ні server.mjs.
    await browser?.close().catch(() => {});
    server?.stop();
  };
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => { void shutdown().then(() => process.exit(130)); });
  }

  try {
    execFileSync('pnpm', ['build'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
    server = await startStore(ROOT, port, env);
    const base = `http://127.0.0.1:${port}`;

    // 2. curl+SQL — гейт B пілота як є.
    const http = await gateHttp(port, { DATABASE_URL: dbUrl });
    for (const line of http.details) check('http', line.startsWith('OK'), line);

    // sitemap: кожен lastmod — W3C.
    const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
    const lastmods = [...sitemap.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map((m) => m[1]);
    check('sitemap lastmod W3C', lastmods.length > 0 && lastmods.every((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v)), `${lastmods.length} url, зразок ${lastmods[0] ?? '—'}`);

    // 3. Браузер: реєстрація → картка → кошик → чекаут → скасування.
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await runFunnel({ page, base, dbUrl, check });

    // 4. Нуль pageerror — у КІНЦІ, коли пройдено всі сторінки: `order-success`
    // і кабінет форматують `Date` через `Intl`, тож рядок замість `Date` на
    // межі RPC дав би тут `RangeError` (поведінковий гейт Е0-2).
    check('pageerror за весь прогін (кошик, order-success, кабінет)', errors.length === 0, errors.length === 0 ? '0' : errors.join(' | '));
  } finally {
    await shutdown();
  }

  console.log('\n| Перевірка | Результат | Факт |\n|---|---|---|');
  for (const [l, r, f] of rows) console.log(`| ${l} | ${r} | ${f} |`);
  const failed = rows.filter(([, r]) => r === 'FAIL').length;
  console.log(`\n${failed === 0 ? 'live-smoke: ЗЕЛЕНИЙ' : `live-smoke: ${failed} FAIL`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(`\n[live-smoke] ${e.message}`); process.exit(1); });
```

Тексти, на які спирається воронка, — з каталогу `uk`: `product.addToCart`
«Додати в кошик», `checkout.orderSummary.submit` «Підтвердити замовлення»,
`auth.register.title` «Реєстрація» (назва вкладки), `auth.register.submit`
«Зареєструватися», `common.cancel` «Скасувати» (тригер діалогу),
`profile.order.cancel.confirm` «Так, скасувати» (підтвердження). Поле email
або телефон — обовʼязкове одне з двох: email приїжджає префілом профілю,
телефон заповнюємо (профіль його не має).

`package.json`: `"live:smoke": "node scripts/live-smoke.mjs"` — після `db:demo`
(`:35`). 🔴 `db:demo` сьогодні ОСТАННІЙ рядок блоку `scripts` і йде без коми,
тож кома дописується саме до нього, а новий рядок лишається без коми — інакше
`package.json` перестає бути валідним JSON і падає вже `pnpm install`.

- [ ] **Step 2: Прогін**

```bash
docker start simplycms-review-pg >/dev/null 2>&1 || true
pnpm exec playwright install chromium
PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55434/postgres pnpm live:smoke
git status --porcelain
```

Expected: усі рядки `OK`, `live-smoke: ЗЕЛЕНИЙ`, код виходу 0; `.env.local`
не змінено; дерево — лише навмисні зміни задачі (`dist/` — артефакт збірки,
в `.gitignore`).

- [ ] **Step 3: Документи — один дотик**

🔴 Етап К2-Е0 у ред. 1.3 — **без жодної зміни схеми БД** (рішення Р3: банери
демо їдуть inline `data:`-SVG, колонка `banners.image_url` лишається
`NOT NULL`). Тому в жодному документі, який пише цей крок, не зʼявляється ні
міграція `0004`, ні обіцянка `nullable` для банерів. 🔴 У роадмапі цю правку
вже зроблено — разом зі спекою, у цьому ж наборі змін (абзац «План ред. 1.3»,
`:258-299`; речення про `nullable` там лишилось ЛИШЕ як пояснення, чому
альтернативу відкинуто). Тобто крок роадмап не переписує, а лише датує.

- `CLAUDE.md` Quick Reference: рядок `pnpm live:smoke  # DoD К2-Е0: db:demo → build → server → curl+SQL (gate-b) + Playwright (реєстрація, кошик без #418, бейдж = БД, автовибір точки, воронка до orders зі СПИСАННЯМ, скасування з ПОВЕРНЕННЯМ залишку). Потребує Postgres (PG_HARNESS_URL) і Chromium; не CI — гейти релізу окремим рішенням`; у рядку `pnpm db:demo` (`:53`) дописати «покупний демо (доставка, системна точка видачі, залишки, `decrease_on_order = true`) з К2-Е0»; у розділі «Database Commands» (сніпет `pnpm db:pull / db:diff / test:schema`) — той самий рядок про `db:demo` як покупний демо-магазин (§5 спеки вимагає обох секцій).
- `CLAUDE.md` «Project Structure», тека `scripts/` (`:396-409`): після `demo-db.mjs` — `live-smoke.mjs + live-smoke/  # DoD К2-Е0: sql.mjs (прямий SQL) + funnel.mjs (Playwright-воронка)`. 🔴 `demo-db.mjs` (`:409`) перестає бути останнім вузлом теки: його `└──` міняється на `├──`, а `└──` переїжджає на новий рядок — інакше ASCII-дерево ламається.
- `CLAUDE.md` «Tech Stack» (список `:253-263`, після рядка **Package Manager:**): рядок **Runtime:** Node `>=22.12` — поріг `@tanstack/react-start`; стоїть у ВСІХ пʼяти публікованих пакетах і в `packages/create-simplycms-store/template/package.json.tpl`, під тестом-піном парності (Task 2, рішення Р6). До К2-Е0 порогу не було взагалі в трьох пакетах, а у двох стояв хибний `">=20"`.
- `CLAUDE.md` блок лінт-зон (після абзацу «Пʼята (2026-08-30, трек V2-К3)…», `:206-215`): **шоста** зона — доступні імена контролів. `eslint-plugin-jsx-a11y` з ОДНИМ правилом `jsx-a11y/label-has-associated-control` (error) на пʼять тек воронки пакета ядра (`cart-ui`, `catalog-ui`, `checkout-ui`, `profile-ui`, `reviews-ui`), тим самим механізмом зон, що й тір-зони та i18n-селектори (Task 11, рішення Р5). 🔴 Це нова devDependency, тож `pnpm-lock.yaml` перегенеровано в тому ж коміті — інакше `pnpm install --frozen-lockfile`, ПЕРШИЙ гейт, валить увесь CI (урок PR #20).
- `docs/architecture/test-contours.md` §12: у підрозділ «Живий прогін» першим абзацом — «Живий прогін = `pnpm live:smoke` (Е0-8): таблиця нижче — його вивід на дату, не рукопис; рядки додаються лише разом із перевіркою в скрипті» і вклеїти вивід прогону з кроку 2 з датою. У тому ж абзаці — межа: фліп `stock_status` в обидва боки доводить харнес-тест `order-stock.test.ts`, live-smoke доводить арифметику й симетрію в реальному контурі.
- `docs/tasks/v2-state-map.md`: §2 — новий підрозділ «2.2. К2-Е0 — підтверджено `pnpm live:smoke` <дата>» з тим самим виводом; §1 «Головне за 30 секунд» — речення про покупний демо-магазин (картка → кошик → чекаут → `orders`, скасування повертає залишок); §3.4 «Ціни позицій замовлення не перераховуються» → «✅ Закрито К2-Е0 <дата> (Е0-4): ціни й доставку рахує сервер, `placeOrder` повертає доменну відмову»; §5 «Як підняти це локально» — після кроку з `pnpm db:demo` рядок «перевірити весь контур одразу — `PG_HARNESS_URL=… pnpm live:smoke`»; §6 п.4 і п.6 → ✅.
- `docs/tasks/platform-roadmap.md` — **лише позначки завершення** (опис ред. 1.3, зняте речення про `nullable` і уточнений T-4 туди вже приземлилися разом зі спекою): етап К2-Е0 (`:229-299`) → `- [x] ✅ … ЗАВЕРШЕНО <дата>`; секція «Борги треку T» — T-1…T-5 (`:798-843`) → `✅ ЗАКРИТО <дата>`; борг 0.4.1-4 (`:731`) → `✅ ЗАКРИТО <дата> (К2-Е0 Е0-4)`; рядок таблиці «Магазин на чистому Postgres» (`:113`) — без «🔴 чекаут … мовчить» (замінити на «покупний демо: картка → кошик → чекаут → `orders` зі списанням, скасування повертає залишок; перевірка одним прогоном — `pnpm live:smoke`»). 🔴 Абзац «🔴 **План ред. 1.2**» (`:246-257`) НЕ чіпати: роадмап веде редакції накопиченням, і це історія аудиту r2 поруч із чинним абзацом ред. 1.3 (`:258-299`). Якорі перевірити перед правкою — вони від правки роадмапу цього ж набору змін.

- [ ] **Step 4: Повний ланцюг гейтів і коміт**

```bash
pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm build && pnpm typecheck && pnpm test && pnpm test:schema && pnpm build:packages && pnpm typecheck:template && pnpm test:packaging && pnpm pilot:pack
git add scripts/live-smoke.mjs scripts/live-smoke/ scripts/pilot-pack/build.mjs package.json CLAUDE.md docs/architecture/test-contours.md docs/tasks/v2-state-map.md docs/tasks/platform-roadmap.md
git commit -m "feat(k2-e0): live-smoke — DoD як скрипт; документи під живий прогін

curl+SQL через gate-b пілота + Playwright: реєстрація покупця, кошик без
React #418, бейдж наявності = БД, JSON-LD, автовибір єдиної точки, воронка до
рядка в orders зі списанням і скасування з поверненням залишку, нуль pageerror
включно з order-success і кабінетом (Date через serverFn). §12, карта стану й
роадмап посилаються на прогін, а не на рукопис (Е0-8)."
```

---

## Точка передачі

Після Task 14 — повернутись на валідацію з артефактами: вивід повного ланцюга
гейтів; вивід `pnpm pilot:pack` (з Gate IP); вивід `pnpm live:smoke`; `git log
--oneline main..HEAD`. Гілка НЕ мержиться без рішення власника — мерж у `main`
публікує пакети на npm. Шість рішень ред. 1.3 — Додаток Г
спеки; підтвердження власника вони НЕ потребують (ухвалені на брейнштормі
2026-09-05). Додаток В — рішення ред. 1.2, закриті тим самим брейнштормом.

Наступний план — **К3 Е2: Storage-мінімум** (роадмап, блок К3).
