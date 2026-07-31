# Фаза 1 «Пілот пакування + production-готовність» + fix-пакет ревʼю Фази 0 — план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрити 6 підтверджених знахідок ревʼю Фази 0 (Етап 0) і виконати Фазу 1 роадмапу: магазин, зібраний зі **справжніх npm-tarball-ів** усіх пакетів ядра, проходить смок; `pnpm start` працює; `sitemap.xml`/`robots.txt` віддаються в production (spec §16 Фаза 1, gates §15).

**Architecture:** Етап 0 — точкові фікси з TDD (кожен зелений + коміт). Етап 1 — пакувальність УСІХ runtime-пакетів магазину (включно з ui/admin/core-фасадом — відомий блокер з червня) + `npm pack`-пілот у чистому скретч-магазині з чотирма gate-ами. Етап 2 — server preset (`pnpm start`). Етап 3 — production SEO-роути через custom server entry (існуюча задача). Етап 4 — живі браузерні смоки боргів Фази 0. Порядок 2→3 жорсткий (SEO-entry залежить від обраного preset).

**Tech Stack:** як у Фазі 0 (pinned TanStack, Vite 8, tsup, Vitest 4) + `npm pack`/verdaccio-free локальний пілот, chrome-devtools для смоків.

## Global Constraints

- Ті самі, що у плані Фази 0 (strict TS, коментарі укр., ≤150 рядків, DI-only supabase, git grep, гейти `format:check → lint → build → typecheck → test` після КОЖНОГО завдання → коміт).
- Нічого не публікувати на npmjs у цій фазі — пілот виключно локальними tarball-ами (`npm pack`). Реліз — Фаза 2.
- Правки коду поза скоупом знахідок/фази — заборонені (не «поліпшувати попутно»).

**Зафіксовані відкладення (не прогалини):** повна i18n-міграція (~954 warn) — окремий трек; `@simplycms/engine`-обʼєднання — Фаза 1+ за спекою §4.0 (НЕ в цьому плані); релізний CI на npmjs (`NPM_TOKEN`) — Фаза 2.

---

## Етап 0 — Fix-пакет ревʼю Фази 0 (6 знахідок)

### Task 0.1: [major] Помилки Supabase не ковтаються — хуки головної + SSR-loader

**Files:**
- Modify: `packages/simplycms/storefront-routes/src/pages/home/queries.ts` (4 хуки, рядки ~36-114)
- Modify: `packages/simplycms/storefront/src/loaders/home.ts` (`Promise.all`, рядки ~40-68)
- Test: Create `packages/simplycms/storefront-routes/src/__tests__/home-queries-errors.test.tsx`; Modify `packages/simplycms/storefront/src/loaders/__tests__/…` (якщо тек немає — створити поруч із loader)

- [ ] **Step 1 (TDD, хуки):** тест з мок-клієнтом, що повертає `{ data: null, error: { message: 'RLS violation' } }` для кожного з 4 хуків (`useFeaturedProducts`, `useNewProducts`, `useRootSections`, `useSectionProducts`): очікування — `isError === true` (зараз буде `isSuccess:true, data:[]` — тест червоний). Патерн мок-клієнта — як у наявному `bootstrap.test.ts`.
- [ ] **Step 2:** у кожному queryFn: `const { data, error } = await …; if (error) throw error;` (канон `data-access.instructions.md:37-38`, як у `Catalog.tsx:90`). Тест зелений.
- [ ] **Step 3 (TDD, loader):** unit-тест `loadHomePageData` з моком, де ОДИН із запитів `Promise.all` повертає `error`: очікування — функція **кидає** (зараз мовчки віддає порожні масиви). Фікс: після `Promise.all` перевірити `.error` кожного з 4 результатів, кинути перший знайдений.
- [ ] **Step 4:** гейти → коміт: `fix(home): помилки Supabase більше не ковтаються (хуки + loader) — ревʼю Фази 0`.

### Task 0.2: [major] N+1 на головній — серверний префетч + initialData

**Files:**
- Modify: `packages/simplycms/storefront/src/loaders/home.ts` (+ секційні товари в `Promise.all`)
- Modify: `packages/simplycms/storefront-routes/src/pages/home/queries.ts` (`useSectionProducts` приймає `initialData`), `.../pages/Home.tsx`, `.../pages/home/SectionProductCarousel.tsx` (проброс), route `_storefront/index.tsx` (loader-дані вже течуть — перевірити форму)
- Test: Create `.../src/__tests__/home-n-plus-one.test.tsx`

