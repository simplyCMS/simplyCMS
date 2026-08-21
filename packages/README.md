# SimplyCMS Core

Open-source headless commerce engine — core packages for TanStack Start (Vite) + Supabase.

## Пакети (топологія К0, 2026-08-20)

Публікованих пакетів **пʼять**. Ядро — один unscoped фреймворк-пакет
`simplycms`; тіри T0→T5 всередині нього — це **теки**, а не окремі npm-пакети.

| Пакет | Тека | Роль |
|-------|------|------|
| `simplycms` | `simplycms/` | Фреймворк: увесь T0–T5 (`src/*`), роут-теки (`routes/*`), core-міграції (`migrations/`), агентні скіли (`skills/`) |
| `@simplycms/cli` | `cli/` | CLI магазину (bin `simplycms`): `doctor`/`add`/`create`/`update`/`db:diff`/`theme:conformance`. `host/` — канон host-файлів; виконується в магазині, поза тірами |
| `@simplycms/theme-solarstore` | `simplycms-theme-solarstore/` | Референс-тема повного контуру: manifest + tokens + components + messages (Фаза 4) |
| `@simplycms/plugin-faq` | `simplycms-plugin-faq/` | Референс-плагін повного контуру: `plg_faq_items`, `/admin/faq`, слот, Zod-settings, i18n |
| `create-simplycms-store` | `create-simplycms-store/` | CLI-скаффолдер магазину (unscoped). Вбудований шаблон — джерело правди каркаса |

### Тіри всередині `simplycms`

Тір — напрямок дозволених імпортів: тека шару N може імпортувати лише теки
шарів **нижче** себе. До К0 цю дисципліну тримала межа npm-пакета
(`dependencies` + `audit-deps`); після злиття її тримають **eslint-тір-зони**
(`eslint.tier-zones.mjs` + `eslint.tier-relative.mjs`, негативний контроль —
`tests/tier-boundary.test.ts`). Кожна заборона виражена двома формами
специфікатора — bare-субшляхом `simplycms/<тека>` і відносним `../<тека>`.

| Тека `src/` | Субшлях | Tier | Опис |
|-------------|---------|------|------|
| `contracts/` | `simplycms/contracts` | T0 | Контракти доменних обʼєктів + порти (репозиторії, провайдери, `EngineContext`) + view-model-и вітрини (`./views`, контракт тем v3). 0 runtime-залежностей; тонкий рантайм-шар у `./views` (константи реквізитів) і `./views/fixtures` (фікстури conformance). `react` — опційний type-only peer саме через типи слотів `./views` (у барель не потрапляє) |
| `domain/` | `simplycms/domain` | T1 | Чиста комерційна логіка — `./pricing`, `./discounts`, `./inventory`, `./shipping`. Без IO |
| `schema/` | `simplycms/schema` | T1 | Drizzle-baseline схеми ядра + RLS у TS. Тулінг (`drizzle/`, `drizzle.config.ts`, `seed-migrations/`, `scripts/dump-rls.mjs`) — на рівні пакета, не в `src/` |
| `supabase/` | `simplycms/supabase` | T2 | Клієнти browser/server/anon, `SupabaseProvider`, `resolveSupabaseKeys`, baseline-типи БД (`database.ts`) |
| `data-supabase/` | `simplycms/data-supabase` | T2 | Реалізації портів на Supabase (DI: інʼєктований клієнт + `ScopeResolver`) |
| `react-query/` | `simplycms/react-query` | T2 | Хуки TanStack Query через `EngineProvider`/`useEngine` |
| `runtime/` | `simplycms/runtime` | T2 | `defineRuntime` (складання `EngineContext`) + host-`defineConfig` |
| `i18n/` | `simplycms/i18n` | T2 | Request-scoped транслятор (`createTranslator`, `I18nProvider`, `useT`) + каталоги uk/en |
| `storefront/` | `simplycms/storefront` | T2 | SSR-лоадери + SEO-генератори (Supabase-клієнт інʼєктується) |
| `ui/` | `simplycms/ui` | T3 | Бібліотека примітивів shadcn/ui |
| `themes/` | `simplycms/themes` | T4 | Система тем v3 (`ThemeRegistry`, `bootstrapThemes`, `applyTokens`, `validateThemeModule` + `./conformance` — гейт заявлених темою `views`) |
| `plugins/` | `simplycms/plugins` | T4 | Система плагінів (`HookRegistry`, `PluginLoader`, `PluginSlot`) |
| `plugin-sdk/` | `simplycms/plugin-sdk` | T4 | SDK плагіна: `definePlugin`, `validatePluginModule`, `usePluginT`, `usePluginTable` — єдина поверхня, дозволена плагіну (межа довіри, спека §7). 🔴 T4, а не T2: імпортує `plugins` |
| `cart-ui/` | `simplycms/cart-ui` | T4 | Кошик: `CartButton`, `CartDrawer`, `CartItem`, `CartItemView` |
| `catalog-ui/` | `simplycms/catalog-ui` | T4 | Каталог: `ProductCard`, `FilterSidebar`, `ProductGallery`, `ModificationSelector`, `StockDisplay` |
| `checkout-ui/` | `simplycms/checkout-ui` | T4 | Оформлення: форми контактів, доставки, оплати, отримувача + підсумок |
| `profile-ui/` | `simplycms/profile-ui` | T4 | Профіль: адреси, отримувачі, аватар |
| `reviews-ui/` | `simplycms/reviews-ui` | T4 | Відгуки: `ProductReviews`, `StarRating` |
| `core/` | `simplycms/core` | T5 | Власні провайдери/хуки/компоненти (`CMSProvider`, `useAuth`, `useCart`, `useBanners`…). 🔴 Фасадну роль розчинено К0 — реекспорти чужого прибрано, споживачів переведено на джерела; повне розселення власних модулів по тірах свідомо ПОЗА К0 |
| `admin/` | `simplycms/admin` | T5 | Лейаути, сторінки й компоненти адмінки |
| `storefront-routes/` | `simplycms/storefront-routes` | T5 | Канонічні сторінки: `pages/` (container-и) і `views/` (канонічні view + `views/slots/` — прибінджені реквізити, контракт тем v3), `shells/`, `server/`, `seo/` |

