# CLAUDE.md — SimplyCMS

## Quick Reference

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (Vite + TanStack Start)
pnpm build            # Production build (vite build)
pnpm start            # Run production server (.output/server/index.mjs)
pnpm typecheck        # TypeScript type check
pnpm lint             # ESLint
pnpm lint:fix         # ESLint (auto-fix)
pnpm format           # Prettier (write)
pnpm format:check     # Prettier (check only)
pnpm test             # Run tests (vitest run)
pnpm test:watch       # Tests in watch mode
pnpm db:pull / db:diff / db:migrate / db:dump-rls / db:generate-types
                      # Схема БД — див. «Database Commands»
```

## What This Project Is

SimplyCMS is an open-source e-commerce CMS built with **TanStack Start (Vite)** and Supabase. It provides a full storefront (SSR), admin panel (client-side SPA), user profiles, cart, checkout, and order management. The core CMS packages live in this monorepo and are published to npmjs (Фаза 1+).

**Platform direction (затверджено 2026-07-30):** SimplyCMS розвивається в OpenCart-подібну платформу — ядро постачає каркас (роути/сторінки) npm-пакетами, магазин стає тонкою збіркою, плагіни й теми — встановлювані одиниці. Джерело правди: [`docs/superpowers/specs/2026-07-30-platform-architecture-design.md`](docs/superpowers/specs/2026-07-30-platform-architecture-design.md); трекінг: [`docs/tasks/platform-roadmap.md`](docs/tasks/platform-roadmap.md).

**Фаза 0 завершена 2026-07-31.** Опис нижче — фактичний стан коду після неї: роути й канонічні сторінки живуть у пакетах (`@simplycms/storefront-routes`, `@simplycms/admin-routes`), host стиснуто до `__root.tsx` + `src/routes/my/`, теми — контракт v2 (`manifest + tokens + components`), схема БД — Drizzle-baseline у `@simplycms/schema`. Незакриті борги Фази 0 перелічені в роадмапі (розділ «Борги»).

## Mandatory Instructions

All detailed coding rules, architecture decisions, and domain-specific guidelines are maintained in `.github/instructions/`. **These are mandatory and must be followed.**

| File | Scope | Description |
|------|-------|-------------|
| [`architecture-core`](.github/instructions/architecture-core.instructions.md) | `**/*` | Core architecture, rendering strategies, themes, plugins, auth |
| [`coding-style`](.github/instructions/coding-style.instructions.md) | `**/*` | TypeScript strict mode, Ukrainian comments, file limits |
| [`data-access`](.github/instructions/data-access.instructions.md) | `app/**`, `packages/**` | Supabase clients, caching, data fetching, DB types |
| [`ui-architecture`](.github/instructions/ui-architecture.instructions.md) | `app/**`, `themes/**`, `ui/**` | UI components, theme structure, shadcn/ui |
| [`editor`](.github/instructions/editor.instructions.md) | `core/**` | Tiptap editor integration |
| [`storage`](.github/instructions/storage.instructions.md) | `core/**`, `app/**` | Supabase Storage patterns |
| [`tooling`](.github/instructions/tooling.instructions.md) | `**/*` | Commands, formatting, testing |
| [`optimization`](.github/instructions/optimization.instructions.md) | `**/*.ts,tsx` | Performance, bundle, rendering optimization |

Also see:
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — Full project overview, MCP servers, agents
- [`AGENTS.md`](AGENTS.md) — Agent-specific instructions

## Agent Tooling

Процесний тулінг для агентної розробки. Джерело правди — `.agents/skills/`;
`.claude/skills/*` і `.github/prompts/*.prompt.md` — симлінки на нього, щоб
Claude Code й Copilot читали **одні й ті самі** файли.

| Шар | Що це |
|-----|-------|
| `.agents/skills/codebase-research/` | Як шукати в репо: `orient` (карта символів, валідація якорів плану), протокол стейл-графа, формат звіту-дельти |
| `.agents/skills/code-review/` | Як рев'ювити: шкала `blocker/major/minor` × confidence з порогом 80, шість лінз, обов'язковий adversarial-крок |
| `.claude/agents/` | Субагенти `codebase-research`, `code-review` (одна лінза за виклик), `code-review-verifier` (скептик) |
| `.claude/commands/` | `/виконай-задачу` (головна), `/перевір-роботу-агента-кодування`, `/проведи-додаткове-дослідження`, `/граф-онови`, `/поділи-задачу-на-етапи`, `/перевір-нову-версію-задачі`, `/проаналізуй-кларіфай-питання`, `/перевір-скіли` |

```bash
ORIENT=.agents/skills/codebase-research/scripts/orient
$ORIENT ThemeRegistry getActiveTheme   # де лежить + хто споживає (з транзитивними через барелі)
$ORIENT --plan docs/superpowers/plans/2026-07-31-phase0-foundation.md
$ORIENT --doctor                       # чи є граф, чи свіжий, чи немає привидів
```

**Knowledge graph (graphify).** `graphify-out/` — локальний артефакт (gitignored),
оновлюється post-commit хуком (AST, без LLM). `orient` працює і без графа —
тихо падає на `ripgrep`. Семантика доків і назви спільнот хуком **не**
оновлюються — це `/граф-онови`; 🔴 завжди з явною дешевою моделлю
(`--model=haiku`), бо `--backend claude-cli` без моделі бере Opus.

**🔴 Порядок гейтів:** `pnpm format:check → lint → build → typecheck → test`.
`build` іде **перед** `typecheck`, бо генерує `src/routeTree.gen.ts`;
гейт саме `format:check`, бо `pnpm format` — це `prettier --write`, який не
червоніє (обидві покривають лише `src/**`).
🔴 **Борг:** `prettier` відсутній у `devDependencies` — обидві команди зараз
падають із `prettier: not found`, а CI їх не запускає. Де-факто гейти
починаються з `pnpm lint`.

🔴 **`pnpm lint` = 0 errors / ~960 warnings — це НОРМА.** Warn-зона двох
`no-restricted-syntax`-селекторів (i18n) навмисно підсвічує ще не мігровані
кириличні рядки в `@simplycms/storefront-routes` та `@simplycms/admin`.
Error-зона — явний список із 3 файлів у `eslint.config.mjs`. Ці ворнінги
**не глушити** й селектори не послабляти: warn→error станеться після
i18n-міграції (роадмап, Фаза 1+).

## Tech Stack

- **Framework:** TanStack Start 1.167 + TanStack Router 1.168 (Vite 8, React 19)
- **Language:** TypeScript 5.9 (strict mode)
- **Package Manager:** pnpm 10.26 (workspaces)
- **Database:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **UI:** Tailwind CSS v4 + shadcn/ui (Radix primitives)
- **Forms:** react-hook-form + Zod 4
- **Data Fetching:** TanStack React Query 5 (client) + route loaders / `createServerFn` (server)
- **Rich Text:** Tiptap v3
- **Testing:** Vitest 4 + Testing Library
- **Formatting:** Prettier 3

## Project Structure

```
simplyCMS/
├── routes.ts                         # virtualRouteConfig: rootRoute + physical() на теки пакетів
├── src/                              # Host — тонка збірка магазину
│   ├── routes/
│   │   ├── __root.tsx                # Root route (html, providers, 404/error)
│   │   └── my/                       # ЄДИНА тека роутів магазину (кастомні сторінки)
│   ├── server/engine.ts              # createServerFn-glue для EngineContext
│   ├── engine-provider.tsx           # EngineProvider (репозиторії lazy, DI-клієнт)
│   ├── engine.shared.ts              # Shared-частина EngineContext (isomorphic)
│   ├── styles/globals.css            # Tailwind v4 entry (@import + @config)
│   ├── theme-registry.ts             # Реєстрація тем з config.themes (side-effect)
│   ├── router.tsx                    # createRouter
│   ├── start.ts                      # createStart + global request middleware (admin guard)
│   ├── client.tsx                    # Client hydration entry
│   └── routeTree.gen.ts              # AUTO-GENERATED — do not edit
│
├── packages/simplycms/               # Ядро CMS (публікація на npmjs — Фаза 1+)
│   ├── objects/            @simplycms/objects        # Контракти + порти (0 deps)
│   ├── domain/             @simplycms/domain         # Pure-логіка: pricing/discounts/inventory/shipping
│   ├── schema/             @simplycms/schema         # Drizzle-схема ядра + RLS у TS + drizzle/ snapshot
│   ├── supabase/           @simplycms/supabase       # browser/server/anon-клієнти, SupabaseProvider, keys
│   ├── data-supabase/      @simplycms/data-supabase  # Реалізації портів на Supabase
│   ├── react-query/        @simplycms/react-query    # Query-хуки через EngineContext
│   ├── runtime/            @simplycms/runtime        # defineRuntime + host-defineConfig
│   ├── i18n/               @simplycms/i18n           # createTranslator, I18nProvider, каталоги uk/en
│   ├── storefront/         @simplycms/storefront     # SSR-лоадери + SEO-генератори (DI-клієнт)
│   ├── storefront-routes/  @simplycms/storefront-routes  # routes/ + канонічні pages/ + shells/ + server/
│   ├── admin-routes/       @simplycms/admin-routes   # routes/admin* (тонкі обгортки)
│   ├── admin/              @simplycms/admin          # Сторінки/компоненти адмінки
│   ├── theme-system/       @simplycms/themes         # ThemeRegistry, applyTokens, validateThemeModule
│   ├── plugin-system/      @simplycms/plugins        # HookRegistry, PluginSlot, bootstrapPlugins
│   ├── ui/                 @simplycms/ui             # shadcn/ui-примітиви
│   ├── {cart,catalog,checkout,profile,reviews}-ui/   # Feature-UI пакети
│   └── core/               @simplycms/core           # Legacy-фасад (розчиняється; Фаза 1+)
│
├── scripts/                          # db-diff.mjs, db-migrate.mjs (конвеєр міграцій)
├── supabase/                         # config.toml, migrations/ (згенеровані), functions/, types.ts
├── themes/default/ · themes/solarstore/   # Теми: manifest + tokens + components (контракт v2)
├── plugins/hello-world/              # Референс-плагін
├── tests/                            # virtual-routes-escape, published-exports-parity
│
├── simplycms.config.ts               # defineConfig: themes, plugins, siteUrl, …
├── vite.config.ts                    # tanstackStart({ virtualRouteConfig: './routes.ts' }) + seoRoutesPlugin()
├── tailwind.config.ts                # Tailwind v4 config
└── pnpm-workspace.yaml               # Workspace config
```

🔴 `src/routes/` сканується **не** цілком: `routes.ts` монтує лише `my/`. Файл,
покладений поруч із `__root.tsx`, роутом не стане (гард — `tests/virtual-routes-escape.test.ts`).

## Package Aliases (tsconfig paths + vite resolve.alias)

Кожен запис має пару `X` і `X/*`. Імʼя пакета ≠ імʼя теки для `themes`/`plugins`.

| Import | Path |
|--------|------|
| `@simplycms/db-types` | `supabase/types.ts` |
| `@simplycms/objects` | `packages/simplycms/objects/src` |
| `@simplycms/domain` | `packages/simplycms/domain/src` |
| `@simplycms/supabase` | `packages/simplycms/supabase/src` |
| `@simplycms/data-supabase` | `packages/simplycms/data-supabase/src` |
| `@simplycms/react-query` | `packages/simplycms/react-query/src` |
| `@simplycms/runtime` | `packages/simplycms/runtime/src` |
| `@simplycms/i18n` | `packages/simplycms/i18n/src` |
| `@simplycms/storefront` | `packages/simplycms/storefront/src` |
| `@simplycms/storefront-routes` | `packages/simplycms/storefront-routes/src` |
| `@simplycms/admin` | `packages/simplycms/admin/src` |
| `@simplycms/ui` | `packages/simplycms/ui/src` |
| `@simplycms/{cart,catalog,checkout,profile,reviews}-ui` | `packages/simplycms/<name>/src` |
| `@simplycms/plugins` | `packages/simplycms/**plugin-system**/src` |
| `@simplycms/themes` | `packages/simplycms/**theme-system**/src` |
| `@simplycms/core` | `packages/simplycms/core/src` (legacy-фасад) |
| `@themes/*` | `themes/*` |
| `@plugins/*` | `plugins/*` |

`@simplycms/schema` і `@simplycms/admin-routes` аліасів **не мають** — вони
резолвляться через workspace-симлінки `node_modules` (schema споживають лише
`scripts/db-*.mjs`, admin-routes монтується шляхом у `routes.ts`).

## Theme System (контракт v2)

Тема постачає **лише** оформлення. Сторінок і лейаутів у ній немає.

```ts
ThemeModule = { manifest, tokens, components, settings? }
```

1. **Реєстрація:** `src/theme-registry.ts` реєструє теми з `config.themes`
   (`simplycms.config.ts`) через `ThemeRegistry.register()` — side-effect-імпорт
   з `__root.tsx`, працює на сервері й на клієнті.
2. **SSR-резолв:** `getActiveThemeSSR` (`@simplycms/themes`) читає активну тему з БД;
   `loader` каркасних роутів віддає `themeName` дітям.
3. **Сторінки — в ядрі:** канонічні сторінки живуть у
   `@simplycms/storefront-routes/src/pages/`. Каркаси `StorefrontShell` /
   `ProtectedShell` беруть з теми `components` (Header/Footer/HomeSections/…)
   і обгортають канонічну сторінку. `theme.pages.*` більше **не існує**.
4. **Токени:** `applyTokens(theme.tokens)` розкладає палітру в CSS-змінні —
   тема не везе власний `theme.css`.
5. **Валідація:** `validateThemeModule` — публічний API для авторів тем;
   `ThemeRegistry.load` падає на тему `default`, якщо запитаної немає.
6. **Активація з адмінки:** прапорець `is_active` у таблиці `themes`;
   перемикання інвалідовує кеш теми.
7. **ThemeContext (клієнт):** приймає `initialThemeName` з лоадера — зайвого
   клієнтського фетчу немає.

## Environment Variables

Required (copy `.env.example` to `.env.local`). Client-exposed vars use the `VITE_` prefix:
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key
  (legacy fallback — `VITE_SUPABASE_ANON_KEY`; резолв — `resolveSupabaseKeys`)
- `VITE_SITE_URL` — Public site URL (production)
- `SUPABASE_PROJECT_ID` — Supabase project ref (tooling)
- `SUPABASE_ACCESS_TOKEN` — Personal access token for Management API (tooling)

## Database Commands

Джерело правди схеми — `packages/simplycms/schema/src/schema.ts` (Drizzle).

```bash
pnpm db:pull                   # Introspect live DB → Drizzle baseline
pnpm db:dump-rls               # Дамп RLS-політик із живої БД (джерело для rls-parity.test.ts)
pnpm db:diff <name>            # schema.ts → SQL у supabase/migrations/ (ревʼю обовʼязкове)
pnpm db:migrate                # supabase link + db push + db:generate-types
pnpm db:generate-types         # Regenerate TypeScript types to supabase/types.ts
```

🔴 Міграції **не** застосовуються через Supabase MCP (`apply_migration`) — MCP лише
для інспекції. Після зміни схеми типи мають бути свіжими (`db:migrate` робить це сам).

## CI/CD

GitHub Actions (`.github/workflows/workflow.yml`) on push/PR to `main`:
- **TypeScript job:** `pnpm install` → `pnpm build` → `pnpm typecheck` → `pnpm lint`
- **Test job:** `pnpm install` → `pnpm test`
