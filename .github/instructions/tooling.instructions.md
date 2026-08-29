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

# База даних (використовує DATABASE_URL з .env.local)
pnpm db:pull                # Інтроспекція живої БД → Drizzle-baseline (schema.ts)
pnpm db:diff <name>         # schema.ts → SQL у packages/simplycms/migrations (ревʼю обовʼязкове!)
pnpm test:schema            # Накат канону на чисту БД харнеса (db:migrate виведено з експлуатації)
```

🔴 `pnpm db:generate-types` і `pnpm types:baseline` — **ВИДАЛЕНІ** (0.4.1)
разом із генератом `supabase/types.ts`: типи для НОВОГО серверного коду —
`simplycms/schema/types` (Drizzle). Baseline-файл адмінки
(`packages/simplycms/src/supabase/database.ts`) заморожений до треку К3.

🔴 **`supabase/seed.sql` — ГЕНЕРАТ, руками не правиться.** Джерело правди —
`scripts/pilot-pack/seed-fixtures.mjs`; перегенерація — `pnpm pilot:seed`,
парність стереже `tests/pilot-seed.test.ts`. Так само як `pnpm pilot:e2e` не
переживає без Docker: він піднімає локальний стек (`supabase start` → `db reset`
→ міграції + сід) і в Gate B асертить ТОЧНІ назви товарів із фікстур. Проти
довільної бази (`pnpm pilot`) очікування лишаються нечіткими — назви беруться з
живої БД, тому змінюються разом з нею.

🔴 **Генерат `supabase/types.ts` ВИДАЛЕНИЙ (0.4.1)** разом із
`db:generate-types`/`types:baseline` — магазин на ньому більше не
типізується. Лишився один файл — `packages/simplycms/src/supabase/database.ts`,
**заморожений** baseline core-схеми, проти якого типізується адмінка ядра
(до треку К3, руками не редагується, у `.prettierignore`). Типи для НОВОГО
серверного коду — `simplycms/schema/types` (Drizzle). Деталі —
`packages/simplycms/src/supabase/README.md`.

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

🔴 **Контракт магазину — рівно ТРИ ключі (0.4.1).** Supabase-ключів немає:
браузер у БД не ходить, тож секретів для неї не має.

```env
DATABASE_URL=postgresql://app_runtime:your-password@localhost:5432/postgres
BETTER_AUTH_SECRET=your-32-byte-random-secret
VITE_SITE_URL=https://example.com
```

- Завжди використовуй `.env.local` для локальних значень.
- `VITE_` prefix для клієнтських змінних (`import.meta.env.VITE_*`) — лише `VITE_SITE_URL`/`VITE_LOCALE`.
- `DATABASE_URL`/`BETTER_AUTH_SECRET` — СЕРВЕРНІ, лише `process.env`, у рантаймі (див. `CLAUDE.md` «Environment Variables»).
- Не комітьте `.env.local` — він в `.gitignore`.

### Env-матриця для DB команд

| Змінні | Команди |
|--------|---------|
| `DATABASE_URL` | `db:pull`, `db:diff` (прямий SQL-конект); 🔴 у V2 — ще й рантайм-пул `simplycms/db` |
