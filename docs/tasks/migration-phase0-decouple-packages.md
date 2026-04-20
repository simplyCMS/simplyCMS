# Task: Phase 0 — Відв'язка пакетів від Next.js примітивів

## Контекст

Проєкт `simplyCMS` мігрує з Next.js App Router на TanStack Start + Vite. Перед встановленням нового фреймворка потрібно **прибрати пряму залежність** пакетів `@simplycms/core`, `@simplycms/admin`, `@simplycms/themes` і `themes/*` від `next/*` імпортів.

Зараз Next.js API проникає в усі шари проєкту. За результатами аудиту:

- **`@simplycms/core`** — ~30 точок у pages/ і components/: `next/navigation` (useParams, useRouter, useSearchParams, usePathname, redirect), `next/link` (Link), `next/image` (Image), `next/headers` (cookies), `next/server` (NextResponse, NextRequest)
- **`@simplycms/admin`** — ~40 точок у pages/, layouts/AdminLayout.tsx, components/ImageUpload.tsx, components/ProductModifications.tsx: `next/navigation`, `next/link`, `next/image`
- **`@simplycms/theme-system`** — 1 точка: `next/cache` (unstable_cache)
- **`@simplycms/ui`** — 1 точка: `next-themes` (useTheme) — **залишити як є**, працює без Next.js
- **`themes/default`** і **`themes/solarstore`** — ~15 точок: `next/link`, `next/image`, `next/navigation`

> **ВАЖЛИВО:** Числа орієнтовні. Перед імплементацією виконати свіжий `grep -r 'from "next/' packages/ themes/` для точного inventory.

Мета цієї фази — **централізувати всі framework-specific імпорти** в тонкий adapter-шар всередині `@simplycms/core`, щоб решта коду залежала від адаптерів, а не напряму від `next/*`. Це дозволить Phase 1 перемкнути адаптери на TanStack Router без масового рефакторингу.

**Зворотня сумісність не потрібна** — проєкт ще не в production, можна робити будь-які breaking changes.

## Вимоги

- [ ] Створити модуль адаптера роутингу в `@simplycms/core` з re-exports: `Link`, `useRouter`, `useParams`, `usePathname`, `useSearchParams`, `useNavigate`, `redirect`
- [ ] Створити модуль адаптера зображень в `@simplycms/core` з компонентом `OptimizedImage` (тонка обгортка навколо `next/image`, яку потім замінять)
- [ ] Замінити **всі** прямі `from "next/link"` імпорти в `packages/simplycms/core/src/` на імпорт з адаптера роутингу
- [ ] Замінити **всі** прямі `from "next/navigation"` імпорти в `packages/simplycms/core/src/` на імпорт з адаптера роутингу
- [ ] Замінити **всі** прямі `from "next/image"` імпорти в `packages/simplycms/core/src/` на імпорт з адаптера зображень
- [ ] Замінити **всі** прямі `from "next/link"`, `"next/navigation"`, `"next/image"` імпорти в `packages/simplycms/admin/src/` на імпорти з адаптерів
- [ ] Замінити **всі** прямі `from "next/link"`, `"next/navigation"`, `"next/image"` імпорти в `themes/default/` і `themes/solarstore/` на імпорти з адаптерів
- [ ] Замінити `next/dynamic` в `app/(cms)/admin/` на `React.lazy` + `Suspense` (або залишити поки — ці файли будуть видалені в Phase 7)
- [ ] Позначити `packages/simplycms/core/src/supabase/server.ts` (cookies з `next/headers`) і `packages/simplycms/core/src/supabase/proxy.ts` (NextResponse/NextRequest з `next/server`) як **server-only файли що будуть переписані в Phase 2** — поки не чіпати, але задокументувати залежність
- [ ] Позначити `packages/simplycms/theme-system/src/getActiveThemeSSR.ts` (unstable_cache з `next/cache`) як **файл що буде переписаний в Phase 5** — поки не чіпати
- [ ] Додатково перевірити `packages/simplycms/admin/src/components/` і `packages/simplycms/admin/src/layouts/` на прямі `next/*` імпорти, а не лише `pages/`
- [ ] Зафіксувати що `packages/simplycms/core/src/supabase/client.ts` містить `"use client"` і browser singleton pattern; сам файл не змінювати в цій фазі, але врахувати його адаптацію в Phase 1
- [ ] Після заміни: `pnpm typecheck` проходить без помилок
- [ ] Після заміни: `pnpm build` проходить (Next.js ще залишається runtime)
- [ ] Після заміни: `pnpm dev` працює без регресій

