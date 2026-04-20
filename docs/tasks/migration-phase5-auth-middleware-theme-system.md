# Task: Phase 5 — Theme system, providers і request middleware

## Контекст

Після Phase 4 всі маршрути мігровані на TanStack Start. Залишилося стабілізувати дві cross-cutting підсистеми:

1. **Theme system** — поточний `getActiveThemeSSR()` і подвійна реєстрація тем прив'язані до Next.js mental model
2. **Request middleware** — auth guards уже працюють через `beforeLoad`, але глобальні headers і загальний request lifecycle мають бути зведені в `src/start.ts`

### Поточна архітектура Theme System

- **ThemeRegistry** — singleton Map з lazy-loading theme modules
- **Реєстрація на сервері:** `app/theme-registry.server.ts` — імпортується в layout
- **Реєстрація на клієнті:** `app/providers.tsx` — дублює ту саму реєстрацію в `"use client"` файлі
- **getActiveThemeSSR()** — Next.js-specific resolver з `React.cache()` + `unstable_cache()`
- **ThemeContext** — client-side React Context з ThemeProvider, fallbackTheme, initialThemeName
- **CMSProvider** — обгортає QueryClientProvider + Toaster + SonnerToaster

### Що потрібно змінити

В TanStack Start:
- Немає `unstable_cache` — потрібен інший механізм cross-request кешування
- Немає роздільних `"use client"` / server entry points — ThemeRegistry має працювати isomorphic
- Global request middleware визначається в `src/start.ts`

## Вимоги

### Theme system adaptation

- [ ] Видалити `packages/simplycms/theme-system/src/getActiveThemeSSR.ts` як робочу точку інтеграції і замінити його на `src/server/themes.ts` + loader-based використання
- [ ] Реалізувати theme cache як module-level in-memory cache з TTL
- [ ] **Не використовувати `React.cache()`** — це RSC-only API і воно не є частиною цільової архітектури TanStack Start
- [ ] Уніфікувати реєстрацію тем — єдиний entry point що працює і на сервері, і на клієнті:
  - ThemeRegistry.register() має викликатися один раз при старті застосунку
  - В TanStack Start немає boundary server/client — реєстрація в `src/routes/__root.tsx` або окремому файлі імпортованому з root
  - `src/server/themes.ts` має явно гарантувати реєстрацію тем перед резолюцією активної теми (через import або `ensureThemeRegistry()`), а не покладатися лише на те, що side-effect уже відпрацював у root route
- [ ] Адаптувати ThemeContext (CMSThemeProvider) для роботи без `"use client"` директиви
  - **Увага:** `ThemeContext.tsx` імпортує `supabase` з `@simplycms/core/supabase/client` — цей singleton має guard `typeof window !== "undefined"` для realtime subscription. Після видалення `"use client"` перевірити що isomorphic import не ламає серверний рендеринг (realtime subscription має бути client-only через useEffect)
- [ ] Адаптувати Providers wrapper (CMSProvider + ThemeProvider) для TanStack Start __root.tsx
- [ ] Реалізувати `invalidateThemeCache()` як server function для адмінки
- [ ] Перевести storefront layout на loader + route context для передачі активної теми дочірнім маршрутам

### Request middleware

- [ ] Визначити в `src/start.ts` глобальний request middleware тільки для того, що справді має бути global:
  - security headers
  - CORS для зовнішніх endpoints, якщо вони залишаються
  - за потреби логування
- [ ] Залишити в global middleware **лише той auth gate, який неможливо виразити server-side через `beforeLoad`**:
  - початковий request на `/admin` для client-only admin shell
- [ ] Не дублювати в global middleware route-level guards для `_protected` або інших SSR-маршрутів, які вже коректно захищаються через `beforeLoad`
- [ ] Видалити `proxy.ts`, якщо це ще не зроблено у ранніх фазах

### Provider architecture

- [ ] Адаптувати CMSProvider (QueryClientProvider + toast) для TanStack Start:
  - QueryClientProvider може залишитися як є — TanStack Query framework-agnostic
  - Toaster / SonnerToaster — framework-agnostic
- [ ] Визначити де в route tree розміщуються providers:
  - `__root.tsx` component обгортає `<Outlet />` providers-ами

## Clarify (питання перед імплементацією)

- [ ] Який механізм in-memory cache використовувати?
  - Чому це важливо: cross-request cache для активної теми — критичний для продуктивності (без нього кожен SSR-запит робить DB-запит)
  - Варіант A: Простий module-level Map з TTL check — `let cached: ThemeRecord | null; let cachedAt: number;` (рекомендовано — мінімально, достатньо)
  - Варіант B: Бібліотека `lru-cache` або `node-cache`
  - Варіант C: `React.cache()` тільки — **неможливо в TanStack Start** (це RSC-only API, не працює без React Server Components)
  - Вплив: продуктивність, складність, зовнішні залежності