**Рішення (зафіксоване):** per-section `limit(8)` неможливий одним PostgREST-запитом без RPC, тому N запитів **лишаються, але переїжджають на сервер** — у `loadHomePageData` додається `Promise.all(rootSections.map(s => products…eq('section_id', s.id).limit(8)))` (паралельно, один SSR-батч, з перевіркою `.error` за Task 0.1); результат їде в route-loader-дані → `useSectionProducts(section, { initialData })` + `staleTime: 60_000`. Клієнтські запити при гідрації зникають. (RPC з `row_number()` — пізніша оптимізація, поза скоупом.)

- [ ] **Step 1 (TDD):** тест: рендер 3 × `SectionProductCarousel` з переданими `initialData` → spy мок-клієнта: **0** викликів `.eq('section_id', …)` (зараз 3 — червоний; репро-патерн уже відпрацьований скептиком ревʼю).
- [ ] **Step 2:** реалізація за рішенням вище; `queryKey` не міняти (`['section-products', section.id]`).
- [ ] **Step 3:** SSR-перевірка: `curl -s localhost:3000/ | grep` — назва товару з секційної каруселі присутня в HTML (бонус рішення: каруселі тепер у SSR).
- [ ] **Step 4:** гейти → коміт: `fix(home): N+1 усунено — секційні товари префетчаться в SSR-loader (ревʼю Фази 0)`.

### Task 0.3: Дрібні фікси (4 minor одним завданням)

**Files:** `packages/simplycms/core/src/index.ts` (видалити мертвий блок «Supabase Client (DI)» ~91-100; залежність `@simplycms/supabase` у package.json НЕ чіпати — її використовують ~12 файлів core); `.github/instructions/data-access.instructions.md:129` (`core/src/supabase/` → `packages/simplycms/supabase/src/`); `.github/instructions/tooling.instructions.md:43-46` (додати `supabase`, `i18n`, `storefront-routes` у «повний перелік» аліасів); `.env.example` (+`DATABASE_URL=` з приміткою «лише для pnpm db:pull/diff/dump-rls; session pooler»); `packages/simplycms/schema/package.json` (+`dependencies: dotenv, pg` — зараз фантомні з кореня).

- [ ] **Step 1:** внести всі 5 правок; `git grep -n "core/src/supabase"` → 0.
- [ ] **Step 2:** гейти → коміт: `chore(review): 4 minor-знахідки ревʼю Фази 0 (мертвий re-export, доки, env, deps)`.

---

## Етап 1 — Пакувальність усіх пакетів + npm-pack пілот

### Task 1.1: Розвʼязати `@simplycms/db-types` (блокер пакування core/admin)

Аліас `@simplycms/db-types` → **host-файл** `supabase/types.ts` — пакет, що його імпортує, непакований в принципі.

**Files:** усі споживачі (`git grep -l "@simplycms/db-types"`), `packages/simplycms/supabase/src/index.ts` (канонічний re-export `Database`/`Json` вже є — `./database`), `tsconfig.json`/`vite.config.ts`/`vitest.config.ts` (видалити аліас db-types).

- [ ] **Step 1:** інвентар: `git grep -rn "@simplycms/db-types" -- ':!node_modules'` → список споживачів; замінити всі на `import type { Database, Json } from '@simplycms/supabase'` (типи вже ре-експортуються з `src/database.ts`).
- [ ] **Step 2:** синхронізація генерата: `db:generate-types` пише в `supabase/types.ts` (host) — додати у скрипт копіювання/ре-експорт: `packages/simplycms/supabase/src/database.ts` має бути **єдиним** джерелом для пакетів (рішення: database.ts = `export * from '../../../../supabase/types'`? НІ — це знову host-звʼязка. Правильно: генератор пише ОДРАЗУ в `packages/simplycms/supabase/src/database.ts`, а host `supabase/types.ts` видаляється; `scripts`/`db-migrate.mjs` оновити ціль). Виконати саме так.
- [ ] **Step 3:** видалити аліас з трьох конфігів; `git grep "db-types"` → 0; гейти → коміт: `refactor(types): Database-типи живуть у @simplycms/supabase — аліас db-types знято`.

### Task 1.2: Build-конфіги + publishConfig для решти пакетів

**Files:** `packages/simplycms/{supabase,i18n,schema,storefront-routes,admin-routes,theme-system,plugin-system,ui,admin,core,cart-ui,catalog-ui,checkout-ui,profile-ui,reviews-ui}/…` — `tsup.config.ts`, `package.json` (`build`, `private:false` де публікується, `publishConfig` з dist-exports дзеркалом dev-exports, registry `https://registry.npmjs.org`), root `build:packages` filter вже `@simplycms/*`.