## Clarify (питання перед імплементацією)

- [ ] Який шлях використовувати для модулів адаптера?
  - Чому це важливо: визначає import path для всіх споживачів
  - Варіант A: `@simplycms/core/adapters/router` і `@simplycms/core/adapters/image` (рекомендовано)
  - Варіант B: `@simplycms/core/router` і `@simplycms/core/image` (коротше, але може конфліктувати з існуючими exports)
  - Вплив: DX, відсутність конфліктів з barrel export у `@simplycms/core`

- [ ] Чи потрібно адаптувати API компонента Link (href → to)?
  - Чому це важливо: Next.js Link приймає `href`, TanStack Router Link приймає `to`. Якщо адаптер зберігає `href` prop, перемикання стане простішим
  - Варіант A: Адаптер приймає `href` і маппить на внутрішню реалізацію (рекомендовано для плавного переходу)
  - Варіант B: Одразу перейти на `to` prop (менше роботи в Phase 1, але більше змін тут)
  - Додатково: адаптер має зберегти сумісність по `className`, `children`, `target`, `rel`, `onClick` і базових anchor props
  - Вплив: обсяг роботи в Phase 0 vs Phase 1

- [ ] Що робити з `next-themes` (useTheme)?
  - Чому це важливо: `next-themes` працює без Next.js (це чистий React пакет), але назва вводить в оману
  - Варіант A: Залишити як є — `next-themes` сумісний з будь-яким React (рекомендовано)
  - Варіант B: Замінити на власну реалізацію dark/light mode
  - Вплив: обсяг роботи

## Рекомендовані патерни

### Тонкий adapter-модуль для роутингу

Модуль має бути максимально тонким: тільки re-exports і мінімальний маппінг props. Жодної бізнес-логіки. На цьому етапі — re-export з `next/*`. У Phase 1 — заміна на `@tanstack/react-router`.

- Де створювати: `packages/simplycms/core/src/adapters/router.tsx`
- Що має експортувати: `Link`, `useRouter`, `useParams`, `usePathname`, `useSearchParams`, `useNavigate`, `redirect`
- Зразок підходу: кожен export — тонка обгортка або прямий re-export

### Тонкий adapter для зображень

Компонент-обгортка з props-контрактом (src, alt, width, height, className, fill, priority). Зараз — делегує `next/image`. В Phase 1 — стане звичайним `<img>` або інтеграцією з Vite image optimizer.

- Де створювати: `packages/simplycms/core/src/adapters/image.tsx`

### Контракт Link адаптера

Адаптер `Link` має підтримувати всі props що активно використовуються в темах і пакетах: `href` (обовʼязковий), `className`, `children`, `target`, `onClick`, `prefetch`. Теми (`Header.tsx`, `Footer.tsx`, `ProductCard.tsx`) масово використовують ці props — адаптер не має їх втрачати.

### Увага: `supabase/client.ts`

`packages/simplycms/core/src/supabase/client.ts` має `"use client"` директиву і singleton з `typeof window !== "undefined"` guard. В Phase 0 цей файл **не чіпати** (він framework-agnostic по суті), але врахувати що `"use client"` буде видалено в Phase 1 — singleton pattern з window-перевіркою має залишитися.

### Масовий пошук і заміна

Для кожного пакету виконати grep по `from "next/` або `from 'next/`, зібрати повний список файлів, замінити імпорти на адаптери. Перевірити типи після кожного пакету.

- Порядок: core → admin → themes/default → themes/solarstore
- Після кожного пакету: `pnpm typecheck`

## Антипатерни (уникати)

### ❌ Створювати складний абстракційний шар
Адаптер — це тонка прошарка для заміни, а не фреймворк над фреймворком. Жодних фабрик, провайдерів, конфігурацій. Тільки re-exports і мінімальний маппінг props.

