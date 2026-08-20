# План імплементації: трек К0 — консолідація пакетів 26 → 5 + доставка скілів

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Механічно консолідувати 26 npm-пакетів у 5 (unscoped фреймворк
`simplycms` + 4 сателіти) і перевести доставку агентних скілів на теку
`skills/` пакета з прямими симлінками — БЕЗ зміни поведінки, даних чи
контрактів рантайму.

**Architecture:** Чистий перенос: тіри T0→T5 стають теками
`packages/simplycms/src/*`, публічні входи — субшляхами exports-мапи 1:1;
дисципліна шарів переїжджає в eslint-зони з негативним контролем. Скіл
`redesign-from-reference` переїжджає байт-в-байт у `skills/` пакета;
магазини отримують його симлінками від скаффолдера/`simplycms update`.

**Tech Stack:** pnpm workspaces, tsup (профіль route-пакета,
`target: 'esnext'`), ESLint no-restricted-imports, vitest, наявні
гейти/пілот монорепо.

**Spec:** [`docs/superpowers/specs/2026-08-20-package-consolidation-design.md`](../specs/2026-08-20-package-consolidation-design.md)
(рішення ПК1–ПК12, відкрите питання O1).

## Global Constraints

- 🔴 **Умова старту (ПК12):** паралельна гілка механізму скіла
  (`.agents/skills/redesign-from-reference/scripts/**`) ЗМЕРЖЕНА в main;
  якщо ні — СТОП, дія власника.
- 🔴 **Механізми ПЕРЕНОСЯТЬСЯ, не розробляються заново** (рішення власника
  2026-08-20): жодних нових абстракцій/обгорток; існуючі скрипти й тести
  адаптуються шляхами. Єдиний новий код — створення/reconcile симлінків
  скілів (ПК9, ~30 рядків у скаффолдері та CLI) і тір-зони eslint (ПК3).
- 🔴 **Скрипти скіла не редагуються**: `skills/redesign-from-reference/**`
  переїжджає байт-в-байт (`git mv`), нуль правок вмісту.
- 🔴 **Гейти після КОЖНОЇ задачі** канонічним порядком:
  `pnpm install --frozen-lockfile → format:check → lint → build → typecheck
  → test → build:packages → test:packaging`. Якщо задача міняла manifest-и —
  СПОЧАТКУ `pnpm install` (регенерація lockfile), потім ланцюг із frozen.
  `pnpm pilot:pack` — де позначено.
- 🔴 **Гілка К0 НЕ мержиться в main до Task 9**: мерж = публікація
  `simplycms` і зайняття unscoped-імені (ПК2/ПК11).
- 🔴 **Кодмод імпортів НЕ чіпає `docs/**`** (спеки — історичні документи;
  редакційні правки доків — окремо в Task 8). Зона кодмоду: `src/`,
  `packages/`, `themes/`, `plugins/`, `tests/`, `scripts/`, `routes.ts`,
  `*.config.*`, `apps/www` (якщо зачеплено).
- Коментарі українською, TS strict 5.9, prettier exact 3.9.6.
- Версія фінального релізу — **0.4.0** (`pnpm release 0.4.0`, Task 9).

## Канонічна мапа переносу (джерело правди для всіх задач)

