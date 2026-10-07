# V2-К3 · Етап Е6в: знижки й категорії покупців — одна ціна на картці, у кошику й у чеку

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вісім легасі-сторінок (`Discounts`, `DiscountEdit`, `DiscountGroupEdit`, `PriceValidator`, `UserCategories`, `UserCategoryEdit`, `UserCategoryRules`, `UserCategoryRuleEdit`) переходять на `simplycms/admin-server` + `simplycms/admin-data`. Дерево груп знижок лишається, але без відомих дефектів. Покупець бачить одну й ту саму ціну на картці, у кошику й у чеку. Категорії покупців працюють і вручну, і за автоправилами. Доводить це `pnpm live:smoke`.

**Architecture:** Рушій знижок — чиста функція T1 над реєстром умов (`{ type, parse, evaluate }`) і вкладеним `DiscountContext` з обовʼязковим `now`. Ліс груп будує чиста `buildDiscountForest` з усіх рядків. Серверне ядро `priceCart` (commerce) має один контекст і один `now` на розрахунок, і його ділять чекаут, квота кошика, адмінка замовлень і діагностика ціни. Картки рахують той самий рушій над серверним середовищем `{ forest, actor, now }` (`staleTime: 0`). Кошик бере ціни з серверної квоти. Записи знижок і категорій — іменовані операції під advisory-локами конфігурації. Автоправила категорій запускаються після COMMIT замовлення і кнопкою.

**Tech Stack:** TanStack Start 1.167, `@tanstack/react-db` 0.5.3 + `@tanstack/query-db-collection` 1.3.4, Drizzle + `columnsToZod`, Zod 4, Vitest, PostgreSQL 17 (`pnpm test:schema`), Playwright (`pnpm live:smoke`).

**Spec:** [`docs/superpowers/specs/2026-10-07-discounts-customer-categories-design.md`](../specs/2026-10-07-discounts-customer-categories-design.md) (З-1…З-8). Серверний шар — [`2026-08-29-v2-k3-admin-server-layer-design.md`](../specs/2026-08-29-v2-k3-admin-server-layer-design.md). Зразки — план [Е6а](2026-10-06-v2-k3-e6a-shipping-providers.md) (guard-хук фабрики Е6а-16, lock-константи, guarded remove, live-smoke крок з прибиранням) і [Е4](2026-10-03-v2-k3-e4-catalog-dictionaries.md) (setDefault під advisory-lock, детермінований тест локу Е4-12).

**Передумова:** гілка `claude/k3-e6v-discounts-categories` від `main` 0fa3fa0a (v0.10.0); спека — коміти `881465c0`, `cc6d0766`, `4d736b4d`.

**Обсяг:** 8 легасі-файлів. Лічильник `useSupabaseClient` у `src/admin/**`: 17 → **9**.

**Редакції:**
- ред.6 (2026-10-07, виконання) — Е6в-23 (`condition_invalid`, `group_id`, `Json`), передпольотні перенесення: `contracts/cart-limits.ts` створює Task 1, `CUSTOMER_CONFIG_LOCK` — Task 5.
- ред.5 (2026-10-07) — четверте коло Codex, REJECT: 0 blocker / 2 major; знахідки третього кола закрито. Сума для тарифу доставки до вибору способу — з квоти кошика; `auth_provider` — лише оператор `=`.
- ред.4 (2026-10-07) — третє коло Codex, REJECT: 2 blocker / 1 major / 1 minor; 5 з 6 знахідок другого кола закрито, межу узгодженості Е6в-8 аудитор прийняв. Реекспорт `applyDiscount` у `core/index.ts`; межі `min_quantity` залежно від оператора; харнес `utm_source`; текст підказки UTM. Позначка *(ред.4, аудит Codex)*.
- ред.3 (2026-10-07) — друге коло Codex, REJECT: 1 blocker / 5 major; з 16 знахідок першого кола 15 закрито, 1 частково. Часткову (узгоджений знімок усього контексту) архітектор ВІДХИЛИВ з обґрунтуванням межі узгодженості в Е6в-8; межа йде канон в `data-layer.md` (Task 11). Знос `priceTypeContext` разом із реєстром `aggregate-deps`; `min_quantity` — лише ціле; UTM у статистиці явно; `addItem` повертає результат ліміту; дублікати рядків кошика. Позначка *(ред.3, аудит Codex)*.
- ред.2 (2026-10-07) — аудит Codex (`gpt-6-sol`, read-only), REJECT: 8 blocker / 8 major. Кожну знахідку перевірено кодом, усі прийнято. Рішення архітектора R1–R6 вписано в Е6в-2, 5, 6, 8, 9, 10, 13, 15, 16, 19, 22 позначкою. *(ред.2, аудит Codex)*; гейти Task 2 (харнеси `loadDiscountGroups`, фікстура історії), формула підказки, межі кошика, пара дат групи в guard, негативний контроль live-smoke, тест after-commit — виправлено в задачах.
- ред.1 (2026-10-07) — рішення власника З-1…З-8 (спека); рішення архітектора Е6в-1…Е6в-22 (розвилки 1–9, архітектор — сесія `k3-e6a-shipping-plan`); Е6в-12 уточнено архітектором: підказка показує ціну з того самого рушія, відсоток — лише для однієї `percent`-знижки.

## Ухвалені рішення етапу

