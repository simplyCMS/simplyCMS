# simplycms/runtime

Складання магазину SimplyCMS: `defineRuntime` збирає `EngineContext` з
інжектованих адаптерів (`links`, `config`), а `defineConfig` типізує
`simplycms.config.ts`. Залежить лише від контрактів `simplycms/contracts` —
Supabase та `import.meta.env` усередині немає.

Шар ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремим пакетом він більше не
постачається: усе ядро приходить одним npm-пакетом `simplycms`, а магазин
створюється скаффолдером `pnpm create simplycms-store`.

## Встановлення

```bash
pnpm add simplycms
```

Вхід цього шару — субшлях `simplycms/runtime`.

## Що всередині

| Символ | Що робить |
|--------|-----------|
| `defineRuntime(input)` | Збирає `SimplyCmsRuntime` = `{ engine, modules, theme, plugins }` з `adapters`; `scope` за замовчуванням — single-tenant |
| `bootstrapRuntime(rt)` | Послідовно виконує `setup()` усіх `EngineModule` під час старту застосунку |
| `defineConfig(config)` | Typed identity для `simplycms.config.ts`; дженерик `<T extends SimplyCmsConfig>` зберігає точні типи лоадерів тем і плагінів |
| Типи | `DefineRuntimeInput`, `SimplyCmsRuntime`, `EngineModule`, `SimplyCmsConfig`, `SimplyCmsSeoConfig`, `PluginRegistration`, `ThemeLoader` |

## Приклад

🔴 **`adapters` звузились до двох чистих провайдерів (0.4.1).**
Репозиторії даних (`catalog`/`orders`/`identity`/`media`) знесені разом із
шаром `simplycms/data-supabase` — вітрина читає БД серверними лоадерами
`simplycms/storefront` через `simplycms/db` (`withActor`), а не з браузера.
`defineRuntime` лишає лише `links`/`config`, тож збірка ізоморфна:

```ts
// src/engine.shared.ts магазину — ізоморфна збірка EngineContext
import { defineRuntime, type SimplyCmsRuntime } from 'simplycms/runtime';
import { appLinks, appConfig } from './engine.shared';

export function buildClientEngine(): SimplyCmsRuntime {
  return defineRuntime({
    adapters: { links: appLinks, config: appConfig },
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
