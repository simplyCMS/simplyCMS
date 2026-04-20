# Task: Phase 3 — Міграція Storefront SSR-маршрутів

## Контекст

Після Phase 2 серверні функції (data access, auth, themes) реалізовані через `createServerFn()`. Зараз потрібно створити **TanStack Start file routes** для всіх публічних storefront-сторінок і підключити їх до серверних функцій через route loaders.

### Поточний маппінг маршрутів

| Next.js (app/) | TanStack Start (src/routes/) | Опис |
|----------------|------------------------------|------|
| `(storefront)/layout.tsx` | `_storefront.tsx` (layout route) | Обгортка з ThemeLayout |
| `(storefront)/page.tsx` | `_storefront/index.tsx` | Головна сторінка |
| `(storefront)/catalog/page.tsx` | `_storefront/catalog/index.tsx` | Каталог (список секцій) |
| `(storefront)/catalog/[sectionSlug]/page.tsx` | `_storefront/catalog/$sectionSlug/index.tsx` | Секція з товарами |
| `(storefront)/catalog/[sectionSlug]/[productSlug]/page.tsx` | `_storefront/catalog/$sectionSlug/$productSlug.tsx` | Сторінка товару |
| `(storefront)/properties/[propertySlug]/page.tsx` | `_storefront/properties/$propertySlug/index.tsx` | Список опцій властивості |
| `(storefront)/properties/[propertySlug]/[optionSlug]/page.tsx` | `_storefront/properties/$propertySlug/$optionSlug.tsx` | Товари з опцією |
| `(storefront)/properties/page.tsx` | `_storefront/properties/index.tsx` | Список всіх властивостей |
| `(storefront)/cart/page.tsx` | `_storefront/cart.tsx` | Кошик |
| `(storefront)/checkout/page.tsx` | `_storefront/checkout.tsx` | Оформлення замовлення |
| `(storefront)/order-success/[orderId]/page.tsx` | `_storefront/order-success/$orderId.tsx` | Успішне замовлення |
| `sitemap.ts` | `sitemap[.]xml.tsx` (server handler) | XML sitemap |
| `robots.ts` | `robots[.]txt.tsx` (server handler) | robots.txt |

### SEO-модель в TanStack Start

В Next.js SEO реалізується через `generateMetadata()` і `export const metadata`. В TanStack Start SEO реалізується через **`head` property на route** — функція що повертає масив `meta`, `links`, `scripts` тегів. JSON-LD додається як `<script type="application/ld+json">` в тому ж head.

## Вимоги

### Layout route для storefront

- [ ] Створити layout route `_storefront.tsx` який:
  - В `loader` викликає серверну функцію `getActiveTheme()` (з Phase 2)
  - Рендерить `theme.MainLayout` навколо `<Outlet />`
  - Передає theme дані дочірнім маршрутам через route context або props
  - **ВАЖЛИВО:** при client-side навігації між storefront-маршрутами loader layout route спрацьовує повторно. Потрібно кешувати theme на рівні routeContext (не перезавантажувати) або використовувати `staleTime` / `gcTime` на loader щоб уникнути зайвих DB-запитів

### SSR-сторінки з SEO

- [ ] Головна сторінка (`_storefront/index.tsx`):
  - `loader` → серверна функція `getHomePageData()` — один RPC-виклик з `Promise.all` всередині (банери, featured, нові товари, секції)
  - `head` → title "Головна", description "SimplyCMS Store — інтернет-магазин"
  - Component → `theme.pages.HomePage` з даними з loader

- [ ] Каталог (`_storefront/catalog/index.tsx`):
  - `loader` → серверна функція для отримання кореневих секцій
  - `head` → meta title/description для каталогу
  - Component → `theme.pages.CatalogPage`

- [ ] Секція каталогу (`_storefront/catalog/$sectionSlug/index.tsx`):
  - `loader` → серверна функція `getSectionBySlug(sectionSlug)` з товарами
  - `head` → meta з назви секції і description
  - Component → `theme.pages.CatalogSectionPage`

