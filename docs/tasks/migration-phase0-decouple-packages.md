# Task: Phase 0 — Повний inventory next/* залежностей і фіксація цільових контрактів

## Контекст

Проєкт `simplyCMS` мігрує з Next.js App Router на TanStack Start + Vite як **один breaking change без перехідного періоду**. Це означає:

- **не потрібен** adapter-шар для роутингу або зображень;
- **не потрібна** сумісність Next.js і TanStack Start в одному коді;
- всі `next/*` залежності мають бути або прибрані, або переписані одразу під фінальні API.

Зараз Next.js API проник у `@simplycms/core` (pages + components), `@simplycms/admin` (pages + components + layout), `@simplycms/ui` (sonner), `@simplycms/theme-system` (getActiveThemeSSR) і `themes/*` (layouts + components). Перед імплементацією потрібно зафіксувати точний inventory і визначити фінальні контракти міграції, щоб не робити подвійний рефакторинг.

Результат цієї фази — **документ-артефакт** (inventory table + decision log), а не код. Жоден файл не змінюється.

## Inventory ~120 файлів з next/* залежностями

### Фаза 0.1 — Core pages (prop-driven refactor): 13 файлів

Усі core pages переходять на prop-driven контракт. Route hooks (`useParams`, `useRouter`, `useSearchParams`, `usePathname`, `redirect`) виносяться в route layer.

| Файл | Поточні hooks | Цільовий props контракт |
|------|--------------|------------------------|
| `core/src/pages/ProductDetail.tsx` | `useParams`, `useRouter`, `useSearchParams`, `usePathname` | `productSlug`, `sectionSlug`, `initialProduct?`, `initialModSlug?` |
| `core/src/pages/CatalogSection.tsx` | `useParams` | `sectionSlug`, `initialSection?`, `initialProducts?` |
| `core/src/pages/PropertyPage.tsx` | `useParams` | `propertySlug` |
| `core/src/pages/PropertyDetail.tsx` | `useParams` | `propertySlug`, `optionSlug` |
| `core/src/pages/OrderSuccess.tsx` | `useParams`, `useSearchParams` | `orderId`, `guestEmail?` |
| `core/src/pages/ProfileOrderDetail.tsx` | `useParams`, `useRouter` | `orderId`, `onBack: () => void` |
| `core/src/pages/Auth.tsx` | `useRouter`, `useSearchParams` | `redirectTo?`, `onSuccess: () => void` |
| `core/src/pages/Checkout.tsx` | `useRouter` | `onSuccess: (orderId: string) => void` |
| `core/src/pages/NotFound.tsx` | `usePathname` | `pathname: string` |
| `core/src/pages/Cart.tsx` | `Link` | лише заміна `Link` примітиву |
| `core/src/pages/Catalog.tsx` | `Link`, `NextImage` | лише заміна примітивів |
| `core/src/pages/ProfileOrders.tsx` | `Link` | лише заміна `Link` |
| `core/src/pages/Profile.tsx` | `Link` | лише заміна `Link` |
| `core/src/pages/Properties.tsx` | `Link` | лише заміна `Link` |

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

### Фаза 0.3 — Admin pages (route-aware rewrite): ~30 файлів

Admin pages залишаються route-aware і переписуються напряму на TanStack Router. Маппінг:

| Next.js API | TanStack Router API |
|-------------|---------------------|
| `useParams()` | `Route.useParams()` або `useParams({ from: '/admin/...' })` |
| `useRouter().push(path)` | `useNavigate()({ to: path })` |
| `useSearchParams()` | `Route.useSearch()` |
| `usePathname()` | `useRouterState({ select: s => s.location.pathname })` |
| `Link` | `Link` з `@tanstack/react-router` |
| `NextImage` | `<img loading="lazy">` (admin не LCP-критичний) |

Файли: `Dashboard`, `Products`, `ProductEdit`, `Sections`, `SectionEdit`, `Orders`, `OrderDetail`, `Banners`, `BannerEdit`, `Reviews`, `ReviewDetail`, `Users`, `UserEdit`, `UserCategories`, `UserCategoryEdit`, `UserCategoryRules`, `UserCategoryRuleEdit`, `Properties`, `PropertyEdit`, `PropertyOptionEdit`, `PriceTypes`, `PriceTypeEdit`, `Discounts`, `DiscountEdit`, `DiscountGroupEdit`, `Themes`, `ThemeSettings`, `PluginSettings`, `Shipping`, `ShippingMethods`, `ShippingMethodEdit`, `ShippingZones`, `ShippingZoneEdit`, `PickupPoints`, `PickupPointEdit`, `PlaceholderPage`.

