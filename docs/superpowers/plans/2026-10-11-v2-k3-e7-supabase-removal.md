# К3-Е7: повний знос Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Гілка `claude/k3-e6d-content` (база `a15bcb31`) стає першою без Supabase у коді, залежностях, шаблоні магазину й доках про чинний стан. Реліз 0.14.0 — окремо, за словом власника.

**Architecture:** Е7 зносить мертвий шар, а не портує живий: споживачів `supabase-js` немає (інвентаризація 2026-10-11, чотири розвідники). Спершу ставимо гарди-замінники для тих контролів, що спиралися на шар, і доводимо кожен мутацією. Далі зносимо шар і замикаємо повернення ратчетом (правило лінту + тест маніфестів і lock). Потім перейменовуємо теку магазину `supabase/` → `db/` і прибираємо кореневі залишки. Наприкінці правимо коментарі й доки за єдиною політикою слова (Р1) і звіряємо `git grep` з allowlist.

**Tech Stack:** ESLint 9 flat config + власні правила (`eslint-rules/`), Vitest (юніт, `vitest.packaging.config.ts`, `vitest.schema.config.ts`), tsdown, pnpm 11 workspaces, CLI `@simplycms/cli` і `create-simplycms-store` (Node ESM), лендінг `apps/www`.

**Spec:** `docs/superpowers/specs/2026-10-11-v2-k3-e7-supabase-removal-design.md` (В1–В3 власника, А1–А9 архітектора). Розвилки Р1–Р9 ухвалив архітектор `dashboard-design-spec` 2026-10-11; вони **записані тут**, Task 9 переносить їх у спеку.

## Розбіжності зі спекою (факти розвідки, HEAD `a15bcb31`)

| # | Спека припускала | Факт |
|---|---|---|
| а | А3: правило `import.meta.env` у `SERVER_ENV_FILES` «зберігає негативний контроль» після зникнення `env-source.test.ts` | Контролю немає зовсім. `env-source.test.ts:8-13` сам визнає, що селектор не доводить: у vitest `import.meta.env` — Proxy над `process.env`. Контроль пишемо з нуля (Task 1) |
| б | А5: у dist є «інший реальний ланцюг `import.meta.env`» | Немає. Єдиний код — `supabase/browser-client.ts:13`; у `dist/runtime/index.js` це лише коментар. Позитивний якір — фікстур-збірка (Task 1) |
| в | А6: Gate C «далі ловить серверний вантаж (негативний контроль)» | Юніт-тесту на `gateBundle` немає; є лише живий `pnpm pilot` без мутації. Пишемо юніт (Task 1) |
| г | А3: «розширити бан, якщо зараз лише плагінний» | Так і є: `@supabase/*` забанено лише в `PLUGIN_TRUST_BOUNDARY_FILES` (`eslint.config.mjs:140-233`); `no-direct-storage` бачить тільки `@supabase/storage-js`; `template/*` повністю в ignores лінту (`:595-612`) |
| д | В1: «`doctor` чесно повідомляє про стару `supabase/` або план пояснює, чому ні» | `checkMigrations` (`doctor-fs-checks.mjs:47`) на відсутній теці отримує `[]` від `listSqlFiles` і каже «всі міграції нові» — хибно за будь-яких умов. `simplycms update` теку не бачить. Лагодимо обидва (Р6, Task 5) |
| е | А7: `seed.sql` «перенести або знести» | Ланцюг `seed.sql` ← `pilot-seed.mjs` ← `seed-sql.mjs` ← `seed-fixtures.mjs` має єдиного читача — власний тест парності `tests/pilot-seed.test.ts`. Gate B його не читає. К6 сід однаково переписує |
| є | А4: «гілка `supabase` у `insert-scan.ts`» | Гілка живе в `explicit-ids.test.ts:125,147,194-203,231-233,284-296`, у `insert-scan.ts:55` — лише JSDoc. Окремо виїмка `EXEMPT_DIRS = ['admin/pages/','admin/components/']` (`explicit-ids.test.ts:76`) обґрунтована «шаром supabase-js», якого там уже немає; `.insert(` у цих теках теж 0 |

## Рішення (Р1–Р9, архітектор 2026-10-11)

- **Р1 — політика слова.** У **коді** (src, routes, scripts, tests, шаблон, лендінг) слово `supabase` лишається лише в трьох категоріях:
  1. гарди та їхні тести/фікстури (`@supabase/*`, `supabase.storage`, `not.toMatch(/SUPABASE/)`, `not.toContain('supabase db push')`, підказка `git mv supabase/migrations db/migrations` у Р6);
  2. Supabase як **провайдер Postgres** (dev-БД на Supabase-хостингу, session pooler). Формулюється як «провайдер Postgres», не як стек;
  3. SQL-канон міграцій (`packages/simplycms/migrations/0002_grants.sql:5`, `migrations/README.md`) і його байт-копії — канон заради коментаря не чіпаємо.

  Решту історичних коментарів коду перефразовуємо без слова або прибираємо клаузу. У **доках** історичні розділи з позначкою лишаються. Окремого текстового ратчета на слово НЕМАЄ: тест «символи з доків існують у коді» прийде з паралельної гілки `claude/tooling-lessons`. Перевірка — allowlist у Task 10.
- **Р2 — ратчет проти повернення.** Нове правило `simplycms-supabase/no-supabase-import` (`eslint-rules/no-supabase-import.mjs`) на все репо `**/*.{ts,tsx,mts,cts,mjs,cjs,js}`. Ловить п'ять форм: static `import`, `export … from`, динамічний `import()` з літералом або шаблоном без виразів, `require()`. Плюс тест маніфестів: жодного `@supabase/` у `package.json` workspace-пакетів, `template/package.json.tpl`, `tests/pilot/store-template/package.json` і в `pnpm-lock.yaml`. `@supabase/*` у `pluginOnlySurfaceGroup` лишається: межа довіри плагіна має власний тест.
- **Р3 — dist-import-meta.** `tsdown.config.ts` експортує `base`. Тест збирає фікстур саме цим об'єктом (імпорт, не копія опцій) у tmp. Мутація `target: 'es2017'` у самому `tsdown.config.ts` валить тест — доводиться прогоном. Тест живе в packaging-контурі, поруч із наявним `tests/dist-import-meta.test.ts`.
- **Р4 — Gate C.** Юніт на `gateBundle` із синтетичним `bundle-stats.client.json`, три кейси. Мутація: прибрати `...SERVER_ONLY.map(...)` → червоно. Живий `pnpm pilot` лишається в DoD.
- **Р5 — сід пілота.** Знести весь ланцюг. У roadmap К6 явно записати: «сід пілота під Postgres-стек пишеться з нуля; ланцюг `supabase/seed.sql` знесено в Е7».
- **Р6 — коректність doctor.** Немає `db/migrations` → `error` «тека міграцій магазину відсутня». Якщо при цьому є `supabase/migrations`, у тому ж повідомленні — підказка `git mv supabase/migrations db/migrations`. `simplycms update` не мовчить про відсутню теку. Це не підтримка старих магазинів, а прибирання хибного твердження doctor.
- **Р7.** `EXEMPT_DIRS` у `explicit-ids` знімаємо, `tests/admin-inserts-need-id.test.ts` зносимо. Якщо зняття червоніє — лагодимо справжні дефекти в Task 4 і повідомляємо архітекторові кількість.
- **Р8 — інструментарій агентів.** `AGENTS.md:138` → «Міграції — лише через `pnpm db:diff`; MCP-інструменти БД (напр. Supabase MCP до хостингу dev-БД) — лише інспекція». Посилання на скіл `supabase-postgres-best-practices` лишаються. Прибираємо тільки брехню: `supabase/types.ts`, cookie-сесії `@supabase/ssr`, `supabase` у переліку тірів.
- **Р9 — доки.** Розділи чинного стану оновлюємо, історичні з позначкою не чіпаємо. `platform-delivery-options.md` отримує позначку «історичний» угорі.
- **Дрібне.** `.claude/settings.json` → `{}`: власник явно дозволив саме цю правку (В2). У `tsconfig.json` exclude прибираємо `tools` і `supabase/functions`. `scripts/db-migrate.mjs` разом зі скриптом `db:migrate` зносимо. `TEMPLATED_FILES` → `['package.json']`. `PEER_SCOPES` прибираємо разом із гілкою.

