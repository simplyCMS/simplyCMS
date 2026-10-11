# V2-К3-Е7 — повний знос Supabase (рішення)

**Дата:** 2026-10-11 · **Статус:** рішення власника й архітектора ухвалено; план пише виконавець.
**Гілка:** `claude/k3-e6d-content` (той самий PR, що й Е6д; база — прийнятий `55d7a4d2`).
**Мета:** реліз 0.14.0 — перший без Supabase у коді, залежностях, шаблоні магазину й доках про стан.

## Факти інвентаризації (2026-10-11)

- Живих споживачів `supabase-js` у ядрі, шаблоні, host, плагінах і темах **немає**:
  `src/supabase/` імпортують лише його власні тести.
- `LegacySupabaseBoundary` (`admin/layouts/AdminLayout.tsx:8,66-68`) ловить
  `SupabaseEnvMissingError`, якої ніхто не кидає: `SupabaseProvider` не монтується.
  Реєстр `tests/admin-server-first/registry.ts` (`PENDING_LEGACY`) містить лише цю межу і її тест.
- Єдиний живий клієнт `supabase-js` у репо — `tools/content-loader-mcp` (поза workspace,
  на v2 нефункціональний: PostgREST немає).
- Е7 — знос мертвого шару, а не портування. Оцінка: 6–10 год агента + 3–4 год на перейменування теки.

## Рішення власника

- **В1. Тека магазину `supabase/` → `db/`.** `supabase/migrations` → `db/migrations`;
  `config.toml` (Supabase CLI) і `templates/invite.html` видаляються. Зачіпає
  `scripts/sync-create-store-template.mjs`, `packages/cli/src/db-diff.mjs` (`storeMigrationsDir`),
  `create-simplycms-store/src/{scaffold.mjs,steps.mjs}`, `scripts/pilot-pack/create-pkg-checks.mjs`,
  `placeholder-scan`, тести CLI/скаффолдера/парності шаблону, `template/gitignore`, README і
  `docs/architecture/{cli,plugins,data-layer}.md`, `doctor` №7 і `simplycms update`.
  Міграції наявних магазинів немає (їх немає); `doctor` чесно повідомляє про стару `supabase/`
  або план пояснює, чому ні.
- **В2. `tools/content-loader-mcp` знести** разом із записом MCP у `.claude/settings.json`
  (власник дозволив саме цю правку) і виключенням у `tsconfig.json`.
- **В3. Формулювання стеку** (лендінг `apps/www`, кореневий README): «TanStack Start, React and
  PostgreSQL» + Better Auth; логотип Supabase → PostgreSQL.

## Рішення архітектора

- **А1. Знести:** `packages/simplycms/src/supabase/` повністю (з `database.ts`, тестами, README);
  `LegacySupabaseBoundary` з тестом і монтуванням; i18n `admin.legacy.*` (якщо інших споживачів
  немає); мертві `vi.mock('simplycms/supabase/SupabaseProvider')` у storefront-тестах;
  `core/__tests__/cms-provider-no-supabase.test.tsx`.
- **А2. Публічний API і залежності:** 6 exports `simplycms/supabase*` (і дзеркало в `publishConfig`),
  peer'и `@supabase/*`, залежності в кореневому `package.json`, `template/package.json.tpl`,
  `tests/pilot/store-template/package.json`, `PEER_SCOPES` у `scripts/audit-deps*`; перевірити
  входи tsdown; lock — `pnpm install`, далі `install --frozen-lockfile`.
- **А3. Гарди.** Бан `@supabase/*` ЛИШАЄТЬСЯ ратчетом проти повернення — і розширюється на все
  `packages/simplycms/src` та шаблон, якщо зараз лише плагінний (з негативним контролем).
  `no-direct-storage` і `storage-direct-calls` лишаються. Записи `simplycms/supabase*` (лінт-група
  плагінів, тір-зона `src/supabase`, `tests/tier-boundary/zones.ts`, `SERVER_ENV_FILES`) прибрати;
  правило `import.meta.env` у серверних модулях зберігає негативний контроль після зникнення
  `env-source.test.ts`.
