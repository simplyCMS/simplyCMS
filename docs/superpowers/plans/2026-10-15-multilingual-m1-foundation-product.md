# Мультимовність М1: фундамент і наскрізний товар — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Мови, механіка перекладів, реєстри адрес і токенів, реєстр операцій з адмінським і публічним HTTP-транспортом. На цьому фундаменті товар наскрізно: створюється, перекладається й читається обома транспортами, а вітрина віддає `/<path>` і `/<мова>/<path>` з коректним SEO.

**Architecture:** Дві внутрішні хвилі з прийманням архітектора після кожної.

- **Хвиля Ф (фундамент)** не чіпає таблиць товару:
  - ребазлайн drizzle;
  - машина станів мов у БД;
  - чисті модулі `domain/translations` і `domain/slugs`;
  - узагальнений тригер джерела;
  - реєстри `url_paths` / `slug_tokens`;
  - виконавець операцій із явним суб'єктом;
  - HTTP-адаптер з токенами й ідемпотентністю;
  - лінт і паритет;
  - мовний контекст вітрини через `rewrite` роутера.

  Перший живий споживач реєстру — операції мов.
- **Хвиля Т (товар)** переводить товар за схемою expand → contract усередині гілки:
  1. нові таблиці поруч зі старими колонками;
  2. команда агрегата;
  3. адмінка на команді (зникають старі записувачі);
  4. проєкція;
  5. читачі вітрини;
  6. знос старих колонок разом із вмиканням тригерів І4/І5.

  Проміжні коміти зелені; реліз — лише з кінця хвилі мультимовності.

**Tech Stack:** TypeScript 6 strict, TanStack Start 1.168 / router-core 1.171 (`rewrite`), Drizzle + PostgreSQL 17 (`test:schema`), Zod 4.6 (`z.toJSONSchema`), Vitest + Testing Library, ESLint flat config (власні правила).

**Spec:** `docs/superpowers/specs/2026-10-14-multilingual-wave-design.md`.
**Майстер-план (контракти, матриця І1–І40, Global Constraints):** `docs/superpowers/plans/2026-10-15-multilingual-wave-master.md` — §1 Р1–Р18, §3 незворотні контракти, §4 матриця, §6 процес. Імплементер читає його §3, §4 і §6 перед будь-якою задачею. Цей план їх НЕ повторює й не перевизначає.

---

## Global Constraints

Усе з майстер-плану §6, плюс:
- **Номери інваріантів** (`І<n>`) — з матриці майстра. Задача, що закриває рядок, у звіті дає рядок «мутація → червоний → відкат → зелений» для КОЖНОЇ мутації рядка.
- **Тимчасове дзеркалення в старі колонки** (хвиля Т, від Task 10 до Task 17) позначається коментарем `// М1-TEMP: зноситься в Task 17`. Task 17 доводить `git grep -n "М1-TEMP"` → порожньо. Тимчасовий `createTranslator(x, 'uk')` з Task 3 позначається `// М1-TEMP: Task 9` і зникає в Task 9.
- **Нові теки й субшляхи** цього плану:
  - `src/operations/` (T2, `simplycms/operations`, серверна частина `simplycms/operations/server`);
  - `src/addressing/` (T2, `simplycms/addressing`);
  - `src/translations/` (T2, `simplycms/translations`);
  - `src/catalog-projection/` (T2, `simplycms/catalog-projection`);
  - `src/domain/translations/`, `src/domain/slugs/` (T1, субшляхи `simplycms/domain/translations`, `simplycms/domain/slugs`);
  - `src/i18n/packs/` (T2, усередині `simplycms/i18n`).

  Кожна реєструється в `eslint.tier-zones.mjs` (з переліком upward-винятків одним рядком причини), у `exports` `packages/simplycms/package.json`, у `contracts/server-only` (якщо серверна) і в таблиці `packages/README.md`.
- Мова інтерфейсу адмінки в М1 = основна мова магазину. Налаштування в профілі — М3.

## Розвилки рівня М1 (вирішую сам у межах майстра; архітектор бачить на прийманні)

| # | Питання | Рішення |
|---|---|---|
| Д1 | Де генерується OpenAPI | Лінива генерація з реєстру при першому `GET /api/v1/openapi.json`, мемоізація на процес. Плюс закомічений знімок операцій ЯДРА `packages/simplycms/api/openapi.core.json` під тестом рівності: будь-яка зміна публічного контракту видна в дифі рев'ю. Регенерація — `pnpm api:snapshot`. «При збірці» зі спеки досягається тим самим: реєстр — частина серверного бандла |
| Д2 | Звідки клієнт знає набір мов для `rewrite` | Інлайн-скрипт у `<head>` (той самий патерн, що `serializeActiveThemeScript`): `window.__SCMS_LOCALES__ = { primary, published: [...] }`. Сервер читає набір із `languagesCache` — кешу з поколінням У БД (див. Д6), а не з процесного `invalidate()`: на кількох репліках процесне скидання бачить лише один процес |
| Д6 | Узгодженість процесних кешів між репліками (прийнято архітектором 2026-10-15) | ОДИН механізм: `createReadCache` сам стає поколіннєвим через таблицю `cache_generations(key text PRIMARY KEY, generation bigint NOT NULL)`. Ключі — константа ядра `CACHE_KEYS` (`storeProfile`, `activeTheme`, `languages`), рядки сіду — у `0003_seed.sql` (перекладної пари немає, B1 не порушено). Мутація збільшує покоління у СВОЇЙ транзакції. Усі покоління читаються ОДНИМ запитом на HTTP-запит і мемоізуються в per-request контексті ядра `simplycms/site/request-context`; поза запитом (CLI, фонові задачі) — запит на `get`. LISTEN/NOTIFY не беремо: прив'язаний до з'єднання й ненадійний за пулерами. Задача — Task 5а |
| Д3 | Як `output` rewrite знає поточну мову | `input` записує мову розібраного URL у стан, створений у `getRouter()`. Стан per-router: на сервері роутер створюється на запит, на клієнті — один. Це обчислене значення `resolveRequestLocale`, а не друге джерело мови |
| Д4 | Виконавець і старий `runAdmin` | `runAdmin`/`runAdminTransactions` лишаються для ще не перенесених 125 serverFn до М3. Нові операції йдуть лише через `executeOperation`. Лінт І25 тримає явний legacy-перелік, який лише скорочується |
| Д5 | Права операцій мов і токенів | `languages.*` → `settings.manage`; `apiTokens.*` → нова операція `apiToken.manage` в `AUTHZ_MATRIX` (`{ admin: 'any' }`): видача токена — окрема ділянка безпеки, а не налаштування |

---

# Хвиля Ф — фундамент

### Task 1: Ребазлайн drizzle і злиття `mail_outbox` у baseline (Р6)

**Files:**
- Create: `scripts/rebaseline-drizzle.mjs`, `tests/rebaseline-drizzle.test.ts`
- Modify: `package.json` (скрипт `db:rebaseline`), `packages/simplycms/drizzle/**` (регенерат), `packages/simplycms/migrations/0001_init.sql` (+ вміст `0005`), `packages/simplycms/migrations/README.md`, `docs/architecture/{data-layer.md,repository-layout.md,test-contours.md}`, `packages/simplycms/test-harness/pg/__tests__/baseline.test.ts:151` (коментар лічильника), `tests/schema-sources-parity.test.ts:128-134` (очікування — лише `['0000_init.sql']`), `packages/simplycms/migrations/0002_grants.sql` + `test-harness/pg/__tests__/fixtures/grants.ts` (ручні `revoke all … from public` і `grant select, insert, update, delete … to app_admin` для `mail_outbox` переїжджають з `0005_mail_outbox.sql:15-21`: регенерат зі схеми їх не відновить)
- Delete: `packages/simplycms/migrations/0005_mail_outbox.sql`, `packages/simplycms/drizzle/0001_mail_outbox.sql`, `packages/simplycms/drizzle/meta/0001_snapshot.json`
- Sync: `pnpm template:sync` (копії `template/db/migrations/`, `packages/cli/host/`)

**Interfaces:**
- Produces: `pnpm db:rebaseline`. Після будь-якої правки `schema.ts` у цьому плані — замість ручних правок снапшотів.
  - регенерує `packages/simplycms/drizzle/` (одна міграція `0000_init.sql` + `meta/0000_snapshot.json` + `_journal.json`);
  - переписує `migrations/0001_init.sql` як `drizzle/0000_init.sql` + рядки `ALLOWLIST_MIGRATION_ONLY_LINES` (два `COMMENT ON COLUMN`) у фіксованому місці.

- [ ] **Step 1: Тест детермінізму.** `tests/rebaseline-drizzle.test.ts`:
  - `it('два прогони поспіль дають нульовий диф')` — копія пакета в tmp, `node scripts/rebaseline-drizzle.mjs --root <tmp>` двічі; `sha256` усіх файлів `drizzle/**` і `migrations/0001_init.sql` після 1-го й 2-го прогону однакові;
  - `it('канон не має 0005, а mail_outbox є в 0001_init')` — `existsSync('…/0005_mail_outbox.sql') === false`, `readFileSync(0001_init).includes('CREATE TABLE "mail_outbox"') === true`.
- [ ] **Step 2:** `pnpm vitest run tests/rebaseline-drizzle.test.ts` → FAIL (скрипта немає).
- [ ] **Step 3: Скрипт.** `scripts/rebaseline-drizzle.mjs` з `--root <dir>` (типово корінь репо):
  - видаляє `drizzle/`;
  - запускає `drizzle-kit generate --dialect postgresql --schema ./src/schema/schema.ts --out ./drizzle --name init` з cwd пакета (відносний `--out`, пастка з `drizzle.config.ts`);
  - нормалізує `when` у `_journal.json` до константи `0` — інакше детермінізму немає;
  - збирає `migrations/0001_init.sql` за правилом з Interfaces.

  Без мережі й БД. Потім злиття: файли `0005`/`drizzle/0001*` видаляються, `mail_outbox` уже в `schema.ts` (`export * from "./mail"`) і потрапляє в `0000`.
- [ ] **Step 4:** `pnpm db:rebaseline && git diff --stat` — у дифі лише `drizzle/**`, `0001_init.sql`, `0002_grants.sql` і видалені файли. Детермінізм: `find packages/simplycms/drizzle packages/simplycms/migrations -type f | sort | xargs sha256sum > /tmp/a` → повторний `pnpm db:rebaseline` → те саме в `/tmp/b` → `diff /tmp/a /tmp/b` порожній (порівняння між прогонами, а не з HEAD).
- [ ] **Step 5:** `pnpm vitest run tests/rebaseline-drizzle.test.ts tests/schema-sources-parity.test.ts` → PASS. `pnpm template:sync`, потім `pnpm vitest run tests/create-store-template-parity.test.ts` → PASS. `pnpm test:schema baseline` → PASS.
- [ ] **Step 6: Доки.**
  - `migrations/README.md`: склад канону `0000…0004`, процедура «правка `schema.ts` → `pnpm db:rebaseline` → ручні файли → `template:sync`»;
  - `data-layer.md:279-290`: те саме, «baseline `0000…0004`»;
  - `repository-layout.md:123`, `test-contours.md:662`: `0005` прибрати;
  - `AGENTS.md` «baseline `0000…0005`» → `0000…0004` (рядки «Принципи» й «Пакети й реліз»).
- [ ] **Step 7:** БЛ. Негативний контроль: у скрипті прибрати нормалізацію `when` → тест детермінізму червоний → відкат → зелений. Commit (з дозволу власника) `chore(multilingual): ребазлайн drizzle скриптом, mail_outbox у baseline`.

### Task 2: Мови в БД і реєстр ключів замків (І1–І3)

