# Task: Build-time Registration, Runtime Activation — повний рефакторинг системи тем

> **[АРХІВ 2026-07-30]** Виконано: перемикання тем з адмінки + SSR-резолв активної теми реалізовані (див. CLAUDE.md, розділ Theme System).

## Концепція

**Next.js вимагає компіляції** — неможливо завантажувати довільні теми через ZIP як WordPress/OpenCart. Тому SimplyCMS використовує підхід **"Build-time Registration, Runtime Activation":**

- **Розробник** додає тему як код (`themes/<name>/`), реєструє у ThemeRegistry, створює DB-міграцію → deploy
- **Адміністратор** після деплою бачить список зареєстрованих тем → обирає активну → налаштовує через UI (кольори, параметри з `manifest.settings`)
- Теми **не можна встановлювати через UI** — тільки через код + міграцію

> **Відхилення від BRD 7.4:** BRD стверджує що зміна теми вимагає rebuild. Це переглянуте рішення: усі теми присутні в коді на етапі збірки, БД зберігає лише яка активна + користувацькі налаштування. Runtime-перемикання працює без rebuild.

## Контекст

Після міграції з Vite SPA на Next.js система тем частково працює, але має критичні проблеми:

1. **Storefront хардкодить `@themes/default`** — усі 8+ маршрутів в `app/(storefront)/` напряму імпортують компоненти дефолтної теми, ігноруючи `ThemeRegistry` та `is_active` у БД
2. **SSR theme resolver відсутній** — `ThemeContext` (клієнтський) завантажує тему з БД після гідрації, що не працює для SSR
3. **ThemeRegistry не ініціалізований на сервері** — реєстрація тем зроблена в `app/providers.tsx` ("use client"), серверний код не виконує цей модуль
4. **DB seed розсинхронізований з маніфестами** — запис `default` у БД має `display_name: "SolarStore Default"`, тоді як маніфест каже "Default Theme"
5. **SolarStore відсутній у БД** — його немає в seed-міграції
6. **InstallThemeDialog дозволяє ручне створення тем** — суперечить концепції build-time registration
7. **StorefrontShell дублює MainLayout** — зайва абстракція
8. **`settings_schema` дублюється** між маніфестом і БД
9. **`system_settings.active_theme`** — невикористовуваний дублікат `themes.is_active`

### Діагностика поточного стану

| Компонент | Де | Стан | Проблема |
|-----------|-----|------|----------|
| `ThemeRegistry.register()` | `app/providers.tsx` | ✅ `default` + `solarstore` зареєстровані | Тільки client-side |
| `public.themes` seed | міграція `20260209...` | ⚠️ тільки `default` | SolarStore відсутній |
| `themes.display_name` | БД | ❌ "SolarStore Default" для default | Має бути "Default Theme" |
| `themes.settings_schema` | БД | ⚠️ дублює manifest.settings | Джерело істини — код |
| `system_settings.active_theme` | БД | ❌ дублює `themes.is_active` | Видалити |
| `InstallThemeDialog` | адмін-панель | ❌ дозволяє ручне створення | Видалити — теми тільки через код |
| `StorefrontShell` | `themes/default/layouts/` | ❌ дублює MainLayout | Видалити, використовувати MainLayout |
| `ThemeContext.fetchActiveTheme()` | `theme-system/ThemeContext.tsx` | ✅ працює | Не SSR, тільки після гідрації |
| Storefront pages | `app/(storefront)/*.tsx` | ❌ хардкод `@themes/default` | Ігнорують активну тему |
| `getActiveTheme()` | `theme-system/index.ts` | ⚠️ синхронна обгортка | Не SSR-aware, не ходить у БД |

### Файли що змінюються

**DB міграція (нова):**
- `supabase/migrations/` — нова міграція: оновлення схеми `themes`, видалення `system_settings.active_theme`

