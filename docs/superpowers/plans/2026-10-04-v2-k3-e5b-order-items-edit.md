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

- [ ] **Step 1: Регрес-фіксація (має бути ЗЕЛЕНИМ одразу)** — до переїзду прогнати `pnpm exec vitest run --config vitest.schema.config.ts checkout-flow storefront-loaders` і `pnpm vitest run packages/simplycms/src/core packages/simplycms/src/storefront`; зберегти вивід як еталон. Записати в тест `commerce-pricing` конкретні очікувані `price`/`basePrice`/`discountData` для 2–3 позицій демо-сиду, отримані ще СТАРИМ рушієм (оракул, аудит Codex minor).
- [ ] **Step 2: Тест (червоний)** — `commerce-pricing.test.ts`:
```ts
it('priceItems без opts дає ЗАФІКСОВАНІ до переїзду значення (price, basePrice, discountData) — оракул: очікування з checkout-flow.test.ts:~227 і явні числа демо-фікстур, записані в Step 1', async () => {});
it('extraCartTotal переводить кошик через поріг знижки «від суми» — нова позиція отримує знижку', async () => {});
it('покупець із категорією отримує свій тип ціни; гість — дефолтний', async () => {});
it('quoteShippingCost: free_from від subtotal → 0; нижче min_order_amount → null; validateShippingChoice з methodId null → shipping_unavailable', async () => {});
it('пріоритет відмов чекауту незмінний: невалідна доставка І неможливий до купівлі товар одночасно → shipping_unavailable (як до переїзду)', async () => {});
it('validateShippingChoice паритет із чекаутом: pickup з deliveryCity null і активною точкою → тариф; pickup з неактивною точкою → pickup_point_invalid; не-pickup без міста → shipping_unavailable; метод деактивовано → shipping_unavailable', async () => {});
```
Run: `pnpm exec vitest run --config vitest.schema.config.ts commerce-pricing` → FAIL (`Test Files 1`).
- [ ] **Step 3: Переїзд і правки** за Interfaces. Старі шляхи й символи: `rg "loaders/(pricing|categories|discounts|shipping|pickup-points|checkout-items)|entities/(price|discount)'" packages scripts tests` → лише `commerce/` і коментарі; плюс `rg "(loadShippingDirectory|loadPickupPoints|loadPricesByProduct|loadDefaultPriceTypeId|loadUserPriceTypeId|loadUserCategoryId|loadDiscountGroups|priceCheckoutItems|groupPricesByProduct|priceColumns)" packages scripts tests` — кожен імпорт іде з `simplycms/commerce` або сусіднього файлу всередині `commerce/`.
- [ ] **Step 4: Зелене + регрес** — Step 1 повторно (ті самі числа), `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages && pnpm pilot:pack --skip-build` (Gate C: `commerce` не в клієнтському бандлі).
- [ ] **Step 5: Коміт** — `feat(k3-e5b): серверне ціноутворення й доставка в simplycms/commerce`.

---

## Task 2: Дельта залишку по позиції (`simplycms/inventory`, Е5б-7′)

**Files:** Create `packages/simplycms/src/inventory/order-item-stock.ts`; Modify `inventory/index.ts`, `test-harness/pg/__tests__/order-stock.test.ts`.

**Interfaces** (усі — під уже взятим викликачем `orders FOR UPDATE`; функція сама бере `order_items … FOR UPDATE` своєї позиції й локи залишку через `lockTargetStock`):
- `reserveNewOrderItemStock(db, item: { orderItemId: string; orderId: string; productId: string | null; modificationId: string | null; quantity: number }): Promise<{ stockPointId: string | null; reserved: number }>` — 🔴 рядок позиції ВЖЕ вставлено викликачем (`stock_reserved = 0`); тумблер увімкнено → точка `resolveStockPoint(orders.pickup_point_id)`, `reserveStock`, `UPDATE` позиції (точка + фактично списане); вимкнено → `{ null, 0 }`, позицію не чіпає. Тести Task 2 спершу вставляють позицію, потім кличуть хелпер; кейс «рядка позиції немає» → `Error` (не мовчазне списання без лічильника).
- `adjustOrderItemStock(db, orderItemId: string, newQuantity: number): Promise<{ reserved: number }>` — за Е5б-7′ п.2–3 (зменшення повертає `min(Δ, stock_reserved)`); `InsufficientStockError` пробрасується.
- `releaseOrderItemStock(db, orderItemId: string): Promise<{ released: number }>` — за Е5б-7′ п.4, обнуляє `stock_reserved` тим самим CTE-прийомом, що `releaseOrderStock`.

