# Трек T — міграція збірки пакетів tsup → tsdown (ред. 3.2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести збірку трьох публікованих пакетів (`simplycms`,
`@simplycms/theme-solarstore`, `@simplycms/plugin-faq`) з покинутого апстрімом
`tsup` на `tsdown`, і при цьому звести межу клієнт/сервер ядра до ОДНІЄЇ
декларації, яку читають збірка, гейт артефакта, лінт, Gate C пілота і — вперше —
сама збірка магазину (Import Protection TanStack Start).

**Architecture:** Межа довіри стає даними в T0-контрактах
(`simplycms/contracts/server-only`), а не поведінкою бандлера. Ядро збирається
ДВОМА збірками Rolldown — клієнтською і серверною — і модулі різних збірок не
можуть ділити чанк, тож серверний код структурно не потрапляє в чанк, досяжний
із клієнтського entry. Список entry виводиться з dev-`exports` package.json, тож
`dist/` дзеркалить exports за побудовою. Декларації ядра й далі емітить `tsc`
(виміряно: dts-плагін бандлера на цьому пакеті вичерпує 3 ГБ heap). Кожна
властивість артефакта має гейт із доведеним негативним контролем; міграція
ядра — одна тіньова збірка й одне перемикання, без стану «два інструменти в
одному dist».

**Tech Stack:** tsdown 0.22.14 (Rolldown 1.2.x — той самий, що у Vite 8),
TanStack Start 1.167 (Import Protection), Node 24, pnpm 11.20, TypeScript 5.9,
vitest 4, ESLint 10.

**Spec:** [`docs/tasks/platform-roadmap.md`](../../tasks/platform-roadmap.md),
пункт «4. Трек T» (амендмент ред. 3 від 2026-09-02);
[`2026-08-29-v2-k3-admin-server-layer-design.md`](../specs/2026-08-29-v2-k3-admin-server-layer-design.md),
К3-9′ (розкладка client/server, амендмент про `admin-server/impl/<entity>`);
[`2026-07-30-platform-architecture-design.md`](../specs/2026-07-30-platform-architecture-design.md)
§7 (межа довіри плагінів); межі тестування —
[`docs/architecture/test-contours.md`](../../architecture/test-contours.md).

> 🔴 **Ревізія 3 (2026-09-02).** Ред. 2 пройшла аналіз із ЕМПІРИЧНОЮ перевіркою:
> tsdown 0.22.14 встановлено у scratch, плагін і повний конфіг ядра зібрано за
> текстом ред. 2, збірку хоста прогнано з Import Protection у трьох режимах.
> Що змінено і чому (кожен пункт доведено прогоном, не читанням):
> **(1)** `platform: 'neutral'` знято — дефолт tsup ТЕЖ `node`
> (`tsup/dist/index.js:483`), а під `neutral` Rolldown дає 7 попереджень
> `UNRESOLVED_IMPORT` на `node:crypto`; **(2)** `external` знято — у 0.22.14 він
> deprecated і друкує WARN на кожен конфіг, канон `deps.neverBundle`;
> **(3)** обґрунтування `clean` переписано — tsdown чистить outDir ОДИН раз для
> всього масиву конфігів до першого запису (`build-*.mjs`, мемоізований
> `cleanOutDir`), гонки немає; **(4)** 16 ізольованих збірок замінено двома
> групами — ізоляція `contracts`/`schema` трималася на застарілому аргументі
> про `.d.ts` (декларації ядра з 2026-08-24 емітить tsc), а справжній інваріант
> — партиція графа; **(5)** список entry виводиться з `exports`, бо глоби ред. 2
> були ВУЖЧІ за exports (сім вкладених `.tsx` під `storefront-routes/pages/*`
> обіцяні wildcard-ом, але не збиралися); **(6)** гейт «нуль відносних імпортів»
> замінено гейтом партиції — Rolldown веде спільні модулі через entry-файли, і
> витік проявляється як `./impl.js`, а не лише як `../chunk-*.js`;
> **(7)** межа вперше перевіряється в самому магазині: Import Protection Start
> з `include: ['**']` і патернами `specifiers` + `files` (у монорепо alias
> резолвить специфікатор РАНІШЕ за перевірку — ловить лише `files`);
> **(8)** три serverFn-модулі (`plugin-sdk/server`, `themes/server`,
> `plugins/server`) НЕ server-only: їх імпортує клієнт, стаби робить компілятор
> Start — включення їх у декларацію дало 5 хибних спрацювань на чистому хості;
> **(9)** негативна мутація `build-config-typecheck` дає TS2322, не TS2353;
> **(10)** `/usr/bin/time` на машині немає — вимір RSS через python;
> **(11)** декларації силами tsdown відкинуто ВИМІРОМ: OOM 3 ГБ за 25 с при
> дефолтному паралелізмі і за 29 с при `--concurrency 1`, tsc — 11 с / 1,1 ГБ;
> **(12)** ред. 3.1 після другого Codex-аудиту (обірвався на ліміті, але
> встиг знайти блокер): шлях у dist виводиться з ДЖЕРЕЛА, а не з ключа
> exports — інакше 37 явних цілей `publishConfig.exports` не збігалися б;
> **(13)** додано `sideEffects: false` (нуль side-effect-імпортів і нуль
> top-level мутацій глобалів у `src` ядра), знос барелю `simplycms/storefront`
> без споживачів, `pilot:pack` у гейти релізу.
> **(14)** ред. 3.2 після аудиту r2b (`gpt-5.6-luna`, REJECT: 1 блокер,
> 2 major, 4 minor — усі підтверджені проти коду): конфіг ядра не залежить
> від cwd (його імпортує і кореневий vitest); декларація доповнена
> `storefront-routes/seo`; серверні хелпери `is-admin`/`theme-record`/
> `revalidate-theme` переїжджають зі `storefront-routes/server` у
> `storefront/loaders` (туди ж 2026-08-24 переїхав `withSessionDb` з тієї самої
> причини), нутрощі адмінки — під `admin-server/impl/`; інвентаризація tsup
> доповнена (72 збіги у 32 файлах); правило ловить `import(\`./impl\`)`; склад
> гейтів релізу — під тестом; шаблон трейлерів комітів.
> Рішення власника 2026-09-02: сім вкладених `.tsx` стають entry; барель
> `storefront` зноситься; `schema` цілком server-only; `pilot:pack` у
> `gates.mjs`; Import Protection у режимі `error` для dev і build.

## Global Constraints

Діють у КОЖНІЙ задачі; окремо в кроках не повторюються.

- **Формат — тільки ESM.** `format: ['esm']` у кожному конфізі.
- **`platform: 'node'` і `fixedExtension: false` у base КОЖНОГО конфігу.**
  `node` — той самий platform, що був дефолтом tsup: builtins Node зовнішні
  без попереджень, у браузер код їде лише через бандлер магазину.
  `fixedExtension` при platform node дав би `.mjs` повз `publishConfig.exports`.
- **`target: 'esnext'` у base.** За нижчого таргета бандлер лоуерить
  `import.meta` у `var import_meta = {}`. Гард — `tests/dist-import-meta.test.ts`.
- **`deps: { neverBundle: [/^simplycms(\/|$)/, /^@simplycms\//] }`** у кожному
  конфізі. `external` у tsdown deprecated. Без правила бандлер вбудував би
  self-reference граф у кожен entry й задублював stateful-модулі мовчки.
- **Декларації ядра емітить `tsc -p tsconfig.dts.json`, а НЕ бандлер.**
  `dts: false` в обох конфігах ядра; сателіти — `dts: true`.
- **`clean: true` рівно в ОДНОМУ конфізі масиву ядра і в base сателітів.**
  tsdown чистить outDir один раз для всього масиву до першого запису; `tsc`
  дописує `.d.ts` після. Скрипт `build` ядра більше не викликає `rmSync`.
- **Кеп памʼяті `HEAP_CAP_MB = 3072` і стеля `WALL_CAP_SECONDS = 300`
  (`scripts/build-packages.mjs`) не змінюються.** Вони стережуть `tsc` і
  dts-плагін сателітів, які живуть у V8; native-памʼять Rolldown вимірюється
  окремо (Task 4) і записується в `test-contours.md`.
- **Рівно ДВІ збірки ядра — клієнтська і серверна.** Хто де — лише
  `SERVER_ONLY` з `simplycms/contracts/server-only`. Нових профілів,
  `outputOptions.codeSplitting: false` та ізольованих конфігів не буде.
- **Список entry ядра НЕ пишеться руками** — виводиться з dev-`exports`
  package.json. Новий субшлях = новий ключ exports (обидві мапи), і більше нічого.
- 🔴 **Опцію `exports: true` у tsdown НЕ вмикати.** Мапа exports рукописна
  (20 wildcard-ів читабельніші за ~300 згенерованих ключів) і стережеться
  `tests/published-exports-parity.test.ts`.
- **`SERVER_ONLY` — єдина декларація межі.** Жоден споживач не тримає копії
  списку; літерали дозволені лише для того, що НЕ є server-only
  (legacy Supabase до К3, serverFn-модулі як заборонена для плагінів поверхня).
- **Коментарі в коді — українською**, пояснюють ПРИЧИНУ, не переказують код
  (`.github/instructions/coding-style.instructions.md`).
- **Порядок гейтів** (CLAUDE.md): `pnpm install --frozen-lockfile →
  format:check → lint → build → typecheck → test → test:schema →
  build:packages → typecheck:template → test:packaging`; після треку в
  гейтах РЕЛІЗУ ще `pilot:pack`.