**Theme System (`packages/simplycms/theme-system/src/`):**
- `types.ts` — оновити `ThemeRecord` (прибрати `settings_schema`, перейменувати `config` → `settings`)
- `index.ts` — замінити `getActiveTheme()` на `getActiveThemeSSR()` (async, server-only)
- `ThemeContext.tsx` — додати prop `initialThemeName`, прибрати визначення теми (SSR це робить)
- `ThemeResolver.ts` — адаптувати під нову серверну логіку

**Server-side registration (нове):**
- `app/theme-registry.server.ts` — server-only реєстрація тем (імпортується з SSR resolver)

**Storefront (`app/(storefront)/`):**
- `layout.tsx` — замінити `StorefrontShell` на `theme.MainLayout` через SSR resolver
- `page.tsx` — замінити хардкод на `theme.pages.HomePage`
- `catalog/page.tsx` — замінити на `theme.pages.CatalogPage`
- `catalog/[sectionSlug]/page.tsx` — замінити на `theme.pages.CatalogSectionPage`
- `catalog/[sectionSlug]/[productSlug]/page.tsx` — замінити на `theme.pages.ProductPage`
- `properties/page.tsx` — замінити на `theme.pages.PropertiesPage`
- `properties/[propertySlug]/page.tsx` — замінити на `theme.pages.PropertyDetailPage`
- `properties/[propertySlug]/[optionSlug]/page.tsx` — замінити на `theme.pages.PropertyOptionPage`

**Admin (`packages/simplycms/admin/src/`):**
- `components/InstallThemeDialog.tsx` — **видалити файл**
- `pages/Themes.tsx` — прибрати кнопку "Встановити тему", адаптувати для нового потоку

**Revalidation:**
- `app/api/revalidate/route.ts` — додати підтримку `type: 'theme'` → `revalidateTag('active-theme')`

**Themes:**
- `themes/default/layouts/StorefrontShell.tsx` — **видалити файл**
- `themes/default/index.ts` — прибрати export StorefrontShell якщо є

**Client providers:**
- `app/providers.tsx` — передавати `initialThemeName` з layout

---

## Прийняті архітектурні рішення

Clarify-питання з попередньої версії задачі **вирішені**:

| Питання | Рішення | Обґрунтування |
|---------|---------|---------------|
| **ThemeRegistry на сервері** | Окремий `app/theme-registry.server.ts` (server-only модуль) | Предсказуємо, прозорий контроль; імпортується з SSR resolver |
| **Кешування SSR resolution** | `unstable_cache` + tag `'active-theme'` + `revalidate: 3600` | Cross-request кеш, інвалідується через `revalidateTag`; Next.js 16 рекомендує для DB queries |
| **Revalidation при зміні теми** | On-demand `revalidateTag('active-theme')` через `/api/revalidate` | Миттєве перемикання; адмінка після `activateMutation.onSuccess` викликає API |
| **CSS стилі тем** | Scoping через CSS-класи (`.default-theme`, `.solarstore-theme`) — обидва CSS в білді | Вже працює; CSS тем ~2-3KB кожна; SSR layout ставить правильний className |
| **StorefrontShell vs MainLayout** | `StorefrontShell` видалити; використовувати `theme.MainLayout` | `StorefrontShell` = дублікат `MainLayout` (той самий Header + main + Footer) |
| **`settings_schema` — де джерело?** | Тільки в `manifest.settings` (код); БД зберігає тільки `settings` (значення) | Уникає дублювання; адмін UI бере схему через `ThemeRegistry.load()` на клієнті |
| **Runtime vs rebuild** | Runtime — обидві теми у білді, БД обирає активну | Відхиляє BRD 7.4; ThemeRegistry вже підтримує це |

---

## Вимоги

### Фаза 1: DB — нова структура таблиці `themes`

**Мета:** привести БД у відповідність з концепцією "Build-time Registration, Runtime Activation"

**Scope:** одна нова SQL-міграція

