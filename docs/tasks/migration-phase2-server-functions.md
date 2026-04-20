# Task: Phase 2 — Server-only data-access шар через createServerFn

## Контекст

Після Phase 1 TanStack Start працює як єдиний runtime, а `next/*` примітиви вже переписані напряму. Тепер потрібно повністю винести server-only логіку з package-level Next.js файлів у site-level шар `src/server/`.

Зараз серверна логіка залишилась у файлах, що прив'язані до Next.js server API:

- **`packages/simplycms/core/src/supabase/server.ts`** — використовує `cookies()` з `next/headers` для створення серверного Supabase клієнта
- **`packages/simplycms/core/src/supabase/proxy.ts`** — використовує `NextResponse`, `NextRequest` з `next/server` для auth guards
- **`packages/simplycms/theme-system/src/getActiveThemeSSR.ts`** — використовує `unstable_cache` з `next/cache` для кешування активної теми
- **`app/api/revalidate/route.ts`** — використовує `revalidatePath`, `revalidateTag` з `next/cache`

В TanStack Start **серверна логіка ізолюється через `createServerFn()`**. Це RPC-style функції, які гарантовано виконуються лише на сервері. Вони викликаються з loaders, beforeLoad або компонентів, а framework автоматично створює API endpoint.

Ця фаза створює **повний server-only data-access шар** на базі `createServerFn`, який замінить усі Next.js серверні механізми і стане єдиною точкою доступу до cookies, session, auth та server-side DB читання.

## Вимоги

- [ ] Створити директорію `src/server/` для серверних функцій
- [ ] Реалізувати `src/server/supabase.ts` з єдиною factory `createServerSupabase()`
  - **Читання cookies:** через `getRequestHeader('cookie')` + `parseCookieHeader()` з `@supabase/ssr`
  - **Запис cookies:** через `setCookie()` з `@tanstack/react-start/server`
  - **ВАЖЛИВО:** `@supabase/ssr` потребує і читання, і запису cookies для session refresh / token rotation
- [ ] Реалізувати серверні функції для отримання даних storefront:
  - Отримання товару по slug (для сторінки товару)
  - Отримання секції з товарами (для сторінки категорії)
  - Отримання списку секцій і товарів (для каталогу)
  - Отримання даних головної сторінки (банери, featured, нові товари, секції)
  - Отримання даних properties / property options
- [ ] Реалізувати серверні функції для auth:
  - `getSession()`
  - `getUser()`
  - `isAdmin()`
- [ ] Реалізувати серверну функцію для sitemap data
- [ ] Реалізувати серверну функцію для robots.txt
- [ ] Відмовитися від generic ISR/revalidation механіки для storefront: SSR-дані за замовчуванням читаються напряму з БД, без `revalidatePath`/`revalidateTag`
- [ ] Видалити або позначити як deprecated: `packages/simplycms/core/src/supabase/server.ts`, `packages/simplycms/core/src/supabase/proxy.ts`, `app/api/revalidate/route.ts`
- [ ] Клієнтський Supabase (`supabase/client.ts`) залишити без змін — він framework-agnostic

> **Примітка:** `guest-order` API route (`app/api/guest-order/route.ts`) теж використовує `createServerSupabaseClient()`. Його міграція виконується в Phase 4 (як `createServerFn` або server handler), але після Phase 2 він зможе використовувати `createServerSupabase()` з `src/server/supabase.ts`.

## Clarify (питання перед імплементацією)

- [ ] Який API використовувати для cookies у Supabase factory?
  - Чому це важливо: `@supabase/ssr` очікує `getAll` / `setAll`, а TanStack Start працює з request headers і `setCookie()`
  - Рекомендація: `getRequestHeader('cookie')` + `parseCookieHeader()` для read, `setCookie()` для write
  - Альтернатива: низькорівневий `vinxi/http`, якщо виникне прогалина в `@tanstack/react-start/server`
  - Вплив: auth session refresh, token rotation

- [ ] Який механізм кешування замість unstable_cache?
  - Чому це важливо: `getActiveThemeSSR` зараз кешується через `unstable_cache` (cross-request cache з revalidation). TanStack Start не має вбудованого аналога
  - Варіант A: Module-level in-memory cache з TTL (простий Map + setTimeout) (рекомендовано для початку)
  - Варіант B: ~~React `cache()` для per-request deduplication + in-memory для cross-request~~ — **неможливо:** `React.cache()` є RSC-only API, не працює в TanStack Start (ізоморфна модель без Server Components). Per-request dedup непотрібен, бо loader виконується один раз на запит
  - Варіант C: Зовнішній cache (Redis/Upstash) — overkill для одного запису
  - Вплив: продуктивність, складність

