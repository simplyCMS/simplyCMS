# @simplycms/runtime

Складання магазину SimplyCMS: `defineRuntime` збирає `EngineContext` з
інжектованих адаптерів (репозиторії, identity, links, media, config), а
`defineConfig` типізує `simplycms.config.ts`. Залежить лише від контрактів
`@simplycms/objects` — Supabase та `import.meta.env` усередині немає.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/runtime
```

## Що всередині

| Символ | Що робить |
|--------|-----------|
| `defineRuntime(input)` | Збирає `SimplyCmsRuntime` = `{ engine, modules, theme, plugins }` з `adapters`; `scope` за замовчуванням — single-tenant |
| `bootstrapRuntime(rt)` | Послідовно виконує `setup()` усіх `EngineModule` під час старту застосунку |
| `defineConfig(config)` | Typed identity для `simplycms.config.ts`; дженерик `<T extends SimplyCmsConfig>` зберігає точні типи лоадерів тем і плагінів |
| Типи | `DefineRuntimeInput`, `SimplyCmsRuntime`, `EngineModule`, `SimplyCmsConfig`, `SimplyCmsSeoConfig`, `PluginRegistration`, `ThemeLoader` |

## Приклад

```ts
// src/server/engine.ts магазину — серверний рантайм на одному Supabase-клієнті
import { defineRuntime, type SimplyCmsRuntime } from '@simplycms/runtime';

export function createServerRuntime(cookieHeader?: string): SimplyCmsRuntime {
  const client = createServerSupabase(cookieHeader);
  return defineRuntime({
    adapters: {
      catalog: createSupabaseCatalogRepository(client, singleTenantScope),
      orders: createSupabaseOrderRepository(client, singleTenantScope),
      identity: createSupabaseIdentityProvider(client),
      links: appLinks,
      media: createAppMediaProvider(client),
      config: appConfig,
    },
  });
}
```

## 🔴 `defineConfig` і `defineRuntime` — різні контури

`defineConfig` описує **сайт** (SEO, локаль, валюта, набір тем і плагінів
лінивими лоадерами), `defineRuntime` — **адаптери даних**; один одного не читає
й не замінює. Модуль у лоадері конфігу — `unknown` навмисно: його форму валідує
`ThemeRegistry` / `bootstrapPlugins`, а не рантайм.

## Ліцензія

MIT
