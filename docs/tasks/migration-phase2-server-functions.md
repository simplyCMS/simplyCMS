# Task: Phase 2 — Серверний data-access шар через createServerFn

## Контекст

Після Phase 1 TanStack Start працює як runtime, адаптери перемкнуті на TanStack Router, але серверний доступ до даних ще не адаптований. Зараз серверна логіка залишилась у файлах, що прив'язані до Next.js server API:

- **`packages/simplycms/core/src/supabase/server.ts`** — використовує `cookies()` з `next/headers` для створення серверного Supabase клієнта
- **`packages/simplycms/core/src/supabase/proxy.ts`** — використовує `NextResponse`, `NextRequest` з `next/server` для auth guards
- **`packages/simplycms/theme-system/src/getActiveThemeSSR.ts`** — використовує `unstable_cache` з `next/cache` для кешування активної теми
- **`app/api/revalidate/route.ts`** — використовує `revalidatePath`, `revalidateTag` з `next/cache`

В TanStack Start **серверна логіка ізолюється через `createServerFn()`**. Це RPC-style функції, які гарантовано виконуються лише на сервері. Вони викликаються з loaders, beforeLoad або компонентів, а framework автоматично створює API endpoint.

Ця фаза створює **повний серверний data-access шар** на базі `createServerFn`, який замінить усі Next.js серверні механізми.

## Вимоги

- [ ] Створити директорію `src/server/` для серверних функцій
- [ ] Реалізувати серверний Supabase клієнт через `createServerFn` — замість `cookies()` з next/headers використовувати `getHeaders()` / `getCookie()` з TanStack Start server context
- [ ] Реалізувати серверні функції для отримання даних storefront:
  - Отримання товару по slug (для сторінки товару)
  - Отримання секції з товарами (для сторінки категорії)
  - Отримання списку секцій і товарів (для каталогу)
  - Отримання даних головної сторінки (банери, featured, нові товари, секції)
  - Отримання даних properties / property options
- [ ] Реалізувати серверну функцію для перевірки auth сесії — аналог поточного proxy.ts
- [ ] Реалізувати серверну функцію для перевірки admin ролі
- [ ] Реалізувати серверну функцію для sitemap data
- [ ] Реалізувати серверну функцію для robots.txt
- [ ] Реалізувати механізм cache invalidation через server route замість `revalidatePath`/`revalidateTag`
- [ ] Видалити або позначити як deprecated: `packages/simplycms/core/src/supabase/server.ts`, `packages/simplycms/core/src/supabase/proxy.ts`
- [ ] Клієнтський Supabase (`supabase/client.ts`) залишити без змін — він framework-agnostic

## Clarify (питання перед імплементацією)

- [ ] Як передавати cookies до Supabase server client у TanStack Start?
  - Чому це важливо: `@supabase/ssr` createServerClient потребує доступу до cookies для auth сесії
  - Варіант A: `getHeaders()` з `@tanstack/react-start` — отримати Cookie header і парсити вручну (рекомендовано, native API)
  - Варіант B: Використовувати `vinxi` (underlying server) getCookie API
  - Вплив: серверна автентифікація, session refresh

- [ ] Який механізм кешування замість unstable_cache?
  - Чому це важливо: `getActiveThemeSSR` зараз кешується через `unstable_cache` (cross-request cache з revalidation). TanStack Start не має вбудованого аналога
  - Варіант A: Module-level in-memory cache з TTL (простий Map + setTimeout) (рекомендовано для початку)
  - Варіант B: React `cache()` для per-request deduplication + in-memory для cross-request
  - Варіант C: Зовнішній cache (Redis/Upstash) — overkill для одного запису
  - Вплив: продуктивність, складність

- [ ] Як замінити revalidatePath / revalidateTag?
  - Чому це важливо: адмінка після збереження товару/секції/теми викликає `/api/revalidate` для оновлення ISR-кешованих сторінок
  - Варіант A: In-memory cache з manual invalidation endpoint (серверна функція + вбудований cache store)
  - Варіант B: Без cross-request cache — кожен SSR request завжди робить свіжий DB запит. Для 99% CMS це достатньо швидко
  - Варіант C: TanStack Start ISR якщо підтримується
  - Вплив: продуктивність, складність, архітектура кешування

## Рекомендовані патерни

### Організація серверних функцій

Групувати по доменах: `src/server/products.ts`, `src/server/sections.ts`, `src/server/auth.ts`, `src/server/themes.ts`, `src/server/sitemap.ts`. Кожен файл експортує `createServerFn` функції.

- Де шукати поточну серверну логіку: `app/(storefront)/*.tsx` (inline в Server Components), `app/api/revalidate/route.ts`, `proxy.ts`

