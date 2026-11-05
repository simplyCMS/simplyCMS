# Мультимовність М2, блок 1: розведення осей мови — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Мова контенту й мова інтерфейсу стають двома типами з одним мостом між ними. На клієнт вітрини потрапляє лише каталог ядра своєї мови й своєї частини. Адмінка показується мовою з профілю. Листи, ціни, дати й множина йдуть за мовою інтерфейсу.

**Architecture:**
- Брендовані `ContentLocale` (вісь даних: тип — `simplycms/contracts` (файл `contracts/content-locale.ts`), конструктор — `simplycms/domain/translations`) і `UiLocale` (вісь інтерфейсу: тип — `simplycms/contracts`, конструктори — `simplycms/i18n`). Змішування ловить `tsc`.
- Міст `resolveUiLocale` — єдине місце, де мова контенту перетворюється на мову інтерфейсу.
- Мова магазину — лише мова з пакетом (спека §19.15, ред. 2): публікація без пакета неможлива, тож на вітрині міст — тотожність; крок «основна мова» лишається лише для деградованого режиму й листів старих даних, з гучним сигналом.
- Каталоги ядра — ліниві частини `base`/`admin`/`mail` у реєстрі з протоколом thenable. Протокол спільний із `ThemeRegistry`. Прогрів — у кореневому лоадері, у `beforeLoad` адмінки й перед гідрацією.
- Каталоги тем і плагінів не змінюються. Спільний у них лише пошук рядка `lookupMessage`.

**Tech Stack:** TypeScript 6 strict, React 19 (`use`), TanStack Start/Router (лоадери, `beforeLoad`, `ssr:false` адмінки), Drizzle + PostgreSQL 17 (`test:schema`), Vitest + Testing Library, `Intl.NumberFormat`/`DateTimeFormat`/`PluralRules`.

**Spec:** `docs/superpowers/specs/2026-10-14-multilingual-wave-design.md` **§19**: усі рішення цього плану, терміни §19.2, рішення власника §19.12 (п. 7–10 — ревізія ред. 2), **§19.15** — мова магазину лише з пакетом (пріоритет над §19.4–19.10 там, де розходяться).
**Майстер-план:** `docs/superpowers/plans/2026-10-15-multilingual-wave-master.md`:
- §3.1 — `profiles.ui_locale`;
- §3.6 — Р7, уточнення «пакет є»;
- §4 — І41–І46;
- §5 — рядок М2;
- §6 — процес;
- §7 — Review Focus 6.

Імплементер читає §19 спеки й §4/§6 майстра перед будь-якою задачею. Цей план їх не повторює.

**Місце у хвилі.** Це ПЕРШИЙ план підхвилі М2 (майстер §5). Перекладні таблиці решти сутностей, `orders.locale`/`profiles.locale`/`product_reviews.locale`, двомовні знімки, `bootstrapStore` + `primaryLocale` і плагіни — наступний план М2. Він пишеться після приймання цього блоку і стоїть на його типах.

---

## Global Constraints

- **Процес.** Усе з майстра §6:
  - гілка `claude/multilingual-wave`; імплементер — `model: sonnet`, рецензенти — `model: opus`; Fable — ніде;
  - коміти задач — локально;
  - після коміту субагента `git log --format=%B <база>..HEAD | grep -ciE "co-authored|generated with"` = `0`.
- **Доказ задачі** (рішення власника 2026-11-04, ред. 3): Step 5 задач читати як ШВИДКИЙ ланцюг (`format:check → lint → build → typecheck → test`; `install --frozen-lockfile` першим, якщо правлено `package.json`) + цільові гейти задачі (бриф) + мутації, що їх вимагає план (smoke-мутації — лише де план прямо каже `live:smoke`). Повний `pnpm gates` (штамп `.gates-stamp.json`: `head` = голова, усі `ok`, без `dirtyAfter`) + `pnpm live:smoke` — на контрольних точках: К-1 (Task 5 + вікно залежностей К1), К-2 (Task 5б + Task 6), К-3 (СТОП після Task 8; штамп для приймання). `pilot:pack` повний pilot не замінює. Причина: повний ланцюг 12–15 хв (test:schema ≈7), ×2–3 на задачу перевищував саму імплементацію.
- **Нові тести — за `docs/architecture/test-contours.md` § 0.**
  - Одна поведінка — один рівень.
  - Доказ мутацією — для рядків матриці (І41–І45) і гейтів (сканер, Gate C, парність).
  - Змінюєш файл тестів — прибери дубль у зоні зміни.
- **Без зворотної сумісності.** Старі імена (`Locale`, `useLocale`, `useFallbackLocale`, `getLanguagePack`, `LanguagePack.catalog`, `languageOfConfigLocale`, `getStoreLocale`, `declareStoreLocale`, `config.locale`, `VITE_LOCALE`, публічний експорт `LANGUAGE_PACKS`) зносяться в задачі, що їх замінює, без реекспортів і шимів. Кожне знесене публічне ім'я — рядок BREAKING у `CHANGELOG.md` `[Unreleased]`, у тій самій задачі.
- **Host-копії** (`src/`, `packages/create-simplycms-store/template/src/`, `packages/cli/host/src/`) правляться лише в `src/`, далі `pnpm template:sync`. Паритет — `tests/create-store-template-parity.test.ts`.
- **Схема** (Task 5) — виняток baseline:
  - `schema.ts` → `pnpm db:rebaseline`;
  - ручні файли `0002_grants`/`0004_functions`, якщо зачеплено;
  - `pnpm template:sync`, `pnpm test:schema`;
  - CHANGELOG «перестворити БД».
- **Розмір модуля** ~150 рядків; у звіті — `wc -l` змінених файлів коду.
- **Норма лінту** — та, що в `AGENTS.md` на старті задачі. Нове попередження лагодять.

## Рішення рівня плану (у межах §19; архітектор бачить на прийманні)

