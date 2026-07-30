# Task: Комплексна заміна Next.js на TanStack Start у simplyCMS

> **[АРХІВ 2026-07-30]** Головний міграційний документ; міграція завершена у 2026-06.

## Goal

Провести **комплексну міграцію фреймворка** в проєкті `simplyCMS` з **Next.js App Router** на **TanStack Start + Vite**, збережучи поточну бізнес-функціональність, модульну архітектуру, Supabase-інтеграцію, систему тем і плагінів, а також побудувати **повноцінний DB-driven SEO-шар** для storefront.

Міграція виконується як **one-shot breaking change без перехідного періоду**:

- без adapter-шару для роутингу або зображень;
- без підтримки двох framework API паралельно;
- без сумісних wrapper-ів для `href`, `URLSearchParams`, `useRouter` або `next/image`.

Цільова архітектура після міграції:

- **storefront** — **SSR / full-document SSR** на TanStack Start
- **admin** — client-heavy маршрути в межах TanStack Start
- **cart / checkout / profile** — client-heavy або hybrid маршрути
- **SEO** — окремий домен даних у БД, який редагується в адмінці та рендериться в готовий HTML storefront-сторінок
- **themes / plugins / packages** — збережені та адаптовані до execution model TanStack Start

---

## Expected Output

На виході має бути повністю мігрований проєкт, у якому:

1. **Next.js повністю видалений**
   - відсутні `next`, `next.config.*`, `app/`, `middleware.ts`, `next/*` імпорти

2. **TanStack Start налаштований як основний framework**
   - використовується `@tanstack/react-start`
   - використовується `vite.config.ts`
   - маршрути побудовані через `src/routes/*`
   - root route побудований через `src/routes/__root.tsx`
   - middleware перенесений у `src/start.ts`

3. **Storefront працює в SSR-режимі**
   - головна сторінка
   - каталог
   - сторінка категорії
   - сторінка товару
   - сторінки властивостей / фільтрів / SEO-лендінгів
   - сторінки віддають готовий HTML із SEO-даними

4. **Admin залишається функціонально еквівалентним**
   - редактор товару
   - редактор секцій
   - редактор властивостей / опцій
   - теми / плагіни / налаштування
   - Supabase CRUD не втрачається

5. **SEO-шар реалізований як окремий керований контур**
   - SEO-поля зберігаються в БД
   - SEO-поля редагуються в адмінці
   - storefront бере SEO-дані з БД
   - HTML містить правильні `title`, `meta`, `canonical`, `og:*`, `twitter:*`, `robots`, `H1`, `JSON-LD`
   - sitemap генерується на основі SEO URL / slug даних з БД

6. **Система тем працює після міграції**
   - активна тема резолвиться на сервері для storefront
   - клієнтська та серверна реєстрація тем узгоджені
   - немає жорсткої прив’язки до Next.js server components mental model

7. **Проєкт проходить базову технічну перевірку**
   - dev запускається
   - build проходить
   - production server запускається
   - основні маршрути працюють
   - немає витоків server-only логіки в isomorphic код

---

## Tech Notes

### 1. Джерела, на які потрібно спиратися

#### Поточний стан simplyCMS

- `package.json` (main branch)
- `app/layout.tsx`
- `next.config.ts`
- `app/(storefront)/catalog/[sectionSlug]/[productSlug]/page.tsx`
- `app/sitemap.ts`
- `docs/tasks/ssr-theme-resolution.md`
- `packages/simplycms/admin/src/pages/ProductEdit.tsx`

#### TanStack Start lifecycle skill

- `packages/react-start/skills/lifecycle/migrate-from-nextjs/SKILL.md`

Цей skill є **базовим migration contract**. Дотримуватись його правил, але адаптувати їх до реальної архітектури `simplyCMS`.

---

### 2. Поточний стан проєкту, який треба врахувати

#### 2.1 Framework / runtime

Проєкт зараз працює на **Next.js 16.x** з App Router та turbopack-скриптом у dev

#### 2.2 Root layout / SSR shell

Зараз root layout already містить:

- глобальний `metadata`
- `ThemeProvider`
- `Providers`
- SSR theme bootstrap через `getActiveThemeSSR()`
- `theme-registry.server`

