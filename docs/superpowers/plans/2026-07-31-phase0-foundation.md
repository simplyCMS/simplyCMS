# Фаза 0 «Фундамент у монорепо» — імплементаційний план (v2, після аудиту Codex)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перебудувати монорепо на цільову топологію платформи (spec §16 Фаза 0): роути ядра в пакетах через `physical()`, канонічні сторінки в ядрі, теми = tokens+components, плагін-контур підключено, supabase консолідовано, Drizzle-конвеєр міграцій, scope `@simplycms` — все на workspace-теках, без публікації.

**Architecture:** Порядок виправлено за аудитом: спершу консолідація supabase і **переїзд server-шару в пакет** (щоб роути, які на нього посилаються, переїжджали без зламаних відносних імпортів), потім роути через `physical()`, потім атомарний ланцюг тем. Кожне завдання лишає репозиторій зеленим (`typecheck`/`lint`/`test`/`build`) і закінчується комітом; **єдиний виняток — Task 10 (теми): 4 підетапи, одна green/commit-межа, це заявлено явно**.

**Tech Stack:** TanStack Start / Router (pinned, див. Task 2b), Vite 8, React 19, TS 5.9 strict, Supabase (`@supabase/ssr`), Drizzle ORM/Kit (pinned), Vitest 4, Zod 4.

## Global Constraints

- Strict TypeScript; без `any`; коментарі українською; файли ≤150 рядків (розбивати).
- Жодного глобального supabase-singleton — тільки DI/порти.
- `ssr: false`-роути завжди мають `pendingComponent`.
- `src/routeTree.gen.ts` не редагується руками; порядок CI: `install → build (генерація) → typecheck → test`.
- Рішення D5 (spec §2): без перехідних шимів — старі шляхи видаляються.
- Після кожного завдання (крім підетапів Task 10): `pnpm typecheck && pnpm lint && pnpm test && pnpm build` зелені → коміт (`git diff --check` перед комітом; чистий `git status` — ПІСЛЯ коміту).
- Пошук по репо — тільки `git grep` (не `grep -r`): виключає node_modules/.git/генерат.

**Свідомо відкладено на Фазу 1+ (зафіксовано, не прогалина):**
- Публікація/`npm pack`/dist-exports нових пакетів і розширення `published-exports-parity.test.ts` на них — Фаза 1 (пілот пакування).
- `server-admin-client`, `require-user`, auth-хуки в `@simplycms/supabase` (spec §10 повний контракт) — додаються, коли зʼявиться перший споживач (зараз service-role ніде не використовується; YAGNI).
- Повна міграція UI-рядків на i18n (Task 15 — скелет + канонічні сторінки; адмінка — warn-рівень лінта + пункт роадмапу).

---

## Етап A — механічний фундамент

### Task 1: LICENSE

**Files:** Create: `LICENSE`; Modify: `package.json`, усі workspace `package.json` без `license` (**workspace = `packages/simplycms/*` + `themes/*` + `plugins/*`** за `pnpm-workspace.yaml`; themes/plugins package.json теж).

- [ ] **Step 1:** Створити `LICENSE` (MIT, copyright `2026 simplyCMS`) — стандартний текст MIT без змін.
- [ ] **Step 2:** Додати `"license": "MIT"` в кореневий `package.json` і в усі workspace-пакети, де відсутнє:

```bash
node -e "
const fs=require('fs'),glob=['packages/simplycms','themes','plugins'];
for(const root of glob){for(const d of fs.readdirSync(root,{withFileTypes:true})){
  if(!d.isDirectory())continue;const p=root+'/'+d.name+'/package.json';
  if(!fs.existsSync(p))continue;const j=JSON.parse(fs.readFileSync(p,'utf8'));
  if(!j.license){j.license='MIT';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');console.log('added',p)}}}"
```

- [ ] **Step 3:** Верифікація повна + коміт: `chore(license): LICENSE MIT + license-поле в усі workspace-пакети`.

### Task 2: Rename scope `@simplysoftua` → `@simplycms` + registry npmjs

**Files:** усі файли зі згадкою (`git grep -l '@simplysoftua'`), плюс `packages/simplycms/*/package.json` (publishConfig) і `tests/published-exports-parity.test.ts`.

- [ ] **Step 1:** Заміна тільки по tracked-файлах:

```bash
git grep -l '@simplysoftua' | xargs sed -i 's|@simplysoftua|@simplycms|g'
```

