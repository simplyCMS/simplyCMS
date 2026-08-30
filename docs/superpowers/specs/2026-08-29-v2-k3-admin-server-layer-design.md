# Серверний шар адмінки + TanStack DB — трек V2-К3

> **Статус: затверджено власником 2026-08-29** (брейнштормінг-сесія
> `k3-admin-server-layer`); **у коді НЕ реалізовано.** Це виконання пункту
> К3 спеки
> [`2026-08-19-backend-contract-v2-design.md`](2026-08-19-backend-contract-v2-design.md)
> (з амендментом 2026-08-23: B3′/B5″/B13) і прямий наступник контуру `0.4.1`
> «Supabase зі шляху вітрини». Стан, від якого стартує трек, описано в
> [`docs/tasks/v2-state-map.md`](../../tasks/v2-state-map.md) §3.1.
> Імплементаційний план (superpowers writing-plans) пишеться перед стартом.
>
> 🔴 Рамка та сама, що у V2 і К0: клієнтів і реальних магазинів немає —
> зворотна сумісність НЕ підтримується, перехідних шимів немає
> (підтвердження D5, повторно підтверджено власником 2026-08-29:
> «вся поточна робота може і місцями повинна містити брейкінг чендж —
> наслідків зараз нема ніяких і це дешево зараз зробити якісно правильно,
> ніж потім переробляти»). Критерій рішень — вартість подальшої
> експлуатації, не ціна переписування.
>
> Доказова база рішень — три джерела, розділені за вагою: **власний код**
> (виміряно грепом, якорі в §1), **офіційні артефакти бібліотеки**
> (розпаковані npm-tarball-и, Додаток Б) і **чужий бойовий досвід MetaHub**
> (Додаток А, із якорями на їхній репозиторій). Твердження MetaHub
> перевірялися незалежно там, де від них залежить рішення.

## 1. Мотивація — виміряно кодом, не припущено

1. **Адмінка не працює взагалі, і це структурний наслідок, а не поломка.**
   53 файли, **215** звернень `.from(...)` з браузера через
   `useSupabaseClient()`, серверних функцій — **нуль**. На чистому Postgres
   HTTP-посередника немає, тому `/admin` віддає каркас і застигає на
   «Завантаження». Магазином сьогодні неможливо керувати: власник не заведе
   жодного товару.
2. **Але стан адмінки вже на TanStack Query** — **87** `useQuery`, **65**
   `useMutation` у **47** файлах, і лише **7** `useEffect` на всі 19 322
   рядки. Тобто трек замінює *тіло* `queryFn`/`mutationFn`, а не систему
   керування станом. Це вирішально для оцінки обсягу.
3. **Ключі кешу стихійні, і розсинхрон уже існує на межі вітрина/адмінка.**
   34 таблиці живуть під ~50 різними ключами; одна таблиця — під чотирма
   в одному `QueryClient`:

   | Таблиця | Вітрина | Адмінка |
   |---|---|---|
   | `pickup_points` | `['active-pickup-points']`, `['pickup-points-count']` | `['pickup-points']`, `['pickup-point', id]` |
   | `product_reviews` | `['product-reviews', id]`, `['product-ratings']` | `['admin-reviews']`, `['admin-review', id]` |
   | `banners` | `['banners', placement, sectionId]` | `['admin-banners']` |

   Сьогодні це невидиме (адмінка мертва); після К3 адмін змінить пункт
   видачі — вітрина покаже старий.
4. **Усі первинні ключі генерує БД.** 45 із 45 таблиць канону мають
   `DEFAULT gen_random_uuid()`; клієнтської генерації PK у репо немає ніде
   (`randomUUID` вживається двічі й не для PK — `order-create.ts:62`
   номер замовлення, `checkout.ts:35` гостьовий токен). Це прямо несумісне
   з оптимістичними мутаціями (§2, К3-6).
5. **К3 — єдиний трек, що розблоковує знос легасі.** Після нього зникає
   останній споживач `supabase-js`, а з ним `src/supabase/`, заморожений
   `database.ts`, host-провайдер і решта рішення B12.

## 2. Рішення (К3-1 … К3-12)

**К3-1. Адмінка лишається client-side SPA.** Це не вибір, а вимога:
«TanStack DB collections are client-side only. SSR is not implemented.
Routes using TanStack DB must disable SSR» (Додаток Б-1). `ssr: false` уже
стоїть у `packages/simplycms/routes/admin/admin.tsx:14`. Наслідок, який
фіксуємо явно: **колекції неможливі на вітрині** (вона SSR), тому спільний
дескриптор даних для К2 і К3 не робиться — див. К3-4.

