# SimplyCMS Platform — специфікація архітектури

> **Статус:** затверджено власником 2026-07-30 (напрям A з поправками).
> **Аналітична база:** [`docs/architecture/platform-delivery-options.md`](../../architecture/platform-delivery-options.md)
> (дослідження 9 платформ + 2 адверсарні верифікації з експериментами + критик повноти).
> **Це джерело правди** для розвитку SimplyCMS як платформи. Документи, що суперечать
> цій специфікації, — застарілі.

---

## 1. Мета

SimplyCMS — **e-commerce платформа**, подібна за моделлю до OpenCart, для стека
TanStack Start (Vite, React 19, SSR) + Supabase:

- **ядро** розвивається окремо і поставляється версіонованими npm-пакетами;
- **магазин** — тонка збірка (~6-8 файлів + конфіг), а не форк репозиторію;
- **оновлення ядра** (`pnpm update`) приносить існуючим магазинам нові сторінки,
  фікси та SEO-покращення без ручного переносу;
- **плагіни й теми** встановлює розробник через код + rebuild (npm-пакети;
  runtime-завантаження zip — свідомо відкинуто);
- активація та налаштування встановленого — з адмінки, без перезбірки.

Skeleton-update — задача, яку індустрія не закрила (Medusa: сторфронт-форк з гайдом
«Don't use git merge»; після v2.14 — взагалі без каналу оновлень). Її розвʼязання —
диференціатор SimplyCMS.

## 2. Зафіксовані рішення власника

| # | Рішення |
|---|---|
| D1 | Модель поставки розширень: **розробник, через код + rebuild** (npm). Без runtime-zip |
| D2 | **Адмінка: перевизначення сторінок не існує** (модель OpenCart/WP). Плагіни лише **додають** сторінки |
| D3 | **Канонічні сторінки storefront — невідʼємна частина ядра**, SEO/AI-оптимізовані, не перевизначаються. Магазин вільно додає власні сторінки |
| D4 | **Тема не володіє сторінками**: контракт = manifest + tokens + brand-компоненти + settings |
| D5 | Робочих сайтів немає → **breaking-реструктуризація без перехідних шимів дозволена** |
| D6 | **Міграції БД:** схема ядра і плагінів — Drizzle TS (включно з RLS) → зведена diff-міграція → людське ревʼю → Supabase CLI |
| D7 | **Supabase-шар:** консолідація в один пакет за зразком `metahub/packages/supabase`, звірено з офіційним quickstart Supabase для TanStack Start |
| D8 | **Склад коду — один: npmjs.** CLI — інструмент поверх pnpm, маркетплейс — індекс-вітрина, SDK — бібліотека |
| D9 | MetaHub-adoption скасовано; SimplyCMS — самостійна платформа |

## 3. Топологія платформи

```
┌─ npmjs (єдиний склад коду) ──────────────────────────────────────────────┐
│  @simplycms/* (ядро, реліз-потяг)     @vendor/simplycms-plugin-*      │
│  @simplycms/plugin-sdk                @vendor/simplycms-theme-*       │
└──────────────────────────────────────────────────────────────────────────┘
        ▲ pnpm add (виконує CLI)                 ▲ npm publish (автор)
┌─ Магазин (репо розробника) ─────────┐   ┌─ Маркетплейс (вітрина) ────────┐
│ simplycms.config.ts  ← джерело      │   │ JSON-індекс + сайт: метадані,  │
│ routes.ts            істини          │   │ сумісність, скріншоти.         │
│ src/routes/{__root,лейаути,my/}     │   │ Коду НЕ зберігає — вказує      │
│ supabase/migrations/ (зведені)      │   │ на npmjs-пакети                │
│ themes/, plugins/    (локальні)     │   └────────────────────────────────┘
└─────────────────────────────────────┘
        ▲ simplycms CLI: add / update / db:diff / doctor (обгортка pnpm)
```

Ролі: **npmjs** — склад; **`simplycms` CLI** — встановлення/оновлення (те, чого pnpm
не вміє: конфіг, міграції, типи, сумісність, schematics для host-файлів);
**маркетплейс** — каталог; **SDK** — типи й хелпери для авторів.

## 4. Цільова пакетна архітектура

Реструктуризація поточних 17 пакетів (D5 дозволяє без шимів):

| Пакет | Зміст | Походження |
|---|---|---|
| `@simplycms/objects` | Контракти + порти (0 deps) | як є |
| `@simplycms/domain` | Pure-логіка: pricing/discounts/inventory/shipping | як є |
| `@simplycms/schema` | **Drizzle-схема ядра + RLS** (`pgPolicy`, `drizzle-orm/supabase`) | новий; замінює сирі seed-міграції |
| `@simplycms/supabase` | Клієнти (browser/server/server-admin), auth-хелпери, hooks, testing, типи | консолідація `core/supabase/*` + `data-supabase` за зразком `@kit/supabase` |
| `@simplycms/engine` | EngineProvider, репозиторії, query-хуки | `data-supabase` + `react-query` |
| `@simplycms/ui` | shadcn-примітиви (self-contained) | як є |
| `@simplycms/theme-system` | ThemeRegistry (новий контракт §6), токени | перебудова |
| `@simplycms/plugin-system` | HookRegistry, PluginSlot, loader | як є + wiring |
| `@simplycms/plugin-sdk` | `definePlugin`, порти, Zod-хелпери настройок | новий |
| `@simplycms/storefront-routes` | **Канонічні SSR-сторінки** (route-файли + server fns + SEO) | `src/routes/_storefront|_protected|auth|api` + `src/server` + сторінки з core/themes |
| `@simplycms/admin-routes` | Route-файли адмінки | `src/routes/admin` (тонкі обгортки `@simplycms/admin`) |
| `@simplycms/admin` | Сторінки/компоненти адмінки | як є |
| `@simplycms/cli` | `simplycms` CLI | новий |
| `create-simplycms-store` | Скаффолдер магазину | новий |
| feature-ui (`catalog-ui` та ін.) | Вливаються у storefront-routes/admin або лишаються внутрішніми | рішення на імплементації |

`core` (legacy) розчиняється по цільових пакетах; re-export-шими зносяться (D5).

**Версіонування:** реліз-потяг — усі UI-звʼязані пакети виходять однією
платформенною версією; `objects`/`domain` — незалежний semver. **Строгий semver:
breaking — тільки major** (свідомий контраст із Medusa). Плагіни/теми декларують
`engines.simplycms` (діапазон) — CLI і bootstrap перевіряють (модель Vendure).

### 4.1. Репозиторії, організація, неймінг (доповнення 2026-07-31)

- **Один монорепо платформи.** Окремий репозиторій `simplyCMS-core` і
  git-subtree-синхронізація (`cms:pull`/`cms:push`) **виводяться з експлуатації**:
  subtree існував, бо репозиторій-застосунок був водночас шаблоном магазину.
  У цільовій моделі магазини не форкають наш репозиторій — отже дві копії ядра
  не потрібні. Монорепо = `packages/*` (ядро, публікується на npmjs) +
  `apps/dev-store` (референс/тестовий магазин для розробки платформи; сьогоднішній
  `src/`). `simplyCMS-core` архівується.
- **GitHub-організація `simplyCMS` + npm-scope `@simplycms`.** Перевірено
  2026-07-31: npm-пакет `simplycms` вільний, у scope `@simplycms` немає жодного
  опублікованого пакета, GitHub-імʼя `simplycms` не зайняте. Для платформи
  продуктовий неймінг (як vendure-ecommerce, medusajs, payloadcms) кращий за
  корпоративний `simplySOFTua`. Rename scope `@simplycms` → `@simplycms` —
  механічний codemod (робився один раз у зворотний бік; червнева причина
  переіменування — вимога GitHub Packages «scope = власник» — зникла з переходом
  на npmjs). Виконати у Фазі 0, поки зовнішніх споживачів нуль.
  *Дії власника: створити org на GitHub і org `simplycms` на npmjs;
  зарезервувати пакетне імʼя `simplycms` (майбутній CLI).*
- **Структура репозиторіїв org:** `simplycms/simplycms` (монорепо платформи),
  `simplycms/marketplace` (індекс + вітрина, Фаза 4); решта — за потребою.

## 5. Механізм роутів (несуча стіна)

**Механізм:** `virtualRouteConfig` (`routes.ts` магазину) + `physical(prefix, dir)`
монтує route-теки пакетів із node_modules. Верифіковано експериментально; в апстрімі
TanStack є регресійні фікстури на escape за межі routesDirectory.

```ts
// routes.ts магазину (генерується скаффолдером, редагується рідко)
import path from 'node:path'
import { rootRoute, layout, physical } from '@tanstack/virtual-file-routes'
const pkg = (n: string) => path.join('node_modules', n, 'routes') // symlink, НЕ require.resolve

export const routes = rootRoute('__root.tsx', [
  layout('_storefront.tsx', [physical('/', pkg('@simplycms/storefront-routes'))]),
  physical('/admin', pkg('@simplycms/admin-routes')),
  physical('/', 'my'),                                  // власні сторінки магазину
  // адмін-сторінки плагінів (генерує CLI з simplycms.config.ts):
  physical('/admin/x-plugin', pkg('@vendor/simplycms-plugin-x/admin-routes')),
])
```

**Контракт пакета з роутами:**
- фіксований **mount-prefix**; route id у файлах запечені під нього → генератор
  нічого не пише в node_modules, білд працює на read-only ФС;
- `peerDependencies` містить `@tanstack/react-start` → Start авто-додає пакет у
  `ssr.noExternal`/`optimizeDeps.exclude` (vitefu crawlFrameworkPkgs);
- `exports` map покриває `./routes/*` (dev=src, publish=dist) — **паритет
  контролюється тестом** (розширення `tests/published-exports-parity.test.ts`);
  це найкрихкіше місце за досвідом Medusa (issues #12687/#12585);
- server functions пакетів викликаються з route-файлів (обхід відкритого
  бага TanStack #7213 — server fn, досяжна лише з server-коду, випадає з
  prod-маніфесту).

**Правила URL-простору:**
- канонічні URL ядра — стабільне API (додавання = minor, зміна/видалення = major);
- перевизначення URL ядра **не існує** (D2/D3); власні сторінки — у своєму просторі;
- простори плагінів: `/admin/<plugin-slug>/…` (адмінка) — колізії неможливі
  за побудовою.

**Інваріанти CI магазину:** `install → build (генерація routeTree) → typecheck →
test`. `routeTree.gen.ts` регенерується після кожного install (шляхи імпортів
залежать від layout node_modules — непортабельний артефакт).

**Tailwind v4:** CLI генерує `@source`-директиви у `globals.css` магазину для тек
пакетів ядра/плагінів/тем (інакше стилі мовчки випадуть зі скану).

**План Б (задокументований):** якщо апстрім зламає `physical()`-escape — CLI
матеріалізує route-теки пакетів у `src/routes/` магазину schematics-ами; решта
архітектури не змінюється. Пін версій роутера + власний регрес-тест механізму
в CI ядра.

## 6. Контракт теми

```ts
interface ThemeModule {
  manifest: { name: string; version: string; engines: { simplycms: string } }
  tokens: DesignTokens                 // CSS variables: кольори, типографіка, радіуси…
  components: ThemeComponents          // Header, Footer, HeroBanner?, …(брендові)
  settings?: ZodSchema                 // схема налаштувань (значення — themes.settings)
}
```

- Сторінки рендерить **ядро** (канонічні, D3/D4); тема дає вигляд: токени,
  брендові компоненти, налаштування. Нова сторінка ядра не ламає жодну тему.
- Варіативність усередині канонічних сторінок: theme-компоненти + `PluginSlot`
  + settings. Повна заміна сторінки — поза скоупом v1 (свідомо).
- Реєстрація тем — генерується з `simplycms.config.ts`; **активація з БД**
  (`themes.is_active`, перемикання з адмінки серед установлених) зберігається.
- Поставка: **npm-пакет** (semver, апстрім-фікси) або **copy-in** через реєстр
  (shadcn-модель; повне володіння, без фіксів) — вибір автора. Механіка збірки
  однакова (урок Shopware: «switchability» ≠ спосіб поставки).
- `themes/default` — еталон і джерело fallback-токенів; сторінки з нинішніх тем
  переїжджають у `storefront-routes` як канонічні.

## 7. Контракт плагіна

```ts
// @simplycms/plugin-sdk
export default definePlugin({
  name: 'x-plugin',
  version: '1.0.0',
  engines: { simplycms: '^1.0' },        // перевірка сумісності (CLI + bootstrap)
  settings: z.object({ apiKey: z.string() }),   // форму рендерить адмінка
  hooks: { 'product.detail.after': (ctx) => …}, // типізовані hook-поінти
  slots: { 'checkout.shipping.before': Component },
  adminRoutes: './admin-routes',          // тека сторінок адмінки (монтує CLI)
  schema: './schema',                     // Drizzle-фрагмент (таблиці plg_xplugin_*)
  catalogs: './i18n',                     // каталоги повідомлень
})
```

- **Межа довіри:** плагін НЕ отримує `SupabaseClient` — тільки порти з SDK
  (репозиторії, events, storage-фасад). Примус: dependency-lint у CI (заборона
  імпортів повз SDK) + вузька перелічувана поверхня (урок WP/Magento: ніякого
  «перехоплюй будь-що»).
- **Життєвий цикл:** встановлення — build-time (`simplycms add`: pnpm add + запис у
  config + міграції на ревʼю + rebuild); активація/налаштування — runtime з адмінки
  (`plugins.is_active`, `plugins.config` за Zod-схемою), без перезбірки.
- Таблиці плагіна — префікс `plg_<name>_*`; звʼязки з ядром — через link-таблиці,
  без FK у чужі таблиці (модель Medusa Module Links). RLS-політики плагіна —
  лише на власні таблиці.
- **Авторський цикл:** `simplycms create plugin` (скаффолд) → `simplycms plugin:dev`
  (workspace-лінк dev-loop) → build → `npm publish` → подача в індекс маркетплейсу.

## 8. Конфігурація: одне джерело істини

`simplycms.config.ts` декларує **що встановлено/зареєстровано**: тема(и), плагіни,
адаптери, SEO-базу. БД зберігає **лише runtime-стан**: `themes.is_active`,
`plugins.is_active`, `plugins.config`, `system_settings`.

Розсинхрон (у БД активна тема/плагін, якого немає в білді): fallback на `default`
/ пропуск плагіна + гучний запис у журнал + індикатор в адмінці. Ніяких падінь.

`src/theme-registry.ts` і монтажні рядки плагінів у `routes.ts` — генеруються CLI
з конфігу (рукописний дрейф виключається).

## 9. Дані: Drizzle-схема, міграції, типи

- Схема ядра: `@simplycms/schema` — Drizzle TS, включно з RLS
  (`pgPolicy`, `pgTable.withRLS`, `authenticatedRole`/`authUsers` з
  `drizzle-orm/supabase`). Схема плагіна — Drizzle-фрагмент у пакеті плагіна.
- **Конвеєр:** `simplycms db:diff` → складає core + встановлені плагіни →
  `drizzle-kit generate` → одна SQL-міграція у `supabase/migrations/` →
  **людське ревʼю (git diff)** → `db:migrate` (Supabase CLI) → `db:generate-types`.
- Наявні 32 міграції — baseline: initial snapshot через introspect; далі — тільки
  конвеєр. Саморобний `supabase/scripts/migrate.mjs` виводиться з експлуатації.
- Політика: **forward-fix-only** (down() у продакшні не обіцяємо); видалення
  плагіна залишає його таблиці до явної команди `simplycms plugin:purge`
  (генерує окрему міграцію на ревʼю).
- `supabase/types.ts` регенерується як крок CLI після кожної міграції
  (плагінні таблиці потрапляють у типи магазину штатно).
- Edge Functions / storage buckets плагінів — v1: лише декларація в маніфесті
  + інструкція; автоматизація — пізніша фаза.

## 10. Supabase-шар

`@simplycms/supabase` (за зразком `@kit/supabase` з metahub, звірено з офіційним
quickstart Supabase для TanStack Start):

- `./browser-client` — `createBrowserClient` (`import.meta.env.VITE_*`);
- `./server-client` — `createServerClient` на `getCookies`/`setCookie`/
  `setResponseHeader` з `@tanstack/react-start/server` (без proxy/middleware-шару);
- `./server-admin-client` — service role (тільки server-only шляхи);
- `./hooks/*`, `./auth`, `./require-user`, `./testing`, `./database` (типи + parity-тест);
- нейминг ключів — за актуальною докою (`VITE_SUPABASE_PUBLISHABLE_KEY`); оновити
  `.env.example`.

## 11. SEO та AI-придатність канонічних сторінок (вимоги D3)

Канонічні сторінки ядра зобовʼязані мати з коробки: повний `head` (title/description/
canonical/og), JSON-LD (Product+Offer, BreadcrumbList, Organization), коректні
404/301, серверний HTML зі списками товарів (без клієнтського enrichment-розриву),
`sitemap.xml`/`robots.txt` **у production** (custom server entry), `llms.txt` +
чиста семантична розмітка для AI-агентів. Faceted-навігація — за правилами з
[`docs/tasks/seo-ssr-faceted-navigation.md`](../../tasks/seo-ssr-faceted-navigation.md).
Це — вимоги якості ядра, оновлення яких їде всім магазинам (головна перевага D3).

## 12. i18n

Ядро, що постачає сторінки, постачає й текст → рядки канонічних сторінок і адмінки —
**каталоги повідомлень** у ядрі (базова `uk` + `en`); теми/плагіни можуть додавати
власні каталоги; ланцюжок fallback. Хардкод-рядки в компонентах — заборонені лінтом.
Вибір бібліотеки — на імплементації (вимоги: SSR-safe, tree-shakeable, TS-типізація
ключів). Закладається у Фазі 0 (дешево зараз — дорого потім).

## 13. Ліцензія та governance

- Додати **LICENSE (MIT)** у корінь негайно; `license: MIT` — у кожен пакет.
- До першої сторонньої публікації: зафіксувати позицію щодо ліцензії екосистеми
  (що успадковують похідні теми), правила неймінгу (`simplycms-plugin-*`,
  `simplycms-theme-*`), мінімальні вимоги індексу маркетплейсу.
- Прецедент усвідомлено: Vendure зробив MIT→GPLv3 на мажорі як бізнес-важіль —
  наше рішення має бути свідомим, не дефолтним.

## 14. Поза скоупом v1 (свідомо)

- Multi-store / SaaS-хостинг (порти/ScopeResolver двері не зачиняють).
- Runtime-встановлення розширень (zip/URL) — D1.
- Перевизначення канонічних сторінок/URL ядра — D2/D3.
- Out-of-process apps (webhooks/iframe, модель Saleor) — можливий пізніший tier
  для зовнішніх інтеграцій.
- Автоматичний rollback міграцій.

## 15. Ризики та пілотні перевірки (gates)

| Ризик | Gate |
|---|---|
| `physical()` поза routesDirectory — недодокументована поведінка | Регрес-тест механізму в CI ядра + пін версій роутера; план Б §5 |
| Server fns у справжньому npm-пакеті (#7213) | Фаза 1: `npm pack` → чистий магазин → e2e; правило «server fn викликається з route-файла» |
| Витік server-коду в клієнт (#6361/#5738) | CI bundle-guard: перевірка клієнтського бандла на server-only модулі |
| Exports-map ламається після публікації (головний DX-провал Medusa) | Parity-тест на всі пакети + CI-джоба збірки магазину зі справжніх tarball-ів |
| Tailwind не бачить класи пакетів | `@source` генерує CLI; візуальний smoke-тест у пілоті |
| Розсинхрон конфіг↔БД | Визначена деградація §8 + `simplycms doctor` |

## 16. Фази реалізації

**Фаза 0 — Фундамент у монорепо** (без публікації; все на workspace-теках):
переїзд `src/routes` на `routes.ts` + `physical()` до нових пакетів
`storefront-routes`/`admin-routes`; канонікалізація сторінок (сторінки з core/themes →
storefront-routes; теми → tokens+components); wiring плагін-контуру від
`simplycms.config.ts`; консолідація `@simplycms/supabase`; Drizzle-baseline +
конвеєр `db:diff`; LICENSE; i18n-скелет; гігієна з беклогу (guest-token з URL,
перевірка SSR-повноти списків).
*DoD: магазин працює на новій топології в монорепо; typecheck/lint/test/build зелені;
жодного імпорту повз нові межі.*

**Фаза 1 — Пілот пакування + production-готовність:** `npm pack` пілот у чистий
проєкт (усі gates §15); server preset + працюючий `pnpm start`; production
sitemap/robots (custom server entry). *DoD: магазин зібраний зі справжніх tarball-ів
проходить smoke-e2e; деплой можливий.*

**Фаза 2 — CLI + скаффолдер + перший реліз:** `@simplycms/cli`
(add/update/db:diff/doctor + schematics для host-файлів), `create-simplycms-store`,
реліз-потяг v1.0 на npmjs. *DoD: сторонній розробник створює магазин двома командами
і оновлює ядро одним `pnpm update`.*

**Фаза 3 — Plugin SDK + референс-плагіни:** `plugin-sdk`, dependency-lint межі
довіри, adminRoutes плагінів, 1-2 референс-плагіни (напр., спосіб доставки і
платіжний). *DoD: плагін ставиться `simplycms add`, вмикається з адмінки, везе
свої таблиці й сторінки.*

**Фаза 4 — Теми як пакети + маркетплейс-індекс:** пакування тем (npm + copy-in),
conformance-kit для авторів, JSON-індекс + вітрина. *DoD: стороння тема
встановлюється і перемикається з адмінки.*

Паралельний продуктовий трек (незалежно від фаз): SEO/faceted navigation
([`seo-ssr-faceted-navigation.md`](../../tasks/seo-ssr-faceted-navigation.md)) —
підсилює цінність канонічних сторінок.

## 17. Наскрізні сценарії (перевірка несуперечності)

1. **Новий магазин:** `pnpm create simplycms-store my-shop` → конфіг Supabase →
   `pnpm dev` → повний магазин (канонічні сторінки, default-тема, порожня адмінка).
2. **Оновлення ядра:** `pnpm update "@simplycms/*"` → нові сторінки/фікси в
   білді; якщо реліз позначено host-змінами — `simplycms update` доганяє ~6 файлів.
3. **Плагін:** маркетплейс → `simplycms add @vendor/simplycms-plugin-np` →
   diff міграцій на ревʼю → rebuild → активація і налаштування в адмінці.
4. **Тема:** `simplycms add @vendor/simplycms-theme-aurora` (npm) або
   `simplycms add --copy @vendor/...` (copy-in) → rebuild → перемикання в адмінці.
5. **Своя сторінка:** файл у `src/routes/my/landing.tsx` → у роутах і sitemap.
6. **Автор плагіна:** `simplycms create plugin` → dev-loop лінком → publish →
   індекс маркетплейсу.
