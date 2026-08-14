# SimplyCMS

Open-source e-commerce CMS built with TanStack Start, Supabase, and shadcn/ui.

**Ядро опубліковане на npmjs:** [`@simplycms/*@0.3.0`](https://www.npmjs.com/search?q=%40simplycms) — 22 пакети
(включно з CLI [`@simplycms/cli`](https://www.npmjs.com/package/@simplycms/cli)),
плюс скаффолдер [`create-simplycms-store`](https://www.npmjs.com/package/create-simplycms-store) тієї ж версії.

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
| Ядро в npm-пакетах | ✅ `0.3.0`, 22 пакети |
| Магазин збирається з npm без монорепо | ✅ перевірено автоматичним пілотом (`pnpm pilot:pack`) |
| Production-запуск | ✅ `pnpm build && pnpm start` |
| `create-simplycms-store` | ✅ у npm-реєстрі — `pnpm create simplycms-store` |
| CLI `simplycms` (`@simplycms/cli`) | ✅ v1: `doctor` / `add` / `update` / `db:diff` |
| Плагіни й теми як окремі npm-пакети | ⏳ Фаза 3 (Plugin SDK) |

Обидві половини обіцянки закриті: магазин створюється скаффолдером, а
обслуговується CLI — діагностика, встановлення плагінів/тем, оновлення ядра з
доганянням host-файлів і донесенням core-міграцій. Наступний рубіж — Фаза 3:
Plugin SDK і перші плагіни/теми як справжні npm-пакети.

## Створити магазин на SimplyCMS

Магазин — окремий проєкт, який ставить ядро з npm. Форкати цей репозиторій не треба.

```bash
pnpm create simplycms-store my-store
cd my-store && pnpm install && pnpm build && pnpm start
```

Скаффолдер розгортає повний каркас магазину (~74 файли: host-обвʼязка, міграції
Supabase, дефолтна тема, референс-плагін) із версіями `@simplycms/*`, що
відповідають його власній. Магазин налаштований **лише під pnpm 11+**:
`pnpm-workspace.yaml` везе `allowBuilds`, без якого install обривається.

🔴 У перші 24 години після виходу нової версії ядра install упреться в
`minimumReleaseAge` (дефолт pnpm 11 — 1 доба). Обхід описаний у README
згенерованого магазину.

📁 **Джерело правди каркаса — [`packages/create-simplycms-store/template/`](packages/create-simplycms-store/template/).**
Той самий шаблон розгортає пілот пакування, тож він гарантовано робочий на
поточній версії ядра. `tests/pilot/store-template/` — не окрема копія каркаса, а
тонкий оверлей із двох файлів (`vite.config.ts` + `package.json`), який
`scaffold.mjs` накладає поверх `template/` пакета.

Що ви отримуєте одразу: SSR-вітрину з каталогом, кошиком і checkout, адмінку,
профілі користувачів, `sitemap.xml`/`robots.txt`, і теми.

### Обслуговування магазину — `simplycms` CLI

Свіжий магазин уже має [`@simplycms/cli`](packages/cli/) у `devDependencies`
(в існуючий — `pnpm add -D @simplycms/cli`):

```bash
pnpm simplycms doctor            # діагностика: версії, env, host-файли, міграції, конфіг↔БД
pnpm simplycms add <pkg> --plugin|--theme   # встановити плагін/тему (pnpm add + запис у конфіг)
pnpm simplycms update --write    # оновити всі @simplycms/* + догнати host-файли
pnpm simplycms db:diff --write   # донести нові core-міграції (далі: git diff → supabase db push)
```

Повна інструкція (команди, exit-коди, наскрізні сценарії, канон host-файлів) —
[`docs/architecture/cli.md`](docs/architecture/cli.md).

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
pnpm pilot:pack   # gates A/C/D + CLI/TOOL — роути з node_modules, bundle-guard, Tailwind, смоуки обох CLI-пакетів. Без БД, Gate E — видимо SKIP
pnpm pilot        # + gate B: живий HTTP проти вашої бази (.env.local); Gate E — досі SKIP (потрібен --e2e)
pnpm pilot:e2e    # gates A/C/D/CLI/TOOL/B/E на локальному стеку Supabase із сідом (потребує Docker)
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
src/                      # Host — тонка збірка магазину, 13 файлів
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
  cli/                    #   simplycms CLI: doctor/add/update/db:diff (docs/architecture/cli.md)
themes/ plugins/          # Референсні тема й плагін
supabase/                 # Міграції, seed, згенеровані типи, edge functions
scripts/                  # Тулчейн: міграції, аудити пакування, пілот, реліз
```

Повний довідник розробника — [`CLAUDE.md`](CLAUDE.md).

## License

MIT
