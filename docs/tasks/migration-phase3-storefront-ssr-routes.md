# Task: Phase 3 — Міграція Storefront SSR-маршрутів

> Execution note: ця фаза є прямим продовженням Phase 2 і передбачає, що server functions уже існують і використовуються як єдина server-only межа.
> Це кодова фаза. Не відкладати storefront routes до «пізнішого cleanup» і не повертатися до Next.js app-router mental model.
> Clarify-пункти з рекомендацією трактувати як дефолтну реалізацію, якщо інше не доведено технічно.

## Контекст

Після Phase 2 серверні функції (data access, auth, themes) реалізовані через `createServerFn()`. Зараз потрібно створити **TanStack Start file routes** для всіх публічних storefront-сторінок і підключити їх до серверних функцій через route loaders.

### SSR-модель: loader + initialData + hydration

Storefront pages в SimplyCMS — це **ізоморфні React-компоненти** з `useQuery` + `initialData` pattern (не чистий server rendering). SSR для них працює так:

1. **Loader** (на сервері) — викликає server function, отримує серіалізовані дані.
2. **Component** (на сервері) — рендерить theme page з loaderData як props (initialProducts, initialSections тощо). useQuery отримує initialData і рендерить HTML.
3. **Hydration** (на клієнті) — useQuery підхоплює initialData. Далі працює як SPA з refetch за staleTime.

Результат: View Source показує заповнений HTML (SEO), а після hydration сторінка стає інтерактивною.

### Поточний маппінг маршрутів

| Next.js (app/) | TanStack Start (src/routes/) | Опис |
|----------------|------------------------------|------|
| `(storefront)/layout.tsx` | `_storefront.tsx` (layout route) | Обгортка з ThemeLayout |
| `(storefront)/page.tsx` | `_storefront/index.tsx` | Головна сторінка |
| `(storefront)/catalog/page.tsx` | `_storefront/catalog/index.tsx` | Каталог (список секцій) |
| `(storefront)/catalog/[sectionSlug]/page.tsx` | `_storefront/catalog/$sectionSlug/index.tsx` | Секція з товарами |
| `(storefront)/catalog/[sectionSlug]/[productSlug]/page.tsx` | `_storefront/catalog/$sectionSlug/$productSlug.tsx` | Сторінка товару |
| `(storefront)/properties/page.tsx` | `_storefront/properties/index.tsx` | Список всіх властивостей |
| `(storefront)/properties/[propertySlug]/page.tsx` | `_storefront/properties/$propertySlug/index.tsx` | Список опцій властивості |
| `(storefront)/properties/[propertySlug]/[optionSlug]/page.tsx` | `_storefront/properties/$propertySlug/$optionSlug.tsx` | Товари з опцією |
| `(storefront)/order-success/[orderId]/page.tsx` | `_storefront/order-success/$orderId.tsx` | Успішне замовлення |
| `sitemap.ts` | `sitemap[.]xml.tsx` (server handler) | XML sitemap |
| `robots.ts` | `robots[.]txt.tsx` (server handler) | robots.txt |

### SEO-модель в TanStack Start

В Next.js SEO реалізується через `generateMetadata()` і `export const metadata`. В TanStack Start SEO реалізується через **`head` property на route** — функція що повертає масив `meta`, `links`, `scripts` тегів. JSON-LD додається як `<script type="application/ld+json">` в тому ж head.

### Маппінг ThemePages на routes

| Route | ThemePages key | Props interface |
|-------|---------------|-----------------|
| `_storefront/index.tsx` | `HomePage` | `HomePageProps` (banners, featuredProducts, newProducts, sections) |
| `_storefront/catalog/index.tsx` | `CatalogPage` | `CatalogPageProps` (initialSections, initialProducts) |
| `_storefront/catalog/$sectionSlug/index.tsx` | `CatalogSectionPage` | `CatalogSectionPageProps` (sectionSlug, initialSection, initialSections, initialProducts) |
| `_storefront/catalog/$sectionSlug/$productSlug.tsx` | `ProductPage` | `ProductDetailPageProps` (product, sectionSlug) |
| `_storefront/properties/index.tsx` | `PropertiesPage` | `PropertiesPageProps` (properties) |
| `_storefront/properties/$propertySlug/index.tsx` | `PropertyDetailPage` | `PropertyDetailPageProps` (property, options) |
| `_storefront/properties/$propertySlug/$optionSlug.tsx` | `PropertyOptionPage` | `PropertyOptionPageProps` (property, option, products) |
| `_storefront/order-success/$orderId.tsx` | `OrderSuccessPage` | — (без props, client-only) |