**К3-2. Повний перехід адмінки на TanStack DB — з явним реєстром
винятків.** Дефолт: сутність читається `useLiveQuery` з колекції, пишеться
`collection.insert/update/delete`. Але «повний» не означає «без винятків»:
заводиться закомічений реєстр сутностей і операцій, що свідомо лишаються
server-first (кандидати: `PriceValidator` — обчислення, не сутність;
`Dashboard` — агрегати-лічильники; `system_settings` — одиничний рядок).
Мовчазні відхилення заборонені; виняток без запису в реєстрі — дефект.

**К3-3. Ім'я сутності не пишеться руками — воно виводиться зі схеми.**
Причина не стильова: при function-based `queryKey` усі похідні ключі
**мусять** розширювати базовий як префікс, інакше оновлення кешу проминає
записи й показує застарілі дані (Додаток Б-2). Джерело правди — реєстр
`ENTITY` у T0 (плоскі рядки, нуль рантайм-залежностей), під тестом
парності з `getTableName()` Drizzle-таблиць. Форма ключів єдина на весь
проєкт — і для адмінки, і для вітрини:

```
[entity]                       // база (all)
[entity, 'list']               // колекція
[entity, 'detail', id]
[entity, relation, parentId]   // scoped
```

Літеральний `queryKey` у зонах адмінки й вітрини забороняється лінтом.

**К3-4. `defineAdminResource` — фабрика CRUD; операції з інваріантами
пишуться руками.** Розріз проходить **по операціях, а не по сутностях**:
`orders` бере `list`/`update` з фабрики, а `changeStatus` живе окремим
serverFn. Дескриптор описує лише те, чого фабрика не виводить зі схеми:

```ts
defineAdminResource({
  entity: ENTITY.products,
  table: products,                 // Drizzle → типи, колонки, SQL
  operation: 'catalog.write',      // рядок AUTHZ_MATRIX
  mode: 'on-demand',
  filterable: ['sectionId', 'isActive', 'stockStatus'],
  sortable:   ['createdAt', 'name'],
  defaultOrder: { column: 'createdAt', direction: 'desc' },
  writable:   [...],
  readonly:   ['id', 'createdAt', 'updatedAt'],
});
```

Фабрика існує заради **однієї** речі, яку не можна дублювати 34 рази:
трансляції `loadSubsetOptions` → Drizzle-`where` з allowlist колонок
(`subset.ts`). Це той самий мотив, з якого в `plugin-sdk/server/guard.ts`
живуть `assertColumn`/`assertOwnTable`.

Типізація вся з Drizzle: рядок — `InferSelectModel`, Zod — через
`drizzle-zod` (сумісність із Zod 4 перевірена, Додаток Б-4), плюс
compile-time exhaustiveness: кожна колонка мусить бути у `writable` або
`readonly`, інакше збірка червоніє.

🔴 **Фабрика свідомо не має DSL запитів** — жодних вкладених фільтрів,
`or`, підзапитів. Усе складніше — це `useLiveQuery` на клієнті або
іменована операція. Саме це утримує її в межах ~150 рядків.

**К3-5. Три режими колекцій за характером сутності.**

| Режим | Сутності | Чому |
|---|---|---|
| `eager` | ~24 довідники (`price_types`, `order_statuses`, `shipping_*`, `sections`, `property_options`, `themes`, `plugins`, `discount_*`, `banners`…) | обмежений розмір; повна колекція в пам'яті |
| `on-demand` | `products` + сателіти | каталог росте; push-down у Drizzle-`where` |
| `on-demand` + обов'язковий `orderBy` і серверний ліміт | `orders`, `order_items`, `profiles`, `product_reviews` | ростуть у часі без стелі |

🔴 MetaHub цього режиму **не проходив** (Додаток А-5) — це єдина частина
треку без зовнішнього зразка. Запасний хід — К3-5-fallback у §6.

**К3-6. Клієнтська генерація id для всього, що клієнт створює.**
Серверна генерація структурно несумісна з оптимізмом: оптимістичний рядок
лягає в колекцію під ключем, відомим до відповіді сервера, а сервер
повертає інший — це не розсинхрон полів, а **два різні рядки в одній
мапі** (Додаток Б-3, Додаток А-1). Критерій розрізу — **чи клієнт створює
рядок**, а не «доменна vs системна»: для `UPDATE`/`DELETE` клієнтський id
не потрібен.