- [ ] **Step 2:** **Registry → npmjs** (spec D8; GitHub Packages більше не використовується): у 6 публікованих `package.json` (`objects`,`domain`,`data-supabase`,`react-query`,`runtime`,`storefront`) замінити `"registry": "https://npm.pkg.github.com"` → `"registry": "https://registry.npmjs.org"`; у `tests/published-exports-parity.test.ts` — те саме очікування. `.github/workflows/publish-packages.yml`: scope `@simplycms` (джоба лишається `if: false` — повне переписування на npmjs+NPM_TOKEN це Фаза 2).
- [ ] **Step 3:** Точкові перевірки: `build:packages` filter = `"@simplycms/*"`; tsconfig paths / vite / vitest аліаси на `@simplycms/*` (включно `@simplycms/db-types`).
- [ ] **Step 4:** `git grep -c '@simplysoftua'` → 0; `pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test`; коміт: `refactor(scope): rename @simplysoftua → @simplycms + registry npmjs`.

**Прим. (узгодження з Codex-знахідкою №3):** пакети `@simplycms/themes` і `@simplycms/plugins` зберігають наявні імена (теки `theme-system`/`plugin-system`); таблиця spec §4 виправляється під фактичні імена окремим кроком Task 17 (щоб spec не розходилась з кодом).

### Task 2b: Pin версій TanStack + прямі залежності генератора

**Files:** `package.json`, `pnpm-lock.yaml`.

- [ ] **Step 1:** Зафіксувати **exact**-версії (прибрати `^`) для: `@tanstack/react-router`, `@tanstack/react-start`, `@tanstack/react-router-devtools` — на поточно встановлені (`pnpm list --depth 0 | grep tanstack`).
- [ ] **Step 2:** Додати прямими devDependencies (exact): `@tanstack/virtual-file-routes` і `@tanstack/router-generator` — версії, **сумісні зі встановленим `@tanstack/react-start`** (взяти ті, що вже в lockfile як транзитивні для router-plugin: `pnpm why @tanstack/router-generator`). Без цього імпорти в `routes.ts`/регрес-тесті не резолвляться при strict linking pnpm.
- [ ] **Step 3:** `pnpm install --frozen-lockfile=false && pnpm build && pnpm typecheck && pnpm test`; коміт: `chore(deps): pin TanStack-набір + прямі deps virtual-file-routes/router-generator (spec §15)`.

### Task 3: Вивід git-subtree `simplyCMS-core`

**Files:** `package.json` (скрипти `cms:*` геть), `CLAUDE.md` (розділ «Git Subtree Workflow» + cms-рядки Quick Reference), `AGENTS.md`, `.github/instructions/tooling.instructions.md` (subtree-розділи), `.github/instructions/architecture-core.instructions.md` (рядок про subtree), `packages/simplycms/README.md` (переписати: монорепо, npmjs).

- [ ] **Step 1:** Правки за списком; remote — ідемпотентно: `git remote remove simplycms-core 2>/dev/null || true`.
- [ ] **Step 2:** Контроль: `git grep -n "cms:pull\|cms:push\|subtree" -- '*.json' '*.md' ':!docs/architecture' ':!docs/superpowers'` → порожньо (allowlist: аналітика/спека/план описують сам вивід).
- [ ] **Step 3:** Верифікація + коміт: `chore(repo): вивести git-subtree simplyCMS-core (spec §4.1)`. У PR-описі: власник архівує `simplyCMS/simplyCMS-core` на GitHub.

---

## Етап B — консолідація Supabase

### Task 4: Пакет `@simplycms/supabase`

**Files:**
- Create: `packages/simplycms/supabase/{package.json,src/{keys.ts,browser-client.ts,server-client.ts,anon-client.ts,SupabaseProvider.tsx,index.ts,__tests__/keys.test.ts}}`
- Move: `packages/simplycms/core/src/supabase/{client.ts→browser-client.ts, anon.ts→anon-client.ts, SupabaseProvider.tsx, types.ts→src/database.ts}`; **`src/server/supabase.ts` → `src/server-client.ts`** (справжній cookie-aware серверний клієнт живе САМЕ тут — `getRequestHeader('cookie')`/`setCookie`, зберегти сигнатуру з опційним cookie header)
- Modify: `tsconfig.json`/`vite.config.ts`/`vitest.config.ts` (алаіс `@simplycms/supabase`), **`src/start.ts`** (імпорт `./server/supabase` → `@simplycms/supabase/server-client`), усі споживачі за таблицею нижче
- Delete: `packages/simplycms/core/src/supabase/` (порожня після move)

**Мапа API старе → нове (атомарна заміна, D5 без шимів):**

| Старий імпорт | Старий експорт | Новий імпорт | Експорт (без перейменувань) |
|---|---|---|---|
| `@simplycms/core/supabase/client` | `createClient`, `getSupabaseBrowserClient`, тип `SupabaseClient` | `@simplycms/supabase/browser-client` | ті самі імена |
| `src/server/supabase` (`./server/supabase`, `../server/supabase`) | `createServerSupabase` | `@simplycms/supabase/server-client` | `createServerSupabase` (сигнатура як є) |
| `@simplycms/core/supabase/anon` | `createAnonSupabaseClient` | `@simplycms/supabase/anon-client` | те саме |
| `@simplycms/core/supabase/SupabaseProvider` | `SupabaseProvider`, `useSupabaseClient` | `@simplycms/supabase/SupabaseProvider` | ті самі |
| `@simplycms/core/supabase/types` | `Database`, `Json` | `@simplycms/supabase` (re-export `database.ts`) | ті самі |

