# Task: Phase 0 — Повний inventory next/* залежностей і фіксація цільових контрактів

> Статус: виконано. Цей документ є зафіксованим prerequisite для наступних фаз.

> ⚠️ **Superseded (2026-05-29, частково — лише дата-шар):** два рішення цієї фази переглянуто задачею
> [`core-engine-extraction-implementation.md`](./core-engine-extraction-implementation.md) у межах виносу ядра в headless commerce engine:
> - **Фаза 0.9 «singleton pattern зберігається»** → скасовано: глобальний `export const supabase` прибирається на користь dependency injection через порт `CatalogRepository`/`OrderRepository` + `EngineProvider`. Причина: singleton унеможливлює мультитенантне (`hub_id`) перевикористання в MetaHub і subset-adoption.
> - **Decision #10 «Жодних adapter-модулів»** → уточнено: заборона стосувалась **router/image-адаптерів** під час Next→TanStack міграції (щоб не робити подвійний рефакторинг). **Data-access порти (репозиторії)** — інша категорія, тепер дозволені й обов'язкові.
>
> Решта рішень фази (prop-driven pages, route-aware admin, `<img>`, next-themes, beforeLoad auth, ISR→invalidate, **ThemeRegistry-singleton**) лишаються чинними. ThemeRegistry-singleton ≠ supabase-singleton — не плутати.

## Контекст

Проєкт `simplyCMS` мігрує з Next.js App Router на TanStack Start + Vite як **один breaking change без перехідного періоду**. Це означає:

- **не потрібен** adapter-шар для роутингу або зображень;
- **не потрібна** сумісність Next.js і TanStack Start в одному коді;
- всі `next/*` залежності мають бути або прибрані, або переписані одразу під фінальні API.

Зараз Next.js API проник у `@simplycms/core` (pages + components), `@simplycms/admin` (pages + components + layout), `@simplycms/ui` (sonner), `@simplycms/theme-system` (getActiveThemeSSR) і `themes/*` (layouts + components). Перед імплементацією потрібно зафіксувати точний inventory і визначити фінальні контракти міграції, щоб не робити подвійний рефакторинг.

Результат цієї фази — **документ-артефакт** (inventory table + decision log), а не код. Жоден файл не змінюється.

## Inventory ~153 файлів з next/* залежностями

> **Верифіковано:** inventory перевірено через grep по реальній кодовій базі (2026-04-21).

### Фаза 0.1 — Core pages (prop-driven refactor): 14 файлів

Усі core pages переходять на prop-driven контракт. Route hooks (`useParams`, `useRouter`, `useSearchParams`, `usePathname`, `redirect`) виносяться в route layer.

