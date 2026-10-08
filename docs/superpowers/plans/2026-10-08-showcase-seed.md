# Сід вітрини для ручного тестування (`pnpm db:showcase`) — план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Одна команда `pnpm db:showcase` дає локальну демо-базу з правдоподібними даними (каталог із зображеннями, покупці, замовлення за 30 днів, відгуки, знижки, сценарії Е6г), щоб власник і агенти могли клацати адмінку й вітрину без ручного наповнення.

**Architecture:** TS-скрипт `scripts/showcase/*.mts` під `pnpm exec tsx` працює in-process поверх `db:demo`. Покупців реєструє через Better Auth, адмінів — через invite власника, решту даних пише через доменні ядра під `withActor({ role: 'app_admin' })`. Там, де логіка зараз лежить у тілі `runAdmin`, вона виноситься в ядро (операція = `requireGrant` + `withActor` + ядро). Детермінований PRNG задає назви, кількості й дні. Сирих записів SQL у сіді два, обидва позначені: зсув часу (С-3) і схвалення відгуків (С-11).

**Tech Stack:** TypeScript 6 (`tsx` з devDependencies), Better Auth 1.7.7 in-process API, Drizzle, `node:zlib` (PNG), Vitest + PostgreSQL 17 (`pnpm test:schema`).

**Spec:** окремої спеки немає (рішення архітектора С-1…С-9: тулінг, не продукт). Рішення нижче — спека.

**Передумова:** гілка від `main` ПІСЛЯ мержу К3-Е6г (потрібні ядра й операції Е6г). Розвідка — за комітом 1f6fcfac.

> **Статус:** план написано 2026-10-08; С-10…С-15 ухвалено архітектором того ж дня; аудит Codex. **Виконано 2026-10-08** (гілка `claude/showcase-seed`): Task 1–8, рев'ю кожної задачі й фінальне рев'ю гілки. Відкрите — SHOWCASE-2 у роадмапі (розширення переліку колонок С-3, рішення власника).
> **Спеки немає свідомо:** це тулінг, не продукт. Рішення С-1…С-9 нижче виконують роль спеки.
> **Ролі:** архітектор — сесія `dashboard-design-spec`; автор плану — `customers-dashboard-plan`. Запит власника — 2026-10-08.

## Ухвалені рішення