## Вимоги

### Phase 3A — Runtime prerequisites

> Ці кроки є prerequisite для всіх storefront routes. Без них theme pages не працюватимуть, бо вони використовують useQuery, useAuth, useCart, useThemeSettings.

- [ ] Створити `src/theme-registry.ts` — ізоморфна реєстрація тем (один файл замість двох: `app/theme-registry.server.ts` + `app/providers.tsx`):
  - ThemeRegistry.register() для default і solarstore
  - Імпортується з `src/routes/__root.tsx` (side-effect import)
  - Імпортується з `src/server/themes.ts` для серверної резолюції (гарантія реєстрації перед load)

- [ ] Підключити CMSProvider в `src/routes/__root.tsx`:
  - CMSProvider (з `@simplycms/core`) обгортає `<Outlet />` — дає QueryClientProvider + AuthProvider + CartProvider
  - CMSProvider вже framework-agnostic: AuthProvider використовує supabase.auth.onAuthStateChange (guard `typeof window`), CartProvider — localStorage (SSR-safe lazy initializer)

- [ ] Підключити CMS ThemeProvider в layout route `_storefront.tsx`:
  - ThemeProvider (з `@simplycms/themes/ThemeContext`) обгортає `<theme.MainLayout><Outlet /></theme.MainLayout>`
  - Приймає `initialThemeName` з loader для пропуску початкового DB fetch на клієнті
  - Дочірні маршрути отримують тему через `useTheme().activeTheme.pages.*`

### Phase 3B — Layout route для storefront

- [ ] Створити layout route `_storefront.tsx` який:
  - В `loader` викликає серверну функцію `getActiveTheme()` (з Phase 2) — повертає `ThemeRecord | null`. Loader витягує `themeName = record?.name ?? 'default'` і `themeSettings = record?.settings`.
  - В `component`:
    1. Викликає `ThemeRegistry.load(themeName)` — ізоморфна операція з кешуванням (ThemeRegistry — singleton). Оскільки `load()` повертає `Promise<ThemeModule>`, використовувати `React.use(ThemeRegistry.load(themeName))` (React 19). На сервері Promise резолвиться з кешу синхронно (теми зареєстровані через side-effect import). На клієнті кеш ThemeRegistry заповнюється при імпорті `src/theme-registry.ts` з `__root.tsx`.
    2. Рендерить `<ThemeProvider initialThemeName={themeName} initialThemeSettings={themeSettings}><theme.MainLayout><Outlet /></theme.MainLayout></ThemeProvider>`
  - **ВАЖЛИВО:** ThemeModule містить React-компоненти і не серіалізується через RPC. Тому loader повертає лише серіалізовані дані (themeName, themeSettings), а ThemeRegistry.load() викликається в component.
  - **Кешування:** getActiveTheme() в `src/server/themes.ts` вже має in-memory cache з TTL 5 хв. При client-side навігації loader спрацьовує повторно, але cache запобігає зайвим DB-запитам.

### Phase 3B — SSR-сторінки з SEO

- [ ] Головна сторінка (`_storefront/index.tsx`):
  - `loader` → серверна функція `getHomePageData()` — один RPC-виклик з `Promise.all` всередині (банери, featured, нові товари, секції)
  - `head` → title "Головна", description "SimplyCMS Store — інтернет-магазин"
  - Component → `theme.pages.HomePage` з loaderData як props: `banners`, `featuredProducts`, `newProducts`, `sections`

- [ ] Каталог (`_storefront/catalog/index.tsx`):
  - `loader` → `getSections()` + `getProducts()` (паралельно)
  - `head` → meta title "Каталог"
  - Component → `theme.pages.CatalogPage` з props: `initialSections`, `initialProducts`

- [ ] Секція каталогу (`_storefront/catalog/$sectionSlug/index.tsx`):
  - `loader` → `getSectionBySlug({ slug: sectionSlug })` → якщо section null → `throw notFound()`. Потім `getProductsBySectionId({ sectionId: section.id })` + `getSections()` (паралельно)
  - `head` → meta title з section.name, description з section.description
  - Component → `theme.pages.CatalogSectionPage` з props: `sectionSlug`, `initialSection`, `initialSections`, `initialProducts`

