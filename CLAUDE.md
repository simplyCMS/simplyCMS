# CLAUDE.md — SimplyCMS

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
pnpm build:packages   # tsup build публікованих пакетів ядра
pnpm test:packaging   # Tarball-parity suite (vitest.packaging.config.ts)
pnpm test:e2e         # БРАУЗЕРНИЙ контур: Playwright по монорепо-хосту.
                      # scripts/e2e.mjs сам піднімає локальний Supabase (Docker),
                      # накатує сід, створює власника — і ганяє специ ДВІЧІ:
                      # під VITE_LOCALE=uk-UA і en-US, послідовно.
                      # У CI НЕ ганяється (Docker + ~10 ГБ образів) — як і пілот
pnpm pilot:pack       # tarball-пілот: гейти A/C/D/CLI — БЕЗ Supabase (Gate B відсутній, Gate E — видимо skipped)
pnpm pilot            # той самий пілот + Gate B проти живої БД (.env.local); Gate E — видимо skipped (потрібен --e2e)
pnpm pilot:e2e        # пілот A/C/D/CLI/B/E проти ЛОКАЛЬНОГО стеку (supabase start + seed.sql);
                      # потребує Docker; Gate B асертить точні назви із сіду,
                      # Gate E — owner:invite (inviteUserByEmail → /auth/confirm → set-password) наживо
pnpm pilot:seed       # перегенерувати supabase/seed.sql із фікстур пілота
pnpm template:sync    # синк закомічених копій з монорепо, ТРИ цілі: template/ скаффолдера,
                      # packages/cli/host/ (канон host-файлів для simplycms update),
                      # packages/simplycms/migrations/ (для simplycms db:diff) — усі під парність-тестом
pnpm release 0.4.0    # РЕЛІЗ: гарди + бамп версії всіх 5 пакетів + гейти + коміт
                      # → git push → PR у main → мерж публікує на npmjs
                      # Повний опис — docs/architecture/release-process.md
pnpm version:packages 0.2.0   # «сирий» бамп версій БЕЗ гейтів і коміту (нетипові випадки)
pnpm db:pull / db:diff / db:migrate / db:dump-rls / db:generate-types / types:baseline
                      # Схема БД і типи — див. «Database Commands»
