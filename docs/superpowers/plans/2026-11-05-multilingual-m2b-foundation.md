# Мультимовність М2, фундамент решти сутностей — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Цей план робить спільні механізми, на яких решта сутностей М2 переходить на переклади короткими однотипними задачами в двох паралельних деревах:
- старт БД з основною мовою магазину;
- фабрика команд перекладних сутностей;
- операція-список;
- реєстр видів адрес;
- спільний UI картки;
- тулінг другого дерева.

Механізм доводить пробна сутність — статуси замовлень.

**Architecture:**
- Сід перекладних системних довідників переїжджає з `0003_seed.sql` у `bootstrapStore`. Його викликає `applyMigrations({ primaryLocale })` після останнього файлу, тож кожен канал накату отримує крок без окремого виклику (майстер Р23).
- Тексти довідників беруться зі статичної частини мовного пакета `content.seed`. Основну мову прод-старт і `db:apply` читають з `simplycms.config.ts` текстовою міткою.
- Загальну механіку агрегата товару (замок кореня й версія, стан текстів, дротові хелпери, хеші, кроки дітей) винесено в `admin-server/impl/translatable/` без зміни поведінки товару (Р20). Товар і нові сутності стоять на тих самих функціях.
- Фабрика `defineTranslatableCommands` видає операції create, get, saveDescription, saveTranslation, deleteTranslation і list. Доменні операції (`setDefault`, `reorder`, remove з охороною) лишаються іменованими.
- `addressing` отримує реєстр видів цілей для наявних видів (товар, модифікація), без зміни SQL і поведінки (Р22). Нові види додає зріз «каталог».