| # | Питання | Рішення |
|---|---|---|
| Д1 | Де `LocaleSet` | `simplycms/contracts` (файл `contracts/content-locale.ts`) (T0, лише типи, разом із `ContentLocale`): його читають `contracts/entities`, `runtime/router-context`, `site`, `storefront-routes`, `storefront/loaders`. Конструктор `checkedContentLocale` — у `simplycms/domain/translations`. Поля стають `ContentLocale`. Поле `known` лишається |
| Д2 | Де кореневий `UiLocale` | У даних кореня: `loadStorefrontRoot` повертає `ui: { locale, fallback }` і до повернення чекає `loadUiCatalog(ui.locale, 'base')` (без мови fallback: спека §19.4, §19.12(1) — один каталог ядра на клієнт; `ui.fallback` лишається в даних кореня для тем і плагінів). `beforeLoad` кореня не змінюється: лоадер уже біжить і на SSR, і на клієнтській навігації, і `head()` бере дані з `matches` |
| Д3 | Як провайдер отримує каталоги | `I18nProvider` стає чистим контекстом: `{ locale: UiLocale; fallback: UiLocale; catalogs: readonly PartCatalog[] }`. Вантажить роут: хук `useUiCatalogs(locale, parts)` = `parts.map((p) => use(loadUiCatalog(locale, p)))`. Тести передають статичні каталоги з `packages/simplycms/test-harness/i18n.tsx` без реєстру |
| Д4 | Транслятор поза React | `createTranslator(catalogs: readonly PartCatalog[]): Translator` — синхронний над завантаженим. `loadTranslator(ui: UiLocale, parts): Promise<Translator>` — єдиний шлях поза React (head, листи, CLI). Синхронного peek немає: `head` у router-core асинхронний (`Awaitable`, `route.ts:1372+`), а помилки в ньому роутер ковтає (`load-client.ts:1283`, `load-server.ts:671`), тож «кидати з інваріантом» там — мовчазний дефект |
| Д5 | Спільний протокол thenable | `packages/simplycms/src/contracts/thenable.ts` (T0, клієнтобезпечний): `type ReactThenable<T>` і `trackThenable<T>(p: Promise<T>): ReactThenable<T>`. Ним користуються `ThemeRegistry` і реєстр каталогів |
| Д6 | Прогрів перед гідрацією | `prepareStorefrontHydration(): Promise<void>` у `simplycms/storefront-routes/hydration` (новий модуль поруч із `locale`). Вантажить активну тему (як зараз `client.tsx:22-26`); `base` під час гідрації не прогрівається: `head` маршрутів чекає `loadTranslator` у `router.hydrate()`, а корінь без Suspense-межі, призупинившись, лишає SSR-DOM (виміряно Task 4, маркер ідентичності вузла). `client.tsx` лише чекає цю функцію |
| Д7 | Мова адмінки: запис і читання | Одна операція реєстру `profiles.setUiLocale` (permission `profile.update`, input `{ uiLocale: string \| null }`, значення — код наявного пакета з частиною `admin` або `null`, інакше 400; лише оновлює наявний профіль). Читання окремої операції не має: `beforeLoad` `/admin` бере `uiLocale` разом із сесією serverFn `getAdminSession` (§19.6). Операція — для власного рядка `actor.userId`; актор `system` → відмова; стає «доступною ролі user» — рядок у знімку `user-accessible-operations` з причиною «власний профіль» |
| Д8 | Де вибір мови в адмінці | Селектор у шапці `AdminLayout` поруч із `ThemeToggle`. Окремої сторінки профілю адміністратора немає, і цей блок її не створює |
| Д9 | Мова листа | `resolveMailUiLocale(recipient: MailRecipient, primary: ContentLocale): UiLocale` (§19.9). Колонок `orders.locale`/`profiles.locale` ще немає (наступний план), тож зараз: лист покупцю бере опубліковану мову чекауту (`requirePublishedTextLocale`); користувачу — `profiles.ui_locale`, інакше основна; магазину — основна; запрошенню — основна. Наступний план лише подасть нові поля в ту саму функцію |
| Д10 | Гейт складу клієнтського графа (І43) | Правило в наявному Gate C пілота (`scripts/pilot-pack/gate-c.mjs`, `NOT_IN_INITIAL`): у початковому графі вхідного чанка вітрини немає ЖОДНОГО модуля з `packages/simplycms/src/i18n/catalogs/` (усі частини — лише `import()`). Юніт-контроль — `tests/pilot-gate-c.test.ts` |
| Д11 | `useFormatDate` | Переїжджає з `admin/lib/` у `simplycms/i18n/format.ts` (форматування — вісь інтерфейсу), Імпорти оновлюються, реекспорту немає. Окремий `useFormatNumber` не створюється (YAGNI) |
| Д12 | Мова магазину лише з пакетом (§19.15) | Один пошук пакета `findLanguagePack(code)` (точний код → базова мова) у `i18n/packs` — на ньому стоять і `resolveUiLocale` (кроки 1–2), і `hasLanguagePack`; дві реалізації пошуку заборонені. Відмова публікації — `ValidationError` `{ path: ['status'], code: 'language_pack_missing' }` за зразком `languageIncompleteError` (`impl/languages/completeness.ts:114`): код у `contracts/domain-errors.ts`, мапа `admin/lib/apply-server-validation.ts`, рядок `admin.validation.language_pack_missing` у каталогах `uk`/`en`. Сигнал деградації — серверний `loadLocaleSet()` (`storefront/loaders/languages.ts`): опублікована мова без пакета → одне попередження в лог на процес і мову (механізм логування сервера — той, що вже є в коді; `console.log` не можна) |

---

### Task 1: Вісь контенту — `ContentLocale`, `LocaleSet`, `useContentLocale`, ключі кешу (І41 типова частина)

**Files:**
- Create:
  - `packages/simplycms/src/contracts/content-locale.ts` (типи `ContentLocale`, `LocaleSet`);
  - `packages/simplycms/src/domain/translations/content-locale.ts` (`checkedContentLocale`);
  - `packages/simplycms/src/runtime/content-locale.ts` (хук `useContentLocale`, субшлях `simplycms/runtime/content-locale`);
  - `packages/simplycms/src/domain/request-locale.ts` (переїзд `resolveRequestLocale`, `ResolvedLocale`, `NO_LOCALES`, `NON_STOREFRONT_SEGMENTS`, `isStorefrontPath`, `localePrefix` з `storefront-routes/locale/resolve.ts` і `localeOfHref` з `root-data.ts`; `resolve.ts` видалено);
  - `packages/simplycms/src/contracts/__tests__/locale-axes.typetest.ts`.
- Modify:
  - `domain/translations/{text-locale.ts,index.ts}`: поля `TextLocale` → `ContentLocale`;
  - `i18n/types.ts`: прибрати `LocaleSet`;
  - `site/languages.ts`: `toLocaleSet` конструює через `checkedContentLocale`;
  - `storefront-routes/locale/{script.ts,root-data.ts,context.ts}`;
  - `runtime/router-context.ts`, `site/request-context.ts`, `storefront/loaders/{languages,text-locale}.ts`, `storefront-routes/seo/{normalize,history}.ts`, `storefront-routes/pages/entity-route.ts`;
  - `core/lib/locale-input.ts`: `localeInput` дає `ContentLocale`;
  - `contracts/entities.ts`: `entityKey(entity, locale?: ContentLocale)`, `keyFor(locale: ContentLocale)`;
  - `react-query/queries.ts:27`, `site/read-cache.ts`: `variant` лишається `string`, бо `createReadCache` не знає осі — ключ мови дає викликач.
  - Споживачі `useLocale()` ДЛЯ ДАНИХ переходять на `useContentLocale()`:
    - `catalog-ui/FilterSidebar.tsx:91`, `core/hooks/{useBanners.ts:18,useCartQuote.ts:56}`;
    - `storefront-routes/pages/catalog/{useCatalogQueries.ts:26,42,62,86,useCatalogProductsQuery.ts:39}`;
    - `storefront-routes/pages/product-detail/{useProductQuery.ts:30,useModificationData.ts:32}`;
    - `storefront-routes/pages/checkout/useCheckoutQuote.ts:32`, `storefront-routes/pages/Checkout.tsx:118`;
    - `storefront-routes/pages/home/queries.ts:37,52,65,89`, `storefront-routes/pages/{Properties.tsx:18,PropertyDetail.tsx:24,PropertyPage.tsx:66}`;
    - `storefront-routes/views/slots/ProductAddToCart.tsx:41`, `cart-ui/CartItemView.tsx:40`.

**Interfaces:**
- Produces:
  - `type ContentLocale = string & { readonly __axis: 'content' }`.
  - `checkedContentLocale(code: string): ContentLocale` — кидає `Error`, якщо `code` не відповідає `LANGUAGE_CODE_FORMAT`. Кличуть лише межі: `toLocaleSet`, `readClientLocaleSet`, `localeInput` (`.transform`), фікстури тестів.
  - `type LocaleSet = { primary: ContentLocale; published: readonly ContentLocale[]; known: readonly ContentLocale[] }`.
  - `interface TextLocale { locale: ContentLocale; primary: ContentLocale; __checked: true }`, `checkedTextLocale(locale: ContentLocale, primary: ContentLocale)`.
  - `useContentLocale(): ContentLocale` (`simplycms/runtime/content-locale`) — `localeOfHref(useRouterState(publicHref), useRouteContext({ strict: false }).locales)`, та сама пара, що в `useRequestTranslator`. Другого парсера сегмента немає.
  - `localeOfHref(publicHref: string, locales: LocaleSet): ContentLocale` (`simplycms/domain`).