## Global Constraints

- Відповіді, коментарі й доки — українською; коментар пояснює **чому**.
- Жодних трейлерів `Co-Authored-By`/`Generated with`. Після **кожного** коміту субагента: `git log --format=%B a15bcb31..HEAD | grep -ciE "co-authored|generated with"` = `0`.
- Комітити в `claude/k3-e6d-content` можна. Пуш, PR і реліз 0.14.0 — лише за словом власника.
- А9: Е8 (живий прогін магазину з опублікованих tarball-ів npm) — окремо після релізу; цей план його не робить.
- Копії `packages/create-simplycms-store/template/{src,db/migrations,themes/default,plugins/hello-world}` і `packages/cli/host/**` руками не правляться: правимо джерело (кореневі `src/*`, `packages/simplycms/migrations/`), потім `pnpm template:sync`.
- Після будь-якої правки `package.json`: `pnpm install`, далі `pnpm install --frozen-lockfile`.
- Норма `pnpm lint` = 0 errors / 7 warnings.
- Кожен гейт-замінник і ратчет доводиться мутацією **прогоном**. У звіті задачі — рядок «мутація → червоний → відкат → зелений» з назвою тесту.
- Задача, що чіпає `test-harness/pg`, ганяє `pnpm test:schema`. Вибірковий фільтр — БЕЗ `--` (`pnpm test:schema explicit-ids`), інакше біжить уся сюїта. Харнес: `docker run -d --rm -p 54330:5432 -e POSTGRES_HOST_AUTH_METHOD=trust pgvector/pgvector:pg17` → `PG_HARNESS_URL=postgres://postgres@localhost:54330/postgres`.
- `CHANGELOG.md` (крім `[Unreleased]`) і `docs/superpowers/{plans,specs,research}/**` (крім спеки Е7 у Task 9) не чіпати.
- ~150 рядків на модуль; нове правило й тести — окремими файлами.

## Review Focus

1. **Власник створює магазин із tarball-ів і виконує надруковані кроки.** Очікування: є `db/migrations/0000_prelude.sql`, psql-цикл `for f in db/migrations/*.sql` накатується на чисту БД, `supabase/` у магазині немає. Тест: Task 5 (`create-store-invite-setup`, `create-pkg-checks`) і живий скаффолд у Task 10.
2. **Магазин без `db/migrations` (наприклад, скаффолд 0.13 із `supabase/migrations`) запускає `simplycms doctor` або `simplycms update`.** Очікування: error із підказкою `git mv`, а не «всі міграції нові» і не тиша. Тест: Task 5, три кейси `checkMigrations` + кейс `update`.
3. **`@supabase/ssr` повертається в шаблон (`package.json.tpl` поза лінтом) або транзитивно в lock.** Очікування: червоний юніт. Тест: Task 3, мутації маніфесту і lock.
4. **Фікстур-збірка в packaging-тесті пише в реальний `packages/simplycms/dist`.** Очікування: тест працює лише в tmp; наступні tarball-тести бачать справжній dist. Тест: Task 1 асертить, що `outDir` лежить під `os.tmpdir()` і що `mtime` файлу `packages/simplycms/dist/index.js` не змінився.
5. **Після зняття `EXEMPT_DIRS` у `admin/pages`/`admin/components` з'являється Drizzle-вставка без `id`.** Очікування: `explicit-ids` її ловить. Тест: Task 4, синтетичне джерело з шляхом `admin/pages/x.ts` → offender.

---

### Task 1: Гарди-замінники (А3-контроль, А5, А6)

Гарди, що зараз спираються на шар `supabase`, отримують незалежні контролі **до** зносу. Ця задача нічого не видаляє, крім позитивного якоря `dist/supabase/browser-client.js`, який заміняє фікстур.

**Files:**
- Create: `tests/eslint-server-env.test.ts`
- Modify: `packages/simplycms/tsdown.config.ts:91` (`const base` → `export const base`)
- Create: `tests/dist-import-meta-fixture.test.ts`; Modify: `tests/dist-import-meta.test.ts:68-85` (позитивний якір → посилання на фікстур-тест), `vitest.packaging.config.ts:29-35` і `vitest.config.ts` exclude (новий файл — у packaging, не в юніт)
- Create: `tests/pilot-gate-c.test.ts`

**Interfaces:**
- Produces: `export const base` з `packages/simplycms/tsdown.config.ts` (тип `UserConfig`); тест-контроль для `SERVER_ENV_FILES`, на який спирається Task 2 (там зникають два записи).
- Consumes: `gateBundle(storeDir: string): { ok: boolean; details: string[] }` з `scripts/pilot-pack/gate-c.mjs:116`. Читає `<storeDir>/bundle-stats.client.json` (форма `{ [chunk]: { modules: string[]; isEntry: boolean; imports: string[] } }` — `initialChunks` (`:100-112`) читає `isEntry` і `imports`; без них перевірка `NOT_IN_INITIAL` вакуумна або падає) і `<storeDir>/node_modules/simplycms/dist/admin-server/{index.js,impl/index.js}`.

- [ ] **Step 1: `tests/eslint-server-env.test.ts`.** `new ESLint({ cwd: repoRoot })`, `lintText('export const x = import.meta.env.FOO;\n', { filePath, warnIgnored: true })` — за взірцем `tests/plugin-trust-boundary.test.ts`. Очікування:
  - для кожного з п'яти шляхів — 1 повідомлення `ruleId === 'no-restricted-syntax'`, текст містить `process.env`. Шляхи: `packages/simplycms/src/storefront-routes/seo/robots.ts`, `…/seo/sitemap.ts`, `…/storefront-routes/server/root.ts`, `packages/simplycms/routes/storefront/api/health.tsx`, `src/start.ts`;
  - чистий контроль: `packages/simplycms/src/storefront-routes/components/X.tsx` → 0 повідомлень `no-restricted-syntax` із цим текстом.

  Список у тесті — рукописний: тест не переказує конфіг.