| № | Рішення |
|---|---|
| С-1 | **Межі.** Окрема команда ПОВЕРХ `db:demo`. Гейтові сіди (`0003_seed.sql`, `demo/demo-seed.sql`) і `scripts/dev-stand/*` не чіпаємо. Код живе лише в монорепо (`scripts/showcase/`) і не їде ні в пакети, ні в шаблон магазину (поставку в магазини вирішує власник, не зараз). |
| С-2 | **Через код застосунку, in-process, без HTTP.** Покупці реєструються через `auth.api.signUpEmail`, тож хуки провізії спрацьовують. Решта йде через доменні ядра під `withActor({ role: 'app_admin' })` (прецедент — CLI `owner:invite`). Операції (`*Op`) беруть актора з сесії (`requireGrant`, `admin-server/impl/run.ts:29-44`). Тому логіку з тіла `runAdmin` виносимо в ядро: операція = `requireGrant` + `withActor` + ядро, а сід кличе ядро. 🔴 Жодних seed-гілок і прапорців у продакшн-коді, жодних моків authz у сіді. Ресурси `defineAdminResource` — через операції фабрики (К3-4′). Замовлення — тим самим ядром, що `placeOrder`, гостьові й від покупців. Скасування — тією самою зміною статусу, з поверненням залишку. Видалення покупця — ядром `deleteCustomer`. Як запускати TS із node (dist після `build:packages` чи наявний раннер), вирішує план. Нових runtime-залежностей не додавати. |
| С-3 | **Дати в минулому — не параметром `now`.** Продакшн-API заради сіду не розширюємо. Наприкінці сіду один явний крок «зсув часу»: SQL `UPDATE orders SET created_at/updated_at` (і `user_category_history.created_at`, якщо дашборд чи картка їх показують) з явним переліком колонок. Це єдиний сирий SQL запису в сіді, і він позначений коментарем. День-зсув детермінований, береться з PRNG. Перейменування колонок ловить гейт С-8(г). |
| С-4 | **Обсяг.** Розділи з властивостями, товари з модифікаціями, кілька типів цін, залишки по точках. Знижка «від 3 шт −10%», знижка для категорії «VIP», автоправило категорії. Замовлення з адресною доставкою й самовивозом, у всіх статусах, зокрема `cancelled`, плюс гостьові; розподілені за останні 30 днів. 15–20 покупців у різних категоріях. Сценарії Е6г: один забанений покупець; один покупець із ручною закріпленою категорією; один ВИДАЛЕНИЙ покупець із замовленнями й відгуком. Відгуки. Власник `owner@showcase.test` з фіксованим паролем (друкується в консоль) і другий адмін. Email-и — лише на домені `@showcase.test` (RFC 2606). |
| С-5 | **Зображення генеруються кодом детерміновано:** PNG через `node:zlib` (deflate + crc32), колір і візерунок — із PRNG за товаром. Ні бінарників у репо, ні мережі, ні ліцензійних питань. Завантаження — лише через порт `simplycms/storage`, з коректними рядками `media` і локальним `MEDIA_ROOT`. |
| С-6 | **Детермінованість:** фіксований seed PRNG; однакові назви, email-и, кількості й суми. uuid і абсолютний час детермінованими не робимо: ключ генерує викликач (`randomUUID`), час рахується відносно запуску. |
| С-7 | *(уточнено С-16)* **Захист:** сід працює лише на стані «щойно після `db:demo`», тобто в `users` немає рядків і замовлень немає. Інакше — відмова з поясненням, `--force` немає. Повтор — це `pnpm db:showcase` заново, і команда сама спершу кличе `db:demo`. Ідемпотентність не потрібна, контракт — «лише на чисту». |
| С-8 | **Гейт** (харнес, `test:schema`): (а) накат на чисту БД проходить; (б) два прогони на двох чистих БД дають однаковий нормалізований знімок (без uuid, дати — як день-зсуви); (в) модуль `seedShowcase` на засіяній БД відмовляє й нічого не пише (команда таку базу перестворює за позначкою — С-16); (г) `dashboardSummary` на засіяній БД дорівнює прямому SQL по тих самих даних, скасовані виключено; (д) у видаленого покупця ПД — `NULL`, сиріт за `user_id` немає. Негативний контроль: без кроку зсуву часу (г) червоніє на виручці 7/30. |
| С-9 | **Доки:** рядок у `docs/development/TOOLING.md` (команда, що робить, обмеження С-7) і в `docs/tasks/v2-state-map.md` §5 (як підняти локальний стенд для ручного тесту). Пароль власника — лише в консолі й у TOOLING з позначкою «лише локалка». |
| С-10 | *(архітектор)* **Статус відповіді ставить межа, а не ядро.** `stateConflict`, `toAdminConflict` і `fieldIssue` перестають кликати `setResponseStatus`. Статус ставить catch у `runAdminTransactions`: `AdminConflictError` → 409, `ValidationError` → 400, ДО повторного `throw`. Канон К3-13 зберігається, бо catch операції ще в handler. Експеримент «no-op поза контекстом» не робимо: недокументована поведінка бібліотеки гірша за чисту межу. Гейти: (а) наявні тести статусів 409/400 зелені без змін; (б) тест «ядро поза запитом кидає доменну помилку й не чіпає response»; (в) грeп- або лінт-гейт: `setResponseStatus` імпортується лише в `admin-server/impl/run.ts` (і вхід serverFn, якщо він окремо), нове використання в ядрах червоніє, з негативним контролем. `data-layer.md` §10 оновлюється (хто ставить статус) | Ядро без HTTP-контексту потрібне сіду, портам К5 і майбутньому MCP-серверу магазину |
| С-11 | *(архітектор)* **Схвалення відгуків** — другий позначений SQL-крок сіду: `UPDATE product_reviews SET status = 'approved'`. Обидва сирі записи (С-3 і С-11) живуть в одному модулі `scripts/showcase/raw-writes.mts` з шапкою «єдині сирі записи сіду» і явним переліком колонок. Нової продакшн-поверхні немає. Коли Е6д спроєктує модерацію, крок переїде на ядро (борг у роадмапі) | Серверної операції статусу відгуку немає, а `insertProductReview` пише `pending` |
| С-12 | *(архітектор; уточнено аудитом р2)* Сід підключається як `app_runtime` (`withUser(url, 'app_runtime')`), як магазин у проді. Усі записи, зокрема С-3 і С-11, йдуть під `withActor({ role: 'app_admin' })`. Адміністративне (суперюзерне) підключення обслуговує лише життєвий цикл бази: `db:demo`, перевірку й постановку позначки С-16. Записи власне сіду його не використовують. Better Auth (`signUpEmail`, invite) іде штатним proxy, як у магазині | RLS і гранти працюють так само, як у живого магазину |
| С-13 | *(архітектор)* **Медіа.** Виділений `MEDIA_ROOT=.data/showcase-media` (gitignored). `db:showcase` перед стартом очищає ЛИШЕ цю теку (шлях зашитий; `realpath` перевіряється всередині кореня репо, симлінк назовні — відмова). Наприкінці друкує `DATABASE_URL`, `MEDIA_ROOT` і пароль власника | Ключі сховища недетерміновані (`randomUUID`). `db:demo` перестворює БД, а файли інакше лишалися б сиротами |
| С-14 | *(архітектор)* Сід ДОДАЄ дані до `db:demo`, а не переписує: нові розділи й товари з зображеннями, зображення 8 демо-товарам (через `update` фабрики), другий тип ціни, адресний спосіб (`core:address`) із тарифом, друга точка, залишки всім товарам. `demo-seed.sql` не чіпаємо | На демо-сіді стоять гейти (`demo-seed.test.ts`, `seed-determinism.test.ts`) |
| С-15 | *(архітектор)* Розщеплюються лише потрібні сіду ядра. Фабрика `defineAdminResource` (2 файли, покриває ~18 ресурсів), `saveProductPrices`, `saveStock`, `saveDiscount`, `changeOrderStatus`, а з Е6г — `assignCustomerCategory`, `setCustomerBan`, `deleteCustomer`. `setAdminRole` і `set-default` не розщеплюються: другий адмін створюється через invite, дефолти беруться з канону. **Актор ядра — явний тип** `type CoreActor = { kind: 'admin'; userId: string } | { kind: 'system' }` (а не `string \| null`). Перевірка «не я» діє лише для `admin`, `changed_by` у `system` дорівнює `NULL`, як в автоправил. Той самий тип отримують усі ядра, яким потрібен актор. Кожне розщеплення — без зміни поведінки: наявні тести операцій зелені без правок; зміна поведінки — стоп і ескалація | YAGNI. `null` як «система» читається як забута перевірка, дискримінант — як рішення |
| С-16 | *(архітектор, аудит Codex — blocker С-7)* **Два контракти захисту.** (а) **Команда** `db:showcase` працює лише з базою фіксованого імені `simplycms_showcase` на сервері `PG_HARNESS_URL` (ні параметра, ні env для імені). Право перестворити визначає позначка `COMMENT ON DATABASE … IS 'simplycms:showcase'`, а не домен email-ів: власник реєструватиметься в цьому магазині руками. ДО будь-якого `DROP`: бази немає → створюємо; є з позначкою → перестворюємо; є без позначки → відмова з поясненням. Позначка ставиться одразу після `CREATE` (до сіду): обірваний сід інакше лишав би базу без позначки, і повтор відмовляв би. (б) **Модуль** `seedShowcase(env)` має guard С-7 «`users` і `orders` порожні» проти прямого виклику з чужою `DATABASE_URL`. TOOLING: «`simplycms_showcase` одноразова: кожен запуск її перестворює, ручні зміни зникають; чужу базу з таким іменем без позначки команда не чіпає» | С-7 суперечило собі: `db:demo` робить `DROP DATABASE` раніше, ніж guard перевіряв «чистоту» |