- `useLocale()` у цій задачі ще існує й повертає мову провайдера (вісь інтерфейсу). Після задачі в даних його не лишається.

- [ ] **Step 1: Типовий тест** `locale-axes.typetest.ts` (перевіряє `pnpm typecheck`, не vitest):
  - `// @ts-expect-error` на `entityKey(ENTITY.products, 'uk')` (сирий рядок);
  - `// @ts-expect-error` на `checkedTextLocale('uk', 'uk')`;
  - позитивний рядок: `entityKey(ENTITY.products, checkedContentLocale('uk'))` компілюється.
  - Юніт `content-locale.test.ts`: `checkedContentLocale('pt-BR')` → `'pt-BR'`; `checkedContentLocale('EN')` і `('')` кидають.
- [ ] **Step 2:** `pnpm build && pnpm typecheck` → червоний (типів і функції ще немає).
- [ ] **Step 3: Реалізація** за Interfaces. Перенести `LocaleSet`, переписати конструктори, перевести перелічених споживачів на `useContentLocale()`. Компілятор знайде решту: кожне місце, де рядок іде в `entityKey`/`keyFor`, виправляється на мову контенту, а не приведенням `as`.
- [ ] **Step 4:** `pnpm build && pnpm typecheck` → зелений; `pnpm vitest run packages/simplycms/src/{contracts,domain,storefront-routes,core,catalog-ui,cart-ui}` → PASS. Перевірка повноти: `git grep -n "useLocale()" packages/simplycms/src -- ':!**/__tests__/**'` дає лише місця форматування (`admin/**`, `useFormatDate`) і `useThemeT`/`usePluginT`.
- [ ] **Step 5:** Мутація: `type ContentLocale = string` → `typecheck` червоний (невикористаний `@ts-expect-error`) → відкат → зелений. `pnpm gates` + `pnpm live:smoke`. Commit `refactor(i18n): вісь контенту — ContentLocale, LocaleSet у domain, useContentLocale`.

---

### Task 2: Вісь інтерфейсу — `UiLocale`, міст `resolveUiLocale`, спільний `lookupMessage` (І41 поведінка, І42)

**Files:**
- Create:
  - `packages/simplycms/src/i18n/ui-locale.ts` (конструктори `resolveUiLocale`, `toUiLocale`; тип `UiLocale` — у `simplycms/contracts`);
  - `packages/simplycms/src/i18n/lookup.ts` (`lookupMessage`);
  - `i18n/__tests__/{resolve-ui-locale.test.ts,lookup.test.ts}`;
  - `storefront-routes/__tests__/content-vs-ui-locale.test.tsx`.
- Modify:
  - `i18n/{types.ts,translator.ts,I18nProvider.tsx,index.ts}`;
  - `themes/useThemeT.ts`, `plugin-sdk/usePluginT.ts`: пошук через `lookupMessage`;
  - `storefront-routes/locale/{root-data.ts,useRequestTranslator.ts}`, `storefront-routes/head/head.ts`;
  - `src/routes/__root.tsx` + `pnpm template:sync`;
  - `site/{language-pack.ts → видалити, index.ts}`, `admin-server/impl/languages/view.ts:34`: `hasPack` через `hasUiPack`;
  - `themes/conformance/{assertThemeViewsConformance.ts:124,fallback-lang.ts:84}`: без дефолту `'uk'`, мова — параметр;
  - споживачі `useLocale()` для форматування (`admin/lib/useFormatDate.ts`, `OrdersTable`, `OrderDetailPage`, `RecentOrdersCard`, `DiscountGroupHeader`, `PluginInfoCard`) → `useUiLocale()`.

**Interfaces:**
- Consumes: `ContentLocale`, `LocaleSet` (Task 1).
- Produces:
  - `type UiLocale = string & { readonly __axis: 'ui' }`.
  - `resolveUiLocale(content: ContentLocale, primary: ContentLocale): UiLocale`:
    1. пакет із точним кодом;
    2. пакет базової мови (`new Intl.Locale(code).language`);
    3. кроки 1–2 для `primary`;
    4. `throw new Error(…)` з переліком наявних пакетів (інваріант Р7).
  - `hasUiPack(code: ContentLocale): boolean` = кроки 1–2 знаходять пакет (Р7, майстер §3.6).
  - `toUiLocale(value: string | null): UiLocale | null` — лише точний код наявного пакета.
  - `lookupMessage(catalogs: readonly (Readonly<Record<string, string>> | undefined)[], key: string, params?: MessageParams): string` — перший каталог, що має ключ, далі `interpolate`; немає ніде → сам `key`. Копій `?? ??` у `translator.ts`, `useThemeT.ts`, `usePluginT.ts` не лишається.
  - `I18nProvider({ locale: UiLocale; fallback: UiLocale; children })` — каталоги поки статичні (Task 3 додасть `catalogs`).
  - `useUiLocale(): UiLocale`; `useLocale` і `useFallbackLocale` зносяться. `useThemeT`/`usePluginT` беруть пару мов із внутрішнього контексту провайдера.
  - `StorefrontRootData` отримує `ui: { locale: UiLocale; fallback: UiLocale }`; `locale` (контент) лишається для `<html lang>` (І37).
  - `storefrontHead` бере транслятор за `ui`. `useRequestTranslator` — `resolveUiLocale(localeOfHref(…), locales.primary)`.

- [ ] **Step 1: Тести.**
  - `resolve-ui-locale.test.ts` (І42), на реальних пакетах `uk`, `en`:
    - `('uk','uk')` → `'uk'`; `('en-GB','uk')` → `'en'`; `('pl','uk')` → `'uk'`; `('pl','en')` → `'en'`;
    - `('pl','pl')` кидає з текстом, що містить `uk` і `en`;
    - `hasUiPack('en-GB')` → `true`, `hasUiPack('pl')` → `false`;
    - `toUiLocale('en')` → `'en'`, `toUiLocale('en-GB')` → `null`, `toUiLocale(null)` → `null`.
  - `lookup.test.ts`: перший каталог виграє; ключ лише в другому → значення другого; ніде → ключ; `{n}` підставляється.
  - `content-vs-ui-locale.test.tsx` (І41), за зразком `product-page-html.test.tsx` (`ssr(url)`), `SET = { primary: 'uk', published: ['uk','en','pl'], known: ['uk','en','pl'] }`:
    - SSR `/pl/<path>`: мок `products.byAddress` отримав `locale: 'pl'` і НІКОЛИ `'uk'`;
    - HTML містить назву товару з даних `pl` і український рядок інтерфейсу (значення `t('product.addToCart')` каталогу `uk`);
    - `<html lang="pl">`.