- [ ] **Step 2: Прогнати** `pnpm vitest run tests/eslint-server-env.test.ts` → PASS. Мутація: прибрати `'src/start.ts'` з `SERVER_ENV_FILES` → FAIL на цьому шляху; відкат → PASS. Друга мутація: змінити `property.name="env"` на `"envx"` → FAIL усіх п'яти; відкат.
- [ ] **Step 3: `export const base`** у `tsdown.config.ts`. Решта конфігу без змін.
- [ ] **Step 4: `tests/dist-import-meta-fixture.test.ts`.**
  - Фікстур `export const v = import.meta.env.VITE_X;` пишеться в `mkdtemp(join(tmpdir(), 'tsdown-im-'))`.
  - Збірка: `build({ ...base, entry: { fixture: <tmp>/fixture.ts }, outDir: <tmp>/out, cwd: <tmp>, clean: false, tsconfig: false })` з `tsdown`. Перевизначаються ЛИШЕ `entry/outDir/cwd/clean/tsconfig`; `target`, `format` і `platform` приходять з `base`.
  - Асерти:
    - вихід містить `import.meta.env.VITE_X`;
    - вихід НЕ матчить `/import_meta\d*/`;
    - `outDir` починається з `tmpdir()`;
    - `mtime` файлу `packages/simplycms/dist/index.js` до і після збірки однаковий, якщо dist існує.

  У коментарі тесту одним рядком: які ключі перевизначено (`entry/outDir/cwd/clean/tsconfig`) і чому. Решта (`target`, `platform`, `format`, майбутні хуки чи плагіни `base`) успадковується — НЕ перевизначати мовчки.
  Виміряти час тесту і записати в коментар файлу, чому він у packaging. Помилки резолву `tsconfig` перевірити першим прогоном. Якщо `tsconfig: false` tsdown не приймає, вказати tmp-`tsconfig.json` із `{}` — але НЕ `PACKAGE_ROOT`.
- [ ] **Step 5: Прогнати** `pnpm build:packages && pnpm test:packaging -- dist-import-meta` → PASS. Мутація: `target: 'es2017'` у `tsdown.config.ts` → FAIL позитивної частини; відкат → PASS.
- [ ] **Step 6: Перебудувати `tests/dist-import-meta.test.ts`.** Позитивний якір `existsSync('dist/supabase/browser-client.js')` + `closure` (`:68-85`) прибрати. Скан «жоден dist-модуль не містить `import_meta`» лишається, а коментар `:13` переписати без `resolveSupabaseKeys`. Коментар над сканом посилається на фікстур-тест як на доказ, що гейт не вакуумний.
- [ ] **Step 7: `tests/pilot-gate-c.test.ts`.** Store-dir у tmp: `bundle-stats.client.json`, а також `node_modules/simplycms/dist/admin-server/index.js` і `impl/index.js` (порожні файли). Кейси:
  - чистий: модулі `node_modules/simplycms/dist/storefront-routes/server/x.js` (заглушка server-fn, має матчити `SERVER_FN_STUB`) і `node_modules/simplycms/dist/admin-server/index.js` → `ok === true`;
  - той самий набір + `node_modules/simplycms/dist/db/client.js` → `ok === false`, `details` містить `db`;
  - той самий набір + `node_modules/drizzle-orm/index.js` → `ok === false`;
  - initial-кейс: entry-чанк (`isEntry: true`) статично імпортує чанк із `node_modules/simplycms/dist/admin/x.js` → `ok === false` (`NOT_IN_INITIAL`); той самий модуль у чанку, досяжному лише динамічно (не в `imports`), → `ok === true`.

  Кожен чанк фікстури має всі три поля (аудит Codex №6).

  Точні форми module-id звірити з `SERVER_FN_STUB` і `adminServerStubs` у `gate-c.mjs`.
- [ ] **Step 8: Прогнати** `pnpm vitest run tests/pilot-gate-c.test.ts` → PASS. Мутація: прибрати `...SERVER_ONLY.map(...)` з `SERVER_PAYLOAD` → кейс `db/client.js` FAIL; відкат → PASS.
- [ ] **Step 9: Commit.** `test(k3-e7): незалежні контролі import.meta.env, dist-import-meta і Gate C перед зносом Supabase`. Перевірка трейлерів.
- [ ] **Step 10: Журнал мутацій → архітекторові** (`dashboard-design-spec`): кожна мутація Steps 2/5/8 — команда, червоний вивід, відкат, зелений.

### Task 2: Знос шару `simplycms/supabase` і його публічного API (А1, А2, А6)

**Files:**
- Delete:
  - `packages/simplycms/src/supabase/` (уся тека);
  - `packages/simplycms/src/admin/layouts/LegacySupabaseBoundary.tsx` і `__tests__/LegacySupabaseBoundary.test.tsx`;
  - `packages/simplycms/src/i18n/catalogs/{uk,en}/admin/legacy.ts`;
  - `packages/simplycms/src/core/__tests__/cms-provider-no-supabase.test.tsx`;
  - `tests/admin-server-first/registry.ts` і `tests/admin-server-first-registry.test.ts` — у ЦІЙ задачі, а не в Task 4: тест реєстру червоніє «протухлим записом», щойно зникає `LegacySupabaseBoundary` (аудит Codex №1).
- Modify:
  - `packages/simplycms/src/admin/layouts/AdminLayout.tsx:8,21-23,66-68`;
  - `packages/simplycms/src/i18n/catalogs/{uk,en}/admin/index.ts` (імпорт і спред `legacy`);
  - `packages/simplycms/src/storefront-routes/__tests__/{catalog-ssr,page-views-resolve}.test.tsx` — блоки `vi.mock('simplycms/supabase/SupabaseProvider', …)`, `:36-40` і `:39-43`.
- Modify:
  - `packages/simplycms/package.json:46-51` (exports), `:265-288` (`publishConfig.exports`), `:600-601` (peers);
  - кореневий `package.json:69-70`;
  - `packages/create-simplycms-store/template/package.json.tpl:47-48`;
  - `tests/pilot/store-template/package.json:40-41`;
  - `pnpm-lock.yaml`.
- Modify: `scripts/audit-deps/classify.mjs:13,36,93` (`PEER_SCOPES` і гілка), `scripts/audit-deps.mjs:18`, `scripts/audit-exports/collect.mjs:39`.
- Modify:
  - `eslint.config.mjs`:
    - `:106` — посилання на `env-source.test.ts` → на `tests/eslint-server-env.test.ts`;
    - `:122-123` — два записи `SERVER_ENV_FILES` прибрати;
    - `:186-187` — `simplycms/supabase*` з `pluginOnlySurfaceGroup` прибрати;
    - `:228` — з regex прибрати лише альтернативу `supabase|`, `@supabase/.*` лишити;
  - `eslint.tier-zones.mjs:48,57,121`;
  - `tests/tier-boundary/zones.ts`;
  - `tests/plugin-trust-boundary.test.ts:42-57,135-136`.
- Modify:
  - `scripts/pilot-pack/gate-c.mjs` — `:36-42` два патерни `dist/supabase/*`; докблок `:24-32`; `:143`, `:171`, `:198` без слова;
  - `packages/simplycms/src/contracts/server-only.ts:42-43` — абзац прибрати;
  - `.prettierignore:19-23`.

**Interfaces:**
- Consumes: `tests/eslint-server-env.test.ts`, `tests/pilot-gate-c.test.ts` (Task 1) — мусять лишитися зеленими.
- Produces: пакет без субшляхів `simplycms/supabase*` і без peer'ів `@supabase/*`. На цьому стоїть Task 3.