```

## What This Project Is

SimplyCMS is an open-source e-commerce CMS built with **TanStack Start (Vite)** and Supabase. It provides a full storefront (SSR), admin panel (client-side SPA), user profiles, cart, checkout, and order management. The core CMS packages live in this monorepo and are published to npmjs (Фаза 1+).

**Platform direction (затверджено 2026-07-30):** SimplyCMS розвивається в OpenCart-подібну платформу — ядро постачає каркас (роути/сторінки) npm-пакетами, магазин стає тонкою збіркою, плагіни й теми — встановлювані одиниці. Джерело правди: [`docs/superpowers/specs/2026-07-30-platform-architecture-design.md`](docs/superpowers/specs/2026-07-30-platform-architecture-design.md); трекінг: [`docs/tasks/platform-roadmap.md`](docs/tasks/platform-roadmap.md).

**Фаза 0 завершена 2026-07-31.** Її здобутки чинні й сьогодні, але вже в топології К0: роути й канонічні сторінки живуть у ядрі (теки `routes/storefront`, `routes/admin` і `src/storefront-routes` пакета `simplycms`), host стиснуто до `__root.tsx` + `src/routes/my/`, теми — контракт v3, схема БД — Drizzle-baseline (`simplycms/schema`). Незакриті борги Фази 0 перелічені в роадмапі (розділ «Борги»).

🔴 **Трек К0 (консолідація пакетів) — У КОДІ цієї гілки, у реєстрі npm ЩЕ НІ.** 26 npm-пакетів зведено в 5: unscoped фреймворк-пакет `simplycms` (усе ядро T0–T5 теками `packages/simplycms/src/*`) + сателіти `@simplycms/{cli,theme-solarstore,plugin-faq}` + `create-simplycms-store`. Специфікатори ядра — субшляхи `simplycms/<тека>`; фасад `@simplycms/core` розчинено; дисципліну шарів тримають eslint-тір-зони; агентні скіли доставляються магазинам симлінками на `node_modules/simplycms/skills/`. Спека — [`2026-08-20-package-consolidation-design.md`](docs/superpowers/specs/2026-08-20-package-consolidation-design.md). 🔴 **Публікація** `simplycms` (і deprecate 22 злитих імен) відбувається в момент мержу гілки в `main` — до того реєстр тримає стару топологію 26 пакетів `0.3.0`. Опис нижче в цьому файлі — стан коду ПІСЛЯ К0.

🔴 **Стратегічний напрям 2026-08-19 затверджено власником, у коді ще НЕМАЄ.** Три звʼязані спеки: **бекенд-контракт v2** (ревізія D7 → D7′: сервер-first дані — браузер не звертається до БД, PostgREST/GoTrue/supabase-js зникають; Better Auth; storage-порт; чистий Postgres як контракт, Supabase — один із провайдерів) — [`2026-08-19-backend-contract-v2-design.md`](docs/superpowers/specs/2026-08-19-backend-contract-v2-design.md); **маркетплейс** (модель поставки П1–П5 ухвалена) — [`2026-08-18-marketplace-platform-design.md`](docs/superpowers/specs/2026-08-18-marketplace-platform-design.md); **хмара** (`simplycms/platform`, Dokploy, тенант = застосунок + Postgres) — [`2026-08-19-cloud-platform-design.md`](docs/superpowers/specs/2026-08-19-cloud-platform-design.md). Клієнтів і реальних магазинів немає — реструктуризація БЕЗ зворотної сумісності. Черга виконання — роадмап. Опис Supabase-механік нижче в цьому файлі — чинний стан коду ДО v2. Четверта спека — консолідація пакетів (трек К0) — йшла ПЕРШОЮ і **вже виконана** (блок вище); `theme-sdk` V2-К5 приземлиться субшляхом того самого пакета.

## Mandatory Instructions

All detailed coding rules, architecture decisions, and domain-specific guidelines are maintained in `.github/instructions/`. **These are mandatory and must be followed.**

| File | Scope | Description |
|------|-------|-------------|
| [`architecture-core`](.github/instructions/architecture-core.instructions.md) | `**/*` | Core architecture, rendering strategies, themes, plugins, auth |
| [`coding-style`](.github/instructions/coding-style.instructions.md) | `**/*` | TypeScript strict mode, Ukrainian comments, file limits |
| [`data-access`](.github/instructions/data-access.instructions.md) | `app/**`, `packages/**` | Supabase clients, caching, data fetching, DB types |
| [`ui-architecture`](.github/instructions/ui-architecture.instructions.md) | `app/**`, `themes/**`, `ui/**` | UI components, theme structure, shadcn/ui |
| [`editor`](.github/instructions/editor.instructions.md) | `core/**` | Tiptap editor integration |
| [`storage`](.github/instructions/storage.instructions.md) | `core/**`, `app/**` | Supabase Storage patterns |
| [`tooling`](.github/instructions/tooling.instructions.md) | `**/*` | Commands, formatting, testing |
| [`optimization`](.github/instructions/optimization.instructions.md) | `**/*.ts,tsx` | Performance, bundle, rendering optimization |

Also see:
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — Full project overview, MCP servers, agents
- [`AGENTS.md`](AGENTS.md) — Agent-specific instructions
- [`docs/architecture/test-contours.md`](docs/architecture/test-contours.md) — 🔴 **межі тестування**: чому зелений `pnpm test` нічого не каже про опублікований пакет, що доводить кожен гейт пілота (A/B/C/D/E/CLI/TOOL), які зони не покриті й що змінить `apps/dev-store`
- [`docs/architecture/cli.md`](docs/architecture/cli.md) — механізм `simplycms` CLI (doctor/add/create (plugin|theme)/update/db:diff/theme:conformance): команди, канон host-файлів і міграцій, контракт серверного env, звʼязок із реліз-потягом
- [`docs/architecture/plugins.md`](docs/architecture/plugins.md) — механізм плагінів (Фаза 3): контракт `definePlugin`, рантайм-контур, межа довіри, конвеєр міграцій `plg_*`, i18n плагінів, adminRoutes, інваріант імені, межі v1
- [`docs/architecture/themes.md`](docs/architecture/themes.md) — механізм тем (Фаза 4): контракт `ThemeModule`, пакування npm vs copy-in, `bootstrapThemes` і БД, conformance-kit, межі v1
- [`docs/guides/themes.md`](docs/guides/themes.md) — практичний посібник по темах для розробника магазину й автора теми (how-to поверх механізму)

## Agent Tooling

Процесний тулінг для агентної розробки. Джерело правди — `.agents/skills/`;
`.claude/skills/*` і `.github/prompts/*.prompt.md` — симлінки на нього, щоб
Claude Code й Copilot читали **одні й ті самі** файли.

🔴 **Виняток — скіли, які їдуть у магазини** (з треку К0): їхнє джерело
правди — тека `packages/simplycms/skills/<name>` пакета ядра, а `.agents/
skills/<name>` і `.claude/skills/<name>` монорепо — **прямі симлінки** на неї
(обидва в пакет, не ланцюжком один через одного). Так само їх отримує магазин:
скаффолдер створює обидві пари лінків на `node_modules/simplycms/skills/<name>`
після `installDeps`, `simplycms update` доробляє відсутні й прибирає осиротілі,
`doctor` №12 звітує розсинхрон. Копії скіла в шаблоні більше немає
(`template/.claude/` видалено) — оновлення ядра оновлює скіл автоматично.
Сьогодні під цим механізмом один скіл — `redesign-from-reference`.

| Шар | Що це |
|-----|-------|
| `.agents/skills/codebase-research/` | Як шукати в репо: `orient` (карта символів, валідація якорів плану), протокол стейл-графа, формат звіту-дельти |
| `.agents/skills/code-review/` | Як рев'ювити: шкала `blocker/major/minor` × confidence з порогом 80, шість лінз, обов'язковий adversarial-крок |
| `packages/simplycms/skills/redesign-from-reference/` (лінки — `.agents/skills/` і `.claude/skills/`) | Як робити редизайн магазину за референс-сайтом, фази 0-6: правові межі, дискавері сторінок із обовʼязковим діалогом, детерміністична інспекція (`scripts/` усередині скіла) — кольори, типографіка й **motion** (transitions/keyframes/reveal/hover/JS-детект, `inspection.json` `schemaVersion: 3`), мапінг токенів по всіх знятих сторінках, тема штатним лайфсайклом, спека-файли компонентів із секцією Motion, **обовʼязковий** side-by-side по кожному підтвердженому типу з класифікацією розбіжностей, опційне шліфування. Їде в магазини текою `skills/` пакета `simplycms` (симлінки, не копія); посібник — [`docs/guides/redesign-from-reference.md`](docs/guides/redesign-from-reference.md) |
| `.claude/agents/` | Субагенти `codebase-research`, `code-review` (одна лінза за виклик), `code-review-verifier` (скептик) |
| `.claude/commands/` | `/виконай-задачу` (головна), `/перевір-роботу-агента-кодування`, `/проведи-додаткове-дослідження`, `/граф-онови`, `/поділи-задачу-на-етапи`, `/перевір-нову-версію-задачі`, `/проаналізуй-кларіфай-питання`, `/перевір-скіли`, `/редизайн-за-референсом` |

```bash
ORIENT=.agents/skills/codebase-research/scripts/orient
$ORIENT ThemeRegistry getActiveTheme   # де лежить + хто споживає (з транзитивними через барелі)
$ORIENT --plan docs/superpowers/plans/2026-07-31-phase0-foundation.md
$ORIENT --doctor                       # чи є граф, чи свіжий, чи немає привидів
```

**Knowledge graph (graphify).** `graphify-out/` — локальний артефакт (gitignored),
оновлюється post-commit хуком (AST, без LLM). `orient` працює і без графа —
тихо падає на `ripgrep`. Семантика доків і назви спільнот хуком **не**
оновлюються — це `/граф-онови`; 🔴 завжди з явною дешевою моделлю
(`--model=haiku`), бо `--backend claude-cli` без моделі бере Opus.

**🔴 Порядок гейтів:** `pnpm install --frozen-lockfile → format:check → lint →
build → typecheck → test → build:packages → typecheck:template →
test:packaging`.
🔴 `install --frozen-lockfile` — **перший** і не пропускається після будь-якої
правки `package.json`: жоден інший гейт не звіряє `pnpm-lock.yaml` з манифестами,
а звичайний `pnpm install` мовчки лагодить розсинхрон замість червоніти. У CI
frozen — дефолт, тож локально зелене, а на PR усі job-и падають із
`ERR_PNPM_OUTDATED_LOCKFILE` ще до першого кроку (спіймано на PR #20: перенесення
`pg`/`dotenv` у devDependencies без перегенерації lockfile).
`build` іде **перед** `typecheck`, бо генерує `src/routeTree.gen.ts`;
packaging-suite іде **після** `pnpm test`, бо `tests/published-exports-parity.test.ts`
виведено з дефолтного прогону (`test.exclude`) і працює по зібраних tarball-ах —
без `pnpm build:packages` перед ним `pnpm test:packaging` не має що перевіряти.
гейт саме `format:check`, бо `pnpm format` — це `prettier --write`, який не
червоніє.

🔴 **`typecheck:template` — окремий гейт, і саме після `build:packages`.**
Кореневий `tsconfig.json` ВИКЛЮЧАЄ `packages/create-simplycms-store/template`
(його імпорти резолвляться з `node_modules` магазину, не workspace-аліасами),
тому `pnpm typecheck` шаблону не бачить. Розрив був не теоретичний: помилка
типів у `template/routes.ts` проходила `tsc`, `lint`, `test`, `build:packages`
і `test:packaging` ЗЕЛЕНИМИ — ловив її лише `pnpm pilot:pack`, якого в CI
немає. `typecheck:template` типізує шаблон проти зібраного `dist` (те саме,
що бачить магазин), тому потребує `build:packages` перед собою. Список файлів
під ним стереже `tests/template-typecheck-coverage.test.ts`.

`prettier` — exact `3.9.6` у `devDependencies`; обидві команди покривають **увесь
репозиторій** (`prettier --write .` / `--check .`), а не лише `src/**`.
Що НЕ форматується — у `.prettierignore`: згенерований машиною код
(`src/routeTree.gen.ts`, `supabase/types.ts`, Drizzle-схема і `drizzle/`),
артефакти збірки і **всі `*.md`** (доки вичитує людина — prettier ламає ручне
вирівнювання таблиць і списків без користі для коду).

🔴 **`pnpm lint` = 0 errors / 13 warnings — це НОРМА** (станом на 2026-08-09,
після i18n-міграції). Ворнінги — `react-hooks/*` і `no-unused-vars`, до i18n
стосунку не мають. Два `no-restricted-syntax`-селектори (i18n) переведено
з warn на **error** і діють на host `src/`, ОБИДВІ роут-теки ядра
(`routes/storefront` і `routes/admin`), `src/storefront-routes`, `src/admin`
і пʼять `src/*-ui` пакета ядра плюс компоненти тем — новий кириличний рядок
інтерфейсу там валить лінт.
🔴 `routes/admin` увійшла в зону 2026-08-21 (борг К0-1 закрито): єдиний
хардкод «Завантаження адмінки…» переведено на ключ `admin.common.loading`
(`AdminPending` — React-компонент на тому ж місці дерева, що й `AdminLayout`,
тобто всередині `I18nProvider`, тож `useT()` там штатний).
Третя error-зона (2026-08-13) — `import.meta.env` у шести
серверних модулях env-контракту (див. «Environment Variables»).
Четверта (2026-08-20, трек К0) — **тір-зони напрямку шарів**:
`eslint.tier-zones.mjs` + `eslint.tier-relative.mjs` забороняють імпорт
угору по тірах усередині пакета ядра (23 зони; обидві форми специфікатора —
bare-субшлях `simplycms/<тека>` і відносний `../<тека>`), бо після злиття
пакетів межу `dependencies` більше не тримає ніщо. Негативний контроль —
`tests/tier-boundary.test.ts`. Селектори не послабляти.

🔴 Зелений лінт завершеності i18n **не доводить**: він бачить лише `JSXText` і
три атрибути (~64 % рядків). Доводять пʼять committed-тестів —
`tests/i18n-coverage.test.ts` (AST-скан по `SCANNED_ROOTS` проти реєстру
`PENDING_FILES`; 🔴 з 2026-08-21 реєстр НЕ порожній — у ньому 16 роут-файлів
ядра, чиї `<title>`/`<meta description>` у `head()` перекласти нічим:
`head()` — функція поза React-контекстом, а локаль магазину ядру недоступна),
`tests/i18n-catalog-parity.test.ts` (повнота `en`),
`packages/simplycms/src/i18n/__tests__/catalog-integrity.test.ts` (дублікати ключів),
`tests/theme-messages-parity.test.ts` (повнота каталогів тем),
`tests/plugin-messages-parity.test.ts` (повнота каталогів плагінів).

**Що покрито (оновлено 2026-08-20).** `SCANNED_ROOTS` у
`tests/i18n-coverage/scan.ts` — host `src/` і теки пакета ядра:
`storefront-routes`, `admin`, уся воронка покупки (`cart-ui`, `catalog-ui`,
`checkout-ui`, `profile-ui`, `reviews-ui`), `core`, `storefront`, `themes`,
`plugins`, `plugin-sdk`; плюс теми (тека `themes/` цілком і референс-пакети
`simplycms-theme-*`) і плагіни (тека `plugins/` цілком і референс-пакети
`simplycms-plugin-*`) — обидва дискавляться з диска, не статичним списком.
🔴 Перелічені саме ТЕКИ, а не `packages/simplycms/src` цілком: core-каталоги
(`src/i18n/catalogs/**`) — кирилиця за побудовою, суцільний корінь вимагав би
перекладу від перекладу. Тобто `locale: 'en-US'` дає англійський магазин
цілком, а не змішаний.

🔴 **Каталогів ТРИ рівні, і плутати їх не можна.** Core-каталог
(`packages/simplycms/src/i18n/catalogs/{uk,en}/`) типізований замкненим union-ом
`MessageKey` — саме він дає перевірку одруків. Тема несе **власний**
каталог (`ThemeModule.messages`, `themes/<name>/messages.ts`) і читається
хуком `useThemeT()`; плагін — власний `messages` у `definePlugin`
(ключі з префіксом `plugin.<name>.`), читається `usePluginT()` з
`simplycms/plugin-sdk`. Класти копірайт теми/плагіна в core-каталог
заборонено: це зламало б типізацію ядра й змішало шари. Ланцюжок скрізь
той самий: `[locale]` → `uk` → сам ключ. Метадані реєстру плагіна
(manifest.description) — англійською: показуються з БД-рядка, не з каталогу.

## Tech Stack

- **Framework:** TanStack Start 1.167 + TanStack Router 1.168 (Vite 8, React 19)
- **Language:** TypeScript 5.9 (strict mode) — 🔴 **свідомо не 6/7**, див. нижче
- **Linting:** ESLint 10 + typescript-eslint 8
- **Package Manager:** pnpm 11.20 (workspaces; налаштування — у `pnpm-workspace.yaml`, не в `package.json`)
- **Database:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **UI:** Tailwind CSS v4 + shadcn/ui (Radix primitives)
- **Forms:** react-hook-form + Zod 4
- **Data Fetching:** TanStack React Query 5 (client) + route loaders / `createServerFn` (server)
- **Rich Text:** Tiptap v3
- **Testing:** Vitest 4 + Testing Library + jsdom 30
- **Formatting:** Prettier 3

🔴 **Чому TypeScript лишається на 5.9** (перевірено 2026-08-04, не інерція):
TS 7 — нативний Go-компілятор без стабільного програмного API до 7.1, тож
`typescript-eslint` закрив запит підтримки як **not planned** (його peer —
`typescript <6.1.0`), а `tsup --dts` ламається повністю: генерація декларацій
кличе Compiler API. Обидва — наші гейти (`pnpm lint`, `pnpm build:packages`).
Апстрім пропонує тримати два компілятори (`@typescript/typescript6` для
тулінгу) — для нас це борг без вигоди.
TS 6 пробували: він вимагає прибрати `baseUrl`, після чого `tsup` інжектує
власний і падає з `TS5101`, а `ignoreDeprecations: "6.0"` відкриває наступний
шар — `TS2209` (неоднозначний корінь проєкту, потрібен явний `rootDir` у
кожному пакеті). Це окремий міграційний проєкт, а не бамп залежності.
**Умова перегляду:** `typescript-eslint` і `tsup` оголосять підтримку TS 7.

## Project Structure

```
simplyCMS/
├── routes.ts                         # virtualRouteConfig: rootRoute + physical() на роут-теки
│                                     # packages/simplycms/routes/{storefront,admin} (+ плагіни)
├── apps/www/                         # Лендінг simplycms.dev: TanStack Start у режимі ПРЕРЕНДЕРУ
│                                     # (статичний HTML, деплой dist/client на будь-який хостинг).
│                                     # private, ПОЗА реліз-потягом (bump/publish сканують лише
│                                     # packages/*). Живі метрики (зірки GitHub, downloads/версія npm)
│                                     # тягне БРАУЗЕР відвідувача з публічних API — сторінка не
│                                     # старіє між білдами; агрегатори під tests/www-live-stats.test.ts.
│                                     # Виключений з root tsconfig (власний), у root eslint/prettier
│                                     # входить (ігнор лише на routeTree.gen.ts). CI — job `www`.
├── src/                              # Host — тонка збірка магазину
│   ├── routes/
│   │   ├── __root.tsx                # Root route (html, providers, 404/error)
│   │   └── my/                       # ЄДИНА тека роутів магазину (кастомні сторінки)
│   ├── server/engine.ts              # createServerFn-glue для EngineContext
│   ├── engine-provider.tsx           # EngineProvider (репозиторії lazy, DI-клієнт)
│   ├── engine.shared.ts              # Shared-частина EngineContext (isomorphic)
│   ├── styles/globals.css            # Tailwind v4 entry (@import + @config)
│   ├── theme-registry.ts             # Реєстрація тем з config.themes (side-effect)
│   ├── router.tsx                    # createRouter
│   ├── start.ts                      # createStart + global request middleware (admin guard)
│   ├── client.tsx                    # Client hydration entry
│   ├── server.ts                     # Server entry: createServerEntry({ fetch }) + точка перехоплення
│   └── routeTree.gen.ts              # AUTO-GENERATED — do not edit
│
├── packages/               # ВСІ публіковані пакети — рівно ПʼЯТЬ (трек К0).
│   │                       # 🔴 Тека `packages/simplycms/` — це САМ фреймворк-пакет
│   │                       # (unscoped npm-імʼя `simplycms`), а не проміжний рівень:
│   │                       # старий проміжний `packages/simplycms/` часів subtree-дзеркала
│   │                       # сплощено 2026-08-04, і ім'я звільнилось. Тулінг відрізняє
│   │                       # ядро за ІМЕНЕМ: scope `@simplycms/` АБО точне `simplycms`
│   │                       # (🔴 ніколи префіксом — зачепив би сторонні simplycms-theme-*).
│   ├── simplycms/          simplycms                 # ФЛАГМАН: усе ядро одним пакетом
│   │   ├── src/contracts/        # T0 Контракти + порти (0 runtime deps); субшляхи
│   │   │                         #    ./views і ./views/fixtures — view-model-и вітрини
│   │   │                         #    (контракт тем v3; react — type-only peer)
│   │   ├── src/domain/           # T1 Pure-логіка: pricing/discounts/inventory/shipping
│   │   ├── src/schema/           # T1 Drizzle-схема ядра + RLS у TS
│   │   ├── src/supabase/         # T2 browser/server/anon-клієнти, SupabaseProvider, keys,
│   │   │                         #    database.ts (baseline core-типів)
│   │   ├── src/data-supabase/    # T2 Реалізації портів на Supabase
│   │   ├── src/react-query/      # T2 Query-хуки через EngineContext
│   │   ├── src/runtime/          # T2 defineRuntime + host-defineConfig
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
│   │   ├── src/{cart,catalog,checkout,profile,reviews}-ui/   # T4 Feature-UI воронки
│   │   ├── src/core/             # T5 Власні провайдери/хуки/компоненти (CMSProvider,
│   │   │                         #    useAuth, useCart, useBanners…). Фасадна роль
│   │   │                         #    розчинена К0; розселення по тірах — поза К0
│   │   ├── src/admin/            # T5 Сторінки/компоненти адмінки
│   │   ├── src/storefront-routes/# T5 pages/ (container-и) + views/ (канонічні view +
│   │   │                         #    slots/ реквізитів) + shells/ + server/ + seo/
│   │   ├── routes/storefront/    # T5 Роут-файли вітрини — монтуються physical()
│   │   ├── routes/admin/         # T5 Роут-файли адмінки (тонкі обгортки src/admin)
│   │   ├── migrations/           # Канон core-міграцій для `simplycms db:diff`
│   │   │                         #    (закомічена копія supabase/migrations, template:sync)
│   │   ├── skills/               # Агентні скіли, які їдуть у магазини СИМЛІНКАМИ
│   │   ├── drizzle/ + drizzle.config.ts + scripts/dump-rls.mjs  # schema-тулінг
│   │   └── tsup.config.ts        # МАСИВ профілів; 🔴 target: 'esnext' — у спільному base
│   ├── cli/                @simplycms/cli            # CLI магазину (bin `simplycms`): doctor/add/
│   │                                                 # create (plugin|theme)/update/db:diff (N канонів)/
│   │                                                 # theme:conformance (гейт views, контракт тем v3);
│   │                                                 # чистий ESM без build; host/ — канон host-файлів,
│   │                                                 # template-plugin/ і template-theme/ — шаблони
│   │                                                 # create plugin/create theme (`pnpm template:sync`);
│   │                                                 # виконується В МАГАЗИНІ, не тут
│   ├── simplycms-theme-solarstore/ @simplycms/theme-solarstore  # Референс-тема повного контуру: manifest
│   │                                                 # + tokens + components + messages (Фаза 4, npm)
│   ├── simplycms-plugin-faq/  @simplycms/plugin-faq  # Референс-плагін повного контуру: plg_faq_items,
│   │                                                 # routes/ (/admin/faq), слот, Zod-settings, i18n.
│   │                                                 # 🔴 З шаблону знято (ПК7) — ставиться `simplycms add`
│   ├── create-simplycms-store/  # UNSCOPED npm-пакет: CLI-скаффолдер (`src/`) + вбудований
│   │                            # шаблон магазину (`template/`, закомічена копія,
│   │                            # синхронізується `pnpm template:sync`). Другий unscoped
│   │                            # пакет поруч із флагманом — під фільтри імені ядра
│   │                            # не підпадає й у tarball-parity не рахується.
│   └── README.md           # Джерело правди про тіри залежностей T0→T5
│
├── scripts/                          # Тулчейн міграцій, пакування, релізу
│   ├── db-diff.mjs · db-migrate.mjs · types-baseline.mjs
│   ├── release.mjs      + release/      # bump/gates/git — `pnpm release X.Y.Z`
│   │                                    # (bump.mjs сканує packages/* — і ядро, і скаффолдер)
│   ├── version-packages.mjs             # «сирий» бамп версій без гейтів
│   ├── audit-deps.mjs   + audit-deps/   # collect (bare-імпорти) + classify (deps/peers)
│   ├── audit-exports.mjs + audit-exports/ # collect (споживані subpath-и) + resolve
│   ├── pack-inspect.mjs + pack-inspect/ # читання вмісту tarball-ів
│   ├── sync-create-store-template.mjs   # монорепо → template/ пакета create-simplycms-store (`pnpm template:sync`)
│   ├── pilot-pack.mjs   + pilot-pack/   # env/e2e/pack/scaffold/build/run + gate-a…gate-e + create-pkg-smoke
│   │                                    # + seed-fixtures.mjs — джерело правди сіду
│   └── pilot-seed.mjs                   # фікстури → supabase/seed.sql (`pnpm pilot:seed`)
├── supabase/                         # config.toml (проєкт + локальний стек), migrations/,
│                                     # seed.sql (ЗГЕНЕРОВАНО), functions/, types.ts
├── themes/default/                   # Локальна тема-еталон (контракт v3, із власними views);
│                                     # solarstore — npm-пакет packages/simplycms-theme-solarstore/
├── plugins/hello-world/              # Референс-плагін (мінімальний; повний — @simplycms/plugin-faq)
├── tests/                            # virtual-routes-escape, published-exports-parity,
│   │                                 # audit-deps, audit-exports, host-database-types, seo-endpoints,
│   │                                 # pilot-seed, create-store-template-parity (парність seed.sql і фікстур/шаблону),
│   │                                 # cli-* (юніти @simplycms/cli: контекст/doctor/add/update/db-diff),
│   │                                 # tier-boundary (негативний контроль тір-зон),
│   │                                 # dist-import-meta (гард лоуереного import.meta у dist)
│   └── pilot/store-template/         # Тонкий ОВЕРЛЕЙ пілота (vite.config.ts + package.json) поверх шаблону
│                                     # create-simplycms-store — не власна копія host-каркаса (виключений
│                                     # із tsconfig.json і eslint.config.mjs)
│
├── server.mjs                        # Node-runner прод-збірки: sirv(dist/client) + fetch-handler
├── simplycms.config.ts               # defineConfig: themes, plugins, siteUrl, …
├── eslint.tier-zones.mjs             # Тір-зони T0→T5 усередині пакета ядра (ПК3);
│                                     # eslint.tier-relative.mjs — відносні форми специфікатора
├── vite.config.ts                    # tanstackStart({ router.virtualRouteConfig, server.entry })
├── vitest.config.ts                  # Дефолтний прогін (packaging-suite — у test.exclude)
├── vitest.packaging.config.ts        # Tarball-parity suite (`pnpm test:packaging`)
├── tailwind.config.ts                # Tailwind v4 config
└── pnpm-workspace.yaml               # Workspace config
```

🔴 `src/routes/` сканується **не** цілком: `routes.ts` монтує лише `my/`. Файл,
покладений поруч із `__root.tsx`, роутом не стане — це семантика `virtualRouteConfig`
(файлове сканування вимкнене), окремим тестом не асертиться.
`tests/virtual-routes-escape.test.ts` стереже зворотну здатність: що `physical()`
бачить теки пакетів ПОЗА `src/routes/` — саме на ній тримається монтування.

## Package Aliases (tsconfig paths + vite resolve.alias)

🔴 **Після К0 аліасів для тек ядра БІЛЬШЕ НЕМАЄ.** Увесь T0–T5 резолвиться
однією парою `simplycms` / `simplycms/*`, а конкретна тека — це субшлях
(`simplycms/contracts`, `simplycms/ui`, `simplycms/themes/conformance`, …).
Чинний повний список:

| Import | Path |
|--------|------|
| `simplycms` (корінь; 🔴 зсередини самого пакета заборонений — цикл модулів) | `packages/simplycms/src` |
| `simplycms/*` | `packages/simplycms/src/*` |
| `@simplycms/theme-solarstore` | `packages/simplycms-theme-solarstore/src` |
| `@simplycms/plugin-faq` (+ `/pages/*`, `/*`) | `packages/simplycms-plugin-faq/src` |
| `@themes/*` | `themes/*` |
| `@plugins/*` | `plugins/*` |

Мапа старих імен на нові субшляхи (для читання доків і історії git):
`@simplycms/objects` → `simplycms/contracts`; `@simplycms/themes` →
`simplycms/themes`; `@simplycms/plugins` → `simplycms/plugins`;
`@simplycms/core` → `simplycms/core` (лише **власні** модулі — реекспорти
чужого розчинені кодмодом на джерела); решта — імʼя теки один-в-один.
Роут-теки лишили СТАРІ ключі exports (`./storefront-routes/routes/*`,
`./admin-routes/routes/*`) при новій фізичній теці `routes/{storefront,admin}`.

`@simplycms/cli` аліаса **не має** — резолвиться через workspace-симлінк
`node_modules` (bin-інструмент, який ніхто не імпортує як код). Схема БД і
роут-теки аліаса теж не потребують: `scripts/db-*.mjs` адресують
`packages/simplycms/` шляхом, `routes.ts` монтує теки `physical()`-ом.

🔴 Vite/vitest мають ОДИН base-prefix ключ `simplycms` (не пару):
`@rollup/plugin-alias` матчить і `simplycms`, і `simplycms/<sub>`, але **не**
`simplycms-*` — саме тому сторонні `simplycms-theme-*` не перехоплюються.

## Theme System (контракт v3)

Тема постачає оформлення і — опційно — **view-шар** пʼяти сторінок вітрини.
Дані, роути й SEO лишаються ядром завжди. Повний механізм (пакування
npm/copy-in, `bootstrapThemes`, views/слоти, conformance-kit, чекліст автора)
— [`docs/architecture/themes.md`](docs/architecture/themes.md).

```ts
ThemeModule = { manifest, tokens, components, settings?, messages?, fonts?, views? }
```

1. **Реєстрація:** `src/theme-registry.ts` реєструє теми з `config.themes`
   (`simplycms.config.ts`) через `ThemeRegistry.register()` — side-effect-імпорт
   з `__root.tsx`, працює на сервері й на клієнті. Тема — локальна тека
   `themes/<name>` (аліас `@themes/*`) або npm-пакет (референс ядра —
   `@simplycms/theme-<name>`, конвенція сторонніх — `simplycms-theme-<name>`,
   Фаза 4).
2. **SSR-резолв:** `getActiveThemeSSR` (`simplycms/themes`) читає активну тему з БД;
   `loader` каркасних роутів віддає `themeName` дітям.
3. **Сторінки — в ядрі:** канонічні сторінки живуть у
   `simplycms/storefront-routes/pages/*`. Каркаси `StorefrontShell` /
   `ProtectedShell` беруть з теми `components` лише Header/Footer і обгортають
   сторінку; секційні компоненти (HeroBanner/HomeSections) споживає сама
   сторінка (`pages/Home.tsx`). `theme.pages.*` не існує — тема впливає на
   сторінку лише через `views` (п. 10).
4. **Токени:** `applyTokens(theme.tokens)` розкладає палітру в CSS-змінні —
   тема не везе власний `theme.css`. З контракту v2.2 набір містить два
   не-кольорові типографічні ключі — `'font-sans'` і `'font-heading'`
   (значення — повний CSS font-family stack рядком); `font-heading` б'є по
   `h1..h6` через `@layer base`, fallback обох — `:root` у
   `src/styles/globals.css` (🔴 невизначена `var()` у `font-family` вбиває
   всю декларацію, тож fallback обовʼязковий). `--brand-*`/`colors.brand`
   більше немає: `.gradient-brand*` фарбуються `--primary` активної теми.
5. **Шрифти теми (v2.2):** опційне `fonts?: ReadonlyArray<{ stylesheet }>` —
   лише абсолютні `https:`-URL зовнішніх stylesheet-ів (без `@font-face` і
   роздачі файлів: npm-тема не має каналу статики). Фільтр —
   `safeFontStylesheets` (🔴 імпорт ТІЛЬКИ субшляхом
   `simplycms/themes/safeFontStylesheets`: barrel тягне `getActiveThemeSSR`
   → `anon-client` у клієнтський бандл); рендер — `ThemeFonts` в обох
   каркасах поруч із `ThemeTokens`. Базовий Inter-`<link>` у `__root.tsx`
   лишається (адмінка + fallback).
6. **Валідація:** `validateThemeModule` — публічний API для авторів тем;
   `ThemeRegistry.load` падає на тему `default`, якщо запитаної немає.
7. **Активація з адмінки:** прапорець `is_active` у таблиці `themes`;
   перемикання інвалідовує кеш теми. `bootstrapThemes` (клієнтський
   `useEffect` поруч із `PluginBootstrap` у `__root.tsx`, Фаза 4) дописує в
   БД рядки для зареєстрованих-але-відсутніх тем — інакше адмінка (читає
   лише БД) не побачила б встановлену через конфіг тему; рядок без модуля
   в білді показує бейдж «модуль відсутній» + disabled «Активувати»
   (registry-awareness, `Themes.tsx`).
8. **ThemeContext (клієнт):** приймає `initialThemeName` з лоадера — зайвого
   клієнтського фетчу немає.
9. **Установка npm-теми:** `pnpm simplycms add <pkg> --theme` (голий пакет,
   апстрім-фікси) або `--copy` (shadcn-модель: копія `src/` у `themes/<key>`,
   пакет знімається — повне володіння). Авторський dev-loop —
   `pnpm simplycms create theme <name>`.
10. **`views` (контракт v3, трек A завершено 2026-08-18):** опційне
    перевизначення view-шару пʼяти сторінок вітрини — `Home`, `Catalog`,
    `CatalogSection`, `ProductDetail`, `Cart`. Кожна сторінка
    `storefront-routes/src/pages/<Name>.tsx` — **container** (дані, стан,
    збір view-model-а) і резолвить view хуком `useStorefrontViews`
    (🔴 повертає МАПУ: `<views.X {...vm}/>`, бо компонент у локальній
    змінній валить `react-hooks/static-components`); канонічні view —
    `src/views/<Name>View.tsx`. View — ЧИСТА функція від vm (жодних запитів;
    дозволені `useT`/`useThemeT`/`useThemeSettings`).
11. **View-model-и — `simplycms/contracts/views`** (+ фікстури
    `simplycms/contracts/views/fixtures`), 🔴 субшлях ПОЗА барелем: тип слота
    вимагає `ComponentType` з react (структурний тип JSX не приймає, TS2786),
    а барель обіцяє «без імпортів react/supabase». `react` там — опційний
    **type-only peer**, T0 лишається без рантайм-залежностей.
12. **Слоти реквізитів:** `vm.slots` — прибінджені ядром компоненти
    (`src/views/slots/`), тема їх лише РОЗСТАВЛЯЄ; кожен малює маркер
    `data-simplycms-requisite`. Імена й обовʼязковий склад —
    `REQUIRED_REQUISITES` у `simplycms/contracts/views` (🔴 `Home` порожній,
    `Cart` без `ClearCart` — обовʼязковим може бути лише безумовний слот).
13. **Conformance:** `assertThemeViewsConformance` —
    `simplycms/themes/conformance` (субшлях, як `safeFontStylesheets`):
    рендер заявлених темою view на фікстурах (`full`/`edge`) без БД + асерт
    реквізитів на `full`. Рантайм-fallback НЕ робиться. Два канали запуску:
    канонічний `pnpm simplycms theme:conformance <name>` (потребує `jsdom`
    on-demand) і додатковий `themes/<name>/conformance.test.ts` (де є vitest).

## Environment Variables

Required (copy `.env.example` to `.env.local`). Client-exposed vars use the `VITE_` prefix:
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key
  (legacy fallback — `VITE_SUPABASE_ANON_KEY`; резолв — `resolveSupabaseKeys`)
- `VITE_SITE_URL` — Public site URL (production)
- `SUPABASE_PROJECT_ID` — Supabase project ref (tooling)
- `SUPABASE_ACCESS_TOKEN` — Personal access token for Management API (tooling)

🔴 **Контурів env два, і джерела в них різні** (спека CLI v1 §7, 2026-08-13).
Клієнтський бандл читає `import.meta.env` — значення запікаються при
`vite build`. Серверний код (SSR, server fns, middleware, SEO) читає **лише**
`process.env` і лише в рантаймі; `.env`/`.env.local` — не джерело, а спосіб
його наповнення (див. «Production Run»). `VITE_`-префікс означає «видно
клієнту», а не «лише клієнт»: той самий `VITE_SUPABASE_URL` сервер бере з
`process.env`. Дуального резолву немає — відсутній ключ гучно падає.
🔴 Контракт стережеться машинно, і саме так, бо інакше не можна: у vitest
`import.meta.env` — це Proxy над `process.env` (один обʼєкт), тож ТЕСТ довести
джерело env не здатен. Доводять: eslint `no-restricted-syntax` на
`import.meta.env` у шести серверних модулях (`server-client`, `anon-client`,
`seo/robots`, `seo/sitemap`, `api/health.tsx`, `src/start.ts`) — селектор не
послабляти; і Gate C пілота (`server-client` + `anon-client` у
`SERVER_PAYLOAD`).

## Production Run

`pnpm build` віддає **два** каталоги: `dist/client/` (статика з хешованими
іменами) і `dist/server/server.js` — це **fetch-handler** (`{ fetch(Request) →
Response }`), а не готовий HTTP-сервер. Теки `.output/` немає.

- `src/server.ts` — server entry (`server: { entry: './server.ts' }` у
  `vite.config.ts`). 🔴 Шлях резолвиться від `srcDirectory` (`src/`), **не** від
  кореня: `'./src/server.ts'` мовчки не знайдеться і плагін відкотиться на
  дефолтний entry. Тут же — точка перехоплення запиту перед делегацією в роутер.
- `server.mjs` (корінь) — Node-runner: `sirv(dist/client)` для статики
  (`/assets/*` → `max-age=31536000, immutable`), решта — `IncomingMessage →
  Request → fetch-handler → ServerResponse` зі стрімінгом в обидва боки
  (`Readable.toWeb` / `Readable.fromWeb`), тому SSR-стрімінг Start не ламається.
- `pnpm start` = `node server.mjs`; порт — `PORT` (за замовчуванням `3000`),
  інтерфейс — `HOST` (за замовчуванням `0.0.0.0`).

**Deploy:** на прод кладуться `dist/`, `server.mjs`, `package.json` +
production-`node_modules` (потрібен рівно один рантайм-пакет — `sirv`, він у
`dependencies`, не в dev). `VITE_*` для КЛІЄНТСЬКОГО бандла запікаються на
етапі `vite build`, тож збірку робить той самий env, що й прод.

🔴 **Контракт серверного env (2026-08-13, спека CLI v1 §7).** Серверний контур
читає **лише** `process.env` і лише в рантаймі (усередині фабрик/хендлерів, не
на модуль-рівні). `server.mjs` перед динамічним імпортом хендлера наповнює
`process.env` із `.env.local`/`.env` — лише відсутні ключі, тож реальний env
процесу завжди виграє (`process.env` > `.env.local` > `.env`); у dev те саме
робить `loadEnv` у `vite.config.ts`. Дуального резолву немає. Наслідок:
ротація Supabase-ключів = перезапуск процесу (`pnpm start`), БЕЗ перезбірки;
для клієнтських значень перезбірка як була, так і лишається.

## Database Commands

Джерело правди схеми — `packages/simplycms/src/schema/schema.ts` (Drizzle).
Schema-тулінг (`drizzle/`, `drizzle.config.ts`, `scripts/dump-rls.mjs`,
`seed-migrations/`) живе на рівні ПАКЕТА, не в `src/`; root-скрипти
`db:pull`/`db:dump-rls` — це `pnpm --filter simplycms run …`.

```bash
pnpm db:pull                   # Introspect live DB → Drizzle baseline
pnpm db:dump-rls               # Дамп RLS-політик із живої БД (джерело для rls-parity.test.ts)
pnpm db:diff <name>            # schema.ts → SQL у supabase/migrations/ (ревʼю обовʼязкове)
pnpm db:migrate                # supabase link + db push + db:generate-types
pnpm db:generate-types         # Regenerate TypeScript types to supabase/types.ts
pnpm types:baseline            # Снапшот CORE-типів → packages/simplycms/src/supabase/database.ts
```

🔴 **Типів БД два файли.** `supabase/types.ts` — генерат МАГАЗИНУ (core + таблиці
встановлених плагінів); проти нього типізується host-код.
`packages/simplycms/src/supabase/database.ts` — **baseline** core-схеми для
самого ядра; оновлюється `pnpm types:baseline` з еталонної dev-БД без плагінів
після кожної core-міграції. Магазин звужує клієнти до своїх типів через
generic-параметр фабрик (`createServerSupabase<StoreDatabase>()`) —
`packages/simplycms/src/supabase/README.md`.

🔴 Міграції **не** застосовуються через Supabase MCP (`apply_migration`) — MCP лише
для інспекції. Після зміни схеми типи мають бути свіжими (`db:migrate` робить це сам).

## CI/CD

Два workflow-файли: `workflow.yml` (перевірки) і `publish-packages.yml` (реліз).

| Workflow | Job | Кроки | Коли |
|----------|-----|-------|------|
| `workflow.yml` | `typecheck` | `install` → `format:check` → `build` → `typecheck` → `lint` | push/PR/manual |
| `workflow.yml` | `test` | `install` → `test` | push/PR/manual |
| `workflow.yml` | `packaging` | `install` → `build:packages` → `test:packaging` | push/PR/manual |
| `publish-packages.yml` | `publish` | гейт `NPM_TOKEN` → `install` → `build:packages` → `test:packaging` → `pnpm publish -r` | push у `main`, manual |

`packaging` — окремий job, а не крок у `test`: parity-suite працює по tarball-ах і
потребує зібраних `dist/` кожного пакета.

🔴 **Пілот пакування в CI НЕ ганяється** (рішення власника 2026-08-01). `pilot` і
`pilot:e2e` потребують бази — живої або локального стеку в Docker, — а це зовнішній
стан, від дрейфу якого гейт червонів би без регресії коду. Прогін пілота перед
релізом — відповідальність розробника (`pnpm pilot:pack` не потребує нічого, решта —
див. Quick Reference). Передрелізний гейт у CI — детерміністичний tarball-parity.

## Публікація пакетів (npmjs)

Ядро публікується на npmjs **пʼятьма пакетами** (трек К0): unscoped
фреймворк-пакет `simplycms` + сателіти `@simplycms/{cli,theme-solarstore,plugin-faq}`
+ unscoped скаффолдер `create-simplycms-store`.
**Повна інструкція — [`docs/architecture/release-process.md`](docs/architecture/release-process.md)**
(включно з типовими помилками 401/402/403 і чому не GitHub Packages). Стисло:

- **реліз однією командою** — `pnpm release 0.4.0`: гарди (чисте дерево, версія
  більша за поточну, тег ще не існує) → бамп → повний прогін гейтів → коміт
  `chore(release): vX.Y.Z`. Далі `git push` і PR у `main` — вручну, бо реліз має
  лишатися рішенням людини;
- **версія синхронна** — усі 5 пакетів завжди мають ОДНУ версію;
  `scripts/release/bump.mjs` сканує `packages/*` і бере все, що не `private`;
  точний набір (не поріг) асертить `tests/release-bump-coverage.test.ts`;
  розходження версій між ними реліз-скрипт вважає помилкою стану й падає.
  🔴 Критерії «публікованості» в різних інструментів РІЗНІ: у реліз-потязі
  пакетів пʼять, а в tarball-parity-suite — **чотири**
  (`create-simplycms-store` відсікається за іменем; це зафіксовано
  коментарем у тесті, «лагодити» не треба);
- **тригер — push у `main`.** `pnpm publish -r` сам пропускає пакети, чия версія вже
  в реєстрі (`isAlreadyPublished`), тож merge без бампа — no-op **тільки для тих
  пакетів, що вже там є**. Пакет, якого в реєстрі ще немає, мерж публікує —
  саме так у реєстр поїхали `create-simplycms-store` і `@simplycms/cli`
  (2026-08-13), і так само їде unscoped `simplycms`: мерж гілки К0 займає
  ім'я в глобальному просторі імен npm незворотно. Після появи `simplycms`
  у реєстрі — одноразовий `npm deprecate` 22 злитих імен
  ([`release-process.md`](docs/architecture/release-process.md), розділ
  «Deprecate злитих пакетів»);
- `workflow_dispatch` — ручний ретрай, якщо прогін упав на середині;
- 🔴 `publishConfig.access: "public"` у кожному manifest-і **обов'язковий**: scoped-пакети
  npm за замовчуванням робить приватними, а це платний план;
- потрібен secret **`NPM_TOKEN`** — 🔴 саме **Granular Access Token із увімкненим
  «Bypass 2FA»** і обсягом **`All Packages`** (read+write). Не scope
  `@simplycms`: scope — це префікс в ІМЕНІ пакета, а не тека, а unscoped-пакетів
  у монорепо ДВА — `create-simplycms-store` і сам фреймворк `simplycms`
  (CLI зрештою пішов ПІД scope — `@simplycms/cli`, bin `simplycms`).
  Розширено 2026-08-04. Токен без bypass успішно
  автентифікується, але публікацію npm відхиляє з `403 … bypass 2fa enabled is
  required` — спіймано падінням першого релізу. Без секрету job падає з явним
  повідомленням ще до збірки. 🔴 Наслідок обсягу `All Packages`, про який варто
  памʼятати: мерж у `main` публікує будь-який НОВИЙ пакет, якого ще немає в
  реєстрі, — незалежно від бампу версії. Тобто введення нового пакета є
  релізним рішенням саме в момент мержу. Порядок дій — у
  [`docs/architecture/release-process.md`](docs/architecture/release-process.md).

🔴 Історія: до 2026-08-01 цей workflow публікував у **GitHub Packages** і був
заглушений `if: false` — після переносу репо в org `simplyCMS` scope `@simplycms`
перестав збігатися з власником, і публікація гарантовано падала з 403. Переписано
на npmjs; старий шлях не відновлювати.