## Ступінь обовʼязковості — читати ПЕРШИМ

- **КАНОН** (розбіжність → зупинка і звернення до архітектора): рішення С-1…С-15, Global Constraints, імена ядер і їхні сигнатури в блоках Interfaces, склад гейтів, асерти Review Focus.
- **ОРІЄНТИР** (виконавець адаптує сам і пише про це у звіті): якорі `файл:рядок` (за 1f6fcfac), розбиття `scripts/showcase/` на файли, конкретні назви товарів і розділів.
- 🔴 Звіт «гейт зелений» — не доказ. Доказ — вивід команди у звіті задачі.
- 🔴 Рефакторинг операцій у ядра поведінку НЕ змінює. Наявні тести операцій (харнес Е4–Е6г) лишаються зеленими без правок асертів. Правка асерту в наявному тесті — сигнал зупинитися, а не «полагодити тест».

## Протокол виконання

- **Ролі.** Виконує сесія-оркестратор (subagent-driven). Архітектор — `dashboard-design-spec`, автор плану — `customers-dashboard-plan`. Ескалація ДО коду: розбіжність із КАНОНОМ; потрібне рішення, якого план не містить.
- **Рев'ю.** Після кожної задачі — рев'ю задачі. Наприкінці — фінальне рев'ю гілки архітектором від першого коміту плану.
- **Стенд.** `PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55434/postgres`.

## Global Constraints