- [ ] **Step 2:** тести → FAIL (`resolveUiLocale` немає; провайдер на `/pl` отримує `pl`).
- [ ] **Step 3: Реалізація** за Interfaces. Root (`__root.tsx`): `<I18nProvider locale={ui.locale} fallback={ui.fallback}>`, `<html {...htmlLangAttrs(locale)}>` без змін. Переписати тести, що конструювали провайдер з `locale="uk"`, на `UiLocale` (фікстура `uk = resolveUiLocale(…)` чи `toUiLocale('uk')!` у тесті).
- [ ] **Step 4:** тести → PASS; `pnpm vitest run packages/simplycms/src/{i18n,themes,plugin-sdk,storefront-routes,admin}` → PASS; `pnpm build && pnpm typecheck`.
- [ ] **Step 5:** Мутації:
  - (а) прибрати крок базової мови → `resolve-ui-locale` червоний;
  - (б) `useContentLocale` повертає мову провайдера → `content-vs-ui-locale` червоний;
  - (в) `lookupMessage` бере останній каталог першим → `lookup` і `theme-messages-parity`/conformance червоні.

  BREAKING у CHANGELOG: `Locale`, `useLocale` → `useUiLocale`, `useFallbackLocale`, пропи `I18nProvider`. `pnpm gates` + `pnpm live:smoke`. Commit `feat(i18n): мова інтерфейсу через міст resolveUiLocale, спільний lookupMessage`.

---

### Task 3: Лінивий реєстр каталогів ядра, пакет із частинами `ui`/`content` (І43 сканер, частина І44)

**Files:**
- Create:
  - `packages/simplycms/src/contracts/thenable.ts` + `contracts/__tests__/thenable.test.ts`;
  - `packages/simplycms/src/i18n/registry.ts` (`loadUiCatalog`, `useUiCatalogs`, `loadTranslator`) + `i18n/__tests__/registry.test.ts`;
  - `packages/simplycms/src/i18n/catalogs/{uk,en}/base.ts` (зведення 17 кореневих неймспейсів без `mail`);
  - `packages/simplycms/test-harness/i18n.tsx` (`TestI18nProvider`, `ukT`, `enT` — статичні імпорти частин, лише для тестів).
- Modify:
  - `themes/ThemeRegistry.ts:18-110` (протокол → `trackThenable`);
  - `i18n/{types.ts,translator.ts,I18nProvider.tsx,index.ts,packs/{index,uk,en}.ts}`;
  - `catalogs/{uk,en}/index.ts` → видалити (зведення за частинами);
  - `i18n/__tests__/catalog-integrity.test.ts`, `tests/i18n-catalog-parity.test.ts`: за частинами;
  - `domain/slugs` споживачі: `admin-server/impl/products/aggregate/{create.ts:96,modification-tokens.ts:12}` → `getContentTools(primary)`;
  - `routes/admin/admin.tsx` (layout вантажить `admin` + `base` мовою основної; мова з профілю — Task 5);
  - `storefront-routes/locale/{root-data.ts,useRequestTranslator.ts}`, `storefront-routes/head/head.ts` (async `head()` на `loadTranslator`);
  - серверні творці транслятора: `auth/{reset-mail.ts:44,verification-mail.ts:54,invite.ts:151}`, `auth/owner-invite-cli/run.ts:91`, `storefront/loaders/order-mail.ts:73`. Тут лише `await loadTranslator(ui, ['base','mail'])`; джерело мови не змінюється до Task 6, позначка `// М2а-TEMP: Task 6`;
  - `tests/e2e/support/i18n.ts:19`;
  - `tests/i18n-coverage/scan.ts` + `tests/i18n-coverage.test.ts` (нове правило ключів частин);
  - тести з `createTranslator('uk','uk')` (~90 файлів) і `<I18nProvider locale=…>` → `ukT`/`TestI18nProvider`.

**Interfaces:**
- Consumes: `UiLocale`, `lookupMessage` (Task 2).
- Produces:
  - `type ReactThenable<T> = Promise<T> & { status?: 'pending' | 'fulfilled' | 'rejected'; value?: T; reason?: unknown }`; `trackThenable<T>(p: Promise<T>): ReactThenable<T>` (позначає `status`/`value`/`reason`, повертає той самий проміс).
  - `type UiCatalogPart = 'base' | 'admin' | 'mail'`; `BaseKey`, `AdminKey`, `MailKey` виводяться з `catalogs/uk/{base,admin/index,mail}.ts`; `MessageKey = BaseKey | AdminKey | MailKey`; `PartCatalog = Readonly<Record<string, string>>`. Каталоги `en` — `satisfies Record<BaseKey, string>` тощо (повні; `Partial` зноситься).
  - `LanguagePack = { code: string; name: string; ui: Record<UiCatalogPart, () => Promise<PartCatalog>>; content: { slugify?: (text: string) => string; tokenize?: never } }`. Лоадери — `() => import('../catalogs/uk/base').then((m) => m.messages)`.
  - `getUiPack(ui: UiLocale): LanguagePack` (кидає, якщо немає — `UiLocale` гарантує наявність); `getContentTools(code: ContentLocale): LanguagePack['content'] | null` (точний код). `getLanguagePack` зноситься.
  - `loadUiCatalog(ui: UiLocale, part: UiCatalogPart): ReactThenable<PartCatalog>` — кеш за `${ui}:${part}`. Відхилений проміс видаляється з кешу (як `ThemeRegistry.ts:91`): наступний виклик повторює завантаження.
  - `useUiCatalogs(ui: UiLocale, parts: readonly UiCatalogPart[]): readonly PartCatalog[]` (`use` у циклі).
  - `createTranslator(catalogs: readonly PartCatalog[]): Translator`; `loadTranslator(ui, parts): Promise<Translator>` (синхронного peek немає, Д4).
  - `I18nProvider({ locale, fallback, catalogs, children })` (Д3). Root: `catalogs = useUiCatalogs(ui.locale, ['base'])`. Layout адмінки: вкладений провайдер з `['base','admin']`.
  - `loadStorefrontRoot` перед поверненням чекає `loadUiCatalog(ui.locale,'base')` (Д2).
  - `beforeLoad` адмінки (до Task 5): `ui = resolveUiLocale(context.locales.primary, context.locales.primary)`, чекає `loadUiCatalog(ui,'base')` і `(ui,'admin')`.
  - `useRequestTranslator` (екрани `NotFound`/помилки поза провайдером) — `useUiCatalogs(ui, ['base'])`, а не синхронне читання реєстру: корінь міг упасти до завантаження, тож хук має право призупинитись.
  - Тип значення каталогу Task 7 розширить до `string | PluralForms`; `PartCatalog` і `lookupMessage` тоді змінюються там.
  - `TestI18nProvider({ locale?: 'uk' | 'en'; children })` і `ukT`/`enT` — у `test-harness`, у продакшн-граф не потрапляють.
- **Сканер** (`scan.ts`):
  - рядковий літерал, що дорівнює ключу з множини `AdminKey`, поза коренями `packages/simplycms/src/{admin,admin-data}` і `packages/simplycms/routes/admin` → порушення;
  - ключ із множини `MailKey` поза `packages/simplycms/src/mail` → порушення.

  Множини ключів сканер бере з каталогів `uk`.

- [ ] **Step 0: Базовий вимір.** `pnpm build`; записати у звіт розмір і gzip чанка з каталогами (зараз `dist/client/assets/I18nProvider-*.js`, ≈196 KB / 47 KB gzip) і вхідного чанка вітрини.
- [ ] **Step 1: Тести.**
  - `thenable.test.ts`: після `await` — `status: 'fulfilled'`, `value`; відхилений — `status: 'rejected'`, `reason`.
  - `registry.test.ts`:
    - два виклики `loadUiCatalog(uk,'base')` повертають ТОЙ САМИЙ проміс;
    - `loadTranslator` чекає лише названі частини;
    - лоадер, що впав, не кешується (другий виклик знову кличе лоадер);
    - частина `admin` не вантажиться, доки її не попросили (шпигун на лоадері).
  - `i18n-coverage.test.ts`: негативні контролі нового правила (`'admin.common.title'` у фікстурі вітрини → порушення; `'mail.reset.subject'` у фікстурі `storefront-routes` → порушення).
  - `i18n-catalog-parity.test.ts` переписаний за частинами: та сама суворість (повнота, без зайвих, непорожні, плейсхолдери).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Реалізація** за Interfaces. `ThemeRegistry` переходить на `trackThenable` без зміни поведінки (його тести без змін). Масове оновлення тестів — механічне, через `test-harness/i18n.tsx`.