- **Мінімальний гейт кожної задачі:** `pnpm lint && pnpm test` перед комітом
  (урок Е1б: рев'ю по дифу сліпе до парність-тестів).
- **Кожен коміт** закінчується двома трейлерами атрибуції сесії-виконавця,
  дослівно (URL — тієї сесії, що виконує):
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` і
  `Claude-Session: https://claude.ai/code/session_<id сесії-виконавця>`.
  Команди `git commit` нижче показують лише тіло повідомлення; перевірка після
  коміту — `git show -s --format=%B HEAD | tail -2`.
- **`$SCRATCH`** у командах — scratchpad поточної сесії-виконавця
  (`export SCRATCH=<шлях>`); у репо тимчасові файли не кладуться.
- Робота йде в гілці `claude/track-t-tsdown` від `main`. Прямі коміти в `main`
  заборонені — мерж у `main` публікує пакети на npm.

---

## Мапа файлів

**Створюються:**

| Файл | Відповідальність |
|---|---|
| `packages/simplycms/src/contracts/server-only.ts` | Декларація межі: `SERVER_ONLY`, `SERVER_ONLY_DEPS`, `serverOnlyOwner`, `isServerOnlySubpath`, `serverOnlySpecifiers`, `serverOnlyFiles` |
| `eslint-rules/server-only-relative.mjs` | Правило: відносний імпорт у server-only дерево ззовні нього заборонений |
| `tests/eslint-rules/server-only-relative.test.ts` | Фікстури правила (5 «ловить», 5 «пропускає») |
| `tests/lib/dist-graph.ts` | Спільний обхід `dist`: `distFiles`, `relativeImports`, `closure` |
| `tests/dist-server-boundary.test.ts` | Гейт партиції `dist` ядра + `.d.ts` сателітів (packaging-suite) |
| `tests/release-gates.test.ts` | Точний склад і порядок `GATES` релізу, включно з `pilot:pack` |
| `packages/simplycms/tsdown.config.ts` | Дві збірки ядра; entry з exports; група за декларацією |
| `packages/simplycms-theme-solarstore/tsdown.config.ts` | Тема: 1 entry, декларації бандлером |
| `packages/simplycms-plugin-faq/tsdown.config.ts` | Плагін: 2 конфіги по одному entry (d.ts без спільних чанків) |

**Змінюються:**

| Файл | Що саме |
|---|---|
| `packages/simplycms/package.json` | exports: `+ ./contracts/server-only`, `- ./storefront` (обидві мапи); скрипт `build`; `sideEffects: false` |
| `packages/simplycms/tsup.config.ts` | Task 1: `src/contracts/server-only.ts` у профіль `contracts`, `impl/index.ts` у профіль `admin-server`; Task 4: файл видаляється |
| `packages/simplycms/src/admin-server/**` → `admin-server/impl/**`; `storefront-routes/server/{is-admin,theme-record,revalidate-theme}.ts` → `storefront/loaders/` | Переїзд під префікси декларації (Task 1 Кроки 1а, 1б) разом із тестами й імпортерами |
| `packages/simplycms/src/contracts/README.md` | Рядок таблиці про `server-only` |
| `eslint.config.mjs:1-10, 120-176, ~330` | Групи межі плагінів — похідні від декларації; реєстрація правила |
| `scripts/pilot-pack/gate-c.mjs:29-47, 186` | `SERVER_PAYLOAD` — похідний від декларації |
| `vite.config.ts`, `packages/create-simplycms-store/template/vite.config.ts`, `tests/pilot/store-template/vite.config.ts` | Import Protection (шаблон і оверлей — ідентично поза `#region pilot-only`) |
| `tests/plugin-trust-boundary.test.ts` | Кейс на похідні групи |
| `tests/dist-import-meta.test.ts:36-77, 7-17, 93` | Хелпер графа замість власного; текст без tsup |
| `vitest.packaging.config.ts` | alias `simplycms`; новий тест у `include` |
| `tests/dts-toolchain.test.ts` | Читає `tsdown.config.ts`; асерти скрипта `build` |
| `tests/tsup-config-typecheck.test.ts` → `tests/build-config-typecheck.test.ts` | Глоб `tsdown.config.ts`; якір `platform`; код 2322 |
| `tests/tier-boundary/zones.ts:45` | Фікстура `simplycms/storefront` → `simplycms/storefront/loaders` |
| `packages/simplycms-{theme-solarstore,plugin-faq}/package.json` | Скрипти `build`/`prepublishOnly`; `sideEffects: false` |
| `package.json` (корінь) | `+ tsdown`, `- tsup` |
| `scripts/release/gates.mjs` | `+ pilot:pack` |
| `scripts/build-packages.mjs`, `packages/simplycms/tsconfig.dts.json`, сім файлів `src/**` (Task 5) | Коментарі називають механізм, а не tsup |
| `CLAUDE.md`, `docs/architecture/test-contours.md`, `docs/architecture/plugins.md`, `docs/architecture/themes.md`, `docs/architecture/release-process.md`, `packages/README.md`, `.github/instructions/{tooling,ui-architecture}.instructions.md`, `docs/tasks/platform-roadmap.md` | Опис тулчейна і межі |

**Видаляються:**

| Файл | Коли |
|---|---|
| `packages/simplycms-plugin-faq/tsup.config.ts`, `packages/simplycms-theme-solarstore/tsup.config.ts` | Task 3 |
| `packages/simplycms/tsup.config.ts`, `packages/simplycms/src/storefront/index.ts` | Task 4 |

## Декларація межі та її споживачі

| Споживач | Механізм | Що ловить | Де доводиться |
|---|---|---|---|
| `tsdown.config.ts` ядра | entry з `SERVER_ONLY` → серверна збірка | серверний код у чанку клієнтської збірки — неможливий за побудовою | Task 4 |
| `tests/dist-server-boundary.test.ts` | closure(server entry) ∩ closure(client entry) = ∅ по відносних імпортах `dist` | регрес розкладки (грубий склад груп, відносний імпорт у стаб) | Task 2 (esbuild), Task 4 (tsdown) |
| `eslint-rules/server-only-relative.mjs` | резолв відносного специфікатора у субшлях | інлайн серверних нутрощів у клієнтський модуль на рівні джерела | Task 1 |
| групи `no-restricted-imports` для плагінів | похідні від `SERVER_ONLY` + літерали поверхні | плагін імпортує серверний граф | Task 1 (`tests/plugin-trust-boundary.test.ts`) |
| `scripts/pilot-pack/gate-c.mjs` | `SERVER_PAYLOAD` з `SERVER_ONLY` | серверний вантаж у клієнтських чанках скретч-магазину | Task 1, Task 4 |
| Import Protection Start (хост, шаблон, пілот) | `specifiers` + `files`, `include: ['**']`, `behavior: 'error'` | те саме, але в КОЖНОМУ магазині, dev і build, з трасою імпорту | Task 1 |

Склад `SERVER_ONLY`: `db`, `auth`, `schema`, `storefront`,
`storefront-routes/seo`, `admin-server/impl`.
🔴 НЕ входять serverFn-модулі `plugin-sdk/server`, `themes/server`,
`plugins/server`, `admin-server` (стаб), `storefront-routes/server/*` (після
Task 1 Крок 1б там лишаються ЛИШЕ serverFn-модулі та ізоморфні схеми/мапери
`checkout-input`, `product-list-item`), `core/lib/*`: їх імпортує клієнт, а компілятор Start замінює хендлери
RPC-стабами і прибирає осиротілі серверні імпорти. Перевірено 2026-09-02:
включення трьох перших дало 5 хибних спрацювань Import Protection на чистому
хості (`usePluginTable` → `plugin-sdk/server`, `bootstrap` → `plugins/server`,
`bootstrapThemes` → `themes/server`). Legacy `supabase/*` теж не входить:
`supabase/keys` легально спільний для anon- і browser-клієнта; Gate C тримає
його літералами до К3.

## Розкладка збірки ядра

| Група | Entry (з dev-`exports`) | Спільні чанки | platform |
|---|---|---|---|
| клієнтська | усе, що не server-only: `index`, `contracts/*`, `domain/*`, `supabase/*`, `react-query/*`, `runtime`, `i18n`, `ui/*`, `themes/*` (включно з `themes/server`), `plugins/*` (включно з `plugins/server`), `plugin-sdk/*` (включно з `plugin-sdk/server`), `*-ui/*`, `admin/*`, `admin-data`, `admin-server` (стаб), `core/*`, `storefront-routes/*` крім `seo` (serverFn-модулі `server/*` та ізоморфні схеми/мапери) | між собою — так | `node` |
| серверна | `db`, `auth`, `schema`, `schema/relations`, `schema/types`, `storefront/loaders`, `storefront/seo`, `storefront-routes/seo/{interceptor,robots,sitemap}`, `admin-server/impl/index` | між собою — так | `node` |

Виміряно на прототипі (18 конфігів ред. 2, ті самі entry): 0,4 с wall,
634 МБ max RSS проти 2,1 с / 448 МБ у tsup; ≈20 спільних чанків замість 267;
дублювання модулів немає (`ThemeRegistryClass` рівно один, `createContext`
13 у обох). Дві збірки замість вісімнадцяти лише зменшать пік.

---

### Task 1: Декларація межі й пʼять її споживачів

**Files:**
- Create: `packages/simplycms/src/contracts/server-only.ts`
- Create: `eslint-rules/server-only-relative.mjs`
- Create: `tests/eslint-rules/server-only-relative.test.ts`
- Modify: `packages/simplycms/package.json` (обидві exports-мапи)
- Modify: `packages/simplycms/tsup.config.ts` (профілі `contracts`, `admin-server`)
- Move: `packages/simplycms/src/admin-server/{impl.ts,resource.ts,subset.ts,operations/,resources/,__tests__/}` → `packages/simplycms/src/admin-server/impl/` (Крок 1а)
- Move: `packages/simplycms/src/storefront-routes/server/{is-admin,theme-record,revalidate-theme}.ts` → `packages/simplycms/src/storefront/loaders/` (Крок 1б)
- Modify: `packages/simplycms/src/storefront/loaders/index.ts`, `packages/simplycms/src/storefront-routes/server/{auth,themes}.ts`, `packages/simplycms/routes/storefront/api/revalidate-theme.tsx`, `packages/simplycms/src/storefront-routes/__tests__/{revalidate-theme,revalidate-theme-route}.test.ts`, `packages/simplycms/src/core/lib/price-type.ts:28`, `packages/simplycms/src/themes/server/registry-db.ts:16`
- Modify: `packages/simplycms/src/contracts/README.md`
- Modify: `eslint.config.mjs:1-10, 120-176, ~330-336`
- Modify: `scripts/pilot-pack/gate-c.mjs:1-12, 29-47, 186`
- Modify: `vite.config.ts:1-4, 21-31`
- Modify: `packages/create-simplycms-store/template/vite.config.ts`
- Modify: `tests/pilot/store-template/vite.config.ts`
- Modify: `tests/plugin-trust-boundary.test.ts`

**Interfaces:**
- Produces (споживають Task 2, 4, 5):
  - `SERVER_ONLY: readonly ['db','auth','schema','storefront','storefront-routes/seo','admin-server/impl']`
  - `SERVER_ONLY_DEPS: readonly ['pg','drizzle-orm','drizzle-zod']`
  - `serverOnlyOwner(subpath: string): string | null` — префікс декларації або null
  - `isServerOnlySubpath(subpath: string): boolean`
  - `serverOnlySpecifiers(): RegExp[]`, `serverOnlyFiles(): RegExp[]` — для Import Protection
  - субшлях `simplycms/contracts/server-only` в обох exports-мапах.
- Consumes: нічого нового.

Задача йде ПЕРШОЮ і повністю на чинному tsup: декларація й усі споживачі
мусять бути зеленими до того, як міняється бандлер, — інакше не відрізнити
регресію міграції від дефекту гейта.

- [ ] **Крок 1: Написати декларацію**

Створити `packages/simplycms/src/contracts/server-only.ts`:

```ts
/**
 * Межа довіри клієнт/сервер ядра — ЄДИНА декларація (трек T, 2026-09-02).
 *
 * Субшлях у списку означає: модуль існує лише на сервері й НІКОЛИ не
 * імпортується клієнтським кодом напряму. serverFn-модулі сюди НЕ входять
 * (`admin-server`, `plugin-sdk/server`, `themes/server`, `plugins/server`,
 * `storefront-routes/server/*`, `core/lib/*`): їх клієнт імпортує легально,
 * а компілятор Start замінює хендлери RPC-стабами і прибирає осиротілі
 * серверні імпорти. Перевірено збіркою хоста 2026-09-02: `plugin-sdk/server`,
 * `themes/server` і `plugins/server` у цьому списку дають пʼять хибних
 * спрацювань Import Protection на чистому коді.
 *
 * 🔴 Тут лише ДАНІ (тір T0 — нуль рантайм-залежностей). Читачів пʼять, кожен
 * своїм механізмом, і жоден не тримає власної копії списку:
 *   1. `packages/simplycms/tsdown.config.ts` — серверна група збірки;
 *   2. `tests/dist-server-boundary.test.ts` — партиція `dist` (packaging-suite);
 *   3. `eslint.config.mjs` + `eslint-rules/server-only-relative.mjs` — межа
 *      для плагінів і заборона відносного імпорту в server-only дерево;
 *   4. `scripts/pilot-pack/gate-c.mjs` — серверний вантаж у клієнтських чанках;
 *   5. `vite.config.ts` хоста, шаблону й пілота — Import Protection Start.
 *
 * Legacy `supabase/*` навмисно НЕ тут: `supabase/keys` легально спільний для
 * anon- і browser-клієнта; Gate C тримає ці два файли літералами до К3.
 */
export const SERVER_ONLY = [
  'db',
  'auth',
  'schema',
  'storefront',
  // Побудова sitemap/robots і перехоплювач SEO-запитів: їх кличе лише
  // серверний entry магазину (`src/server.ts`), `sitemap` тягне лоадери.
  'storefront-routes/seo',
  // Після Task 1 Крок 1а — ЦІЛЕ піддерево нутрощів адмінки (index + resource +
  // operations + resources + subset); стаб `admin-server/index` — клієнт.
  'admin-server/impl',
] as const;

/** Зовнішні залежності, що існують лише на сервері. */
export const SERVER_ONLY_DEPS = ['pg', 'drizzle-orm', 'drizzle-zod'] as const;

/** Префікс декларації, під яким лежить субшлях (без `simplycms/`), або null. */
export const serverOnlyOwner = (subpath: string): string | null =>
  SERVER_ONLY.find((p) => subpath === p || subpath.startsWith(`${p}/`)) ??
  null;

export const isServerOnlySubpath = (subpath: string): boolean =>
  serverOnlyOwner(subpath) !== null;

const alternation = SERVER_ONLY.join('|');

/**
 * Патерни для Import Protection (Vite-плагін Start), клієнтське середовище.
 *
 * `specifiers` ловлять bare-імпорт у магазині (там alias-ів немає); `files` —
 * резолвлений шлях, бо в монорепо alias `simplycms/*` спрацьовує РАНІШЕ за
 * перевірку і специфікатор до неї не доходить (виміряно 2026-09-02: без
 * `files` витік `simplycms/db` у роут хоста збирався зеленим).
 */
export const serverOnlySpecifiers = (): RegExp[] => [
  new RegExp(`^simplycms/(${alternation})(/|$)`),
  ...SERVER_ONLY_DEPS.map((dep) => new RegExp(`^${dep}(/|$)`)),
  // Корінь better-auth — сервер; `better-auth/react` — клієнтський SDK.
  /^better-auth(\/(?!react)|$)/,
];

export const serverOnlyFiles = (): RegExp[] => [
  new RegExp(
    `(packages/simplycms/src|simplycms/dist)/(${alternation})(/|\\.[tj]sx?$)`,
  ),
];
```

🔴 Файл мусить лишатися придатним для Node без транспіляції (його імпортують
`.mjs`-скрипти через розширення `.ts`): лише erasable-синтаксис — анотації
типів, `as const`, `import type`. Жодних `enum`, `namespace`, параметрів
конструктора з модифікаторами.

- [ ] **Крок 1а: Нутрощі адмінки — під префікс `admin-server/impl/`**

Декларація працює префіксами, а сьогодні server-only нутрощі адмінки
(`resource.ts`, `subset.ts`, `operations/*`, `resources/*`) лежать ПОРУЧ із
`impl.ts`, а не під ним: правило `server-only-relative` не бачило б
відносного `./resource` зі стаба, а Е3 однаково розкладає сутності як
`admin-server/impl/<entity>` (амендмент К3-9′). Переїзд — одна операція:

```bash
cd packages/simplycms/src/admin-server
mkdir impl && git mv impl.ts impl/index.ts && git mv resource.ts subset.ts operations resources __tests__ impl/
cd ../../../..
```

Відносні імпорти всередині піддерева не змінюються (усі сусіди переїхали
разом); стаб `index.ts` імпортує лише bare `simplycms/admin-server/impl`, який
тепер резолвиться в `impl/index.ts`. Оновити три посилання на файл:
1. `packages/simplycms/package.json`: у `exports` —
   `"./admin-server/impl": "./src/admin-server/impl/index.ts"`; у
   `publishConfig.exports` — `"types": "./dist/admin-server/impl/index.d.ts"`,
   `"import": "./dist/admin-server/impl/index.js"`;
2. `packages/simplycms/tsup.config.ts`, профіль `admin-server`:
   `'src/admin-server/impl.ts'` → `'src/admin-server/impl/index.ts'`;
3. `scripts/pilot-pack/gate-c.mjs`: `existsSync(join(adminServerDist, 'impl.js'))`
   → `existsSync(join(adminServerDist, 'impl/index.js'))`, і в тексті помилки
   поруч «index.js (стаб) + impl.js (нутрощі)» → «+ impl/index.js».

Перевірка: `pnpm vitest run packages/simplycms/src/admin-server` — зелено
(тести переїхали разом, їхні `../resource` лишились чинними).

- [ ] **Крок 1б: Серверні хелпери зі `storefront-routes/server` — у `storefront/loaders`**

У `storefront-routes/server/` поруч із serverFn-модулями лежать три ЗВИЧАЙНІ
серверні функції: `is-admin.ts` (`checkIsAdmin`: `simplycms/auth` +
`getRequest`), `theme-record.ts` (`loadActiveTheme`/`invalidateThemeCache`:
drizzle + схема + лоадери) і `revalidate-theme.ts` (HTTP-хендлер
`POST /api/revalidate-theme`). serverFn-модулі `auth.ts` і `themes.ts` тягнуть
їх ВІДНОСНО — у клієнтській збірці вони стають спільними чанками, і межу
тримає лише DCE компілятора Start. Це той самий клас, з якого 2026-08-24 у
`storefront/loaders` переїхав `withSessionDb` (див. шапку
`storefront/loaders/session.ts`); ці три — його залишок. Після переїзду
`storefront-routes/server/*` містить лише serverFn-модулі та ізоморфні
схеми/мапери (`checkout-input`, `product-list-item`), а серверні хелпери
живуть під префіксом декларації і збираються серверною групою.

```bash
cd packages/simplycms/src
git mv storefront-routes/server/is-admin.ts storefront/loaders/is-admin.ts
git mv storefront-routes/server/theme-record.ts storefront/loaders/theme-record.ts
git mv storefront-routes/server/revalidate-theme.ts storefront/loaders/revalidate-theme.ts
grep -n "withStorefrontDb" storefront/loaders/db.ts | head -1
cd ../../..
```

(grep мусить дати рядок: `withStorefrontDb` живе в `./db`.) Правки:
1. `storefront/loaders/theme-record.ts:4`:
   `import { withStorefrontDb, type JsonValue } from 'simplycms/storefront/loaders';` →
   `import { withStorefrontDb } from './db';` та окремо
   `import type { JsonValue } from 'simplycms/storefront/loaders';`
   (type-only self-import стирається при збірці — рантайм-циклу немає);
   `revalidate-theme.ts` та `is-admin.ts` імпортів не міняють (`./is-admin`,
   `./theme-record` — тепер сусіди в тій самій теці);
2. `storefront/loaders/index.ts` — у кінець барелю:
   ```ts
   export * from './is-admin';
   export * from './theme-record';
   export * from './revalidate-theme';
   ```
3. `storefront-routes/server/auth.ts:4`: `import { checkIsAdmin } from './is-admin';`
   → `import { checkIsAdmin } from 'simplycms/storefront/loaders';`
4. `storefront-routes/server/themes.ts:2`: `import { loadActiveTheme } from './theme-record';`
   → `import { loadActiveTheme } from 'simplycms/storefront/loaders';`
   (якщо там є ще `type ThemeRecord` — так само з барелю);
5. `packages/simplycms/routes/storefront/api/revalidate-theme.tsx:2`:
   `from 'simplycms/storefront-routes/server/revalidate-theme'` →
   `from 'simplycms/storefront/loaders'`;
6. `storefront-routes/__tests__/revalidate-theme-route.test.ts:16,19,24`:
   `vi.mock('simplycms/storefront-routes/server/is-admin', …)` →
   `vi.mock('../../storefront/loaders/is-admin', …)`, так само для
   `theme-record`; `import { revalidateTheme } from '../server/revalidate-theme'`
   → `from '../../storefront/loaders/revalidate-theme'`;
7. `storefront-routes/__tests__/revalidate-theme.test.ts:120-121`:
   `'../server/revalidate-theme'` → `'../../storefront/loaders/revalidate-theme'`,
   `'../server/theme-record'` → `'../../storefront/loaders/theme-record'`;
8. коментарі зі старим шляхом: `core/lib/price-type.ts:28` і
   `themes/server/registry-db.ts:16` — «`storefront-routes/server/is-admin`»
   → «`storefront/loaders/is-admin`».

Перевірка: `pnpm vitest run packages/simplycms/src/storefront-routes packages/simplycms/src/storefront`
— зелено; `git grep -n "server/is-admin\|server/theme-record\|server/revalidate-theme" -- packages src`
— 0 збігів.

- [ ] **Крок 2: Субшлях в exports і в чинній збірці tsup**

У `packages/simplycms/package.json`, у кореневу мапу `exports` після ключа
`"./contracts/entities"` додати:

```json
    "./contracts/server-only": "./src/contracts/server-only.ts",
```

У `publishConfig.exports` після блоку `"./contracts/entities"` додати:

```json
      "./contracts/server-only": {
        "types": "./dist/contracts/server-only.d.ts",
        "import": "./dist/contracts/server-only.js"
      },
```

У `packages/simplycms/tsup.config.ts`, профіль `contracts`, до масиву патернів
після `'src/contracts/entities.ts',` додати `'src/contracts/server-only.ts',`
— інакше `dist` не матиме JS-цілі до Task 4, і `published-exports-parity`
почервоніє.

- [ ] **Крок 3: README контрактів**

У `packages/simplycms/src/contracts/README.md`, у таблицю «Що всередині» після
рядка `simplycms/contracts/views/fixtures` додати:

```markdown
| `simplycms/contracts/server-only` | Декларація межі довіри клієнт/сервер: `SERVER_ONLY` (субшляхи ядра, що існують лише на сервері), `SERVER_ONLY_DEPS`, `isServerOnlySubpath`, і патерни `serverOnlySpecifiers()`/`serverOnlyFiles()` для Import Protection магазину. Лише дані — читачі: збірка ядра, гейт `dist-server-boundary`, лінт, Gate C, `vite.config.ts` магазину |
```

- [ ] **Крок 4: Групи межі плагінів — похідні від декларації**

У `eslint.config.mjs` до імпортів (після рядка 10) додати:

```js
import serverOnlyRelative from './eslint-rules/server-only-relative.mjs';
// 🔴 Розширення `.ts` обовʼязкове: конфіг вантажить Node без транспіляції
// (type stripping), а він резолвить лише явні розширення.
import {
  SERVER_ONLY,
  SERVER_ONLY_DEPS,
} from './packages/simplycms/src/contracts/server-only.ts';
```

Блок `const pluginTrustBoundaryImports = [ … ];` (рядки 120-162) замінити на:

```js
// 🔴 Похідне від ЄДИНОЇ декларації межі (`contracts/server-only.ts`): усі
// server-only субшляхи ядра й серверні залежності — bare і з підшляхами.
// Літерали нижче — те, що плагіну заборонено ПОНАД server-only: Supabase-шар
// адмінки (до К3) і serverFn-модулі ядра (`admin-server`, `plugin-sdk/server`):
// плагін кличе хуки SDK, а не хендлери під ними.
const serverOnlyImportGroup = [
  ...SERVER_ONLY.flatMap((sub) => [`simplycms/${sub}`, `simplycms/${sub}/*`]),
  ...SERVER_ONLY_DEPS.flatMap((dep) => [dep, `${dep}/*`]),
];
const pluginOnlySurfaceGroup = [
  'simplycms/supabase',
  'simplycms/supabase/*',
  '@supabase/*',
  'simplycms/plugin-sdk/server',
  'simplycms/plugin-sdk/server/*',
  'simplycms/admin-server',
  'simplycms/admin-server/*',
];
const pluginTrustBoundaryImports = [
  {
    group: [...pluginOnlySurfaceGroup, ...serverOnlyImportGroup],
    message:
      'Плагін працює лише через порти simplycms/plugin-sdk (межа довіри, спека §7).',
  },
  // Flat config замінює опції правила цілком, тож глобальну зону
  // `simplycms/db/client` доливаємо сюди явно — інакше блок мовчки зняв би її
  // з `plugins/**` (той самий прийом, що з i18n-селекторами в env-зоні).
  dbClientImportGroup,
];
```

Блок `const pluginTrustBoundarySyntax = [ … ];` (рядки 164-174) замінити на:

```js
// no-restricted-imports НЕ бачить динамічний import() — його ловить окремий
// селектор (знахідка рев'ю Фази 3). Regex будується з тих самих списків, що
// й групи вище; `/` у селекторі ESLint пишеться як \u002F.
const esq = (items) => items.map((s) => s.replace(/\//g, '\\u002F')).join('|');
const pluginTrustBoundarySyntax = [
  {
    selector: `ImportExpression > Literal[value=/^(?:simplycms\\u002F(?:supabase|plugin-sdk\\u002Fserver|admin-server|${esq(SERVER_ONLY)})(?:\\u002F.*)?|@supabase\\u002F.*|(?:${esq(SERVER_ONLY_DEPS)})(?:\\u002F.*)?)$/]`,
    message:
      'Плагін працює лише через порти simplycms/plugin-sdk (межа довіри, спека §7) — динамічний import() теж.',
  },
];
```

- [ ] **Крок 5: Правило проти відносного імпорту в server-only дерево**

Створити `eslint-rules/server-only-relative.mjs`:

```js
import { dirname, relative, resolve, sep } from 'node:path';
import { serverOnlyOwner } from '../packages/simplycms/src/contracts/server-only.ts';

// Заборона ВІДНОСНОГО імпорту в server-only дерево ззовні нього (трек T).
//
// 🔴 Чому окреме правило, а не тір-зони: тір-зони стережуть напрямок шарів,
// а тут межа проходить УСЕРЕДИНІ шару — `admin-server/index.ts` (стаб) лежить
// поруч із `admin-server/impl.ts` (нутрощі). Відносний `./impl` заінлайнив би
// серверні нутрощі в клієнтський стаб: без чанка, без сліду в dist, без
// спрацювання гейта партиції. Ловити це можна лише на джерелі.
//
// Усередині одного server-only дерева відносні імпорти легальні
// (`storefront/loaders/session.ts` → `./db`); між ДВОМА деревами — ні
// (`auth` → `../db/client` продублював би пул у auth.js): перехід між
// деревами — лише bare-субшляхом, який бандлер лишає зовнішнім.

const SRC = resolve(import.meta.dirname, '../packages/simplycms/src');

/** Субшлях файла відносно src ядра (`db`, `admin-server/impl/x`) або null поза src. */
const subpathOf = (absolute) => {
  const rel = relative(SRC, absolute).split(sep).join('/');
  if (rel.startsWith('..')) return null;
  return rel.replace(/\.(?:[cm]?[jt]sx?)$/, '').replace(/\/index$/, '');
};

/** Рядок специфікатора: літерал або template literal без підстановок (`import(\`./impl\`)`). */
const specifierOf = (source) => {
  if (!source) return null;
  if (typeof source.value === 'string') return source.value;
  if (source.type === 'TemplateLiteral' && source.expressions.length === 0) {
    return source.quasis[0]?.value.cooked ?? null;
  }
  return null;
};

export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      crossesBoundary:
        'Відносний імпорт «{{source}}» веде в server-only дерево `{{owner}}` — ' +
        'імпортуй bare-субшляхом `simplycms/{{owner}}…` (межа довіри, contracts/server-only.ts).',
    },
  },
  create(context) {
    const importer = subpathOf(context.filename);
    if (importer === null) return {};
    const importerOwner = serverOnlyOwner(importer);
    const check = (node) => {
      const source = specifierOf(node.source);
      if (source === null || !source.startsWith('.')) return;
      const target = subpathOf(resolve(dirname(context.filename), source));
      const owner = target === null ? null : serverOnlyOwner(target);
      if (owner === null || owner === importerOwner) return;
      context.report({
        node,
        messageId: 'crossesBoundary',
        data: { source, owner },
      });
    };
    return {
      ImportDeclaration: check,
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check,
      ImportExpression: check,
    };
  },
};
```

Зареєструвати в `eslint.config.mjs` поруч із блоком `'simplycms-serverfn'`
(рядки ~330-336), окремим елементом масиву:

```js
  {
    files: ['packages/simplycms/src/**/*.{ts,tsx}'],
    plugins: {
      'simplycms-boundary': {
        rules: { 'server-only-relative': serverOnlyRelative },
      },
    },
    rules: { 'simplycms-boundary/server-only-relative': 'error' },
  },
