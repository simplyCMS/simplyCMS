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
> затвердженні плану). 🔴 **Ред. 1.3 (2026-09-05): брейншторм із власником** —
> шість ухвалених рішень (Додаток Г): скасування замовлення ПОВЕРТАЄ
> залишок; списання й повернення — з ОДНІЄЇ детермінованої точки
> (`orders.pickup_point_id` → системна → перша активна); банери демо —
> inline `data:`-SVG, тож **DDL з етапу зникає повністю** (К2-Е0 не змінює
> схему БД); `decrease_on_order = true` — умовним `update` у демо-сіді;
> правило доступних імен розширено на всю воронку зі структурним
> ESLint-гейтом на зону; `engines.node >= 22.12.0` — на всі пʼять
> публікованих пакетів і шаблон. У спеці змінено T-4, Е0-3, Е0-4, Е0-6, §4,
> §5, §6, §7, §8, Додаток Б і Додаток В; додано Додаток Г.
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
лише монорепо. 🔴 Ред. 1.3: `engines.node: ">=22.12.0"` — не лише у скаффолдері, а
в **усіх пʼяти** публікованих маніфестах і в `template/package.json.tpl`. Сьогодні
поріг оголошують рівно два пакети — `@simplycms/cli`
(`package.json:29-31`) і `create-simplycms-store` (`package.json:14-16`),
обидва `">=20"`; `simplycms`, `@simplycms/theme-solarstore`,
`@simplycms/plugin-faq` і шаблон не оголошують нічого — при тому, що саме
флагман оголошує `@tanstack/react-start` у **`peerDependencies`** (`^1.0.0`),
тобто ВИМАГАЄ його від магазину-господаря, а шаблон ставить його версією
`1.167.42` (`package.json.tpl:51`). Це не політика, а дзеркало вимоги Start
(`node_modules/@tanstack/react-start/package.json` → `engines.node:
">=22.12.0"`). Пін — ОКРЕМИЙ новий файл `tests/engines-node-floor.test.ts`:
шість порогів (пʼять маніфестів + `template/package.json.tpl`, який тест
читає напряму) не слабші за вимогу ВСТАНОВЛЕНОГО Start, прочитану через
`createRequire` — у ESM-тесті `require` не існує; порівняння семантичне, не
рядкове, тож бамп Start підіймає поріг сам, а не пінить константу. 🔴 НЕ кейс
у `tests/create-store-template-parity.test.ts`, як планувала ред. 1.2: після
Р6 інваріант стосується пʼятьох пакетів ЯДРА, а той тест — про парність
ШАБЛОНУ з монорепо, і `engines` у коло його полів не входить (виміряно:
`pnpm install` із завищеним порогом друкує `[WARN] Unsupported engine` і
виходить із кодом `0`). Гейт для конфігу МАГАЗИНУ —
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
  «В наявності» — у гілці ОДНІЄЇ точки (`:66-77`, тернар `:71-73`) це вже
  зроблено; розкладка по точках — як була. 🔴 Названа межа: багатоточкова
  гілка (`:79-91`) малює лічильник (`:84`) БЕЗУМОВНО, тож магазин із двома і
  більше активними точками й без рядків обліку покаже «В наявності: 0 шт».
  Сьогодні цей рядок недосяжний — `stock-info.ts:82` при нулі й статусі
  `in_stock` віддає `isAvailable: false`, і компонент виходить раніше
  (`:55-64`), — а після переходу на `isPurchasable` стає досяжним. Демо-сід
  везе рівно ОДНУ активну точку, тож у контурі етапу межа не проявляється;
  вирівнювання гілки — поза Е0.
- Write-side виноситься з `order-create.ts` у власні модулі
  `storefront/loaders/` — ПАРОЮ взаємно обернених операцій: списання при
  створенні замовлення і 🔴 ред. 1.3 повернення при скасуванні. Скільки
  файлів і як названі — справа плану (канон 150 рядків); спека пінить
  ПАРУ і те, що обидві живуть у server-only дереві. Обидві приймають
  готову транзакцію, тобто працюють у ТІЙ САМІЙ, що й запис замовлення.
  Умова роботи — `decrease_on_order = true` і наявні рядки залишків для
  позиції; без них нічого не змінюється (магазин не веде обліку). Тумблер
  нарешті отримує читача.
- 🔴 Ред. 1.3: списання й повернення йдуть з ОДНІЄЇ детермінованої точки, а
  не розкладаються по кількох. Правило вибору — те саме для обох напрямків:
  (1) `orders.pickup_point_id`, якщо він є — чекаут уже проносить це поле
  наскрізь (`checkout-input.ts:39` → `checkout.ts:110` →
  `order-create.ts:118`; колонка `uuid` nullable із FK
  `orders_pickup_point_id_fkey`, `schema.ts:785`); (2) інакше — точка з
  `pickup_points.is_system = true` (`schema.ts:585`, `boolean default false
  not null`; прапорець уже знає адмінка — бейдж «Системна»,
  `PickupPointEdit.tsx:191-194`, — а на write-path читача не мав ЖОДНОГО);
  (3) інакше — перша активна за `(sort_order, id)`. Для замовлення точка вже
  записана в `orders`, тож повернення точне БЕЗ таблиці резервів. 🔴 Названа
  межа: FK `orders_pickup_point_id_fkey` — `ON DELETE set null`
  (`0001_init.sql:651`), тож видалення точки ПІСЛЯ оформлення обнуляє
  `orders.pickup_point_id`, і повернення йде вже за загальним правилом
  (системна → перша активна). Схему етап не змінює (ред. 1.3), тож це
  приймається як межа, а не лагодиться. Свідомо прийнятий наслідок
  семантики: залишок 3+2 у двох точках не продасть 4 —
  для магазину з одним складом (і для демо) це правильна відмова, а не
  дефект.