- **А4.** Реєстр `tests/admin-server-first*` знести (його замінює бан лінтом); гілку `supabase` у
  `test-harness/pg/insert-scan.ts` і `explicit-ids.test.ts` знести; `admin-inserts-need-id` —
  знести, якщо сканує лише supabase-js-вставки, інакше лишити.
- **А5.** `tests/dist-import-meta.test.ts`: позитивний якір `dist/supabase/browser-client.js`
  замінити іншим реальним ланцюгом `import.meta.env` у dist або перебудувати тест так, щоб він
  червонів на мутації. Просто видалити — не можна.
- **А6.** `scripts/pilot-pack/gate-c.mjs`: мертві патерни `dist/supabase/*` прибрати; Gate C далі
  ловить серверний вантаж у клієнті (негативний контроль).
- **А7. Кореневий `supabase/`:** `config.toml` знести; `seed.sql` з генератором і тестом
  парності — перенести в `tests/pilot/` або знести, якщо споживача немає до К6 (вибір обґрунтувати
  в плані); `tsconfig.json` (`supabase/functions`) і заглушку `db:migrate` — прибрати.
- **А8. Доки.** Обовʼязково виправити все, що бреше про стан: кореневий `README.md`,
  `docs/architecture/*` (data-layer, repository-layout, plugins, themes, cli, storage,
  release-process, test-contours), `docs/development/{ENVIRONMENT,TOOLING}.md`, `docs/guides/themes.md`,
  `how-it-works.md`, `packages/README.md`, `AGENTS.md` (рядок про «застарілий шар supabase-js»),
  `.agents/skills/code-review/SKILL.md`, `.claude/commands/*`, протухлі посилання в
  `schema/types.ts` і `eslint.config.mjs`; `platform-delivery-options.md` позначити історичним.
  Не чіпати `CHANGELOG` (історія) і `docs/superpowers/{plans,specs,research}`. Копії `template/` і
  `cli/host` — лише через джерело + `template:sync`. Roadmap/state-map: Е7 закрито, легасі = 0.
  CHANGELOG [Unreleased] → «Видалено»: Supabase, API `simplycms/supabase*`, `supabase/` → `db/`
  (breaking для скаффолдера).
- **А9.** Е8 (живий прогін із tarball-ів) — окремо після релізу.

## DoD

- `git grep -il supabase` поза `CHANGELOG.md`, `docs/superpowers/**`, історичними позначками й
  навмисними гардами — порожній, або план містить вичерпний перелік із причиною біля кожного файлу.
- Повний ланцюг гейтів (`AGENTS.md`) + `live:smoke` + `pnpm pilot` (Gate C); скаффолд магазину з
  tarball-ів створює `db/migrations` і проходить накат; lint 0/7; трейлерів 0.
- Пуш, PR і реліз 0.14.0 — лише за словом власника.

## Амендмент (план, 2026-10-11)

Розвідка плану (HEAD `a15bcb31`, база виконання `8b48c8ed`) виявила розбіжності зі спекою;
розвилки Р1–Р9 ухвалив архітектор. Повний текст — у плані
[`2026-10-11-v2-k3-e7-supabase-removal.md`](../plans/2026-10-11-v2-k3-e7-supabase-removal.md).

### Розбіжності зі спекою (а)–(є)

