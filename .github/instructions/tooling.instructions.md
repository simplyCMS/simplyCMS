---
applyTo: '**/*'
description: 'Команди, форматування, тестування та середовище розробки'
---

# Tooling Rules

## Package Manager
- **pnpm** (v10.x) — єдиний пакетний менеджер.
- Workspace: `packages/simplycms/*`, `themes/*`, `plugins/*`.
- Не використовуй `npm` або `yarn`.

## Основні команди

```bash
# Розробка
pnpm dev                    # Vite dev server (TanStack Start)
pnpm build                  # Production build (vite build)
pnpm start                  # Production server (.output/server/index.mjs)
pnpm typecheck              # TypeScript type check
pnpm lint                   # ESLint
pnpm lint:fix               # ESLint (auto-fix)
pnpm format                 # Prettier (write)
pnpm format:check           # Prettier (check only)

# Тестування
pnpm test                   # Vitest run
pnpm test:watch             # Vitest watch mode

# Пакети ядра
pnpm build:packages         # tsup build публікованих пакетів

# База даних (використовує SUPABASE_PROJECT_ID + SUPABASE_ACCESS_TOKEN з .env.local)
pnpm db:pull                # Інтроспекція живої БД → Drizzle-baseline (schema.ts)
pnpm db:diff <name>         # schema.ts → SQL у supabase/migrations (ревʼю обовʼязкове!)
pnpm db:migrate             # Застосувати міграції (supabase link + db push + типи)
pnpm db:generate-types      # Згенерувати TypeScript типи з Supabase
```

## Конфігурація

### TypeScript
- Strict mode увімкнено.
- Path aliases (повний перелік — `tsconfig.json` + дзеркало у `vite.config.ts`):
  - `@simplycms/db-types` → `supabase/types.ts`
  - `@simplycms/*` → `packages/simplycms/*/src` (objects, domain, data-supabase,
    react-query, core, admin, ui, plugins → plugin-system, themes → theme-system,
    storefront, storefront-routes, runtime, supabase, i18n, cart-ui, catalog-ui,
    checkout-ui, profile-ui, reviews-ui)
  - `@themes/*` → `themes/*`
  - `@plugins/*` → `plugins/*`

### ESLint
- Flat config (`eslint.config.mjs`): typescript-eslint + eslint-plugin-react-hooks.
- `src/routeTree.gen.ts` виключено з лінтингу (автогенерований).

### Vite / TanStack Start
- `vite.config.ts`: `tanstackStart()` + `tailwindcss()` + `seoRoutesPlugin()`.
- `resolve.dedupe`: `react`, `react-dom`, `@tanstack/react-query`.
- Тести мають окремий `vitest.config.ts` (з `@vitejs/plugin-react`, без tanstackStart).

### Tailwind v4
- Конфігурація в `tailwind.config.ts`; entry — `src/styles/globals.css` (`@import` + `@config`).
- Vite plugin `@tailwindcss/vite`.
- Typography plugin: `@tailwindcss/typography`.

## Тестування
- **Vitest** для unit та integration тестів.
- **Testing Library** (@testing-library/react) для компонентів (environment: jsdom per-file).
- Тести поруч з кодом або в `__tests__/` директоріях.
- `tests/published-exports-parity.test.ts` — guard паритету dev/publish exports пакетів.

## Змінні оточення

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_SITE_URL=https://example.com
SUPABASE_PROJECT_ID=your-project-ref
SUPABASE_ACCESS_TOKEN=sbp_xxxx
```

- Завжди використовуй `.env.local` для локальних значень.
- `VITE_` prefix для клієнтських змінних (`import.meta.env.VITE_*`).
- `SUPABASE_PROJECT_ID` + `SUPABASE_ACCESS_TOKEN` — для CLI (міграції, генерація типів через Management API).
- Не комітьте `.env.local` — він в `.gitignore`.

### Env-матриця для DB команд

| Змінні | Команди |
|--------|---------|
| `SUPABASE_PROJECT_ID` + `SUPABASE_ACCESS_TOKEN` | `db:generate-types`, `db:migrate` (Management API) |
| `DATABASE_URL` | `db:pull`, `db:diff`, `db:dump-rls` (прямий SQL-конект, session pooler) |