- [ ] **Step 1:** для кожного пакета — tsup за зразком наявних шести (esm+dts, `splitting:false`, `external` на сиблінгів); **route-пакети:** тека `routes/` копіюється в dist **as-is** (це вихідні route-файли для генератора host-а, не бандл) — `publishConfig.exports` `./routes/*` → `./dist/routes/*`… СТОП: генератор сканує `.tsx`-файли — вони мають лишатись сирими. Рішення: `files: ["dist","src","routes"]`, publish-exports `./routes/*` → `./routes/*` (сирці), решта subpath → dist. Зафіксувати це в README пакета.
- [ ] **Step 2:** розширити `tests/published-exports-parity.test.ts` на ВСІ пакети з `publishConfig` (зараз 6) — кожен subpath dev↔publish 1:1 і target-файл існує після `build:packages`.
- [ ] **Step 3:** `pnpm build:packages` — зелений для всіх; гейти → коміт: `feat(packaging): build+publishConfig для всіх пакетів ядра, parity-тест розширено`.

### Task 1.3: npm-pack пілот — скретч-магазин зі справжніх tarball-ів

**Files:** Create `scripts/pilot-pack.mjs` (оркестрація) + `tests/pilot/` (шаблон скретч-магазину: package.json, simplycms.config.ts, routes.ts, src/{__root,router,start,client}, .env з дев-ключами — копія host-файлів монорепо).