- [ ] **Step 0: `ImportMetaEnv`.** `packages/simplycms/src/supabase/vite-env.d.ts` теж декларує `ImportMetaEnv`. Перед зносом переконатися, що поля, які читають `storefront-routes` і кореневий `src`, декларовані в `packages/simplycms/src/storefront-routes/vite-env.d.ts` / `src/vite-env.d.ts`. Результат — явним рядком у звіті задачі (не лише «typecheck зелений»).
- [ ] **Step 1: Знести теку й межу.** У `AdminLayout` лишається `{children}` без обгортки. `useLocation` і `pathname` прибрати, якщо інших споживачів у файлі немає.
- [ ] **Step 2: Маніфести.** Exports і `publishConfig.exports` — по 6 ключів `./supabase*`. Peers — обидва. Залежності — у трьох маніфестах. `PEER_SCOPES` прибрати разом із гілкою `:93`; `tests/audit-deps.test.ts` має лишитися зеленим. Входи tsdown виводяться з `exports` (`tsdown.config.ts:46-70`), правка конфігу не потрібна.
- [ ] **Step 3: `pnpm install && pnpm install --frozen-lockfile`.** Очікується `grep -c '@supabase/' pnpm-lock.yaml` → `0`. Якщо не 0 — знайти, хто тягне транзитивно (`pnpm why @supabase/supabase-js`), і доповісти до продовження.
- [ ] **Step 4: Тір-зони.** Запис `['src/supabase', 2, 'supabase', []]` прибрати; з `alsoForbidden` зони `ui` прибрати `'supabase'`. Коментар `:48` переписати («T2 поруч із `auth`»). У `zones.ts` замінити специфікатори, зберігши семантику рядка:

  | Рядок `zones.ts` | Було | Стало | Чому семантика зберігається |
  |---|---|---|---|
  | schema | заборонений `simplycms/supabase` | `simplycms/db` | T2 над T1 |
  | db | заборонений `simplycms/supabase` | `simplycms/react-query` | той самий T2 без винятку |
  | auth | заборонений `simplycms/supabase` | `simplycms/react-query` | — |
  | supabase | запис зони | видалити | — |
  | react-query | заборонений `simplycms/supabase` | `simplycms/db` | — |
  | storefront | заборонений `simplycms/supabase/server-client` | `simplycms/react-query` | — |
  | storage | заборонений `simplycms/supabase` | `simplycms/react-query` | — |
  | themes | легальний `simplycms/supabase/anon-client` | `simplycms/react-query` | T2 нижче T4 |

  У storage коментар `:48-49` переписати: «`react-query` того самого тіру у виняток не входить».
- [ ] **Step 5: Межа довіри плагіна.**
  - Фікстуру `violation` (`plugin-trust-boundary.test.ts:42-44`) замінити на `import { createClient } from '@supabase/supabase-js'`.
  - Зі списку `:55-57` прибрати `simplycms/supabase` і `simplycms/supabase/browser-client`, `@supabase/supabase-js` лишити.
  - Динамічний кейс `:135-136`: перший `import('simplycms/supabase/server-client')` замінити на `import('simplycms/admin-server/impl')`. Так очікування `2` зберігається: обидва мусять ловитися (перевірити, що `simplycms/admin-server/*` у `pluginOnlySurfaceGroup` або в тому ж регексі `:228`; якщо ні — узяти наявний заборонений специфікатор з того ж регексу).
- [ ] **Step 6: Gate C і `server-only.ts`.** Прибрати два патерни. Мутація з Task 1 (без `SERVER_ONLY.map`) і далі валить `pilot-gate-c.test.ts` — прогнати.
- [ ] **Step 7: Прогнати.**
  - `pnpm format:check && pnpm lint && pnpm build && pnpm typecheck && pnpm test` → зелено, lint 0/7.
  - `pnpm build:packages && pnpm test:packaging && node scripts/audit-exports.mjs` → зелено (ловить дзеркало `exports` ↔ `publishConfig`).
  - `pnpm template:sync` → без змін у `git status`.
- [ ] **Step 8: Commit.** `refactor(k3-e7)!: знесено шар simplycms/supabase, LegacySupabaseBoundary і залежності @supabase/*`. Перевірка трейлерів.

### Task 3: Ратчет проти повернення `@supabase/*` (Р2)

**Files:**
- Create: `eslint-rules/no-supabase-import.mjs`, `tests/eslint-rules/no-supabase-import.test.ts`, `tests/no-supabase-manifests.test.ts`
- Modify: `eslint.config.mjs` — новий блок `plugins: { 'simplycms-supabase': { rules: { 'no-supabase-import': … } } }` на `files: ['**/*.{ts,tsx,mts,cts,mjs,cjs,js}']`, рівень `error`; поруч із блоком `simplycms-storage` (`:417-424`).

**Interfaces:**
- Produces: правило `simplycms-supabase/no-supabase-import` з `messageId: 'supabaseImport'`. Тест маніфестів нічого не експортує, лише асерти (маніфести, lock, код шаблону).

- [ ] **Step 1: RuleTester-тест правила.**
  - invalid (по 1 помилці `supabaseImport`):
    - `import { createClient } from '@supabase/supabase-js'`;
    - `import '@supabase/ssr'`;
    - `export * from '@supabase/storage-js'`;
    - `await import('@supabase/supabase-js')`;
    - ``await import(`@supabase/ssr`)`` (TemplateLiteral без виразів);
    - `require('@supabase/supabase-js')`.
  - valid:
    - `import x from 'supabase-like'`;
    - `import x from '@supabaseish/x'`;
    - `const s = '@supabase/x'` (рядок, не імпорт);
    - `import(dynamicVar)`.
- [ ] **Step 2: Прогнати** `pnpm vitest run tests/eslint-rules/no-supabase-import.test.ts` → FAIL (правила немає).
- [ ] **Step 3: Правило.** Збіг — специфікатор `=== '@supabase'` або `startsWith('@supabase/')`. Вузли: `ImportDeclaration`, `ExportAllDeclaration`, `ExportNamedDeclaration[source]`, `ImportExpression` з `source` — `Literal` або `TemplateLiteral` без `expressions` (значення з `quasis[0].value.cooked`), `CallExpression[callee.name='require'][arguments.0.type='Literal']`. Повідомлення українською: Supabase знесено в К3-Е7, БД — лише через `simplycms/db`.
- [ ] **Step 4: Підключити в `eslint.config.mjs`.** Додати `lintText`-кейси в той самий тест-файл: `@supabase/ssr`-імпорт з `filePath` `packages/simplycms/src/x.ts`, `src/x.ts`, `plugins/x/index.ts`, `scripts/x.mjs` → по 1 помилці `simplycms-supabase/no-supabase-import`. Це доводить, що зона покриває все репо, а не лише RuleTester.
- [ ] **Step 5: `tests/no-supabase-manifests.test.ts`.** Множина файлів — `package.json` кореня і всіх workspace-пакетів (обхід `pnpm-workspace.yaml` globs), `packages/create-simplycms-store/template/package.json.tpl`, `tests/pilot/store-template/package.json`. Кожен парситься (для `.tpl` — текстом). Об'єднання ключів `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies` не містить `@supabase/`. Окремий кейс: `pnpm-lock.yaml` не містить підрядка `@supabase/`. Окремий кейс-контроль: список файлів непорожній і містить `.tpl` (тест не вакуумний).
- [ ] **Step 5а: Код шаблону поза лінтом (аудит Codex №2).** `packages/create-simplycms-store/template/*` і `template/*/**` в ignores (`eslint.config.mjs:620-630`), лінт бачить лише `template/scripts/**`. `template/src/**` — синкована копія кореневого `src/` (його лінт бачить), але `template/{vite.config.ts,routes.ts,simplycms.config.ts,…}` і `tests/pilot/store-template/**` — ні. У `tests/no-supabase-manifests.test.ts` додати кейс: обійти всі `*.{ts,tsx,mts,cts,js,mjs,cjs}` у `packages/create-simplycms-store/template/` і `tests/pilot/store-template/`, лінтувати кожен через `new Linter({ configType: 'flat' })` з ОДНИМ правилом `simplycms-supabase/no-supabase-import` і парсером `typescript-eslint` (без конфіг-ігнорів) → 0 повідомлень. Контроль невакуумності: список файлів містить `template/vite.config.ts` і `template/simplycms.config.ts`.
- [ ] **Step 6: Прогнати** `pnpm lint && pnpm vitest run tests/eslint-rules/no-supabase-import.test.ts tests/no-supabase-manifests.test.ts tests/plugin-trust-boundary.test.ts` (останній фільтрує за `ruleId === 'no-restricted-imports'`, друге правило на тій самій фікстурі лічильників не ламає — підтвердити прогоном) → зелено, lint 0/7. Мутації:
  - додати `"@supabase/ssr": "^0.12.7"` у `package.json.tpl` → FAIL; відкат;
  - дописати рядок `  '@supabase/x@1.0.0':` у кінець `pnpm-lock.yaml` → FAIL; `git checkout pnpm-lock.yaml`;
  - тимчасовий `import '@supabase/ssr'` у `src/start.ts` → `pnpm lint` червоний; відкат;
  - тимчасовий `import '@supabase/ssr'` у `packages/create-simplycms-store/template/simplycms.config.ts` → кейс Step 5а червоний (`pnpm lint` при цьому зелений — саме тому кейс існує); відкат.