Дві теки роутів лежать НЕ в `src/` — вони монтуються `physical()`-ом як
файли, а не імпортуються як модулі:

| Тека пакета | Вхід exports | Tier | Опис |
|---|---|---|---|
| `routes/storefront/` | `simplycms/storefront-routes/routes/*` | T5 | Роут-файли вітрини/protected/auth/api |
| `routes/admin/` | `simplycms/admin-routes/routes/*` | T5 | Роут-файли адмінки (тонкі обгортки `src/admin`) |

🔴 Ключі exports цих двох входів навмисно лишились СТАРИМИ (`./storefront-routes/routes/*`,
`./admin-routes/routes/*`) при новій фізичній теці — правило переносу 1:1
зберігає чинні публічні входи, а фізична розкладка — деталь реалізації.

🔴 **Дві розбіжності цієї таблиці з `eslint.tier-zones.mjs` зафіксовані фактом,
а не виправлені кодом:** `plugin-sdk` стоїть T4 (він імпортує `plugins`), а
пʼять `*-ui` (T4) тягнуть `core` (T5) — зустрічний цикл, борг розселення
`core` по тірах.

## Usage

Ці пакети живуть у монорепо SimplyCMS — окремих форків/копій у магазинах немає.
Магазини споживають ядро як звичайні npm-залежності: публікація на npmjs
працює з 2026-08-03; версія синхронна — усі 5 пакетів завжди мають одну
версію, актуальний номер — у [`CHANGELOG.md`](../CHANGELOG.md). Розширення
відбувається через плагіни й теми, а не форк ядра.

Магазин після К0 тримає **одну** залежність ядра — `simplycms` (+ CLI у
devDependencies), а конкретний шар імпортує субшляхом:

```ts
import { definePlugin } from 'simplycms/plugin-sdk';
import { Button } from 'simplycms/ui/button';
import type { HomeViewModel } from 'simplycms/contracts/views';
```

Найшвидший шлях завести магазин — `pnpm create simplycms-store`: скаффолдер
приводить усе ядро разом і в узгоджених версіях.

## Development

Розробка ведеться напряму в цьому монорепо: зміни в `packages/`
коммітяться разом з рештою проекту, окремого push у зовнішній core-репозиторій
не потрібно.

## Чеклист нового пакета

Зібрано під час додавання `@simplycms/cli` (2026-08-13), оновлено під
топологію К0 (2026-08-20). 🔴 **Спершу спитай, чи потрібен новий ПАКЕТ.**
Після К0 дефолт — нова **тека** в `packages/simplycms/src/` плюс вхід
в `exports`-мапі й зона в `eslint.tier-zones.mjs`; окремий npm-пакет
виправданий лише коли одиниця має власний цикл релізу (тема, плагін,
bin-інструмент). Конвеєр підхоплює новий пакет майже весь автоматично, але
критерії «публікованості» у різних інструментів РІЗНІ, і розбіжність дає
мовчазні дірки:

1. **`version`** — точно поточна синхронна (звір по сусідах);
   `scripts/release/bump.mjs` бере все, що не `private: true`, і падає, якщо
   версії розійшлися.
2. 🔴 **`"private": false` — буквально, не відсутність поля.**
   `scripts/pack-inspect.mjs` (tarball-parity suite) фільтрує за
   `private === false` **І** іменем ядра (scope `@simplycms/` **або** точне
   unscoped `simplycms`) — пакет без явного `"private": false` мовчки ВИПАДАЄ
   з packaging-гейта (тест не червоніє, просто не перевіряє). `bump.mjs` при
   цьому пакет бачить — тобто він релізиться, але не веріфікується.
   🔴 Ім'я `simplycms` скрізь звіряється ТОЧНО, ніколи префіксом: префікс
   зачепив би сторонні `simplycms-theme-*`/`simplycms-plugin-*`.
3. **`publishConfig`** — `access: "public"` (scoped-пакети npm за
   замовчуванням приватні), `registry: https://registry.npmjs.org`,
   `exports` (обовʼязково — parity-тест вимагає його наявності) і
   `main`/`types`, якщо є в топ-рівні.
4. **`files`, `license: MIT`, `README.md`** — конвенція; тестами стережуться
   лише цілі з `exports` («кожна ціль існує в tarball-і»), license і README —
   ні, не забудь руками.
5. **Збірка** — tsup. У флагмані `tsup.config.ts` — це **масив профілів**
   (розкладка entry по чанках), а `entry` кожного профілю — МАПА
   `<шлях у dist> → файл`: за списковою формою esbuild бере outbase =
   спільний предок і мовчки затирає корінь пакета. `dist/` мусить лишатися
   дзеркалом `publishConfig.exports`.
   🔴 **`target: 'esnext'` живе у спільному `base`, а не в профілях.** Без
   нього esbuild лоуерить `import.meta` у `var import_meta = {}`, і
   опублікований `dist` читає `({}).env` — браузерний Supabase-клієнт падає
   на гідрації (спіймано К0: при злитті 21 конфігу опція вціліла лише в
   одному профілі). Гард — `tests/dist-import-meta.test.ts` у
   packaging-suite. Профіль задає розкладку, а не політику синтаксису.
   Альтернатива — без збірки взагалі: сирці в tarball, без скрипту `build`
   (`cli`, `create-simplycms-store`). `pnpm build:packages` фільтрує за
   іменем (`@simplycms/*` + `simplycms`) і пакети без `build` пропускає
   мовчки.
6. **Аліаси tsconfig/vite/vitest** — лише якщо пакет імпортують КОДОМ.
   Нова тека всередині флагмана аліаса НЕ потребує взагалі: її покриває
   чинна пара `simplycms` / `simplycms/*`. Bin-інструменти й теки, що
   монтуються шляхом (роут-теки, `cli`), живуть без аліасів через
   workspace-симлінки.
7. **Гейти підхоплюють самі:** tsconfig `include`-глоб і `eslint .` бачать
   новий пакет автоматично; vitest бере `packages/<pkg>/src/**/__tests__/`
   без конфігурації. НЕ автоматично — явні списки в `eslint.config.mjs` та
   сусідніх файлах, допиши свою теку, якщо вона підпадає:
   error-зони `no-restricted-syntax` (i18n для UI-тек, env для серверних
   модулів), **тір-зона в `eslint.tier-zones.mjs`** (нова тека ядра без
   зони не має жодної межі шарів) і `SCANNED_ROOTS` i18n-скану.
8. **`audit-deps`/`audit-exports`** (у `pnpm test`) — сканують `src/` і
   `routes/` пакетів ядра (`@simplycms/*` + `simplycms`, включно з `.mjs`):
   кожен bare-імпорт
   мусить бути в `dependencies`/`peerDependencies`, кожен вжитий у репо
   subpath — в `exports` і `publishConfig.exports`.
9. 🔴 **Публікація автоматична і НЕЗВОРОТНА за фактом мержу:**
   `pnpm publish -r` у CI публікує будь-який не-`private` пакет, якого ще
   немає в реєстрі, незалежно від бампа версії. Введення пакета в
   `packages/*` = релізне рішення в момент мержу в `main`
   ([`release-process.md`](../docs/architecture/release-process.md)).
10. **Перед PR:** повний конвеєр гейтів у канонічному порядку + `pnpm
    pilot:pack`; якщо пакет їде в шаблон магазину — звір parity-тести і
    `writeManifest` пілота (підміна на `file:`-tarball-и має покрити і
    devDependencies).

## License

MIT