- TypeScript 6.0 strict, Node `>=22.12`. Нових runtime-залежностей немає: `tsx` уже є в devDependencies, PNG робиться через `node:zlib`.
- Код сіду живе лише в `scripts/showcase/`. У `packages/*`, шаблон магазину й `exports` він не потрапляє. Ядра, винесені з операцій, живуть у пакеті поруч з операціями (`admin-server/impl/**`) і йдуть з ним.
- 🔴 У продакшн-коді немає seed-гілок, прапорців «якщо сідимо» і моків authz у сіді (С-2).
- Email-и сіду — лише `@showcase.test`. Пароль власника — константа в сіді, друкується в консоль.
- Ліміт 150 рядків на новий файл; `wc -l` нових файлів іде у звіт кожної задачі.
- `pnpm lint` = 0 errors / 7 warnings. Повний ланцюг — як у `AGENTS.md`.
- Мінімальний гейт задачі: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:schema`. Плюс `pnpm typecheck:showcase` з Task 5, плюс `pnpm build:packages`, якщо зачеплено пакет.
- Коміти: `refactor(showcase): …`, `feat(showcase): …`, `test(showcase): …`, `docs(showcase): …`; без трейлерів.

## Review Focus

1. **`pnpm db:showcase` запускають удруге поверх уже засіяної бази (і власник уже зареєстрував там себе руками)** → команда за позначкою бази перестворює її і очищає лише `.data/showcase-media`. Нічого поза цією текою не видаляється, а друга база має ті самі назви й суми, що й перша. Тест — Task 7 (С-8б) і Task 5 (`showcase-db-guard`, шлях очищення).
2. **Хтось має власну базу `simplycms_showcase` без позначки** → команда відмовляє ДО `DROP`, база й дані цілі. **Модуль сіду проти чужої `DATABASE_URL` з даними** → відмова, жодного запису. Тест — Task 5 (`showcase-db-guard`) і Task 7 (С-8в).
3. **Магазин стартує з `MEDIA_ROOT`, який надрукував сід** → зображення товарів роздаються (`/media/<key>` дає 200 і `image/png`). Тест — Task 7 (запит до `serveMedia` або перевірка файлу за ref).
4. **Адмін-операції після розщеплення в ядра поводяться так само в HTTP-контексті** → 409/400 і тости ті самі. Тест — Task 1: наявні тести статусів зелені + новий «ядро поза запитом кидає `AdminConflictError`».
5. **Дашборд на засіяній базі** → нові замовлення, виручка за 7 і 30 днів збігаються з прямим SQL; скасовані не входять. Тест — Task 7 (С-8г) і негативний контроль без зсуву часу.

## Граф залежностей задач

```
Task 1 (межа статусів С-10) ─► Task 2 (фабрика db-варіантів) ─► Task 3 (ядра цін/складу/знижок/статусу) ─► Task 4 (ядра Е6г)
Task 5 (інфраструктура сіду) ─► Task 6 (наповнення) ─► Task 7 (гейт С-8) ─► Task 8 (доки, живий запуск)
Task 4 ─► Task 6
```

## File Structure

**Створюються:** `scripts/showcase/{run,env,guard,showcase-db,prng,png,media-dir,catalog,people,commerce,orders,raw-writes,report}.mts` (розбиття — ОРІЄНТИР), `tsconfig.showcase.json`, `admin-server/impl/core-actor.ts`; тести — `admin-server/impl/__tests__/{core-status-boundary,set-response-status-scan}.test.ts`, `test-harness/pg/__tests__/{admin-resource-in,admin-cores,admin-customer-cores,showcase-db-guard,showcase-seed,showcase-seed-determinism}.test.ts` (назва не `storefront-showcase` — така вже є), `tests/showcase-{prng,png,media-dir}.test.ts`.

**Змінюються:** `admin-server/impl/{run,errors,validation,resource,resource-write-ops}.ts`, `impl/{product-prices/save,stock/save,discounts/save,orders/change-status}.ts`, `impl/customers/{assign-category,ban,delete}.ts` + експорти `impl/index.ts`; `package.json` (`db:showcase`, `typecheck:showcase`); доки — `docs/architecture/data-layer.md` §10, `docs/development/TOOLING.md`, `docs/tasks/{v2-state-map,platform-roadmap}.md`, `CHANGELOG.md`.

---

## Task 1: Межа статусів відповіді (С-10)

**Files:** `admin-server/impl/{run,errors,validation}.ts`, `impl/orders/change-status.ts` (і будь-який інший прямий виклик `setResponseStatus` у `impl/**`), тести `admin-server/impl/__tests__/{core-status-boundary,set-response-status-scan}.test.ts`, `docs/architecture/data-layer.md` §10.

**Interfaces:**
- `stateConflict(constraint): never` і `fieldIssue(path, code): never` — лише `throw`, без `setResponseStatus`. `toAdminConflict(error)` повертає помилку без побічного ефекту.
- `runAdminTransactions` у `catch`: `AdminConflictError` → `setResponseStatus(409)`, `ValidationError` → `setResponseStatus(400)`, потім той самий `throw`. Це покриває помилки, що виникли ВСЕРЕДИНІ операції.
- Вхід serverFn — окрема межа: `adminInput(schema)` (валідатор `.validator(...)`) і `parseAdminInput` виконуються ДО `runAdminTransactions` і далі самі ставлять 400 при `ValidationError` (наявний тест `impl/__tests__/validation.test.ts:37-47` — без змін). `validation.ts` — у allowlist гейта С-10в.
- *(аудит Codex)* Усі прямі виклики `setResponseStatus` у `admin-server/impl/**`, крім `run.ts` і `validation.ts`, переходять на `stateConflict`/межу вже в цій задачі — зокрема `orders/change-status.ts:3,63-70`. Інакше гейт С-10в червоний одразу. Перелік — `git grep -n setResponseStatus -- packages/simplycms/src/admin-server` (вивід у звіт). Виклики в `auth/` і `plugin-sdk/` — поза зоною гейта.

- [X] **Step 1: Експеримент і тест (червоний):** юніт «`stateConflict` поза контекстом запиту кидає `AdminConflictError` (не інший виняток)»; харнес — наявні тести, що асертять 409/400 (`admin-customer-*`, `admin-orders`, `admin-discounts`), прогнати ДО правки як базу.
- [X] **Step 2: Реалізація.**
- [X] **Step 3: Гейт імпорту (С-10в):** тест-скан (зразок — `admin-validators-wrapped.test.ts`): `setResponseStatus` імпортується лише в `admin-server/impl/run.ts` (і у валідаторі входу serverFn, якщо він ставить 400 окремо — явний allowlist). Негативний контроль: тимчасовий імпорт у ядро → скан червоніє.
- [X] **Step 4: Зелене** — `pnpm lint && pnpm typecheck && pnpm test && pnpm test:schema`, наявні тести статусів зелені без змін асертів. Негативний контроль: прибрати мапінг 409 у `runAdminTransactions` → червоніє наявний тест статусу. Онови `data-layer.md` §10: статус ставить межа операції, ядра його не чіпають.
- [X] **Step 5: Коміт** — `refactor(showcase): статус адмін-помилки ставить межа операції`.

## Task 2: Фабрика ресурсів — db-варіанти (С-2, С-15)

**Files:** `admin-server/impl/{resource,resource-write-ops}.ts`, `test-harness/pg/__tests__/admin-resource-in.test.ts`.

**Interfaces:** кожен ресурс `defineAdminResource` додатково віддає `insertIn(db: ActorDb, input: unknown): Promise<unknown[]>` і `updateIn(db, input)` — parse схемою + `prepare` (лок і guard) + `*ResourceRows`; `removeIn(db, input)` — ТОЧНЕ дзеркало чинного `remove` (БЕЗ `prepare`: guard не має варіанта `remove`, `resource-config.ts:11-20`). Захищене видалення лишається за іменованими операціями (*аудит Codex*). Наявні `insert/update/remove` = `run(db => xIn(db, input))`. readonly/insertOnly відсікаються так само.

- [X] **Step 1: Тест (червоний):** харнес — `sectionsOps.insertIn` під `withActor({ role: 'app_admin' })` створює розділ; `insertIn` з полем readonly (`isDefault`) — поле відкинуто; guard ресурсу доставки спрацьовує через `insertIn` так само, як через `insert`.
- [X] **Step 2: Реалізація.** **Step 3: Зелене** (усі наявні тести фабрики й ресурсів без змін). **Step 4: Коміт** — `refactor(showcase): db-варіанти операцій фабрики ресурсів`.

## Task 3: Ядра цін, складу, знижок, статусу замовлення (С-2, С-15)

**Files:** `impl/{product-prices/save,stock/save,discounts/save,orders/change-status}.ts`, `impl/core-actor.ts`, `impl/index.ts`, `test-harness/pg/__tests__/admin-cores.test.ts`.

**Interfaces (КАНОН):** `CoreActor` (С-15) — у `admin-server/impl/core-actor.ts`. `saveProductPrices(db, input)`, `saveStock(db, input)`, `saveDiscount(db, input)`, `changeOrderStatus(db, { orderId, statusId })` (актор додається лише ядру, яке його справді читає) — тіло колишньої операції з тими самими локами в тому самому порядку. `input` — уже розібраний Zod тієї ж схеми. Операція = `parseAdminInput` + `runAdmin(op, db => core(db, parsed))`.

- [X] **Step 1: Тести (червоні):** харнес — кожне ядро поза запитом під `app_admin` дає той самий результат, що операція (по одному кейсу); `changeOrderStatus` на `cancelled` повертає залишок.
- [X] **Step 2: Реалізація.** **Step 3: Зелене** — наявні тести цих операцій (включно з тестами локів Е4/Е6а/Е6в) без змін. **Step 4: Коміт** — `refactor(showcase): ядра цін, складу, знижок і статусу замовлення`.

## Task 4: Ядра Е6г (С-15)

**Files:** `impl/customers/{assign-category,ban,delete}.ts`, `impl/index.ts`, `test-harness/pg/__tests__/admin-customer-cores.test.ts`.

**Interfaces (КАНОН):** `assignCustomerCategory(db, input, actor: CoreActor)` (`changed_by` = `actor.userId` для `admin`, `NULL` для `system`), `setCustomerBan(db, input)`, `deleteCustomer(db, input, actor: CoreActor)` (перевірка «не я» — лише для `admin`). Порядок локів Е6г-22 без змін. Операції передають `{ kind: 'admin', userId: grant.subject.userId }`.

- [X] **Step 1: Тести (червоні):** харнес — кожне ядро поза запитом. `deleteCustomer(…, { kind: 'system' })` видаляє покупця; адміна — так само `customer_is_admin`. **Step 2–3:** реалізація, наявні тести Е6г зелені без змін (зокрема детерміновані тести локів). **Step 4: Коміт** — `refactor(showcase): ядра операцій покупця`.

## Task 5: Інфраструктура сіду (С-1, С-5, С-6, С-7, С-12, С-13)

**Files:** `scripts/showcase/{run,env,guard,prng,png,report,media-dir,showcase-db}.mts`, `scripts/demo-db.mjs` (необовʼязковий `--comment`), `tsconfig.showcase.json`, `package.json` (скрипти `db:showcase` і `typecheck:showcase`), `tests/showcase-{prng,png,media-dir}.test.ts`, `test-harness/pg/__tests__/showcase-db-guard.test.ts`. `.gitignore` не змінюється: `.data/` уже ігнорується (`.gitignore:74`).

**Interfaces:**
- `pnpm db:showcase` → `pnpm exec tsx scripts/showcase/run.mts`. Кроки — усі під ОДНИМ адмін-підключенням із сесійним локом `pg_advisory_lock(hashtext('simplycms:showcase-db'))`, який береться першим і звільняється у `finally` після останнього кроку (*аудит Codex р3*: інакше друга команда перестворить базу, поки перша її наповнює): (1) `prepareShowcaseDb` (С-16а) — перевірка позначки й `db:demo --name <name> --comment <SHOWCASE_DB_COMMENT>` (позначку ставить сам `demo-db.mjs` одразу після `CREATE`); (2) очищення `.data/showcase-media`, лише якщо `realpath` усередині кореня репо; (3) env: `DATABASE_URL` (`app_runtime`), `BETTER_AUTH_SECRET` (згенерований, друкується), `MEDIA_ROOT`; (4) `seedShowcase` → guard С-16б; (5) наповнення (Task 6); (6) `closeDbPool()`; (7) звіт: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `MEDIA_ROOT`, власник, пароль, команда запуску магазину.
- `prng(seed: number): () => number` (mulberry32), `pick`, `int(min,max)`; `SHOWCASE_SEED` — константа.
- `pngBytes({ width, height, seed }): Uint8Array` — валідний PNG (IHDR/IDAT/IEND, crc32, `deflateSync`).
- `assertPristine(db): Promise<void>` — `users` і `orders` порожні, інакше `ShowcaseNotPristineError` з поясненням; без `--force`.
- Імпорти з ядра — відносні шляхи `../../packages/simplycms/src/...` (зразок `scripts/live-smoke/owner-invite.mts`).
- *(аудит Codex)* `tsx` типів не перевіряє, а кореневий `tsconfig.json` не включає `*.mts`. Тому `tsconfig.showcase.json` (strict, `include: ['scripts/showcase/**/*.mts']`, ті самі `paths`) і скрипт `pnpm typecheck:showcase` — крок повного ланцюга одразу після `typecheck`.
- **База команди (С-16а):** `showcase-db.mts` — `prepareShowcaseDb(admin: AdminConnection, name: string): Promise<'created' | 'recreated'>`, де `type AdminConnection = { client: pg.Client; url: string }` — `client` (до службової бази `postgres`) тримає лок і робить перевірку позначки, `url` іде в `--url` дочірнього `demo-db.mjs` (ОДНА сигнатура: `name` іде і в перевірку позначки, і в `--name` дочірнього `demo-db.mjs`; публічна команда передає лише `SHOWCASE_DB_NAME`) ДО будь-якого `DROP`: бази `name` немає → створення; є з `shobj_description(oid, 'pg_database') = 'simplycms:showcase'` → перестворення; є без позначки → `ShowcaseForeignDbError` з поясненням, нічого не змінено. Створення — `node scripts/demo-db.mjs --url <adminUrl> --name <name> --comment <SHOWCASE_DB_COMMENT>`. *(аудит Codex р2)* `demo-db.mjs` отримує необовʼязковий `--comment`: `COMMENT ON DATABASE` виконується в тому ж кроці одразу після `CREATE DATABASE`, ДО міграцій. Без прапорця поведінка `db:demo` не змінюється. Так обрив міграцій чи сіду не лишає базу без позначки, і повтор її перестворює. Перевірка позначки, `DROP`/`CREATE` і `COMMENT` серіалізуються сесійним advisory-локом на адмін-підключенні (`pg_advisory_lock(hashtext('simplycms:showcase-db'))`), щоб дві одночасні команди не перехрестились. *(умови архітектора)* Без `--comment` поведінка й вивід `db:demo` — байт у байт ті самі, наявні тести й гейти `db:demo` не правляться. Значення коментаря — константа `SHOWCASE_DB_COMMENT` поряд із `SHOWCASE_DB_NAME`, а не довільний текст із CLI. Сесійний лок тримає АДМІН-ПІДКЛЮЧЕННЯ батьківського процесу (до службової бази `postgres`, яку `pg_terminate_backend` у `demo-db.mjs` не зачіпає) від перевірки позначки до ЗАВЕРШЕННЯ всієї команди — `db:demo`, очищення медіатеки й `seedShowcase` — і звільняє його у `finally`. Дочірній процес лока не успадковує, і він йому не потрібен: серіалізуються самі запуски команди. Тест: поки один запуск тримає лок, другий — `stillPending`.
- **Модуль (С-16б):** `seedShowcase(env)` (його кличе і команда, і гейт) першим кроком — `assertPristine` (`users` і `orders` порожні).