- [ ] **Step 4:** PASS; `pnpm vitest run packages/simplycms/src tests/i18n-coverage.test.ts tests/i18n-catalog-parity.test.ts` → PASS; `pnpm build && pnpm typecheck && pnpm typecheck:showcase`.
- [ ] **Step 5:** Мутації:
  - (а) реєстр без кешу → `registry` «той самий проміс» червоний;
  - (б) кешувати відхилений → червоний;
  - (в) прибрати правило `AdminKey` зі сканера → негативний контроль червоний.

  BREAKING: `LanguagePack`, `getLanguagePack`, `createTranslator(locale, fallback)`. `pnpm gates` + `pnpm live:smoke`. Commit `feat(i18n): ліниві частини каталогу ядра й пакет мови з частинами ui/content`.

---

### Task 4: Прогрів перед гідрацією, гейти складу графа й сирих ключів (І43, І44)

**Files:**
- Create:
  - `packages/simplycms/src/storefront-routes/hydration/{index.ts,prepare.ts}` + `__tests__/prepare.test.ts`;
  - `packages/simplycms/src/storefront-routes/__tests__/no-raw-keys-html.test.tsx`.
- Modify:
  - `src/client.tsx` (лише `await prepareStorefrontHydration()` замість рядків 22-26) + `pnpm template:sync`;
  - `scripts/pilot-pack/gate-c.mjs` (`NOT_IN_INITIAL` + правило каталогів), `tests/pilot-gate-c.test.ts`;
  - реєстрація субшляху `simplycms/storefront-routes/hydration`: `exports` у `packages/simplycms/package.json`, `eslint.tier-zones.mjs` (у зоні `storefront-routes`), таблиця `packages/README.md`.

**Interfaces:**
- Consumes: `ThemeRegistry`, `readActiveThemeName` (каталогів ядра прогрів не торкається — Д6, вимір маркером).
- Produces: `prepareStorefrontHydration(): Promise<void>` (Д6) — лише активна тема. Збій теми — як зараз (`.catch` з fallback на `default`). Каталог `base` вантажить `head` маршрутів у `router.hydrate()` або сам корінь (призупинення без Suspense-межі зберігає SSR-DOM); збій його завантаження не ковтається — його бачить `installStaleChunkGuard` (застарілий чанк після деплою).

- [ ] **Step 1: Тести.**
  - `prepare.test.ts` (jsdom; ред. після виміру Task 4 — прогрів лише теми): вантажить активну тему з назви від сервера; без назви — `default`; збій теми не блокує гідрацію.
  - Доказ «гідрація без прогріву `base` не перемальовує SSR» — маркер ідентичності SSR-вузлів у `live:smoke` на `/` і на товарі (постійна перевірка), разом з title SSR = після гідрації і `console.error` = 0.
  - `no-raw-keys-html.test.tsx` (І44), зразок `ssr(url)` з `product-page-html.test.tsx`: для `/`, `/<товар>`, `/cart` × мови `uk`, `en`, `pl` (без пакета; після Task 5б — «деградований режим», §19.15) жоден текстовий вузол і жодне значення атрибута HTML не дорівнює ключу з `BaseKey ∪ AdminKey ∪ MailKey`.
  - Клієнтський перехід `/x` → `/en/x` у тому ж тесті (`router.navigate`): після `router.load()` рендер англійський, без сирих ключів.
  - `pilot-gate-c.test.ts`: синтетичний граф, де вхідний чанк статично імпортує модуль `…/i18n/catalogs/en/base` → гейт червоний; через `import()` → зелений.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Реалізація** за Interfaces.
- [ ] **Step 4:** PASS; `pnpm build`; виміряти розмір і gzip вхідного графа вітрини й чанка `base` кожної мови → у звіт поруч із Step 0 Task 3. Оцінка §19.5 — ≈7–10 KB gzip на мову; розбіжність понад 2× — пояснити у звіті.
- [ ] **Step 5:** Мутації:
  - (а) прибрати очікування `base` у `loadStorefrontRoot` → `no-raw-keys-html` червоний;
  - (б) статичний імпорт `catalogs/uk/admin/index` у `packs/uk.ts` → Gate C червоний на повному pilot.

  `pnpm gates` (повний pilot!) + `pnpm live:smoke`. Commit `feat(storefront): прогрів каталогу перед гідрацією, гейти складу графа й сирих ключів`.

---

### Task 5: Мова інтерфейсу адмінки — `profiles.ui_locale` (І45)

**Files:**
- Create:
  - `packages/simplycms/src/admin-server/impl/profiles/ui-locale.ts` (обидві операції);
  - `packages/simplycms/src/admin/layouts/UiLocaleSelect.tsx`;
  - `packages/simplycms/test-harness/pg/__tests__/profile-ui-locale.test.ts`;
  - `packages/simplycms/routes/admin/__tests__/admin-ui-locale.test.tsx`.
- Modify:
  - `schema/schema.ts:999-1046` (`uiLocale: text('ui_locale')`, NULL, без FK) → `pnpm db:rebaseline` → `pnpm template:sync`;
  - `admin-server/impl/{operations-registry.ts,index.ts}`, `admin-server/index.ts` (тонкі serverFn за зразком `:668-670`);
  - знімок `user-accessible-operations` (Д7);
  - `openapi.core.json` (`pnpm api:snapshot`);
  - `routes/admin/admin.tsx` (`beforeLoad`: після `isAdmin` — `profiles.getUiLocale`, повертає `{ ui }` у контекст);
  - `admin/layouts/AdminLayout.tsx` (селектор поруч із `ThemeToggle`);
  - каталоги `admin/common` (`uk`, `en`): підпис селектора.

**Interfaces:**
- Consumes: `toUiLocale`, `resolveUiLocale`, `useUiCatalogs`, `I18nProvider` (Tasks 2–3), `LANGUAGE_PACKS` (назви мов; Task 5б замінює на `listLanguagePacks()` з фільтром частини `admin`).
- Produces:
  - Операції Д7 з ідентифікаторами `profiles.getUiLocale` / `profiles.setUiLocale`.
  - Контекст адмінки `ui: UiLocale` = `toUiLocale(value) ?? resolveUiLocale(primary, primary)`.
  - Вкладений `I18nProvider` у компоненті layout адмінки з `catalogs = useUiCatalogs(ui, ['base','admin'])`; кореневий елемент адмінки має `lang={ui}`.
  - Після `setUiLocale` — `router.invalidate()`: `beforeLoad` перечитує мову, лоадер частин підтягує каталог.

- [ ] **Step 1: Тести.**
  - `profile-ui-locale.test.ts` (`test:schema`, `executeOperation`):
    - адмін ставить `'en'` → `getUiLocale` повертає `'en'`;
    - `'xx'` → 400 і рядок не змінено;
    - `null` → скидання;
    - пише лише свій рядок (рядок іншого користувача не змінено);
    - актор `system` → відмова.
  - `admin-ui-locale.test.tsx`: мок `getUiLocale` → `'en'` → шапка показує `en`-значення `admin.common.title`, `lang="en"`; `null` → основна (`uk`); значення, якого немає серед пакетів (`'de'`), → основна.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Реалізація** за Interfaces. Схема — виняток baseline (Global Constraints).
