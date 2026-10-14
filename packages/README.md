# SimplyCMS Core

Open-source headless commerce engine — core packages for TanStack Start (Vite) + PostgreSQL.

## Пакети (топологія К0, 2026-08-20)

Публікованих пакетів **пʼять**. Ядро — один unscoped фреймворк-пакет
`simplycms`; тіри T0→T5 всередині нього — це **теки**, а не окремі npm-пакети.

| Пакет | Тека | Роль |
|-------|------|------|
| `simplycms` | `simplycms/` | Фреймворк: увесь T0–T5 (`src/*`), роут-теки (`routes/*`), core-міграції (`migrations/`), агентні скіли (`skills/`), вступ агента магазину (`agent/`) |
| `@simplycms/cli` | `cli/` | CLI магазину (bin `simplycms`): `doctor`/`add`/`create`/`update`/`db:diff`/`theme:conformance`. `host/` — канон host-файлів; виконується в магазині, поза тірами |
| `@simplycms/theme-solarstore` | `simplycms-theme-solarstore/` | Референс-тема повного контуру: manifest + tokens + components + messages (Фаза 4) |
| `@simplycms/plugin-faq` | `simplycms-plugin-faq/` | Референс-плагін повного контуру: `plg_faq_items`, `/admin/faq`, слот, Zod-settings, i18n |
| `create-simplycms-store` | `create-simplycms-store/` | CLI-скаффолдер магазину (unscoped). Вбудований шаблон — джерело правди каркаса |

### Тіри всередині `simplycms`

Тір — напрямок дозволених імпортів: тека шару N може імпортувати лише теки
шарів **нижче** себе. До К0 цю дисципліну тримала межа npm-пакета
(`dependencies` + `audit-deps`); після злиття її тримають **eslint-тір-зони**
(`eslint.tier-zones.mjs` + `eslint.tier-relative.mjs`, негативний контроль —
`tests/tier-boundary.test.ts`). Кожна заборона виражена двома формами
специфікатора — bare-субшляхом `simplycms/<тека>` і відносним `../<тека>`.

