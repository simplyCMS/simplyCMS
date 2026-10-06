# simplycms/runtime

`defineConfig` типізує `simplycms.config.ts` (локаль, валюта, набір тем
і плагінів лінивими лоадерами) — це і є чинний спосіб конфігурації магазину.
Шар несе також `defineRuntime`/`bootstrapRuntime` — заявлений, але **без
жодного споживача в коді** (див. нижче). Залежить лише від контрактів
`simplycms/contracts` — Supabase та `import.meta.env` усередині немає.

Шар ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Postgres. Окремим пакетом він більше не
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
| `defineConfig(config)` | Typed identity для `simplycms.config.ts`; дженерик `<T extends SimplyCmsConfig>` зберігає точні типи лоадерів тем і плагінів. **Активно споживається** — і кореневим `simplycms.config.ts`, і шаблоном скаффолдера |
| `defineRuntime(input)` | Збирає `SimplyCmsRuntime = { engine, modules, theme, plugins }` з `adapters: { links, config }`. 🔴 Без споживачів (див. «Відкрите питання») |
| `bootstrapRuntime(rt)` | Послідовно виконує `setup()` усіх `EngineModule` під час старту застосунку. 🔴 Без споживачів |
| `csrfMiddleware` (`simplycms/runtime/csrf`) | Request-міддлвара CSRF для `requestMiddleware` у `start.ts`: перевіряє origin мутуючих запитів (server functions і server routes), виняток — `CSRF_EXEMPT_PREFIXES` (`/api/auth/`). Client-safe |
| Типи | `DefineRuntimeInput`, `SimplyCmsRuntime`, `EngineModule`, `SimplyCmsConfig` (без `seo`: назва й описи — профіль магазину в БД, URL сайту — серверний env `VITE_SITE_URL`, Е6б-11), `PluginRegistration`, `ThemeLoader` |

## Як магазин ФАКТИЧНО збирає `EngineContext`

Складання відбувається не через `defineRuntime`, а напряму в
`src/engine-provider.tsx` магазину — файл повертає `EngineContext`
(`{ links, config }`) без проміжної обгортки `SimplyCmsRuntime`:

```ts
// src/engine-provider.tsx магазину — ізоморфна збірка EngineContext
import type { EngineContext } from 'simplycms/contracts';
import { appLinks, appConfig } from './engine.shared';

export function buildClientEngine(): EngineContext {
  return { links: appLinks, config: appConfig };
}
```

`src/engine.shared.ts` несе самі адаптери (`appLinks`, `appConfig`) — саме їх
0.4.1 звузив до двох чистих провайдерів після знесення шару репозиторіїв
(`catalog`/`orders`/`identity`/`media`): вітрина читає БД серверними
лоадерами `simplycms/storefront` через `simplycms/db` (`withActor`), а не з
браузера.

## 🔴 Відкрите питання: `defineRuntime`/`bootstrapRuntime` без споживачів

`defineRuntime`, `bootstrapRuntime`, `EngineModule` і `SimplyCmsRuntime`
лишились у пакеті, але жоден магазин (кореневий host, шаблон скаффолдера,
пілот) їх не імпортує — і сигнатура розійшлася з тим, що реально споживає
`EngineProvider` (`value: EngineContext`, не `SimplyCmsRuntime`). Рішення
знести цей шар чи, навпаки, зробити його єдиним каноном складання —
за власником; трек — борг роадмапу 0.4.1-10.

## Ліцензія

MIT
