# V2-К3 · Етап Е5б: редагування позицій оформленого замовлення в адмінці

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** У картці `/admin/orders/$orderId` адмін додає товар (вузький пошук за назвою або sku), змінює кількість і видаляє позицію. Ціна нової позиції — серверна, для покупця замовлення. Залишок коригується дельтою по позиції, підсумок і доставка перераховуються тими самими правилами, що й у чекауті. Доведено живим прогоном: адмін змінює склад замовлення, склад і кабінет покупця бачать узгоджені числа, а скасування після редагування повертає рівно актуально списане.

**Architecture:** Серверне ціноутворення й розрахунок доставки (`priceCheckoutItems`, лоадери цін, категорій, знижок і довідника доставки) переїжджають зі `storefront/loaders` у нову server-only теку `simplycms/commerce` (T2) — прецедент Е3-5/Е5-3 (`simplycms/inventory`). Тоді їх можуть викликати і чекаут, і `admin-server`. Дельта залишку по одній позиції — нові функції `simplycms/inventory` поверх наявних `reserveStock`/`releaseStock` та лічильника `order_items.stock_reserved` (Е5-4′). Три іменовані операції під `runAdmin('order.manage')` мають один порядок: `orders FOR UPDATE` → гвард «скасоване — кінцеве» → `order_items FOR UPDATE` → залишок → запис позиції → перерахунок `subtotal`/доставки/`total`. Колекції лишаються лише на читання, write-back робиться з відповіді операції.

**Tech Stack:** як у Е5 — TanStack Start 1.167, `@tanstack/react-db` 0.8.6, Drizzle, Zod 4, Vitest 4, PostgreSQL 17, Playwright.

**Spec:** [`docs/superpowers/specs/2026-08-29-v2-k3-admin-server-layer-design.md`](../specs/2026-08-29-v2-k3-admin-server-layer-design.md) (К3-4′, К3-13, §7 — пошук П6). Доменні правила — спека К2-Е0 [`2026-09-03-k2-e0-storefront-live-contour-design.md`](../specs/2026-09-03-k2-e0-storefront-live-contour-design.md) (Е0-3 залишки, Е0-4 серверне ціноутворення). Попередній етап, на якому стоїть Е5б: [`2026-10-04-v2-k3-e5-orders.md`](2026-10-04-v2-k3-e5-orders.md) (Е5-4′ облік по позиції, Е5-2 «Скасоване» кінцеве, Е5-7 omit, Е5-8 `order.manage`, Е5-9 `AdminConflictError` `state`).