```

- [ ] **Крок 6: Фікстури правила — спершу червоні**

Створити `tests/eslint-rules/server-only-relative.test.ts`:

```ts
import { resolve } from 'node:path';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import rule from '../../eslint-rules/server-only-relative.mjs';

// Фікстури правила server-only-relative (трек T). Шлях файла — частина
// вхідних даних правила: воно резолвить специфікатор ВІДНОСНО імпортера і
// класифікує обидва кінці за деклараціями `contracts/server-only.ts`.

const REPO = resolve(import.meta.dirname, '../..');
const linter = new Linter({ configType: 'flat' });
const config: Linter.Config[] = [
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { b: { rules: { 'server-only-relative': rule } } },
    rules: { 'b/server-only-relative': 'error' },
  },
];
const lint = (code: string, file: string) =>
  linter.verify(code, config, {
    filename: resolve(REPO, 'packages/simplycms/src', file),
  });

describe('server-only-relative (трек T)', () => {
  it.each([
    ['стаб → нутрощі', "import { ops } from './impl';", 'admin-server/index.ts'],
    ['стаб → нутрощі в теці', "export * from './impl/orders';", 'admin-server/index.ts'],
    ['динамічний import()', "const m = import('./impl');", 'admin-server/index.ts'],
    ['динамічний import() з template literal', "const m = import(\`./impl\`);", 'admin-server/index.ts'],
    ['між двома server-only деревами', "import { pool } from '../db/client';", 'auth/index.ts'],
    ['клієнтський тір → лоадери', "import { x } from '../storefront/loaders/db';", 'core/lib/x.ts'],
  ])('ловить: %s', (_label, code, file) => {
    expect(lint(code, file)).toHaveLength(1);
  });

  it.each([
    ['усередині server-only дерева', "import { withCustomerDb } from './db';", 'storefront/loaders/session.ts'],
    ['усередині impl/', "import { defineAdminResource } from './resource';", 'admin-server/impl/orders.ts'],
    ['bare-субшлях', "import { ops } from 'simplycms/admin-server/impl';", 'admin-server/index.ts'],
    ['відносний імпорт клієнтського модуля', "import { x } from './usePluginT';", 'plugin-sdk/index.ts'],
    ['файл поза src ядра', "import { x } from './impl';", '../../../src/routes/my/x.ts'],
  ])('пропускає: %s', (_label, code, file) => {
    expect(lint(code, file)).toHaveLength(0);
  });
});
```

```bash
pnpm vitest run tests/eslint-rules/server-only-relative.test.ts
```

Очікувано: 11 passed (правило вже написане в Кроці 5; якщо якийсь кейс
червоний — лагодити правило, не фікстуру).

- [ ] **Крок 7: Кейс у негативному контролі межі плагінів**

У `tests/plugin-trust-boundary.test.ts`, у `describe('межа довіри плагінів …')`,
додати:

```ts
  it('похідна від декларації межі: server-only субшляхи й серверні залежності', async () => {
    for (const bad of [
      "import { pool } from 'simplycms/db';",
      "import { ops } from 'simplycms/admin-server/impl';",
      "import { createSelectSchema } from 'drizzle-zod';",
    ]) {
      const errors = await boundaryErrors(bad, 'plugins/hello-world/fixture.ts');
      expect(errors, bad).toHaveLength(1);
    }
  });