- [ ] **Step 4:** PASS; `pnpm test:schema` → PASS; `pnpm vitest run packages/simplycms/routes packages/simplycms/src/admin` → PASS.
- [ ] **Step 5:** Мутація: `beforeLoad` ігнорує колонку → `admin-ui-locale` червоний. CHANGELOG — «перестворити БД» і новий пункт. `pnpm gates` + `pnpm live:smoke`. Commit `feat(admin): мова інтерфейсу адмінки з профілю (profiles.ui_locale)`.

---

### Task 5б: Мова магазину лише з пакетом (§19.15, І46)

> Додано ред. 2 плану (ревізія власника 2026-11-04). Виконується після переставлення Task 5 поверх Task 4 і ДО Task 6. Від вікна К1 (оновлення залежностей) не залежить.

**Files:**
- Modify:
  - `i18n/packs/index.ts`: тип `LanguagePack.ui` → `{ base; mail; admin? }`; реєстр не експортується; `findLanguagePack(code)` (внутрішній, Д12), `listLanguagePacks()`, `hasLanguagePack()`; коментарі `:2`, `:27` (стара модель «для більшості мов пакета немає») переписати;
  - `i18n/index.ts:9` — експорт `listLanguagePacks`, `hasLanguagePack`, тип `LanguagePackInfo` (поруч із наявними `getUiPack`, `getContentTools`); `LANGUAGE_PACKS` геть;
  - `i18n/ui-locale.ts` — кроки 1–2 через `findLanguagePack`; `toUiLocale(value, parts?)` перевіряє наявність частин;
  - `admin/layouts/UiLocaleSelect.tsx` — `listLanguagePacks()` з частиною `admin`;
  - `admin-server/impl/profiles/ui-locale.ts` — `setUiLocale`: пакет без `admin` → 400;
  - `routes/admin/admin.tsx` (`beforeLoad`) — ланцюг читання §19.6/§19.15: `ui_locale` з `admin` → основна з `admin` → `en`;
  - `admin-server/impl/languages/status.ts` (+ відмова поруч із `languageIncompleteError`), `contracts/domain-errors.ts`, `admin/lib/apply-server-validation.ts`, каталоги `admin/validation` `uk`/`en`;
  - `storefront/loaders/languages.ts` (`loadLocaleSet`) — сигнал деградації (Д12);
  - `packages/cli/src/doctor-db-checks.mjs` — перевірка «опублікована мова без пакета». Спершу звір, як doctor уже читає ядро магазину (`doctor-theme-checks.mjs`, `doctor-engines.mjs`). Якщо доступу до реєстру пакетів ядра з CLI немає — СТОП і питання архітектору, не дублюй перелік пакетів у CLI;
  - коментарі старої моделі: `storefront-routes/locale/root-data.ts:40`, `storefront-routes/locale/useRequestTranslator.ts:28`, `test-harness/locale.ts:25`;
  - тести старої моделі — переформулювати, не дублювати: `i18n/__tests__/resolve-ui-locale.test.ts:17`, `i18n/packs/__tests__/packs.test.ts:14,19,55`, `storefront-routes/__tests__/no-raw-keys-html.test.tsx:279`, тест І41 `content-vs-ui-locale` (Task 2): `pl` у них = «опублікована мова, пакета якої немає» (деградований режим), назви кейсів — відповідно;
  - канон, що описує чинний код: `docs/architecture/i18n.md:54,66`, `docs/architecture/repository-layout.md:106`, `packages/simplycms/src/i18n/README.md:31`.

**Interfaces:**
- Consumes: `resolveUiLocale`, `toUiLocale` (Task 2), реєстр частин (Task 3), `profiles.setUiLocale` і `UiLocaleSelect` (Task 5).
- Produces:
  - `type UiPart = 'base' | 'admin' | 'mail'`;
  - `type LanguagePackInfo = { readonly code: string; readonly name: string; readonly parts: readonly UiPart[] }`;
  - `listLanguagePacks(): readonly LanguagePackInfo[]`;
  - `hasLanguagePack(code: string, parts: readonly UiPart[] = ['base', 'mail']): boolean` — точний код або базова мова (`pt-BR` → `pt`);
  - `getUiPack`, `getContentTools` — без змін (Task 3, §19.10); `getLanguagePack` знесено в Task 3 і не повертається;
  - відмова `languages.setStatus` → `published`: `ValidationError` `{ path: ['status'], code: 'language_pack_missing' }`.
- Task 6 бере ці імена як є: `resolveMailUiLocale` не змінюється, гілка `order-customer` `'pl'` → `'uk'` — це лист старого замовлення мовою, що втратила пакет.

