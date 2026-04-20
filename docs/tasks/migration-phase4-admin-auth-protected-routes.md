# Task: Phase 4 — Міграція адмінки, auth та захищених маршрутів

## Контекст

Після Phase 3 всі публічні storefront маршрути працюють на TanStack Start. Тепер потрібно мігрувати:

1. **Admin panel** — ~20 route files в `app/(cms)/admin/`, які є тонкими обгортками навколо `@simplycms/admin` пакету
2. **Auth routes** — авторизація, callback для OAuth
3. **Protected routes** — профіль, замовлення, налаштування
4. **API routes** — guest-order, health, revalidation

### Поточна архітектура адмінки

Всі admin маршрути мають ідентичний шаблон: `"use client"` + `dynamic(() => import('@simplycms/admin/pages/X'), { ssr: false })`. Фактично вся логіка живе в `@simplycms/admin` — route files лише lazy-load пакетні сторінки без SSR. Цей патерн ідеально маппиться на TanStack Start routes з `ssr: false` + `React.lazy`.

### Поточні admin sub-routes

banners, discounts, languages, orders, order-statuses, plugins, price-types, price-validator, products (list, [id]/edit, new), properties, reviews, sections, service-requests, services, settings, shipping, themes, user-categories, users

### Auth callback

`app/auth/callback/route.ts` — обробляє OAuth callback: отримує `code` з query params, обмінює на session через Supabase, redirectить. Використовує `NextResponse.redirect`.

### Protected layout

`app/(protected)/layout.tsx` — серверний перехоплювач: перевіряє сесію через серверний Supabase client, redirectить на `/auth` якщо не залогінений.

## Вимоги

### Admin routes

- [ ] Створити layout route `_admin.tsx` або `admin.tsx` з `ssr: false`:
  - `beforeLoad` — перевірка admin session через серверну функцію `isAdmin()` (з Phase 2)
  - Component — lazy-load `AdminLayout` з `@simplycms/admin`
- [ ] Створити route files для кожного admin sub-route (~20 файлів):
  - `admin/index.tsx` — Dashboard
  - `admin/products/index.tsx` — Products list
  - `admin/products/$id/edit.tsx` — Product edit
  - `admin/products/new.tsx` — Product create
  - `admin/sections/index.tsx` — Sections
  - `admin/orders/index.tsx` — Orders
  - `admin/orders/$id.tsx` — Order detail
  - ... і решта sub-routes (banners, discounts, languages, order-statuses, plugins, price-types, price-validator, properties, reviews, service-requests, services, settings, shipping, themes, user-categories, users)
- [ ] Кожен admin route має `ssr: false` — вся адмінка client-only
- [ ] Кожен admin route lazy-load-ить відповідну сторінку з `@simplycms/admin/pages/*`

### Auth routes

- [ ] Створити route `auth/index.tsx`:
  - `ssr: false` (auth форми клієнтські)
  - `beforeLoad` — якщо вже залогінений, redirect на `/`
  - `head` — title "Авторизація | SolarStore"
  - Component — `@simplycms/core/pages/Auth`
- [ ] Створити server handler для OAuth callback `auth/callback.tsx`:
  - Server handler (не component route)
  - Отримує `code` з query params
  - Обмінює на session через серверний Supabase client
  - Redirectить на `next` param або `/`
  - Обробляє помилки — redirect на `/auth?error=auth_error`

### Protected routes

- [ ] Створити layout route `_protected.tsx`:
  - `beforeLoad` — серверна перевірка auth (серверна функція `getSession()`)
  - Redirect на `/auth` якщо не залогінений
- [ ] Створити profile routes:
  - `_protected/profile/index.tsx` — профіль
  - `_protected/profile/orders/index.tsx` — замовлення
  - `_protected/profile/orders/$orderId.tsx` — деталі замовлення
  - `_protected/profile/settings.tsx` — налаштування

### API routes (server handlers)

- [ ] Створити server handler для guest-order:
  - Замінити `app/api/guest-order/route.ts`
  - Альтернатива: перенести логіку в `createServerFn`
- [ ] Створити server handler для health check:
  - Замінити `app/api/health/route.ts`
- [ ] Revalidation endpoint (з Phase 2) — вже має бути серверною функцією

## Clarify (питання перед імплементацією)

- [ ] Чи потрібні API routes як HTTP endpoints в TanStack Start?
  - Чому це важливо: guest-order API може викликатися зовнішніми клієнтами (не лише з React). Якщо тільки internal — можна замінити на createServerFn
  - Варіант A: Все через `createServerFn` — простіше, але доступно лише через RPC (рекомендовано якщо API не public)
  - Варіант B: Server handlers на routes для external API endpoints
  - Вплив: архітектура, зовнішні інтеграції

- [ ] Як організувати admin routes — flat чи nested?
  - Чому це важливо: 20+ sub-routes, деякі мають вкладені маршрути (products/new, products/$id/edit)
  - Варіант A: Flat file-based routing (`admin/products.index.tsx`, `admin/products.$id.edit.tsx`) — менше директорій
  - Варіант B: Nested directories (`admin/products/index.tsx`, `admin/products/$id/edit.tsx`) — зрозуміліша структура (рекомендовано)
  - Вплив: DX, навігація по файлах

