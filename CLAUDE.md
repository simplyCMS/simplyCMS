# CLAUDE.md — SimplyCMS

Цей файл — загальні правила проєкту. Поточний стан, прогрес, етапи й черга виконання живуть
в `docs/tasks/platform-roadmap.md` і `docs/tasks/v2-state-map.md` — **не дублювати їх тут**.
Карту чинного стану (що працює наживо, що ні, як підняти локально з нуля) читати ПЕРШОЮ, якщо береш
роботу в цій частині.

## Quick Reference

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (Vite + TanStack Start)
pnpm build            # Production build (vite build)
pnpm start            # Run production server (node server.mjs, PORT=3000) — див. «Production Run»
pnpm typecheck        # TypeScript type check
pnpm dev:www          # Лендінг simplycms.dev (apps/www) — dev на :3100
pnpm build:www        # Лендінг: статичний білд (prerender) → apps/www/dist/client
pnpm typecheck:www    # Лендінг: tsc (після build:www — потребує routeTree.gen.ts)
pnpm lint             # ESLint
pnpm lint:fix         # ESLint (auto-fix)
pnpm format           # Prettier (write)
pnpm format:check     # Prettier (check only)
pnpm test             # Run tests (vitest run; packaging-suite виключено)
pnpm test:watch       # Tests in watch mode
pnpm build:packages   # Збірка публікованих пакетів. 🔴 Ходить через scripts/build-packages.mjs
                      # із кепом купи 3 ГБ: JS видає tsdown (Rolldown), ДЕКЛАРАЦІЇ — tsc
                      # (tsconfig.dts.json), бо dts-плагін бандлера тримає повну ts.Program.
                      # Ядро — ДВІ збірки, клієнтська й серверна, entry виводяться з exports;
                      # межу задає simplycms/contracts/server-only, стережуть
                      # tests/dist-server-boundary.test.ts і tests/dts-toolchain.test.ts
pnpm test:packaging   # Tarball-parity suite (vitest.packaging.config.ts)
pnpm test:schema      # СХЕМНИЙ контур: накат канону міграцій на чистий Postgres + парність
                      # політик і грантів + ПОВЕДІНКОВА матриця RLS.
                      # 🔴 Docker НЕ потрібен: або готовий кластер через PG_HARNESS_URL,
                      # або ефемерний initdb/pg_ctl (не від root). У CI — job `schema`
                      # із service-контейнером postgres:17. Межі — test-contours.md §10
pnpm pilot:pack       # tarball-пілот: гейти A/C/D/IP + CLI/TOOL — БЕЗ БД (Gate B відсутній)
pnpm pilot            # той самий пілот + Gate B проти живої БД: DATABASE_URL і
                      # BETTER_AUTH_SECRET із .env.local; назви товарів Gate B бере прямим SQL
                      # (HTTP-API до БД у контракті v2 немає)
pnpm pilot:seed       # перегенерувати supabase/seed.sql із фікстур пілота (сід годує лише
                      # локальний стек supabase start; під парність-тестом)
pnpm template:sync    # синк закомічених копій з монорепо, ТРИ цілі: template/ скаффолдера,
                      # packages/cli/host/ (канон host-файлів для simplycms update),
                      # packages/simplycms/migrations/ (для simplycms db:diff) — усі під парність-тестом
pnpm release X.Y.Z    # РЕЛІЗ: гарди + бамп версії всіх 5 пакетів + гейти + коміт
                      # → git push → PR у main → мерж публікує на npmjs
                      # Повний опис — docs/architecture/release-process.md
pnpm version:packages 0.2.0   # «сирий» бамп версій БЕЗ гейтів і коміту (нетипові випадки)
pnpm db:demo          # підняти ЧИСТУ базу магазину з нуля (канон міграцій + покупний
                      # демо-каталог: доставка, СИСТЕМНА точка видачі, залишки,
                      # decrease_on_order = true). 🔴 Підключення бере з PG_HARNESS_URL або
                      # --url, а НЕ з DATABASE_URL: створює нову БД у кластері, тож потрібен
                      # адмін-доступ до кластера, а не до бази магазину; готовий DATABASE_URL
                      # скрипт ДРУКУЄ в кінці. Покроковий запуск — docs/tasks/v2-state-map.md
pnpm live:smoke       # живий прогін: db:demo → build → server → curl+SQL (gate-b) + Playwright
                      # (воронка, сховище, кроки адмінки в сесії власника). Потребує Postgres
                      # (PG_HARNESS_URL) і Chromium; не CI — гейти релізу окремим рішенням
pnpm db:pull / db:diff
                      # Схема БД — див. «Database Commands»