### Supabase server client factory

Створити одну utility `createServerSupabase()` всередині `src/server/supabase.ts`, яка використовує `getHeaders()` для отримання cookies і створює authenticated Supabase client. Всі серверні функції використовують цю factory.

- Де шукати поточну реалізацію: `packages/simplycms/core/src/supabase/server.ts`
- Що змінюється: `cookies()` з next/headers → `getHeaders()` / cookie parsing з TanStack Start

### Input validation в серверних функціях

Використовувати `.inputValidator()` chain на `createServerFn` для валідації вхідних параметрів (slug, id). Це дає type-safety і runtime validation.

### Loaders як точки виклику

Серверні функції викликаються з route `loader` — це гарантує що дані завантажені до рендеру. Loader виконується і на сервері (SSR), і на клієнті (client-side navigation), але `createServerFn` автоматично стає RPC-викликом на клієнті.

## Антипатерни (уникати)

### ❌ DB-виклики напряму в route components
В TanStack Start route components isomorphic — вони можуть виконуватися на клієнті. Прямий `supabase.from('products').select()` в компоненті витече в клієнтський bundle. Завжди через `createServerFn()`.

### ❌ Використовувати process.env в route modules без createServerFn
`process.env.SUPABASE_*` доступні лише на сервері. Якщо route module виконується на клієнті, вони будуть undefined. Лише `NEXT_PUBLIC_*` (або `VITE_*`) доступні на клієнті.

### ❌ Створювати Supabase client всередині кожного createServerFn
Factory має бути одна — `createServerSupabase()`. Серверні функції імпортують і викликають її. Не дублювати логіку cookies/headers в кожній функції.

### ❌ Зберігати серверні функції в packages/simplycms/
Серверні функції TanStack Start мають жити в `src/server/` — це site-level код, не core-level. Core має залишатися framework-agnostic (hooks, types, utils, UI components).

## Архітектурні рішення

- **В який пакет додавати код:** `src/server/` (site-level, не в packages)
- **Rendering стратегія:** SSR (серверні функції виконуються на сервері під час SSR, стають RPC при client-side navigation)
- **Залежності:** `@tanstack/react-start` (вже встановлено в Phase 1)
- **Що видаляється:** `packages/simplycms/core/src/supabase/server.ts` (замінюється), `packages/simplycms/core/src/supabase/proxy.ts` (замінюється)

## Цільова структура після Phase 2

```
src/
  server/
    supabase.ts           # createServerSupabase() factory
    products.ts           # getProduct, getProducts, getProductsBySectionSlug
    sections.ts           # getSections, getSectionBySlug
    home.ts               # getHomePageData (banners, featured, new products)
    properties.ts         # getProperties, getPropertyBySlug, getPropertyOption
    auth.ts               # getSession, getUser, isAdmin
    themes.ts             # getActiveTheme (серверна резолюція)
    sitemap.ts            # getSitemapData
    revalidation.ts       # invalidateCache (manual cache control)
```

## MCP Servers (за потреби)

- **context7** — TanStack Start `createServerFn` API, input validators, server context (getHeaders, getCookie)
- **supabase** — перевірити що `@supabase/ssr` createServerClient працює без Next.js cookie API

## Пов'язана документація

- `docs/tasks/migration-phase1-tanstack-start-bootstrap.md` — попередня фаза (prerequisite)
- `.github/instructions/data-access.instructions.md` — поточні data access патерни (для розуміння що замінюється)
- `packages/simplycms/core/src/supabase/server.ts` — поточний серверний клієнт
- `packages/simplycms/core/src/supabase/proxy.ts` — поточний auth proxy
- `app/api/revalidate/route.ts` — поточний revalidation endpoint
- `app/(storefront)/page.tsx` — приклад серверного data fetching в Next.js (для розуміння що треба перенести)
- `app/(storefront)/catalog/[sectionSlug]/[productSlug]/page.tsx` — найскладніший SSR-маршрут з metadata і JSON-LD

## Definition of Done

- [ ] `src/server/supabase.ts` існує з `createServerSupabase()` на базі TanStack Start server context
- [ ] Серверні функції для products, sections, home, properties, auth, themes, sitemap існують і експортуються
- [ ] Кожна серверна функція використовує `createServerFn()` з `@tanstack/react-start`
- [ ] Серверні функції мають input validation де потрібно (slugs, ids)
- [ ] Жоден серверний файл не імпортує з `next/*`
- [ ] `pnpm typecheck` проходить
- [ ] Серверні функції можна імпортувати і викликати з route loaders (перевірити на placeholder route)