- [ ] Чи потрібен глобальний request middleware для auth?
  - Чому це важливо: `beforeLoad` не дає server-side захисту для `ssr: false` admin routes на початковому request
  - Рекомендація: так, але тільки для `/admin` initial request; решта auth guards залишаються на route layer
  - Вплив: безпечний вхід у admin без повернення до широкого `proxy.ts`

- [ ] Як ThemeRegistry працюватиме на клієнті при client-side navigation?
  - Чому це важливо: зараз ThemeRegistry.register() в providers.tsx гарантує що тема доступна на клієнті. В TanStack Start client-side navigation теж потребує завантаження theme module
  - Варіант A: ThemeRegistry завжди isomorphic — один import реєструє на обох середовищах (рекомендовано)
  - Варіант B: Серверна функція повертає theme data, клієнт не потребує registry
  - Вплив: архітектура, розмір клієнтського bundle

## Рекомендовані патерни

### In-memory cache з TTL

Простий module-scope cache: зберігає останній результат і timestamp. При запиті перевіряє чи не застарів (TTL). Інвалідація — обнулити cached значення. Не потребує зовнішніх залежностей.

- Де створювати: `packages/simplycms/theme-system/src/themeCache.ts` (framework-agnostic utility)
- Де використовувати: серверна функція `getActiveTheme()` в `src/server/themes.ts`

### Isomorphic ThemeRegistry

ThemeRegistry — чистий TypeScript singleton без framework залежностей. Реєстрація — одна, спільна для server і client. Root route імпортує цей файл для клієнтського боку, а `src/server/themes.ts` явно імпортує або викликає helper реєстрації для server-side резолюції.

- Де шукати поточну реалізацію: `app/theme-registry.server.ts` (server), `app/providers.tsx` (client)
- Цільовий стан: один файл `src/theme-registry.ts`, який імпортується з `src/routes/__root.tsx` і з `src/server/themes.ts`

### Providers в `__root.tsx`

__root.tsx component має обгортати Outlet:
1. QueryClientProvider (React Query)
2. ThemeProvider (CMSThemeProvider)
3. Toaster components

Без окремого Providers wrapper якщо він стає тривіальним.

## Антипатерни (уникати)

### ❌ Зовнішній cache для одного запису
Redis, Upstash, або інші зовнішні cache stores — overkill для кешування одного запису "active theme". Module-level in-memory достатньо.

### ❌ Дублювати ThemeRegistry реєстрацію в двох місцях
В TanStack Start немає server/client boundary. Одна реєстрація в одному файлі. Не потрібні два entry points.

### ❌ Використовувати `createServerFn` для ThemeRegistry реєстрації
ThemeRegistry — клієнтський singleton (потрібен і в браузері для theme components). Реєстрація має бути isomorphic, не server-only.

### ❌ Залишати proxy.ts
`proxy.ts` як Next.js артефакт має бути видалений. Його функції розділяються між `beforeLoad` для route-level guards і вузьким middleware у `src/start.ts` для початкового request на client-only admin shell.

## Архітектурні рішення

- **В який пакет додавати код:** `@simplycms/theme-system` (cache utility), `src/` (theme-registry, root integration, start middleware)
- **Rendering стратегія:** без змін
- **Залежності:** жодних нових
- **Що видаляється:** `proxy.ts`, `app/theme-registry.server.ts`, дублююча реєстрація тем у `app/providers.tsx`, Next.js-specific theme resolver

## MCP Servers (за потреби)

- **context7** — TanStack Start server middleware / start.ts configuration
- **context7** — In-memory caching patterns для server functions (не React.cache())

## Пов'язана документація

- `docs/tasks/migration-phase4-admin-auth-protected-routes.md` — попередня фаза
- `packages/simplycms/theme-system/src/getActiveThemeSSR.ts` — поточна серверна резолюція теми
- `packages/simplycms/theme-system/src/ThemeRegistry.ts` — поточний ThemeRegistry
- `packages/simplycms/theme-system/src/ThemeContext.tsx` — поточний ThemeProvider
- `app/theme-registry.server.ts` — поточна серверна реєстрація тем
- `app/providers.tsx` — поточна клієнтська реєстрація тем + providers
- `proxy.ts` — поточний auth middleware
- `.github/instructions/architecture-core.instructions.md` — тема system overview

## Definition of Done

- [ ] `getActiveThemeSSR()` більше не є робочою точкою інтеграції runtime
- [ ] ThemeRegistry реєструється один раз в єдиному файлі, доступному і на сервері і на клієнті
- [ ] Providers (QueryClient, ThemeProvider, Toaster) підключені в __root.tsx
- [ ] `proxy.ts` видалено
- [ ] `app/theme-registry.server.ts` замінено на `src/theme-registry.ts`
- [ ] Theme switching з адмінки працює (invalidation → наступний SSR-запит отримує нову тему)
- [ ] Storefront layout отримує тему через loader/context, а не через Next.js-specific SSR resolver
- [ ] `pnpm typecheck` проходить
- [ ] `pnpm dev` — storefront використовує правильну тему, адмінка може перемикати теми