- `SELECT … FOR UPDATE OF stock_by_pickup_point` (Drizzle
  `.for('update', { of })`) лишається: під блокуванням робиться і
  арифметика, і фліп статусу. Списання — від заблокованого залишку, нестача
  — `InsufficientStockError` з відкатом (`not_purchasable` для клієнта);
  коли сума по цілі стає 0 — `stock_status := 'out_of_stock'`, а при
  поверненні — зворотний фліп у `'in_stock'` **лише тоді, коли сума ДО
  повернення була нулем**. 🔴 Умова саме така, а не «сума знову > 0»:
  остання істинна завжди (позиція замовлення має `quantity > 0` за CHECK
  `order_items_positive_quantity`), тож скасування вмикало б назад і той
  товар, який у `out_of_stock` перевів не облік, а рішення магазину.
  🔴 Ред. 1.2: саме `FOR UPDATE`, а не guarded UPDATE: переворот статусу від
  pre-read залишку давав два паралельні замовлення по одиниці на залишок 2
  без фліпу — нуль на складі при `in_stock`. Позиції обробляються у сталому
  порядку (`productId/modificationId`) — проти дедлоку двох кошиків.
- Права: `app_user` не пише в облік і не редагує `orders` (`0002_grants.sql`),
  тож службова дія йде через **scoped-ескалацію** — `operator(fn)`, другий
  аргумент `fn` у `withCustomerDb`/`withOrderTokenDb` (третій у
  `withSessionDb`): `SET LOCAL ROLE app_admin` рівно на час `fn` у ТІЙ САМІЙ
  транзакції, після RLS-прийнятого запису покупця; runtime-роль має `set
  true` на обидві ролі (`0000_prelude.sql:94-95`). 🔴 Ред. 1.2: той самий
  механізм замінює три транзакції `cancelMyOrder` (`profile-orders.ts:60`)
  на одну — «перевірив право → записав» без вікна; `withStoreOperatorDb`
  лишається для дій, які ініціює сервер (реєстр і конфіг плагінів). 🔴 Ред.
  1.3: ця сама транзакція ще й ПОВЕРТАЄ залишок (`releaseStock` за тим самим
  правилом точки) — інакше інваріант асиметричний і демо-магазин після
  кількох скасувань показує нуль залишку при нулі продажів. Порядок усередині
  ескалації фіксований: блокування рядка замовлення (`lockOrderStatus` —
  `SELECT … FOR UPDATE` по `orders`) → повернення залишку → статус. Блокування
  тут не «ще одна перевірка статусу»: подвійний клік дає ДВІ паралельні
  транзакції, які під READ COMMITTED обидві прочитали б `new` і повернули б
  залишок ДВІЧІ; заблокований рядок пропускає рівно одну, друга бачить уже
  змінений `status_id` і виходить без повернення. Повернення ПІСЛЯ статусу
  лишало б вікно «замовлення скасоване, склад ще ні». Ні DDL, ні нових
  грантів це не потребує: `app_admin` уже має `select, insert, update,
  delete` на `public.stock_by_pickup_point` (`0002_grants.sql:156`, блок
  «app_admin: доменні таблиці адмінки»). Правило — у
  `data-access.instructions.md`, «Ескалація ролі покупцем».
