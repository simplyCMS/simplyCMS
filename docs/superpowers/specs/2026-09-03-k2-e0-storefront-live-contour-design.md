# Санація живого контуру вітрини — трек К2, етап Е0 (+ борги треку T)

> **Статус: затверджено власником 2026-09-03** (брейнштормінг-сесія після
> фінального рев'ю треку T; пʼять рішень власника — Додаток А). Це
> **перший етап треку К2 «Вітрина»** роадмапу і водночас секція **«Борги
> треку T»** — обидві хвилі йдуть одним планом, бо доводяться одним стендом.
> Черга — рішення власника того ж дня: **після треку T, перед К3 Е2**.
> Імплементаційний план (superpowers writing-plans) пишеться після рев'ю
> цього документа. 🔴 Ред. 1.1 (2026-09-03): план пройшов Codex-аудит r1
> (REJECT 5B/5M/3m, усі підтверджені) — правки в плані ред. 1.1; у спеці
> змінено лише сентинел дерева `storefront` (T-3).
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
| 9 | `template/vite.config.ts` і оверлей пілота поза будь-якою програмою `tsc`; `__dirname` у `vitest.config.ts:5` і `vite.config.ts:20` (Vite попереджає при кожному запуску); картки головної без ціни (`toCardViewModel.ts:23-24`, посилання «звіт Ф1, ризик №4» — 0 збігів у `docs/`); банери демо-сіду з файлами, яких немає (`demo-seed.sql:234,249`) | `template/tsconfig.json:22` include без `vite.config.ts`; коверидж-тест виводить список із нього ж | трек T / К2 |

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
після Gate D (щоб не зіпсувати `dist` для C/D) — мутаційний крок: записати
`src/routes/my/__leak.tsx` з bare `simplycms/db`, `vite build` **мусить**
упасти з `[import-protection]`; повторити з відносним
`../../../node_modules/simplycms/src/db/client` і **реальним** експортом
(`resolveDatabaseUrl` — з вигаданим ім'ям збірка падає на `MISSING_EXPORT`
раніше за межу, і доказ хибний; спіймано на рев'ю); прибрати файл; звіт
через `report.mjs::step`. Ціна — дві збірки, ≈10 с. `pnpm pilot:pack` іде в
CI job `packaging` після `test:packaging` (+≈1–2 хв на `pnpm install`
скретча; job сьогодні 50 с при ліміті 600). Борг №2 роадмапу звужується до
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
`vitest.config.ts:5` **і** `vite.config.ts:20`; розширення `.ts` у
відносному імпорті декларації в `vite.config.ts:11`. Блок `#region
pilot-only` оверлею лишається поза `tsc` (функціонально покритий Gate C).

**T-5. §12 — структурні твердження замість чисел.** Після T-3 таблиця
читачів отримує сьомий рядок «контроль списку — сентинели»; рядки/байти
лишаються лише як порядок величини; 13 маркерів посилаються на тест, а не
на ручний grep. Урок №8 роадмапу доповнюється цим прикладом.

### 2.2. Хвиля 1 — К2-Е0

**Е0-1. Спайк: `Date` через межу serverFn.** Одне питання: чи `Date`
проходить `createServerFn`-payload і loader (seroval) як `Date`. Результат
фіксує форму Е0-2: «так» — контракт наскрізний; «ні» — серіалізація
`toISOString()` на межі serverFn, а всередині сервера контракт лишається
`Date`. Спайк — throwaway, без коду в дереві.

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
- Споживачі: `ProductListRow`/view-model-и отримують `Date`; чотири сторінки
  кабінету форматують через `Intl` без `new Date(str)`.
- Тести: `sitemap.test.ts` — фікстури `new Date(...)`, асерт W3C-регексом;
  `storefront-loaders.test.ts:193` — `toBeInstanceOf(Date)` (контракт коду,
  а не GUC кластера).
- Спека К3, Додаток Б-6, переписується: колекції адмінки Е3+ приймають `Date`.

**Е0-3. Наявність — «статус є джерелом правди на читанні; кількість — його
деталь; write-side тримає статус правдивим».**
- `domain/inventory.ts`: `isPurchasable(status: StockStatus | null):
  boolean` — `out_of_stock → false`, `on_order → true`, `in_stock | null →
  true`. Без опцій-тумблерів. `calculateProductAvailability` зводиться до
  неї (модифікації — `some`).
- Шість споживачів переходять на неї: `stock-info.ts:82`, `stock.ts:96`,
  `catalog-products.ts:133` (→ фільтр `inStockOnly`), `ModificationSelector`
  і `ProductCard` (уже так), JSON-LD у `$productSlug.tsx`: `in_stock →
  InStock`, `on_order → BackOrder`, `out_of_stock → OutOfStock`.
- `StockDisplay`: «В наявності: N шт» лише коли `totalQuantity > 0`, інакше
  «В наявності» (гілка `:71-73` уже є); розкладка по точках — як була.
- Write-side у `createOrder` (та сама транзакція): якщо
  `decrease_on_order = true` і для позиції існують рядки залишків —
  `UPDATE stock_by_pickup_point SET quantity = quantity - n WHERE … AND
  quantity >= n` (інакше відмова `not_purchasable`); коли сума по цілі стає
  0 — `stock_status := 'out_of_stock'`. Без рядків залишків нічого не
  змінюється (магазин не веде обліку). Тумблер отримує читача.
- Тести: `inventory.test.ts` під нову формулу; харнес — фікстура `tryfazny`
  («негативний контроль без залишку», `fixtures/storefront-client.ts:14`)
  **перенацілюється на `out_of_stock`**, а не інвертується (інакше сюїта без
  жодного кейсу `false`); новий файл харнеса на декремент і переворот
  статусу; `showcase.test.ts:236` (залишок закритої точки) — без змін.

**Е0-4. Чекаут — «сервер рахує і відмовляє доменно; клієнт показує, не
вирішує».**
- `placeOrder` повертає union (прецедент `profile-orders.ts:66-89`):
  `{ ok: true; order: PlacedOrder } | { ok: false; reason:
  'shipping_unavailable' | 'pickup_point_invalid' | 'not_purchasable' }`.
  Не `Error` з `.code`: чи проносить `createServerFn` кастомні поля через
  RPC — у репо не перевірено, union працює за побудовою.
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
  мапить `reason → t('checkout.rejected.<reason>')` з фолбеком — як
  `CheckoutAuthBlock.tsx:61-63` мапить коди Better Auth.

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

**Е0-6. Демо-сід — покупний магазин.** `migrations/demo/demo-seed.sql` у
своїй id-нумерації додає 1 `shipping_methods` (system, flat, активний),
1 `pickup_points` (активна, привʼязана до методу), `stock_by_pickup_point`
для 2–3 товарів — щоб обидві гілки Е0-3 (облік є / обліку немає) жили в
одному сіді; банери — `image_url = NULL` («порожній круг» — рішення
власника, яке `HeroBanner.tsx:46` уже документує). Шапка сіду (`:3-17`)
фіксує нову межу: демо-магазин мусить доходити до рядка в `orders`. Пін
`seed-determinism.test.ts:21` оновлюється як частина компенсаційного
контролю; `pnpm template:sync` обовʼязковий. Канон `0003_seed` не
чіпається — «доставку заводить магазин» лишається правдою для проду.
Ціна на головній: `homeProductColumns` розширюється, мапер — той самий
`toProductListItem`/`resolvePrice` (`product-list-item.ts:50-59`), не
другий `MIN(price)`-агрегат; посилання «звіт Ф1, ризик №4» знімається.

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
`@playwright/test` для трьох речей, яких curl не бачить: `pageerror` з
непорожнім кошиком, бейдж наявності після гідратації, і сама воронка
(картка → кошик → чекаут → `SELECT count(*) FROM orders` +1, залишок −n).
Друкує таблицю §12 — вона стає виводом, а не рукописом. Запуск
`PG_HARNESS_URL=… pnpm live:smoke` (db:demo → build → start → прогін →
зупинка). Не CI (Postgres + браузер) — той самий клас, що `pilot` з Gate B;
місце — гейти релізу поруч із `pilot:pack`, окремим рішенням після К2-Е0.
Через К6 він стає Gate B на Postgres — пишеться один раз.

## 3. Порядок і залежності

```
Хвиля 0 (≈1 день):  T-1 → T-2 → T-3 → T-4 → T-5
Хвиля 1 (≈3–4 дні): Е0-1 → Е0-2 → Е0-3 → Е0-4 → Е0-5 → Е0-6 → Е0-7 → Е0-8
```

- Е0-2 залежить від Е0-1 (форма серіалізації).
- Е0-4 залежить від Е0-3 (`isPurchasable` у `createOrder`) і Е0-2 (типи
  рядків замовлення).
- Е0-6 залежить від Е0-3/Е0-4 (сід має що декрементувати й через що купити).
- Е0-8 залежить від усього (він і є DoD).
- Хвиля 0 ні від чого не залежить і може виконуватись паралельно з Е0-1.

Мінімальний гейт кожного кроку — як у треку T: `pnpm format:check && pnpm
lint && pnpm test`; для кроків із харнесом — ще `pnpm test:schema`; для
T-2/T-3 — `pnpm build:packages && pnpm test:packaging && pnpm pilot:pack`.

## 4. Гейти й докази (нічого нового в контурах — лише файли в чинних)

| Що доводить | Файл | Контур |
|---|---|---|
| Гідратація кошика | `packages/simplycms/src/react-query/__tests__/cart-hydration.test.tsx`: `renderToString` → jsdom-глобали (техніка `packages/cli/src/theme-conformance-dom.mjs`) з передзаповненим `localStorage` → `hydrateRoot` + spy на `console.error` | `test` |
| Правило наявності | `domain/__tests__/inventory.test.ts`; харнес `storefront-client-queries.test.ts` (фікстура → `out_of_stock`) | `test` + `test:schema` |
| Декремент і переворот статусу | харнес `order-stock.test.ts` | `test:schema` |
| Воронка → `orders`; три доменні відмови | харнес `checkout-flow.test.ts` (кошик → `createOrder`) | `test:schema` |
| Date-контракт | `sitemap.test.ts` (Date-фікстури + W3C-регекс); `storefront-loaders.test.ts` (`instanceof Date`) | `test` + `test:schema` |
| Env-контракт | `tests/env-contract.test.ts` | `test` |
| Import Protection: дані + рядок | `tests/import-protection-wiring.test.ts` | `test` |
| Import Protection: поведінка | мутаційний крок у `scripts/pilot-pack/run.mjs` після Gate D | `pilot:pack` → CI `packaging` + реліз |
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
`data-access.instructions.md` — розділ «Контракт дат» поруч із «Контракт
id»; `optimization.instructions.md:54`; `test-contours.md` — §12 отримує
рядок «живий прогін = `pnpm live:smoke`» і посилання на харнес-тести;
`v2-state-map.md` §2 — новий датований прогін.

## 6. Ризики та мітигації

| Ризик | Мітигація |
|---|---|
| `Date` не проходить seroval/loader як `Date` | Е0-1 спайк першим; фолбек — `toISOString()` на межі serverFn, контракт усередині сервера незмінний |
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
кошик → чекаут → рядок в `orders` із декрементом залишку; нуль `pageerror`
з непорожнім кошиком на всіх SSR-сторінках; `lastmod` валідний W3C на
кожному URL; бейдж наявності збігається з `stock_status` у БД; JSON-LD
`availability` відповідає статусу; ціни й `shippingCost` у `orders`
дорівнюють серверному розрахунку, а не значенням із запиту; `pnpm
test:schema` має кейси на воронку, три відмови, декремент; повний ланцюг
гейтів зелений.

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