*Категорія A — `DROP DEFAULT`, `id` обов'язковий на вході.* Усе, що
створює адмінка: `products`, `sections`, `banners`, `discounts` +
`discount_targets`/`discount_conditions`, `price_types`, `order_statuses`,
`pickup_points`, `shipping_zones`/`shipping_methods`/`shipping_rates`,
`property_options`, `section_properties`,
`section_property_assignments`, `product_prices`, `product_modifications`,
`product_property_values`, `modification_property_values`,
`stock_by_pickup_point`, `user_categories`, `category_rules`,
**`order_items`** — плюс таблиці плагінів (К3-11).

*Категорія B — DEFAULT лишається, і це контракт:*

| Таблиці | Обґрунтування |
|---|---|
| `users`, `sessions`, `accounts`, `verifications` | Better Auth **конструктивно делегує генерацію базі**: `generateId: 'uuid'` + `supportsUUIDs` драйвера drizzle-pg означає, що BA не кладе `id` в INSERT (`auth/instance.ts:78-87`, `schema/auth.ts:20-21`). Зняття DEFAULT поклало б signUp/sign-in/OAuth цілком |

🔴 **Ревізія Е1а: `orders` переведено в Категорію A** — після Е0 її
вставка (`order-create.ts:99`) передає ключ явно, тож DEFAULT став
fail-silent пасткою в таблиці, яку адмінка отримує в керування в
Е1б–Е6, а не страхувальною сіткою.

🔴 Поіменна класифікація всіх 45 таблиць — **машинна** (скан insert-шляхів
+ іменований allowlist), а не список у спеці, який застаріє.

Порядок робіт жорсткий: **код перед DDL** (Додаток А-2). Клієнт генерує
`crypto.randomUUID()`; сіди отримують статичні UUID (закриває борг №4
роадмапу — сім динамічних роутів e2e); серверні вставки вітрини передають
`id` явно; лише після цього `ALTER COLUMN id DROP DEFAULT`. `NOT NULL`
лишається — забутий `id` падає `23502` у момент помилки.

🔴 **`crypto.randomUUID()` доступний лише в secure context.** Адмінка на
`http://` не-localhost отримає `undefined`. Рішення — не тягнути пакет
`uuid` (обгортка заради обгортки), а fail-loud перевірка при старті
адмінки. Це правда й поза UUID: Better Auth і так ставить `Secure`-cookie.

**К3-7. Write-back замість self-invalidation.** Happy-path власної
колекції синхронізується прямим `writeUpsert(serverRow)` у persistence
handler із `return { refetch: false }`. Інвалідація власного ключа —
заборонений антипатерн (зайвий GET + вікно гонки stale-refetch, Додаток
А-3). Це свідомо розходиться з дефолтом бібліотеки, який рефетчить сам.

Три пастки, зняті наперед (усі — сплачені MetaHub, Додаток А-4):
`writeUpsert` в `onInsert`, ніколи `writeUpdate`; fail-loud при
`serverRow.id !== optimisticId` **до** будь-якого write-back; updater
завжди лишає слід у draft — інакше транзакція не відправляється і UI
тостить успіх без запису в БД.

**К3-8. Сім нових машинних гейтів плюс розширення наявного `test:schema`,
кожен із негативним контролем.** Принцип —
власний урок репо (К1а-9, 0.4.1-5): структурна перевірка не є доказом
поведінки.

| # | Гейт | Ловить | Крок ланцюга |
|---|---|---|---|
| 1 | `mutation-cache-sync` | мутація без синхронізації кешу | `pnpm lint` |
| 2 | `handler-canon` | `{refetch:false}` без write-back у своїй гілці | `pnpm test` |
| 3 | `client-generated-ids` | create-схема без обов'язкового `id` | `pnpm test` |
| 4 | `id-mismatch` | сервер повернув інший ключ | `pnpm test` |
| 5 | `entity-parity` | `ENTITY` розійшовся зі схемою | `pnpm test` |
| 6 | `no-literal-query-key` | ключ рядком повз `entityKey` | `pnpm lint` |
| 7 | тір-зони `admin-server`/`admin-data` | імпорт угору по шарах | `pnpm lint` |
| +  | відсутність `DEFAULT` на Категорії A (не новий гейт — кілька рядків у наявному харнесі) | повернений DEFAULT | `pnpm test:schema` |