```

- [ ] **Крок 8: Gate C читає декларацію**

У `scripts/pilot-pack/gate-c.mjs` після імпортів `node:fs`/`node:path` додати:

```js
// 🔴 Розширення `.ts`: скрипт виконує Node без транспіляції.
import {
  SERVER_ONLY,
  SERVER_ONLY_DEPS,
} from '../../packages/simplycms/src/contracts/server-only.ts';
```

Масив `const SERVER_PAYLOAD = [ … ];` (рядки 29-47) замінити на:

```js
const SERVER_PAYLOAD = [
  // Legacy Supabase-шар адмінки (зникає з К3): у декларації межі його немає,
  // бо `supabase/keys` легально спільний для anon- і browser-клієнта.
  /simplycms\/dist\/supabase\/server-client/,
  // Anon-клієнт читає голий `process.env` у рантаймі (контракт серверного
  // env, спека CLI v1 §7): при витоку в клієнтський бандл він упав би вже в
  // браузері (там `process` немає) — гейт має зловити раніше.
  /simplycms\/dist\/supabase\/anon-client/,
  // 🔴 Похідне від ЄДИНОЇ декларації межі (contracts/server-only.ts): кожен
  // server-only субшлях — як файл (`dist/admin-server/impl.js`) і як тека
  // (`dist/storefront/loaders/…`). Це читач списку, не його копія.
  ...SERVER_ONLY.map((sub) => new RegExp(`simplycms/dist/${sub}(/|\\.js)`)),
  // Серверні залежності — сегментом шляху або цілим специфікатором, але НЕ
  // підрядком (інакше `pg` збігся б із будь-яким `…jpg…`). Окремо від
  // субшляхів, бо витекти вони можуть і без модулів ядра — прямим імпортом
  // із роут-файлу чи теми.
  ...SERVER_ONLY_DEPS.map((dep) => new RegExp(`(^|[/"'])${dep}([/"']|$)`)),
];
```

Рядок 186 `OK   server-fn заглушок ${stubs}, серверного вантажу (server-client, loaders, admin-server/impl) — 0`
замінити на `OK   server-fn заглушок ${stubs}, серверного вантажу (SERVER_ONLY + legacy supabase + deps) — 0`.

- [ ] **Крок 9: Import Protection у трьох Vite-конфігах**

🔴 Три файли, дві форми імпорту. Хост (`vite.config.ts` кореня) НЕ має
залежності `simplycms` в `package.json` — резолвить через alias і tsconfig
paths, а конфіг Vite бандлить esbuild-ом без alias-ів, — тож імпорт ВІДНОСНИЙ.
Шаблон і пілотний оверлей — bare-субшлях; ці два файли мусять бути
байт-ідентичними поза блоками `#region pilot-only`
(`tests/create-store-template-parity.test.ts:90-107`).

`vite.config.ts` (корінь), після імпорту `node:path`:

```ts
// Хост не має залежності `simplycms` — резолвить ядро alias-ом, якого
// конфіг Vite не бачить, тож декларація межі береться відносним шляхом.
import {
  serverOnlyFiles,
  serverOnlySpecifiers,
} from './packages/simplycms/src/contracts/server-only';
```

`packages/create-simplycms-store/template/vite.config.ts` і
`tests/pilot/store-template/vite.config.ts`, після імпорту `node:path`
(поза `#region pilot-only`):

```ts
import {
  serverOnlyFiles,
  serverOnlySpecifiers,
} from 'simplycms/contracts/server-only';
```

У всіх трьох — у виклику `tanstackStart({ … })` після `server: { entry: './server.ts' },`:

```ts
        // 🔴 Межа довіри клієнт/сервер у САМІЙ збірці магазину. Server-only
        // субшляхи ядра й серверні залежності не можуть потрапити в
        // клієнтський граф: Start валить збірку (dev і build) з трасою
        // імпорту. Список — єдина декларація ядра, не копія. `include: ['**']`
        // обовʼязковий: за замовчуванням перевіряються лише імпортери в `src/`,
        // а теми, плагіни й сам пакет ядра в node_modules лишилися б поза
        // перевіркою. Перевірка йде ПІСЛЯ компіляції serverFn, тож стаби з
        // серверними імпортами в тілах хендлерів її не тригерять.
        importProtection: {
          behavior: 'error',
          include: ['**'],
          client: {
            specifiers: serverOnlySpecifiers(),
            files: serverOnlyFiles(),
          },
        },
```

- [ ] **Крок 10: Позитивний і негативний контроль Import Protection на хості**

```bash
pnpm build
```

Очікувано: зелено (client + server), без `[import-protection]` у виводі.
Виміряно 2026-09-02 з фінальним складом `SERVER_ONLY`: чиста збірка хоста в
режимі `error` з `include: ['**']` — 0 порушень (`host-build-ip-final-clean.log`
у scratchpad сесії аналізу); з роутом-витоком — `EXIT=1`, «Denied by file
pattern», importer `src/routes/my/ip-leak.tsx` (`host-build-ip-final-leak.log`).

Негативний контроль — тимчасовий роут із живим серверним імпортом:

```bash
cat > src/routes/my/ip-leak.tsx <<'EOF'
import { createFileRoute } from '@tanstack/react-router';
import { withActor } from 'simplycms/db';

export const Route = createFileRoute('/my/ip-leak')({
  component: () => <div>{String(typeof withActor)}</div>,
});
EOF
pnpm build; echo "EXIT=$?"
rm src/routes/my/ip-leak.tsx && git checkout -- src/routeTree.gen.ts
```

Очікувано: `EXIT=1`, у виводі `[import-protection] Import denied in client
environment`, `Denied by file pattern: …packages/simplycms/src…`, траса від
`src/client.tsx` до `ip-leak.tsx`. 🔴 Якщо збірка зелена — `files` не
застосувались (найімовірніше, регекс не збігся з відносним шляхом
`packages/simplycms/src/db/index.ts`); лагодити декларацію, не контроль.
Без Import Protection цей самий роут збирається зеленим і кладе `Pool`
з `pg` у `dist/client/assets/ip-leak-*.js` (виміряно).

- [ ] **Крок 11: Гейти**

```bash
pnpm lint && pnpm test && pnpm typecheck
pnpm build:packages && pnpm typecheck:template && pnpm test:packaging
pnpm pilot:pack
```

Очікувано: усе зелено. `pilot:pack` доводить ДВІ речі: bare-імпорт
`simplycms/contracts/server-only` у `vite.config.ts` скретч-магазину
резолвиться з tarball-а, і Gate C з похідним `SERVER_PAYLOAD` лишається
зеленим (тобто `auth` і `schema`, яких у старому списку не було, у
клієнтських чанках відсутні).

- [ ] **Крок 12: Коміт**

```bash
git add packages/simplycms/src/contracts/server-only.ts packages/simplycms/src/contracts/README.md \
  packages/simplycms/package.json packages/simplycms/tsup.config.ts \
  eslint.config.mjs eslint-rules/server-only-relative.mjs tests/eslint-rules/server-only-relative.test.ts \
  tests/plugin-trust-boundary.test.ts scripts/pilot-pack/gate-c.mjs \
  vite.config.ts packages/create-simplycms-store/template/vite.config.ts tests/pilot/store-template/vite.config.ts
git commit -m "feat(track-t): декларація межі клієнт/сервер + Import Protection магазину

Одна декларація simplycms/contracts/server-only замість чотирьох списків:
групи межі плагінів, правило server-only-relative, Gate C і Import
Protection Start у хості, шаблоні й пілоті читають її, не копіюють.
Негативний контроль: роут із живим імпортом simplycms/db валить pnpm build."
```

---

### Task 2: Гейт партиції `dist` і спільний хелпер графа

**Files:**
- Create: `tests/lib/dist-graph.ts`
- Create: `tests/dist-server-boundary.test.ts`
- Modify: `tests/dist-import-meta.test.ts:36-77`
- Modify: `vitest.packaging.config.ts`

**Interfaces:**
- Consumes: `SERVER_ONLY`, `isServerOnlySubpath` (Task 1).
- Produces: `distFiles(dir): string[]`, `relativeImports(code): string[]`,
  `closure(entries: Iterable<string>): Set<string>` у `tests/lib/dist-graph.ts`;
  гейт `dist-server-boundary` у packaging-suite, на який спираються Task 4 і 6.

Гейт заводиться на чинній збірці tsup і мусить бути зеленим (baseline): це
властивість, яку міграція зберігає. Виміряно на прототипі 2026-09-02:
9 серверних entry, 309 клієнтських, перетин замикань порожній — і на tsup, і
на tsdown.

- [ ] **Крок 1: Свіжий `dist`**

```bash
pnpm build:packages
```

- [ ] **Крок 2: Спільний хелпер графа**

Створити `tests/lib/dist-graph.ts`:

```ts
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// Обхід зібраного `dist` — спільний для гейтів packaging-suite
// (`dist-import-meta`, `dist-server-boundary`). Читає ФАЙЛИ на диску, а не
// tarball: у `.tgz` лягає той самий `dist/`, а його присутність там доводить
// `published-exports-parity`.

/** Усі JS-модулі всередині `dir` (рекурсивно), абсолютні шляхи. */
export const distFiles = (dir: string): string[] => {
  const out: string[] = [];
  const walk = (abs: string): void => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const next = join(abs, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (/\.[cm]?js$/.test(entry.name)) out.push(next);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
};

/**
 * Відносні специфікатори модуля (`./x`, `../x`) у ВСІХ трьох формах.
 *
 * 🔴 Динамічний `import("./chunk")` не менш важливий за статичний: саме ним
 * Rolldown виносить код в окремий чанк навіть за одного входу. І `from`
 * покриває обидві форми — `import x from` та `export * from`.
 */
export const relativeImports = (code: string): string[] => {
  const found = new Set<string>();
  const patterns = [
    /\bfrom\s*["'](\.[^"']*)["']/g,
    /^\s*import\s*["'](\.[^"']*)["']/gm,
    /\bimport\s*\(\s*["'](\.[^"']*)["']/g,
  ];
  for (const rx of patterns) {
    for (const match of code.matchAll(rx)) found.add(match[1]);
  }
  return [...found];
};

/** Транзитивне замикання по відносних імпортах від набору файлів. */
export const closure = (entries: Iterable<string>): Set<string> => {
  const seen = new Set<string>(entries);
  const queue = [...seen];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    for (const spec of relativeImports(readFileSync(file, 'utf8'))) {
      const next = resolve(dirname(file), spec);
      if (existsSync(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
};
```

- [ ] **Крок 3: `dist-import-meta` переходить на хелпер**

У `tests/dist-import-meta.test.ts` видалити локальні `distFiles` (рядки 36-47)
і `closure` (рядки 62-77), додати імпорт:

```ts
import { closure, distFiles } from './lib/dist-graph';
```

і в третьому тесті замінити `closure(entry)` на `[...closure([entry])]`.
Запустити, щоб переконатися, що нічого не змінилось:

```bash
pnpm vitest run --config vitest.packaging.config.ts tests/dist-import-meta.test.ts
```

Очікувано: 3 passed.

- [ ] **Крок 4: Alias у packaging-конфізі**

У `vitest.packaging.config.ts` до `defineConfig({ … })` додати блок
`resolve` (перед `test`):

```ts
  // Один base-prefix ключ, як у vitest.config.ts: гейти треку T імпортують
  // декларацію межі bare-субшляхом `simplycms/contracts/server-only`, а
  // `dts-toolchain` імпортує `tsdown.config.ts`, який робить те саме.
  resolve: {
    alias: { simplycms: resolve(__dirname, 'packages/simplycms/src') },
  },
```

та `import { resolve } from 'node:path';` угорі. У масив `include` після
`'tests/dts-toolchain.test.ts',` додати:

```ts
      // Партиція dist ядра на серверну й клієнтську групи + .d.ts сателітів
      // (трек T): ламається першою, коли серверний код потрапляє в чанк,
      // досяжний із клієнтського entry.
      'tests/dist-server-boundary.test.ts',
```

- [ ] **Крок 5: Гейт партиції**

