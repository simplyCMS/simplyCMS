# Task: Phase 5 — Адаптація Auth middleware та Theme system

## Контекст

Після Phase 4 всі маршрути мігровані на TanStack Start. Але дві підсистеми ще містять Next.js-specific код або потребують архітектурної адаптації:

1. **Auth middleware** — поточний `proxy.ts` використовує Next.js middleware API (NextResponse, NextRequest). В Phase 4 auth guards реалізовані через `beforeLoad`, але загальний middleware (CORS, logging, security headers) ще не адаптований
2. **Theme system** — `getActiveThemeSSR()` використовує `unstable_cache` з `next/cache` для cross-request кешування. ThemeRegistry реєструється двічі (server + client) через різні entry points. Ця модель потребує уніфікації

### Поточна архітектура Theme System

- **ThemeRegistry** — singleton Map з lazy-loading theme modules
- **Реєстрація на сервері:** `app/theme-registry.server.ts` — імпортується в layout
- **Реєстрація на клієнті:** `app/providers.tsx` — дублює ту саму реєстрацію в `"use client"` файлі
- **getActiveThemeSSR()** — обгортка в `React.cache()` (per-request dedup) + `unstable_cache()` (cross-request, tag: "active-theme", revalidate: 3600)
- **ThemeContext** — client-side React Context з ThemeProvider, fallbackTheme, initialThemeName
- **CMSProvider** — обгортає QueryClientProvider + Toaster + SonnerToaster

### Що потрібно змінити

В TanStack Start:
- Немає `unstable_cache` — потрібен інший механізм cross-request кешування
- Немає роздільних `"use client"` / server entry points — ThemeRegistry має працювати isomorphic
- Middleware визначається в `start.ts` (або конфігурації серверного handler) замість `proxy.ts`

## Вимоги

### Theme system adaptation

- [ ] Замінити `unstable_cache` в `getActiveThemeSSR()` на framework-agnostic кешування:
  - Module-level in-memory cache з TTL (наприклад, 3600 секунд)
  - **Не використовувати `React.cache()`** — це RSC-only API, яке не працює в TanStack Start (ізоморфна модель без Server Components). Per-request dedup непотрібен, бо loader природньо виконується один раз на запит
- [ ] Уніфікувати реєстрацію тем — єдиний entry point що працює і на сервері, і на клієнті:
  - ThemeRegistry.register() має викликатися один раз при старті застосунку
  - В TanStack Start немає boundary server/client — реєстрація в `src/routes/__root.tsx` або окремому файлі імпортованому з root
- [ ] Адаптувати ThemeContext (CMSThemeProvider) для роботи без `"use client"` директиви
  - **Увага:** `ThemeContext.tsx` імпортує `supabase` з `@simplycms/core/supabase/client` — цей singleton має guard `typeof window !== "undefined"` для realtime subscription. Після видалення `"use client"` перевірити що isomorphic import не ламає серверний рендеринг (realtime subscription має бути client-only через useEffect)
- [ ] Адаптувати Providers wrapper (CMSProvider + ThemeProvider) для TanStack Start __root.tsx
- [ ] Реалізувати інвалідацію theme cache — серверна функція `invalidateThemeCache()` що скидає in-memory cache (замінює `revalidateTag('active-theme')`)

### Auth middleware

- [ ] Якщо потрібен загальний middleware (не auth guards — вони вже в beforeLoad):
  - Визначити в start.ts / app.ts серверну конфігурацію
  - CORS headers для API endpoints
  - Security headers (X-Frame-Options, CSP, etc.)
- [ ] Видалити `proxy.ts` (вся його функціональність замінена beforeLoad guards і серверними функціями)

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

- [ ] Чи потрібен TanStack Start server middleware?
  - Чому це важливо: proxy.ts виконував auth guards (вже в beforeLoad) + security headers + logging
  - Варіант A: Лише security headers через Vite plugin або серверну конфігурацію (рекомендовано якщо deploy на Node.js)
  - Варіант B: Повний middleware в start.ts — перевірка auth, headers, logging
  - Варіант C: Без middleware — все в route-level beforeLoad + headers на рівні reverse proxy (Nginx/Cloudflare)
  - Вплив: безпека, архітектура, DevOps

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

ThemeRegistry — чистий TypeScript singleton без framework залежностей. Реєстрація — одна, спільна для server і client. В root route файлі імпортувати файл з реєстрацією (аналог поточного theme-registry.server.ts, але без server-only обмеження).

- Де шукати поточну реалізацію: `app/theme-registry.server.ts` (server), `app/providers.tsx` (client)
- Цільовий стан: один файл `src/theme-registry.ts` імпортований з `src/routes/__root.tsx`

### Providers в __root.tsx

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

### ❌ Використовувати createServerFn для ThemeRegistry реєстрації
ThemeRegistry — клієнтський singleton (потрібен і в браузері для theme components). Реєстрація має бути isomorphic, не server-only.

### ❌ Залишати proxy.ts
Після Phase 4 вся функціональність proxy.ts покрита beforeLoad guards. Файл має бути видалений щоб уникнути плутанини.

## Архітектурні рішення

- **В який пакет додавати код:** `@simplycms/theme-system` (cache utility), `src/` (theme-registry, root integration)
- **Rendering стратегія:** без змін
- **Залежності:** жодних нових
- **Що видаляється:** `proxy.ts`, `app/theme-registry.server.ts` (замінюється на `src/theme-registry.ts`), `unstable_cache` залежність

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

- [ ] `getActiveThemeSSR()` не імпортує з `next/cache` — використовує in-memory cache з TTL
- [ ] ThemeRegistry реєструється один раз в єдиному файлі, доступному і на сервері і на клієнті
- [ ] Providers (QueryClient, ThemeProvider, Toaster) підключені в __root.tsx
- [ ] `proxy.ts` видалено
- [ ] `app/theme-registry.server.ts` замінено на `src/theme-registry.ts`
- [ ] Theme switching з адмінки працює (invalidation → наступний SSR-запит отримує нову тему)
- [ ] `pnpm typecheck` проходить
- [ ] `pnpm dev` — storefront використовує правильну тему, адмінка може перемикати теми