Цю роль потрібно перенести в TanStack Start root route (`src/routes/__root.tsx`) та стартову ініціалізацію

#### 2.3 Storefront

Storefront уже має SSR-поведінку на рівні Next.js сторінок:

- dynamic metadata на сторінці товару
- `revalidate = 3600`
- JSON-LD `Product`
- серверне отримання активної теми

Це **не можна втратити** під час міграції

#### 2.4 Sitemap

У проєкті вже є `app/sitemap.ts`, який генерує sitemap з БД. Це потрібно зберегти у новій архітектурі як server route / generator layer у TanStack Start

#### 2.5 Theme resolution

У проєкті вже існує окремо задокументована проблема SSR theme resolution. Це означає, що міграція framework-а **не повинна ламати**:

- ThemeRegistry
- server-side resolution активної теми
- клієнтське використання тем
- fallback на default theme

#### 2.6 SEO в адмінці вже частково є

У `ProductEdit` уже існують поля:

- `meta_title`
- `meta_description`

Але storefront metadata ще не використовує їх як повноцінне джерело істини. Під час міграції потрібно **не просто перенести існуючі поля**, а **довести SEO-шар до завершеної архітектури**

---

### 3. Критичні правила міграції з TanStack Start SKILL

#### 3.1 Execution model

**TanStack Start is isomorphic by default**

Це головна відмінність від Next.js Server Components. Усі компоненти / loaders / route modules треба вважати такими, що можуть виконуватись не лише на сервері.

**Уся server-only логіка повинна бути винесена в `createServerFn()` або server handlers**

#### 3.2 Заборонено переносити Next mental model без змін

Потрібно **повністю прибрати**:

- `"use server"`
- `"use client"`
- bare server-side DB виклики всередині компонентів
- `next/navigation`
- `next/link`
- `next/head`
- `generateMetadata` як Next-specific API
- `middleware.ts`

#### 3.3 SEO в TanStack Start

SEO потрібно будувати через **`head` property на route** + route loaders / server functions, а не через Next metadata API

#### 3.4 Router migration contract

Мапінг імен і директорій:

- `app/layout.tsx` → `src/routes/__root.tsx`
- `app/page.tsx` → `src/routes/index.tsx`
- `app/catalog/[sectionSlug]/[productSlug]/page.tsx` → `src/routes/catalog/$sectionSlug/$productSlug.tsx`
- `app/api/.../route.ts` → `src/routes/api/...ts`
- `middleware.ts` / `proxy.ts` → `src/start.ts`

---

### 4. Проєктні вимоги до нової цільової архітектури

#### 4.1 Структура верхнього рівня

Після міграції очікується приблизно така структура:

```text
src/
  routes/
    __root.tsx
    index.tsx
    catalog/
      index.tsx
      $sectionSlug.tsx
      $sectionSlug/
        $productSlug.tsx
    properties/
      index.tsx
      $propertySlug.tsx
      $propertySlug/
        $optionSlug.tsx
    auth.tsx
    profile/
      index.tsx
      orders/
        $orderId.tsx
      settings.tsx
    admin/
      index.tsx
      products.tsx
      products/
        $productId.tsx
      sections.tsx
      ...
    api/
      guest-order.ts   # лише якщо потрібен HTTP endpoint для зовнішніх клієнтів
      health.ts        # лише якщо потрібен окремий health endpoint
  start.ts
  router.tsx
  providers/
  server/
  features/
```

Назви можуть бути адаптовані, але структура має бути **логічною, route-oriented і сумісною з TanStack Start**

#### 4.2 Монорепо / workspace пакети

Не зламати існуючі workspace packages:

- `@simplysoftua/core`
- `@simplysoftua/admin`
- `@simplysoftua/ui`
- `@simplysoftua/plugins`
- `@simplysoftua/themes`

Потрібно адаптувати збірку під Vite / TanStack Start так, щоб ці пакети лишились окремими логічними модулями

#### 4.3 Supabase

Зберегти Supabase як основне джерело даних:

- browser client
- server client / server-side access layer
- auth/session logic
- storage URLs / image access

Уся серверна взаємодія з Supabase повинна бути побудована так, щоб вона не протікала в isomorphic runtime неконтрольовано

---

### 5. Обов’язковий новий SEO-контур