- [ ] **Step 1 (TDD):** `keys.test.ts` — `resolveSupabaseKeys(env)`: publishable-key пріоритетний; fallback на `VITE_SUPABASE_ANON_KEY`; без ключів — помилка з текстом `SUPABASE.*KEY` (3 кейси, код тесту як у v1 плану). FAIL → реалізація `keys.ts` → PASS.
- [ ] **Step 2:** `package.json` пакета: exports `.`, `./browser-client`, `./server-client`, `./anon-client`, `./SupabaseProvider`; peerDeps `@supabase/ssr`, `@supabase/supabase-js`, `react`, `@tanstack/react-start` (для server-client). `git mv` за таблицею; клієнти переводяться на `resolveSupabaseKeys`.
- [ ] **Step 3:** Заміна імпортів по репо **за мапою** (`git grep -l` по кожному старому шляху → sed конкретної пари; `./server/supabase` у `src/start.ts` — руками). Контроль: `git grep -n "core/supabase\|server/supabase"` → 0.
- [ ] **Step 4:** `.env.example`: `VITE_SUPABASE_PUBLISHABLE_KEY=` (+ коментар про legacy anon fallback).
- [ ] **Step 5:** Повна верифікація (`start.ts` guard працює: dev + зайти на `/admin` без сесії → редірект) + коміт: `refactor(supabase): консолідація в @simplycms/supabase (spec §10, частковий обсяг Фази 0)`.

---

## Етап C — server-шар і каркас роутів

### Task 5: Скелети route-пакетів

**Files:** Create: `packages/simplycms/storefront-routes/{package.json,src/index.ts,routes/.gitkeep}`, `packages/simplycms/admin-routes/{package.json,routes/.gitkeep}`; Modify: `tsconfig.json`/`vite.config.ts`/`vitest.config.ts` (алаіси), `tailwind.config.ts` (+`"./packages/simplycms/**/routes/**/*.{ts,tsx}"`).

- [ ] **Step 1:** `storefront-routes/package.json`: exports `{".": "./src/index.ts", "./server/*": "./src/server/*.ts", "./seo/*": "./src/seo/*.ts", "./routes/*": "./routes/*"}`; `src/index.ts` — реальний файл (поки порожній export). `admin-routes/package.json`: exports **лише** `{"./routes/*": "./routes/*"}` — без `"."`, бо `src/` у нього немає (Codex №10).
- [ ] **Step 2:** peerDeps обох: `@tanstack/react-router`, `@tanstack/react-start`, `react`. Верифікація + коміт: `feat(routes-pkg): скелети storefront-routes/admin-routes`.

### Task 6: Переїзд server-шару і SEO в `storefront-routes` (ДО роутів)

**Files:**
- Move: `src/server/*.ts` (auth, themes, products, sections, home, properties, engine…) → `packages/simplycms/storefront-routes/src/server/`; `src/seo/{sitemap.ts,robots.ts,plugin.ts}` → `.../src/seo/`; `src/active-theme.ts` → `.../src/active-theme.ts`
- Modify: **усі** імпортери: route-файли (`../../server/home` → `@simplycms/storefront-routes/server/home` — алаісні, глибина неважлива), `src/routes/__root.tsx`, `src/routes/admin.tsx` (`../server/auth` → `@simplycms/storefront-routes/server/auth`), `src/client.tsx` (active-theme, якщо є), `vite.config.ts` (імпорт `seoRoutesPlugin`)
- Modify: `.../src/seo/plugin.ts` — **виправити hardcoded `ssrLoadModule('./src/seo/…')`** (Codex №13): шляхи модулів передавати параметром плагіна з `vite.config.ts` (`seoRoutesPlugin({ sitemapModule: '/packages/simplycms/storefront-routes/src/seo/sitemap.ts', robotsModule: '…/robots.ts' })`)

- [ ] **Step 1:** `git mv` + заміна імпортів: `git grep -l "\.\./server/\|\.\./\.\./server/\|\.\./\.\./\.\./\.\./server/" -- src` → sed на алаіс; `git grep -n "server/\|seo/\|active-theme" -- src vite.config.ts src/client.tsx` → усі на алаісах.
- [ ] **Step 2:** `pnpm dev` smoke: `/`, `/catalog`, `/admin` (guard), **`/sitemap.xml` і `/robots.txt` віддаються** (перевірка фікса плагіна).
- [ ] **Step 3:** Повна верифікація + коміт: `refactor(storefront): server-шар і SEO переїхали в @simplycms/storefront-routes`.