| № | Рішення | Причина |
|---|---|---|
| Е6в-1 | *(архітектор)* **Схема — правкою BASELINE**, як Е6а-5: `schema.ts` + `migrations/0001_init.sql` + `drizzle/0000_init.sql` + snapshot + `pnpm template:sync`; `drizzle-kit generate` → «No schema changes» | Магазинів немає (D5), демо-бази перестворюються |
| Е6в-2 | *(архітектор)* **Склад змін схеми:** `discounts.price_type_id` → nullable (`NULL` = «для всіх типів цін»). FK `category_rules.from_category_id` і `to_category_id` → `ON DELETE RESTRICT`. `user_category_history`: `from_category_id` і `to_category_id` стають nullable з `ON DELETE SET NULL`; додаються `from_category_name text` (nullable) і `to_category_name text NOT NULL` — знімок назв, який пише вставка. `profiles`: −`auth_provider`, +`category_locked boolean NOT NULL DEFAULT false`. *(ред.2, аудит Codex)* `category_rules.conditions` — без DEFAULT (нинішній `{"type":"all","rules":[]}` — порожнє правило, яке Е6в-19 робить невалідним; форма завжди пише явно). | Правило «з VIP» не має мовчки ставати правилом «з будь-якої», а видалення категорії не має стирати правила. Історія — аудит: факт переведення переживає видалення категорії й не блокує його назавжди. `auth_provider` ніхто не пише (провайдер лежить в `accounts.provider_id`) |
| Е6в-3 | *(архітектор)* **Контекст рушія — вкладений, `now` обовʼязковий:** `DiscountContext = { customer: { categoryId: string \| null; isLoggedIn: boolean }; item: { productId: string; modificationId: string \| null; sectionId: string \| null; quantity: number }; cart: { total: number }; now: Date }` | Контракт умов, який у К5 відкриється плагінам. `now` без відкату на `new Date()`: картка, кошик і чек мусять рахувати на серверному часі |
| Е6в-4 | *(архітектор)* **Реєстр умов у `domain` (T1), без Zod:** `DiscountConditionDefinition<C> = { type: string; parse(operator: string, value: JsonValue): C \| null; evaluate(config: C, ctx: DiscountContext): boolean }`. Вбудовані (`user_category`: оператори `in`/`not_in`, значення `string[]`; `min_quantity`: `>=`/`>`/`<=`/`<`/`=`, ЦІЛЕ 1…`MAX_LINE_QUANTITY` *(ред.3, аудит Codex)*; *(ред.4, аудит Codex)* умова має бути досяжною в межах `1…MAX_LINE_QUANTITY`: `>` приймає `value ≤ MAX_LINE_QUANTITY − 1`, `<` — `value ≥ 2`, решта — `1…MAX_LINE_QUANTITY`; `min_order_amount`: ті самі оператори, невідʼємне число; `user_logged_in`: `=`, boolean) реєструються тим самим контрактом. Невідомий тип або `parse → null` — умова НЕ виконана (fail-closed). Адмінський Zod кличе той самий `parse` у `refine`, тож невідомий тип на запис відкидається. Реєстр внутрішній, плагінам відкривається в К5 | З-7. Zod у `contracts`/`domain` не імпортується (Е6а-19) |
| Е6в-5 | *(архітектор)* **Результат групи = фактично застосоване.** Оцінка групи повертає `{ amount, applied, rejected }`. `and` — усі; `or` — перший за пріоритетом; `min`/`max` — найменший/найбільший; `not` — жодної, сума 0 (семантика лишається). Переможцем може бути пряма знижка або дочірня група, і тоді в `applied` іде ВЕСЬ `applied` дитини. Програвші знижки (прямі й усі `applied` дочірніх груп, що програли) потрапляють у `rejected` з причиною `lost_to_operator`. `fixed_price` в `and` перемагає, як і тепер. Неактивна або позадатна група дає `amount 0`, а всі знижки її піддерева — `rejected` з причиною `group_inactive`/`group_out_of_dates`. *(ред.2, аудит Codex)* Кандидати групи (прямі знижки й дочірні групи) — ОДИН список, відсортований за `priority` (менше число — раніше; при рівності пряма знижка перед групою, далі за `id`). Корені обходяться за пріоритетом із залишком: внесок кореня = `min(amount, remaining)`; `applied` кореня з нульовим внеском іде в `rejected` з `exceeds_price`; при частковому обрізанні `calculatedAmount` останньої застосованої зменшується так, що Σ `calculatedAmount` = `totalDiscount` точно (у центах). | Спека §1: у `discount_data` лише те, що увійшло в суму. `PriceValidator` має пояснювати кожну знижку. Нині пряма знижка з `priority` 100 перемагає дочірню групу з 0 в `or` (`discounts.ts:234-279`), а `applied` збирається до обрізання сумою базою (`:420-428`). |
| Е6в-6 | *(архітектор)* **Причини відхилення — код, не текст:** `DiscountRejectionReason = 'inactive' \| 'out_of_dates' \| 'group_inactive' \| 'group_out_of_dates' \| 'target_mismatch' \| 'condition_failed' \| 'condition_unknown' \| 'lost_to_operator' \| 'exceeds_price'`; `RejectedDiscount = { id; name; groupName; reason: DiscountRejectionReason; conditionType: string \| null }`. Текст — i18n у `PriceValidator` | Нинішні рядки зашиті українською в T1 і не перекладаються |
| Е6в-7 | *(архітектор)* **Порожній список цілей — fail-closed** (`target_mismatch`). Запис вимагає ≥ 1 ціль, «на все» — явна ціль `all` (лише одна, без інших). Демо-сід знижок не має; усі фікстури харнеса (`fixtures/{discounts,commerce}.ts`, `checkout-flow.test.ts:492`, `aggregate-deps.test.ts:63`) ціль пишуть — правка фікстур не потрібна (виміряно 2026-10-07) | Обрив запису в легасі лишав знижку без цілей, а вона діяла на все |
| Е6в-8 | *(архітектор)* **Ліс знижок.** `loadDiscountRules(db): Promise<DiscountRules>` (commerce) читає ВСІ групи і ВСІ знижки з цілями й умовами двома-чотирма запитами. Чиста `buildDiscountForest(rules, priceTypeId, { includeInactive }): DiscountGroup[]` (domain) бере знижки з `price_type_id = T` або `NULL` і будує дерево за `parent_group_id`. Без `includeInactive` неактивні групи падають РАЗОМ із піддеревом, а неактивні знижки відкидаються; дати не обрізаються (їх оцінює рушій із `now`). Групи, недосяжні з коренів (цикл), до лісу не потрапляють. `includeInactive: true` бере ЛИШЕ `diagnosePrice` під `discount.manage`. *(ред.2, аудит Codex)* `loadDiscountRules` — ОДИН SQL-вираз (CTE + `json_agg` груп, знижок, цілей, умов): один вираз бачить один знімок і в READ COMMITTED. REPEATABLE READ не береться (чекаут пише залишки → `40001`). Межа «БД → домен» — ОДНА функція `parseDiscountRules(json: unknown): DiscountRules` (commerce): `starts_at`/`ends_at` → `Date`, `discount_value` (numeric, приходить рядком) → число явним розбором; невалідний рядок → виняток (дефект даних, не тиха знижка). *(ред.3, межа узгодженості — рішення архітектора)* Узгодженість гарантується в межах агрегата, що пишеться ОДНІЄЮ транзакцією (знижка з цілями й умовами — один SQL-знімок). Між незалежними агрегатами (категорія покупця, тип ціни, ціни товарів, правила знижок), які змінюються окремими операціями, розрахунок може поєднати стани з різних моментів, зокрема комбінацію, якої не існувало в жоден момент. Жодного інваріанта це не порушує: записане в замовлення = пораховане сервером в одній транзакції оформлення (`priceItems`), квоти перераховуються щоразу (`staleTime: 0`), грошових балансів між агрегатами немає. REPEATABLE READ для чекауту відхилено: `40001` у записуваному шляху. | Нинішній `loadGroupClosure` піднімав дітей неактивного батька в корені. Вітрина не має віддавати в браузер назви вимкнених акцій. Окремі SELECT-и (`commerce/discounts.ts:35-51`) між собою бачать `saveDiscount`, і знижка складається зі старого рядка й нових умов — стану, якого не було. |
| Е6в-9 | *(архітектор)* **Ядро ціноутворення.** `loadPricingContext(db, userId, opts?)` будує ОДИН контекст (тип ціни, категорія з відкатом на дефолтну, ліс, `now`). `priceCart(db, ctx, items, opts?)` рахує рядки з `available`. `priceItems` стає обгорткою: якщо хоч один рядок недоступний → `'not_purchasable'`, інакше `NewOrderItem[]`. `cartTotal` — сума БАЗОВИХ цін доступних рядків + `extraCartTotal`. Один `now` на весь розрахунок. *(ред.2, аудит Codex)* Суми й пороги — у центах: `toCents(value: number): number` (domain/pricing); `cart.total` складається центами; `min_order_amount` порівнюється центами. | Нині `now: new Date()` береться на кожну позицію окремо, а контекст будується в трьох місцях різним кодом. `0.1 + 0.2 > 0.3` у JS: умова `> 0.30` спрацювала б на рівному порозі. |
| Е6в-10 | *(архітектор)* **Середовище вітрини — одна транзакція `{ forest, actor, now }`.** Ключ запиту `[...AGGREGATE.discountEnvironment.key, userId]`, `staleTime: 0`. Серверного кешу немає. `userId` у ключі — лише сегмент клієнтського кешу: сервер бере актора тільки з сесії, у serverFn нічого не передається. Скидання `discountEnvironment` з адмінки — превʼю для самого адміна, і коментар у коді каже це вголос: свіжість покупцям дає `staleTime: 0`. `now` з відповіді дорівнює `now` сервера в момент запиту. *(ред.2, аудит Codex)* Середовище несе й `priceTypeId`, `defaultPriceTypeId`; базу ВСІХ карток резолвить звідти, `usePriceType` поверхні-картки не читають. `usePriceType`, `getPriceTypeContext` (`core/lib/price-type.ts`) і `AGGREGATE.priceTypeContext` зносяться в Task 3 — інших споживачів, крім трьох поверхонь-карток, немає (виміряно 2026-10-07) *(ред.3, аудит Codex)*. | Кеш без багатоінстансної інвалідації розводить картку й чек. Нині ключ без `userId`, тож після входу середовище не перезапитується. `usePriceType` кешує тип на 5 хв (`usePriceType.ts:19`): після зміни категорії картка показувала б стару базу, а квота — нову. |
| Е6в-11 | *(архітектор)* **Усі поверхні-картки рахують одним рушієм:** сітка каталогу й розділу, головна (`home`, `home-sections`), `PropertyPage`, сторінка товару. SSR лишається на базовій ціні до гідрації, як сьогодні | Інакше головна показує одну ціну, а картка — іншу. Борг (Task 11): SSR-ціна зі знижкою й `offers.price` у JSON-LD — разом із дизайном full-page кешу |
| Е6в-12 | *(архітектор)* **Порогові підказки:** `discountThresholdHints(basePrice, forest, ctx): ThresholdHint[]` (domain), `ThresholdHint = { kind: 'quantity' \| 'cart_total'; threshold: number; finalPrice: number; percentOff: number \| null }`. Підказка проганяє ТОЙ САМИЙ рушій з гіпотетичним контекстом на порозі, а не окрему формулу відсотка. Головне в підказці — ціна: «від 3 шт — 900 ₴/шт». Відсоток показується лише вторинно і лише тоді, коли на порозі застосовано рівно одну знижку типу `percent` (`percentOff` = її значення, інакше `null`). Алгоритм — у Task 1. Ціна на картці лишається без підказки. Рядок кошика отримує підказки з тих самих даних квоти | З-2. `fixed_amount`/`fixed_price`, переведені у відсоток, вводять в оману (−50 ₴ як «−4%»). `or`/`min`/`max`/`not` на порозі можуть дати іншу знижку, ніж та, чия умова спрацювала: окрема формула розійшлася б із чеком. Поріг «від суми» рахується від суми БАЗОВИХ цін кошика (Е6в-9). *(уточнення архітектора до ред.1)* |
| Е6в-13 | *(архітектор)* **Кошик з серверної квоти.** serverFn `quoteCart` → `quoteCartFor` → `priceCart`. Недоступна позиція повертається рядком `available: false` і не валить квоту. `CartItem` втрачає `price`, `basePrice`, `discountData`. Drawer, сторінка кошика, `CartSummary` і контекст слотів `cart.subtotal` (`number \| null` до першої квоти) читають квоту. `cart-ui` (T4) serverFn не імпортує: квоту передає T5-контейнер (`core/components/cart/CartDrawer.tsx`, `storefront-routes/views/slots/*`). *(ред.2, аудит Codex)* Межі кошика спільні для кошика, квоти й чекауту: `MAX_CART_LINES = 100`, `MAX_LINE_QUANTITY = 999` (T0 `contracts/cart-limits.ts`); `checkoutInputSchema` бере їх же. `cart-store.read()` валідує рядок (UUID `productId`, UUID або `null` `modificationId`, ціла `quantity` 1…`MAX_LINE_QUANTITY`, рядок `name`), відкидає невалідні, обрізає до `MAX_CART_LINES`; `updateQuantity`/`addItem` не виходять за межу. *(ред.3, аудит Codex)* `addItem` повертає `'added' \| 'limit_reached'`; дублікати пари `(productId, modificationId)` у сховищі зводяться в один рядок (кількість ≤ `MAX_LINE_QUANTITY`); валідатори `quoteCart` і `checkoutInputSchema` відкидають дубль-пари. | Ціна, запамʼятована при додаванні, не оновлювалась ні при повторному `addItem`, ні після перезавантаження |
| Е6в-14 | *(архітектор)* **Права:** нові `discount.manage` (знижки, групи, діагностика ціни) і `customer.manage` (категорії, правила, призначення, пошук покупця), обидві `{ admin: 'any' }` | Прецедент `shipping.manage` |
| Е6в-15 | *(архітектор)* **Локи.** `DISCOUNT_CONFIG_LOCK = 'discount-config'` — запис груп (guard циклу), `saveDiscount`, видалення груп. `CUSTOMER_CONFIG_LOCK = 'customer-config'` — запис і видалення категорій, setDefault, запис правил. `customerCategoryLock(userId) = 'customer-category:' + userId` — будь-яка зміна категорії одного покупця (вручну чи правилом). Лок береться ПЕРШИМ запитом транзакції через `lockCatalogTarget`. *(ред.2, аудит Codex)* Примітив — `advisoryXactLock(db: ActorDb, key: string): Promise<void>` у `simplycms/db` (ЄДИНА реалізація SQL; хешування ключа байт-у-байт як нинішній `lockCatalogTarget`); `lockCatalogTarget` стає його викликом; `commerce` бере лок через нього. **Глобальний порядок локів: `customer-config` → `discount-config`** — жодна операція не бере їх навпаки; правило записується в `docs/architecture/data-layer.md`. | Перевірка циклу й дефолту без локу не атомарна відносно паралельного запису. `commerce` за тір-зоною імпортує лише `db` (`eslint.tier-zones.mjs:105`), а `lockCatalogTarget` лежить в `admin-server/impl`. |
| Е6в-16 | *(архітектор)* **Атомарний запис знижки** — `saveDiscount`: рядок знижки (upsert за `id` викликача), цілі й умови замінюються повністю в ОДНІЙ транзакції; `id` цілей і умов генерує сервер (`randomUUID`, прецедент `product-prices/save.ts`). *(ред.2, аудит Codex)* Якщо в наборі є умова `user_category`, `saveDiscount` бере `CUSTOMER_CONFIG_LOCK`, потім `DISCOUNT_CONFIG_LOCK`, і під локом перевіряє, що всі id категорій існують, інакше `AdminConflictError('state', 'discount_condition_category_missing')`. | Легасі писав трьома незалежними запитами. Умова тримає id у jsonb без FK: без спільного локу паралельне видалення категорії лишало висяче посилання. |
| Е6в-17 | *(архітектор)* **Цикл груп:** guard фабрики (Е6а-16) для update з `parentGroupId` відмовляє, якщо новий батько — сама група або її нащадок (рекурсивний CTE під `DISCOUNT_CONFIG_LOCK`) → `AdminConflictError('state', 'discount_group_cycle')` | Спека §1 |
| Е6в-18 | *(архітектор)* **Видалення категорії** — `removeUserCategoriesOp` під `CUSTOMER_CONFIG_LOCK` відмовляє явними state-кодами: дефолтна → `user_category_default`; є покупці → `user_category_has_customers`; є правила (`from`/`to`) → `user_category_has_rules`; на неї посилається умова знижки `user_category` → `user_category_in_discount`. FK (`profiles` NO ACTION, правила RESTRICT) лишаються страховкою | Свої тости замість загального «використовується» (спека §3) |
| Е6в-19 | *(архітектор)* **Автоправила.** Профіль з `category_id NULL` оцінюється як дефолтна категорія. `auth_provider` — «будь-який рядок `accounts` має `provider_id = X`» (`UserCategoryStats.authProviders: readonly string[]`). Статистика: `LEFT JOIN order_statuses`, виключається лише `code = 'cancelled'` (замовлення з `status_id NULL` рахуються); UTM — `profiles.registration_utm->>'utm_source'` і `->>'utm_campaign'` (порожні рядки й відсутні ключі → `null`) *(ред.3, аудит Codex)*. Режим `any` = АБО, `all` = І. Після COMMIT `placeOrderFor` кличе `applyCategoryRules` в ОКРЕМІЙ транзакції `withStoreOperatorDb` у `try/catch` + `console.error`: збій правил не ламає оформлення. «Запустити всі» — keyset-порції по 100, кожен покупець у своїй транзакції, результат `{ checked, changed }`. **Скасування замовлення категорію не перераховує** (поза хвилею, вголос). *(ред.2, аудит Codex)* **Порожнє правило (`rules: []`) — fail-closed на всіх рівнях:** `parseCategoryRuleConditions` → `null`, запис → відмова, `conditionsMatch` → `false`. | Спека §3. `accounts` доступні лише `app_admin`. Інакше «вакуумна істина» (`conditions.ts:106`) при «Запустити всі» перевела б увесь магазин. |
| Е6в-20 | *(архітектор)* **Ручне призначення блокує автоправила.** `assignCustomerCategory({ userId, categoryId, reason, locked })` ставить `profiles.category_locked = locked` (за замовчуванням `true`). Автоправила пропускають заблокованих. Історія пишеться лише при зміні категорії (`changed_by` = адмін, `rule_id = null`). UI — картка покупця, наступна хвиля | Вручну призначений VIP не має стати знову «Роздрібом» після чергової покупки |
| Е6в-21 | *(архітектор)* **Знос D5:** хуки `admin.discount.form.fields`, `discount.conditions.evaluate`, `discount.before_apply`, `discount.after_apply`, `discount.types` (константи, `ALL_HOOKS`, юніон у `plugins/types.ts`, реекспорти) і порт `CatalogRepository.getDiscounts` разом з `DiscountScope`. Легасі-типи `supabase/database.ts` і легасі `Users.tsx`/`UserEdit.tsx` (наступна хвиля) не чіпаються | Їх ніхто не кличе; їх заміщує реєстр умов |
| Е6в-22 | *(архітектор)* **Дати у формах:** `toDateTimeLocal(date: Date \| null): string` і `fromDateTimeLocal(value: string): Date \| null` у `admin/lib/datetime-local.ts` — локальний час браузера власника ↔ `Date`, без `slice` ISO-рядка. На дроті `Date`, на сервері порівняння абсолютних `Date`. *(ред.2, аудит Codex)* Поле дати, яке власник не змінював, зберігає ВИХІДНИЙ `Date` (форма тримає оригінал і пише його, доки поле не `dirty`): повторена година переходу на зимовий час (2026-10-25T00:30Z і 01:30Z — обидві «03:30» у Києві) не зсувається. Змінене поле в неоднозначну годину бере зсув, який дає браузер, — записано як відома межа. | Легасі зсував дату на часовий пояс при кожному збереженні |
| Е6в-23 | *(архітектор; під час виконання, Task 1)* **Причини `condition_unknown` (тип не зареєстровано) і `condition_invalid` (зареєстрований тип, config не пройшов `parse`) — різні коди.** `DiscountRejectionReason` отримує `'condition_invalid'`; обидві fail-closed. i18n `PriceValidator` (Task 10) — два окремі рядки, тест на обидва. T0 `Discount` має `group_id: string` (NOT NULL, як `discounts.group_id`); `parseDiscountCondition` приймає `Json` з `contracts` | Для `PriceValidator` (З-4) це різні діагнози з різними діями власника: `unknown` — умова плагіна, якого немає в збірці (встановити плагін); `invalid` — пошкоджені дані умови (відкрити й зберегти знижку повторно) |

