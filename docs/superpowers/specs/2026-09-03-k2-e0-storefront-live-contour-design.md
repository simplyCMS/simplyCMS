# Санація живого контуру вітрини — трек К2, етап Е0 (+ борги треку T)

> **Статус: затверджено власником 2026-09-03** (брейнштормінг-сесія після
> фінального рев'ю треку T; пʼять рішень власника — Додаток А). Це
> **перший етап треку К2 «Вітрина»** роадмапу і водночас секція **«Борги
> треку T»** — обидві хвилі йдуть одним планом, бо доводяться одним стендом.
> Черга — рішення власника того ж дня: **після треку T, перед К3 Е2**.
> Імплементаційний план (superpowers writing-plans) пишеться після рев'ю
> цього документа. 🔴 Ред. 1.1 (2026-09-03): план пройшов Codex-аудит r1
> (REJECT 5B/5M/3m, усі підтверджені) — правки в плані ред. 1.1; у спеці
> змінено лише сентинел дерева `storefront` (T-3). 🔴 **Ред. 1.2
> (2026-09-04): аудит r2** (Claude Fable, read-only, HEAD `f6f1ef5b`; 4
> блокери, 10 major, 9 minor — усі підтверджені проти коду й бібліотек у
> `node_modules`) — план переписано (14 задач замість 15); у спеці змінено
> Е0-1 (спайк знято — `Date` у `DefaultSerializable` Start), Е0-3
> (`FOR UPDATE`, ескалація також для `cancelMyOrder`, сьома формула), Е0-4
> (типи в T0, доступні контроли, автовибір точки), Е0-6 (сід — власник
> активної доставки, `decrease_on_order = true`, порядок задач), Е0-8, T-2,
> T-4, §3–§8; додано Додаток В (рішення ред. 1.2, підтвердження власника при
> затвердженні плану).
>
> 🔴 Рамка та сама, що у V2, К0 і К3: клієнтів і реальних магазинів немає —
> зворотна сумісність НЕ підтримується, перехідних шимів немає. Критерій
> рішень — вартість подальшої експлуатації, не ціна переписування.
>
> Доказова база — **живий прогін 2026-09-03** проти чистого Postgres 17.10
> у Docker (`pnpm db:demo` → `pnpm build` → `node server.mjs` → Chromium
> через `@playwright/test` → прямий SQL), **A/B-атрибуція** кожного дефекту
> проти `main` (`1ad29034`) на тій самій базі, і **адверсаріальна
> критика** семи первісних рішень архітектора (Додаток Б — що спростовано і
> чому). Жоден із дефектів нижче не є регресією треку T: усі відтворені на
> `main` байт-у-байт.

## 1. Мотивація — виміряно живим прогоном, не припущено

Статичні гейти репо (`test`, `test:schema`, `test:packaging`, `pilot:pack`)
зелені, а магазин, піднятий документованим шляхом (`v2-state-map.md` §5),
показує покупцеві таке:

| # | Симптом | Корінь (файл:рядок) | На `main`? |
|---|---|---|---|
| 1 | З товаром у кошику **кожна** SSR-сторінка кидає `Minified React error #418` (розбіжність гідратації); з порожнім — нуль | `react-query/useCart.tsx:49-61` читає `localStorage` у lazy-`useState`, тобто в рендері гідратації; умовний бейдж у шапці теми (`themes/default/components/HeaderActions.tsx:134-138`, `cart-ui/CartButton.tsx:16-21`, solarstore `Header.tsx:198-201`) стає зайвим DOM-вузлом. Єдиний `suppressHydrationWarning` у репо — на `<html>` | так, 8/8 завантажень |
| 2 | Картка каже **«Немає в наявності»** при `stock_status='in_stock'` у всіх 8 товарах; лістинг бейджа не показує; «Додати в кошик» активна; фільтр «лише в наявності» сховав би весь каталог | **Шість** формул доступності: `domain/inventory.ts:12`, `storefront/loaders/stock-info.ts:82`, `stock.ts:96` (усі три — `qty > 0 \|\| on_order`, перенос plpgsql `get_stock_info`); `catalog-ui/ProductCard.tsx:54-64` і `ModificationSelector.tsx:52-56` — лише статус; JSON-LD у `routes/…/$productSlug.tsx:60-63` — `on_order` роботам як `OutOfStock`. DEFAULT статусу в схемі — `'in_stock'` (`schema.ts:393,427`). Тумблер `system_settings.stock_management.decrease_on_order` (`0003_seed.sql:64-69`, `admin/pages/Settings.tsx:104-116`) не має жодного читача на write-path | так |
| 3 | `/checkout` рендериться, кнопка «Підтвердити замовлення» активна, клік — **нічого**: ні тоста, ні валідації, ні рядка в `orders` | `checkout-ui/CheckoutDeliveryForm.tsx:223` — `methods.map` без гілки для `[]`; автовибір `:190-194` не спрацьовує; `shippingMethodId` обовʼязковий (`pages/Checkout.tsx:45`), поля для помилки немає. Демо-сід не везе `shipping_methods`/`pickup_points`/`stock_by_pickup_point`. Сервер: `placeOrder` кидає (`checkout.ts:34-36`), клієнт показує `error.message` як є (`Checkout.tsx:244-246`); `checkout-input.ts:42` **приймає `shippingCost` з клієнта**, ціни позицій — теж (борг 0.4.1-4); наявність позицій не перевіряється (`order-create.ts`) | так |
| 4 | `<lastmod>` у `sitemap.xml` — `2026-09-03 17:06:50.331961+00`: не W3C Datetime (пробіл замість `T`, `+00` замість `+00:00`), 12 із 15 URL | 62 колонки `timestamp(…, { mode: 'string' })` у `schema.ts`; `drizzle-orm/node-postgres/session.js:26-31,64-65` підкладає identity-парсер для `TIMESTAMPTZ` на кожен запит (тому `pg.types.setTypeParser` **мертвий** для доменних запитів — доведено прогоном); `storefront/seo/sitemap.ts:58` вставляє текст як є. Чотири сторінки кабінету парсять цей текст **у браузері** (`OrderSuccess.tsx:94-101`, `ProfileOrders.tsx:164`, `ProfileOrderDetail.tsx:184`, `Profile.tsx:172`). Формат залежить від GUC кластера: під `DateStyle='SQL,DMY'` V8 читає `01/07/2026` як **7 січня** | так |
| 5 | `tests/import-protection-wiring.test.ts` зелений на **вимкненому** захисті: закоментований блок або один рядок `enabled: false` дають 15/15 passed при чистих `typecheck`/`lint` | патерни `:43-54,85-87` не анкеровані і перевіряють текст, не дані; `enabled` — штатна опція Start (`plugin.js:678` → `config.enabled = false; return`) | трек T |
| 6 | Усі шість читачів `SERVER_ONLY` похідні від списку: приберіть `'storefront'` — лоадери переїдуть у клієнтську збірку (`tsdown.config.ts:88`), Import Protection і Gate C перестануть їх бачити, **жоден гейт не почервоніє** | єдиний контроль, не похідний від списку, — 13 літералів `test-contours.md` §12, і він прозовий | трек T |
| 7 | §12 як доказ дрейфує: 89 002 vs 89 005 рядків, наївний grep — 6 збігів, не 1, перетин 2/2, не 3/2; два рядки живого прогону були хибні (виправлено `71095e0`) | таблиця ручних вимірів замість гейта; порушує урок №8 роадмапу | трек T |
| 8 | Три ключі контракту дають WARN Better Auth «Base URL is not set»; §5 карти стану показував чотири ключі і сніпет із неіснуючим `mail.url` (виправлено `71095e0`); тесту-піна контракту env немає | `.env.example:37-40` описує WARN як навмисний; `doctor-checks.mjs:33` знає лише два серверні ключі | 0.4.1 |
| 9 | `template/vite.config.ts` і оверлей пілота поза будь-якою програмою `tsc`; `__dirname` у `vitest.config.ts:5`, `vite.config.ts:20`, `template/vite.config.ts:26,67-68` і оверлеї пілота (Vite попереджає при кожному запуску — і в монорепо, і в магазині зі шаблону); `engines.node: ">=20"` скаффолдера при вимозі Start `>=22.12.0`; картки головної без ціни (`toCardViewModel.ts:23-24`, посилання «звіт Ф1, ризик №4» — 0 збігів у `docs/`); банери демо-сіду з файлами, яких немає (`demo-seed.sql:234,249`) | `template/tsconfig.json:22` include без `vite.config.ts`; коверидж-тест виводить список із нього ж | трек T / К2 |

Що це доводить понад окремі дефекти — **чотири повторні патерни**, і саме
вони є предметом цього документа:

- **P1. Гейт перевіряє текст або тип, а не поведінку чи формат** (5, 7,
  `sitemap.test.ts:16,49` з ISO-фікстурами, яких драйвер не віддає;
  `storefront-loaders.test.ts:192-193` з коментарем «мусить приїхати рядком
  ISO» і асертом `expect.any(String)`).
- **P2. Одне доменне правило живе в N копіях** (2).
- **P3. Стан читається не в тій фазі рендеру** (1).
- **P4. Усі читачі декларації похідні від одного списку, тож список сам без
  контролю** (6).

## 2. Рішення

Нумерація: **Е0-N** — етап К2-Е0; **T-N** — борги треку T.

### 2.1. Хвиля 0 — борги треку T (гейти; незалежні від рішень по вітрині)

**T-1. `importProtection()` — один читач замість трьох копій.** У
`packages/simplycms/src/contracts/server-only.ts` три хелпери
(`serverOnlySpecifiers/Files/ExcludeFiles`; читачів поза трьома
`vite.config.ts` — нуль) зливаються в `importProtection()`, що віддає повний
обʼєкт (`behavior: 'error'`, `include: ['**']`, `client: { specifiers,
files: [..., '**/*.server.*'], excludeFiles }`), типізований як
`NonNullable<Parameters<typeof tanstackStart>[0]>['importProtection']` з
`@tanstack/react-start/plugin/vite` (peer; нової залежності немає). Три
конфіги — один рядок `importProtection: importProtection(),`. Коментарі про
`include` і `pick(user, default)` переїжджають до хелпера. 🔴 «T0 — лише
дані» означає нуль рантайм-залежностей, і хелпер їх не додає; три копії
Start-специфічного блоку — рівно те, від чого декларація існує.
`tests/import-protection-wiring.test.ts` переписується: DATA-частина
викликає хелпер і асертить форму, `behavior === 'error'`, `include`, три
набори і **відсутність ключа `enabled`**; текстова — один анкерований
регекс на конфіг (`/^\s*importProtection: importProtection\(\),$/m`) плюс
`not.toMatch(/^\s*enabled\s*:/m)`.

**T-2. Поведінковий доказ межі в пілоті + CI.** У `scripts/pilot-pack/run.mjs`
останнім у `runGates()` — після Gate B, бо кожна червона збірка спорожнює
`dist` скретча, який читають і C/D, і B — мутаційний крок: записати
`src/routes/my/__leak.tsx` з bare `simplycms/db`, `vite build` **мусить**
упасти з `[import-protection]`; повторити з відносним
`../../../node_modules/simplycms/src/db/client` і **реальним** експортом
(`resolveDatabaseUrl` — з вигаданим ім'ям збірка падає на `MISSING_EXPORT`
раніше за межу, і доказ хибний; спіймано на рев'ю); прибрати файл; звіт
через `report.mjs::step`. Ціна — дві червоні збірки плюс чистий ре-білд.
`pnpm pilot:pack` іде в CI job `packaging` після `test:packaging` (+≈3–5 хв:
`pnpm install` скретча і три збірки поверх основної; job сьогодні 50 с при
ліміті 600). Негативний контроль гейта — `sed` по ОВЕРЛЕЮ пілота
(`tests/pilot/store-template/vite.config.ts`): саме його `scaffold.mjs`
копіює поверх шаблону, а `template:sync` статичні файли шаблону не чіпає. Борг №2 роадмапу звужується до
`pilot` з Gate B (жива БД); текст `workflow.yml:171-177` переписується.

**T-3. Список `SERVER_ONLY` під контролем — сентинели дерев.** У
`tests/dist-server-boundary.test.ts` — мапа **не похідна** від списку, по
одному літералу на дерево: `db → '[simplycms/db]'`, `auth →
'[simplycms/auth]'`, `schema → 'wishlists_own_all'`, `storefront →
'Disallow: /admin/'` (🔴 ред. 1.1 після Codex r1: `[simplycms] Sign-in required`
дублюють три клієнтські `core/lib/*`, тож сентинел — літерал `robots.ts`, який
живе лише під `storefront/`), `admin-server/impl → 'patch не може бути
порожнім'`, `storefront-routes/seo → 'public, max-age=3600,
stale-while-revalidate=86400'` з `interceptor.ts`. Преflight унікальності —
обовʼязковий крок плану.
Асерти: (а) `Object.keys(SENTINELS)` дорівнює `SERVER_ONLY` — свідома друга
копія, що ловить усічення списку; (б) літерал існує в **джерелі** свого
дерева (позитивний контроль проти рефакторингу рядка); (в) літерал є в
замиканні серверних entry `dist` пакета і відсутній у замиканні клієнтських.
Усі 13 літералів §12 у джерелі є (перевірено). Це розширення чинного гейта
packaging-suite, не новий файл.

**T-4. Типізація й гігієна конфігів.** `"vite.config.ts"` — в `include`
**обох** `template/tsconfig.json` і `tsconfig.template.json` (без пари
`template-typecheck-coverage.test.ts` червоніє — доведено мутацією;
типізація проти `dist` дає 0 помилок, негативний контроль — зіпсований тип
`server.port` — ловиться). `import.meta.dirname` замість `__dirname` у
**всіх трьох** `vite.config.ts` (корінь `:20,67-78`, шаблон `:26,67-68`,
оверлей `:58,74,118-119` — включно з `#region pilot-only`) і у
`vitest.config.ts:5`; розширення `.ts` у відносному імпорті декларації в
`vite.config.ts:11`. 🔴 Ред. 1.2: Vite у режимі `bundle` підставляє обидві
форми, а попередження — forward-compat до дефолту `native`; магазин
збирається ШАБЛОННИМ конфігом, тож без шаблону й оверлею DoD стосувався б
лише монорепо. `engines.node` скаффолдера `">=20"` → `">=22.12"`: це не
політика, а дзеркало вимоги `@tanstack/react-start` (`>=22.12.0`), яку
згенерований магазин і так має; пін — кейс у
`tests/create-store-template-parity.test.ts`. Гейт для конфігу МАГАЗИНУ —
чистий ре-білд Gate IP (T-2): він захоплює вивід `vite build` скретча і
червонить попередження про `__dirname`, яких монорепний `pnpm build` не
бачить. Блок `#region pilot-only` оверлею лишається поза `tsc`
(функціонально покритий Gate C).

**T-5. §12 — структурні твердження замість чисел.** Після T-3 таблиця
читачів отримує сьомий рядок «контроль списку — сентинели»; рядки/байти
лишаються лише як порядок величини; 13 маркерів посилаються на тест, а не
на ручний grep. Урок №8 роадмапу доповнюється цим прикладом.

### 2.2. Хвиля 1 — К2-Е0

**Е0-1. ~~Спайк: `Date` через межу serverFn~~ — знято (ред. 1.2).**
Питання закрито читанням бібліотеки: `Date` входить у `DefaultSerializable`
серіалізатора Start (`@tanstack/router-core@1.168`,
`dist/esm/ssr/serializer/transformer.d.ts:18`), тобто і loader-payload, і
RPC serverFn проносять його як `Date`, а `strict`-перевірка типів
`createServerFn` уже на `pnpm typecheck` відкинула б несеріалізовний тип.
Контракт Е0-2 — наскрізний без гілки «B». Поведінковий гейт — live-smoke
Е0-8: `order-success` форматує `Date` через `Intl`, і рядок замість `Date`
дав би `RangeError` у `pageerror`.

**Е0-2. Контракт дат — «у застосунку `Date`, текст лише на межі виводу».**
- `db/client.ts`: пул зі startup-опціями `options: '-c DateStyle=ISO,YMD -c
  TimeZone=UTC'` — текст драйвера детермінований незалежно від кластера
  (накриває і auth-шлях через pg-proxy). Перевірка — харнес `test:schema`.
- `schema.ts`: 62 × `mode: 'string'` → `mode: 'date'` (той самий механізм,
  що вже в `schema/auth.ts:44-138`). DDL не змінюється — `db:diff` порожній
  за побудовою. `customType` не заводиться (у репо не вживається).
- Межа виводу: `storefront/seo/sitemap.ts::entry()` приймає `Date`, пише
  `toISOString()`. Інших спец-форматів на виході немає (перевірено: JSON-LD
  без дат, `Last-Modified` не ставиться, RSS немає).
- Споживачі: `ProductListRow`/view-model-и, `OrderListRow`/`OrderDetailRow`,
  `ProductReviewRow`, контракти `Banner` (включно з `date_from`/`date_to`),
  `Order`, `ShippingMethod`… отримують `Date`; `PluginRecord` (Drizzle-читання)
  — `Date | null`, тоді як `Plugin` (supabase-шар адмінки) лишається на
  рядках; чотири сторінки кабінету форматують через `Intl` без
  `new Date(str)`.
- Тести: `sitemap.test.ts` — фікстури `new Date(...)`, асерт W3C-регексом;
  `storefront-loaders.test.ts:193` — `toBeInstanceOf(Date)` (контракт коду,
  а не GUC кластера).
- Спека К3, Додаток Б-6, переписується: колекції адмінки Е3+ приймають `Date`.
- 🔴 Ред. 1.2: `admin/pages/OrderStatuses.tsx` — ЖИВА сторінка на
  `simplycms/admin-data` з типом `OrderStatus` зі `simplycms/schema/types`
  (не legacy `supabase-js`): `createdAt: new Date()` замість ISO-рядка,
  інакше `as OrderStatus` дає TS2352; мок колекції — `new Date(…)`.
- Крок `db:diff` для перевірки DDL не потрібен: `mode` — властивість
  TS-типу, DDL стереже `test:schema`.

**Е0-3. Наявність — «статус є джерелом правди на читанні; кількість — його
деталь; write-side тримає статус правдивим».**
- `domain/inventory.ts`: `isPurchasable(status: StockStatus | null):
  boolean` — `out_of_stock → false`, `on_order → true`, `in_stock | null →
  true`. Без опцій-тумблерів. `calculateProductAvailability` зводиться до
  неї (модифікації — `some`).
- Шість споживачів переходять на неї: `stock-info.ts:82`, `stock.ts:97`,
  `catalog-products.ts:133` (→ фільтр `inStockOnly`; зайві читання залишків
  у лістингу знімаються), `ModificationSelector` і `ProductCard` (уже так),
  JSON-LD у `$productSlug.tsx`: `in_stock → InStock`, `on_order →
  BackOrder`, `out_of_stock → OutOfStock`. 🔴 Ред. 1.2: сьома формула —
  мертва `core/hooks/useStock.ts::isProductAvailable` («`in_stock → qty >
  0`», нуль викликів, реекспорт у `core/index.ts`) — ВИДАЛЯЄТЬСЯ;
  `ProductAvailabilityInput.stock_status` звужується до `StockStatus | null`.
- `StockDisplay`: «В наявності: N шт» лише коли `totalQuantity > 0`, інакше
  «В наявності» (гілка `:71-73` уже є); розкладка по точках — як була.
- Write-side у `createOrder` (та сама транзакція): якщо
  `decrease_on_order = true` і для позиції існують рядки залишків — рядки
  беруться `SELECT … FOR UPDATE OF stock_by_pickup_point` (Drizzle
  `.for('update', { of })`), списання — від заблокованого залишку, нестача —
  `InsufficientStockError` з відкатом (`not_purchasable` для клієнта); коли
  сума по цілі стає 0 — `stock_status := 'out_of_stock'`. 🔴 Ред. 1.2: саме
  `FOR UPDATE`, а не guarded UPDATE: переворот статусу від pre-read залишку
  давав два паралельні замовлення по одиниці на залишок 2 без фліпу — нуль
  на складі при `in_stock`. Позиції списуються у сталому порядку
  (`productId/modificationId`) — проти дедлоку двох кошиків. Без рядків
  залишків нічого не змінюється (магазин не веде обліку). Тумблер отримує
  читача.
- Права: `app_user` не пише в облік і не редагує `orders` (`0002_grants.sql`),
  тож службова дія йде через **scoped-ескалацію** — `operator(fn)`, другий
  аргумент `fn` у `withCustomerDb`/`withOrderTokenDb` (третій у
  `withSessionDb`): `SET LOCAL ROLE app_admin` рівно на час `fn` у ТІЙ САМІЙ
  транзакції, після RLS-прийнятого запису покупця; runtime-роль має `set
  true` на обидві ролі (`0000_prelude.sql:94-95`). 🔴 Ред. 1.2: той самий
  механізм замінює три транзакції `cancelMyOrder` (`profile-orders.ts`) на
  одну — «перевірив право → записав» без вікна; `withStoreOperatorDb`
  лишається для дій, які ініціює сервер (реєстр і конфіг плагінів). Правило
  — у `data-access.instructions.md`, «Ескалація ролі покупцем».
- Тести: `inventory.test.ts` під нову формулу; харнес — фікстура `tryfazny`
  («негативний контроль без залишку», `fixtures/storefront-client.ts:14`)
  **перенацілюється на `out_of_stock`**, а не інвертується (інакше сюїта без
  жодного кейсу `false`); новий файл харнеса `order-stock.test.ts` ПОВЕРХ
  покупного сіду (Е0-6): списання з сідового залишку, порядок по точках,
  нестача з відкатом, два конкурентні кейси — «3 / 2+2 → один» і «2 / 1+1 →
  обидва, статус `out_of_stock`» (пінить читання під `FOR UPDATE`);
  негативний контроль — списання без `operator` → `permission denied` вже
  на `FOR UPDATE`; `showcase.test.ts:236` (залишок закритої точки) — без
  змін, лічильник точок — 2 (сідова + фікстурна).

**Е0-4. Чекаут — «сервер рахує і відмовляє доменно; клієнт показує, не
вирішує».**
- `placeOrder` повертає union (прецедент `profile-orders.ts:66-89`):
  `{ ok: true; order: PlacedOrder } | { ok: false; reason:
  'shipping_unavailable' | 'pickup_point_invalid' | 'not_purchasable' }`.
  Не `Error` з `.code`: чи проносить `createServerFn` кастомні поля через
  RPC — у репо не перевірено, union працює за побудовою.
- 🔴 Ред. 1.2: типи запиту й результату — у T0 `contracts/objects/order.ts`
  (`CheckoutItemInput`, `PlaceOrderInput`, `PlaceOrderRejection`,
  `PlacedOrder`, `PlaceOrderResult`; прецедент — `CreateOrderInput` там же);
  Zod-схема в T5 оголошує `satisfies z.ZodType<PlaceOrderInput>`, каст у
  хендлері зникає, клієнт бере `PlaceOrderRejection` для мапи
  `Record<PlaceOrderRejection, MessageKey>`; дубль `CreatedOrder`
  (лоадери) / `PlacedOrder` (`checkout-input.ts`) злито в один контракт.
  Логіка — `storefront/loaders/place-order.ts` (server-only дерево),
  serverFn — тонкий. Zod у T0/T1 не можна (рантайм-залежність), тому схема
  лишається в T5, а тип — у контрактах.
- Сервер: `shippingMethodId ∈ активні` (`loadShippingMethods`); для
  pickup-методів точка належить методу; `shippingCost =
  resolveShippingRate(...)` (`domain/shipping.ts:100` — той самий домен, що
  вже рахує клієнт у `useShippingDirectory.ts:54`); **ціна позиції =
  серверний `resolvePrice`** за тим самим price-контекстом, що каталог —
  кошик несе як істину лише `productId/modificationId/quantity`;
  `isPurchasable` кожної позиції. Зі схеми `checkout-input.ts` зникають
  `shippingCost` і клієнтська `price` як джерела. Це закриває борг 0.4.1-4
  **цілком**, а не половину, — інакше `placeOrder` торкаємось двічі.
- UI: `methods.length === 0` → блокуючий empty-state (патерн `CartView` для
  `itemCount === 0`: іконка + заголовок + опис) з ключем
  `checkout.noShippingMethods` в обох каталогах, submit `disabled`;
  `validation.shippingRequired` (ключ існує) рендериться через `FormMessage`
  (`simplycms/ui/form`, як у `SetPasswordForm.tsx`); `Checkout.tsx:228-247`
  мапить `reason → t(REJECTION_KEY[reason])` — як `CheckoutAuthBlock.tsx:61-63`
  мапить коди Better Auth.
- 🔴 Ред. 1.2, два правила UI. (а) **Доступні імена**: у `checkout-ui` нуль
  `id`/`htmlFor` при двох десятках текстових контролів у шести формах, тож
  ані скрінрідер, ані `getByLabel` Playwright поля не знаходять; правило —
  кожен текстовий контрол має `id="checkout-<поле>"` і `<label htmlFor>`
  (radio/checkbox в обгортці `<label>` — не чіпати), гейт — спільний асерт
  по DOM у юнітах форм. (б) **Автовибір єдиної точки видачі** тим самим
  ефектом, що й перший метод: точка — `<select>` з плейсхолдером, і при
  одній точці покупець упирався в `pickup_point_invalid` — та сама «стіна»,
  що й без методів.

**Е0-5. Кошик — «стан, якого сервер не знає, читається через
`useSyncExternalStore`».** У `react-query/useCart.tsx` — `cartStore`:
кешований снапшот (`getSnapshot` віддає ту саму референцію — `JSON.parse`
на кожен виклик дав би нескінченний рендер), `getServerSnapshot = () =>
EMPTY` (стабільна константа), перечитування `localStorage` при переході
0→1 підписників (тести `cart-slots.test.tsx:54,75` перезаписують сховище
між рендерами) плюс `storage`-подія; мутатори пишуть у `localStorage` і
нотифікують. `isInitializedRef` і ефект збереження зникають. Теми не
змінюються. Прецедент патерну — `plugins/HookRegistry.ts:17-29` +
`PluginSlot.tsx:20-26`; той самий механізм у `useHydrated` роутера.
Серверний `throw` у мутаторах не потрібен — вони викликаються лише з
обробників подій (`slots/ProductAddToCart.tsx:37`, `CartSlots.tsx:50`,
`Checkout.tsx:228`). `optimization.instructions.md:54` (рецепт
`suppressHydrationWarning` для cart count) переписується — за офіційною
докою React він не покриває умовно присутній елемент.

**Е0-6. Демо-сід — покупний магазин і ЄДИНИЙ власник активної доставки.**
`migrations/demo/demo-seed.sql` у своїй id-нумерації додає 1
`shipping_methods` (`pickup`, `system`, активний), 1 дефолтну
`shipping_zones` (`shipping_rates.zone_id` — NOT NULL), 1 `pickup_points`,
1 безкоштовний `flat`-тариф, `stock_by_pickup_point` для двох панелей — щоб
обидві гілки Е0-3 (облік є / обліку немає) жили в одному сіді; банери —
`image_url = NULL` («порожній круг» — рішення власника, яке
`HeroBanner.tsx:46` уже документує). 🔴 Ред. 1.2 після верифікації плану:
колонка в каноні — `text NOT NULL` (`schema.ts:1040`), тож `NULL` у сіді
впав би з `23502`; схема суперечила контракту, який тема вже виконує, —
вирівнюється схема штатним шляхом канону: `schema.ts` → `pnpm db:diff` →
новий файл `0004_banners-image-nullable.sql` (`ALTER … DROP NOT NULL`),
контракт `Banner.image_url: string | null`, `BannerSlider` фільтрує банери
без фото так само, як `HeroBanner.find`; піни списку канону
(`baseline.test.ts`, парність шаблону, `migrations/README.md`) — у тій самій
задачі. 🔴 Ред. 1.2: **`decrease_on_order =
true`** (`update` канонічного рядка, не `insert` — пін не зачеплений):
демо веде облік, і live-smoke доводить списання буквально, як вимагає DoD.
Шапка сіду (`:3-17`) фіксує нову межу: демо-магазин мусить доходити до
рядка в `orders` зі списанням. Пін `seed-determinism.test.ts:21` → 20;
`pnpm template:sync` обовʼязковий. Канон `0003_seed` не чіпається —
«доставку заводить магазин» лишається правдою для проду.

🔴 Ред. 1.2 — харнес. Активний `pickup` вставляли три фікстури незалежно
(`fixtures/shipping.ts:26`, `showcase.ts:110`, `storefront-client.ts:24`),
дефолтну зону — `fixtures/shipping.ts:31`; сід із доставкою став би пʼятою
декларацією і зламав би нові тести (другий дефолт зони проти
`idx_shipping_zones_single_default`; залишки тих самих слагів). Тому: сід —
єдина декларація активної доставки; `SHIPPING_FIXTURES` розщеплено на
`ACTIVE_SHIPPING_FIXTURES` (ідемпотентні поверх сіду: `on conflict (code)`,
`on conflict (is_default) where (is_default = true)`, `where not exists` для
тарифу й точки, посилання за `code`/`is_default`, не за іменем — потрібні
лише на чистому каноні) і `HIDDEN_SHIPPING_FIXTURES` (негативні рядки — саме
їх тести композують поверх сіду; повний набір дав би другий активний тариф
на пару метод+зона); `showcase.ts` і `storefront-client.ts` не вставляють
метод; тести write-side і воронки додають лише те, чого сід не має. **Задача сіду йде
ПЕРЕД write-side і воронкою** (§3). Знижки харнесу — спільний білдер
`fixtures/discounts.ts` (showcase + checkout-flow), а не другий інлайн.
Ціна на головній: `loadPricesByProduct` + той самий `resolvePrice`, що в
каталозі, не другий `MIN(price)`-агрегат; посилання «звіт Ф1» знімаються
(`toCardViewModel.ts`, `HomeView.tsx`). Порядок карток при однаковому
`created_at` (усі рядки одного `insert` — один `now()`) стабілізується
вторинним ключем `id` у `loadHomeProducts`/`loadSectionProducts`; гейт
значення ціни — харнес `storefront-loaders.test.ts` по featured-набору.

**Е0-7. Env — контракт як тест, не як три тексти.** `auth/env.ts:47`
**лишається** (fallback `baseURL = VITE_SITE_URL` спростовано: з рядковим
`baseURL` Better Auth 1.7.1 довіряє рівно одному origin і відкидає інші з
403 `INVALID_ORIGIN` — дев на іншому порту зламався б на вході). Новий
`tests/env-contract.test.ts`: активні ключі `.env.example` = `{DATABASE_URL,
BETTER_AUTH_SECRET, VITE_SITE_URL}`; `REQUIRED_ENV_VARS` доктора ⊂ серверна
підмножина. Тексти (`CLAUDE.md`, `.env.example`): WARN очікуваний у dev,
`BETTER_AUTH_URL` рекомендований у проді (звужує довірені origin-и).

**Е0-8. `scripts/live-smoke.mjs` — DoD як скрипт.** Перевикористовує
`scripts/pilot-pack/gate-b.mjs` (`expectedProducts`/`check`) для curl+SQL і
`@playwright/test` для того, чого curl не бачить: бейдж наявності після
гідратації, JSON-LD, автовибір єдиної точки видачі (читає значення
`#checkout-pickup-point` — точка це `<select>`, не radio), сама воронка
(картка → кошик → чекаут → `SELECT count(*) FROM orders` +1, залишок −1
безумовно, бо демо вмикає облік), і нуль `pageerror` на всіх сторінках
включно з `order-success` (форматує `Date` — гейт контракту дат на межі
RPC). 🔴 Ред. 1.2: `.env.local` розробника не чіпається — env збірки й
сервера явний, а `loadEnv`/`server.mjs` беруть файл лише для відсутніх
ключів; процеси гасяться і на SIGINT/SIGTERM. Друкує таблицю §12 — вона
стає виводом, а не рукописом. Запуск `PG_HARNESS_URL=… pnpm live:smoke`
(db:demo → build → start → прогін → зупинка). Не CI (Postgres + браузер) —
той самий клас, що `pilot` з Gate B; місце — гейти релізу поруч із
`pilot:pack`, окремим рішенням після К2-Е0. Через К6 він стає Gate B на
Postgres — пишеться один раз.

## 3. Порядок і залежності

```
Хвиля 0 (≈1 день):  T-1 → T-4 → T-3 → T-2 → T-5
Хвиля 1 (≈3–4 дні): Е0-2 → Е0-6 (сід + фікстури + ціна на головній) → Е0-3 → Е0-4 → Е0-5 → Е0-7 → Е0-8
```

- 🔴 Ред. 1.2: у хвилі 0 T-4 іде одразу за T-1 — він типізує проти `dist`
  саме той рядок `importProtection: importProtection()`, який T-1 поклав у
  шаблон; T-3 і T-2 незалежні; T-5 документує все попереднє.

- 🔴 Ред. 1.2: Е0-1 знято (спайк не потрібен — Е0-1 у §2.2); **Е0-6 іде
  ПЕРЕД Е0-3/Е0-4**, бо демо-сід — база фікстур харнесу write-side і
  воронки (єдина декларація активної доставки й залишків). Сід від коду не
  залежить; `loadPricesByProduct` для ціни на головній створюється в Е0-6 і
  перевикористовується Е0-4.
- Е0-4 залежить від Е0-3 (`isPurchasable`, ескалація в `createOrder`), Е0-2
  (типи рядків замовлення) і Е0-6 (`loadPricesByProduct`, дані тестів).
- Е0-8 залежить від усього (він і є DoD).
- Хвиля 0 ні від чого не залежить і може виконуватись паралельно з Е0-2.

Мінімальний гейт кожного кроку — як у треку T: `pnpm format:check && pnpm
lint && pnpm test`; для кроків із харнесом — ще `pnpm test:schema`; для
T-2/T-3 — `pnpm build:packages && pnpm test:packaging && pnpm pilot:pack`.

## 4. Гейти й докази (нічого нового в контурах — лише файли в чинних)

| Що доводить | Файл | Контур |
|---|---|---|
| Гідратація кошика | `packages/simplycms/src/react-query/__tests__/cart-hydration.test.tsx`: `renderToString` → jsdom-глобали (техніка `packages/cli/src/theme-conformance-dom.mjs`) з передзаповненим `localStorage` → `hydrateRoot` + spy на `console.error` | `test` |
| Правило наявності | `domain/__tests__/inventory.test.ts`; харнес `storefront-client-queries.test.ts` (фікстура → `out_of_stock`) | `test` + `test:schema` |
| Декремент і переворот статусу; конкурентність (`FOR UPDATE`); негативний контроль ролі | харнес `order-stock.test.ts` поверх демо-сіду | `test:schema` |
| Воронка → `orders`; серверна ціна й знижка; три доменні коди відмови у шести сценаріях + нестача залишку | харнес `checkout-flow.test.ts` (кошик → `placeOrderFor`) поверх демо-сіду + `HIDDEN_SHIPPING_FIXTURES` | `test:schema` |
| Ціна на головній — значення, не лише тип | харнес `storefront-loaders.test.ts` (`loadHomeProducts`/`loadSectionProducts` проти демо-сіду) | `test:schema` |
| Скасування — одна транзакція з ескалацією; `app_user` без UPDATE на `orders` | харнес `storefront-personal-data.test.ts` | `test:schema` |
| Доступні імена контролів чекауту; empty-state; автовибір точки | `checkout-ui/__tests__/{CheckoutDeliveryForm,CheckoutContactForm}.test.tsx` + спільний асерт `accessible-controls.ts` | `test` |
| Поріг Node скаффолдера не слабший за Start | `tests/create-store-template-parity.test.ts` (кейс `engines`) | `test` |
| `banners.image_url` nullable — канон `0004` накатується, список канону з пʼяти файлів | `test-harness/pg/__tests__/baseline.test.ts`, `tests/create-store-template-parity.test.ts` | `test:schema` + `test` |
| Пул сесійних опцій — self-contained (тимчасова БД + канон) | `test-harness/pg/__tests__/db-session-options.test.ts` | `test:schema` |
| Date-контракт | `sitemap.test.ts` (Date-фікстури + W3C-регекс); `storefront-loaders.test.ts` (`instanceof Date`) | `test` + `test:schema` |
| Env-контракт | `tests/env-contract.test.ts` | `test` |
| Import Protection: дані + рядок | `tests/import-protection-wiring.test.ts` | `test` |
| Import Protection: поведінка | мутаційний крок останнім у `runGates()` (`scripts/pilot-pack/run.mjs`); чистий ре-білд захоплює вивід і червонить попередження Vite про `configLoader: 'native'` у конфізі магазину (T-4) | `pilot:pack` → CI `packaging` + реліз |
| Список `SERVER_ONLY` під контролем | `tests/dist-server-boundary.test.ts` (сентинели) | `test:packaging` |
| Шаблон типізується | `tsconfig.template.json` + `template-typecheck-coverage.test.ts` (автоматично) | `typecheck:template` |
| Живий контур цілком | `scripts/live-smoke.mjs` | реліз (окреме рішення), К6 |

## 5. Вплив на документи — один дотик на файл

**Разом зі спекою (цей самий коміт):** роадмап — етап `К2-Е0` у треку К2 з
черговістю «після T, перед К3 Е2»; секція «Борги треку T» (T-1…T-5);
рядки `:113` і `:206-209` без безумовного «чекаут/залишки працюють»; борг
№2 звужений до `pilot` з Gate B; борг 0.4.1-4 поглинається Е0-4; «Опційний
беклог тем» — герой з одним банером (`HeroBanner.tsx:52` бере перший банер
із зображенням; слайдер чи один герой — продуктове рішення теми); урок №8 —
приклад §12. Спека К3 — Додаток Б-6 і §7. `v2-state-map.md` — §3.4 і §6.

**У кінці хвилі 0:** `test-contours.md` §12 (T-5); `CLAUDE.md` — рядок про
`pilot:pack` у CI; коментар `workflow.yml`.

**У кінці хвилі 1:** `CLAUDE.md` — «Environment Variables» (WARN, `BETTER_AUTH_URL`)
і «Database Commands» (`db:demo` — покупний демо); `.env.example`;
`data-access.instructions.md` — розділи «Контракт дат» поруч із «Контракт
id» і «Ескалація ролі покупцем» у «Storefront (SSR)»;
`optimization.instructions.md:54`; `test-contours.md` — §12 отримує
рядок «живий прогін = `pnpm live:smoke`» і посилання на харнес-тести;
`v2-state-map.md` — §1 (покупний демо), §2 (новий датований прогін), §3.4 і
§6 п.4/п.6 (борг 0.4.1-4 закрито); роадмап — К2-Е0 ✅, борги T ✅, борг
0.4.1-4 ✅, рядок «Магазин на чистому Postgres» без «чекаут мовчить».

## 6. Ризики та мітигації

| Ризик | Мітигація |
|---|---|
| ~~`Date` не проходить seroval/loader як `Date`~~ | знято (ред. 1.2): `Date` у `DefaultSerializable` Start; гейт поведінки — `order-success` у live-smoke |
| Блокування `FOR UPDATE` на «гарячому» товарі затримує паралельні оформлення | масштаб магазину; блокуються лише рядки залишків однієї цілі, у сталому порядку — без дедлоку; альтернатива (guarded UPDATE) давала хибний статус |
| Харнес-тести залежать від вмісту демо-сіду | залежність уже існувала (слаги, ціни, назви); сід під пінами `seed-determinism`/`demo-seed`; фікстури ідемпотентні й працюють і на чистому каноні |
| `mode: 'date'` торкається типів у десятках лоадерів/view-model-ів | DDL не змінюється; зміна механічна (той самий `mode`, що в auth-схемі); `pnpm typecheck` веде до кожного споживача; К2 будує дескрипторів уже на `Date` — робота один раз |
| Пін детермінізму сіду й парність шаблону | обидва оновлюються в тому самому кроці Е0-6; `template:sync` у чеклісті кроку |
| `pilot:pack` у CI подовжує job `packaging` | +≈1–2 хв при ліміті 600 с; мережа для `pnpm install` скретча — та сама, що для кореневого install |
| Гідраційний тест потребує «сервер без window, потім клієнт з window» в одному файлі | техніка `exposeDom` з `theme-conformance-dom.mjs` (уже в репо); дефолтний `environment: 'node'` vitest лишається |
| Union `placeOrder` міняє клієнтський контракт | одне місце виклику (`Checkout.tsx`); мапа `reason → i18n` з фолбеком |

## 7. Межі (свідомо НЕ робиться)

- Дескриптори домену як SSOT, full-page кеш, фасетна навігація — сам К2.
- Слайдер героя / другий банер — «Опційний беклог тем».
- Storage-порт, драйвери — К3 Е2 / К4.
- Пошук вітрини — окрема спека.
- `customType()` для дат, `ClientOnly` навколо бейджів, fallback `baseURL` —
  відкинуті (Додаток Б).
- Спайк Е0-1 — знято (ред. 1.2): питання закрите типами бібліотеки.
- Юніт доступних імен для `CheckoutAuthBlock` — не пишеться (потребує моків
  auth-клієнта); правило до нього застосовується вручну за таблицею плану.
- Знос re-export-шимів `simplycms/core/components/checkout/*` — поза К2-Е0
  (розселення `core`); `Checkout.tsx` лише переводить імпорти на джерело.
- Типізація блоку `#region pilot-only` оверлею — поза скоупом (Gate C
  покриває функціонально).

## 8. DoD

**Хвиля 0:** `enabled: false` у будь-якому з трьох `vite.config.ts` валить
`pnpm test`; роут-витік у скретчі валить `pnpm pilot:pack` (обидві форми —
bare і відносна); видалення будь-якого рядка `SERVER_ONLY` валить
`pnpm test:packaging`; `pnpm typecheck:template` типізує `vite.config.ts`
шаблону; Vite не попереджає про `__dirname`/розширення; §12 без чисел, що
дрейфують.

**Хвиля 1:** на базі з `pnpm db:demo` `pnpm live:smoke` зелений: картка →
кошик → чекаут → рядок в `orders` із декрементом залишку (безумовно — демо
вмикає облік); єдина точка видачі обрана автоматично; нуль `pageerror` з
непорожнім кошиком на всіх SSR-сторінках, включно з `order-success`;
`lastmod` валідний W3C на кожному URL; бейдж наявності збігається з
`stock_status` у БД; JSON-LD `availability` відповідає статусу; ціни й
`shippingCost` у `orders` дорівнюють серверному розрахунку, а не значенням
із запиту; кожен текстовий контрол чекауту має `id` і `label[for]`; `pnpm
test:schema` має кейси на воронку, три коди відмови (шість сценаріїв),
нестачу залишку, декремент, два конкурентні сценарії, скасування однією
транзакцією й ціну на головній; повний ланцюг гейтів зелений; `.env.local`
розробника після прогону не змінений.

## Додаток А. Рішення власника 2026-09-03

1. **Черга:** К2-Е0 — перший етап треку К2, після треку T, перед К3 Е2;
   борги треку T — короткою хвилею перед ним, одним планом.
2. **Контракт дат:** `mode: 'date'` у К2-Е0 (не лише межа виводу).
3. **`decrease_on_order`:** реалізувати write-side декремент у К2-Е0.
4. **Демо-сід:** покупний демо-магазин; канон не чіпати.
5. **`pilot:pack` у CI** job `packaging` — ре-рішення від 2026-08-01
   (борг №2 стосується `pilot` з Gate B).

## Додаток Б. Відкинуті альтернативи (з причиною, доведеною кодом)

- **`baseURL = BETTER_AUTH_URL ?? VITE_SITE_URL`** — спростовано: better-auth
  1.7.1 `context/helpers.mjs:60-75` кладе в `trustedOrigins` рівно origin з
  `baseURL`, `origin-check.mjs:104-113` відкидає інші з 403; дев на `:3111`
  з `VITE_SITE_URL=:3000` не зміг би ввійти.
- **`pg.types.setTypeParser` для дат** — мертвий для доменних запитів:
  `drizzle-orm/node-postgres/session.js:26-31` підкладає identity-парсер.
- **`customType()` у схемі** — у репо не вживається; механізм `mode: 'date'`
  уже є в auth-схемі.
- **Фікстури «у форматі драйвера» з `.000000`** — Postgres такого не друкує
  (дробову частину обрізає); і формат залежить від GUC кластера — тест
  пінив би оточення, не код.
- **`<ClientOnly>` навколо бейджів** — переносить обовʼязок на кожну
  майбутню тему; дефект у даних лишається.
- **grep-гейт 13 літералів по host-`dist`** замість сентинелів у packaging
  — host-dist у CI не будується; сентинели в `dist` пакета ловлять те саме
  усічення списку.
- **Кількість по точках гейтить продаж** — потребує прапорця «магазин веде
  облік», якого немає; статус — уже DEFAULT і уже правило пʼяти з семи
  місць.
- **Розширити parity шаблон↔хост на `vite.config.ts`** —
  `sync-create-store-template.mjs:20-23` свідомо не синкає його.

**Додано ред. 1.2 (аудит r2):**

- **Guarded `UPDATE … WHERE quantity >= n` без блокування читання** —
  захищає від оверселу, але фліп статусу від pre-read залишку хибний під
  конкуренцією (два по 1 на залишок 2 → нуль при `in_stock`); `FOR UPDATE`
  робить і арифметику, і фліп правдивими одним механізмом.
- **Сід-агностичні харнес-тести з умовною логікою («зона є або немає»)** —
  крихкі й дублюють декларацію доставки вчетверте; сід як єдиний власник +
  ідемпотентні фікстури дешевші й уже відповідають фактичній залежності
  тестів від сідових слагів/цін.
- **Спайк `Date` через serverFn throwaway-роутом** — питання закривається
  типом `DefaultSerializable` бібліотеки; поведінку доводить live-smoke без
  тимчасового коду.
- **Ручне дзеркало `PlaceOrderInput` у server-only дереві з `data as …`** —
  ховає дрейф двох копій і не дає клієнту типу відмов; тип у T0 +
  `satisfies` на схемі роблять копію неможливою.
- **`id`/`htmlFor` лише для чотирьох полів контактів (B5 r1)** — часткове
  правило при нулі звʼязків у шести формах; одне правило на теку з одним
  асертом дешевше за вибірковий фікс.
- **Підміна `.env.local` з бекапом у `finally` в live-smoke** — зайва
  (явний env виграє за побудовою) і небезпечна на SIGINT.
- **`engines.node >= 20.11` (мінімум для `import.meta.dirname`)** — нижчий за
  фактичну вимогу `@tanstack/react-start` (`>=22.12.0`), тобто далі брехав
  би про сумісність; поріг дзеркалить Start.

## Додаток В. Рішення ред. 1.2 (аудит r2; архітектор — Claude Fable, 2026-09-04)

Прийняті при переписуванні плану; **підтвердження власника — при
затвердженні плану ред. 1.2** (жодне не суперечить Додатку А, кожне лише
конкретизує його):

1. `decrease_on_order = true` у демо-сіді — наслідок рішень А.3 (write-side
   у К2-Е0) і А.4 (покупний демо): без нього DoD «зі списанням» не
   доводиться живим прогоном.
2. Порядок хвилі 1: сід (Е0-6) перед write-side (Е0-3) і воронкою (Е0-4);
   спайк Е0-1 знято.
3. `engines.node >= 22.12` у скаффолдері — дзеркало вимоги Start; пін тестом.
4. Автовибір єдиної точки видачі й правило доступних імен для всієї
   `checkout-ui` — розширення scope Е0-4 тим самим патерном, що вже є.
5. `cancelMyOrder` переходить на ескалацію в одній транзакції — другий
   споживач механізму Е0-3; `withStoreOperatorDb` лишається для
   серверно-ініційованих дій.
6. DDL у К2-Е0: `banners.image_url` → nullable (канон `0004`) — наслідок
   рішення А.4 про банери без фото; `NOT NULL` суперечив стану, який тема
   вже підтримує. Це єдина зміна схеми етапу; `mode: 'date'` DDL не чіпає.