Під час міграції потрібно **не лише перенести meta_title/meta_description**, а створити цілісну SEO-схему, яку можна масштабувати на кілька типів сутностей

#### 5.1 Сутності, які повинні підтримувати SEO

Мінімум:

- `products`
- `sections`
- `properties`
- `property_options` або окремі SEO landing entities
- за потреби статичні storefront pages

#### 5.2 Мінімальний набір SEO-полів

Потрібно реалізувати або еквівалентний набір, або кращий узгоджений варіант:

- `seo_h1`
- `canonical_url`
- `meta_title`
- `meta_description`
- `meta_keywords` або `seo_tags`
- `robots`
- `og_title`
- `og_description`
- `og_image`
- `twitter_title`
- `twitter_description`
- `twitter_image`
- `schema_json`

#### 5.3 Правила використання SEO-полів у storefront

Storefront-сторінка повинна використовувати дані в такому порядку пріоритету:

1. SEO fields з БД
2. fallback на бізнес-поля (`name`, `description`, `slug`, `images`)
3. fallback на глобальні site defaults з `simplycms.config.ts`

#### 5.4 Що повинно потрапити в готовий HTML

На storefront route для SEO-сутності повинні коректно рендеритись:

- `<title>`
- `<meta name="description">`
- `<meta name="keywords">` якщо використовується
- `<link rel="canonical">`
- `<meta property="og:*">`
- `<meta name="twitter:*">`
- `<meta name="robots">`
- `<h1>`
- `<script type="application/ld+json">`

#### 5.5 Sitemap

Sitemap повинен будуватись на основі `canonical_url`, якщо він заданий, або на основі актуальних slug-полів з БД за чітко документованим fallback-алгоритмом

---

### 6. Комплексний план виконання

## Phase 0 — Аудит залежностей і цільові контракти без адаптерів

### Завдання

- створити migration branch
- зафіксувати baseline стан build/dev
- зібрати повний inventory `next/*` залежностей
- розділити їх на route-aware UI, image, server-only, runtime/bootstrap
- визначити які storefront/core pages стають prop-driven
- визначити де admin pages можуть залишатись route-aware
- зафіксувати правило: **жодних router/image adapter-шарів не створювати**

### Результат

- inventory сформований
- цільові контракти переписування узгоджені
- подвійний рефакторинг через adapter-механізм виключений

---

## Phase 1 — Встановлення TanStack Start і прямий breaking rewrite runtime-примітивів

### Завдання

- встановити `@tanstack/react-start`, `@tanstack/react-router`, `vite`, `@vitejs/plugin-react`
- створити `vite.config.ts`, `src/start.ts`, `src/router.tsx`, `src/routes/__root.tsx`
- перевести scripts на Start runtime
- напряму замінити `next/link`, `next/navigation`, `next/image`, `next/font`, `next/dynamic`
- прибрати `"use client"` / `"use server"`
- перевести env-модель з `NEXT_PUBLIC_*` на `VITE_*`
- рано прибрати Next.js з активного runtime-контуру

### Результат

- Start skeleton працює
- TanStack Start є єдиним runtime
- `next/*` примітиви більше не використовуються як активний API

---

## Phase 2 — Server-only data-access шар через createServerFn

### Завдання

- створити `src/server/` з доменними server functions
- винести Supabase server factory на site-level
- реалізувати auth/session helpers, sitemap, robots, storefront data fetchers
- прибрати package-level Next.js server helpers
- відмовитись від generic ISR/revalidation механіки для storefront

### Результат

- server-only логіка ізольована
- cookies/session керуються через TanStack Start server context
- route loaders працюють через server functions

---

## Phase 3 — Міграція storefront SSR-маршрутів

### Завдання

- перенести storefront маршрути в `src/routes/_storefront/*`
- використовувати loader + head + theme-aware rendering
- передавати params/search/SEO через route layer, а не через package-level Next hooks

### Результат

- ключові storefront SSR routes працюють на TanStack Start
- HTML output містить SEO та structured data

---

## Phase 4 — Міграція admin, auth, protected та client-heavy маршрутів

### Завдання