### Task 7: `routes.ts` + virtualRouteConfig + пілот

**Files:** Create: `routes.ts`, `src/routes/my/.gitkeep`; Modify: `vite.config.ts`; Move: `src/routes/admin/index.tsx` → `packages/simplycms/admin-routes/routes/admin/index.tsx`.

- [ ] **Step 1:** Зʼясувати точну форму опції: `git grep -n "virtualRouteConfig" node_modules/@tanstack/router-plugin/dist node_modules/@tanstack/start-plugin-core/dist -- '*.d.ts'` → підставити в блок опцій `tanstackStart()` те, що показує `TanStackStartInputConfig` (`tsr`/`router`); опція приймає шлях або обʼєкт — за типом.
- [ ] **Step 2:** `routes.ts` (код як у v1: `rootRoute('__root.tsx', [physical('/', '../../packages/simplycms/storefront-routes/routes'), physical('/', '../../packages/simplycms/admin-routes/routes'), physical('/', 'my')])`).
- [ ] **Step 3:** Пілот: `git mv src/routes/admin/index.tsx packages/simplycms/admin-routes/routes/admin/index.tsx` → `pnpm build` → у `routeTree.gen.ts`: імпорт відносним шляхом у пакет, id `/admin/` незмінний, решта дерева без змін → `typecheck`/`test` зелені → коміт: `feat(routes): virtualRouteConfig + physical() — пілот admin/index`.

### Task 8: Переїзд усіх admin-роутів

**Files:** Move: `src/routes/admin.tsx` + `src/routes/admin/**` → `packages/simplycms/admin-routes/routes/…` (імпорти вже алаісні після Task 6 — правок не потребують).

- [ ] **Step 1:** Еталон: `grep -oE "'/[^']*'" src/routeTree.gen.ts | sort -u > /tmp/ids-before.txt`.
- [ ] **Step 2:** `git mv`; контроль відносних: `git grep -n "from '\.\." -- packages/simplycms/admin-routes` → 0.
- [ ] **Step 3:** `pnpm build` → diff route id порожній; повна верифікація; коміт: `feat(routes): адмін-роути в @simplycms/admin-routes`.

### Task 9: Переїзд storefront/_protected/auth/api-роутів

**Files:** Move: `src/routes/{_storefront.tsx,_storefront,_protected.tsx,_protected,auth,api}` → `packages/simplycms/storefront-routes/routes/…` (імпорти алаісні після Task 6).

- [ ] **Step 1-3:** Той самий протокол, що Task 8 (еталон id → mv → нуль відносних → diff порожній → верифікація + dev smoke по сторінках). Підсумок: `ls src/routes` = `__root.tsx`, `my/`. Коміт: `feat(routes): storefront-роути в пакеті — host стиснуто до __root + my/`.

### Task 9b: Регрес-тест `physical()`

**Files:** Create: `tests/virtual-routes-escape.test.ts` (код з v1 плану — Generator API, тека поза routesDirectory, перевірка `/shop/products` і шляху `pkg/routes/products` у згенерованому дереві; сигнатури `Generator`/`getConfig` звірити з `node_modules/@tanstack/router-generator/dist/esm/index.d.ts` — тепер це прямий dep після Task 2b).

- [ ] **Step 1-2:** Тест → зелений → коміт: `test(routes): регрес-гард physical() поза routesDirectory`.

---

## Етап D — теми v2 + канонічні сторінки

### Task 10 (АТОМАРНИЙ: підетапи A-D, одна green/commit-межа — виняток з інваріанта, заявлено явно)

**Interfaces (Produces):**

```ts
// theme-system/src/types.ts — ПОВНА заміна старого контракту
export interface ThemeManifest { name: string; displayName: string; version: string; engines: { simplycms: string } }
export interface DesignTokens { /* значення для НАЯВНИХ semantic CSS-змінних shadcn: */
  background?: string; foreground?: string; primary?: string; 'primary-foreground'?: string;
  secondary?: string; accent?: string; border?: string; radius?: string; /* + решта наявних --vars */ }
export interface ThemeComponents { Header: React.ComponentType; Footer: React.ComponentType;
  HeroBanner?: React.ComponentType<{ banners: Banner[] }> }  // опційний; fallback ядра — BannerSlider
export interface ThemeModule { manifest: ThemeManifest; tokens: DesignTokens;
  components: ThemeComponents; settings?: z.ZodTypeAny }
// applyTokens пише в ІСНУЮЧІ змінні (--primary, --background, --radius…), НЕ у нові --color-*
export function applyTokens(tokens: DesignTokens): string
export function validateThemeModule(m: unknown): asserts m is ThemeModule // публічний pure-валідатор
// storefront-routes:
export function StorefrontShell(props: {children: ReactNode}): JSX.Element   // Header/Footer теми + токени
export function ProtectedShell(props: {children: ReactNode}): JSX.Element    // канонічний профіль-каркас (бічна навігація, sign-out) — заміна theme.ProfileLayout
```