- Тести: `inventory.test.ts` під нову формулу; харнес — фікстура `tryfazny`
  («негативний контроль без залишку», `fixtures/storefront-client.ts:14`)
  **перенацілюється на `out_of_stock`**, а не інвертується (інакше сюїта без
  жодного кейсу `false`); новий файл харнеса `order-stock.test.ts` ПОВЕРХ
  покупного сіду (Е0-6): списання з сідового залишку, нестача з відкатом,
  два конкурентні кейси — «3 / 2+2 → один» і «2 / 1+1 → обидва, статус
  `out_of_stock`» (пінить читання під `FOR UPDATE`). 🔴 Негативний контроль
  ролі живе не тут: усі позитивні кейси цього файлу й так проходять лише під
  ескалацією (без `operator` списання падає на `FOR UPDATE` — `app_user` має
  на `stock_by_pickup_point` тільки SELECT, `0002_grants.sql:87`), а
  комітований негативний кейс сусідньої межі — у
  `storefront-personal-data.test.ts`.
  🔴 Ред. 1.3 — ще чотири кейси, по одному на ланку правила точки й на
  симетрію: списання йде саме в `orders.pickup_point_id`; за його
  відсутності — у системну (`is_system = true`); за відсутності обох — у
  першу активну за `(sort_order, id)`; скасування повертає рівно стільки ж і
  В ТУ САМУ точку, а перехід 0 → n перевертає статус назад у `in_stock`.
  `showcase.test.ts:236` (залишок закритої точки) — без змін, лічильник
  точок — 2 (сідова + фікстурна).

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
  `id` і нуль `htmlFor` при 24 `<label>` і 28 контролях
  (`input`/`select`/`textarea`), з яких 25 — текстові: три radio/checkbox
  лежать прямими дітьми `<label>` (`CheckoutDeliveryForm.tsx:227-236`,
  `CheckoutPaymentForm.tsx:44-55`, `CheckoutRecipientForm.tsx:226-228`) і
  правила не потребують. Тож ані скрінрідер, ані `getByLabel` Playwright
  поля не знаходять; правило — кожен текстовий контрол має `id` і
  `<label htmlFor>`. 🔴 Префікс `id` — за ФІЧЕЮ, не за іменем теки:
  `checkout-*` (Е0-8 уже читає `#checkout-pickup-point`), `profile-*`,
  `catalog-*`, `review-*`; готовий прецедент у репо —
  `reviews-ui/ReviewForm.tsx:82-86` (`<label htmlFor="review-title">` +
  `<input id="review-title">`). 🔴 Ред. 1.3: правило поширюється на **всю
  воронку**, а не лише на чекаут, бо розрив однаковий і виміряний:
  `profile-ui` — 13 `<label>` / 0 `htmlFor` / 13 контролів (11 текстових),
  `catalog-ui` — 5 / 4 / 8 (4 текстові), `reviews-ui` — 4 / 1 / 2,
  `cart-ui` — форм немає (0 / 0 / 0). Тема `default` (0 `<label>` при
  одному контролі, `HomeSections.tsx:58`) у зону НЕ входить: форм тема не
  несе, а її власний гейт — `theme:conformance`. Гейт — структурний, а не разовий:
  `eslint-plugin-jsx-a11y` з ОДНИМ правилом
  `jsx-a11y/label-has-associated-control` (`error`) на зону цих тек у
  `eslint.config.mjs` — тим самим механізмом зон, яким уже тримаються
  тір-зони й i18n-селектори; ті самі пʼять тек там уже перелічені разом
  (`I18N_MIGRATED_FILES`, `eslint.config.mjs:66-70`), тож зона — копія
  готового списку, а не новий розбір меж. 🔴 Конфігурація правила —
  `{ assert: 'htmlFor', depth: 3 }`, і це не смак: з дефолтним
  `assert: 'either'` правило ловить **5 випадків із 41** (виміряно прогоном),
  бо будь-який `{t('…')}` усередині лейбла задовольняє гілку «має текст», а
  `depth: 2` за замовчуванням не дістає до вкладеного контрола. `htmlFor` —
  єдиний режим, який дає справжній гейт. Ціна, прийнята свідомо: під правило
  підпадають і пʼять label-обгорток radio/checkbox, яким доведеться дати
  `id` + `htmlFor`. 🔴 Межа гейта, і знати її обовʼязково (урок P1 §1 —
  гейт мусить доводити те, що обіцяє): правило дивиться з боку `<label>` —
  «кожен label має контрол». Зворотний бік — контрол БЕЗ жодного `<label>` —
  воно не бачить; таких у зоні девʼять (зокрема пошукові поля
  `AddressSelectorPopup.tsx:87` і `RecipientSelectorPopup.tsx:92`, у яких
  лише `placeholder`), і закриває їх механічна правка (`aria-label`) плюс
  поведінковий асерт, а не лінт. Двобічний гейт дало б друге правило
  `jsx-a11y/control-has-associated-label`, від якого відмовились (Додаток Б). 🔴 Це НОВА `devDependency` (плагіна в дереві
  сьогодні немає), тож `pnpm-lock.yaml` перегенеровується В ТОМУ САМОМУ
  кроці: `pnpm install --frozen-lockfile` — ПЕРШИЙ гейт, і розсинхрон
  манифеста з локом валить увесь CI ще до першої перевірки (урок PR #20).
  Поведінковий асерт (`getByLabelText`) лишається там, де юніти форм і так
  пишуться, — у `checkout-ui`; решту тек покриває ESLint.
  (б) **Автовибір єдиної точки видачі** тим самим
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
`shipping_zones` (`shipping_rates.zone_id` — NOT NULL), 1 `pickup_points`
(🔴 ред. 1.3 — **системну**, `is_system = true`: склад, у який Е0-3 списує
замовлення без власної точки видачі), 1 безкоштовний `flat`-тариф,
`stock_by_pickup_point` для двох панелей — щоб обидві гілки Е0-3 (облік є /
обліку немає) жили в одному сіді.

🔴 **Ред. 1.3 — банери: inline `data:`-SVG, і DDL з етапу зникає повністю.**
Замість «`image_url = NULL` + міграція `0004`» (ред. 1.2) сід кладе
самодостатній плейсхолдер `data:image/svg+xml;charset=utf-8,…` з підписом
банера (параметр `charset` явний — підпис кириличний, а `;utf8` параметром
MIME не є і живе лише з поблажливості браузерів), а
колонка лишається `text NOT NULL` (`0001_init.sql:13`, `schema.ts:1040`).
Три причини, кожна перевірена кодом: (а) `BannerSlider.tsx:128-131`
рендерить `<img src={banner.image_url}>` БЕЗЗАСТЕРЕЖНО у канонічній
`HomeView` — nullable дав би биту картинку; (б) `image_url: string` стоїть і
в T0-контракті (`contracts/objects/banner.ts:14`), і в замороженому
`supabase/database.ts:39`, на якому до К3 типізується адмінка, а
`BannerEdit.tsx:656` ВИМАГАЄ фото для збереження
(`disabled={… || !form.image_url || …}`) — nullable зробив би baseline
брехливим і розсинхронив адмінку; (в) `HeroBanner.tsx:52-54` банер без фото
не «підтримує», а ІГНОРУЄ
(`banners.find((item) => item.desktop_image_url || item.image_url)`), тож
демо-мета «зробити магазин видним» від `NULL` не виграє нічого. Заразом це
закриває частину дефекту №9 §1: сідові банери більше не посилаються на
файли, яких у репо немає (`demo-seed.sql:234,249`). **Наслідок для всього
етапу: К2-Е0 не змінює схему БД взагалі** — з нього зникають файл
`packages/simplycms/migrations/0004_banners-image-nullable.sql`, крок
`db:diff` із ревʼю DDL і правки `schema.ts:1040`,
`contracts/objects/banner.ts:14`, `BannerSlider.tsx`,
`baseline.test.ts:51-57`, `create-store-template-parity.test.ts:60-68` та
`migrations/README.md` у частині `0004`.

🔴 **Ред. 1.3 — `decrease_on_order = true` УМОВНИМ `update`.** Канон
`0003_seed.sql:59-70` кладе рядок `stock_management` зі значенням
`{"decrease_on_order": false}` під `on conflict (key) do nothing`, тож
демо-сід робить `update … where key = 'stock_management' and
value->>'decrease_on_order' = 'false'` — той самий патерн ідемпотентності,
що вже вживається у файлі (`on conflict do nothing`, `where not exists`).
Тобто повторний накат файлу по рядку, який уже `true`, не пише НІЧОГО.
🔴 Захистом ручного налаштування власника предикат НЕ є: власницьке `false`
він якраз матчить і перевертає на `true`. Це прийнятно, бо `pnpm db:demo` перед накатом
дропає й створює базу заново (`scripts/demo-db.mjs:70-71`), тобто
попереднього стану власника не бачить у принципі. На чистій базі демо веде
облік — і live-smoke доводить списання буквально, як вимагає DoD.
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
BETTER_AUTH_SECRET, VITE_SITE_URL}`; `REQUIRED_ENV_VARS` доктора **дорівнює**
серверній підмножині — рівно `{DATABASE_URL, BETTER_AUTH_SECRET}`, а не «⊂»:
включення лишало б зеленим доктора, який знає один ключ із двох, тобто рівно
той розсинхрон трьох описів env, що є дефектом №8 §1. Тексти
(`CLAUDE.md`, `.env.example`): WARN очікуваний у dev,
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
| Декремент і переворот статусу; **вибір однієї детермінованої точки** (три ланки правила) і **повернення при скасуванні**; конкурентність (`FOR UPDATE`); негативний контроль ролі | харнес `order-stock.test.ts` поверх демо-сіду | `test:schema` |
| Воронка → `orders`; серверна ціна й знижка; три доменні коди відмови у шести сценаріях + нестача залишку | харнес `checkout-flow.test.ts` (кошик → `placeOrderFor`) поверх демо-сіду + `HIDDEN_SHIPPING_FIXTURES` | `test:schema` |
| Ціна на головній — значення, не лише тип | харнес `storefront-loaders.test.ts` (`loadHomeProducts`/`loadSectionProducts` проти демо-сіду) | `test:schema` |
| Скасування — ОДНА транзакція з ескалацією (`operator` усередині `withCustomerDb`); `app_user` без UPDATE на `orders`, службовий запис іде під `app_admin` | харнес `storefront-personal-data.test.ts` | `test:schema` |
| Доступні імена контролів чекауту (поведінка); empty-state; автовибір точки | `checkout-ui/__tests__/{CheckoutDeliveryForm,CheckoutContactForm}.test.tsx` + спільний асерт `accessible-controls.ts` | `test` |
| Кожен `<label>` воронки звʼязаний із контролом (структурно; зворотний бік — контрол без `<label>` — правило не бачить) | `eslint.config.mjs` — зона пʼяти тек воронки з `jsx-a11y/label-has-associated-control` (`error`) | `lint` |
| Поріг Node **усіх пʼяти пакетів і шаблону** не слабший за вимогу встановленого Start | новий `tests/engines-node-floor.test.ts` (шість порогів; поріг Start читається через `createRequire`, порівняння семантичне) | `test` |
| Пул сесійних опцій — self-contained (тимчасова БД + канон) | `test-harness/pg/__tests__/db-session-options.test.ts` | `test:schema` |
| Date-контракт | `sitemap.test.ts` (Date-фікстури + W3C-регекс); `storefront-loaders.test.ts` (`instanceof Date`) | `test` + `test:schema` |
| Env-контракт | `tests/env-contract.test.ts` | `test` |
| Import Protection: дані + рядок | `tests/import-protection-wiring.test.ts` | `test` |
| Import Protection: поведінка | мутаційний крок останнім у `runGates()` (`scripts/pilot-pack/run.mjs`); чистий ре-білд захоплює вивід і червонить попередження Vite про `configLoader: 'native'` у конфізі магазину (T-4) | `pilot:pack` → CI `packaging` + реліз |
| Список `SERVER_ONLY` під контролем | `tests/dist-server-boundary.test.ts` (сентинели) | `test:packaging` |
| Шаблон типізується | `tsconfig.template.json` + `template-typecheck-coverage.test.ts` (автоматично) | `typecheck:template` |
| Етап не додає файлів канону — їх лишається рівно чотири | харнес `baseline.test.ts:51-57` | `test:schema` |
| Живий контур цілком — включно з композицією самого `cancelMyOrder` (`lockOrderStatus` → повернення залишку → статус): харнес її НЕ кличе, бо serverFn потребує сесії Better Auth, і відтворює лише читання під актором + повернення | `scripts/live-smoke.mjs` | реліз (окреме рішення), К6 |

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

**У кінці хвилі 1:** `CLAUDE.md` — «Quick Reference» (`live:smoke`; `db:demo`
як покупний демо), «Environment Variables» (WARN, `BETTER_AUTH_URL`),
«Database Commands» (той самий `db:demo`), «Project Structure» (тека
`scripts/` — `live-smoke.mjs`), «Tech Stack» (новий рядок Runtime `>=22.12` —
наслідок ред. 1.3, Р6) і блок лінт-зон (**шоста** зона: a11y-правило воронки
— наслідок ред. 1.3, Р5); `.env.example`;
`data-access.instructions.md` — розділи «Контракт дат» поруч із «Контракт
id» і «Ескалація ролі покупцем» у «Storefront (SSR)»;
`optimization.instructions.md:54`; `test-contours.md` — §12 отримує
рядок «живий прогін = `pnpm live:smoke`» і посилання на харнес-тести;
`v2-state-map.md` — §1 (покупний демо), §2 (новий датований прогін), §3.4 і
§6 п.4/п.6 (борг 0.4.1-4 закрито); роадмап — К2-Е0 ✅, борги T ✅, борг
0.4.1-4 ✅, рядок «Магазин на чистому Postgres» без «чекаут мовчить».

🔴 **Ред. 1.3 — два файли, які формально не є документами, але місце їм тут,
бо вони чіпають ПЕРШИЙ гейт ланцюга:** `eslint.config.mjs` (зона
a11y-правила воронки, Е0-4) і кореневий `package.json` разом із
`pnpm-lock.yaml` (нова `devDependency` `eslint-plugin-jsx-a11y` — лок
перегенеровується в тому самому кроці, інакше `pnpm install
--frozen-lockfile` валить увесь CI). Натомість зі списку етапу ЗНИКАЮТЬ
`packages/simplycms/migrations/README.md` і піни складу канону
(`baseline.test.ts`, парність шаблону): етап не змінює схему БД (Е0-6,
ред. 1.3).

## 6. Ризики та мітигації

| Ризик | Мітигація |
|---|---|
| ~~`Date` не проходить seroval/loader як `Date`~~ | знято (ред. 1.2): `Date` у `DefaultSerializable` Start; гейт поведінки — `order-success` у live-smoke |
| Блокування `FOR UPDATE` на «гарячому» товарі затримує паралельні оформлення | масштаб магазину; блокуються лише рядки залишків однієї цілі, у сталому порядку — без дедлоку; альтернатива (guarded UPDATE) давала хибний статус |
| Харнес-тести залежать від вмісту демо-сіду | залежність уже існувала (слаги, ціни, назви); сід під пінами `seed-determinism`/`demo-seed`; фікстури ідемпотентні й працюють і на чистому каноні |
| `mode: 'date'` торкається типів у десятках лоадерів/view-model-ів | DDL не змінюється; зміна механічна (той самий `mode`, що в auth-схемі); `pnpm typecheck` веде до кожного споживача; К2 будує дескрипторів уже на `Date` — робота один раз |
| Пін детермінізму сіду й парність шаблону | обидва оновлюються в тому самому кроці Е0-6; `template:sync` у чеклісті кроку |
| `pilot:pack` у CI подовжує job `packaging` | +≈3–5 хв, тому `timeout-minutes` job-а піднімається 10 → 20; мережа для `pnpm install` скретча — та сама, що для кореневого install |
| Гідраційний тест потребує «сервер без window, потім клієнт з window» в одному файлі | техніка `exposeDom` з `theme-conformance-dom.mjs` (уже в репо); дефолтний `environment: 'node'` vitest лишається |
| Union `placeOrder` міняє клієнтський контракт | одне місце виклику (`Checkout.tsx`); мапа `reason → i18n` з фолбеком |
| 🔴 Ред. 1.3: стан магазину змінився МІЖ замовленням і скасуванням — тумблер `decrease_on_order` вимкнули, точку деактивували, — і повернення розійшлося зі списанням | повернення йде за ТИМ САМИМ правилом точки й тією ж умовою тумблера, що й списання, тож розбіжність можлива лише при зміні конфігурації між двома подіями; для замовлення з `orders.pickup_point_id` (типовий випадок і весь демо-контур) точка зафіксована в рядку й не дрейфує зовсім — крім видалення самої точки: FK `orders_pickup_point_id_fkey` — `ON DELETE set null` (`0001_init.sql:651`), тож поле обнуляється і повернення йде за загальним правилом (системна → перша активна). Точний облік «скільки з якої точки взято» вимагав би окремої сутності з власним DDL, грантами й RLS — свідомо відкинуто (Додаток Б, блок ред. 1.3), бо етап лишається без зміни схеми |

## 7. Межі (свідомо НЕ робиться)

- Дескриптори домену як SSOT, full-page кеш, фасетна навігація — сам К2.
- Слайдер героя / другий банер — «Опційний беклог тем».
- Storage-порт, драйвери — К3 Е2 / К4.
- Пошук вітрини — окрема спека.
- `customType()` для дат, `ClientOnly` навколо бейджів, fallback `baseURL` —
  відкинуті (Додаток Б).
- Спайк Е0-1 — знято (ред. 1.2): питання закрите типами бібліотеки.
- 🔴 **Зміна схеми БД — К2-Е0 не має жодної** (ред. 1.3). `mode: 'date'`
  (Е0-2) DDL не чіпає за побудовою, а міграція
  `0004_banners-image-nullable.sql` знята разом із самою потребою в ній
  (Е0-6; причина — Додаток Б, блок ред. 1.3). Отже, окремого прогону
  `pnpm db:diff` етап НЕ має (Е0-2: `mode` — властивість TS-типу), а канон
  лишається чотирма файлами `0000_prelude` … `0003_seed`: склад пінить
  `baseline.test.ts:51-57`, і ні він, ні
  `create-store-template-parity.test.ts:60-68` цим етапом не чіпаються.
- Юніт доступних імен для `CheckoutAuthBlock` — не пишеться (потребує моків
  auth-клієнта); 🔴 ред. 1.3: саме правило до нього застосовується не
  вручну — файл лежить у зоні ESLint-гейта Е0-4, тож розрив `label`/контрол
  валить `pnpm lint`; без юніта лишається лише поведінковий доказ.
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
із запиту; жоден `<label>` у пʼяти теках воронки не лишився без
привʼязаного контрола (`pnpm lint`, правило
`jsx-a11y/label-has-associated-control`), а в `checkout-ui` кожен текстовий
контрол має ще й `id` і `label[for]` — це доводить поведінковий асерт
(`getByLabelText`), бо зворотний бік правило не бачить; `pnpm test:schema` має
кейси на воронку, три коди відмови (шість сценаріїв), нестачу залишку,
декремент із однієї детермінованої точки (три ланки правила), два
конкурентні сценарії, скасування однією транзакцією **з поверненням залишку
в ту саму точку** й ціну на головній; етап не додає файлів канону
(`baseline.test.ts:51-57` — рівно чотири) і не редагує DDL у `schema.ts`, тож
окремого прогону `pnpm db:diff` у ньому немає; повний ланцюг гейтів
зелений; `.env.local` розробника після прогону не змінений.

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

**Додано ред. 1.3 (брейншторм 2026-09-05):**

- **DDL `banners.image_url` → nullable (канон `0004`)** — відкинуто ланцюгом
  із чотирьох ланок, кожна прочитана в коді: `image_url: string` у
  T0-контракті (`contracts/objects/banner.ts:14`) і в замороженому baseline
  адмінки (`supabase/database.ts:39`); `BannerEdit.tsx:656` не дає зберегти
  банер без фото; `BannerSlider.tsx:128-131` рендерить `<img>`
  беззастережно; `HeroBanner.tsx:52-54` банер без фото не показує, а ІГНОРУЄ
  (`find((item) => item.desktop_image_url || item.image_url)`). Тобто
  nullable зробив би baseline брехливим, розсинхронив адмінку й не дав
  демо-магазину нічого — при тому, що вся мета демо в тому, щоб магазин було
  ВИДНО. Inline `data:`-SVG у сіді дає ту саму картинку без зміни схеми, а
  етап лишається без DDL.
- **Розкладання списання по кількох точках видачі** — унеможливлює точне
  повернення при скасуванні без окремої таблиці резервів: «з якої точки
  скільки взяли» ніде не записано. Натомість `orders.pickup_point_id`
  (`schema.ts:785`) дає привʼязку задарма — чекаут це поле вже проносить
  (`checkout-input.ts:39` → `checkout.ts:110` → `order-create.ts:118`).
- **Окрема таблиця резервів `order_item_reservations`** — нова сутність із
  DDL, грантами й RLS заради обліку, який уже виводиться з готового ключа в
  `orders`; етап без жодної зміни схеми перетворився б на етап зі схемною
  міграцією та новим шаром прав.
- **Правило доступних імен лише для `checkout-ui`** — два стандарти в одній
  воронці: у `profile-ui` 13 таких самих `<label>` при нулі `htmlFor`, тобто
  сусідня сторінка кабінету лишалась би недоступною скрінрідеру. Одне
  правило на пʼять тек із ESLint-гейтом коштує стільки ж, скільки вибірковий
  фікс, і не дає розриву відкритись назад.
- **Власне AST-правило в `eslint-rules/` замість плагіна** — відкинуто за
  критерієм, за яким там уже стоять пʼять правил: своє правило пишеться для
  СВОГО інваріанта, якого не існує поза цим репо (`query-key-from-entity` —
  наш реєстр `ENTITY`; `mutation-cache-sync` — урок №6 роадмапу;
  `server-fn-top-level` — конкретний баг компілятора Start;
  `server-only-relative` — наша межа `server-only`; `no-side-effect-import` —
  наша обіцянка `sideEffects: false`). «`<label>` звʼязаний із контролем» —
  не наш інваріант, а WCAG, який спільнота вирішувала десять років разом із
  крайовими випадками (вкладені контроли, `aria-labelledby`, кастомні
  компоненти). Своє правило тут було б відхиленням від норми, а не її
  продовженням, і його довелося б викидати на першому ж розширенні
  a11y-покриття.
- **Форк `eslint-plugin-jsx-a11y-x`** (peer `^9 || ^10`, реліз 2026-05-10) —
  peer-діапазон у ньому чистий, але `0.2.0`, один мейнтейнер і 72 тис.
  завантажень на тиждень проти 46 млн в оригіналу: для репо, яке публікує
  пʼять пакетів у npm, це гірша supply-chain-позиція, ніж застиглий, але
  масовий апстрім. Незакритий peer — попередження `pnpm`, а не помилка
  (`strict-peer-dependencies` вимкнено), і має штатний вихід
  `peerDependencyRules.allowedVersions`.
- **Друге правило `jsx-a11y/control-has-associated-label`** — закрило б і
  зворотний бік (контрол без жодного `<label>`, таких у зоні девʼять), але
  шумить на кнопках та іконках і потребує окремого виміру за межами воронки.
  Девʼять місць дешевше закрити механічним `aria-label` у тій самій задачі,
  ніж вводити гейт, який доведеться глушити виїмками.
- **Пін `engines.node` лише у скаффолдері** — пакет, який СПРАВДІ вимагає
  `@tanstack/react-start` (флагман `simplycms` — у `peerDependencies`), і
  шаблон, з якого збирається магазин, не декларували б нічого: сьогодні
  поріг є лише в `@simplycms/cli` і `create-simplycms-store`, і обидва
  `">=20"`. Поріг
  мусить стояти там, де живе вимога.
- **Безумовний `update` `decrease_on_order` у демо-сіді** — писав би в рядок
  на кожному накаті, зокрема коли значення вже `true`; умовний
  `where value->>'decrease_on_order' = 'false'` — той самий клас
  ідемпотентності, що вже прийнятий у файлі (`on conflict do nothing`,
  `where not exists`). 🔴 Різниці в «захисті» ручного налаштування власника
  між формами НЕМАЄ, і мотивувати нею відмову не можна: власницьке `false`
  матчить саме предикат, а `pnpm db:demo` і так пересоздає базу
  (`scripts/demo-db.mjs:70-71`).

## Додаток В. Рішення ред. 1.2, підтверджені власником 2026-09-05

Прийняті архітектором при переписуванні плану (аудит r2, Claude Fable,
2026-09-04) і винесені власникові на брейншторм **2026-09-05**. Жодне не
суперечить Додатку А. Два підтверджено дослівно, чотири — уточнено або
скасовано рішеннями ред. 1.3 (Додаток Г):

1. ~~`decrease_on_order = true` у демо-сіді~~ — **уточнено**. Сама вимога
   лишається (наслідок А.3 + А.4: без обліку DoD «зі списанням» не
   доводиться живим прогоном), але спосіб інший — УМОВНИЙ `update` замість
   безумовного (Додаток Г-4).
2. **Підтверджено без змін.** Порядок хвилі 1: сід (Е0-6) перед write-side
   (Е0-3) і воронкою (Е0-4); спайк Е0-1 знято.
3. ~~`engines.node >= 22.12` у скаффолдері~~ — **розширено**: поріг той
   самий, охоплення ширше — усі пʼять публікованих пакетів і
   `template/package.json.tpl` (Додаток Г-6).
4. Автовибір єдиної точки видачі — **підтверджено без змін**; правило
   доступних імен для `checkout-ui` — **розширено** на всю воронку зі
   структурним ESLint-гейтом (Додаток Г-5).
5. **Підтверджено без змін.** `cancelMyOrder` переходить на ескалацію в
   одній транзакції — другий споживач механізму Е0-3; `withStoreOperatorDb`
   лишається для серверно-ініційованих дій. 🔴 Ред. 1.3 додає в ТУ САМУ
   транзакцію ще й повернення залишку (Додаток Г-1).
6. ~~DDL у К2-Е0: `banners.image_url` → nullable (канон `0004`)~~ —
   **скасовано цілком** (Додаток Г-3): етап не змінює схему БД взагалі.

## Додаток Г. Рішення ред. 1.3 (брейншторм із власником, 2026-09-05)

Шість рішень, ухвалених власником; підстава кожного перевірена в коді, а
відкинуті альтернативи — у Додатку Б, блок «Додано ред. 1.3».

1. **Скасування замовлення ПОВЕРТАЄ залишок.** Етап вмикає write-side
   декремент, тож без симетричного повернення інваріант асиметричний:
   демо-магазин після кількох скасувань показував би нуль залишку при нулі
   продажів. `releaseStock` живе в тому самому модулі
   `storefront/loaders/stock-reservation.ts`, що й `reserveStock`;
   `cancelMyOrder` в ОДНІЙ транзакції з ескалацією і скасовує, і повертає.
   Порядок усередині ескалації фіксований — блокування рядка замовлення
   (`lockOrderStatus`, `SELECT … FOR UPDATE` по `orders`) → повернення
   залишку → статус; повторне скасування (подвійний клік, паралельна дія
   адмінки) під блокуванням бачить уже змінений `status_id` і виходить БЕЗ
   другого повернення. Це і є ідемпотентність скасування: без блокування дві
   транзакції під READ COMMITTED прочитали б `new` обидві.
2. **Списання й повернення — з ОДНІЄЇ детермінованої точки.** Правило:
   (1) `orders.pickup_point_id`; (2) інакше точка з `is_system = true`;
   (3) інакше перша активна за `(sort_order, id)`. Повернення йде В ТУ САМУ
   точку за тим самим правилом — для замовлення точка вже записана в
   `orders`, тож таблиця резервів не потрібна. `SELECT … FOR UPDATE`
   лишається (арифметика і фліп статусу під блокуванням). Свідомо прийнятий
   наслідок семантики: залишок 3+2 у двох точках не продасть 4. 🔴 Названа
   межа: FK `orders_pickup_point_id_fkey` — `ON DELETE set null`
   (`0001_init.sql:651`), тож видалена після оформлення точка обнуляє
   `orders.pickup_point_id`, і повернення йде за загальним правилом (системна
   → перша активна); схему етап не змінює (рішення 3), тож межа названа, а
   не залагоджена. Ні DDL, ні нових грантів: `app_admin` уже має повний
   доступ до `stock_by_pickup_point` (`0002_grants.sql:156`).
3. **Банери демо — inline `data:`-SVG; DDL з етапу зникає повністю.**
   `banners.image_url` лишається `text NOT NULL` (`0001_init.sql:13`), а сід
   кладе `data:image/svg+xml;charset=utf-8,…` з підписом банера (`charset`
   виписаний явно — підпис кириличний, а `;utf8` параметром MIME не є).
   К2-Е0 стає етапом БЕЗ жодної зміни схеми БД: файл `0004_banners-image-nullable.sql`, крок
   `db:diff`/ревʼю DDL і супутні піни канону з плану зникають.
4. **`decrease_on_order = true` — умовним `update` у демо-сіді**
   (`where key = 'stock_management' and value->>'decrease_on_order' =
   'false'`): предикат робить повторний накат НЕ-ПИСЬМОВИМ на рядку, який уже
   `true` — той самий клас ідемпотентності, що `on conflict do nothing` у
   тому ж файлі. 🔴 Захистом ручного налаштування власника він НЕ є
   (власницьке `false` предикат матчить і перевертає), і не мусить бути:
   `pnpm db:demo` дропає й створює базу заново
   (`scripts/demo-db.mjs:70-71`). Канон `0003_seed.sql` НЕ чіпається
   (рішення А.4), тож чистий магазин і далі стартує з обліком вимкненим.
   Сід також везе ОДНУ **системну** точку видачі (`is_system = true`) — склад для
   замовлень без власної точки (крок 2 правила вище).
5. **Доступні імена — уся воронка + ESLint-правило на зону.**
   `eslint-plugin-jsx-a11y` з одним правилом
   `jsx-a11y/label-has-associated-control` (`error`) і опціями
   `{ assert: 'htmlFor', depth: 3 }` на зону пʼяти тек воронки в
   `eslint.config.mjs`. Правило доводить один бік — «кожен `<label>` має
   контрол»; контрол без жодного `<label>` воно не бачить, і цей бік
   лишається за механічною правкою й поведінковим асертом
   (`getByLabelText`) у `checkout-ui`, де юніти форм і так створюються.
   🔴 Плагін береться **як є, попри незакритий peer** — окреме рішення
   власника 2026-09-05, ухвалене з фактами на руках: `6.10.2` не релізився
   з 2024-10-26 і оголошує `eslint: '^3 || … || ^9'` при ESLint `10.8.0` у
   репо, тоді як сусіди (`typescript-eslint` 8.65, `eslint-plugin-react-hooks`
   7.1) вже заявили `^10`. Підстава: 46 млн завантажень на тиждень означають,
   що з ESLint 10 плагін працює в мільйонах проєктів (перевірено ще й прямим
   прогоном правила на нашому ESLint), `pnpm` не в `strict-peer-dependencies`,
   а сам плагін — `devDependency`, тобто в рантайм магазину не їде. Якщо peer
   колись почне заважати — штатний вихід `peerDependencyRules.allowedVersions`
   у `pnpm-workspace.yaml`, не відкат гейта. 🔴 Нова
   `devDependency` ⇒ `pnpm-lock.yaml` перегенеровується В ТОМУ САМОМУ кроці,
   інакше `pnpm install --frozen-lockfile` (ПЕРШИЙ гейт) валить увесь CI.
6. **`engines.node >= 22.12.0` — на всі пʼять публікованих пакетів і на
   `template/package.json.tpl`.** Сьогодні поріг оголошують лише
   `@simplycms/cli` і `create-simplycms-store` (обидва `">=20"`), а флагман
   `simplycms`, який і вимагає `@tanstack/react-start` (у
   `peerDependencies`), — жодного. Тест-пін: поріг кожного пакета не
   слабший за вимогу ВСТАНОВЛЕНОГО
   `@tanstack/react-start`, прочитану через `createRequire` (у ESM-тесті
   `require` не існує).
