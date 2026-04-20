# Task: Комплексна заміна Next.js на TanStack Start у simplyCMS

## Goal

Провести **комплексну міграцію фреймворка** в проєкті `simplyCMS` з **Next.js App Router** на **TanStack Start + Vite**, збережучи поточну бізнес-функціональність, модульну архітектуру, Supabase-інтеграцію, систему тем і плагінів, а також побудувати **повноцінний DB-driven SEO-шар** для storefront.

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
      orders.tsx
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
      revalidate.ts
      guest-order.ts
  start.ts
  router.tsx
  providers/
  server/
  features/
```

Назви можуть бути адаптовані, але структура має бути **логічною, route-oriented і сумісною з TanStack Start**

#### 4.2 Монорепо / workspace пакети

Не зламати існуючі workspace packages:

- `@simplycms/core`
- `@simplycms/admin`
- `@simplycms/ui`
- `@simplycms/plugins`
- `@simplycms/themes`

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
- `seo_url` або узгоджений canonical slug field
- `meta_title`
- `meta_description`
- `meta_keywords` або `seo_tags`
- `canonical_url`
- `robots_index`
- `robots_follow`
- `og_title`
- `og_description`
- `og_image`
- `twitter_title`
- `twitter_description`
- `twitter_image`
- `schema_json` або `schema_overrides`

#### 5.3 Правила використання SEO-полів у storefront

Storefront-сторінка повинна використовувати дані в такому порядку пріоритету:

1. SEO fields з БД
2. fallback на бізнес-поля (`name`, `description`, `slug`, `images`)
3. fallback на глобальні site defaults

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

Sitemap повинен будуватись на основі SEO URL / актуальних slug-полів з БД. Якщо є окремий `seo_url`, треба використовувати саме його або чітко документований алгоритм пріоритету

---

### 6. Комплексний план виконання

## Phase 0 — Branch, audit, migration baseline

### Завдання

- створити окрему migration branch
- зафіксувати baseline стан build/dev
- описати map старих маршрутів до нових route files
- описати map Next-specific API → TanStack Start equivalents
- визначити всі `next/*` імпорти
- визначити всі місця з server-only поведінкою

### Результат

- migration branch створена
- inventory сформований
- список ризиків сформований

---

## Phase 1 — Інсталяція TanStack Start та заміна build/runtime основи

### Завдання

- встановити `@tanstack/react-start`, `@tanstack/react-router`, `vite`, `@vitejs/plugin-react`
- створити `vite.config.ts` з `tanstackStart()` перед `react()`
- оновити `package.json` scripts під Vite / Start
- підготувати `src/router.tsx`
- підготувати `src/routes/__root.tsx`

### Важливо

Поки Next ще не видаляти фізично до моменту, поки нова структура не почне збиратись. Але новий Start skeleton треба підняти першочергово

### Результат

- Start skeleton існує
- root route існує
- router factory існує
- dev server стартує на мінімальному порожньому route tree

---

## Phase 2 — Перенесення root shell, providers, global CSS, theme bootstrap

### Завдання

- перенести роль `app/layout.tsx` у `src/routes/__root.tsx`
- перенести глобальний HTML shell
- перенести `Providers`
- перенести theme bootstrap логіку
- інтегрувати `HeadContent`, `Scripts`, `Outlet`
- перенести global CSS

### Важливо

Не переносити next-specific механіки дослівно. Потрібно адаптувати shell до TanStack Start conventions

### Результат

- глобальна оболонка працює
- провайдери ініціалізуються
- тема стартує коректно
- basic hydration працює

---

## Phase 3 — Перенесення server-side data layer у createServerFn / server handlers

### Завдання

- знайти всі місця, де зараз server logic сидить у Next page/layout/metadata flow
- створити окремий шар server functions
- винести туди:
  - отримання товарів
  - отримання секцій
  - отримання активної теми
  - sitemap data
  - revalidation helper
  - auth/session helpers
  - SEO fetchers

### Важливо

У TanStack Start **не можна покладатися на те, що route component “і так серверний”**. Усі DB / secret / server-only виклики повинні бути ізольовані

### Результат

- є окремий server access layer
- route modules працюють через loader + serverFn
- немає небезпечних прямолінійних server-side викликів у isomorphic коді

---

## Phase 4 — Міграція storefront маршрутів у SSR mode

### Завдання

Перенести маршрути:

- `/`
- `/catalog`
- `/catalog/:sectionSlug`
- `/catalog/:sectionSlug/:productSlug`
- `/properties`
- `/properties/:propertySlug`
- `/properties/:propertySlug/:optionSlug`

### Вимоги

- SSR/full-document route output
- loader-based data fetching
- head-based SEO generation
- JSON-LD insertion
- theme-aware rendering
- 404 / redirect handling

### Результат

- storefront parity досягнута
- ключові публічні маршрути працюють на Start SSR

---

## Phase 5 — Міграція admin, auth, profile, cart, checkout

### Завдання

Перенести client-heavy частини:

- `/auth`
- `/profile/*`
- `/cart`
- `/checkout`
- `/admin/*`

### Вимоги

- зберегти React Query патерни
- замінити `next/navigation` на TanStack Router navigation
- адаптувати route params та links
- зберегти CRUD та UI behavior

### Результат

- admin parity досягнута
- auth/profile/cart/checkout працюють

---

## Phase 6 — Middleware / auth control / request lifecycle

### Завдання

- перенести Next middleware/proxy логіку в `src/start.ts`
- реалізувати auth middleware
- реалізувати route protection для admin/profile
- адаптувати cookie/session model

### Результат

- auth guards працюють
- неавторизовані користувачі перенаправляються коректно
- SSR routes мають доступ до auth context за потреби

---

## Phase 7 — Theme system adaptation

### Завдання

- адаптувати theme registry під isomorphic execution model
- забезпечити server-safe theme resolution
- забезпечити client compatibility
- зберегти fallback на default theme
- не допустити дублювання registry init

### Важливо

Поточна задача `ssr-theme-resolution.md` повинна бути врахована як окремий ризиковий блок

### Результат

- теми працюють у Start
- storefront route рендерить активну тему
- адмінка може змінювати тему без руйнування storefront logic

---

## Phase 8 — Реалізація повного SEO-шару з БД

### Завдання

- додати / нормалізувати SEO-поля в БД
- оновити типи Supabase
- оновити адмінку для редагування SEO-полів
- реалізувати SEO resolver layer
- прив’язати SEO resolver до head route API
- реалізувати canonical / og / twitter / robots
- реалізувати H1 precedence
- реалізувати JSON-LD generation з SEO overrides
- реалізувати sitemap generator

### Важливо

Цей етап є **обов’язковою частиною міграції**, а не окремим nice-to-have

### Результат

- SEO повністю керується з БД
- storefront HTML містить правильний SEO output
- admin редагує SEO централізовано

---

## Phase 9 — API routes / utilities / sitemap / robots / revalidation

### Завдання

- перенести `app/api/*` у Start server routes
- перенести `revalidate` endpoint
- реалізувати `robots.txt` та sitemap endpoint у новій архітектурі
- при оновленні товару / секції / SEO-полів коректно оновлювати cache / invalidation mechanism у Start-compatible way

### Результат

- API parity досягнута
- SEO infrastructure повністю працює

---

## Phase 10 — Очищення Next.js спадщини

### Завдання

Після досягнення функціонального паритету:

- видалити `next`
- видалити `next.config.ts`
- видалити `app/`
- видалити `middleware.ts` / `proxy.ts` якщо лишаться
- видалити всі `next/*` imports
- видалити залишки server component mental model
- прибрати `"use client"` / `"use server"`

### Результат

- кодова база повністю Start-native

---

## Phase 11 — Stabilization / verification

### Завдання

- перевірити dev/build/start
- перевірити основні storefront routes
- перевірити SEO output у HTML
- перевірити sitemap
- перевірити admin CRUD
- перевірити auth guards
- перевірити theme switching
- перевірити image rendering / remote URLs

### Результат

- проєкт стабільний після заміни framework

---

### 7. Явна route map для simplyCMS

Мінімум потрібно перенести таким чином:

```text
app/layout.tsx
  -> src/routes/__root.tsx

app/(storefront)/page.tsx
  -> src/routes/index.tsx

app/(storefront)/catalog/page.tsx
  -> src/routes/catalog/index.tsx

app/(storefront)/catalog/[sectionSlug]/page.tsx
  -> src/routes/catalog/$sectionSlug.tsx

app/(storefront)/catalog/[sectionSlug]/[productSlug]/page.tsx
  -> src/routes/catalog/$sectionSlug/$productSlug.tsx

app/(storefront)/properties/page.tsx
  -> src/routes/properties/index.tsx

app/(storefront)/properties/[propertySlug]/page.tsx
  -> src/routes/properties/$propertySlug.tsx

app/(storefront)/properties/[propertySlug]/[optionSlug]/page.tsx
  -> src/routes/properties/$propertySlug/$optionSlug.tsx

app/auth/page.tsx
  -> src/routes/auth.tsx

app/(protected)/profile/page.tsx
  -> src/routes/profile/index.tsx

app/(protected)/profile/orders/page.tsx
  -> src/routes/profile/orders.tsx

app/(protected)/profile/orders/[orderId]/page.tsx
  -> src/routes/profile/orders/$orderId.tsx

app/(protected)/profile/settings/page.tsx
  -> src/routes/profile/settings.tsx

app/(cms)/admin/page.tsx
  -> src/routes/admin/index.tsx

app/(cms)/admin/products/page.tsx
  -> src/routes/admin/products.tsx

app/(cms)/admin/products/[productId]/page.tsx
  -> src/routes/admin/products/$productId.tsx

app/api/revalidate/route.ts
  -> src/routes/api/revalidate.ts
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

Почати потрібно не з переписування сторінок, а з **foundation layer**:

1. створити migration branch
2. встановити TanStack Start та Vite
3. підготувати `vite.config.ts`
4. створити `src/router.tsx`
5. створити `src/routes/__root.tsx`
6. підняти мінімальний working Start shell
7. тільки після цього переходити до route-by-route migration

---

### 12. Підсумкова суть задачі

Потрібно виконати **не просто технічну заміну framework package**, а **повну платформену міграцію**:

- з Next.js App Router mental model
- на TanStack Start execution model
- зі збереженням SSR storefront
- зі збереженням тем і плагінів
- з побудовою повного SEO-шару з БД
- з готовими HTML-сторінками для пошукових систем

