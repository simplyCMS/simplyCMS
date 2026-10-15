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
- Версії залежностей — у `package.json`; `Node >=24` стоїть у ВСІХ пʼяти публікованих пакетах
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
Декларації пакетів емітить `tsc -p tsconfig.dts.json` (CLI, не програмний API). Корінь — TS 7.0
вийшов без програмного API (з'явиться в 7.1); `typescript-eslint` підтримку робить (трекер #10940,
PR #12803), а не відмовив. **Умова перегляду:** реліз `typescript-eslint` з підтримкою TS 7.1 →
бамп одразу на 7.1. Стан апстріму й розглянуті альтернативи — у записі TSESL-1.

## 2. Команди

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (Vite + TanStack Start)
pnpm build            # Production build (vite build)
pnpm start            # Локальний запуск зібраного бандла (node server.mjs, PORT=3000), НЕ для проду (прод — node scripts/start.mjs) — див. docs/development/ENVIRONMENT.md
pnpm typecheck        # TypeScript type check
pnpm typecheck:showcase   # tsc сіду вітрини (tsconfig.showcase.json): tsx типів не перевіряє,
                      # а кореневий tsconfig scripts/showcase/*.mts не включає
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
pnpm harness:up       # Postgres-харнес однією командою: контейнер simplycms-harness-pg
                      # (pgvector/pgvector:pg17, trust, порт 54331), ідемпотентно; пише
                      # PG_HARNESS_URL у git-ignored .env.harness, який підхоплюють test:schema,
                      # live:smoke і db:demo, лише якщо змінну не задано явно І контейнер запущений
                      # (інакше файл ігнорується з попередженням). Потребує Docker.
                      # pnpm harness:down — прибрати контейнер і .env.harness
pnpm test:schema      # СХЕМНИЙ контур: накат канону міграцій на чистий Postgres + парність
                      # політик і грантів + ПОВЕДІНКОВА матриця RLS.
                      # 🔴 Проєкт `pg` — без Docker: або готовий кластер через PG_HARNESS_URL,
                      # або ефемерний initdb/pg_ctl (не від root). Проєкти `storage` і `mail`
                      # потребують Garage і Mailpit (`pnpm harness:up`). У CI — job `schema`
                      # із service-контейнером postgres:17. Межі — test-contours.md §10
pnpm pilot:pack       # tarball-пілот: гейти A/C/SB/D/IP + CLI/TOOL — БЕЗ БД (Gate B відсутній)
pnpm pilot            # той самий пілот + Gate B проти живої БД: DATABASE_URL і
                      # BETTER_AUTH_SECRET із .env.local; назви товарів Gate B бере прямим SQL
                      # (HTTP-API до БД у контракті v2 немає)
pnpm template:sync    # синк закомічених копій з монорепо, ТРИ цілі: template/ скаффолдера,
                      # packages/cli/host/ (канон host-файлів для simplycms update),
                      # packages/simplycms/migrations/ (для simplycms db:diff) — усі під парність-тестом
pnpm gates            # ПОВНИЙ ланцюг гейтів + pilot; чисте дерево; штамп .gates-stamp.json
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
pnpm db:showcase      # ВІТРИННИЙ стенд для ручного тесту: db:demo + наповнення (8 розділів і
                      # 33 товари з PNG-зображеннями, два типи цін, залишки у двох точках,
                      # адресна доставка, власник і другий адмін, 18 покупців, категорія VIP і
                      # знижки, 40 замовлень за 30 днів, схвалені відгуки). Пише через доменні
                      # ядра під withActor (С-12), детермінований (фіксований seed PRNG).
                      # 🔴 Обмеження (С-7/С-16): база ФІКСОВАНОГО імені simplycms_showcase на
                      # кластері PG_HARNESS_URL (ні параметра, ні env для імені). Вона ОДНОРАЗОВА:
                      # кожен запуск її перестворює, ручні зміни зникають. Право перестворити дає
                      # позначка COMMENT ON DATABASE 'simplycms:showcase'; чужу базу з таким
                      # іменем без позначки команда не чіпає (відмова з поясненням). Сам модуль
                      # сіду відмовляє на непорожній базі (users/orders), --force немає.
                      # Медіатека — .data/showcase-media (очищується кожним запуском).
                      # Друкує DATABASE_URL (app_runtime), BETTER_AUTH_SECRET (новий щоразу),
                      # MEDIA_ROOT і готову команду pnpm build && … pnpm start.
                      # 🔴 Паролі — ЛИШЕ ЛОКАЛКА (константи scripts/showcase/env.mts і people.mts):
                      # власник owner@showcase.test / showcase-owner-2026,
                      # менеджер manager@showcase.test / showcase-manager-2026,
                      # покупці buyer-01…18@showcase.test / showcase-buyer-2026
pnpm live:smoke       # живий прогін: db:demo → build → server → curl+SQL (gate-b) + Playwright
                      # (воронка, сховище, кроки адмінки в сесії власника). Потребує Postgres
                      # (PG_HARNESS_URL) і Chromium; не CI — гейти релізу окремим рішенням
                      # Журнал: .live-smoke/last.log (+ <timestamp>.log, 10 останніх); при FAIL — шлях і рядки FAIL наприкінці.
pnpm db:pull / db:diff
                      # Схема БД — див. docs/architecture/data-layer.md § «Міграції»
```

Команд `pnpm test:e2e` і `pnpm pilot:e2e` немає: прапорець `--e2e` падає з поясненням, а не
мовчки ігнорується. Генератора типів БД (`db:generate-types`, `types:baseline`) теж немає.

**Скіли TanStack для агента (локально, не в git).** Пакети `@tanstack/react-start` і
`@tanstack/virtual-file-routes` постачають власні скіли в `node_modules`. `.claude/skills/tanstack-*`
у `.gitignore`: лінки з абсолютними цілями (однієї машини) у репо не лежать, а тест
`tests/git-symlinks.test.ts` стереже, що їх там немає. Щоб підключити скіли, створи ВІДНОСНІ лінки:

```bash
ln -s ../../node_modules/@tanstack/react-start/skills/react-start .claude/skills/tanstack-react-start
ln -s ../../node_modules/@tanstack/virtual-file-routes/skills/virtual-file-routes .claude/skills/tanstack-virtual-file-routes
ln -s ../../node_modules/@tanstack/react-db/skills/react-db .claude/skills/tanstack-react-db
```

Лінки `tanstack-db-core`, `tanstack-db-meta-framework`, `tanstack-router-core`, `tanstack-start-core`,
`tanstack-start-server-core` не повертаються: скіли `db-*` жили в розпакованих тарболах у тимчасовій теці
(`@tanstack/db` у `node_modules` скілів не несе), а `*-core` — у транзитивних залежностях за шляхом
`.pnpm/<версія>/`, що змінюється з кожним бампом, тож стабільної відносної цілі в них немає. Скіл
`tanstack-react-db` є прямою залежністю; усі три лінки блоку вище — відносні.

## 3. Гейти (порядок і причини)

Порядок: `pnpm install --frozen-lockfile → format:check → lint → build → typecheck →
typecheck:showcase → test → test:schema → build:packages → typecheck:template → test:packaging`.

🔴 Повний ланцюг — `pnpm gates` (`scripts/gates.mjs`): ті самі гейти + повний `pilot` наприкінці, з
ЄДИНОГО переліку `scripts/release/gates.mjs` (його ж бере `pnpm release`; `tests/gates-chain.test.ts`
звіряє порядок з `AGENTS.md`). Відмовляє на брудному дереві, зупиняється на першому червоному гейті, пише
штамп `.gates-stamp.json` (git-ignored): `{ head, startedAt, finishedAt, gates: [{ name, ok, ms }] }` —
і при падінні, з тим, що встигло пройти. Звіт на СТОП посилається на штамп (head + усі `ok`).

- 🔴 `install --frozen-lockfile` — **перший** і не пропускається після будь-якої правки
  `package.json`: жоден інший гейт не звіряє `pnpm-lock.yaml` з манифестами, а звичайний
  `pnpm install` мовчки лагодить розсинхрон замість червоніти; у CI frozen — дефолт.
  Те саме робить будь-який `pnpm <script>` (supply-chain policy pnpm 11): тож мутацію lock для
  перевірки ратчета (`tests/no-supabase-manifests`) доводь через `npx vitest`, а не `pnpm test`.
- Гейт саме `format:check`, бо `pnpm format` (`prettier --write`) не червоніє.
- `build` іде **перед** `typecheck`, бо генерує `src/routeTree.gen.ts`.
- `typecheck:showcase` — одразу після `typecheck`: сід `db:showcase` біжить під `tsx`, який
  типів не перевіряє, а кореневий `tsconfig.json` не включає `scripts/showcase/*.mts`. Без
  гейта дрейф сигнатур ядер, якими пише сід, червонів би лише на живому запуску.
- `test:schema` у ланцюгу, бо він єдиний перевіряє накат канону міграцій і ПОВЕДІНКУ RLS —
  інші гейти схему БД не виконують.
- 🔴 Гейти `test`, `test:schema`, `test:packaging` **ізольовані від `.env*` розробника**: усі три
  vitest-конфіги мають `envDir: false` (штатний вимикач Vite — Vite shared-options `envDir`),
  інакше `VITE_*` з `.env.local` робили б гейт зеленим лише локально й червоним у CI. Проєкт `pg`
  отримує фіксований `VITE_SITE_URL=http://store.test` у `test.env`. Ключі стенду (`HARNESS_SMTP_URL`,
  `HARNESS_MAILPIT_URL`, `S3_*`, `PG_HARNESS_URL`) беруться з env, а `.env.harness` — лише запасний
  шлях. Доводить `tests/gate-env-isolation.test.ts` (пробна `.env.local` у tmp-корені) і
  `tests/harness-env.test.ts`.
- `test:packaging` іде **після** `pnpm test` і `build:packages`: `tests/published-exports-parity.test.ts`
  виведено з дефолтного прогону (`test.exclude`), він працює по зібраних tarball-ах.
- 🔴 `typecheck:template` — окремий гейт **після** `build:packages`: кореневий `tsconfig.json`
  ВИКЛЮЧАЄ `packages/create-simplycms-store/template` (його імпорти резолвляться з `node_modules`
  магазину), тож `pnpm typecheck` шаблону не бачить. Гейт типізує шаблон проти зібраного `dist`
  (те саме, що бачить магазин). Список файлів під ним стереже
  `tests/template-typecheck-coverage.test.ts`.
- Гейти РЕЛІЗУ (`scripts/release/gates.mjs`) після `test:packaging` ганяють ще ПОВНИЙ `pilot`
  (`scripts/release/pilot-full.mjs`: `pnpm harness:up` + `db:demo` → `pnpm pilot`, Docker потрібен):
  Gate C — межа клієнт/сервер у реальному клієнтському бандлі, Gate SB — драйвер БД не вклеєний у
  серверний бандл, Gate IP — витік ВАЛИТЬ збірку, Gate B — серверний бандл стартує. `pilot:pack`
  (без БД) ганяється в CI (job `packaging`).
- Гейти-звірки з уроків Е6д (усі в `pnpm test`, кожен із негативним контролем у самому тесті):
  `tests/upstream-tripwires.test.ts` — передумови обходів реєстру `upstream-workarounds.md`
  (текст встановлених модулів, версії, SQL білдера Drizzle) і парність маркерів
  `UPSTREAM:<ID>` ↔ записів реєстру; `tests/doc-symbols-exist.test.ts` — кожен символ у
  зворотних лапках у `docs/architecture`, `docs/development`, README пакетів і скілах ВИЗНАЧЕНИЙ
  у продакшн-коді (згадка в коментарі чи назві тесту не рахується). 🔴 Згадку СКАСОВАНОГО
  символу в доці позначай БЕЗПОСЕРЕДНЬО після нього дужкою: «`sym` (знесено)» або
  «`sym` (замінено …)» — маркер діє лише на цей символ, без маркера він червоніє; сторонні API й приклади — запис у
  `DOC_SYMBOL_ALLOWLIST` з причиною (список лише скорочується, мертвий запис червоніє).
  `tests/server-fn-consumers.test.ts` — кожна `export const … = createServerFn(…)` має
  імпортера поза тестами й моками; виняток — `SERVER_FN_NO_CONSUMER_ALLOWLIST` з причиною.
- `prettier` — exact `3.9.6` у `devDependencies`; обидві команди покривають **увесь репозиторій**.
  Не форматується (`.prettierignore`): згенерований код (`src/routeTree.gen.ts`, Drizzle-схема і `drizzle/`), артефакти збірки і **всі `*.md`**
  (prettier ламає ручне вирівнювання таблиць і списків).

## 4. Лінт

🔴 **Норма: `pnpm lint` = 0 errors / 7 warnings.** Ворнінги — `react-hooks/*` і `no-unused-vars`.
Не «лагодити» число вгору чи вниз без причини.

Error-зони й кастомні правила (селектори й опції не послабляти; кожне має негативний контроль
тестом):

- **i18n-селектори** (`no-restricted-syntax`, error): новий кириличний рядок інтерфейсу валить лінт.
  Зона — host `src/`, обидві роут-теки ядра (`routes/storefront`, `routes/admin`),
  `src/storefront-routes`, `src/admin`, п'ять `src/*-ui` пакета ядра, компоненти тем. У
  `routes/admin` живий React-компонент `AdminPending` використовує `useT()` (ключ
  `admin.common.loading`).
- **`import.meta.env` у серверних модулях** (`no-restricted-syntax`, error): п'ять модулів
  env-контракту (`SERVER_ENV_FILES`) — `seo/robots`, `seo/sitemap`, `server/root`, `api/health.tsx`,
  `src/start.ts`. Негативний контроль — `tests/eslint-server-env.test.ts`.
- **Тір-зони напрямку шарів:** `eslint.tier-zones.mjs` + `eslint.tier-relative.mjs` забороняють
  імпорт угору по тірах усередині пакета ядра, бо межу `dependencies` після злиття пакетів не тримає
  ніщо. Негативний контроль — `tests/tier-boundary.test.ts`.
- **Контракт ключів кешу React Query** — `eslint-rules/query-key-from-entity.mjs`: літеральний
  перший сегмент `queryKey` (прямий, через константу-масив і в умовному виборі) заборонений;
  сегмент 0 іде з реєстру `simplycms/contracts/entities` (`ENTITY`/`AGGREGATE`/`SESSION_KEY`).
  Зона — `core/`, `*-ui/`, `react-query/`, `storefront-routes/`, `admin-data/`, `admin/` пакета
  ядра (адмінку додано в К3-Е7). Деталі —
  `docs/architecture/data-layer.md` § «Контракт ключів кешу».
- **Доступні імена контролів:** `jsx-a11y/label-has-associated-control` (error,
  `assert: 'htmlFor', depth: 3`) на п'яти теках воронки (`cart-ui`, `catalog-ui`, `checkout-ui`,
  `profile-ui`, `reviews-ui`) і в адмінці `src/admin/**` (з К3-Е7). Охоплення адмінки обома
  правилами доводить `tests/eslint-admin-zones.test.ts`. 🔴 Правило бачить лише `<label>` — контрол без лейбла йому
  невидимий: зелений лінт доступності воронки не доводить її повноти.
- **Ратчет проти `@supabase/*` — `simplycms-supabase/no-supabase-import`:** зона — ВСЕ репо
  (усі `*.{ts,tsx,mts,cts,mjs,cjs,js}`), без виїмок; ловить статичний `import`/`export…from`,
  динамічний `import()`, `require` і TS-форми. Код шаблону магазину в основний лінт не потрапляє —
  його, маніфести й `pnpm-lock.yaml` стереже `tests/no-supabase-manifests.test.ts`. Негативний
  контроль — `tests/eslint-rules/no-supabase-import.test.ts`.
- **Порт сховища — `simplycms-storage/no-direct-storage`:** зона — увесь `packages/simplycms/src/**`
  без виїмок (ратчет порожній: легасі `ReviewDetail.tsx` знесено в Е6д); забороняє `supabase.storage`,
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
| `workflow.yml` | `typecheck` | `install` → `format:check` → `build` → `typecheck` → `typecheck:showcase` → `lint` | push/PR/manual |
| `workflow.yml` | `test` | `install` → `test` | push/PR/manual |
| `workflow.yml` | `packaging` | `install` → `build:packages` → `typecheck:template` → `test:packaging` → `pilot:pack --skip-build` | push/PR/manual |
| `workflow.yml` | `schema` | `install` → `test:schema` (service-контейнер `postgres:17`) | push/PR/manual |
| `publish-packages.yml` | `publish` | гейт `NPM_TOKEN` → `install` → `build:packages` → `test:packaging` → `pnpm publish -r` | push у `main`, manual |

- `packaging` — окремий job, а не крок у `test`: parity-suite працює по tarball-ах і потребує
  зібраних `dist/` кожного пакета.
- 🔴 `pnpm pilot` (Gate B проти живої БД) у CI **не** ганяється: він потребує живої бази
  (`DATABASE_URL`), а це зовнішній стан, від дрейфу якого гейт червонів би без регресії коду. Прогін
  `pilot` перед релізом — гейт релізу (`pilot-full.mjs`), не CI.
- 🔴 `pnpm pilot:pack` (без БД) — крок job `packaging`: Gate C і Gate IP — єдиний поведінковий доказ
  межі клієнт/сервер у реальному магазині з tarball-ів. Передрелізний гейт у CI —
  детерміністичний tarball-parity плюс `pilot:pack --skip-build`.

Реліз пакетів — `docs/architecture/release-process.md`.