- [ ] **1.1** Створити міграцію що оновлює таблицю `themes`:
  - Прибрати колонку `settings_schema` (джерело істини тепер тільки `manifest.settings` в коді)
  - Перейменувати `config` → `settings` (більш зрозуміма назва для користувацьких значень)
  - Перейменувати `installed_at` → `created_at` (стандартна конвенція)
  - Зробити `is_active` NOT NULL DEFAULT false
- [ ] **1.2** Виправити seed-дані для `default`: `display_name` → "Default Theme", `version` → "0.1.0", `author` → "SimplyCMS" (відповідно до `themes/default/manifest.ts`)
- [ ] **1.3** Додати запис `solarstore` (`is_active=false`): `display_name` → "SolarStore Default", `version` → "1.0.0", `author` → "SimplyCMS" (відповідно до `themes/solarstore/manifest.ts`)
- [ ] **1.4** Видалити запис `system_settings` з `key='active_theme'` (дублює `themes.is_active`)

**Ризики:**
- Partial unique index `themes_active_idx` залишається (тільки одна активна тема)
- Зміна колонок потребує оновлення типів: `pnpm db:generate-types` після міграції

**DoD Фази 1:**
- [ ] Міграція застосовується без помилок
- [ ] Обидві теми присутні в БД з правильними метаданими
- [ ] `default` активна, `solarstore` неактивна
- [ ] Колонки `settings_schema`, `installed_at`, `config` — видалені/перейменовані
- [ ] `system_settings.active_theme` — видалений
- [ ] `pnpm db:generate-types` виконано, `supabase/types.ts` оновлено

---

### Фаза 2: Server-side Theme Registration та SSR Resolver

**Мета:** SSR-сторінки storefront рендерять активну тему з БД, а не хардкод

**Scope:** `@simplysoftua/themes` (core) + `app/theme-registry.server.ts` (site-level)

- [ ] **2.1** Створити `app/theme-registry.server.ts` — server-only модуль реєстрації тем:
  - Без `"use client"`
  - Ті ж `ThemeRegistry.register()` виклики що й у `app/providers.tsx`
  - `ThemeRegistry.has()` guard від подвійної реєстрації (вже є в `providers.tsx`)
- [ ] **2.2** Оновити `ThemeRecord` у `types.ts`:
  - Прибрати `settings_schema` (тепер тільки manifest)
  - Перейменувати `config` → `settings`
  - `installed_at` → `created_at`
- [ ] **2.3** Створити `getActiveThemeSSR()` у `packages/simplycms/theme-system/src/`:
  - Server-only async функція (без `"use client"`)
  - Імпортує `app/theme-registry.server.ts` для гарантії реєстрації **(увага: залежність core → app — потрібно вирішити через параметр або lazy init)**
  - Читає `themes` з БД через `createServerSupabaseClient()` → `WHERE is_active = true`
  - Резолвить `ThemeModule` через `ThemeRegistry.load(record.name)`
  - Fallback на `"default"` якщо тема не знайдена
  - Обгорнуто в `unstable_cache` з key `['active-theme']`, tag `'active-theme'`, `revalidate: 3600`
  - Повертає `{ theme: ThemeModule; themeName: string; themeRecord: ThemeRecord }`
- [ ] **2.4** Вирішити проблему залежності `core → app`:
  - **Варіант A (рекомендований):** `getActiveThemeSSR()` перевіряє `ThemeRegistry.has('default')`, і якщо порожній — кидає зрозумілу помилку "Call ensureThemesRegistered() before using SSR resolver". Реєстрацію виконує `app/theme-registry.server.ts`, який імпортується в `app/(storefront)/layout.tsx`
  - **Варіант B:** `getActiveThemeSSR()` приймає параметр `registrationFn` що лениво реєструє теми
- [ ] **2.5** Оновити exports у `packages/simplycms/theme-system/src/index.ts`:
  - Замінити синхронну `getActiveTheme(name)` на async `getActiveThemeSSR()` 
  - Зберегти `resolveTheme()`, `resolveThemeWithFallback()`, `getAvailableThemes()` для зворотної сумісності