Створити `tests/dist-server-boundary.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SERVER_ONLY,
  isServerOnlySubpath,
} from 'simplycms/contracts/server-only';
import { closure, distFiles, relativeImports } from './lib/dist-graph';

// Гейт межі клієнт/сервер у ЗІБРАНОМУ ядрі (трек T).
//
// 🔴 Інваріант — ПАРТИЦІЯ, а не «нуль відносних імпортів»: замикання
// серверних entry по відносних імпортах не перетинається із замиканням
// клієнтських. Спільний модуль у зібраному ESM проявляється рівно як
// відносний імпорт — чанком (`../loaders-XXXX.js`) або іншим entry
// (`./impl.js`: Rolldown веде спільні модулі ЧЕРЕЗ entry-файли). Bare-
// специфікатори (`pg`, `simplycms/db`) межу не порушують, а тримають: їх
// бандлер магазину або лишає зовнішніми, або компілятор Start прибирає разом
// із тілами хендлерів.
//
// Хто серверний — каже ЄДИНА декларація `contracts/server-only`; гейт
// перевіряє властивість артефакта і тому чинний до міграції й після неї.
// Що НЕ ловить: інлайн серверного модуля в клієнтський БЕЗ сліду в dist
// (відносний імпорт на джерелі) — це правило `server-only-relative`; і
// витік у сам бандл магазину — це Gate C пілота й Import Protection.

const ROOT = resolve(import.meta.dirname, '..');
const CORE = resolve(ROOT, 'packages/simplycms');
const DIST = join(CORE, 'dist');

/** JS-цілі publishConfig.exports, розгорнуті в реальні файли dist (wildcard включно). */
const entryFiles = (): string[] => {
  const pkg = JSON.parse(readFileSync(join(CORE, 'package.json'), 'utf8')) as {
    publishConfig: { exports: Record<string, string | Record<string, string>> };
  };
  const files = distFiles(DIST);
  const targets = Object.values(pkg.publishConfig.exports)
    .flatMap((value) => (typeof value === 'string' ? [value] : Object.values(value)))
    .filter((target) => target.endsWith('.js'));
  const expand = (target: string): string[] => {
    if (!target.includes('*')) return [resolve(CORE, target)].filter((f) => existsSync(f));
    const [prefix, suffix] = target.split('*');
    return files.filter((file) => {
      const rel = `./${relative(CORE, file)}`;
      return rel.startsWith(prefix) && rel.endsWith(suffix);
    });
  };
  return [...new Set(targets.flatMap(expand))];
};

/** `db/index.js` → `db`, `admin-server/impl.js` → `admin-server/impl`. */
const subpathOf = (file: string): string =>
  relative(DIST, file).replace(/\.js$/, '').replace(/\/index$/, '');

const read = (rel: string): string => readFileSync(join(DIST, rel), 'utf8');

describe('межа клієнт/сервер у зібраному ядрі', () => {
  it('dist ядра зібраний і кожне server-only дерево має entry (інакше гейт мовчав би)', () => {
    expect(existsSync(DIST), 'спершу `pnpm build:packages`').toBe(true);
    const server = entryFiles().filter((f) => isServerOnlySubpath(subpathOf(f)));
    for (const sub of SERVER_ONLY) {
      expect(
        server.some((f) => subpathOf(f) === sub || subpathOf(f).startsWith(`${sub}/`)),
        `у dist немає жодного entry під ${sub}`,
      ).toBe(true);
    }
  });

  it('замикання серверних entry не перетинається із замиканням клієнтських', () => {
    const entries = entryFiles();
    const server = entries.filter((f) => isServerOnlySubpath(subpathOf(f)));
    const client = entries.filter((f) => !isServerOnlySubpath(subpathOf(f)));
    const clientClosure = closure(client);
    const shared = [...closure(server)]
      .filter((f) => clientClosure.has(f))
      .map((f) => relative(DIST, f));
    expect(
      shared,
      `серверний код досяжний із клієнтського entry — межа довіри пробита:\n${shared.join('\n')}`,
    ).toEqual([]);
  });

  it('стаб admin-server/index тримає impl BARE-специфікатором', () => {
    // На цьому розрізненні стоїть Gate C: у клієнті легальний СТАБ
    // (`dist/admin-server/index`), але не нутрощі (`dist/admin-server/impl`).
    const code = read('admin-server/index.js');
    expect(code).toContain('simplycms/admin-server/impl');
    expect(relativeImports(code).filter((s) => /\/impl(\/index)?(\.js)?$/.test(s))).toEqual([]);
  });

  // 🔴 Сателіти: інваріант стосується ДЕКЛАРАЦІЙ, а не JS. Їхні .d.ts емітить
  // бандлер (на відміну від ядра, де це tsc), і спільний d.ts-чанк дав би
  // ре-експорт через відносний файл — те, що ламає `moduleResolution: node`
  // у споживача, який не на `bundler`.
  it.each([
    'packages/simplycms-plugin-faq/dist/index.d.ts',
    'packages/simplycms-plugin-faq/dist/pages/FaqAdmin.d.ts',
    'packages/simplycms-theme-solarstore/dist/index.d.ts',
  ])('%s — декларація без відносних ре-експортів', (rel) => {
    const file = resolve(ROOT, rel);
    expect(existsSync(file), `немає ${rel} — спершу pnpm build:packages`).toBe(true);
    expect(relativeImports(readFileSync(file, 'utf8'))).toEqual([]);
  });
});
```

- [ ] **Крок 6: Зелено на baseline tsup**

```bash
pnpm vitest run --config vitest.packaging.config.ts tests/dist-server-boundary.test.ts
```

Очікувано: 6 passed (1 + 1 + 1 + 3).

- [ ] **Крок 7: Негативний контроль на esbuild**

🔴 Мутація мусить змінити ГРАФ модулів, а не лише опцію: між
`admin-server/index` і `impl` немає спільного локального модуля, тож сама
опція чанку не створює. Дві правки: відносний імпорт у стабі (створює
спільний модуль) і `splitting: true` для профілю `admin-server` (дозволяє
esbuild винести його в чанк; за `splitting: false` esbuild заінлайнив би
impl у стаб без сліду — саме той клас, який ловить лінт, а не цей гейт).

```bash
sed -i "s#from 'simplycms/admin-server/impl'#from './impl'#" packages/simplycms/src/admin-server/index.ts
python3 - <<'EOF'
import re, pathlib
p = pathlib.Path('packages/simplycms/tsup.config.ts')
s = p.read_text()
new, n = re.subn(r"('admin-server',\n\s+\['src/admin-server/index\.ts', 'src/admin-server/impl\.ts'\],\n\s+\{ splitting: )false", r"\1true", s)
assert n == 1, 'профіль admin-server не знайдено'
p.write_text(new)
EOF
pnpm --filter simplycms run build
pnpm vitest run --config vitest.packaging.config.ts tests/dist-server-boundary.test.ts
```

Очікувано: FAIL щонайменше на двох тестах — партиція (спільний чанк з
нутрощами impl досяжний і зі стаба, і з impl) і стаб (`./impl`).

🔴 Якщо зелено — гейт хибний, далі йти НЕ МОЖНА: розібрати
`grep -l "impl" packages/simplycms/dist/*.js packages/simplycms/dist/admin-server/*.js`
і полагодити гейт, не мутацію.

- [ ] **Крок 8: Відкотити мутацію, перезібрати, переконатись у зеленому**

```bash
git checkout -- packages/simplycms/tsup.config.ts packages/simplycms/src/admin-server/index.ts
pnpm --filter simplycms run build
pnpm vitest run --config vitest.packaging.config.ts tests/dist-server-boundary.test.ts
```

Очікувано: 6 passed.

- [ ] **Крок 9: Гейти й коміт**

```bash
pnpm lint && pnpm test && pnpm test:packaging
git add tests/lib/dist-graph.ts tests/dist-server-boundary.test.ts tests/dist-import-meta.test.ts vitest.packaging.config.ts
git commit -m "test(track-t): гейт партиції dist — серверні й клієнтські entry не ділять чанків

Baseline на tsup перед міграцією. Інваріант читає декларацію межі, тому
чинний до і після зміни бандлера. Негативний контроль: відносний імпорт
impl у стабі + splitting:true у профілі admin-server червонить."
```

---

### Task 3: tsdown у дереві + міграція сателітів

**Files:**
- Modify: `package.json` (devDependencies: `+ tsdown`)
- Create: `packages/simplycms-plugin-faq/tsdown.config.ts`
- Delete: `packages/simplycms-plugin-faq/tsup.config.ts`
- Modify: `packages/simplycms-plugin-faq/package.json:46-47`
- Create: `packages/simplycms-theme-solarstore/tsdown.config.ts`
- Delete: `packages/simplycms-theme-solarstore/tsup.config.ts`
- Modify: `packages/simplycms-theme-solarstore/package.json:37-38`

**Interfaces:**
- Produces: канонічний `base` опцій tsdown цього репо (переноситься в Task 4
  дослівно, крім `dts`).

Сателіти йдуть першими: два entry, декларації бандлером — найменші пакети, на
яких видно всі механізми. `tsup` лишається в дереві до Task 5 (ядро збирає
його до Task 4).

- [ ] **Крок 1: Поставити tsdown і перевірити єдину копію Rolldown**

```bash
pnpm add -Dw tsdown@0.22.14
pnpm why rolldown | grep -E "^rolldown@" | sort -u
pnpm dedupe --check
```

Очікувано: `tsdown` у `devDependencies` кореня. Vite 8 і tsdown обидва тягнуть
`rolldown ~1.2.0`, але свіжа резолюція може дати ДРУГУ версію (у scratch-
встановленні 2026-09-02 tsdown отримав 1.2.6 при 1.2.2 у Vite). Тому одразу:

```bash
pnpm dedupe && pnpm install --frozen-lockfile
pnpm why rolldown | grep -E "^rolldown@" | sort -u
```

Очікувано після dedupe: рівно ОДНА версія `rolldown@1.2.x` в обох споживачів.
🔴 Дві версії ПІСЛЯ dedupe — зупинись: план не передбачає двох копій
native-бандлера в дереві.

- [ ] **Крок 2: Звірити поверхню опцій встановленої версії**

```bash
grep -oE "^\s+(external|platform|fixedExtension|deps|dts|clean|target|tsconfig|sourcemap|hash|report|exports)\??:" node_modules/tsdown/dist/types-*.d.mts | sort -u
grep -n -B1 "external?: ExternalOption" node_modules/tsdown/dist/types-*.d.mts
```

Очікувано: усі поля є; над `external?:` стоїть `@deprecated Use … deps.neverBundle`.
Виміряно на офіційному tarball 0.22.14 (2026-09-02): дефолти
`platform = "node"`, `fixedExtension = platform === "node"`, `clean = true`,
`hash = true`, `report = true`, `failOnWarn = false`; `concurrency` читається
ЛИШЕ з CLI. Якщо вимір розійшовся — інша версія в lockfile, зупинись.

- [ ] **Крок 3: Конфіг плагіна**

`packages/simplycms-plugin-faq/tsdown.config.ts`:

```ts
import { defineConfig, type UserConfig } from 'tsdown';

// 🔴 ДВА конфіги, а не один із двома entry: декларації тут емітить бандлер
// (`dts: true`), і спільний d.ts-чанк між `index` і `pages/FaqAdmin`
// ре-експортував би типи через відносний файл — саме те, що гейт
// `dist-server-boundary` забороняє для .d.ts сателітів. Збірка з одним
// входом не має з чим ділити.
const base = {
  format: ['esm'],
  // Той самий platform, що був дефолтом tsup: builtins Node зовнішні без
  // попереджень, а в браузер код їде лише через бандлер магазину.
  // `fixedExtension` при platform node дав би `.mjs` повз exports.
  platform: 'node',
  fixedExtension: false,
  // Ядро приїжджає до магазину окремим пакетом; вбудовувати його копію
  // означало б дубль React-контекстів. `external` у tsdown deprecated.
  deps: { neverBundle: [/^simplycms(\/|$)/, /^@simplycms\//] },
  dts: true,
  tsconfig: './tsconfig.json',
  sourcemap: true,
  target: 'esnext',
  // tsdown чистить outDir ОДИН раз для всього масиву конфігів, до першого
  // запису (мемоізований cleanOutDir) — гонки між конфігами немає.
  clean: true,
} satisfies UserConfig;

export default defineConfig([
  { ...base, entry: { index: 'src/index.ts' } },
  { ...base, entry: { 'pages/FaqAdmin': 'src/pages/FaqAdmin.tsx' } },
]);
```

- [ ] **Крок 4: Скрипти плагіна**

У `packages/simplycms-plugin-faq/package.json`:

```json
    "build": "tsdown",
    "prepublishOnly": "tsdown"
```

- [ ] **Крок 5: Знімок, збірка, порівняння**

```bash
cd packages/simplycms-plugin-faq
find dist -type f | sort > "$SCRATCH/faq-before.txt"
rm -f tsup.config.ts
pnpm run build
find dist -type f | sort > "$SCRATCH/faq-after.txt"
diff "$SCRATCH/faq-before.txt" "$SCRATCH/faq-after.txt" && echo "НАБІР ФАЙЛІВ ІДЕНТИЧНИЙ"
grep -oE "from ['\"](\.[^'\"]*)['\"]" dist/index.js dist/pages/FaqAdmin.js dist/index.d.ts dist/pages/FaqAdmin.d.ts || echo "(відносних немає)"
find dist -name '*.mjs' | head
cd ../..
```

Очікувано: `НАБІР ФАЙЛІВ ІДЕНТИЧНИЙ` (index.js/.d.ts/.js.map + pages/FaqAdmin
те саме), `(відносних немає)`, жодного `.mjs`. Виміряно 2026-09-02: так і є;
форма d.ts інша (`//#region` і `import("simplycms/plugin-sdk").SdkPluginModule`
замість top-level import), і це не регресія — bare-специфікатор збережено.

- [ ] **Крок 6: Конфіг теми**

`packages/simplycms-theme-solarstore/tsdown.config.ts`:

```ts
import { defineConfig } from 'tsdown';

// Тема — один entry, тож питання спільних чанків не постає взагалі
// (на відміну від плагіна, див. його конфіг). Декларації емітить бандлер:
// поверхня типів теми — один `ThemeModule`, окремий крок tsc, як у ядрі,
// тут не потрібен. Опції — канон репо (див. plugin-faq).
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  platform: 'node',
  fixedExtension: false,
  deps: { neverBundle: [/^simplycms(\/|$)/, /^@simplycms\//] },
  dts: true,
  tsconfig: './tsconfig.json',
  sourcemap: true,
  target: 'esnext',
  clean: true,
});
```

У `packages/simplycms-theme-solarstore/package.json`:

```json
    "build": "tsdown",
    "prepublishOnly": "tsdown"
```

```bash
rm packages/simplycms-theme-solarstore/tsup.config.ts
cd packages/simplycms-theme-solarstore && pnpm run build && find dist -type f | sort && cd ../..
```

Очікувано: рівно `dist/index.js`, `dist/index.d.ts`, `dist/index.js.map`.

- [ ] **Крок 7: Гейти, conformance теми, коміт**

```bash
pnpm lint && pnpm test && pnpm typecheck
pnpm build:packages && pnpm typecheck:template && pnpm test:packaging
pnpm simplycms theme:conformance solarstore
git add package.json pnpm-lock.yaml packages/simplycms-plugin-faq packages/simplycms-theme-solarstore
git commit -m "build(track-t): сателіти на tsdown — plugin-faq і theme-solarstore

platform:'node' (той самий, що був дефолтом tsup), deps.neverBundle замість
deprecated external, clean один раз на масив. Плагін — два конфіги по entry,
бо .d.ts емітить бандлер і спільний d.ts-чанк ламав би резолв у споживача."
```