- [ ] **Step 7: Commit.** `test(k3-e7): ратчет no-supabase-import на все репо і заборона @supabase/ у маніфестах і lock`. Перевірка трейлерів.
- [ ] **Step 8: Журнал мутацій Step 6 → архітекторові.**

### Task 4: Тестові реєстри легасі (А4, Р7)

**Files:**
- Delete: `tests/admin-inserts-need-id.test.ts` (реєстр `admin-server-first` знесено в Task 2)
- Modify: `packages/simplycms/test-harness/pg/__tests__/explicit-ids.test.ts:50-76,125,147,194-203,231-233,284-296`; `packages/simplycms/test-harness/pg/insert-scan.ts:55` (приклад JSDoc → `db.insert(t).values([payload])`); `tests/media-read-resolve.test.ts:34` (коментар бреше про «адмінку на supabase-js»)

**Interfaces:**
- Consumes: `discoverInsertsInSource` у `explicit-ids.test.ts`; `insert-scan.ts` лишається спільним (його імпортують `insert-scan.test.ts`, `mutation-cache-sync-coverage`, `storage-direct-calls`, `storage-port-consumers`).

- [ ] **Step 1: Тест Review Focus №5.** `discoverInsertsInSource(src, file)` повертає вставки незалежно від шляху; виїмку застосовує фільтр тесту `!isExempt(site) && !hasIdField(site.payload)` (`explicit-ids.test.ts:239-252`). Тому:
  - винести цей фільтр у функцію `offendersOf(sites: InsertSite[]): InsertSite[]` того ж файлу, і основний тест, і синтетичний кейс кличуть її;
  - синтетичний кейс: джерело `await db.insert(products).values(payload)` без `id`, файл `…/admin/pages/X.tsx` → `offendersOf(discoverInsertsInSource(src, file))` має довжину 1.

  Прогнати → FAIL (шлях у виїмці; аудит Codex №3).
- [ ] **Step 2: Зняти виїмку.** `EXEMPT_DIRS`, коментар `:50-75` і перевірку теки в `isExempt` прибрати; з асерту «виїмки не розповзаються» (`:254-263`) прибрати рядок `expect(EXEMPT_DIRS)…`, асерт `ID_FROM_DB` лишається. Гілку `supabase` (`kind`, `supabaseRe`, цикл, коментар `:231-233`, кейс `:284-296`) прибрати. Поле `kind` прибрати зовсім, якщо після цього воно має одне значення і ніде не читається.
- [ ] **Step 3: Прогнати** `PG_HARNESS_URL=… pnpm test:schema explicit-ids` → PASS, включно з кейсом зі Step 1. Якщо реальних offender'ів у `admin/pages`/`admin/components` > 0 — полагодити кожен (`id` генерує викликач), записати кількість у звіт задачі для архітектора.
- [ ] **Step 4: Знести `admin-inserts-need-id`.** `git grep -n "tests/admin-server-first\|admin-server-first-registry\|admin-inserts-need-id\|PENDING_LEGACY\|KNOWN_WITHOUT_ID"` (живий контракт `simplycms/contracts/admin-server-first.ts` — `ADMIN_SERVER_FIRST` — інша річ і лишається) → 0 поза `docs/superpowers/**` і CHANGELOG; доки правляться в Task 9, тож тут лише код і тести.
- [ ] **Step 5: Прогнати** `pnpm test && pnpm test:schema` → зелено.
- [ ] **Step 6: Commit.** `test(k3-e7): explicit-ids бачить усю адмінку; реєстри легасі supabase-js знесено`. Перевірка трейлерів.

### Task 5: Тека магазину `supabase/` → `db/` і коректний doctor (В1, Р6)

**Files:**
- Modify: `scripts/sync-create-store-template.mjs:17-23,64-67` (`to: 'db/migrations'`; `supabase/config.toml` зі списку; коментар «перейменування — крок К6» прибрати)
- Delete: `packages/create-simplycms-store/template/supabase/` (уся тека, після sync); Create (через `pnpm template:sync`): `template/db/migrations/**`
- Modify: `packages/cli/src/db-diff.mjs:23-24,36,162,325-331`; `packages/cli/src/doctor-fs-checks.mjs:47-84`; `packages/cli/src/update.mjs:98-150`
- Modify: `packages/create-simplycms-store/src/scaffold.mjs:26-30` (`TEMPLATED_FILES = ['package.json']`), `src/steps.mjs:116-133`
- Modify: `scripts/pilot-pack/create-pkg-checks.mjs:34-35` (`'db/migrations/0000_prelude.sql'` замість двох `supabase/*`), `scripts/pilot-pack/placeholder-scan.mjs:6-7` (коментар)
- Modify: `template/gitignore:17-18` (прибрати), `template/vite.config.ts:56` і `tests/pilot/store-template/vite.config.ts:107` (коментар без `config.toml`; порт 3000 тримає `server.mjs`), `template/README.md:43,47,50,65,138`, `template/env.example:8`, `template/scripts/owner-invite{,-core}.mjs:5`, `packages/cli/README.md:8,27,36`, `packages/create-simplycms-store/README.md:70`, `packages/simplycms-plugin-faq/README.md:19-20`
- Test: `tests/cli-doctor.test.ts:144-170`, `tests/create-store-cli.test.ts:196` (перевірку `project_id` у `config.toml` знести), `tests/create-store-invite-setup.test.ts:53-58,77`, новий кейс `update` у `tests/cli-update.test.ts` (або наявному тесті update — знайти `parseUpdateArgs` у `tests/`)

**Interfaces:**
- Produces: `storeMigrationsDir(storeRoot: string): string` → `join(storeRoot, 'db', 'migrations')`. Новий експорт там само, у `db-diff.mjs`: `missingStoreMigrationsDir(storeRoot: string): string | null`. Повертає `null`, якщо тека є. Інакше — рівно `Тека міграцій магазину db/migrations відсутня.`; якщо існує `supabase/migrations`, до неї дописується ` Знайдено стару supabase/migrations — перенеси: git mv supabase/migrations db/migrations`. Тести асертять саме ці рядки. Його використовують `checkMigrations` і `update`.

