# Migration Execution Workflow — Next.js → TanStack Start (фінальні фази 4–7)

> **[АРХІВ 2026-07-30]** Виконано; known follow-up (server preset для pnpm start) перенесено в backlog-post-migration-remnants.md.

> Створено під час фінального проходу міграції. Фіксує **реальний** стан кодової бази
> та конкретний план довершення, що відрізняється від початкових оцінок.

## Реальний стан на момент старту (гілка `tanstack-start-migration` → `claude/gracious-rubin-lYqCX`)

- **Фундамент TanStack Start готовий:** `vite.config.ts` (`tanstackStart()` + `seoRoutesPlugin()`),
  `src/router.tsx`, `src/start.ts`, `src/routes/__root.tsx`, Tailwind v4 (vite plugin), React 19, Vite 8.
- **Storefront SSR — зроблено:** home, catalog, catalog/section, product, properties (+ option), order-success.
- **Серверні функції (Phase 2) — є:** `src/server/{auth,home,products,properties,sections,themes,supabase}.ts`.
- **`packages/simplycms/*` (subtree) ВЖЕ мігровано на TanStack Router:** admin/core/ui/theme-system
  використовують `@tanstack/react-router` (`Link`, `useNavigate`, `useParams({strict:false})`).
  Залишок `next/*` тут — лише `core/src/supabase/proxy.ts` (`next/server`), який стає мертвим кодом.
- **`next-themes`** — фреймворк-незалежна бібліотека, лишається.

### Чому падав `pnpm typecheck` до цього проходу
Admin-сторінки навігують на типізовані шляхи `/admin/*`, яких **ще не було** в `routeTree.gen.ts`.
Реєстрація admin-роутів усуває ці помилки автоматично.

## Залишок роботи

### A. Admin (client-only) — `src/routes/admin.tsx` (layout) + 42 leaf-роути
- `admin.tsx`: `ssr:false`, `beforeLoad` → `isAdmin()` server fn → `redirect('/auth')`,
  component = `AdminLayout` (`@simplysoftua/admin/layouts/AdminLayout`) з `<Outlet/>`.
- Кожен leaf — тонка обгортка: `createFileRoute(...)({ ssr:false, component })`, де
  component — default-експорт з `@simplysoftua/admin/pages/*`. Жодної логіки в route-файлі.
- Структура дзеркалить старий `app/(cms)/admin/`; режим «new» обробляється сторінками через
  значення параметра (`id === 'new'`), тож окремих `new.tsx` не створюємо.

### B. Auth / Protected / client storefront
- `auth/index.tsx`: `ssr:false`, `beforeLoad` → якщо є user → `redirect('/')`, component = `@simplysoftua/core/pages/Auth`.
- `auth/callback.tsx`: server route (`server.handlers.GET`) — обмін `code` → session → redirect.
- `_protected.tsx`: `beforeLoad` (server) → `getUser()` → `redirect('/auth')`; вантажить активну тему;
  рендерить `theme.ProfileLayout` з `<Outlet/>`.
- `_protected/profile/{index,orders/index,orders/$orderId,settings}.tsx` → `theme.pages.Profile*`.
- `_storefront/cart.tsx`, `_storefront/checkout.tsx` → `ssr:false`, `theme.pages.{Cart,Checkout}Page`.

### C. API → TanStack server routes
- `routes/api/guest-order.tsx`: `server.handlers.POST` (зовнішній клієнт може викликати).
- `routes/api/health.tsx`: `server.handlers.GET`.
- `revalidate` — не відновлюємо (Next-ISR специфіка; кеш-інвалідація через staleTime/router invalidate).

### D. Root infra
- `__root.tsx`: додати `notFoundComponent` (404) та `errorComponent`.
- Перенести `app/globals.css` → `src/styles/globals.css`, оновити import у `__root.tsx`.

### E. Server-side guard (hardening) — `src/start.ts`
- Request-level перевірка для початкового запиту на `/admin` та `/profile` (бо admin `ssr:false`).

### F. Видалення Next.js та стабілізація (Phase 7)
- Видалити `app/`, `next.config.ts`, `next-env.d.ts`, `proxy.ts`, `core/src/supabase/proxy.ts`.
- Прибрати скрипти `dev:next`/`build:next`/`start:next`.
- Оновити `CLAUDE.md` / `.github/instructions` (стек → TanStack Start).

### G. Tooling
- Додати **Prettier** (config + `format`/`format:check` скрипти).
- Переконатися, що `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm format:check` зелені.

## Known follow-up (deploy-time, поза міграцією фреймворку)

- **Production server target.** `vite build` наразі емітить `dist/client` + `dist/server`
  (SSR-модуль), але **не** самостійний node-сервер. Скрипт `start`
  (`node .output/server/index.mjs`) — це задокументований TanStack Start default, який
  запрацює лише після вибору server preset/target (node-server / bun / vercel / netlify
  тощо) під конкретний хостинг. Це deploy-рішення; dev (`pnpm dev`) і `pnpm build` працюють.
- `/api/revalidate` (Next ISR) свідомо не відновлено — кеш-інвалідація через
  `staleTime` + router invalidate / theme cache.

## Порядок виконання
1. Паралельно: (Sonnet) генерує 42 leaf admin-роути; (Opus) — B–E + globals.
2. Opus: F (видалення Next) + G (prettier).
3. Регенерація `routeTree.gen.ts` → `typecheck` → `lint` → `build` → фікси.
4. Детальне код-ревью, виправлення.
5. Commit + push у `claude/gracious-rubin-lYqCX`. (Core/subtree pull виконує власник окремо.)