**Поза Е6в (план каже це вголос):** сторінки «Покупці», «Картка покупця», «Дашборд» (і кнопка ручного призначення та зняття блоку — там); перевірка правил за розкладом; купони й знижки кошика (З-8); збір UTM (З-6); історія категорії для покупця; перерахунок категорії при скасуванні; SSR-ціна зі знижкою й `offers.price` у JSON-LD; багатоінстансна інвалідація.

## Ступінь обовʼязковості — читати ПЕРШИМ

- **КАНОН** (розбіжність → зупинка і звернення до архітектора): рішення Е6в-1…Е6в-22, Global Constraints, імена операцій, serverFn і типів у блоках Interfaces, склад гейтів, асерти Review Focus, рядки i18n, позначені як КАНОН.
- **ОРІЄНТИР** (виконавець адаптує сам і пише про це у звіті): якорі `файл:рядок`, імена внутрішніх компонентів і хуків, розкладка JSX, розбиття UI-файлів.
- 🔴 Звіт «гейт зелений» — не доказ. Доказ — вивід команди у звіті задачі. На К3-Е2 двоє виконавців відрапортували повний ланцюг зеленим, а вісім файлів були без `prettier --write`.
- 🔴 Крок «має бути ЗЕЛЕНИМ одразу» перевіряє припущення плану. Червоний — знахідка: зупинка, а не «полагодити тест».
- 🔴 Лок доводиться детерміновано хелперами `holdAdvisoryLock`/`stillPending` (`test-harness/pg/__tests__/fixtures/advisory-lock.ts`). Тест `Promise.all` двох операцій як єдиний доказ заборонено: на К3-Е4 без локу він червонів лише в ~4 % прогонів.
- Задачі адресуються заголовками `## Task N:`; заголовок незмінний, статус — окремим рядком під ним.

## Протокол виконання

- **Ролі.** Виконує сесія-оркестратор (subagent-driven). **Архітектор — сесія `k3-e6a-shipping-plan`** (рішення Е6в-N), звернення — `SendMessage`. Автор плану — `simplycms-f4`. Ескалація ДО коду: розбіжність із КАНОНОМ; «зелений одразу» вийшов червоним; потрібне рішення, якого план не містить. Відповідь — рішення `Е6в-N`, вписане в таблицю окремим docs-комітом.
- **Рев'ю.** Після кожної задачі — рев'ю задачі (SDD). Після Task 11 — фінальне рев'ю гілки архітектором; межа дифу — від коміту спеки `881465c0` (`git diff 881465c0^..HEAD`), щоб увійшли всі коміти етапу. Архітектор у спільному дереві git не чіпає. Мерж і пуш вирішує власник.
- **Стенд.** `PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55434/postgres`. RED одного файлу харнеса: `pnpm exec vitest run --config vitest.schema.config.ts <фільтр>`.

## Global Constraints

- TypeScript 6.0 strict (`UPSTREAM:TSESL-1`). Node `>=22.12`.
- Коментарі й доки українською; рядки інтерфейсу — лише i18n (обидва каталоги `uk`/`en`, парність — `catalog-integrity.test.ts`). Гроші — `useFormatPrice()`.
- `pnpm lint` = 0 errors / 7 warnings.
- 🔴 Ліміт 150 рядків на новий або переписаний файл. `wc -l` нових файлів іде у звіт кожної задачі (на К3-Е4 без цього девʼять файлів вийшли до 350 рядків). Виняток — `admin-server/index.ts` (К3-9′). Легасі-сторінки на 423–872 рядки діляться на компоненти, а не переносяться одним файлом.
- Повний ланцюг: `pnpm install --frozen-lockfile → format:check → lint → build → typecheck → test → test:schema → build:packages → typecheck:template → test:packaging → pilot:pack --skip-build`.
- Мінімальний гейт задачі: `pnpm lint && pnpm typecheck && pnpm test`. Плюс `pnpm test:schema`, якщо зачеплено `schema/`, `migrations/`, `commerce/`, `storefront/loaders/`, `admin-server/impl/**`, `test-harness/`. Плюс `pnpm build:packages`, якщо зачеплено серверний код пакета або `exports`.
- К3-4′/К3-9′: `createServerFn` — лише топ-рівневий `const` в `admin-server/index.ts` (адмінка) або в модулі з РІВНО одним експортом-serverFn (вітрина: `core/lib/*`, `storefront-routes/server/*`); нутрощі адмінки — `admin-server/impl/**` через bare-специфікатор.
- К3-13: кожна адмін-операція йде через `runAdmin(operation, fn)`; 409 ставиться до `throw` (`stateConflict`).
- К3-7: write-back замість self-invalidation; `mutation-cache-sync` без послаблень.
- Нові serverFn адмінки — у фабрику моку `admin-server/__tests__/support/admin-server-mock.ts`.
- Ключ `id` генерує викликач (`crypto.randomUUID()`); `DEFAULT gen_random_uuid()` у схему не повертати.
- Тіри: `contracts` = T0, `domain` = T1, `commerce`/`admin-server`/`storefront`/`react-query` = T2, `cart-ui`/`catalog-ui`/`admin-data` = T4, `core`/`admin`/`storefront-routes` = T5.
- `console.log` у production-коді не лишати (`console.error` у after-commit — Е6в-19).
- Коміти: `feat(k3-e6v): …`, `test(k3-e6v): …`, `docs(k3-e6v): …`; без трейлерів `Co-Authored-By`/`Generated with`.

## Review Focus

1. **Власник зберігає знижку, а одна з умов невалідна (або транзакція обривається після запису рядка знижки)** → у БД нічого не змінилось: ні рядка знижки, ні цілей, ні умов; стара знижка, якщо редагувалась, лишилась із попереднім набором. Тест — Task 5.
2. **Покупець увійшов або вийшов, не перезавантажуючи сторінку** → картки, сторінка товару й кошик перераховуються під нову категорію: ключ середовища й квоти містить `userId`. Тест — Task 3 (ключ і refetch) і Task 4.
3. **У покупця з минулого візиту в localStorage лежить кошик старого формату** (`price`, `basePrice`, `discountData`, ціна давно змінилась) → кошик відкривається без помилки, показує ціну з квоти, а старі поля ігноруються. Тест — Task 4.
4. **Власник видаляє категорію, яку колись призначали покупцям, але зараз у ній нікого немає** → категорія видалена; рядки `user_category_history` лишились із `to_category_id = NULL` і назвою зі знімка. Категорію з покупцями, правилами чи умовою знижки видалити не можна: 409 зі своїм тостом, нічого не змінено. Тест — Task 6.
5. **Правило категорії падає (зламаний jsonb умов, обрив зʼєднання) під час оформлення замовлення** → замовлення оформлене й повернуте покупцю; помилка в `console.error`; категорія незмінна. Тест — Task 6.

Додатково: кількість рівно на порозі (`>= 3`, кількість 3) дає знижку, а 2 — підказку (Task 1); збереження форми без змін не зсуває дат у часовому поясі з переходом на літній час (Task 8); дві вкладки одночасно роблять дефолтними різні категорії → рівно одна дефолтна (Task 6, детермінований лок); позиція, що стала недоступною, в кошику показується як недоступна, а решта рахується (Task 4).

## Граф залежностей задач

```
Task 1 (рушій, реєстр, знос хуків) ─► Task 2 (схема, ліс, priceCart) ─┬─► Task 3 (середовище, картки) ─► Task 4 (кошик)
                                                                      ├─► Task 5 (сервер знижок)
                                                                      └─► Task 6 (сервер категорій, автоправила)
Task 5, 6 ─► Task 7 (колекції, кеш) ─┬─► Task 8 (UI знижок)
                                     └─► Task 9 (UI категорій і правил)
Task 5 ─► Task 10 (діагностика ціни)
Task 3, 4, 8, 9, 10 ─► Task 11 (live:smoke, доки, ланцюг)
```

Задачі виконуються послідовно, бо комітять у спільну гілку. Task 1 змінює контекст рушія, і `pnpm typecheck` мусить бути зеленим уже в Task 1: виклики адаптуються механічно (Step 3 Task 1).

## File Structure

**Створюються:**
- `src/domain/discounts/{index,types,conditions,evaluate,forest,hints}.ts` + `domain/__tests__/discounts-{engine,conditions,forest,hints}.test.ts` (замість `domain/discounts.ts` і `discounts.test.ts`);
- `src/commerce/{discount-rules,pricing-context,price-cart,customer-categories,customer-stats}.ts`;
- `src/storefront/loaders/quote-cart.ts`, `src/core/lib/cart-quote.ts`, `src/core/hooks/useCartQuote.ts`, `src/contracts/objects/cart-quote.ts`;
- `src/admin-server/impl/{discount-lock,customer-lock}.ts`, `admin-server/impl/{discount-groups,discounts,price-diagnosis,user-categories,category-rules,customers}/**`;
- `src/admin-data/collections/{discount-groups,discounts,user-categories,category-rules}.ts`, `src/admin-data/discount-cache.ts`;
- `src/admin/lib/datetime-local.ts`, `src/admin/features/{discounts,customer-categories}/**`;
- харнес: `test-harness/pg/__tests__/{discount-forest,price-cart,admin-discounts,admin-customer-categories,category-rules-after-order}.test.ts`;
- `scripts/live-smoke/admin-discounts{,-sql,-owner,-buyer,-cleanup}.mjs`.