- [ ] **Step 1: Тести doctor.** У `cli-doctor.test.ts`:
  - наявний кейс `:150` → `join(store, 'db', 'migrations')`;
  - новий: канон є, `db/migrations` немає, `supabase/` немає → `status: 'error'`, `details` містить `db/migrations`;
  - новий: канон є, немає `db/migrations`, є `supabase/migrations/0001_init.sql` → `error`, `details` містить `git mv supabase/migrations db/migrations`;
  - наявний `skip` без канону лишається `skip`: канон перевіряється першим.
- [ ] **Step 2: Тест update.** Тимчасовий магазин без `db/migrations`. `process.exitCode` скидати між кейсами. Кейси:
  - host-файли навмисно розсинхронізовані, `run(['--no-install', '--write'])` → `process.exitCode === 1`, у виводі текст з Interfaces, host-файли в цьому ж прогоні перезаписано канонічними (вміст = `packages/cli/host/`);
  - host-файли збігаються з каноном, `run(['--no-install'])` → `process.exitCode === 1` і той самий текст (гілка «дрейфу немає» теж не мовчить);
  - з `db/migrations` і без дрейфу → `process.exitCode` не `1`.

  Знайти, як наявні тести update ізолюють `findStoreRoot`/`say`, і повторити прийом.
- [ ] **Step 3: Тести скаффолдера.**
  - `create-store-invite-setup.test.ts:53-58,77` → `toContain('db/migrations/*.sql')`, гард `not.toContain('supabase db push')` лишається;
  - новий асерт: надрукованих кроків `not.toContain('supabase/migrations')`.
  - `create-store-cli.test.ts:196`: прибрати читання `config.toml`; додати `existsSync(join(target, 'db/migrations/0000_prelude.sql'))` і `!existsSync(join(target, 'supabase'))`.
- [ ] **Step 4: Прогнати** `pnpm vitest run tests/cli-doctor.test.ts tests/create-store-cli.test.ts tests/create-store-invite-setup.test.ts <тест update>` → FAIL.
- [ ] **Step 5: Імплементація.**
  - `storeMigrationsDir` і `missingStoreMigrationsDir` у `db-diff.mjs`.
  - У `checkMigrations` — перевірка одразу після `skip`.
  - `update.run` перебудувати: зараз дві гілки виходять ранніми `return` (`:131` «дрейфу немає», `:141` після `writeHostFiles`; аудит Codex №4). Після `syncSkillLinks` і обробки host-дрейфу всі три гілки (без дрейфу / `--write` / `--check`) сходяться в одну точку: перевірка `missingStoreMigrationsDir` → `say.error(<текст>)` і `process.exitCode = 1`; далі підсумковий `finish`. Код виходу дрейфу (`hostDriftExitCode`) не губиться: підсумковий — максимум з обох. Не `throw`, щоб host-синк лишався корисним.
  - Друковані тексти `db-diff.mjs:325-331` і `steps.mjs:116-133` → `db/migrations`, без згадки Supabase CLI.
  - `sync`: `to: 'db/migrations'`, далі `pnpm template:sync && git rm -r packages/create-simplycms-store/template/supabase`.
- [ ] **Step 6: Прогнати.**
  - `pnpm vitest run` чотирьох тестів → PASS.
  - `pnpm test` → зелено (`create-store-template-parity` бере шлях із `SYNCED_DIRS`).
  - `pnpm template:sync` повторно → без змін.
  - Мутація: у `checkMigrations` прибрати виклик `missingStoreMigrationsDir` → два нові кейси FAIL; відкат.
- [ ] **Step 7: Commit.** `feat(k3-e7)!: міграції магазину в db/migrations; doctor і update не мовчать про відсутню теку`. Перевірка трейлерів.

### Task 6: Кореневі залишки — `supabase/`, сід пілота, `db:migrate`, content-loader (А7, Р5, В2)

**Files:**
- Delete:
  - `supabase/` (`config.toml`, `seed.sql`);
  - `scripts/pilot-seed.mjs`, `scripts/pilot-pack/seed-sql.mjs`, `scripts/pilot-pack/seed-fixtures.mjs`;
  - `tests/pilot-seed.test.ts`;
  - `scripts/db-migrate.mjs`;
  - `tools/` (уся тека: `content-loader-mcp` — її єдиний вміст).
- Modify:
  - `package.json:30,35` — скрипти `pilot:seed`, `db:migrate`;
  - `tsconfig.json:36-38` — `tools`, `supabase/functions` з exclude;
  - `.gitignore:46-47`;
  - `.claude/settings.json` → `{}` + перенос рядка;
  - `packages/simplycms/migrations/demo/demo-seed.sql:12` (коментар про домен посилається на `seed-fixtures.mjs` → прибрати посилання, домен описати словами), далі `pnpm template:sync` для копії в шаблоні; `tests/create-store-template-parity.test.ts:14` («модель tests/pilot-seed.test.ts» → описати модель без посилання) — аудит Codex №5;
  - `scripts/dev-stand/generate-seed.mjs:29`, `scripts/dev-stand/README.md:31,50,75-82`, `scripts/dev-stand/dump-demo-data.mjs:32` — Postgres-формулювання, без `supabase start/db reset` і без `supabase/seed.sql`.

**Interfaces:** нічого не продукує для інших задач.

🔴 Паралельна гілка `claude/tooling-lessons` (сесія `simplycms-8c`) теж правитиме `.claude/*`, `.agents/skills/code-review/SKILL.md`, `.claude/commands/*`. Вона ребейзиться на Е7 після нас — на неї не чекати й її змін не мержити.

- [ ] **Step 1: Доказ відсутності читачів.** `git grep -nE "seed-fixtures|seed-sql|pilot-seed|pilot:seed|db-migrate|db:migrate|content-loader|supabase/seed|supabase/config" -- ':!docs/**' ':!CHANGELOG.md'` → лише файли, що зносяться або правляться в цій задачі (включно з `demo-seed.sql` і його копією, `create-store-template-parity.test.ts`). Решту доків правити в Task 9. Повторити grep після правок → 0 поза `docs/**` і CHANGELOG.
- [ ] **Step 2: Знести й поправити.** Скрипти `pnpm-workspace.yaml` не чіпають: `tools/` поза workspace.
- [ ] **Step 3: Прогнати.**
  - `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test` → зелено.
  - `pnpm pilot:pack` → зелено: він не залежить від сіду.
  - `test -d supabase || echo gone` → `gone`.
- [ ] **Step 4: Commit.** `chore(k3-e7): знесено кореневий supabase/, сід пілота, db:migrate і tools/content-loader-mcp`. Перевірка трейлерів.

### Task 7: Коментарі коду за політикою слова (Р1)

Зона: `packages/simplycms/{src,routes,test-harness,drizzle.config.ts}`, кореневий `.env.example`, `packages/cli/src`, `packages/create-simplycms-store/{src,template/scripts}`, `packages/simplycms-plugin-faq/src`, `scripts/**`, `tests/**`, `eslint*.mjs`, `playwright.config.ts`, кореневі `src/*` (далі `pnpm template:sync`).