- [ ] **A (типи + токени, TDD):** тести на `validateThemeModule` (публічна функція, не приватний метод: приймає валідний модуль; відхиляє без `Header`/без `engines`) і `applyTokens({primary:'221 83% 53%'})` → містить `--primary: 221 83% 53%`. Реалізувати `types.ts` (старі `ThemePages`/layouts — видалити), `applyTokens.ts`, `validateThemeModule.ts`; `ThemeRegistry.load` fallback на `'default'` при відсутній темі (+тест). Fallback-виняток: якщо і `default` не зареєстровано — reject (як зараз).
- [ ] **B (канонічні сторінки):** `git mv packages/simplycms/core/src/pages packages/simplycms/storefront-routes/src/pages` (15 сторінок); **створити канонічну `HomePage`** (в core її НЕМАЄ — перенести з `themes/default/pages/HomePage.tsx`, параметризувавши банер-блок через `theme.components.HeroBanner ?? BannerSlider`); `StorefrontShell` (код з v1) + `ProtectedShell` (перенести розмітку з `themes/default` ProfileLayout: бічна навігація, sign-out — на `@simplycms/ui` + `useSupabaseClient`); route-файли `_storefront/**`, `_protected/**`, auth: рендерять сторінки напряму, `_storefront.tsx` → `StorefrontShell`, `_protected.tsx` → `ProtectedShell` (замість `theme.ProfileLayout`).
- [ ] **C (перебудова тем):** `themes/default/index.ts` → `ThemeModule v2` (`tokens` — значення з поточного `styles/theme.css` під наявні змінні; `components: {Header, Footer, HeroBanner: BannerSlider-адаптер}`); `git rm -r themes/default/{pages,layouts}` ПІСЛЯ `git diff --stat`-звірки, що унікальний код перенесено (B). Дзеркально solarstore (своя палітра; `HeroBanner` відсутній — опційний, fallback ядра).
- [ ] **D (зелений стан):** `pnpm typecheck` — компілятор як чекліст залишків старого контракту (`ThemeContext`, `getActiveThemeSSR`, `ThemeResolver`, `CMSProvider`) → виправити; повна верифікація + dev smoke (головна: Header/Footer/токени теми; перемикання теми в адмінці міняє вигляд; `/profile` працює на `ProtectedShell`). **Один коміт:** `feat(themes)!: контракт v2 tokens+components + канонічні сторінки в ядрі (spec §6, D3/D4)`.

---

## Етап E — плагін-контур

### Task 11: Конфіг як джерело істини + реактивний bootstrap

**Files:**
- Modify: `packages/simplycms/runtime/src/index.ts` — **єдиний канонічний `defineConfig`** (типи: + `plugins?: PluginRegistration[]`, + `themes?: Record<string, ThemeLoader>`); `simplycms.config.ts` — **перевести імпорт з `@simplycms/core/config` на `@simplycms/runtime`**; Delete: `packages/simplycms/core/src/config.ts` (legacy defineConfig, D5)
- Modify: `packages/simplycms/plugin-system/src/HookRegistry.ts` (+підписка: `subscribe(listener): () => void`, нотифікація з `register`/`unregister`/`clear`), `PluginSlot.tsx` (**`useSyncExternalStore(hookRegistry.subscribe, …)`** — слоти реактивні до змін реєстру)
- Create: `packages/simplycms/plugin-system/src/bootstrap.ts`; `plugins/hello-world/{package.json,index.ts}`
- Modify: `src/routes/__root.tsx` (клієнтський bootstrap), `src/theme-registry.ts` (читає `config.themes`)
- Test: `packages/simplycms/plugin-system/src/__tests__/{bootstrap.test.ts,slot-reactive.test.tsx}`

**Interfaces (Produces):**

```ts
export interface PluginRegistration { name: string; module: () => Promise<{ default: PluginModule }> }
export async function bootstrapPlugins(regs: PluginRegistration[], supabase: SupabaseClient): Promise<void>
// 1) registerPluginModule для КОЖНОГО reg; 2) upsert відсутніх у таблиці plugins
//    (name/display_name/version з manifest модуля, is_active=false) — щоб адмінка їх бачила (Codex №22);
// 3) loadPlugins(supabase) — вмикає активні; 4) невідомий активний у БД → console.error + пропуск (spec §8)
```