- [ ] **Step 1: Тести (червоні)** у `order-stock.test.ts`:
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
- [ ] **Step 2: Реалізація** (поверх `reserveStock`/`releaseStock`/`lockTargetStock`, прямі сусідні імпорти).
- [ ] **Step 3: Зелене** — `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test`.
- [ ] **Step 4: Коміт** — `feat(k3-e5b): дельта залишку по позиції замовлення`.

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

- [ ] **Step 1: Харнес-тести (червоні)** — шапка й фікстури як `admin-orders.test.ts` (`placeOrder`, `holdOrderRowLock`, `waitForBlockedBy`, `rowLocksOnStock`, `restrictOrdersSelectForAdmin`):
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
- [ ] **Step 2: Реалізація** за Interfaces і Е5б-8.
- [ ] **Step 3: Зелене** — `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages && pnpm pilot:pack --skip-build`.
- [ ] **Step 4: Коміт** — `feat(k3-e5b): додавання, зміна кількості й видалення позицій замовлення`.

---

## Task 4: Вузький пошук товару для замовлення (Е5б-4)

**Files:** Create `admin-server/impl/products/search-for-order.ts`, `test-harness/pg/__tests__/product-search-for-order.test.ts`; Modify `admin-server/impl/index.ts`, `admin-server/index.ts`, мок.

