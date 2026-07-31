---
applyTo: '**/*.ts,**/*.tsx'
description: 'Правила оптимізації для SimplyCMS'
---

# Performance Optimization

## SSR & Caching (Storefront)

- Cross-request кешування серверних даних — in-memory TTL у `createServerFn`-хендлерах
  (еталон: `src/server/themes.ts`, 5 хв TTL для активної теми).
- Router-рівень: `staleTime` для loader-даних; інвалідація через `router.invalidate()`.
- Lazy loading зображень (`loading="lazy"`) + явні розміри проти CLS.
- Schema.org structured data для товарних сторінок (SEO).

## React Query & Caching (Admin)

- TanStack React Query для client-side caching в адмінці.
- Правильні `staleTime` для різних типів даних:
  - Довідники (статуси, типи цін): `staleTime: 5 * 60 * 1000` (5 хв)
  - Списки товарів/замовлень: `staleTime: 30 * 1000` (30 сек)
- Після мутацій — **invalidation** відповідних query keys.
- Стабільні `queryKey` між компонентами.

## Bundle Optimization

- Роути `ssr: false` (адмінка) не потрапляють у серверний рендер; клієнтський код
  сплітиться по роутах автоматично (file-based routing).
- **Dynamic imports** (`React.lazy`/динамічний `import()`) для важких компонентів:
  Tiptap editor, Recharts.
- Теми завантажуються ліниво через `ThemeRegistry.load()` — не імпортуй теми напряму.
- Tree shaking через правильні exports у packages.
- `resolve.dedupe` у `vite.config.ts` для react/react-dom/@tanstack/react-query.

## Database

- Pagination для списків > 50 записів.
- **Debounce** 300ms для пошуку та фільтрів.
- Використовуй `.select()` з конкретними полями замість `select('*')` де можливо.
- RLS policies для фільтрації на рівні бази.

## Error Handling

- `errorComponent` / `notFoundComponent` на root-роуті (`src/routes/__root.tsx`).
- `pendingComponent` для `ssr: false`-роутів — обовʼязково (усуває hydration-попередження і «білі» стани).
- Try-catch для всіх Supabase операцій.
- Graceful degradation при недоступності Supabase.

## SSR vs Client

- Storefront-роути — SSR (`_storefront`): HTML з даними для краулерів.
- Інтерактивні частини — звичайні React-компоненти з хуками (стан, ефекти);
  жодних Server Components / `'use client'` — це Vite/TanStack Start, не Next.js.
- `suppressHydrationWarning` для елементів з різним SSR/client рендером (dark mode, cart count).