### ❌ Чіпати server-only файли на цьому етапі
`supabase/server.ts`, `supabase/proxy.ts`, `getActiveThemeSSR.ts` — залежать від Next.js server API (`cookies()`, `NextResponse`, `unstable_cache`). Вони будуть повністю переписані в Phase 2 і Phase 5. Чіпати їх зараз — подвійна робота.

### ❌ Видаляти `"use client"` директиви
На цьому етапі Next.js ще є runtime. Видалення `"use client"` зламає збірку. Це буде зроблено в Phase 1 або Phase 7.

### ❌ Змінювати структуру routes в `app/`
`app/` директорія залишається без змін до Phase 3-4. Ця фаза стосується лише packages і themes.

## Архітектурні рішення

- **В який пакет додавати код:** `@simplycms/core` (нова директорія `adapters/`)
- **Rendering стратегія:** без змін (Next.js залишається runtime)
- **Міграція з temp/:** не стосується цієї фази
- **Залежності:** жодних нових npm-пакетів

## Зачеплені файли

### Нові файли

| Файл | Опис |
|------|------|
| `packages/simplycms/core/src/adapters/router.tsx` | Adapter для роутингу (Link, useRouter, useParams, etc.) |
| `packages/simplycms/core/src/adapters/image.tsx` | Adapter для зображень (OptimizedImage) |
| `packages/simplycms/core/src/adapters/index.ts` | Barrel export |

### Файли для заміни імпортів — core (~30 файлів)

Повний список файлів в `packages/simplycms/core/src/` з `next/*` імпортами:

**pages/:** ProductDetail, Catalog, CatalogSection, PropertyDetail, PropertyPage, Properties, Cart, Checkout, Auth, Profile, ProfileOrders, ProfileOrderDetail, OrderSuccess, NotFound

**components/:** NavLink, catalog/ProductCard, catalog/ProductGallery, catalog/ProductCharacteristics, catalog/CatalogLayout, cart/CartDrawer, cart/CartItem, reviews/ReviewCard, reviews/ProductReviews, profile/ProfileLayout, profile/AvatarUpload

### Файли для заміни імпортів — admin (~30 файлів)

Всі файли в `packages/simplycms/admin/src/pages/` (~40 файлів), а також:
- `layouts/AdminLayout.tsx` — `next/link`, `next/navigation`
- `components/ImageUpload.tsx` — `next/image`
- `components/ProductModifications.tsx` — `next/image`
- `components/ReviewDetail.tsx` — `next/image` (якщо не в pages/)

> Перед імплементацією зробити повний grep по `packages/simplycms/admin/src/`, щоб підтвердити повний список `pages/`, `components/` і `layouts/`.

### Файли для заміни імпортів — themes (~12 файлів)

**themes/default/:** components/Header, Footer, ProductCard, BannerSlider, BrandCarousel, ProductCarousel; layouts/ProfileLayout

**themes/solarstore/:** components/Header, Footer; pages/HomePage; layouts/ProfileLayout

## Пов'язана документація

- `docs/tasks/simplycms_tanstack_start_migration_task.md` — загальний план міграції (референс)
- `.github/instructions/architecture-core.instructions.md` — rendering стратегії, пакетна структура
- `.github/instructions/coding-style.instructions.md` — стиль коду, TypeScript strict mode

## Definition of Done

- [ ] Жоден файл в `packages/simplycms/core/src/` (крім `supabase/server.ts` і `supabase/proxy.ts`) не імпортує напряму з `next/*`
- [ ] Жоден файл в `packages/simplycms/admin/src/` не імпортує напряму з `next/*`
- [ ] Жоден файл в `themes/default/` і `themes/solarstore/` не імпортує напряму з `next/*`
- [ ] Всі framework-specific імпорти проходять через `@simplycms/core/adapters/*`
- [ ] Повний grep по `packages/simplycms/admin/src/` підтверджує що `pages/`, `components/` і `layouts/` очищені від прямих `next/*` імпортів
- [ ] `pnpm typecheck` проходить без помилок
- [ ] `pnpm build` проходить без помилок
- [ ] `pnpm dev` працює — storefront, admin, auth функціонують як раніше
- [ ] `packages/simplycms/core/src/supabase/server.ts`, `proxy.ts` і `theme-system/src/getActiveThemeSSR.ts` задокументовані як TODO для Phase 2/5