- [ ] Сторінка товару (`_storefront/catalog/$sectionSlug/$productSlug.tsx`):
  - `loader` → серверна функція `getProduct(productSlug)` з повними даними (modifications, prices, property_values)
  - `head` → meta з product.name, product.description, openGraph images, **JSON-LD Product** schema
  - notFound() якщо товар не знайдено
  - Component → `theme.pages.ProductPage`

- [ ] Properties routes (`properties/index.tsx`, `$propertySlug/index.tsx`, `$propertySlug/$optionSlug.tsx`):
  - `loader` → серверні функції для properties
  - `head` → meta на основі property/option назв
  - Component → `theme.pages.PropertyPage` / `theme.pages.PropertyOptionPage`

### Client-rendered сторінки (в storefront layout)

- [ ] Кошик (`_storefront/cart.tsx`):
  - `ssr: false` або мінімальний loader
  - Component → `theme.pages.CartPage` або `@simplycms/core` CartPage

- [ ] Checkout (`_storefront/checkout.tsx`):
  - `ssr: false` або мінімальний loader
  - Component → `theme.pages.CheckoutPage` або `@simplycms/core` CheckoutPage

- [ ] Order Success (`_storefront/order-success/$orderId.tsx`):
  - Мінімальний loader з orderId validation
  - Component → `theme.pages.OrderSuccessPage`

### Server routes (не HTML)

- [ ] Sitemap (`sitemap[.]xml.tsx`) — server handler що повертає XML з всіх active products і sections
- [ ] Robots.txt (`robots[.]txt.tsx`) — server handler що повертає robots.txt

## Clarify (питання перед імплементацією)

- [ ] Як передати theme з layout route в дочірні маршрути?
  - Чому це важливо: layout route `_storefront.tsx` завантажує тему, дочірні маршрути рендерять через `theme.pages.*`. Потрібен механізм передачі.
  - Варіант A: TanStack Router `routeContext` — кожен layout може додати дані в context, доступний дочірнім через `useRouteContext()` (рекомендовано)
  - Варіант B: React Context з ThemeProvider
  - Варіант C: Кожен дочірній маршрут окремо викликає `getActiveTheme()` (дублювання)
  - Вплив: архітектура, DRY, кількість DB-запитів

- [ ] Як обробляти JSON-LD в head?
  - Чому це важливо: JSON-LD для Product schema зараз вставляється як `<script dangerouslySetInnerHTML>` в JSX. В TanStack Start головний спосіб — через head.scripts
  - Варіант A: Включити JSON-LD як script tag в head property route (рекомендовано)
  - Варіант B: Залишити в JSX body як `<script>` (менш семантично)
  - Вплив: SEO, структура коду

- [ ] Що робити з `export const revalidate = 3600`?
  - Чому це важливо: Next.js ISR з фіксованим часом revalidation. TanStack Start не має вбудованого ISR
  - Варіант A: Не кешувати SSR — кожен запит робить свіжий DB-запит. Supabase достатньо швидкий для простого CMS
  - Варіант B: HTTP Cache-Control headers (`s-maxage=3600, stale-while-revalidate`) на CDN рівні
  - Варіант C: Серверний in-memory cache з TTL в серверних функціях (Phase 2)
  - Вплив: продуктивність, складність, DevOps

## Рекомендовані патерни

### Route з loader і head

Кожен SSR-маршрут має три частини: `loader` (data fetching через createServerFn), `head` (SEO meta з даних loader), `component` (UI через theme pages). Loader повертає всі дані одним обʼєктом. Head отримує доступ до loader data через `loaderData` parameter.

- Де шукати поточну логіку: `app/(storefront)/catalog/[sectionSlug]/[productSlug]/page.tsx` — найповніший приклад (generateMetadata + Server Component + JSON-LD)
- Що перенести: data fetching → loader → server function, generateMetadata → head property, JSX → component

### Layout route для theme wrapping

