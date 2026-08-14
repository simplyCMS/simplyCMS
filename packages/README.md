# SimplyCMS Core

Open-source headless commerce engine — core packages for TanStack Start (Vite) + Supabase.

## Packages

| Package | Tier | Description |
|---------|------|-------------|
| `@simplycms/objects` | T0 | Domain object contracts + ports (repositories, providers, `EngineContext`). Type-only, 0 runtime deps. |
| `@simplycms/domain` | T1 | Pure commerce logic — `./pricing`, `./discounts`, `./inventory`, `./shipping`. No IO. |
| `@simplycms/data-supabase` | T2 | Supabase implementations of the ports (DI: injected client + `ScopeResolver`) |
| `@simplycms/react-query` | T2 | TanStack Query hooks wired through `EngineProvider`/`useEngine`. |
| `@simplycms/core` | — | Legacy facade; re-exports domain logic for backward compatibility (being decomposed). |
| `@simplycms/admin` | T5 | Admin panel layouts, pages, components |
| `@simplycms/ui` | T3 | shadcn/ui component library |
| `@simplycms/plugins` | T4 | Plugin system (HookRegistry, PluginLoader, PluginSlot) |
| `@simplycms/plugin-sdk` | T2 | Plugin SDK: `definePlugin`, `validatePluginModule`, `usePluginT`, `usePluginTable` — єдина поверхня, дозволена плагіну (межа довіри, спека §7) |
| `@simplycms/themes` | T4 | Theme system v2 (ThemeRegistry, ThemeContext, `applyTokens`, `validateThemeModule`) — теки `theme-system/` |
| `@simplycms/i18n` | T2 | Request-scoped translator (`createTranslator`, `I18nProvider`, `useT`) + каталоги uk/en |
| `@simplycms/runtime` | T2 | `defineRuntime` (складання `EngineContext`) + host-`defineConfig` |
| `@simplycms/supabase` | T2 | Клієнти browser/server/anon, `SupabaseProvider`, `resolveSupabaseKeys`, типи БД |
| `@simplycms/storefront` | T2 | SSR-лоадери + SEO-генератори (Supabase-клієнт інʼєктується) |
| `@simplycms/storefront-routes` | T5 | Канонічні SSR-сторінки + route-файли storefront/protected/auth/api |
| `@simplycms/admin-routes` | T5 | Route-файли адмінки (тонкі обгортки `@simplycms/admin`) |
| `@simplycms/schema` | T1 | Drizzle-baseline схеми ядра + RLS у TS (`db:pull`/`db:diff`/`db:migrate`) |
| `@simplycms/cart-ui` | T4 | Кошик: `CartButton`, `CartDrawer`, `CartItem`, `CartItemView` |
| `@simplycms/catalog-ui` | T4 | Каталог: `ProductCard`, `FilterSidebar`, `ProductGallery`, `ModificationSelector`, `StockDisplay` |
| `@simplycms/checkout-ui` | T4 | Оформлення: форми контактів, доставки, оплати, отримувача + підсумок |
| `@simplycms/profile-ui` | T4 | Профіль: адреси, отримувачі, аватар |
| `@simplycms/reviews-ui` | T4 | Відгуки: `ProductReviews`, `StarRating` |
| `@simplycms/cli` | — | CLI магазину (bin `simplycms`): `doctor`/`add`/`update`/`db:diff`. `host/` — канон host-файлів; виконується в магазині, поза тірами |
| `create-simplycms-store` | — | CLI-скаффолдер магазину (unscoped). Вбудований шаблон — джерело правди каркаса |

> See `docs/superpowers/specs/2026-07-30-platform-architecture-design.md` for the platform architecture (packages, routes, plugins, themes, migrations).

## Usage

Ці пакети живуть у монорепо SimplyCMS — окремих форків/копій у магазинах немає.
Магазини споживають ядро як звичайні npm-залежності: публікація на npmjs
працює з 2026-08-03; версія синхронна — усі 23 пакети (22 `@simplycms/*` +
unscoped скаффолдер) завжди мають одну версію, актуальний номер — у
[`CHANGELOG.md`](../CHANGELOG.md). Розширення відбувається через плагіни й
теми, а не форк ядра.

Найшвидший шлях завести магазин — `pnpm create simplycms-store`: скаффолдер
приводить усе ядро разом і в узгоджених версіях.

## Development

Розробка ведеться напряму в цьому монорепо: зміни в `packages/`
коммітяться разом з рештою проекту, окремого push у зовнішній core-репозиторій
не потрібно.

## Чеклист нового пакета

Зібрано під час додавання `@simplycms/cli` (2026-08-13) — 23-го пакета і
першого нового після сплощення `packages/*`. Конвеєр підхоплює новий пакет
майже весь автоматично, але критерії «публікованості» у різних інструментів
РІЗНІ, і розбіжність дає мовчазні дірки:

1. **`version`** — точно поточна синхронна (звір по сусідах);
   `scripts/release/bump.mjs` бере все, що не `private: true`, і падає, якщо
   версії розійшлися.
2. 🔴 **`"private": false` — буквально, не відсутність поля.**
   `scripts/pack-inspect.mjs` (tarball-parity suite) фільтрує за
   `private === false` **І** префіксом імені `@simplycms/` — пакет без явного
   `"private": false` мовчки ВИПАДАЄ з packaging-гейта (тест не червоніє,
   просто не перевіряє). `bump.mjs` при цьому пакет бачить — тобто він
   релізиться, але не веріфікується.
3. **`publishConfig`** — `access: "public"` (scoped-пакети npm за
   замовчуванням приватні), `registry: https://registry.npmjs.org`,
   `exports` (обовʼязково — parity-тест вимагає його наявності) і
   `main`/`types`, якщо є в топ-рівні.
4. **`files`, `license: MIT`, `README.md`** — конвенція; тестами стережуться
   лише цілі з `exports` («кожна ціль існує в tarball-і»), license і README —
   ні, не забудь руками.
5. **Збірка** — tsup за одним із трьох профілів (node — `schema`; react —
   `ui`; route-пакет — `storefront-routes`, 🔴 з `target: 'esnext'`, інакше
   esbuild лоуерить `import.meta` у `{}`) — АБО без збірки взагалі: сирці в
   tarball, без скрипту `build` (`admin-routes`, `cli`,
   `create-simplycms-store`). `pnpm build:packages` фільтрує за іменем
   `@simplycms/*` і пакети без `build` пропускає мовчки.
6. **Аліаси tsconfig/vite/vitest** — лише якщо пакет імпортують КОДОМ.
   Bin-інструменти й пакети, що монтуються шляхом, живуть без аліасів через
   workspace-симлінки (`schema`, `admin-routes`, `cli`).
7. **Гейти підхоплюють самі:** tsconfig `include`-глоб і `eslint .` бачать
   новий пакет автоматично; vitest бере `packages/<pkg>/src/**/__tests__/`
   без конфігурації. НЕ автоматично: error-зони `no-restricted-syntax`
   (i18n для UI-пакетів, env для серверних модулів) — явні списки файлів у
   `eslint.config.mjs`, допиши свій пакет, якщо він підпадає.
8. **`audit-deps`/`audit-exports`** (у `pnpm test`) — сканують `src/` і
   `routes/` пакетів `@simplycms/*` (включно з `.mjs`): кожен bare-імпорт
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