- [ ] Чи потрібен окремий revalidation endpoint?
  - Чому це важливо: у Next.js це було потрібно через ISR; у TanStack Start storefront може працювати на свіжому SSR без cross-request cache
  - Рекомендація: ні для загального storefront data layer; окрема інвалідація потрібна лише для theme cache у Phase 5 або для зовнішніх webhook-інтеграцій
  - Вплив: спрощення архітектури, менше технічного боргу

## Рекомендовані патерни

### Організація серверних функцій

Групувати по доменах: `src/server/products.ts`, `src/server/sections.ts`, `src/server/auth.ts`, `src/server/themes.ts`, `src/server/sitemap.ts`. Кожен файл експортує `createServerFn` функції.

- Де шукати поточну серверну логіку: `app/(storefront)/*.tsx` (inline в Server Components), `app/api/revalidate/route.ts`, `proxy.ts`

### Supabase server client factory

Створити одну utility `createServerSupabase()` всередині `src/server/supabase.ts`, яка:

- читає raw cookie header через TanStack Start server API;
- перетворює його у `getAll()` сумісний формат для `@supabase/ssr`;
- записує cookies назад через `setCookie()`;
- використовується усіма server functions і server handlers.

Без cookie write-back auth session refresh працювати не буде.

### Home page data — один createServerFn з Promise.all

Поточна `app/(storefront)/page.tsx` робить 4 паралельні Supabase-запити (банери, featured, new products, секції). Серверна функція `getHomePageData()` має обгорнути всі 4 запити в один `createServerFn` з `Promise.all` всередині — це один RPC-виклик з клієнта замість 4-х окремих.

- Де шукати поточну логіку: `app/(storefront)/page.tsx`

### Input validation в серверних функціях

Використовувати `.inputValidator()` chain на `createServerFn` для валідації вхідних параметрів (slug, id). Це дає type-safety і runtime validation.

### Loaders як точки виклику

Серверні функції викликаються з route `loader` — це гарантує що дані завантажені до рендеру. Loader виконується і на сервері (SSR), і на клієнті (client-side navigation), але `createServerFn` автоматично стає RPC-викликом на клієнті.

### Межа з Phase 5

У цій фазі достатньо створити `src/server/themes.ts` як server-facing API для тем. Фінальна cache-стратегія і root-level інтеграція providers/theme registry завершуються в Phase 5.

## Антипатерни (уникати)

### ❌ DB-виклики напряму в route components
В TanStack Start route components isomorphic — вони можуть виконуватися на клієнті. Прямий `supabase.from('products').select()` в компоненті витече в клієнтський bundle. Завжди через `createServerFn()`.

### ❌ Використовувати `process.env` в route modules без createServerFn
`process.env.SUPABASE_*` доступні лише на сервері. Якщо route module виконується на клієнті, вони будуть undefined. Після Phase 1 у клієнтському коді мають залишитися лише `import.meta.env.VITE_*` змінні.

### ❌ Створювати Supabase client всередині кожного `createServerFn`
Factory має бути одна — `createServerSupabase()`. Серверні функції імпортують і викликають її. Не дублювати логіку cookies/headers в кожній функції.

### ❌ Реалізувати тільки читання cookies без write-back
Такий підхід дає приховану регресію: базова auth-перевірка може працювати, але session refresh і token rotation зламаються.

### ❌ Зберігати серверні функції в packages/simplycms/
Серверні функції TanStack Start мають жити в `src/server/` — це site-level код, не core-level. Core має залишатися framework-agnostic (hooks, types, utils, UI components).

## Архітектурні рішення

- **В який пакет додавати код:** `src/server/` (site-level, не в packages)
- **Rendering стратегія:** SSR (серверні функції виконуються на сервері під час SSR, стають RPC при client-side navigation)
- **Залежності:** `@tanstack/react-start` (вже встановлено в Phase 1)
- **Що видаляється:** `packages/simplycms/core/src/supabase/server.ts`, `packages/simplycms/core/src/supabase/proxy.ts`, generic Next.js revalidation endpoint

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
    revalidation.ts       # за потреби: тільки для зовнішніх webhook / cache hooks
```

## MCP Servers (за потреби)

- **context7** — TanStack Start `createServerFn` API, input validators, server context (`getRequestHeader`, `setCookie`)
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
- [ ] `createServerSupabase()` підтримує і читання, і запис cookies для `@supabase/ssr`
- [ ] Серверні функції для products, sections, home, properties, auth, themes, sitemap існують і експортуються
- [ ] Кожна серверна функція використовує `createServerFn()` з `@tanstack/react-start`
- [ ] Серверні функції мають input validation де потрібно (slugs, ids)
- [ ] Жоден серверний файл не імпортує з `next/*`
- [ ] Відсутня generic залежність storefront від `revalidatePath` / `revalidateTag`
- [ ] `pnpm typecheck` проходить
- [ ] Серверні функції можна імпортувати і викликати з route loaders (перевірити на placeholder route)
