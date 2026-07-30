# Task: SSR Theme Resolution — динамічне перемикання тем через адмінку

> **[АРХІВ 2026-07-30]** Виконано: SSR-резолв теми реалізовано через createServerFn getActiveTheme + loader.

## Контекст

Після міграції з Vite SPA на Next.js storefront-сторінки **жорстко імпортують компоненти з `@themes/default/...`**, ігноруючи активну тему в БД. Адмінка показує лише ті теми, які є в таблиці `public.themes`, але seed-міграція вставляє лише одну запись (`default`). Тема `solarstore` **існує в кодовій базі** (`themes/solarstore/`) і **зареєстрована в ThemeRegistry** (`app/providers.tsx`), але відсутня в БД → не видна для перемикання.

Навіть якщо вручну додати `solarstore` в БД і активувати — storefront не зміниться, бо `app/(storefront)/**/*.tsx` містять hardcoded імпорти `@themes/default/pages/*` i `@themes/default/layouts/*`.

**BRD секція 7.2** описує цільовий патерн: storefront Server Components резолвять активну тему через `getActiveTheme()` і рендерять `theme.pages.*`.

### Три проблеми, що вирішуються

1. **DB:** SolarStore відсутній в таблиці `themes` → не видно в адмінці для перемикання
2. **SSR API:** Немає серверної функції для визначення активної теми з БД + резолв модуля
3. **Storefront:** Hardcoded `@themes/default/...` імпорти замість динамічного резолву

## Вимоги

- [ ] **1.** В адмін-панелі (`/admin/themes`) відображаються всі теми, які є в `ThemeRegistry` та в БД
- [ ] **2.** Перемикання теми в адмінці змінює storefront (layouts, pages, components)
- [ ] **3.** Серверна функція `getActiveThemeSSR()` в `@simplysoftua/themes` — резолв активної теми з БД для Server Components
- [ ] **4.** Storefront layout та сторінки використовують динамічний theme resolution замість hardcoded імпортів
- [ ] **5.** ThemeRegistry популяризований і на сервері, і на клієнті (одна точка реєстрації)
- [ ] **6.** Seed-міграція для `solarstore` в таблиці `themes` (або auto-sync через `InstallThemeDialog`)
- [ ] **7.** Fallback на `default` тему якщо активна тема не знайдена / не зареєстрована
- [ ] **8.** Сумісність з ISR/revalidation — перемикання теми враховується при ревалідації

## Clarify (питання перед імплементацією)

- [ ] **Q1:** Чи потрібна SQL-міграція для seed solarstore в `public.themes`, чи досить ручного "Встановити тему" через адмінку?
  - Чому це важливо: міграція — декларативна, завжди відтворювана; ручна дія — може бути забута
  - Варіант A: SQL-міграція з `INSERT INTO themes` для solarstore (рекомендовано для dev/staging)
  - Варіант B: Auto-sync при старті: порівнювати ThemeRegistry з `public.themes` і створити відсутні записи
  - Варіант C: Лише через UI "Встановити тему" (поточна поведінка)
  - Вплив: DX, відтворюваність середовищ

- [ ] **Q2:** Де реєструвати теми для сумісності Server + Client?
  - Чому це важливо: зараз `app/providers.tsx` має `'use client'` → ThemeRegistry заповнюється лише на клієнті; серверні компоненти не бачать зареєстрованих тем
  - Варіант A: Створити `app/theme-register.ts` (без `'use client'`) — імпортується і в SSR, і в providers (рекомендовано)
  - Варіант B: Додати секцію `themes` в `simplycms.config.ts` — відповідає BRD, але потребує заміни формату конфігу
  - Варіант C: Реєструвати в `getActiveThemeSSR()` як lazy fallback
  - Вплив: архітектура, чистота границі core/site

- [ ] **Q3:** Як кешувати DB-запит активної теми в рамках SSR-запиту?
  - Чому це важливо: storefront layout + page + вкладені компоненти можуть викликати `getActiveThemeSSR()` декілька разів за один request
  - Варіант A: `React.cache()` — дедуплікація в рамках одного request (рекомендовано)
  - Варіант B: `unstable_cache()` з tag-based revalidation — кешування між requests
  - Варіант C: Резолвити тему один раз в layout, передавати через props/context
  - Вплив: продуктивність, складність, revalidation

- [ ] **Q4:** Чи правити рассинхрон `display_name` в seed-міграції (`default` записаний як "SolarStore Default")?
  - Чому це важливо: manifest теми `default` має `displayName: 'Default Theme'`, а в БД — "SolarStore Default"
  - Варіант A: Нова міграція з `UPDATE` для виправлення display_name
  - Варіант B: Auto-sync display_name з manifest при завантаженні
  - Вплив: дані, консистентність

## Рекомендовані патерни

### Серверна реєстрація тем (theme-register.ts)

Виділити реєстрацію тем з `app/providers.tsx` в окремий файл без `'use client'`. Цей файл імпортується як side-effect і в серверних компонентах (SSR), і в клієнтських провайдерах. ThemeRegistry — синглтон модуля, тому працює в обох контекстах.