- [X] **Step 1: Юніти (червоні):** `prng` детермінований (однаковий seed → однакова послідовність); `pngBytes` починається з сигнатури PNG і проходить `sniffImageMime` → `image/png`; функція шляху очищення відмовляє для шляху поза репо (`../`, абсолютний) і для симлінка, що веде поза репо (ціль симлінка після виклику НЕ очищена). Харнес `showcase-db-guard.test.ts`: 🔴 тест відкриває власне `AdminConnection` з `PG_HARNESS_URL` і кличе `prepareShowcaseDb(admin, name)` — внутрішній параметр імені; команда передає лише константу `SHOWCASE_DB_NAME`, а тест — ОБОВʼЯЗКОВО унікальне `randomDbName('showcase_guard')` на кожен кейс і ніколи не фіксовану назву (асерт у тесті: `name !== SHOWCASE_DB_NAME`). Кейси (у кожному після виклику — асерт, що база `SHOWCASE_DB_NAME` на стенді НЕ змінилась: OID і `shobj_description` ті самі або її немає, як і до тесту): (1) база без позначки з даними → `ShowcaseForeignDbError`, база й дані цілі після виклику; (2) база з позначкою і ручним не-сідовим користувачем → перестворена; (3) бази немає → створена й позначена; (4) міграція падає (підкласти зламаний SQL-файл через тестовий шов списку файлів `demo-db.mjs` — ОРІЄНТИР) → створена база ВЖЕ має позначку, а повтор її перестворює. Негативний контроль: прибрати перевірку позначки → кейс (1) червоніє.
- [X] **Step 2–3:** реалізація, зелене. **Step 4: Коміт** — `feat(showcase): каркас команди, PRNG, PNG, захист`.