| Тека `src/` | Субшлях | Tier | Опис |
|-------------|---------|------|------|
| `contracts/` | `simplycms/contracts` | T0 | Контракти доменних обʼєктів + порти (репозиторії, провайдери, `EngineContext`) + view-model-и вітрини (`./views`, контракт тем v3). 0 runtime-залежностей; тонкий рантайм-шар у `./views` (константи реквізитів) і `./views/fixtures` (фікстури conformance). `react` — опційний type-only peer саме через типи слотів `./views` (у барель не потрапляє) |
| `domain/` | `simplycms/domain` | T1 | Чиста комерційна логіка — `./pricing`, `./discounts`, `./inventory`, `./shipping`. Без IO |
| `schema/` | `simplycms/schema` | T1 | Drizzle-baseline схеми ядра + RLS у TS. Тулінг (`drizzle/`, `drizzle.config.ts`, `seed-migrations/`) — на рівні пакета, не в `src/` |
| `db/` | `simplycms/db` | T2 | db-рантайм v2: пул `pg` + `withActor` (транзакція + claims `app.user_id` + `SET LOCAL ROLE`) + `advisoryXactLock` — ЄДИНА SQL-реалізація транзакційного advisory-локу за рядковим ключем (адмінка й `commerce` мусять хешувати ключ однаково, Е6в-15). 🔴 Єдиний канал до Postgres — субшляху `./db/client` в `exports` немає, прямий імпорт фабрики пулу є помилкою лінту |
| `auth/` | `simplycms/auth` | T2 | Серверний auth-контур v2 (Better Auth, пін версії): інстанс + `drizzleAdapter` над схемою, хук `user.create.after` (`profiles`+`user_roles`, інваріант `first_user_no_auto_admin`), invite власника, typed authz (`requireOperation`, матриця «роль × операція»). Підключений до `start.ts`/роутів (К1′б, GoTrue знесено). Листи скидання й запрошення — через порт `mail` (outbox + доставка без `await`, Е8-Т11). Upward-виняток `db` (зʼєднання лише через `withActor`), `mail`, `site` (назва магазину й локаль), `i18n`, `env` (`siteUrl`) |
| `react-query/` | `simplycms/react-query` | T2 | `EngineProvider`/`useEngine` (links+config), `CartProvider`/`useCart`, `catalogKeys` |
| `runtime/` | `simplycms/runtime` | T2 | `defineRuntime` (складання `EngineContext`) + host-`defineConfig`. Client-safe субшляхи (К3-Е8): `./build-id` (`BUILD_ID` із `define`-глобала збірки), `./stale-chunk` (сторож застарілих чанків: подія `vite:preloadError`, одне перезавантаження під ключем сховища сесії з id збірки), `./stale-chunk-react` (хук `useStaleChunkRecovery` для меж помилок вітрини й адмінки) |
| `i18n/` | `simplycms/i18n` | T2 | Request-scoped транслятор (`createTranslator`, `I18nProvider`, `useT`) + каталоги uk/en |
| `storefront/` | `simplycms/storefront` | T2 | SSR-лоадери (`withStorefrontDb` над Drizzle) + SEO-генератори — без клієнта БД у браузері. Upward-виняток `db`+`auth`+`storage`+`inventory`+`commerce`+`site`+`mail`+`env`+`i18n`: `withActor`, читання сесії, канал до файлів (аватар), спільний гвард залишків, серверне ціноутворення/доставка, кеш профілю й активної теми, листи замовлення в outbox (`mail`, база посилань `env`, тексти `i18n`) |
| `admin-server/` | `simplycms/admin-server` (+ службовий `./admin-server/impl`) | T2 | Серверний шар адмінки (трек К3, Е1б): фабрика операцій `defineAdminResource` + іменовані операції з інваріантами; публічна поверхня `index.ts` — ЛИШЕ топ-рівневі `createServerFn` (К3-4′), нутрощі — за bare-субшляхом `impl` (дзеркало `storefront/loaders` для Gate C, К3-9′). Upward-виняток `db`+`auth`+`storage`+`inventory`+`commerce`+`site`+`mail` (картка хвостів пошти): `withActor`, `requireGrant`, канал до файлів, спільний гвард залишків, серверне ціноутворення/доставка (редагування позицій замовлення, Е5б) і скидання кешу профілю й теми після COMMIT (Е6б-9) |
| `storage/` | `simplycms/storage` | T2 | 🔴 Порт сховища файлів (К3-Е2): драйвер `local-fs` (іммутабельні ключі `ab/<uuid>.<ext>`, атомарна публікація через `link`), `inspectUpload` (MIME за магічними байтами, SVG заборонений), `writeMedia` (файл + рядок `media`; відкат публікації — `withPublishedRollback` через outbox) і `eraseMediaRows` (двофазне стирання: у транзакції лише рядки `media` + хвіст outbox `media_erasures`, файл стирає `completeMediaErasures` після COMMIT), `serveMedia` для роуту `/media/$`. **server-only** за `contracts/server-only`; upward-винятки `db` (канал до Postgres лише `withActor`) і `env` (вибір драйвера за групами `S3_*`/`MEDIA_ROOT`). Клієнту звідси не потрібно нічого: резолв URL живе в `domain/media` (T1) |
| `commerce/` | `simplycms/commerce` | T2 | 🔴 Серверне ціноутворення й доставка (К3-Е5б, Е5б-5): ядро ціноутворення К3-Е6в — `loadPricingContext` (один контекст: ефективна категорія з відкатом на дефолтну, тип ціни ЦІЄЇ категорії, інакше глобальний дефолтний, ліс знижок, `now`) + `priceCart` (рядки з `available`, сума центами), `priceItems` — обгортка для чеку; категорії покупців і автоправила (`applyCategoryRules`, `customerCategoryLock`, `loadCustomerStats`), `validateShippingChoice` + `quoteShippingCost` (метод, точка видачі, зона — основна або зона точки самовивозу за `resolveShippingZone`, тариф від `subtotal`), довідники цін/знижок/доставки/точок видачі. ОДНА копія рушія на чекаут вітрини (`storefront/loaders`) і редагування позицій замовлення (`admin-server`) — копія вже раз давала розходження знижок. Переїхало зі `storefront/loaders` без реекспорту. **server-only** за `contracts/server-only`; upward-винятки `db` (тип `ActorDb`), `i18n` (тип `Locale` для `declareStoreLocale`) |
| `inventory/` | `simplycms/inventory` | T2 | 🔴 Облік залишків (Е3-5): спільний гвард `stock_status` — `loadTargetStatus`/`setTargetStatus`/`syncStatusWithQuantity`, пише в `products`/`product_modifications` через ActorDb; облік замовлення (Е5) — `reserveOrderStock`/`releaseOrderStock` (списане й повернене ПО ПОЗИЦІЇ: `order_items.stock_point_id`/`stock_reserved`), `loadStockManagement`, `InsufficientStockError`. Одна копія на вітрину (оформлення й скасування) і адмінку (зміна статусу замовлення). **server-only** за `contracts/server-only`; upward-виняток лише `db` — канал до Postgres той самий `withActor`. Не плутати з `simplycms/domain/inventory` (T1, чиста арифметика без IO, клієнтобезпечна) |
| `site/` | `simplycms/site` | T2 | 🔴 Кеш профілю магазину й активної теми (К3-Е6б, Е6б-7): `createReadCache` (TTL 5 хв + лічильник поколінь), `storeProfileCache`/`activeThemeCache`, `readStoreProfile`, реєстр вшитих тем `declareBuiltThemes`/`isBuiltTheme`, локаль листів `declareStoreLocale`/`getStoreLocale` (Е8-Р8) і валюта `declareStoreCurrency`/`getStoreCurrency`. ОДИН модульний стан: вітрина читає, адмінка скидає після COMMIT (`admin-server` не імпортує `storefront`). Власного каналу до БД немає — функції приймають `ActorDb`. **server-only** за `contracts/server-only`; upward-винятки `db` (тип `ActorDb`), `i18n` (тип `Locale`) |
| `env/` | `simplycms/env` | T2 | 🔴 Резолвер груп env драйверів (К3-Е8, Е8-Р7): `resolveDriverEnv(env)` — чиста функція, що з переданого оточення дає драйвер сховища (`local-fs`/`s3`) і пошти (`log`/`smtp`) за правилом «все або нічого» (`S3_KEYS`, `SMTP_KEYS`); часткова група — `DriverEnvError` з іменами відсутніх ключів без значень; `siteUrl(path, env)` — єдиний будівельник абсолютних посилань у листах (origin `VITE_SITE_URL`, не запит). `process.env` читає викликач (старт магазину, фабрики драйверів, doctor, status), модуль нічого не друкує. **server-only** за `contracts/server-only`; upward-винятків немає |
| `mail/` | `simplycms/mail` | T2 | 🔴 Порт пошти (К3-Е8, Task 9): `getMailTransport()` обирає драйвер за групою `SMTP_URL`+`MAIL_FROM` (`resolveDriverEnv`), `smtpTransport` (peer `nodemailer`, помилка лише `SMTP: <code>`) і `logTransport` (поза продом друкує лист, у проді — лише «Кому / Тема / тип», Е8-С1; режим — `isProductionRuntime`). **server-only** за `contracts/server-only`; upward-виняток `env`, `db`, `schema`, `i18n`; рендер листів auth (`renderPasswordResetMail`, `renderOwnerInviteMail`) і замовлення (`renderOrderCustomerMail`, `renderOrderOwnerMail`), тексти — каталог `mail.*` |
| `vite/` | `simplycms/vite` | T2 | 🔴 Build-time плагіни Vite (К3-Е8): `resolveBuildId(env, {command, cwd})` — каскад `BUILD_ID` → `SOURCE_COMMIT` → git → час збірки (у dev `'dev'`), мемоізований і записаний у `process.env.BUILD_ID`; `simplycmsBuildInfo()` вшиває його `define`-глобалом `__SIMPLYCMS_BUILD_ID__` (читає client-safe `simplycms/runtime/build-id`). `precompressAssets()` кладе `.br`/`.gz` поруч з асетами клієнтської збірки (для `sirv` у `server.mjs`). Node-код збірки без залежності від `vite` (структурний тип плагіна). **server-only** за `contracts/server-only`; upward-винятків немає |
| `migrate/` | `simplycms/migrate` | T2 | 🔴 Накат міграцій із журналом контрольних сум (К3-Е8, Е8-Р2): `applyMigrations` — одна реалізація для старту контейнера, `db:apply`, харнесу `test:schema` і `db:demo` (advisory-лок → відмова бази без журналу → звірка сум ДО першого DDL → кожен файл в одній транзакції зі своїм записом у `public.simplycms_migrations` → грант `app_admin` → синк пароля `app_runtime` верифікатором SCRAM-SHA-256, порахованим на клієнті, `scramSha256Verifier`, Р15); `listMigrationFiles` (sha256 після CRLF→LF, відмова `concurrently`/`begin`/`commit` до накату), `readJournal` і `readStoreFacts` (власник, профіль, невдалі листи; з `DATABASE_URL` через `SET LOCAL ROLE app_admin`, спільний `withRuntimeAdminRead`), `pendingMigrations`, помилки `MigrationChecksumError`/`UnjournaledDatabaseError`/`MigrationTransactionControlError`. Власне зʼєднання `pg` під власником схеми — повз `withActor` за побудовою (до ролей і RLS актора не існує). **server-only** за `contracts/server-only`; upward-винятків немає |
| `server-guard/` | `simplycms/server-guard` | T2 | 🔴 Охорона серверного входу (К3-Е8, Р23/Р27): `maskUnexpectedError` — у проді непередбачена помилка йде клієнту загальним повідомленням з ідентифікатором, повна (через `redactUrls`) — у лог із тим самим ідентифікатором; доменні помилки з кодом (`DOMAIN_ERROR_NAME`), редіректи, `notFound` і `Response` проходять як є. `withSecurityHeaders`/`securityHeaders` — базові заголовки безпеки на всіх динамічних відповідях (HSTS лише для https-сайту). Host підключає: function-middleware у `src/start.ts`, обгортка fetch у `src/server.ts`. Формат повідомлення з ідентифікатором — T0 `contracts/masked-error` (його читає й клієнтський екран помилки). **server-only** за `contracts/server-only`; upward-виняток лише `env` |
| `ui/` | `simplycms/ui` | T3 | Бібліотека примітивів shadcn/ui |
| `themes/` | `simplycms/themes` | T4 | Система тем v3 (`ThemeRegistry`, `bootstrapThemes`, `applyTokens`, `validateThemeModule` + `./conformance` — гейт заявлених темою `views`) |
| `plugins/` | `simplycms/plugins` | T4 | Система плагінів (`HookRegistry`, `PluginLoader`, `PluginSlot`) |
| `plugin-sdk/` | `simplycms/plugin-sdk` | T4 | SDK плагіна: `definePlugin`, `validatePluginModule`, `usePluginT`, `usePluginTable` — єдина поверхня, дозволена плагіну (межа довіри, спека §7). 🔴 T4, а не T2: імпортує `plugins` |
| `admin-data/` | `simplycms/admin-data` | T4 | Колекції TanStack DB адмінки: реєстр `getCollection`/`useCollection` (WeakMap по `QueryClient`), колекції без `schema` (тип — type-only з `schema/types`), ключі з `contracts/entities` |
| `cart-ui/` | `simplycms/cart-ui` | T4 | Кошик: `CartButton`, `CartDrawer`, `CartItem`, `CartItemView` |
| `catalog-ui/` | `simplycms/catalog-ui` | T4 | Каталог: `ProductCard`, `FilterSidebar`, `ProductGallery`, `ModificationSelector`, `StockDisplay` |
| `checkout-ui/` | `simplycms/checkout-ui` | T4 | Оформлення: форми контактів, доставки, оплати, отримувача + підсумок |
| `profile-ui/` | `simplycms/profile-ui` | T4 | Профіль: адреси, отримувачі, аватар |
| `reviews-ui/` | `simplycms/reviews-ui` | T4 | Відгуки: `ProductReviews`, `StarRating` |
| `core/` | `simplycms/core` | T5 | Власні провайдери/хуки/компоненти (`CMSProvider`, `useAuth`, `useCart`, `useBanners`…). 🔴 Фасадну роль розчинено К0 — реекспорти чужого прибрано, споживачів переведено на джерела; повне розселення власних модулів по тірах свідомо ПОЗА К0 |
| `admin/` | `simplycms/admin` | T5 | Лейаути, сторінки й компоненти адмінки |
| `storefront-routes/` | `simplycms/storefront-routes` | T5 | Канонічні сторінки: `pages/` (container-и) і `views/` (канонічні view + `views/slots/` — прибінджені реквізити, контракт тем v3), `shells/`, `server/`, `seo/` |