**Tech Stack:** TypeScript 6 strict, Drizzle 0.45 + PostgreSQL 17 (`test:schema`), Zod 4, TanStack Start (serverFn), TanStack DB 1.0 (колекції `admin-data`), React 19, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-14-multilingual-wave-design.md`:
- §5 — що перекладається; §5.1 — неперекладне, зокрема `price_types`; §5.6 — системні довідники;
- §9 — запис перекладних сутностей командами над агрегатом;
- §18.2–18.3 — семантика запису.

**Майстер-план:** `docs/superpowers/plans/2026-10-15-multilingual-wave-master.md`:
- розвилки Р1–Р28, з них для цього плану головні Р20–Р27;
- §3.1 — форма перекладу, версії агрегатів, адреси М2;
- §3.4 — семантика запису;
- §3.6 — створення магазину;
- §4 — І4, І14, І16, І21, І40;
- §5 — рядок М2;
- §6 — процес, включно з раундами й паралельними деревами.

**Доказова база:** `docs/superpowers/research/2026-10-13-multilingual/95-m2-rest-execution-options.md` (§2 факти, §5 схема, §8 питання — їх закриває таблиця Д нижче) і `94-m2-rest-inventory.md`.

Імплементер читає майстер (Р19–Р28, §3.6, §4, §6) і research 95 §2 перед будь-якою задачею. Цей план їх не повторює.

**Шляхи.** Короткі шляхи `src/…`, `test-harness/…`, `migrations/…`, `admin-server/…`, `admin/…`, `admin-data/…`, `storefront/…`, `storefront-routes/…`, `addressing/…`, `translations/…`, `i18n/…`, `schema.ts` відраховуються від `packages/simplycms/` (для `admin-server/`, `admin/`, `addressing/` тощо — від `packages/simplycms/src/`). Шляхи `scripts/…`, `tests/…`, `docs/…`, `eslint*` — від кореня репо. `orient --plan` на цьому плані дає ✗ саме на коротких шляхах і на файлах «Create» — це не дрейф.

**Місце у хвилі.** Це другий план підхвилі М2, після блоку 1 «осі мови» (PR #64). Далі йдуть плани:
- зрізу А «довідники й комерція»;
- зрізу Б «каталог»;
- завершення.

Їх архітектор пише паралельно з виконанням цього плану, на імена з блоків Interfaces нижче. Схему кожної сутності, крім статусів, додає її зріз разом із кодом.

---

## Global Constraints

- **Гілка й дерево:**
  - гілка `claude/multilingual-m2b` від `main` разом із docs-комітами `claude/m2a-closeout`;
  - дерево `/home/vsydorenko/github/simplyCMS`;
  - архітектор приймає в `~/simplycms-accept`;
  - імплементери роблять `git add` лише явних шляхів.
- **Моделі й коміти:**
  - імплементер — `model: sonnet`, рецензенти й верифікатори — `model: opus`, Fable — ніде;
  - коміти задач — локально, логічними комітами (міграція тестів — окремим);
  - після коміту субагента `git log --format=%B main..HEAD | grep -ciE "co-authored|generated with"` = `0`.
- **Доказ задачі:** швидкий ланцюг `format:check → lint → build → typecheck → test` (з `install --frozen-lockfile` першим, якщо правлено `package.json`) + цільові гейти задачі + мутації, які вимагає крок.
  - Повний `pnpm gates` (штамп `.gates-stamp.json` з `head` = голова, усі `ok`) + `pnpm live:smoke` — лише на К-1 і К-2, на тихій машині (`uptime` у звіті). Повтор прогону «до зеленого» не приймається.
  - Задача, що чіпає сід або назви довідників, ганяє `pnpm live:smoke` на своїй К-точці.
- **Раунди (майстер §6):**
  - не більше 3 фікс-раундів на задачу, далі СТОП і питання архітектору;
  - раунд лише з доків — grep по носіях + штамп `pnpm test`, без рецензента Opus;
  - перед диспетчем контролер називає, яке рішення власника вимагає задачу.
- **Виняток baseline:**
  - `schema.ts` → `pnpm db:rebaseline`;
  - ручні `0002_grants` / `0003_seed` / `0004_functions`;
  - `test-harness/pg/__tests__/fixtures/grants.ts`;
  - нова функція чи тригер → `functions-allowlist.test.ts`;
  - зміна INSERT-ів сіду → `seed-determinism.test.ts`;
  - далі `pnpm template:sync`, `pnpm test:schema`, рядок `CHANGELOG` «перестворити БД».
- **Без зворотної сумісності.** Знесене ім'я зноситься в задачі, що його замінює, без реекспортів і шимів. Кожне знесене публічне ім'я або змінений публічний контракт — рядок BREAKING у `CHANGELOG.md` `[Unreleased]` у тій самій задачі.
- **Ідентифікатори операцій — публічний контракт (Р16).**
  - Формат — `OPERATION_ID_FORMAT` (`operations/define.ts:7`): префікс сутності в kebab-case, наприклад `order-statuses.saveDescription`.
  - Будь-яка нова операція проходить усі 9 точок з research-звіту фундаменту: опис → барель → `impl/index.ts` → `operations-registry.ts` → обгортка в `admin-server/index.ts` → `pnpm api:snapshot` → мок `admin-server-mock.ts` → (за потреби) `user-accessible-operations.ts` → прибрати замінене ім'я з `eslint-rules/legacy-admin-server-fns.json` явним кроком.
- **Host-копії** правляться лише в `src/`, далі `pnpm template:sync`.
- **Нові тести — за `docs/architecture/test-contours.md` § 0.** Мутація — лише для рядків матриці (І4, І14, І40), гейтів (сканери, тести реєстру) і гонок.
- **Розмір модуля** — до ~150 рядків. У звіті — `wc -l` змінених файлів коду.
- **Лінт** — 0 errors / 0 warnings.

## Рішення рівня плану (у межах майстра; архітектор бачить на прийманні)

| # | Питання | Рішення |
|---|---|---|
| Д1 | Де `bootstrapStore` (research 95 §8.3) | `packages/simplycms/src/migrate/bootstrap.ts`, сирий SQL через `pg.Client` накату, без Drizzle й без `simplycms/translations`. Мовні пакети — через новий вузький субшлях `simplycms/i18n/packs` (`exports` пакета + `published-exports-parity`), бо барель `simplycms/i18n` тягне React. Тір-зона `migrate` отримує виняток `i18n/packs` поруч із `db/lock-keys` (`eslint.tier-zones.mjs:176`, дзеркало `tests/tier-boundary/zones.ts:77`) |
| Д2 | Тексти довідників у пакеті | Обов'язкове поле `LanguagePack.content.seed: SeedTexts` — статичне, не лінивий `import()`: bootstrap синхронний у процесі накату. Тестові пакети (`test-harness/language-packs.ts`) позичають `content` у пакета-джерела |
| Д3 | Що сіє bootstrap | Мову (`code` = `primaryLocale`, `name` = `pack.name`, `published`, `is_default`). Вид ціни `retail` і категорію покупця `retail` з назвами з пакета. 6 статусів замовлень (до Task 7 — назва в базовій колонці, після — рядок перекладу). Профіль магазину — до зрізу А рядок `system_settings` `store_profile` з `name` з пакета. Основну зону доставки з назвою з пакета. Id, коди, кольори, порядок і `is_default` — дослівно з `0003_seed.sql` на `071d2a03`. У `0003` лишаються `system_settings.stock_management`, `cache_generations`, `themes` |
| Д4 | Пакет для мови | `findLanguagePack(primaryLocale)` — точний код або базова мова (`pt-BR` → `pt`). Немає → відмова з переліком `listLanguagePacks()`. Рядок `languages.code` — значення з конфігу, тексти — зі знайденого пакета |
| Д5 | Перелік мов у `create-simplycms-store` | Статичний `SUPPORTED_LOCALES` у скаффолдері (`uk`, `en`): він запускається до `install` і ядра не бачить. Тест парності в монорепо звіряє його з `listLanguagePacks()`. Шаблон тримає конкретне `primaryLocale: 'uk'`, а скаффолдер переписує його за міткою. Плейсхолдера немає, бо скретч пілота обходить `scaffold()`. `--yes` без `--locale` → помилка: мовчазний `uk` суперечив би спеці §5.6 |
| Д6 | `primaryLocale` в `applyMigrations` | Опційне поле: `undefined` = без bootstrap. Тести міграцій лишаються на чистому накаті без правок. Обов'язковість тримають прод-старт і `db:apply` (мітки немає → відмова) |
| Д7 | Версія й доменні операції (§8.1) | Будь-яка команда, що пише рядок кореня, піднімає `version` кожного зміненого кореня, включно з `setDefault` (обидва рядки) і `reorder` (обидва рядки). `expectedVersion` перевіряється для цільового кореня команди |
| Д8 | Замок кореня (§8.2) | Одна реалізація `lockRoots` у `translatable/roots.ts`: спільний `languages-set` → корені `ORDER BY id FOR <strength>`. Товарний `lockAggregateRoots` делегує їй. Сканер `aggregate-lock-order.test.ts` перевіряє `roots.ts` і делегування з негативними контролями. Config-замки (`db/lock-keys.ts:47-62`) статусів не стосуються; правило «config-замок → `languages-set` → корені» для доставки й знижок фіксує план зрізу А |
| Д9 | Що в фабриці зараз | Лише те, що бере пробна сутність: create, get, saveDescription, saveTranslation, deleteTranslation, list. Опції `singleton` і `afterWrite` додає зріз А, `address` і `steps` — зріз Б. Remove, `setDefault` і `reorder` — іменовані операції сутності |
| Д10 | Вихід операції-списку | Рядок `readModel` ресурсу (`name` основної мови через INNER JOIN), `id`, `version`, базові поля без часових міток. Якщо зрізу потрібна дата, кодек «рядок ISO на дроті → `Date` у `queryFn` колекції» додає той зріз (`AGENTS.md`: «рядком лише на межі виводу») |
| Д11 | Тести реєстру перекладів | (а) Кожна таблиця з підключеним тригером І4 є в `TRANSLATABLE`. (б) Кожен запис із непорожнім `required` має тригер. (в) Гранти таблиці перекладу = гранти її `base`. Поля `condition` в реєстрі немає: значення властивостей (`required: []`, тригер з умовою `value_kind=text`) проходять (а) і не підпадають під (б) |
| Д12 | `resolvePath` / `resolveToken` | Зносяться: споживачів поза тестами немає (research фундаменту). Тести `url-paths.test.ts:170-178`, `slug-tokens.test.ts:176-183` читають `currentPaths` і SQL. BREAKING для субшляху `simplycms/addressing` |
| Д13 | Форма відмови `language_incomplete` | `IncompleteItem` → `{ kind; id; stage }`. Сегмент шляху помилки береться з реєстру видів (`pathSegment`). Для товару й модифікації шлях лишається `['products', <id товару>, <stage>]` — дротовий контракт не змінюється |
| Д14 | Право статусів | Команди запису — `catalog.write`, як зараз (`order-statuses/resource.ts:18`). `order-statuses.list` і `.get` — з тим самим правом, що в наявного `listOrderStatuses`, без розширення доступу. Зміна права — не цей план |
| Д15 | Читання статусу на вітрині | Нова функція `translatedFieldSql(spec, field, owner, text): SQL` у `simplycms/translations/read.ts`. Це скалярний підзапит `coalesce(мова, основна)`, що вкладається в Drizzle-select: читачі замовлень — `.leftJoin`-білдер, тож `withFallback.joinOn` туди не лягає. Параметр псевдоніма `withFallback` (Р28) і дозвіл `translations` для `commerce`/`site` робить зріз А, бо їхній перший споживач — `discount-rules` і `shipping-directory` |

## Review Focus

1. Магазин з `primaryLocale: 'en'` після bootstrap не має жодного кириличного тексту в довідниках. Перевірка — тест у Task 2.
2. Повторний `db:apply` чи прод-старт на заповненій БД зі зміненим `primaryLocale` у конфігу нічого не переписує, а `doctor` попереджає. Перевірка — тести в Task 2 і Task 3.
3. Зустрічні `setDefault` і `reorder` статусів не дають 40P01, дефолт лишається рівно один. Перевірка — тест гонки в Task 7.
4. Видалення статусу, на який посилається замовлення, дає 409 `reference`, а не 500. Перевірка — тест у Task 7.
5. Вітрина з мовою, якої немає в перекладі статусу, показує назву основною мовою, а не порожнє поле. Перевірка — тест у Task 7.
6. Друге дерево з власним `HARNESS_PREFIX` не чіпає Mailpit і Postgres першого. Перевірка — тест у Task 1.

---

### Task 1: Тулінг другого дерева

**Files:**
- Modify: `scripts/harness-env.mjs:16-45` (ім'я контейнера з `.env.harness` або `HARNESS_PREFIX`, не літерал), `scripts/harness-up.mjs:23-56` (пише в `.env.harness` рядок `HARNESS_PG_CONTAINER=<prefix>-pg`)
- Modify: `docs/development/TOOLING.md` — розділ «Друге дерево» (`HARNESS_PREFIX`, порти `HARNESS_PG_PORT`/`HARNESS_GARAGE_PORT`/`HARNESS_SMTP_PORT`/`HARNESS_MAILPIT_PORT`, власний Mailpit, індекс `codebase-memory` на дерево)
- Test: `tests/harness-env.test.ts` (новий або наявний — звір)

**Interfaces:**
- Produces: `harnessContainerName(env: Record<string, string | undefined>, envFile: Record<string, string> | null): string` у `scripts/harness-env.mjs`. Пріоритет — `envFile.HARNESS_PG_CONTAINER`, потім `${env.HARNESS_PREFIX ?? 'simplycms-harness'}-pg`.

- [ ] **Step 1: Тести.**
  - `harnessContainerName({}, null)` → `'simplycms-harness-pg'`;
  - `harnessContainerName({ HARNESS_PREFIX: 'm2b-a' }, null)` → `'m2b-a-pg'`;
  - `harnessContainerName({}, { HARNESS_PG_CONTAINER: 'm2b-a-pg' })` → `'m2b-a-pg'`;
  - `.env.harness` дерева з префіксом `m2b-a` підхоплюється, коли запущено `m2b-a-pg`, навіть якщо `simplycms-harness-pg` не запущено (шпигун на `containerRunning`).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Реалізація за Interfaces.
- [ ] **Step 4:** PASS, плюс ручний доказ у звіті:
  - `HARNESS_PREFIX=m2b-probe HARNESS_PG_PORT=54431 HARNESS_GARAGE_PORT=4292 HARNESS_SMTP_PORT=54425 HARNESS_MAILPIT_PORT=54426 pnpm harness:up` піднімає три контейнери з префіксом;
  - `docker ps --format '{{.Names}}'` показує їх поруч із дефолтними;
  - прибирання — `docker rm -fv m2b-probe-pg m2b-probe-garage m2b-probe-mailpit`.
- [ ] **Step 5:** Швидкий ланцюг; коміт `chore(harness): ім'я контейнера з префіксу дерева`.

