# SimplyCMS — Agent Instructions

Open-source e-commerce CMS built with Next.js 16 App Router, Supabase, and modular theme/plugin system.

## Canonical Instructions

All coding rules, architecture decisions, and best practices are maintained in `.github/instructions/`:

| File | Scope | Description |
|------|-------|-------------|
| [`architecture-core`](.github/instructions/architecture-core.instructions.md) | `**/*` | Architecture, rendering, themes, plugins, auth |
| [`coding-style`](.github/instructions/coding-style.instructions.md) | `**/*` | Code style, documentation (Ukrainian), file limits |
| [`data-access`](.github/instructions/data-access.instructions.md) | `app/**`, `packages/**` | Supabase clients, caching, data fetching |
| [`ui-architecture`](.github/instructions/ui-architecture.instructions.md) | `app/**`, `themes/**`, `ui/**` | UI components, theme structure, shadcn/ui |
| [`editor`](.github/instructions/editor.instructions.md) | `core/**` | Tiptap editor integration |
| [`storage`](.github/instructions/storage.instructions.md) | `core/**`, `app/**` | Supabase Storage patterns |
| [`tooling`](.github/instructions/tooling.instructions.md) | `**/*` | Commands, testing, formatting |
| [`optimization`](.github/instructions/optimization.instructions.md) | `**/*.ts,tsx` | Performance, bundle, rendering optimization |

Also see:
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — MCP servers, agent registry, project overview
- [`docs/BRD_SIMPLYCMS_NEXTJS.md`](docs/BRD_SIMPLYCMS_NEXTJS.md) — Business Requirements Document

**These instruction files are mandatory.** All agents MUST follow the rules defined there.

## Quick Reference

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (Turbopack)
pnpm build            # Production build
pnpm typecheck        # TypeScript type check
pnpm lint             # ESLint
pnpm test             # Run tests (vitest run)
pnpm cms:pull         # Pull core updates from simplyCMS-core
pnpm cms:push         # Push core changes to simplyCMS-core
pnpm db:generate-types # Regenerate TypeScript types
```

## Project Structure (Summary)

```
app/                              # Next.js App Router
├── (storefront)/                 # SSR pages — uses getActiveThemeSSR()
├── (cms)/admin/                  # Admin panel (client SPA)
├── (protected)/                  # Auth-protected user pages
├── auth/                         # Login/Register
├── api/                          # API routes
├── theme-registry.server.ts      # Server-side theme registration
├── providers.tsx                 # Client providers (CMSProvider, ThemeProvider)
└── layout.tsx                    # Root layout

packages/simplycms/               # Core CMS (Git Subtree)
├── core/       @simplysoftua/core
├── admin/      @simplysoftua/admin
├── ui/         @simplysoftua/ui
├── plugin-system/  @simplysoftua/plugins
└── theme-system/   @simplysoftua/themes

themes/{default,solarstore}/      # Storefront themes
supabase/                         # Migrations, types, edge functions
```

## Key Conventions (Summary)

- **Rendering:** SSR for storefront, client-side for admin
- **Themes:** Build-time registration, runtime activation via DB
- **Auth:** Cookie-based sessions via `@supabase/ssr`
- **Imports:** Always use `@simplysoftua/*` aliases, not relative paths to packages
- **Language:** Comments and UI text in Ukrainian
- **Do not:** Edit `temp/`, put logic in themes, bypass `@simplysoftua/core` wrappers