- [ ] Сторінка товару (`_storefront/catalog/$sectionSlug/$productSlug.tsx`):
  - `loader`:
    1. `getProduct({ slug: productSlug })` → якщо null → `throw notFound()`
    2. **Canonical URL validation:** якщо `product.sections.slug !== sectionSlug` → `throw redirect({ to: '/catalog/$sectionSlug/$productSlug', params: { sectionSlug: product.sections.slug, productSlug }, statusCode: 301 })`. Product slug є UNIQUE в БД — sectionSlug в URL декоративний (breadcrumbs/SEO).
  - `head` → meta з product.name, product.description, openGraph images, **JSON-LD Product** schema через head scripts
  - Component → `theme.pages.ProductPage` з props: `product`, `sectionSlug`

- [ ] Список властивостей (`_storefront/properties/index.tsx`):
  - `loader` → `getProperties()`
  - `head` → title "Характеристики"
  - Component → `theme.pages.PropertiesPage` з props: `properties`

- [ ] Деталі властивості (`_storefront/properties/$propertySlug/index.tsx`):
  - `loader` → `getPropertyBySlug({ slug: propertySlug })` → якщо null → `throw notFound()`
  - `head` → title з property.name
  - Component → `theme.pages.PropertyDetailPage` з props: `property`, `options: property.property_options`

- [ ] Товари за опцією (`_storefront/properties/$propertySlug/$optionSlug.tsx`):
  - `loader` → `getPropertyOption({ propertySlug, optionSlug })` → якщо null → `throw notFound()`
  - `head` → title `${option.name} — ${property.name}`
  - Component → `theme.pages.PropertyOptionPage` з props: `property`, `option`, `products`

### Phase 3B — Додаткові storefront маршрути

- [ ] Order Success (`_storefront/order-success/$orderId.tsx`):
  - **Client-only page** — без серверного data fetching
  - `loader` → не потрібен (або лише валідація формату orderId)
  - `head` → статичний title "Замовлення оформлено"
  - Component → `theme.pages.OrderSuccessPage` (без props — за контрактом `ThemePages` це `React.ComponentType`)
  - Доступ до деталей замовлення — через useAuth (authenticated) або search param `token` (guest) — client-side логіка всередині OrderSuccessPage

> `cart` і `checkout` свідомо **не входять** до цієї фази. Вони переносяться у Phase 4 як client-heavy маршрути разом з auth/profile/admin.

> **NotFoundPage:** ThemePages визначає `NotFoundPage: React.ComponentType` як required page. Обробка 404 для storefront (catch-all `_storefront/$.tsx` route) може бути додана в Phase 3B або відкладена до Phase 5. Coding agent має вирішити на етапі імплементації.

### Phase 3C — Server routes (не HTML) і verification

- [ ] Sitemap (`sitemap[.]xml.tsx`) — server handler що повертає XML з всіх active products і sections через `getSitemapData()`
- [ ] Robots.txt (`robots[.]txt.tsx`) — server handler що повертає robots.txt через `getRobotsData()`
- [ ] Перевірити `pnpm build` без помилок
- [ ] Перевірити View Source — SSR HTML для каталогу/товарів/properties

## Прийняті рішення (з дослідження)

### ✅ Передача теми: React Context (ThemeProvider), не route context

ThemeModule містить React-компоненти (MainLayout, pages) — не серіалізується для route context. Використовуємо існуючий ThemeProvider з `@simplycms/themes/ThemeContext`:
- Layout route loader повертає лише themeName і themeSettings (серіалізовані дані з ThemeRecord).
- Layout route component викликає `React.use(ThemeRegistry.load(themeName))` і рендерить `<ThemeProvider initialThemeName={themeName} initialThemeSettings={themeSettings}>`.
- Дочірні routes отримують тему через `useTheme()`.

### ✅ JSON-LD через head scripts property

JSON-LD для Product schema вставляється через head property route (не dangerouslySetInnerHTML в JSX body). Це чистіший підхід для TanStack Start.

### ✅ Кешування замість ISR: loader staleTime + server in-memory cache

- `getActiveTheme()` вже має in-memory cache з TTL 5 хв в `src/server/themes.ts`.
- Для data routes (products, sections): loader staleTime через TanStack Router для client-side reuse. Серверні функції читають DB напряму (Supabase достатньо швидкий).
- HTTP Cache-Control headers — окрема задача після міграції (CDN-level).

### ✅ Server function contracts: послідовні виклики в loaders

Існуючі серверні функції мають мінімальний API:
- `getSectionBySlug({ slug })` → повертає section без products.
- `getProductsBySectionId({ sectionId })` → потребує section.id.
- Loaders самі композують виклики: спочатку section, потім products за section.id.
- Нових composite server functions не створювати — loader і є місцем для композиції.

