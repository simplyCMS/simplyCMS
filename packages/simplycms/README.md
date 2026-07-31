# SimplyCMS Core

Open-source headless commerce engine — core packages for TanStack Start (Vite) + Supabase.

## Packages

| Package | Tier | Description |
|---------|------|-------------|
| `@simplycms/objects` | T0 | Domain object contracts + ports (repositories, providers, `EngineContext`). Type-only, 0 runtime deps. |
| `@simplycms/domain` | T1 | Pure commerce logic — `./pricing`, `./discounts`, `./inventory`, `./shipping`. No IO. |
| `@simplycms/data-supabase` | T2 | Supabase implementations of the ports (DI: injected client + `ScopeResolver`). *(planned)* |
| `@simplycms/react-query` | T2 | TanStack Query hooks wired through `EngineProvider`/`useEngine`. |
| `@simplycms/core` | — | Legacy facade; re-exports domain logic for backward compatibility (being decomposed). |
| `@simplycms/admin` | T5 | Admin panel layouts, pages, components |
| `@simplycms/ui` | T3 | shadcn/ui component library |
| `@simplycms/plugins` | T4 | Plugin system (HookRegistry, PluginLoader, PluginSlot) |
| `@simplycms/themes` | T4 | Theme system v2 (ThemeRegistry, ThemeContext, `applyTokens`, `validateThemeModule`) — теки `theme-system/` |
| `@simplycms/i18n` | T2 | Request-scoped translator (`createTranslator`, `I18nProvider`, `useT`) + каталоги uk/en |
| `@simplycms/runtime` | T2 | `defineRuntime` (складання `EngineContext`) + host-`defineConfig` |
| `@simplycms/supabase` | T2 | Клієнти browser/server/anon, `SupabaseProvider`, `resolveSupabaseKeys`, типи БД |
| `@simplycms/storefront` | T2 | SSR-лоадери + SEO-генератори (Supabase-клієнт інʼєктується) |
| `@simplycms/storefront-routes` | T5 | Канонічні SSR-сторінки + route-файли storefront/protected/auth/api |
| `@simplycms/admin-routes` | T5 | Route-файли адмінки (тонкі обгортки `@simplycms/admin`) |
| `@simplycms/schema` | T1 | Drizzle-baseline схеми ядра + RLS у TS (`db:pull`/`db:diff`/`db:migrate`) |

> See `docs/superpowers/specs/2026-07-30-platform-architecture-design.md` for the platform architecture (packages, routes, plugins, themes, migrations).

## Usage

Ці пакети живуть у монорепо SimplyCMS — окремих форків/копій у магазинах немає.
Магазини споживають ядро як звичайні npm-залежності (публікація на npmjs —
Фаза 1+ роадмапу платформи); розширення відбувається через плагіни й теми, а
не форк ядра.

## Development

Розробка ведеться напряму в цьому монорепо: зміни в `packages/simplycms/`
коммітяться разом з рештою проекту, окремого push у зовнішній core-репозиторій
не потрібно.

## License

MIT