- [ ] **Step 1 (TDD bootstrap):** mock-supabase (патерн `engine-provider.test.tsx`): (а) зареєстрований+активний → hook у registry; (б) активний у БД, незареєстрований → без падіння, `console.error`; (в) зареєстрований, неактивний → hooks нема, але **рядок upsert-нутий у plugins**; FAIL → реалізація → PASS. `console.log` у `PluginLoader` → лишити тільки error-кейси.
- [ ] **Step 2 (TDD реактивність):** `slot-reactive.test.tsx`: рендер `PluginSlot name="admin.dashboard.widgets"` → порожньо; `hookRegistry.register('admin.dashboard.widgets', 'p', () => <b>W</b>)` → віджет зʼявився без ремаунта. FAIL → `subscribe`+`useSyncExternalStore` → PASS. **Семантика togglе в адмінці:** `activatePlugin`/`deactivatePlugin` вже викликають register/unregister — з реактивним слотом віджет зʼявляється/зникає живцем; перезавантаження не потрібне (задокументувати в коді).
- [ ] **Step 3:** `runtime` canonical `defineConfig`; `simplycms.config.ts`: імпорт з `@simplycms/runtime`, поля як були + `plugins: [{name:'hello-world', module: () => import('@plugins/hello-world')}]`, `themes: {default: …, solarstore: …}` (перенесено з theme-registry); `src/theme-registry.ts` = тонкий споживач `config.themes`. `git grep -n "core/config"` → 0.
- [ ] **Step 4:** `plugins/hello-world/index.ts` — `PluginModule` з hook **`admin.dashboard.widgets`** (точне імʼя з `HookName`-типу). `__root.tsx`: client-only виклик `bootstrapPlugins(...)` в effect до першого рендера слотів не блокує гідрацію — слоти реактивні, доженуть (задокументувати; SSR-слоти сторфронту в цій фазі не вмикаємо — PluginSlot і так client-effect).
- [ ] **Step 5:** Повна верифікація + smoke: `/admin/plugins` бачить hello-world (upsert) → увімкнути → віджет на дашборді **без reload** → вимкнути → зник. Коміт: `feat(plugins): контур підключено — канонічний defineConfig, реактивні слоти, bootstrap, референс-плагін`.

---

## Етап F — Drizzle-конвеєр

### Task 12: Baseline з інтроспекції (spike з чіткими gate-ами)

**Files:** Create: `packages/simplycms/schema/{package.json,drizzle.config.ts,src/schema.ts (згенерований),drizzle/ (meta+snapshots),README.md}`; Modify: кореневий `package.json` (devDeps **exact**: `drizzle-orm`, `drizzle-kit`, `pg`; скрипт `db:pull`).

- [ ] **Step 1:** Встановити pinned devDeps (+`pg` — драйвер, без нього pull не працює). `drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',                       // МЕТА+snapshots+staging SQL Drizzle — ОКРЕМО від supabase/migrations
  dbCredentials: { url: process.env.DATABASE_URL! },
  schemaFilter: ['public'],               // НЕ тягнути auth/storage/realtime
  entities: { roles: { provider: 'supabase' } },
});
```

- [ ] **Step 2 (pull):** `DATABASE_URL=… pnpm db:pull` → drizzle-kit пише `schema.ts`/`relations.ts` у **`out`** → перемістити в `src/` (задокументувати в README цей крок; snapshot лишається в `drizzle/meta`).
- [ ] **Step 3 (RLS — blocking gate, spec D6):** перевірити наявність `pgPolicy`/`.withRLS` у згенерованій схемі. Політики, які pull НЕ витяг, — **дописати руками** в `schema.ts` (джерело: `select * from pg_policies where schemaname='public'`). Parity-перевірка — тест `packages/simplycms/schema/src/__tests__/rls-parity.test.ts`: кількість політик у `schema.ts` (регекс по `pgPolicy(`) === кількість рядків дампа `pg_policies` (фікстура, знята в цьому кроці й закомічена; README: як оновлювати).
- [ ] **Step 4 (нуль-diff gate):** `pnpm drizzle-kit generate --config …` → згенерований SQL **порожній/відсутній**; якщо diff є — правити `schema.ts` до нуля (типи/дефолти). Прибрати staging-артефакти цієї перевірки: `git checkout -- packages/simplycms/schema/drizzle && git clean -fd packages/simplycms/schema/drizzle` → **`git status` чистий** (відкат включає meta, Codex №29).
- [ ] **Step 5:** Верифікація + коміт: `feat(schema): Drizzle-baseline (schema+RLS у TS, snapshot у drizzle/) — spec §9`.

### Task 13: Конвеєр `db:diff`/`db:migrate` (адаптер до формату Supabase)

**Files:** Create: `scripts/db-diff.mjs`, `scripts/db-migrate.mjs`; Modify: кореневий `package.json` (скрипти), `.github/instructions/data-access.instructions.md`; Delete: `supabase/scripts/migrate.mjs` (+`update-types.mjs` НЕ чіпати).

