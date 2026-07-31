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
```

## What This Project Is

SimplyCMS is an open-source e-commerce CMS built with **TanStack Start (Vite)** and Supabase. It provides a full storefront (SSR), admin panel (client-side SPA), user profiles, cart, checkout, and order management. The core CMS packages live in this monorepo and are published to npmjs (Фаза 1+).

**Platform direction (затверджено 2026-07-30):** SimplyCMS розвивається в OpenCart-подібну платформу — ядро постачає каркас (роути/сторінки) npm-пакетами, магазин стає тонкою збіркою, плагіни й теми — встановлювані одиниці. Джерело правди: [`docs/superpowers/specs/2026-07-30-platform-architecture-design.md`](docs/superpowers/specs/2026-07-30-platform-architecture-design.md); трекінг: [`docs/tasks/platform-roadmap.md`](docs/tasks/platform-roadmap.md). Опис нижче документує **поточний** стан коду до реструктуризації.

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
├── src/                              # TanStack Start application
│   ├── routes/                       # File-based routes (TanStack Router)
│   │   ├── __root.tsx                # Root route (html, providers, 404/error)
│   │   ├── _storefront.tsx + _storefront/  # Public SSR pages (theme MainLayout)
│   │   ├── admin.tsx + admin/        # Admin panel (client-only, ssr:false, guard)
│   │   ├── _protected.tsx + _protected/    # Auth-guarded profile pages
│   │   ├── auth/                     # Login/register (index) + OAuth callback (server route)
│   │   └── api/                      # Server routes (health, guest-order)
│   ├── server/                       # createServerFn (auth, themes, products, …)
│   ├── seo/                          # sitemap.xml / robots.txt vite plugin
│   ├── styles/globals.css            # Tailwind v4 entry (@import + @config)
│   ├── theme-registry.ts             # Isomorphic theme registration (side-effect)
│   ├── router.tsx                    # createRouter
│   ├── start.ts                      # createStart + global request middleware (admin guard)
│   ├── client.tsx                    # Client hydration entry
│   └── routeTree.gen.ts              # AUTO-GENERATED — do not edit
│
├── supabase/                         # Site-level database
│   ├── config.toml                   # Supabase project config
│   ├── migrations/                   # SQL migrations
│   ├── functions/                    # Edge Functions
│   └── types.ts                      # Auto-generated TypeScript types
│
├── packages/simplycms/               # Core CMS (у монорепо; публікація на npmjs — Фаза 1+)
│   ├── core/src/       @simplycms/core
│   ├── admin/src/      @simplycms/admin
│   ├── ui/src/         @simplycms/ui
│   ├── plugin-system/  @simplycms/plugins
│   ├── theme-system/   @simplycms/themes
│   └── schema/                       # Seed migrations
│
├── themes/default/                   # Default storefront theme
├── themes/solarstore/                # SolarStore theme (blue palette)
├── plugins/                          # Local plugins directory
│
├── simplycms.config.ts               # CMS config
├── vite.config.ts                    # Vite + tanstackStart() + seoRoutesPlugin()
├── tailwind.config.ts                # Tailwind v4 config
└── pnpm-workspace.yaml               # Workspace config
```

## Package Aliases (tsconfig paths)

| Import | Path |
|--------|------|
| `@simplycms/db-types` | `supabase/types.ts` |
| `@simplycms/core` | `packages/simplycms/core/src` |
| `@simplycms/admin` | `packages/simplycms/admin/src` |
| `@simplycms/ui` | `packages/simplycms/ui/src` |
| `@simplycms/plugins` | `packages/simplycms/plugin-system/src` |
| `@simplycms/themes` | `packages/simplycms/theme-system/src` |
| `@themes/*` | `themes/*` |
| `@plugins/*` | `plugins/*` |

## Theme System (SSR)

Themes use isomorphic registration + runtime DB activation:

1. **Registration:** `src/theme-registry.ts` registers themes via `ThemeRegistry.register()` — imported as a side-effect from `__root.tsx` (works on server and client).
2. **SSR Resolution:** `src/server/themes.ts` (`getActiveTheme` `createServerFn`) reads the active theme from the DB; the `_storefront` / `_protected` route `loader` provides `themeName` to children.
3. **Storefront pages:** Route component does `const theme = use(ThemeRegistry.load(themeName))` → renders `theme.pages.XxxPage`.
4. **Admin activation:** `themes` table `is_active` flag; switch invalidates the theme cache.
5. **ThemeContext (client):** Accepts `initialThemeName` from the loader, avoids redundant client fetch.

## Environment Variables

Required (copy `.env.example` to `.env.local`). Client-exposed vars use the `VITE_` prefix:
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key
- `VITE_SITE_URL` — Public site URL (production)
- `SUPABASE_PROJECT_ID` — Supabase project ref (tooling)
- `SUPABASE_ACCESS_TOKEN` — Personal access token for Management API (tooling)

## Database Commands

Джерело правди схеми — `packages/simplycms/schema/src/schema.ts` (Drizzle).

```bash
pnpm db:pull                   # Introspect live DB → Drizzle baseline
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
