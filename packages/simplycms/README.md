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
| `@simplycms/themes` | T4 | Theme system (ThemeRegistry, ThemeContext, ThemeResolver) |
| `schema/` | — | Seed migrations (reference SQL for bootstrapping new projects) |

> See `docs/architecture/core-engine-extraction.md` and
> `docs/tasks/core-engine-extraction-implementation.md` for the engine-extraction design and status.

## Usage

SimplyCMS core is distributed via Git Subtree. To use it in your project:

```bash
# Add remote (the project lives under the simplySOFTua org)
git remote add simplycms-core https://github.com/simplySOFTua/simplyCMS-core.git

# Add as subtree
git subtree add --prefix=packages/simplycms simplycms-core main --squash

# Pull updates later
git subtree pull --prefix=packages/simplycms simplycms-core main --squash
```

## Development

When developing within the main SimplyCMS project, changes to `packages/simplycms/` are automatically part of the subtree. To push changes back to the core repo:

```bash
pnpm cms:push                 # push packages/simplycms → simplycms-core main
pnpm cms:push:branch <branch> # push to a specific branch
pnpm cms:diff                 # review local core changes before pushing
```

## License

MIT
