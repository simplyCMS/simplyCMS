---
applyTo: '**/*'
description: 'Базові архітектурні правила SimplyCMS'
---

# Architecture Core Rules

## Основна архітектура

SimplyCMS — open-source e-commerce CMS на TanStack Start з SSR-first підходом для публічних сторінок. Проект складається з:

- **`routes.ts`** — `virtualRouteConfig`: дерево роутів збирається `physical()`-монтуванням route-тек пакетів; сканування `src/routes` цілком **вимкнено**
- **`src/`** — host: тонка збірка магазину (`routes/__root.tsx` + `routes/my/`, engine-glue, `theme-registry.ts`, `start.ts`)
- **`packages/`** — Публіковані пакети: unscoped фреймворк `simplycms` (усе ядро — роути, канонічні сторінки, лоадери, SEO, схема БД) плюс три сателіти й скаффолдер
- **`themes/`** — Локальні теми проекту (контракт v3: `manifest + tokens + components + views?`;
  теми також ставляться npm-пакетами — `docs/architecture/themes.md`)
- **`plugins/`** — Локальні плагіни проекту
- **`scripts/`** — `db-diff.mjs` / `db-migrate.mjs` (конвеєр міграцій Drizzle → Supabase CLI)

### Ядро — теки всередині пакета `simplycms` (tier-архітектура)

Публікованих пакетів **пʼять**: unscoped фреймворк `simplycms` (усе ядро),
`@simplycms/cli`, `@simplycms/theme-solarstore`, `@simplycms/plugin-faq`,
`create-simplycms-store`. Тіри T0→T5 — це **теки** флагмана, а не окремі
npm-пакети; шар імпортується субшляхом `simplycms/<тека>`.

| Тека `packages/simplycms/` | Специфікатор | Tier | Призначення |
|-------|-------|------|-------------|
| `src/contracts/` | `simplycms/contracts` | T0 | Доменні контракти + порти (0 runtime deps); `./views` і `./views/fixtures` — view-model-и вітрини (контракт тем v3) |
| `src/domain/` | `simplycms/domain` | T1 | Pure-логіка: pricing, discounts, inventory, shipping |
| `src/schema/` | `simplycms/schema` | T1 | Drizzle-схема ядра + RLS у TS; snapshot і schema-тулінг — на рівні ПАКЕТА (`drizzle/`, `drizzle.config.ts`), не в `src/` |
| `src/supabase/` | `simplycms/supabase` | T2 | Клієнти browser/server/anon, `SupabaseProvider`, `resolveSupabaseKeys`, baseline-типи БД |
| `src/data-supabase/` | `simplycms/data-supabase` | T2 | Репозиторії на інжектованому Supabase-клієнті |
| `src/react-query/` | `simplycms/react-query` | T2 | `EngineProvider`/`useEngine` + data-хуки |
| `src/i18n/` | `simplycms/i18n` | T2 | `createTranslator`/`normalizeLocale`, `I18nProvider`/`useT`, каталоги uk/en |
| `src/runtime/` | `simplycms/runtime` | T2 | `defineRuntime` (складання EngineContext) + host-`defineConfig` |
| `src/storefront/` | `simplycms/storefront` | T2 | SSR-loaders + SEO (sitemap/robots), Supabase-клієнт інʼєктується |
| `src/ui/` | `simplycms/ui` | T3 | Дизайн-система (50+ shadcn/ui компонентів, self-contained) |
| `src/themes/` | `simplycms/themes` | T4 | ThemeRegistry, ThemeContext, `applyTokens`, `validateThemeModule`, `getActiveThemeSSR`, `./conformance` |
| `src/plugins/` | `simplycms/plugins` | T4 | HookRegistry, PluginSlot, `bootstrapPlugins`, `validatePluginModule` |
| `src/plugin-sdk/` | `simplycms/plugin-sdk` | T4 | `definePlugin` + порти плагінів (`usePluginTable`, `usePluginConfig`, `usePluginT`) — єдина поверхня, дозволена плагіну; `docs/architecture/plugins.md` |
| `src/*-ui/` | `simplycms/{cart,catalog,checkout,profile,reviews}-ui` | T4 | Feature-UI воронки покупки |
| `src/core/` | `simplycms/core` | T5 | Власні провайдери/хуки/компоненти (`CMSProvider`, `useAuth`, `useCart`…). Фасадну роль розчинено К0; розселення по тірах — окремий борг |
| `src/admin/` | `simplycms/admin` | T5 | Адмін-панель (layouts, pages, components) |
| `src/storefront-routes/` | `simplycms/storefront-routes` | T5 | Канонічні `pages/` (container-и) + `views/` + `shells/` + `server/` + `seo/` |
| `routes/storefront/` | `simplycms/storefront-routes/routes/*` | T5 | Роут-файли вітрини/protected/auth/api — монтуються `physical()`, не імпортуються |
| `routes/admin/` | `simplycms/admin-routes/routes/*` | T5 | Роут-файли адмінки (тонкі обгортки над `simplycms/admin`) |

