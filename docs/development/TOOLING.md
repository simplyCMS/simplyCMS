# Інструментарій: команди, гейти, лінт, CI

Довідник розробника репозиторію. Правила-інваріанти — `AGENTS.md`; середовище й
змінні — `docs/development/ENVIRONMENT.md`; межі тестових контурів —
`docs/architecture/test-contours.md`; обходи дефектів залежностей —
`docs/architecture/upstream-workarounds.md`.

## 1. Менеджер пакетів і стек

- **pnpm** — єдиний менеджер (не `npm`/`yarn`). 🔴 З pnpm 11 УСІ налаштування pnpm живуть у
  `pnpm-workspace.yaml`: поле `pnpm` у `package.json` мовчки ігнорується, `.npmrc` читається
  лише для auth і registry. Workspace: `packages/*`, `themes/*`, `plugins/*`, `apps/*`
  (`apps/*` — private-застосунки платформи, не пакети ядра: реліз-потяг їх не чіпає).
- Версії залежностей — у `package.json`; `Node >=22.12` стоїть у ВСІХ пʼяти публікованих пакетах
  і в `packages/create-simplycms-store/template/package.json.tpl` під тестом-піном парності.

Стек (версії — у `package.json`, тут лише те, що визначає рішення):

- **Каркас:** TanStack Start + Router (Vite, React 19), SSR вітрини, client-only адмінка.
- **Мова:** TypeScript strict — 🔴 **TS 6.0; TS 7 заблоковано лише `typescript-eslint`** (причина нижче).
- **Лінт:** ESLint 10 (flat config) + typescript-eslint 8; форматування — Prettier (exact-версія в `devDependencies`).
- **Дані:** чистий **PostgreSQL 17** (Drizzle + `pg`-пул, `simplycms/db`), auth — **Better Auth**.
  Supabase — лише один із можливих провайдерів Postgres.
- **UI:** Tailwind CSS v4 + shadcn/ui (Radix); форми — react-hook-form + Zod 4; rich text — Tiptap v3.
- **Дані на клієнті:** TanStack React Query (+ TanStack DB колекції адмінки) і route loaders / `createServerFn`.
- **Тести:** Vitest + Testing Library + jsdom; схемний контур — Postgres-харнес.

🔴 **TypeScript 6.0, TS 7 — ще ні** (реєстр — `UPSTREAM:TSESL-1`): міграція 5.9 → 6.0.3 (2026-10-05)
зводилась до прибирання `"baseUrl": "."` у трьох tsconfig (шляхи `paths` уже `./…`), без
`ignoreDeprecations` і без змін коду; декларації пакетів побайтово ті самі, що на 5.9. TS 7 —
нативний Go-компілятор; наш код він типізує без помилок (4,8 с проти 16,5 с на 6.0.3), але
`typescript-eslint` має peer `typescript <6.1.0` — це наш гейт `pnpm lint`, і блокер ОДИН.
Декларації пакетів емітить `tsc -p tsconfig.dts.json` (CLI, не програмний API). **Умова перегляду:**
`typescript-eslint` оголосить підтримку TS 7.

`tools/content-loader-mcp` (поза workspace, борг №13 роадмапа): під TS 6 при відновленні
потребує `"types": ["node"]` у tsconfig (TS2591); зараз не виправляється.

## 2. Команди

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (Vite + TanStack Start)
pnpm build            # Production build (vite build)
pnpm start            # Run production server (node server.mjs, PORT=3000) — див. docs/development/ENVIRONMENT.md
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
pnpm verify:published X.Y.Z   # післярелізно: чи всі пʼять пакетів доїхали в реєстр на версії X.Y.Z
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
                      # Схема БД — див. docs/architecture/data-layer.md § «Міграції»
```

Команд `pnpm test:e2e` і `pnpm pilot:e2e` немає: прапорець `--e2e` падає з поясненням, а не
мовчки ігнорується. Генератора типів БД (`db:generate-types`, `types:baseline`) теж немає.

## 3. Гейти (порядок і причини)

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

## 4. Лінт

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
  виїмка, доки сторінки адмінки не переписані на `admin-server`. Деталі —
  `docs/architecture/data-layer.md` § «Контракт ключів кешу».
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

Повнота i18n і три рівні каталогів — `docs/architecture/i18n.md`.

## 5. Аліаси специфікаторів (tsconfig paths + vite resolve.alias)

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

Інше: SEO-ендпойнти (`/sitemap.xml`, `/robots.txt`) живуть у серверному вході
`src/server.ts` (окремого vite-плагіна немає); `resolve.dedupe` — `react`, `react-dom`,
`@tanstack/react-query`. Тести мають окремий `vitest.config.ts` (`@vitejs/plugin-react`, без
`tanstackStart`) — він не проганяє React Compiler/Start-трансформації, тож їх дефекти тестам
невидимі.

## 6. CI/CD

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

Реліз пакетів — `docs/architecture/release-process.md`.