Дві теки роутів лежать НЕ в `src/` — вони монтуються `physical()`-ом як
файли, а не імпортуються як модулі:

| Тека пакета | Вхід exports | Tier | Опис |
|---|---|---|---|
| `routes/storefront/` | `simplycms/storefront-routes/routes/*` | T5 | Роут-файли вітрини/protected/auth/api |
| `routes/admin/` | `simplycms/admin-routes/routes/*` | T5 | Роут-файли адмінки (тонкі обгортки `src/admin`) |

🔴 Ключі exports цих двох входів навмисно лишились СТАРИМИ (`./storefront-routes/routes/*`,
`./admin-routes/routes/*`) при новій фізичній теці — правило переносу 1:1
зберігає чинні публічні входи, а фізична розкладка — деталь реалізації.

🔴 **Дві розбіжності цієї таблиці з `eslint.tier-zones.mjs` зафіксовані фактом,
а не виправлені кодом:** `plugin-sdk` стоїть T4 (він імпортує `plugins`), а
пʼять `*-ui` (T4) тягнуть `core` (T5) — зустрічний цикл, борг розселення
`core` по тірах.

## Usage

Ці пакети живуть у монорепо SimplyCMS — окремих форків/копій у магазинах немає.
Магазини споживають ядро як звичайні npm-залежності: публікація на npmjs
працює з 2026-08-03; версія синхронна — усі 5 пакетів завжди мають одну
версію, актуальний номер — у [`CHANGELOG.md`](../CHANGELOG.md). Розширення
відбувається через плагіни й теми, а не форк ядра.