🔴 №1 і №2 — обидва, бо стережуть **різні поверхні** одного інваріанту:
React-хуки і persistence-хендлери колекції. №1 евристичний за побудовою
(можливі фолс-негативи, не фолс-позитиви); строгість дає №2 через
dataflow-аналіз. `BASELINE` гейта №2 порожній і лишається порожнім.

**К3-9. Розкладка тір-перша, фіча-друга.** Повний feature-slice зламав би
межу шарів: тір-зони прив'язані до тек верхнього рівня
`packages/simplycms/src/<тека>`, і серверний код у `admin/features/…`
опинився б у зоні T5. Тому фіча простежується вертикально за іменем
(див. §3), а межу далі стереже машина.

**К3-10. `@tanstack/react-db` — peer-залежність, пін у шаблоні.** Пакет
`0.3.x` (адаптер `query-db-collection` уже `1.2.x`), і як `dependency`
ядра його breaking changes їхали б у магазини з нашим релізом. Форма — та
сама, що вже вживається для `@tanstack/react-query`.

**К3-11. Контракт плагінів вирівнюється тим самим правилом.** Чотири
зміни: `PluginTablePort.insert` вимагає `id`; `insertPluginRow` fail-loud
без нього; DDL шаблону міграції плагіна і `create plugin` перестають
писати `default gen_random_uuid()`; референс `@simplycms/plugin-faq`
генерує id сам. Вікно закривається на К5 («відкриття сторонніх подач —
лише після заморозки портів»), тож зараз ціна зміни нульова.

**К3-12. Storage-мінімум (К4) входить у скоуп.** `MediaProvider` + один
драйвер `local-fs` (`upload`/`url`/`delete`). Без нього адмінка лишилась
би без завантаження зображень у п'яти місцях (`ProductEdit`,
`SectionEdit`, `BannerEdit`, `PropertyOptionEdit`,
`ProductModifications`), тобто CMS без картинок товару. Драйвер `s3`,
трансформації й облік орфанів лишаються повному К4.

## 3. Цільова структура

```
packages/simplycms/src/
│
├── contracts/entities.ts          T0  ENTITY (рядки) + entityKey()
├── schema/__tests__/
│      entity-parity.test.ts       T1  гейт №5
│
├── admin-server/                  T2  🔴 єдиний, хто торкається БД
│   ├── resource.ts                    defineAdminResource
│   ├── subset.ts                      loadSubsetOptions → Drizzle where
│   ├── resources/<entity>.ts          ← фіча
│   └── operations/<name>.ts           ← інваріанти запису
│
├── admin-data/                    T4  колекції + похідні view
│   ├── registry.ts                    WeakMap<QueryClient, …>
│   ├── collections/<entity>.ts        ← та сама фіча
│   └── views/<name>.ts                ← live-query join
│
└── admin/features/<entity>/       T5  UI тієї ж фічі
```

Дві нові теки верхнього рівня = дві нові тір-зони в
`eslint.tier-zones.mjs` + два субшляхи в `exports`-мапі.

## 4. Наслідки для інфраструктури (чесний перелік для плану)

1. **Host-файли змінюються.** `QueryClient` створюється у `getRouter()`,
   кладеться в router context і передається в `CMSProvider` наявним
   пропом `customQueryClient` — інакше `loader` не має доступу до
   колекцій. Це `src/router.tsx` і `src/routes/__root.tsx`, обидва під
   каноном `packages/cli/host/src/` і `template:sync`; доїде в магазини
   через `simplycms update`.
2. **`0001_init.sql` переписується** в частині `DEFAULT` (Категорія A);
   `0003_seed.sql` і `demo/demo-seed.sql` отримують статичні UUID.
   Коментар-інваріант `0002_grants.sql:186-189` («усі PK — uuid з
   gen_random_uuid()») стає стале й оновлюється; функціонально гранти не
   зачіпаються — sequences не з'являються.
3. **Gate C пілота** отримує `simplycms/admin-server` у `SERVER_PAYLOAD`.
4. **Перше кастомне ESLint-правило в репо.** Досі зони були
   `no-restricted-imports`/`no-restricted-syntax`; №1 — правило з власним
   AST-обходом.
5. **`i18n`-зона** поширюється на нові теки `admin-data`/`admin-server`
   (де є рядки інтерфейсу) — механізм наявний.
6. **RLS не зачіпається**: жодна політика не звертається до `id` (усі
   предикати — по `user_id`/`access_token`), тож клієнтський UUID
   проходить ті самі перевірки власності.

## 5. Вплив на ухвалені спеки й документи