- [ ] **Step 1:** `scripts/db-diff.mjs`: (1) `drizzle-kit generate --config packages/simplycms/schema/drizzle.config.ts --name <arg>`; (2) взяти новий `.sql` зі `schema/drizzle`, **скопіювати** в `supabase/migrations/<YYYYMMDDHHmmss>_<name>.sql` (формат Supabase CLI); (3) вивести шлях + нагадування про ревʼю. Meta/snapshot Drizzle лишаються в `schema/drizzle` (комітяться) — подвійна бухгалтерія задокументована в README схеми.
- [ ] **Step 2:** `scripts/db-migrate.mjs` — зберегти функції старого `migrate.mjs`: load `.env.local`, перевірка `supabase` CLI, `supabase link --project-ref $SUPABASE_PROJECT_ID` (ідемпотентно), `supabase db push`, потім **`pnpm db:generate-types`** (ланцюжок зі spec §9). `package.json`: `"db:diff": "node scripts/db-diff.mjs"`, `"db:migrate": "node scripts/db-migrate.mjs"`, `db:pull` як у Task 12.
- [ ] **Step 3 (e2e конвеєра, без БД-змін):** тестова колонка в `schema.ts` → `pnpm db:diff test-col` → файл у `supabase/migrations` з `ALTER TABLE … ADD COLUMN` → відкат: правка схеми назад, видалення згенерованого SQL у **обох** теках + відновлення meta (`git checkout -- … && git clean -fd …`) → `git status` чистий.
- [ ] **Step 4:** `git rm supabase/scripts/migrate.mjs`; інструкції data-access: новий флоу (schema.ts → db:diff → ревʼю → db:migrate → типи), прибрати «тільки через MCP». Верифікація + коміт: `feat(db): конвеєр db:diff/db:migrate (drizzle-kit → формат Supabase CLI); migrate.mjs виведено`.

---

## Етап G — i18n-скелет

### Task 14: `@simplycms/i18n` (request-scoped, без глобального стану)

**Files:** Create: `packages/simplycms/i18n/{package.json,src/{index.ts,catalogs/uk.ts,catalogs/en.ts,__tests__/translator.test.ts}}`; Modify: `tsconfig.json`/`vite.config.ts`/`vitest.config.ts` (алаіс), `package.json` route-пакетів (dep `@simplycms/i18n: workspace:*`), `eslint.config.mjs`, `StorefrontShell` + `pages/Cart.tsx` (демо-міграція), `simplycms.config.ts` (locale → нормалізація).

**Interfaces (Produces):**

```ts
export type Locale = 'uk' | 'en';
export type MessageKey = keyof typeof import('./catalogs/uk').messages;
export function createTranslator(locale: Locale): (key: MessageKey, params?: Record<string, string|number>) => string
export function normalizeLocale(input: string): Locale   // 'uk-UA' → 'uk'; невідома → 'uk'
export const I18nProvider: React.FC<{locale: Locale; children: ReactNode}>  // контекст
export function useT(): ReturnType<typeof createTranslator>
```

**БЕЗ `setLocale`/глобального mutable-стану** (SSR-safe, Codex №30): транслятор створюється per-request/per-render від локалі з конфіга.

- [ ] **Step 1 (TDD):** тести: `createTranslator('uk')('cart.title')` → «Кошик»; `('en')` → `Cart`; відсутній ключ у en → fallback uk; параметри `{count: 5}`; **конкурентність**: два транслятори з різними локалями в interleaved-викликах не впливають один на одного; `normalizeLocale('uk-UA')` → `'uk'`. FAIL → реалізація → PASS.
- [ ] **Step 2:** `I18nProvider` у `StorefrontShell` (locale = `normalizeLocale(config.locale)`); демо-міграція рядків `Cart.tsx` + shell на `useT()`.
- [ ] **Step 3 (лінт):** `no-restricted-syntax` для JSXText з кирилицею: **error** для `packages/simplycms/storefront-routes/**` (сторінки мігруються тут же — порушень нуль або міграція в цьому кроці), **warn** для `packages/simplycms/admin/**` (повна міграція адмінки — пункт роадмапу Фази 1+, зафіксувати в `platform-roadmap.md`).
- [ ] **Step 4:** `pnpm install --frozen-lockfile` (workspace-deps коректні) + повна верифікація + коміт: `feat(i18n): request-scoped транслятор uk/en + лінт хардкодів (spec §12)`.

---

## Етап H — гігієна

### Task 15: Guest-token геть з URL

**Files:** Modify: `packages/simplycms/storefront-routes/src/pages/OrderSuccess.tsx`; Test: `.../src/__tests__/order-success-token.test.tsx`.

- [ ] **Step 1 (TDD):** мок `useNavigate` (з `@tanstack/react-router`): після успішного завантаження замовлення викликано `navigate({ search: expect.any(Function), replace: true })` і функція-трансформер з `{token:'abc', foo:'x'}` повертає `{foo:'x'}` (**інші параметри зберігаються, прибирається лише `token`**); при помилці завантаження navigate НЕ викликано.
- [ ] **Step 2:** Реалізація: `const navigate = useNavigate();` в компоненті сторінки; в effect за успіхом: `navigate({ search: (s) => { const { token: _t, ...rest } = s; return rest; }, replace: true })`. Контракт Edge Function незмінний.
- [ ] **Step 3:** Верифікація + коміт: `fix(security): guest-token прибирається з URL після використання`.