**Передумова:** Е5 прийнято (фінальне рев'ю й хвиля правок). Гілка — та сама `claude/k3-e4-catalog-dictionaries-plan`, коміти Е5б поверх Е5 (якщо власник не змерджить Е4/Е5 раніше — тоді нова гілка від `main`).

**Обсяг:** лічильник легасі не змінюється (31): `AddProductToOrder` видалено ще в Е5; Е5б — нова функціональність на живих сторінках.

**Редакції:**
- ред.1 (2026-10-04) — рішення власника Е5б-1…Е5б-4; рішення архітектора Е5б-5…Е5б-12.
- ред.2 (2026-10-04) — аудит Codex (`gpt-6-sol`), REJECT: 1 blocker / 6 major / 2 minor, усі перевірено кодом і прийнято. Е5б-7 ПЕРЕГЛЯНУТО (Е5б-7′): `reserveOrderStock` пише `stock_point_id` навіть при фактично списаному 0 (`inventory/order-stock.ts:62`), тож «облікова = точка задана» хибне — єдина правда лічильник `stock_reserved`. Додано Е5б-13 (грошова арифметика в центах), розширено `quoteShipping` (точка видачі), повний перелік споживачів переїзду, 409 нестачі для `add`, правильна послідовність live:smoke.
- ред.3.1 (2026-10-04, виконання) — рішення архітектора Е5б-14 (Task 8 «атомарні борги Е4/Е5», директива власника) і Е5б-15 (К3-Е5-1: токен order-success захоплюється при монтуванні).
- ред.3 (2026-10-04) — друге коло Codex, REJECT: 1 blocker / 3 major / 2 minor, усі підтверджено кодом і прийнято: нова позиція ВСТАВЛЯЄТЬСЯ до списання (лічильник пишеться в наявний рядок); `JsonValue` — з `simplycms/schema/types`; доставка розщеплена на `validateShippingChoice` (ДО ціноутворення, порядок відмов чекауту незмінний) і `quoteShippingCost`; окрема межа `orders.shipping_cost numeric(10,2)` і перетворення числової ціни в центи; пошук з `\`; друга панель живого прогону названа.

## Ухвалені рішення етапу (власник 2026-10-04; архітектор — де позначено)

| № | Рішення | Причина |
|---|---|---|
| Е5б-1 | *(власник)* **Знімок + ціна нової.** Наявні позиції зберігають свою ціну, `base_price` і `discount_data`; зміна кількості множить ЗБЕРЕЖЕНУ ціну. Нова позиція отримує серверну ціну для покупця замовлення (`orders.user_id`; гість — дефолтний тип ціни й категорія, як у чекауті) на момент додавання. 🔴 *(архітектор)* Контекст знижок «від суми кошика» для нової позиції — склад замовлення ПІСЛЯ додавання: `cartTotal` = базові ціни нової позиції + `Σ (base_price ?? price) × quantity` наявних. Наявні позиції не переоцінюються | Покупець не бачить несподіваної зміни вже погодженої ціни; нова позиція рахується тим самим рушієм, що й чекаут, а не «ціною дефолтного типу з браузера», як легасі |
| Е5б-2 | *(власник)* **Доставка перераховується за правилами після кожної зміни складу.** Ті самі функції, що в чекауті (`validateShippingChoice` + `quoteShippingCost`, Task 1): метод `orders.shipping_method_id`, точка `orders.pickup_point_id`, зона за `orders.delivery_city` (`findShippingZoneIn`), тариф `resolveShippingRate` від нового `subtotal`. 🔴 *(архітектор)* Тариф недоступний (метод деактивовано, `min_order_amount` не досягнуто, `max_order_amount` перевищено, тарифу немає) → зміна ВІДХИЛЯЄТЬСЯ 409 `AdminConflictError('state', 'order_shipping_unavailable')`, транзакція відкочується. `orders.shipping_method_id = NULL` → та сама відмова | Доставка відповідає складу замовлення, як у чекауті. Тихо лишити стару вартість означало б показати покупцю суму, яку не дав би жоден тариф. 🔴 Власнику на увагу: замовлення з деактивованим відтоді методом стає нередагованим — це свідома межа, бо зміни методу доставки в Е5б немає |
| Е5б-3 | *(власник)* **Редагувати можна в будь-якому статусі, крім «Скасоване»** (Е5-2) | Статуси адмін створює сам, система знає лише `new` і `cancelled` |
| Е5б-4 | *(власник)* **Вузький пошук товару для додавання:** одна іменована операція `searchProductsForOrderOp({ query })` — параметризований `ilike` за `name` і `sku` товару та його модифікацій, лише `is_active`, мінімум 2 символи, не більше 20 результатів, `%`, `_` і `\` екрануються. Загальний пошук адмінки (П6) цим НЕ відкривається: push-down `like` у `subset.ts` лишається забороненим | Без пошуку адмін не знайде товар у великому каталозі; вузька операція не змінює контракт on-demand колекцій |
| Е5б-5 | *(архітектор)* **Нова server-only тека `simplycms/commerce` (T2, upward-виняток лише `db`).** Переїжджають (`git mv`) зі `storefront/loaders`: `pricing.ts`, `categories.ts`, `discounts.ts`, `entities/price.ts`, `entities/discount.ts`, `checkout-items.ts` (→ `commerce/price-items.ts`), `shipping.ts`, `pickup-points.ts`; із `profile.ts` виноситься лише `loadUserPriceTypeId`. Із `prepare-checkout.ts` виноситься ВСЯ перевірка доставки у `validateShippingChoice` + `quoteShippingCost` (ред.2, див. Task 1 Interfaces) — її кличуть і чекаут, і адмінка. Реекспорту зі `storefront/loaders` НЕ лишається (прецедент Е5-3); ПОВНИЙ перелік споживачів — Task 1 Files | `admin-server` не може імпортувати `storefront/loaders` (тір-зони), а копія рушія — це вже пройдений дефект розходження знижок (B2/r1). `inventory` не розширюємо: облік залишків і ціноутворення — різні домени |
| Е5б-6 | *(архітектор)* **Рушій ціноутворення отримує контекст кошика:** `priceItems(db, userId, items, opts?: { extraCartTotal?: number })` — `cartTotal` = Σ базових цін `items` + `extraCartTotal`. Чекаут викликає без `opts` (поведінка незмінна) | Інакше нова позиція бачила б кошик «лише з себе» і отримала б іншу знижку, ніж та, що дав би чекаут із тим самим складом |
| Е5б-7′ | 🔴 *(архітектор; ред.2 — аудит Codex, blocker)* **Дельта залишку по позиції; ЄДИНА правда — лічильник `order_items.stock_reserved`** (фактично списане, Е5-4′), а не наявність `stock_point_id` (його `reserveOrderStock` пише й при списаному 0, `inventory/order-stock.ts:62`). 1) Нова позиція: тумблер `decrease_on_order` увімкнено ЗАРАЗ → точка `resolveStockPoint(orders.pickup_point_id)`, `reserveStock`, у позицію — точка й фактично списане; вимкнено → `stock_point_id = NULL`, `stock_reserved = 0`. 2) Збільшення на `Δ`: якщо `stock_point_id IS NOT NULL` → `reserveStock(Δ)` у цю точку, `stock_reserved += фактично списане` (0, якщо рядка залишку досі немає; нестача → 409 `order_insufficient_stock`); якщо `NULL` → позиція лишається необліковою. 3) Зменшення на `Δ`: повертається `r = min(Δ, stock_reserved)` через `releaseStock(r)` у точку позиції, `stock_reserved -= r`; при `r = 0` залишок не чіпається. 4) Видалення: повертається рівно `stock_reserved`, потім `DELETE`. Позиція з точкою, видаленою після оформлення (`stock_point_id` став NULL через FK SET NULL, а `stock_reserved > 0`) — як Е5-11: `console.warn`, повернення немає, лічильник обнуляється | Повернути можна лише те, що справді списали, — інакше товар без рядка залишку, якому рядок завели пізніше, дав би фантомні одиниці при зменшенні кількості. Інваріант Е5-4′ зберігається після будь-якої правки, тож `releaseOrderStock` при подальшому скасуванні (адміном чи покупцем) поверне рівно актуальне |
| Е5б-13 | *(архітектор; ред.2 — аудит Codex)* **Грошова арифметика — у цілих центах.** `toCents(s: string): number` розбирає десятковий рядок `numeric` (`"1234.5"`, `"1234.50"`, `"0"`) без `parseFloat`; `subtotalCents = toCents(sum(order_items.total))` (SQL-сума повертає рядок); доставка — `toCents(rate.cost.toFixed(2))`; `totalCents = subtotalCents + shippingCents`; запис — `fromCents(n): string` (`"x.yy"`). Межі колонок — окремо: `order_items.price`/`total`, `orders.subtotal`/`total` — `numeric(12,2)` (≤ 999 999 999 999 центів); 🔴 *(ред.3)* `orders.shipping_cost` — `numeric(10,2)` (≤ 9 999 999 999 центів). Перевищення будь-якої → 409 `AdminConflictError('state', 'order_amount_out_of_range')` до запису. Ціна від рушія — `number`, уже округлена `roundMoney`: `centsFromNumber(n: number): number = Math.round(n * 100)`; рядки `numeric` з БД — `toCents(s: string)`. `total` позиції = `fromCents(centsFromNumber(price) × quantity)` | Без явного алгоритму виконавець отримав би конкатенацію рядків, float-дрейф або переповнення колонки при кількості 9999 |
| Е5б-8 | *(архітектор)* **Операції й порядок локів — КАНОН.** `addOrderItemOp`, `updateOrderItemQuantityOp`, `removeOrderItemOp` — `runAdmin('order.manage')`, одна транзакція: (1) `select … from orders where id = $orderId for update` (проєкція без `accessToken`); (2) код статусу `cancelled` → 409 `order_cancelled_final`; (3) для update/remove — `select … from order_items where id = $itemId and order_id = $orderId for update` (чужа позиція → `Error`); для add — 🔴 *(ред.3)* СПОЧАТКУ `INSERT` нової позиції з `stock_point_id = NULL`, `stock_reserved = 0`; (4) залишок (Е5б-7′) — пише лічильник у вже наявний рядок; (5) запис позиції (кількість/суми для update, `DELETE` для remove); (6) `subtotal = Σ order_items.total` (SQL-сумою після запису, далі центи за Е5б-13); (7) `validateShippingChoice` + `quoteShippingCost` з методом, містом і точкою видачі замовлення (Е5б-2); (8) `update orders set subtotal, shipping_cost, total = subtotal + shipping_cost, updated_at` (центи → `fromCents`). Повертають `{ order: OrderRow; upserted: OrderItem[]; removedIds: string[] }` | Той самий порядок «orders → order_items → stock», що в `cancelOwnOrder` і `changeOrderStatusOp`, — циклу локів немає; гвард кінцевого стану перед будь-якою роботою |
| Е5б-9 | *(архітектор)* **Межі вводу:** `quantity` — ціле 1…9999; видалити ОСТАННЮ позицію не можна → 409 `AdminConflictError('state', 'order_last_item')`; додавання того самого товару/модифікації — НОВИЙ рядок зі своєю ціною (знімки не змішуються); нова позиція з неактивним товаром, модифікацією чужого товару, без ціни або `!isPurchasable` → 409 `AdminConflictError('state', 'order_item_not_purchasable')` | Замовлення без позицій позбавлене сенсу (легасі забороняв лише в UI); злиття рядків зламало б знімок ціни |
| Е5б-10 | *(архітектор)* **Нові `constraint` для `kind: 'state'`** у T0 `ADMIN_STATE_CONSTRAINT`: `orderShippingUnavailable`, `orderInsufficientStock`, `orderLastItem`, `orderItemNotPurchasable`, `orderAmountOutOfRange`; `adminErrorKey` → `admin.errors.<camelCase>` (uk/en) | Той самий канал Е3-20/Е5-9: тост людською мовою переживає межу RPC |
| Е5б-11 | *(архітектор)* **Клієнт: колекції лишаються лише на читання.** Хук `useOrderItemsEdit` кличе serverFn і пише відповідь у `ordersCollection` (`writeUpsert(order)`) і `orderItemsCollection` (`writeUpsert` кожного `upserted`, `writeDelete` кожного `removedIds`) однією `writeBatch` на колекцію. Помилка → `reportTxError`, стан колекцій незмінний | Канон К3-7 і правило `mutation-cache-sync`; оптимістичного стану немає, бо сервер рахує ціну, доставку й залишок |
| Е5б-12 | *(архітектор)* **Операція authz:** запис — `order.manage`, пошук товарів — теж `order.manage` (він існує лише для діалогу додавання) | Одна операція на поверхню редагування замовлення |
| Е5б-14 | *(архітектор, 2026-10-04, директива власника «виправити записані, але не виправлені дрібні дефекти»)* **Task 8 «атомарні борги Е4/Е5»** — після Task 6, перед Task 7 (живий прогін і повний ланцюг Task 7 її покривають). Кожен пункт — окремий коміт; фікс поведінки — спершу RED (`Test Files 1`). К3-Е5-3 (розпил `resource.ts` до ≤150) — лише чистий рефакторинг: окремий коміт, тести `resource*.test.ts` і харнес-ресурси зелені без правок асертів, публічні сигнатури `defineAdminResource`/`AdminResourceOps` незмінні, маркери `UPSTREAM:DZOD-1` переїжджають зі своїми кастами; інакше — зупинка. Зміна змісту `released` у `releaseOrderStock` — JSDoc, усі споживачі й рядок у плані. Не беруться: К3-Е5-2 (потрібна колекція точок видачі — Е6а), глибокі відносні шляхи моку (зміна аліасів), ключ засіву типу ціни (прийнятий дизайн) | Борги дрібні й атомарні, а контекст етапу ще свіжий |
| Е5б-15 | *(архітектор, 2026-10-04)* **К3-Е5-1: токен гостьового замовлення на `order-success` захоплюється ОДИН раз при монтуванні** (`const [token] = useState(() => search.token ?? null)`) і живе лише в памʼяті цього монтування — не в cookie/sessionStorage. Ключ запиту стабільний, повторного запиту без токена немає. Тести: замовлення лишається після зняття токена з URL і `getOrderView` не кличеться з `token: null`; примусовий refetch іде з тим самим токеном; `navigate` зняття — рівно один раз; залогінений — без змін; негативний контроль «`search.token` напряму» → червоний | Корінь: токен у `queryKey` читався з URL на кожному рендері, ефект знімав його з URL → новий ключ → запит без токена → «не знайдено» (`OrderSuccess.tsx:55,66-70,74-86`). Сервер токен не гасить, «одноразовість» — клієнтське правило «не тримати в URL/історії», тож (А) його не послаблює |
| Е5б-16 | (архітектор, фінальне рев'ю) `pickup_point_invalid` → `order_shipping_unavailable`: замовлення з деактивованою точкою видачі нередаговане, як і з деактивованим методом (наслідок Е5б-2) | Перевірка доставки в адмінці — та сама `validateShippingChoice`, що в чекауті; окремої відмови для точки видачі в редагуванні немає, бо зміни точки в Е5б немає |

**Поза Е5б:** зміна методу/адреси доставки й контактів; ручна ціна позиції; знижка на рівні замовлення; повторне переоцінювання наявних позицій; загальний пошук адмінки (П6); заборона редагування за «кінцевими» статусами, крім `cancelled`.

## Ступінь обовʼязковості — читати ПЕРШИМ

- **КАНОН** (розбіжність → зупинка і звернення до архітектора): рішення Е5б-1…Е5б-13 (Е5б-7′ замість Е5б-7), Global Constraints, імена операцій/serverFn у Interfaces, порядок локів Е5б-8, асерти Review Focus.
- **ОРІЄНТИР:** якорі `файл:рядок`, імена внутрішніх компонентів, розкладка JSX, тексти i18n.
- 🔴 Звіт «гейт зелений» — не доказ; доказ — вивід команди.
- 🔴 Крок «має бути ЗЕЛЕНИМ одразу» перевіряє припущення плану; червоний — зупинка й ескалація.
- 🔴 Лок доводиться ДЕТЕРМІНОВАНО: спостерігати ЛОКИ (`waitForBlockedBy` + `pg_locks`, фікстури Е5), а не дані — незакомічені зміни іншому зʼєднанню невидимі (урок Е5 ред.2).
- Задачі адресуються заголовками `## Task N:`.

## Протокол виконання

- **Ролі.** Виконує сесія-оркестратор (subagent-driven). **Архітектор — сесія `v2-k3-e4-catalog-dictionaries-plan`**, звернення через `SendMessage`. Ескалація ДО коду: розбіжність із КАНОНОМ, «зелений одразу» червоний, рішення, якого план не містить. Відповідь — рішення `Е5б-N` окремим docs-комітом.
- **Рев'ю.** Після кожної задачі — рев'ю задачі (SDD). Після Task 7 — фінальне рев'ю гілки архітектором. Мерж і пуш — рішення власника.
- **Git.** Архітектор у цей час git-запису не робить.
- 🔴 **`CLAUDE.md` — лише загальні правила** (рішення власника 2026-10-04): стан, етапи, лічильники й «живі сторінки» туди НЕ пишуться — це функція `platform-roadmap.md` і `v2-state-map.md`. Правка `CLAUDE.md` доречна лише тоді, коли змінюється ПРАВИЛО (напр. нова server-only тека `commerce` у Project Structure), і лише з дозволу власника.
- **Стенд.** `PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55434/postgres`. Окремий файл харнеса — `pnpm exec vitest run --config vitest.schema.config.ts <фільтр>`; RED валідний лише з `Test Files 1` у виводі. `pnpm test:schema -- <файл>` прогін НЕ звужує.

## Global Constraints

- TypeScript 5.9 strict; Node `>=22.12`; коментарі й доки — українською; рядки UI — лише i18n (uk + en).
- 🔴 Ліміт 150 рядків на новий або переписаний файл (`coding-style.instructions.md:43`); у звіті задачі з кодом — `wc -l` нових файлів. Виняток лише `admin-server/index.ts` (К3-9′).
- `pnpm lint` = 0 errors / ≤ 8 warnings.
- Повний ланцюг: `pnpm install --frozen-lockfile → format:check → lint → build → typecheck → test → test:schema → build:packages → typecheck:template → test:packaging → pilot:pack --skip-build`.
- Мінімальний гейт задачі: `pnpm lint && pnpm typecheck && pnpm test`; + `pnpm test:schema`, якщо зачеплено `commerce/`, `inventory/`, `storefront/loaders/`, `admin-server/impl/**`, `test-harness/`; + `pnpm build:packages`, якщо зачеплено серверний код пакета або exports.
- К3-4′/К3-9′: `createServerFn` — лише топ-рівнем в `admin-server/index.ts`; нові serverFn — у фабрику моку `admin-server/__tests__/support/admin-server-mock.ts` (Е4-13).
- К3-13: кожна адмін-операція — `runAdmin`; 409 — до `throw`.
- Тіри: `contracts` T0, `domain` T1, `commerce`/`inventory`/`admin-server` T2, `admin-data` T4, `admin` T5. Тір-зони не послаблювати.
- Коміти: `feat(k3-e5b): …`, `test(k3-e5b): …`, `docs(k3-e5b): …`.

## Review Focus

1. **Адмін збільшує кількість понад наявний залишок** → тост «недостатньо на складі», у БД нічого не змінилось (ні позиція, ні залишок, ні суми). Тест — Task 3.
2. **Після редагування покупець скасовує замовлення в кабінеті** → залишок повертається рівно на актуальні `stock_reserved` кожної позиції (зокрема доданої й видаленої). Тест — Task 3.
3. **Видалення позиції опускає суму нижче порогу безкоштовної доставки або `min_order_amount`** → доставка перерахована за тарифом, або зміна відхилена 409 `order_shipping_unavailable`; `total = subtotal + shipping_cost` завжди. Тест — Task 3.
4. **Адмін редагує, поки покупець скасовує (або інший адмін міняє статус)** → операції серіалізовані локом замовлення; редагування після скасування — 409 `order_cancelled_final`. Тест — Task 3 (детерміновано: `holdOrderRowLock` + `waitForBlockedBy` + `rowLocksOnStock`).
5. **Пошук «50%», «a_b» або один символ** → `%` і `_` шукаються буквально; запит коротший за 2 символи — порожній результат без звернення до БД. Тест — Task 4.

Додатково: нова позиція для зареєстрованого покупця з категорією отримує його тип ціни й знижку, а не дефолтну (Task 1/3); чекаут після переїзду рушія дає ті самі суми, що до нього (Task 1, регрес).

## Граф залежностей задач

```
Task 1 (simplycms/commerce: переїзд + validateShippingChoice/quoteShippingCost + extraCartTotal) ─┐
Task 2 (inventory: дельта по позиції) ─────────────────────────────────┼─► Task 3 (операції редагування) ─► Task 5 (UI: кількість, видалення) ─┐
                                                       Task 4 (пошук) ──┴──────────────────────────────────► Task 6 (UI: діалог додавання) ──┤
                                                                                                                                           ▼
                                                                                         Task 7 (гейти, live:smoke, доки, повний ланцюг)
```

## File Structure

**Створюються:** `packages/simplycms/src/commerce/{index.ts,shipping-choice.ts}`; `packages/simplycms/src/inventory/order-item-stock.ts`; `packages/simplycms/src/admin-server/impl/order-items/{add,update-quantity,remove,totals}.ts`; `packages/simplycms/src/admin-server/impl/products/search-for-order.ts`; `packages/simplycms/src/admin/features/orders/detail/{useOrderItemsEdit.ts,OrderItemQuantity.tsx,RemoveOrderItemDialog.tsx,AddOrderItemDialog.tsx,ProductSearchList.tsx}` + `__tests__/`; `packages/simplycms/test-harness/pg/__tests__/{admin-order-items-edit,commerce-pricing,product-search-for-order}.test.ts`; `scripts/live-smoke/admin-order-edit.mjs`.

**Переносяться (`git mv`):** `storefront/loaders/{pricing,categories,discounts,shipping,pickup-points}.ts`, `storefront/loaders/entities/{price,discount}.ts` → `commerce/`; `storefront/loaders/checkout-items.ts` → `commerce/price-items.ts`.

**Змінюються:** `contracts/server-only.ts`, `contracts/domain-errors.ts`; `eslint.tier-zones.mjs`; `packages/simplycms/package.json` (exports src + dist `./commerce`); `tests/tier-boundary/zones.ts`; `tests/dist-server-boundary.test.ts` (мапа маркерів); `storefront/loaders/{prepare-checkout,profile,index,home,home-sections}.ts`; `storefront-routes/server/catalog.ts`; `core/lib/{discounts,price-type}.ts`; `inventory/index.ts`; `admin-server/impl/index.ts`, `admin-server/index.ts`, `admin-server/__tests__/support/admin-server-mock.ts`; `admin/lib/admin-error.ts`; `admin/features/orders/detail/{OrderDetailPage,OrderItemsTable}.tsx`; i18n `admin/{orders,errors}.ts`; `scripts/live-smoke/owner-steps.mjs`; доки.

---

## Task 1: `simplycms/commerce` — серверне ціноутворення й доставка в спільній теці (Е5б-5, Е5б-6)

**Files:** як у File Structure (переїзд, `commerce/index.ts`, `commerce/shipping-choice.ts`, реєстрація теки в пʼяти місцях) + `test-harness/pg/__tests__/commerce-pricing.test.ts`. 🔴 *(ред.2, аудит Codex major)* Споживачі, що мусять перейти на `simplycms/commerce` (перелік — мінімальний, остаточний дає `rg` у Step 3): `storefront/loaders/{prepare-checkout,home,home-sections,catalog-products,products,product-detail,profile,index}.ts`, `storefront-routes/server/catalog.ts`, `core/lib/{discounts,price-type,shipping-directory,stock}.ts`, харнес-тести, що імпортують ці символи з барелю `simplycms/storefront/loaders`. У ПЕРЕНЕСЕНИХ файлах: `import type { ActorDb } from './db'` → `simplycms/db`; `JsonValue` з `./entities/property` → `simplycms/schema/types` (саме цей субшлях є в exports; `schema/json` — ні) (інакше зона `commerce` з винятком лише `db` червоніє). `shipping.ts` (163 рядки) при переїзді ділиться на `commerce/shipping-directory.ts` (лоадери) і `commerce/shipping-types.ts` (типи рядків), обидва ≤ 150.

**Interfaces:**
- Барель `simplycms/commerce`: `priceItems(db: ActorDb, userId: string | null, items: CheckoutItemInput[], opts?: { extraCartTotal?: number }): Promise<NewOrderItem[] | 'not_purchasable'>` (перейменований `priceCheckoutItems`; без `opts` — побайтово та сама поведінка); 🔴 *(ред.3, аудит Codex major — порядок відмов чекауту і `PreparedCheckout.method`)* доставка — ДВІ функції: `validateShippingChoice(db, input: { methodId: string | null; deliveryCity: string | null; pickupPointId: string | null }): Promise<{ method: ShippingMethodRow; zone: ShippingZoneRow | null; directory: ShippingDirectory } | 'shipping_unavailable' | 'pickup_point_invalid'>` — рівно перевірки `prepare-checkout.ts:70-96` (метод активний; `pickup` → активна точка цього методу, місто не потрібне; інший метод → точка заборонена, порожнє місто → `shipping_unavailable`; зона `findShippingZoneIn(zones, deliveryCity ?? '')`); і `quoteShippingCost(choice, subtotal: number): number | null` — `resolveShippingRate` від `subtotal` (`null` = тариф недоступний). `prepareCheckout` кличе `validateShippingChoice` ДО `priceItems` (як зараз), а `quoteShippingCost` — після, і далі несе `method: ShippingMethodRow` у `PreparedCheckout` — `place-order.ts` (`prepared.method.code`) не змінюється. Адмінка: `validateShippingChoice` з `orders.shipping_method_id`/`delivery_city`/`pickup_point_id`, потім `quoteShippingCost` від нового `subtotal`; будь-яка відмова чи `null` → 409 `order_shipping_unavailable`; плюс уже наявні лоадери ланцюга (`loadPricesByProduct`, `loadDefaultPriceTypeId`, `loadUserPriceTypeId`, `loadUserCategoryId`, `loadDefaultUserCategoryId`, `loadDiscountGroups`, `loadShippingDirectory`, `loadPickupPoints`) із тими самими сигнатурами. `NewOrderItem` переїжджає разом (тип у `commerce`, `storefront/loaders/entities/new-order.ts` імпортує звідти).
- `prepareCheckout` кличе `validateShippingChoice` ДО ціноутворення і `quoteShippingCost` після нього замість власного розрахунку; три коди відмов `PlaceOrderRejection`, їхній пріоритет і поле `PreparedCheckout.method` не змінюються.
- Реєстрація теки — усі пʼять місць прецеденту `inventory`: `SERVER_ONLY` у `contracts/server-only.ts`; зона `['src/commerce', 2, 'commerce', ['db']]` в `eslint.tier-zones.mjs` + `'commerce'` у upward-виняток `storefront` і `admin-server`; `exports` `./commerce` (src і dist) у `package.json`; рядок негативного контролю в `tests/tier-boundary/zones.ts` (`commerce` не може `simplycms/storefront/loaders`); маркер у `tests/dist-server-boundary.test.ts`.
- Внутрішні імпорти `commerce/*` — прямі сусідні (`./pricing`), не через барель (урок Е5, minor 12).

- [x] **Step 1: Регрес-фіксація (має бути ЗЕЛЕНИМ одразу)** — до переїзду прогнати `pnpm exec vitest run --config vitest.schema.config.ts checkout-flow storefront-loaders` і `pnpm vitest run packages/simplycms/src/core packages/simplycms/src/storefront`; зберегти вивід як еталон. Записати в тест `commerce-pricing` конкретні очікувані `price`/`basePrice`/`discountData` для 2–3 позицій демо-сиду, отримані ще СТАРИМ рушієм (оракул, аудит Codex minor).
- [x] **Step 2: Тест (червоний)** — `commerce-pricing.test.ts`:
```ts
it('priceItems без opts дає ЗАФІКСОВАНІ до переїзду значення (price, basePrice, discountData) — оракул: очікування з checkout-flow.test.ts:~227 і явні числа демо-фікстур, записані в Step 1', async () => {});
it('extraCartTotal переводить кошик через поріг знижки «від суми» — нова позиція отримує знижку', async () => {});
it('покупець із категорією отримує свій тип ціни; гість — дефолтний', async () => {});
it('quoteShippingCost: free_from від subtotal → 0; нижче min_order_amount → null; validateShippingChoice з methodId null → shipping_unavailable', async () => {});
it('пріоритет відмов чекауту незмінний: невалідна доставка І неможливий до купівлі товар одночасно → shipping_unavailable (як до переїзду)', async () => {});
it('validateShippingChoice паритет із чекаутом: pickup з deliveryCity null і активною точкою → тариф; pickup з неактивною точкою → pickup_point_invalid; не-pickup без міста → shipping_unavailable; метод деактивовано → shipping_unavailable', async () => {});
```
Run: `pnpm exec vitest run --config vitest.schema.config.ts commerce-pricing` → FAIL (`Test Files 1`).
- [x] **Step 3: Переїзд і правки** за Interfaces. Старі шляхи й символи: `rg "loaders/(pricing|categories|discounts|shipping|pickup-points|checkout-items)|entities/(price|discount)'" packages scripts tests` → лише `commerce/` і коментарі; плюс `rg "(loadShippingDirectory|loadPickupPoints|loadPricesByProduct|loadDefaultPriceTypeId|loadUserPriceTypeId|loadUserCategoryId|loadDiscountGroups|priceCheckoutItems|groupPricesByProduct|priceColumns)" packages scripts tests` — кожен імпорт іде з `simplycms/commerce` або сусіднього файлу всередині `commerce/`.
- [x] **Step 4: Зелене + регрес** — Step 1 повторно (ті самі числа), `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages && pnpm pilot:pack --skip-build` (Gate C: `commerce` не в клієнтському бандлі).
- [x] **Step 5: Коміт** — `feat(k3-e5b): серверне ціноутворення й доставка в simplycms/commerce`.

---

## Task 2: Дельта залишку по позиції (`simplycms/inventory`, Е5б-7′)

**Files:** Create `packages/simplycms/src/inventory/order-item-stock.ts`; Modify `inventory/index.ts`, `test-harness/pg/__tests__/order-stock.test.ts`.

**Interfaces** (усі — під уже взятим викликачем `orders FOR UPDATE`; функція сама бере `order_items … FOR UPDATE` своєї позиції й локи залишку через `lockTargetStock`):
- `reserveNewOrderItemStock(db, { orderItemId, orderId }): Promise<{ stockPointId: string | null; reserved: number }>` *(фактична сигнатура після рев'ю Task 2: ціль і кількість беруться із ЗАБЛОКОВАНОГО рядка позиції, а не з аргументу — мертві поля `productId`/`modificationId`/`quantity` прибрано, щоб викликач не вважав їх джерелом правди)* — 🔴 рядок позиції ВЖЕ вставлено викликачем (`stock_reserved = 0`); тумблер увімкнено → точка `resolveStockPoint(orders.pickup_point_id)`, `reserveStock`, `UPDATE` позиції (точка + фактично списане); вимкнено → `{ null, 0 }`, позицію не чіпає. Тести Task 2 спершу вставляють позицію, потім кличуть хелпер; кейс «рядка позиції немає» → `Error` (не мовчазне списання без лічильника).
- `adjustOrderItemStock(db, orderItemId: string, newQuantity: number): Promise<{ reserved: number }>` — за Е5б-7′ п.2–3 (зменшення повертає `min(Δ, stock_reserved)`); `InsufficientStockError` пробрасується.
- `releaseOrderItemStock(db, orderItemId: string): Promise<{ released: number }>` — за Е5б-7′ п.4, обнуляє `stock_reserved` тим самим CTE-прийомом, що `releaseOrderStock`.

- [x] **Step 1: Тести (червоні)** у `order-stock.test.ts`:
```ts
it('нова позиція при увімкненому тумблері: точка й stock_reserved записані, залишок списано', async () => {});
it('нова позиція при вимкненому: необлікова, залишок не чіпали', async () => {});
it('збільшення облікової: списано Δ, stock_reserved += Δ; нестача → InsufficientStockError, нічого не змінено', async () => {});
it('зменшення: повернуто |Δ|, stock_reserved -= |Δ|', async () => {});
it('необлікова позиція (stock_point_id NULL) лишається необліковою після зміни кількості, навіть якщо тумблер увімкнули', async () => {});
it('🔴 точка задана, stock_reserved = 0 (рядка залишку не було) → рядок залишку завели → ЗМЕНШЕННЯ кількості НЕ повертає нічого; скасування теж (Е5б-7′)', async () => {});
it('точка задана, stock_reserved = 0 → рядок залишку завели → ЗБІЛЬШЕННЯ списує Δ, stock_reserved = Δ; скасування повертає рівно Δ', async () => {});
it('releaseOrderItemStock: повертає stock_reserved і обнуляє; повторний виклик — 0', async () => {});
it('після adjust + release позиції releaseOrderStock усього замовлення повертає рівно залишок інших позицій', async () => {});
it('on_order: збільшення йде в мінус без InsufficientStockError', async () => {});
```
Негативні контроли (вивід у звіт), кожен зі спостереженням: зменшення повертає `|Δ|` замість `min(Δ, stock_reserved)` → червоніє кейс 🔴 «точка задана, stock_reserved = 0» (залишок зростає); `adjust` пише `stock_reserved = newQuantity` → червоніє той самий кейс (лічильник ≠ 0) і кейс «збільшення після появи рядка»; `release` без обнулення → червоніє «повторний виклик». Асертити і лічильник, і точний залишок після зменшення та після скасування.
- [x] **Step 2: Реалізація** (поверх `reserveStock`/`releaseStock`/`lockTargetStock`, прямі сусідні імпорти).
- [x] **Step 3: Зелене** — `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test`.
- [x] **Step 4: Коміт** — `feat(k3-e5b): дельта залишку по позиції замовлення`.

---

## Task 3: Операції редагування позицій (Е5б-1, Е5б-2, Е5б-8…Е5б-10)

**Files:** Create `admin-server/impl/order-items/{add,update-quantity,remove,totals}.ts`, `test-harness/pg/__tests__/admin-order-items-edit.test.ts`; Modify `admin-server/impl/index.ts`, `admin-server/index.ts`, `admin-server/__tests__/support/admin-server-mock.ts`, `contracts/domain-errors.ts`, `admin/lib/admin-error.ts` (+ тест), i18n `admin/errors.ts`.

**Interfaces:**
- `addOrderItemInput = z.object({ orderId: z.uuid(), productId: z.uuid(), modificationId: z.uuid().nullable(), quantity: z.number().int().min(1).max(9999) })`; `addOrderItemOp → { order, upserted: [нова позиція], removedIds: [] }`. id позиції — `randomUUID()` на сервері.
- `updateOrderItemQuantityInput = z.object({ orderId: z.uuid(), orderItemId: z.uuid(), quantity: z.number().int().min(1).max(9999) })`; `updateOrderItemQuantityOp → { order, upserted: [позиція], removedIds: [] }`; та сама кількість → no-op (без перерахунку доставки).
- `removeOrderItemInput = z.object({ orderId: z.uuid(), orderItemId: z.uuid() })`; `removeOrderItemOp → { order, upserted: [], removedIds: [orderItemId] }`.
- `recomputeOrderTotals(db, order): Promise<OrderRow>` (`totals.ts`) — кроки 6–8 Е5б-8 за алгоритмом Е5б-13.
- Нова позиція: `priceItems(db, order.userId, [{ productId, modificationId, quantity }], { extraCartTotal })` (Е5б-1), `'not_purchasable'` → 409 `order_item_not_purchasable`; запис `name/price/quantity/total/base_price/discount_data` як `createOrder`.
- 🔴 *(ред.2, аудит Codex major)* `InsufficientStockError` з `reserveNewOrderItemStock`/`adjustOrderItemStock` перехоплюється в ОБОХ операціях (`add` і `update`): `setResponseStatus(409)` → `throw new AdminConflictError('state', ADMIN_STATE_CONSTRAINT.orderInsufficientStock)` — `runAdmin` сам мапить лише коди Postgres (`run.ts:38`).
- Гроші — Е5б-13 (`toCents`/`centsFromNumber`/`fromCents` поруч у `totals.ts`, з юніт-тестом на `"0"`, `"1234.5"`, `"1234.50"`, `"0.01"`, `centsFromNumber(0.1 + 0.2)` = 30 і обидві межі — `numeric(12,2)` і `numeric(10,2)`).
- serverFn: `addOrderItem`, `updateOrderItemQuantity`, `removeOrderItem`.

- [x] **Step 1: Харнес-тести (червоні)** — шапка й фікстури як `admin-orders.test.ts` (`placeOrder`, `holdOrderRowLock`, `waitForBlockedBy`, `rowLocksOnStock`, `restrictOrdersSelectForAdmin`):
```ts
it('add: ціна для покупця (тип ціни категорії, знижка), stock списано, subtotal/shipping/total перераховано', async () => {});
it('add гостьовому замовленню: дефолтний тип ціни', async () => {});
it('update понад залишок → 409 order_insufficient_stock; позиція, залишок і суми незмінні (Review Focus 1)', async () => {});
it('add понад залишок → 409 order_insufficient_stock; позицій не додано, залишок і суми незмінні', async () => {});
it('суми з копійками: 3 × 1234.55 + доставка 70.10 → subtotal 3703.65, total 3773.75 рядками numeric', async () => {});
it('кількість, що виводить total за межу numeric(12,2) → 409 order_amount_out_of_range, нічого не змінено', async () => {});
it('тариф (відсоток від суми), що виводить shipping_cost за межу numeric(10,2) при subtotal у межах → 409 order_amount_out_of_range, а не помилка БД', async () => {});
it('remove останньої позиції → 409 order_last_item', async () => {});
it('remove опускає subtotal нижче free_from → shipping_cost зріс; нижче min_order_amount → 409 order_shipping_unavailable, нічого не змінено (Review Focus 3)', async () => {});
it('будь-яка операція на скасованому → 409 order_cancelled_final', async () => {});
it('чужа позиція (orderItemId іншого замовлення) → помилка, нічого не змінено', async () => {});
it('редагування → cancelOwnOrder покупцем повертає рівно актуальні stock_reserved (Review Focus 2)', async () => {});
it('(лок) поки рядок замовлення зайнятий holdOrderRowLock — операція стоїть на `select … from "orders" … for update` і не тримає локів order_items/stock_by_pickup_point (Review Focus 4)', async () => {});
it('рядки результату без accessToken (колонкові гранти restrictOrdersSelectForAdmin)', async () => {});
it('не-адмін → AuthzError', async () => {});
```
Негативні контроли (вивід у звіт, кожен зі спостереженням): прибрати `for update` замовлення → тест «(лок)» червоний (операція стоїть на іншому запиті або тримає локи залишку); пропустити `quoteShippingCost` → червоніє Review Focus 3; гвард `cancelled` після роботи → червоніє «скасованому».
- [x] **Step 2: Реалізація** за Interfaces і Е5б-8.
- [x] **Step 3: Зелене** — `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages && pnpm pilot:pack --skip-build`.
- [x] **Step 4: Коміт** — `feat(k3-e5b): додавання, зміна кількості й видалення позицій замовлення`.

---

## Task 4: Вузький пошук товару для замовлення (Е5б-4)

**Files:** Create `admin-server/impl/products/search-for-order.ts`, `test-harness/pg/__tests__/product-search-for-order.test.ts`; Modify `admin-server/impl/index.ts`, `admin-server/index.ts`, мок.

**Interfaces:** `searchProductsForOrderInput = z.object({ query: z.string().trim().max(100) })`; `searchProductsForOrderOp → { items: Array<{ productId: string; name: string; sku: string | null; hasModifications: boolean }> }` — `query.length < 2` → `{ items: [] }` без запиту; `ilike` з екрануванням `\`, `%`, `_` (функція `escapeLike(s)` поруч + юніт-тест); пошук і за `product_modifications.sku`/`name` (повертається товар); лише `products.is_active`; `order by name, id`; `limit 20`. serverFn `searchProductsForOrder` (GET).

- [x] **Step 1: Тести (червоні):** буквальні `%`/`_`/`\` (товар «Знижка 50%» знаходиться за «50%», а «5_» не знаходить «50»; товар зі sku `AB\12` знаходиться за `B\1`, а запит, що закінчується на `\`, не екранує наступний символ шаблону); 1 символ → порожньо; неактивний не повертається; модифікація зі збігом sku → її товар; не більше 20; не-адмін → AuthzError (Review Focus 5).
- [x] **Step 2–3: Реалізація, зелене** — мінімальний гейт + `test:schema`.
- [x] **Step 4: Коміт** — `feat(k3-e5b): вузький пошук товару для додавання в замовлення`.

---

## Task 5: UI — кількість і видалення позиції (Е5б-11)

**Files:** Create `admin/features/orders/detail/{useOrderItemsEdit.ts,OrderItemQuantity.tsx,RemoveOrderItemDialog.tsx}` + тести; Modify `OrderItemsTable.tsx`, `OrderDetailPage.tsx`, i18n `admin/orders.ts` (перевикористати наявні ключі `removeItemTitle`, `removeItemText`, `itemRemoved`, `updated`, `updateFailed` — перевірити `rg`).

**Interfaces:** `useOrderItemsEdit(orderId): { add(input), setQuantity(orderItemId, qty), remove(orderItemId) }` — кожен кличе свій serverFn і робить write-back за Е5б-11; `OrderItemQuantity` — поле з підтвердженням (Enter/blur), межі 1…9999; кнопка видалення прихована для останньої позиції; усе редагування вимкнене для статусу `cancelled`.

- [x] **Step 1: Тести (червоні):** зміна кількості → `updateOrderItemQuantity` один раз → рядок і підсумки оновлені write-back-ом без `listOrderItems`; 409 `order_insufficient_stock` → тост `admin.errors.orderInsufficientStock`, поле повертається до серверного значення; видалення через діалог; скасоване — контролів немає.
- [x] **Step 2–3: Реалізація, зелене** — мінімальний гейт, `wc -l` нових файлів.
- [x] **Step 4: Коміт** — `feat(k3-e5b): зміна кількості й видалення позицій у картці замовлення`.

---

## Task 6: UI — діалог додавання товару

**Files:** Create `admin/features/orders/detail/{AddOrderItemDialog.tsx,ProductSearchList.tsx}` + тести; Modify `OrderDetailPage.tsx`, i18n (наявні `addItem`, `addItemTitle`, `searchPlaceholder`, `searchHint`, `searchEmpty`, `pickModification`, `modificationsEmpty`, `addToOrder`).

**Interfaces:** пошук — `searchProductsForOrder` з debounce 300 мс і скасуванням застарілої відповіді (порядок відповідей не має значення — показується відповідь на ОСТАННІЙ запит); модифікації вибраного товару — наявна колекція `productModificationsCollection` (зріз `where productId`); кількість 1…9999; «Додати» → `useOrderItemsEdit().add`; 409 `order_item_not_purchasable`/`order_insufficient_stock`/`order_shipping_unavailable` → тост, діалог лишається відкритим.

- [x] **Step 1: Тести (червоні):** менше 2 символів — запиту немає; застаріла відповідь не перетирає нову; товар із модифікаціями вимагає вибору модифікації; успіх → діалог закрито, позиція в таблиці з write-back; помилка → тост, діалог відкритий.
- [x] **Step 2–3: Реалізація, зелене**.
- [x] **Step 4: Коміт** — `feat(k3-e5b): діалог додавання товару в замовлення`.

---

## Task 8: Атомарні борги Е4/Е5 (Е5б-14, Е5б-15)

Виконується після Task 6 і перед Task 7. Кожен пункт — окремий коміт; фікс поведінки — RED першим.

- К3-Е5-1 — `order-success` гостя (Е5б-15).
- К3-Е5-3 — розпил `admin-server/impl/resource.ts` до ≤150 рядків, чистий рефакторинг (`refactor(k3-e5b): …`, умови Е5б-14).
- Фабрика: `touch` типізується як `Exclude<ColumnName<T>, O>`; `maxLimit` валідується на старті фабрики (додатне ціле, fail-loud).
- `releaseOrderStock`: `released` не рахує позицію, по якій `releaseStock` нічого не повернув (рядка залишку немає) — або чесний JSDoc «спроби»; рішення — рядком у «Фактах виконання».
- Тест гілки `stock_point_id IS NULL` (точку видалено після оформлення): лічильник обнулено, залишок не повернуто, `released` її не рахує.
- Е4: юніт-тести `AddAssignmentDialog` (порожній список → `allAdded`, кнопка вимкнена, скидання вибору при закритті, `onAdd(selected)`); асерт «remount без refetch» у `on-demand-full-slice`; тест сортування списку типів цін за `sortOrder`; перейменувати сторінковий тест «update не несе propertyType» з посиланням на юніт `toPropertyPatch`.
- Е5: прибрати декоративний асерт `rows.length <= 100` у тесті `listOrders`; `Intl.DateTimeFormat` у `useMemo` + асерт дати в `OrdersTable`; захист від повторного підтвердження в `OrderStatusControl` (in-flight); явний очікуваний `shown.id` у тесті write-back колекцій замовлень.

Гейт: мінімальний + `test:schema` + `build:packages`. Закриті борги позначаються в `platform-roadmap.md` і в «Відомо, не виправлено» планів Е4/Е5.

---

## Task 7: Живий прогін, доки, повний ланцюг

**Files:** Create `scripts/live-smoke/admin-order-edit.mjs`; Modify `scripts/live-smoke/owner-steps.mjs` (виклик після кроку замовлень Е5, усередині того самого `try`), `docs/tasks/{platform-roadmap,v2-state-map}.md`, `packages/README.md` (рядок `commerce/`), цей план («Факти виконання»).

- [x] **Step 1: Крок живого прогону** (кожен рядок — `check(…)`): покупець оформлює замовлення (хелпери Е5 у ТІЙ послідовності, що `admin-orders-buyer.mjs:29`: `addToCart` → `openCheckoutPrefilled` → `submitCheckout`) → власник у картці збільшує кількість на 1 → SQL: позиція, `stock_reserved`, залишок −1, суми = формула → додає ІНШИЙ товар пошуком — `sonyachna-panel-550w-mono` (демо-сід веде для нього залишок) → SQL: знімок залишку його точки ДО додавання, нова позиція з ціною рушія, залишок −1 → видаляє її → SQL: залишок повернуто, позиції немає → покупець у кабінеті бачить новий `total` → покупець скасовує → SQL: залишок = стан до замовлення (Review Focus 2) → `pageerror` = 0.
- [x] **Step 2: Ручний прогін** («пункт — факт»): збільшення понад залишок (тост); видалення до порогу безкоштовної доставки; англійська локаль діалогу; гостьове замовлення.
- [x] **Step 3: Доки** — `v2-state-map.md` (§1, §2.x, §3.1, §6: редагування позицій живе; межа Е5б-2 про деактивований метод доставки); `platform-roadmap.md` (Е5б ✅, наступний — Е6а); `packages/README.md` (`commerce/`). У `CLAUDE.md` стан НЕ пишеться; якщо змінилось правило (нова тека `commerce` у Project Structure, її межа server-only) — запропонувати рядок власнику у звіті.
- [x] **Step 4: Повний ланцюг** — команда з Global Constraints, вивід у «Факти виконання».
- [x] **Step 5: Коміт** — `docs(k3-e5b): живий прогін редагування замовлення, карта стану й роадмап`.

---

## DoD етапу Е5б

1. `pnpm live:smoke` зелений із кроком редагування; вивід у «Факти виконання».
2. `pnpm test:schema` доводить: ціну нової позиції для покупця й гостя; дельту залишку в обидва боки, нестачу, `on_order`, необлікову позицію; скасування після редагування повертає рівно актуальне; перерахунок доставки й відмову `order_shipping_unavailable`; детерміноване очікування на локу замовлення; буквальний пошук — з негативними контролями.
3. Чекаут після переїзду рушія дає ті самі суми (регрес Task 1).
4. Повний ланцюг + `pilot:pack --skip-build` зелений; lint 0 / ≤ 8; нові файли ≤ 150 рядків.
5. Доки оновлено.

## Факти виконання

### Tasks 1–6

Коміти — `git log --oneline f9dad58a..a3669c22`; ключовий вимір кожної
задачі — зі звіту виконавця.

- **Task 1** — `6533b810` `feat(k3-e5b): серверне ціноутворення й доставка в
  simplycms/commerce`. Регрес-еталон до переїзду: `checkout-flow
  storefront-loaders` — 2 файли / 27 тестів, `core`+`storefront` — 31 / 148,
  ті самі числа після; оракул `commerce-pricing` записано СТАРИМ рушієм.
  Тест розбито на `commerce-pricing` і `commerce-shipping` (ліміт 150).
- **Task 2** — `d8da817f` `feat(k3-e5b): дельта залишку по позиції
  замовлення`. 11 харнес-кейсів; RED отримано тимчасовим вилученням
  реалізації (написаної до тестів — записано чесно); негативні контролі
  `|Δ|` замість `min(Δ, stock_reserved)` і `stock_reserved = newQuantity` —
  червоні. Сигнатура `reserveNewOrderItemStock` звужена до
  `{ orderItemId, orderId }` (Interfaces виправлено).
- **Task 3** — `63fac6d2` `feat(k3-e5b): додавання, зміна кількості й
  видалення позицій замовлення` + `b6ea2d06` (Focus 2 видаляє облікову
  позицію, лок — для трьох операцій). RED — 4 харнес-файли й юніт `totals`;
  мутації: без `.for('update')`, стара `shipping_cost` замість
  `quoteShippingCost`, гвард `cancelled` після роботи, `extraCartTotal: 0` —
  усі червоні.
- **Task 4** — `a6e1db60` `feat(k3-e5b): вузький пошук товару для додавання
  в замовлення`. 7/7; мутації: без екранування — червоніють «50%/5_» і «sku
  з `\`»; `where true` замість `is_active` — червоніє «неактивний».
- **Task 5** — `e9ac48e8` `feat(k3-e5b): зміна кількості й видалення позицій
  у картці замовлення`. Тести після коду — замість RED мутаційний доказ:
  без `writeUpsert(upserted)` і без повернення поля на 409 — червоні; нові
  файли ≤ 112 рядків.
- **Task 6** — `7f91bfdc` `feat(k3-e5b): діалог додавання товару в
  замовлення`. RED до коду — 9 з 10 тестів червоні; GREEN 10/10; мутація
  без in-flight-гварда червонить «подвійний клік».

### Task 8

- **`released` — лише фактичні повернення (рішення D).** Обрано «не рахувати
  позицію без фактичного повернення», а не JSDoc «спроби»: `releaseStock`
  (внутрішня, поза барелем) повертає кількість фактично повернутих одиниць
  (0 — рядка залишку на точці немає); `releaseOrderStock.released` рахує
  лише позиції з поверненням > 0, `releaseOrderItemStock.released` — повернуті
  одиниці. Зміст числа змінився лише для позиції без рядка залишку; живі
  споживачі (`cancelOwnOrder`, `changeOrderStatusOp`, `removeOrderItemOp`)
  результат не читають — оновлено JSDoc і тести
  (`order-item-stock-edges.test.ts`).

### Task 7

**Коміти етапу** (`git log --oneline f9dad58a~1..HEAD`): 30 комітів до Task 7
(план → Task 1–6 → Task 8, 21 коміт атомарних боргів) + коміт Task 7.

**Факти етапу, зафіксовані контролером:**

- **Рішення Е5б-14/Е5б-15** додано в ході виконання (директива власника
  «виправити записані, але не виправлені дрібні дефекти»): Task 8 «атомарні
  борги Е4/Е5» — після Task 6, перед Task 7.
- **Task 8 закрила К3-Е5-1** (`order-success` гостя, Е5б-15), **К3-Е5-3**
  (розпил `resource.ts`) і низку мінорів Е4/Е5/Е5б — 21 коміт, кожен 1–5
  файлів.
- **Гейт `explicit-ids` тепер приймає шортхенд `{ id }`** у вставці (раніше
  давав хибно-червоне). 🔴 Лишається межа: `id` як ЕЛЕМЕНТ МАСИВУ
  (`{ tags: [a, id, b] }`) скан приймає за ключ — хибно-зелене. Записано,
  не виправлено.
- **Одноразовий збій прогону харнеса під час Task 8** («усі skipped»,
  ймовірно збій `beforeAll`-інфраструктури) — без відтворення; рев'юер не
  знайшов залежності від порядку чи спільного стану (тимчасова БД на файл,
  тумблер у `beforeEach`). Повний ланцюг Task 7 нижче — повторна перевірка.
- **Межа Е5б-2 ширша за метод:** відмова точки видачі
  (`pickup_point_invalid`) теж мапиться в `order_shipping_unavailable`, тож
  замовлення з деактивованою відтоді точкою видачі так само нередаговане
  (мінор рев'ю Task 3 → фінальне рішення архітектора). Записано в
  `v2-state-map.md` §1/§3.1 і в роадмапі.

**`pnpm live:smoke`** (HEAD `05880cb3` + робоче дерево Task 7;
`PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55434/postgres`). Новий крок —
`scripts/live-smoke/admin-order-edit.mjs` (дії браузера —
`admin-order-edit-ui.mjs`, SQL — `admin-order-edit-sql.mjs`), викликається з
`owner-steps.mjs` після кроку замовлень Е5 усередині того самого `try`.
Зелений з першого запуску. Вивід цілком:

| Перевірка | Результат | Факт |
|---|---|---|
| http | OK | OK   GET / — 200, назва товару: Сонячна панель 600 Вт бі-фаціальна |
| http | OK | OK   GET /catalog — 200, назва товару: Сонячна панель 600 Вт бі-фаціальна, ціни(₴): true |
| http | OK | OK   GET /admin (guard) — 307 → /auth |
| http | OK | OK   GET /auth/set-password — 200 |
| http | OK | OK   GET /sitemap.xml — 200, application/xml; charset=utf-8, url-ів: 15 |
| http | OK | OK   GET /robots.txt — 200, text/plain; charset=utf-8 |
| http | OK | OK   GET /api/health — 200, status=healthy |
| sitemap lastmod W3C | OK | 12 url, зразок 2026-10-04T11:25:26.895Z |
| аватар: <img> отримав /media-URL | OK | /media/fe/fed0dadf-8bb9-4b0b-829f-9a5333e9bd93.png |
| аватар: роздача — 200 image/png із nosniff та immutable | OK | 200 image/png public, max-age=31536000, immutable |
| аватар: у profiles.avatar_url РЕФЕРЕНС, не URL | OK | fe/fed0dadf-8bb9-4b0b-829f-9a5333e9bd93.png |
| аватар: URL = база + референс | OK | /media/fe/fed0dadf-8bb9-4b0b-829f-9a5333e9bd93.png vs /media/fe/fed0dadf-8bb9-4b0b-829f-9a5333e9bd93.png |
| аватар: рядок media несе фактичний розмір і MIME | OK | 51 Б / image/png |
| аватар: видалення прибрало і обʼєкт, і рядок | OK | GET 404, рядків 0 |
| бейдж = БД | OK | stock_status=in_stock, залишок 5, очікували «В наявності», бейдж «В наявності: 5 шт» |
| JSON-LD availability | OK | stock_status=in_stock, очікували https://schema.org/InStock, отримали schema.org/InStock |
| чекаут префілено профілем покупця | OK | Тест |
| демо: одна активна точка видачі, вона ж системна | OK | точок 1, is_system true |
| єдина точка видачі обрана автоматично | OK | 1000000b-0000-4000-8000-000000000001 |
| orders +1 | OK | 0 → 1 |
| списання залишку | OK | 5 → 4, точка 1000000b-0000-4000-8000-000000000001 |
| підсумок = замовлення | OK | підсумок чекауту 4800, orders.total 4800 |
| замовлення скасовано | OK | status → cancelled |
| повернення залишку і статусу | OK | 4 → 5, stock_status in_stock → in_stock |
| адмін: запрошення → пароль → /admin | OK | owner-572ca491@example.test |
| адмін: товар у БД з клієнтським id | OK | f97d37bb-a561-4532-b623-58f215aabdf8 vs f97d37bb-a561-4532-b623-58f215aabdf8 |
| адмін: ціна з комою збережена як 1234.50 | OK | 1234.50 |
| адмін: залишок 3, статус in_stock | OK | {"quantity":3,"stock_status":"in_stock","images":["f5/f57532e8-6672-41ff-a8e2-29eda473281b.png"]} |
| адмін: у images референс, не URL | OK | ["f5/f57532e8-6672-41ff-a8e2-29eda473281b.png"] |
| вітрина: картка 200 з назвою | OK | 200 |
| вітрина: ціна 1234,50 | OK | 1 234,5 |
| вітрина: бейдж «В наявності: 3 шт» | OK |  |
| вітрина: зображення з /media | OK | /media/f5/f57532e8-6672-41ff-a8e2-29eda473281b.png |
| адмін: дубль slug → тост i18n | OK |  |
| адмін: видалення → вітрина 404, рядка немає | OK | 404 / 0 |
| адмін pageerror за весь крок каталогу | OK | 0 |
| адмін: розділ у БД, активний, image_url — референс сховища | OK | {"id":"65edada5-9355-420c-bfba-7bbb462666b1","name":"Живий розділ Е4","is_active":true,"image_url":"26/26c233c3-26af-483c-a74d-30454abfa06c.png"} |
| вітрина: /catalog показує новий розділ | OK | 200 |
| адмін: дубль slug розділу → тост i18n, рядок один | OK | тост=true, рядків=1 |
| адмін: властивість select, hasPage, isFilterable, глобальна | OK | {"id":"20d4a515-142d-4294-a500-4a6a302e576a","property_type":"select","has_page":true,"is_filterable":true,"section_id":null} |
| адмін: картка властивості без контролу типу (Е4-5) | OK | #property-type відсутній, тип — текстом |
| адмін: опція з property_id властивості | OK | {"id":"073d85aa-164f-41c2-9d43-2b06fbbfcd52","property_id":"20d4a515-142d-4294-a500-4a6a302e576a"} |
| адмін: призначення applies_to = product | OK | [{"property_id":"20d4a515-142d-4294-a500-4a6a302e576a","applies_to":"product"}] |
| адмін: у діалозі «для модифікацій» призначеної властивості немає | OK | запропоновано 0 |
| вітрина: /properties/live-dict-prop 200 з назвою опції | OK | 200 |
| адмін: тип ціни створено й видалено | OK | створено 1, лишилось 0 |
| адмін: видалення дефолтного retail — кнопка disabled | OK |  |
| адмін: тип із цінами → тост conflictReference, ціни на місці | OK | тост=true, тип=1, ціни 1→1 |
| адмін: розділ видалено, призначення зникло каскадом | OK | розділів 0, призначень 0 |
| адмін pageerror за весь крок довідників | OK | 0 |
| замовлення: покупець оформив два, обидва new | OK | new, new |
| замовлення: у позиціях stock_reserved = кількість, stock_point_id заданий | OK | [{"quantity":1,"stock_reserved":1,"stock_point_id":"1000000b-0000-4000-8000-000000000001"},{"quantity":1,"stock_reserved":1,"stock_point_id":"1000000b-0000-4000-8000-000000000001"}] |
| замовлення: залишок списано на обидва | OK | 5 → 3 |
| адмін: /admin/orders показує A — номер, сума = orders.total, бейдж | OK | 261004-0118BF: сума 4800 vs 4800, бейдж «Новий» vs «Новий» |
| адмін: /admin/orders показує B — номер, сума = orders.total, бейдж | OK | 261004-F2B318: сума 4800 vs 4800, бейдж «Новий» vs «Новий» |
| адмін: A → «Підтверджено» — статус у БД, залишок і stock_reserved без змін | OK | status confirmed, залишок 3 → 3 |
| кабінет: у підтвердженому A кнопки «Скасувати» немає | OK | бейдж «Підтверджено» видно=true, кнопок «Скасувати» 0 |
| адмін: B → «Скасовано» через діалог — cancelled, повернуто рівно кількість B, stock_reserved = 0 | OK | до підтвердження new; status cancelled; залишок 3 → 4 (B: 1); stock_reserved 0 |
| вітрина: після скасування адміном бейдж наявності = БД | OK | stock_status=in_stock, залишок 4, бейдж «В наявності: 4 шт» |
| адмін: картка B — контрол статусу вимкнений | OK | true |
| кабінет: B показано «Скасовано», кнопки «Скасувати» немає | OK | бейдж «Скасовано» видно=true, кнопок «Скасувати» 0 |
| адмін pageerror за весь крок замовлень | OK | 0 |
| покупець pageerror за весь крок замовлень | OK | 0 |
| редагування: замовлення оформлено — одна позиція, stock_reserved = 1 | OK | {"id":"a21a1027-e91a-4b23-b98e-9297795be785","slug":"sonyachna-panel-450w-mono","name":"Сонячна панель 450 Вт монокристалічна","quantity":1,"price":"4800.00","total":"4800.00","stock_reserved":1,"stock_point_id":"1000000b-0000-4000-8000-000000000001"}; залишок 4 → 3 |
| редагування: кількість 1 → 2 — stock_reserved 2, залишок −1, суми = формула | OK | залишок 3 → 2; Σ позицій 9600, subtotal 9600.00, доставка 0.00, total 9600.00 |
| редагування: додано 550 Вт пошуком — ціна рушія, stock_reserved 1, залишок його точки −1, суми = формула | OK | ціна 5900.00 vs 5900; залишок {"1000000b-0000-4000-8000-000000000001":3} → {"1000000b-0000-4000-8000-000000000001":2}; Σ позицій 15500, subtotal 15500.00, доставка 0.00, total 15500.00 |
| редагування: 550 Вт видалено — позиції немає, залишок його точки повернуто, суми = формула | OK | залишок 2 → 3; Σ позицій 9600, subtotal 9600.00, доставка 0.00, total 9600.00 |
| кабінет: після редагування «Разом» = orders.total | OK | кабінет 9600, orders.total 9600.00 |
| редагування: покупець скасував — залишки = стан до замовлення, stock_reserved = 0 | OK | status cancelled; 450 Вт 4 → 4; 550 Вт 3 → 3 |
| адмін pageerror за весь крок редагування | OK | 0 |
| покупець pageerror за весь крок редагування | OK | 0 |
| pageerror за весь прогін (кошик, order-success, кабінет) | OK | 0 |

live-smoke: ЗЕЛЕНИЙ

**Регрес.** Пари «підпис | результат» 64 рядків прогону Е5 («Факти
виконання» плану Е5) — воронка, Е3, Е4, Е5 — ідентичні й у тому самому
порядку (`diff` порожній після відкидання 8 нових рядків кроку редагування,
вставлених перед фінальним `pageerror`). Числові факти воронки й Е5
збігаються: бейдж «В наявності: 5 шт», списання 5 → 4, підсумок 4800 =
4800, повернення 4 → 5, залишок на обидва 5 → 3, скасування B 3 → 4.

**Негативний контроль.** У `inventory/order-item-release.ts` рядок
`return { released: await releaseStock(db, row, row.stockPointId) };`
замінено на `return { released: 0 };` (лічильник обнуляється, залишок не
повертається). Результат — `live-smoke: 2 FAIL`:
- «550 Вт видалено — … залишок його точки повернуто» (2 → 2);
- «покупець скасував — залишки = стан до замовлення» (550 Вт 3 → 2).
Після відкату (`git diff` файлу порожній) — зелено.

**Ручний прогін** (Step 2; окрема БД `simplycms_e5b_manual` з `pnpm db:demo`,
`pnpm build` → `node server.mjs`, Playwright-скрипт поза репо; тариф
самовивозу — `calculation_type = 'free_from'`, 150 ₴, безкоштовно від
10 000 ₴). «Пункт — факт»:
1. **Гостьове замовлення / `order-success` (К3-Е5-1) — PASS.** Після
   оформлення гостем і зняття `?token` (URL `/order-success/<id>`) сторінка
   показує номер `261004-A3F22F`, «Замовлення не знайдено» — 0,
   `user_id = NULL`, `pageerror` 0. Доставка нижче порогу: subtotal 4800,
   доставка 150, total 4950.
2. **Збільшення понад залишок — PASS.** Кількість 99 → тост «Недостатньо
   товару на складі — зміну не збережено»; позиції, залишки обох товарів і
   суми в БД побайтово ті самі; поле повернулось до «1».
3. **Гість, нова позиція — PASS.** 550 Вт пошуком: ціна 5900 (дефолтний
   тип), subtotal 10 700 ≥ порогу → доставка 0, total 10 700.
4. **Видалення до порогу безкоштовної доставки — PASS.** Видалення 550 Вт:
   subtotal 4800 → доставка 150, total 4950; картка показує «4 950».
5. **Видалення нижче `min_order_amount` (5000) — PASS.** Тост «Для нового
   складу замовлення доставка цим способом недоступна — зміну не збережено»,
   стан БД незмінний (Review Focus 3, гілка відмови).
6. **Англійська локаль діалогу — PASS.** Збірка `VITE_LOCALE=en-US`, сесія
   власника з п.1–5: діалог додавання («Add an item to the order», «Search
   by name or SKU...», «Enter at least 2 characters to search», «Add to the
   order», «← Back to search»), діалог видалення («Remove this item?», «Are
   you sure you want to remove … from the order?», «Cancel»/«Delete»), тост
   «Not enough stock — change not saved». Кирилиця — лише назви товарів із
   БД. `pageerror` 0.
🔴 Перший запуск п.3 дав FAIL (доставка 150 при subtotal 10 700) — помилка
постановки, не коду: я виставив `free_from_amount` на тарифі
`calculation_type = 'flat'`, а поріг діє лише для `free_from`
(`domain/shipping.ts:66`). Після виправлення сетапу на свіжій БД — PASS.

**Повний ланцюг** (Step 4): `PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55434/postgres`, робоче дерево
Task 7 до коміту (HEAD `05880cb3`); кроки послідовно, кожен наступний —
лише після зеленого попереднього. Усі 11 кроків зелені з першого запуску:

| Крок | rc | Підсумок |
|---|---|---|
| `pnpm install --frozen-lockfile` | 0 | — |
| `format:check` | 0 | All matched files use Prettier code style! |
| `lint` | 0 | ✖ 8 problems (0 errors, 8 warnings) |
| `build` | 0 | ✓ built |
| `typecheck` | 0 | — |
| `test` | 0 | Test Files 265 passed (265); Tests 1720 passed (1720) |
| `test:schema` | 0 | Test Files 46 passed (46); Tests 344 passed (344) — skipped 0, збій Task 8 не відтворився |
| `build:packages` | 0 | — |
| `typecheck:template` | 0 | — |
| `test:packaging` | 0 | Test Files 6 passed (6); Tests 43 passed (43) |
| `pilot:pack --skip-build` | 0 | Пілот пройдено: гейти A/C/D/IP + CLI/TOOL зелені. Gate E — SKIP за дизайном |

Нові файли Task 7 (`wc -l`): `admin-order-edit.mjs` 145,
`admin-order-edit-ui.mjs` 104, `admin-order-edit-sql.mjs` 83 — усі ≤ 150.

## Точка передачі

Артефакти: вивід повного ланцюга, `live:smoke`, ручного прогону, негативних контролів, `git log --oneline` етапу. Наступний план — **Е6а: доставка й точки видачі** (`Shipping*`, `PickupPoint*`, 7 файлів).