- перенести `/admin/*`, `/auth`, `/profile/*`, `/cart`, `/checkout`
- зберегти React Query патерни і CRUD behavior
- винести guards у `beforeLoad`
- за потреби лишити admin pages route-aware напряму через TanStack Router API

### Результат

- admin/auth/profile/cart/checkout працюють у новій архітектурі

---

## Phase 5 — Theme system, providers і request middleware

### Завдання

- замінити Next.js-specific theme resolver на loader/server-function оркестрацію
- реалізувати in-memory TTL cache для активної теми
- уніфікувати ThemeRegistry registration
- інтегрувати providers у `__root.tsx`
- звести global request middleware у `src/start.ts` без дублювання auth guards

### Результат

- theme system працює в isomorphic моделі TanStack Start
- request lifecycle не залежить від `proxy.ts`

---

## Phase 6 — DB-driven SEO і site metadata infrastructure

> **Винесено в окрему задачу.** Цю фазу видалено з даного міграційного документа і **повністю переписано** як самостійну задачу, що покриває весь SEO/SSR-контур storefront разом із faceted navigation (фільтрами каталогу), crawl-менеджментом та керуванням із адмінки.
>
> Див.: [`docs/tasks/seo-ssr-faceted-navigation.md`](./seo-ssr-faceted-navigation.md)
>
> Причина винесення: SEO-домен переріс рамки одного кроку міграції — він включає не лише DB-поля + resolver, а й URL-схему фільтрів, серверну фільтрацію каталогу, індексованість single-facet лендингів, sitemap/robots/canonical-політику та окремий розділ адмінки. Це окремий продуктовий контур, а не завершальний крок framework-міграції.

---

## Phase 7 — Фінальна стабілізація, cleanup і документація

### Завдання

- перевірити що ранній cleanup Next.js завершений повністю
- прибрати мертві reference на `app/`, `next/*`, `NEXT_PUBLIC_*`
- оновити README, AGENTS, instructions
- виконати повну функціональну верифікацію storefront/admin/auth/theme/SEO

### Результат

- кодова база повністю Start-native
- документація відповідає реальному стану системи
- migration checkpoints закриті без прихованого legacy

---

### 7. Явна route map для simplyCMS

Мінімум потрібно перенести таким чином:

```text
app/layout.tsx
  -> src/routes/__root.tsx

app/(storefront)/layout.tsx
  -> src/routes/_storefront.tsx

app/(storefront)/page.tsx
  -> src/routes/_storefront/index.tsx

app/(storefront)/catalog/page.tsx
  -> src/routes/_storefront/catalog/index.tsx

app/(storefront)/catalog/[sectionSlug]/page.tsx
  -> src/routes/_storefront/catalog/$sectionSlug/index.tsx

app/(storefront)/catalog/[sectionSlug]/[productSlug]/page.tsx
  -> src/routes/_storefront/catalog/$sectionSlug/$productSlug.tsx

app/(storefront)/properties/page.tsx
  -> src/routes/_storefront/properties/index.tsx

app/(storefront)/properties/[propertySlug]/page.tsx
  -> src/routes/_storefront/properties/$propertySlug/index.tsx

app/(storefront)/properties/[propertySlug]/[optionSlug]/page.tsx
  -> src/routes/_storefront/properties/$propertySlug/$optionSlug.tsx

app/(storefront)/order-success/[orderId]/page.tsx
  -> src/routes/_storefront/order-success/$orderId.tsx

app/(storefront)/cart/page.tsx
  -> src/routes/_storefront/cart.tsx

app/(storefront)/checkout/page.tsx
  -> src/routes/_storefront/checkout.tsx

app/auth/page.tsx
  -> src/routes/auth/index.tsx

app/auth/callback/route.ts
  -> src/routes/auth/callback.tsx

app/(protected)/layout.tsx
  -> src/routes/_protected.tsx

app/(protected)/profile/page.tsx
  -> src/routes/_protected/profile/index.tsx

app/(protected)/profile/orders/page.tsx
  -> src/routes/_protected/profile/orders/index.tsx

app/(protected)/profile/orders/[orderId]/page.tsx
  -> src/routes/_protected/profile/orders/$orderId.tsx

app/(protected)/profile/settings/page.tsx
  -> src/routes/_protected/profile/settings.tsx

app/(cms)/admin/layout.tsx
  -> src/routes/_admin.tsx

app/(cms)/admin/page.tsx
  -> src/routes/admin/index.tsx

app/(cms)/admin/products/page.tsx
  -> src/routes/admin/products/index.tsx

app/(cms)/admin/products/[productId]/page.tsx
  -> src/routes/admin/products/$productId/edit.tsx

app/api/guest-order/route.ts
  -> src/routes/api/guest-order.ts

app/api/health/route.ts
  -> src/routes/api/health.ts

app/sitemap.ts
  -> src/routes/sitemap[.]xml.tsx

app/robots.ts
  -> src/routes/robots[.]txt.tsx
```