## Task 6: Наповнення (С-3, С-4, С-11, С-14)

**Files:** `scripts/showcase/{catalog,people,commerce,orders,raw-writes}.mts`.

**Interfaces / обсяг (КАНОН — С-4):**
- **Каталог** через `insertIn`/`updateIn` фабрики й ядра Task 3: ≥3 нові розділи з властивостями; ≥24 нові товари (частина з модифікаціями); зображення (`writeMedia`, `entityType: 'product'`, PNG із PRNG) — усім новим і 8 демо-товарам; другий тип ціни «Оптова»; ціни обох типів; залишки всім товарам у двох точках.
- **Доставка:** адресний спосіб (`core:address`, режим `rates`) із тарифом; друга точка видачі.
- **Люди:** власник `owner@showcase.test` і другий адмін `manager@showcase.test` — `issueOwnerInvite` + `acceptOwnerInvite`. 18 покупців `buyer-NN@showcase.test` — `getAuth().api.signUpEmail`.
- **Категорії й знижки:** категорія «VIP» (тип ціни «Оптова»), правило «`orders_count >= 3` → VIP» (розподіл замовлень PRNG гарантує ≥2 покупців із ≥3 нескасованими замовленнями — асерт гейта (е)); знижка «від 3 шт −10%» на розділ; знижка «VIP −5%» за умовою `user_category in [VIP]`; один покупець із ручно закріпленою категорією (`assignCustomerCategory(…, { …, locked: true }, { kind: 'admin', userId: <owner id> })`).
- **Замовлення** через `placeOrderFor`: ~40 (≈30 від покупців, ≈10 гостьових), адреса й самовивіз; статуси розкидані PRNG, зокрема `cancelled` через `changeOrderStatus`.
- **Відгуки:** `insertProductReview` (як покупець, `withCustomerDb`) ~15, потім позначений SQL С-11 (`approved`).
- **Сценарії Е6г:** `setCustomerBan` одного покупця; `deleteCustomer(…, { kind: 'system' })` одного покупця, що має замовлення й відгук.
- **Сирі записи (С-3, С-11):** єдиний модуль `raw-writes.mts` із шапкою «єдині сирі записи сіду»: схвалення відгуків і зсув часу — `UPDATE orders SET created_at = …, updated_at = …` за день-зсувом із PRNG (0–29 днів); `user_category_history.created_at`, якщо картка покупця його показує (так — показує). Явний перелік колонок.

