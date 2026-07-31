# SimplyCMS

Open-source e-commerce CMS built with TanStack Start, Supabase, and shadcn/ui.

## Vision: e-commerce platform

SimplyCMS розвивається в OpenCart-подібну платформу нового покоління:

- **Ядро** постачає готовий магазин (SSR-вітрина + адмінка) версіонованими npm-пакетами — магазин це **тонка збірка** (~8 файлів + конфіг), а не форк репозиторію.
- **`pnpm update` приносить нові сторінки й фікси** існуючим магазинам без ручного переносу коду.
- **Плагіни й теми** — встановлювані npm-пакети (`simplycms add …` + rebuild); активація й налаштування — з адмінки, без перезбірки.
- **Канонічні сторінки** (каталог, товар, checkout…) — SEO/AI-оптимізовані з коробки й однакові для всіх магазинів; кастомізація — через теми (токени + брендові компоненти), слоти плагінів і власні сторінки.

Детально: [Як це працює](docs/how-it-works.md) · [Специфікація архітектури](docs/superpowers/specs/2026-07-30-platform-architecture-design.md) · [Роадмап](docs/tasks/platform-roadmap.md)

> Код нижче описує поточний стан репозиторію до реструктуризації (Фаза 0 роадмапу).

## Tech Stack

- **TanStack Start** (Vite 8, file-based routing, SSR) + **TanStack Router**
- **React 19** + **TypeScript** (strict mode)
- **Supabase** (Auth, Database, Storage, Edge Functions)
- **shadcn/ui** + Radix UI
- **Tailwind CSS v4**
- **TanStack React Query 5**

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy env template and fill in Supabase credentials
cp .env.example .env.local

# Start development server
pnpm dev
```

## Code Quality

```bash
pnpm typecheck     # TypeScript
pnpm lint          # ESLint
pnpm test          # Vitest
pnpm format:check  # Prettier
```

## Project Structure

```
src/                    # TanStack Start application
  routes/               # File-based routes (storefront SSR, admin SPA, profile, auth, api)
  server/               # createServerFn functions
  seo/                  # sitemap.xml / robots.txt
packages/simplycms/     # Core CMS packages (Git Subtree from simplyCMS-core)
  ├── objects/          # Domain contracts + ports (0 deps)
  ├── domain/           # Pure business logic (pricing, discounts, inventory, shipping)
  ├── data-supabase/    # Supabase repository implementations
  ├── react-query/      # EngineProvider + data hooks
  ├── core/             # Legacy core (hooks, pages, providers)
  ├── admin/            # Admin panel
  ├── ui/               # shadcn/ui component library
  ├── plugin-system/    # Plugin architecture (HookRegistry, PluginSlot)
  ├── theme-system/     # Theme engine (registry + SSR resolution)
  ├── storefront/       # SSR loaders + SEO builders
  └── ...               # cart-ui, catalog-ui, checkout-ui, profile-ui, reviews-ui, runtime, schema
themes/                 # Storefront themes (default, solarstore)
plugins/                # Local plugins
supabase/               # Migrations, generated types, edge functions
```

See [`CLAUDE.md`](CLAUDE.md) for the full development reference.

## License

MIT