Магазин після К0 тримає **одну** залежність ядра — `simplycms` (+ CLI у
devDependencies), а конкретний шар імпортує субшляхом:

```ts
import { definePlugin } from 'simplycms/plugin-sdk';
import { Button } from 'simplycms/ui/button';
import type { HomeViewModel } from 'simplycms/contracts/views';
```

Найшвидший шлях завести магазин — `pnpm create simplycms-store`: скаффолдер
приводить усе ядро разом і в узгоджених версіях.

## Development

Розробка ведеться напряму в цьому монорепо: зміни в `packages/`
коммітяться разом з рештою проекту, окремого push у зовнішній core-репозиторій
не потрібно.

## Чеклист нового пакета

Зібрано під час додавання `@simplycms/cli` (2026-08-13), оновлено під
топологію К0 (2026-08-20). 🔴 **Спершу спитай, чи потрібен новий ПАКЕТ.**
Після К0 дефолт — нова **тека** в `packages/simplycms/src/` плюс вхід
в `exports`-мапі й зона в `eslint.tier-zones.mjs`; окремий npm-пакет
виправданий лише коли одиниця має власний цикл релізу (тема, плагін,
bin-інструмент). Конвеєр підхоплює новий пакет майже весь автоматично, але
критерії «публікованості» у різних інструментів РІЗНІ, і розбіжність дає
мовчазні дірки:

1. **`version`** — точно поточна синхронна (звір по сусідах);
   `scripts/release/bump.mjs` бере все, що не `private: true`, і падає, якщо
   версії розійшлися.
2. 🔴 **`"private": false` — буквально, не відсутність поля.**
   `scripts/pack-inspect.mjs` (tarball-parity suite) фільтрує за
   `private === false` **І** іменем ядра (scope `@simplycms/` **або** точне
   unscoped `simplycms`) — пакет без явного `"private": false` мовчки ВИПАДАЄ
   з packaging-гейта (тест не червоніє, просто не перевіряє). `bump.mjs` при
   цьому пакет бачить — тобто він релізиться, але не веріфікується.
   🔴 Ім'я `simplycms` скрізь звіряється ТОЧНО, ніколи префіксом: префікс
   зачепив би сторонні `simplycms-theme-*`/`simplycms-plugin-*`.
3. **`publishConfig`** — `access: "public"` (scoped-пакети npm за
   замовчуванням приватні), `registry: https://registry.npmjs.org`,
   `exports` (обовʼязково — parity-тест вимагає його наявності) і
   `main`/`types`, якщо є в топ-рівні.
4. **`files`, `license: MIT`, `README.md`** — конвенція; тестами стережуться
   лише цілі з `exports` («кожна ціль існує в tarball-і»), license і README —
   ні, не забудь руками.