Admin components: `ImageUpload.tsx`, `ProductModifications.tsx` — лише заміна `NextImage` → `<img>`.
`AdminLayout.tsx` — `useRouter` → `useNavigate()`, auth guard виноситься в `beforeLoad` route `_admin`.

### Фаза 0.4 — Theme components: 13 файлів

Теми переписуються напряму на TanStack Router `Link` і нативний `<img>`. Теми — project-local код, а не reusable library; framework-agnostic не потрібен.

| Компонент | Зміни |
|-----------|-------|
| `themes/default/Header.tsx` | `Link` → TanStack, `Image` → `<img>` + LCP, `useRouter` → `useNavigate()` |
| `themes/default/Footer.tsx` | `Link` → TanStack, `Image` → `<img>` |
| `themes/default/ProfileLayout.tsx` | `Link` → TanStack, `usePathname`/`useRouter` → TanStack; прибрати auth guard |
| `themes/default/BannerSlider.tsx` | `Image` → `<img>` + LCP attrs, `Link` → TanStack |
| `themes/default/ProductCard.tsx` | `Link` → TanStack, `NextImage` → `<img>` |
| `themes/default/BrandCarousel.tsx` | `NextImage` → `<img>`, `Link` → TanStack |
| `themes/default/ProductCarousel.tsx` | `Link` → TanStack |
| `themes/solarstore/Header.tsx` | `Link` → TanStack, `useRouter` → `useNavigate()` |
| `themes/solarstore/Footer.tsx` | `Link` → TanStack |
| `themes/solarstore/HomePage.tsx` | `Link` → TanStack, `NextImage` → `<img>` + LCP |
| `themes/solarstore/ProfileLayout.tsx` | `Link` → TanStack, `usePathname`/`useRouter` → TanStack; прибрати auth guard |

**Відхилення від норми:** `themes/*/ProfileLayout.tsx` дублюють auth guard (redirect на /auth). Це порушення архітектури: auth guard має бути лише в `beforeLoad` route `_authed`. З theme layouts auth логіку повністю прибрати.

### Фаза 0.5 — Server-only файли: 12 файлів

| Файл | Next.js API | Цільовий owner у TanStack Start |
|------|-------------|--------------------------------|
| `core/src/supabase/server.ts` | `cookies()` з `next/headers` | `src/server/supabase.ts` (server fn) |
| `core/src/supabase/proxy.ts` | `NextResponse`, `NextRequest` | Зникає: `beforeLoad` + server fn |
| `theme-system/src/getActiveThemeSSR.ts` | `unstable_cache`, `React.cache` | `src/server/theme.ts` (server fn з route-level cache) |
| `proxy.ts` (root) | `NextResponse`, `NextRequest` | Зникає: auth guards у `beforeLoad` route definitions |
| `app/layout.tsx` | `next/font`, `next-themes`, SSR theme | `src/routes/__root.tsx` |
| `app/api/revalidate/route.ts` | `revalidatePath`, `revalidateTag` | Зникає: `router.invalidate()` + `queryClient.invalidateQueries()` |
| `app/api/guest-order/route.ts` | `NextResponse` | Server fn |
| `app/api/health/route.ts` | `NextResponse` | Server fn або Vite middleware |
| `app/auth/callback/route.ts` | `NextResponse` | Server fn або API route |
| `app/(protected)/layout.tsx` | `redirect` з `next/navigation` | `beforeLoad` у `_authed` route |
| `app/(cms)/admin/layout.tsx` | `next/dynamic` | `ssr: false` на admin layout route |
| `app/theme-registry.server.ts` | — (чистий TS) | Переноситься as-is |

### Фаза 0.6 — App admin shims (next/dynamic): ~35 файлів

Усі `app/(cms)/admin/*/page.tsx` використовують однаковий патерн:
```
import dynamic from 'next/dynamic';
const Component = dynamic(() => import('@simplycms/admin/...'), { ssr: false });
```
У TanStack Start admin layout route визначається з `ssr: false`, і всі дочірні routes автоматично client-only. Жоден окремий `dynamic()` шім не потрібен — 35 файлів зникають повністю.

### Фаза 0.7 — next/image LCP-матриця

| Файл | LCP-критичний? | Атрибути |
|------|:--------------:|----------|
| `themes/*/BannerSlider.tsx` (hero) | **Так** | `fetchpriority="high"` + `loading="eager"` + `decoding="async"` + explicit `width`/`height` |
| `themes/*/Header.tsx` (logo) | **Так** | `fetchpriority="high"` + `loading="eager"` |
| `core/ProductGallery.tsx` (main) | **Так** | `fetchpriority="high"` + `loading="eager"` (тільки перше зображення) |
| `solarstore/HomePage.tsx` (hero) | **Так** | `fetchpriority="high"` + `loading="eager"` |
| Решта (~20 файлів) | Ні | `loading="lazy"` + `decoding="async"` |