- **Спека V2** (§4, К3): цей документ — її розкриття; розбіжність одна —
  «дескриптор домену як SSOT» із К2 **не** робиться спільним для вітрини
  й адмінки (обґрунтування — К3-1).
- **Спека пошуку** (2026-08-25): контур П6 (пошук в адмінці)
  розблоковується після цього треку.
- **Роадмап**: закриваються борги №3, №4, 0.4.1-11, решта B12; борг №1 і
  К1а-6 (SMTP/browser-e2e) лишаються — вони поза скоупом.
- **`v2-state-map.md`**: §3.1 переписується після Е8.
- **`test-contours.md`**: додаються гейти §2 К3-8.

## 6. Ризики та мітигації

| Ризик | Мітигація |
|---|---|
| **on-demand push-down без зовнішнього зразка** (Е3) | Каркас доводиться раніше (Е1) на eager-довіднику. Fallback — режим `eager` + серверна пагінація, як у MetaHub: `mode` — поле дескриптора, переробки фабрики не потребує |
| `@tanstack/react-db` 0.x ламає API | peer-залежність із піном (К3-10); адаптер, який робить основну роботу, уже 1.x |
| «Фреймворк усередині фреймворка» | MetaHub заплатив 3527 рядків, але з них realtime-bridge, Redis-шар, `hubId`-мультитенантність і AnimationStore нам не потрібні. Оцінка нашого шару — 800–1200 рядків. Обмеження К3-4 (без DSL) — головний запобіжник |
| Обсяг 19 322 рядків UI | Стан уже на React Query (§1.2) — замінюється тіло запиту, не архітектура компонента |
| Тиха регресія кеш-синхронізації | Два незалежні гейти (К3-8 №1, №2) + порожній BASELINE |

## 7. Межі К3 (свідомо НЕ робиться)

- Повний К4: драйвер `s3`, трансформації, `delete`-порядок і облік
  орфанів, інваріант розміру в транзакції (передумова тарифів хмари C11).
- Пошук в адмінці (П6 спеки пошуку) — окремий контур після К3.
- Realtime будь-якого виду.
- Віртуалізація великих таблиць в UI.
- Переклад `<title>` роутів (борг К0-8) — належить К2.
- Перерахунок цін позицій замовлення (борг 0.4.1-4) — контур чекауту.
- Розселення `core` по тірах (борг К0-3) — розвантажується побіжно, але
  цільової перебудови не робиться.

## 8. DoD треку К3

1. `/admin` працює наживо на чистому Postgres: створення, редагування й
   видалення в кожній сутності Категорії A — **доведено живим прогоном**,
   не тестами (канон репо).
2. Нуль `useSupabaseClient` у `packages/simplycms/src/admin/**`;
   `src/supabase/` і `@supabase/supabase-js` знесені; host-провайдера
   немає.
3. Ключі: нуль літеральних `queryKey` в адмінці й вітрині; одна таблиця —
   один префікс.
4. Усі сім гейтів зелені, кожен має негативний контроль, що червонить.
5. `pnpm test:schema` доводить відсутність `DEFAULT` на Категорії A.
6. Завантаження й видалення зображення товару працює (К3-12).
7. Повний ланцюг `pnpm install --frozen-lockfile → format:check → lint →
   build → typecheck → test → test:schema → build:packages →
   typecheck:template → test:packaging` зелений; `pnpm pilot:pack`
   пройдено.
8. Живий прогін контуру за зразком 0.4.1: магазин зі свіжих tarball-ів,
   чиста БД, `node server.mjs`, цикл «створив товар в адмінці → з'явився
   на вітрині».

## Додаток А. Запозичені уроки MetaHub

Джерело — `/home/vsydorenko/github/metahub`, дослідження 2026-08-29.
Твердження, від яких залежать рішення, перевірені незалежно.

**А-1. Клас помилок серверної генерації id.** Живий баг favorites:
`getKey = item.id` + сервер INSERT без `id` + `writeUpsert(optimisticItem)`
→ ключ оптимістичного рядка розходиться із серверним → колапс стану при
швидкому pin/unpin (`docs/architecture/DATA_ACCESS.md:1107-1112`).
Формулювання причини — `apps/hub/src/lib/entity-data/crud-strategy.ts:284-296`:
«`writeUpsert(serverItem)` завів би у synced-store ДРУГИЙ рядок під
серверним ключем, а оптимістичний рядок під `optimisticId` не мав би
write-back і зник би на commit транзакції».