---

### Task 2: Старт БД — `SYSTEM_SEED_IDS`, тексти довідників у пакеті, `bootstrapStore`

**Files:**
- Modify: `packages/simplycms/src/schema/seed-ids.ts` — `SYSTEM_SEED_IDS`; `MAIN_SHIPPING_ZONE_ID` зноситься, 7 файлів-споживачів переходять на `SYSTEM_SEED_IDS.mainShippingZone`; константа скрипта `scripts/live-smoke/admin-shipping-sql.mjs` лишається, бо `.mjs` не імпортує TS, а її парність стереже `seed-ids.test.ts`
- Modify: `packages/simplycms/src/i18n/types.ts:75-80` (`content.seed`), `src/i18n/packs/uk.ts`, `src/i18n/packs/en.ts`, `test-harness/language-packs.ts`; `package.json` `exports` — `simplycms/i18n/packs`
- Create: `packages/simplycms/src/migrate/bootstrap.ts`
- Modify: `packages/simplycms/src/migrate/apply.ts:32-110` (опція, крок між циклом файлів і `GRANT_JOURNAL_SQL`, поле звіту), `src/migrate/index.ts`
- Modify: `packages/simplycms/migrations/0003_seed.sql` — лишаються `stock_management`, `cache_generations`, `themes`; коментар-шапка пояснює, куди пішло решта (Р23)
- Modify: `test-harness/pg/apply.mjs:23` (`applyCanon` → `primaryLocale: 'uk'`; новий `applyCleanCanon`), `scripts/demo-db.mjs:75-84` (`primaryLocale: 'uk'`)
- Modify: `eslint.tier-zones.mjs:176`, `tests/tier-boundary/zones.ts:77`
- Modify (тести, що чекали сід у `0003`): `baseline.test.ts:249-305` (чистий накат: статусів 0, `settings` 1; після bootstrap: 6 і 2), `seed-determinism.test.ts:21-24` (`0003` → 3 INSERT-и), `src/schema/__tests__/seed-ids.test.ts`, `demo-seed.test.ts:64-69` (коментар джерела), `migrate-store-facts.test.ts`
- Test: `packages/simplycms/test-harness/pg/__tests__/bootstrap-store.test.ts` (І40), `src/i18n/packs/__tests__/packs.test.ts`