- [X] **Step 1:** реалізація по модулях; кожен ≤150 рядків. **Step 2:** локальний прогін `PG_HARNESS_URL=… pnpm db:showcase` → exit 0, звіт надруковано (вивід у звіт задачі). **Step 3: Коміт** — `feat(showcase): наповнення демо-бази`.

## Task 7: Гейт С-8

**Files:** `packages/simplycms/test-harness/pg/__tests__/showcase-seed.test.ts`, `showcase-seed-determinism.test.ts` (імпортують `scripts/showcase/run.mts` як модуль; env — як `admin-guard.test.ts:55-61`; `closeDbPool()` між БД).

- [X] **Step 1: Тести:** (а) накат на чисту БД (канон + демо) проходить; (б) дві чисті БД → однаковий нормалізований знімок: назви товарів і розділів, email-и, кількості замовлень за статусами, суми, день-зсуви, кількість відгуків, без uuid і `ref`; (в) модуль `seedShowcase` на засіяній БД → `ShowcaseNotPristineError`, кількість рядків у ключових таблицях незмінна (команду й позначку бази перевіряє `showcase-db-guard.test.ts`, Task 5); (г) справжня операція `dashboardSummaryOp` (через наявний патерн харнесу `vi.mock('simplycms/auth', … requireGrant → admin)`, як `admin-dashboard.test.ts`) = прямий SQL по засіяних даних, `cancelled` поза виручкою; плюс НЕЗАЛЕЖНІ асерти розподілу дат: є нескасовані замовлення старші за 7 днів і `revenue30dCents > revenue7dCents` (*аудит Codex*: без них порівняння з SQL зелене й без зсуву часу); (е) автоправило справді перевело ≥1 покупця у VIP (`user_category_history` з `rule_id`), а ручно закріплений лишився у своїй категорії; (д) у видаленого покупця ПД `NULL`, сиріт немає (`findOrphans`); файл зображення товару існує за ref у `MEDIA_ROOT` і є PNG (Review Focus 3).
- [X] **Step 2: Негативний контроль:** прибрати виклик зсуву часу → (г) червоніє на незалежних асертах дат (вивід у звіт, відкат).
- Дві БД у (б) — дві різні медіатеки: тест передає `writeMedia` явний драйвер (`localFsDriver(root)`), бо `getMediaDriver()` кешується (`local-fs.ts:120-130`); сід приймає драйвер параметром (ОРІЄНТИР).
- [X] **Step 3: Зелене** — `pnpm test:schema`. **Step 4: Коміт** — `test(showcase): гейт сіду вітрини`.