**Змінюються:** `schema/schema.ts`, `migrations/0001_init.sql`, `drizzle/**`, копії `template:sync`; `contracts/objects/discount.ts`, `contracts/ports/index.ts`, `contracts/entities.ts`, `contracts/domain-errors.ts`; `domain/user-categories/{engine,conditions,types}.ts`; `commerce/{discounts,price-items,index}.ts`; `storefront/loaders/{prepare-checkout,place-order,home,home-sections}.ts`; `admin-server/impl/order-items/add.ts`; `core/lib/discounts.ts`, `core/hooks/useDiscountedPrice.ts`, `core/components/cart/CartDrawer.tsx`; `react-query/{cart-store,useCart}.ts*`; `cart-ui/{CartDrawer,CartItemView}.tsx`; `storefront-routes/pages/{catalog/usePricedProducts,product-detail/*,PropertyPage,home/*,Checkout}.ts*`, `storefront-routes/views/slots/{CartSummary,CartSlots}.tsx`; `auth/authz.ts`; `admin-server/{index,impl/index}.ts`, мок; `admin/lib/admin-error.ts`; `admin/pages/<вісім>.tsx` (стають реекспортами); `plugins/{hooks,types,index}.ts`; i18n; `tests/admin-server-first/registry.ts`, `tests/admin-inserts-need-id.test.ts`; `scripts/live-smoke/owner-steps.mjs`; доки.

**Видаляються:** `src/domain/discounts.ts`, `src/domain/__tests__/discounts.test.ts` (кейси переїжджають), `commerce/discounts.ts::loadGroupClosure`.

---

## Task 1: Рушій знижок, реєстр умов, знос хуків (Е6в-3…Е6в-7, Е6в-12, Е6в-21)

**Files:**
- Create: `packages/simplycms/src/domain/discounts/{index,types,conditions,evaluate,forest,hints}.ts`, `domain/__tests__/discounts-{engine,conditions,forest,hints}.test.ts`
- Modify: `contracts/objects/discount.ts` (типи), `commerce/entities/discount.ts` (мапер `toDiscount` віддає `price_type_id`), `package.json` (`exports` і `publishConfig.exports`: `./domain/discounts` → `./src/domain/discounts/index.ts`, прецедент `./domain/user-categories`), `plugins/{hooks,types,index}.ts`, `contracts/ports/index.ts`; механічна адаптація викликачів під новий контекст: `commerce/price-items.ts`, `core/hooks/useDiscountedPrice.ts`, `storefront-routes/pages/catalog/usePricedProducts.ts`, `storefront-routes/pages/product-detail/{pricing,types}.ts`, `admin/pages/PriceValidator.tsx`, `test-harness/pg/__tests__/storefront-showcase.test.ts`
- Delete: `domain/discounts.ts`, `domain/__tests__/discounts.test.ts` (8 наявних кейсів переїжджають у `discounts-engine.test.ts`)

**Interfaces:**
- Produces (T0 `contracts/objects/discount.ts`): `DiscountContext` (Е6в-3); `DiscountRejectionReason`, `RejectedDiscount` (Е6в-6); `ThresholdHint` (Е6в-12); `Discount` — +`price_type_id: string | null`; `DiscountResult` без змін форми.
- Produces (domain/pricing): `toCents(value: number): number` (Е6в-9).
- Produces (domain): `resolveDiscount(basePrice: number, forest: DiscountGroup[], ctx: DiscountContext): DiscountResult`; `DiscountConditionDefinition<C>` (Е6в-4); `getDiscountCondition(type: string): DiscountConditionDefinition<unknown> | undefined`; `parseDiscountCondition(type: string, operator: string, value: JsonValue): boolean` (для Zod адмінки: чи валідна); `BUILT_IN_DISCOUNT_CONDITIONS` — кортеж типів; `buildDiscountForest(rules: DiscountRules, priceTypeId: string | null, opts: { includeInactive: boolean }): DiscountGroup[]`; `DiscountRules = { groups: DiscountGroupRow[]; discounts: Discount[] }`, де `DiscountGroupRow = Omit<DiscountGroup, 'discounts' | 'children'> & { parent_group_id: string | null }`; `discountThresholdHints(basePrice: number, forest: DiscountGroup[], ctx: DiscountContext): ThresholdHint[]`; `countGroupSubtree(groupId: string, groups: readonly { id: string; parent_group_id: string | null }[], discounts: readonly { group_id: string }[]): { groups: number; discounts: number }` (для діалогу видалення).
- Алгоритм `discountThresholdHints` (КАНОН):
  1. Кандидати — умови `min_quantity`/`min_order_amount` знижок лісу, у яких ціль збігається з `ctx.item`. Оператор `>=` дає поріг `value`; `>` дає `value + 1` для кількості і `value + 0.01` для суми; інші оператори підказки не дають. Кандидат береться, лише якщо поріг > поточного значення (`ctx.item.quantity` або `ctx.cart.total`).
  2. Для порогу кількості T: `ctx' = { …ctx, item: { …, quantity: T }, cart: { total: max(ctx.cart.total, basePrice × q) + basePrice × (T − q) } }`, де `q = ctx.item.quantity` (решта кошика лишається, рядок доростає до T; ред.2). Для порогу суми T: `ctx' = { …ctx, cart: { total: T } }`.
  3. `r = resolveDiscount(basePrice, forest, ctx')`; `current = resolveDiscount(basePrice, forest, ctx).finalPrice`. Підказка є, якщо `r.finalPrice < current`: `finalPrice = r.finalPrice`; `percentOff = r.appliedDiscounts.length === 1 && r.appliedDiscounts[0].type === 'percent' ? r.appliedDiscounts[0].value : null`. Крок 2 відтворює кошик, у якому цей рядок доріс до T, тож підказка дорівнює ціні, яку дасть квота кошика на порозі.
  4. Сортування `kind`, потім `threshold`. Підказка, що не дешевша за попередню того самого `kind`, відкидається.

- [ ] **Step 1: Юніти (червоні).** Кожен кейс має конкретні числа; база 1000, якщо не сказано інше.
  - `discounts-engine.test.ts`: 8 перенесених кейсів; `min` → менша з двох, друга в `rejected` з `lost_to_operator`; `not` → `finalPrice 1000`, `applied` порожній; `or`, де переможець — дочірня група з двома знижками → обидві в `applied`, пряма знижка в `rejected` (`lost_to_operator`); `max` з дочірньою групою-програвшою → жодна знижка дитини не в `applied`; вкладеність на 3 рівні; неактивна група → її знижки й знижки піддерева в `rejected` з `group_inactive`; група поза датами → `group_out_of_dates`; знижка до `starts_at` (`now` задано явно) → `out_of_dates`; цілі `product`/`modification`/`section` — збіг і незбіг; `targets: []` → `target_mismatch`; сума коренів обрізається базовою ціною. Ред.2: корені −100% і −10% → `applied` лише першої, друга в `rejected` з `exceeds_price`, Σ `calculatedAmount` = `totalDiscount`; корені −700 і −500 при базі 1000 → `calculatedAmount` 700 і 300; `or` з прямою знижкою `priority 100` і дочірньою групою `priority 0` → перемагає група; рівний пріоритет → пряма знижка; `min_order_amount > 0.3` при сумі 0.1 + 0.2 → НЕ виконано.
  - `discounts-conditions.test.ts`: `user_category in [A]` для A/B; `not_in`; `min_quantity >= 3` при кількості 3 → виконано, 2 → ні; `min_order_amount > 2000` при 2000 → ні; `user_logged_in = true` для гостя → ні; невідомий тип `utm_campaign` → `condition_unknown`, знижка не застосована; `min_quantity` зі значенням `"abc"` → `parse` повертає `null`, знижка не застосована; ред.3: `min_quantity` зі значенням `2.5` або `1000` → `parse` = `null`; `min_quantity > 2` дає підказку з порогом 3, що дорівнює квоті на 3 шт. Ред.4: `> 999` → `null`; `< 1` → `null`; `> 998` → валідна, підказка з порогом 999.
  - `discounts-forest.test.ts`: неактивний батько → дитина НЕ в корені (і ніде); `includeInactive: true` → неактивна група в лісі на своєму місці; знижка з `price_type_id NULL` є в лісі для типу T; знижка типу U — немає; цикл A→B→A → обидві відсутні, решта лісу ціла.
  - `discounts-hints.test.ts`: `min_quantity >= 3` −10% при кількості 1 → `[{ kind: 'quantity', threshold: 3, finalPrice: 900, percentOff: 10 }]`; при кількості 3 → `[]`; `min_order_amount >= 2000` −5% → `{ kind: 'cart_total', threshold: 2000, finalPrice: 950, percentOff: 5 }`; `fixed_amount` 50 від 3 шт → `{ finalPrice: 950, percentOff: null }`; `min_quantity > 2` → поріг 3; оператор `<=` → `[]`; поріг 5 дешевший за поріг 3 → обидва; поріг 5 не дешевший → лише 3; ред.2: рядок 1 × 1000 при `cart.total` 5000 (інші товари на 4000), знижка в `and` з умовами `min_quantity >= 3` і `min_order_amount >= 6000` → підказка `threshold: 3` (сума на порозі 7000); група `max` з порогами «від 3 шт −10%» і «від 3 шт −50 ₴» → `finalPrice` дорівнює `resolveDiscount` з кількістю 3 (900), а в харнесі Task 4 — ціні рядка `quoteCartFor` з кількістю 3.