### ✅ Product canonical URL: redirect 301 при mismatch

Product slug UNIQUE в БД (constraint). sectionSlug в URL — декоративний. При невідповідності section → redirect 301 на канонічний URL.

### ✅ Order Success: client-only page без серверного loader

ThemePages контракт: `OrderSuccessPage: React.ComponentType` (без props). Сторінка повністю клієнтська — auth/token перевірка і DB query через supabase client на клієнті.

## Антипатерни (уникати)

### ❌ Дублювати data fetching в head і component
Head і component мають спільний loader. Не робити окремий DB-запит в head — використовувати `loaderData` parameter в head function.

### ❌ Робити тему залежною від конкретного route
Тема завантажується один раз в layout route і передається через ThemeProvider. Дочірні маршрути не повинні знати як саме тема резолвиться.

### ❌ Використовувати `dangerouslySetInnerHTML` для JSON-LD
В TanStack Start JSON-LD можна вставити через head scripts property — це чистіший підхід.

### ❌ Створювати route files для admin в цій фазі
Адмін маршрути — Phase 4. Ця фаза лише storefront.

### ❌ Передавати ThemeModule через route context
ThemeModule містить React-компоненти, які не серіалізуються. Route context через loader/beforeLoad серіалізує дані. Використовувати React Context (ThemeProvider).

### ❌ Створювати composite server functions для loader composition
Loaders — це місце для композиції серверних функцій. Не створювати getSectionWithProducts — замість цього викликати getSectionBySlug + getProductsBySectionId послідовно в loader.

### ❌ SSR для Order Success
OrderSuccessPage — client-only за контрактом ThemePages. Доступ до замовлення вимагає auth або guest token. Серверний loader не потрібен.

## Архітектурні рішення

- **В який пакет додавати код:** `src/routes/_storefront/` (site-level routes), `src/theme-registry.ts` (ізоморфна реєстрація)
- **Rendering стратегія:** SSR (loader + initialData + hydration) для каталогу/товарів/properties; client-only для order-success
- **Залежності:** серверні функції з Phase 2, theme system з `@simplycms/themes`, CMSProvider з `@simplycms/core`
- **Міграція з Phase 5:** мінімальний набір prerequisites (providers, theme-registry) виноситься в Phase 3A

## Цільова структура після Phase 3

```
src/
  theme-registry.ts                  # Ізоморфна реєстрація тем (замість app/theme-registry.server.ts + app/providers.tsx)
  routes/
    __root.tsx                       # (оновлений) CMSProvider навколо Outlet
    index.tsx                        # redirect до _storefront/
    sitemap[.]xml.tsx                # XML sitemap server handler
    robots[.]txt.tsx                 # robots.txt server handler
    _storefront.tsx                  # Layout route: getActiveTheme loader, ThemeProvider + MainLayout
    _storefront/
      index.tsx                      # Головна сторінка (SSR)
      catalog/
        index.tsx                    # Каталог (SSR)
        $sectionSlug/
          index.tsx                  # Секція з товарами (SSR)
          $productSlug.tsx           # Сторінка товару (SSR + JSON-LD + canonical redirect)
      properties/
        index.tsx                    # Список властивостей (SSR)
        $propertySlug/
          index.tsx                  # Список опцій (SSR)
          $optionSlug.tsx            # Товари з опцією (SSR)
      order-success/
        $orderId.tsx                 # Успішне замовлення (client-only)
```

## Фазова декомпозиція для coding agent

### Phase 3A — Runtime prerequisites

**Мета:** забезпечити мінімальний runtime для storefront routes.
**Scope:** theme-registry, CMSProvider, ThemeProvider.
**Ризики:** порушення provider tree, supabase client guard на сервері.
**Checklist:**
- [ ] `src/theme-registry.ts` створено, імпортується з __root.tsx
- [ ] CMSProvider обгортає Outlet в __root.tsx
- [ ] `pnpm dev` — root route працює без помилок

**DoD Phase 3A:** `pnpm dev` стартує, providers підключені, ThemeRegistry має зареєстровані теми.

### Phase 3B — SSR storefront routes