**Ризики:**
- `ThemeRegistry` — module-level singleton; в dev-режимі module cache може очищатись між запитами. `has()` guard + повторна реєстрація вирішує це
- `unstable_cache` — "unstable" API, але Next.js 16 офіційно рекомендує його для DB кешування; fallback — `React.cache()` для per-request dedup

**DoD Фази 2:**
- [ ] `app/theme-registry.server.ts` створено, без `"use client"`
- [ ] `getActiveThemeSSR()` повертає правильний ThemeModule з БД
- [ ] Fallback на `default` працює якщо активна тема не в Registry
- [ ] Кешування через `unstable_cache` + tag `'active-theme'`
- [ ] `ThemeRecord` type оновлений (без `settings_schema`, з `settings`)
- [ ] Typecheck проходить (`pnpm typecheck`)

---

### Фаза 3: Storefront — заміна хардкоду на SSR resolver

**Мета:** всі storefront-маршрути рендерять сторінки з активної теми

**Scope:** `app/(storefront)/` — layout + 8 page files

- [ ] **3.1** `app/(storefront)/layout.tsx`:
  - Імпортувати `app/theme-registry.server.ts` (гарантія реєстрації)
  - Виклик `getActiveThemeSSR()` → отримати `theme` + `themeName`
  - Рендерити `<theme.MainLayout>{children}</theme.MainLayout>` 
  - Передавати `themeName` далі (через props або context)
  - Видалити імпорт `StorefrontShell`
- [ ] **3.2** `app/(storefront)/page.tsx`:
  - `const { theme } = await getActiveThemeSSR()`
  - `const HomePage = theme.pages.HomePage`
  - `return <HomePage {...ssrProps} />`
  - Зберегти існуючий SSR data fetching (banners, products, sections)
  - Зберегти `export const revalidate` та `export const metadata`
- [ ] **3.3** Аналогічно для решти маршрутів:
  - `catalog/page.tsx` → `theme.pages.CatalogPage`
  - `catalog/[sectionSlug]/page.tsx` → `theme.pages.CatalogSectionPage`
  - `catalog/[sectionSlug]/[productSlug]/page.tsx` → `theme.pages.ProductPage`
  - `properties/page.tsx` → `theme.pages.PropertiesPage`
  - `properties/[propertySlug]/page.tsx` → `theme.pages.PropertyDetailPage`
  - `properties/[propertySlug]/[optionSlug]/page.tsx` → `theme.pages.PropertyOptionPage`
- [ ] **3.4** Видалити `themes/default/layouts/StorefrontShell.tsx`
- [ ] **3.5** Перевірити що SSR-дані (props) продовжують передаватись як раніше — контракт `ThemePages` дозволяє `Record<string, unknown>`

**Ризики:**
- Layout — Server Component, але `theme.MainLayout` у обох темах `"use client"` (через `useEffect` для `classList`). Це нормально — Server Component може рендерити Client Component
- Якщо `unstable_cache` повертає stale тему — fallback через ISR `revalidate` на рівні page

**DoD Фази 3:**
- [ ] Жоден storefront-файл не імпортує напряму з `@themes/default`
- [ ] SSR рендерить сторінки з активної теми
- [ ] При зміні теми в адмінці → storefront оновлюється (через revalidation)
- [ ] SSR-дані (banners, products, sections) передаються як props
- [ ] `StorefrontShell.tsx` видалено
- [ ] `generateMetadata()` та `export const revalidate` збережені в кожному маршруті

---

### Фаза 4: ThemeContext — синхронізація з SSR + прибирання зайвого

**Мета:** клієнтський ThemeContext не конфліктує з SSR, не дублює роботу

**Scope:** `@simplysoftua/themes` (ThemeContext.tsx) + `app/providers.tsx`