- [ ] **Step 2: Run** `pnpm vitest run packages/simplycms/src/domain` → FAIL (модулів ще немає).
- [ ] **Step 3: Реалізація** за Interfaces і Е6в-3…Е6в-7. Викликачі отримують новий контекст механічно, зі своїми нинішніми значеннями (`now: new Date()` у клієнтських хуках поки лишається, його прибирає Task 3; `price-items.ts` — повністю в Task 2). Знос хуків і порту — Е6в-21; `grep -rn "discount\.\(types\|conditions\|before_apply\|after_apply\)\|admin\.discount\|getDiscounts\|DiscountScope" packages docs --include=*.ts --include=*.tsx --include=*.md` → порожньо, крім спек і планів (вивід у звіт).
- [ ] **Step 4: Зелене** — Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm exec vitest run --config vitest.schema.config.ts storefront-showcase checkout-flow admin-order-items-edit-discounts` → PASS. Ці три харнес-файли мають бути ЗЕЛЕНИМИ одразу: їхні фікстури — одна група `and`, і нова семантика `applied` їх не змінює. `pnpm build:packages` (змінено `exports`).
- [ ] **Step 5: Коміт** — `feat(k3-e6v): рушій знижок з реєстром умов і чесним applied, знос мертвих хуків`.

---

## Task 2: Схема, ліс зі сховища, ядро `priceCart` (Е6в-1, Е6в-2, Е6в-8, Е6в-9)

**Files:**
- Create: `commerce/{discount-rules,pricing-context,price-cart}.ts`, `test-harness/pg/__tests__/{discount-forest,price-cart}.test.ts`
- Modify: `schema/schema.ts` (`discounts.priceTypeId`, `category_rules` FK, `user_category_history`, `profiles`), `migrations/0001_init.sql`, `drizzle/{0000_init.sql,meta/0000_snapshot.json}`, копії `pnpm template:sync`; `commerce/{discounts,price-items,index}.ts` (`loadDiscountGroups` і `loadGroupClosure` видаляються); `storefront/loaders/prepare-checkout.ts`; `admin-server/impl/order-items/add.ts`; `core/lib/discounts.ts` (мінімально: `loadDiscountGroups` → `buildDiscountForest(await loadDiscountRules(db), T, { includeInactive: false })`, форму відповіді переробляє Task 3); ред.2: споживачі `loadDiscountGroups` у харнесі — `storefront-showcase.test.ts:14,155,178` і `aggregate-deps.test.ts:149` (реєстр викликів) переходять на `loadDiscountRules` + `buildDiscountForest`; `fixtures/rls-actors.ts:93` (вставка історії) отримує `to_category_name`; `test-harness/pg/__tests__/fixtures/discounts.ts` (опційний `priceTypeCode: null`, `operator`, вкладена група)

**Interfaces:**
- Consumes: Task 1.
- `loadDiscountRules(db: ActorDb): Promise<DiscountRules>` — один SQL-вираз; `parseDiscountRules(json: unknown): DiscountRules` — єдина межа «БД → домен» (Е6в-8).
- `PricingContext = { userId: string | null; priceTypeId: string | null; defaultPriceTypeId: string | null; categoryId: string | null; isLoggedIn: boolean; forest: DiscountGroup[]; now: Date }`.
- `loadPricingContext(db: ActorDb, userId: string | null, opts?: { includeInactive?: boolean }): Promise<PricingContext>` — тип ціни й категорія персональні з відкатом на дефолтні (як нинішній `price-items.ts:85-91`), ліс через `buildDiscountForest`, `now = new Date()` ОДИН раз.
- `PricedLine = { available: true; productId: string; modificationId: string | null; name: string; quantity: number; basePrice: number; price: number; applied: AppliedDiscount[]; rejected: RejectedDiscount[]; hints: ThresholdHint[] }`; `UnavailableLine = { available: false; productId: string; modificationId: string | null; quantity: number }`.
- `priceCart(db: ActorDb, ctx: PricingContext, items: CheckoutItemInput[], opts?: { extraCartTotal?: number }): Promise<{ lines: (PricedLine | UnavailableLine)[]; cartTotal: number }>` — правила доступності дослівно з нинішнього `price-items.ts:113-127`.
- `priceItems(db, userId, items, opts?)` — сигнатура й вихід НЕЗМІННІ (Е6в-9). `discountData = { applied }` лише зі знижок, що увійшли в суму (Е6в-5).

- [ ] **Step 1: Правка baseline** (Е6в-2) + `pnpm template:sync`. Коментар у `schema.ts` біля історії пояснює, чому SET NULL зі знімком (аудит).
- [ ] **Step 2: Перевірка канону** — Run: `pnpm exec drizzle-kit generate` (конфіг пакета) → `No schema changes`; `pnpm exec vitest run --config vitest.schema.config.ts baseline grants-parity id-defaults explicit-ids single-default demo-seed seed-determinism` → PASS (має бути ЗЕЛЕНИМ одразу).
- [ ] **Step 3: Харнес (червоний).**
  - `discount-forest.test.ts`: група неактивна → `priceItems` для товару з активною знижкою в її дочірній групі дає базову ціну й `discount_data = null`; знижка з `price_type_id NULL` застосовується покупцю з типом «опт» і гостю з «роздріб»; `discount_data.applied` для кожного оператора на двох знижках 10% і 20% в одній групі (база 1000): `and` → обидві, `price` 700; `or` → перша за пріоритетом; `min` → 10%; `max` → 20%; `not` → `discount_data = null`, `price` 1000; `max` з дочірньою групою-програвшою → її знижок в `applied` немає.
  - `price-cart.test.ts`: `priceCart` для [активний товар, вимкнений товар] → рядки `available: true` і `false`, `cartTotal` = база лише першого; `priceItems` на тому самому вході → `'not_purchasable'`; кошик з двох позицій під `min_order_amount` → обидва рядки рахуються з тим самим `cartTotal`; рядок має `hints` для порогу кількості, якого ще не досягнуто.
  - ред.2: `parseDiscountRules` (юніт, `commerce/__tests__`): `starts_at: '2026-03-29T00:30:00+00:00'` → `Date` з тим самим `getTime()`; `discount_value: '12.50'` → `12.5`; `discount_value: 'abc'` → виняток. Тест-шпигун: `loadDiscountRules` робить рівно ОДИН виклик до `db` (негативний контроль: розбити на два запити → червоний).
  - Run → FAIL з очікуваної причини (немає модулів; `loadDiscountGroups` піднімає дитину в корінь).
- [ ] **Step 4: Реалізація** за Interfaces. `prepareCheckout` і `order-items/add.ts` кличуть `priceItems` як раніше.
- [ ] **Step 5: Зелене** — Run: `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages` → PASS. Негативний контроль (вивід у звіт): у `buildDiscountForest` повернути підйом сиріт у корені → перший кейс `discount-forest` червоніє.
- [ ] **Step 6: Коміт** — `feat(k3-e6v): схема знижок і категорій, ліс без сиріт, спільне ядро priceCart`.

---

## Task 3: Середовище вітрини й картки з підказками (Е6в-10…Е6в-12)

**Files:**
- Modify: `core/lib/discounts.ts`, `core/hooks/useDiscountedPrice.ts`, `core/index.ts` (−реекспорти `applyDiscount` і `usePriceType`; новий хук середовища — за потреби, ред.4), `contracts/entities.ts` (коментар ключа; −`priceTypeContext`), `test-harness/pg/__tests__/aggregate-deps.test.ts` (−`priceTypeContext` з `INVOCATIONS`)
- Delete: `core/hooks/usePriceType.ts`, `core/lib/price-type.ts` (ред.3, Е6в-10)
- Modify (UI): `storefront-routes/pages/catalog/usePricedProducts.ts`, `storefront-routes/pages/product-detail/{pricing,useProductPricing,types}.ts`, `storefront-routes/pages/PropertyPage.tsx`, `storefront-routes/pages/home/*` (`toCardViewModel` і сітки головної), `storefront/loaders/{home,home-sections}.ts` (віддають сирі ціни/ідентифікатори, потрібні рушію, якщо їх ще немає), `ProductPriceBlock.tsx` і картка каталогу (рядок підказки), i18n `product.ts`, `catalog.ts`
- Create: `storefront-routes/pages/__tests__/card-pricing.test.tsx`, `core/hooks/__tests__/discount-environment.test.tsx`

**Interfaces:**
- Consumes: `loadPricingContext` (Task 2), `resolveDiscount`, `discountThresholdHints` (Task 1).
- `DiscountEnvironment = { forest: DiscountGroup[]; actor: { userId: string | null; categoryId: string | null; isLoggedIn: boolean }; priceTypeId: string | null; defaultPriceTypeId: string | null; now: Date }` (ред.2, Е6в-10); `getDiscountEnvironment` — ОДНА транзакція (`withCustomerDb` для залогіненого, `withStorefrontDb` для гостя) через `loadPricingContext`; модуль лишається з рівно одним експортом-serverFn.
- `useDiscountEnvironment(): { data: DiscountEnvironment | undefined; isLoading: boolean }` — ключ `[...AGGREGATE.discountEnvironment.key, user?.id ?? null]`, `staleTime: 0` (Е6в-10).
- `priceForCard(basePrice: number, env: DiscountEnvironment, item: { productId: string; modificationId: string | null; sectionId: string | null }): { price: number; basePrice: number; hints: ThresholdHint[] }` — `quantity: 1`, `cart.total: 0`, `now: env.now`. Єдина функція для всіх поверхонь Е6в-11 (ОРІЄНТИР: файл у `storefront-routes/pages/pricing/`).
- i18n (КАНОН): uk `product.discountHint.quantity` = «від {threshold} шт — {price}/шт», `product.discountHint.cartTotal` = «від {amount} у кошику — {price}/шт», `product.discountHint.percent` = « (−{percent}%)» (додається лише при `percentOff !== null`); en — «from {threshold} pcs — {price}/pc», «from {amount} in cart — {price}/pc», « (−{percent}%)». `price`, `amount` — через `useFormatPrice`.

- [ ] **Step 1: Тести (червоні).**
  - `discount-environment.test.tsx`: ключ запиту для гостя `[…, null]`, після входу `[…, 'u1']` → новий запит serverFn; `staleTime === 0` (повторний mount кличе serverFn вдруге). Ред.2: перший запит середовища дає `priceTypeId: 'retail'`, повторний (покупця перевели в категорію з типом «опт») — `'wholesale'` → картка після повторного mount показує оптову базу без перезавантаження сторінки.
  - Харнес (`discount-forest.test.ts`, ред.2): `getDiscountEnvironment`-лоадер для групи, вимкненої разом із активною дитиною, віддає ліс, у якому немає ні батька, ні дитини (назва вимкненої акції не йде в браузер).
  - `card-pricing.test.tsx`: середовище з `now` = 2026-01-01 і знижкою, що закінчилась 2025-12-31, при системному годиннику 2025-12-30 (`vi.setSystemTime`) → знижки на картці НЕМАЄ (рахується за `env.now`, не за браузером); знижка `min_quantity >= 3` −10% (база 1000) → ціна 1000, рядок «від 3 шт — 900 ₴/шт (−10%)»; та сама знижка показана однаково на картці каталогу, головної й `PropertyPage` (три рендери, одна фікстура середовища).
- [ ] **Step 2: Реалізація.** Поверхні-картки беруть базу з середовища, а не з `usePriceType`; `rg -n "usePriceType|getPriceTypeContext" packages/simplycms/src` після правки → порожньо поза тестами; так само `rg -n "applyDiscount" packages/simplycms/src` → порожньо (ред.4); хук, serverFn (`core/lib/price-type.ts`) і `AGGREGATE.priceTypeContext` зносяться РАЗОМ із записом `priceTypeContext` у `INVOCATIONS` (`aggregate-deps.test.ts:137`; реєстр типізовано `Record<keyof typeof AGGREGATE, …>`, ред.3) і з реекспортом у `core/index.ts`, якщо він є (вивід `rg` у звіт). `applyDiscount` з `now: new Date()` видаляється; усі поверхні Е6в-11 рахують через `priceForCard`. Головна, якщо її лоадер віддає готову ціну, повинна віддавати базову ціну й `sectionId`, а знижку на клієнті рахує `priceForCard`.
- [ ] **Step 3: Зелене** — Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm exec vitest run --config vitest.schema.config.ts aggregate-deps checkout-flow` → PASS (`aggregate-deps` має лишитись зеленим одразу: таблиці ті самі). `wc -l` змінених UI-файлів — у звіт.
- [ ] **Step 4: Коміт** — `feat(k3-e6v): картки рахують знижку на серверному часі, порогові підказки`.

---

## Task 4: Кошик із серверної квоти (Е6в-13)

**Files:**
- Create: `contracts/objects/cart-quote.ts` (+ реекспорт із бареля `contracts`), `storefront/loaders/quote-cart.ts`, `core/lib/cart-quote.ts`, `core/hooks/useCartQuote.ts`, тести
- Modify: `contracts/entities.ts` (`AGGREGATE.cartQuote` з deps `products`, `productModifications`, `productPrices`, `priceTypes`, `profiles`, `userCategories`, `discounts`, `discountTargets`, `discountConditions`, `discountGroups`), `test-harness/pg/__tests__/aggregate-deps.test.ts` (реєстр викликів: `quoteCartFor`), `react-query/{cart-store.ts,useCart.tsx}`, `storefront-routes/pages/product-detail/cart-item.ts`, `cart-ui/{CartDrawer,CartItemView}.tsx`, `core/components/cart/CartDrawer.tsx` (стає контейнером), `storefront-routes/views/slots/{CartSummary,CartSlots,ProductAddToCart}.tsx`, `storefront-routes/server/checkout-input.ts`, i18n `cart.ts`, `storefront-routes/pages/Checkout.tsx` (`cart.subtotal` слотів), тести кошика (`cart-hydration`, `cart-slots`, `cart-view`, `product-slots`, `slots-harness`)

**Interfaces:**
- Consumes: `priceCart`, `loadPricingContext` (Task 2); компонент рядка підказки (Task 3).
- `CartQuoteLine = { available: true; productId: string; modificationId: string | null; quantity: number; name: string; basePrice: number; price: number; applied: { name: string; calculatedAmount: number }[]; hints: ThresholdHint[] } | { available: false; productId: string; modificationId: string | null; quantity: number }`; `CartQuote = { lines: CartQuoteLine[]; subtotal: number }` (`subtotal` = Σ `price × quantity` доступних).
- `quoteCartFor(items: CheckoutItemInput[], userId: string | null): Promise<CartQuote>` — `withCustomerDb`/`withStorefrontDb`, `loadPricingContext` + `priceCart`.
- serverFn `quoteCart` (`core/lib/cart-quote.ts`, рівно один експорт): `POST`, валідатор `{ items: { productId: uuid; modificationId: uuid | null; quantity: int 1..999 }[] }`, `max(100)`; порожній масив → `{ lines: [], subtotal: 0 }` без звернення до БД.
- `useCartQuote(): { quote: CartQuote | null; isLoading: boolean }` — ключ `[...AGGREGATE.cartQuote.key, userId, items.map(i => [i.productId, i.modificationId, i.quantity])]`, `staleTime: 0`, лише після `hydrated`.
- `MAX_CART_LINES = 100`, `MAX_LINE_QUANTITY = 999` у `contracts/cart-limits.ts` (T0; + субшлях або реекспорт за прецедентом Е6а-21); `checkoutInputSchema` і валідатор `quoteCart` беруть їх (ред.2, Е6в-13).
- `CartItem = { productId: string; modificationId: string | null; name: string; modificationName?: string; quantity: number; image?: string; sku?: string }`. `cart-store.read()` відкидає зайві поля старого формату й рядки без `productId`/`quantity`.
- `useCart().totalPrice` видаляється; сума — лише з квоти. Ред.3: `addItem(...): 'added' | 'limit_reached'`; `ProductAddToCart` на `'limit_reached'` показує тост `cart.limitReached` замість `product.addedToCart`. i18n (КАНОН): uk `cart.limitReached` = «Досягнуто межу кошика: до {lines} позицій і до {quantity} шт кожної»; en — «Cart limit reached: up to {lines} items and {quantity} pcs of each». Контекст слотів: `cart: { items, subtotal: number | null }`. Ред.5: сума, від якої `CheckoutDeliveryForm` рахує тарифи до вибору способу (`indicativeSubtotal`, `Checkout.tsx:219`), — `useCartQuote().quote.subtotal`; після успішної квоти оформлення — її `subtotal`; до першої квоти кошика тариф показується станом завантаження, а не від `0`.

- [ ] **Step 1: Тести (червоні).**
  - Харнес `price-cart.test.ts` (доповнення): `quoteCartFor` гостя й покупця з категорією → ціни збігаються з `quoteCheckoutFor` на тих самих позиціях (картка-кошик-чек: одне ядро); вимкнений товар у кошику → рядок `available: false`, `subtotal` без нього. Група `max` з порогами «від 3 шт −10%» і «від 3 шт −50 ₴»: `hints[0].finalPrice` рядка з кількістю 1 дорівнює `price` рядка `quoteCartFor` з кількістю 3 (підказка = квота на порозі, Е6в-12).
  - `cart-store` (Review Focus 3): localStorage `[{ productId, modificationId: null, name, price: 999, basePrice: 1200, discountData: {…}, quantity: 2 }]` → `items[0]` без `price`/`basePrice`/`discountData`, `quantity: 2`; сміття (`{}`, рядок, `quantity: -1`, `quantity: 1.5`, `productId: 'x'`) → рядок відкинуто без винятку; 150 рядків → 100; `updateQuantity(…, 1000)` → кількість 999; `checkoutInputSchema` з `quantity: 1000` → помилка (ред.2). Ред.3: два рядки тієї самої пари по 999 у сховищі → один рядок, `quantity: 999`; `quoteCart`/`checkoutInputSchema` з дубль-парою → помилка валідації; кнопка товару на 100-му рядку або при 999 шт → тост «Досягнуто межу кошика…», а не «Додано до кошика». Ред.5: спосіб із безкоштовною доставкою від 5000 і кошик на 6000 → ДО вибору способу список показує «Безкоштовно» (сума з квоти кошика); поки квоти кошика немає — стан завантаження тарифу.
  - `useCartQuote`: зміна кількості → новий ключ і запит; `userId` у ключі.
  - `CartDrawer`/`CartItemView`: рядок показує `price` і закреслену `basePrice` з квоти, назви застосованих знижок; рядок `available: false` → «Товар недоступний», сума без нього; поки квоти немає — скелет суми, а не 0.
  - `CartSummary`: `subtotal` з квоти; `Checkout` передає слотам `cart.subtotal` з квоти.
- [ ] **Step 2: Реалізація.** `buildCartItem` більше не рахує ціну. `addItem` для наявної позиції лише збільшує кількість, бо ціни в кошику немає.
- [ ] **Step 3: Зелене** — Run: `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages && pnpm typecheck:template` → PASS (`typecheck:template`, бо теми магазину читають `useCart`). `wc -l` — у звіт.
- [ ] **Step 4: Коміт** — `feat(k3-e6v): кошик бере ціни й знижки з серверної квоти`.

---

## Task 5: Права й серверні операції знижок (Е6в-14…Е6в-17)

**Files:**
- Create: `admin-server/impl/discount-lock.ts`, `admin-server/impl/discount-groups/{resource,guards,remove}.ts`, `admin-server/impl/discounts/{resource,get,save,save-input}.ts`, `test-harness/pg/__tests__/admin-discounts.test.ts`
- Modify: `auth/authz.ts` (+ тести матриці: `discount.manage`, `customer.manage`), `contracts/domain-errors.ts`, `admin/lib/admin-error.ts`, i18n `admin/errors.ts`, `admin-server/impl/index.ts`, `admin-server/index.ts`, мок

**Interfaces:**
- `DISCOUNT_CONFIG_LOCK = 'discount-config'`.
- `discountGroupsOps = defineAdminResource({ entity: ENTITY.discountGroups, table: discountGroups, operation: 'discount.manage', mode: 'eager', lock: DISCOUNT_CONFIG_LOCK, guard: guardDiscountGroups, writable: [name, description, operator, isActive, priority, startsAt, endsAt, parentGroupId], … })`. `guardDiscountGroups` — Е6в-17 (`discount_group_cycle`) і пара дат (ред.2: `refine` фабрики поколонковий, `resource-schemas.ts:18`): для insert — з рядка, для update — злиття поточного рядка з patch; `startsAt >= endsAt` → `discount_group_dates_invalid`.
- `removeDiscountGroupsOp({ data: { id }[] }) → { removed: string[] }` — під локом, каскад піддерева.
- `discountsOps` — `mode: 'eager'`, `writable: []` (запис лише через `saveDiscount`), `remove` — generic фабрики (цілі й умови йдуть каскадом).
- `getDiscountOp({ data: { id } }) → { discount: DiscountRow; targets: DiscountTargetRow[]; conditions: DiscountConditionRow[] }`.
- `saveDiscountInput` (КАНОН): `{ id: uuid; groupId: uuid; name: string trim 1..200; description: string ≤ 2000 | null; discountType: 'percent' | 'fixed_amount' | 'fixed_price'; discountValue: number > 0 (для percent ≤ 100); priceTypeId: uuid | null; priority: int; isActive: boolean; startsAt: Date | null; endsAt: Date | null (startsAt < endsAt); targets: ({ targetType: 'all'; targetId: null } | { targetType: 'product' | 'modification' | 'section'; targetId: uuid })[] 1..200, де 'all' — лише єдиним елементом; conditions: { conditionType: string; operator: string; value: JsonValue }[] ≤ 20, кожна проходить parseDiscountCondition }`.
- `saveDiscountOp({ data }) → { discount; targets; conditions }` — Е6в-16 під `DISCOUNT_CONFIG_LOCK`.
- serverFn: `listDiscountGroups`, `insertDiscountGroups`, `updateDiscountGroups`, `removeDiscountGroups`, `listDiscounts`, `getDiscount`, `saveDiscount`, `removeDiscounts`.
- Нові state-коди: `discount_group_cycle` (тост «Група не може бути вкладена у власну підгрупу»), `discount_group_dates_invalid`, `discount_condition_category_missing` (ред.2).

- [ ] **Step 1: Харнес (червоний)** — шапка як `admin-shipping.test.ts`:

```ts
describe('admin: знижки (Е6в, Task 5)', () => {
  it('saveDiscount з невалідною умовою (min_quantity "abc") → 400; SQL: знижки, цілей і умов немає', async () => {});
  it('saveDiscount існуючої з новим набором → старі цілі й умови видалені, нові записані, id цілей нові', async () => {});
  it('обрив після запису рядка знижки (тригер-фікстура RAISE на insert discount_conditions) → рядок знижки й старі цілі незмінні', async () => {});
  it('saveDiscount з targets: [] → 400; з [all, product] → 400', async () => {});
  it('update групи parentGroupId = власний id → discount_group_cycle; = онук → discount_group_cycle; SQL незмінний', async () => {});
  it('guard циклу стоїть, поки зовнішній тримає DISCOUNT_CONFIG_LOCK (holdAdvisoryLock/stillPending)', async () => {});
  it('removeDiscountGroups батька → піддерево груп і знижок видалено каскадом', async () => {});
  it('saveDiscount з priceTypeId null → рядок з NULL; priceItems застосовує його для двох типів цін', async () => {});
  it('startsAt рівно 2026-03-29T00:30:00Z записується і читається тим самим Date', async () => {});
  it('не-адмін → AuthzError, нічого не змінено', async () => {});
  it('ред.2: insert групи з endsAt < startsAt → discount_group_dates_invalid; update лише endsAt раніше наявного startsAt → те саме; рядок незмінний', async () => {});
  it("ред.2: saveDiscount з user_category in [неіснуючий id] → discount_condition_category_missing; нічого не записано", async () => {});
  it('ред.2: зовнішнє зʼєднання тримає CUSTOMER_CONFIG_LOCK → saveDiscount з умовою user_category stillPending; без такої умови — проходить', async () => {});
});
```

🔴 Порожні тіла вище — лише перелік кейсів. До запуску RED кожен `it` написаний повністю: виклик операції, точний `kind`/`constraint`, SQL-стан після відмови. Звіт показує, що кожен падає з ОЧІКУВАНОЇ причини, а не проходить порожнім. Кейс обриву — Review Focus 1.

Негативний контроль (вивід у звіт): прибрати `lockCatalogTarget` з guard-шляху → тест локу червоніє; писати цілі поза транзакцією (окремий `runAdmin`) → червоніє кейс обриву.

- [ ] **Step 2: Реалізація** за Interfaces; тост для `discount_group_cycle` — `adminErrorKey` + i18n.
- [ ] **Step 3: Зелене** — Run: `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages && pnpm pilot:pack --skip-build` → PASS; Gate C зелений.
- [ ] **Step 4: Коміт** — `feat(k3-e6v): атомарний запис знижки і групи без циклів під discount-config lock`.

---

## Task 6: Категорії покупців і автоправила на сервері (Е6в-15, Е6в-18…Е6в-20)

**Files:**
- Create: `db/advisory-lock.ts` (ред.2, Е6в-15: `advisoryXactLock`; `admin-server/impl/catalog-lock.ts` стає його викликом; експорт з `simplycms/db`), `commerce/{customer-categories,customer-stats}.ts`, `admin-server/impl/customer-lock.ts`, `admin-server/impl/user-categories/{resource,set-default,remove,counts}.ts`, `admin-server/impl/category-rules/{resource,guards,run-all}.ts`, `admin-server/impl/customers/{assign-category,find}.ts`, `test-harness/pg/__tests__/{admin-customer-categories,category-rules-after-order}.test.ts`
- Modify: `domain/user-categories/{engine,conditions,types,index}.ts` (+ тести), `storefront/loaders/place-order.ts`, `commerce/index.ts`, `contracts/domain-errors.ts`, `admin/lib/admin-error.ts`, i18n `admin/errors.ts`, `admin-server/{index,impl/index}.ts`, мок

**Interfaces:**
- domain: `UserCategoryStats.authProvider` → `authProviders: readonly string[]`; `conditionsMatch` — `any` = АБО, `all` = І (тест `any = AND` переписується); `evaluateCategoryRules(rules, currentCategoryId: string, stats)` — `currentCategoryId` не-null (Е6в-19); `parseCategoryRuleConditions(json: unknown): CategoryRuleConditions | null` (ручний guard для Zod адмінки). Ред.5: допустимі оператори за полем — числові (`total_purchases`, `orders_count`, `registration_days`): `>=`/`>`/`<=`/`<`/`=`; текстові (`email_domain`, `utm_source`, `utm_campaign`): `=`/`contains`; `auth_provider`: лише `=` — інший оператор → `null`.
- commerce: `loadCustomerStats(db: ActorDb, userId: string, now: Date): Promise<UserCategoryStats | null>` (SQL — Е6в-19; email — `users.email`; UTM — з `registration_utm`, ред.3); `applyCategoryRules(db: ActorDb, userId: string): Promise<'changed' | 'unchanged' | 'skipped'>` — лок `customerCategoryLock(userId)`, `profiles … FOR UPDATE`, `category_locked` → `'skipped'`, `NULL` → дефолтна, активні правила, запис профілю й історії зі знімком назв; `writeCategoryChange(db, { userId, fromCategoryId, toCategoryId, reason, ruleId, changedBy }): Promise<void>`.
- `customerCategoryLock(userId: string): string` живе в `commerce` (ним користуються і вітрина, і адмінка).
- `userCategoriesOps` — eager, `operation: 'customer.manage'`, `lock: CUSTOMER_CONFIG_LOCK`, `writable: [name, code, description, priceTypeId]`, `readonly: [isDefault, createdAt]`; `setDefaultUserCategoryOp({ data: { id } }) → { rows }` (патерн `price-types/set-default.ts`); `removeUserCategoriesOp` — Е6в-18; `countCustomersByCategoryOp() → { categoryId: string; customers: number }[]`.
- `categoryRulesOps` — eager, `lock: CUSTOMER_CONFIG_LOCK`, `writable: [name, description, fromCategoryId, toCategoryId, conditions, isActive, priority]`, `refine.conditions` через `parseCategoryRuleConditions`; guard: `fromCategoryId === toCategoryId` → `category_rule_same_category`.
- `runCategoryRulesOp() → { checked: number; changed: number }` — Е6в-19 (keyset по `profiles.id`, порції по 100).
- `assignCustomerCategoryOp({ data: { userId: uuid; categoryId: uuid; reason: string 1..500; locked: boolean = true } }) → { categoryId: string; locked: boolean }` — Е6в-20.
- `findCustomersOp({ data: { query: string 2..100 } })` під `customer.manage` → { userId: string; email: string; name: string | null; categoryName: string | null }[]` (≤ 20; для діагностики ціни, Task 10).
- serverFn: `listUserCategories`, `insertUserCategories`, `updateUserCategories`, `removeUserCategories`, `setDefaultUserCategory`, `countCustomersByCategory`, `listCategoryRules`, `insertCategoryRules`, `updateCategoryRules`, `removeCategoryRules` (generic), `runCategoryRules`, `assignCustomerCategory`, `findCustomers`.
- Нові state-коди: `user_category_default`, `user_category_has_customers`, `user_category_has_rules`, `user_category_in_discount`, `category_rule_same_category`.

- [ ] **Step 1: Юніти рушія категорій (червоні):** `any` з двома умовами, з яких виконана одна → правило спрацювало; `all` → ні; `auth_provider = google` при `authProviders: ['credential', 'google']` → так; ред.2: `rules: []` → `parseCategoryRuleConditions` = `null`, `conditionsMatch` = `false`; ред.5: `auth_provider contains goog` → `parseCategoryRuleConditions` = `null`, а `insertCategoryRules` з такою умовою → помилка валідації (харнес).
- [ ] **Step 2: Харнес (червоний).**
  - `admin-customer-categories.test.ts`: видалення дефолтної → `user_category_default`; з покупцем → `user_category_has_customers`; з правилом → `user_category_has_rules`; з умовою знижки `user_category in [id]` → `user_category_in_discount`; у кожному кейсі SQL після відмови: категорія, профілі, правила на місці. Категорія без покупців, але з історією → видалена, історія лишилась з `to_category_id NULL` і `to_category_name` = стара назва (Review Focus 4). setDefault: стара знята, нова стоїть; setDefault стоїть, поки зовнішній тримає `CUSTOMER_CONFIG_LOCK`. `assignCustomerCategory` → профіль, `category_locked = true`, рядок історії з `changed_by` = адмін і `rule_id NULL`; повтор із тією самою категорією й `locked: false` → історії не додалось, `category_locked = false`. `runCategoryRules`: 3 покупці, з них 1 відповідає правилу, 1 заблокований (теж відповідає) → `{ checked: 3, changed: 1 }`, заблокований без змін.
  - `category-rules-after-order.test.ts`: правило «`orders_count >= 2` → VIP»: перше замовлення → категорія незмінна; друге → VIP, історія з `rule_id`. Скасоване перше замовлення не рахується (`orders_count` = 1 після другого). Замовлення з `status_id NULL` рахується. Ред.2: `applyCategoryRules` кидає виняток (`vi.mock('simplycms/commerce', importOriginal)` з підміною лише цієї функції) → `placeOrderFor` повертає `ok: true`, замовлення в БД (COMMIT відбувся), категорія незмінна, `console.error` викликано рівно раз (Review Focus 5). Окремо: зламаний jsonb умов правила (SQL в обхід Zod) → правило не спрацьовує, замовлення оформлене. Порожнє правило з `to` = VIP + `runCategoryRules` → `changed: 0`. Ред.3: правило `utm_campaign = spring` → покупець з `registration_utm = {"utm_campaign":"spring"}` переведений, покупець з `{}` — ні. Ред.4: правило `utm_source = google` → покупець з `{"utm_source":"google"}` переведений, покупець без ключа `utm_source` — ні. Тест локу (ред.2, Е6в-15): зовнішнє зʼєднання тримає `lockCatalogTarget(k)` → `advisoryXactLock(k)` stillPending; і навпаки. Гість → правила не викликаються.
  - Run → FAIL з очікуваної причини.
- [ ] **Step 3: Реалізація.** У `place-order.ts` виклик іде ПІСЛЯ `await run(...)` і лише при `ok: true` та `userId !== null`; `try/catch` навколо `withStoreOperatorDb((db) => applyCategoryRules(db, userId))`, у `catch` — `console.error` з префіксом `[simplycms/storefront]`.
- [ ] **Step 4: Зелене** — Run: `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages && pnpm pilot:pack --skip-build` → PASS; наявні тести локів Е4/Е6а/Е6б зелені БЕЗ змін (доказ, що хешування ключа не змінилось). Негативний контроль (вивід у звіт): прибрати `try/catch` після COMMIT → кейс винятку з `applyCategoryRules` червоніє; прибрати перевірку `category_locked` → кейс `runCategoryRules` червоніє.
- [ ] **Step 5: Коміт** — `feat(k3-e6v): категорії покупців і автоправила після замовлення`.

---

## Task 7: Колекції адмінки й скидання кешу

**Files:**
- Create: `admin-data/collections/{discount-groups,discounts,user-categories,category-rules}.ts`, `admin-data/discount-cache.ts`, `admin-data/__tests__/discount-collections.test.tsx`
- Modify: `admin-data/index.ts`

**Interfaces:**
- Колекції — за зразком `collections/shipping-zones.ts` (eager, `persistenceHandlers`, `ref`-комірка). Колекція `discounts` має лише `remove` (запис іде через `saveDiscount` і `writeBatch(writeUpsert)`).
- `invalidateDiscountConsumers(queryClient: QueryClient): Promise<void>` — інвалідує `AGGREGATE.discountEnvironment.key` і `AGGREGATE.cartQuote.key` (префіксом: варіанти з `userId`; `priceTypeContext` знесено в Task 3, ред.3). Коментар (КАНОН, Е6в-10): «превʼю для адміна; покупцям свіжість дає `staleTime: 0`». Кличеться в `afterWrite` усіх чотирьох колекцій і в хуках іменованих операцій (Task 8/9: `saveDiscount`, `removeDiscountGroups`, `setDefaultUserCategory`, `removeUserCategories`, `runCategoryRules`).

- [ ] **Step 1: Тест (червоний)** — insert/update/remove групи й категорії через колекцію → `isInvalidated === true` для `[...AGGREGATE.discountEnvironment.key, 'u1']` і `[...AGGREGATE.cartQuote.key, null, []]`; write-back без refetch колекції.
- [ ] **Step 2: Реалізація.**
- [ ] **Step 3: Зелене** — Run: `pnpm lint && pnpm typecheck && pnpm test` → PASS.
- [ ] **Step 4: Коміт** — `feat(k3-e6v): колекції знижок і категорій, скидання середовища цін`.

---

## Task 8: Адмінка знижок — дерево, група, знижка (З-1, Е6в-4, Е6в-7, Е6в-22)

**Files:**
- Create: `admin/lib/datetime-local.ts` (+ тест), `admin/features/discounts/{tree,group,discount}/**` (+ `__tests__/`)
- Modify: `admin/pages/{Discounts,DiscountEdit,DiscountGroupEdit}.tsx` → однорядкові реекспорти; i18n `admin/discounts.ts`; `tests/admin-server-first/registry.ts` (−3 записи) і `tests/admin-inserts-need-id.test.ts` (`KNOWN_WITHOUT_ID` −4: `DiscountEdit` ×3, `DiscountGroupEdit` ×1; число виміряти й записати рядком журналу) — у ЦІЙ задачі

**Interfaces:**
- Consumes: колекції Task 7, serverFn Task 5, `countGroupSubtree`, `BUILT_IN_DISCOUNT_CONDITIONS`.
- Дерево: групи з оператором, активністю (перемикач → `updateDiscountGroups`), датами; знижки під групою з типом ціни («усі типи» для `NULL`). Видалення групи — `AlertDialog` з текстом «Буде видалено груп: {groups}, знижок: {discounts}» (`countGroupSubtree`).
- Група: батьків для вибору показує БЕЗ самої групи і її нащадків; 409 `discount_group_cycle` → тост.
- Знижка: поля `saveDiscountInput`; цілі (`all` вимикає інші); умови за реєстром: поле для кожного вбудованого типу, невідомий тип — рядок «Невідома умова: {type}» без редагування, з кнопкою видалення; дати — `datetime-local` через Е6в-22. Збереження — один виклик `saveDiscount`, далі `writeBatch(writeUpsert)` у колекцію `discounts` і `invalidateDiscountConsumers`.
- `toDateTimeLocal`/`fromDateTimeLocal` — Е6в-22.

- [ ] **Step 1: Тести (червоні).**
  - `datetime-local.test.ts` (`process.env.TZ = 'Europe/Kyiv'` на рівні файлу): `fromDateTimeLocal(toDateTimeLocal(d))` дорівнює `d`, обрізаній до хвилин, для 2026-03-29T00:30Z (день переходу) і 2026-10-25T00:30Z; `''` → `null`; `'abc'` → `null`. Ред.2: картка знижки зі `startsAt` = 2026-10-25T01:30Z (друга «03:30»), збережена без зміни поля → `saveDiscount` отримав `getTime()` вихідного значення.
  - Картка знижки: завантажили знижку з `startsAt` і зберегли без змін → `saveDiscount` отримав той самий `Date` (Review Focus, додаток); умова невідомого типу показана й не ламає форму; спроба зберегти без цілей → повідомлення валідації, `saveDiscount` не викликаний.
  - Картка групи: у select батька немає самої групи й онука.
  - Дерево: діалог видалення групи з 2 підгрупами й 3 знижками → «груп: 3, знижок: 3».
- [ ] **Step 2: Реалізація** за патерном `features/shipping` (`useSeedOnce`, `reportTxError`, `isPersisted`).
- [ ] **Step 3: Зелене** — Run: `pnpm lint && pnpm typecheck && pnpm test` → PASS; `wc -l` нових файлів ≤ 150.
- [ ] **Step 4: Коміт** — `feat(k3-e6v): адмінка знижок на серверному шарі`.

---

## Task 9: Адмінка категорій і правил (З-3, З-6, Е6в-18, Е6в-19)

**Files:**
- Create: `admin/features/customer-categories/{categories,rules}/**` (+ `__tests__/`)
- Modify: `admin/pages/{UserCategories,UserCategoryEdit,UserCategoryRules,UserCategoryRuleEdit}.tsx` → реекспорти; i18n `admin/users.ts` (або новий `admin/customer-categories.ts`); `tests/admin-server-first/registry.ts` (−4) і `tests/admin-inserts-need-id.test.ts` (−2: `UserCategoryEdit`, `UserCategoryRuleEdit`) — у ЦІЙ задачі

**Interfaces:**
- Список категорій: назва, код, тип ціни, кількість покупців (`countCustomersByCategory`), бейдж дефолтної, «Зробити дефолтною» (`setDefaultUserCategory` + `writeBatch(writeUpsert)`); видалення — тости чотирьох кодів Е6в-18.
- Правила: список (назва, з → в, активність, пріоритет), кнопка «Запустити всі правила» → `runCategoryRules` → тост «Перевірено: {checked}, змінено: {changed}». Форма правила: режим «усі»/«будь-яка», поля умов (`total_purchases`, `orders_count`, `registration_days`, `email_domain`, `auth_provider`, `utm_source`, `utm_campaign`).
- i18n (КАНОН, З-6): uk `admin.customerCategories.rules.utmHint` = «UTM-мітки поки не збираються автоматично: правило з такою умовою спрацює лише для покупців, у профілі яких мітку вже записано»; en — «UTM tags are not collected automatically yet: a rule with this condition fires only for customers whose profile already has the tag» (ред.4).

- [ ] **Step 1: Тести (червоні):** підказка UTM видна біля полів `utm_source`/`utm_campaign` і не видна для інших; для поля `auth_provider` у виборі оператора є лише `=` (ред.5, перелік операторів — з `parseCategoryRuleConditions`); «Запустити всі» показує тост із числами з відповіді; кнопки видалення дефолтної категорії немає; 409 `user_category_has_customers` → тост «У категорії є покупці».
- [ ] **Step 2: Реалізація.**
- [ ] **Step 3: Зелене** — Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → PASS; `wc -l` нових файлів ≤ 150.
- [ ] **Step 4: Коміт** — `feat(k3-e6v): адмінка категорій покупців і автоправил`.

---

## Task 10: Діагностика ціни тим самим ядром (З-4, Е6в-6, Е6в-8)

**Files:**
- Create: `admin-server/impl/price-diagnosis/{diagnose,input}.ts`, `admin/features/discounts/price-validator/**` (+ `__tests__/`), харнес-кейси в `admin-discounts.test.ts`
- Modify: `admin/pages/PriceValidator.tsx` → реекспорт; `admin-server/{index,impl/index}.ts`, мок; i18n `admin/validator.ts` (тексти восьми причин Е6в-6); `tests/admin-server-first/registry.ts` (виняток `PriceValidator` зі `SERVER_FIRST_EXCEPTIONS` видаляється, і тип винятків, якщо список стає порожнім, лишається)

**Interfaces:**
- `diagnosePriceInput = { userId: uuid | null; productId: uuid; modificationId: uuid | null; quantity: int 1..999; otherCartTotal: number ≥ 0 }`.
- `diagnosePriceOp({ data }) → PriceDiagnosis` під `discount.manage`: `loadPricingContext(db, userId, { includeInactive: true })` → `priceCart(db, ctx, [line], { extraCartTotal: otherCartTotal })`. `PriceDiagnosis = { priceTypeId: string | null; categoryId: string | null; available: boolean; basePrice: number | null; finalPrice: number | null; applied: AppliedDiscount[]; rejected: RejectedDiscount[] }`. Гість (`userId: null`) отримує дефолтну категорію.
- UI: покупець — «Гість» або пошук за email (`findCustomers`), товар і модифікація (наявні колекції/ендпойнти каталогу), кількість, «сума решти кошика»; результат — тип ціни, база, застосовані, відхилені з причиною, фінальна ціна.

- [ ] **Step 1: Харнес (червоний):** для однакових входів `diagnosePrice(...).finalPrice === priceItems(...)[0].price` у трьох сценаріях (гість; покупець з категорією; поріг суми через `otherCartTotal`); неактивна знижка й знижка в неактивній групі — у `rejected` з `inactive`/`group_inactive`, ціна від цього не змінюється.
- [ ] **Step 2: Тест UI (червоний):** причина `lost_to_operator` показана перекладеним текстом, а не кодом.
- [ ] **Step 3: Реалізація.**
- [ ] **Step 4: Зелене** — Run: `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages` → PASS.
- [ ] **Step 5: Коміт** — `feat(k3-e6v): діагностика ціни тим самим ядром, що чекаут`.

---

## Task 11: Живий прогін, доки, повний ланцюг

**Files:**
- Create: `scripts/live-smoke/admin-discounts{,-sql,-owner,-buyer,-cleanup}.mjs` (`runAdminDiscountsStep({ context, buyerPage, base, dbUrl, check })`)
- Modify: `scripts/live-smoke/owner-steps.mjs` (крок після доставки, ПЕРЕД кроком «система»); доки: `docs/tasks/v2-state-map.md` (§1, нове §2.10, легасі 9), `docs/tasks/platform-roadmap.md` (статус; борги: SSR-ціна зі знижкою й `offers.price` + full-page кеш; перерахунок категорії при скасуванні; правила за розкладом; UI ручного призначення — хвиля «покупці»), `docs/architecture/plugins.md` (хуки знижок знесено, реєстр умов — К5), `docs/architecture/data-layer.md` (ядро `priceCart`, середовище без кешу; розділ локів — `advisoryXactLock` і глобальний порядок `customer-config` → `discount-config`, Е6в-15; поруч — абзац-межа узгодженості розрахунків поверх кількох агрегатів дослівно за Е6в-8 ред.3: це канон для всіх таких розрахунків, не лише знижок), `CHANGELOG.md`

**Interfaces:**
- Крок створює все сам і прибирає в `finally`. Товар — `sonyachna-panel-550w-mono` (демо-воронка).
- Власник у браузері: створює групу «Е6в поріг» (`and`) і в ній дочірню групу «Е6в поріг / дитина» (`and`) зі знижкою «Від 3 шт −10%» (ред.2: вкладеність — щоб негативний контроль міг почервоніти) (ціль — товар, умова `min_quantity >= 3`, тип ціни «усі типи»); створює категорію «VIP Е6в» і знижку «VIP −15%» на той самий товар з умовою `user_category in [VIP Е6в]` в окремій групі; створює правило «2+ замовлення → VIP Е6в» (з «Роздріб», `orders_count >= 2`).
- Покупець (новий, `register`): картка товару показує ціну без знижки й підказку «від 3 шт — … (−10%)»; додає 3 шт → кошик показує ціну −10% і назву знижки; оформлює → SQL: `order_items.price` = ціна з кошика, `discount_data.applied` рівно `['Від 3 шт −10%']`.
- Власник вимикає БАТЬКІВСЬКУ групу «Е6в поріг» перемикачем (дочірня лишається активною) → покупець перезавантажує сторінку товару → підказки немає; кошик з 3 шт → без знижки.
- Покупець оформлює друге замовлення → SQL: `profiles.category_id` = VIP, рядок `user_category_history` з `rule_id` правила й `to_category_name = 'VIP Е6в'`; сторінка товару після перезавантаження показує ціну −15% (зміна категорії → зміна ціни).
- Прибирання (`finally`, САМЕ в цьому порядку): (1) SQL: покупця назад у дефолтну категорію; (2) видалити правило; (3) видалити групи (каскад знижок); (4) видалити категорію «VIP Е6в» (історія лишається з `NULL` і знімком). Тестові замовлення лишаються.

- [ ] **Step 1: Крок `live:smoke`** — Run: `pnpm live:smoke` → 0 FAIL; вивід цілком — у «Факти виконання».
- [ ] **Step 2: Негативний контроль** — у `buildDiscountForest` тимчасово повернути підйом активної дитини неактивного батька в корінь → крок червоніє на «вимкнена група» (ред.2: `includeInactive: true` контролем бути не може — рушій однаково нейтралізує неактивну групу); у `quoteCartFor` тимчасово `quantity: 1` → червоніє на «кошик −10%». Вивід у звіт; відкотити.
- [ ] **Step 3: Регрес** — пари «підпис | результат» рядків попередніх кроків ідентичні прогону Е6б (`diff` порожній, крім нових рядків).
- [ ] **Step 4: Лічильники** — `rg -l useSupabaseClient packages/simplycms/src/admin | wc -l` → **9**; `rg -n "Discount|UserCategor|PriceValidator" tests/admin-server-first/registry.ts` → порожньо; `KNOWN_WITHOUT_ID` — 2 (вивід у звіт).
- [ ] **Step 5: Доки** за Files.
- [ ] **Step 6: Повний ланцюг** (Global Constraints) → усі PASS; коміт — `docs(k3-e6v): живий прогін знижок і категорій, карта стану, changelog`.

## DoD етапу Е6в

1. `pnpm live:smoke` зелений із кроком знижок; обидва негативні контролі Task 11 червоні.
2. Повний ланцюг гейтів зелений; `pnpm lint` = 0 errors / 7 warnings.
3. `useSupabaseClient` у `src/admin/**` — 9 файлів, знижок і категорій серед них немає; реєстр легасі без восьми записів.
4. Review Focus 1–5 закриті тестами, названими в задачах.
5. Хуків знижок і порту `getDiscounts` немає; `discount_data` пише лише застосоване; `profiles.auth_provider` немає.
6. Фінальне рев'ю гілки архітектором; коміти без трейлерів (`git log --format=%B main..HEAD | grep -ciE "co-authored|generated with"` = 0).

## Точка передачі

Після Е6в — хвиля «покупці й `Dashboard`» (`Users`, `UserEdit` з кнопкою ручного призначення й зняття блоку `category_locked`, `Dashboard`), далі контент (`Banner*`, `Review*`) → Е7–Е8. Плагінні умови знижок — К5 через реєстр Е6в-4.