**Interfaces:**
- Produces:
  - `SYSTEM_SEED_IDS` (`as const`):
    - `language`;
    - `orderStatuses: { new; confirmed; processing; shipped; delivered; cancelled }`;
    - `priceTypeRetail`;
    - `customerCategoryRetail`;
    - `storeProfileSetting` (`00000005-…003`);
    - `mainShippingZone`.

    Значення — id з `0003_seed.sql` на `071d2a03`.
  - `SEED_ORDER_STATUS_CODES = ['new', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const` і `type SeedOrderStatusCode` у `seed-ids.ts`. Це коди сіду; системні коди `ORDER_STATUS_CODE` (`contracts/order-status-codes.ts`: лише `new`, `cancelled`) не змінюються.
  - `type SeedTexts = { readonly orderStatuses: Readonly<Record<SeedOrderStatusCode, string>>; readonly priceTypeRetail: string; readonly customerCategoryRetail: string; readonly mainShippingZone: string; readonly storeName: string }`.
  - `uk`: тексти дослівно з `0003` («Новий», «Підтверджено», «В обробці», «Відправлено», «Доставлено», «Скасовано», «Роздрібна», «Роздріб», «Основна зона», «Мій магазин»). `en`: `New`, `Confirmed`, `Processing`, `Shipped`, `Delivered`, `Cancelled`, `Retail`, `Retail`, `Main zone`, `My store`.
  - `bootstrapStore(client: pg.ClientBase, primaryLocale: string): Promise<{ seeded: boolean }>`:
    - одна транзакція під `pg_advisory_xact_lock(hashtextextended('languages-set', 0))`;
    - `languages` непорожня → `{ seeded: false }` без запису;
    - без пакета → `Error('[simplycms/migrate] Для основної мови «<code>» немає мовного пакета. Наявні: <коди>.')`.
  - `ApplyOptions.primaryLocale?: string`; `ApplyReport.bootstrapped: boolean`. Крок виконується й тоді, коли `pending` порожній, і не виконується при `dryRun`.
  - `applyCleanCanon(connectionString: string): Promise<void>` у `test-harness/pg/apply.mjs` — для `baseline` і тестів, що перевіряють порожню `languages`.
- Task 3 бере `ApplyOptions.primaryLocale`. Task 7 змінює в `bootstrap.ts` лише вставку статусів: база без `name` + рядок перекладу.

- [ ] **Step 1: Тести.**
  - `bootstrap-store.test.ts` на `applyCleanCanon`:
    - `bootstrapStore(c, 'uk')` → `{ seeded: true }`; мова `uk` `published` `is_default`; 6 статусів з id і кодами `SYSTEM_SEED_IDS`; дефолт — `new`; категорія з `price_type_id` = `priceTypeRetail`; зона `is_default`; профіль `name` = «Мій магазин»;
    - повторний виклик → `{ seeded: false }`, кількість рядків у кожній таблиці та сама;
    - `bootstrapStore(c, 'en')` на новій БД → жоден текст довідників не містить `[А-Яа-яІіЇїЄєҐґ]` (Review Focus 1);
    - `bootstrapStore(c, 'pl')` → відмова з текстом, що містить `uk, en`, і порожня `languages`;
    - `bootstrapStore(c, 'en-GB')` → рядок мови `en-GB`, тексти `en`;
    - два паралельні `bootstrapStore` на одній БД → рівно одна мова (замок).
  - `applyMigrations({ …, primaryLocale: 'uk' })` двічі → другий звіт `applied: []`, `bootstrapped: false`; `applyMigrations({ …, dryRun: true, primaryLocale: 'uk' })` нічого не пише.
  - `shipping-zone-invariant.test.ts` і `languages-invariants.test.ts` зелені на `applyCanon` (з bootstrap).
  - `packs.test.ts`: кожен пакет `listLanguagePacks()` має `content.seed` з усіма 6 кодами й непорожніми рядками.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Реалізація за Interfaces і Д1–Д4, Д6.
- [ ] **Step 4:**
  - PASS;
  - `pnpm test:schema` зелений;
  - `git grep -n "MAIN_SHIPPING_ZONE_ID" -- packages scripts` → лише константа скрипта live-smoke і її тест;
  - `git grep -nE "'Новий'|'Роздріб'|'Основна зона'|Мій магазин" -- packages/simplycms/migrations/0003_seed.sql` → порожньо.
- [ ] **Step 5: Мутації й коміт.**
  - Мутації:
    - прибрати перевірку «`languages` непорожня» → повторний bootstrap червоний;
    - зняти замок → тест паралельного bootstrap червоний (або доказ, що без замка він флейкує, з числом прогонів).
  - `CHANGELOG`:
    - «перестворити БД»;
    - BREAKING: `MAIN_SHIPPING_ZONE_ID` → `SYSTEM_SEED_IDS.mainShippingZone`;
    - BREAKING: `LanguagePack.content.seed` обов'язкове;
    - новий субшлях `simplycms/i18n/packs`.
  - Канон `docs/architecture/data-layer.md` (розділ сіду: `0003` + bootstrap) і `test-contours.md` (`applyCanon` проти `applyCleanCanon`).

---

### Task 3: Основна мова магазину — конфіг, прод-старт, `db:apply`, `doctor`, `create-simplycms-store --locale`

