# Фаза 1 «Пілот пакування + production-готовність» + fix-пакет ревʼю Фази 0 — план (v2, після Codex-аудиту)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрити 6 знахідок ревʼю Фази 0; зробити всі пакети ядра пакованими; отримати production-запуск (`pnpm start`) з робочими `sitemap.xml`/`robots.txt`; довести пілотом, що магазин зі **справжніх tarball-ів** працює (spec §16 Фаза 1, gates §15).

**Architecture (порядок виправлено аудитом):** Етап 0 (фікси) → Етап 1 (пакувальність: типи/exports-аудит/deps-аудит/build+tarball-parity) → **Етап 2 (production server entry + SEO — ДО пілота, бо Gate B пілота потребує production-запуску)** → Етап 3 (npm-pack пілот повним fixture) → Етап 4 (2 remediation-фікси + браузерні смоки) → Етап 5 (фініш + повторний пілот як DoD).

**Tech Stack:** як у Фазі 0; пакування — **`pnpm pack`** (застосовує `publishConfig` і підставляє версії замість `workspace:*` — на відміну від `npm pack`); node-runner для fetch-handler; chrome-devtools для смоків.

## Global Constraints

- Ті самі, що у Фазі 0 (strict TS, укр. коментарі, ≤150 рядків, DI-only, `git grep` **scoped до коду/конфігів — `':!docs' ':!*.md'`** де перевіряється «нуль згадок», гейти → коміт після кожного завдання).
- Нічого не публікувати на npmjs — пілот локальними tarball-ами. Реліз — Фаза 2.
- Правки поза скоупом знахідок/фази — заборонені.

**Зафіксовані відкладення:** повна i18n-міграція; `@simplycms/engine`; релізний CI (`NPM_TOKEN`) — Фаза 2; RPC-оптимізація секційних запитів головної.

---

## Етап 0 — Fix-пакет ревʼю Фази 0

### Task 0.1: [major] Помилки Supabase не ковтаються — хуки + loader

**Files:** Modify `packages/simplycms/storefront-routes/src/pages/home/queries.ts` (4 хуки), `packages/simplycms/storefront/src/loaders/home.ts`; Test: Create `packages/simplycms/storefront-routes/src/__tests__/home-queries-errors.test.tsx`, `packages/simplycms/storefront/src/loaders/__tests__/home-loader.test.ts`.

- [ ] **Step 1 (TDD, хуки):** мок-клієнт повертає `{data:null, error:{message:'RLS violation'}}` для кожного з 4 хуків → очікування `isError === true` (зараз червоно: `isSuccess:true, data:[]`). Патерн мока — з `bootstrap.test.ts`.
- [ ] **Step 2:** у кожному queryFn `const { data, error } = …; if (error) throw error;` (канон `data-access.instructions.md:37`). Зелено.
- [ ] **Step 3 (TDD, loader):** тест `loadHomePageData`: будь-який з 4 запитів `Promise.all` повертає `error` → функція **кидає**. Фікс: перевірка `.error` кожного результату.
- [ ] **Step 4:** гейти → коміт: `fix(home): помилки Supabase більше не ковтаються (хуки + loader)`.

### Task 0.2: [major] N+1 на головній — серверний префетч + initialData

**Files:** Modify `packages/simplycms/storefront/src/loaders/home.ts`, `packages/simplycms/storefront-routes/src/pages/home/queries.ts` (`useSectionProducts(section, opts?)`), `.../pages/Home.tsx`, `.../pages/home/SectionProductCarousel.tsx`, route `_storefront/index.tsx`; Test: Create `.../__tests__/home-n-plus-one.test.tsx` + доповнити `home-loader.test.ts`.