Сателіти поза флагманом: `@simplycms/theme-solarstore` (референс-тема повного
контуру) і `@simplycms/plugin-faq` (референс-плагін: `plg_`-таблиця,
adminRoutes, settings, i18n) — T5 за роллю; `@simplycms/cli` — bin-інструмент
магазину, поза тірами.

Залежності — тільки вниз по tier-ах. 🔴 Після К0 цю межу тримає не
`dependencies` пакета, а **eslint-тір-зони** (`eslint.tier-zones.mjs` +
`eslint.tier-relative.mjs` — обидві форми специфікатора, bare-субшлях і
відносний `../<тека>`; негативний контроль — `tests/tier-boundary.test.ts`).
Цільова архітектура платформи: `docs/superpowers/specs/2026-07-30-platform-architecture-design.md`
(розбіжності факту з цільовою таблицею — амендмент §4.0 у тій же спеці).

🔴 **Ключі `exports` двох роут-тек лишились СТАРИМИ** (`./storefront-routes/routes/*`,
`./admin-routes/routes/*`) при новій фізичній теці `routes/{storefront,admin}` —
перенос 1:1 зберіг чинні публічні входи. Так само навмисні префікси тек
сателітів (`simplycms-plugin-faq/`, `simplycms-theme-solarstore/`): eslint-зона
межі довіри матчить `packages/simplycms-plugin-*/**`, не зачіпаючи
`src/plugins` і `src/plugin-sdk`.

### Rendering-стратегії

Route-файли живуть у пакетах; `routes.ts` монтує їхні теки на одному рівні
(префікс `''`), тож id роутів такі самі, як при звичайному файловому скані.

| Route group | Де лежить | Стратегія | Опис |
|-------------|-----------|-----------|------|
| `_storefront/` | `simplycms/routes/storefront/` | SSR | Публічні сторінки, SEO; loader надає `themeName` |
| `_protected/` | `simplycms/routes/storefront/` | SSR guard + client | `beforeLoad` перевіряє auth, редіректить на `/auth` |
| `auth/` | `simplycms/routes/storefront/` | Client-only + server route | Форми авторизації; `callback` — server handler (OAuth) |
| `api/` | `simplycms/routes/storefront/` | Server routes | `server.handlers` (health, guest-order) |
| `admin/` | `simplycms/routes/admin/` | Client-only (`ssr: false`) | `ssr:false` стоїть **лише** на `admin.tsx`; дочірні роути його не повторюють |
| `my/` | `src/routes/my/` | за потребою магазину | Єдина тека роутів host-а |

## ✅ ALWAYS
- SSR для storefront-сторінок (каталог, товари, головна) — SEO критично.
- Client-side (`ssr: false`) для адмін-панелі; **завжди** додавай `pendingComponent` для `ssr:false`-роутів.
- Route-файли — тонкі обгортки: `createFileRoute` + component з пакетів; без бізнес-логіки.
- Нова сторінка магазину — у `src/routes/my/`; сторінка ядра — у route-теці відповідного пакета. Файл поруч із `__root.tsx` роутом **не стане** (гард — `tests/virtual-routes-escape.test.ts`).
- Дані на сервері — через `createServerFn` (server-шар `simplycms/storefront-routes/server/*` або `src/server/engine.ts`) чи route `loader`.
- Списки товарів мають бути повними в SSR-HTML: DTO `ProductListItem` + `SsrProductGrid`, збагачення — на сервері, не в `useEffect`.
- Нові UI-рядки — через `simplycms/i18n` (`useT` / `createTranslator`), не хардкодом.
- Cookie-based auth через `@supabase/ssr` (не localStorage JWT).
- Request-level guard для `/admin` — у `src/start.ts` (middleware).
- Supabase-клієнт — через DI: `SupabaseProvider`/`useSupabaseClient` або репозиторії-порти; не глобальний singleton.
- Використовуй субшляхи пакета `simplycms` замість локальних копій (`simplycms/ui`, `simplycms/core`, `simplycms/admin`).
- **Використовуй MCP сервери** для перевірки актуальних API:
  - **context7:** TanStack Start/Router, React, TanStack Query, Zod docs
  - **shadcn:** UI компоненти перед додаванням
  - **supabase:** DB міграції, TypeScript types