5. **Збірка** — tsdown. У флагмані `tsdown.config.ts` — ДВІ збірки
   (клієнтська й серверна), а entry виводяться з dev-`exports`
   (ключ → джерело), тож `dist/` дзеркалить `publishConfig.exports`
   за побудовою; server-only групу задає `contracts/server-only`.
   `entry` — МАПА `<шлях у dist> → файл`: за списковою формою бандлер бере
   outbase = спільний предок і мовчки затирає корінь пакета.
   🔴 **Форму `import.meta` у `dist` зберігає `format: ['esm']` у спільному
   `base`, а не `target`.** Rolldown у ESM-виході не лоуерить `import.meta`
   за жодного `target` (виміряно es2015…esnext), а cjs лоуерить у
   `var import_meta = {}` / `{}.env…` — опублікований `dist` читає
   `({}).env`, і браузерний код, що читає `import.meta.env`, падає на
   гідрації (спіймано К0 при злитті 21 конфігу). `target: 'esnext'` лишено
   явним лише для незалежності рівня синтаксису від tsconfig пакета. Гард —
   `tests/dist-import-meta.test.ts` у packaging-suite (скан `dist`), його
   самоперевірка патерна `LOWERED_IMPORT_META` — cjs-кейс
   `tests/dist-import-meta-fixture.test.ts`. Розкладка entry — не
   політика синтаксису.
   Альтернатива — без збірки взагалі: сирці в tarball, без скрипту `build`
   (`cli`, `create-simplycms-store`). `pnpm build:packages` фільтрує за
   іменем (`@simplycms/*` + `simplycms`) і пакети без `build` пропускає
   мовчки.
6. **Аліаси tsconfig/vite/vitest** — лише якщо пакет імпортують КОДОМ.
   Нова тека всередині флагмана аліаса НЕ потребує взагалі: її покриває
   чинна пара `simplycms` / `simplycms/*`. Bin-інструменти й теки, що
   монтуються шляхом (роут-теки, `cli`), живуть без аліасів через
   workspace-симлінки.
7. **Гейти підхоплюють самі:** tsconfig `include`-глоб і `eslint .` бачать
   новий пакет автоматично; vitest бере `packages/<pkg>/src/**/__tests__/`
   без конфігурації. НЕ автоматично — явні списки в `eslint.config.mjs` та
   сусідніх файлах, допиши свою теку, якщо вона підпадає:
   error-зони `no-restricted-syntax` (i18n для UI-тек, env для серверних
   модулів), **тір-зона в `eslint.tier-zones.mjs`** (нова тека ядра без
   зони не має жодної межі шарів) і `SCANNED_ROOTS` i18n-скану.
8. **`audit-deps`/`audit-exports`** (у `pnpm test`) — сканують `src/` і
   `routes/` пакетів ядра (`@simplycms/*` + `simplycms`, включно з `.mjs`):
   кожен bare-імпорт
   мусить бути в `dependencies`/`peerDependencies`, кожен вжитий у репо
   subpath — в `exports` і `publishConfig.exports`.
9. 🔴 **Публікація автоматична і НЕЗВОРОТНА за фактом мержу:**
   `pnpm publish -r` у CI публікує будь-який не-`private` пакет, якого ще
   немає в реєстрі, незалежно від бампа версії. Введення пакета в
   `packages/*` = релізне рішення в момент мержу в `main`
   ([`release-process.md`](../docs/architecture/release-process.md)).
10. **Перед PR:** повний конвеєр гейтів у канонічному порядку + `pnpm
    pilot:pack`; якщо пакет їде в шаблон магазину — звір parity-тести і
    `writeManifest` пілота (підміна на `file:`-tarball-и має покрити і
    devDependencies).

## License

MIT