| Файл | Поточні next/* imports | Цільовий props контракт |
|------|----------------------|------------------------|
| `core/src/pages/ProductDetail.tsx` | `useParams`, `useRouter`, `useSearchParams`, `usePathname` (next/navigation); `Link` (next/link) | `productSlug`, `sectionSlug`, `initialProduct?`, `initialModSlug?` |
| `core/src/pages/CatalogSection.tsx` | `useParams` (next/navigation); `Link` (next/link); `NextImage` (next/image) | `sectionSlug`, `initialSection?`, `initialProducts?` |
| `core/src/pages/PropertyPage.tsx` | `useParams` (next/navigation); `NextImage` (next/image); `Link` (next/link) | `propertySlug` |
| `core/src/pages/PropertyDetail.tsx` | `useParams` (next/navigation); `NextImage` (next/image); `Link` (next/link) | `propertySlug`, `optionSlug` |
| `core/src/pages/OrderSuccess.tsx` | `useParams`, `useSearchParams` (next/navigation); `Link` (next/link) | `orderId`, `guestEmail?` |
| `core/src/pages/ProfileOrderDetail.tsx` | `useParams`, `useRouter` (next/navigation); `Link` (next/link) | `orderId`, `onBack: () => void` |
| `core/src/pages/Auth.tsx` | `useRouter`, `useSearchParams` (next/navigation) | `redirectTo?`, `onSuccess: () => void` |
| `core/src/pages/Checkout.tsx` | `useRouter` (next/navigation); `Link` (next/link) | `onSuccess: (orderId: string) => void` |
| `core/src/pages/NotFound.tsx` | `usePathname` (next/navigation); `Link` (next/link) | `pathname: string` |
| `core/src/pages/Cart.tsx` | `Link` (next/link) | лише заміна `Link` примітиву |
| `core/src/pages/Catalog.tsx` | `Link` (next/link); `NextImage` (next/image) | лише заміна примітивів |
| `core/src/pages/ProfileOrders.tsx` | `Link` (next/link) | лише заміна `Link` |
| `core/src/pages/Profile.tsx` | `Link` (next/link) | лише заміна `Link` |
| `core/src/pages/Properties.tsx` | `Link` (next/link) | лише заміна `Link` |

> **Примітка:** `ProfileSettings.tsx` існує в тій самій директорії, але не має next/* imports.

Правило: `useRouter` для imperative navigation → callback props (`onSuccess`, `onBack`). `useParams`/`useSearchParams` → props від route layer. `usePathname` → prop `pathname`.

### Фаза 0.2 — Core components (примітиви): 11 файлів

| Компонент | `next/link` | `next/image` | `next/navigation` | Рішення |
|-----------|:-----------:|:------------:|:-----------------:|---------|
| `NavLink.tsx` | ✅ | — | `usePathname` | Переноситься в route layer; TanStack `Link` з `activeProps` замінює повністю |
| `ProfileLayout.tsx` | ✅ | — | `usePathname`, `redirect` | `redirect` прибрати (auth guard в `beforeLoad`), `pathname` через props |
| `CatalogLayout.tsx` | ✅ | — | `useRouter` | `useRouter` → callback `onNavigate` через props |
| `ProductCard.tsx` | ✅ | ✅ | — | TanStack `Link` + `<img loading="lazy">` |
| `ProductGallery.tsx` | — | ✅ | — | `<img>` + LCP attrs для першого зображення |
| `ProductCharacteristics.tsx` | ✅ | — | — | TanStack `Link` |
| `CartDrawer.tsx` | ✅ | — | — | TanStack `Link` |
| `CartItem.tsx` | — | ✅ | — | `<img loading="lazy">` |
| `ReviewCard.tsx` | — | ✅ | — | `<img loading="lazy">` |
| `AvatarUpload.tsx` | — | ✅ | — | `<img loading="lazy">` |
| `ProductReviews.tsx` | ✅ | — | — | TanStack `Link` |

### Фаза 0.3 — Admin pages (route-aware rewrite): 36 файлів

Admin pages залишаються route-aware і переписуються напряму на TanStack Router. Маппінг:

| Next.js API | TanStack Router API |
|-------------|---------------------|
| `useParams()` | `Route.useParams()` або `useParams({ from: '/admin/...' })` |
| `useRouter().push(path)` | `useNavigate()({ to: path })` |
| `useSearchParams()` | `Route.useSearch()` |
| `usePathname()` | `useRouterState({ select: s => s.location.pathname })` |
| `Link` | `Link` з `@tanstack/react-router` |
| `NextImage` | `<img loading="lazy">` (admin не LCP-критичний) |

Файли: `Dashboard` (Link), `Products` (NextImage, useRouter), `ProductEdit` (useParams, useRouter), `Sections` (NextImage, useRouter), `SectionEdit` (useParams, useRouter), `Orders` (useRouter), `OrderDetail` (useParams, useRouter), `Banners` (NextImage, useRouter), `BannerEdit` (useParams, useRouter), `Reviews` (useRouter), `ReviewDetail` (NextImage, useParams, useRouter, Link), `Users` (useRouter, Link), `UserEdit` (useParams, Link), `UserCategories` (useRouter, Link), `UserCategoryEdit` (useParams, useRouter, Link), `UserCategoryRules` (useRouter, Link), `UserCategoryRuleEdit` (useParams, useRouter, Link), `Properties` (useRouter), `PropertyEdit` (useParams, useRouter), `PropertyOptionEdit` (useParams, useRouter), `PriceTypes` (useRouter), `PriceTypeEdit` (useParams, useRouter, Link), `Discounts` (Link), `DiscountEdit` (useRouter, useParams, useSearchParams), `DiscountGroupEdit` (useRouter, useParams, useSearchParams), `Themes` (Link, NextImage), `ThemeSettings` (useParams, useRouter, Link), `PluginSettings` (useParams, useRouter), `Shipping` (Link), `ShippingMethods` (useRouter, Link), `ShippingMethodEdit` (useRouter, useParams), `ShippingZones` (useRouter, Link), `ShippingZoneEdit` (useRouter, useParams), `PickupPoints` (useRouter, Link), `PickupPointEdit` (useRouter, useParams), `PlaceholderPage` (usePathname).

Admin components: `ImageUpload.tsx`, `ProductModifications.tsx` — лише заміна `NextImage` → `<img>`.
`AdminLayout.tsx` — `useRouter` → `useNavigate()`, auth guard виноситься в `beforeLoad` route `_admin`.

### Фаза 0.4 — Theme components: 11 файлів

Теми переписуються напряму на TanStack Router `Link` і нативний `<img>`. Теми — project-local код, а не reusable library; framework-agnostic не потрібен.

| Компонент | Зміни |
|-----------|-------|
| `themes/default/components/Header.tsx` | `Link` → TanStack, `Image` → `<img>` + LCP, `useRouter` → `useNavigate()` |
| `themes/default/components/Footer.tsx` | `Link` → TanStack, `Image` → `<img>` |
| `themes/default/layouts/ProfileLayout.tsx` | `Link` → TanStack, `usePathname`/`useRouter` → TanStack; прибрати auth guard |
| `themes/default/components/BannerSlider.tsx` | `Image` → `<img>` + LCP attrs, `Link` → TanStack |
| `themes/default/components/ProductCard.tsx` | `Link` → TanStack, `NextImage` → `<img>` |
| `themes/default/components/BrandCarousel.tsx` | `NextImage` → `<img>`, `Link` → TanStack |
| `themes/default/components/ProductCarousel.tsx` | `Link` → TanStack |
| `themes/solarstore/components/Header.tsx` | `Link` → TanStack, `useRouter` → `useNavigate()` |
| `themes/solarstore/components/Footer.tsx` | `Link` → TanStack |
| `themes/solarstore/pages/HomePage.tsx` | `Link` → TanStack, `NextImage` → `<img>` + LCP |
| `themes/solarstore/layouts/ProfileLayout.tsx` | `Link` → TanStack, `usePathname`/`useRouter` → TanStack; прибрати auth guard |

**Відхилення від норми:** `themes/*/ProfileLayout.tsx` дублюють auth guard через `useRouter().push("/auth")` (клієнтська навігація), а `core/src/components/profile/ProfileLayout.tsx` — через `redirect()` з `next/navigation` (серверний API). Це порушення архітектури: auth guard має бути лише в `beforeLoad` route `_authed`. З theme layouts та core ProfileLayout auth логіку повністю прибрати.

### Фаза 0.5 — Server-only файли: 12 файлів

| Файл | Next.js API | Цільовий owner у TanStack Start |
|------|-------------|--------------------------------|
| `core/src/supabase/server.ts` | `cookies()` з `next/headers` | `src/server/supabase.ts` (server fn) |
| `core/src/supabase/proxy.ts` | `NextResponse`, `NextRequest` | Зникає: `beforeLoad` + server fn |
| `theme-system/src/getActiveThemeSSR.ts` | `unstable_cache`, `React.cache` | `src/server/theme.ts` (server fn з route-level cache) |
| `proxy.ts` (root) | `NextResponse`, `NextRequest` | Зникає: auth guards у `beforeLoad` route definitions |
| `app/layout.tsx` | `next/font/google` (Inter), `type Metadata` (next), `next-themes` | `src/routes/__root.tsx` |
| `app/api/revalidate/route.ts` | `revalidatePath`, `revalidateTag` (next/cache); `NextResponse` (next/server) | Зникає: `router.invalidate()` + `queryClient.invalidateQueries()` |
| `app/api/guest-order/route.ts` | `NextResponse` | Server fn |
| `app/api/health/route.ts` | `NextResponse` | Server fn або Vite middleware |
| `app/auth/callback/route.ts` | `NextResponse` | Server fn або API route |
| `app/(protected)/layout.tsx` | `redirect` з `next/navigation` | `beforeLoad` у `_authed` route |
| `app/(cms)/admin/layout.tsx` | `next/dynamic` | `ssr: false` на admin layout route |
| `app/theme-registry.server.ts` | — (чистий TS) | Переноситься as-is |

### Фаза 0.6 — App admin shims (next/dynamic): 42 файли

Усі `app/(cms)/admin/*/page.tsx` використовують однаковий патерн:
```
import dynamic from 'next/dynamic';
const Component = dynamic(() => import('@simplycms/admin/...'), { ssr: false });
```
У TanStack Start admin layout route визначається з `ssr: false`, і всі дочірні routes автоматично client-only. Жоден окремий `dynamic()` шім не потрібен — 42 файли зникають повністю (включаючи shim-сторінки для `languages`, `order-statuses`, `price-validator`, `service-requests`, `services`, `settings`, `plugins` та кореневу `admin/page.tsx`).

### Фаза 0.7 — next/image LCP-матриця

| Файл | LCP-критичний? | Атрибути |
|------|:--------------:|----------|
| `themes/*/BannerSlider.tsx` (hero) | **Так** | `fetchpriority="high"` + `loading="eager"` + `decoding="async"` + explicit `width`/`height` |
| `themes/*/Header.tsx` (logo) | **Так** | `fetchpriority="high"` + `loading="eager"` |
| `core/ProductGallery.tsx` (main) | **Так** | `fetchpriority="high"` + `loading="eager"` (тільки перше зображення) |
| `solarstore/HomePage.tsx` (hero) | **Так** | `fetchpriority="high"` + `loading="eager"` |
| Решта (~20 файлів) | Ні | `loading="lazy"` + `decoding="async"` |

Правило `NextImage fill` → CSS: `<img className="absolute inset-0 w-full h-full object-cover">` + батьківський `div position: relative`.

### Фаза 0.8 — next-themes: залишається без змін

> **Верифіковано:** `next-themes@0.4.6` НЕ має `next` як peer dependency. Потрібні лише `react` та `react-dom`. Пакет framework-agnostic, працює з будь-яким React-додатком. Заміна на `better-themes` **не потрібна**.

Файли з `next-themes` (залишаються as-is):

| Файл | Import |
|------|--------|
| `app/layout.tsx` | `import { ThemeProvider } from 'next-themes'` |
| `ui/src/sonner.tsx` | `import { useTheme } from 'next-themes'` |
| `core/src/components/ThemeToggle.tsx` | `import { useTheme } from 'next-themes'` |

API зберігається: `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`.

### Фаза 0.9 — Supabase client env migration

| Файл | Зміна |
|------|-------|
| `core/src/supabase/client.ts` | `NEXT_PUBLIC_*` → `VITE_*` через `import.meta.env.*`; singleton pattern зберігається ⚠️ **(SUPERSEDED — singleton прибирається, див. amendment вгорі + `core-engine-extraction-implementation.md`)** |
| `core/src/supabase/anon.ts` | `NEXT_PUBLIC_*` → `VITE_*` через `import.meta.env.*` |
| `core/src/supabase/server.ts` | `NEXT_PUBLIC_*` → server-side env (process.env без prefix) |
| `core/src/supabase/proxy.ts` | `NEXT_PUBLIC_*` → server-side env (process.env без prefix) |
| `core/src/config.ts` | `NEXT_PUBLIC_*` → `VITE_*` (client) або server env залежно від контексту |
| `simplycms.config.ts` | `NEXT_PUBLIC_*` → `VITE_*` через `import.meta.env.*` |
| `proxy.ts` (root) | `NEXT_PUBLIC_*` → зникає разом з файлом |
| `app/api/health/route.ts` | `NEXT_PUBLIC_*` → зникає (стає server fn) |
| `app/robots.ts` | `NEXT_PUBLIC_SITE_URL` → `VITE_SITE_URL` або server env |
| `app/sitemap.ts` | `NEXT_PUBLIC_SITE_URL` → `VITE_SITE_URL` або server env |
| `tools/content-loader-mcp/src/client.ts` | `NEXT_PUBLIC_SUPABASE_URL` fallback → `VITE_SUPABASE_URL` fallback |

### Фаза 0.9.1 — App-layer storefront/protected pages: 14 файлів

Ці файли знаходяться в `app/` і містять next/* залежності (type imports, runtime конвенції, route hooks):

| Файл | Next.js API | Цільовий owner у TanStack Start |
|------|-------------|--------------------------------|
| `app/(storefront)/page.tsx` | `type Metadata`; `export const metadata`; `export const revalidate = 3600` | Route metadata + loader staleTime |
| `app/(storefront)/catalog/page.tsx` | `type Metadata`; `export const metadata`; `export const revalidate = 1800` | Route metadata + loader staleTime |
| `app/(storefront)/catalog/[sectionSlug]/page.tsx` | `notFound()`; `type Metadata`; `generateMetadata()`; `export const revalidate = 1800` | throw route error; route head(); loader staleTime |
| `app/(storefront)/catalog/[sectionSlug]/[productSlug]/page.tsx` | `notFound()`; `type Metadata`; `generateMetadata()`; `export const revalidate = 3600` | throw route error; route head(); loader staleTime |
| `app/(storefront)/properties/page.tsx` | `type Metadata`; `export const metadata`; `export const revalidate = 86400` | Route metadata + loader staleTime |
| `app/(storefront)/properties/[propertySlug]/page.tsx` | `notFound()`; `type Metadata`; `generateMetadata()`; `export const revalidate = 86400` | throw route error; route head(); loader staleTime |
| `app/(storefront)/properties/[propertySlug]/[optionSlug]/page.tsx` | `notFound()`; `type Metadata`; `generateMetadata()`; `export const revalidate = 86400` | throw route error; route head(); loader staleTime |
| `app/(storefront)/order-success/[orderId]/page.tsx` | `useParams` (next/navigation) | Params з route definition |
| `app/(protected)/profile/orders/[orderId]/page.tsx` | `useParams` (next/navigation) | Params з route definition |
| `app/not-found.tsx` | `Link` (next/link) | TanStack Link або custom 404 route |
| `app/auth/layout.tsx` | `type Metadata`; `export const metadata` | Route metadata |
| `app/robots.ts` | `type MetadataRoute` (next); `NEXT_PUBLIC_SITE_URL` | Окремий файл або server fn |
| `app/sitemap.ts` | `type MetadataRoute` (next); `NEXT_PUBLIC_SITE_URL` | Окремий файл або server fn |
| `next.config.ts` | `type NextConfig` (next) | Зникає: конфігурація переходить у `app.config.ts` (Vinxi/TanStack Start) |

> **Примітки:**
> - `app/(storefront)/layout.tsx` не має прямих next/* imports, але транзитивно залежить від `getActiveThemeSSR()` (uses `unstable_cache` з `next/cache`). При міграції замінюється на TanStack Start route layout з server fn.
> - `app/providers.tsx` не має next/* imports, але це інфраструктурний файл (CMSProvider, ThemeProvider), що потребує адаптації під TanStack Start.
> - ~4 admin pages (`Plugins.tsx`, `PriceValidator.tsx`, `OrderStatuses.tsx`, `Settings.tsx`) не мають прямих next/* imports, але можуть мати транзитивні залежності через core-компоненти (напр. `NavLink` з `@simplycms/core`).

### Фаза 0.10 — Auth/proxy flow: beforeLoad + server functions

Поточний auth guard реалізований через `proxy.ts` (Next.js middleware) + дублюється в `AdminLayout.tsx`, `ProfileLayout.tsx`, `themes/*/ProfileLayout.tsx`.

Цільова архітектура — єдина точка auth guards через TanStack Start `beforeLoad`:

| Route | beforeLoad | Повертає |
|-------|-----------|---------|
| `_authed.tsx` (profile) | server fn `getCurrentUser()` → redirect якщо null | `{ user }` |
| `_admin.tsx` (admin) | server fn `requireAdmin()` → перевірка user + role | `{ user, isAdmin: true }` |
| `/auth` | якщо user є → redirect на `/` | — |

Дублювання auth guard з `AdminLayout.tsx`, `ProfileLayout.tsx`, `themes/*/ProfileLayout.tsx` — повністю прибрати.

### Фаза 0.11 — Revalidation/cache target contract

ISR (`revalidatePath`, `revalidateTag`, `unstable_cache`) не існує в TanStack Start. Заміна:

| Поточний механізм | Цільовий механізм |
|-------------------|-------------------|
| `unstable_cache` (theme) | Server fn з client-side `staleTime` через React Query |
| `revalidatePath` / `revalidateTag` | `router.invalidate()` (route loaders) + `queryClient.invalidateQueries()` |
| `/api/revalidate` endpoint | Зникає; invalidation через server fn response |
| `export const revalidate = 3600` | Route loader `staleTime` |

## Прийняті рішення (decision log)

1. **Усі core pages — prop-driven.** Packages не імпортують жодного router. Route layer передає params, search, callbacks.
2. **Усі admin pages — route-aware.** Переписуються напряму на `@tanstack/react-router` hooks. Prop-driven для admin — зайвий overhead.
3. **Теми — route-aware (TanStack Router).** Теми — project-local код, framework-agnostic не потрібен.
4. **`next/image` → `<img>`.** LCP-критичні місця отримують `fetchpriority="high"` + `loading="eager"`. Решта — `loading="lazy"`. Окремий компонент `MediaImage` не створюється.
5. **`next-themes` — залишається.** Пакет framework-agnostic (peer deps: react + react-dom, без next). Заміна на `better-themes` не потрібна.
6. **Auth guards — лише в `beforeLoad`.** Дублювання в layout components повністю прибирається.
7. **ISR → client-side invalidation.** `router.invalidate()` + React Query invalidation. CDN-level cache — окрема задача після міграції.
8. **Admin shims (next/dynamic) — зникають.** `ssr: false` на admin layout route.
9. **Server-only файли — виносяться з packages.** `supabase/server.ts`, `supabase/proxy.ts`, `getActiveThemeSSR.ts` переходять у `src/server/`.
10. **Жодних adapter-модулів `@simplycms/core/adapters/*` не створювати.** ⚠️ **(УТОЧНЕНО — стосувалось router/image-адаптерів; data-access порти/репозиторії тепер дозволені, див. amendment вгорі)**

## Антипатерни (уникати)

### ❌ Створювати router/image adapters

Це дублює обсяг міграції: спочатку Next → adapter, потім adapter → TanStack/native. За умовами цієї міграції це зайвий крок.

### ❌ Емулювати `URLSearchParams` або `href` API заради сумісності

Якщо компонент потребує route search або dynamic params, треба або підняти це в route layer, або переписати компонент під фінальний контракт.

### ❌ Залишати server-only файли в packages як тимчасовий компроміс

`supabase/server.ts`, `supabase/proxy.ts`, `getActiveThemeSSR.ts` не мають пережити міграцію у поточному вигляді.

### ❌ Залишати auth guard дублювання в layout components

Auth guard має бути тільки в `beforeLoad` route definitions. ProfileLayout, AdminLayout, theme ProfileLayout — лише візуальний шар.

### ❌ Створювати MediaImage або інші image wrappers

`<img>` з правильними атрибутами — фінальне рішення. Wrapper вводити лише при доведеній продуктовій потребі після міграції.

### ❌ Створювати обгортки для `export const revalidate`

ISR семантика зникає повністю. Використовувати loader `staleTime` на route definitions.

### ❌ Зберігати `generateMetadata` / `export const metadata` API

Next.js metadata конвенція замінюється на `head()` property в TanStack Start route definitions.

## Архітектурні рішення

- **В який пакет додавати код:** новий код у цій фазі не додається; це audit + фіксація цільових контрактів
- **Rendering стратегія:** фіксується цільова: SSR для storefront (TanStack Start loaders), client-only для admin (`ssr: false`), `beforeLoad` для auth guards
- **Міграція з temp/:** не стосується
- **Залежності:** `next-themes` залишається (framework-agnostic, без next peer dep)
- **Формат артефакту:** inventory table + decision log у цьому файлі

## Зведена матриця файлів

| Зона | Файлів | Стратегія |
|------|--------|-----------|
| Core pages (prop-driven refactor) | 14 | Props замість router hooks |
| Core components (примітиви) | 11 | TanStack Link / `<img>` / callbacks |
| Admin pages (route-aware rewrite) | 36 | Механічна заміна next/* → @tanstack/* |
| Admin components | 3 | `NextImage` → `<img>` |
| Theme components | 11 | TanStack Link / `<img>` / useNavigate |
| Server-only (packages) | 3 | Виносяться в src/server/ |
| Server-only (app) | 9 | Стають route definitions / server fns |
| App admin shims | 42 | Зникають (ssr: false на layout route) |
| App storefront/protected pages | 14 | Route definitions / metadata / error handling |
| next-themes (залишається) | 3 | Без змін (framework-agnostic) |
| NEXT_PUBLIC_ env migration | 11 | `VITE_*` або server env |
| **Разом** | **~153** | — |

> **Примітка:** Деякі файли рахуються в кількох категоріях (напр. `app/layout.tsx` — server-only + next-themes).
> Унікальних файлів з next/* або NEXT_PUBLIC_ залежностями: ~140.

## Пов'язана документація

- `docs/tasks/simplycms_tanstack_start_migration_task.md` — загальний план міграції
- `docs/tasks/migration-phase1-tanstack-start-bootstrap.md` — фаза прямого переписування примітивів
- `.github/instructions/architecture-core.instructions.md`
- `.github/instructions/coding-style.instructions.md`
- `.github/instructions/data-access.instructions.md` — Supabase client patterns
- `.github/instructions/ui-architecture.instructions.md` — система тем

## Definition of Done

- [Х] Є повний inventory `next/*` залежностей по `packages/`, `themes/`, `app/` з розбивкою по файлах
- [Х] Кожна залежність віднесена до категорії та має зафіксований цільовий контракт
- [Х] Є inventory table core pages з цільовим props-контрактом для кожної сторінки
- [Х] Є список admin pages для route-aware rewrite на TanStack Router
- [Х] Є список theme components з цільовими замінами `Link`/navigation/image API
- [Х] Є повний список server-only файлів з цільовим owner у TanStack Start
- [Х] Є LCP-матриця для всіх `next/image` використань
- [Х] Є рішення по next-themes → better-themes
- [Х] Є рішення по auth/proxy flow → beforeLoad + server functions
- [Х] Є рішення по ISR/cache → router.invalidate() + React Query
- [Х] Зафіксовано decision log з 10 прийнятими рішеннями
- [Х] Зафіксовано що adapter-механізм повністю виключений з плану міграції
- [Х] Inventory верифіковано через grep по реальній кодовій базі (2026-04-21)
- [Х] Додано пропущені app-layer storefront/protected pages (14 файлів)
- [Х] Додано повний перелік NEXT_PUBLIC_* env usage (11 файлів)