- [ ] **4.1** Додати prop `initialThemeName` до `ThemeProvider`:
  - SSR layout передає `themeName` (з `getActiveThemeSSR()`) → `<Providers initialThemeName={themeName}>`
  - `ThemeContext` при `initialThemeName` пропускає `fetchActiveTheme()` на першому рендері
  - `refreshTheme()` залишається для ре-фетчу (потрібний адмінці)
- [ ] **4.2** Оновити `app/providers.tsx`:
  - Прийняти `initialThemeName` як prop
  - Передати в `<CMSThemeProvider initialThemeName={...}>`
- [ ] **4.3** Оновити `app/(storefront)/layout.tsx`:
  - Передати `themeName` у `<Providers>` 
- [ ] **4.4** ThemeContext: оновити `fetchActiveTheme()` під нову структуру БД:
  - Читати `settings` замість `config`
  - Не читати `settings_schema` (брати з manifest)
  - ThemeRecord type вже оновлений у Фазі 2

**Ризики:**
- Flash якщо `initialThemeName` не передано → fallback на fetch (повільніше, але працює)
- `Providers` зараз — client component; передавання prop з Server Component layout — стандартний Next.js патерн

**DoD Фази 4:**
- [ ] Немає flash/mismatch між SSR і клієнтом
- [ ] CSS variables активної теми застосовуються коректно
- [ ] `ThemeContext.themeName` === SSR theme name
- [ ] `refreshTheme()` працює для адмінки
- [ ] Немає зайвого `fetchActiveTheme()` при наявності `initialThemeName`

---

### Фаза 5: Admin — прибирання InstallThemeDialog + revalidation

**Мета:** адмінка відповідає концепції "теми тільки через код + міграцію"

**Scope:** `@simplysoftua/admin` + `app/api/revalidate/`

- [ ] **5.1** Видалити `packages/simplycms/admin/src/components/InstallThemeDialog.tsx`
- [ ] **5.2** Оновити `packages/simplycms/admin/src/pages/Themes.tsx`:
  - Прибрати імпорт та рендер `<InstallThemeDialog />`
  - Оновити запити під нову схему (без `settings_schema`, з `settings`)
  - Після `activateMutation.onSuccess` → виклик `/api/revalidate` з `{ type: 'theme', secret }` 
  - Toast: "Тему активовано. Зміни застосовані на сайті"
- [ ] **5.3** Оновити `app/api/revalidate/route.ts`:
  - Додати обробку `type === 'theme'` → `revalidateTag('active-theme')`
  - Додати `revalidatePath('/', 'layout')` для повної інвалідації storefront layout
- [ ] **5.4** Видалити файл `StorefrontShell.tsx` якщо не зроблено у Фазі 3
- [ ] **5.5** Прибрати `console.log` з `ThemeRegistry.ts` та `ThemeContext.tsx` (production cleanup)

**Ризики:**
- `revalidateTag` в Next.js 16 вимагає другий аргумент `profile` (рекомендовано `'max'` для stale-while-revalidate)
- Theme Settings page (`/admin/themes/${id}/settings`) — схему налаштувань тепер потрібно брати з `ThemeRegistry.load(name).manifest.settings` на клієнті, а не з БД

**DoD Фази 5:**
- [ ] `InstallThemeDialog.tsx` видалено
- [ ] Адмінка не показує кнопку "Встановити тему"
- [ ] Після активації теми → revalidation storefront
- [ ] Storefront оновлюється протягом кількох секунд після перемикання
- [ ] Немає `console.log` у production коді theme-system

---

### Фаза 6: Очистка та фінальна верифікація

**Мета:** прибрати все зайве, перевірити типи та лінтинг

**Scope:** весь проект