- Де шукати поточну реєстрацію: `app/providers.tsx` рядки 8-18
- ThemeRegistry клас: `packages/simplycms/theme-system/src/ThemeRegistry.ts`

### getActiveThemeSSR()

Серверна функція, яка:
1. Приймає Supabase server client як параметр (не створює свій)
2. Читає `public.themes WHERE is_active = true`
3. Резолвить `ThemeRegistry.load(record.name)`
4. Fallback на default тему
5. Обгорнута в `React.cache()` для дедуплікації в рамках request

- Де додавати: `packages/simplycms/theme-system/src/` (новий файл або розширити `ThemeResolver.ts`)
- Де шукати серверний supabase client: `packages/simplycms/core/src/supabase/server.ts`
- BRD референс: `docs/BRD_SIMPLYCMS_NEXTJS.md` секція 7.2 (рядки 681-718)

### Динамічний storefront layout

Layout резолвить тему один раз і рендерить `theme.MainLayout`. Це центральна точка — всі вкладені сторінки автоматично отримають правильний shell.

- Що замінюється: `app/(storefront)/layout.tsx` — hardcoded `import { StorefrontShell } from "@themes/default/layouts/StorefrontShell"`
- На що: `const theme = await getActiveThemeSSR(supabase); const Layout = theme.MainLayout;`

### Динамічні storefront page imports

Кожна сторінка резолвить тему і бере компонент з `theme.pages.*`. Server-fetched дані передаються як props (серіалізовані).

- Файли для заміни (10 storefront pages):
  - `app/(storefront)/page.tsx` — `theme.pages.HomePage`
  - `app/(storefront)/catalog/page.tsx` — `theme.pages.CatalogPage`
  - `app/(storefront)/catalog/[sectionSlug]/page.tsx` — `theme.pages.CatalogSectionPage`
  - `app/(storefront)/catalog/[sectionSlug]/[productSlug]/page.tsx` — `theme.pages.ProductPage`
  - `app/(storefront)/cart/page.tsx` — `theme.pages.CartPage`
  - `app/(storefront)/checkout/page.tsx` — `theme.pages.CheckoutPage`
  - `app/(storefront)/order-success/[orderId]/page.tsx` — `theme.pages.OrderSuccessPage`
  - `app/(storefront)/properties/page.tsx` — `theme.pages.PropertiesPage`
  - `app/(storefront)/properties/[propertySlug]/page.tsx` — `theme.pages.PropertyDetailPage`
  - `app/(storefront)/properties/[propertySlug]/[optionSlug]/page.tsx` — `theme.pages.PropertyOptionPage`
- Деякі з них — заглушки (`cart`, `checkout`, `order-success`); їх теж потрібно перевести на theme-based рендеринг

### ISR Revalidation при перемиканні теми

Після активації нової теми в адмінці — викликати revalidation endpoint для storefront-маршрутів, щоб ISR-кешовані сторінки перебудувались.

- Де шукати revalidation API: `app/api/revalidate/route.ts`
- Де додати виклик: `Themes.tsx` — `activateMutation.onSuccess`

## Антипатерни (уникати)

### ❌ Імпорт `@themes/default/...` напряму в `app/(storefront)/`
Це головна проблема. Hardcoded імпорти зводять нанівець систему тем. Сторінки мають отримувати компоненти через ThemeModule.

### ❌ Реєстрація тем тільки в `'use client'` компоненті
ThemeRegistry має бути заповнений і на сервері. Якщо реєстрація відбувається лише в `app/providers.tsx` (client), серверні компоненти не зможуть резолвити тему.

### ❌ Створення Supabase client всередині `getActiveThemeSSR()`
Функція має приймати client як параметр. Це дотримання інверсії залежностей і дозволяє працювати з будь-яким client (server, browser, service role).

### ❌ `require()` замість ESM імпорту
Поточний `getActiveTheme()` в `theme-system/src/index.ts` використовує `require("./ThemeRegistry")` — це антипатерн для ESM/Next.js. Замінити на нормальний import.

### ❌ Очікування hot-swap тем без деплою
В Next.js на Vercel додати **нову** тему (якої немає в build) неможливо без нового деплою. БД керує лише "яка з вже включених тем активна" + налаштування. Це не баг, це архітектурне обмеження SSR-first підходу.

### ❌ Дублювання логіки резолву теми в кожній сторінці
Тему потрібно резолвити один раз (в layout або через shared cached function), а не копіювати однаковий код в кожному page.tsx.

### ❌ Бізнес-логіка в темах
Теми — лише візуальна оболонка. Серверні запити, обробка даних, metadata — залишаються в `app/` сторінках. Тема отримує готові дані через props.

## Архітектурні рішення

