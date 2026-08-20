# План імплементації: трек К0 — консолідація пакетів 26 → 5 + доставка скілів

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.
>
> **Ревізія 2 (2026-08-20):** після незалежного аудиту Codex (21 знахідка,
> з них 7 блокерів) — усі знахідки вивірені вручну проти коду й враховані:
> конфлікт імені з root-манифестом, злиття manifest-ів/tsup-профілів,
> schema-тулінг поза src, фактичний вміст `core` (hooks/providers, НЕ
> фасад), template `routes.ts`/`tailwind.config.ts`, CLI-скоуп-припущення,
> реліз-скрипти, пілот-гейти, i18n-шляхи, ПК6-peer, порядок release-коміту.

**Goal:** Механічно консолідувати 26 npm-пакетів у 5 (unscoped фреймворк
`simplycms` + 4 сателіти) і перевести доставку агентних скілів на теку
`skills/` пакета з прямими симлінками — БЕЗ зміни поведінки, даних чи
контрактів рантайму.

**Architecture:** Чистий перенос: тіри T0→T5 стають теками
`packages/simplycms/src/*`, публічні входи — субшляхами exports-мапи за
правилом 1:1; дисципліна шарів переїжджає в eslint-зони з негативним
контролем. Скіл `redesign-from-reference` переїжджає байт-в-байт у
`skills/` пакета; магазини отримують його симлінками від
скаффолдера/`simplycms update`.

**Tech Stack:** pnpm workspaces, tsup (масив профілів node/react/route),
ESLint no-restricted-imports, vitest, наявні гейти/пілот монорепо.

**Spec:** [`docs/superpowers/specs/2026-08-20-package-consolidation-design.md`](../specs/2026-08-20-package-consolidation-design.md)
(рішення ПК1–ПК12, O1).

## Global Constraints

- 🔴 **Умова старту (ПК12):** паралельна гілка механізму скіла
  (`.agents/skills/redesign-from-reference/scripts/**`) ЗМЕРЖЕНА в main;
  якщо ні — СТОП, дія власника.
- 🔴 **Механізми ПЕРЕНОСЯТЬСЯ, не розробляються заново**: жодних нових
  абстракцій; існуючі скрипти/тести адаптуються шляхами. Новий код лише
  там, де вимагає спека: симлінк-логіка (ПК9) і тір-зони (ПК3).
- 🔴 **Скрипти скіла не редагуються**: `skills/redesign-from-reference/**`
  переїжджає байт-в-байт (`git mv`), нуль правок вмісту.
- 🔴 **Гейти після КОЖНОЇ задачі** канонічним порядком:
  `pnpm install --frozen-lockfile → format:check → lint → build → typecheck
  → test → build:packages → test:packaging`; якщо задача міняла manifest-и —
  спершу `pnpm install` (регенерація lockfile), потім ланцюг із frozen.
  `pnpm pilot:pack` — де позначено.
- 🔴 **Кодмод специфікаторів чіпає ЛИШЕ кодові файли** (`*.ts`, `*.tsx`,
  `*.mjs`): **`package.json` — НІКОЛИ** (dependency-ключ `@simplycms/x` не
  можна замінити на субшлях `simplycms/x` — залежність має називатись
  `simplycms`; manifest-и редагуються структурно у своїх задачах).
  `docs/**` кодмод теж не чіпає (спеки — історичні; редакційно — Task 8).
- 🔴 **Гілка К0 НЕ мержиться в main до Task 9**: мерж = публікація
  `simplycms` і зайняття unscoped-імені (ПК2/ПК11).
- Коментарі українською, TS strict 5.9, prettier exact 3.9.6.
- Версія фінального релізу — **0.4.0** (Task 8).

## Канонічна мапа переносу

**Правило субшляхів (нормативне):** кожен чинний export-вхід
`@simplycms/<pkg>/<sub>` → `simplycms/<нова-тека>/<sub>`; корінь пакета
`@simplycms/<pkg>` → `simplycms/<нова-тека>`. Повний перелік чинних входів
знімається Step-ом інвентаризації (Task 2/3) з `package.json.exports`
кожного пакета — **знімок і є ціллю**, таблиця нижче — орієнтир тек:

| Старий пакет | Тека в `packages/simplycms` | Відомі входи (не вичерпно — правило вище) |
|---|---|---|
| `@simplycms/objects` | `src/contracts/` | `.`, `./objects`, `./ports`, `./semver`, `./views`, `./views/fixtures` |
| `@simplycms/domain` | `src/domain/` | `.`, `./pricing`, `./discounts`, `./inventory`, `./shipping`, `./money` |
| `@simplycms/schema` | `src/schema/` (+ `migrations/`, `drizzle/`, `drizzle.config.ts`, `scripts/dump-rls.mjs`, `seed-migrations/` — на рівень пакета) | `.`, `./relations` |
| `@simplycms/supabase` | `src/supabase/` | `.`, `./server-client`, `./anon-client`, … (усі чинні) |
| `@simplycms/data-supabase` | `src/data-supabase/` | `.` (+ чинні) |
| `@simplycms/react-query` | `src/react-query/` | `.`, `./queries` |
| `@simplycms/runtime` | `src/runtime/` | `.` |
| `@simplycms/i18n` | `src/i18n/` | `.` (+ чинні) |
| `@simplycms/storefront` | `src/storefront/` | `.`, `./loaders`, `./seo` |
| `@simplycms/storefront-routes` | `src/storefront-routes/`; `routes/` → `routes/storefront/` | чинні глибокі входи за правилом |
| `@simplycms/admin-routes` | `routes/admin/` (+ src за наявності → `src/admin-routes/`) | монтується шляхом |
| `@simplycms/admin` | `src/admin/` | `.` (+ чинні) |
| `@simplycms/themes` | `src/themes/` | `.`, `./conformance`, `./safeFontStylesheets`, `./ThemeRegistry`, `./ThemeContext`, `./applyTokens`, `./bootstrapThemes`, … (усі чинні) |
| `@simplycms/plugins` | `src/plugins/` | `.`, `./PluginSlot`, `./types` |
| `@simplycms/plugin-sdk` | `src/plugin-sdk/` | `.` (ПК4) |
| `@simplycms/ui` | `src/ui/` | `.` (+ чинні глибокі) |
| `@simplycms/{cart,catalog,checkout,profile,reviews}-ui` | `src/<name>-ui/` | `.` (+ чинні) |
| `@simplycms/core` | реекспорти чужого → кодмод на джерела; **власні модулі** (`providers/`, `hooks/`, `components/`, `lib/`, `types/` — `CMSProvider`, `useAuth`, `useCart`, `useBanners`, …) → `src/core/` | `simplycms/core` |

🔴 **Уточнення ПК1 по `core` (виявлено аудитом):** `packages/core/src` — НЕ
чистий фасад: 45 файлів власних hooks/providers. Розчиняється **фасадна
роль** (реекспорти pricing/shipping/чужих символів → кодмод на справжні
джерела); власні модулі лишаються текою `src/core/` із субшляхом
`simplycms/core`. Повне розселення власних модулів по тірах — свідомо ПОЗА
К0 (семантична робота). Якщо власник хоче інакше — сказати ДО Task 3.

Кодмод (лише кодові файли, по одному мапінгу, 🔴 довші імена першими:
`storefront-routes` → `storefront`, `data-supabase` → `supabase`,
`admin-routes` → `admin`, `plugin-sdk` і `plugin-faq` ПЕРЕД `plugins`;
`@simplycms/theme-solarstore`, `@simplycms/plugin-faq`, `@simplycms/cli` у
мапі НЕМАЄ — не чіпати):

```bash
rg -l -F "@simplycms/objects" -g '*.ts' -g '*.tsx' -g '*.mjs' \
   src packages themes plugins tests scripts routes.ts apps \
  | xargs -r sed -i "s#@simplycms/objects#simplycms/contracts#g"
```

---

### Task 1: Прекондиції, root-манифест, каркас пакета, фільтри тулінгу