### Task 16: SSR-повнота списків товарів (ОБОВʼЯЗКОВИЙ фікс)

Відомий факт (Codex №34 + git history `ssr-product-list-enrichment.md`): `Catalog`/`CatalogSection` ігнорують серверні дані — списки НЕ в SSR-HTML. Це фікс, не «перевірка».

**Files:** Modify: `packages/simplycms/storefront-routes/src/pages/{Catalog.tsx,CatalogSection.tsx}`, route-файли `catalog/index.tsx` і `catalog/$sectionSlug/index.tsx` (передати loader-дані як `initialProducts` у сторінки); Test: `.../src/__tests__/catalog-ssr.test.tsx`.

- [ ] **Step 1 (TDD):** `renderToString(<Catalog initialProducts=[фікстура з name/price/image]/>)` (обгорнуто в мінімальні провайдери, mock supabase) → HTML містить назву і ціну товару. Те саме для `CatalogSection`. FAIL (зараз перший рендер порожній до клієнтського fetch) → фікс.
- [ ] **Step 2:** Фікс у межах: сторінки використовують `initialProducts` як `initialData`/початковий стан рендера (назва+ціна+зображення з loader-а); клієнтський React Query далі збагачує (stock/знижки) — без нових RPC, одне джерело правди для базових полів.
- [ ] **Step 3:** Підтвердження в реальному SSR: `pnpm dev` + `curl -s localhost:3000/catalog | grep -o "<назва товару з БД>"` → знайдено (і для `/catalog/<slug>`). Верифікація + коміт: `fix(ssr): списки товарів рендеряться в серверному HTML`.

---

## Етап I — фініш

### Task 17: Зачистка + синхронізація документації + DoD

**Files:** Delete: невикористані шими core (кожен після `git grep`-перевірки використань); Modify: `CLAUDE.md`, `AGENTS.md`, `.github/instructions/architecture-core.instructions.md` (нова структура/пакети/контракт тем/міграційний флоу), **`docs/superpowers/specs/2026-07-30-platform-architecture-design.md` §4** (амендмент: фактичні імена `@simplycms/themes`, `@simplycms/plugins`; `@simplycms/engine` — за фактом Фази 0 лишаються `data-supabase`+`react-query`, обʼєднання — Фаза 1+), `docs/tasks/platform-roadmap.md` (чекбокси Фази 0 + пункт «i18n адмінки: warn→error»).

- [ ] **Step 1:** Шими: для кожного кандидата `git grep -n "<шлях>" -- ':!сам-файл'` → 0 → `git rm`; не нуль → лишити, зафіксувати споживача в коміті.
- [ ] **Step 2:** Документи за списком; чекбокси роадмапу.
- [ ] **Step 3 (DoD):** `pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test` зелені; dev smoke (головна/каталог/товар/адмінка/профіль/sitemap); регрес-тест physical() зелений; `git grep -c '@simplysoftua'` = 0; `git diff --check` чистий → коміт: `chore(phase0): зачистка + синхронізація документації — Фаза 0 завершена` → після коміту `git status` чистий.

---

## Self-review v2

- **Усі 38 знахідок Codex адресовані:** №1→T2b; №2→T2b; №3→T2-прим.+T17; №4→T2.2; №5→T3; №6-8→T4 (мапа API; §10 частково — заявлений deferral); №9,12→порядок B/C (server-шар до роутів) + T4 start.ts; №10→T5; №11→deferral (Фаза 1); №13→T6; №14→T10 tokens на наявні змінні; №15→`validateThemeModule` публічний; №16→T10.B HomePage; №17→ProtectedShell; №18→HeroBanner опційний+адаптер; №19→T11 канонічний defineConfig; №20→`admin.dashboard.widgets`; №21→реактивний PluginSlot+семантика; №22→upsert у bootstrap; №23-27→T12/13 (окремий out, RLS blocking+parity, pinned+pg+schemaFilter, адаптер формату); №28→wrapper db-migrate; №29→відкат meta; №30→createTranslator без глобального стану; №31→normalizeLocale+error/warn зони+роадмап; №32→deps/алаіси T14; №33→точний navigate API+збереження params; №34→T16 обовʼязковий+SSR-тест; №35→T1 всі workspace; №36→формулювання DoD; №37→git grep всюди; №38→T10 атомарний, заявлено в інваріанті.
- Плейсхолдерів немає; типи/імена наскрізь узгоджені (`bootstrapPlugins`, `createTranslator`, `validateThemeModule`, `StorefrontShell`/`ProtectedShell`, мапа supabase-API).
