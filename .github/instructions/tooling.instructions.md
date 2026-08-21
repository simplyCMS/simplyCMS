---
applyTo: '**/*'
description: 'Команди, форматування, тестування та середовище розробки'
---

# Tooling Rules

## Package Manager
- **pnpm** (v11.x) — єдиний пакетний менеджер. 🔴 Усі налаштування pnpm живуть у `pnpm-workspace.yaml`: з v11 поле `pnpm` у `package.json` мовчки ігнорується, а `.npmrc` читається лише для auth і registry.
- Workspace: `packages/*`, `themes/*`, `plugins/*` — усі публіковані пакети лежать в одній теці `packages/`. Після К0 їх рівно пʼять: unscoped флагман `simplycms` (усе ядро теками `src/*`), `@simplycms/cli`, `@simplycms/theme-solarstore`, `@simplycms/plugin-faq`, `create-simplycms-store`.
- Не використовуй `npm` або `yarn`.

## Основні команди

```bash
# Розробка
pnpm dev                    # Vite dev server (TanStack Start)
pnpm build                  # Production build (vite build)
pnpm start                  # Production server (node server.mjs, PORT=3000)
pnpm typecheck              # TypeScript type check
pnpm lint                   # ESLint
pnpm lint:fix               # ESLint (auto-fix)
pnpm format                 # Prettier (write)
pnpm format:check           # Prettier (check only)

# Тестування
pnpm test                   # Vitest run (packaging-suite виключено — див. нижче)
pnpm test:watch             # Vitest watch mode
pnpm test:packaging         # Tarball-parity suite (vitest.packaging.config.ts)

# Пакети ядра
pnpm build:packages         # tsup build публікованих пакетів
pnpm template:sync          # регенерація шаблону create-simplycms-store з монорепо (закомічені копії)
pnpm pilot:pack             # tarball-пілот, гейти A/C/D/CLI — без Supabase; Gate E видимо SKIP
pnpm pilot                  # той самий пілот + Gate B проти живої БД (.env.local); Gate E досі SKIP
pnpm pilot:e2e              # гейти A/C/D/CLI/B/E проти ЛОКАЛЬНОГО стеку (supabase start + db reset)
pnpm pilot:seed             # фікстури пілота → supabase/seed.sql (генерат!)

# База даних (використовує SUPABASE_PROJECT_ID + SUPABASE_ACCESS_TOKEN з .env.local)
pnpm db:pull                # Інтроспекція живої БД → Drizzle-baseline (schema.ts)
pnpm db:diff <name>         # schema.ts → SQL у supabase/migrations (ревʼю обовʼязкове!)
pnpm db:migrate             # Застосувати міграції (supabase link + db push + типи)
pnpm db:generate-types      # Згенерувати TypeScript типи з Supabase → supabase/types.ts
pnpm types:baseline         # Снапшот CORE-типів → packages/simplycms/src/supabase/database.ts
```

🔴 **`supabase/seed.sql` — ГЕНЕРАТ, руками не правиться.** Джерело правди —
`scripts/pilot-pack/seed-fixtures.mjs`; перегенерація — `pnpm pilot:seed`,
парність стереже `tests/pilot-seed.test.ts`. Так само як `pnpm pilot:e2e` не
переживає без Docker: він піднімає локальний стек (`supabase start` → `db reset`
→ міграції + сід) і в Gate B асертить ТОЧНІ назви товарів із фікстур. Проти
довільної бази (`pnpm pilot`) очікування лишаються нечіткими — назви беруться з
живої БД, тому змінюються разом з нею.

🔴 **Типів БД у репо ДВА файли.** `supabase/types.ts` — генерат МАГАЗИНУ
(core + таблиці встановлених плагінів), проти нього типізується host-код.
`packages/simplycms/src/supabase/database.ts` — **baseline** core-схеми, проти
якого типізуються пакети ядра; оновлюється `pnpm types:baseline` і ЛИШЕ з
еталонної dev-БД без плагінів, після кожної core-міграції. Обидва — генерати:
руками не редагуються, у `.prettierignore`. Магазин звужує клієнти до своїх
типів через generic-параметр фабрик (`createServerSupabase<StoreDatabase>()`) —
див. `packages/simplycms/src/supabase/README.md`.

## Конфігурація

### TypeScript
- Strict mode увімкнено.
- Path aliases (повний перелік — `tsconfig.json` + дзеркало у `vite.config.ts`):
  - `simplycms` / `simplycms/*` → `packages/simplycms/src` / `packages/simplycms/src/*`
    — 🔴 ОДНА пара покриває весь T0–T5: аліасів злитих пакетів після К0 немає,
    конкретний шар — це субшлях (`simplycms/contracts`, `simplycms/ui`,
    `simplycms/themes/conformance`, …)
  - `@simplycms/theme-solarstore`, `@simplycms/plugin-faq` → `packages/simplycms-*/src`
    (сателіти; `@simplycms/cli` аліаса не має — bin-інструмент)
  - `@themes/*` → `themes/*`
  - `@plugins/*` → `plugins/*`
  🔴 У Vite/vitest ключ ОДИН — `simplycms` (base-prefix): `@rollup/plugin-alias`
  матчить і корінь, і субшляхи, але **не** `simplycms-*`, тож сторонні
  `simplycms-theme-*`/`simplycms-plugin-*` не перехоплюються.

### ESLint
- Flat config (`eslint.config.mjs`): typescript-eslint + eslint-plugin-react-hooks.
- `src/routeTree.gen.ts` виключено з лінтингу (автогенерований).
- 🔴 Тір-зони ядра — `eslint.tier-zones.mjs` + `eslint.tier-relative.mjs`
  (трек К0): імпорт УГОРУ по тірах усередині пакета `simplycms` — error,
  в обох формах специфікатора (bare-субшлях `simplycms/<тека>` і відносний
  `../<тека>`). Після злиття пакетів межу `dependencies` не тримає ніщо, тож
  селектори не послаблювати; негативний контроль — `tests/tier-boundary.test.ts`.

### Vite / TanStack Start
- `vite.config.ts`: `tanstackStart({ router.virtualRouteConfig, server.entry })` + `tailwindcss()`.
- SEO-ендпойнти (`/sitemap.xml`, `/robots.txt`) — у серверному вході `src/server.ts`
  (працює в dev, `vite preview` і production; окремого vite-плагіна немає).
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
  Він **виключений** із `pnpm test` (`test.exclude` у `vitest.config.ts`), бо працює по
  зібраних tarball-ах: запускати `pnpm build:packages && pnpm test:packaging`.
- 🔴 `pnpm typecheck:template` — між ними. Кореневий `tsconfig.json` виключає
  `packages/create-simplycms-store/template`, тож `pnpm typecheck` шаблону НЕ
  бачить: помилка типів у `template/routes.ts` проходить усі інші гейти
  зеленими, а магазин із такого шаблону не збирається. Гейт типізує шаблон
  проти зібраного `dist` — того самого, що бачить магазин, — тому йде після
  `build:packages`. Покриття списку файлів стереже
  `tests/template-typecheck-coverage.test.ts`.

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