```

Команд `pnpm test:e2e` і `pnpm pilot:e2e` немає: прапорець `--e2e` падає з поясненням, а не
мовчки ігнорується. Генератора типів БД (`db:generate-types`, `types:baseline`) теж немає.

## What This Project Is

SimplyCMS — open-source e-commerce CMS на **TanStack Start (Vite)** і чистому **PostgreSQL**.
Повна вітрина (SSR), адмінка (client-side SPA), профілі, кошик, чекаут, замовлення. Ядро живе в
цьому монорепо й публікується на npmjs.

- **Дані вітрини** — Drizzle поверх чистого Postgres (`simplycms/db`, `withActor`); **auth** —
  Better Auth (`simplycms/auth`). Браузер не звертається до БД: усе через серверні функції.
- **Адмінка** — client-side SPA на серверному шарі `simplycms/admin-server` + колекціях
  `simplycms/admin-data`. `supabase-js` лишається лише як застарілий шар адмінки, що
  переписується на `admin-server`; вітрина його не імпортує.
- **Клієнтів і реальних магазинів немає** — зміни роблять БЕЗ зворотної сумісності.
- **Напрям платформи:** OpenCart-подібна платформа — ядро постачає каркас (роути/сторінки)
  npm-пакетами, магазин — тонка збірка, плагіни й теми — встановлювані одиниці. Джерело правди:
  [`docs/superpowers/specs/2026-07-30-platform-architecture-design.md`](docs/superpowers/specs/2026-07-30-platform-architecture-design.md);
  трекінг — [`docs/tasks/platform-roadmap.md`](docs/tasks/platform-roadmap.md).
- **Пакети:** у реєстрі npm рівно **5** — unscoped фреймворк `simplycms` (усе ядро T0–T5 теками
  `packages/simplycms/src/*`) + сателіти `@simplycms/{cli,theme-solarstore,plugin-faq}` +
  `create-simplycms-store`. Специфікатори ядра — субшляхи `simplycms/<тека>`; дисципліну шарів
  тримають eslint-тір-зони; агентні скіли доставляються магазинам симлінками на
  `node_modules/simplycms/skills/`.
- **Спеки напрямку:** бекенд-контракт v2 (сервер-first дані; Better Auth; storage-порт; чистий
  Postgres як контракт; ролі+гранти як код + RLS-ядро; Better Auth канонічними таблицями в
  `public`; чистий baseline міграцій) — [`2026-08-19-backend-contract-v2-design.md`](docs/superpowers/specs/2026-08-19-backend-contract-v2-design.md)
  (читати з амендментом B3′/B5″/B13); маркетплейс (модель поставки) —
  [`2026-08-18-marketplace-platform-design.md`](docs/superpowers/specs/2026-08-18-marketplace-platform-design.md);
  хмара (`simplycms/platform`, Dokploy, тенант = застосунок + Postgres) —
  [`2026-08-19-cloud-platform-design.md`](docs/superpowers/specs/2026-08-19-cloud-platform-design.md);
  консолідація пакетів — [`2026-08-20-package-consolidation-design.md`](docs/superpowers/specs/2026-08-20-package-consolidation-design.md).

## Mandatory Instructions

Детальні правила кодування, архітектури й доменні настанови — у `.github/instructions/`.
**Вони обовʼязкові.**

| File | Scope | Description |
|------|-------|-------------|
| [`architecture-core`](.github/instructions/architecture-core.instructions.md) | `**/*` | Core architecture, rendering strategies, themes, plugins, auth |
| [`coding-style`](.github/instructions/coding-style.instructions.md) | `**/*` | TypeScript strict mode, Ukrainian comments, file limits |
| [`data-access`](.github/instructions/data-access.instructions.md) | `app/**`, `packages/**` | Дані вітрини (`withActor` над Drizzle), кеш, Supabase-клієнти адмінки (до переписування) |
| [`ui-architecture`](.github/instructions/ui-architecture.instructions.md) | `app/**`, `themes/**`, `ui/**` | UI components, theme structure, shadcn/ui |
| [`editor`](.github/instructions/editor.instructions.md) | `core/**` | Tiptap editor integration |
| [`storage`](.github/instructions/storage.instructions.md) | `packages/simplycms/src/**`, `src/**` | Порт `simplycms/storage`, драйвер `local-fs`, медіа-референси |
| [`tooling`](.github/instructions/tooling.instructions.md) | `**/*` | Commands, formatting, testing |
| [`optimization`](.github/instructions/optimization.instructions.md) | `**/*.ts,tsx` | Performance, bundle, rendering optimization |

Also see:
- 🔴 [`docs/tasks/v2-state-map.md`](docs/tasks/v2-state-map.md) — карта чинного стану V2: що працює
  наживо, що ні і чому, як підняти локально з нуля, наступний крок
- [`docs/tasks/platform-roadmap.md`](docs/tasks/platform-roadmap.md) — роадмап, черга виконання, борги
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — Full project overview, MCP servers, agents
- [`AGENTS.md`](AGENTS.md) — Agent-specific instructions
- [`docs/architecture/test-contours.md`](docs/architecture/test-contours.md) — 🔴 межі тестування:
  чому зелений `pnpm test` нічого не каже про опублікований пакет, що доводить кожен гейт пілота
  (A/B/C/D/CLI/TOOL), які зони не покриті
- 🔴 [`docs/architecture/upstream-workarounds.md`](docs/architecture/upstream-workarounds.md) —
  ЄДИНИЙ реєстр обходів дефектів залежностей (TanStack DB, drizzle-zod, typescript-eslint, tsdown…):
  симптом, корінь, обхід, як перевірити виправлення на новій версії і що тоді прибрати. У коді —
  маркери `UPSTREAM:<ID>` (`git grep`). При БУДЬ-ЯКОМУ бампі залежності — перевірити її записи;
  новий обхід — новий запис, не лише коментар
- [`docs/architecture/cli.md`](docs/architecture/cli.md) — `simplycms` CLI (doctor/add/create (plugin|theme)/update/db:diff/theme:conformance): канон host-файлів і міграцій, контракт серверного env
- [`docs/architecture/plugins.md`](docs/architecture/plugins.md) — механізм плагінів: контракт `definePlugin`, рантайм, межа довіри, конвеєр міграцій `plg_*`, i18n, adminRoutes
- [`docs/architecture/themes.md`](docs/architecture/themes.md) — механізм тем: контракт `ThemeModule`, пакування npm vs copy-in, `bootstrapThemes`, conformance-kit
- [`docs/guides/themes.md`](docs/guides/themes.md) — практичний посібник по темах для розробника магазину й автора теми

## Agent Tooling

Процесний тулінг для агентної розробки. Джерело правди — `.agents/skills/`;
`.claude/skills/*` і `.github/prompts/*.prompt.md` — симлінки на нього, щоб
Claude Code й Copilot читали **одні й ті самі** файли.

🔴 **Виняток — скіли, які їдуть у магазини:** їхнє джерело правди — тека
`packages/simplycms/skills/<name>` пакета ядра, а `.agents/skills/<name>` і `.claude/skills/<name>`
монорепо — **прямі симлінки** на неї (обидва в пакет, не ланцюжком один через одного). Так само їх
отримує магазин: скаффолдер створює обидві пари лінків на `node_modules/simplycms/skills/<name>`
після `installDeps`, `simplycms update` доробляє відсутні й прибирає осиротілі, `doctor` №12
звітує розсинхрон. Копії скіла в шаблоні немає — оновлення ядра оновлює скіл автоматично.
Приклад — `redesign-from-reference`.

| Шар | Що це |
|-----|-------|
| `.agents/skills/codebase-research/` | Як шукати в репо: `orient` (карта символів, валідація якорів плану), протокол стейл-графа, формат звіту-дельти |
| `.agents/skills/code-review/` | Як рев'ювити: шкала `blocker/major/minor` × confidence з порогом 80, шість лінз, обов'язковий adversarial-крок |
| `packages/simplycms/skills/redesign-from-reference/` (лінки — `.agents/skills/` і `.claude/skills/`) | Як робити редизайн магазину за референс-сайтом, фази 0-6: правові межі, дискавері сторінок із обовʼязковим діалогом, детерміністична інспекція (`scripts/` усередині скіла) — кольори, типографіка й **motion** (`inspection.json` `schemaVersion: 3`), мапінг токенів, тема штатним лайфсайклом, спека-файли компонентів із секцією Motion, **обовʼязковий** side-by-side по кожному підтвердженому типу з класифікацією розбіжностей, опційне шліфування. Їде в магазини текою `skills/` пакета `simplycms` (симлінки, не копія); посібник — [`docs/guides/redesign-from-reference.md`](docs/guides/redesign-from-reference.md) |
| `.claude/agents/` | Субагенти `codebase-research`, `code-review` (одна лінза за виклик), `code-review-verifier` (скептик) |
| `.claude/commands/` | `/виконай-задачу` (головна), `/перевір-роботу-агента-кодування`, `/проведи-додаткове-дослідження`, `/поділи-задачу-на-етапи`, `/перевір-нову-версію-задачі`, `/проаналізуй-кларіфай-питання`, `/перевір-скіли`, `/редизайн-за-референсом` |

```bash
ORIENT=.agents/skills/codebase-research/scripts/orient
$ORIENT ThemeRegistry getActiveTheme   # де лежить + хто справді кличе (потребує codebase-memory-mcp)
$ORIENT --map "як локалізується тема"  # тема людською мовою → BM25 по канону доків
$ORIENT --plan docs/superpowers/plans/2026-07-31-phase0-foundation.md
$ORIENT --doctor                       # стан індексу cbm, .cbmignore, шару доків
```

**Код-шар — `codebase-memory-mcp`** (глобальна установка, у репо лише `.cbmignore`). Індекс
прив'язаний до АБСОЛЮТНОГО шляху: worktree/другий клон індексуються окремо. Без нього
`orient <Символ>` чесно відмовляє, а не грепає (греп через барелі бреше на «хто кличе»).
Канон — [`docs/development/CODEBASE_MEMORY.md`](docs/development/CODEBASE_MEMORY.md).

## Гейти (порядок і причини)

Порядок: `pnpm install --frozen-lockfile → format:check → lint → build → typecheck → test →
test:schema → build:packages → typecheck:template → test:packaging`.

- 🔴 `install --frozen-lockfile` — **перший** і не пропускається після будь-якої правки
  `package.json`: жоден інший гейт не звіряє `pnpm-lock.yaml` з манифестами, а звичайний
  `pnpm install` мовчки лагодить розсинхрон замість червоніти; у CI frozen — дефолт.
- Гейт саме `format:check`, бо `pnpm format` (`prettier --write`) не червоніє.
- `build` іде **перед** `typecheck`, бо генерує `src/routeTree.gen.ts`.
- `test:schema` у ланцюгу, бо він єдиний перевіряє накат канону міграцій і ПОВЕДІНКУ RLS —
  інші гейти схему БД не виконують.
- `test:packaging` іде **після** `pnpm test` і `build:packages`: `tests/published-exports-parity.test.ts`
  виведено з дефолтного прогону (`test.exclude`), він працює по зібраних tarball-ах.
- 🔴 `typecheck:template` — окремий гейт **після** `build:packages`: кореневий `tsconfig.json`
  ВИКЛЮЧАЄ `packages/create-simplycms-store/template` (його імпорти резолвляться з `node_modules`
  магазину), тож `pnpm typecheck` шаблону не бачить. Гейт типізує шаблон проти зібраного `dist`
  (те саме, що бачить магазин). Список файлів під ним стереже
  `tests/template-typecheck-coverage.test.ts`.
- Гейти РЕЛІЗУ (`scripts/release/gates.mjs`) після `test:packaging` ганяють ще `pilot:pack`: Gate C
  пілота — єдиний доказ межі клієнт/сервер у реальному клієнтському бандлі, Gate IP — що витік
  ВАЛИТЬ збірку магазину. `pilot:pack` ганяється і в CI (job `packaging`).
- `prettier` — exact `3.9.6` у `devDependencies`; обидві команди покривають **увесь репозиторій**.
  Не форматується (`.prettierignore`): згенерований код (`src/routeTree.gen.ts`, заморожений
  `supabase/database.ts` ядра, Drizzle-схема і `drizzle/`), артефакти збірки і **всі `*.md`**
  (prettier ламає ручне вирівнювання таблиць і списків).

## Лінт

🔴 **Норма: `pnpm lint` = 0 errors / 8 warnings.** Ворнінги — `react-hooks/*` і `no-unused-vars`.
Не «лагодити» число вгору чи вниз без причини.

Error-зони й кастомні правила (селектори й опції не послабляти; кожне має негативний контроль
тестом):

- **i18n-селектори** (`no-restricted-syntax`, error): новий кириличний рядок інтерфейсу валить лінт.
  Зона — host `src/`, обидві роут-теки ядра (`routes/storefront`, `routes/admin`),
  `src/storefront-routes`, `src/admin`, п'ять `src/*-ui` пакета ядра, компоненти тем. У
  `routes/admin` живий React-компонент `AdminPending` використовує `useT()` (ключ
  `admin.common.loading`).
- **`import.meta.env` у серверних модулях** (`no-restricted-syntax`, error): шість модулів
  env-контракту — `server-client`, `anon-client`, `seo/robots`, `seo/sitemap`, `api/health.tsx`,
  `src/start.ts`.
- **Тір-зони напрямку шарів:** `eslint.tier-zones.mjs` + `eslint.tier-relative.mjs` забороняють
  імпорт угору по тірах усередині пакета ядра, бо межу `dependencies` після злиття пакетів не тримає
  ніщо. Негативний контроль — `tests/tier-boundary.test.ts`.
- **Контракт ключів кешу React Query** — `eslint-rules/query-key-from-entity.mjs`: літеральний
  перший сегмент `queryKey` (прямий, через константу-масив і в умовному виборі) заборонений;
  сегмент 0 іде з реєстру `simplycms/contracts/entities` (`ENTITY`/`AGGREGATE`/`SESSION_KEY`).
  Зона — `core/`, `*-ui/`, `react-query/`, `storefront-routes/` пакета ядра; `src/admin/**` —
  виїмка, доки сторінки адмінки не переписані на `admin-server`. Деталі — `data-access`, розділ
  «Контракт ключів кешу».
- **Доступні імена контролів:** `jsx-a11y/label-has-associated-control` (error,
  `assert: 'htmlFor', depth: 3`) на п'яти теках воронки (`cart-ui`, `catalog-ui`, `checkout-ui`,
  `profile-ui`, `reviews-ui`). 🔴 Правило бачить лише `<label>` — контрол без лейбла йому
  невидимий: зелений лінт доступності воронки не доводить її повноти.
- **Порт сховища — `simplycms-storage/no-direct-storage`:** зона — увесь `packages/simplycms/src/**`
  з єдиною виїмкою-ратчетом `admin/pages/ReviewDetail.tsx`; забороняє `supabase.storage`,
  `x.storage.from(…)`, `x['storage']` та імпорт `@supabase/storage-js`. Файловий двійник —
  ратчет `tests/storage-direct-calls.test.ts`; негативний контроль —
  `tests/eslint-rules/no-direct-storage.test.ts`.
- **Межа клієнт/сервер — `simplycms-client-boundary/no-server-only-in-client`:** зона —
  `src/admin/**` і п'ять `src/*-ui/**`; забороняє СТАТИЧНИЙ `import`/`export…from` на server-only
  субшлях чи серверну залежність, стертий `import type` легальний. Негативні контролі —
  `tests/eslint-rules/no-server-only-in-client.test.ts` і
  `tests/tier-boundary-client-boundary.test.ts`.
- **Сегмент `'list'` лише колекціям адмінки —
  `simplycms-collection-key/no-collection-key-outside-admin-data`:** зона — увесь пакет ядра КРІМ
  `admin-data`, плюс референс-тема й референс-плагін; забороняє будь-яку форму
  `entityKey(x).list()`. Метод `list()` в `entityKey` відсутній за побудовою; ключ колекції дає
  окрема `collectionKey(entity)`. Причина: write-back `query-db-collection` робить ПРЕФІКСНИЙ пошук
  ключа (`findAll({ queryKey: baseKey })`), тож вітринний і адмінський запит під тим самим
  префіксом ділили б чужі рядки. Негативний контроль —
  `tests/eslint-rules/no-collection-key-outside-admin-data.test.ts`; поведінковий доказ —
  `admin-data/__tests__/collection-key-storefront-isolation.test.ts`.
- 🔴 **Кожне кастомне правило має ВЛАСНЕ імʼя плагіна:** ESLint 10 падає з
  `ConfigError: Cannot redefine plugin`, якщо два блоки на тих самих файлах оголошують один ключ, а
  flat config замінює опції правила цілком — тому власне правило, а не черговий
  `no-restricted-syntax`, який замістив би i18n-селектори.

### i18n: повнота

🔴 Зелений лінт завершеності i18n **не доводить**: він бачить лише `JSXText` і три атрибути
(~64 % рядків). Доводять п'ять committed-тестів:

- `tests/i18n-coverage.test.ts` — AST-скан по `SCANNED_ROOTS` проти реєстру `PENDING_FILES`
  (реєстр містить роут-файли ядра, чиї `<title>`/`<meta description>` у `head()` перекласти нічим:
  `head()` поза React-контекстом, локаль магазину ядру недоступна);
- `tests/i18n-catalog-parity.test.ts` — повнота `en`;
- `packages/simplycms/src/i18n/__tests__/catalog-integrity.test.ts` — дублікати ключів;
- `tests/theme-messages-parity.test.ts` — повнота каталогів тем;
- `tests/plugin-messages-parity.test.ts` — повнота каталогів плагінів.

`SCANNED_ROOTS` (`tests/i18n-coverage/scan.ts`) — host `src/` і теки пакета ядра:
`storefront-routes`, `admin`, уся воронка (`cart-ui`, `catalog-ui`, `checkout-ui`, `profile-ui`,
`reviews-ui`), `core`, `storefront`, `themes`, `plugins`, `plugin-sdk`; плюс теми (тека `themes/`
і референс-пакети `simplycms-theme-*`) та плагіни (тека `plugins/` і референс-пакети
`simplycms-plugin-*`) — дискавляться з диска, не статичним списком. 🔴 Перелічені саме ТЕКИ, а не
`packages/simplycms/src` цілком: core-каталоги (`src/i18n/catalogs/**`) — кирилиця за побудовою.
Тобто `locale: 'en-US'` дає англійський магазин цілком.

🔴 **Каталогів ТРИ рівні, плутати не можна.** Core-каталог
(`packages/simplycms/src/i18n/catalogs/{uk,en}/`) типізований замкненим union-ом `MessageKey`.
Тема несе **власний** каталог (`ThemeModule.messages`, `themes/<name>/messages.ts`), читається
`useThemeT()`; плагін — власний `messages` у `definePlugin` (ключі з префіксом `plugin.<name>.`),
читається `usePluginT()` з `simplycms/plugin-sdk`. Класти копірайт теми/плагіна в core-каталог
заборонено: зламає типізацію ядра й змішає шари. Ланцюжок скрізь: `[locale]` → `uk` → сам ключ.
Метадані реєстру плагіна (manifest.description) — англійською: показуються з БД-рядка.

## Tech Stack

- **Framework:** TanStack Start 1.167 + TanStack Router 1.168 (Vite 8, React 19)
- **Language:** TypeScript 5.9 (strict mode) — 🔴 **свідомо не 6/7**, див. нижче
- **Linting:** ESLint 10 + typescript-eslint 8
- **Package Manager:** pnpm 11.20 (workspaces; налаштування — у `pnpm-workspace.yaml`, не в `package.json`)
- **Runtime:** Node `>=22.12` (поріг `@tanstack/react-start`); стоїть у ВСІХ пʼяти публікованих
  пакетах і в `packages/create-simplycms-store/template/package.json.tpl`, під тестом-піном парності
- **Database:** чистий **PostgreSQL 17** (Drizzle + `pg`-пул, `simplycms/db`); auth — **Better Auth**.
  Supabase — лише один із можливих провайдерів Postgres
- **UI:** Tailwind CSS v4 + shadcn/ui (Radix primitives)
- **Forms:** react-hook-form + Zod 4
- **Data Fetching:** TanStack React Query 5 (client) + route loaders / `createServerFn` (server)
- **Rich Text:** Tiptap v3
- **Testing:** Vitest 4 + Testing Library + jsdom 30
- **Formatting:** Prettier 3

🔴 **Чому TypeScript лишається на 5.9** (реєстр — `UPSTREAM:TSESL-1`): TS 7 — нативний Go-компілятор
без стабільного програмного API до 7.1, тож `typescript-eslint` закрив запит підтримки як
**not planned** (peer — `typescript <6.1.0`); це наш гейт `pnpm lint`, і блокер тут ОДИН. Декларації
пакетів емітить `tsc -p tsconfig.dts.json` (CLI, не програмний API). Апстрім пропонує тримати два
компілятори (`@typescript/typescript6` для тулінгу) — для нас це борг без вигоди. TS 6 вимагає
прибрати `baseUrl`, після чого бандлер інжектує власний і падає з `TS5101`, а
`ignoreDeprecations: "6.0"` відкриває `TS2209` (потрібен явний `rootDir` у кожному пакеті) — це
окремий міграційний проєкт, а не бамп залежності. **Умова перегляду:** `typescript-eslint`
оголосить підтримку TS 7.

## Project Structure

```
simplyCMS/
├── routes.ts                         # virtualRouteConfig: rootRoute + physical() на роут-теки
│                                     # packages/simplycms/routes/{storefront,admin} (+ плагіни)
├── apps/www/                         # Лендінг simplycms.dev: TanStack Start у режимі ПРЕРЕНДЕРУ
│                                     # (статичний HTML, деплой dist/client на будь-який хостинг).
│                                     # private, ПОЗА реліз-потягом (bump/publish сканують лише
│                                     # packages/*). Живі метрики (зірки GitHub, downloads/версія npm)
│                                     # тягне БРАУЗЕР відвідувача з публічних API; агрегатори під
│                                     # tests/www-live-stats.test.ts. Виключений з root tsconfig
│                                     # (власний), у root eslint/prettier входить (ігнор лише на
│                                     # routeTree.gen.ts). CI — job `www`.
├── src/                              # Host — тонка збірка магазину
│   ├── routes/
│   │   ├── __root.tsx                # Root route (html, providers, 404/error)
│   │   └── my/                       # ЄДИНА тека роутів магазину (кастомні сторінки)
│   ├── engine-provider.tsx           # EngineProvider (ізоморфна збірка EngineContext: links+config)
│   ├── engine.shared.ts              # Shared-частина EngineContext (isomorphic)
│   ├── styles/globals.css            # Tailwind v4 entry (@import + @config)
│   ├── theme-registry.ts             # Реєстрація тем з config.themes (side-effect)
│   ├── router.tsx                    # createRouter
│   ├── start.ts                      # createStart + global request middleware (admin guard)
│   ├── client.tsx                    # Client hydration entry
│   ├── server.ts                     # Server entry: createServerEntry({ fetch }) + точка перехоплення
│   └── routeTree.gen.ts              # AUTO-GENERATED — do not edit
│
├── packages/               # ВСІ публіковані пакети — рівно ПʼЯТЬ.
│   │                       # 🔴 Тека `packages/simplycms/` — САМ фреймворк-пакет (unscoped
│   │                       # npm-імʼя `simplycms`), а не проміжний рівень. Тулінг відрізняє ядро
│   │                       # за ІМЕНЕМ: scope `@simplycms/` АБО точне `simplycms`
│   │                       # (🔴 ніколи префіксом — зачепив би сторонні simplycms-theme-*).
│   ├── simplycms/          simplycms                 # ФЛАГМАН: усе ядро одним пакетом
│   │   ├── src/contracts/        # T0 Контракти + порти (0 runtime deps); субшляхи
│   │   │                         #    ./views і ./views/fixtures — view-model-и вітрини
│   │   │                         #    (контракт тем v3; react — type-only peer);
│   │   │                         #    ./entities — реєстр ENTITY/AGGREGATE/SESSION_KEY +
│   │   │                         #    фабрика entityKey() для queryKey React Query;
│   │   │                         #    ./server-only — декларація межі клієнт/сервер (єдина;
│   │   │                         #    читачів СІМ: збірка ядра, гейт dist-server-boundary,
│   │   │                         #    правило server-only-relative, групи no-restricted-imports
│   │   │                         #    плагінів, Gate C, Import Protection у vite.config магазину,
│   │   │                         #    правило no-server-only-in-client. 🔴 Три лінт-детектори
│   │   │                         #    рахуються ОКРЕМО: різні механізми й різні негативні
│   │   │                         #    контролі — test-contours.md §12)
│   │   ├── src/domain/           # T1 Pure-логіка: pricing/discounts/inventory/shipping
│   │   ├── src/schema/           # T1 Drizzle-схема ядра + RLS у TS
│   │   ├── src/schema/types.ts   # T1 Типи рядків із Drizzle — джерело типів для НОВОГО серверного коду
│   │   ├── src/db/               # T2 pg-пул + `withActor` — ЄДИНИЙ спосіб дістати зʼєднання
│   │   │                         #    (GUC актора + SET LOCAL ROLE у транзакції); гола фабрика
│   │   │                         #    `db/client` закрита лінт-зоною й не має субшляху в exports
│   │   ├── src/auth/             # T2 Серверний Better Auth (інстанс, databaseHooks, invite
│   │   │                         #    власника, authz-матриця); вхід, сесія й guard адмінки
│   │   ├── src/admin-server/     # T2 Серверний шар адмінки — defineAdminResource (операції+схеми)
│   │   │                         #    + іменовані операції; index.ts — ЛИШЕ топ-рівневі
│   │   │                         #    createServerFn, нутрощі — bare-субшлях ./impl
│   │   ├── src/storage/          # T2 Порт сховища файлів — драйвер local-fs, іммутабельні
│   │   │                         #    ключі, MIME за байтами, запис файлу й рядка `media` однією
│   │   │                         #    транзакцією актора. server-only за contracts/server-only
│   │   ├── src/inventory/        # T2 Спільний облік залишків — гвардований перехід stock_status
│   │   │                         #    (одна копія для вітрини й адмінки), lockTargetStock/
│   │   │                         #    servingQuantity. server-only
│   │   ├── src/supabase/         # T2 browser/server/anon-клієнти, SupabaseProvider, keys,
│   │   │                         #    database.ts (ЗАМОРОЖЕНИЙ baseline core-типів). Шар
│   │   │                         #    адмінки на supabase-js, що переписується на admin-server;
│   │   │                         #    вітрина його не імпортує, провайдер ніде не монтується
│   │   ├── src/react-query/      # T2 Query-хуки через EngineContext
│   │   ├── src/runtime/          # T2 defineRuntime + host-defineConfig; ./domain-error-adapter —
│   │   │                         #    T0-реєстр доменних помилок (AdminConflictError/AuthzError) +
│   │   │                         #    клієнтський seroval-адаптер межі serverFn (реєструється в
│   │   │                         #    src/start.ts serializationAdapters)
│   │   ├── src/i18n/             # T2 createTranslator, I18nProvider, каталоги uk/en
│   │   ├── src/storefront/       # T2 SSR-лоадери + SEO-генератори (DI-клієнт)
│   │   ├── src/ui/               # T3 shadcn/ui-примітиви
│   │   ├── src/themes/           # T4 ThemeRegistry, bootstrapThemes, applyTokens,
│   │   │                         #    validateThemeModule, conformance/ (гейт views v3,
│   │   │                         #    субшлях simplycms/themes/conformance)
│   │   ├── src/plugins/          # T4 HookRegistry, PluginSlot, bootstrapPlugins,
│   │   │                         #    validatePluginModule
│   │   ├── src/plugin-sdk/       # T4 definePlugin + порти плагінів (usePluginTable,
│   │   │                         #    usePluginConfig, usePluginT) — ЄДИНА поверхня,
│   │   │                         #    дозволена плагіну (межа довіри §7)
│   │   ├── src/admin-data/       # T4 Колекції TanStack DB адмінки — реєстр по QueryClient,
│   │   │                         #    колекції без schema, ключі з contracts/entities
│   │   ├── src/{cart,catalog,checkout,profile,reviews}-ui/   # T4 Feature-UI воронки
│   │   ├── src/core/             # T5 Власні провайдери/хуки/компоненти (CMSProvider,
│   │   │                         #    useAuth, useCart, useBanners…)
│   │   ├── src/admin/            # T5 Сторінки/компоненти адмінки; частина на admin-server/
│   │   │                         #    admin-data, решта — легасі на supabase-js (поточний
│   │   │                         #    перелік — v2-state-map.md та реєстр
│   │   │                         #    tests/admin-server-first/registry.ts)
│   │   ├── src/storefront-routes/# T5 pages/ (container-и) + views/ (канонічні view +
│   │   │                         #    slots/ реквізитів) + shells/ + server/ + seo/
│   │   ├── routes/storefront/    # T5 Роут-файли вітрини — монтуються physical()
│   │   ├── routes/admin/         # T5 Роут-файли адмінки (тонкі обгортки src/admin)
│   │   ├── migrations/           # КАНОН core-міграцій: baseline 0000_prelude → 0003_seed;
│   │   │                         #    джерело `simplycms db:diff`
│   │   ├── skills/               # Агентні скіли, які їдуть у магазини СИМЛІНКАМИ
│   │   ├── drizzle/ + drizzle.config.ts + seed-migrations/     # schema-тулінг
│   │   └── tsdown.config.ts      # ДВІ збірки (клієнт/сервер); entry з dev-exports; група — за contracts/server-only
│   ├── cli/                @simplycms/cli            # CLI магазину (bin `simplycms`): doctor/add/
│   │                                                 # create (plugin|theme)/update/db:diff (N канонів)/
│   │                                                 # theme:conformance (гейт views, контракт тем v3);
│   │                                                 # чистий ESM без build; host/ — канон host-файлів,
│   │                                                 # template-plugin/ і template-theme/ — шаблони
│   │                                                 # (`pnpm template:sync`); виконується В МАГАЗИНІ
│   ├── simplycms-theme-solarstore/ @simplycms/theme-solarstore  # Референс-тема повного контуру: manifest
│   │                                                 # + tokens + components + messages (npm)
│   ├── simplycms-plugin-faq/  @simplycms/plugin-faq  # Референс-плагін повного контуру: plg_faq_items,
│   │                                                 # routes/ (/admin/faq), слот, Zod-settings, i18n.
│   │                                                 # 🔴 З шаблону знято — ставиться `simplycms add`
│   ├── create-simplycms-store/  # UNSCOPED npm-пакет: CLI-скаффолдер (`src/`) + вбудований
│   │                            # шаблон магазину (`template/`, закомічена копія,
│   │                            # синхронізується `pnpm template:sync`). Під фільтри імені ядра
│   │                            # не підпадає й у tarball-parity не рахується.
│   └── README.md           # Джерело правди про тіри залежностей T0→T5
│
├── scripts/                          # Тулчейн міграцій, пакування, релізу
│   ├── db-diff.mjs · db-migrate.mjs  # db-migrate — файл-надгробок (канон переїхав у packages/simplycms/migrations/)
│   ├── release.mjs      + release/      # bump/gates/git — `pnpm release X.Y.Z`
│   │                                    # (bump.mjs сканує packages/* — і ядро, і скаффолдер)
│   ├── version-packages.mjs             # «сирий» бамп версій без гейтів
│   ├── audit-deps.mjs   + audit-deps/   # collect (bare-імпорти) + classify (deps/peers)
│   ├── audit-exports.mjs + audit-exports/ # collect (споживані subpath-и) + resolve
│   ├── pack-inspect.mjs + pack-inspect/ # читання вмісту tarball-ів
│   ├── sync-create-store-template.mjs   # монорепо → template/ пакета create-simplycms-store
│   ├── pilot-pack.mjs   + pilot-pack/   # env/pack/scaffold/build/run + gate-a…gate-d + create-pkg-smoke
│   │                                    # + seed-fixtures.mjs — джерело правди сіду
│   ├── pilot-seed.mjs                   # фікстури → supabase/seed.sql (`pnpm pilot:seed`)
│   ├── demo-db.mjs                      # `pnpm db:demo`: чиста БД із канону + демо-каталог
│   └── live-smoke.mjs + live-smoke/     # `pnpm live:smoke`: sql.mjs (прямий SQL) + register.mjs +
│                                        # funnel.mjs (Playwright-воронка) + avatar.mjs (ЄДИНИЙ
│                                        # живий доказ порту сховища: завантаження, роздача /media,
│                                        # референс у БД, видалення)
├── packages/simplycms/test-harness/pg/  # контур `pnpm test:schema` — підйом Postgres без Docker
│                                     # (PG_HARNESS_URL або ефемерний initdb), накат канону,
│                                     # інтроспекція ACL/політик, актори
├── supabase/                         # ЗАЛИШКОВА тека: config.toml + ЗГЕНЕРОВАНИЙ seed.sql
│                                     # локального стеку supabase. Ні migrations/, ні types.ts
│                                     # тут немає; канон схеми — packages/simplycms/migrations/
├── themes/default/                   # Локальна тема-еталон (контракт v3, із власними views);
│                                     # solarstore — npm-пакет packages/simplycms-theme-solarstore/
├── plugins/hello-world/              # Референс-плагін (мінімальний; повний — @simplycms/plugin-faq)
├── tests/                            # virtual-routes-escape, published-exports-parity,
│   │                                 # audit-deps, audit-exports, host-database-types, seo-endpoints,
│   │                                 # pilot-seed, create-store-template-parity (парність seed.sql і фікстур/шаблону),
│   │                                 # cli-* (юніти @simplycms/cli), tier-boundary (негативний
│   │                                 # контроль тір-зон), dist-import-meta (гард лоуереного import.meta у dist)
│   └── pilot/store-template/         # Тонкий ОВЕРЛЕЙ пілота (vite.config.ts + package.json) поверх шаблону
│                                     # create-simplycms-store — не власна копія host-каркаса (виключений
│                                     # із tsconfig.json і eslint.config.mjs)
│
├── server.mjs                        # Node-runner прод-збірки: sirv(dist/client) + fetch-handler
├── simplycms.config.ts               # defineConfig: themes, plugins, siteUrl, …
├── eslint.tier-zones.mjs             # Тір-зони T0→T5 усередині пакета ядра;
│                                     # eslint.tier-relative.mjs — відносні форми специфікатора
├── eslint-rules/                     # Кастомні flat-config ESLint-плагіни (не публікуються), кожне
│                                     # з ВЛАСНИМ імʼям плагіна: query-key-from-entity.mjs,
│                                     # server-fn-top-level.mjs (createServerFn лише топ-рівнем),
│                                     # mutation-cache-sync.mjs (мутація синхронізує кеш),
│                                     # server-only-relative.mjs (відносний імпорт у server-only
│                                     # дерево ззовні нього), no-side-effect-import.mjs
│                                     # (side-effect-імпорт у пакетах із sideEffects:false),
│                                     # no-direct-storage.mjs, no-server-only-in-client.mjs,
│                                     # no-collection-key-outside-admin-data.mjs
├── vite.config.ts                    # tanstackStart({ router.virtualRouteConfig, server.entry })
├── vitest.config.ts                  # Дефолтний прогін (packaging-suite — у test.exclude)
├── vitest.packaging.config.ts        # Tarball-parity suite (`pnpm test:packaging`)
├── tailwind.config.ts                # Tailwind v4 config
└── pnpm-workspace.yaml               # Workspace config
```

🔴 `src/routes/` сканується **не** цілком: `routes.ts` монтує лише `my/`. Файл, покладений поруч із
`__root.tsx`, роутом не стане — це семантика `virtualRouteConfig` (файлове сканування вимкнене).
`tests/virtual-routes-escape.test.ts` стереже зворотну здатність: що `physical()` бачить теки
пакетів ПОЗА `src/routes/` — саме на ній тримається монтування.

## Package Aliases (tsconfig paths + vite resolve.alias)

Аліасів для тек ядра немає: увесь T0–T5 резолвиться однією парою `simplycms` / `simplycms/*`, а
конкретна тека — це субшлях (`simplycms/contracts`, `simplycms/ui`, `simplycms/themes/conformance`, …).

| Import | Path |
|--------|------|
| `simplycms` (корінь; 🔴 зсередини самого пакета заборонений — цикл модулів) | `packages/simplycms/src` |
| `simplycms/*` | `packages/simplycms/src/*` |
| `@simplycms/theme-solarstore` | `packages/simplycms-theme-solarstore/src` |
| `@simplycms/plugin-faq` (+ `/pages/*`, `/*`) | `packages/simplycms-plugin-faq/src` |
| `@themes/*` | `themes/*` |
| `@plugins/*` | `plugins/*` |

- Довідка для читання історії git: `@simplycms/objects` → `simplycms/contracts`;
  `@simplycms/themes` → `simplycms/themes`; `@simplycms/plugins` → `simplycms/plugins`;
  `@simplycms/core` → `simplycms/core`; решта — імʼя теки один-в-один. Роут-теки лишили ключі
  exports `./storefront-routes/routes/*`, `./admin-routes/routes/*` при фізичній теці
  `routes/{storefront,admin}`.
- `@simplycms/cli` аліаса **не має** — резолвиться через workspace-симлінк `node_modules` (bin-інструмент).
  Схема БД і роут-теки аліаса теж не потребують: `scripts/db-*.mjs` адресують `packages/simplycms/`
  шляхом, `routes.ts` монтує теки `physical()`-ом.
- 🔴 Vite/vitest мають ОДИН base-prefix ключ `simplycms` (не пару): `@rollup/plugin-alias` матчить і
  `simplycms`, і `simplycms/<sub>`, але **не** `simplycms-*` — саме тому сторонні `simplycms-theme-*`
  не перехоплюються.

## Theme System (контракт v3)

Тема постачає оформлення і — опційно — **view-шар** пʼяти сторінок вітрини. Дані, роути й SEO
лишаються ядром завжди. Повний механізм — [`docs/architecture/themes.md`](docs/architecture/themes.md).

```ts
ThemeModule = { manifest, tokens, components, settings?, messages?, fonts?, views? }
```

1. **Реєстрація:** `src/theme-registry.ts` реєструє теми з `config.themes` (`simplycms.config.ts`)
   через `ThemeRegistry.register()` — side-effect-імпорт з `__root.tsx`, працює на сервері й на
   клієнті. Тема — локальна тека `themes/<name>` (аліас `@themes/*`) або npm-пакет (референс ядра —
   `@simplycms/theme-<name>`, конвенція сторонніх — `simplycms-theme-<name>`).
2. **SSR-резолв:** `getActiveThemeSSR` (`simplycms/themes`) читає активну тему з БД; `loader`
   каркасних роутів віддає `themeName` дітям.
3. **Сторінки — в ядрі:** канонічні сторінки живуть у `simplycms/storefront-routes/pages/*`. Каркаси
   `StorefrontShell` / `ProtectedShell` беруть з теми `components` лише Header/Footer і обгортають
   сторінку; секційні компоненти (HeroBanner/HomeSections) споживає сама сторінка (`pages/Home.tsx`).
   `theme.pages.*` не існує — тема впливає на сторінку лише через `views` (п. 10).
4. **Токени:** `applyTokens(theme.tokens)` розкладає палітру в CSS-змінні — тема не везе власний
   `theme.css`. Набір містить два не-кольорові типографічні ключі — `'font-sans'` і `'font-heading'`
   (повний CSS font-family stack рядком); `font-heading` б'є по `h1..h6` через `@layer base`,
   fallback обох — `:root` у `src/styles/globals.css` (🔴 невизначена `var()` у `font-family` вбиває
   всю декларацію, тож fallback обовʼязковий). `--brand-*`/`colors.brand` немає:
   `.gradient-brand*` фарбуються `--primary` активної теми.
5. **Шрифти теми (v2.2):** опційне `fonts?: ReadonlyArray<{ stylesheet }>` — лише абсолютні
   `https:`-URL зовнішніх stylesheet-ів (без `@font-face` і роздачі файлів: npm-тема не має каналу
   статики). Фільтр — `safeFontStylesheets` (🔴 імпорт ТІЛЬКИ субшляхом
   `simplycms/themes/safeFontStylesheets`: barrel тягне `getActiveThemeSSR` → `anon-client` у
   клієнтський бандл); рендер — `ThemeFonts` в обох каркасах поруч із `ThemeTokens`. Базовий
   Inter-`<link>` у `__root.tsx` лишається (адмінка + fallback).
6. **Валідація:** `validateThemeModule` — публічний API для авторів тем; `ThemeRegistry.load` падає
   на тему `default`, якщо запитаної немає.
7. **Активація з адмінки:** прапорець `is_active` у таблиці `themes`; перемикання інвалідовує кеш
   теми. `bootstrapThemes` (клієнтський `useEffect` поруч із `PluginBootstrap` у `__root.tsx`)
   дописує в БД рядки для зареєстрованих-але-відсутніх тем — інакше адмінка (читає лише БД) не
   побачила б встановлену через конфіг тему; рядок без модуля в білді показує бейдж «модуль
   відсутній» + disabled «Активувати» (registry-awareness, `Themes.tsx`).
8. **ThemeContext (клієнт):** приймає `initialThemeName` з лоадера — зайвого клієнтського фетчу немає.
9. **Установка npm-теми:** `pnpm simplycms add <pkg> --theme` (голий пакет, апстрім-фікси) або
   `--copy` (shadcn-модель: копія `src/` у `themes/<key>`, пакет знімається — повне володіння).
   Авторський dev-loop — `pnpm simplycms create theme <name>`.
10. **`views`:** опційне перевизначення view-шару пʼяти сторінок вітрини — `Home`, `Catalog`,
    `CatalogSection`, `ProductDetail`, `Cart`. Кожна сторінка
    `storefront-routes/src/pages/<Name>.tsx` — **container** (дані, стан, збір view-model-а) і
    резолвить view хуком `useStorefrontViews` (🔴 повертає МАПУ: `<views.X {...vm}/>`, бо компонент
    у локальній змінній валить `react-hooks/static-components`); канонічні view —
    `src/views/<Name>View.tsx`. View — ЧИСТА функція від vm (жодних запитів; дозволені
    `useT`/`useThemeT`/`useThemeSettings`).
11. **View-model-и — `simplycms/contracts/views`** (+ фікстури `simplycms/contracts/views/fixtures`),
    🔴 субшлях ПОЗА барелем: тип слота вимагає `ComponentType` з react (структурний тип JSX не
    приймає, TS2786), а барель обіцяє «без імпортів react/supabase». `react` там — опційний
    **type-only peer**, T0 лишається без рантайм-залежностей.
12. **Слоти реквізитів:** `vm.slots` — прибінджені ядром компоненти (`src/views/slots/`), тема їх
    лише РОЗСТАВЛЯЄ; кожен малює маркер `data-simplycms-requisite`. Імена й обовʼязковий склад —
    `REQUIRED_REQUISITES` у `simplycms/contracts/views` (🔴 `Home` порожній, `Cart` без
    `ClearCart` — обовʼязковим може бути лише безумовний слот).
13. **Conformance:** `assertThemeViewsConformance` — `simplycms/themes/conformance` (субшлях, як
    `safeFontStylesheets`): рендер заявлених темою view на фікстурах (`full`/`edge`) без БД + асерт
    реквізитів на `full`. Рантайм-fallback НЕ робиться. Два канали запуску: канонічний
    `pnpm simplycms theme:conformance <name>` (потребує `jsdom` on-demand) і додатковий
    `themes/<name>/conformance.test.ts` (де є vitest).

## Environment Variables

🔴 **Контракт магазину — рівно ТРИ ключі.** Copy `.env.example` to `.env.local`; клієнту видно лише
ті, що з префіксом `VITE_`:

- `DATABASE_URL` — **серверний**: пряме підключення до Postgres, з нього живе пул `simplycms/db`.
  Логін роллю `app_runtime` (вона без прямих грантів, тож забутий `SET LOCAL ROLE` падає, а не
  мовчки обходить RLS). Той самий URL — джерело тулінгу (`db:pull`/`db:diff`)
- `BETTER_AUTH_SECRET` — **серверний**: підпис сесій Better Auth (`simplycms/auth`). `VITE_`-префікса
  бути не може — секрет у клієнтському бандлі не секрет. Опційний сусід — `BETTER_AUTH_URL` (без
  нього базовий URL береться із самого запиту — у dev це очікуваний WARN; у проді рекомендований: з
  рядковим baseURL Better Auth довіряє рівно цьому origin і відкидає інші з 403 `INVALID_ORIGIN`).
  Контракт стереже `tests/env-contract.test.ts`
- `VITE_SITE_URL` — публічний URL сайту (sitemap.xml, robots.txt); запікається при `vite build`,
  тож зміна вимагає перезбірки

- 🔴 `MEDIA_ROOT` — опційний серверний ключ, а не четвертий у контракті: корінь драйвера
  `local-fs`, дефолт `./.data/media` відносно робочої теки процесу. У проді його задають на
  змонтований том, бо дефолт лежить усередині теки деплою й після нового деплою сховище було б
  порожнім. У `.env.example` і в шаблоні магазину ключ лежить **закоментованим** (як
  `BETTER_AUTH_URL`) — `tests/env-contract.test.ts` рахує активні рядки, розкоментований
  `MEDIA_ROOT` зробив би гейт червоним.
- Поза контрактом магазину — dev-ключ `PG_HARNESS_URL`: готовий Postgres для `pnpm test:schema` (без
  нього харнес підіймає ефемерний кластер сам) і для `pnpm db:demo` (альтернатива — прапорець
  `--url`; `DATABASE_URL` цим двом не джерело, бо обидва СТВОРЮЮТЬ базу в кластері).
- `VITE_SUPABASE_*` магазину не потрібні ні вітрині, ні входу, ні `/api/health`.
  `resolveSupabaseKeys` і фабрики клієнтів лишились у `simplycms/supabase` як шар **адмінки**:
  магазин, якому потрібна робоча легасі-адмінка, тримає ці ключі у власному env — контрактом ядра
  вони не є.

🔴 **Контурів env два, джерела в них різні.** Клієнтський бандл читає `import.meta.env` — значення
запікаються при `vite build`. Серверний код (SSR, server fns, middleware, SEO) читає **лише**
`process.env` і лише в рантаймі; `.env`/`.env.local` — не джерело, а спосіб його наповнення (див.
«Production Run»). `VITE_`-префікс означає «видно клієнту», а не «лише клієнт»: той самий
`VITE_SITE_URL` сервер бере з `process.env` (`seo/robots`, `seo/sitemap`). Дуального резолву немає —
відсутній ключ гучно падає. Контракт стережеться машинно, і саме так, бо інакше не можна: у vitest
`import.meta.env` — Proxy над `process.env` (один обʼєкт), тож ТЕСТ довести джерело env не здатен.
Доводять: eslint `no-restricted-syntax` на `import.meta.env` у шести серверних модулях (див. «Лінт»)
і Gate C пілота (`server-client` + `anon-client` у `SERVER_PAYLOAD`).

## Production Run

`pnpm build` віддає **два** каталоги: `dist/client/` (статика з хешованими іменами) і
`dist/server/server.js` — **fetch-handler** (`{ fetch(Request) → Response }`), а не готовий
HTTP-сервер. Теки `.output/` немає.

- `src/server.ts` — server entry (`server: { entry: './server.ts' }` у `vite.config.ts`). 🔴 Шлях
  резолвиться від `srcDirectory` (`src/`), **не** від кореня: `'./src/server.ts'` мовчки не
  знайдеться і плагін відкотиться на дефолтний entry. Тут же — точка перехоплення запиту перед
  делегацією в роутер.
- `server.mjs` (корінь) — Node-runner: `sirv(dist/client)` для статики (`/assets/*` →
  `max-age=31536000, immutable`), решта — `IncomingMessage → Request → fetch-handler →
  ServerResponse` зі стрімінгом в обидва боки (`Readable.toWeb` / `Readable.fromWeb`), тому
  SSR-стрімінг Start не ламається.
- `pnpm start` = `node server.mjs`; порт — `PORT` (за замовчуванням `3000`), інтерфейс — `HOST`
  (за замовчуванням `0.0.0.0`).

**Deploy:** на прод кладуться `dist/`, `server.mjs`, `package.json` + production-`node_modules`
(потрібен рівно один рантайм-пакет — `sirv`, він у `dependencies`). `VITE_*` для КЛІЄНТСЬКОГО
бандла запікаються на етапі `vite build`, тож збірку робить той самий env, що й прод.

🔴 **Контракт серверного env:** серверний контур читає **лише** `process.env` і лише в рантаймі
(усередині фабрик/хендлерів, не на модуль-рівні). `server.mjs` перед динамічним імпортом хендлера
наповнює `process.env` із `.env.local`/`.env` — лише відсутні ключі, тож реальний env процесу завжди
виграє (`process.env` > `.env.local` > `.env`); у dev те саме робить `loadEnv` у `vite.config.ts`.
Наслідок: ротація `DATABASE_URL`/`BETTER_AUTH_SECRET` = перезапуск процесу, БЕЗ перезбірки; для
клієнтського `VITE_SITE_URL` потрібна перезбірка.

## Database Commands

Джерело правди схеми — `packages/simplycms/src/schema/schema.ts` (Drizzle). Schema-тулінг
(`drizzle/`, `drizzle.config.ts`, `seed-migrations/`) живе на рівні ПАКЕТА, не в `src/`; root-скрипти
`db:pull` — це `pnpm --filter simplycms run …`.

```bash
pnpm db:pull                   # Introspect live DB → Drizzle baseline
pnpm db:diff <name>            # schema.ts → SQL у packages/simplycms/migrations/ (ревʼю обовʼязкове)
pnpm test:schema               # накат канону на чисту БД харнеса
pnpm db:demo                   # покупний демо-магазин; перевірка одним прогоном далі — `pnpm live:smoke`
```

- 🔴 Генератора типів БД немає. Джерело типів для НОВОГО коду — `simplycms/schema/types`
  (виведені з Drizzle-схеми). `packages/simplycms/src/supabase/database.ts` — **заморожений**
  снапшот, на якому типізується легасі-адмінка: не «оновлювати» і не «прибирати дублювання».
- 🔴 Міграції **не** застосовуються через Supabase MCP (`apply_migration`) — MCP лише для
  інспекції. `db:migrate` — файл-надгробок; накат канону на чисту БД робить `pnpm db:demo`
  (магазин) або харнес `pnpm test:schema` (гейт).

### Контракт id: ключ генерує ВИКЛИКАЧ, не БД

- У таблицях «Категорії A» немає `DEFAULT gen_random_uuid()`, тож кожен INSERT зобовʼязаний
  передати `id` (`randomUUID()` на сервері, `crypto.randomUUID()` у браузері) — інакше `23502`.
- DEFAULT лишається тільки в `users`/`sessions`/`accounts`/`verifications` (Better Auth не кладе
  `id` в INSERT — конструктивне делегування генерації базі).
- Виїмка на теку — `src/admin/**` (легасі supabase-js-шар) під ратчетом
  `tests/admin-inserts-need-id.test.ts`.
- Гейти інваріанта — `explicit-ids.test.ts` (дискаверить усі вставки в `packages/simplycms/src/**`)
  і `id-defaults.test.ts` (DDL) у `pnpm test:schema`.
- Повний опис — [`data-access`](.github/instructions/data-access.instructions.md), розділ «Контракт id».

## CI/CD

Два workflow-файли: `workflow.yml` (перевірки) і `publish-packages.yml` (реліз).

| Workflow | Job | Кроки | Коли |
|----------|-----|-------|------|
| `workflow.yml` | `typecheck` | `install` → `format:check` → `build` → `typecheck` → `lint` | push/PR/manual |
| `workflow.yml` | `test` | `install` → `test` | push/PR/manual |
| `workflow.yml` | `packaging` | `install` → `build:packages` → `typecheck:template` → `test:packaging` → `pilot:pack --skip-build` | push/PR/manual |
| `workflow.yml` | `schema` | `install` → `test:schema` (service-контейнер `postgres:17`) | push/PR/manual |
| `publish-packages.yml` | `publish` | гейт `NPM_TOKEN` → `install` → `build:packages` → `test:packaging` → `pnpm publish -r` | push у `main`, manual |

- `packaging` — окремий job, а не крок у `test`: parity-suite працює по tarball-ах і потребує
  зібраних `dist/` кожного пакета.
- 🔴 `pnpm pilot` (Gate B проти живої БД) у CI **не** ганяється: він потребує живої бази
  (`DATABASE_URL`), а це зовнішній стан, від дрейфу якого гейт червонів би без регресії коду. Прогін
  `pilot` перед релізом — відповідальність розробника.
- 🔴 `pnpm pilot:pack` (без БД) — крок job `packaging`: Gate C і Gate IP — єдиний поведінковий доказ
  межі клієнт/сервер у реальному магазині з tarball-ів. Передрелізний гейт у CI —
  детерміністичний tarball-parity плюс `pilot:pack --skip-build`.

## Публікація пакетів (npmjs)

Ядро публікується на npmjs **пʼятьма пакетами**: unscoped `simplycms` +
`@simplycms/{cli,theme-solarstore,plugin-faq}` + unscoped скаффолдер `create-simplycms-store`.
**Повна інструкція — [`docs/architecture/release-process.md`](docs/architecture/release-process.md)**
(включно з типовими помилками 401/402/403 і чому не GitHub Packages). Стисло:

- **Реліз однією командою** — `pnpm release X.Y.Z`: гарди (чисте дерево, версія більша за
  поточну, тег ще не існує) → бамп → повний прогін гейтів → коміт `chore(release): vX.Y.Z`. Далі
  `git push` і PR у `main` — вручну, бо реліз лишається рішенням людини.
- **Версія синхронна** — усі 5 пакетів завжди мають ОДНУ версію; `scripts/release/bump.mjs`
  сканує `packages/*` і бере все, що не `private`; точний набір (не поріг) асертить
  `tests/release-bump-coverage.test.ts`; розходження версій реліз-скрипт вважає помилкою стану й
  падає. 🔴 Критерії «публікованості» в інструментів РІЗНІ: у реліз-потязі пʼять пакетів, у
  tarball-parity-suite — **чотири** (`create-simplycms-store` відсікається за іменем; зафіксовано
  коментарем у тесті, «лагодити» не треба).
- **Тригер — push у `main`.** `pnpm publish -r` сам пропускає пакети, чия версія вже в реєстрі
  (`isAlreadyPublished`), тож merge без бампа — no-op **тільки для пакетів, що вже там є**. Пакет,
  якого в реєстрі ще немає, мерж публікує: введення нового пакета є релізним рішенням саме в
  момент мержу, а імʼя в глобальному просторі npm займається незворотно.
- `workflow_dispatch` — ручний ретрай, якщо прогін упав на середині.
- 🔴 `publishConfig.access: "public"` у кожному manifest-і **обовʼязковий**: scoped-пакети npm за
  замовчуванням робить приватними, а це платний план.
- Потрібен secret **`NPM_TOKEN`** — 🔴 саме **Granular Access Token із увімкненим «Bypass 2FA»** і
  обсягом **`All Packages`** (read+write). Не scope `@simplycms`: scope — префікс в ІМЕНІ пакета, а
  не тека, а unscoped-пакетів у монорепо ДВА (`create-simplycms-store` і `simplycms`). Токен без
  bypass автентифікується, але публікацію npm відхиляє з `403 … bypass 2fa enabled is required`.
  Без секрету job падає з явним повідомленням ще до збірки.
- Публікація йде в **npmjs**, не в GitHub Packages (scope `@simplycms` не збігається з власником
  org, і публікація гарантовано падала б з 403) — той шлях не відновлювати.