- [ ] **6.1** `pnpm db:generate-types` — оновити `supabase/types.ts` під нову схему
- [ ] **6.2** Перевірити що всі імпорти `ThemeRecord` (у core, admin, themes) сумісні з новим типом
- [ ] **6.3** `pnpm typecheck` — без помилок
- [ ] **6.4** `pnpm lint` — без помилок  
- [ ] **6.5** `pnpm build` — білд проходить
- [ ] **6.6** Перевірити в dev: storefront рендерить default тему
- [ ] **6.7** Перевірити в dev: зміна активної теми в адмінці → storefront оновлюється
- [ ] **6.8** Перевірити: немає console errors у browser dev tools

**DoD Фази 6:**
- [ ] Всі команди якості проходять
- [ ] Manual smoke test пройдений

---

## Рекомендовані патерни

### Build-time Registration (DX workflow)
Розробник додає нову тему:
1. Створити `themes/<name>/` (manifest, index, layouts, pages, components, styles)
2. Зареєструвати в `app/providers.tsx` (client) **та** `app/theme-registry.server.ts` (server)
3. Створити міграцію: `INSERT INTO themes (name, display_name, version, ...) VALUES (...)`
4. `pnpm build` → deploy → адмін бачить нову тему

### SSR Theme Resolution
Серверна async-функція `getActiveThemeSSR()` обгорнута в `unstable_cache`:
- Читає `themes WHERE is_active = true` через `createServerSupabaseClient()`
- Резолвить ThemeModule з `ThemeRegistry.load(name)`
- Fallback на `"default"` при помилці
- Інвалідується через `revalidateTag('active-theme')`
- Де шукати приклад: `packages/simplycms/theme-system/src/ThemeResolver.ts`

### Dynamic Theme Page Rendering
`app/(storefront)/page.tsx` як Server Component:
- `const { theme } = await getActiveThemeSSR()`
- `const Page = theme.pages.HomePage`
- `return <Page {...ssrProps} />`
- SSR data fetching залишається на рівні route page.tsx
- Де шукати приклад: BRD секція 7.2

### On-demand Revalidation After Theme Switch
Адмінка після `activateMutation.onSuccess`:
- POST `/api/revalidate` з `{ type: 'theme', secret }`
- Route handler викликає `revalidateTag('active-theme')` → наступний запит отримає нову тему
- Де шукати приклад: `app/api/revalidate/route.ts`

### Theme Settings — розділення відповідальностей
- **Схема (що можна налаштувати):** тільки `manifest.settings` в коді — source of truth
- **Значення (що налаштовано):** `themes.settings` в БД (jsonb)
- **Адмін UI:** бере схему через `ThemeRegistry.load(name).manifest.settings`, значення з `themes.settings`
- **Клієнт:** CSS variables застосовує ThemeContext через `useEffect` (без змін)

---

## Антипатерни (уникати)

### ❌ Динамічний `import()` на основі рядка з БД без Registry
Не робити `import(\`@themes/${name}/index\`)` — порушує webpack static analysis, не працює на Vercel. Тільки pre-registered loaders через `ThemeRegistry`.

### ❌ Подвійний рендер (SSR default → client re-render solarstore)
Flash/mismatch. SSR має знати правильну тему через `getActiveThemeSSR()`.

### ❌ Бізнес-логіка в темах
Теми — чиста візуалізація. Fetching, enrichment, price resolution залишаються в `app/` page.tsx або `@simplysoftua/core`.

### ❌ `"use client"` у SSR theme resolver
`getActiveThemeSSR()` — server-only функція з `createServerSupabaseClient()`. Без `"use client"`.

### ❌ Ручне встановлення тем через адмін UI
Теми — це код. Новий код = rebuild + deploy. Адмінка тільки **перемикає** та **налаштовує**.

### ❌ `settings_schema` в БД
Дублювання → розсинхрон. Manifest — єдине джерело схеми налаштувань.

### ❌ Seed з `is_active=true` для кількох тем
Partial unique index `themes_active_idx` дозволяє тільки одну активну. Міграція впаде.

