---
applyTo: '**/*'
description: 'Базові архітектурні правила SimplyCMS'
---

# Architecture Core Rules

## Основна архітектура

SimplyCMS — open-source e-commerce CMS з SSR-first підходом для публічних сторінок. Проект складається з:

- **`app/`** — Next.js App Router (маршрутизація, сторінки)
- **`packages/simplycms/`** — Ядро CMS (Git Subtree → окремий репозиторій)
- **`themes/`** — Локальні теми проекту
- **`plugins/`** — Локальні плагіни проекту
- **`temp/`** — Референсний SPA-проект (read-only, для міграції)

### Пакети ядра

| Пакет | Alias | Призначення |
|-------|-------|-------------|
| `core/` | `@simplysoftua/core` | Бізнес-логіка, хуки, типи, Supabase клієнти, компоненти |
| `admin/` | `@simplysoftua/admin` | Адмін-панель (layouts, pages, components) |
| `ui/` | `@simplysoftua/ui` | Дизайн-система (50+ shadcn/ui компонентів) |
| `plugin-system/` | `@simplysoftua/plugins` | HookRegistry, PluginLoader, PluginSlot |
| `theme-system/` | `@simplysoftua/themes` | ThemeRegistry, ThemeContext, ThemeResolver |
| `schema/` | — | Seed-міграції (reference SQL для bootstrap нових проектів) |

### Rendering-стратегії

| Route Group | Стратегія | Опис |
|-------------|-----------|------|
| `(storefront)/` | SSR + ISR | Публічні сторінки, SEO, revalidation |
| `(cms)/admin/` | Client-only | Адмін-панель, `'use client'` |
| `(protected)/` | Client-only | Захищені сторінки (профіль, замовлення) |
| `auth/` | Client-only | Форми авторизації |
| `api/` | Server | API routes |

## ✅ ALWAYS
- Вибирай React Server Components за замовчуванням; додавай `'use client'` лише за потреби (стан, ефекти, події).
- Використовуй пакети `@simplysoftua/*` замість локальних копій (UI, core, admin).
- SSR для storefront-сторінок (каталог, товари, головна) — SEO критично.
- Client-side для адмін-панелі — вся `(cms)/admin/` працює як SPA.
- Cookie-based auth через `@supabase/ssr` (не localStorage JWT).
- **Используй MCP сервери** для перевірки актуальних API:
  - **context7:** Next.js, React, TanStack Query, Zod docs
  - **shadcn:** UI компоненти перед додаванням
  - **supabase:** DB міграції, TypeScript types
- Proxy (`proxy.ts`) для auth guards: `/admin` (admin role), `/profile` (auth).
- Система тем: публічні сторінки рендеряться через `ThemeModule` (layouts, pages).
- Система плагінів: розширення через `HookRegistry` (25+ hook points).
- Git Subtree для синхронізації ядра: `pnpm cms:push` / `pnpm cms:pull`.
- Конфігурація CMS через `simplycms.config.ts` (тема, плагіни, Supabase, SEO).

## ❌ NEVER
- Не розміщуй бізнес-логіку в темах (теми — лише візуальна складова).
- Не обминай систему тем для storefront-сторінок.
- Не редагуй файли в `temp/` — це read-only референс для міграції.
- Не хардкодь Supabase URL/ключі — використовуй змінні оточення.
- Не використовуй прямий `supabase-js` без `@simplysoftua/core` обгорток в клієнтському коді.
- **НЕ додавай shadcn/ui компоненти без перевірки через MCP** (search → examples → audit).
- **НЕ припускай library APIs — перевіряй через MCP context7**.
- Не ставай `'use client'` в Server Components без потреби.
- Не виноси auth-логіку за межі `proxy.ts` та `auth/` route.
- Не створюй файли > 150 рядків без розбиття.

## 📚 Коли потрібні деталі
- Міграційний план: `BRD_SIMPLYCMS_NEXTJS.md`
- Система тем: BRD секція 7 (ThemeModule, ThemeManifest, ThemePages)
- Система плагінів: BRD секція 8 (PluginModule, HookRegistry, hook points)
- SSR-стратегія: BRD секція 9 (ISR, revalidation, Server/Client Components)
- Автентифікація: BRD секція 10 (Supabase SSR, proxy)
- База даних: BRD секція 11 (міграції ядра vs проекту)
- Файлове перенесення: BRD Додаток A (map temp/ → packages/)

## 🔄 Робочий цикл
1. Прочитай відповідний розділ `BRD_SIMPLYCMS_NEXTJS.md`, якщо працюєш над новою фічею.
2. Використовуй MCP для перевірки актуальних API та best practices.
3. Перевір, чи існує інструкція в `.github/instructions` для твоєї сфери.
4. Якщо мігруєш компонент — знайди оригінал у `temp/src/` та адаптуй.
5. Лише після цього додавай або змінюй код.