**Files:**
- Modify: `packages/simplycms/src/runtime/config.ts` (`SimplyCmsConfig.primaryLocale: string` — обов'язкове), кореневий `simplycms.config.ts`, `packages/create-simplycms-store/template/simplycms.config.ts`, `tests/pilot/store-template/*` (якщо має конфіг)
- Create: `packages/simplycms/src/migrate/primary-locale.ts` (експорт з `migrate/index.ts`)
- Modify: `src/prod-start/run-start.ts:7-12,60-90` і `start-store.ts:21-29` (читає `join(cwd, 'simplycms.config.ts')`, передає `primaryLocale`), `packages/cli/src/db-apply.mjs:49,63-80` (теж), `tests/cli-db-apply.test.ts`
- Modify: `src/migrate/store-facts.ts:4-26` (`StoreFacts.primaryLocale`), `packages/cli/src/doctor-language-check.mjs` (нова перевірка), `doctor-checks.mjs:184` (мітка `primaryLocale:`), тести `tests/cli-language-check.test.ts`, `tests/cli-doctor.test.ts`
- Modify: `packages/create-simplycms-store/src/{args,steps,scaffold,index}.mjs`; Create: `packages/create-simplycms-store/src/locales.mjs`; тести `tests/create-store-cli.test.ts`, новий `tests/create-store-locales-parity.test.ts`; `scripts/pilot-pack/create-pkg-smoke.mjs:106` (`--locale uk`)
- Modify: `packages/simplycms/skills/simplycms-onboarding/SKILL.md:26-28`, `references/requirements.md:5-14`, `references/local.md:10`, `references/dokploy.md:34-38`; `docs/architecture/cli.md`; `pnpm template:sync`

**Interfaces:**
- Consumes: `ApplyOptions.primaryLocale` (Task 2), `listLanguagePacks()`.
- Produces:
  - `readPrimaryLocale(source: string): string | null` — регекс однорядкової мітки `primaryLocale:\s*'([^']+)'`, патерн `config-edit.mjs`;
  - прод-старт і `db:apply`: мітки немає → відмова `[simplycms] У simplycms.config.ts немає primaryLocale: '<код>'. Додайте основну мову магазину.` (накат не починається);
  - `StoreFacts.primaryLocale: string | null` (`select code from public.languages where is_default`);
  - перевірка `doctor` `id: 'primary-locale'`: конфіг ≠ БД → `warn` з обома значеннями; збіг → `ok`; БД порожня → `ok`;
  - `create-simplycms-store`: `--locale <code>`, `CliOptions.locale?: string`, `SUPPORTED_LOCALES: readonly string[]` у `src/locales.mjs`. Інтерактивно — select з `SUPPORTED_LOCALES`; `--yes` без `--locale` → помилка; невідомий код → помилка з переліком.

- [ ] **Step 1: Тести.**
  - `readPrimaryLocale` (юніт): `primaryLocale: 'en'` → `'en'`; немає → `null`; `primaryLocale: "en"` → `null` (мітка — лише одинарні лапки, як у шаблоні).
  - `cli-db-apply.test.ts`: конфіг без мітки → відмова до виклику `applyMigrations`; з міткою → фейк `applyMigrations` отримав `primaryLocale`.
  - prod-start (наявний тест `run-start`): без мітки й з `MIGRATION_DATABASE_URL` → відмова; без `MIGRATION_DATABASE_URL` → накат і bootstrap пропущено, як зараз.
  - `doctor`: конфіг `en`, БД `uk` → `warn`; збіг → `ok` (Review Focus 2).
  - `create-store-cli.test.ts`: `--locale en` → `locale: 'en'`; `--locale` без значення → помилка; `--locale --yes` не ковтає прапорець; `--yes` без `--locale` → помилка; `scaffold` з `locale: 'en'` → `simplycms.config.ts` містить `primaryLocale: 'en'`.
  - `create-store-locales-parity.test.ts`: `SUPPORTED_LOCALES` = коди `listLanguagePacks()`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Реалізація за Interfaces і Д5–Д6.
- [ ] **Step 4:** PASS; `pnpm template:sync` без диффу після; `tests/create-store-template-parity.test.ts` зелений.
- [ ] **Step 5: Коміт і документація.**
  - `CHANGELOG`:
    - BREAKING `SimplyCmsConfig.primaryLocale` обов'язкове;
    - `create-simplycms-store --locale`;
    - `db:apply` і прод-старт створюють основну мову й системні довідники.
  - Скіл онбордингу: питання «основна мова» в прийомі вимог, `pnpm create simplycms-store <тека> --locale <код>`, застереження «мову після створення БД не змінити без перестворення».

**К-1 (контрольна точка):** повний `pnpm gates` + `pnpm live:smoke` на голові після Task 3, на тихій машині.

---

### Task 4: Реєстр перекладів, Drizzle-хелпер, фабрика фікстур

**Files:**
- Create: `packages/simplycms/src/schema/translation-table.ts` (Drizzle-хелпер)
- Modify: `packages/simplycms/src/schema/schema.ts:479-642` — п'ять таблиць товару через хелпер
- Create: `packages/simplycms/src/domain/translations/entities.ts` (клієнтобезпечні поля сутностей: `fields`, `required`, `richHtml`, `fieldToWire`)
- Modify: `src/translations/specs.ts` (`TranslatableEntity.base`; поля — з `domain/translations/entities.ts`; `fieldToWire` переїжджає), `src/admin/features/products/edit/product-form-schema.ts:5-11` (перелік полів — з домену)
- Test: `src/translations/__tests__/specs.test.ts` (Д11 а–в), `test-harness/pg/__tests__/translation-registry.test.ts` (новий; читає тригери з `pg_trigger`, гранти з `information_schema.role_table_grants`)
- Create: `test-harness/pg/__tests__/fixtures/translatable-rows.ts`; Modify: `fixtures/product-graph-rows.ts` (`textRow` → обгортка над загальною)
- Modify (механічно): 14 файлів із літеральними id сіду `0000000{1,4,7}-…` → `SYSTEM_SEED_IDS` (перелік — research 95 §2.6; знайти `git grep -nE "0000000[147]-0000-4000-8000-"`)

**Interfaces:**
- Produces:
  - `translationTable<TName extends string, TOwner extends Record<string, PgColumnBuilderBase>, TText extends Record<string, PgColumnBuilderBase>>(name: TName, spec: { owner: TOwner; pk: readonly (keyof TOwner & string)[]; ownerFks: readonly OwnerFk[]; text: TText; checks?: (t) => readonly Check[] })`. Повертає результат `pgTable` з `locale`, `source_hashes`, `updated_at`, FK `<name>_locale_fkey` → `languages.code` `RESTRICT`, `idx_<name>_locale`, CHECK `<name>_source_hashes_object`, PK `<name>_pkey`. Імена FK власника — явні в `ownerFks` (вивести їх механічно не можна: `…_modification_fkey`, `…_image_id_fkey`).
  - `TranslatableEntity { …TranslatableSpec; table: string; fk: string; base: string }`; `type TranslatableKey = keyof typeof TRANSLATABLE`.
  - `TRANSLATABLE_FIELDS` у `simplycms/domain/translations` (ключі = ключі `TRANSLATABLE`) і `fieldToWire(field: string): string` там само.
  - `textRowOf(columns: Readonly<Record<string, string>>, texts: Readonly<Record<string, string | null | undefined>>): Row` і `translatableStatements(spec: { table: string; base: Row; translationTable: string; ownerColumn: string; id: string; texts: Readonly<Record<string, Readonly<Record<string, string | null | undefined>>>>; textColumns: Readonly<Record<string, string>> }): string[]`. Основна мова позначається ключем `PRIMARY`, оператори йдуть ОДНИМ блоком через `inLockedBlock`.
- Зрізи беруть `translationTable`, `TRANSLATABLE_FIELDS`, `translatableStatements` як є.

- [ ] **Step 1: Тести.**
  - `specs.test.ts`: для кожного запису `TRANSLATABLE` `base` — наявна таблиця схеми; поля `TRANSLATABLE` = `TRANSLATABLE_FIELDS`.
  - `translation-registry.test.ts`:
    - (а) таблиці з тригером `*_src_tr` ⊆ `TRANSLATABLE[*].table`;
    - (б) запис із непорожнім `required` → тригер є;
    - (в) гранти `(роль, привілей)` таблиці перекладу = гранти `base`.
  - Тип: `expectTypeOf(productTranslations.$inferSelect)` має `productId: string`, `locale: string`, `name: string | null`, `sourceHashes: Record<string, string>`.
  - Фабрика фікстур: наявні тести товару зелені без правок; новий юніт `translatableStatements` — один `do`-блок з INSERT бази й рядком основної мови `(select code from public.languages where is_default)`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Реалізація за Interfaces і Д11.
- [ ] **Step 4:** PASS; `tests/rebaseline-drizzle.test.ts` і `tests/schema-sources-parity.test.ts` зелені БЕЗ регенерації `drizzle/` і `0001_init.sql`. Нульовий дифф SQL — доказ того, що хелпер нічого не змінив. Якщо дифф ненульовий, СТОП: хелпер змінив схему.
- [ ] **Step 5: Мутації й коміт.**
  - Мутації:
    - прибрати рядок товару з `TRANSLATABLE` → (а) червоний;
    - прибрати грант `app_user` з `product_translations` у `0002` → (в) червоний.
  - Логічні коміти: хелпер; реєстр і тести; фабрика фікстур; механічна заміна id.

---

### Task 5: Спільні ядра агрегата

**Files:**
- Create: `packages/simplycms/src/admin-server/impl/translatable/{roots,state,wire,hashes,steps}.ts` (кожен ≤150 рядків)
- Modify: `admin-server/impl/products/aggregate/{lock-order,version,load,children-status,schemas,save-translation,children-common,create,save-description,operations}.ts` — делегують спільним; експорт `lockProduct` з `aggregate/load.ts` лишається (його імпортують pg-тести)
- Modify: `admin-server/impl/__tests__/aggregate-lock-order.test.ts` (Д8)

**Interfaces:**
- Produces (`admin-server/impl/translatable/`):
  - `interface AggregateRoot { readonly table: PgTable; readonly id: PgColumn; readonly version: PgColumn; readonly touch?: PgColumn; readonly label: string }`. `touch` — колонка `updated_at`, якщо вона є.
  - `lockRoots(db: ActorDb, root: AggregateRoot, ids: readonly string[], strength: 'no key update' | 'update'): Promise<Map<string, number>>` і `lockRoot(db, root, id, strength): Promise<number>`. Рядка немає → `AdminNotFoundError(root.label)`.
  - `bumpVersion(db: ActorDb, root: AggregateRoot, id: string, base?: Readonly<Record<string, unknown>>): Promise<number>`.
  - `loadTextState(db: ActorDb, spec: TranslatableEntity, id: string): Promise<{ primary: ContentLocale; source: StoredTranslation | null; byLocale: Map<string, StoredTranslation> }>`.
  - `textStatuses(spec: TranslatableSpec, rows: ReadonlyMap<string, StoredTranslation> | undefined, primary: string)` — одна функція замість `load.ts:70-92` і `children-status.ts:16-53`, з адаптером під форму `products.get`.
  - `toPatch(spec, texts)`, `toPatchMap(spec, texts)`, `fromWireKeys(spec, record, at)`, а також перенесені без змін `toWireKeys`, `remapPlanIssues`, `expectedVersion`, `versionOut`; будівник `textsRowSchema(texts: z.ZodObject<z.ZodRawShape>): z.ZodObject<z.ZodRawShape>` — поля nullable + `status` + `fieldStatus`.
  - `requireHashes(spec, patch, expected, source): void`.
  - `Step`, `NOOP`, `fail`, `knownLocales`, `assertKnownLocales`, `requireLocales(ctx: { locales: ReadonlySet<string> }, map, at)`, `requireDistinct`, `uuidArray`.

  `ChildCtx` лишається в товарі.

- [ ] **Step 1: Тести.** Нових тестів поведінки немає: доказ — незмінні тести товару. `aggregate-lock-order.test.ts` переписаний за Д8: (1) у `roots.ts` `advisoryXactLockShared(db` стоїть перед `.for(strength)` з `orderBy(id)`; (2) товарний `lockAggregateRoots` викликає `lockRoots(` з корінням товару і не має власного `.for(`.
- [ ] **Step 2:** Сканер червоний до переносу (позитивний контроль).
- [ ] **Step 3:** Перенос за Interfaces, товар делегує.
- [ ] **Step 4:** PASS. Без правок зелені такі тести:
  - pg: `product-aggregate`, `product-aggregate-children`, `product-aggregate-http`, `product-create-images`, `product-remove-media`, `aggregate-language-locks`, `catalog-projection-{locks,order,parity}`, `translation-race`, `translations-hash-keys`, `source-translation-required`;
  - юніти: `products-get-authz`, `registry-parity`, `modifications-deleter`;
  - `openapi-snapshot.test.ts` — без `pnpm api:snapshot` (дротовий контракт товару не змінився).
- [ ] **Step 5: Мутації й коміт.**
  - Мутації сканера (кожна → червоний, відкат → зелений):
    - переставити замок `languages-set` після коренів;
    - прибрати `orderBy`;
    - повернути власний `.for(` у товарний файл.
  - Коміт `refactor(admin-server): спільні ядра перекладного агрегата (товар без зміни поведінки)`.

---

### Task 6: Спільний UI-набір перекладної картки

**Files:**
- Create: `packages/simplycms/src/admin/features/translations/{texts-form,texts-diff,texts-rebase,texts-errors,useTranslatableTexts}.ts`
- Modify: `admin/features/translations/PathField.tsx:3,13,41` (команда інжектується)
- Modify: `admin/features/products/edit/{product-aggregate,product-diff,product-rebase,save-errors,useProductCardState,ProductMainFields,ProductSeoFields}.ts(x)` — текстова частина делегує спільним
- Test: `admin/features/translations/__tests__/*` (нові юніти функцій), наявні тести картки товару

**Interfaces:**
- Consumes: `TRANSLATABLE_FIELDS`, `fieldToWire` (Task 4).
- Produces (`admin/features/translations/`):
  - `localeStatusesOf(texts: Readonly<Record<string, { status: string; fieldStatus: Readonly<Record<string, string>> }>>): Record<string, LocaleStatuses>`;
  - `textsToForm<F extends string>(fields: readonly F[], texts, locales: readonly string[]): Record<string, Record<F, string>>`;
  - `textsDiff<F extends string>(fields: readonly F[], before, after): Record<string, Partial<Record<F, string | null>>>`;
  - `rebaseTexts<F extends string>(fields: readonly F[], fresh, sent, now)`;
  - `textsErrorField(path: readonly (string | number)[]): string | null` (`texts.<мова>.<поле>` → ім'я поля форми);
  - `PathField` з пропсом `command: (a: { data: { id: string; locale: string; path: string; expectedVersion: number } }) => Promise<{ version: number }>` замість прямого `setProductPath`;
  - `useTranslatableTexts<F extends string>(opts: { fields: readonly F[]; primary: string; languages: readonly LanguageInfo[]; aggregate: { version: number; texts: … } | undefined; refetch: () => Promise<unknown> })` → `{ form; active; setActive; statuses; conflict; setConflict; reload; errorLocales }`.

  Хук працює всередині `AggregateVersionContext.Provider` і в сторінці, і в діалозі.

- [ ] **Step 1: Тести.**
  - Юніти функцій на двох наборах полів: товару (`name`, `shortDescription`, `description`, `metaTitle`, `metaDescription`) і однопольному (`name`):
    - diff не надсилає незмінене поле;
    - rebase не затирає локальну правку;
    - помилка `['texts','en','name']` → поле `name`, вкладка `en`.
  - Наявні тести картки товару — без правок.
- [ ] **Step 2:** FAIL нових юнітів.
- [ ] **Step 3:** Винесення за Interfaces; картка товару на набір.
- [ ] **Step 4:** PASS; тести `admin/features/products/**` зелені без правок, крім імпортів.
- [ ] **Step 5:** Коміт `refactor(admin): спільний набір перекладної картки (товар без зміни поведінки)`.

---

### Task 7: Фабрика команд, операція-список і пробна сутність «статуси замовлень» (точка рішення Р19)

**Files:**
- Create: `packages/simplycms/src/admin-server/impl/translatable/{commands,create,save-description,save-translation,delete-translation,list}.ts`
- Modify: `admin-server/impl/resource.ts:118-139` (`listIn`)
- Modify (схема): `schema.ts:74-88` — `order_statuses` без `name`, з `version integer NOT NULL DEFAULT 1`; нова `order_status_translations(name)` через `translationTable`; `0002_grants.sql:73,170` (ті самі гранти), `fixtures/grants.ts:31`, `0004_functions.sql` (`CALL attach_source_translation_triggers('public.order_statuses'::regclass, 'public.order_status_translations'::regclass, 'status_id', ARRAY['name'])`), `functions-allowlist.test.ts`, `baseline.test.ts:163` (кількість таблиць +1); `TRANSLATABLE.orderStatus` + `TRANSLATABLE_FIELDS.orderStatus`
- Modify: `src/migrate/bootstrap.ts` (статуси з перекладом)
- Create/Modify: `admin-server/impl/order-statuses/{commands,remove,reorder,set-default,resource}.ts`; `impl/index.ts`, `operations-registry.ts`, `admin-server/index.ts`, `admin-server/__tests__/support/admin-server-mock.ts`, `api/openapi.core.json` (`pnpm api:snapshot`), `eslint-rules/legacy-admin-server-fns.json` (6 імен статусів — геть)
- Modify (адмінка): `admin-data/collections/order-statuses.ts` (лише читання), `admin/features/order-statuses/{useOrderStatusesPage,useStatusPersist,StatusFormDialog}.ts(x)`, каталоги `i18n/catalogs/{uk,en}/admin/*` (вкладки мов статусу)
- Modify (вітрина): `src/translations/read.ts` (Д15), `storefront/loaders/{order-statuses,orders}.ts`, `loaders/entities/order.ts`, serverFn `storefront-routes/server/{profile-orders,profile,order-view}.ts` (`localeOnlyInput` + `resolveTextLocale`), ключі кешу `ProfileOrders.tsx`, `Profile.tsx`, `ProfileOrderDetail.tsx`, `OrderSuccess.tsx` (сегмент `ContentLocale`)
- Modify (тести, що брали `order_statuses` як загальну фікстуру фабрики): `resource.test.ts:24-34,106-128`, `resource-lock-guard.test.ts:50-59`, `subset.test.ts:28-31` → на `price_types` (вона лишається з `name`, Р26)
- Modify: `single-default.test.ts:50-52`, `admin-order-statuses.test.ts`, `scripts/live-smoke/sql.mjs:131`, `admin-save-return-orders.mjs:33` (читають назву з перекладу)
- Test: `admin-server/impl/translatable/__tests__/commands.test.ts` (юніт форми операцій), pg `order-statuses-aggregate.test.ts` (новий), `source-translation-required.test.ts` (рядок статусів), `storefront-order-status-locale.test.ts` (новий)

**Interfaces:**
- Consumes: усе з Task 5, `translationTable` і `TRANSLATABLE_FIELDS` (Task 4), `useTranslatableTexts` (Task 6), `bootstrapStore` (Task 2).
- Produces:
  - `defineTranslatableCommands(cfg: { entity: TranslatableKey; root: AggregateRoot; idPrefix: string; permission: Operation; texts: z.ZodObject<…>; base: z.ZodObject<…>; createOnly?: z.ZodObject<…>; resource: AdminResourceOps<PgTable> }): { create; get; saveDescription; saveTranslation; deleteTranslation; list }`.
    - Кожне значення — `OperationDef` з id `${idPrefix}.<ім'я>`.
    - Форма входу й виходу кожної команди — дзеркало відповідної операції товару (`products/aggregate/create.ts`, `save-description.ts`, `save-translation.ts`, `operations.ts` → `deleteTranslation`) без товарних полів (діти, адреса, проєкція, ціни).
    - `id` генерує викликач, create має `idempotent: 'create'`, команди запису — `versioned: true`.
    - Перевірка обов'язкових полів основної мови на create — за `spec.required`, а не жорстко `name` (`create.ts:84-95`).
  - `list` — вхід `subsetInputSchema` (eager шле `{}`), вихід за Д10, `run: ({ db }, i) => cfg.resource.listIn(db, i.subset ?? {})`.
  - `listIn(db: ActorDb, subset: SubsetInput): Promise<…>` у результаті `defineAdminResource` (тип `AdminResourceOps`, `impl/resource.ts:147`), поруч з `insertIn`/`updateIn`/`removeIn`; рядок — той самий, що віддає `list` ресурсу з `readModel`.
  - Операції статусів: `order-statuses.list`, `.get`, `.create`, `.saveDescription`, `.saveTranslation`, `.deleteTranslation` (фабрика); `.remove`, `.setDefault`, `.reorder` (іменовані, `lockRoots` по відсортованих id, `version` за Д7).
    - Тонкі обгортки: `listOrderStatuses`, `getOrderStatus`, `createOrderStatus`, `saveOrderStatus`, `saveOrderStatusTranslation`, `deleteOrderStatusTranslation`, `removeOrderStatus`, `setDefaultOrderStatus`, `reorderOrderStatus`.
    - База статусу: `color`, `sortOrder`; `createOnly`: `code`; тексти: `name`.
    - Remove: охорона дефолтного й системних кодів як зараз (`remove.ts:21-57`), посилання з `orders` → 409 `reference` (Review Focus 4).
  - `translatedFieldSql(spec: TranslatableEntity, field: string, owner: SQL, text: TextLocale): SQL` у `simplycms/translations`.

- [ ] **Step 1: Тести.**
  - `commands.test.ts` (юніт): id операцій статусів відповідають `OPERATION_ID_FORMAT`; команди запису `versioned`; `create` без рядка основної мови → `ValidationError` з шляхом `texts.<primary>.name`.
  - `order-statuses-aggregate.test.ts` (pg, під `app_admin`):
    - create з `uk` і `en` → `get` повертає обидві мови зі статусом `current`;
    - saveDescription лише `uk` → `en` `outdated` (сценарій 1 майстра §3.4);
    - saveTranslation `en` → `current`;
    - deleteTranslation `uk` (основна) → 400;
    - старий `expectedVersion` → 412;
    - `setDefault(A)` піднімає `version` A і колишнього дефолту;
    - 20 пар паралельних `setDefault(A)` / `reorder(A↔C)` → жодного 40P01, рівно один `is_default` (Review Focus 3);
    - remove статусу з посиланням із `orders` → 409 `reference`;
    - remove дефолтного → 409.
  - `source-translation-required.test.ts`: вставка статусу без рядка `uk` → відмова на коміті під `app_admin`.
  - `storefront-order-status-locale.test.ts`: замовлення зі статусом без перекладу `en` → у профілі `/en/...` назва `uk` (Review Focus 5); з перекладом → `en`.
  - `bootstrap-store.test.ts` (Task 2) доповнити: статуси мають рядок перекладу основної мови, базова колонка `name` відсутня.
  - Юніти адмінки: діалог статусу показує вкладки мов; збереження кличе `saveOrderStatus` з `expectedVersion`; 412 → `ConflictDialog`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Реалізація за Interfaces, Д7, Д9, Д10, Д14, Д15.
- [ ] **Step 4:**
  - PASS;
  - `pnpm test:schema` зелений;
  - `registry-parity.test.ts` зелений;
  - `git grep -nE "insertOrderStatuses|updateOrderStatuses|removeOrderStatuses" -- packages` → порожньо;
  - `git grep -n "orderStatuses.name\|order_statuses.name\|os.name" -- packages/simplycms/src` → порожньо.
- [ ] **Step 5: Мутації, коміти, документація.**
  - Мутації:
    - прибрати `CALL attach_source_translation_triggers` статусів → `source-translation-required` червоний;
    - прибрати `bumpVersion` з `setDefault` → тест версії червоний;
    - повернути зустрічний порядок замків у `reorder` → тест гонки червоний (число прогонів у звіті).
  - Логічні коміти: фабрика + `listIn`; схема + bootstrap + операції; адмінка; вітрина; міграція тестів.
  - `CHANGELOG`:
    - «перестворити БД»;
    - BREAKING: шість легасі-serverFn статусів → операції `order-statuses.*`;
    - `order_statuses.name` → `order_status_translations`.
  - Канон: `docs/architecture/translations.md` (фабрика, `translatedFieldSql`), `operations-api.md` (операція-список, правило версії Д7).
  - **Звіт для точки рішення Р19:**
    - рядків коду фабрики й рядків коду статусів окремо;
    - кількість фікс-раундів;
    - що в фабриці виявилось незручним для зрізів А і Б.

  Архітектор за цим звітом вирішує В3 або В2 до старту зрізів.

---

### Task 8: Реєстр видів цілей `addressing`

**Files:**
- Create: `packages/simplycms/src/addressing/targets.ts`
- Modify: `addressing/{paths,tokens,copy,copy-candidates,owners,server}.ts`; `admin-server/impl/languages/{fill,completeness}.ts`; `storefront/loaders/address-history.ts:8-100`
- Modify (тести): `url-paths.test.ts:170-178`, `slug-tokens.test.ts:176-183` (Д12)
- Test: наявні pg і юніти адрес (перелік у Step 4), новий юніт `addressing/__tests__/targets.test.ts`

**Interfaces:**
- Produces (`addressing/targets.ts`):
  - `interface PathKindSpec { readonly kind: string; readonly column: string; readonly field: string; readonly rootTable: string; readonly lockChain: readonly string[]; readonly pathSegment: string }` — для товару `{ kind: 'product', column: 'product_id', field: 'productId', rootTable: 'products', lockChain: ['products'], pathSegment: 'products' }`;
  - `interface TokenKindSpec { readonly kind: string; readonly tokenKind: string; readonly column: string; readonly field: string; readonly scopeColumn: 'scope_id'; readonly lockChain: readonly string[]; readonly pathSegment: string }` — для модифікації `{ kind: 'modification', tokenKind: 'modification', column: 'modification_id', field: 'modificationId', lockChain: ['products', 'product_modifications'], pathSegment: 'products' }`;
  - `PATH_KINDS`, `TOKEN_KINDS` (масиви `as const`); `AddressTarget` і `TokenTarget` виводяться з них. `PATH_TARGET_COLUMNS` зноситься;
  - `IncompleteItem { kind: string; id: string; stage: IncompleteStage }` (Д13);
  - резолвер вітрини повертає `AddressResolution & { kind: string; id: string }`;
  - `resolvePath` і `resolveToken` знесено (Д12).
- Зріз Б додає записи `section`, `property`, `option` і поле умовної адреси за Р22; цей план поля умови не вводить.

- [ ] **Step 1: Тести.**
  - `targets.test.ts`: кожен вид має колонку, наявну в `url_paths` чи `slug_tokens` (Drizzle-таблиця), і `lockChain`, що починається з кореня.
  - Тести, що доводять «без зміни поведінки» (Step 4), — без правок, крім Д12.
- [ ] **Step 2:** `targets.test.ts` FAIL.
- [ ] **Step 3:** Параметризація за Interfaces. SQL для товару й модифікації лишається текстово тотожним (підстановка `sql.raw` з реєстру).
- [ ] **Step 4:**
  - PASS без правок:
    - pg: `url-paths`, `slug-tokens`, `addressing-parity`, `languages-add-concurrency`, `languages-fill-{collisions,done,progress}`, `language-completeness`, `language-code-address`, `catalog-projection*`, `storefront-path-normalize`;
    - юніти: `public-names`, `path-normalize`, `entity-route-moved`, `entity-route-match`, `language-incomplete-transport`;
    - `openapi-snapshot.test.ts` без `pnpm api:snapshot`;
  - `git grep -nE "resolvePath|resolveToken|PATH_TARGET_COLUMNS" -- packages` → порожньо.
- [ ] **Step 5: Мутація й коміт.**
  - Мутація: змінити `pathSegment` товару → `language-incomplete-transport` червоний.
  - `CHANGELOG` BREAKING: `resolvePath`, `resolveToken` знесено з `simplycms/addressing`.
  - Коміт `refactor(addressing): реєстр видів цілей (товар і модифікація без зміни поведінки)`.

**К-2 / СТОП:**
- повний `pnpm gates` + `pnpm live:smoke` на голові після Task 8, на тихій машині;
- фінальне рев'ю гілки двома незалежними рецензентами Opus з окремим скептиком на кожну знахідку;
- далі приймання архітектором у `~/simplycms-accept`.

PR — лише за словом власника.