- **Новий код (SSR API):** `@simplysoftua/themes` — `getActiveThemeSSR()`, оновлення `ThemeResolver.ts` або новий файл
- **Новий код (реєстрація):** `app/theme-register.ts` — site-specific, без `'use client'`
- **Зміни (storefront):** `app/(storefront)/layout.tsx` + 10 page.tsx файлів — заміна hardcoded imports
- **Зміни (providers):** `app/providers.tsx` — імпорт theme-register замість inline реєстрації
- **Зміни (index):** `packages/simplycms/theme-system/src/index.ts` — прибрати `require()`, оновити exports
- **Міграції (опціонально):** seed `solarstore` в `public.themes` + виправлення display_name для `default`
- **Rendering стратегія:** SSR (storefront) — тема резолвиться на сервері; Client (admin) — без змін
- **Пакет/site boundary:**
  - Core (`@simplysoftua/themes`): `getActiveThemeSSR()`, `ThemeRegistry`, `ThemeResolver` — не знає конкретних тем
  - Site (`app/`): список тем, їх dynamic imports, реєстрація — знає які теми включені в build
  - DB (`public.themes`): "яка активна" + config/settings — джерело істини для runtime

## MCP Servers (за потреби)

- **context7** — перевірити `React.cache()` API (Next.js 16), `unstable_cache`, ISR revalidation API
- **supabase** — якщо потрібна нова міграція для seed solarstore або UPDATE display_name

## Пов'язана документація

- `docs/BRD_SIMPLYCMS_NEXTJS.md` секція 7.1-7.2 — контракт ThemeModule та цільовий патерн підключення тем
- `docs/BRD_SIMPLYCMS_NEXTJS.md` секція 9 — SSR стратегія, ISR, revalidation
- `.github/instructions/architecture-core.instructions.md` — rendering стратегії по route groups
- `.github/instructions/data-access.instructions.md` — Supabase server/browser client правила
- `.github/instructions/optimization.instructions.md` — кешування, React.cache()
- `packages/simplycms/theme-system/src/` — весь theme-system код (ThemeRegistry, ThemeContext, ThemeResolver, types)
- `app/providers.tsx` — поточна реєстрація тем (client-only)
- `supabase/migrations/20260209075414_...sql` — seed міграція таблиці `themes` (тільки `default`)

## Зачеплені файли (повний список)

| Файл | Дія | Опис |
|------|-----|------|
| `packages/simplycms/theme-system/src/ThemeResolver.ts` | Розширити | Додати `getActiveThemeSSR()` |
| `packages/simplycms/theme-system/src/index.ts` | Оновити | Прибрати `require()`, додати export `getActiveThemeSSR` |
| `app/theme-register.ts` | Створити | Реєстрація тем без `'use client'` |
| `app/providers.tsx` | Оновити | Імпортувати `./theme-register` замість inline реєстрації |
| `app/(storefront)/layout.tsx` | Переписати | Динамічний layout через `getActiveThemeSSR()` |
| `app/(storefront)/page.tsx` | Оновити | `theme.pages.HomePage` замість hardcoded import |
| `app/(storefront)/catalog/page.tsx` | Оновити | `theme.pages.CatalogPage` |
| `app/(storefront)/catalog/[sectionSlug]/page.tsx` | Оновити | `theme.pages.CatalogSectionPage` |
| `app/(storefront)/catalog/[sectionSlug]/[productSlug]/page.tsx` | Оновити | `theme.pages.ProductPage` |
| `app/(storefront)/cart/page.tsx` | Оновити | `theme.pages.CartPage` |
| `app/(storefront)/checkout/page.tsx` | Оновити | `theme.pages.CheckoutPage` |
| `app/(storefront)/order-success/[orderId]/page.tsx` | Оновити | `theme.pages.OrderSuccessPage` |
| `app/(storefront)/properties/page.tsx` | Оновити | `theme.pages.PropertiesPage` |
| `app/(storefront)/properties/[propertySlug]/page.tsx` | Оновити | `theme.pages.PropertyDetailPage` |
| `app/(storefront)/properties/[propertySlug]/[optionSlug]/page.tsx` | Оновити | `theme.pages.PropertyOptionPage` |
| `supabase/migrations/NEW_*.sql` | Створити (опціонально) | Seed solarstore + fix display_name |

## Definition of Done

- [ ] В адмінці `/admin/themes` видно обидві теми (default + solarstore) з можливістю перемикання
- [ ] Після перемикання теми на solarstore і оновлення storefront — рендериться solarstore layout/pages
- [ ] Після перемикання назад на default — рендериться default layout/pages
- [ ] Fallback працює: якщо активна тема видалена з ThemeRegistry — рендериться default
- [ ] Жодного `import ... from '@themes/default/...'` в `app/(storefront)/` (крім `theme-register.ts`)
- [ ] `getActiveThemeSSR()` доступний з `@simplysoftua/themes`
- [ ] ThemeRegistry заповнений і на сервері (SSR), і на клієнті
- [ ] ISR revalidation працює після перемикання теми
- [ ] `pnpm typecheck` проходить без помилок
- [ ] `pnpm lint` проходить без помилок
- [ ] `pnpm build` проходить без помилок