`_storefront.tsx` (з underscore prefix) — це layout route. Він не відповідає URL segment, але обгортає всі дочірні маршрути. В loader — завантажити тему. В component — `<ThemeLayout><Outlet /></ThemeLayout>`.

### Sitemap як server handler

Файл `sitemap[.]xml.tsx` використовує `server.handlers` property на route для повернення Response з XML content-type. Серверна функція `getSitemapData()` повертає масив URL.

- Де шукати поточну логіку: `app/sitemap.ts`

## Антипатерни (уникати)

### ❌ Дублювати data fetching в head і component
Head і component мають спільний loader. Не робити окремий DB-запит в head — використовувати `loaderData` parameter в head function.

### ❌ Робити тему залежною від конкретного route
Тема завантажується один раз в layout route і передається через context. Дочірні маршрути не повинні знати як саме тема резолвиться.

### ❌ Використовувати `dangerouslySetInnerHTML` для JSON-LD
В TanStack Start JSON-LD можна вставити через head scripts property — це чистіший підхід.

### ❌ Створювати route files для admin в цій фазі
Адмін маршрути — Phase 4. Ця фаза лише storefront.

## Архітектурні рішення

- **В який пакет додавати код:** `src/routes/_storefront/` (site-level routes)
- **Rendering стратегія:** SSR для каталогу/товарів/properties, client-only для cart/checkout
- **Залежності:** серверні функції з Phase 2, theme system з `@simplycms/themes`

## Цільова структура після Phase 3

```
src/routes/
  __root.tsx                         # (з Phase 1)
  index.tsx                          # redirect до _storefront/
  sitemap[.]xml.tsx                  # XML sitemap server handler
  robots[.]txt.tsx                   # robots.txt server handler
  _storefront.tsx                    # Layout route: theme loading, MainLayout
  _storefront/
    index.tsx                        # Головна сторінка
    catalog/
      index.tsx                      # Каталог (секції)
      $sectionSlug/
        index.tsx                    # Секція з товарами
        $productSlug.tsx             # Сторінка товару (SSR + JSON-LD)
    properties/
      index.tsx                    # Список властивостей
      $propertySlug/
        index.tsx                    # Список опцій
        $optionSlug.tsx              # Товари з опцією
    cart.tsx                         # Кошик (client-only)
    checkout.tsx                     # Checkout (client-only)
    order-success/
      $orderId.tsx                   # Успішне замовлення
```

## MCP Servers (за потреби)

- **context7** — TanStack Start `createFileRoute`, `head` property, route loader API, `routeContext`, server handlers
- **context7** — перевірити як додавати JSON-LD scripts в head property

## Пов'язана документація

- `docs/tasks/migration-phase2-server-functions.md` — попередня фаза (серверні функції)
- `app/(storefront)/page.tsx` — поточна головна сторінка (шаблон data fetching)
- `app/(storefront)/catalog/[sectionSlug]/[productSlug]/page.tsx` — поточна сторінка товару (шаблон SSR + SEO + JSON-LD)
- `app/(storefront)/layout.tsx` — поточний layout з theme resolution
- `app/sitemap.ts` — поточний sitemap
- `app/robots.ts` — поточний robots.txt
- `.github/instructions/architecture-core.instructions.md` — rendering стратегії

## Definition of Done

- [ ] Всі storefront маршрути з таблиці маппінгу створені як TanStack Start file routes
- [ ] Кожен SSR-маршрут має loader (серверна функція), head (SEO meta), component (theme page)
- [ ] Сторінка товару має JSON-LD Product schema в head
- [ ] Sitemap генерується як XML по URL `/sitemap.xml`
- [ ] Robots.txt генерується по URL `/robots.txt`
- [ ] Тема завантажується один раз в layout route і передається через context
- [ ] Cart і Checkout працюють як client-only routes
- [ ] `pnpm dev` — всі storefront сторінки відображаються з правильними даними
- [ ] `pnpm build` проходить без помилок
- [ ] View Source в браузері показує SSR HTML для каталогу/товарів