- Система тем (контракт v3): `ThemeModule = { manifest, tokens, components, settings?, views? }`. Дані, SEO й лоадери публічних сторінок лишаються ядром (`simplycms/storefront-routes/pages/`); тема дає `components` (Header/Footer/…) і `tokens`, які розкладає `applyTokens`, а опційно — `views` для пʼятьох сторінок вітрини (`Home`, `Catalog`, `CatalogSection`, `ProductDetail`, `Cart`): лише розмітка поверх готових `vm.slots`, під гейтом `pnpm simplycms theme:conformance <slug>`.
- Система плагінів: контракт — `definePlugin` з `simplycms/plugin-sdk` (слоти, Zod-settings, власні таблиці `plg_*`, каталог i18n `plugin.<name>.*`); розширення через `HookRegistry`; `PluginSlot` реактивний (`hookRegistry.subscribe` + `useSyncExternalStore`) — віджет зʼявляється без reload. 🔴 Плагін НЕ імпортує Supabase-шар — лише порти SDK (dependency-lint); механізм цілком — `docs/architecture/plugins.md`.
- Конфігурація CMS через `simplycms.config.ts` (`defineConfig`: теми, плагіни, `siteUrl`, SEO) — одне джерело істини для `theme-registry.ts` і `bootstrapPlugins`.
- Зміни схеми БД: `db:pull` → правка `packages/simplycms/src/schema/schema.ts` → `db:diff <name>` → ревʼю SQL → `db:migrate`. Supabase MCP — **лише** для інспекції.

## ❌ NEVER
- Не розміщуй бізнес-логіку в темах (теми — лише візуальна складова).
- Не повертай у теми сторінки/лейаути (`theme.pages`, `MainLayout`, `CatalogLayout`, `ProfileLayout` видалені свідомо, рішення D3/D4).
- Не редагуй `src/routeTree.gen.ts` — автогенерований.
- Не повертай re-export-шими в `simplycms/core` — фасадну роль розчинено К0 (рішення D5): тека тримає лише ВЛАСНІ модулі, чуже імпортується з джерела.
- Не глуши i18n-ворнінги `no-restricted-syntax` і не послаблюй селектори — ~960 warn це очікуваний стан до i18n-міграції.
- Не застосовуй міграції через Supabase MCP (`apply_migration`) і не пиши SQL повз `db:diff`.
- Не хардкодь Supabase URL/ключі — використовуй змінні оточення (`VITE_*`).
- Не імпортуй глобальний supabase-клієнт — тільки DI (`useSupabaseClient`/порти).
- **НЕ додавай shadcn/ui компоненти без перевірки через MCP** (search → examples → audit).
- **НЕ припускай library APIs — перевіряй через MCP context7**.
- Не виноси auth-guard логіку за межі `src/start.ts` та `auth/`-роутів.
- Не створюй файли > 150 рядків без розбиття.

## 📚 Коли потрібні деталі
- Огляд проекту та структура: `CLAUDE.md`
- Архітектура платформи (пакети, роути, плагіни, теми, міграції): `docs/superpowers/specs/2026-07-30-platform-architecture-design.md`
- Аналітична база рішень: `docs/architecture/platform-delivery-options.md`
- Система тем (контракт v3, реєстрація, токени, views): `CLAUDE.md` розділ «Theme System (контракт v3)», механізм — `docs/architecture/themes.md`
- Стан і борги Фази 0: `docs/tasks/platform-roadmap.md`
- SEO/faceted navigation: `docs/tasks/seo-ssr-faceted-navigation.md`

## 🔄 Робочий цикл
1. Перевір, чи існує інструкція в `.github/instructions` для твоєї сфери.
2. Використовуй MCP для перевірки актуальних API та best practices.
3. Для нових фіч звіряйся з `docs/architecture/` та відкритими задачами в `docs/tasks/`.
4. Лише після цього додавай або змінюй код.