**Files:** точний перелік — вивід Step 1. Місця, де заміна вимагає перевірки факту, а не лише прибирання слова:
- `packages/simplycms/src/storefront-routes/components/SetPasswordForm.tsx:34` — подивитися, що сторінка реально кличе (Better Auth), і назвати це.
- `packages/simplycms/src/themes/theme-context.ts:7` — перевірити, що тягне `ThemeContext.tsx` сьогодні, і переписати за фактом.
- `packages/simplycms/src/plugin-sdk/index.ts:9`, `src/routes/__root.tsx:16` (джерело копій), `packages/simplycms/routes/admin/admin.tsx:11` — «lifecycle адмінки, що ходить у БД через supabase-js» → за фактом. Адмінка client-only, бо працює через serverFn `admin-server` і TanStack DB. Перевірити, чи барель досі тягне серверний вантаж.
- `packages/simplycms/src/schema/types.ts:5-13` — переписати: типи нового коду лише з Drizzle (`simplycms/schema/types`); baseline-файлу більше немає.
- `packages/simplycms/src/db/client.ts:16,63,71` — прибрати порівняння з `supabase/keys`; `:98` лишається (Р1-2, провайдер Postgres).
- `eslint.config.mjs:133,164,618` — `:618`: перевірити, що `template/scripts` справді без `@supabase/supabase-js`, і прибрати.
- `tests/e2e/support/env.ts:6,18` — текст `throw` теж (без слова).
- `scripts/pilot-pack.mjs:19,77-81` — гард-повідомлення про знятий `--e2e` лишається, але без слова («локальний стек БД»).

**Interfaces:** немає.

- [ ] **Step 1: Перелік.** `git grep -n -i supabase -- packages/simplycms/src packages/simplycms/routes packages/simplycms/test-harness packages/simplycms/drizzle.config.ts .env.example packages/cli/src packages/create-simplycms-store/src packages/create-simplycms-store/template/scripts packages/simplycms-plugin-faq/src scripts tests eslint.config.mjs eslint.tier-zones.mjs playwright.config.ts src`. Кожен рядок — у категорію Р1(1)/(2) (лишити) або «перефразувати».
- [ ] **Step 2: Перефразувати.** Факт лишається, слово або клауза зникають. Приклади: «Ні supabase-клієнта, ні QueryClient» → «Ні клієнта БД, ні QueryClient»; «знесені разом із шаром `data-supabase`» → «знесені в 0.4.1». Коментарі `src/*` правити лише в корені, потім `pnpm template:sync`.
- [ ] **Step 3: Прогнати** повторно команду Step 1. Кожен рядок, що лишився, — у категорії Р1(1) або (2) і є в allowlist Task 10. Потім `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` → зелено; `pnpm template:sync` → без змін.
- [ ] **Step 4: Commit.** `chore(k3-e7): коментарі коду без Supabase поза гардами й провайдером Postgres`. Перевірка трейлерів.

### Task 8: Лендінг, README і стек (В3)

**Files:**
- Modify:
  - `apps/www/src/components/hero.tsx:37` → `TanStack Start, React&nbsp;19 and PostgreSQL`;
  - `apps/www/src/routes/__root.tsx:13` — meta description: «… on TanStack Start, React 19 and PostgreSQL …»;
  - `apps/www/src/components/stack.tsx:9,51-54` — елемент `{ name: 'PostgreSQL', host: 'postgresql.org', href: 'https://www.postgresql.org', logo: <PostgresLogo /> }`. Якщо Better Auth у списку немає — додати `{ name: 'Better Auth', host: 'better-auth.com', href: 'https://www.better-auth.com', … }` з текстовим/простим логотипом у стилі сусідів;
  - `apps/www/src/components/icons.tsx:192-206` — `SupabaseLogo` → `PostgresLogo` (монохромний SVG, `currentColor`, як сусідні лого);
  - `apps/www/src/components/sections.tsx:133` → `├─ db/migrations/`.
- Modify:
  - `README.md:3,63,90,98-110,144,171,184` — розділ «Потрібна Supabase» → «Потрібен PostgreSQL 17» + три env-ключі (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `VITE_SITE_URL`); стек «TanStack Start, React and PostgreSQL» + Better Auth; дерево без `src/supabase/` і з `db/` магазину;
  - `packages/README.md:3,34,38,138`;
  - `plugins/README.md:13`;
  - `packages/simplycms-plugin-faq/README.md:10`;
  - `packages/simplycms-theme-solarstore/README.md:42`;
  - `packages/simplycms/src/{contracts,domain,i18n,react-query,runtime,schema}/README.md` (рядки зі звітів: шаблонний вступ «TanStack Start + Supabase» → «+ PostgreSQL»; `schema/README.md:10-11,119` — B; `:100` перефразувати без слова; `:105` лишається, Р1-2).

**Interfaces:** немає.

- [ ] **Step 1: Правки.** Приклад «подвоєння React-контексту» в README теми — замінити `SupabaseProvider` на `CMSProvider`/`QueryClientProvider`, перевіривши, що такий провайдер існує.
- [ ] **Step 2: Прогнати** `pnpm build:www && pnpm typecheck:www && pnpm lint && pnpm format:check` → зелено. `git grep -il supabase -- apps README.md packages/README.md plugins packages/*/README.md packages/simplycms/src/*/README.md` → лише `packages/simplycms/src/schema/README.md` (`:105`).
- [ ] **Step 3: Commit.** `docs(k3-e7): стек TanStack Start, React and PostgreSQL на лендінгу й у README`. Перевірка трейлерів.

### Task 9: Доки, інструментарій агентів, roadmap/state-map, спека, CHANGELOG (А8, Р8, Р9)

**Files:**
- `AGENTS.md`:
  - `:138` — формулювання Р8;
  - `:140` → «Адмінка пишеться на `simplycms/admin-server` + `simplycms/admin-data`; `@supabase/*` у репо заборонено лінтом (`no-supabase-import`)»;
  - `:156` → «Плагін ходить лише через порти `simplycms/plugin-sdk` (межа довіри); БД-клієнтів напряму не імпортує»;
  - `:176` лишається (гард).
- `.agents/skills/code-review/SKILL.md:28,89,95,109,113-117,131` і `.claude/commands/*` — прибрати лише брехню (Р8).
- `docs/architecture/`:
  - `data-layer.md:95,109-114,188,218,232,235`;
  - `plugins.md:118,123,129-135,235-240`;
  - `themes.md:58,171,296,612,658`;
  - `cli.md:153,173,237,275` + опис doctor №7 (Р6) і `update`;
  - `repository-layout.md:72-74,98,138,150-151,158,168`;
  - `release-process.md:255`;
  - `test-contours.md` — лише непозначені розділи; `§11:709` перевірити; гейти Task 1/3 дописати в §11;
  - `platform-delivery-options.md` — позначка «Історичний документ (2026-07-30): Supabase знесено в К3-Е7» угорі, текст не правити.
- `docs/development/ENVIRONMENT.md:32-33`; `TOOLING.md:38,76-77,147` + нові гейти (`no-supabase-import`, тест маніфестів).
- `docs/guides/themes.md:246,333`; `docs/how-it-works.md:15,59,68,78,100` — «Postgres магазину»; `docs/marketplace/README.md:42`; `docs/tasks/seo-ssr-faceted-navigation.md:42,126,212` — `simplycms/schema/types`, `pnpm db:diff`.
- `docs/tasks/platform-roadmap.md`:
  - «Поточний стан» `:42-46` → Е7 закрито, легасі = 0;
  - «Що працює» `:289`;
  - черга;
  - борги №13 (`:1048-1049`), К0-9 (`:1242-1254`), 0.4.1-11 (`:1342-1350`), `:1130-1134`, `:1155`, `:1185-1186`, `:1602` → ✅ з посиланням на цей план;
  - К6 (`:869`) — дописати Р5 дослівно.