**Зафіксований двофазний алгоритм loader-а:** фаза 1 — наявний `Promise.all` (banners/featured/new/**sections**); фаза 2 — `Promise.all(rootSections.map(s => products.select(…).eq('section_id', s.id).limit(8)))`; результат — **мапа `sectionId → HomeProduct[]`** у поверненні loader-а; помилка БУДЬ-ЯКОГО секційного запиту → reject (за Task 0.1). Per-section `limit(8)` одним запитом PostgREST не вміє — N паралельних запитів свідомо переїжджають на сервер (один SSR-батч); RPC — пізніша оптимізація.

- [ ] **Step 1 (TDD, loader):** тест: 3 секції у фазі 1 → рівно 3 виклики `.eq('section_id', …)` з `.limit(8)` у фазі 2; повернення містить мапу з ключами всіх трьох; помилка одного секційного запиту → reject.
- [ ] **Step 2 (TDD, клієнт):** рендер 3 × `SectionProductCarousel` з `initialData` з мапи → spy: **0** клієнтських викликів `.eq('section_id', …)` (зараз 3).
- [ ] **Step 3:** реалізація: loader + `useSectionProducts(section, { initialData, staleTime: 60_000 })`, `queryKey` незмінний; проброс route → `Home` → карусель.
- [ ] **Step 4:** SSR-підтвердження: `curl -s localhost:3000/ | grep "<назва товару секційної каруселі>"` → знайдено. Гейти → коміт: `fix(home): N+1 усунено — секційні товари в SSR-loader`.

### Task 0.3: Дрібні фікси (4 minor + env-матриця)

**Files:** `packages/simplycms/core/src/index.ts` (видалити мертвий блок «Supabase Client (DI)» ~91-100; deps НЕ чіпати); `.github/instructions/data-access.instructions.md` (рядок ~129 → `packages/simplycms/supabase/src/`; **+ env-матриця**: `SUPABASE_PROJECT_ID`+`SUPABASE_ACCESS_TOKEN` → `db:generate-types`/`db:migrate`; `DATABASE_URL` → `db:pull`/`db:diff`/`db:dump-rls`); `.github/instructions/tooling.instructions.md` (аліаси += `supabase`,`i18n`,`storefront-routes`; та сама env-матриця в розділі env); `.env.example` (+`DATABASE_URL=` з приміткою «session pooler; лише db:pull/diff/dump-rls»); `packages/simplycms/schema/package.json` (+`dependencies: dotenv, pg`).

- [ ] **Step 1:** всі правки; контроль: `git grep -n "core/src/supabase" -- ':!docs'` → 0.
- [ ] **Step 2:** гейти → коміт: `chore(review): minor-знахідки ревʼю + env-матриця в інструкціях`.

---

## Етап 1 — Пакувальність усіх пакетів

### Task 1.1: Типи БД — baseline у пакеті, генерація лишається host-owned

**Рішення (виправлене аудитом — spec: типи магазину host-owned, бо включають плагінні таблиці):** `packages/simplycms/supabase/src/database.ts` = **закомічений baseline типів core-схеми** (snapshot; оновлюється разом із core-міграціями — правило в README пакета). Host `supabase/types.ts` **лишається** генерованою ціллю `db:generate-types` (повні типи магазину: core + плагіни). Пакети типізуються проти baseline; host-код може використовувати свій повний файл. Аліас `@simplycms/db-types` знімається.

**Files:** Modify: споживачі `@simplycms/db-types` (`git grep -l`), `tsconfig.json`/`vite.config.ts`/`vitest.config.ts` (зняти аліас), `packages/simplycms/supabase/src/database.ts` (заповнити baseline поточним генератом), `packages/simplycms/supabase/README.md` (правило оновлення baseline), `.prettierignore` (+`packages/simplycms/supabase/src/database.ts` — генерат).

- [ ] **Step 1:** скопіювати поточний `supabase/types.ts` → `database.ts` пакета (зараз БД не має плагінних таблиць, крім `plg_*`-відсутніх — baseline = повний поточний генерат; зафіксувати в README, що плагінні таблиці в baseline не входять ніколи).
- [ ] **Step 2:** усі імпорти `@simplycms/db-types` → `import type { Database, Json } from '@simplycms/supabase'`; зняти аліас із 3 конфігів; `git grep "db-types" -- ':!docs'` → 0.
- [ ] **Step 3 (generic-місток до host-типів):** фабрики й Provider параметризувати: `createServerSupabase<Db extends Database = Database>()`, `createBrowserSupabase<Db …>()`, `SupabaseProvider<Db>`/`useSupabaseClient<Db>()` — host, що має плагінні таблиці, підставляє СВІЙ згенерований `Database` з `supabase/types.ts` у точках створення клієнтів (`engine.shared.ts`, `start.ts`); пакети всередині лишаються на baseline. Тест: host-типізований клієнт компілюється з `.from('<таблиця з host-типів>')`.
- [ ] **Step 4 (процедура оновлення baseline):** README пакета: «baseline регенерується ПІСЛЯ кожної core-міграції: `pnpm db:generate-types` на еталонній dev-БД без плагінів → копія в `packages/simplycms/supabase/src/database.ts`»; додати npm-скрипт `types:baseline` (копіювання + prettier-ignore перевірка). Оновити згадки в `supabase/scripts/update-types.mjs` (коментар про два файли), `tooling.instructions.md`, `CLAUDE.md`.
- [ ] **Step 5:** гейти → коміт: `refactor(types): baseline у @simplycms/supabase + generic-місток до host-типів; аліас db-types знято`.

### Task 1.2: Consumed-subpath аудит exports

Реальні споживачі використовують subpath-и, відсутні в `exports` (мінімум: `@simplycms/plugins/PluginSlot`, `@simplycms/plugins/types`, `@simplycms/core/providers/CMSProvider`) — у монорепо це працює через vite-аліаси, при справжньому resolve буде `ERR_PACKAGE_PATH_NOT_EXPORTED`.

**Files:** Create `scripts/audit-exports.mjs`; Modify `packages/simplycms/*/package.json` (додати відсутні exports).

- [ ] **Step 1:** скрипт: зібрати всі імпорт-специфікатори `@simplycms/<pkg>/<subpath>` по репо (`git grep -oE`) → для кожного перевірити наявність ключа в `exports` відповідного manifest → вивести відсутні. Прогнати, отримати повний список.
- [ ] **Step 2:** додати відсутні exports (dev=src) у manifests; скрипт → 0 відсутніх; підключити скрипт до `pnpm test` (або окремий vitest-тест, що його викликає) — гейт назавжди.
- [ ] **Step 3:** гейти → коміт: `fix(packaging): exports покривають усі реально споживані subpath-и (audit-exports гейт)`.

### Task 1.3: Deps-graph аудит manifest-ів

Імпорти пакетів не збігаються з `dependencies`/`peerDependencies` (мінімум: `core` не декларує `objects` і `themes`; `plugin-system` не декларує `objects`).

**Files:** Create `scripts/audit-deps.mjs`; Modify manifests за результатом.

**Обсяг аудиту (повний, за аудитом):** для кожного пакета сканувати **всі publish-roots** (`src/` **і** `routes/`), збирати **всі bare-імпорти** — і `@simplycms/*`, і зовнішні (`@tanstack/*`, `@tiptap/*`, `lucide-react`, `zod`, `@supabase/*`, …; приклад розриву: `admin` імпортує router/Tiptap/lucide/zod, а manifest їх не декларує). Кожен зовнішній класифікується: **peers** — react/react-dom/@tanstack/react-router/react-start/react-query/@supabase/* (один інстанс на host); **deps** — решта утиліт. Перевірка: множина bare-імпортів ⊆ deps∪peers.

- [ ] **Step 1:** скрипт + прогін → список розривів → додати відсутні deps/peers (`workspace:*` для сиблінгів).
- [ ] **Step 2:** підключити до тест-гейта (як 1.2). Гейти → коміт: `fix(packaging): manifest-deps покривають УСІ bare-імпорти обох publish-roots (audit-deps гейт)`.

### Task 1.4: Build + publishConfig для всіх пакетів; parity по TARBALL; окремий CI job

**Files:** `packages/simplycms/{supabase,i18n,schema,storefront-routes,admin-routes,theme-system,plugin-system,ui,admin,core,cart-ui,catalog-ui,checkout-ui,profile-ui,reviews-ui}/`: `tsup.config.ts` + `package.json` (`build`, `private:false`, `publishConfig` dist-дзеркало, registry npmjs); Rewrite `tests/published-exports-parity.test.ts`; Modify `.github/workflows/workflow.yml` (+job `packaging`).

- [ ] **Step 1:** tsup за зразком наявних шести (esm+dts, `splitting:false`, `external` сиблінги). **Route-пакети:** тека `routes/` їде в tarball **сирцями** (`files: ["dist","src","routes"]`, publish-export `./routes/*` → `./routes/*` без dist — генератор host-а сканує сирі `.tsx`); зафіксувати в README обох route-пакетів.
- [ ] **Step 2:** parity-тест v2 — працює по **tarball-ах**: `pnpm pack` кожного пакета у tmp → розпакувати manifest з `.tgz` → перевірити: (а) top-level exports = publish-варіант (pnpm pack застосував publishConfig — це і перевіряємо); (б) кожен export-target існує в tarball; (в) **нуль `workspace:`** у dependencies. Тест позначити як `packaging`-suite: у `vitest.config.ts` → `test.exclude += 'tests/published-exports-parity.test.ts'`; CI-job запускає його явно `vitest run tests/published-exports-parity.test.ts --config vitest.config.ts --no-file-parallelism` (потребує попереднього build).
- [ ] **Step 3:** CI: новий job `packaging` (окремо від test-job, який dist не має): `install → build:packages → vitest run tests/published-exports-parity.test.ts` — на PR/push. Гейти → коміт: `feat(packaging): build+publishConfig для всіх пакетів; tarball-parity; CI job packaging`.

---

## Етап 2 — Production server entry + SEO (ДО пілота)

### Task 2.1: Node-запуск fetch-handler-а

**Факти встановленої версії (з аудиту, звірити при виконанні):** `tanstackStart()` приймає `TanStackStartViteInputConfig`; кастомний вхід — `server.entry`; дефолтний entry (`@tanstack/react-start/dist/…/default-entry/server.ts`) експортує **fetch-handler** через `createServerEntry({ fetch })` — Node-listener збірка НЕ дає; чинний `start`-скрипт вказує на неіснуючий `.output/server/index.mjs`.

**Files:** Create `src/server.ts` (custom entry: `createServerEntry` + SEO-інтерсептор з Task 2.2), `server.mjs` (корінь: Node-runner — `node:http` сервер, який (а) віддає статику з `dist/client` (через `sirv` — додати dep exact), (б) решту передає у fetch-handler з `dist/server`); Modify `vite.config.ts` (`server: { entry: './src/server.ts' }` — точну форму звірити з `vite.d.ts`), `package.json` (`"start": "node server.mjs"`).

- [ ] **Step 1:** звірити типи: `sed -n '1,60p' node_modules/@tanstack/react-start/dist/esm/plugin/vite.d.ts` + default-entry — зафіксувати точні імена (`createServerEntry`, форма `server.entry`).
- [ ] **Step 2:** реалізація entry + runner; `pnpm build && pnpm start` → `curl localhost:3000/api/health` (наявний server route) → 200; `curl /` → HTML з даними; `curl /catalog` → назви товарів (SSR у production-запуску).
- [ ] **Step 3:** CLAUDE.md Quick Reference/deploy-нотатка. Гейти → коміт: `feat(server): production-запуск — server.entry + node-runner, pnpm start працює`.

### Task 2.2: `sitemap.xml`/`robots.txt` у production + чесні помилки builder-а

**Рішення Clarify (з задачі production-seo-routes):** cache-headers одразу (`Cache-Control: public, max-age=3600, stale-while-revalidate=86400` — тільки для 200); склад sitemap поточний; dev-plugin — видалити повністю.

**Files:** Modify `packages/simplycms/storefront/src/seo/sitemap.ts` (**+перевірка `.error` обох запитів → throw** — інакше кеш на годину зафіксує неповний sitemap як успіх); Create `packages/simplycms/storefront-routes/src/seo/interceptor.ts` (`createSeoInterceptor(builders): (req) => Response | null`) + тест; Modify `src/server.ts` (wiring: інтерсептор ПЕРЕД делегацією), `vite.config.ts` (видалити `seoRoutesPlugin`); Delete `packages/simplycms/storefront-routes/src/seo/plugin.ts`; Modify `.github/instructions/tooling.instructions.md` (рядок про `seoRoutesPlugin` у vite.config — прибрати), CLAUDE.md (те саме); Test: `tests/seo-endpoints.test.ts`.

- [ ] **Step 1 (TDD builder):** тест `buildSitemapXml`: помилка products-запиту → throw; помилка sections → throw (зараз мовчки статичні URL). Фікс.
- [ ] **Step 2 (TDD інтерсептор):** `/sitemap.xml` → 200 + `application/xml` + cache header; builder кинув → **500 без public cache**; `/robots.txt` → 200 text; будь-який інший шлях → `null`; **delegate-spy**: обгортка entry викликає fetch-handler рівно для не-SEO шляхів.
- [ ] **Step 3 (наскрізна перевірка трьох середовищ):** `pnpm dev` → curls `/sitemap.xml`, `/robots.txt`, `/`, `/catalog`; `vite preview` → ті самі; `pnpm build && pnpm start` → ті самі + `/api/health` (SSR-регресій немає — вимога source-задачі).
- [ ] **Step 4:** видалити dev-plugin; задачу `docs/tasks/production-seo-routes-tanstack-start.md` видалити з відміткою в роадмапі (політика «тільки актуальне»). Гейти → коміт: `feat(seo): production sitemap/robots у server entry; builder кидає на помилках; dev-plugin знято`.

---

## Етап 3 — npm-pack пілот (після Етапу 2 — Gate B потребує production-запуску)

### Task 3.1: Скретч-магазин зі справжніх tarball-ів + gates

**Files:** Create `scripts/pilot-pack.mjs` + `tests/pilot/store-template/` — **повний** host-fixture (перелік вичерпний, аудит: без цього route tree не згенерується): `package.json` (top-level deps: `@simplycms/{storefront-routes,admin-routes,admin,ui,themes,plugins,supabase,runtime,i18n,core,storefront,react-query,data-supabase,objects,domain}` + feature-ui + tanstack/react/vite — **через overrides-мапу всіх tarball-ів** (`file:`-транзитивність npm по імені не резолвить; це відома вада методу — статичну повноту manifest-deps гарантує Task 1.3, зафіксувати обидва факти коментарем у скрипті)), `vite.config.ts` (tanstackStart + virtualRouteConfig + tailwind, БЕЗ workspace-аліасів — у цьому суть пілота), `tsconfig.json`, `routes.ts`, `simplycms.config.ts`, `src/{routes/__root.tsx,routes/my/.gitkeep,router.tsx,start.ts,client.tsx,server.ts,engine-provider.tsx,engine.shared.ts,server/engine.ts,theme-registry.ts,styles/globals.css}`, `server.mjs`, `themes/default/**` (копія), `plugins/hello-world/**` (копія), `.env` (dev-ключі з `.env.local`).

- [ ] **Step 1:** `pilot-pack.mjs`: `pnpm build:packages` → `pnpm pack` кожного пакета → скопіювати template у `/tmp/simplycms-pilot/store` → підставити tarball-шляхи в overrides → `npm install` (саме npm — інший linker) → `npx vite build` → старт `node server.mjs` на вільному порту.
- [ ] **Step 2 (Gate A — роути з node_modules):** множина route-id зі скретч-`routeTree.gen.ts` **ідентична** множині з монорепо (63 id; точний set-diff, не grep по `createFileRoute` — його в генераті немає); імпорти в генераті ведуть у `node_modules/@simplycms/…`.
- [ ] **Step 3 (Gate B — production + server fns, #7213):** curls до запущеного скретч-сервера: `/` (200, назва товару), `/catalog` (назви+ціни — server fn з пакета в **production**-манифесті), `/admin` (guard-редірект), `/sitemap.xml`, `/robots.txt`, `/api/health`.
- [ ] **Step 4 (Gate C — bundle-guard + splitting, по модульному графу):** Vite manifest модулів НЕ містить — у vite.config скретча додається міні-плагін `emitBundleStats()` (hook `generateBundle`: пише `bundle-stats.json` = `{[chunkFileName]: Object.keys(chunk.modules)}`). Перевірки по stats: (а) жоден модуль з `server/`-тек пакетів і `server-client` не входить у клієнтські чанки; (б) initial-чанк `/` (entry + статичні імпорти за графом) не містить модулів `@simplycms/admin`, `@tiptap/*`, `recharts` (splitting-gate роадмапу).
- [ ] **Step 5 (Gate D — Tailwind):** зібраний CSS скретча містить утиліти компонентів пакетів (перевірка 2-3 класів з `@simplycms/ui`); фінальна візуальна перевірка — Етап 4 (браузер).
- [ ] **Step 6:** пілот однією командою; CI job `pilot` (workflow_dispatch + weekly): env скретча — з GitHub secrets `PILOT_SUPABASE_URL`/`PILOT_SUPABASE_KEY` (мапінг job-env → `.env` скретча в скрипті; `.env.local` в CI недоступний — задокументувати в workflow-коментарі; секрети створює власник). Гейти → коміт: `feat(packaging): npm-pack пілот — скретч-магазин з tarball-ів проходить gates A-D`.

---

## Етап 4 — Remediation + живі браузерні смоки

### Task 4.1: Тема — робоча інвалідація замість POST на неіснуючий роут

`Themes.tsx:41` постить на `/api/revalidate` (не існує з часів Next) і ігнорує відповідь; серверний кеш активної теми (5 хв TTL) ніхто не інвалідує → смок «перемкнув тему — вітрина оновилась» гарантовано падає.

**Placement (за аудитом — без забороненого ребра T5→T5 `admin → storefront-routes`):** інвалідація живе там, де кеш — **server route** `packages/simplycms/storefront-routes/routes/api/revalidate-theme.tsx` (POST; guard через `server/auth.isAdmin`, не-адмін → 403; викликає наявний `invalidateThemeCache()`); адмінка звертається **по HTTP** (`fetch('/api/revalidate-theme', {method:'POST'})`) — пакетної залежності не виникає.

**Files:** Create `packages/simplycms/storefront-routes/routes/api/revalidate-theme.tsx`; Modify `packages/simplycms/admin/src/pages/Themes.tsx` (замість мертвого `/api/revalidate` — новий endpoint, **перевірка `response.ok`**, toast при помилці); Test: guard-тест (без сесії/не-адмін → 403; адмін → 200 + кеш скинуто).

- [ ] **Step 1 (TDD)** → **Step 2** реалізація → **Step 3** гейти → коміт: `fix(themes): інвалідація кешу активної теми через auth-guarded server fn (замість мертвого /api/revalidate)`.

### Task 4.2: Плагін-toggle мутує registry, не лише БД

`Plugins.tsx:59` оновлює `plugins.is_active` напряму → `PluginSlot` (реагує на registry) не оновиться без reload.

**Files:** Modify `packages/simplycms/plugin-system/src/PluginLoader.ts` — **атомарний порядок** в `activatePlugin`/`deactivatePlugin`: спершу DB-update, і ТІЛЬКИ при успіху — мутація registry (зараз registry мутується до DB і без rollback — збій БД лишає «привидний» стан); Modify `packages/simplycms/admin/src/pages/Plugins.tsx` — toggle викликає ці функції (єдиний механізм); Test: розширення `slot-reactive.test.tsx` (toggle → слот без remount) + **failure-тести**: DB-помилка при activate → registry БЕЗ змін, стан toggle відкочено; те саме для deactivate.

- [ ] **Step 1 (TDD, включно з failure-кейсами)** → **Step 2** → гейти → коміт: `fix(plugins): атомарний activate/deactivate (DB → registry) — слоти оновлюються без reload, збій БД не лишає привидів`.

### Task 4.3: Живі браузерні смоки (борги Фази 0)

- [ ] **Step 1:** `pnpm dev` + браузер: `/admin/themes` перемикання → шапка/токени змінились (після Task 4.1 — без 404 у консолі).
- [ ] **Step 2:** логін → `/profile` на `ProtectedShell`; sign-out працює.
- [ ] **Step 3:** `/admin/plugins`: рядок `hello-world` є (upsert під адмін-сесією — звірити в БД) → увімкнути → віджет на дашборді **без reload** → вимкнути → зник.
- [ ] **Step 4:** зняти пункти з «Боргів» роадмапу. Коміт: `docs(roadmap): живі смоки Фази 0 закрито`.

---

## Етап 5 — Фініш

- [ ] Роадмап (чекбокси Фази 1), CLAUDE.md (start/пілот/типи/структура), memory-нотатка.
- [ ] **DoD (spec §16):** фінальний прогін `node scripts/pilot-pack.mjs` (всі gates зелені, включно з production-curls скретча) + гейти монорепо. Коміт: `chore(phase1): Фаза 1 завершена`.

---

## Changelog v3 (після другого кола: 5 знахідок — усі прийнято)

Blocker: deps-аудит розширено на обидва publish-roots і ВСІ bare-імпорти з
класифікацією deps/peers (T1.3). Major: generic-місток host-типів у supabase-пакеті
+ процедура оновлення baseline (T1.1 Steps 3-4); Gate C через emitBundleStats
(generateBundle → модульний граф), не manifest (T3.1); theme-remediation через
server route без ребра admin→storefront-routes, plugin-remediation з атомарним
порядком DB→registry і failure-тестами (T4.1/T4.2). Хвости: SUPABASE_ACCESS_TOKEN
у матриці, vitest.exclude для packaging-suite, secrets-мапінг weekly-пілота,
update-types.mjs/tooling/CLAUDE у списку T1.1.

## Changelog v2 (після Codex-аудиту: 16 знахідок — 15 прийнято, 1 частково)

Прийнято: №1 `pnpm pack`+tarball-parity (T1.4); №2 consumed-subpath аудит (T1.2); №3 повний fixture скретча (T3.1); №4 типи: baseline у пакеті + host-генерація лишається (T1.1 — рішення розвернуто за спекою); №5 deps-graph аудит + пояснення обмеження overrides (T1.3/T3.1); №6 порядок 1→2→3 + production-curls у скретчі (структура плану); №7 packaging-suite поза дефолтним test + окремий CI job (T1.4); №8 реальні API server.entry/`createServerEntry` + node-runner + `/api/health` (T2.1); №9 gates: route-id set-diff, manifest-based bundle/splitting-gate, 63 роути (T3.1); №10 двофазний loader-тест N+1 (T0.2); №11 sitemap-builder кидає + 5xx без cache (T2.2); №12 delegate-spy + три середовища (T2.2); №13 theme-remediation (T4.1); №14 plugin-toggle remediation (T4.2); №15 env-матриця (T0.3); №16 scoped greps + tooling/CLAUDE/.prettierignore у відповідних тасках.
Частково №5: скретч ставить всі tarball-и через overrides (обмеження `file:`-резолву npm), статичну повноту deps гарантує окремий гейт T1.3 — компроміс задокументований у скрипті.