### ❌ `console.log` в production коді
ThemeRegistry і ThemeContext мають багато `console.log` — прибрати або замінити на `console.error` для помилок.

---

## Архітектурні рішення

| Компонент | Пакет | Деталі |
|-----------|-------|--------|
| DB міграція | `supabase/migrations/` (site-level) | Нова структура themes, seed для обох тем |
| SSR Resolver | `@simplysoftua/themes` (core) | `getActiveThemeSSR()` + `unstable_cache` |
| Server Registration | `app/theme-registry.server.ts` (site-level) | Server-only реєстрація модулів |
| Storefront pages | `app/(storefront)/` (site-level) | Динамічний рендер через SSR resolver |
| ThemeContext | `@simplysoftua/themes` (core) | `initialThemeName` prop, без визначення теми |
| Admin Themes | `@simplysoftua/admin` (core) | Без InstallDialog, з revalidation |
| Revalidation | `app/api/revalidate/` (site-level) | + type `theme` → `revalidateTag('active-theme')` |

- **Rendering storefront:** SSR + ISR (без змін — джерело компонентів стає динамічним)
- **Rendering admin:** Client-only (без змін)
- **Реєстрація тем:** site-specific (`app/`) — і client, і server файли
- **Міграція з `temp/`:** не застосовується (нова архітектура)

---

## MCP Servers (за потреби)

- **context7** — для перевірки актуальних API:
  - Next.js `unstable_cache`, `revalidateTag` (Next.js 16 вимагає profile як другий аргумент)
  - Dynamic imports у Server Components
- **supabase** — для виконання міграції та генерації типів після зміни схеми
- **shadcn** — не потрібен для цієї задачі

---

## Пов'язана документація

- `BRD_SIMPLYCMS_NEXTJS.md` секція 7 — система тем (ThemeModule, ThemeManifest, ThemePages)
- `BRD_SIMPLYCMS_NEXTJS.md` секція 7.4 — **УВАГА: описує "rebuild required" — ми свідомо відхиляємо це**
- `BRD_SIMPLYCMS_NEXTJS.md` секція 6.2 — структура app/ (route groups, rendering стратегії)
- `.github/instructions/architecture-core.instructions.md` — правила архітектури
- `.github/instructions/ui-architecture.instructions.md` — система тем, ThemeModule contract
- `.github/instructions/data-access.instructions.md` — Supabase клієнти, ISR revalidation
- `packages/simplycms/theme-system/src/` — поточна реалізація
- `themes/default/manifest.ts` — `name: 'default'`, `displayName: 'Default Theme'`, `version: '0.1.0'`
- `themes/solarstore/manifest.ts` — `name: 'solarstore'`, `displayName: 'SolarStore Default'`, `version: '1.0.0'`
- `app/providers.tsx` — клієнтська реєстрація тем
- `supabase/migrations/20260209075414_...sql` — поточний seed (тільки `default`, з помилковим display_name)

---

## Definition of Done (загальне)

- [ ] DB міграція застосована, обидві теми в БД з правильними метаданими
- [ ] Storefront SSR рендерить сторінки з **активної** теми (не hardcoded `default`)
- [ ] Перемикання теми в адмінці → storefront оновлюється через revalidation
- [ ] Усі 8+ storefront-маршрутів використовують `getActiveThemeSSR()`
- [ ] Fallback на `default` якщо активна тема не в Registry
- [ ] SSR-дані (banners, products, sections) передаються як props (без змін)
- [ ] Немає flash/mismatch між SSR і клієнтом
- [ ] CSS variables активної теми застосовуються коректно
- [ ] `InstallThemeDialog` видалено
- [ ] `StorefrontShell` видалено
- [ ] `settings_schema` прибрано з БД
- [ ] `system_settings.active_theme` видалено
- [ ] `console.log` прибрано з theme-system
- [ ] `pnpm typecheck` — без помилок
- [ ] `pnpm lint` — без помилок
- [ ] `pnpm build` — білд проходить