| # | Спека припускала | Факт |
|---|---|---|
| а | А3: правило `import.meta.env` у `SERVER_ENV_FILES` «зберігає негативний контроль» після зникнення `env-source.test.ts` | Контролю не було зовсім: `env-source.test.ts` сам визнавав, що селектор нічого не доводить (у vitest `import.meta.env` — Proxy над `process.env`). Контроль написано з нуля (Task 1) |
| б | А5: у dist є «інший реальний ланцюг `import.meta.env`» | Немає: єдиний код — `supabase/browser-client.ts`; позитивний якір — фікстур-збірка |
| в | А6: Gate C «далі ловить серверний вантаж» | Юніт-тесту на `gateBundle` не було, лише живий `pnpm pilot` без мутації; написано юніт |
| г | А3: розширити бан, «якщо зараз лише плагінний» | Так і було: `@supabase/*` банено лише в `PLUGIN_TRUST_BOUNDARY_FILES`; `no-direct-storage` бачив тільки `@supabase/storage-js`; `template/*` повністю в ignores лінту |
| д | В1: «`doctor` чесно повідомляє про стару `supabase/`» | `checkMigrations` на відсутній теці отримував `[]` і казав «всі міграції нові»; `simplycms update` теку не бачив. Виправлено обидва (Р6) |
| е | А7: `seed.sql` «перенести або знести» | Ланцюг `seed.sql` ← `pilot-seed.mjs` ← `seed-sql.mjs` ← `seed-fixtures.mjs` мав єдиного читача — власний тест парності; знесено весь |
| є | А4: «гілка `supabase` у `insert-scan.ts`» | Гілка жила в `explicit-ids.test.ts`, у `insert-scan.ts` — лише JSDoc; окрема виїмка `EXEMPT_DIRS` обґрунтована знесеним шаром |

### Рішення Р1–Р9 (архітектор)

- **Р1 — політика слова.** У коді `supabase` лишається лише в гардах і їхніх тестах, як «провайдер Postgres» (dev-БД) і в SQL-каноні міграцій (з байт-копіями); решту історичних коментарів перефразовано. Окремого текстового ратчета на слово немає — його роль частково бере `tests/doc-symbols-exist`.
- **Р2 — ратчет проти повернення.** Правило `simplycms-supabase/no-supabase-import` на все репо: static `import`, `export … from`, динамічний `import()`, `require()`; плюс тест маніфестів і `pnpm-lock.yaml` (жодного `@supabase/`). Виконання додало TS-форми (`import x = require`, `import('…').T`) і шаблонні маніфести.
- **Р3 — dist-import-meta.** `tsdown.config.ts` експортує `base`; тест збирає фікстур саме цим об'єктом. Виконання: гард доводиться мутацією `format: ['cjs']`, а не `target` (Rolldown не лоуерить `import.meta` у ESM); спільний патерн `LOWERED_IMPORT_META` має самоперевірку.
- **Р4 — Gate C.** Юніт на `gateBundle` із синтетичним `bundle-stats.client.json`, три кейси; мутація — прибрати `...SERVER_ONLY.map(...)` → червоно.
- **Р5 — сід пілота.** Знесено весь ланцюг; К6 пише сід пілота під Postgres-стек з нуля.
- **Р6 — коректність doctor.** Немає `db/migrations` → `error` «тека міграцій магазину відсутня» (із підказкою `git mv supabase/migrations db/migrations`, якщо є стара); `simplycms update` не мовчить. Це не підтримка старих магазинів, а прибирання хибного твердження.
- **Р7.** `EXEMPT_DIRS` в `explicit-ids` знято, `tests/admin-inserts-need-id.test.ts` знесено.
- **Р8 — інструментарій агентів.** `AGENTS.md`: міграції лише через `pnpm db:diff`, MCP-інструменти БД — лише інспекція; прибрано лише брехню (`supabase/types.ts`, cookie-сесії `@supabase/ssr`, `supabase` у тірах).
- **Р9 — доки.** Розділи чинного стану оновлено, історичні з позначкою не чіпано; `platform-delivery-options.md` — позначка «історичний» угорі.
- **Дрібне.** `.claude/settings.json` → `{}` (дозвіл власника, В2); `tsconfig.json` без `tools` і `supabase/functions`; `scripts/db-migrate.mjs` і `db:migrate` знесено; `TEMPLATED_FILES` → `['package.json']`; `PEER_SCOPES` прибрано.

### Додаткові ухвали виконання

- Р3: мутація доводиться саме `format: ['cjs']` — `target` не лоуерить `import.meta` у ESM-виході Rolldown.
- Р2: ратчет ловить і TS-форми (`import x = require(...)`, `import('…').T`), не лише п'ять форм плану.
- pnpm 11 переписує lock перед кожним `pnpm <script>`, тож мутацію lock доводять через `npx vitest`, а не `pnpm test`.