- [ ] **Step 1: Тести.**
  - `packs.test.ts`: `listLanguagePacks()` → `uk`, `en` з `parts` `['base','admin','mail']`; `hasLanguagePack('pt-BR')` за наявного лише `pt` (тестовий реєстр) → `true`; пакет без `admin` → `hasLanguagePack(code)` `true`, `hasLanguagePack(code, ['admin'])` `false`; `pl` → `false`.
  - `test:schema` поряд з наявними тестами `languages.setStatus`: `pl` `draft` → ок; `pl` → `published` → `language_pack_missing` на `status`, рядок лишився `draft`; `en` → `published` → ок; неповна `en` і далі дає `language_incomplete` (порядок перевірок: пакет, потім повнота).
  - `admin-ui-locale.test.tsx`: пакет без `admin` (тестовий реєстр) не потрапляє в селектор; `ui_locale` з таким кодом → основна; основна без `admin` → `en`. `setUiLocale` з кодом пакета без `admin` → 400.
  - Сигнал: шпигун логу на `loadLocaleSet()` — опублікована `pl` без пакета → рівно одне попередження за два виклики; `uk`/`en` → нуль.
  - Переформульовані тести старої моделі зелені й кажуть «деградований режим».
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Реалізація** за Interfaces і Д12.
- [ ] **Step 4:** PASS; `git grep -n "LANGUAGE_PACKS" -- packages/simplycms/src ':!packages/simplycms/src/i18n/packs/**'` → порожньо; `git grep -nE "мова без пакета|без пакета pl|для більшості з них пакета немає" -- packages docs/architecture` → порожньо (крім `slugify`-контекстів §18.4 і `product-aggregate` про path); `pnpm api:snapshot`, якщо код відмови потрапляє в OpenAPI.
- [ ] **Step 5:** Мутації: прибрати перевірку пакета з `setStatus` → `test:schema` червоний; прибрати попередження → шпигун червоний. BREAKING у `CHANGELOG`: `LANGUAGE_PACKS` не експортується; `LanguagePack.ui.admin` необов'язкова; мову без пакета не опублікувати (`language_pack_missing`). `pnpm gates` + `pnpm live:smoke`. Commit(и) логічні: `feat(i18n): API пакетів мов, admin необов'язкова`, `feat(languages): публікація лише з пакетом мови`, `feat(storefront): гучний сигнал деградованого режиму мови`, `test: …`, `docs: …`.

---

### Task 6: Листи, CLI і форматування за мовою інтерфейсу; знос `config.locale`

**Files:**
- Create:
  - `packages/simplycms/src/mail/locale.ts` (`resolveMailUiLocale`, `MailRecipient`) + `mail/__tests__/locale.test.ts`;
  - `packages/simplycms/src/i18n/format.ts` (`useFormatDate` переїжджає сюди з `admin/lib/useFormatDate.ts`) + `i18n/__tests__/format.test.ts`.
- Modify:
  - `domain/money.ts:60` (`formatPrice(value, { locale: UiLocale; currency }, options)`), `react-query/useFormatPrice.ts:24-32` (мова — `useUiLocale()`, валюта — `useEngine().config.currency`);
  - `domain/shipping.ts:205` (мова — параметр від викликача; ланцюжок викликів звірити);
  - `mail/render/order.ts:59`;
  - листи: `auth/{reset-mail,verification-mail,invite}.ts`, `storefront/loaders/{order-mail.ts,place-order.ts:52}`, `auth/owner-invite-cli/{run,cli}.ts` — `resolveMailUiLocale` замість `getStoreLocale`, без `'uk'` і позначок `М2а-TEMP`;
  - хардкоди `'uk-UA'`: `storefront-routes/pages/{Profile.tsx:56,ProfileOrders.tsx:68,ProfileOrderDetail.tsx:88,OrderSuccess.tsx:97}`, `admin/features/products/edit/ProductMetaCard.tsx:35,39` → `useFormatDate`;
  - імпортери `useFormatDate` (адмінка, 6 файлів);
  - знос:
    - `site/store-locale.ts`, `site/index.ts:25`, `src/server.ts:16,33` + `template:sync`;
    - `languageOfConfigLocale` (`i18n/translator.ts:14`);
    - поле `locale` конфігу: тип `ConfigProvider`, `src/engine.shared.ts:27`, `simplycms.config.ts` host/шаблону;
    - `VITE_LOCALE` (`src/vite-env.d.ts:9`, `tests/e2e/support/env.ts:27`, `tests/e2e/support/i18n.ts`, `docs/development/ENVIRONMENT.md`).

**Interfaces:**
- Consumes: `resolveUiLocale`, `toUiLocale`, `loadTranslator` (Tasks 2–3), `profiles.ui_locale` (Task 5), `hasLanguagePack` (Task 5б), `loadLocaleSet()` (`storefront/loaders/languages.ts:20`) як джерело основної мови на сервері; у CLI — `readLanguages(db)`.
- Produces:
  - `type MailRecipient =`
    - `| { kind: 'order-customer'; orderLocale: ContentLocale }`
    - `| { kind: 'user'; uiLocale: string | null; locale: ContentLocale | null }`
    - `| { kind: 'store' }`
    - `| { kind: 'invitee' }`
  - `resolveMailUiLocale(r: MailRecipient, primary: ContentLocale): UiLocale` за §19.9:
    - `order-customer` → `resolveUiLocale(orderLocale, primary)`;
    - `user` → `toUiLocale(uiLocale) ?? resolveUiLocale(locale ?? primary, primary)`;
    - `store`, `invitee` → `resolveUiLocale(primary, primary)`.
  - Лист покупцю — `orderLocale` = мова з `requirePublishedTextLocale` чекауту (Д9). Лист магазину — `store`, окремий транслятор. Один `t` на два листи (`order-mail.ts:73`) зноситься.
  - `formatPrice` форматує за `UiLocale`; таблиця `CURRENCY_SYMBOLS` лишається.
  - `useFormatDate(style?: 'medium' | 'short'): (d: Date) => string` з `simplycms/i18n`.

- [ ] **Step 1: Тести.**
  - `locale.test.ts`: кожна гілка `MailRecipient` з основною `uk`:
    - `order-customer` `'en'` → `'en'`, `'pl'` → `'uk'` (замовлення мовою, що втратила пакет — деградований режим §19.15);
    - `user` `{ uiLocale: 'en', locale: null }` → `'en'`, `{ uiLocale: null, locale: null }` → `'uk'`, `{ uiLocale: 'xx', locale: null }` → `'uk'`;
    - `store` → `'uk'`.
  - `format.test.ts`: `formatPrice(1234.5, { locale: en, currency: 'UAH' }, { minimumFractionDigits: 2 })` → `'1,234.50 ₴'`; для `uk` → `` `${new Intl.NumberFormat('uk', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1234.5)} ₴` ``.
  - Листи (наявні `mail/render/__tests__/{auth,order}.test.ts` переписуються): лист магазину на замовлення мовою `en` — український, лист покупцю — англійський. Скидання пароля адміна з `ui_locale = 'en'` (`test:schema`, наявний тест `reset-mail` чи поряд) — англійське.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Реалізація** за Interfaces.
- [ ] **Step 4:** PASS; `git grep -nE "getStoreLocale|declareStoreLocale|languageOfConfigLocale|VITE_LOCALE|'uk-UA'|М2а-TEMP" -- ':!CHANGELOG.md' ':!docs/superpowers'` → порожньо (коментарі з `uk-UA` у `money.ts`/`shipping.ts` переписати); `pnpm vitest run packages/simplycms/src/{mail,auth,storefront,domain,react-query}` → PASS.
- [ ] **Step 5:** Мутація: гілка `user` ігнорує `uiLocale` → `locale.test` і тест скидання пароля червоні. BREAKING: `config.locale`, `VITE_LOCALE`, `formatPrice(value, config)`, `useFormatDate` з `admin/lib`. `pnpm gates` + `pnpm live:smoke`. Commit `feat(i18n): листи мовою одержувача, форматування за мовою інтерфейсу, знос config.locale`.

---

### Task 7: Множина на `Intl.PluralRules`

**Files:**
- Create: `packages/simplycms/src/i18n/plural.ts` + `i18n/__tests__/plural.test.ts`.
- Modify:
  - `i18n/types.ts` (тип значення каталогу, виведення `StringKey`/`PluralKey`), `i18n/{translator.ts,lookup.ts,index.ts}`;
  - `themes/types.ts:141`, `plugin-sdk/types.ts:21`: значення каталогу може бути `PluralForms`;
  - каталоги `uk`/`en`: `cart.itemsOne/itemsFew/itemsMany` → `cart.items`; `reviews.countOne/countFew/countMany` → `reviews.count`; `profile.usedInOrders.one/.many` → `profile.usedInOrders`;
  - `cart-ui/CartDrawer.tsx:32-39,67`, `reviews-ui/ProductReviews.tsx:33-40,88`, `profile-ui/{AddressesList.tsx:180-183,RecipientsList.tsx:218-221}`;
  - `tests/i18n-catalog-parity.test.ts`, `tests/theme-messages-parity.test.ts`, `tests/plugin-messages-parity.test.ts`: категорії множини.

**Interfaces:**
- Produces:
  - `type PluralForms = { readonly other: string } & Partial<Readonly<Record<'zero' | 'one' | 'two' | 'few' | 'many', string>>>`.
  - Значення ключа каталогу — `string | PluralForms`. `StringKey` (приймає `t()`) і `PluralKey` (приймає `plural`) виводяться з `catalogs/uk` умовним типом.
  - `plural(t: PluralTranslator, key: PluralKey, count: number, params?: MessageParams): string` — форма `new Intl.PluralRules(t.locale).select(count)`, немає — `other`; `{count}` підставляється автоматично.
  - Транслятори ядра, теми й плагіна віддають `PluralTranslator` (функція + `locale: UiLocale` + доступ до форм) — ОДИН контракт для трьох рівнів.
- Парність: для кожного пакета/теми/плагіна й кожного значення-`PluralForms` набір ключів форм = `new Intl.PluralRules(code).resolvedOptions().pluralCategories` (рівно).

- [ ] **Step 1: Тести.**
  - `plural.test.ts`: `uk` `cart.items` для 1, 2, 5, 21, 0 → one, few, many, one, many; `en` для 1, 2 → one, other; `{count}` підставлено; транслятор теми з `PluralForms` працює тією ж функцією.
  - Парність: `uk` без `few` у `cart.items` → червоний; `en` з `few` → червоний.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Реалізація** за Interfaces; чотири місця переписати на `plural`, ручні `pluralItemsKey`/`pluralReviewsKey` знести.
- [ ] **Step 4:** PASS; `pnpm vitest run packages/simplycms/src/{i18n,cart-ui,reviews-ui,profile-ui} tests/*parity*` → PASS.
- [ ] **Step 5:** Мутації — два кейси парності зі Step 1 (як мутації каталогу) → червоні → відкат → зелені. BREAKING: форма значення каталогів тем/плагінів (`PluralForms`). `pnpm gates` + `pnpm live:smoke`. Commit `feat(i18n): множина на Intl.PluralRules, форми у значенні ключа`.

---

### Task 8: Закриття блоку — канон, носії, доказ

**Files:**
- Modify:
  - `docs/architecture/i18n.md` — переписати:
    - перший рядок — «власний механізм SimplyCMS, не i18next»;
    - терміни §19.2, міст, частини й реєстр, прогрів, гейти; модель «мова магазину лише з пакетом» і деградований режим (§19.15), джерело пакета — PR;
    - прибрати рядки 44–52, 62–65 і 80–82 (змішування осей, `languageOfConfigLocale`);
  - `docs/architecture/translations.md` (`ContentLocale` у `TextLocale`, рядки ~126–128);
  - `docs/architecture/themes.md` (`useUiLocale`, `PluralForms`, «не i18next»);
  - `packages/simplycms/src/i18n/README.md` (таблиця символів; «`en` частковий» — геть);
  - `packages/README.md:36` (рядок `i18n/`);
  - `AGENTS.md` (розділ i18n, один рядок: «мова контенту (`ContentLocale`) і мова інтерфейсу (`UiLocale`) — різні типи; міст — лише `resolveUiLocale`; мову без пакета не опублікувати (§19.15); i18n = вісь інтерфейсу»);
  - `docs/tasks/{platform-roadmap.md,v2-state-map.md}` (стан), `CHANGELOG.md` `[Unreleased]` (зведення блоку, BREAKING задач 2–7 зібрані).

- [ ] **Step 1:** `pnpm test` (тест `doc-symbols-exist`: нові символи в доках існують, знесені — позначені `(знесено)` або прибрані). `orient --doctor`.
- [ ] **Step 2:** `pnpm gates` + `pnpm live:smoke`. Звіт приймання:
  - таблиця «рядок матриці → тест → мутація → результат» для І41–І46;
  - Review Focus 1–5 цього плану з назвами тестів;
  - виміри gzip «до/після» з Task 3/4;
  - `git grep` порожніх збігів знесених імен.
- [ ] **Step 3:** Commit `docs(i18n): канон двох осей мови, закриття блоку 1 М2`.

**Приймання блоку архітектором** — СТОП.

---

## Review Focus (блок 1 М2)

Сценарій 6 майстра §7 розкладено на тести задач. Плюс п'ять класів входів, яких спека прямо не перелічує:

1. **Мова контенту з регіоном (`en-GB`, `pt-BR`), пакет є лише для базової.** Очікування: інтерфейс базовою мовою (`en`), дані — точною (`en-GB`). Тест — `resolve-ui-locale.test.ts` (Task 2).
2. **Клієнтський перехід між мовами (`/x` → `/en/x`) без перезавантаження сторінки.** Очікування: каталог `en` догружається до рендера, без спалаху сирих ключів і без Suspense-фолбеку. Тест — `no-raw-keys-html.test.tsx`, кейс навігації (Task 4).
3. **Вкладка, відкрита до деплою, просить частину каталогу з новим хешем.** Очікування: невдалий `import()` не кешується, повтор можливий, помилку бачить `installStaleChunkGuard`. Тест — `registry.test.ts` «лоадер, що впав, не кешується» (Task 3).
4. **Адмін вибрав мову, пакет якої прибрали в наступному релізі.** Очікування: адмінка основною мовою, без помилки; селектор показує основну. Тест — `admin-ui-locale.test.tsx`, кейс `'de'` (Task 5).
5. **Замовлення англійською в українському магазині.** Очікування: покупцю — англійський лист і англійський формат цін; магазину — український. Тест — `mail/render/__tests__/order.test.ts` (Task 6).
6. **Власник публікує мову, для якої пакета ще немає (ред. 2).** Очікування: відмова з поясненням у формі (`language_pack_missing` → рядок `admin.validation`), мова лишається чернеткою, переклади даних збережено. Тест — `test:schema` `languages.setStatus` (Task 5б).

Сценарій 6 майстра:
- вітрина `/pl/x` — Task 2 (`content-vs-ui-locale`) і Task 4 (`no-raw-keys-html`, Gate C);
- адмін з `en` — Task 5 (`admin-ui-locale`).

Перемикач мови контенту в картці товару вже покрито М1 і цей блок не змінює.

---

## Підсумок виконання (перенесено з леджера SDD перед його видаленням, 2026-11-05)

Блок прийнято архітектором на `0df37112` (К-3: `pnpm gates` 12/12 + `live:smoke`, тиха машина), влито PR #64 (`071d2a03`). Рішення, яких немає в спеці чи вище в плані:
- **Процес.** Задачу комітять логічними комітами (механічні правки й CHANGELOG окремо); повний `pnpm gates` + `live:smoke` — лише на контрольних точках (К-1, К-2, К-3), на задачу — швидкий ланцюг + цільові гейти. Контрольні точки — на тихій машині: паралельні дерева хвилі на час прогону не запускають ні тестів, ні збірки; у штамп К-3 — `uptime` до й після. Повтор таймауту того самого тесту на тихій машині (load < ~8) — не навантаження, а окремий коміт (явний timeout з причиною або виправлення); загальний `testTimeout` не піднімають. Задачі без перетину зон можна вести паралельно в окремих worktree з переставленням поверх голови (`rebase --onto` старої бази); docs-коміти в гілку хвилі — лише коли голова не зафіксована під ребейз вікна.
- **Тулінг доказів (поза планом, Т2½).** Унікальна БД на кожен прогін `live:smoke`/pilot, скретч pilot на дерево, Mailpit без глобальної чистки, замок `.proof-run.lock` на дерево (`scripts/tree-lock.mjs`; беруть лише вхідні точки `gates`/`release`/`live:smoke`).
- **Архітектура.** Ребро тір-зони `react-query→i18n` свідоме (`useFormatPrice` бере валюту з `useEngine`; перенос у `i18n` дав би залежність основи від надбудови). `PLATFORM_FALLBACK_UI` (`en`) — одна константа для кінцевої ланки адмінки й екрана помилки без мовного контексту; fallback каталогів плагінів і тем в адмінці — основна мова магазину, не мова адміна. Профіль користувача самовідновлюється при вході (`databaseHooks.session.create.after`, та сама провізія, що й при реєстрації; наявні рядки не змінює). Рушій i18n — власний за спайками (§19.2, research 89–93); прогрів перед гідрацією — лише тема (вимір маркером ідентичності SSR-вузлів, Task 4).
- **Беклог хвилі** (`docs/tasks/multilingual-wave-backlog.md`): прогрів теми, можливо, зайвий (трек тем); постачання мовних пакетів ззовні (після rc.1); `doc-symbols-exist` для однослівних символів (тулінг доків).
