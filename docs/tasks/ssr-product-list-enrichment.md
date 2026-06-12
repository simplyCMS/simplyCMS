# Task: SSR для списків продуктів — винос enrichment-логіки на сервер

## Контекст

У рамках SSR-first рефакторингу (див. `typesafety-and-modernization.md`, фаза 1B) виявлено, що **списки продуктів на storefront-сторінках не рендеряться в серверному HTML**. Серверні сторінки (`app/(storefront)/catalog/page.tsx`, `[sectionSlug]/page.tsx`) fetch'ать базові продукти і передають їх як `initialProducts`, але клієнтські компоненти (`Catalog.tsx`, `CatalogSection.tsx`, `PropertyPage.tsx`) не можуть використати ці дані як `initialData` в React Query, тому що **формат серверних і клієнтських даних не збігається**.

### Причина невідповідності форматів

Клієнтський `queryFn` виконує **3-етапну збагачувальну обробку** (enrichment pipeline), яка повертає формат `EnrichedProduct`, а не сирий Supabase row:

1. **Modification enrichment** — додаткові запити `fetchModificationPropertyValues()` + `fetchModificationStockData()` за modification IDs
2. **Product mapping** — вибір `defaultMod`, об'єднання `propertyValues` (product-level + modification-level), нормалізація `images`, `section`, `has_modifications`
3. **Availability enrichment** — `enrichProductsWithAvailability()` додає поле `isAvailable`

Після цього `useMemo` ще виконує **price resolution** (`resolvePrice`) та **discount application** (`applyDiscount`).

Серверні сторінки fetch'ать лише `products.select('*, sections(*), product_modifications(*)')` — без prices, property values, stock, і без enrichment pipeline.

### Зачеплені сторінки

| Сторінка | Server Page | Client Component | Що не в SSR |
|----------|-------------|------------------|-------------|
| Каталог | `catalog/page.tsx` | `Catalog.tsx` | Повний список продуктів |
| Секція каталогу | `catalog/[sectionSlug]/page.tsx` | `CatalogSection.tsx` | Продукти секції |
| Характеристика-опція | `properties/[slug]/[option]/page.tsx` | `PropertyPage.tsx` | Продукти з характеристикою |

**Примітка:** Сторінки Properties, PropertyDetail, ProductDetail, HomePage вже мають робочий SSR через `initialData` (дані простіші і формати збігаються).

---

## Вимоги

- [ ] **1.** Crawler (Google, `curl`) отримує HTML з назвами, цінами та зображеннями продуктів для каталогу і секцій
- [ ] **2.** ProductCard рендериться в серверному HTML (хоча б назва, зображення, ціна, slug для посилання)
- [ ] **3.** Клієнтський React Query оновлює/збагачує дані після hydration (stock, discounts, availability) — це може бути client-only
- [ ] **4.** Не дублювати enrichment-логіку — один джерело правди
- [ ] **5.** Зберегти ISR revalidation (1800s каталог)
- [ ] **6.** Не додавати нових Supabase RPC або Edge Functions без обґрунтування

## Clarify (питання перед імплементацією)

- [ ] **Q1.** Який рівень деталізації потрібен в SSR HTML для SEO?
  - Чому це важливо: визначає скільки enrichment потрібно на сервері
  - Варіант A: мінімальний SSR (назва + зображення + slug) — достатньо для індексації посилань
  - Варіант B: повний SSR (назва + зображення + ціна + availability) — кращий SEO, але складніше
  - Вплив: архітектура, складність, час реалізації

- [ ] **Q2.** Чи можна спростити серверний формат даних та зробити two-pass rendering?
  - Чому це важливо: визначає чи потрібно дублювати enrichment pipeline на сервер
  - Варіант A: server рендерить SimplifiedProductCard, client замінює на повний ProductCard після hydration
  - Варіант B: витягнути enrichment в shared utility (працює і на server, і на client через різні Supabase клієнти)
  - Варіант C: перенести enrichment select на сервер (один великий `.select()` з joins), передати enriched data як `initialData`
  - Вплив: архітектура, UX (flash of simplified content)

- [ ] **Q3.** Price resolution залежить від `usePriceType()` (user category → price type) — це клієнтська логіка. Чи показувати ціни в SSR?
  - Чому це важливо: ціни залежать від авторизованого користувача (різні категорії мають різні типи цін)
  - Варіант A: SSR показує default price type ціни, client замінює на user-specific
  - Варіант B: SSR не показує ціни (тільки назву і зображення), client показує ціни після hydration
  - Вплив: SEO (Google Merchant Center хоче бачити ціни), UX

- [ ] **Q4.** Discounts (`useDiscountGroups`, `applyDiscount`) — серверний чи клієнтський розрахунок?
  - Чому це важливо: знижки можуть залежити від контексту (cart total, quantity, user category)
  - Рекомендація: discounts залишити client-only, SSR показує base price
  - Вплив: дані, UX

---

## Рекомендовані патерни

### Варіант A: Shared enrichment utility (рекомендований)

Витягнути enrichment pipeline в чисту функцію без залежності від конкретного Supabase клієнта. Серверна сторінка викликає цю функцію з server client, передає результат як `initialData`. Клієнтський `useQuery` використовує ту ж функцію з browser client, отримує `initialData` для миттєвого рендерингу.