🔴 `tests/tsup-config-typecheck.test.ts` і далі глобить `packages/*/tsup.config.ts`:
після цієї задачі лишається лише конфіг ядра, тест зелений. Нові
`tsdown.config.ts` типізує кореневий `pnpm typecheck` (глоб `**/*.ts`).

---

### Task 4: Ядро — дві збірки, entry з exports, перемикання

**Files:**
- Create: `packages/simplycms/tsdown.config.ts`
- Delete: `packages/simplycms/tsup.config.ts`
- Delete: `packages/simplycms/src/storefront/index.ts`
- Modify: `packages/simplycms/package.json` (exports `./storefront`; скрипт `build`)
- Modify: `tests/tier-boundary/zones.ts:45`
- Modify: `tests/dts-toolchain.test.ts:19-33, 55-60`
- Modify: `tests/tsup-config-typecheck.test.ts` → `tests/build-config-typecheck.test.ts`

**Interfaces:**
- Consumes: `isServerOnlySubpath` (Task 1); гейт партиції (Task 2); `base` (Task 3).
- Produces: `tsdown.config.ts` як default-export масив із ДВОХ конфігів
  (`entry: Record<string,string>`), який читає `dts-toolchain`.

- [ ] **Крок 1: Baseline артефакта на tsup**

```bash
pnpm --filter simplycms run build
cd packages/simplycms
find dist -name '*.js' | sort > "$SCRATCH/core-js-before.txt"
node -e '
const { readFileSync } = require("node:fs");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const targets = Object.values(pkg.publishConfig.exports).flatMap(v => typeof v === "string" ? [v] : Object.values(v)).filter(t => t.endsWith(".js"));
console.log("js-цілей exports:", targets.length, "wildcard:", targets.filter(t => t.includes("*")).length);
' | tee "$SCRATCH/core-targets-before.txt"
grep -rl "ThemeRegistryClass" dist --include=*.js | wc -l
cd ../..
```

Очікувано: `js-цілей exports: 88 wildcard: 18`, `ThemeRegistryClass` рівно в 1
файлі. Кількість JS-файлів (`wc -l "$SCRATCH/core-js-before.txt"`, сьогодні 571)
ЗМІНИТЬСЯ — інший бандлер, інша розкладка чанків; це не сигнал.

- [ ] **Крок 2: Конфіг ядра**

`packages/simplycms/tsdown.config.ts`:

```ts
import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type UserConfig } from 'tsdown';
// Self-reference: конфіг лежить у пакеті, Node резолвить `simplycms/*` через
// власний `exports` (dev-мапа → src), tsc — через paths кореневого tsconfig.
import { isServerOnlySubpath } from 'simplycms/contracts/server-only';

// Збірка ядра — ДВІ групи замість профілів (трек T, ред. 3).
//
// 🔴 Список entry НЕ пишеться руками: він виводиться з dev-`exports`
// package.json (ключ → джерело; у dist файл лягає за шляхом ДЖЕРЕЛА), тож
// `dist/` дзеркалить exports ЗА ПОБУДОВОЮ. Wildcard-ціль `./src/ui/*.tsx` розгортається глобом
// `src/ui/**/*.tsx` — рівно стільки, скільки обіцяє exports-wildcard (він
// матчить і вкладені шляхи; до ред. 3 сім вкладених `.tsx` під
// `storefront-routes/pages/*` були обіцяні, але не зібрані). Цілі поза
// `./src/` (`routes/*` — сирі TSX роутів) пропускаються.
//
// 🔴 Розділ на групи — це і є межа довіри в артефакті: модулі різних збірок
// Rolldown не може покласти в один чанк, тож серверний код ніколи не
// зʼявиться в чанку, досяжному з клієнтського entry. Усередині серверної
// групи спільні чанки дозволені й бажані (34 майбутні impl адмінки ділять
// `resource.ts` одним чанком, а не 34 копіями). Хто де — вирішує єдина
// декларація `contracts/server-only`; гейт — `tests/dist-server-boundary`.
// Клієнтська група включає serverFn-модулі (`themes/server`, `plugins/server`,
// `plugin-sdk/server`, стаби admin-server): їх клієнт імпортує легально, а
// компілятор Start робить із них RPC-стаби.
//
// 🔴 `deps.neverBundle` обовʼязковий: інтра-пакетні імпорти — self-reference
// субшляхи (`simplycms/contracts` усередині цього ж пакета), бандлер
// авто-зовнішнить лише dependencies/peerDependencies, а пакет не може
// залежати сам від себе. Без правила граф вбудувався б у кожен entry й
// задублював stateful-модулі (реєстри, пул) МОВЧКИ.

// 🔴 Усе — від теки пакета, не від cwd: конфіг імпортує і `tsdown` (cwd =
// пакет), і `tests/dts-toolchain.test.ts` з кореневого vitest (cwd = корінь,
// де `package.json` без `exports`, а глоби `src/**` порожні). Без цього
// імпорт із кореня падав би на `Object.entries(undefined)` (знахідка аудиту).
const PACKAGE_ROOT = import.meta.dirname;
const pkg = JSON.parse(
  readFileSync(resolve(PACKAGE_ROOT, 'package.json'), 'utf8'),
) as { exports: Record<string, string> };

/** `./src/schema/schema.ts` → `schema/schema`: шлях у dist = шлях джерела. */
const outOf = (source: string): string =>
  source.replace(/^\.?\/?src\//, '').replace(/\.tsx?$/, '');

// 🔴 Шлях у dist береться з ДЖЕРЕЛА, а не з ключа exports: `dist/` дзеркалить
// розкладку `src/`, а ключ лише вказує на файл (`./schema` → `schema/schema.js`,
// `./contracts` → `contracts/index.js`, `./core/providers` →
// `core/providers/CMSProvider.js`). Виведення з ключа дало б 37 розбіжностей
// із `publishConfig.exports` (знахідка аудиту ред. 3).
const entries = Object.entries(pkg.exports)
  .filter(([, target]) => target.startsWith('./src/'))
  .flatMap(([key, target]): Array<[string, string]> => {
    if (!key.includes('*')) return [[outOf(target), resolve(PACKAGE_ROOT, target)]];
    const [dir, ext] = target.slice(2).split('*');
    const files = globSync(`${dir}**/*${ext || '.{ts,tsx}'}`, { cwd: PACKAGE_ROOT })
      .map((file) => file.split('\\').join('/'))
      .filter((file) => !file.includes('__tests__'))
      .sort();
    // Wildcard без збігів — одрук у exports або перенесена тека: падати
    // гучно, а не мовчки лишити пакет без частини entry.
    if (files.length === 0) throw new Error(`tsdown.config: ${key} без збігів`);
    return files.map((file) => [outOf(file), resolve(PACKAGE_ROOT, file)]);
  });

const group = (server: boolean): Record<string, string> =>
  Object.fromEntries(
    entries.filter(([out]) => isServerOnlySubpath(out) === server),
  );

const base = {
  format: ['esm'],
  // Той самий platform, що був дефолтом tsup: builtins Node (`node:crypto` у
  // лоадерах) зовнішні без попереджень; у браузер код їде лише через
  // бандлер магазину. За `neutral` Rolldown дає UNRESOLVED_IMPORT на кожен.
  platform: 'node',
  // При platform node дефолт `fixedExtension` дав би `.mjs` повз exports.
  fixedExtension: false,
  // 🔴 dts вимкнено: декларації емітить `tsc -p tsconfig.dts.json` (крок
  // `build`). Виміряно 2026-09-02: dts-плагін бандлера на цьому пакеті
  // вичерпує 3 ГБ heap за 25 с (і за 29 с при concurrency 1), tsc робить те
  // саме за 11 с і 1,1 ГБ. Умова перегляду — `isolatedDeclarations` у
  // tsconfig: тоді декларації емітить oxc без програми TypeScript.
  // Гард — tests/dts-toolchain.test.ts.
  dts: false,
  cwd: PACKAGE_ROOT,
  tsconfig: resolve(PACKAGE_ROOT, 'tsconfig.json'),
  sourcemap: true,
  // 🔴 target esnext: за нижчого таргета бандлер лоуерить `import.meta` у
  // `var import_meta = {}`, і опублікований dist читає `{}.env.VITE_…`.
  // Гард — tests/dist-import-meta.test.ts.
  target: 'esnext',
  deps: { neverBundle: [/^simplycms(\/|$)/, /^@simplycms\//] },
} satisfies UserConfig;

export default defineConfig([
  // Клієнтська група. `clean: true` рівно тут: tsdown чистить outDir один
  // раз для всього масиву, до першого запису; `tsc` дописує .d.ts після.
  { ...base, clean: true, entry: group(false) },
  // Серверна група: db, auth, schema/*, storefront/{loaders,seo},
  // admin-server/impl. Спільні чанки — лише між собою.
  { ...base, entry: group(true) },
]);
```

- [ ] **Крок 3: Exports, барель `storefront`, скрипт `build`**

У `packages/simplycms/package.json`:
1. видалити ключ `"./storefront"` з ОБОХ мап (`exports` і `publishConfig.exports`)
   — барель `src/storefront/index.ts` (`export * from './loaders/index'` +
   `'./seo/index'`) не має жодного споживача в репо і дублює два субшляхи;
2. рядок 478 замінити на:

```json
    "build": "tsdown && tsc -p tsconfig.dts.json",
```

```bash
git rm packages/simplycms/src/storefront/index.ts packages/simplycms/tsup.config.ts
```

У `tests/tier-boundary/zones.ts:45` фікстуру `'simplycms/storefront',` замінити
на `'simplycms/storefront/loaders',` (той самий тір, субшлях існує).

- [ ] **Крок 4: Зібрати й звірити exports**

```bash
pnpm --filter simplycms run build
cd packages/simplycms
node -e '
const { readFileSync, existsSync } = require("node:fs");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const targets = Object.values(pkg.publishConfig.exports).flatMap(v => typeof v === "string" ? [v] : Object.values(v)).filter(t => t.endsWith(".js") && !t.includes("*"));
const missing = targets.filter(t => !existsSync(t));
console.log("явних js-цілей:", targets.length, "відсутніх:", missing.length, missing);
' 
find dist -name '*.mjs' | wc -l
grep -rl "ThemeRegistryClass" dist --include=*.js | wc -l
ls dist/storefront-routes/pages/home/slots.js dist/storefront-routes/pages/catalog/slots.js dist/storefront-routes/pages/product-detail/slots.js
cd ../..
```

Очікувано: `відсутніх: 0`, `.mjs` — 0, `ThemeRegistryClass` — 1 файл, сім
нових entry під `pages/{home,catalog,product-detail}/` існують. Перевірено
на dev-exports HEAD `2a0b7b7b`: алгоритм дає 322 entry = 318 чинних tsup
+ 7 вкладених `.tsx` + `contracts/server-only` − `storefront/index` − 3 хелпери,
що переїхали в лоадери (Task 1 Крок 1б); серверна група — рівно 11
(`schema/{schema,relations,types}`, `admin-server/impl/index`, `db/index`,
`auth/index`, `storefront/{loaders,seo}/index`,
`storefront-routes/seo/{interceptor,robots,sitemap}`). Wildcard-цілі
доводить `published-exports-parity` (Крок 6).

🔴 Якщо `tsdown` падає на імпорті `simplycms/contracts/server-only` у конфізі
— перевір `pnpm exec tsdown --config-loader unrun` з теки пакета: native-лоадер
Node мусить резолвити self-reference через `exports`; якщо ні — це помилка
lockfile/симлінка workspace, а не плану.

- [ ] **Крок 5: Мігрувати два тести тулчейна**

`tests/dts-toolchain.test.ts`, перший тест замінити на:

```ts
  it('жодна збірка tsdown ядра не вмикає dts (декларації — лише tsc)', async () => {
    // Імпорт, не регекс: конфіг — код, і форма запису може мінятись.
    const mod = (await import(
      resolve(root, 'packages/simplycms/tsdown.config.ts')
    )) as { default: Array<{ dts?: unknown; entry: Record<string, string> }> };
    // Рівно дві збірки — клієнтська й серверна (трек T): третя означала б,
    // що межу знову тримає розкладка профілів, а не декларація.
    expect(mod.default).toHaveLength(2);
    const offenders = mod.default
      .filter((config) => Boolean(config.dts))
      .map((config) => Object.keys(config.entry).slice(0, 3).join(','));
    expect(
      offenders,
      'збірки з dts: true — це шлях назад до OOM (dts-плагін бандлера тримає повну ts.Program)',
    ).toEqual([]);
  });
```

У тесті `build пакета ядра викликає tsc-емісію декларацій` дописати:

```ts
    expect(pkg.scripts.build).toBe('tsdown && tsc -p tsconfig.dts.json');
```

Шапку файлу: «Вендорений rollup-plugin-dts (dts-механізм tsup)» →
«dts-механізм бандлера (rollup-plugin-dts у tsup, rolldown-plugin-dts у
tsdown — обидва тримають повну ts.Program; виміряно 2026-08-24 і 2026-09-02)»;
`describe('тулчейн декларацій: dts поза tsup'` → `'… dts поза бандлером'`.

```bash
git mv tests/tsup-config-typecheck.test.ts tests/build-config-typecheck.test.ts
```

У ньому:
1. глоб: `globSync('packages/*/tsdown.config.ts', { cwd: ROOT })`;
2. `describe('tsup-конфіги під типізацією'` → `describe('конфіги збірки під типізацією'`;
3. якір і мутацію замінити на:

```ts
// Якір — рядок, що є в base КОЖНОГО конфігу репо; мутація — літерал поза
// union-ом `'node' | 'neutral' | 'browser'`. Виміряно: tsc дає TS2322 (плюс
// TS2820 «did you mean 'node'»). Заміна ІНШОГО якоря на `platform: …` дала б
// TS1117 (дубль ключа) і нічого не довела б про union.
const ANCHORS = ["platform: 'node',"] as const;
const TYPO = "platform: 'nodejs',";
```

та `expect(codes, …).toContain(2353)` → `.toContain(2322)`;
4. у шапці лишити історію про `dts: { tsconfig }` як реальний дефект, з
   поміткою, що інструмент і мутація змінились.

```bash
pnpm vitest run --config vitest.packaging.config.ts tests/dts-toolchain.test.ts
pnpm vitest run tests/build-config-typecheck.test.ts
```

Очікувано: обидва зелені.

- [ ] **Крок 6: Гейти артефакта**

```bash
pnpm build:packages
pnpm vitest run --config vitest.packaging.config.ts tests/dist-server-boundary.test.ts tests/dist-import-meta.test.ts
pnpm typecheck:template && pnpm test:packaging
pnpm pilot:pack
```

Очікувано: усе зелено. `published-exports-parity` доводить wildcard-цілі,
`dist-server-boundary` — партицію на tsdown, `pilot:pack` — Gate C і Import
Protection зі справжнього tarball-а.

- [ ] **Крок 7: Негативний контроль партиції на tsdown**

Механізм чанкування інший, тож доказ Task 2 треба відтворити. Мутація:
відносний імпорт у стабі + `impl` тимчасово в клієнтській групі (декларацію
НЕ чіпаємо — гейт і далі вважає impl серверним):

```bash
sed -i "s#from 'simplycms/admin-server/impl'#from './impl'#" packages/simplycms/src/admin-server/index.ts
sed -i "s#isServerOnlySubpath(out) === server#(!out.startsWith('admin-server/impl') \&\& isServerOnlySubpath(out)) === server#" packages/simplycms/tsdown.config.ts
grep -c "startsWith('admin-server/impl')" packages/simplycms/tsdown.config.ts
pnpm --filter simplycms run build
pnpm vitest run --config vitest.packaging.config.ts tests/dist-server-boundary.test.ts
```

Очікувано: `1`, потім FAIL: `admin-server/impl/index.js` у замиканні
клієнтського `admin-server/index.js` (entry-to-entry імпорт `./impl/index.js`)
і стаб із `./impl`.

```bash
git checkout -- packages/simplycms/tsdown.config.ts packages/simplycms/src/admin-server/index.ts
pnpm --filter simplycms run build
pnpm vitest run --config vitest.packaging.config.ts tests/dist-server-boundary.test.ts
```

Очікувано: зелено.

- [ ] **Крок 8: Виміряти памʼять і час збірки**

🔴 `/usr/bin/time` на машині немає; кеп `--max-old-space-size` не бачить
native-памʼять Rolldown. Вимір — python-обгорткою по RUSAGE_CHILDREN:

```bash
cat > "$SCRATCH/rusage.py" <<'EOF'
import resource, subprocess, sys, time
t0 = time.time()
r = subprocess.run(sys.argv[1:])
ru = resource.getrusage(resource.RUSAGE_CHILDREN)
print(f"RUSAGE: exit={r.returncode} elapsed={time.time()-t0:.1f}s maxrss_children={ru.ru_maxrss/1024:.0f}MB", file=sys.stderr)
sys.exit(r.returncode)
EOF
cd packages/simplycms && python3 "$SCRATCH/rusage.py" pnpm exec tsdown 2>&1 | grep RUSAGE; cd ../..
python3 "$SCRATCH/rusage.py" pnpm build:packages 2>&1 | grep -E "RUSAGE|build:packages: ok"
```

Записати обидва числа для Task 5 (`test-contours.md`). Орієнтир прототипу
2026-09-02: tsdown ядра 0,4 с / 634 МБ (18 конфігів); tsup 2,1 с / 448 МБ.
Якщо max RSS перевищує 2 ГБ — зупинись і розберись, це не очікувано.

- [ ] **Крок 9: Гейти й коміт**

```bash
pnpm lint && pnpm test && pnpm typecheck && pnpm test:packaging
git add -A packages/simplycms tests/dts-toolchain.test.ts tests/build-config-typecheck.test.ts tests/tier-boundary/zones.ts
git commit -m "build(track-t): ядро на tsdown — дві збірки, entry з exports, межа за декларацією

Клієнтська й серверна групи замість восьми профілів: модулі різних збірок
не ділять чанків, тож межа — властивість розкладки, а не опції. Entry
виводяться з dev-exports (сім вкладених .tsx нарешті збираються), барель
simplycms/storefront без споживачів знято. Негативний контроль партиції
відтворено на tsdown."
```

---

### Task 5: Знос tsup, документація, гейти релізу

**Files:**
- Modify: `package.json` (`- tsup`)
- Modify: `scripts/release/gates.mjs:23`
- Modify: `scripts/build-packages.mjs:1-12, 54-58`
- Modify: `packages/simplycms/tsconfig.dts.json:2-11`
- Modify: `tests/dist-import-meta.test.ts:7-17, 93`, `vitest.packaging.config.ts` (коментар), `tests/cli-pack.test.ts:21`
- Modify: `packages/simplycms/src/{storefront/loaders/session.ts:19-27, storefront/loaders/index.ts:35, storefront-routes/server/is-admin.ts:20, admin-server/index.ts:2, admin-server/impl.ts:4, schema/index.ts:13, supabase/vite-env.d.ts:5}`
- Modify: `CLAUDE.md`, `docs/architecture/test-contours.md`, `docs/architecture/plugins.md:96-110`, `docs/architecture/themes.md:39,212,294`, `docs/architecture/release-process.md:192`, `packages/README.md:126-130`, `.github/instructions/tooling.instructions.md:32`, `.github/instructions/ui-architecture.instructions.md:94`, `docs/tasks/platform-roadmap.md` (пункт 4)

**Interfaces:**
- Consumes: стан після Task 4 і числа Task 4 Крок 8.

- [ ] **Крок 1: Зняти залежність і проінвентаризувати згадки**

```bash
pnpm remove -Dw tsup
git grep -n -w -i "tsup" -- ':!pnpm-lock.yaml' ':!CHANGELOG.md' ':!docs/superpowers/plans' ':!docs/superpowers/research' ':!docs/superpowers/specs' ':!docs/tasks' | wc -l
git grep -n -w -i "tsup" -- ':!pnpm-lock.yaml' ':!CHANGELOG.md' ':!docs/superpowers/plans' ':!docs/superpowers/research' ':!docs/superpowers/specs' ':!docs/tasks'
```

🔴 `-w` обовʼязковий: без нього `assertSupportedVersion` дає хибний збіг.
Історичні згадки НЕ чіпати — вони описують стан на дату: CHANGELOG, минулі
плани, `docs/superpowers/research/**`, `docs/superpowers/specs/**` (спека К0
описує рішення 2026-08-20) і записи роадмапу про минулі роботи. Усе інше —
нижче, поіменно (перелік звірено grep-ом на HEAD `2a0b7b7b`: 72 збіги у 32
файлах, з них 5 конфігів/скриптів, що зникають, і 3 тести, що мігрують у
Task 4); після правок цей grep дає 0.

- [ ] **Крок 2: Гейт релізу**

У `scripts/release/gates.mjs` після рядка `{ name: 'test:packaging', … },`:

```js
  // 🔴 Трек T: після зміни бандлера єдиний доказ межі клієнт/сервер у
  // РЕАЛЬНОМУ клієнтському бандлі — Gate C пілота (плюс Import Protection
  // шаблону з того самого tarball-а). БД не потребує (`--pack-only`),
  // детермінований; у CI не ганяється (рішення 2026-08-01 стосується `pilot`
  // з Gate B), тож реліз — єдине місце, де він обовʼязковий.
  { name: 'pilot:pack', cmd: 'pnpm pilot:pack' },
```

Гейт на сам список — створити `tests/release-gates.test.ts` (сьогодні
`template-typecheck-coverage` перевіряє лише наявність одного рядка):

```ts
import { describe, expect, it } from 'vitest';
import { GATES } from '../scripts/release/gates.mjs';

// Точний склад і порядок гейтів релізу — контракт, не деталь: CLAUDE.md і
// release-process.md його цитують, а pilot:pack (трек T) мусить іти ПІСЛЯ
// test:packaging — він пакує ті самі tarball-и.
describe('гейти релізу', () => {
  it('склад і порядок рівно такі, як задокументовано', () => {
    expect(GATES.map((gate) => gate.name)).toEqual([
      'install --frozen-lockfile',
      'format:check',
      'lint',
      'build',
      'typecheck',
      'test',
      'build:packages',
      'typecheck:template',
      'test:packaging',
      'pilot:pack',
    ]);
  });
});
```

🔴 Відхилення для рішення власника (не міняти мовчки): у `gates.mjs` немає
`test:schema`, хоча порядок гейтів у CLAUDE.md його містить. Тест фіксує
ЧИННИЙ склад; додавання `test:schema` у реліз — окреме рішення (потребує
Postgres на машині релізу).

- [ ] **Крок 3: Коментарі в коді — механізм замість інструмента**

Точні заміни (причину ЗБЕРЕГТИ):
- `scripts/build-packages.mjs:1-12` — шапка: «rollup-plugin-dts усередині tsup»
  → «dts-плагін бандлера (rollup-plugin-dts у tsup, rolldown-plugin-dts у
  tsdown)»; «Воркери tsup УСПАДКОВУЮТЬ ліміт» → «Дочірні процеси успадковують
  ліміт; native-памʼять Rolldown він не обмежує — її вимір у test-contours.md»;
  рядки 54-58 (текст помилки): «декларації знову генерує tsup ('dts: true' у
  якомусь профілі)» → «декларації знову генерує бандлер (`dts: true` у
  конфізі ядра tsdown)». 🔴 Це не косметика: текст помилки — єдине, що
  побачить розробник на кепі;
- `packages/simplycms/tsconfig.dts.json:2-11` — «замість dts-механізму tsup» →
  «замість dts-плагіна бандлера»; дописати «Перевірено ще раз 2026-09-02 на
  tsdown: OOM 3 ГБ за 25 с; tsc — 11 с / 1,1 ГБ»;
- `tests/dist-import-meta.test.ts:7-17` — «tsup віддає esbuild таргет із
  tsconfig» → «бандлер бере таргет із tsconfig, якщо його не задано явно»;
  рядок 93: «esbuild злоуерив `import.meta` — у tsup-конфігах цих пакетів
  бракує» → «бандлер злоуерив `import.meta` — у конфігах tsdown цих пакетів бракує»;
- `vitest.packaging.config.ts` — «dts поза tsup» → «dts поза бандлером»;
- `tests/cli-pack.test.ts:21` — «tsup-збірки пакет не має» → «збірки пакет не має»;
- `src/storefront/loaders/session.ts:19-27` — абзац «Чому це ЛОАДЕРИ…»
  переписати: «Живий не-serverFn експорт, який serverFn-модулі тягнуть
  ВІДНОСНИМ шляхом, бандлер піднімає у спільний чанк, а сторінки кабінету
  імпортують ті самі serverFn-модулі й дістають чанк у клієнтський граф.
  Тому лоадери — server-only дерево за декларацією `contracts/server-only`:
  вони збираються ОКРЕМОЮ збіркою, а serverFn-модулі імпортують їх лише
  bare-субшляхом (`simplycms/storefront/loaders`), який для бандлера
  зовнішній. Стережуть: правило `server-only-relative`, гейт
  `dist-server-boundary`, Import Protection магазину»;
- `src/storefront/loaders/index.ts:35` — «heap воркера tsup» → «heap dts-плагіна бандлера»;
- `src/storefront-routes/server/is-admin.ts:20` — «в один tsup-чанк» → «в один чанк бандлера»;
- `src/admin-server/index.ts:2` — «відносний імпорт tsup заінлайнив би» →
  «відносний імпорт бандлер заінлайнив би; стереже правило server-only-relative»;
- `src/admin-server/impl.ts:4` — «tsup лишає» → «бандлер лишає (deps.neverBundle)»;
- `src/schema/index.ts:13` — «Entry-точкою tsup барель НЕ стає» → «Entry-точкою
  збірки барель НЕ стає (entry виводяться з exports, а ключа для нього немає)»;
- `src/supabase/vite-env.d.ts:5` — «(tsup поза host-програмою)» → «(бандлер пакета поза host-програмою)».

- [ ] **Крок 4: CLAUDE.md**

Блок `pnpm build:packages` у Quick Reference (рядки 20-24) замінити на:

```
pnpm build:packages   # Збірка публікованих пакетів. 🔴 Ходить через scripts/build-packages.mjs
                      # із кепом купи 3 ГБ: JS видає tsdown (Rolldown), ДЕКЛАРАЦІЇ — tsc
                      # (tsconfig.dts.json), бо dts-плагін бандлера тримає повну ts.Program
                      # (виміряно двічі: tsup 2026-08-24, tsdown 2026-09-02). Ядро — ДВІ
                      # збірки, клієнтська й серверна, entry виводяться з exports; межу
                      # задає simplycms/contracts/server-only, стережуть
                      # tests/dist-server-boundary.test.ts і tests/dts-toolchain.test.ts
```

Рядок 357 дерева пакета: `tsup.config.ts        # МАСИВ профілів; 🔴 target: 'esnext' — у спільному base`
→ `tsdown.config.ts      # ДВІ збірки (клієнт/сервер); entry з dev-exports; група — за contracts/server-only`.

У розділі «Чому TypeScript лишається на 5.9» (рядки 258-268): прибрати
аргумент про `tsup --dts` (він більше не гейт), лишити `typescript-eslint`;
«Умова перегляду: `typescript-eslint` і `tsup` оголосять підтримку TS 7» →
«Умова перегляду: `typescript-eslint` оголосить підтримку TS 7 (декларації
емітить tsc, tsdown має власний шлях через tsgo, але два компілятори в дереві
— борг без вигоди)».

У розділі про порядок гейтів після речення про `test:schema` додати:
«🔴 У гейтах РЕЛІЗУ (`scripts/release/gates.mjs`) після `test:packaging` іде
ще `pilot:pack` (трек T, 2026-09-02): Gate C пілота — єдиний доказ межі
клієнт/сервер у реальному клієнтському бандлі; у CI він не ганяється.»

У розділі «Project Structure» для `src/contracts/` дописати
`./server-only — декларація межі клієнт/сервер (єдина; читають збірка, гейт, лінт, Gate C, vite.config магазину)`.

- [ ] **Крок 5: test-contours.md, plugins.md, решта доків**

`docs/architecture/test-contours.md` — у кінець файлу дописати:

```markdown
## 12. Межа клієнт/сервер: одна декларація, пʼять читачів (трек T, 2026-09-02)

Server-only субшляхи ядра задекларовано ОДИН раз — `simplycms/contracts/server-only`
(`db`, `auth`, `schema`, `storefront`, `admin-server/impl`; serverFn-модулі
`plugin-sdk/server`, `themes/server`, `plugins/server`, стаби `admin-server` —
НЕ server-only, їх клієнт імпортує легально). Читачі:

| Читач | Що доводить | Негативний контроль |
|---|---|---|
| `packages/simplycms/tsdown.config.ts` | server-only entry — окрема збірка, спільних чанків з клієнтом немає за побудовою | Task 4 Крок 7 плану треку T |
| `tests/dist-server-boundary.test.ts` (packaging-suite) | closure(server) ∩ closure(client) = ∅ по відносних імпортах `dist`; `.d.ts` сателітів без відносних ре-експортів | відносний `./impl` у стабі + impl у клієнтській групі → червоний |
| `eslint-rules/server-only-relative.mjs` | відносний імпорт у server-only дерево ззовні — помилка лінту | `tests/eslint-rules/server-only-relative.test.ts` |
| групи `no-restricted-imports` плагінів | плагін не імпортує серверний граф | `tests/plugin-trust-boundary.test.ts` |
| `scripts/pilot-pack/gate-c.mjs` | серверного вантажу в клієнтських чанках скретч-магазину немає | `SERVER_PAYLOAD` похідний, гейт червоніє на `impl` |
| Import Protection Start (хост, шаблон, пілот) | те саме в КОЖНОМУ магазині, dev і build, з трасою імпорту | роут із `import { withActor } from 'simplycms/db'` валить `pnpm build` (перевірено 2026-09-02) |

🔴 Дві пастки Import Protection, обидві виміряні: за замовчуванням перевіряються
лише імпортери в `src/` — тому `include: ['**']`; у монорепо alias `simplycms/*`
резолвить специфікатор РАНІШЕ за перевірку — тому поруч зі `specifiers` є `files`.

### Бюджет памʼяті після tsdown

Кеп `--max-old-space-size=3072` стереже `tsc` (декларації ядра) і dts-плагін
сателітів; native-памʼять Rolldown він не обмежує. Виміряно при перемиканні
(Task 4 Крок 8): tsdown ядра — <час> с / <RSS> МБ; повний `build:packages` —
<час> с / <RSS> МБ. Прототип 2026-09-02 на 18 конфігах: 0,4 с / 634 МБ (tsup:
2,1 с / 448 МБ). Декларації силами tsdown відкинуто виміром: OOM 3 ГБ за 25 с.
```

(замість `<час>`/`<RSS>` — числа з Task 4 Крок 8.)

`docs/architecture/plugins.md:98-110`: перелік заборонених специфікаторів
переписати як «похідний від `simplycms/contracts/server-only` (`SERVER_ONLY`
+ `SERVER_ONLY_DEPS`) плюс поверхня, заборонена плагіну понад server-only:
`simplycms/supabase(/*)`, `@supabase/*`, `simplycms/plugin-sdk/server(/*)`,
`simplycms/admin-server(/*)`; список у `eslint.config.mjs` — читач, не копія».

`README.md:148`, `docs/guides/themes.md:332`,
`docs/architecture/release-process.md:69` (крок «збірка» у процесі релізу) і
`:309`, `docs/architecture/test-contours.md` (згадка «dts поза tsup» — де
покаже grep), `docs/architecture/themes.md:39, 212, 294`, `packages/README.md:126-130`,
`.github/instructions/tooling.instructions.md:32`,
`.github/instructions/ui-architecture.instructions.md:94`: «tsup» → «tsdown»;
у `packages/README.md` п. 5 переписати: «Збірка — tsdown. У флагмані
`tsdown.config.ts` — ДВІ збірки (клієнтська й серверна), а entry виводяться з
dev-`exports` (ключ → джерело), тож `dist/` дзеркалить `publishConfig.exports`
за побудовою; server-only групу задає `contracts/server-only`».

`docs/architecture/release-process.md:192`: у ланцюг гейтів дописати
`→ pilot:pack` і речення, чому він тут, а не в CI.

`docs/tasks/platform-roadmap.md`, пункт «4. Трек T»: заголовок замінити на
`4. ✅ **Трек T — Тулчейн збірки: міграція tsup → tsdown; ЗАВЕРШЕНО 2026-09-DD.**`
і дописати підсумок: три пакети на tsdown; ядро — дві збірки за декларацією
`contracts/server-only`; Import Protection у шаблоні; `sideEffects: false`;
`pilot:pack` у гейтах релізу; посилання на цей план. Мотиваційний текст
лишити як історію рішення.

- [ ] **Крок 6: Повний ланцюг і коміт**

```bash
pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm build \
  && pnpm typecheck && pnpm test && pnpm test:schema && pnpm build:packages \
  && pnpm typecheck:template && pnpm test:packaging && pnpm pilot:pack
git grep -n -w -i "tsup" -- ':!pnpm-lock.yaml' ':!CHANGELOG.md' ':!docs/superpowers/plans' ':!docs/superpowers/research' ':!docs/superpowers/specs' ':!docs/tasks' | wc -l
```

Очікувано: усе зелено; `pnpm lint` — 0 errors, warnings не більше 12; grep — 0.

```bash
git add -A
git commit -m "build(track-t): tsup знесено; pilot:pack у гейтах релізу; доки на tsdown і декларацію межі

Коментарі називають механізм, а не інструмент; test-contours §12 описує
одну декларацію і пʼятьох читачів із негативними контролями; CLAUDE.md,
plugins.md, packages/README, інструкції й роадмап оновлені."
```

---

### Task 6: `sideEffects: false` і живий прогін магазину

**Files:**
- Modify: `packages/simplycms/package.json`, `packages/simplycms-theme-solarstore/package.json`, `packages/simplycms-plugin-faq/package.json` (поле після `"type": "module"`)
- Modify: `docs/architecture/test-contours.md` (§12: результат живого прогону)

**Interfaces:**
- Consumes: усе попереднє.
- Produces: артефакти валідації для передачі власнику.

Чому окремою задачею й останньою: поле змінює те, що бандлер магазину має
право ВИКИНУТИ, а після переходу на Rolldown чанки більші (≈20 замість 267),
тож tree-shaking по модулях важить більше. У `src` ядра нуль side-effect-
імпортів (`import './x'`) і нуль top-level мутацій глобалів (перевірено
2026-09-02): реєстри — експортовані константи, реєстрація — у функціях
(`bootstrapThemes`, `bootstrapPlugins`), CSS-імпортів у пакеті немає.
Правило для авторів: реєстрація лише явними викликами.

- [ ] **Крок 1: Знімок розміру клієнтського бандла хоста ДО**

```bash
pnpm build > /dev/null && du -sb dist/client/assets | tee "$SCRATCH/client-before.txt"
```

- [ ] **Крок 2: Поле в трьох маніфестах**

У кожному з трьох `package.json` після рядка `"type": "module",` додати:

```json
  "sideEffects": false,
```

- [ ] **Крок 3: Гейти пакування, пілот, розмір ПІСЛЯ**

```bash
pnpm build:packages && pnpm test:packaging && pnpm pilot:pack
pnpm build > /dev/null && du -sb dist/client/assets | tee "$SCRATCH/client-after.txt"
```

Очікувано: зелено; Gate C `NOT_IN_INITIAL` (admin, tiptap, recharts поза
initial-чанком) зелений; розмір `dist/client/assets` не більший за «до».

- [ ] **Крок 4: Чиста БД і запуск**

```bash
pnpm db:demo
pnpm build && pnpm start
```

Передумова — `DATABASE_URL` і `BETTER_AUTH_SECRET` у `.env.local`
(`v2-state-map.md` §5).

- [ ] **Крок 5: Живий прогін вітрини**

У браузері: `/` віддає дані з БД; `/catalog` — товари демо-сіду; картка
товару з ціною і залишком; `/sitemap.xml` — реальні URL; консоль — нуль
помилок про `import_meta`, `process is not defined`,
`Cannot read properties of undefined`, і нуль `[import-protection]`.

- [ ] **Крок 6: Живий прогін адмінки — межа в бою**

Увійти власником, `/admin/order-statuses`: створити, перейменувати, змінити
порядок, видалити статус; у Network операції йдуть POST-запитами до serverFn;
у Sources пошук `drizzle`, `pg`, `withActor` серед завантажених чанків —
нуль збігів.

- [ ] **Крок 7: Артефакти й коміт**

У `test-contours.md` §12 дописати рядок «Живий прогін 2026-09-DD: вітрина і
`/admin/order-statuses` на чистому Postgres, клієнтські чанки без drizzle/pg,
розмір `dist/client/assets` до/після `sideEffects`: N/M байт». Зібрати для
передачі: вивід повного ланцюга (Task 5 Крок 6), вивід `pilot:pack`, час і
RSS збірки (Task 4 Крок 8), `git log --oneline main..HEAD`.

```bash
pnpm lint && pnpm test
git add -A
git commit -m "perf(track-t): sideEffects:false у трьох пакетах + підсумок живого прогону

У src ядра нуль side-effect-імпортів і мутацій глобалів; бандлер магазину
тепер має право викинути невикористані модулі. Доведено Gate C (initial без
admin/tiptap/recharts) і живим прогоном вітрини та адмінки."
```

---

## DoD треку T

1. `tsup` відсутній у дереві: ні в `devDependencies`, ні конфігом, ні
   згадкою поза історією (`git grep -w -i tsup` без lockfile, CHANGELOG,
   минулих планів і роадмапу — 0).
2. Три пакети збираються `tsdown`; ядро — рівно ДВІ збірки, entry виведені з
   dev-`exports`; декларації ядра — `tsc -p tsconfig.dts.json`.
3. `simplycms/contracts/server-only` — єдина декларація межі; її читають
   конфіг ядра, `dist-server-boundary`, `eslint.config.mjs` +
   `server-only-relative`, Gate C і три `vite.config.ts`. Жоден із них не
   тримає копії списку. Декларація ПРАВДИВА: нутрощі адмінки — під
   `admin-server/impl/`, серверні хелпери вітрини — у `storefront/loaders`,
   `storefront-routes/server/*` — лише serverFn-модулі та ізоморфні модулі.
4. Import Protection увімкнено в хості, шаблоні й пілоті (`error`, `include: ['**']`,
   `specifiers` + `files`); негативний контроль (роут із `simplycms/db`)
   валить `pnpm build` — доведено на хості.
5. `dist-server-boundary` зелений на tsdown і має ДВА доведені негативні
   контролі — на esbuild (Task 2) і на tsdown (Task 4); обидва мутують граф
   модулів, не лише опцію.
6. Усі явні й wildcard-цілі `publishConfig.exports` існують у `dist`, жодного
   `.mjs`; сім вкладених `.tsx` під `storefront-routes/pages/*` збираються;
   барель `./storefront` знято.
7. `dist-import-meta`, `published-exports-parity`, `dts-toolchain`,
   `build-config-typecheck` (код 2322), `audit-exports`, `plugin-trust-boundary`,
   `server-only-relative` зелені; кеп 3 ГБ і стеля 300 с витримані; час і
   max RSS збірки виміряні й записані в `test-contours.md`.
8. `pilot:pack` зелений і входить у `scripts/release/gates.mjs`; склад і порядок
   гейтів під `tests/release-gates.test.ts`.
9. `sideEffects: false` у трьох пакетах; клієнтський бандл хоста не більший.
10. Живий прогін: вітрина і `/admin/order-statuses` на чистому Postgres, у
    клієнтських чанках немає `drizzle`/`pg`.
11. Доки оновлені: CLAUDE.md, `test-contours.md` §12, `plugins.md`,
    `themes.md`, `release-process.md`, `packages/README.md`, інструкції,
    роадмап (трек T — ✅), спека К3 (амендмент К3-9′ уже в ред. 3).

## Що НЕ входить у трек T

- Опція `exports: true` tsdown і генерація exports-мапи: рукописні wildcard-и
  коротші й читабельніші, а `dist` уже дзеркалить exports за побудовою.
- `unbundle: true`: зробив би `dist/` дзеркалом `src/`, а не exports, і дав
  би шлях назовні внутрішнім модулям `db`/`auth`.
- Декларації силами tsdown: відкинуто виміром (OOM 3 ГБ). Умова перегляду —
  `isolatedDeclarations` у tsconfig ядра (окремий трек: явні типи на всіх
  експортах).
- Перехід `@simplycms/cli` і `create-simplycms-store` на бандлер: чистий ESM
  без збірки.
- Знесення legacy `supabase/*` і його літералів у Gate C — трек К3.
- Розкладка `admin-server/impl/<entity>` — Е3; тут лише конвенція (амендмент
  К3-9′), щоб префікс `admin-server/impl` покривав її без правки декларації.
- `pilot:pack` у CI: у гейтах релізу — так; CI лишається як є (рішення власника).

## Точка передачі

Після Task 6 — повернутись на валідацію з артефактами: вивід повного ланцюга
гейтів; вивід `pilot:pack`; час і RSS збірки; звіт живого прогону (вітрина і
`/admin/order-statuses`); `git log --oneline main..HEAD`. Гілка
`claude/track-t-tsdown` НЕ мержиться без рішення власника: мерж у `main`
публікує пакети на npm.

Наступний план після треку T — **Е2: Storage-мінімум** (`MediaProvider` +
драйвер `local-fs`), далі **Е3: каталог on-demand** із беклогом Е1б/Е1а і
розкладкою `admin-server/impl/<entity>` (див. роадмап, блок К3).