Правило `NextImage fill` → CSS: `<img className="absolute inset-0 w-full h-full object-cover">` + батьківський `div position: relative`.

### Фаза 0.8 — next-themes → better-themes

`next-themes` має `next` як peer dependency і не підтримує Vite/TanStack Start офіційно. Замінити на `better-themes` — API-сумісний drop-in:

| Файл | Зміна |
|------|-------|
| `app/layout.tsx` | `import { ThemeProvider } from 'next-themes'` → `import { ThemeProvider } from 'better-themes'` |
| `ui/src/sonner.tsx` | `import { useTheme } from 'next-themes'` → `import { useTheme } from 'better-themes'` |
| `core/src/components/ThemeToggle.tsx` | `import { useTheme } from 'next-themes'` → `import { useTheme } from 'better-themes'` |

API зберігається: `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`.

### Фаза 0.9 — Supabase client env migration

| Файл | Зміна |
|------|-------|
| `core/src/supabase/client.ts` | `NEXT_PUBLIC_*` → `VITE_*` через `import.meta.env.*`; singleton pattern зберігається |
| `core/src/supabase/anon.ts` | `NEXT_PUBLIC_*` → `VITE_*` через `import.meta.env.*` |

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
5. **`next-themes` → `better-themes`.** Drop-in заміна, 3 файли.
6. **Auth guards — лише в `beforeLoad`.** Дублювання в layout components повністю прибирається.
7. **ISR → client-side invalidation.** `router.invalidate()` + React Query invalidation. CDN-level cache — окрема задача після міграції.
8. **Admin shims (next/dynamic) — зникають.** `ssr: false` на admin layout route.
9. **Server-only файли — виносяться з packages.** `supabase/server.ts`, `supabase/proxy.ts`, `getActiveThemeSSR.ts` переходять у `src/server/`.
10. **Жодних adapter-модулів `@simplycms/core/adapters/*` не створювати.**

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

## Архітектурні рішення

- **В який пакет додавати код:** новий код у цій фазі не додається; це audit + фіксація цільових контрактів
- **Rendering стратегія:** фіксується цільова: SSR для storefront (TanStack Start loaders), client-only для admin (`ssr: false`), `beforeLoad` для auth guards
- **Міграція з temp/:** не стосується
- **Залежності:** `next-themes` → `better-themes` (фіксується рішення, виконується у phase 1)
- **Формат артефакту:** inventory table + decision log у цьому файлі

## Зведена матриця файлів

| Зона | Файлів | Стратегія |
|------|--------|-----------|
| Core pages (prop-driven refactor) | 13 | Props замість router hooks |
| Core components (примітиви) | 11 | TanStack Link / `<img>` / callbacks |
| Admin pages (route-aware rewrite) | ~30 | Механічна заміна next/* → @tanstack/* |
| Admin components | 3 | `NextImage` → `<img>` |
| Theme components | 13 | TanStack Link / `<img>` / useNavigate |
| Server-only (packages) | 3 | Виносяться в src/server/ |
| Server-only (app) | 9 | Стають route definitions / server fns |
| App admin shims | ~35 | Зникають (ssr: false на layout route) |
| next-themes → better-themes | 3 | Drop-in заміна |
| **Разом** | **~120** | — |

## Пов'язана документація

- `docs/tasks/simplycms_tanstack_start_migration_task.md` — загальний план міграції
- `docs/tasks/migration-phase1-tanstack-start-bootstrap.md` — фаза прямого переписування примітивів
- `.github/instructions/architecture-core.instructions.md`
- `.github/instructions/coding-style.instructions.md`
- `.github/instructions/data-access.instructions.md` — Supabase client patterns
- `.github/instructions/ui-architecture.instructions.md` — система тем

## Definition of Done

- [ ] Є повний inventory `next/*` залежностей по `packages/`, `themes/`, `app/` з розбивкою по файлах
- [ ] Кожна залежність віднесена до категорії та має зафіксований цільовий контракт
- [ ] Є inventory table core pages з цільовим props-контрактом для кожної сторінки
- [ ] Є список admin pages для route-aware rewrite на TanStack Router
- [ ] Є список theme components з цільовими замінами `Link`/navigation/image API
- [ ] Є повний список server-only файлів з цільовим owner у TanStack Start
- [ ] Є LCP-матриця для всіх `next/image` використань
- [ ] Є рішення по next-themes → better-themes
- [ ] Є рішення по auth/proxy flow → beforeLoad + server functions
- [ ] Є рішення по ISR/cache → router.invalidate() + React Query
- [ ] Зафіксовано decision log з 10 прийнятими рішеннями
- [ ] Зафіксовано що adapter-механізм повністю виключений з плану міграції