- [ ] Чи зберігати lazy-loading для admin pages?
  - Чому це важливо: зараз кожна admin page lazy-loaded через next/dynamic. Це зменшує initial bundle
  - Варіант A: Зберегти — `React.lazy()` + `Suspense` в кожному route (рекомендовано)
  - Варіант B: Прямий імпорт — простіше, TanStack Router має code-splitting per route
  - Вплив: bundle size, DX

## Рекомендовані патерни

### Admin route з ssr: false

Кожен admin route має `ssr: false` щоб гарантувати client-only rendering. `@simplycms/admin` повністю побудований на React Query + client Supabase — SSR не потрібен.

- Де шукати поточний шаблон: `app/(cms)/admin/products/page.tsx` — типовий приклад
- Що перенести: lazy import → React.lazy або прямий import, wrapper → route component

### beforeLoad для auth guards

TanStack Router `beforeLoad` виконується перед loader і component. Ідеальне місце для auth guards — замінює Next.js layout-based server checks і proxy.ts guards.

- `_admin.tsx` beforeLoad: перевірити admin role, throw redirect('/auth') якщо ні
- `_protected.tsx` beforeLoad: перевірити auth session, throw redirect('/auth') якщо ні
- `auth/index.tsx` beforeLoad: перевірити що не залогінений, throw redirect('/') якщо так

### OAuth callback як server handler

TanStack Start дозволяє визначити server handlers на route через `server.handlers` property. Для OAuth callback потрібен GET handler що отримує `code`, обмінює через Supabase, встановлює cookie і redirectить.

- Де шукати поточну реалізацію: `app/auth/callback/route.ts`

## Антипатерни (уникати)

### ❌ Додавати SSR до admin routes
Адмінка — повністю клієнтська SPA. Вся data-fetching через React Query на клієнті. SSR тут додає складності без цінності.

### ❌ Переносити proxy.ts як окремий middleware файл
proxy.ts містив маршрутні guards. В TanStack Start це робиться через `beforeLoad` на layout routes — більш декларативно і type-safe. Не потрібен окремий middleware.

### ❌ Створювати нові API endpoints де можна обійтися createServerFn
Якщо endpoint викликається лише з React-коду, `createServerFn` краще — type-safe, automatic serialization, no manual fetch. API routes потрібні лише для зовнішніх клієнтів.

### ❌ Дублювати admin page components в route files
Route file має лише lazy-load page з `@simplycms/admin/pages/*`. Жодної UI логіки в route файлі.

## Архітектурні рішення

- **В який пакет додавати код:** `src/routes/admin/`, `src/routes/auth/`, `src/routes/_protected/`
- **Rendering стратегія:** Client-only для admin і auth, server-guarded для protected
- **Залежності:** серверні функції auth з Phase 2, `@simplycms/admin` і `@simplycms/core` пакети

## Цільова структура після Phase 4

```
src/routes/
  _admin.tsx                          # Layout: auth guard (admin role), AdminLayout
  admin/
    index.tsx                         # Dashboard
    products/
      index.tsx                       # Product list
      $id/
        edit.tsx                      # Product edit
      new.tsx                         # Product create
    sections/
      index.tsx                       # Sections
    orders/
      index.tsx                       # Orders list
      $id.tsx                         # Order detail
    banners/index.tsx
    discounts/index.tsx
    languages/index.tsx
    order-statuses/index.tsx
    plugins/index.tsx
    price-types/index.tsx
    price-validator/index.tsx
    properties/index.tsx
    reviews/index.tsx
    service-requests/index.tsx
    services/index.tsx
    settings/index.tsx
    shipping/index.tsx
    themes/index.tsx
    user-categories/index.tsx
    users/index.tsx
  auth/
    index.tsx                         # Auth page (login/register)
    callback.tsx                      # OAuth callback server handler
  _protected.tsx                      # Layout: auth guard (any user)
  _protected/
    profile/
      index.tsx                       # Profile page
      orders/
        index.tsx                     # User orders
        $orderId.tsx                  # Order detail
      settings.tsx                    # Profile settings
```

## MCP Servers (за потреби)

- **context7** — TanStack Start `beforeLoad`, `ssr: false`, server handlers на routes
- **context7** — React.lazy + Suspense для code splitting

## Пов'язана документація

- `docs/tasks/migration-phase3-storefront-ssr-routes.md` — попередня фаза
- `app/(cms)/admin/` — поточні admin route files (шаблон для міграції)
- `app/auth/callback/route.ts` — поточний OAuth callback
- `app/(protected)/layout.tsx` — поточний protected layout з auth guard
- `proxy.ts` — поточні auth guards (замінюються на beforeLoad)

## Definition of Done

- [ ] Всі admin sub-routes створені як TanStack Start file routes з `ssr: false`
- [ ] Admin layout route має auth guard (beforeLoad → isAdmin check)
- [ ] Auth page працює — форми login/register відображаються
- [ ] OAuth callback обробляє code і створює session
- [ ] Protected routes мають auth guard — redirect на /auth для незалогінених
- [ ] Profile, orders, settings сторінки доступні залогіненим користувачам
- [ ] `pnpm dev` — admin panel повністю функціональна (CRUD операції)
- [ ] `pnpm dev` — auth flow працює (login → redirect → profile/admin)
- [ ] `pnpm typecheck` проходить
