# Аналіз конкурентних e-commerce CMS рішень та порівняння з SimplyCMS

> **Дата:** 2026-02-17
> **Автор:** Claude Code (автоматизований аналіз)
> **Мета:** Дослідити 9 open-source e-commerce/CMS проєктів та виявити можливості для покращення SimplyCMS
>
> **[Примітка 2026-07-30]** Аналіз робився ще на Next.js-версії SimplyCMS. Застаріло: рекомендації `"use cache"`/`cacheLife()`/ISR (Next-специфіка), «cart/checkout — заглушки» (реалізовано), «0 тестів» (є 53 unit-тести). Досі актуально: пошук по каталогу, URL-фільтрація/пагінація (див. seo-ssr-faceted-navigation), i18n, BreadcrumbList/Organization JSON-LD, image polish, e2e-тести.

---

## Зміст

1. [Резюме](#1-резюме)
2. [Досліджені проєкти](#2-досліджені-проєкти)
3. [Порівняльна таблиця](#3-порівняльна-таблиця)
4. [Детальний аналіз за категоріями](#4-детальний-аналіз-за-категоріями)
   - 4.1 [Архітектура та рендеринг](#41-архітектура-та-рендеринг)
   - 4.2 [SEO](#42-seo)
   - 4.3 [Кошик та Checkout](#43-кошик-та-checkout)
   - 4.4 [Пошук та фільтрація](#44-пошук-та-фільтрація)
   - 4.5 [Зображення](#45-зображення)
   - 4.6 [Тема та UI](#46-тема-та-ui)
   - 4.7 [Адмін-панель](#47-адмін-панель)
   - 4.8 [Автентифікація](#48-автентифікація)
   - 4.9 [Тестування](#49-тестування)
5. [Поточний стан SimplyCMS](#5-поточний-стан-simplycms)
6. [Рекомендації для SimplyCMS](#6-рекомендації-для-simplycms)
7. [Пріоритетний план дій](#7-пріоритетний-план-дій)

---

## 1. Резюме

Проведено дослідження 9 open-source e-commerce та CMS проєктів з різними архітектурними підходами — від headless commerce frontend-ів (Vercel Commerce, Saleor Storefront, YourNextStore) до повних CMS-платформ (Optimizely, ButterCMS Starter) та гібридних рішень (Crystallize, cms-kit). Ключові висновки:

**SimplyCMS вже має перевагу** над більшістю конкурентів завдяки:
- Вбудованій адмін-панелі з 40+ сторінками управління
- Мульти-темній системі з SSR-рендерингом
- Повній автентифікації (email + Google OAuth)
- Системі плагінів та розширюваності
- JSON-LD структурованим даним на продуктових сторінках

**Основні можливості для покращення:**
- Кошик та checkout потребують завершення (зараз заглушки)
- Відсутній пошук по каталогу
- Немає `useOptimistic` для кошика (React 19 паттерн)
- Тестування відсутнє (лише 1 порожній файл)
- Немає `"use cache"` / `cacheLife()` (Next.js 16 можливість)

---

## 2. Досліджені проєкти

| # | Проєкт | Тип | Стек | Зірки |
|---|--------|-----|------|-------|
| 1 | **vercel/commerce** | Headless storefront | Next.js 16 + Shopify | 12.1k |
| 2 | **bigcommerce/nextjs-commerce** | Headless storefront | Next.js + BigCommerce | 1k |
| 3 | **yournextstore** (YNS) | SaaS storefront | Next.js 16 + Stripe | 4.4k |
| 4 | **saleor/storefront** | Headless storefront | Next.js 15 + Saleor GraphQL | 1.2k |
| 5 | **CrystallizeAPI/furniture-remix** | Demo storefront | Remix + Crystallize API | 0.2k |
| 6 | **kemalkujovic/nextjs-ecommerce** | Шаблон e-commerce | Next.js 15 + Supabase | 0.1k |
| 7 | **focusreactive/cms-kit** | CMS-агрегатор | Next.js + Sanity/Contentful | 0.3k |
| 8 | **ButterCMS/nextjs-starter-buttercms** | CMS starter | Next.js 14 + ButterCMS | 0.1k |
| 9 | **Optimizely-SaaS-CMS-Next.js-15** | Enterprise CMS | Next.js 15 + Optimizely | 0.1k |

---

## 3. Порівняльна таблиця

| Функція | SimplyCMS | Vercel Commerce | YNS | Saleor | Crystallize | BigCommerce |
|---------|-----------|----------------|-----|--------|-------------|-------------|
| **Framework** | Next.js 16 | Next.js 16 | Next.js 16 | Next.js 15 | Remix | Next.js 15 |
| **Admin Panel** | Вбудована (40+ стор.) | Немає | Зовнішня | Окремий Dashboard | Зовнішня | Зовнішня |
| **Theme System** | Multi-theme + SSR | Single theme | Single theme | Single theme | Single theme | Single theme |
| **Auth** | Supabase (email+Google) | Немає | Немає | JWT + Supabase | Немає | Немає |
| **Cart** | localStorage (заглушка) | Cookie + Server | Cookie + useOptimistic | Server-side | Cookie + Service Worker | Cookie + Server |
| **Checkout** | Заглушка | Shopify hosted | Stripe proxy | Multi-step | Crystallize/Stripe | BigCommerce hosted |
| **SEO: Metadata** | generateMetadata (4 стор.) | generateMetadata | Тільки root | generateMetadata | meta export | generateMetadata |
| **SEO: sitemap.ts** | Є (динамічний) | Є | Немає | Є | Немає | Є |
| **SEO: robots.ts** | Є | Є | Немає | Є | Немає | Є |
| **SEO: JSON-LD** | Product schema | Product + Breadcrumb | Немає | Немає | Немає | Product + Offer |
| **Search** | Немає | Немає (Shopify API) | Немає | Немає | Немає (API) | Немає (API) |
| **Filtering** | Немає | URL params | Немає | Немає | URL params | URL params |
| **Image handling** | next/image | next/image + blur | next/image (custom) | next/image | Cloudinary | next/image |
| **Caching** | revalidate ISR | `"use cache"` + cacheLife | `"use cache"` + cacheLife | ISR + revalidate | HTTP headers | ISR |
| **Testing** | Немає | Playwright e2e | Немає | Немає | Немає | Немає |
| **i18n** | Немає (укр. hardcode) | Shopify locales | Немає | Saleor channels | URL-based | Немає |
| **Plugin System** | Є | Немає | Немає | Немає | Немає | Немає |
| **DB** | Supabase (PostgreSQL) | Shopify API | YNS API (Stripe) | Saleor GraphQL | Crystallize API | BigCommerce API |

---

## 4. Детальний аналіз за категоріями

### 4.1 Архітектура та рендеринг

#### Найкращі практики з досліджених проєктів

**Vercel Commerce та YNS** використовують новітній підхід Next.js 16 — `"use cache"` директиву з гранулярними TTL:
```tsx
// Vercel Commerce / YNS паттерн
"use cache";
import { cacheLife } from "next/cache";

export default async function ProductPage({ params }) {
  cacheLife("minutes"); // або "hours", "seconds"
  // ...
}
```

Це замінює `unstable_cache` та `revalidate` — більш явний та гнучкий контроль кешування.

**Saleor Storefront** використовує класичний ISR з `revalidate`:
```tsx
export const revalidate = 60;
```

**Crystallize (Remix)** використовує HTTP headers для кешування:
```tsx
headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" }
```

#### Стан SimplyCMS

SimplyCMS використовує `export const revalidate = 3600` (ISR) — це працює, але менш гнучко ніж `"use cache"` + `cacheLife()`. Оскільки проєкт вже на Next.js 16, міграція на новий API кешування буде природною.

**Server/Client компонентний поділ** — SimplyCMS робить це добре: сторінки (page.tsx) — серверні, теми отримують дані через props. Це той самий паттерн що використовує YNS та Vercel Commerce.

#### Рекомендація
- Мігрувати з `revalidate` на `"use cache"` + `cacheLife()` для гранулярного кешування
- Різні TTL: `"seconds"` для замовлень, `"minutes"` для продуктів, `"hours"` для навігації

---

### 4.2 SEO

#### Порівняння підходів

**Vercel Commerce** — найкращий SEO серед досліджених:
- `generateMetadata()` на всіх динамічних сторінках (products, collections, pages)
- JSON-LD: Product schema + BreadcrumbList + Organization
- Динамічний `sitemap.ts` з продуктами та колекціями
- `robots.ts` з блокуванням admin та API
- `generateStaticParams()` для pre-rendering
- Open Graph images

**BigCommerce** — близько до Vercel Commerce:
- `generateMetadata()` на продуктових та колекційних сторінках
- Product JSON-LD зі schema.org/Offer
- Динамічний sitemap

**Saleor** — помірний:
- `generateMetadata()` на продуктових сторінках
- `sitemap.ts`, `robots.ts`
- Немає JSON-LD

**YNS** — найгірший SEO:
- Тільки статичний metadata на root layout
- Немає sitemap, robots, JSON-LD, OG tags

#### Стан SimplyCMS

SimplyCMS має **середній рівень SEO**:
- `generateMetadata()` на 4 динамічних сторінках (product, section, property, propertyOption) — **добре**
- `sitemap.ts` з продуктами та секціями — **добре**
- `robots.ts` з блокуванням /admin/ та /api/ — **добре**
- JSON-LD Product schema на продуктовій сторінці — **добре**
- Немає BreadcrumbList JSON-LD — **прогалина**
- Немає Organization JSON-LD — **прогалина**
- Немає `generateStaticParams()` для pre-rendering — **прогалина**
- Немає dynamic OG images — **прогалина**

#### Рекомендації
1. Додати BreadcrumbList JSON-LD на продуктових сторінках
2. Додати Organization JSON-LD у root layout
3. Додати `generateStaticParams()` для продуктів та секцій
4. Розглянути `opengraph-image.tsx` для динамічних OG зображень
5. Додати `generateMetadata()` на головну сторінку (зараз статичний `metadata`)

---

### 4.3 Кошик та Checkout

#### Найкращі практики

**YNS — кращий паттерн для кошика:**
- Cookie-based cart (httpOnly, secure) — безпечніше за localStorage
- `useOptimistic` (React 19) для миттєвого UI feedback
- Server Actions для мутацій кошика
- Серверна ініціалізація кошика в layout (без loading spinner)

```tsx
// YNS паттерн — useOptimistic для кошика
const [optimisticCart, dispatch] = useOptimistic(initialCart, (state, action) => {
  switch (action.type) {
    case "ADD_ITEM": // миттєве оновлення UI
    case "REMOVE":   // сервер оновиться async
  }
});
```

**Vercel Commerce:**
- Cookie-based cart з Shopify API
- Server Actions (addItem, removeItem, updateItemQuantity)
- Cart sidebar (Sheet) — UX-стандарт

**Saleor:**
- Server-side cart у Checkout API
- Multi-step checkout з валідацією на кожному кроці
- Адреси, спосіб доставки, оплата — окремі кроки

**Crystallize:**
- Service Worker для офлайн кошика
- Custom checkout з Stripe/Klarna інтеграцією

#### Стан SimplyCMS

**Критична проблема**: Кошик та checkout — заглушки.

- `app/(storefront)/cart/page.tsx` — порожня сторінка
- `app/(storefront)/checkout/page.tsx` — порожня сторінка
- `useCart` хук існує і працює (localStorage, add/remove/update)
- CartButton, CartDrawer, CartItem компоненти існують
- Але серверної інтеграції немає

**Архітектурні рішення:**
- Кошик зберігається в localStorage — вразливий до очищення, не синхронізується між пристроями
- Немає server-side validation цін (клієнт може маніпулювати)
- Ціни беруться з клієнтського стану, а не верифікуються сервером

#### Рекомендації
1. **Критично:** Завершити Cart page та Checkout flow
2. Мігрувати кошик з localStorage на cookie + Supabase (для авторизованих користувачів)
3. Впровадити `useOptimistic` (React 19) для миттєвого UI
4. Server Actions для мутацій кошика з серверною валідацією цін
5. Multi-step checkout: Контактні дані → Доставка → Оплата → Підтвердження
6. Інтеграція з системою доставки (вже є shipping zones/methods в адмін)

---

### 4.4 Пошук та фільтрація

#### Найкращі практики

**Vercel Commerce (Shopify API):**
- URL-based search: `/search?q=keyword`
- Фільтрація через URL params: `/search?q=shirt&sort=price-asc`
- Сортування: price-asc, price-desc, created-desc, relevance

**BigCommerce:**
- Faceted filtering: price range, brand, categories
- URL-based: все у search params
- Server-side filtering через BigCommerce API

**Crystallize:**
- Faceted search з Crystallize API
- Фільтри по властивостях: price range, attributes
- URL-based state management

**YNS:**
- URL-based variant selection: `?Color=Black&Size=Large`
- Немає пошуку по каталогу

#### Стан SimplyCMS

**Пошуку та фільтрації немає.**

- Каталог завантажує ВСІ продукти одним запитом
- Немає пагінації на серверному рівні
- Немає фільтрів по секціям, ціні, властивостях
- Немає сортування
- Properties сторінки існують (`/properties/[slug]/[option]`), але не інтегровані з каталогом

#### Рекомендації
1. Додати серверний пошук через Supabase full-text search або `ilike`
2. URL-based фільтрація: `/catalog?section=solar&price_min=100&sort=price-asc`
3. Серверна пагінація (limit/offset або cursor-based)
4. Фільтри: секції, ціна, наявність, властивості
5. Сортування: ціна, новинки, популярність

---

### 4.5 Зображення

#### Найкращі практики

**Vercel Commerce:**
- `next/image` з `fill` layout + `sizes` responsive
- `blurDataURL` для placeholder під час завантаження
- `priority` для above-the-fold зображень
- Кілька зображень у grid layout (1 велике + 2 менших)

**YNS:**
- Custom `YNSImage` wrapper з polling у dev-mode
- Image hover swap на карточках (2 зображення, CSS opacity transition)
- Zoom-on-click у галереї
- Thumbnail navigation

**Crystallize:**
- Cloudinary CDN для оптимізації
- Responsive srcset

#### Стан SimplyCMS

- `next/image` використовується у темах — **добре**
- Немає placeholder/blur — **прогалина**
- Немає image hover swap на карточках — **естетична прогалина**
- Немає zoom на продуктовій сторінці — **UX прогалина**

#### Рекомендації
1. Додати `blurDataURL` або shimmer placeholder для зображень
2. Image hover swap на product cards (показати друге фото при hover)
3. Zoom функціональність на продуктовій сторінці
4. `priority` flag на above-the-fold зображеннях (hero, перші 4 продукти)

---

### 4.6 Тема та UI

#### Порівняння підходів

**SimplyCMS** — має найпросунутішу тему-систему серед усіх досліджених:
- 2 повних теми (default + solarstore), кожна з 16 сторінками
- Build-time registration + runtime DB activation
- SSR resolution через `getActiveThemeSSR()`
- Admin UI для перемикання тем

**Жоден інший досліджений проєкт не має multi-theme системи.** Це значна конкурентна перевага.

**Optimizely** має "Visual Builder" з drag-and-drop, але це не тема-система.

**cms-kit** має мульти-CMS підтримку (Sanity, Contentful, Wordpress), але single-theme.

#### Стан SimplyCMS — UI

- shadcn/ui (Radix primitives) — **стандарт індустрії** (використовують Vercel Commerce, YNS, Saleor)
- Tailwind CSS v4 — **актуально**
- OKLCH кольори — не використовуються (YNS використовує)

#### Рекомендації
- Тема-система — конкурентна перевага, продовжувати розвивати
- Розглянути OKLCH кольорову модель для тем (perceptually uniform)
- Додати theme preview у адмін-панелі

---

### 4.7 Адмін-панель

#### Порівняння

**SimplyCMS** — має найповнішу вбудовану адмін-панель серед досліджених:
- 40+ сторінок управління
- Продукти, секції, замовлення, користувачі, знижки
- Доставка (зони, методи, точки самовивозу)
- Теми, плагіни, мови, банери
- Рецензії, сервісні запити, цінові типи
- Категорії користувачів з правилами

**Жоден headless frontend не має вбудованої адмін-панелі** — всі залежать від зовнішніх dashboards (Shopify, Saleor Dashboard, YNS Admin, BigCommerce).

**Optimizely** має power admin через Optimizely SaaS, але це окремий продукт.

#### Стан SimplyCMS
Адмін-панель — зріла та функціональна. Це основна конкурентна перевага.

---

### 4.8 Автентифікація

#### Порівняння

| Проєкт | Auth |
|--------|------|
| SimplyCMS | Supabase Auth (email/password + Google OAuth) |
| Vercel Commerce | Немає |
| YNS | Немає |
| Saleor | JWT + email/password |
| Crystallize | Немає |
| BigCommerce | Немає |
| Optimizely | Немає (у frontend) |

**SimplyCMS** — єдиний серед headless frontends з повною автентифікацією. Вхід/реєстрація з Zod валідацією, Google OAuth, захищені маршрути.

#### Рекомендації
- Додати "Забув пароль" flow
- Розглянути Apple OAuth
- Додати 2FA (опціонально)

---

### 4.9 Тестування

#### Порівняння

Сумна реальність: **майже ніхто не має тестів**.

| Проєкт | Тести |
|--------|-------|
| SimplyCMS | 0 тестів (1 порожній файл) |
| Vercel Commerce | Playwright e2e (єдиний!) |
| YNS | Немає |
| Saleor | Немає (в storefront) |
| Crystallize | Немає |
| BigCommerce | Немає |

**Vercel Commerce** — єдиний з e2e тестами (Playwright). Це встановлює мінімальний стандарт.

#### Рекомендації
1. Unit тести для критичних утиліт (discountEngine, calculateRate, cartUtils)
2. Integration тести для серверних data-fetching функцій
3. E2E тести для основних flows: каталог → продукт → кошик → checkout

---

## 5. Поточний стан SimplyCMS

### Сильні сторони

| Функціональність | Оцінка | Деталі |
|------------------|--------|--------|
| Адмін-панель | Відмінно | 40+ сторінок, повне управління контентом |
| Тема-система | Відмінно | Multi-theme SSR, 2 теми з 16 сторінками кожна |
| Автентифікація | Добре | Email + Google OAuth + Zod validation |
| SEO: базовий | Добре | sitemap, robots, generateMetadata, JSON-LD Product |
| Архітектура | Добре | Server/Client split, SSR, theme registry |
| Plugin system | Добре | Розширювана архітектура |
| Shipping | Добре | Зони, методи, точки самовивозу |
| Discounts | Добре | Система знижок з групами |

### Прогалини

| Функціональність | Оцінка | Деталі |
|------------------|--------|--------|
| Cart/Checkout | Критично | Сторінки — заглушки, немає повного flow |
| Пошук/фільтрація | Відсутнє | Немає пошуку, фільтрів, пагінації |
| Тестування | Відсутнє | 0 тестів |
| Кешування | Застаріле | `revalidate` ISR замість `"use cache"` |
| Image UX | Середнє | Немає blur placeholder, hover swap, zoom |
| SEO: розширений | Середнє | Немає BreadcrumbList, Organization, OG images |
| i18n | Відсутнє | Hardcoded Ukrainian |

---

## 6. Рекомендації для SimplyCMS

### Паттерни, які варто запозичити

#### Від YourNextStore:
1. **`useOptimistic` для кошика** — миттєвий UI feedback без TanStack Query
2. **Cookie-based cart** замість localStorage — httpOnly, secure, server-readable
3. **Server-side cart initialization в layout** — без loading spinner
4. **Image hover swap** на product cards — CSS opacity transition
5. **Sticky image gallery** на product page

#### Від Vercel Commerce:
1. **`"use cache"` + `cacheLife()`** — гранулярне кешування замість ISR
2. **BreadcrumbList + Organization JSON-LD** — повний SEO
3. **`generateStaticParams()`** — pre-rendering динамічних сторінок
4. **URL-based filtering** — `/catalog?sort=price-asc&category=solar`
5. **Playwright e2e тести** — базове тестове покриття

#### Від Saleor:
1. **Multi-step checkout** — кроковий процес оформлення замовлення
2. **Server-side cart validation** — ціни перевіряються сервером

#### Від Crystallize:
1. **Faceted search** — фільтрація по властивостях продуктів
2. **Service Worker для офлайн кошика** (low priority)

#### Від BigCommerce:
1. **Product JSON-LD з Offer** — включаючи price та availability
2. **Price range filter** — client-side filter для ціни

---

## 7. Пріоритетний план дій

### P0 — Критично (блокує production)

| # | Задача | Складність | Еталон |
|---|--------|-----------|--------|
| 1 | **Завершити Cart Page** — повна сторінка кошика з items, quantity, totals | Середня | YNS cart-sidebar |
| 2 | **Завершити Checkout Flow** — multi-step: контакт → доставка → оплата | Висока | Saleor checkout |
| 3 | **Server-side cart validation** — ціни перевіряються БД, а не клієнтом | Середня | Saleor/YNS |
| 4 | **Order creation** — збереження замовлення в Supabase після checkout | Середня | — |

### P1 — Важливо (значне покращення UX)

| # | Задача | Складність | Еталон |
|---|--------|-----------|--------|
| 5 | **Пошук по каталогу** — Supabase full-text search | Середня | Vercel Commerce |
| 6 | **Фільтрація та сортування** — URL-based filters | Середня | Vercel Commerce |
| 7 | **Пагінація каталогу** — серверна limit/offset | Низька | BigCommerce |
| 8 | **Міграція кошика на cookie + useOptimistic** | Середня | YNS |
| 9 | **`"use cache"` + `cacheLife()`** — замінити revalidate ISR | Низька | Vercel Commerce |

### P2 — Покращення (SEO та UX polish)

| # | Задача | Складність | Еталон |
|---|--------|-----------|--------|
| 10 | **BreadcrumbList JSON-LD** | Низька | Vercel Commerce |
| 11 | **Organization JSON-LD** у root layout | Низька | Vercel Commerce |
| 12 | **`generateStaticParams()`** для products/sections | Низька | Vercel Commerce |
| 13 | **Image blur placeholder** | Низька | Vercel Commerce |
| 14 | **Image hover swap** на product cards | Низька | YNS |
| 15 | **Zoom на product page** | Середня | YNS |
| 16 | **generateMetadata()** на Homepage (зараз static) | Низька | — |

### P3 — Бажано (конкурентні переваги)

| # | Задача | Складність | Еталон |
|---|--------|-----------|--------|
| 17 | **Unit тести** для discountEngine, calculateRate | Середня | — |
| 18 | **E2E тести** для основних flows | Висока | Vercel Commerce |
| 19 | **Забув пароль** flow | Низька | — |
| 20 | **Dynamic OG images** (`opengraph-image.tsx`) | Середня | Vercel Commerce |
| 21 | **OKLCH кольори** для теми | Низька | YNS |
| 22 | **Eager prefetching** (custom Link wrapper) | Низька | YNS |

---

## Додаток A: Детальні дослідження проєктів

### A.1 Vercel Commerce (vercel/commerce)

**Репозиторій:** github.com/vercel/commerce
**Стек:** Next.js 16, TypeScript, Tailwind CSS v4, Shopify Storefront API (GraphQL)

Headless Shopify storefront від команди Vercel. Еталон якості для Next.js e-commerce:
- `"use cache"` з гранулярними `cacheLife()` TTL — найсучасніший підхід кешування
- Server Actions для cart мутацій (add, remove, update)
- Cookie-based cart з Shopify API
- Повний SEO: generateMetadata, sitemap, robots, JSON-LD (Product + BreadcrumbList)
- URL-based search та sorting
- Responsive image grid з blur placeholders
- Playwright e2e тести
- ~15 файлів коду (без UI компонентів) — екстремальна простота

### A.2 BigCommerce Next.js Commerce (bigcommerce/nextjs-commerce)

**Репозиторій:** github.com/bigcommerce/nextjs-commerce
**Стек:** Next.js 15, TypeScript, Tailwind CSS, BigCommerce API

Fork Vercel Commerce адаптований для BigCommerce:
- `generateMetadata()` на продуктових та колекційних сторінках
- Product JSON-LD зі schema.org/Offer (включає price)
- Dynamic sitemap та robots
- Cookie-based cart через BigCommerce Cart API
- Faceted filtering з URL search params
- Hosted checkout (redirect до BigCommerce)

### A.3 YourNextStore (yournextstore/yournextstore)

**Репозиторій:** github.com/yournextstore/yournextstore
**Стек:** Next.js 16 canary, React 19, Bun, Commerce Kit SDK (Stripe-native)

Мінімалістичний SaaS storefront (~30 файлів):
- `"use cache"` + `cacheLife()` з різними TTL
- `useOptimistic` (React 19) для кошика — найкращий cart UX
- Cookie-based cart (httpOnly, secure)
- Proxy-based checkout до Stripe hosted
- React Compiler enabled (auto-memoization)
- Image hover swap на product cards
- **Найгірший SEO** — тільки static metadata на root layout, немає sitemap/robots/JSON-LD
- Немає admin panel, auth, search, user accounts

### A.4 Saleor Storefront (saleor/storefront)

**Репозиторій:** github.com/saleor/storefront
**Стек:** Next.js 15, TypeScript, Saleor GraphQL API, Tailwind CSS

Headless e-commerce storefront для Saleor platform:
- GraphQL API з typed operations (codegen)
- Multi-step checkout: address → shipping → payment → confirmation
- Server-side cart через Saleor Checkout API
- `generateMetadata()` на динамічних сторінках
- sitemap.ts та robots.ts
- JWT + email/password auth
- Multi-channel/multi-language через Saleor channels

### A.5 Crystallize Furniture Remix

**Репозиторій:** github.com/CrystallizeAPI/furniture-remix
**Стек:** Remix (React Router), Crystallize API, Tailwind CSS

Demo storefront для Crystallize headless PIM:
- Remix loader/action паттерн (server-side data)
- Service Worker для офлайн кошика
- Crystallize + Stripe/Klarna checkout
- Rich content rendering з Crystallize components
- HTTP Cache-Control headers для кешування
- Faceted filtering по product attributes

### A.6 kemalkujovic/nextjs-ecommerce

**Репозиторій:** github.com/kemalkujovic/nextjs-ecommerce
**Стек:** Next.js 15, Supabase, Tailwind CSS, Zustand

Невеликий e-commerce шаблон з Supabase (найближчий до SimplyCMS по стеку):
- Supabase для auth та products
- Zustand для стану кошика (client-side)
- Basic cart та checkout
- Немає admin panel, themes, plugins
- Мінімалістичний — ~10 компонентів

### A.7 FocusReactive cms-kit

**Репозиторій:** github.com/focusreactive/cms-kit
**Стек:** Next.js, TypeScript, Multi-CMS (Sanity, Contentful, WordPress)

CMS-агрегатор з адаптерами для різних headless CMS:
- Plugin-like архітектура для різних CMS backends
- Однаковий frontend код для різних CMS
- Landing page builder з компонентами
- Не e-commerce, а content-focused

### A.8 ButterCMS Next.js Starter

**Репозиторій:** github.com/ButterCMS/nextjs-starter-buttercms
**Стек:** Next.js 14 (Pages Router), ButterCMS API

Starter template для ButterCMS:
- Pages Router (застарілий підхід)
- Static Site Generation (getStaticProps)
- Blog, landing pages, FAQ, navigation
- ButterCMS API для контенту
- Немає e-commerce функціональності

### A.9 Optimizely SaaS CMS Next.js 15

**Репозиторій:** github.com/episerver/cms-saas-vercel-demo (Optimizely)
**Стек:** Next.js 15, Optimizely Graph (GraphQL), Optimizely CMS SaaS

Enterprise CMS frontend:
- Visual Builder з drag-and-drop (через Optimizely admin)
- GraphQL content delivery через Optimizely Graph
- Component-based page building
- A/B testing та personalization інтеграція
- Складна конфігурація, enterprise-рівень
- Немає e-commerce (чистий CMS)

---

## Додаток B: Архітектурні рішення

### Cookie vs localStorage для кошика

| Підхід | Плюси | Мінуси | Хто використовує |
|--------|-------|--------|-----------------|
| **localStorage** | Простий, не обмежений розміром | Не серверний, не secure, очищується | SimplyCMS, kemalkujovic |
| **Cookie (httpOnly)** | Server-readable, secure, cross-tab | 4KB ліміт, потрібен server | YNS, Vercel Commerce |
| **Cookie ID + DB** | Server-validated, cross-device | Потрібна БД, складніше | Saleor, BigCommerce |

**Рекомендація для SimplyCMS:** Cookie ID + Supabase для авторизованих, Cookie з cart data для гостей.

### useOptimistic vs TanStack Query для кошика

| Підхід | Плюси | Мінуси | Хто використовує |
|--------|-------|--------|-----------------|
| **useOptimistic** | Нативний React 19, миттєвий UI, малий bundle | Немає retry, cache | YNS |
| **TanStack Query** | Retry, cache invalidation, devtools | Додаткова залежність, більше boilerplate | SimplyCMS (не для кошика) |
| **useState + fetch** | Простий | Повільний UI, немає optimistic | kemalkujovic |

**Рекомендація для SimplyCMS:** `useOptimistic` для кошика (миттєвий feedback), TanStack Query залишити для адмін-панелі.

### ISR revalidate vs "use cache" + cacheLife

| Підхід | Плюси | Мінуси | Хто використовує |
|--------|-------|--------|-----------------|
| **revalidate (ISR)** | Простий, стабільний | Один TTL на сторінку, грубий контроль | SimplyCMS, Saleor |
| **"use cache" + cacheLife** | Гранулярний, per-component TTL | Next.js 16+, новий API | Vercel Commerce, YNS |

**Рекомендація:** Мігрувати на `"use cache"` поетапно, починаючи з navbar та footer (`"hours"`), потім products (`"minutes"`).