**Interfaces:** `searchProductsForOrderInput = z.object({ query: z.string().trim().max(100) })`; `searchProductsForOrderOp → { items: Array<{ productId: string; name: string; sku: string | null; hasModifications: boolean }> }` — `query.length < 2` → `{ items: [] }` без запиту; `ilike` з екрануванням `\`, `%`, `_` (функція `escapeLike(s)` поруч + юніт-тест); пошук і за `product_modifications.sku`/`name` (повертається товар); лише `products.is_active`; `order by name, id`; `limit 20`. serverFn `searchProductsForOrder` (GET).

- [ ] **Step 1: Тести (червоні):** буквальні `%`/`_`/`\` (товар «Знижка 50%» знаходиться за «50%», а «5_» не знаходить «50»; товар зі sku `AB\12` знаходиться за `B\1`, а запит, що закінчується на `\`, не екранує наступний символ шаблону); 1 символ → порожньо; неактивний не повертається; модифікація зі збігом sku → її товар; не більше 20; не-адмін → AuthzError (Review Focus 5).
- [ ] **Step 2–3: Реалізація, зелене** — мінімальний гейт + `test:schema`.
- [ ] **Step 4: Коміт** — `feat(k3-e5b): вузький пошук товару для додавання в замовлення`.

---

## Task 5: UI — кількість і видалення позиції (Е5б-11)

**Files:** Create `admin/features/orders/detail/{useOrderItemsEdit.ts,OrderItemQuantity.tsx,RemoveOrderItemDialog.tsx}` + тести; Modify `OrderItemsTable.tsx`, `OrderDetailPage.tsx`, i18n `admin/orders.ts` (перевикористати наявні ключі `removeItemTitle`, `removeItemText`, `itemRemoved`, `updated`, `updateFailed` — перевірити `rg`).

**Interfaces:** `useOrderItemsEdit(orderId): { add(input), setQuantity(orderItemId, qty), remove(orderItemId) }` — кожен кличе свій serverFn і робить write-back за Е5б-11; `OrderItemQuantity` — поле з підтвердженням (Enter/blur), межі 1…9999; кнопка видалення прихована для останньої позиції; усе редагування вимкнене для статусу `cancelled`.

- [ ] **Step 1: Тести (червоні):** зміна кількості → `updateOrderItemQuantity` один раз → рядок і підсумки оновлені write-back-ом без `listOrderItems`; 409 `order_insufficient_stock` → тост `admin.errors.orderInsufficientStock`, поле повертається до серверного значення; видалення через діалог; скасоване — контролів немає.
- [ ] **Step 2–3: Реалізація, зелене** — мінімальний гейт, `wc -l` нових файлів.
- [ ] **Step 4: Коміт** — `feat(k3-e5b): зміна кількості й видалення позицій у картці замовлення`.

---

## Task 6: UI — діалог додавання товару

**Files:** Create `admin/features/orders/detail/{AddOrderItemDialog.tsx,ProductSearchList.tsx}` + тести; Modify `OrderDetailPage.tsx`, i18n (наявні `addItem`, `addItemTitle`, `searchPlaceholder`, `searchHint`, `searchEmpty`, `pickModification`, `modificationsEmpty`, `addToOrder`).

**Interfaces:** пошук — `searchProductsForOrder` з debounce 300 мс і скасуванням застарілої відповіді (порядок відповідей не має значення — показується відповідь на ОСТАННІЙ запит); модифікації вибраного товару — наявна колекція `productModificationsCollection` (зріз `where productId`); кількість 1…9999; «Додати» → `useOrderItemsEdit().add`; 409 `order_item_not_purchasable`/`order_insufficient_stock`/`order_shipping_unavailable` → тост, діалог лишається відкритим.

- [ ] **Step 1: Тести (червоні):** менше 2 символів — запиту немає; застаріла відповідь не перетирає нову; товар із модифікаціями вимагає вибору модифікації; успіх → діалог закрито, позиція в таблиці з write-back; помилка → тост, діалог відкритий.
- [ ] **Step 2–3: Реалізація, зелене**.
- [ ] **Step 4: Коміт** — `feat(k3-e5b): діалог додавання товару в замовлення`.

---

## Task 7: Живий прогін, доки, повний ланцюг

**Files:** Create `scripts/live-smoke/admin-order-edit.mjs`; Modify `scripts/live-smoke/owner-steps.mjs` (виклик після кроку замовлень Е5, усередині того самого `try`), `docs/tasks/{platform-roadmap,v2-state-map}.md`, `packages/README.md` (рядок `commerce/`), цей план («Факти виконання»).

- [ ] **Step 1: Крок живого прогону** (кожен рядок — `check(…)`): покупець оформлює замовлення (хелпери Е5 у ТІЙ послідовності, що `admin-orders-buyer.mjs:29`: `addToCart` → `openCheckoutPrefilled` → `submitCheckout`) → власник у картці збільшує кількість на 1 → SQL: позиція, `stock_reserved`, залишок −1, суми = формула → додає ІНШИЙ товар пошуком — `sonyachna-panel-550w-mono` (демо-сід веде для нього залишок) → SQL: знімок залишку його точки ДО додавання, нова позиція з ціною рушія, залишок −1 → видаляє її → SQL: залишок повернуто, позиції немає → покупець у кабінеті бачить новий `total` → покупець скасовує → SQL: залишок = стан до замовлення (Review Focus 2) → `pageerror` = 0.
- [ ] **Step 2: Ручний прогін** («пункт — факт»): збільшення понад залишок (тост); видалення до порогу безкоштовної доставки; англійська локаль діалогу; гостьове замовлення.
- [ ] **Step 3: Доки** — `v2-state-map.md` (§1, §2.x, §3.1, §6: редагування позицій живе; межа Е5б-2 про деактивований метод доставки); `platform-roadmap.md` (Е5б ✅, наступний — Е6а); `packages/README.md` (`commerce/`). У `CLAUDE.md` стан НЕ пишеться; якщо змінилось правило (нова тека `commerce` у Project Structure, її межа server-only) — запропонувати рядок власнику у звіті.
- [ ] **Step 4: Повний ланцюг** — команда з Global Constraints, вивід у «Факти виконання».
- [ ] **Step 5: Коміт** — `docs(k3-e5b): живий прогін редагування замовлення, карта стану й роадмап`.

---

## DoD етапу Е5б

1. `pnpm live:smoke` зелений із кроком редагування; вивід у «Факти виконання».
2. `pnpm test:schema` доводить: ціну нової позиції для покупця й гостя; дельту залишку в обидва боки, нестачу, `on_order`, необлікову позицію; скасування після редагування повертає рівно актуальне; перерахунок доставки й відмову `order_shipping_unavailable`; детерміноване очікування на локу замовлення; буквальний пошук — з негативними контролями.
3. Чекаут після переїзду рушія дає ті самі суми (регрес Task 1).
4. Повний ланцюг + `pilot:pack --skip-build` зелений; lint 0 / ≤ 8; нові файли ≤ 150 рядків.
5. Доки оновлено.

## Точка передачі

Артефакти: вивід повного ланцюга, `live:smoke`, ручного прогону, негативних контролів, `git log --oneline` етапу. Наступний план — **Е6а: доставка й точки видачі** (`Shipping*`, `PickupPoint*`, 7 файлів).