**А-2. Порядок міграції — код перед DDL.** Phase 9: спершу кожен
insert-шлях починає слати `id`, потім серверні bootstrap-функції
генерують його самі, і лише після цього `ALTER COLUMN id DROP DEFAULT`
однією міграцією на 21 таблицю. Зворотний порядок дав би одночасне
падіння всіх вставок.

**А-3. Write-back замість self-invalidation** — `DATA_ACCESS.md:877-881`.

**А-4. Пастки, сплачені інцидентами:** `writeUpdate` в `onInsert` кидає
`UpdateOperationItemNotFoundError`; порожній draft-update — тихий no-op
(кнопка «Відновити» нічого не робила, `DATA_ACCESS.md:588-594`);
натуральний ключ обов'язковий для існування-сутностей.

**А-5. Чого MetaHub НЕ робив:** `syncMode`/`loadSubsetOptions` —
**нуль збігів** по їхньому репозиторію (перевірено особисто). Фільтрація
суто клієнтська; великі домени тягнуться `paginate: true` +
`fetchAllRows()` чанками, тобто все одно цілком у браузер. Для нашого
каталогу це неприйнятно — звідси К3-5.

**А-6. Ключі — децентралізовано.** 29 файлів
`features/<domain>/data/query-keys.ts`; глобальний реєстр названо
антипатерном (`DOMAIN_STRUCTURE.md:253`). Машинної заборони інлайнового
ключа в них **немає** — дисципліна тримається рев'ю. Наш К3-3 сильніший:
ім'я виводиться зі схеми і стережеться лінтом.

**А-7. Ціна шару:** `entity-data` + `cache-db` = 3527 рядків +
`invalidation-map.ts` (542) + realtime-bridge + п'ять guardrail-тестів.
Їхній власний висновок: «це справді немала власна платформа поверх
`@tanstack/react-db`, не тонкий wrapper».

**А-8. Правило межі** (`DATA_ACCESS.md:850-862`): single-row-by-id
read-only → плаский `useQuery`; per-parent зріз → scoped-колекція;
заборонено гріти hub-wide колекцію заради одного рядка. Наш аналог —
К3-2 (реєстр винятків) і К3-5 (режими).

## Додаток Б. Верифіковані факти бібліотеки

Перевірено на розпакованих npm-tarball-ах `@tanstack/db@0.8.6` і
`@tanstack/query-db-collection@1.2.11` (у нас новіші версії, ніж у
MetaHub — `0.6.17`/`1.2.1`), 2026-08-29.

**Б-1. SSR не підтримується.** «TanStack DB collections are client-side
only. SSR is not implemented. Routes using TanStack DB must disable SSR»
(`skills/meta-framework/SKILL.md`). Там же: `preload()` на **on-demand**
колекції — no-op; преload робиться на `createLiveQueryCollection`.

**Б-2. Префікс ключа — вимога коректності.** «all derived keys must
extend the base key as a prefix… Failing to maintain a consistent prefix
can cause cache updates to miss entries, resulting in the display of
stale data» (`skills/db-core/collection-setup/references/query-adapter.md`).
Там же — «Do not create a collection for each relational subset» і
«Memoize by QueryClient… Do not create the collection during every render».

**Б-3. Клієнтські UUID — рекомендація авторів.** «Using client-generated
UUIDs is the cleanest solution if your backend supports it, as the ID
remains stable… Problem 1: UI may re-render when tempId is replaced with
real ID. Problem 2: Trying to delete before sync completes will use
tempId — may 404 on backend» (`docs/guides/mutations.md`).

**Б-4. Сумісність стека.** `syncMode` присутній у
`@tanstack/db@0.8.6/dist/esm/types.d.ts:517`; `parseLoadSubsetOptions` і
`LoadSubsetOptions` — у `query-db-collection@1.2.11`. `drizzle-zod@0.8.3`
має peer `zod: ^3.25.0 || ^4.0.0` і `drizzle-orm: >=0.36.0` — наші
`zod@4.4.3` і `drizzle-orm@0.45.2` заходять.

**Б-5. Продуктивність живих запитів.** Оновлення одного рядка у
відсортованій колекції на 100 000 елементів — ~0.7 мс (differential
dataflow d2ts, M1 Pro; `docs/overview.md`).

**Б-6. Серіалізація.** Доменні таблиці — 63 із 63 `timestamp` у режимі
`mode: 'string'` (`schema.ts` 62 + `media.ts` 1); `numeric` Drizzle віддає
рядком. Шар нормалізації не потрібен. `auth.ts` має 13 колонок у
`mode: 'date'`, але його таблиці в колекції адмінки не входять.