**Мета:** створити всі storefront file routes з loaders, head, components.
**Scope:** layout route, всі сторінки з таблиці маппінгу.
**Ризики:** mismatch props → theme pages, canonical redirect logic, notFound handling.
**Checklist:**
- [ ] `_storefront.tsx` layout route (getActiveTheme + ThemeProvider + MainLayout)
- [ ] `_storefront/index.tsx` (HomePage)
- [ ] `_storefront/catalog/index.tsx` (CatalogPage)
- [ ] `_storefront/catalog/$sectionSlug/index.tsx` (CatalogSectionPage)
- [ ] `_storefront/catalog/$sectionSlug/$productSlug.tsx` (ProductPage + JSON-LD + canonical redirect)
- [ ] `_storefront/properties/index.tsx` (PropertiesPage)
- [ ] `_storefront/properties/$propertySlug/index.tsx` (PropertyDetailPage)
- [ ] `_storefront/properties/$propertySlug/$optionSlug.tsx` (PropertyOptionPage)
- [ ] `_storefront/order-success/$orderId.tsx` (OrderSuccessPage — client-only)

**DoD Phase 3B:** всі storefront URLs працюють через TanStack Start, дані з loaders відображаються в theme pages.

### Phase 3C — SEO, server handlers і verification

**Мета:** довести sitemap, robots, JSON-LD і перевірити SSR.
**Scope:** server handlers, meta/head, build verification.
**Ризики:** неправильний content-type, битий site URL, дублюючі meta.
**Checklist:**
- [ ] `sitemap[.]xml.tsx` server handler
- [ ] `robots[.]txt.tsx` server handler
- [ ] Product JSON-LD в head scripts
- [ ] `pnpm build` проходить без помилок
- [ ] View Source показує SSR HTML для каталогу/товарів

**DoD Phase 3C:** SEO-слой і non-HTML routes працюють. Build проходить.

## MCP Servers (за потреби)

- **context7** — TanStack Start `createFileRoute`, `head` property, route loader API, server handlers, `throw redirect()`, `throw notFound()`
- **context7** — перевірити як додавати JSON-LD scripts в head property
- **context7** — TanStack Router layout routes, Outlet, ізоморфний rendering

## Пов'язана документація

- `docs/tasks/migration-phase2-server-functions.md` — попередня фаза (серверні функції)
- `docs/tasks/migration-phase5-auth-middleware-theme-system.md` — Phase 5 (фінальна theme/provider стабілізація)
- `app/(storefront)/page.tsx` — поточна головна сторінка (шаблон data fetching)
- `app/(storefront)/catalog/[sectionSlug]/[productSlug]/page.tsx` — поточна сторінка товару (шаблон SSR + SEO + JSON-LD)
- `app/(storefront)/layout.tsx` — поточний layout з theme resolution
- `app/sitemap.ts` — поточний sitemap
- `app/robots.ts` — поточний robots.txt
- `packages/simplycms/theme-system/src/types.ts` — ThemePages contract (канонічні назви pages)
- `packages/simplycms/core/src/pages/` — core page components з props interfaces
- `src/server/themes.ts` — серверна функція getActiveTheme (in-memory cache)
- `src/server/products.ts` — getProduct, getProducts, getProductsBySectionId
- `src/server/sections.ts` — getSections, getSectionBySlug, getRootSections
- `src/server/properties.ts` — getProperties, getPropertyBySlug, getPropertyOption
- `src/server/home.ts` — getHomePageData
- `src/server/sitemap.ts` — getSitemapData, getRobotsData
- `.github/instructions/architecture-core.instructions.md` — rendering стратегії

## Definition of Done

- [ ] **Phase 3A:** CMSProvider і ThemeRegistry підключені в __root.tsx
- [ ] **Phase 3B:** Всі storefront маршрути з таблиці маппінгу створені як TanStack Start file routes
- [ ] **Phase 3B:** Кожен SSR-маршрут має loader (серверна функція), head (SEO meta), component (theme page з props)
- [ ] **Phase 3B:** Сторінка товару має canonical URL validation (redirect 301 при mismatch sectionSlug)
- [ ] **Phase 3B:** Сторінка товару має JSON-LD Product schema в head
- [ ] **Phase 3B:** Order Success — client-only page без серверного loader
- [ ] **Phase 3B:** Тема завантажується в layout route через ThemeRegistry.load() і передається через ThemeProvider
- [ ] **Phase 3C:** Sitemap генерується як XML по URL `/sitemap.xml`
- [ ] **Phase 3C:** Robots.txt генерується по URL `/robots.txt`
- [ ] **Phase 3C:** `pnpm dev` — всі storefront сторінки відображаються з правильними даними
- [ ] **Phase 3C:** `pnpm build` проходить без помилок
- [ ] **Phase 3C:** View Source в браузері показує SSR HTML (initialData від loaders) для каталогу/товарів
