# SimplyCMS

Open-source e-commerce CMS built with TanStack Start, Supabase, and shadcn/ui.

**Ядро опубліковане на npmjs:** [`@simplycms/*@0.1.0`](https://www.npmjs.com/search?q=%40simplycms) — 21 пакет.

## Vision: e-commerce platform

SimplyCMS розвивається в OpenCart-подібну платформу нового покоління:

- **Ядро** постачає готовий магазин (SSR-вітрина + адмінка) версіонованими npm-пакетами — магазин це **тонка збірка** (~8 файлів + конфіг), а не форк репозиторію.
- **`pnpm update` приносить нові сторінки й фікси** існуючим магазинам без ручного переносу коду.
- **Плагіни й теми** — встановлювані npm-пакети (`simplycms add …` + rebuild); активація й налаштування — з адмінки, без перезбірки.
- **Канонічні сторінки** (каталог, товар, checkout…) — SEO/AI-оптимізовані з коробки й однакові для всіх магазинів; кастомізація — через теми (токени + брендові компоненти), слоти плагінів і власні сторінки.

Детально: [Як це працює](docs/how-it-works.md) · [Специфікація архітектури](docs/superpowers/specs/2026-07-30-platform-architecture-design.md) · [Роадмап](docs/tasks/platform-roadmap.md)

## Статус

| | Стан |
|---|---|
| Ядро в npm-пакетах | ✅ `0.1.0`, 21 пакет |
| Магазин збирається з npm без монорепо | ✅ перевірено автоматичним пілотом (`pnpm pilot:pack`) |
| Production-запуск | ✅ `pnpm build && pnpm start` |
| `create-simplycms-store` | ✅ код готовий (`pnpm pilot:pack` гейт CLI), у npm-реєстрі ще немає |
| CLI `simplycms add` (`@simplycms/cli`) | ⏳ Фаза 2 — ще немає |
| Плагіни й теми як окремі npm-пакети | ⏳ Фаза 3 |

Обіцянка «магазин двома командами» ще не виконана — CLI в роботі. Зараз магазин
збирається вручну (нижче), і це робочий шлях, а не тимчасовий обхід: саме його
щоразу проходить пілот пакування.

## Створити магазин на SimplyCMS

Магазин — окремий проєкт, який ставить ядро з npm. Форкати цей репозиторій не треба.

```bash
mkdir my-store && cd my-store && npm init -y

# Ядро: роути, сторінки, адмінка, UI
npm install @simplycms/storefront-routes @simplycms/admin-routes \
            @simplycms/admin @simplycms/ui @simplycms/themes @simplycms/plugins \
            @simplycms/supabase @simplycms/runtime @simplycms/i18n @simplycms/core \
            @simplycms/storefront @simplycms/react-query @simplycms/data-supabase \
            @simplycms/objects @simplycms/domain \
            @simplycms/cart-ui @simplycms/catalog-ui @simplycms/checkout-ui \
            @simplycms/profile-ui @simplycms/reviews-ui
```

Далі потрібні **8 файлів збірки**: `vite.config.ts` (з `tanstackStart` і
`virtualRouteConfig`), `routes.ts`, `simplycms.config.ts`, `tsconfig.json`,
`tailwind.config.ts`, `src/engine.shared.ts`, `src/routes/my/` і `.env`.

📁 **Готовий приклад усіх восьми — [`packages/create-simplycms-store/template/`](packages/create-simplycms-store/template/).**
Це вбудований шаблон CLI-скаффолдера `create-simplycms-store` — джерело правди
магазину, гарантовано робоче на поточній версії ядра (пілот пакування збирає
саме його). `tests/pilot/store-template/` — це вже НЕ окрема копія каркаса, а
тонкий оверлей із двох файлів (`vite.config.ts` + `package.json`), який
`scaffold.mjs` накладає поверх `template/` пакета для пілота.

Що ви отримуєте одразу: SSR-вітрину з каталогом, кошиком і checkout, адмінку,
профілі користувачів, `sitemap.xml`/`robots.txt`, і теми.

### Потрібна Supabase

Ядро працює поверх Supabase (Postgres + Auth + Storage). Схема ядра — 40 таблиць
із RLS; міграції лежать у [`supabase/migrations/`](supabase/migrations/).

## Розробка самого ядра

Це для тих, хто розвиває SimplyCMS, а не будує на ньому магазин.

```bash
pnpm install
cp .env.example .env.local     # заповнити ключі Supabase
pnpm dev                       # dev-сервер (Vite, порт 5173+)
pnpm build && pnpm start       # production-запуск (порт 3000)
```

### Перевірки

```bash
pnpm install --frozen-lockfile   # ловить розсинхрон lockfile — має бути ПЕРШИМ
pnpm format:check
pnpm lint
pnpm build                       # генерує src/routeTree.gen.ts — перед typecheck
pnpm typecheck
pnpm test
pnpm build:packages && pnpm test:packaging
```

🔴 **Порядок не випадковий.** `build` іде перед `typecheck`, бо генерує роутрі.
`install --frozen-lockfile` перший, бо це єдиний крок, що звіряє `pnpm-lock.yaml`
з манифестами.

### Пілот пакування

Зелені тести в монорепо **не означають**, що опублікований пакет працює: аліаси
Vite резолвлять те, чого немає в `exports`, а tree-shaking вирізає з сирців те,
що в зібраному чанку лишається живим. Тому є пілот — він збирає магазин зі
справжніх tarball-ів, без workspace-аліасів:

```bash
pnpm pilot:pack   # gates A/C/D/CLI — роути з node_modules, bundle-guard, Tailwind, create-пакет. Без БД, Gate E — видимо SKIP
pnpm pilot        # + gate B: живий HTTP проти вашої бази (.env.local); Gate E — досі SKIP (потрібен --e2e)
pnpm pilot:e2e    # gates A/C/D/CLI/B/E на локальному стеку Supabase із сідом (потребує Docker)
```

Ганяйте його після змін в `exports`, `peerDependencies`, `tsup`-конфігах, барелях
або `routes/`.

### Реліз

```bash
pnpm release 0.2.0     # гарди + бамп версії всіх пакетів + гейти + коміт
```

Далі PR у `main`; мерж публікує на npmjs. Повний опис — [`docs/architecture/release-process.md`](docs/architecture/release-process.md).

## Структура репозиторію

```
src/                      # Host — тонка збірка магазину, 10 файлів
  routes/__root.tsx       #   root route; routes/my/ — власні сторінки магазину
  server.ts · start.ts    #   server entry (SEO-інтерсептор) · middleware (admin guard)
  engine*.ts              #   DI-контекст ядра
packages/       # Ядро CMS — публікується на npmjs
  objects/                #   контракти + порти (0 deps)
  domain/                 #   чиста логіка: pricing, discounts, inventory, shipping
  schema/                 #   Drizzle-схема ядра + RLS у TS
  supabase/               #   клієнти + baseline типів БД
  storefront-routes/      #   роути вітрини + канонічні сторінки + SEO
  admin-routes/ admin/    #   роути адмінки + її сторінки
  themes/ plugins/        #   ThemeRegistry · HookRegistry, PluginSlot
  ui/ *-ui/               #   shadcn-примітиви + feature-UI
themes/ plugins/          # Референсні тема й плагін
supabase/                 # Міграції, seed, згенеровані типи, edge functions
scripts/                  # Тулчейн: міграції, аудити пакування, пілот, реліз
```

Повний довідник розробника — [`CLAUDE.md`](CLAUDE.md).

## License

MIT