**Files:**
- Modify: `package.json` (root: 🔴 rename), `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `scripts/pack-inspect.mjs:38` (фільтр), `scripts/audit-exports.mjs:46` + `scripts/audit-exports/collect.mjs:62` (regex специфікаторів + відбір пакетів), `scripts/audit-deps/collect.mjs:63`, `tests/published-exports-parity.test.ts` (+assert)
- Create: `packages/simplycms/{package.json,tsconfig.json,tsup.config.ts,src/index.ts,README.md}`

**Interfaces:**
- Produces: воркспейс-пакет `simplycms@0.3.x` (`"private": false`
  буквально, `publishConfig` повний, `files: ["dist","src","routes",
  "skills","migrations"]`), аліас `simplycms`/`simplycms/*`; тулінг бачить
  unscoped-флагман нарівні зі scoped.

- [x] **Step 1:** умова старту: `git log --oneline main -- .agents/skills/redesign-from-reference/scripts/ | head` — гілка механізму в main; ребейз на свіжий main. Ні — СТОП.
- [x] **Step 2:** 🔴 root `package.json`: `"name": "simplycms"` → `"simplycms-monorepo"` (private-root, ім'я ніде не публікується; звірити відсутність посилань: `rg -n '\-\-filter[= ]simplycms(\s|$|")' package.json .github scripts` — root-фільтри адресують `@simplycms/schema`, не root).
- [x] **Step 3:** створити `packages/simplycms/` за «Чеклистом нового пакета» + **власний `tsconfig.json`** (за зразком `packages/storefront-routes/tsconfig.json` — його вимагає route-профіль tsup, див. `storefront-routes/tsup.config.ts:24`). `tsup.config.ts` — **масив профілів** `defineConfig([...])`: node-профіль (schema), react-профіль (ui/admin/…), route-профіль (`target:'esnext'`, `splitting:true`) — entry-глоби по теках; 🔴 перенести винятки як є: `splitting:false` для contracts (DTS-чанки, `objects/tsup.config.ts:17`) і plugin-sdk (`plugin-sdk/tsup.config.ts:10`). Тимчасовий `src/index.ts` = `export {}`.
- [x] **Step 4:** аліаси: tsconfig — пара `simplycms` і `simplycms/*`; vite/vitest — base-prefix (як чинні, НЕ пара — звірити форму в `vite.config.ts` перед правкою).
- [x] **Step 5:** 🔴 фільтри тулінгу: `pack-inspect.mjs:38` — `private === false && (name.startsWith('@simplycms/') || name === 'simplycms')`; `audit-exports`/`audit-deps` — і відбір пакетів (collect), і regex специфікаторів (`@simplycms\/…` → додати альтернативу `simplycms(\/|$)`); фільтр `build:packages`. `scripts/release/bump.mjs` сканує `packages/*` — підхопить сам (звірити очима; `CORE_VERSION_FILE` чіпається в Task 2).
- [x] **Step 6:** `tests/published-exports-parity.test.ts` — ДОДАТИ `expect(packed.has('simplycms')).toBe(true)` (поріг `>= 20` поки лишається — Task 3 замінить точним набором). Негативна перевірка: тимчасове `"private": true` у флагмана → тест червоний; повернути.
- [x] **Step 7:** `pnpm install` → повний ланцюг гейтів. Commit: `feat(k0): root-rename, каркас simplycms, unscoped-фільтри тулінгу`.

### Task 2: Перенос T0–T2 (9 пакетів) + schema-тулінг + кодмод

**Files:**
- Move: `packages/{objects,domain,schema,supabase,data-supabase,react-query,runtime,i18n,storefront}/src` → за мапою; `packages/schema/{migrations,drizzle,drizzle.config.ts,seed-migrations,scripts/dump-rls.mjs}` → `packages/simplycms/{migrations,drizzle,drizzle.config.ts,seed-migrations,scripts/dump-rls.mjs}`
- Modify: `packages/simplycms/package.json` (exports за знімком; **злиття dependencies/peerDependencies 9 манифестів** — зовнішні: `clsx`?, тощо — суддя `audit-deps`; scripts: `db:pull`, `db:generate`, `db:dump-rls`, `build` — з schema), root `package.json:32-33` (`--filter @simplycms/schema` → `--filter simplycms`), `scripts/db-diff.mjs:26` (шлях `packages/schema` → `packages/simplycms`), `scripts/types-baseline.mjs:17` (`TARGET` → `packages/simplycms/src/supabase/database.ts`) + відповідний рядок `.prettierignore`, `scripts/sync-create-store-template.mjs` (ціль канону міграцій `packages/schema/migrations` → `packages/simplycms/migrations`), `scripts/release/bump.mjs:66` (`CORE_VERSION_FILE` → `packages/simplycms/src/contracts/semver/…`), `eslint.config.mjs` (env-зона: нові шляхи серверних модулів; `:145` override згенерованої schema → новий шлях), `tests/i18n-coverage/scan.ts` (шлях i18n), `tests/i18n-coverage/pending.ts:22` (allowlist-шляхи перенесених), `tests/i18n-catalog-parity.test.ts:2` (імпорт → `simplycms/i18n`), `tests/e2e/support/i18n.ts:13`, `tests/host-database-types.test.ts`, `tests/rls-parity*` (шляхи)
- Delete: 9 тек пакетів + їхні аліаси

**Interfaces:**
- Consumes: каркас Task 1.
- Produces: субшляхи `simplycms/contracts…simplycms/storefront`; manifest-и
  T3–T5-пакетів, що лишаються, отримують `"simplycms": "workspace:*"`
  замість deps на перенесені (структурна правка, НЕ sed).

- [x] **Step 1 (інвентаризація):** зняти знімок exports 9 пакетів у файл: `for p in objects domain schema supabase data-supabase react-query runtime i18n storefront; do node -e "console.log('$p', JSON.stringify(require('./packages/$p/package.json').exports))"; done > /tmp/k0-exports-t0t2.txt` — це нормативна ціль мапи субшляхів.
- [x] **Step 2 (злиття deps):** згенерувати об'єднання зовнішніх залежностей: `node -e "const m={};for(const p of ['objects','domain','schema','supabase','data-supabase','react-query','runtime','i18n','storefront']){const j=require('./packages/'+p+'/package.json');for(const k of ['dependencies','peerDependencies'])for(const [n,v] of Object.entries(j[k]??{}))if(!n.startsWith('@simplycms'))(m[k]??={})[n]=v}console.log(JSON.stringify(m,null,2))"` → перенести у манифест флагмана (конфлікти версій — взяти новішу, зафіксувати в коміт-повідомленні).
- [x] **Step 3:** `git mv` за мапою (включно зі schema-тулінгом поза src) + exports (+`publishConfig.exports`).
- [x] **Step 4:** кодмод 9 мапінгів (лише кодові файли; порядок!); залишки: `rg -F "@simplycms/<p>" -g '*.ts' -g '*.tsx' -g '*.mjs' src packages themes plugins tests scripts` → нуль для кожного.
- [x] **Step 5:** структурно оновити manifest-и T3–T5, тестів/скриптів шляхи, env-зону, i18n-файли — за списком Files.
- [x] **Step 6:** `pnpm install` → повний ланцюг. 🔴 Звірити, що `db:pull`/`db:dump-rls`/`db:diff` хоча б стартують (dry: `pnpm db:diff --help` чи еквівалент) — DB-тулінг найлегше зламати мовчки.
- [x] **Step 7:** Commit: `refactor(k0): перенос T0–T2 + schema-тулінг у simplycms`.

### Task 3: Перенос T3–T5 + розчинення core + роут-монтування + реліз-гарди

**Files:**
- Move: `ui`, `theme-system`→`src/themes/`, `plugin-system`→`src/plugins/`, `plugin-sdk`, `admin`, 5×`*-ui`, `storefront-routes` (`src`→`src/storefront-routes/`, `routes/`→`routes/storefront/`), `admin-routes` (`routes/`→`routes/admin/`); власні модулі `core` → `src/core/`
- Modify: `routes.ts` (physical на `packages/simplycms/routes/{storefront,admin}`), exports флагмана (знімок T3–T5 + злиття їхніх зовнішніх deps — процедура Task 2 Step 2 для 12 пакетів + core), `eslint.config.mjs` (i18n error-зони — нові шляхи; межа довіри: заборонені `simplycms/supabase*`, `simplycms/data-supabase*`, `@supabase/*`; повідомлення → `simplycms/plugin-sdk`), `tests/plugin-trust-boundary.test.ts` (специфікатори), `tests/i18n-coverage/{scan,pending}.ts` (повністю), `tests/release-bump-coverage.test.ts:18` (замість `>= 21` — точний набір: `simplycms`, `create-simplycms-store`, `@simplycms/cli`, `@simplycms/theme-solarstore`, `@simplycms/plugin-faq`), `tests/published-exports-parity.test.ts:39` (поріг → точний набір 5), manifest-и `simplycms-theme-solarstore`/`simplycms-plugin-faq` (🔴 ПК6: `peerDependencies: {"simplycms":"workspace:*"}` + `devDependencies: {"simplycms":"workspace:*"}` для збірки; старі `@simplycms/*`-deps геть), host `src/*` (імпорти)
- Delete: 12 тек + `packages/core` + аліаси

**Interfaces:**
- Consumes: Task 2.
- Produces: повна exports-мапа; `@simplycms/*`-специфікатори живуть лише в
  4 сателітах; реліз-гарди знають топологію 5.

- [x] **Step 1:** інвентаризація exports 12 пакетів (як Task 2 Step 1) + злиття їхніх зовнішніх deps у флагман (`@tiptap/*` з admin, `clsx`/`tailwind-merge` з ui, …).
- [x] **Step 2:** move + exports + кодмод 11 мапінгів (без core; порядок довших імен!).
- [x] **Step 3 (core):** зняти барель `packages/core/src/index.ts`: (а) реекспорти ЧУЖОГО (pricing/shipping/домен тощо) — кодмод споживачів на справжні джерела (джерело кожного символу видно в барелі; помічник `ORIENT=.agents/skills/codebase-research/scripts/orient; $ORIENT <Символ>`); (б) ВЛАСНІ модулі (`providers/CMSProvider`, `hooks/useAuth|useCart|useBanners|use-toast|…`, `components/`, `lib/`, `types/`) — `git mv` → `src/core/`, барель лишається лише для власного; споживачі `@simplycms/core` кодмодяться на `simplycms/core`; (в) `rg -F "@simplycms/core" -g '*.ts*' -g '*.mjs' src packages themes plugins tests` → нуль; видалити пакет.
- [x] **Step 4:** `routes.ts` монорепо: physical на `./packages/simplycms/routes/storefront` і `…/admin` (точну чинну форму звірити з файлом, рядки ~14–20). `tests/virtual-routes-escape.test.ts` — БЕЗ змін (він синтетичний, tmp-дерево; коректність routes.ts доводять build/routeTree.gen + пілот).
- [x] **Step 5:** межа довіри + trust-boundary-тест (нові специфікатори; прогнати окремо), реліз-гарди (`release-bump-coverage`, `published-exports-parity` — точні набори), сателіти на peer (ПК6).
- [x] **Step 6:** `pnpm install` → повний ланцюг (найважча задача; очікувані хвости — i18n-зони, parity по новій мапі, audit-*).
- [x] **Step 7:** Commit: `refactor(k0): перенос T3–T5, розчинення фасаду core — топологія 26→5`.

### Task 4: Тір-зони напрямку шарів (ПК3) + негативні контролі

**Files:**
- Modify: `eslint.config.mjs`
- Test: `tests/tier-boundary.test.ts` (новий, механіка `tests/plugin-trust-boundary.test.ts`)

- [ ] **Step 1:** зняти ФАКТИЧНІ легальні межі: `for d in contracts domain schema supabase data-supabase react-query runtime i18n storefront ui themes plugins plugin-sdk core admin storefront-routes; do echo "== $d"; rg -o "from 'simplycms/[a-z-]+" packages/simplycms/src/$d 2>/dev/null | sort -u; done` — зони фіксують статус-кво, НЕ вводять нових обмежень.
- [ ] **Step 2:** зони для ВСІХ тірів T0→T5 (не лише нижніх): `contracts` — без `simplycms/*` (крім типів react у views — чинне правило T0); `domain` — лише contracts; T2-теки — без T3+; `ui` — без data/сторінок; `themes`/`plugins` (T4) — без `admin`/`storefront-routes` (T5); same-tier-заборони — лише ті, що підтверджені Step 1 (нуль фактичних імпортів).
- [ ] **Step 3:** `tests/tier-boundary.test.ts`: мінімум по одному негативному кейсу НА КОЖНУ зону (синтетичне порушення → рівно 1 помилка; той самий код поза зоною → 0; окремий кейс — зону не з'їв ignores).
- [ ] **Step 4:** повний ланцюг. Commit: `feat(k0): eslint тір-зони T0→T5 з негативними контролями`.

### Task 5: Скіл у пакет + симлінки монорепо

**Files:**
- Move: `.agents/skills/redesign-from-reference/` → `packages/simplycms/skills/redesign-from-reference/`
- Create: симлінки `.agents/skills/redesign-from-reference` і `.claude/skills/redesign-from-reference` → `../../packages/simplycms/skills/redesign-from-reference` (обидва ПРЯМІ)

- [ ] **Step 1:** `git mv` байт-в-байт; нуль правок вмісту (SKILL.md-шляхи `.claude/skills/…` лишаються валідними через симлінк).
- [ ] **Step 2:** обидва симлінки (старий `.claude/…`-ланцюг замінити прямим); `git add` (mode 120000).
- [ ] **Step 3:** `pnpm vitest run tests/design-import-*` — зелені без правок.
- [ ] **Step 4:** tarball: `pnpm --dir packages/simplycms pack --pack-destination /tmp/k0-pack` → **точна парність файлів**: `tar -tzf /tmp/k0-pack/*.tgz | grep -c 'package/skills/'` == `find packages/simplycms/skills -type f | wc -l` (сьогодні 35; не «кілька grep-ів», а рівність множин — цю саму перевірку Task 7 вносить у `create-pkg-smoke`).
- [ ] **Step 5:** повний ланцюг. Commit: `feat(k0): скіл redesign-from-reference у skills/ пакета`.

### Task 6: Шаблон, скаффолдер, CLI

**Files:**
- Modify (шаблон): `template/package.json.tpl` (deps: `simplycms`; 🔴 без `@simplycms/plugin-faq` — ПК7; devDeps `@simplycms/cli`), `template/routes.ts` (🔴 coreRoutes під один пакет — код нижче; зняти FAQ-mount), `template/tailwind.config.ts` (🔴 +глоби `./node_modules/simplycms/dist/**/*.js`, `./node_modules/simplycms/routes/**/*.{ts,tsx}`; scoped-глоби ЛИШАЮТЬСЯ — ними живуть npm-теми/плагіни сателітів і сторонніх), `template/simplycms.config.ts` (без faq), `template/README.md` (секція «Агентні скіли»), `scripts/sync-create-store-template.mjs` (зняти пару скіла з `SYNCED_DIRS` — елемент на рядках 63–66, оголошення на 54)
- Modify (скаффолдер): `src/scaffold.mjs` (+`createSkillLinks`), `src/steps.mjs` (🔴 виклик ПІСЛЯ `installDeps` — junction на win32 вимагає існуючої цілі; якщо install пропущено (`!installed`) — на POSIX створити dangling-лінки одразу, на win32 пропустити з рядком-підказкою в `printNextSteps`: `pnpm simplycms update`)
- Modify (CLI): `packages/cli/src/context.mjs:32` (розпізнавання ядра: точне ім'я `simplycms` + префікс `@simplycms/`), `update.mjs:78` (`planCoreInstall` включає `simplycms`; + reconcile лінків), `db-diff.mjs:26` (`schemaMigrationsPath` → `node_modules/simplycms/migrations`), `doctor-checks.mjs:113,126` (route-монтування і tailwind-глоб під нову топологію; + warn скіл-лінків), `doctor-fs-checks.mjs:48` (schema-шлях)
- Test: `tests/create-store-template-parity.test.ts`, `tests/cli-update.test.ts`, `tests/cli-doctor.test.ts`, `tests/cli-db-diff.test.ts` (шляхи)
- Delete: `template/.claude/`

**Interfaces:**
- Produces: `createSkillLinks(storeRoot)` — для кожної теки
  `node_modules/simplycms/skills/<name>`: лінки `.agents/skills/<name>` і
  `.claude/skills/<name>` → `../../node_modules/simplycms/skills/<name>`
  (`symlinkSync(target, path, isWin ? 'junction' : undefined)`); reconcile
  в `update` прибирає осиротілі лінки, що вказують у
  `node_modules/simplycms/skills/`.

Новий `coreRoutes` шаблону (`template/routes.ts`; `realpathSync` —
збережений трюк pnpm-шляхів):

```ts
const coreRoutes = (sub: string) =>
  relative(
    ROUTES_DIR,
    join(
      realpathSync(resolve(STORE_ROOT, 'node_modules', 'simplycms', 'routes')),
      sub,
    ),
  );