**Files:**
- Modify: `packages/simplycms/src/schema/schema.ts:155-167` (`languages`), `schema/types.ts:150` (`Language`), `migrations/0003_seed.sql:34`, `migrations/0004_functions.sql` (тригер), `test-harness/pg/__tests__/functions-allowlist.test.ts`, `test-harness/pg/__tests__/single-default.test.ts`
- Create: `packages/simplycms/src/db/lock-keys.ts`, `packages/simplycms/src/db/__tests__/lock-keys.test.ts`, `packages/simplycms/test-harness/pg/__tests__/languages-invariants.test.ts`, `packages/simplycms/test-harness/pg/__tests__/lock-keys-disjoint.test.ts`
- Modify: `packages/simplycms/src/db/advisory-lock.ts` (+ `advisoryXactLockShared`), `src/db/index.ts`, `src/migrate/apply.ts:28` (`MIGRATION_LOCK_KEY` переїжджає в `lock-keys.ts`, тут — імпорт), `src/migrate/index.ts:15-20` (публічний реекспорт `MIGRATION_LOCK_KEY` — тепер з `simplycms/db/lock-keys`, ім'я не змінюється)

**Interfaces:**
- Produces (схема): `languages` за майстром §3.1 + enum `language_status`. Сід рядка `('00000002-0000-4000-8000-000000000001','uk','Українська','published',true,0)` лишається в `0003` до М2 (`bootstrapStore`).
- Produces (БД): `public.languages_guard()` — BEFORE UPDATE OR DELETE тригер:
  - UPDATE `code` чи `is_default` → `check_violation` «languages: код і основна мова незмінні»;
  - основна з `status <> 'published'` → та сама помилка;
  - DELETE основної → «languages: основну мову не видалити».
- Produces (TS):
  - `LOCK_KEYS` (`as const`): `migration: bigint` (= `MIGRATION_LOCK_KEY`), `languagesSet: 'languages-set'`, `adminRoles`, `customerConfig`, `discountConfig`, `shippingConfig`, `siteTheme`, `storeProfile`, `priceTypeDefault` (рядкові ключі) і префікси `customerCategoryPrefix: 'customer-category:'`, `stockPrefix: 'stock:'`, `pricesPrefix: 'prices:'`, `modDefaultPrefix: 'mod-default:'` — РЕЄСТР УСІХ наявних ключів, значення переносяться без зміни; префікса `catalog:` немає (його не мав жоден споживач);
  - `advisoryXactLockShared(db: ActorDb, key: string): Promise<void>` (`pg_advisory_xact_lock_shared(hashtextextended(key, 0))`).

- [ ] **Step 1: Тести.** `languages-invariants.test.ts`, кожен — окрема транзакція з `expect(...).rejects.toThrow(<текст>)`:
  - `'код незмінний'` — `update languages set code='en' where is_default`;
  - `'основна незмінна'` — `update … set is_default=false`;
  - `'основна лише published'` — `update … set status='draft' where is_default`;
  - `'основну не видалити'`;
  - `'не-основну без перекладів видалити можна'` — вставити `('…','pl','Polski','draft',false,1)`, delete → 1 рядок;
  - `'формат BCP 47'`: `uk`, `pt-BR`, `zh-Hans`, `zh-Hans-CN` проходять; `UA`, `uk_UA`, `pt-br`, `english` — ні;
  - `'унікальність без регістру'` — `en-GB` двічі → `unique_violation` на `languages_code_key`;
  - `'регістронезалежний дубль'` — у транзакції тесту (з відкатом; DDL у Postgres транзакційний) CHECK формату замінюється регістронезалежним (`~*`), вставляється `en-GB`, потім `en-gb` → `unique_violation` саме на `languages_code_lower_key` (перевірка `error.constraint`). Так індекс доводиться поведінкою, а не фактом існування.

  `lock-keys-disjoint.test.ts`: `select hashtextextended(k, 0)` для кожного рядкового ключа (для префіксів — `'<prefix>00000000-0000-4000-8000-000000000000'`) ≠ `LOCK_KEYS.migration` і попарно різні.
- [ ] **Step 2:** `pnpm test:schema languages-invariants lock-keys-disjoint` → FAIL.
- [ ] **Step 3: Схема.**
  - `languages`: `code text` (CHECK майстра), `status language_status not null default 'draft'`, `sort_order integer not null default 0`, `is_active` прибрати;
  - UNIQUE `languages_code_key` + `uniqueIndex('languages_code_lower_key').on(sql\`lower(code)\`)`;
  - CHECK `languages_default_published`.
  - Тригер у `0004_functions.sql` — дзеркало конвенцій `require_default_shipping_zone` (`:45-72`): `language plpgsql`, `set search_path = public`, `revoke all … from public`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`.
  - `pnpm db:rebaseline`, функція — в allowlist. `single-default.test.ts`: вставки мов оновити під нові колонки.
- [ ] **Step 4: Ключі замків.** `lock-keys.ts` + перенести ключі з `migrate/apply.ts:28`, `auth/admin-roles-lock.ts`, `admin-server/impl/catalog-lock.ts`, `customer-lock.ts` в імпорти з реєстру (значення байт-у-байт). Юніт `lock-keys.test.ts`: значення ключів = зафіксовані літерали.
- [ ] **Step 5:** `pnpm test:schema languages-invariants lock-keys-disjoint single-default baseline` → PASS. `pnpm vitest run packages/simplycms/src/db` → PASS.
- [ ] **Step 6:** БЛ + `pnpm template:sync`. Мутації: (а) прибрати гілку `is_default` у тригері → `'основна незмінна'` червоний; (б) прибрати гілку DELETE → `'основну не видалити'` червоний; (в) прибрати `languages_code_lower_key` → кейс `'регістронезалежний дубль'` червоний. Commit `feat(multilingual): мови — машина станів у БД, реєстр ключів замків`.

### Task 1б: Маніфест видалених файлів канону й прибирання в магазині (рішення архітектора 2026-10-15, варіант б′)

Причина: Task 1 уперше ВИДАЛИВ файл канону ядра (`0005_mail_outbox.sql`). `simplycms db:diff --write` лише докопіює
нові файли канону в `db/migrations` магазину (`packages/cli/src/db-diff.mjs`), а видалених не прибирає. Магазин
0.15.0, що перестворює БД, отримає старий `0005` поряд із новим `0001_init.sql` (де `mail_outbox` уже є) →
`db:apply` падає 42P07 на CREATE TABLE.

Чому не евристика за іменем: `isCoreMigrationName` (`^\d{4}_[a-z0-9_]+\.sql$`) розпізнає ядро лише за конвенцією.
Власна міграція магазину, яку власник назвав `0006_x.sql`, загинула б на `--write`. Видаляти чужий файл за
евристикою неприйнятно. Тому маніфест закритий: лише явно перелічені файли з точним хешем.

**Files:**
- Create: `packages/simplycms/migrations/removed.json`, тести в `tests/cli-db-diff.test.ts` (новий `describe`) і `tests/cli-doctor*.test.ts` (за наявним патерном doctor-тестів), тест маніфесту `tests/removed-migrations-manifest.test.ts`
- Modify: `packages/cli/src/db-diff.mjs` (звіт і `--write`), `packages/cli/src/doctor-fs-checks.mjs` (warn), `packages/cli/src/index.mjs` (help, якщо описує `db:diff`), `CHANGELOG.md` `[Unreleased]` (крок `db:diff --write`), `packages/simplycms/skills/simplycms-update/**` (крок оновлення), `docs/architecture/cli.md`, `docs/architecture/release-process.md` (правило поповнення), `package.json` `files` пакета `simplycms` (якщо `migrations/` уже їде цілком — перевірити, що `removed.json` потрапляє в tarball: `pnpm test:packaging`)
- Sync: `pnpm template:sync`, якщо маніфест має їхати в шаблон магазину (визначити за тим, як шаблон отримує канон; якщо шаблон бере канон із пакета — не копіювати)

**Interfaces:**
- `packages/simplycms/migrations/removed.json`: масив `[{ "name": string, "sha256": string, "removedIn": string, "reason": string }]`. Перший і єдиний запис: `{ "name": "0005_mail_outbox.sql", "sha256": "fc5b714b963732218da7b39a4808ab87067dadf62c27b2ac6d039bb26346bb95", "removedIn": "<наступна версія з package.json + опис 'baseline-виняток М1'>", "reason": "mail_outbox злито в 0001_init.sql (baseline-виняток до 1.0.0-rc.1)" }`. Хеш узято з тега `v0.15.0` (`git show v0.15.0:packages/simplycms/migrations/0005_mail_outbox.sql | sha256sum`), не з робочої копії.
- `db-diff.mjs`: функція `findRemovedCoreMigrations(storeDir, manifest): Array<{ name; status: 'match' | 'modified' }>` — розглядає ЛИШЕ імена з маніфесту, присутні в `db/migrations`; `match` = sha256 вмісту збігся.
  - Без `--write`: звіт обох статусів.
  - З `--write`: видаляє лише `match`. `modified` — НЕ видаляє, друкує чітку відмову: «файл <name> прибрано з канону ядра у <removedIn>, але в магазині він змінений (хеш інший) — перенеси свої зміни в нову міграцію й видали файл вручну».
  - Плагінні (`<14 цифр>_plg_*`) і будь-які файли поза маніфестом не розглядаються взагалі.
- `doctor`: warn на кожен присутній у `db/migrations` файл із маніфесту (з підказкою `simplycms db:diff --write` для `match`, ручної дії — для `modified`).
- Правило поповнення: маніфест поповнюють лише baseline-винятки до `1.0.0-rc.1`; після заморожування канон файлів не видаляє — рядок у `release-process.md`.

- [ ] **Step 1: Тести CLI** (`tests/cli-db-diff.test.ts`, тимчасова тека магазину за наявним патерном файла):
  - `'файл з маніфесту з правильним хешем — без --write лише звіт, файл лишився'`;
  - `'--write: збіг імені й хешу → видалено'`;
  - `'--write: ім\'я збіглось, хеш ні → не видалено, відмова з інструкцією'`;
  - `'файл поза маніфестом з ім\'ям 0006_x.sql → не чіпається ні звітом, ні --write'`;
  - `'плагінний файл → не розглядається'`.
  `removed-migrations-manifest.test.ts`: кожен запис має 64-hex `sha256`, жодного з імен немає в поточному каноні `packages/simplycms/migrations/`; хеш `0005_mail_outbox.sql` = sha256 файла з тега `v0.15.0` (`git show`).
  Doctor: `'присутній файл з маніфесту → warn'`.
- [ ] **Step 2:** FAIL (RED-доказ у звіт).
- [ ] **Step 3:** Реалізація.
- [ ] **Step 4:** PASS; `pnpm test:packaging` (маніфест у tarball).
- [ ] **Step 5:** Носії: CHANGELOG `[Unreleased]` BREAKING — «після оновлення: `simplycms db:diff --write` прибере `db/migrations/0005_mail_outbox.sql`; якщо ти його змінював — перенеси зміни й видали вручну»; скіл `simplycms-update`; `cli.md`; `release-process.md`.
- [ ] **Step 6:** БЛ. Мутація: видаляти за іменем без перевірки хешу → `'хеш ні → не видалено'` червоний. Commit `feat(cli): маніфест видалених файлів канону, прибирання в db:diff --write`.

### Task 1в: Ребазлайн магазину — `db:diff --write --rebaseline` (рішення архітектора 2026-10-15)

Причина (живий прогін імплементера Task 1б на файлах тега `v0.15.0`): магазин 0.15.0 після оновлення пакета
запускає `simplycms db:diff --write` і зупиняється на «Спільні міграції розійшлися вмістом» (`packages/cli/src/db-diff.mjs:313`),
бо `0001…0004` змінені baseline-винятком. Прибирання `0005` (Task 1б) до цього кроку не доходить. Шляху «оновити
baseline-файли магазину» в платформі немає — досі лише рядок CHANGELOG «перестворити БД». М2 правитиме baseline
ще раз, тож механізм потрібен зараз.

**Files:**
- Modify: `packages/cli/src/db-diff.mjs` (або винесений модуль поруч, якщо файл росте — він уже понад 150 рядків), `packages/cli/src/index.mjs` (help), `CHANGELOG.md` `[Unreleased]`, `packages/simplycms/skills/simplycms-update/references/migrations.md`, `docs/architecture/cli.md`
- Test: `tests/cli-db-diff.test.ts` (новий `describe('--rebaseline')`)

**Interfaces:**
- `simplycms db:diff --write --rebaseline` — ОДИН прохід, по порядку:
  1. видаляє файли з `removed.json` за правилами Task 1б (назва + sha256; змінений — відмова, не видалення);
  2. ЗАМІНЮЄ вмістом канону файли ядра, які присутні в каноні встановленого пакета й відрізняються вмістом;
  3. докопіює відсутні файли канону.
  Власні (будь-які імена поза каноном, зокрема `^\d{4}_` поза каноном) і плагінні (`<14 цифр>_plg_*`) файли не розглядаються.
- Перед заміною друкується перелік файлів, що замінюються, і червоний рядок «базу даних треба перестворити: журнал накату `simplycms_migrations` відхилить змінений вміст». Гарантію дає sha256-журнал Е8; `db:diff` до БД не звертається.
- `--rebaseline` без `--write` — лише звіт того самого плану дій.
- Без `--rebaseline` поведінка Task 1б незмінна; зупинка «Спільні міграції розійшлися вмістом» лишається, але її текст отримує підказку: «до 1.0.0-rc.1 — це baseline-виняток: `simplycms db:diff --write --rebaseline` + перестворити БД».
- Після `1.0.0-rc.1` прапорець відмовляє з поясненням «канон заморожено». Перевірка — за версією ВСТАНОВЛЕНОГО ядра (`node_modules/simplycms/package.json`) через semver: версія `>= 1.0.0-rc.1` (з пререлізами) → відмова. Нової константи немає.

- [ ] **Step 1: Тести CLI** (тимчасова тека магазину за патерном файла):
  - `'--rebaseline: змінений файл ядра замінено вмістом канону, перелік і рядок про перестворення БД надруковано'`;
  - `'власний 2026…_x.sql і власний 0006_x.sql поза каноном, плагінний <14 цифр>_plg_* — не чіпаються'`;
  - `'видалення файла з маніфесту в тому самому проході'`;
  - `'змінений файл з маніфесту — відмова, решта плану виконується'` (поведінка 1б зберігається);
  - `'встановлене ядро 1.0.0-rc.1 → відмова «канон заморожено»'` (фікстура версії);
  - `'без --rebaseline → зупинка з підказкою про --rebaseline'`;
  - `'--rebaseline без --write → лише звіт, файли не змінено'`.
- [ ] **Step 2:** FAIL (RED у звіт).
- [ ] **Step 3:** Реалізація.
- [ ] **Step 4:** PASS. **Живий доказ** (у звіт, з командами й хвостами виводу): тимчасова тека магазину з `db/migrations` = файли тега `v0.15.0` (`git archive v0.15.0 packages/simplycms/migrations`) → підстановка поточного пакета ядра → `simplycms db:diff --write --rebaseline` → `simplycms db:apply` на ЧИСТІЙ БД стенда (окрема база в `simplycms-harness-pg`, видалити після) → зелений; журнал має `0000…0004`, `0005` у теці немає.
- [ ] **Step 5:** Носії: BREAKING у `CHANGELOG.md` `[Unreleased]` — крок `simplycms db:diff --write --rebaseline` + перестворити БД ЗАМІСТЬ ручного порядку (видалити `0000…0004`) з Task 1б; те саме в `skills/simplycms-update/references/migrations.md` і `docs/architecture/cli.md`. Ручний порядок прибрати звідусіль: `grep -rn "0000…0004\|0000...0004" CHANGELOG.md packages/simplycms/skills docs/architecture/cli.md` не має давати інструкції видаляти файли вручну.
- [ ] **Step 6:** БЛ. Мутація: `--rebaseline` замінює й власні файли з ім'ям `^\d{4}_` поза каноном → кейс «власні не чіпаються» червоний. Commit `feat(cli): db:diff --rebaseline — ребазлайн магазину одним проходом`.

### Task 3: Чисті модулі перекладів і адрес, мовні пакети (І12 чиста частина, І18, І19, І22)

**Files:**
- Create:
  - `packages/simplycms/src/domain/translations/{index.ts,status.ts,write-plan.ts}` + `__tests__/{status,write-plan}.test.ts`;
  - `packages/simplycms/src/translations/{index.ts,hash.ts}` + `__tests__/hash.test.ts`, `tests/domain-translations-client-safe.test.ts`;
  - `packages/simplycms/src/domain/slugs/{index.ts,reserved.ts,slugify.ts,allocate.ts,translit-uk.ts}` + `__tests__/{reserved,slugify,allocate,parity}.test.ts`;
  - `packages/simplycms/src/i18n/packs/{index.ts,uk.ts,en.ts}` + `__tests__/packs.test.ts`.
- Modify:
  - `packages/simplycms/src/i18n/{types.ts,translator.ts,I18nProvider.tsx,index.ts}` (відкритий `Locale`);
  - `themes/types.ts:141,167`, `plugin-sdk/usePluginT.ts`, `themes/useThemeT.ts`, `packages/simplycms-theme-solarstore/src/messages.ts`, `packages/simplycms-plugin-faq/src/messages.ts`, `packages/cli/template-{theme,plugin}/messages.ts` (тип ключа каталогу `string`).

**Interfaces:**
- Produces (`simplycms/domain/translations`):
  - `normalizeTextInput(v: string | null | undefined): string | null | undefined` — `undefined` = поле не надіслано; `''` і пробіли → `null`;
  - `type FieldStatus = 'current' | 'outdated' | 'missing'`;
  - `fieldStatus(target: string | null, recordedHash: string | undefined, currentSourceHash: string | null): FieldStatus` — хеші приходять готовими рядками: модуль чистий і без `node:crypto` (його імпортує й клієнт адмінки для бейджів);
  - `rowStatus(spec: TranslatableSpec, source: Row, target: Row | null): FieldStatus`;
  - `isTranslatedForSeo(spec, source, target): boolean` (майстер §3.4);
  - `interface TranslatableSpec { readonly fields: readonly string[]; readonly required: readonly string[]; readonly richHtml?: readonly string[] }`;
  - `planTranslationWrite(input: { spec; current: { source: Row | null; byLocale: ReadonlyMap<string, Row> }; primary: string; patch: ReadonlyMap<string, Partial<Record<string, string | null>>>; expectedSourceHashes?: ReadonlyMap<string, Record<string, string>>; hash: (text: string) => string }): { upserts: Array<{ locale: string; values: Record<string, string | null>; sourceHashes: Record<string, string> }>; sourceChanged: null | { locale: string; current: Record<string, string> } }` — чиста функція сценаріїв 1–3 (майстер §3.4). Функцію хешу інжектує сервер (`sourceFieldHash`), тести — детермінований фейк. Повертає ЛИШЕ надіслані мови: видалень немає за типом.
- Produces (`simplycms/translations`, server-only T2; тека створюється тут, Task 11 її доповнює):
  - `sourceFieldHash(text: string): string` — sha256 hex від `text.normalize('NFC').trim()` через `node:crypto`.
- Produces (`simplycms/domain/slugs`):
  - `RESERVED_SEGMENTS: readonly string[]`, `RESERVED_QUERY_KEYS: readonly string[]` (майстер §3.2);
  - `isReservedPath(segment: string, languageSegments: readonly string[], publicNames: readonly string[]): boolean`;
  - `isReservedPropertyToken(token, languageSegments): boolean` (сегменти + ключі query);
  - `slugify(text: string, pack: LanguagePackSlugify | null): string | null` — `null` для нелатинського письма без таблиці;
  - `allocateSlug(base: string, isTaken: (candidate: string) => boolean): string` — `base`, `base-2`, `base-3`…;
  - `SLUG_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/` (переїжджає з `domain/slug.ts:8`; старий модуль реекспортує до кінця М1).
- Produces (`simplycms/i18n`):
  - `type Locale = string`;
  - `interface LanguagePack { readonly code: string; readonly name: string; readonly catalog: Catalog; readonly slugify?: (text: string) => string; readonly tokenize?: never }` — місце під пошук порожнє;
  - `LANGUAGE_PACKS: ReadonlyMap<string, LanguagePack>` (`uk`, `en`), `getLanguagePack(code): LanguagePack | null`;
  - `createTranslator(locale: string, fallback: string)` — каталог мови, потім основна мова, потім ключ. Аргумент `fallback` обов'язковий, бо фолбек = основна мова магазину, а не `uk`;
  - `normalizeLocale` зноситься (споживачі в М1: `__root.tsx`, `head.ts` — переходять на мову запиту в Task 9; решта — М2; до Task 9 тимчасово `createTranslator(x, 'uk')` з `// М1-TEMP`).

- [ ] **Step 1: Тести `domain/translations`.**
  - `packages/simplycms/src/translations/__tests__/hash.test.ts`: `sourceFieldHash('Caf\u00e9')` = `sourceFieldHash('Cafe\u0301 ')` (у коді тесту — саме escape-послідовності: NFC і пробіл); результат — 64 hex.
  - `tests/domain-translations-client-safe.test.ts`: статичний розбір усіх файлів `domain/translations/**` і транзитивних імпортів — жодного `node:` і жодного server-only субшляху (перелік — `contracts/server-only`).
  - `status.test.ts`:
    - `fieldStatus(null, undefined, 'x') === 'missing'`;
    - `fieldStatus('y', 'h1', 'h1') === 'current'`;
    - `fieldStatus('y', 'h0', 'h1') === 'outdated'`;
    - `rowStatus` → `missing`, коли порожнє обов'язкове;
    - `isTranslatedForSeo` → `false`, коли в джерелі є `description`, а в мові немає (І33 б);
    - `true`, коли поле лише `outdated`.
  - `write-plan.test.ts`:
    - `'сценарій 1: лише джерело — інших мов у upserts немає'`;
    - `'сценарій 2: надіслане поле перекладу отримує хеш НОВОГО джерела, ненадіслане зберігає старий'`;
    - `'сценарій 3: розбіжний expected → sourceChanged з поточними хешами, upserts порожні'`;
    - `'null очищує необов\'язкове, для обов\'язкового — ValidationError'`;
    - `'відсутнє поле не змінюється'`;
    - `'мова поза patch не з\'являється в upserts'` (І11 на рівні плану);
    - `'ключі sourceHashes ⊆ spec.fields'` (І10).
- [ ] **Step 2: Тести `domain/slugs`.**
  - `reserved.test.ts` — `it.each(RESERVED_SEGMENTS)` кожен заборонений; плюс `'en'`, `'pt-br'` з `languageSegments`; плюс ім'я з `publicNames` (`favicon.ico`).
  - `slugify.test.ts`:
    - `uk` КМУ 2010: `'Згорани'` → `'zghorany'`, `'Щастя'` → `'shchastia'`, `'Юрій'` → `'yurii'`, `'Ярослав Ґуральник'` → `'yaroslav-guralnyk'`, `'Їжак'` → `'yizhak'`;
    - латиниця без таблиці: `'Łódź Straße'` → `'lodz-strasse'`, `'Æsir Œuvre'` → `'aesir-oeuvre'`;
    - нелатинське без таблиці: `slugify('東京', null) === null`;
    - пунктуація й повтори дефісів зводяться.
  - `allocate.test.ts`: `allocateSlug('a', t => ['a','a-2'].includes(t)) === 'a-3'`.
  - `parity.test.ts` (І22): адресний і токенний генератори — одна функція (`import { allocateSlug as a } from '…/allocate'` і реекспорт `simplycms/domain/slugs`; `expect(a).toBe(b)`), і на 20 фіксованих назвах результати однакові.
- [ ] **Step 3:** `pnpm vitest run packages/simplycms/src/domain/translations packages/simplycms/src/domain/slugs` → FAIL.
- [ ] **Step 4: Реалізація.**
  - `domain/translations` і `domain/slugs`.
  - Таблиця КМУ 2010 — власна в `translit-uk.ts`: особливі правила для початку слова (є, ї, й, ю, я → ye, yi, y, yu, ya) і `зг` → `zgh`.
  - Латиниця: `normalize('NFKD')` + зняття `\p{M}` + мала мапа `ł→l ø→o ß→ss æ→ae œ→oe đ→d þ→th`; після цього будь-який не-ASCII символ → `null`.
- [ ] **Step 5: Мовні пакети й відкритий `Locale`.** `packs/uk.ts` = `{ code:'uk', name:'Українська', catalog: catalogs.uk, slugify: (t) => transliterateUk(t) }`, `packs/en.ts` без `slugify`. `packs.test.ts`:
  - `getLanguagePack('pt') === null`;
  - `createTranslator('pt', 'uk')('common.save')` = український рядок;
  - `createTranslator('pt', 'en')('common.save')` = англійський рядок (фолбек = аргумент `fallback`, тобто основна мова магазину, а не `uk`);
  - ключ, відсутній і в мові, і у фолбеку, повертається як є.

  Наявний `catalog-integrity.test.ts` — без змін.
- [ ] **Step 6:** `pnpm vitest run packages/simplycms/src/domain packages/simplycms/src/i18n packages/simplycms/src/themes packages/simplycms/src/plugin-sdk` → PASS. `pnpm typecheck` → 0.
- [ ] **Step 7:** БЛ. Мутації:
  - сценарій 2 оновлює хеші ненадісланих полів → `write-plan` червоний;
  - `allocateSlug` повертає `base` без суфікса → `allocate` червоний;
  - прибрати `'assets'` із `RESERVED_SEGMENTS` → `reserved` червоний.

  Commit `feat(multilingual): domain/translations, domain/slugs, мовні пакети`.

### Task 4: Узагальнений тригер обов'язкового джерела (Р3)

**Files:**
- Modify: `packages/simplycms/migrations/0004_functions.sql`, `test-harness/pg/__tests__/functions-allowlist.test.ts`
- Create: `packages/simplycms/test-harness/pg/__tests__/source-translation-required.test.ts`, `packages/simplycms/test-harness/pg/__tests__/fixtures/translatable-probe.ts`

**Interfaces:**
- Produces (БД): `public.require_source_translation()` — функція constraint-тригера, однакова для бази й перекладів. `TG_ARGV`:
  - `[0]` — роль виклику (`'base'` | `'translation'`);
  - `[1]` — базова таблиця;
  - `[2]` — таблиця перекладів;
  - `[3]` — FK-колонка в перекладах;
  - `[4]` — обов'язкові колонки через кому;
  - `[5]` — необов'язкова умова на базовому рядку: ім'я колонки й значення через `=`, наприклад `value_kind=text`.

  Логіка:
  - визначає `entity_id` (`NEW.id` для бази, `OLD.<fk>`/`NEW.<fk>` для перекладу);
  - якщо базового рядка вже немає → `RETURN NULL` (каскад);
  - якщо умова `[5]` задана й не виконується → `RETURN NULL`;
  - інакше вимагає рядок `locale = (select code from languages where is_default)` з усіма обов'язковими колонками непорожніми — `nullif(btrim(col), '') IS NOT NULL` (К3: порожній рядок і пробіли — це «немає»; операція нормалізує першою, тригер — страховка для прямого SQL), інакше `check_violation` «<таблиця>: потрібен переклад основною мовою (<поля>)».

  Ідентифікатори — лише `format('%I')`, значення — лише параметрами `EXECUTE … USING`.
- Produces (харнес): `createTranslatableProbe(client, name)` — створює в транзакції тесту `probe_<name>(id uuid pk, kind text)` + `probe_<name>_translations(probe_id uuid references … on delete cascade, locale text references languages(code), name text, note text, primary key(probe_id, locale))` і вішає тригери (`CREATE CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.require_source_translation('base', …)` на `AFTER INSERT` бази; `('translation', …)` на `AFTER DELETE OR UPDATE OF <обов'язкові>, locale, <fk>` перекладів). Підключення робить ОДНА SQL-процедура `public.attach_source_translation_triggers(base regclass, translations regclass, fk text, required text[], condition text DEFAULT NULL)`: вона будує обидва `CREATE CONSTRAINT TRIGGER` з тих самих аргументів, тож перелік колонок `UPDATE OF` і `TG_ARGV[4]` не можуть розійтися. Її кличуть probe-хелпер, `0004_functions.sql` (Task 17) і в М2 плагінний хелпер.

- [ ] **Step 1: Тест** — для кожної ролі `app_user` і `app_admin` (`describe.each`), через харнес `actors`:
  - `'база без перекладу основною мовою — відмова на коміті'`;
  - `'база + рядок основної мови — коміт'`;
  - `'рядок лише іншої мови — відмова'`;
  - `'видалення рядка основної мови — відмова'`;
  - `'очищення обов\'язкового поля — відмова'`;
  - `'прямий SQL: name = \'\' і name = \'   \' у рядку основної мови — відмова'` (К3);
  - `'зміна locale рядка основної мови на en — відмова'`;
  - `'перенесення рядка основної мови на іншу сутність (зміна FK) — відмова для старої'`;
  - `'видалення бази каскадом — коміт'`;
  - `'видалити базу й вставити знову в тій самій транзакції без перекладу — відмова'`;
  - `'умова [5]: рядок з kind<>text не вимагає перекладу'`;
  - `'ідентифікатор із лапкою в TG_ARGV не ламає SQL'` — таблиця `"probe_q""x"`.

  Гранти на probe-таблиці видаються в тесті.
- [ ] **Step 2:** `pnpm test:schema source-translation-required` → FAIL.
- [ ] **Step 3: Функція** в `0004_functions.sql` після `require_default_shipping_zone`, ті самі конвенції (`language plpgsql`, `set search_path = public`, `revoke all on function … from public`). Якщо тест під `app_user` дає хибну відмову (RLS ховає основну мову чи батька на коміті) → `security definer` з тим самим `search_path`, і ЦЕ рішення записати коментарем із назвою тесту. Allowlist функцій оновити. `pnpm db:rebaseline` не потрібен (ручний файл), `pnpm template:sync`.
- [ ] **Step 4:** `pnpm test:schema source-translation-required functions-allowlist baseline` → PASS.
- [ ] **Step 5:** БЛ. Мутації:
  - (а) не вішати тригер на перекладах → `'видалення рядка основної мови'` червоний;
  - (б) прибрати гілку «бази немає» → `'видалення бази каскадом'` червоний;
  - (в) прибрати `format('%I')` на `[1]` (конкатенація) → тест із лапкою червоний;
  - (г) прибрати `locale` зі списку `UPDATE OF` у процедурі підключення → `'зміна locale'` червоний.

  Commit `feat(multilingual): узагальнений тригер обов'язкового рядка основної мови`.

### Task 5: Реєстри `url_paths` і `slug_tokens` (І15, І16 БД-частина, І18, І19, І21 БД-частина; Review Focus 2)

**Files:**
- Modify: `packages/simplycms/src/schema/schema.ts` (нові таблиці; `product_modifications` + `UNIQUE(product_id, id)`), `migrations/0002_grants.sql`, `test-harness/pg/__tests__/fixtures/grants.ts`
- Create:
  - `packages/simplycms/src/addressing/{index.ts,server.ts,paths.ts,tokens.ts,public-names.ts}` + `__tests__/public-names.test.ts`;
  - `packages/simplycms/test-harness/pg/__tests__/{url-paths.test.ts,slug-tokens.test.ts}`.

**Interfaces:**
- Produces (схема): `url_paths` і `slug_tokens` за майстром §3.1, включно з явними CHECK області й згенерованою `token_kind` у ключі унікальності (К2). У М1 у `url_paths` лише `product_id`, у `slug_tokens` лише `modification_id`. CHECK `num_nonnulls(...) = 1` пишеться з поточним набором колонок; М2 розширює його.
- Produces (БД, К4): `public.require_current_address()` — функція відкладеного constraint-тригера, конвенції як у Task 4, ідентифікатори лише через `format('%I')`.
  - Підключення: `public.attach_current_address_triggers(base regclass, registry regclass, fk text)`.
  - Тригер на реєстрі (`AFTER DELETE OR UPDATE OF is_current, path`) перевіряє лише (сутність, ТА мова). Першими кроками, як «батька немає → OK» у `require_source_translation`:
    - мови вже немає (каскад `languages.remove`) або вона не в `draft`/`published` → `RETURN NULL`;
    - сутності вже немає (каскад видалення товару) → `RETURN NULL`.

    Інакше має лишитись рівно одна поточна адреса. Вмикається в ЦІЙ задачі.
  - Тригер на `AFTER INSERT` бази перевіряє всі мови `draft`/`published` зі знімка своєї транзакції. Вмикається в Task 17 разом з І4: до Task 10 тести й сіди вставляють товари без адрес.
  - Вставка рядка мови тригер не запускає.
  - Дзеркально — `require_current_token()` і `public.attach_current_token_triggers(base regclass, registry regclass, fk text)` для `slug_tokens` (тригер бази — на `product_modifications`, теж у Task 17); перевірка поточного токена — в області `(token_kind, scope_id)`.
  - Гранти: `select` для `app_user`, `select, insert, update, delete` для `app_admin`.
  - RLS — як у таблиць каталогу: читання вітрини лише для мов у `published` пишеться в КОДІ (`is_active`-подібно), RLS не ускладнюємо.
- Produces (`simplycms/addressing`, серверне, всі функції в транзакції викликача `db: ActorDb`):
  - `type AddressTarget = { kind: 'product'; id: string }` (М2 розширює union);
  - `type TokenTarget = { kind: 'modification'; id: string; scopeId: string }`;
  - `createPathsForEntity(db, target, baseSlug: string, locales: readonly string[]): Promise<Map<string, string>>` — для кожної мови `allocateSlug` проти `url_paths` мови й `RESERVED_SEGMENTS`/`publicNames()`; спершу бере `advisoryXactLockShared(db, LOCK_KEYS.languagesSet)`;
  - `setExplicitPath(db, target, locale, path): Promise<void>`:
    - чужий поточний чи історичний → `AdminConflictError('path_taken')`;
    - власний історичний → він знову поточний, старий поточний → історія;
    - зарезервований → `ValidationError('path_reserved')`;
  - `copyPathsForLocale(db, locale, limit: number): Promise<number>` — пакетне ідемпотентне заповнення для нової мови: копія поточного шляху основної мови з `allocateSlug` при колізії. Повертає кількість вставлених рядків (0 = завершено);
  - `resolvePath(db, locale, path): Promise<{ target: AddressTarget; currentPath: string; isCurrent: boolean } | null>`;
  - `currentPaths(db, target): Promise<Map<string, string>>`;
  - `createTokensForEntity`, `setExplicitToken`, `copyTokensForLocale`, `resolveToken(db, locale, scopeId, slug)` — дзеркальні, у просторі `(locale, scope_id)`;
  - `publicNames(): readonly string[]` — верхньорівневі імена `public/` зі збірки: маніфест `dist/client/.simplycms-public.json` пише плагін `simplycms/vite`; без маніфесту (dev, тест) → `[]`. Маніфест генерує Task 5 Step 4.

- [ ] **Step 1: Тести БД і модуля.**
  - `url-paths.test.ts`:
    - `'UNIQUE(locale, path)'` (І15);
    - `'другий поточний для (товар, мова) — unique_violation'` (І16 ≤1);
    - `'num_nonnulls'`;
    - `'формат шляху: /, великі літери, кирилиця — check_violation'`;
    - `'видалення товару видаляє історію'`;
    - `'createPathsForEntity: однакова назва → -2, -3'`;
    - `'copyPathsForLocale: копія зайнята історією → суфікс; повторний виклик вставляє 0'` (Review Focus 2);
    - `'setExplicitPath на чужий історичний → path_taken'`;
    - `'setExplicitPath на власний історичний → він поточний, колишній — історія'` (І18 б);
    - `'зарезервований сегмент і код мови → path_reserved'` (І19);
    - `'resolvePath історичного повертає currentPath'`;
    - `'видалення поточної адреси без заміни — відмова на коміті; заміна в тій самій транзакції — коміт'` (К4, тригер реєстру);
    - `'видалення мови draft з адресами в кількох товарів (каскад) — коміт'`;
    - `'видалення товару з адресами (каскад) — коміт'`;
    - `'вимкнення мови (disabled) не чіпає її адрес і комітиться; видалення адреси disabled-мови — коміт'`;
    - те саме — у `slug-tokens.test.ts` для токенів.
  - `slug-tokens.test.ts` — те саме для `(locale, token_kind, scope_id)`:
    - однаковий slug у різних товарів дозволений;
    - складений FK відхиляє модифікацію чужого товару;
    - токен модифікації з `scope_id IS NULL` → `check_violation` (К2: `MATCH SIMPLE` такий рядок не перевіряє);
    - однаковий slug і `scope_id` у токена модифікації та токена опції не конфліктують (різний `token_kind`).
  - `public-names.test.ts`: читає маніфест із тимчасової теки; без файлу → `[]`.
- [ ] **Step 2:** `pnpm test:schema url-paths slug-tokens` → FAIL.
- [ ] **Step 3:** Схема → `pnpm db:rebaseline` → гранти й фікстура грантів → `pnpm template:sync`. Модуль `addressing` (≤150 рядків на файл). Нова тека — у тір-зони (T2, upward `db` → реальний шар уже T2; винятків немає), `exports`, `server-only`.
- [ ] **Step 4: Маніфест `public/`.** Плагін збірки в `packages/simplycms/src/vite/` дописує після `writeBundle` перелік `readdirSync(publicDir)` (лише верхній рівень) у `dist/client/.simplycms-public.json`. Юніт-тест плагіна поруч з наявними тестами `vite/`.
- [ ] **Step 5:** `pnpm test:schema url-paths slug-tokens grants-parity baseline` → PASS. `pnpm vitest run packages/simplycms/src/addressing packages/simplycms/src/vite` → PASS.
- [ ] **Step 6:** БЛ. Мутації:
  - прибрати `UNIQUE(locale, path)` → І15 червоний;
  - `allocateSlug` без суфікса → `'однакова назва'` червоний;
  - власний історичний → 409 → І18 б червоний;
  - прибрати перевірку `RESERVED_SEGMENTS` в `setExplicitPath` → І19 червоний;
  - прибрати CHECK `modification_id IS NULL OR scope_id IS NOT NULL` → кейс «без області» червоний (К2);
  - прибрати тригер реєстру → кейс «видалення поточної адреси без заміни» червоний (К4);
  - прибрати гілку «мови немає» → кейс «видалення мови draft з адресами» червоний;
  - прибрати гілку «сутності немає» → кейс «видалення товару з адресами» червоний.

  Commit `feat(multilingual): реєстри адрес і мовних токенів`.

### Task 5а: Поколіннєвий `createReadCache` і контекст запиту (Д6)

**Files:**
- Create:
  - `packages/simplycms/src/site/{request-context.ts,cache-generations.ts}` + `__tests__/request-context.test.ts`;
  - `packages/simplycms/test-harness/pg/__tests__/cache-generations.test.ts`.
- Modify:
  - `packages/simplycms/src/site/read-cache.ts`;
  - тести, що кличуть чи мокають `invalidate()`: `site/__tests__/read-cache.test.ts`, `storefront/loaders/__tests__/theme-record-cache.test.ts`, `admin-server/impl/__tests__/system-cache-invalidation.test.ts` — переводяться на покоління (кількість кейсів не зменшується);
  - `schema/schema.ts` (`cache_generations`), `migrations/0003_seed.sql` (три рядки), `0002_grants.sql` + `fixtures/grants.ts` (`select` — `app_user`, `app_admin`; `update` — `app_admin`), `seed-determinism.test.ts`;
  - `admin-server/impl/settings/save-profile.ts:104`, `admin-server/impl/site-themes/{activate.ts:63,save-settings.ts:61}` (замість `invalidate()` після COMMIT — `bumpCacheGeneration` у транзакції);
  - `storefront/loaders/{store-profile.ts,theme-record.ts}`;
  - host `src/server.ts` (лише обгортка `withRequestContext`); `pnpm template:sync`.

**Interfaces:**
- `CACHE_KEYS = { storeProfile: 'store-profile', activeTheme: 'active-theme', languages: 'languages' } as const`.
- `bumpCacheGeneration(db: ActorDb, key: CacheKey): Promise<void>` — `UPDATE cache_generations SET generation = generation + 1 WHERE key = $1`; 0 рядків → помилка (ключ не засіяно).
- `withRequestContext(fetch: (req: Request) => Promise<Response>): (req: Request) => Promise<Response>` — запускає обробку в `AsyncLocalStorage` з порожнім контекстом.
- `getRequestContext(): RequestContext | undefined`, де `RequestContext = { generations?: Promise<ReadonlyMap<string, bigint>>; storefront?: StorefrontRequestState }`. Поле `storefront` заповнює Task 9.
- `readGenerations(): Promise<ReadonlyMap<string, bigint>>`:
  - у контексті запиту — ОДИН `select key, generation from cache_generations` на запит, проміс мемоізується в контексті;
  - поза контекстом — запит на кожен виклик.
- `createReadCache<T>(key: CacheKey, opts?: { ttlMs?: number })`:
  - `get(load)` порівнює збережене покоління з `readGenerations()` і перечитує лише при зміні;
  - локальне покоління проти гонки «читання в польоті» (Е6б) лишається;
  - `invalidate()` зноситься — один механізм, процесної форми не лишається;
  - TTL опційний як верхня межа свіжості, а не механізм узгодження.
- `storeProfileCache`, `activeThemeCache` переходять на нові ключі. `languagesCache` додає Task 6.

- [ ] **Step 1: Тести.**
  - `cache-generations.test.ts` (`test:schema`), `it.each(['storeProfile','activeTheme'])` «дві репліки»:
    - два незалежні екземпляри кешу (окремі модулі через `vi.resetModules` або фабрика з ізольованим станом) → мутація споживача (збереження профілю / активація теми) через перший;
    - `get` другого повертає нове значення без очікування TTL;
    - без мутації `load` другого не викликається вдруге.

    `bumpCacheGeneration` для незасіяного ключа → помилка.
  - `request-context.test.ts`: у `withRequestContext` три кеші → рівно ОДИН запит поколінь (лічильник викликів фейкового `db`); поза контекстом — по запиту на `get`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Реалізація; `pnpm db:rebaseline`; гранти; сід; `template:sync`. Host `src/server.ts` лише кличе `withRequestContext` з ядра — жодної логіки в host-файлі. Зміна має потрапити в усі три копії (`src/server.ts`, `packages/cli/host/src/server.ts`, `packages/create-simplycms-store/template/src/server.ts`): `pnpm vitest run tests/create-store-template-parity.test.ts` → PASS.
- [ ] **Step 4:** PASS; `pnpm vitest run packages/simplycms/src/site packages/simplycms/src/storefront packages/simplycms/src/admin-server` → PASS; `pnpm live:smoke` (профіль і тема) → PASS.
- [ ] **Step 5:** БЛ. Мутації:
  - (а) `activate.ts` не збільшує покоління → кейс `activeTheme` червоний;
  - (б) `save-profile.ts` не збільшує → кейс `storeProfile` червоний;
  - (в) без мемоізації в контексті → `request-context` (три запити) червоний.

  Commit `feat(multilingual): поколіннєвий кеш читання й контекст запиту`.

### Task 6: Реєстр операцій і виконавець; операції мов (І14 порядок, І16 повнота, І24 база; Review Focus 1)

**Files:**
- Create:
  - `packages/simplycms/src/operations/{index.ts,define.ts,registry.ts,errors.ts,execute.ts,server-fn.ts}` + `__tests__/{execute,check-order}.test.ts`;
  - `packages/simplycms/src/admin-server/impl/languages/{operations.ts,fill.ts,completeness.ts}`;
  - `packages/simplycms/test-harness/pg/__tests__/{languages-operations.test.ts,languages-add-concurrency.test.ts}`.
- Modify:
  - `packages/simplycms/src/auth/{authz.ts,authz-request.ts}` (scopes, `subjectFromCookie`);
  - `src/admin-server/impl/errors.ts` (доменні помилки без HTTP);
  - `src/admin-server/index.ts` (обгортки мов);
  - `src/site/read-cache.ts` (+ `languagesCache` на механізмі Task 5а);
  - `src/contracts/domain-errors.ts` (імена нових помилок для `domainErrorAdapter`).

**Interfaces:**
- Produces (`simplycms/operations`):
  ```ts
  export interface OperationDef<I, O> {
    readonly id: string;                       // майстер §3.3, формат id
    readonly permission: Operation;            // ключ AUTHZ_MATRIX
    readonly input: z.ZodType<I>;
    readonly output: z.ZodType<O>;             // дротова форма (дати — z.iso.datetime())
    readonly idempotent?: 'create';
    readonly transport?: 'json' | 'multipart';
    readonly versioned?: true;                 // відповідь несе version → ETag
    readonly sessionOnly?: true;               // лише cookie-сесія, Bearer → 403 (Task 7)
    run(ctx: OperationContext, input: I): Promise<O>;
  }
  export interface OperationContext {
    readonly subject: AuthzSubject;
    readonly actor: CoreActor;
    readonly db: ActorDb;                      // транзакція виконавця
  }
  export function defineOperation<I, O>(def: OperationDef<I, O>): OperationDef<I, O>;
  export type ExecuteResult<O> = { readonly replayed: false; readonly output: O }
    | { readonly replayed: true; readonly status: number; readonly body: unknown };
  export function executeOperation<I, O>(def: OperationDef<I, O>, raw: unknown, subject: AuthzSubject,
    opts?: { idempotency?: IdempotencyRequest }): Promise<ExecuteResult<O>>;
  export interface IdempotencyRequest { readonly subjectKey: string; readonly key: string; readonly fingerprint: Buffer }
  export const CORE_OPERATIONS: readonly OperationDef<unknown, unknown>[];
  export function getOperation(id: string): OperationDef<unknown, unknown> | undefined;
  ```
  - `executeOperation`:
    1. `requireOperation(subject, def.permission, def.id)` → `AuthzError`;
    2. `def.input.safeParse` → `ValidationError` з `issues` (`path`, `code`);
    3. `withActor({ role: dbRoleForSubject(subject), userId }, db => def.run(…))` + `toAdminConflict`.
  - Статусів НЕ ставить. `opts.idempotency` у Task 6 лише проходить у сигнатурі; механіку реалізує Task 7 (`operations/http/idempotency.ts`). Виконавець кличе її першою дією ВСЕРЕДИНІ транзакції: вона або повертає збережену відповідь (`replayed: true`), або дає виконати `run` і зберегти відповідь 2xx у тій самій транзакції.
- Produces (`simplycms/operations/server`): `invokeFromServerFn<I, O>(def: OperationDef<I, O>, data: unknown): Promise<O>` — `subjectFromCookie()` → `executeOperation` → у catch `setResponseStatus` за картою помилок: 403 / 400 / 409 / 412. Обгортка serverFn має рівно форму:
  ```ts
  export const addLanguage = createServerFn({ method: 'POST' })
    .validator(passThrough).handler(({ data }) => invokeFromServerFn(languagesAdd, data));
  ```
  `passThrough` — валідатор-ідентичність з `simplycms/operations/server`: валідує виконавець, а `adminInput` тут не потрібен.
- Produces (`simplycms/auth`):
  - `AuthzSubject` + `readonly scopes?: readonly string[]`, `readonly tokenId?: string`;
  - `requireOperation(subject, operation, operationId?)` — якщо `scopes` задано й `operationId ∉ scopes` → `AuthzError`;
  - `subjectFromCookie(): Promise<AuthzSubject>` (чисте винесення з `resolveRequestGrant`).
- Produces (помилки, `simplycms/admin-server/impl` → `errors.ts`, імена в `contracts/domain-errors`):
  - `VersionMismatchError(currentVersion: number)`;
  - `SourceChangedError(locale: string, current: Record<string,string>)`;
  - `ReferenceError` → ім'я класу `InUseError(kind: 'language_in_use' | 'reference')`.
- Produces (операції мов, `admin-server/impl/languages/operations.ts`, усі `permission: 'settings.manage'`):
  - `languages.list` → `{ code, name, status, isDefault, sortOrder, hasPack }[]`;
  - `languages.add` `{ id, code, name }` → створює `draft`;
  - `languages.setStatus` `{ code, status }` за таблицею майстра §3.5. `draft|disabled → published` вимагає `completeness(code).complete`, інакше `ValidationError('language_incomplete')`;
  - `languages.fill` `{ code, batch? }` → `{ inserted, done }` — пакетне заповнення: адреси, токени, а з Task 14 — ще й проєкція;
  - `languages.reorder` `{ codes: string[] }`;
  - `languages.remove` `{ code }` → БУДЬ-ЯКЕ `foreign_key_violation`, що посилається на `languages` (переклади зараз, з М2 — `orders`, `profiles`, `product_reviews`), → `InUseError('language_in_use')` (К1). Мапінг ЛОКАЛЬНИЙ: `languages.remove` сам ловить `23503` навколо СВОГО `DELETE FROM languages`. В операції видалення мови інших FK-відмов бути не може, тож будь-який `23503` тут означає «мова використовується». Без глобального правила в `toAdminConflict`, без розбору повідомлення й переліку таблиць. 🔴 Postgres заповнює `TABLE NAME` таблицею, ЩО ПОСИЛАЄТЬСЯ (`product_translations`), а не `languages` — доведено архітектором живим прогоном на PG 17. Тому мапінг за `error.table` не спрацював би ніколи.

  Кожна мутація мов у своїй транзакції кличе `bumpCacheGeneration(db, CACHE_KEYS.languages)` (Task 5а). Кейс `languages` додається в `it.each` тесту «дві репліки» Task 5а. `completeness(db, code): Promise<{ complete: boolean; missingPaths: number; missingTokens: number; missingProjection: number }>` (`missingProjection` = 0, доки Task 14 не додасть проєкцію).

- [ ] **Step 1: Юніти виконавця.**
  - `execute.test.ts` (фейкова операція, мок `withActor`):
    - `'невалідний вхід → ValidationError з path/code, без сирого значення'`;
    - `'роль без права → AuthzError'`;
    - `'scopes без id операції → AuthzError'`;
    - `'scopes з id → виконано'`;
    - `'статус відповіді виконавець не ставить'` — `setResponseStatus` не викликано.
  - `check-order.test.ts` (І14): вхід одночасно без права й невалідний → `AuthzError`; валідний із неспівпалою версією та хешем → `VersionMismatchError` (пріоритет над `SourceChangedError`) — на фейковій команді, що рахує обидві умови через спільний хелпер `assertVersionThenHash(current, expectedVersion, hashCheck)` з `operations/define.ts`.
- [ ] **Step 2: Інтеграційні тести мов** (`test:schema`):
  - `languages-operations.test.ts`:
    - `'add → draft, fill створює адреси для всіх товарів'` — фікстура 3 товари з `url_paths` основної мови;
    - `'published без повноти → language_incomplete'`;
    - `'після fill до done → published'`;
    - `'disabled → published дозаповнює адреси товарів, створених поки мова disabled'`;
    - `'remove мови без перекладів — ок, адреси каскадом'`;
    - `'переклад товару мовою L → remove L → 409 language_in_use'` (К1; у М2 те саме із замовленням);
    - `'remove draft-мови з адресами й токенами товарів → коміт'` — тригери К4 не блокують каскад;
    - `'remove основної → помилка тригера'`.
  - `languages-add-concurrency.test.ts` (Review Focus 1):
    - транзакція A створює адресу товару під спільним замком і тримається;
    - транзакція B `languages.add` чекає на ексклюзивний замок;
    - A комітить, B комітить, `fill` до `done` → у товару є адреса в новій мові.
    - Друга гілка: створення товару ПІСЛЯ коміту мови дає адресу в `draft`-мові одразу.
- [ ] **Step 3:** `pnpm vitest run packages/simplycms/src/operations` і `pnpm test:schema languages-operations languages-add-concurrency` → FAIL.
- [ ] **Step 4: Реалізація.**
  - `operations/*`, винесення суб'єкта з `authz-request.ts` (старий `requireGrant` лишається для legacy `runAdmin`, Д4);
  - операції мов; `fill.ts` пакетами по 500 через `copyPathsForLocale`/`copyTokensForLocale`;
  - ексклюзивний `advisoryXactLock(db, LOCK_KEYS.languagesSet)` у `languages.add` і в `setStatus(disabled → published)`;
  - обгортки в `admin-server/index.ts`: `listLanguages`, `addLanguage`, `setLanguageStatus`, `fillLanguage`, `reorderLanguages`, `removeLanguage`.
- [ ] **Step 5:** тести Step 1–2 → PASS; `pnpm vitest run packages/simplycms/src/auth packages/simplycms/src/admin-server` → PASS (legacy-контракт `runAdmin` не змінився).
- [ ] **Step 6:** БЛ. Мутації:
  - (а) у `languages.add` не брати ексклюзивний замок → concurrency-тест червоний;
  - (б) `setStatus` без перевірки повноти → `'published без повноти'` червоний;
  - (в) ігнорувати `scopes` → `execute` червоний (І27 частина);
  - (г) поміняти порядок у `assertVersionThenHash` → `check-order` червоний;
  - (д) `languages.add` не збільшує покоління → кейс `languages` тесту «дві репліки» червоний;
  - (е) мапити за `error.table = 'languages'` → кейс `language_in_use` дає 500 → червоний.

  Commit `feat(multilingual): реєстр операцій, явний суб'єкт, операції мов`.

### Task 7: HTTP-адаптер `/api/v1`, токени, ідемпотентність, OpenAPI (І27–І29; Review Focus 3)

**Files:**
- Modify: `packages/simplycms/src/schema/schema.ts` (`api_tokens`, `idempotency_keys`), `migrations/0002_grants.sql`, `fixtures/grants.ts`, `src/auth/authz.ts` (`'apiToken.manage'`)
- Create:
  - `packages/simplycms/routes/storefront/api/v1/$op.tsx`, `packages/simplycms/routes/storefront/api/v1/openapi[.]json.tsx` (точне ім'я файлу для крапки — за правилом file-based route у `routes.ts`; перевірити на `build`);
  - `packages/simplycms/src/operations/http/{handle.ts,problem.ts,token-auth.ts,idempotency.ts,openapi.ts,wire.ts}` + `__tests__/{http-problem,http-auth,openapi-snapshot,wire}.test.ts`;
  - `packages/simplycms/src/admin-server/impl/api-tokens/operations.ts`;
  - `packages/simplycms/api/openapi.core.json`, `scripts/api-snapshot.mjs` (`pnpm api:snapshot`);
  - `packages/simplycms/test-harness/pg/__tests__/{api-tokens.test.ts,idempotency.test.ts}`.

**Interfaces:**
- Produces:
  - `handleApiRequest(request: Request, op: string): Promise<Response>` (`simplycms/operations/server`), конверт майстра §3.3;
  - `subjectFromToken(authorization: string): Promise<AuthzSubject | 'invalid'>` — sha256 від усього рядка токена → пошук за `token_hash`; `revoked_at`/`expires_at` → `'invalid'`; ролі — з `user_roles` (як `readSessionSubject`); `scopes`, `tokenId`; тротлінг `last_used_at`. Час відповіді невдалої автентифікації не залежить від того, знайдено префікс чи ні: пошук лише за повним хешем, без пошуку за префіксом;
  - `toProblem(error: unknown, operation: string): { status: number; body: ProblemBody }` — 500 без `message`;
  - `reserveIdempotencyKey(db, req: IdempotencyRequest & { operation: string }): Promise<{ kind: 'fresh' } | { kind: 'replay'; status: number; body: unknown } | { kind: 'mismatch' }>`:
    - `INSERT … ON CONFLICT DO NOTHING RETURNING` — НЕ ловити `unique_violation`: Postgres абортує транзакцію після помилки;
    - конкурент чекає на незакомічений рядок першої транзакції;
    - 0 рядків → SELECT збереженого: інший відбиток → `mismatch` (422), інакше `replay`;
    - перша транзакція відкотилась → вставка проходить, `fresh`;
    - перевищення `lock_timeout` → 409 `idempotency_in_flight`;
  - `storeIdempotentResponse(db, req, status, body)` — `UPDATE` того самого рядка перед комітом, лише 2xx. Не-2xx відкочує транзакцію разом із рядком ключа;
  - прибирання протухлих — порцією 100 у тій самій транзакції;
  - операції токенів (`permission: 'apiToken.manage'`):
    - `apiTokens.create { id, userId, name, scopes, expiresAt? }` → `{ token }` — ОДИН раз. `userId` дозволено лише двох видів: власний (`subject.userId`) або сервісного облікового запису (користувач без рядка `accounts`). Інакше `AuthzError` — адмін не випускає токен від імені іншої людини, і атрибуція дій не фальсифікується;
    - `apiTokens.revoke { id }`;
    - `apiTokens.list` → без хешів;
    - `serviceAccounts.create { id, name, role }` — користувач без рядка `accounts`;
    - 🔴 усі `apiTokens.*` і `serviceAccounts.*` позначені `sessionOnly: true` і виконуються ЛИШЕ з cookie-сесії. Bearer → 403 `forbidden`, навіть якщо scope дозволяє: витеклий токен не може сам себе розмножити. Поле `sessionOnly?: true` додається в `OperationDef` (Task 6), а `handleApiRequest` перевіряє його до виконання;
  - `buildOpenApi(ops: readonly OperationDef[]): OpenApiDocument` — `z.toJSONSchema(def.input, { target: 'draft-2020-12', io: 'input' })`, вихід — `io: 'output'`, Date-поля в схемах заборонені (дротова форма), `$schema` вкладених прибрано, `openapi: '3.1.0'`.
- CSRF. Факт: `runtime/csrf.ts:22` `shouldValidateCsrf(method, pathname)` перевіряє ВСІ не-безпечні запити, крім `/api/auth/`, і стоїть першим у `requestMiddleware` (`src/start.ts:118`). Bearer-запит без `Origin` впав би з 403 ще до адаптера. Тому:
  - сигнатура стає `shouldValidateCsrf(method, pathname, headers: Headers)`: для `pathname.startsWith('/api/v1/')` з `Authorization: Bearer …` перевірки немає; cookie-запит на `/api/v1/` перевіряється, як і досі;
  - адаптер за наявності заголовка `Authorization` НІКОЛИ не падає назад на cookie-сесію: невалідний Bearer → 401, навіть якщо cookie валідний;
  - тест `runtime/__tests__/csrf.test.ts`: Bearer без Origin → не перевіряється; cookie без Origin → 403; `Authorization: Basic` → перевіряється. Мутація: виняток за префіксом без перевірки Bearer → кейс «cookie без Origin на /api/v1» червоний.
  - `runtime/csrf.ts` — у Files задачі.

- [ ] **Step 1: Юніти.**
  - `http-problem.test.ts` (І29): `toProblem(new Error('pg: relation x'))` → `{status:500, body:{kind:'internal'}}` і `JSON.stringify(body)` не містить `relation`; кожен `kind` майстра → свій статус (`it.each`); 405 → `method_not_allowed` з `Allow`.
  - `wire.test.ts`: вихід з `Date` серіалізується ISO; вхід з ISO-рядком → `Date` у `run`.
  - `openapi-snapshot.test.ts`: `buildOpenApi(CORE_OPERATIONS)` deep-equal `api/openapi.core.json`; документ валідний 3.1 за структурою (`openapi`, `paths['/api/v1/languages.add'].post`).
  - `http-auth.test.ts` (з моками): без заголовка й без cookie → 401; відкликаний → 401; scopes без операції → 403; cookie без `Origin` → 403; невалідний Bearer разом із валідним cookie → 401 (адаптер не падає назад на сесію).
- [ ] **Step 2: Інтеграційні.**
  - `api-tokens.test.ts` (І27):
    - у БД лише хеш (`select token_hash` ≠ токен, 32 байти);
    - `last_used_at` не оновлюється двічі за хвилину;
    - прострочений → `'invalid'`;
    - права = роль ∩ scopes: токен адміна зі scopes `['languages.list']` на `languages.add` → 403;
    - сервісний обліковий запис не має рядка в `accounts`;
    - дія атрибутується суб'єкту токена (`changed_by`/`userId` у GUC = `user_id` токена);
    - `apiTokens.create` від адміна з `userId` іншого адміна-людини → 403; з власним `userId` і з `userId` сервісного запису → ок;
    - Bearer-токен зі scope `apiTokens.create` на `POST /api/v1/apiTokens.create` → 403 (session-only).
  - `idempotency.test.ts` (І28, Review Focus 3) через `handleApiRequest` на `languages.add`:
    - повтор → той самий статус і тіло, мова одна;
    - інший відбиток → 422;
    - два паралельні запити з одним ключем → обидва 200 з однаковим тілом, мова одна;
    - другий токен того самого користувача з тим самим ключем → окрема область (у `languages.add` другий запит отримує `conflict`, бо мова вже є, і цей 409 НЕ зберігається);
    - перший запит 400 → виправлене тіло з тим самим ключем виконується;
    - рядок старший за 24 год ігнорується й прибирається;
    - placeholder не комітиться: після успішної команди повтор отримує справжнє тіло, а не placeholder (К5);
    - перша транзакція утримана (не комітиться) → дубль чекає й за `IDEMPOTENCY_LOCK_TIMEOUT_MS` (константа поруч із механізмом) отримує 409 `idempotency_in_flight`.
- [ ] **Step 3:** FAIL обох наборів.
- [ ] **Step 4: Реалізація.**
  - Роут `$op.tsx`: `server.handlers` `POST` → `handleApiRequest`, `ANY` → 405 problem (урок `start-route-handlers-methods`: метод без хендлера йде в SSR);
  - `openapi.json` — `GET` лише автентифікованому;
  - `pnpm api:snapshot`;
  - нові таблиці → `pnpm db:rebaseline` → гранти → `template:sync`.
- [ ] **Step 5:** PASS. `pnpm build` (роути змонтовано, Gate C — серверний код роуту зникає з клієнта: `pnpm test:packaging` у БЛ).
- [ ] **Step 6:** БЛ. Мутації:
  - (а) `subject_key` = користувач для Bearer → тест другого токена червоний;
  - (б) зберігати 4xx → тест «після 400» червоний;
  - (в) віддати `error.message` у 500 → `http-problem` червоний;
  - (г) ігнорувати `revoked_at` → `api-tokens` червоний;
  - (д) прибрати перевірку `userId` у `apiTokens.create` → кейс «від імені іншого адміна» червоний;
  - (е) прибрати перевірку `sessionOnly` → кейс Bearer на `apiTokens.create` червоний;
  - (є) пропустити `storeIdempotentResponse` → кейс «повтор отримує справжнє тіло» червоний;
  - (ж) прибрати `SET LOCAL lock_timeout` → кейс утриманої транзакції висне (таймаут тесту) → червоний;
  - (з) адаптер падає назад на cookie за невалідного Bearer → кейс «невалідний Bearer + валідний cookie → 401» червоний.

  Commit `feat(multilingual): HTTP-адаптер /api/v1, токени, ідемпотентність, OpenAPI`.

### Task 8: Лінт тонких serverFn і тест паритету (І24, І25)

**Files:**
- Create: `eslint-rules/thin-server-fn.mjs`, `eslint-rules/no-core-outside-operation.mjs`, `eslint-rules/legacy-admin-server-fns.json`, `tests/eslint-rules/{thin-server-fn,no-core-outside-operation}.test.ts`, `packages/simplycms/src/operations/__tests__/registry-parity.test.ts`
- Modify: `eslint.config.mjs` (плагін `simplycms-ops`, зона `packages/simplycms/src/admin-server/index.ts`, `plugin-sdk/server/index.ts`, `plugins/server/index.ts`, `themes/server/index.ts`)

**Interfaces:**
- `simplycms-ops/thin-server-fn`: у зоні кожен `createServerFn(...)` ланцюжок закінчується `.handler(<ідентифікатор>)` або `.handler(({ data }) => invokeFromServerFn(<ідентифікатор операції>, data))`. Будь-яке інше тіло — помилка.
  - Виняток — імена з `legacy-admin-server-fns.json`: мапа `файл → імена експортованих констант`, знята на старті задачі з УСІХ чотирьох файлів зони (`admin-server/index.ts` — 125, `plugin-sdk/server/index.ts` — 6 з inline-тілами, `plugins/server/index.ts` — 3, `themes/server/index.ts` — 2; разом 136, мінус перенесені Task 6/7).
  - Форма `.handler(<ідентифікатор>)` дозволена ЛИШЕ legacy-іменам. Нова обгортка — тільки `.handler(({ data }) => invokeFromServerFn(<операція>, data))`, інакше обхід І25 проходив би лінт.
  - Правило також падає, якщо ім'я з legacy-переліку більше не існує: перелік лише скорочується.
- `simplycms-ops/no-core-outside-operation`: виклик `withActor(`, `runAdmin(`, `runAdminTransactions(` або ідентифікатора `/In$/`, імпортованого з `simplycms/admin-server/impl`, заборонено в `routes/**`, `src/admin/**`, `src/storefront-routes/server/**` і в зоні serverFn поза legacy-переліком. Дозволено всередині `run` операції (файли `**/operations.ts`, `**/operations/**`).
- Паритет (І24): для кожного `def` з `CORE_OPERATIONS`:
  - (а) в `admin-server/index.ts` є рівно одна обгортка, що передає саме його в `invokeFromServerFn` — статичний розбір файлу, як в `admin-validators-wrapped.test.ts`;
  - (б) `handleApiRequest(new Request(…), def.id)` з токеном адміна не повертає 404 `unknown_operation`.

  І навпаки: кожна обгортка з `invokeFromServerFn` посилається на операцію з реєстру.

- [ ] **Step 1: Тести правил** — `it.each` легальних і заборонених:
  - тіло з `await db…`;
  - `handler(async () => runAdmin(...))`;
  - `handler(({data}) => invokeFromServerFn(x, transform(data)))`;
  - ім'я поза legacy-переліком;
  - зникле ім'я в переліку.

  Тест паритету: на `CORE_OPERATIONS`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Правила + підключення під власним іменем плагіна (урок flat config). `pnpm lint` → 0 errors / 7 warnings.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** БЛ. Мутації:
  - (а) у `addLanguage` додати логіку в тіло → `pnpm lint` червоний;
  - (б) прибрати обгортку `removeLanguage` → паритет червоний;
  - (в) додати операцію в `CORE_OPERATIONS` без обгортки → паритет червоний.

  Commit `feat(multilingual): лінт тонких serverFn і паритет реєстру`.

### Task 9: Мовний контекст запиту вітрини (І30, І36, І37 — `<html lang>`/`dir`/`x-default`)

**Files:**
- Create:
  - `packages/simplycms/src/storefront-routes/locale/{resolve.ts,rewrite.ts,normalize.ts,script.ts}` + `__tests__/{request-locale,rewrite,path-normalize-language}.test.ts`;
  - `packages/simplycms/src/storefront-routes/__tests__/lang-attrs.test.tsx`;
  - `packages/simplycms/src/contracts/__tests__/locale-keys.test.ts`, `packages/simplycms/src/site/__tests__/read-cache-locale.test.ts`;
  - `eslint`-селектор заборони `accept-language` у зоні вітрини (у наявному блоці `no-restricted-syntax` зони вітрини).
- Modify:
  - `src/router.tsx`, `src/routes/__root.tsx`, `src/server.ts` (лише виклик ядра), `simplycms.config.ts` (без змін локалі до М2);
  - `packages/simplycms/src/storefront-routes/head/head.ts` (`StorefrontRootData.locale` + `languages`), `storefront-routes/server/root.ts`;
  - `site/read-cache.ts` (мапа за ключем);
  - `contracts/entities.ts` (сегмент локалі в ключах вітрини);
  - `storefront-routes/seo/interceptor.ts` (нормалізація до роутера).
- Sync: `pnpm template:sync` (host `__root.tsx`, `router.tsx`, `server.ts`).

**Interfaces:**
- `resolveRequestLocale(originalPathname: string, set: LocaleSet): { locale: string; prefixed: boolean; rest: string }`, де `LocaleSet = { primary: string; published: readonly string[]; known: readonly string[] }`.
  - Перший сегмент = `lower(code)` опублікованої не-основної мови → ця мова;
  - сегмент основної → `{ locale: primary, prefixed: true }` (інтерсептор дасть 301);
  - сегмент відомої, але не опублікованої мови → `{ locale: <code>, … }` і 404 вирішує інтерсептор;
  - інакше — основна.

  ОДНЕ джерело для SSR, клієнта й інтерсептора (умова архітектора 2).
- `createLocaleRewrite(set: LocaleSet, state: { current: string }): LocationRewrite`:
  - `input` знімає префікс лише для вітринних шляхів і пише `state.current`;
  - `output` додає префікс поточної не-основної мови;
  - обидва пропускають шляхи з префіксами `/admin`, `/api`, `/_serverFn`, `/assets`, `/media` без змін (умова архітектора 3).
- `normalizeStorefrontRequest(url: URL, set: LocaleSet): Response | null` — `simplycms/storefront-routes/seo/normalize` (server-only, умова архітектора 1):
  - `/<основна>/x` → 301 `/x`;
  - префікс не опублікованої мови → 404;
  - query зберігається.

  Нормалізацію історії адрес і `?mod=` додасть Task 15 у ЦЮ Ж функцію, щоб редирект лишався одним.
- Результат інтерсептора (набір мов і, з Task 15, резолв адреси) кладеться в per-request контекст ядра з Task 5а (`simplycms/site/request-context`, поле `storefront`). На сервері його читають `getRouter()` (через `createIsomorphicFn`, перевірити API на context7) і лоадер `$`-роуту. Так адреса резолвиться ОДИН раз на запит. Клієнтська навігація резолвить через serverFn. Якщо Start не пропускає ALS-контекст до лоадера без обходу, це записується як прийнятий компроміс (два запити) з виміром у М5.
- `src/server.ts` лише вставляє її в ланцюг перед Start-хендлером (`withStorefrontNormalize(normalize, …)`, поруч із `withSeoInterceptor`).
- Root: лоадер повертає `{ …, locale, languages: { primary, published } }`; `<html lang={locale} dir={dirOf(locale)}>`, де `dirOf = (c) => new Intl.Locale(c).getTextInfo?.().direction ?? 'ltr'`; `<I18nProvider locale={locale} fallback={primary}>`. Модульна константа `locale` у `__root.tsx` зноситься разом із модульним `t` (`__root.tsx:51`): `NotFound` і `errorComponent` рендеряться поза провайдером і отримують `createTranslator(resolveRequestLocale(...).locale, primary)` від вихідного pathname (на клієнті — `window.location.pathname` і `__SCMS_LOCALES__`). Тест у `lang-attrs.test.tsx`: 404 на `/en/x` має англійський текст.
- Кеші: `createReadCache` (Task 5а) отримує варіант `get(load, { variant: locale })` — окремий запис на мову під тим самим поколінням ключа; зміна покоління скидає всі варіанти; ключі вітрини `entityKey`/`aggregateKey` отримують сегмент локалі — `locale` додається ПЕРШИМ після сегмента сутності: `[entity, locale, …]`. Реєстр сегмента 0 не змінюється.
- Клієнт: `window.__SCMS_LOCALES__` (Д2), `getRouter()` читає його (на сервері — з `languagesCache`) і передає в `createLocaleRewrite`.
- **Факти дорозвідки** (router-core 1.171.34, start-server-core 1.169.39; перевірити на lockfile на старті задачі):
  - Канонізація роутера (`load-server.js:539-554`) працює лише в SSR-`load`. Вона порівнює весь `publicHref` (шлях + нормалізований query + hash) і кидає 307. Опції, яка її вимикає чи міняє статус, у цій версії НЕМАЄ.
  - `trailingSlash` за замовчуванням `'never'`: `/x/` → 307 `/x`.
  - Обгортка в `src/server.ts` отримує запит РАНІШЕ за Start (`getNormalizedURL`, request-middleware, server routes, `load`).
  - Тому `normalizeStorefrontRequest` сам дає 301 і на завершальний слеш (`/x/` → `/x`, крім кореня), а роутерна канонізація лишається страховкою. Щоб не було циклу, інтерсептор віддає рівно той шлях, який роутер вважає канонічним (без слеша), і `output` rewrite слеша не додає й не знімає. Тест: `'/en/x/ → один 301 на /en/x'`.

- [ ] **Step 1: Тести.**
  - `request-locale.test.ts`:
    - `/en/x` → `en`; `/x` → основна; `/uk/x` при основній `uk` → `prefixed: true`;
    - `/EN/x` → не мова (регістр сегмента — лише малий);
    - `/catalog` → основна;
    - Accept-Language не впливає — функція його не приймає за типом; лінт-тест на заборону читання заголовка в зоні вітрини (І30).
  - `rewrite.test.ts`:
    - `input('/en/cart')` → `/cart`, `state.current='en'`;
    - `output('/cart')` при `current='en'` → `/en/cart`;
    - `/admin/x`, `/api/v1/a.b`, `/_serverFn/x`, `/assets/a.js`, `/media/a.png` незмінні в обидва боки;
    - `output∘input` тотожне на 10 канонічних URL.
  - `path-normalize-language.test.ts`: `/uk/x?utm_source=a` → 301 `/x?utm_source=a`; `/pl/x` при `pl` у `draft` → 404; `/en/x` → `null` (пропуск).
  - `lang-attrs.test.tsx` (І37): SSR root на `/en/x` → `<html lang="en" dir="ltr">`; на `/x` → основна.
  - `locale-keys.test.ts` (І36): ключі `['products', 'en', …]` ≠ `['products', 'uk', …]` для того самого id; SSR-ключ і ключ після гідрації на `/en/x` збігаються (умова 2: одна функція).
  - `read-cache-locale.test.ts`: `get(load, { variant: 'en' })` і `get(load, { variant: 'uk' })` — два виклики `load`; збільшення покоління скидає обидва.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Реалізація.** Локальні споживачі `normalizeLocale` (`__root.tsx`, `head.ts`) — на мову запиту; `// М1-TEMP` з Task 3 у них прибрати. Решта споживачів `getStoreLocale` (листи) — М2, без змін.
- [ ] **Step 4:** тести → PASS; `pnpm vitest run packages/simplycms/src/storefront-routes packages/simplycms/src/contracts packages/simplycms/src/site` → PASS; `pnpm build && pnpm typecheck`.
- [ ] **Step 5:** `pnpm live:smoke` (корінь вітрини змінився) → PASS.
- [ ] **Step 6:** БЛ. Мутації:
  - (а) `input` знімає префікс і з `/api` → `rewrite` червоний;
  - (б) ключ кешу без локалі → `locale-keys` червоний;
  - (в) `resolveRequestLocale` читає `Accept-Language` (параметр) → тип і лінт-тест червоні.

  Commit `feat(multilingual): мовний контекст запиту вітрини`.

**Приймання хвилі Ф архітектором** — СТОП. Звіт: перелік комітів, БЛ, таблиця мутацій І1–І3, І12, І14–І19, І22, І24, І25, І27–І30, І36, І37 (частина).

---

# Хвиля Т — товар

Порядок expand → contract. До Task 17 у таблицях товару живуть і старі колонки, і нові таблиці. Обмеження Р18 і
тригери І4/І5 вмикаються в Task 17, коли не лишається записувача повз команду. Дзеркалення джерела в старі колонки
(читачі до Task 15/16) — лише в команді й фікстурному хелпері, з позначкою `// М1-TEMP: зноситься в Task 17`.

**Факти розвідки, на які спираються задачі** (знімок `a4aa566e`):
- **Читачі колонок товару:**
  - `storefront/loaders/{entities/product.ts:13-55, product-detail.ts:60-115, entities/modification.ts:6-50, property-values.ts:31-76, modification-values.ts, catalog-products.ts:23-137, products.ts:69-109, entities/home-product.ts:10-70, home.ts:79, home-sections.ts:43, sitemap.ts:57-64}`;
  - `commerce/price-cart-catalog.ts:30-71` — єдине джерело назви позиції `"<товар> - <модифікація>"`;
  - `admin-server/impl/{products/search-for-order.ts:50-73, reviews/list.ts:58,69, reviews/card.ts:37-49}`;
  - `storefront-routes/{head/product.ts:40-80, pages/ProductDetail.tsx:125-133, pages/product-detail/useProductContent.ts, server/product-list-item.ts:73-77}`;
  - `catalog-ui/{ProductCard.tsx, ProductCharacteristics.tsx}`, `storefront-routes/pages/catalog/filter-predicates.ts:87` (`pv.value === 'true'`);
  - host `src/engine.shared.ts:11-16` (`LinkResolver.product` — власний шлях, не `productPath`).
- **Записувачі:**
  - `admin-server/impl/{products/resource.ts, product-modifications/resource.ts, property-values/resources.ts}` через `admin-data/collections/{products,product-modifications,product-property-values,modification-property-values}.ts`;
  - знімок `order-create.ts:93-98`, `order-items/add.ts:71-91`.
- **Медіа:** реєстр `domain/media.ts:200` `MEDIA_COLUMNS` + `storage/references.ts:31-45` (sweep шукає референси за ним); гейти `tests/media-columns-coverage.test.ts`, `tests/media-read-resolve.test.ts`.
- **Сіди й фікстури:**
  - `migrations/demo/demo-seed.sql:83-240`, `scripts/dev-stand/{generate-seed.mjs,table-specs.mjs:69-91}`, `scripts/showcase/catalog-products.mts:40-147` (через `*Ops.insertIn`);
  - 25 файлів харнесу вставляють товари напряму, сирі масиви `fixtures/{storefront.ts:25, storefront-client.ts:23, rls-actors.ts:43}`; спільного хелпера немає;
  - `scripts/live-smoke/{product-path.mjs, sql.mjs:44-54, price-visibility.mjs, funnel.mjs:40, place-order.mjs}`, `scripts/pilot-pack/{gate-b.mjs, apply-probe.mjs, sanitize-probe.sql}`.

### Task 10: Схема товару — expand, фікстурний хелпер, сіди

**Files:**
- Modify: `schema/schema.ts` (нові таблиці майстра §3.1 для М1: `product_translations`, `product_modification_translations`, `product_images`, `product_image_translations`, `product_property_value_translations`, `modification_property_value_translations`; у таблицях значень — `value_kind`, `bool_value`, `color_value` NULLABLE; `products.version`; `section_properties` + `UNIQUE(id, property_type)`; `property_options` + `UNIQUE(property_id, id)`; `modification_property_values.numeric_value` → `numeric(15,4)`, як у товару), `migrations/0002_grants.sql`, `fixtures/grants.ts`, `migrations/demo/demo-seed.sql`, `seed-determinism.test.ts`, `scripts/dev-stand/{table-specs.mjs,generate-seed.mjs,seed-demo.sql}`
- Create: `test-harness/pg/__tests__/fixtures/product-graph.ts`, `test-harness/pg/__tests__/product-graph-fixture.test.ts`
- Modify: усі 25 файлів харнесу з прямою вставкою товарів і `fixtures/{storefront,storefront-client,rls-actors,admin-shipping,catalog-media,user-graph}.ts` → хелпер

**Interfaces:**
- Produces (харнес):
  - `insertProductGraph(db: PgClientLike, spec: ProductGraphSpec): Promise<void>` — пише базові рядки, `product_translations` (основна мова + `spec.translations`), `url_paths` (поточний шлях основною мовою = `spec.slug`), модифікації з перекладами й `slug_tokens`, значення з `value_kind` і перекладами для `text`, `product_images`;
  - до Task 17 хелпер ДОДАТКОВО пише старі колонки (`// М1-TEMP`);
  - `ProductGraphSpec = { id; sectionId?; slug; name; texts?: Partial<ProductTexts>; translations?: Record<string, Partial<ProductTexts>>; isActive?; sku?; stockStatus?; images?: string[]; modifications?: Array<{ id; slug; name; sku?; isDefault?; images?: string[] }>; values?: Array<{ id; propertyId; kind: PropertyType; optionId?; number?; bool?; color?; text?: Record<string, string> }> }`.
- Produces (демо-сід): ті самі таблиці для товарів демо. `seed-determinism`: нова кількість `insert into` з поясненням у звіті.

- [ ] **Step 1: Тест хелпера.** `product-graph-fixture.test.ts`:
  - після `insertProductGraph` (1 товар, 2 модифікації, значення text/number/select/boolean) є рядок перекладу основної мови;
  - `url_paths` поточний = slug;
  - 2 токени модифікацій;
  - текстове значення в перекладах, `value_kind` заповнений у всіх значеннях.

  `demo-seed.test.ts` (наявний) + новий кейс: кожен демо-товар має переклад основною мовою й поточну адресу.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Схема → `pnpm db:rebaseline` → гранти → хелпер → сід і dev-stand (генератор пише нові таблиці; `tests/dev-stand-seed.test.ts` оновити) → `template:sync`.
- [ ] **Step 4: Переведення фікстур.** Кожна пряма вставка товару/модифікації/значення в харнесі → `insertProductGraph`. Перевірка: `grep -rlnE "insert into (public\.)?(products|product_modifications|product_property_values|modification_property_values)\b|insert\((products|productModifications|productPropertyValues|modificationPropertyValues)\)" packages/simplycms/test-harness` → лише `fixtures/product-graph.ts`. Друга перевірка: `grep -rlnE "insert into (public\.)?(url_paths|slug_tokens)\b|insert\((urlPaths|slugTokens)\)" packages/simplycms/test-harness` → лише `fixtures/product-graph.ts`, `url-paths.test.ts` і `slug-tokens.test.ts` (прямі вставки адрес у тестах Task 6 переходять на хелпер тут).
- [ ] **Step 5:** `pnpm test:schema` (повний) → PASS; `pnpm vitest run tests/dev-stand-seed.test.ts tests/demo-seed-clean.test.ts` → PASS; `pnpm live:smoke` → PASS.
- [ ] **Step 6:** БЛ. Мутація: хелпер не пише рядок основної мови → `product-graph-fixture` червоний. Commit `feat(multilingual): схема перекладів товару (expand), хелпер фікстур`.

### Task 11: Серверна механіка перекладів і ядро агрегата товару (І10, І11, І12, І14, І17; Review Focus 4)

**Files:**
- Create:
  - `packages/simplycms/src/translations/{index.ts,server.ts,upsert.ts,read.ts,specs.ts}` + `__tests__/specs.test.ts`;
  - `packages/simplycms/src/admin-server/impl/products/aggregate/{operations.ts,create.ts,save-description.ts,save-translation.ts,load.ts,schemas.ts}`;
  - `test-harness/pg/__tests__/{product-aggregate.test.ts,translation-race.test.ts,translations-hash-keys.test.ts}`.
- Modify: `admin-server/index.ts` (обгортки), `operations/registry.ts` (`CORE_OPERATIONS`), `api/openapi.core.json` (`pnpm api:snapshot`)

**Interfaces:**
- Produces (`simplycms/translations`):
  - `TRANSLATABLE: { product: TranslatableSpec & { table: 'product_translations'; fk: 'product_id' }; productModification: …; productImage: …; productPropertyValue: …; modificationPropertyValue: … }` — єдиний реєстр специфікацій М1 (М2 доповнює). `product`: `fields: ['name','short_description','description','meta_title','meta_description']`, `required: ['name']`, `richHtml: ['description']`;
  - `loadTranslations(db, spec, ids: readonly string[]): Promise<Map<string, Map<string, Row>>>`;
  - `applyTranslationPlan(db, spec, entityId, plan: ReturnType<typeof planTranslationWrite>, extra?: Record<string, unknown>): Promise<void>` — `INSERT … ON CONFLICT (<fk>, locale) DO UPDATE` лише надісланих колонок; DELETE ніде;
  - `deleteTranslation(db, spec, entityId, locale)` — відмова для основної мови;
  - `withFallback(spec, locale, primary)` — Drizzle-фрагмент `COALESCE(t_loc.<f>, t_src.<f>)` для спільної функції читання з fallback (вітрина, Task 15/16).

  Rich-text поля санітизуються ДО хешування (`sanitizeRichHtml`, наявний `admin-server/impl/rich-html.ts`).
- Produces (операції; `permission: 'catalog.write'`, читання — `'catalog.read'`):
  - `products.create` (`idempotent: 'create'`, `versioned`): вхід `{ id, sectionId?, sku?, isActive, isFeatured, hasModifications, stockStatus, texts: { [locale]: Partial<ProductTexts> } (основна обов'язкова з name), path?: string }` → `{ id, version: 1, paths: Record<string,string> }`. Шлях основної мови = `path ?? slugify(name)`; для нелатинського письма без пакета `path` обов'язковий (`ValidationError('path_required')`). Адреси для всіх мов у `draft`/`published` — спільним замком;
  - `products.get` `{ id }` → `{ id, version, base, texts: Record<locale, Row & { status: FieldStatus; fieldStatus: Record<field, FieldStatus> }>, paths: Record<locale, string> }`;
  - `products.saveDescription` (`versioned`): `{ id, expectedVersion, base?: Partial<ProductBase>, texts?: { [locale]: Partial<ProductTexts> } }` → `{ version }`. Сценарії 1–2 майстра §3.4. Шлях не чіпає (І17);
  - `products.saveTranslation` (`versioned`): `{ id, locale, expectedVersion, fields, expectedSourceHashes }` → `{ version }` — сценарій 3. `expectedVersion` ОБОВ'ЯЗКОВИЙ (спека §18.3: кожна команда агрегата), інакше дві правки перекладу з тим самим хешем джерела перезаписали б одна одну;
  - `products.deleteTranslation` `{ id, locale, expectedVersion }`;
  - `products.setPath` `{ id, locale, path, expectedVersion }` → `setExplicitPath`; ЗБІЛЬШУЄ `version` (адреса — частина агрегата для ETag); те саме для `products.setModificationToken` (Task 12);
  - `products.remove` `{ id, expectedVersion }`.

  Порядок у кожній команді: `SELECT … FOR UPDATE` кореня → `assertVersionThenHash` → запис → `version = version + 1`. До Task 17 — дзеркалення в старі колонки (`// М1-TEMP`):
  - текст основної мови → `products.*`;
  - поточний шлях основної мови → `products.slug` (NOT NULL до Task 17, без дзеркала create упав би).

  Кейс у `product-aggregate.test.ts`: `'дві правки перекладу en з тим самим хешем джерела і тією самою версією — друга 412'`.

- [ ] **Step 1: Тести.**
  - `translations-hash-keys.test.ts` (І10): після кожної операції ключі `source_hashes` усіх рядків ⊆ `spec.fields` — `select distinct jsonb_object_keys(source_hashes)`.
  - `product-aggregate.test.ts`:
    - `'create без основної мови → validation'`;
    - `'create → paths для draft і published мов'`;
    - `'saveDescription без en не видаляє рядок en'` (І11);
    - `'сценарій 1: зміна uk.description → en.description outdated, en.name current'`;
    - `'сценарій 2: uk.name + en.name в одному запиті → en.name current, en.description outdated'`;
    - `'null очищує необов\'язкове; null для name → validation'`;
    - `'expectedVersion застаріла → VersionMismatchError з currentVersion'` (І14);
    - `'версія і хеш обидва погані → 412, не 409'`;
    - `'saveDescription з новою назвою не змінює шлях'` (І17);
    - `'deleteTranslation основної → validation'`;
    - `'Idempotency: products.create двічі через HTTP — один товар'`.
  - `translation-race.test.ts` (І13, Review Focus 4): дві паралельні транзакції — A `saveDescription(uk.description)`, B `saveTranslation(en.description, expected=старий хеш)`. Хто б не пройшов першим, кінцевий `en.description` не `current` щодо нового джерела, а B отримує 409, якщо A закомітилась раніше. Синхронізація — advisory-«засувками» харнесу (`holdAdvisoryLock`).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Реалізація, обгортки serverFn (форма Task 6), реєстр, `pnpm api:snapshot`, легасі-перелік лінту не росте.
- [ ] **Step 4:** PASS; `pnpm vitest run packages/simplycms/src/operations` (паритет) → PASS.
- [ ] **Step 5:** БЛ. Мутації:
  - (а) `applyTranslationPlan` видаляє відсутні мови → І11 червоний;
  - (б) прибрати `FOR UPDATE` у `saveTranslation` → race червоний;
  - (в) `saveDescription` перегенеровує шлях → І17 червоний;
  - (г) хешувати сирий HTML замість санітизованого → кейс `'опис з <script> → хеш = хеш санітизованого'` (додати в `product-aggregate`) червоний.

  Commit `feat(multilingual): механіка перекладів і агрегат товару`.

### Task 12: Модифікації, значення властивостей і зображення в агрегаті; ціни й залишки — командами (І21 модифікації, Р5)

**Files:**
- Create: `admin-server/impl/products/aggregate/{modifications.ts,property-values.ts,images.ts}`, `admin-server/impl/{product-prices,stock}/operations.ts`, `test-harness/pg/__tests__/{product-aggregate-children.test.ts,product-images-media.test.ts}`
- Modify:
  - `domain/media.ts:200` (`MEDIA_COLUMNS`: + `product_images.storage_key` text `'product'`, + `product_image_translations.storage_key` text `'product'`; рядки `products.images`/`product_modifications.images` прибираються в Task 17);
  - `storage/references.ts`. Факт: `findMediaReferences` робить `select id::text as id` у кожній таблиці гілки (`:80`), а в `product_image_translations` колонки `id` немає. Тому запис `MEDIA_COLUMNS` отримує опційне поле `idExpression` (для цієї таблиці — `image_id::text || ':' || locale`), і запит будує ідентифікатор з нього. Тип `MediaReference.id` лишається `string`;
  - `test-harness/pg/__tests__/media-references.test.ts:86` — `SEEDERS` для `product_images.storage_key` і `product_image_translations.storage_key` (тест парності вимагає сіятеля на кожен запис реєстру);
  - `tests/media-columns-coverage.test.ts`;
  - `scripts/showcase/{catalog-products.mts,catalog.mts,images.mts}` (через команди);
  - `admin-server/index.ts`, `operations/registry.ts`.

**Interfaces:**
- `products.saveDescription` розширюється (той самий id операції, той самий `version`):
  - `modifications?: { upsert?: Array<{ id; sku?; isDefault?; sortOrder?; texts?: { [locale]: { name? } }; token?: Record<locale, string> }>; remove?: string[] }`;
  - `propertyValues?: { upsert?: Array<{ id; propertyId; kind: PropertyType; optionId?; number?; bool?; color?; text?: { [locale]: string | null }; modificationId?: string }>; remove?: string[] }`;
  - `images?: { upsert?: Array<{ id; storageKey; sortOrder; modificationId?; alt?: { [locale]: string | null }; overrides?: { [locale]: string | null } }>; remove?: string[] }`.

  Колекції ніколи не видаляються неявно — лише явним `remove`. До Task 17 (`// М1-TEMP`) команда дзеркалить:
  - фото → jsonb `products.images` / `product_modifications.images`;
  - текст основної мови text-значень → `*_property_values.value`;
  - поточний токен основної мови → `product_modifications.slug` (NOT NULL до Task 17).

  Інакше старі читачі до Task 15/16 не побачать запис через команду. Нова модифікація отримує токени для мов `draft`/`published` (І21). Видалення фото — «об'єкт → рядок» за наявним медіа-контуром.
- `products.setModificationToken` `{ modificationId, locale, slug, expectedVersion }`.
- `products.savePrices` / `products.saveStock` — тонкі операції над наявними ядрами `saveProductPrices` / `saveStock`. `version` НЕ збільшують (Р14).

- [ ] **Step 1: Тести.**
  - `product-aggregate-children.test.ts`:
    - `'нова модифікація → токени в усіх draft/published мовах'` (І21);
    - `'переклад назви модифікації не змінює токен'`;
    - `'deleteTranslation модифікації en → токен en лишається'` (токен живе з мовою, а не з перекладом рядка; І21 «⇔» означає: рядок перекладу є → токен є);
    - `'значення без remove лишається'`;
    - `'text-значення: переклад по мовах; number — без перекладу'`;
    - `'savePrices не змінює version'` (Р14);
    - `'saveStock не змінює version'`.
  - `product-images-media.test.ts`:
    - фото з alt двома мовами;
    - перевизначення фото для `en` → `findMediaReferences` бачить обидва ключі;
    - `remove` фото → файл стерто, рядок прибрано;
    - sweep не чіпає ключ з `product_image_translations.storage_key`;
    - `images.upsert` з `storageKey`, який не є завантаженим файлом ЦЬОГО товару (запис `media` з `entity_type='product'` і `entity_id` = товар), → 409 `media_ref_invalid` (наявний захист Е6д-1); те саме для `overrides`;
    - `products.remove` стирає файли всіх фото й перевизначень за контуром «об'єкт → рядок».
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Реалізація; showcase на команди; `pnpm typecheck:showcase`; `pnpm db:showcase` на чистій БД → PASS.
- [ ] **Step 4:** PASS (+ `media-references`, `media-sweep`, `media-cascade-coverage`, `seed-media-invariant`).
- [ ] **Step 5:** БЛ. Мутації:
  - (а) нова модифікація без токенів → І21 червоний;
  - (а′) прибрати перевірку власника `storageKey` → кейс `media_ref_invalid` червоний;
  - (б) прибрати рядок `product_image_translations` з `MEDIA_COLUMNS` → `media-columns-coverage` і sweep-тест червоні;
  - (в) `savePrices` збільшує version → Р14-тест червоний.

  Commit `feat(multilingual): агрегат товару — модифікації, значення, фото; ціни й залишки командами`.

### Task 13: Адмінка товару на командах — картка з вкладками мов

**Files:**
- Modify:
  - `admin/features/products/edit/{ProductEditPage,ProductForm,ProductMainFields,ProductSeoFields,ProductMetaCard,NewProductPage,useProductSave,product-form-schema}.tsx/ts`;
  - `admin/features/products/modifications/{useModifications,ModificationDialog*,ModificationFormFields}.ts(x)`;
  - `admin/features/products/properties/{usePropertyValueTx,usePropertyValues,PropertyInput,TextPropertyInput}.ts(x)`;
  - `admin/features/products/list/{useProductsList,ProductRow}.ts(x)`;
  - `admin-data/collections/{products,product-modifications,product-property-values,modification-property-values}.ts` — без `persistenceHandlers`, лише читання;
  - `admin/features/discounts/discount/useTargetLabels.ts`, `orders/detail/OrderModificationPicker.tsx`;
  - каталоги i18n `uk`/`en` (`admin.products.*`, `admin.translations.*`).
- Create:
  - `admin/features/translations/{LanguageTabs.tsx,TranslationStatusBadge.tsx,useAggregateCommand.ts,PathField.tsx}` + `__tests__/*`;
  - `admin/features/products/edit/__tests__/product-card-languages.test.tsx`.
- Delete: фабричні обгортки `insertProducts/updateProducts/removeProducts`, `insert/update/removeProductModifications`, `insert/update/remove{Product,Modification}PropertyValues` з `admin-server/index.ts` і з legacy-переліку лінту (`list*` лишаються для колекцій до М3).

**Interfaces:**
- `useAggregateCommand<I, O>(serverFn, { onConflict })` — один запит на «Зберегти», `expectedVersion` з останнього `products.get`. `VersionMismatchError` → діалог «Товар змінив хтось інший» з кнопкою «Перезавантажити» (форма не скидається мовчки).
- Картка:
  - вкладки мов з `languages.list` (основна позначена «джерело»);
  - на кожній вкладці — поля перекладу з `TranslationStatusBadge` поля й рядка;
  - `PathField` для кожної мови (`products.setPath`);
  - модифікації, значення й фото — у тій самій кнопці збереження (`saveDescription`);
  - ціни й залишки — окремі збереження (без змін UX);
  - список — назва основною мовою.
- Мова інтерфейсу адмінки — основна (Global Constraints).

- [ ] **Step 1: Тести** (Testing Library, мок serverFn):
  - `'одна кнопка шле один saveDescription з texts усіх змінених вкладок'`;
  - `'незмінена вкладка не потрапляє в texts'` (І11 з боку UI);
  - `'412 → діалог конфлікту, введене збережено'`;
  - `'статус outdated показано на полі'`;
  - `'шлях редагується окремо й шле setPath'`;
  - `'нова модифікація потрапляє в modifications.upsert того самого запиту'`.

  Наявні тести `edit/`, `modifications/`, `properties/`, `list/` переписуються на нові хуки; кількість тестів не зменшується (у звіті — до/після).
- [ ] **Step 2:** FAIL → реалізація → PASS.
- [ ] **Step 3:** `pnpm lint` (легасі-перелік скоротився на 12 імен, правило перевіряє зникнення); `pnpm vitest run packages/simplycms/src/admin` → PASS; `pnpm live:smoke` (адмін-сценарії каталогу) → PASS.
- [ ] **Step 4:** БЛ. Мутації:
  - (а) збереження шле всі вкладки, а не змінені → тест «незмінена вкладка» червоний;
  - (б) ковтати 412 → тест конфлікту червоний.

  Commit `feat(multilingual): картка товару з вкладками мов на командах`.

### Task 14: Проєкція тексту товару (І23)

**Files:**
- Modify: `schema/schema.ts` (`catalog_product_texts`), гранти
- Create:
  - `packages/simplycms/src/catalog-projection/{index.ts,server.ts,product-texts.ts,reconcile.ts}`;
  - `test-harness/pg/__tests__/catalog-projection.test.ts`.
- Modify: команди Task 11/12 (виклик оновлення), `admin-server/impl/languages/fill.ts` (етап проєкції), `completeness.ts`

**Interfaces:**
- Схема (похідна, не незворотна): `catalog_product_texts(product_id uuid → products CASCADE, locale text → languages(code) CASCADE, name text NOT NULL, short_description text, description text, meta_title text, meta_description text, path text NOT NULL, is_translated boolean NOT NULL, updated_at, PRIMARY KEY (product_id, locale))` + індекс `(locale, path)`.
  - Рядки — для мов у `draft` і `published`.
  - Текст уже з fallback на основну мову, `is_translated` = `isTranslatedForSeo` (майстер §3.4).
  - `path` — поточна адреса мови.
- `refreshProductTexts(db, productIds: readonly string[], locales?: readonly string[]): Promise<void>` — set-based `INSERT … ON CONFLICT DO UPDATE` з одного SELECT. Блокування у детермінованому порядку: `ORDER BY product_id`.
- `reconcileProductTexts(db, { limit }): Promise<{ mismatched: number; fixed: number }>` — звірка проєкції з джерелом.
- Оновлення: кожна команда Task 11/12 (і `setPath`) кличе `refreshProductTexts` у своїй транзакції; `languages.fill` — пакетами.

- [ ] **Step 1: Тест** `catalog-projection.test.ts` (І23): після КОЖНОЇ команди товару (create, saveDescription сценарії 1–3, deleteTranslation, setPath, remove, languages.add + fill) `reconcileProductTexts` дає `mismatched: 0`. Плюс окремо:
  - `'неперекладене en → текст uk, is_translated=false'`;
  - `'назва en + опис лише uk → is_translated=false'` (І33 б на даних);
  - `'disabled мова — рядків немає після fill'`.
- [ ] **Step 2:** FAIL → реалізація → PASS.
- [ ] **Step 3:** БЛ. Мутація: `saveTranslation` не кличе `refreshProductTexts` → тест звірки червоний. Commit `feat(multilingual): проєкція тексту товару`.

### Task 15: Вітрина — сторінка товару `/<path>`, нормалізація, SEO товару (І20, І33 товар, І37 fallback; Review Focus 5)

**Files:**
- Create:
  - `packages/simplycms/routes/storefront/_storefront/$.tsx` (сутність за адресою; у М1 — лише товар, інакше `notFound()`);
  - `packages/simplycms/src/storefront/seo/{index-policy.ts,hreflang.ts}` + `__tests__/index-policy.test.ts`;
  - `packages/simplycms/src/storefront-routes/components/FallbackText.tsx`;
  - `packages/simplycms/src/storefront-routes/__tests__/{path-normalize.test.ts,product-page-html.test.tsx}`.
- Modify:
  - `storefront/loaders/{product-detail.ts,entities/product.ts,entities/modification.ts,property-values.ts,modification-values.ts}` (читання з проєкції + `withFallback`);
  - `storefront-routes/server/products.ts` (`getProduct({ locale, path })`);
  - `storefront-routes/pages/ProductDetail.tsx` і `pages/product-detail/useProductQuery.ts:23-30` — ключ і запит за `(locale, path)` замість `productSlug`, інакше запит вимкнений і навігація між товарами показує попередні дані;
  - `storefront-routes/head/product.ts:48` — опис у `meta description` і `og:description` без HTML-тегів (спека §7.4);
  - `storefront-routes/head/product.ts` (meta_*, canonical, hreflang, noindex, og:locale);
  - `storefront-routes/locale/normalize.ts` (історія адрес + `?mod=` історичний токен в одній функції);
  - `storefront/seo/sitemap.ts` + `loaders/sitemap.ts` — товари ЛИШЕ через результат `indexPolicy` (спека §18.6): рядок на опубліковану мову, де `indexable`, `xhtml:link` alternates = її `hreflang`;
  - `domain/product-path.ts` (`productPath({ path, locale, primary })`; `NO_SECTION_SLUG`, `productRedirectTarget` зносяться);
  - `contracts/ports/index.ts:67-70` (`LinkResolver.product({ path })`);
  - host `src/engine.shared.ts:11-16` → `product: (p) => productPath(p)` з ядра;
  - `storefront-routes/pages/product-detail/useModificationSelection.ts` (`?mod=` — токен поточної мови; знімається `react-hooks/set-state-in-effect` з §15a, бо хук переписується);
  - `catalog-ui/ProductCharacteristics.tsx` (значення за `kind`);
  - `storefront-routes/pages/catalog/filter-predicates.ts:87` (boolean за `bool_value`).
- Delete: `packages/simplycms/routes/storefront/_storefront/catalog/$sectionSlug/$productSlug.tsx`, `domain/__tests__/product-redirect.test.ts`
- Modify (live-smoke): УСІ сценарії, що відкривають товар за `/catalog/…`. На знімку це 13 файлів: `scripts/live-smoke/{admin-orders-buyer,price-visibility,admin-customers-delete,admin-discounts,funnel,product-path,body-limit,security-headers,review-xss,admin-content,error-mask,place-order,admin-catalog-verify}.mjs`, плюс `sql.mjs`, `selectors.mjs`, `stock-labels.mjs`. Шлях — `/<path>` зі `url_paths`. Перевірка: `grep -rn "/catalog/" scripts/live-smoke` → лише сторінки розділів (до М2)

**Interfaces:**
- `indexPolicy(input: { locale; primary; isTranslated: boolean; robots?: string | null; canonicalOverride?: string | null; languages: Array<{ code; isTranslated; path }> }): { indexable: boolean; robots: string; canonical: string; hreflang: Array<{ hrefLang: string; href: string }> }`.
  - Неперекладене → `noindex`, canonical на основну, без hreflang.
  - hreflang — лише опубліковані перекладені версії взаємно + `x-default` на основну.
- `normalizeStorefrontRequest` (з Task 9) серіалізує query ТИМ САМИМ `defaultParseSearch`/`defaultStringifySearch` (`@tanstack/router-core`), що й роутер. Інакше її 301 і роутерний 307 розійдуться в кодуванні й дадуть цикл. Доповнюється:
  - історичний шлях → поточний;
  - історичний `?mod=` → поточний токен;
  - завершальний слеш.

  Усе складається в ОДИН 301 зі збереженням дозволених і невідомих query. Видалена сутність → 404 (історія видалена каскадно).
- `FallbackText({ lang, children })` — `<span lang={primary}>`, коли текст із fallback (`is_translated=false` для поля), інакше без обгортки.

- [ ] **Step 1: Тести.**
  - `path-normalize.test.ts` (І20) — на харнес-БД з `insertProductGraph`:
    - `/uk/old?utm=1` → ОДИН 301 на `/new?utm=1`;
    - `/en/old-en/` → один 301 на `/en/new-en`;
    - `/x?mod=<старий токен>` → один 301 на `/x?mod=<новий>`;
    - видалений товар → 404;
    - `/x` → `null`;
    - закодований (`?utm=%31`) і повторений (`?a=1&a=2`) невідомий параметр → рівно ОДИН редирект, після якого роутер не дає 307 (перевірка: `buildLocation` роутера на цільовому URL = цільовий URL);
    - `/en` і `/en/` — корінь мови: `/en/` → один 301 на `/en`.
  - `index-policy.test.ts` (І33): неперекладене; ручний `robots=index` не перекриває noindex неперекладеного; `x-default` = основна; canonical-override на інший URL → поза hreflang.
  - `product-page-html.test.tsx` (Review Focus 5, тест на відрендереному HTML через SSR-хелпер, як `catalog-ssr.test.tsx`):
    - `/en/x` неперекладеного → `<meta name="robots" content="noindex`, canonical `https://…/x`, текст опису основною мовою всередині `lang="uk"`, кнопки інтерфейсу англійською, `<html lang="en">`;
    - перекладеного → self-canonical, hreflang `uk`, `en`, `x-default`;
    - `meta_title` використано в `<title>`;
    - опис із HTML (`<p>Опис <b>x</b></p>`) у `meta description` і `og:description` — без тегів.
  - `sitemap.test.ts` (наявний): товар із перекладом en — дві `<url>` з alternates; без перекладу — лише основна; паритет — кожен URL sitemap = self-canonical сторінки й є в її hreflang.
- [ ] **Step 2:** FAIL → реалізація → PASS.
- [ ] **Step 3:** `pnpm build && pnpm typecheck && pnpm template:sync`; `pnpm live:smoke` → PASS.
- [ ] **Step 4:** БЛ. Мутації:
  - (а) два послідовні редиректи (окремо мова й історія) → `path-normalize` червоний;
  - (б) hreflang на неперекладену версію → `index-policy` червоний;
  - (в) прибрати `lang` у `FallbackText` → HTML-тест червоний;
  - (г) серіалізувати query в інтерсепторі власним кодом → кейс `%31` червоний;
  - (д) sitemap з `is_translated` в обхід `indexPolicy` → паритет-тест червоний.

  Commit `feat(multilingual): сторінка товару за адресою з реєстру, SEO товару`.

### Task 16: Решта читачів товару — лістинги, головна, кошик, знімок замовлення, адмін-SQL

**Files:**
- Modify:
  - `storefront/loaders/{catalog-products.ts,products.ts,entities/home-product.ts,home.ts,home-sections.ts,property-option.ts}` (назва, шлях, фото з проєкції або `withFallback`);
  - `storefront-routes/server/{product-list-item.ts,product-list-payload.ts,catalog.ts}`;
  - `catalog-ui/ProductCard.tsx`;
  - `commerce/{price-cart-catalog.ts:30-71,price-cart.ts,price-items.ts}` — параметр `locale` наскрізно: кошик і чекаут → `priceItems` → `priceCart` → `loadCatalog`;
  - до Task 17 переходять на `url_paths` / `slug_tokens`: `scripts/showcase/prices.mts:72` і сирий SQL `p.slug` у `scripts/live-smoke/{admin-discounts-sql,admin-order-edit-sql,admin-dictionaries-sql,admin-shipping-sql,body-limit,product-path}.mjs`;
  - `storefront/loaders/{quote-cart.ts,prepare-checkout.ts,order-create.ts}`;
  - `admin-server/impl/{order-items/add.ts,price-diagnosis/diagnose.ts,products/search-for-order.ts,reviews/list.ts,reviews/card.ts}` (назва основною мовою; пошук для замовлення — за назвою будь-якою мовою й артикулом через `product_translations`);
  - `admin/features/reviews/card/ReviewCardPage.tsx` (`productPath`);
  - `tests/media-read-resolve.test.ts` (реєстр проєкцій фото);
  - `scripts/pilot-pack/{gate-b.mjs,apply-probe.mjs,sanitize-probe.sql}`.

**Interfaces:**
- `loadCatalog(db, lines, { locale, primary })`. Знімок `order_items.name` у М1 = назва мовою запиту. Двомовний знімок і `orders.locale` — М2 (майстер §3.1, І31). Тут лише параметр мови без схеми.

- [ ] **Step 1: Тести.** Наявні тести лоадерів і `price-cart`, `checkout-flow`, `product-search-for-order` оновлюються під хелпер. Нові кейси:
  - `'лістинг /en розділу: назва en або fallback, посилання /en/<path>'`;
  - `'кошик на /en: назва позиції en'`;
  - `'пошук для замовлення знаходить товар за en-назвою й за артикулом'` (рішення власника 19, частина товару).
- [ ] **Step 2:** FAIL → реалізація → PASS.
- [ ] **Step 3:** `pnpm test:schema` (повний) і `pnpm test`; `pnpm live:smoke`; `node scripts/pilot-pack/…` за `test-contours.md` (Gate B).
- [ ] **Step 4:** БЛ. Мутація: `loadCatalog` ігнорує `locale` → `'кошик на /en'` червоний. Commit `feat(multilingual): лістинги, кошик і адмін-читачі товару на перекладах`.

### Task 17: Contract — знос старих колонок, обмеження Р18, тригери І4/І5 (І4–І8)

**Files:**
- Modify:
  - `schema/schema.ts` — знос `products.{slug,name,short_description,description,meta_title,meta_description,images,return_policy,shipping_details}`, `product_modifications.{slug,name,images}`, `*_property_values.value`; `value_kind` NOT NULL; складені FK і CHECK Р18; частковий UNIQUE; `option_id` FK `ON DELETE CASCADE`;
  - `migrations/0004_functions.sql` (constraint-тригери `require_source_translation` на `products`/`product_translations`, `product_modifications`/`product_modification_translations`, значення з умовою `value_kind=text`; і тригери НАЯВНОСТІ адреси й токена на `AFTER INSERT` бази — `attach_current_address_triggers(products, url_paths, 'product_id')`, `attach_current_token_triggers(product_modifications, slug_tokens, 'modification_id')` з Task 5, К4);
  - `domain/media.ts` (`MEDIA_COLUMNS` без `products.images`, `product_modifications.images`);
  - `fixtures/product-graph.ts` (без `// М1-TEMP`); команди Task 11/12 (без дзеркалення);
  - `admin-server/impl/products/resource.ts` і `product-modifications/resource.ts` (лишається лише читання для колекцій), `property-values/resources.ts`;
  - `demo-seed.sql`, `scripts/dev-stand/*`;
  - `CHANGELOG.md` `[Unreleased]` BREAKING: знос `return_policy`/`shipping_details` (Р8), адреси товару `/<path>`, «перестворити БД».
- Create: `test-harness/pg/__tests__/property-values-shape.test.ts`; кейси товару в `source-translation-required.test.ts`

- [ ] **Step 1: Тести.**
  - `property-values-shape.test.ts`:
    - І6: number з `option_id` → `check_violation`; `value_kind='number'` для select-властивості → `foreign_key_violation`;
    - І7: опція чужої властивості → `foreign_key_violation`;
    - І8: два рядки select → `unique_violation`, два multiselect з різними опціями → ок;
    - І5: number без перекладу → коміт; text без рядка основної мови → відмова;
    - зміна `property_type` властивості з наявними значеннями → `foreign_key_violation` (`ON UPDATE RESTRICT`).
  - `source-translation-required.test.ts` + `describe('товар')`:
    - товар без перекладу основної мови → відмова на коміті під `app_admin`;
    - видалення товару каскадом → коміт;
    - модифікація без перекладу → відмова.
  - `url-paths.test.ts` + `describe('наявність на коміті')` (К4):
    - товар без поточної адреси в `draft`-мові → відмова на коміті;
    - товар, створений операцією в транзакції, що конкурує з `languages.add` під спільним замком, комітиться без хибної відмови: тригер бачить лише мови свого знімка, нову мову дозаповнює `fill`;
    - модифікація без поточного токена → відмова.
  - `grep`-перевірка в кроці 3.
- [ ] **Step 2:** FAIL → реалізація → PASS.
- [ ] **Step 3:** `git grep -n "М1-TEMP"` → порожньо; `git grep -nE "products\.(slug|name|shortDescription|description|metaTitle|metaDescription|images|returnPolicy|shippingDetails)\b" packages src scripts` → порожньо (typecheck це теж доводить); сирий SQL: `git grep -nE "\bp\.(slug|name)\b|product_modifications\.(slug|name)" scripts packages/simplycms/test-harness` → порожньо, крім розділів (`s.slug`, М2).
- [ ] **Step 4:** БЛ + `pnpm live:smoke` + `pnpm db:showcase` на чистій БД. Мутації:
  - (а) прибрати складений FK `(property_id, value_kind)` → І6 червоний;
  - (б) прибрати CHECK колонки → І6 червоний;
  - (в) простий FK `option_id` → І7 червоний;
  - (г) прибрати частковий UNIQUE → І8 червоний;
  - (д) прибрати умову `value_kind=text` → І5 червоний;
  - (е) прибрати тригер на `product_translations` → І4 червоний;
  - (є) не підключати тригер наявності адреси на `products` → кейс «без адреси» червоний (І16).

  Commit `feat(multilingual): товар — знос старих колонок, обмеження значень, обов'язкове джерело`.

### Task 18: Закриття М1 — канон, носії стану, фінальний доказ

**Files:**
- Create: `docs/architecture/translations.md` (модель, реєстри, семантика запису, проєкція — з посиланням на майстер §3), `docs/architecture/operations-api.md` (реєстр, виконавець, транспорти, токени, ідемпотентність, problem+json, лінт, паритет)
- Modify:
  - `docs/architecture/{data-layer.md,rendering-and-routing.md,test-contours.md,i18n.md}`;
  - `AGENTS.md` (інваріант «запис адмінки й API — лише операції реєстру `simplycms/operations`; serverFn — тонка обгортка» у розділі «Дані й доступ» + посилання на `operations-api.md`; «мова вітрини — лише з URL» у розділі i18n);
  - `docs/tasks/{platform-roadmap.md,v2-state-map.md}`;
  - `CHANGELOG.md` `[Unreleased]` (зведення М1).

- [ ] **Step 1:** `orient --doctor` і тест `doc-symbols-exist` (`pnpm test`): усі нові символи в доках існують.
- [ ] **Step 2:** Повний ланцюг БЛ + `pnpm live:smoke` + `pnpm test:race`. Норма лінту — 0 errors / 6 warnings: Task 15 переписав `useModificationSelection` і зняв його `set-state-in-effect`. Число в `AGENTS.md` (розділ «Команди») і `docs/development/TOOLING.md` оновлюється в ЦІЙ задачі одним рядком із причиною, разом із виправленням застарілого «`no-unused-vars`» (майстер §2 й). Норма 0/3 — М5.
- [ ] **Step 3:** Звіт приймання М1: таблиця «рядок матриці → тест → мутація → результат» для І1–І8, І10–І25 (перенесені операції), І27–І30, І33 (товар), І36, І37, плюс Review Focus 1–5 із назвами тестів. Commit `docs(multilingual): канон перекладів і реєстру операцій, закриття М1`.

**Приймання хвилі Т і М1 архітектором** — СТОП.

---

## Review Focus (М1)

Рядки 1–5 майстер-плану §7 цілком належать М1. Тести:
1. `languages-add-concurrency.test.ts` — Task 6;
2. `url-paths.test.ts` + `slug-tokens.test.ts` — Task 5;
3. `idempotency.test.ts` — Task 7;
4. `translation-race.test.ts` — Task 11;
5. `product-page-html.test.tsx` + `path-normalize.test.ts` — Task 15.