- `docs/tasks/v2-state-map.md` — §1 (`:163-169`), §3.1 (`:873-1065`), §3.2 (`:1102-1106`, суперечність про `ReviewDetail`), §4.1 (`:1275`), §5–6 (`:1404-1446`), вступ `:1,23`.
- Спека `docs/superpowers/specs/2026-10-11-v2-k3-e7-supabase-removal-design.md` — розділ «Амендмент (план, 2026-10-11)»: таблиця розбіжностей (а)–(є) і Р1–Р9 одним рядком кожне.
- `CHANGELOG.md [Unreleased]` → «Видалено»: Supabase, публічний API `simplycms/supabase*`, peer'и `@supabase/*`; `supabase/` магазину → `db/` (**breaking** для скаффолдера: psql-цикл по `db/migrations`); `pnpm pilot:seed`, `pnpm db:migrate`. «Додано»: правило `no-supabase-import`, doctor/update про відсутню `db/migrations`.

**Interfaces:** немає.

- [ ] **Step 1: Grep носіїв скасованого.** Кожен рядок має 0 входжень поза `CHANGELOG.md`, `docs/superpowers/**` та історичними розділами з позначкою:
  - `supabase/migrations` (крім підказки Р6 у `cli.md`);
  - `simplycms/supabase`;
  - `LegacySupabaseBoundary`;
  - `tests/admin-server-first` (не плутати з живим `contracts/admin-server-first.ts`);
  - `admin-inserts-need-id`;
  - `pilot:seed`;
  - `db:migrate`;
  - `content-loader`;
  - `supabase/types.ts`;
  - `useSupabaseClient`;
  - `@supabase/ssr` (крім гардів);
  - `SupabaseProvider`.
- [ ] **Step 2: Правки.** Без лічильників і станів у `AGENTS.md`/`CLAUDE.md`.
- [ ] **Step 3: Прогнати** `pnpm format:check` (`*.md` не форматуються, але `.claude/settings.json` і код — так) і `.agents/skills/codebase-research/scripts/orient --doctor` → без нових битих посилань у шарі доків.
- [ ] **Step 4: Commit.** `docs(k3-e7): канон, інструментарій агентів і стан без Supabase; амендмент спеки Р1–Р9`. Перевірка трейлерів.

### Task 10: Фінальний ланцюг, allowlist, живі прогони

**Files:** нових немає, лише виправлення знайденого.

- [ ] **Step 1: Allowlist (Р1).** Файли, яким дозволено містити `supabase` (без урахування регістру), і причина:

  | Файл | Причина |
  |---|---|
  | `eslint-rules/no-supabase-import.mjs`, `tests/eslint-rules/no-supabase-import.test.ts`, `tests/no-supabase-manifests.test.ts` | гард Р2 |
  | `eslint-rules/no-direct-storage.mjs`, `tests/eslint-rules/no-direct-storage.test.ts`, `tests/storage-direct-calls.test.ts` | гард сховища |
  | `eslint.config.mjs` | `@supabase/*` межі довіри плагіна + підключення Р2 |
  | `tests/plugin-trust-boundary.test.ts` | фікстури межі довіри |
  | `tests/create-store-cli.test.ts`, `tests/create-store-invite-setup.test.ts` | негативні асерти (`SUPABASE`, `supabase db push`, `supabase/migrations`) |
  | `tests/cli-doctor.test.ts`, `packages/cli/src/db-diff.mjs`, тест `update` із Task 5 | підказка `git mv supabase/migrations` (Р6) |
  | `packages/simplycms/src/db/client.ts`, `packages/simplycms/src/schema/README.md` | провайдер Postgres (Р1-2) |
  | `packages/simplycms/migrations/{0002_grants.sql,README.md}`, `packages/create-simplycms-store/template/db/migrations/{0002_grants.sql,README.md}` | SQL-канон і байт-копія (Р1-3) |
  | `AGENTS.md`, `.agents/skills/code-review/SKILL.md`, `.claude/commands/*.md` | гард `@supabase/*`, `supabase.storage`; Supabase MCP як інспекція dev-БД; скіл `supabase-postgres-best-practices` (Р8) |
  | `docs/architecture/{data-layer,plugins,storage,cli,themes,release-process,test-contours,platform-delivery-options}.md`, `docs/development/TOOLING.md` | гарди, провайдер Postgres, історичні позначки (Р9) |
  | `docs/tasks/{platform-roadmap,v2-state-map,redesign-mechanism-b2,theme-views-v3}.md` | історичні розділи й завершені задачі (Р9) |

  Перевірка: `git grep -il supabase -- . ':!CHANGELOG.md' ':!docs/superpowers/**' | sort > /tmp/…/actual.txt`. Кожен рядок `actual.txt` мусить бути в allowlist; `comm -23 actual allowlist` → порожньо. Зайвий файл — виправити в його задачі, а не розширювати allowlist. Розширення — лише з причиною і повідомленням архітекторові.
  Allowlist фільтрує лише шляхи, тож у «змішаних» файлах (`schema/README.md`, `cli.md`, `data-layer.md`…) забута правка пройшла б. Тому другий фільтр (аудит Codex №7): `git grep -nE "supabase/types\.ts|simplycms/supabase|src/supabase|LegacySupabaseBoundary|useSupabaseClient|SupabaseProvider|data-supabase|@supabase/ssr|supabase/config\.toml|supabase/seed" -- . ':!CHANGELOG.md' ':!docs/superpowers/**'`. Кожен рядок виводу — або гард (фікстура/асерт у тестах Р2 і `plugin-trust-boundary`), або в розділі з позначкою «історичний» у `docs/tasks/*`, `test-contours.md`, `platform-delivery-options.md`. І окремо `git grep -n "supabase/migrations"` → лише підказка Р6 (`db-diff.mjs`, її тести, `cli.md`), негативні асерти тестів скаффолдера, SQL-канон README і позначені історичні розділи. Будь-що інше — виправити в задачі-власниці.
  Після перевірки обрізати allowlist у плані до фактичного виводу `actual.txt` (окремим комітом `docs(k3-e7): allowlist плану = факт`), щоб він не брехав наступному читачеві.
- [ ] **Step 2: Повний ланцюг гейтів.** `pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm build && pnpm typecheck && pnpm typecheck:showcase && pnpm test && pnpm test:schema && pnpm build:packages && pnpm typecheck:template && pnpm test:packaging && pnpm build:www && pnpm typecheck:www` → зелено, lint 0/7.
- [ ] **Step 3: Живі прогони.**
  - `pnpm live:smoke` → зелено.
  - `pnpm pilot` → Gate C OK, без рядка `legacy`.
  - Скаффолд із tarball-ів (`pnpm pilot:pack`, далі `create-simplycms-store` з tarball-а в tmp). У магазині є `db/migrations/0000_prelude.sql…0004_functions.sql` і немає `supabase/`. Надрукований psql-цикл накатується на чисту БД харнесу (`createdb e7_store` у контейнері з Global Constraints). `pnpm simplycms doctor` → №7 не `error`.
- [ ] **Step 4: Трейлери.** `git log --format=%B a15bcb31..HEAD | grep -ciE "co-authored|generated with"` → `0`.
- [ ] **Step 5: Звіт архітекторові** (`dashboard-design-spec`): журнал мутацій Task 1/3/5, кількість offender'ів Р7, вивід allowlist-перевірки, результати живих прогонів. Пуш/PR/реліз — не робити.