- Де шукати поточну логіку: `packages/simplycms/core/src/hooks/useProductsWithStock.ts` — `fetchModificationPropertyValues`, `fetchModificationStockData`, `enrichProductsWithAvailability`
- Де шукати клієнтський pipeline: `Catalog.tsx` рядки 64-116, `CatalogSection.tsx` рядки 86-145
- Де шукати price resolution: `packages/simplycms/core/src/lib/priceUtils.ts` — `resolvePrice` (чиста функція, вже server-compatible)

### Варіант B: Two-pass rendering з fallback

Server рендерить продукти з базовими даними (без stock enrichment, без modification property values). Client query refetch'ить з повним enrichment. Потрібен `ProductCardSkeleton` або simplified `ProductCard` для серверного рендерингу.

- Де шукати ProductCard: `packages/simplycms/core/src/components/catalog/ProductCard.tsx`

### Варіант C: Розширений серверний select

Серверні сторінки виконують той самий `.select()` що і клієнт (з prices, stock, property values). Це усуває різницю форматів, але збільшує час серверної відповіді та payload.

- Де шукати серверний select: `app/(storefront)/catalog/page.tsx` рядки 11-19
- Порівняти з клієнтським: `Catalog.tsx` рядки 70-80

---

## Антипатерни (уникати)

### ❌ Дублювання enrichment-логіки в серверних та клієнтських компонентах
Одна й та ж логіка не повинна існувати в двох місцях. Виносити в shared utility.

### ❌ Імпорт browser Supabase client в серверних компонентах
`useProductsWithStock.ts` використовує `"use client"` і browser client. Shared utility має приймати Supabase client як параметр.

### ❌ Блокування серверної відповіді складними enrichment запитами
Якщо enrichment потребує 3+ sequential запити — краще зробити базовий SSR і збагатити на клієнті.

### ❌ Flash of unstyled/empty content під час hydration
Якщо SSR рендерить simplified view, а client замінює повним — перехід має бути плавним (не моргати).

### ❌ Видалення існуючого SSR для sections/properties заради уніфікації
Sections та properties вже працюють через `initialData` — не ламати те, що працює.

---

## Архітектурні рішення

- **Основний пакет змін:** `@simplysoftua/core` — shared enrichment utilities
- **Зачеплені файли:**
  - `packages/simplycms/core/src/hooks/useProductsWithStock.ts` — рефакторинг в client-agnostic utilities
  - `packages/simplycms/core/src/pages/Catalog.tsx` — `initialData` в products query
  - `packages/simplycms/core/src/pages/CatalogSection.tsx` — `initialData` в products query
  - `packages/simplycms/core/src/pages/PropertyPage.tsx` — `initialData` в products query
  - `app/(storefront)/catalog/page.tsx` — розширений серверний fetch + enrichment
  - `app/(storefront)/catalog/[sectionSlug]/page.tsx` — розширений серверний fetch + enrichment
  - `app/(storefront)/properties/[propertySlug]/[optionSlug]/page.tsx` — серверний enrichment
- **Rendering стратегія:** SSR+ISR з `initialData` (розширити існуючий патерн з `HomePage`)
- **Міграція з temp/:** не потрібна

---

## MCP Servers (за потреби)

- **context7** — React Query `initialData` типізація, Next.js Server Components data passing patterns
- **supabase** — оптимізація `.select()` запитів з joins для зменшення кількості запитів

---

## Пов'язана документація

- `docs/tasks/typesafety-and-modernization.md` — батьківська задача (фази 1B, 1C, 1D)
- `BRD_SIMPLYCMS_NEXTJS.md` секція 9 — SSR стратегія, ISR, initialData патерн
- `.github/instructions/data-access.instructions.md` — Supabase server vs browser clients
- `.github/instructions/optimization.instructions.md` — SSR/ISR, React Query caching
- `themes/default/pages/HomePage.tsx` — **робочий приклад SSR initialData для продуктів** (спрощений формат без enrichment)
- `packages/simplycms/core/src/hooks/useProductsWithStock.ts` — enrichment pipeline (джерело правди)
- `packages/simplycms/core/src/lib/priceUtils.ts` — `resolvePrice` (вже server-compatible)

---

## Definition of Done

- [ ] `curl localhost:3000/catalog` повертає HTML з назвами та зображеннями продуктів (не порожній grid)
- [ ] `curl localhost:3000/catalog/{sectionSlug}` — аналогічно
- [ ] `curl localhost:3000/properties/{slug}/{option}` — аналогічно
- [ ] Enrichment-логіка не дубльована (один shared utility)
- [ ] React Query `initialData` використовується для продуктів на всіх трьох сторінках
- [ ] Клієнтський refetch збагачує дані (stock, discounts) після hydration
- [ ] `pnpm typecheck` — 0 помилок
- [ ] `pnpm build` — успішний
- [ ] ISR revalidation працює (зміна продукту → оновлення HTML після timeout)
- [ ] Немає візуального "моргання" при hydration (продукти не зникають і не змінюють порядок)
