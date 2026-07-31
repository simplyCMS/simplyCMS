---
applyTo: '**/*'
description: 'Базові архітектурні правила SimplyCMS'
---

# Architecture Core Rules

## Основна архітектура

SimplyCMS — open-source e-commerce CMS на TanStack Start з SSR-first підходом для публічних сторінок. Проект складається з:

- **`src/`** — TanStack Start застосунок (file-based роути, серверні функції, SEO)
- **`packages/simplycms/`** — Ядро CMS (Git Subtree → окремий репозиторій simplyCMS-core)
- **`themes/`** — Локальні теми проекту
- **`plugins/`** — Локальні плагіни проекту

### Пакети ядра (tier-архітектура)

| Пакет | Alias | Tier | Призначення |
|-------|-------|------|-------------|
| `objects/` | `@simplycms/objects` | T0 | Доменні контракти + порти (0 runtime deps) |
| `domain/` | `@simplycms/domain` | T1 | Pure-логіка: pricing, discounts, inventory, shipping |
| `data-supabase/` | `@simplycms/data-supabase` | T2 | Репозиторії на інжектованому Supabase-клієнті |
| `react-query/` | `@simplycms/react-query` | T2 | `EngineProvider`/`useEngine` + data-хуки |
| `ui/` | `@simplycms/ui` | T3 | Дизайн-система (50+ shadcn/ui компонентів, self-contained) |
| `theme-system/` | `@simplycms/themes` | T4 | ThemeRegistry, ThemeContext, SSR-резолв теми |
| `plugin-system/` | `@simplycms/plugins` | T4 | HookRegistry, PluginLoader, PluginSlot |
| `storefront/` | `@simplycms/storefront` | T4 | SSR-loaders + SEO (sitemap/robots) |
| `*-ui/` | `@simplycms/{cart,catalog,checkout,profile,reviews}-ui` | T5 | Feature-UI |
| `admin/` | `@simplycms/admin` | T5 | Адмін-панель (layouts, pages, components) |
| `core/` | `@simplycms/core` | — | Legacy-ядро (хуки, pages, providers; поступово розноситься по tier-ах) |
| `runtime/` | `@simplycms/runtime` | T6 | `defineConfig` / збірка EngineContext |
| `schema/` | — | — | Seed-міграції (reference SQL для bootstrap нових проектів) |

Залежності — тільки вниз по tier-ах. Цільова архітектура платформи: `docs/superpowers/specs/2026-07-30-platform-architecture-design.md`.

### Rendering-стратегії

| Route group | Стратегія | Опис |
|-------------|-----------|------|
| `_storefront/` | SSR | Публічні сторінки, SEO; loader надає `themeName` |
| `admin/` | Client-only (`ssr: false`) | Адмін-панель як SPA; обовʼязковий `pendingComponent` |
| `_protected/` | SSR guard + client | `beforeLoad` перевіряє auth, редіректить на `/auth` |
| `auth/` | Client-only + server route | Форми авторизації; `callback` — server handler (OAuth) |
| `api/` | Server routes | `server.handlers` (health, guest-order) |

## ✅ ALWAYS
- SSR для storefront-сторінок (каталог, товари, головна) — SEO критично.
- Client-side (`ssr: false`) для адмін-панелі; **завжди** додавай `pendingComponent` для `ssr:false`-роутів.
- Route-файли — тонкі обгортки: `createFileRoute` + component з пакетів/тем; без бізнес-логіки.
- Дані на сервері — через `createServerFn` (`src/server/*`) або route `loader`.
- Cookie-based auth через `@supabase/ssr` (не localStorage JWT).
- Request-level guard для `/admin` — у `src/start.ts` (middleware).
- Supabase-клієнт — через DI: `SupabaseProvider`/`useSupabaseClient` або репозиторії-порти; не глобальний singleton.
- Використовуй пакети `@simplycms/*` замість локальних копій (UI, core, admin).
- **Використовуй MCP сервери** для перевірки актуальних API:
  - **context7:** TanStack Start/Router, React, TanStack Query, Zod docs
  - **shadcn:** UI компоненти перед додаванням
  - **supabase:** DB міграції, TypeScript types
- Система тем: публічні сторінки рендеряться через `ThemeModule` (layouts, pages) з `ThemeRegistry`.
- Система плагінів: розширення через `HookRegistry` (25+ hook points).
- Git Subtree для синхронізації ядра: `pnpm cms:push` / `pnpm cms:pull`.
- Конфігурація CMS через `simplycms.config.ts` (тема, плагіни, Supabase, SEO).

## ❌ NEVER
- Не розміщуй бізнес-логіку в темах (теми — лише візуальна складова).
- Не обминай систему тем для storefront-сторінок.
- Не редагуй `src/routeTree.gen.ts` — автогенерований.
- Не хардкодь Supabase URL/ключі — використовуй змінні оточення (`VITE_*`).
- Не імпортуй глобальний supabase-клієнт — тільки DI (`useSupabaseClient`/порти).
- **НЕ додавай shadcn/ui компоненти без перевірки через MCP** (search → examples → audit).
- **НЕ припускай library APIs — перевіряй через MCP context7**.
- Не виноси auth-guard логіку за межі `src/start.ts` та `auth/`-роутів.
- Не створюй файли > 150 рядків без розбиття.

## 📚 Коли потрібні деталі
- Огляд проекту та структура: `CLAUDE.md`
- Архітектура платформи (пакети, роути, плагіни, теми, міграції): `docs/superpowers/specs/2026-07-30-platform-architecture-design.md`
- Аналітична база рішень: `docs/architecture/platform-delivery-options.md`
- Система тем (SSR-резолв, реєстрація): `CLAUDE.md` розділ «Theme System (SSR)»
- SEO/faceted navigation: `docs/tasks/seo-ssr-faceted-navigation.md`

## 🔄 Робочий цикл
1. Перевір, чи існує інструкція в `.github/instructions` для твоєї сфери.
2. Використовуй MCP для перевірки актуальних API та best practices.
3. Для нових фіч звіряйся з `docs/architecture/` та відкритими задачами в `docs/tasks/`.
4. Лише після цього додавай або змінюй код.
