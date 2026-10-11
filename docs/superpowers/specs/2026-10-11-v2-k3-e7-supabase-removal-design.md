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