| Старий пакет | Тека в `packages/simplycms` | Субшляхи exports (1:1 до чинних) |
|---|---|---|
| `@simplycms/objects` | `src/contracts/` | `simplycms/contracts`, `…/contracts/views`, `…/contracts/views/fixtures` |
| `@simplycms/domain` | `src/domain/` | `simplycms/domain` + `/pricing` `/discounts` `/inventory` `/shipping` |
| `@simplycms/schema` | `src/schema/` (+ `drizzle/`, `migrations/` поруч у пакеті) | `simplycms/schema` |
| `@simplycms/supabase` | `src/supabase/` | `simplycms/supabase` + УСІ чинні субшляхи (`/server-client`, `/anon-client`, …) |
| `@simplycms/data-supabase` | `src/data-supabase/` | `simplycms/data-supabase` |
| `@simplycms/react-query` | `src/react-query/` | `simplycms/react-query` |
| `@simplycms/runtime` | `src/runtime/` | `simplycms/runtime` |
| `@simplycms/i18n` | `src/i18n/` | `simplycms/i18n` |
| `@simplycms/storefront` | `src/storefront/` | `simplycms/storefront` |
| `@simplycms/storefront-routes` | `src/storefront-routes/`; його `routes/` → `routes/storefront/` | `simplycms/storefront-routes` (+ чинні глибокі входи) |
| `@simplycms/admin-routes` | `routes/admin/` (тонкі обгортки; src за наявності → `src/admin-routes/`) | — (монтується шляхом, як сьогодні) |
| `@simplycms/admin` | `src/admin/` | `simplycms/admin` |
| `@simplycms/themes` | `src/themes/` | `simplycms/themes` + `/conformance` `/safeFontStylesheets` |
| `@simplycms/plugins` | `src/plugins/` | `simplycms/plugins` |
| `@simplycms/plugin-sdk` | `src/plugin-sdk/` | `simplycms/plugin-sdk` (ПК4) |
| `@simplycms/ui` | `src/ui/` | `simplycms/ui` (+ чинні глибокі входи) |
| `@simplycms/{cart,catalog,checkout,profile,reviews}-ui` | `src/<name>-ui/` | `simplycms/<name>-ui` |
| `@simplycms/core` | **РОЗЧИНЕННЯ** (Task 3): реекспорти → справжні джерела; реальні модулі (editor/storage) → `src/editor/`, `src/storage/` | `simplycms/editor`, `simplycms/storage` — за фактичним вмістом |

Точний перелік чинних субшляхів кожного пакета знімається з його
`package.json.exports` перед переносом — інваріант спеки §3: «субшлях на
кожен нинішній публічний вхід», парність стереже `audit-exports`.

Кодмод (шаблон; виконується по одному мапінгу за раз, `--` роздільник
обовʼязковий):

```bash
rg -l -F "@simplycms/objects" src packages themes plugins tests scripts routes.ts vite.config.ts vitest*.ts tsconfig.json eslint.config.mjs \
  | xargs -r sed -i "s#@simplycms/objects#simplycms/contracts#g"
```

🔴 Порядок мапінгів у кодмоді: спочатку довші імена (`storefront-routes`
ПЕРЕД `storefront`, `data-supabase` ПЕРЕД `supabase`, `admin-routes` ПЕРЕД
`admin`, `plugin-sdk`/`plugin-faq` ПЕРЕД `plugins`), інакше префіксні
підміни зіпсують довші специфікатори. `@simplycms/theme-solarstore` і
`@simplycms/plugin-faq` у мапі НЕМАЄ — не чіпати.

---

### Task 1: Прекондиції + каркас пакета `simplycms` + фільтри тулінгу

**Files:**
- Create: `packages/simplycms/package.json`, `packages/simplycms/tsup.config.ts`, `packages/simplycms/src/index.ts` (тимчасовий `export {}`), `packages/simplycms/README.md`
- Modify: `tsconfig.json` (paths), `vite.config.ts` (resolve.alias), `vitest.config.ts`, `scripts/pack-inspect/*` (фільтр), корневий `package.json` (`build:packages`-фільтр, якщо він за префіксом), `scripts/audit-deps/*`, `scripts/audit-exports/*` (корені сканування)

**Interfaces:**
- Produces: воркспейс-пакет `simplycms@<поточна>` з `"private": false`
  (буквально!), `publishConfig.access: "public"`, порожньою exports-мапою
  `{".": …}` і алісом `simplycms`/`simplycms/*` → `packages/simplycms/src`.
  Наступні задачі додають у exports субшляхи за мапою.