## Task 8: Доки й живий запуск (С-9)

**Files:** `docs/development/TOOLING.md` (після `db:demo`: команда, що робить, обмеження С-7, пароль власника з позначкою «лише локалка»), `docs/tasks/v2-state-map.md` §5 (рядок у таблиці команд і як підняти стенд для ручного тесту), `docs/tasks/platform-roadmap.md` (борг: схвалення відгуків у сіді переїжджає на ядро модерації Е6д), `CHANGELOG.md`.

- [X] **Step 1:** доки. **Step 2:** живий запуск — `pnpm db:showcase`, потім `pnpm build && DATABASE_URL=… BETTER_AUTH_SECRET=… MEDIA_ROOT=… VITE_SITE_URL=http://localhost:3000 pnpm start`; вхід власника, дашборд показує числа, вітрина — товари з зображеннями (вивід/скриншоти у звіт). **Step 3:** повний ланцюг гейтів. **Step 4: Коміт** — `docs(showcase): команда db:showcase у канон тулінгу`.

## DoD

1. `pnpm db:showcase` на стенді — exit 0, звіт надруковано; магазин на `localhost:3000` з надрукованим env показує дані.
2. Гейт С-8 (а–д) зелений, негативний контроль червонів.
3. Повний ланцюг гейтів зелений; наявні тести операцій без змін асертів.
4. У продакшн-коді немає seed-гілок (`rg -n "showcase" packages/simplycms/src` → порожньо).
