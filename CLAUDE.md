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

SimplyCMS is an open-source e-commerce CMS built with **TanStack Start (Vite)** and Supabase. It provides a full storefront (SSR), admin panel (client-side SPA), user profiles, cart, checkout, and order management. The core CMS packages are distributed via Git Subtree from a separate repository.

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
├── packages/simplycms/               # Core CMS (Git Subtree from simplyCMS-core)
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
├── temp/                             # Reference React SPA (read-only)
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
4. **Admin activation:** `themes` table `is_active` flag; switch invalidates the theme cache (no Next `revalidatePath`).
5. **ThemeContext (client):** Accepts `initialThemeName` from the loader, avoids redundant client fetch.

## Environment Variables

Required (copy `.env.example` to `.env.local`). Client-exposed vars use the `VITE_` prefix:
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key
- `VITE_SITE_URL` — Public site URL (production)
- `SUPABASE_PROJECT_ID` — Supabase project ref (tooling)
- `SUPABASE_ACCESS_TOKEN` — Personal access token for Management API (tooling)

## Git Subtree Workflow

```bash
pnpm cms:pull                  # Pull core updates from simplyCMS-core main
pnpm cms:push                  # Push core changes to simplyCMS-core main
pnpm cms:push:branch <branch>  # Push to a specific branch
pnpm cms:diff                  # View local core changes
```

## Database Commands

```bash
pnpm db:migrate                # Apply Supabase migrations
pnpm db:generate-types         # Regenerate TypeScript types to supabase/types.ts
```

After schema changes, always run `pnpm db:generate-types` to keep types in sync.

## CI/CD

GitHub Actions (`.github/workflows/workflow.yml`) on push/PR to `main`:
- **TypeScript job:** `pnpm install` → `pnpm build` → `pnpm typecheck` → `pnpm lint`
- **Test job:** `pnpm install` → `pnpm test`