Реальна route map має бути повнішою, але цей мінімум обов’язковий

---

### 8. Особливі обмеження та вимоги для агента кодування

#### 8.1 Заборонено

- не переносити код механічно “як є” з Next.js API в TanStack Start
- не залишати `next/*` імпорти
- не робити server-only виклики прямо в route components без `createServerFn`
- не тягнути `"use client"` / `"use server"`
- не будувати storefront як SPA
- не втрачати theme system
- не втрачати SEO з HTML output

#### 8.2 Обов’язково

- працювати поетапно
- тримати код у збираємому стані після кожної великої фази
- у разі сумнівів обирати рішення, яке краще відповідає execution model TanStack Start
- зберігати бізнес-логіку `simplyCMS`, а не переписувати продукт заново

#### 8.3 Важлива архітектурна пріоритезація

Пріоритети такі:

1. **Коректний SSR storefront**
2. **Коректний DB-driven SEO**
3. **Коректна server/client boundary**
4. **Збереження theme/plugin system**
5. **Admin parity**
6. **Очищення framework legacy**

---

### 9. Definition of Done

Міграція вважається завершеною лише якщо виконано все нижче:

- [ ] Проєкт більше не використовує Next.js
- [ ] У проєкті є `vite.config.ts` і TanStack Start runtime
- [ ] Усі критичні storefront routes перенесені на Start SSR
- [ ] Усі критичні admin routes перенесені
- [ ] Усі `next/*` імпорти видалені
- [ ] `app/` видалено
- [ ] `middleware.ts` / `proxy.ts` замінені на `src/start.ts`
- [ ] Усі server-only операції винесені в `createServerFn` або server handlers
- [ ] Theme system працює на storefront
- [ ] Product page рендерить SEO-поля з БД у готовий HTML
- [ ] H1 береться з SEO-поля або fallback логіки
- [ ] `meta_title` / `meta_description` / canonical / og / robots коректно рендеряться
- [ ] JSON-LD рендериться коректно
- [ ] Sitemap генерується з БД
- [ ] Адмінка дозволяє редагувати SEO-поля
- [ ] Dev / build / production start проходять без критичних помилок

---

### 10. Бажаний формат роботи агента

Потрібно виконувати роботу **не одним гігантським рефакторингом**, а через керовані checkpoint-етапи:

1. Start skeleton
2. Providers / root shell
3. Server function layer
4. Storefront routes
5. Admin routes
6. Auth middleware
7. Theme migration
8. SEO layer
9. API / sitemap / cleanup
10. Final stabilization

Після кожного великого checkpoint бажано мати:

- короткий список змінених файлів
- що вже працює
- що ще не перенесено
- які ризики залишились

---

### 11. Перший практичний крок, з якого треба почати

Почати потрібно не з переписування окремих сторінок, а з **audit + foundation layer**:

1. створити migration branch
2. зафіксувати inventory `next/*` залежностей і цільові контракти без adapters
3. встановити TanStack Start та Vite
4. підготувати `vite.config.ts`, `src/start.ts`, `src/router.tsx`
5. створити `src/routes/__root.tsx`
6. підняти мінімальний working Start shell
7. одразу після цього перейти до прямого rewrite примітивів, а не до створення compatibility layer

---

### 12. Підсумкова суть задачі

Потрібно виконати **не просто технічну заміну framework package**, а **повну платформену міграцію**:

- з Next.js App Router mental model
- на TanStack Start execution model
- зі збереженням SSR storefront
- зі збереженням тем і плагінів
- з побудовою повного SEO-шару з БД
- з готовими HTML-сторінками для пошукових систем