// …
export const routes = rootRoute('__root.tsx', [
  physical('', coreRoutes('storefront')),
  physical('', coreRoutes('admin')),
  // plugin admin routes — коментар-місце лишається (без FAQ-рядка)
  …
]);
```

- [ ] **Step 1 (RED):** parity-тест: «шаблон БЕЗ `template/.claude/`», «deps == `simplycms` (+зовнішні), без `plugin-faq`», «`template/routes.ts` монтує `simplycms/routes/{storefront,admin}`» — червоний на чинному шаблоні.
- [ ] **Step 2:** шаблон за списком Files + `pnpm template:sync`; parity зелений.
- [ ] **Step 3 (RED→GREEN):** юніт `createSkillLinks` (стаб `node_modules/simplycms/skills/x/SKILL.md` у tmp; обидва лінки резолвляться) → реалізація + виклик після install → зелений.
- [ ] **Step 4 (RED→GREEN):** CLI: юніти на `planCoreInstall` з `simplycms`, `schemaMigrationsPath`, doctor-перевірки (route/tailwind/лінки), reconcile в `update` — розширити чинні `tests/cli-*`.
- [ ] **Step 5:** O1 — за рекомендацією спеки: обидві теки лінків завжди, БЕЗ сіду `AGENTS.md`/`CLAUDE.md` (власник може перевизначити до виконання).
- [ ] **Step 6:** повний ланцюг. Commit: `feat(k0): шаблон/скаффолдер/CLI під топологію 5 + симлінкова доставка скілів`.

### Task 7: Пілот — гейти під unscoped + FAQ-контур + нові інваріанти

**Files:**
- Modify: `scripts/pilot-pack/pack.mjs` (ім'я tarball-а для unscoped: `simplycms-<v>.tgz` — звірити генерацію `:51`), `provenance.mjs` (scope-парсинг: unscoped-пакет НЕ ігнорується), `gate-a.mjs:49` (route-id: `node_modules/simplycms/routes` замість `@simplycms/`), `gate-c.mjs` (regex-и layout-у), `tool-pkg-smoke.mjs`/`tool-doctor-smoke.mjs` (scoped-згадки), `scaffold.mjs`+`overrides.mjs` (`writeManifest`: file:-tarball-и 5 пакетів, devDeps включно), `create-pkg-smoke.mjs:56-63` (нові інваріанти), **FAQ-контур (ПК7): пілотний scratch-магазин ДОВСТАНОВЛЮЄ `@simplycms/plugin-faq`** (dep + запис у config + physical-mount — кроком пілота, бо з шаблону FAQ знято, а гейти B/E та plugin-тести його потребують)

- [ ] **Step 1:** `create-pkg-smoke`: (а) tarball скаффолдера БЕЗ `template/.claude/**`; (б) `package.json.tpl`: deps == `simplycms`, без `plugin-faq`; (в) після скаффолду лінки скілів існують з очікуваним target-ом; (г) tarball `simplycms`: **точна парність `skills/**`** (рівність кількості й множини файлів із `packages/simplycms/skills/`).
- [ ] **Step 2:** гейти/провенанс/pack під unscoped + FAQ-довстановлення кроком пілота.
- [ ] **Step 3:** `pnpm pilot:pack` зелений; у робочій теці пілота: `head -3 <store>/.claude/skills/redesign-from-reference/SKILL.md` (резолв через лінк).
- [ ] **Step 4:** Commit: `test(k0): пілот під unscoped-флагман, FAQ-контур, скіл-інваріанти`.

### Task 8: Документація чинного стану + реліз-підготовка

**Files:**
- Modify: `CLAUDE.md` (Project Structure, Package Aliases, публікація: 5 пакетів; блок напряму — К0 в коді гілки), `packages/README.md`, `docs/architecture/{cli,plugins,themes}.md`, `docs/architecture/release-process.md` (+розділ «Deprecate злитих пакетів» із циклом Task 9), `docs/tasks/platform-roadmap.md` (відмітки К0), `CHANGELOG.md`

- [ ] **Step 1:** доки чинного стану (редакційно; спеки-історію не чіпати).
- [ ] **Step 2:** `pnpm template:sync`; повний ланцюг + `pnpm pilot:pack`.
- [ ] **Step 3:** 🔴 **закомітити ВСЕ** (`git status` чистий) — `scripts/release.mjs:62` має `assertCleanTree()` ДО бампу; потім `pnpm release 0.4.0` (гарди + бамп 5 + гейти + коміт).
- [ ] **Step 4:** push гілки; PR у `main` — НЕ мержити без власника.

### Task 9: Реліз і пост-реліз (дії власника, асистовані)

- [ ] **Step 1 (власник):** мерж PR = релізне рішення (ПК11): CI публікує 5 пакетів, unscoped-ім'я зайняте (ПК2). Перевірити job `publish`.
- [ ] **Step 2:** deprecate 22 злитих імен (після появи `simplycms` у реєстрі; той самий Granular-токен):

```bash
for p in objects domain schema supabase data-supabase react-query runtime \
         i18n storefront storefront-routes admin-routes admin themes plugins \
         plugin-sdk ui cart-ui catalog-ui checkout-ui profile-ui reviews-ui core; do
  npm deprecate "@simplycms/$p" \
    "Merged into the 'simplycms' package (K0 consolidation, 2026-08). Install 'simplycms' instead."
done
```

  (Сателіти НЕ deprecate. Unpublish свідомо ні: 72h минуло, пакети
  взаємозалежні, ламає lockfile-и пілотних магазинів; scope захищений org.)
- [ ] **Step 3:** жива перевірка з реєстру: `pnpm create simplycms-store` у чистій теці → install → лінки резолвляться, Claude Code бачить скіл.
- [ ] **Step 4:** відмітки DoD у спеці §8 і роадмапі.

## Верифікація (для окремого верифікаційного воркфлоу)

1. `pack-inspect`/`test:packaging` бачать рівно 5 не-private пакетів,
   включно з unscoped `simplycms` (точний набір, не поріг).
2. Повний ланцюг + `pilot:pack` зелені; `tier-boundary` і
   `plugin-trust-boundary` червоніють на синтетичних порушеннях (прогнати
   негативні кейси явно).
3. `rg -F "@simplycms/" -g '*.ts' -g '*.tsx' -g '*.mjs' src packages themes plugins tests scripts routes.ts`
   — збіги лише в 4 сателітах (+довстановлення FAQ у пілоті).
4. `packages/simplycms/skills/redesign-from-reference/**` байт-ідентичний
   стану `.agents/…` до переносу; tarball несе ТОЧНУ множину файлів скіла.
5. Скаффолд у чистій теці: лінки на місці, `doctor` без warn після
   install, `update` лагодить навмисно зламаний лінк; `db:diff`/`db:pull`
   працюють по нових шляхах.
6. Поведінкові suite (i18n-coverage+pending, catalog-parity, rls-parity,
   seo-endpoints, e2e за наявності Docker) — у дифі лише шляхи/специфікатори,
   нуль семантичних правок.
