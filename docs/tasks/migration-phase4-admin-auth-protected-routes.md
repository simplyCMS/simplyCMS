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

- [ ] Забезпечити **двошаровий захист** admin routes:
  - server-side guard у `src/start.ts` для початкових request на `/admin`
  - `beforeLoad` у `_admin.tsx` для client-side навігацій всередині застосунку
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
  - `admin/reviews/index.tsx` — Reviews list
  - `admin/reviews/$reviewId.tsx` — Review detail
  - `admin/themes/index.tsx` — Themes list
  - `admin/themes/$themeId/settings.tsx` — Theme settings
  - `admin/plugins/index.tsx` — Plugins list
  - `admin/plugins/$pluginId/settings.tsx` — Plugin settings
  - `admin/properties/index.tsx` — Properties list
  - `admin/properties/$propertyId.tsx` — Property edit (включає property options)
  - `admin/user-categories/index.tsx` — User categories
  - `admin/user-categories/$id.tsx` — User category edit (+ rules)
  - `admin/shipping/index.tsx` — Shipping overview
  - `admin/shipping/methods.tsx` — Shipping methods
  - `admin/shipping/methods/$id.tsx` — Method edit
  - `admin/shipping/zones.tsx` — Shipping zones
  - `admin/shipping/zones/$id.tsx` — Zone edit
  - `admin/shipping/pickup-points.tsx` — Pickup points
  - `admin/shipping/pickup-points/$id.tsx` — Pickup point edit
  - ... і решта sub-routes (banners/$bannerId, discounts/$discountId, languages, order-statuses, price-types/$priceTypeId, price-validator, service-requests, services, settings, users/$userId)

> **ВАЖЛИВО:** Перед імплементацією зробити повний audit `app/(cms)/admin/` для точного списку всіх вкладених маршрутів.
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

- [ ] Перенести client-heavy storefront routes:
  - `_storefront/cart.tsx`
  - `_storefront/checkout.tsx`
  - обидва маршрути лишаються client-only і використовують storefront layout/theme

### API routes (server handlers)

- [ ] Створити server handler для guest-order:
  - Замінити `app/api/guest-order/route.ts`
  - Альтернатива: перенести логіку в `createServerFn`
- [ ] Створити server handler для health check:
  - Замінити `app/api/health/route.ts`
- [ ] Якщо `guest-order` або інший endpoint потрібен зовнішнім клієнтам — залишити його як HTTP server handler; internal invalidate/revalidation логіку не відновлювати як generic endpoint без явної потреби

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

**Увага щодо `beforeLoad` + `ssr: false`:** якщо route має `ssr: false`, то `beforeLoad` виконується **лише на клієнті**. Тому `beforeLoad` тут не може бути єдиним механізмом захисту. Початковий запит на `/admin` має перевірятися в `src/start.ts`, а `beforeLoad` покриває навігацію після гідрації.

- Де шукати поточний шаблон: `app/(cms)/admin/products/page.tsx` — типовий приклад
- Що перенести: lazy import → React.lazy або прямий import, wrapper → route component

### beforeLoad для auth guards

TanStack Router `beforeLoad` виконується перед loader і component. Ідеальне місце для auth guards — замінює Next.js layout-based server checks і proxy.ts guards.

- `_admin.tsx` beforeLoad: перевірити admin role для client-side навігації, throw redirect('/auth') якщо ні
- `_protected.tsx` beforeLoad: перевірити auth session, throw redirect('/auth') якщо ні
- `auth/index.tsx` beforeLoad: перевірити що не залогінений, throw redirect('/') якщо так

### Server-side guard у `src/start.ts`

Для `/admin` потрібен окремий server-side request middleware, бо admin shell client-only. Він має:

- перевіряти сесію на початковому request;
- перевіряти admin role;
- redirectити незалогіненого користувача до `/auth` ще до рендеру shell.

Це не замінює `beforeLoad`, а доповнює його для початкового входу в admin.

### OAuth callback як server handler

TanStack Start дозволяє визначити server handlers на route через `server.handlers` property. Для OAuth callback потрібен GET handler що отримує `code`, обмінює через Supabase, встановлює cookie і redirectить.

- Де шукати поточну реалізацію: `app/auth/callback/route.ts`

## Антипатерни (уникати)

### ❌ Додавати SSR до admin routes
Адмінка — повністю клієнтська SPA. Вся data-fetching через React Query на клієнті. SSR тут додає складності без цінності.

### ❌ Переносити proxy.ts як окремий middleware файл
proxy.ts як окремий Next.js артефакт не потрібен. Але частина його поведінки для `/admin` має бути перенесена в `src/start.ts`, бо client-only admin shell інакше не має server-side захисту на першому request.

### ❌ Створювати нові API endpoints де можна обійтися createServerFn
Якщо endpoint викликається лише з React-коду, `createServerFn` краще — type-safe, automatic serialization, no manual fetch. API routes потрібні лише для зовнішніх клієнтів.

### ❌ Дублювати admin page components в route files
Route file має лише lazy-load page з `@simplycms/admin/pages/*`. Жодної UI логіки в route файлі.

## Архітектурні рішення

- **В який пакет додавати код:** `src/routes/admin/`, `src/routes/auth/`, `src/routes/_protected/`
- **Rendering стратегія:** Client-only для admin і auth, server-guarded для protected, client-only для cart/checkout
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
    reviews/index.tsx
    reviews/$reviewId.tsx
    themes/index.tsx
    themes/$themeId/settings.tsx
    plugins/index.tsx
    plugins/$pluginId/settings.tsx
    properties/index.tsx
    properties/$propertyId.tsx
    user-categories/index.tsx
    user-categories/$id.tsx
    shipping/
      index.tsx
      methods.tsx
      methods/$id.tsx
      zones.tsx
      zones/$id.tsx
      pickup-points.tsx
      pickup-points/$id.tsx
    banners/index.tsx
    banners/$bannerId.tsx
    discounts/index.tsx
    discounts/$discountId.tsx
    languages/index.tsx
    order-statuses/index.tsx
    price-types/index.tsx
    price-types/$priceTypeId.tsx
    price-validator/index.tsx
    service-requests/index.tsx
    services/index.tsx
    settings/index.tsx
    users/index.tsx
    users/$userId.tsx
  _storefront/
    cart.tsx
    checkout.tsx
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
- [ ] Початковий request на `/admin` захищений server-side middleware у `src/start.ts`
- [ ] Admin layout route має auth guard для client-side навігації (beforeLoad → isAdmin check)
- [ ] Auth page працює — форми login/register відображаються
- [ ] OAuth callback обробляє code і створює session
- [ ] Protected routes мають auth guard — redirect на /auth для незалогінених
- [ ] Cart і Checkout працюють як client-only storefront routes
- [ ] Profile, orders, settings сторінки доступні залогіненим користувачам
- [ ] `pnpm dev` — admin panel повністю функціональна (CRUD операції)
- [ ] `pnpm dev` — auth flow працює (login → redirect → profile/admin)
- [ ] `pnpm typecheck` проходить