- [ ] **Step 1:** `pilot-pack.mjs`: `pnpm build:packages` → `npm pack` кожного пакета в `/tmp/simplycms-pilot/tarballs/` → генерує скретч-магазин у `/tmp/simplycms-pilot/store/` → `package.json` магазину посилається на tarball-и (`"@simplycms/objects": "file:../tarballs/…tgz"`, workspace-зв'язки між tarball-ами через overrides) → `npm install` (САМЕ npm, не pnpm — інший linker ловить більше) → `npx vite build`.
- [ ] **Step 2 (gate A — маршрути з node_modules):** перший запуск `physical()` на СПРАВЖНІЙ `node_modules` — build генерує routeTree зі шляхами в node_modules, всі 65+ роутів на місці (`grep -c createFileRoute` / порівняння множини id з монорепо).
- [ ] **Step 3 (gate B — server functions, баг TanStack #7213):** `node …/server/index.mjs` (або dev) у скретчі → HTTP-запити: `/` (200, HTML з даними), `/catalog` (назви+ціни — server fn відпрацювала з пакета), `/admin` (редірект guard).
- [ ] **Step 4 (gate C — bundle-guard):** у клієнтських чанках скретч-збірки немає server-only коду: `grep -r "createServerClient\|service_role\|getRequestHeader" dist/client/assets` → 0.
- [ ] **Step 5 (gate D — Tailwind):** HTML/CSS скретча містить стилі компонентів пакетів (перевірка класу з `@simplycms/ui` у зібраному css); якщо ні — `@source`-директиви в globals.css шаблону (зафіксувати в скаффолд-шаблоні).
- [ ] **Step 6:** пілот повторюваний однією командою `node scripts/pilot-pack.mjs`; додати CI-джобу `pilot` (workflow_dispatch + weekly cron — не на кожен PR, дорого). Гейти → коміт: `feat(packaging): npm-pack пілот — магазин зі справжніх tarball-ів проходить gates A-D`.

---

## Етап 2 — Server preset: робочий `pnpm start`

### Task 2.1

**Files:** `vite.config.ts`, `package.json` (`start`), можливо `src/server.ts` (див. Етап 3 — створюється там).

- [ ] **Step 1 (verify-first, як з virtualRouteConfig у Фазі 0):** зʼясувати актуальний механізм у **встановленій** версії: `grep -rn "target\|preset\|nitro" node_modules/@tanstack/react-start/dist/*.d.ts node_modules/@tanstack/start-plugin-core/dist/esm/*.d.ts | head` + типи `TanStackStartInputConfig`; двома кандидатами є `tanstackStart({ target: 'node-server' })` і nitro-опції — обрати те, що є в типах, НЕ по памʼяті.
- [ ] **Step 2:** налаштувати; `pnpm build` → зʼявляється самостійний server-артефакт; `pnpm start` (оновити скрипт на фактичний шлях) → сервер слухає, `/`, `/catalog`, `/sitemap-заглушка` відповідають.
- [ ] **Step 3:** задокументувати в CLAUDE.md (Quick Reference: start працює; deploy-нотатка). Гейти → коміт: `feat(server): production server target — pnpm start працює`.

---

## Етап 3 — Production `sitemap.xml`/`robots.txt`

За задачею [`docs/tasks/production-seo-routes-tanstack-start.md`](../../tasks/production-seo-routes-tanstack-start.md) (вимоги/антипатерни там; Clarify-рішення фіксуються тут).

**Рішення Clarify:** cache-headers — ТАК одразу (`Cache-Control: public, max-age=3600, stale-while-revalidate=86400`); склад sitemap — поточний домен без розширення (properties-лендинги додасть SEO-трек); dev-plugin — прибрати повністю після переходу (варіант A).

### Task 3.1

**Files:** Create `src/server.ts` (custom entry: intercept `/sitemap.xml`|`/robots.txt` → нативний Response, решта → `createStartHandler(defaultStreamHandler)`); Modify `vite.config.ts` (підключення entry за механізмом обраного preset; видалити `seoRoutesPlugin` з plugins), `packages/simplycms/storefront-routes/src/seo/plugin.ts` → видалити (builders `sitemap.ts`/`robots.ts` лишаються); Test: `tests/seo-endpoints.test.ts` (unit на інтерсептор: правильний content-type, cache headers, делегація).

- [ ] **Step 1 (TDD):** тест інтерсептора (фабрика `createSeoInterceptor(builders)` — pure, тестується без сервера): `/sitemap.xml` → 200 xml + cache header; `/robots.txt` → 200 text; `/інше` → null (делегація).
- [ ] **Step 2:** реалізація + wiring у server entry; `pnpm build && pnpm start` → `curl localhost:3000/sitemap.xml` містить `<urlset`, `curl /robots.txt` містить `Disallow: /admin/`; у dev (`pnpm dev`) — ті самі URL працюють (через entry або еквівалентний dev-хук — однакова поведінка всіх середовищ, вимога задачі).
- [ ] **Step 3:** видалити dev-plugin; задачу `production-seo-routes-tanstack-start.md` перенести в стан «виконано» (видалити файл, відмітивши в роадмапі — політика «тільки актуальне»). Гейти → коміт: `feat(seo): production sitemap/robots через custom server entry; dev-plugin знято`.

---

## Етап 4 — Живі браузерні смоки (борги Фази 0)

### Task 4.1 (виконує сесія з browser-tools; якщо недоступно — чекліст власнику)

- [ ] **Step 1:** `pnpm dev` + браузер: перемикання теми в `/admin/themes` → шапка/токени змінились без помилок консолі.
- [ ] **Step 2:** логін → `/profile` рендериться на `ProtectedShell` (бічна навігація, sign-out працює).
- [ ] **Step 3:** `/admin/plugins` → `hello-world` зʼявився (upsert під адмін-сесією — перевірити рядок у таблиці) → увімкнути → віджет на дашборді БЕЗ reload → вимкнути → зник.
- [ ] **Step 4:** зняти відповідні пункти з «Боргів» роадмапу. Коміт: `docs(roadmap): живі смоки Фази 0 закрито`.

---

## Етап 5 — Фініш фази

- [ ] Роадмап: чекбокси Фази 1; CLAUDE.md — секції Commands/Structure під фактичний стан (start, пілот, db-types); memory-нотатка.
- [ ] DoD Фази 1 (spec §16): «магазин із tarball-ів проходить smoke-e2e; деплой можливий» — фінальний прогін `node scripts/pilot-pack.mjs` + `pnpm start` + гейти. Коміт: `chore(phase1): Фаза 1 завершена`.

---

## Self-review

- Покриття: 6/6 знахідок ревʼю → Етап 0; роадмап Фази 1 (пілот+gates → 1.3; parity → 1.2; server preset → 2; sitemap/robots → 3) — повне; борги смоків → 4.
- Ризики названі в місці виконання: db-types единое джерело (1.1 Step 2 — рішення зафіксоване, не «або-або»); сирі routes/ у tarball (1.2 Step 1); механізм preset — verify-first (2.1); N+1-рішення обґрунтоване з відхиленою альтернативою (0.2).
- Залежності: 1.1 → 1.2 → 1.3; 2 → 3; Етап 0 і 4 незалежні від 1-3 (0 — перший, бо чіпає код, який пакується в 1.3).