- [ ] **Step 1:** перевірити умову старту: `git log --oneline main -- .agents/skills/redesign-from-reference/scripts/ | head` — коміти паралельної гілки в main; локальна гілка ребейзнута на свіжий main. Якщо гілка механізму НЕ змержена — СТОП, звіт власнику.
- [ ] **Step 2:** створити `packages/simplycms/` за «Чеклистом нового пакета» (`packages/README.md`): version = поточна синхронна; 🔴 `"private": false` буквально; `publishConfig` з `access`, `registry`, `exports`; `files` = `["dist", "src", "routes", "skills"]` (уточнити за профілем route-пакета — сирці їдуть, як у `storefront-routes`); tsup-профіль route-пакета з `target: 'esnext'`; тимчасовий `src/index.ts` = `export {}`.
- [ ] **Step 3:** аліаси `simplycms` + `simplycms/*` у tsconfig/vite/vitest (пара X і X/* — конвенція «Package Aliases» CLAUDE.md).
- [ ] **Step 4:** 🔴 розширити фільтри тулінгу на unscoped-ім'я: `scripts/pack-inspect/*` (умова `private === false && (name.startsWith('@simplycms/') || name === 'simplycms')`), фільтр `build:packages`, корені `audit-deps`/`audit-exports`. Перевірити `scripts/release/bump.mjs` — він сканує `packages/*` без префіксного фільтра, має підхопити сам (звірити очима).
- [ ] **Step 5:** негативна перевірка фільтра: тимчасово поставити `"private": true` пакету `simplycms` → `pnpm test:packaging` НЕ бачить його; повернути `false` → бачить (запустити `build:packages` перед suite). Це доводить, що флагман не випав із гейта мовчки.
- [ ] **Step 6:** `pnpm install` (lockfile) → повний ланцюг гейтів. Commit: `feat(k0): каркас пакета simplycms + unscoped-фільтри тулінгу`.

### Task 2: Перенос T0–T2 (9 пакетів) + кодмод імпортів

**Files:**
- Move (git mv): `packages/{objects,domain,schema,supabase,data-supabase,react-query,runtime,i18n,storefront}/src` → `packages/simplycms/src/<тека за мапою>`; `packages/schema/{drizzle,migrations}` → `packages/simplycms/{drizzle,migrations}` (звірити споживачів шляхів!)
- Modify: `packages/simplycms/package.json` (exports за мапою), manifest-и пакетів T3–T5, що лишаються (їхні deps на перенесені → `"simplycms": "workspace:*"`), `scripts/db-*.mjs` (імпорти schema), `eslint.config.mjs` (env-зона: нові шляхи `server-client`/`anon-client`/seo-модулів), `tests/i18n-coverage/scan.ts` (`SCANNED_ROOTS`: шлях i18n), `tests/host-database-types.test.ts` та інші тести зі шляхами
- Delete: 9 старих тек пакетів (порожні обгортки після mv), їхні аліаси з tsconfig/vite/vitest

**Interfaces:**
- Consumes: каркас Task 1.
- Produces: субшляхи `simplycms/contracts…simplycms/storefront` (мапа) —
  решта репо імпортує ТІЛЬКИ їх; старих імен цих 9 пакетів у кодовій зоні
  кодмоду не існує.

- [ ] **Step 1:** зняти точні exports 9 пакетів: `for p in objects domain schema supabase data-supabase react-query runtime i18n storefront; do node -e "console.log('$p', JSON.stringify(require('./packages/$p/package.json').exports))"; done` — зберегти список, він = цільова мапа субшляхів.
- [ ] **Step 2:** `git mv` тек за мапою; додати субшляхи в exports (і в `publishConfig.exports` — parity-тест вимагає обох).
- [ ] **Step 3:** кодмод імпортів для 9 мапінгів (шаблон вище; `objects→contracts` — єдина зміна імені, решта 1:1). Перевірити нуль залишків: `rg -F "@simplycms/objects" src packages themes plugins tests scripts` → порожньо (і так для всіх 9).
- [ ] **Step 4:** manifest-и T3–T5-пакетів, що лишаються: замінити deps на перенесені пакети одним `"simplycms": "workspace:*"`; прибрати 9 аліасів; оновити env-зону eslint і `SCANNED_ROOTS`.
- [ ] **Step 5:** `pnpm install` → повний ланцюг гейтів. Особлива увага: `tests/rls-parity`, `tests/host-database-types` (шляхи schema/supabase), `packages/i18n/src/__tests__` (тепер `packages/simplycms/src/i18n/__tests__` — vitest глоб `packages/<pkg>/src/**/__tests__/` покриває автоматично, звірити що тести ВИДНО в прогоні, не лише зелений підсумок).
- [ ] **Step 6:** Commit: `refactor(k0): перенос T0–T2 у simplycms (9 пакетів → субшляхи)`.

### Task 3: Перенос T3–T5 (12 пакетів) + розчинення core + роут-монтування

**Files:**
- Move: `ui`, `theme-system`→`src/themes/`, `plugin-system`→`src/plugins/`, `plugin-sdk`, `admin`, 5×`*-ui`, `storefront-routes` (`src`→`src/storefront-routes/`, `routes/`→`routes/storefront/`), `admin-routes` (`routes/`→`routes/admin/`)
- Modify: `routes.ts` (physical() на нові теки), `packages/simplycms/package.json` (exports), `eslint.config.mjs` (i18n error-зони — нові шляхи; межа довіри плагінів — специфікатори `simplycms/plugin-sdk`, `simplycms/ui`, заборонені `simplycms/supabase` тощо), `tests/plugin-trust-boundary.test.ts` (специфікатори), `tests/virtual-routes-escape.test.ts` (нові шляхи тек), `tests/i18n-coverage/scan.ts` (повний `SCANNED_ROOTS`), manifest-и `simplycms-theme-solarstore`/`simplycms-plugin-faq` (deps → `"simplycms": "workspace:*"` — 🔴 лишаються regular deps, НЕ peer: семантика не змінюється в К0, peer-конвенція — маркетплейс/V2-К5), `src/*` host-файли (імпорти)
- Delete: 12 старих тек + аліаси + `packages/core` (після розчинення)

**Interfaces:**
- Consumes: субшляхи Task 2.
- Produces: повна exports-мапа `simplycms`; `routes.ts` монтує
  `packages/simplycms/routes/{storefront,admin}` (у магазині —
  `node_modules/simplycms/routes/…`); `@simplycms/*` імена існують лише в
  4 сателітах.

- [ ] **Step 1:** move + exports + кодмод для 11 некорових мапінгів (🔴 порядок: довші імена першими — див. мапу).
- [ ] **Step 2:** розчинення `core`: (а) зняти його барель: `cat packages/core/src/index.ts` + список файлів; (б) для чистих реекспортів — кодмод споживачів `@simplycms/core` на справжні субшляхи (джерело кожного символу — сам барель; помічник: `ORIENT=.agents/skills/codebase-research/scripts/orient; $ORIENT <Символ>`); (в) реальні модулі (Tiptap-editor, storage-хелпери — скоупи `editor`/`storage` instructions) → `src/editor/`, `src/storage/` + субшляхи `simplycms/editor`, `simplycms/storage`; (г) `rg -F "@simplycms/core"` → нуль; видалити пакет.
- [ ] **Step 3:** `routes.ts`: physical() на `./packages/simplycms/routes/storefront` і `…/routes/admin` (точну чинну форму шляхів звірити з файлом); `tests/virtual-routes-escape.test.ts` — оновити й переконатися, що він ЧЕРВОНІВ до правки шляхів (запустити до і після — це його негативний контроль).
- [ ] **Step 4:** межа довіри: зона плагінів забороняє `simplycms/supabase*`, `simplycms/data-supabase*`, `@supabase/*`; повідомлення вказує на `simplycms/plugin-sdk`. `tests/plugin-trust-boundary.test.ts` — нові специфікатори; прогнати сам тест окремо: `pnpm vitest run tests/plugin-trust-boundary.test.ts`.
- [ ] **Step 5:** `pnpm install` → повний ланцюг гейтів (це найважча задача — очікувані хвости: i18n error-зони, `published-exports-parity` по новій мапі, `audit-exports`).
- [ ] **Step 6:** Commit: `refactor(k0): перенос T3–T5 + розчинення core — топологія 26→5 завершена`.

### Task 4: Тір-зони напрямку шарів (ПК3) + негативний контроль

**Files:**
- Modify: `eslint.config.mjs` (нові зони)
- Test: `tests/tier-boundary.test.ts` (новий, за зразком `tests/plugin-trust-boundary.test.ts`)

**Interfaces:**
- Consumes: теки `packages/simplycms/src/*` (Task 2–3).
- Produces: лінт-інваріант напрямку T0→T5.

- [ ] **Step 1:** зони в `eslint.config.mjs` (шаблон — чинна зона межі довіри):
  `src/contracts/**` — заборонено `simplycms/*` і `react` поза `contracts/views` (чинне правило T0 з `packages/README.md`);
  `src/domain/**` — дозволено лише `simplycms/contracts*`;
  `src/{supabase,data-supabase,react-query,runtime,i18n,storefront}/**` — заборонено `simplycms/{ui,themes,plugins,admin,storefront-routes}*`;
  `src/ui/**` — заборонено `simplycms/{supabase,data-supabase,storefront,admin,themes,plugins}*`.
  (Формулювання «заборонено вище за тіром» — точні селектори за фактичними легальними імпортами: перед написанням зняти реальні межі `rg -o "from 'simplycms/[a-z-]+" packages/simplycms/src/<тека> | sort -u` для кожної теки — зона фіксує статус-кво, НЕ вводить нових обмежень.)
- [ ] **Step 2:** написати `tests/tier-boundary.test.ts` — копія механіки trust-boundary: синтетичне порушення в зоні дає рівно 1 помилку `no-restricted-imports`, той самий код поза зоною — 0; окремий кейс стереже, що зону не з'їв ignores.
- [ ] **Step 3:** прогнати новий тест (червоний до додавання зон — якщо зони писались першими, тимчасово закоментувати одну і побачити падіння тесту), потім зелений повний ланцюг.
- [ ] **Step 4:** Commit: `feat(k0): eslint тір-зони T0→T5 з негативним контролем`.

### Task 5: Скіл у пакет + симлінки монорепо (ПК8, ПК9-монорепо)

**Files:**
- Move: `.agents/skills/redesign-from-reference/` → `packages/simplycms/skills/redesign-from-reference/` (git mv, байт-в-байт)
- Create: симлінки `.agents/skills/redesign-from-reference` і `.claude/skills/redesign-from-reference` → `../../packages/simplycms/skills/redesign-from-reference` (обидва ПРЯМІ, без ланцюга)
- Modify: `packages/simplycms/package.json` (`files` містить `skills` — звірити з Task 1)

**Interfaces:**
- Produces: `skills/redesign-from-reference/**` їде в tarball `simplycms`;
  шляхи `.agents/…` і `.claude/…` у монорепо резолвляться як раніше.

- [ ] **Step 1:** `git mv .agents/skills/redesign-from-reference packages/simplycms/skills/redesign-from-reference` — 🔴 нуль правок вмісту (SKILL.md згадує шляхи `.claude/skills/…` — вони лишаються валідними через симлінк).
- [ ] **Step 2:** створити обидва симлінки (`ln -s ../../packages/simplycms/skills/redesign-from-reference .agents/skills/redesign-from-reference` і так само для `.claude/skills/`; старий симлінк `.claude/skills/redesign-from-reference` → `../../.agents/…` замінити прямим). `git add` обох (git зберігає симлінки як mode 120000).
- [ ] **Step 3:** перевірити фікстурні тести скриптів: `pnpm vitest run tests/design-import-*` — зелені без правок (вони ходять через `.agents/…`, який тепер симлінк).
- [ ] **Step 4:** tarball-перевірка: `pnpm --dir packages/simplycms pack --pack-destination /tmp/k0-pack && tar -tzf /tmp/k0-pack/*.tgz | grep "skills/redesign-from-reference"` — SKILL.md і `scripts/lib/*` присутні (🔴 npm пакує РЕАЛЬНІ файли — вони тепер у пакеті, симлінки лишились тільки в корені монорепо, який не пакується).
- [ ] **Step 5:** повний ланцюг гейтів. Commit: `feat(k0): скіл redesign-from-reference переїхав у skills/ пакета simplycms`.

### Task 6: Шаблон, скаффолдер, CLI (ПК7, ПК9-магазин, O1-рекомендація)

**Files:**
- Modify: `packages/create-simplycms-store/template/package.json.tpl` (deps: `simplycms` замість 22 `@simplycms/*`; 🔴 `@simplycms/plugin-faq` ВИДАЛИТИ — ПК7; devDeps: `@simplycms/cli` лишається), `template/simplycms.config.ts` (прибрати plugin-faq із plugins, якщо є), `template/README.md` (секція «Агентні скіли»), `scripts/sync-create-store-template.mjs` (зняти пару скіла з `SYNCED_DIRS:63-66`), `packages/create-simplycms-store/src/scaffold.mjs` (створення симлінків), `packages/create-simplycms-store/src/steps.mjs` (`printNextSteps` — рядок про скіли), `packages/cli/src/update.mjs` (reconcile), `packages/cli/src/doctor-checks.mjs` (warn-перевірка)
- Test: `tests/create-store-template-parity.test.ts` (нова модель), `tests/cli-update.test.ts` і `tests/cli-doctor.test.ts` (розширення чинних cli-юнітів)
- Delete: `packages/create-simplycms-store/template/.claude/` (заморожена копія скіла)

**Interfaces:**
- Consumes: `skills/` у пакеті (Task 5).
- Produces: функція `createSkillLinks(storeRoot)` у скаффолдері й
  reconcile-логіка `simplycms update`: для кожної теки
  `node_modules/simplycms/skills/<name>` існують лінки
  `.agents/skills/<name>` і `.claude/skills/<name>` →
  `../../node_modules/simplycms/skills/<name>`; биті/осиротілі лінки, що
  вказують у `node_modules/simplycms/skills/`, прибираються.

- [ ] **Step 1 (RED):** оновити `tests/create-store-template-parity.test.ts`: асерт «шаблон НЕ містить `template/.claude/`» + «`package.json.tpl` deps == рівно `simplycms` (+ зовнішні), без `@simplycms/plugin-faq`». Прогнати — ЧЕРВОНИЙ на чинному шаблоні.
- [ ] **Step 2:** зняти пару скіла з `SYNCED_DIRS`, видалити `template/.claude/`, переписати `package.json.tpl` і `simplycms.config.ts`; `pnpm template:sync`; parity-тест зелений.
- [ ] **Step 3 (RED):** юніт на симлінки скаффолдера (у тимчасовій теці зі стабом `node_modules/simplycms/skills/x/SKILL.md`): після `createSkillLinks` обидва лінки існують і резолвляться; на Windows-гілці — junction (перевірка типу опційна, головне — не падає). Прогнати — червоний.
- [ ] **Step 4:** реалізувати `createSkillLinks` у `scaffold.mjs` (`readdirSync` цілі, `symlinkSync(target, path, process.platform === 'win32' ? 'junction' : undefined)` з відносним target `../../node_modules/simplycms/skills/<name>`; тека може ще не існувати до install — лінк створюється «в майбутнє», це штатно); виклик після копіювання шаблону; рядок у `printNextSteps` («скіли агентів підключено симлінками; оновлення — pnpm update simplycms»). Юніт зелений.
- [ ] **Step 5 (RED→GREEN):** reconcile в `update.mjs` (та сама логіка звірки + прибирання осиротілих лінків, що вказують у `node_modules/simplycms/skills/`) + warn-перевірка в `doctor-checks.mjs` (лінк відсутній/битий → warn з командою `pnpm simplycms update`); юніти в чинних cli-тестах.
- [ ] **Step 6:** O1 — реалізується рекомендація спеки: обидві теки лінків ЗАВЖДИ, без промпта; сід `AGENTS.md`/`CLAUDE.md` НЕ робиться (🔴 власник може перевизначити до виконання — звірити із задачею).
- [ ] **Step 7:** повний ланцюг гейтів. Commit: `feat(k0): доставка скілів у магазин — симлінки скаффолдера, reconcile в update, warn у doctor`.

### Task 7: Пілот — нові інваріанти + живий прогін

**Files:**
- Modify: `scripts/pilot-pack/create-pkg-smoke.mjs:56-63` (асерти скіл-копії → нові інваріанти), `scripts/pilot-pack/*` (`writeManifest`: tarball-и 5 пакетів; gate-обвязка за фактом падінь)
- Test: `pnpm pilot:pack` цілком

**Interfaces:**
- Consumes: Task 1–6 повністю.
- Produces: зелений `pilot:pack` доводить: tarball `simplycms` містить
  `skills/**`; скаффолд із tarball-ів дає магазин, де лінки скілів
  резолвляться; шаблон без копії скіла і без `plugin-faq`.

- [ ] **Step 1:** переписати асерти `create-pkg-smoke.mjs`: (а) tarball скаффолдера НЕ містить `template/.claude/**`; (б) `package.json.tpl` у tarball-і має deps `simplycms` і НЕ має `@simplycms/plugin-faq`; (в) після скаффолду в тимчасовій теці існують симлінки `.agents/skills/redesign-from-reference` і `.claude/skills/…` з очікуваним відносним target-ом.
- [ ] **Step 2:** `writeManifest` пілота: file:-підміни для 5 пакетів (включно з devDeps `@simplycms/cli` — чеклист №10 `packages/README.md`).
- [ ] **Step 3:** `pnpm pilot:pack` — зелений. Живий доказ доставки: у робочій теці пілота після install перевірити `cat <store>/.claude/skills/redesign-from-reference/SKILL.md | head -3` (резолв через симлінк у реальний вміст пакета).
- [ ] **Step 4:** Commit: `test(k0): пілот під топологію 26→5 і симлінкову доставку скілів`.

### Task 8: Документація чинного стану + реліз-підготовка

**Files:**
- Modify: `CLAUDE.md` (Project Structure, Package Aliases, Theme System-згадки, «Публікація пакетів»: 5 пакетів; блок стратегічного напряму — К0 позначити виконаним у коді гілки), `packages/README.md` (структура тек замість таблиці пакетів; чеклист нового пакета — доповнити unscoped-нюансом), `docs/architecture/{cli,plugins,themes}.md` (специфікатори `simplycms/*`), `docs/architecture/release-process.md` (розділ «Deprecate злитих пакетів» — цикл із Task 9), `docs/tasks/platform-roadmap.md` (відмітки треку К0), `CHANGELOG.md`
- Run: `pnpm template:sync`, повний ланцюг + `pnpm pilot:pack`

- [ ] **Step 1:** оновити документи чинного стану (тепер код гілки = нова топологія; правило «доки описують код» знову виконується). Кодмод-виняток для `docs/**` знімається саме тут — редакційно, не sed-ом по спеках (спеки лишаються історичними).
- [ ] **Step 2:** `pnpm template:sync` (три цілі синку — звірити, що канон host-файлів не постраждав: `SYNCED_FILES` не мінявся).
- [ ] **Step 3:** повний ланцюг гейтів + `pnpm pilot:pack`.
- [ ] **Step 4:** `pnpm release 0.4.0` (гарди + бамп 5 пакетів + гейти + коміт).
- [ ] **Step 5:** Commit-и пушаться; PR у `main` — НЕ мержити без власника.

### Task 9: Реліз і пост-реліз (дії власника, асистовані)

**Files:**
- Modify: спека §8 DoD (відмітки), роадмап (закриття треку К0)

- [ ] **Step 1 (власник):** мерж PR у `main` = релізне рішення (ПК11): CI публікує 5 пакетів; unscoped-ім'я `simplycms` зайняте (ПК2). Перевірити job `publish`.
- [ ] **Step 2:** deprecate 22 злитих імен (потрібен той самий Granular-токен; виконується ПІСЛЯ появи `simplycms` у реєстрі):

```bash
for p in objects domain schema supabase data-supabase react-query runtime \
         i18n storefront storefront-routes admin-routes admin themes plugins \
         plugin-sdk ui cart-ui catalog-ui checkout-ui profile-ui reviews-ui core; do
  npm deprecate "@simplycms/$p" \
    "Merged into the 'simplycms' package (K0 consolidation, 2026-08). Install 'simplycms' instead."
done
```

  (22 імені; сателіти `cli`/`theme-solarstore`/`plugin-faq`/`create-simplycms-store` — НЕ deprecate. Unpublish свідомо не робиться: 72h-вікно минуло, пакети взаємозалежні, ламає lockfile-и пілотних магазинів; scoped-імена захищені org-ом — сквотинг неможливий.)
- [ ] **Step 3:** жива перевірка з реального реєстру: `pnpm create simplycms-store` у чистій теці → install → лінки скілів резолвляться, Claude Code бачить скіл (відкрити магазин у Claude Code, скіл у списку). Зафіксувати результат у DoD спеки §8.
- [ ] **Step 4:** відмітки DoD у спеці §8 і роадмапі.

## Верифікація (для окремого верифікаційного воркфлоу)

1. `pnpm -r publish --dry-run` (або `pack-inspect`) бачить рівно 5
   не-private пакетів, серед них unscoped `simplycms`.
2. Повний ланцюг гейтів + `pilot:pack` зелені; `tests/tier-boundary` і
   `tests/plugin-trust-boundary` червоніють на синтетичних порушеннях
   (запустити їх негативні кейси явно).
3. `rg -F "@simplycms/" src packages themes plugins tests scripts routes.ts`
   — збіги лише для 4 сателітів (`cli`, `plugin-faq`, `theme-solarstore`,
   `create-simplycms-store`).
4. Diff `packages/simplycms/skills/redesign-from-reference/**` проти
   стану `.agents/skills/…` перед переносом — байт-ідентичний (нуль правок
   механізму скіла).
5. Скаффолд у чистій теці: симлінки на місці, `doctor` без warn після
   install, `update` лагодить навмисно зламаний лінк.
6. Поведінкові suite (i18n-coverage, catalog-parity, rls-parity,
   seo-endpoints, e2e за наявності Docker) — без семантичних правок у дифі
   (лише шляхи/специфікатори).
