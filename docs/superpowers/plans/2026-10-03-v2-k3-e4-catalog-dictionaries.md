# V2-К3 · Етап Е4: довідники каталогу — розділи, типи цін, властивості, опції, призначення

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сторінки `/admin/sections*`, `/admin/price-types*`, `/admin/properties*` (разом з опціями властивості й призначенням властивостей розділу) живуть на серверному шарі `simplycms/admin-server` + колекціях `simplycms/admin-data` замість `supabase-js`. Доведено живим прогоном: власник створює розділ, властивість і опцію, а вітрина їх показує.

**Architecture:** Пʼять читальних ресурсів Е3 (`impl/catalog-read/resources.ts`, `writable: []`) стають записуваними. Кожен отримує власну теку `impl/<entity>/`, а колекції `admin-data` з тими самими ENTITY отримують `persistenceHandlers` у ТИХ САМИХ файлах (правило Е3, Task 5: одна таблиця — один префікс). Операції з інваріантами (дефолтний тип ціни, видалення типу ціни) — іменовані, під `runAdmin`. Сторінки лягають у `src/admin/features/catalog-dictionaries/**` і потрапляють у зону `mutation-cache-sync` за побудовою; легасі-файли `src/admin/pages/*.tsx` стають тонкими реекспортами, бо exports-мапа пакета несе `./admin/pages/*`, а не `./admin/features/*`. Дві правки baseline: FK цін → RESTRICT і глобально унікальний slug властивості.

**Tech Stack:** TanStack Start 1.167 / Router 1.168, `@tanstack/react-db` + `@tanstack/query-db-collection` (піни — як у Е3), Drizzle + drizzle-zod, Zod 4, react-hook-form, Vitest 4, PostgreSQL 17 (харнес `pnpm test:schema`), Playwright (`pnpm live:smoke`).

**Spec:** [`docs/superpowers/specs/2026-08-29-v2-k3-admin-server-layer-design.md`](../specs/2026-08-29-v2-k3-admin-server-layer-design.md) (К3-2, К3-4′, К3-5, К3-7, К3-9′, К3-13, К3-14, §7, §8). Попередній етап, з якого беруться канони й зразки, — [`2026-09-23-v2-k3-e3-catalog-on-demand.md`](2026-09-23-v2-k3-e3-catalog-on-demand.md) (рішення Е3-1…Е3-20, «Точка передачі»). Карта стану — [`docs/tasks/v2-state-map.md`](../../tasks/v2-state-map.md) §3.1, §6.

**Обсяг:** 10 легасі-файлів (`Sections`, `SectionEdit`, `PriceTypes`, `PriceTypeEdit`, `Properties`, `PropertyEdit`, `PropertyOptionEdit`, `SectionPropertiesManager`, мертвий `SectionPropertiesTable`, а `PriceValidator` лише реєструється як виняток). Лічильник `rg -l useSupabaseClient packages/simplycms/src/admin | wc -l` має впасти з 43 до **34** (−7 сторінок, −2 компоненти; `PriceValidator` лишається серед легасі).

**Редакції:**
- ред.1 (2026-10-03) — план за рішеннями власника Е4-1/3/4/5.
- ред.2.3 (2026-10-03, виконання) — рішення архітектора Е4-11, Е4-12 (доказ advisory-локу типу ціни), Review Focus 2 переформульовано; Е4-13 (спільна типізована фабрика моку `admin-server`).
- ред.2.2 (2026-10-03) — власник підтвердив Е4-6; план готовий до виконання.
- ред.2.1 (2026-10-03) — протокол виконання (ролі, ескалація, git, стенд); `typecheck` у мінімальному гейті задачі.
- ред.2 (2026-10-03) — аудит Codex (`gpt-6-sol`, read-only), вердикт REJECT, 2 blocker / 4 major / 2 minor. Кожну знахідку перевірено проти коду, усі вісім прийнято: dev-stand-фікстура з близнюками slug (Task 1); гонка `setDefault × remove` типу ціни (Е4-2, Task 4); контракт сесії власника в `live:smoke` (Task 10); видалення опції (Task 8); двосторонній реєстр легасі й винятків К3-2 (Е4-4, Task 9); тест повного зрізу on-demand колекції і чесне формулювання межі serverFn (Task 5, Review Focus 4); вимір ратчету id (Task 9); обґрунтування Е4-3. Рішення Е4-6 аудит підтвердив по суті.

## Ухвалені рішення етапу (власник 2026-10-03; архітектор плану — там, де позначено)

| № | Рішення | Причина |
|---|---|---|
| Е4-1 | *(власник, 2026-10-03)* **`product_prices.price_type_id` → `ON DELETE RESTRICT`** (правка BASELINE). Видалення типу ціни, на який посилаються ціни, дає 23503 → `AdminConflictError('reference')` → тост `admin.errors.conflictReference`. `discounts.price_type_id` (NO ACTION) поводиться так само; `user_categories.price_type_id` (SET NULL) не змінюється | Сьогодні CASCADE мовчки зносить усі ціни товарів цього типу одним кліком. Клієнтів немає, тож правка baseline безпечна (D5) |
| Е4-2 | *(архітектор, слідство К3-14 і Global Constraints Е3; 🔴 ред.2 — аудит Codex, знахідка 2)* **`price_types.isDefault` — readonly для фабрики.** Дефолт ставить іменована `setDefaultPriceTypeOp`, видалення — іменована `removeManyPriceTypesOp`. 🔴 **ОБИДВІ операції першим кроком транзакції беруть ТОЙ САМИЙ advisory-lock `price-type-default`**, і лише після нього читають і блокують рядки. `setDefault` перевіряє, що `UPDATE` цілі повернув рядок, інакше кидає помилку й відкочує зняття старого дефолту; `remove` блокує batch `FOR UPDATE … ORDER BY id`. Операції «зняти дефолт» немає: щойно дефолт поставлено, він завжди рівно один | Легасі знімав дефолт з інших двома запитами з браузера без транзакції (вікно без дефолту) і дозволяв вимкнути перемикач у самого дефолтного (дефолту не лишалось). Вітрина й `PriceValidator` беруть дефолт як fallback для гостя |
| Е4-3 | *(власник, 2026-10-03)* **Розділи — плоский список.** `parentId` лишається readonly (новий розділ — `NULL`) | Легасі-адмінка `parent_id` ніколи не ставила, тож у даних, створених адмінкою, ієрархії немає. Вітрина поводиться неоднорідно: навігація й добірки головної беруть лише корені (`loadRootSections`, `storefront/loaders/sections.ts:42-48`), а `/catalog` — усі активні розділи без фільтра батька (`loadSections`, `sections.ts:18-25`, через `storefront-routes/server/catalog.ts:36-41`). Дерево — окрема продуктова фіча (вітрина + захист від циклу), не міграція *(обґрунтування виправлено ред.2 за аудитом Codex, знахідка 8)* |
| Е4-4 | *(власник, 2026-10-03)* **`PriceValidator` переїжджає в Е6** разом зі знижками як server-first виняток К3-2. В Е4 заводиться **закомічений реєстр легасі-адмінки** (`tests/admin-server-first/registry.ts`) з ДВОМА списками: `SERVER_FIRST_EXCEPTIONS` (свідомі винятки К3-2 — сутності й операції, перший запис `PriceValidator`) і `PENDING_LEGACY` (решта файлів на `supabase-js` із хвилею Е5/Е6/Е7). 🔴 Тест звіряє в ОБИДВА боки: множина файлів `src/admin/**` з `useSupabaseClient` = обʼєднання двох списків. Незареєстрований виняток або забута сторінка червонить гейт *(ред.2 — аудит Codex, знахідка 5)* | Валідатор читає `profiles`, `user_categories`, `discounts`, `discount_groups` — сутності хвиль Е5/Е6. Спека К3-2: «виняток без запису в реєстрі — дефект» |
| Е4-5 | *(власник, 2026-10-03)* **`section_properties.propertyType` незмінний після створення.** Фабрика отримує третій список колонок `insertOnly`: вони є в insert-схемі й відсутні в update-схемі. Те саме застосовується до `property_options.propertyId` і до `sectionId`/`propertyId`/`appliesTo` призначення | Зміна `multiselect → text` лишала б осиротілі рядки `option_id`. Перенесення опції між властивостями чи призначення між розділами — це видалення плюс створення, не patch |
| Е4-6 | 🔴 *(архітектор, виміряно кодом 2026-10-03; аудит Codex підтвердив; **власник підтвердив 2026-10-03**)* **Унікальність slug властивості — глобальна**: `section_properties_section_id_code_key UNIQUE(section_id, slug)` → `section_properties_slug_key UNIQUE(slug)` (правка BASELINE разом з Е4-1; `ON CONFLICT (section_id, slug)` у `migrations/demo/demo-seed.sql` → `ON CONFLICT (slug)`) | Вітрина знаходить властивість **лише за slug**: `storefront/loaders/properties.ts:47`, `storefront/loaders/property-option.ts:51`, роут `/properties/$propertySlug`. Нові властивості адмінки глобальні (`section_id NULL`), а NULL у старому ключі різний, тож дубль slug проходив і давав неоднозначну сторінку вітрини. Демо-сид має три різні slug — конфлікту немає |
| Е4-7 | *(архітектор)* **`SLUG_RE` переїжджає в T1** `packages/simplycms/src/domain/slug.ts`, експорт через наявний барель `simplycms/domain` (нового субшляху немає). Поруч `PRICE_TYPE_CODE_RE = /^[a-z0-9_]+$/` (правило легасі `PriceTypeEdit`). Формат перевіряє і форма, і сервер: `refine` ресурсу для `slug`/`code`. Автогенерації slug з назви немає — так само, як у товарі Е3 | Легасі `generateSlug` (`PropertyOptionEdit.tsx:17-24`) лишав кирилицю в URL, а товари Е3 вже на ASCII-kebab. Сервер, що довіряє формі, пропустив би кирилицю прямим викликом serverFn. T1 імпортують і T2 (`admin-server`), і T5 (`admin`) |
| Е4-8 | *(архітектор)* **Розкладка:** `src/admin/features/catalog-dictionaries/{sections,price-types,properties,assignments}/**`; `pages/{Sections,SectionEdit,PriceTypes,PriceTypeEdit,Properties,PropertyEdit,PropertyOptionEdit}.tsx` → реекспорт або диспетчер `new`/id за зразком `pages/Products.tsx` і `pages/ProductEdit.tsx`. `components/SectionPropertiesManager.tsx` видаляється (його місце займає `features/.../assignments/`), мертвий `components/SectionPropertiesTable.tsx` теж, а їхні експорти зникають з `src/admin/index.ts` | `features/**` — зона `mutation-cache-sync` за побудовою, ратчет `MUTATION_CACHE_SYNC_RATCHET` не росте. Роут-файли не змінюються |
| Е4-9 | *(архітектор)* **Режими колекцій не змінюються:** `sections` і `price_types` — eager; `section_properties`, `property_options`, `section_property_assignments` — on-demand (Е3-1). Сторінка списку властивостей читає on-demand колекцію без `where` (повний зріз, `orderBy name`) | Зміна режиму змінила б поведінку кешу картки товару Е3, яка вже доведена живим прогоном. Розмір довідника властивостей обмежений, тож повний зріз прийнятний |
| Е4-10 | *(архітектор)* **Зображення розділу й опції** — один референс сховища в `imageUrl`, через наявний `ImageUpload` (`entityType` `'section'` / `'property_option'`, `maxImages={1}`, `entityId` = id рядка; для нового рядка id згенеровано заздалегідь, Е0) | Порт сховища (Е2) уже несе обидва типи сутностей (`domain/media.ts:51-53`) і обидві колонки референсів (`media.ts:132-133`). Новий код сховища не потрібен |
| Е4-11 | *(архітектор, 2026-10-03, під час виконання Task 4)* **Advisory-лок `price-type-default` у `removeManyPriceTypesOp` лишається, хоча тест гонки `setDefault × remove` його не розрізняє.** Рядкові локи вже серіалізують будь-яку пару `remove` × `setDefault`; advisory тримає ЄДИНИЙ порядок «advisory → рядки» для всіх операцій довідника, зокрема майбутніх | Виміряно: мутація «прибрати advisory з remove» лишає тест гонки зеленим 3/3, «прибрати і advisory, і `FOR UPDATE`» червонить стабільно |
| Е4-12 | *(архітектор, 2026-10-03, під час виконання Task 4)* **Доказ advisory-локу — детермінований тест утримання локу для ОБОХ операцій** (`holdAdvisoryLock` + `stillPending`, спільний модуль `test-harness/pg/__tests__/fixtures/advisory-lock.ts`, на нього перепідключено й Е3). Конкурент тримає `price-type-default` → операція не завершується за 300 мс, БД не змінена → після release операція проходить. Стрес `Promise.all` двох `setDefault` лишається додатковим, імовірнісним | Виміряно: без advisory у `setDefault` стрес червонить лише 2 з 55 прогонів (~4 %). Імовірнісний тест гонки як ЄДИНИЙ доказ локу — хибний доказ. Детермінований тест червоніє на мутації 3/3 для кожної операції |
| Е4-13 | *(архітектор, 2026-10-03, під час виконання Task 5)* **Спільна фабрика моку `simplycms/admin-server`** — `admin-server/__tests__/support/admin-server-mock.ts`, `createAdminServerMock(overrides?)`; повноту переліку тримає ТИП (`satisfies AdminServerMock` над `keyof typeof AdminServer`), гейт — `pnpm typecheck`; окремого тесту-парсера `index.ts` немає. На фабрику переведено всі файли з `vi.mock('simplycms/admin-server', …)`. Драфт `$synced:false` on-demand колекції без живого спостерігача лишається видимим до наступного sync-коміту (@tanstack/db 0.8.6, `collection/state.js:686-745`) — запису в реєстр обходів НЕ потрібно: сторінки завжди підписані, тест відтворює їхню форму | Крок «регрес картки Е3 — зелений одразу» почервонів 18/54: явні переліки моків Е3 не знали нових serverFn колекцій Е4 (поведінка картки не змінилась — контроль `git stash` 54/54). Кожен новий serverFn ламав би чужі тести |

**Обходи дефектів бібліотек.** Нових не очікується. Якщо зʼявиться — запис у [`docs/architecture/upstream-workarounds.md`](../../architecture/upstream-workarounds.md) і маркер `UPSTREAM:<ID>` у коді, не лише коментар.

**Поза Е4 (план каже це вголос):** дерево розділів (Е4-3); `PriceValidator` (Е6, Е4-4); легасі-споживачі цих таблиць в інших сторінках — `Dashboard`, `BannerEdit`, `DiscountEdit`, `Discounts`, `UserCategories`, `UserCategoryEdit`, `ReviewDetail` (Е5/Е6); інвалідація вітринних агрегатів `AGGREGATE.*` записом адмінки (Е3 її теж не робив, вітрина SSR); ручний статус «в наявності» при нульовому залишку (хвіст Е3 — продуктове питання товару, не довідника; переходить у роадмап); reorder стрілками для довідників (легасі мав числове поле `sort_order` — так і лишається); пошук в адмінці (§7 спеки).

## Ступінь обовʼязковості — читати ПЕРШИМ

- **КАНОН** (розбіжність → зупинка і звернення до замовника): рішення Е4-1…Е4-10, Global Constraints, імена serverFn і операцій у блоках Interfaces, склад і порядок гейтів, асерти тестів Review Focus.
- **ОРІЄНТИР** (виконавець адаптує сам і пише про це в звіті задачі): якорі `файл:рядок`, імена внутрішніх компонентів і хуків, розкладка JSX, точні тексти i18n.
- 🔴 Звіт «гейт зелений» — не доказ. Доказ — вивід команди в звіті задачі.
- 🔴 Крок «має бути ЗЕЛЕНИМ одразу» перевіряє припущення плану. Якщо він червоний, це знахідка: зупинитись і повідомити, а не «полагодити тест».
- Задачі адресуються заголовками `## Task N:` (рівно два дієзи), напр. `awk '/^## Task 3:/,/^## Task 4:/' <план>`.

## Протокол виконання (ред.2.1)

- **Ролі.** Виконує окрема сесія-оркестратор (subagent-driven). **Архітектор рішення — сесія `simplycms-d3`** (автор плану). Звертатись до неї через `SendMessage({ to: "simplycms-d3", … })`. Власник — людина; його рішення приходять або напряму, або через архітектора.
- **Коли звертатись до архітектора** (до коду, не після): розбіжність із КАНОНОМ (розділ «Ступінь обовʼязковості»); точка зупинки Task 5 (поведінка повного зрізу on-demand); тест «має бути зеленим одразу» вийшов червоним; потрібне рішення, якого план не містить. Повідомлення: задача/крок, факт із доказом (вивід, `файл:рядок`), варіанти й рекомендація. Архітектор відповідає рішенням з номером `Е4-N`, і оркестратор вписує його в таблицю рішень окремим docs-комітом.
- **Рев'ю.** Після кожної задачі — рев'ю задачі за SDD. Після Task 10 — ОДНЕ фінальне рев'ю всієї гілки, яке проводить архітектор (`simplycms-d3`). Мерж і пуш — рішення власника.
- **Гілка і git.** Робота йде в гілці `claude/k3-e4-catalog-dictionaries-plan` (у ній уже лежить план) у ГОЛОВНОМУ робочому дереві. Архітектор у цей час git-операцій запису не робить; правки плану від нього — лише через оркестратора або у вікні між задачами, яке оркестратор явно відкриває.
- **Стенд.** Postgres 17 з trust-auth: `PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55434/postgres` (контейнер `simplycms-review-pg`; перевірено 2026-10-03). Його потребують `pnpm test:schema`, `pnpm db:demo`, `pnpm live:smoke`. 🔴 Окремий файл харнеса запускати лише через `pnpm test:schema -- <файл>` (конфіг `vitest.schema.config.ts`). `pnpm vitest run <файл харнеса>` мовчки дає «No test files found», і RED-крок TDD виглядає провалом, хоча тест не запускався.

## Global Constraints

- TypeScript 5.9 strict, не оновлювати до 6/7 (`UPSTREAM:TSESL-1`). Node `>=22.12`.
- Коментарі й документація — українською. Рядки інтерфейсу — лише через i18n (`packages/simplycms/src/i18n/catalogs/{uk,en}/admin/*.ts`, обидва каталоги). Кирилиця в JSX `src/admin/**` валить лінт. Англійські хардкоди легасі (`"Slug"`, `"SEO"`, `"Meta Title"`, `"Meta Description"`, `"URL (slug)"`) у нових файлах теж ідуть через ключі.
- `pnpm lint` = **0 errors / ≤ 8 warnings** (норма на 2026-09-24). Нових ворнінгів не додавати.
- Повний ланцюг гейтів: `pnpm install --frozen-lockfile → format:check → lint → build → typecheck → test → test:schema → build:packages → typecheck:template → test:packaging → pilot:pack --skip-build`.
- Мінімальний гейт задачі: `pnpm lint && pnpm typecheck && pnpm test` *(ред.2.1: `typecheck` обовʼязковий — урок К2-Е0, рішення K: задача поїхала з червоним `tsc`, бо vitest типи тестів не перевіряє)*. Якщо задача зачепила `schema/`, `migrations/`, `drizzle/`, `test-harness/` або `admin-server/impl/**`, додається `pnpm test:schema`. Якщо зачепила серверний код пакета або exports, додається `pnpm build:packages`.
- К3-4′: `createServerFn` — лише топ-рівневий `const` у `admin-server/index.ts` (гейт `server-fn-top-level`).
- К3-9′: `admin-server/index.ts` експортує ЛИШЕ serverFn. Нутрощі живуть у `admin-server/impl/**` і імпортуються bare-специфікатором `simplycms/admin-server/impl`. Клієнт бере типи рядків лише через `import type` з `simplycms/schema/types`.
- К3-13: кожна операція йде через `runAdmin(operation, fn)`. Код Postgres 23505/23503 мапиться в `AdminConflictError` з 409 (уже в `runAdmin`). `Response` не кидати.
- К3-7: write-back (`writeUpsert`/`writeDelete` у `writeBatch`) і `{ refetch: false }`. Хендлери обробляють УСІ `transaction.mutations`; fail-loud, якщо `serverRow.id !== optimisticId` — це вже канон `persistenceHandlers`, власних хендлерів не писати.
- Контракт id (Е0): кожен INSERT несе `id` (клієнт — `crypto.randomUUID()`).
- `queryKey` колекції = `collectionKey(ENTITY.x)`; сегмент `'list'` — лише в `admin-data` (Е3-15′). Друга колекція того самого ENTITY заборонена.
- Операція authz для всього CRUD довідників — `'catalog.write'` (Е3-6). Завантаження файлу йде під `'media.write'` всередині `uploadMedia` (уже так).
- Інваріант `template:sync`: задача, що чіпає `migrations/` (входить у `SYNCED_DIRS`), запускає `pnpm template:sync` і комітить копії в ТІЙ САМІЙ задачі.
- Тіри: `domain` = T1, `admin-server` = T2, `admin-data` = T4, `admin` = T5. Тір-зони не послабляти.
- Коміти — conventional, скоуп `k3-e4`, опис українською: `feat(k3-e4): …`, `test(k3-e4): …`, `docs(k3-e4): …`.

## Review Focus

Вхідні дані й стани, яких спека прямо не називає, але на яких найімовірніше спіткнеться власник магазину. Кожен рядок має тест у задачі-власниці коду.

1. **Видалення типу ціни, яким уже ціновані товари** → тост «використовується», ціни в БД цілі (не зникли мовчки). Тест — Task 1 (DDL: 23503) і Task 4 (операція → `AdminConflictError` `reference`, кількість `product_prices` незмінна).
2. **Дві вкладки одночасно ставлять дефолтом різні типи цін** → рівно один дефолт, жодного 23505 назовні. Те саме для `setDefault` паралельно з видаленням цілі. Тест — Task 4: детермінований тест серіалізації advisory-локу для `setDefault` і `remove` (Е4-12); стрес `Promise.all` двох `setDefault` — додатковий, імовірнісний (виміряно: без локу червонить ~4 % прогонів); 20 ітерацій `setDefault × remove` (ред.2).
3. **Призначення тієї самої властивості розділу вдруге** (наприклад, «для модифікацій», коли вона вже є «для товарів») → у діалозі її немає серед доступних; прямий insert дає `AdminConflictError` `unique` і тост, а не 500. Тест — Task 3 (харнес: 23505 → `unique`) і Task 8 (UI: список доступних виключає вже призначені в розділі незалежно від `appliesTo`).
4. **Кириличний або порожній slug / code** → форма показує помилку формату і не надсилає; прямий виклик ОПЕРАЦІЇ з `"Тип-панелі"` відбивається схемою до транзакції. Це та сама схема, яку serverFn отримує в `inputValidator(ops.insertSchema)`, але тест межу HTTP/серіалізації Start НЕ перетинає (ред.2, аудит Codex, знахідка 6). Межу serverFn для помилок доводить живий прогін (Task 10, крок 2 — дубль slug через справжню межу; кирилицю відсікає форма раніше). Тест — Task 2 (refine), Task 3 (операція) і Task 6/7/8 (форми).
5. **Видалення розділу, у якому є товари, або властивості, у якої є значення** → діалог підтвердження прямо каже про наслідки (товари лишаються без розділу; значення властивості в товарах зникнуть). Після видалення розділу товар живий з `section_id NULL`. Тест — Task 3 (харнес: SET NULL) і Task 7/Task 8 (текст попередження в діалозі — ключі `admin.sections.deleteWarning` / `admin.properties.deleteWarning`).

Додатково (нижче п'ятірки, але теж з тестами): дубль slug властивості в різних розділах → 23505 (Task 1, Е4-6); зміна `propertyType` прямим `update` → 400 «patch не може бути порожнім» до транзакції (Task 2, Е4-5).

## Граф залежностей задач

```
Task 1 (baseline: RESTRICT + slug)  ─┐
Task 2 (фабрика insertOnly + domain/slug) ─┼─► Task 3 (ресурси + serverFn) ─► Task 4 (іменовані типів цін)
                                     │                      │
                                     │                      ▼
                                     │               Task 5 (колекції: persistence)
                                     │                      │
                                     │      ┌───────────────┼───────────────┐
                                     │      ▼               ▼               ▼
                                     │   Task 6 (типи цін)  Task 7 (розділи) Task 8 (властивості, опції, призначення)
                                     │      └───────────────┴───────────────┘
                                     │                      ▼
                                     └──────────────► Task 9 (гейти, реєстр винятків, заглушка)
                                                            ▼
                                                     Task 10 (live:smoke, доки, повний ланцюг)
```

Task 1 і Task 2 незалежні між собою. Task 6/7/8 незалежні між собою, крім одного: Task 8 вбудовує панель призначень у картку розділу з Task 7, тому Task 8 іде після Task 7.

## File Structure

**Створюються**

| Шлях | Відповідальність |
|---|---|
| `packages/simplycms/src/domain/slug.ts` (+ `__tests__/slug.test.ts`) | `SLUG_RE`, `PRICE_TYPE_CODE_RE` — T1, без залежностей |
| `packages/simplycms/src/admin-server/impl/sections/resource.ts` | `sectionsOps` |
| `packages/simplycms/src/admin-server/impl/price-types/{resource,set-default,remove}.ts` | `priceTypesOps`, `setDefaultPriceTypeOp`, `removeManyPriceTypesOp` |
| `packages/simplycms/src/admin-server/impl/section-properties/resource.ts` | `sectionPropertiesOps` |
| `packages/simplycms/src/admin-server/impl/property-options/resource.ts` | `propertyOptionsOps` |
| `packages/simplycms/src/admin-server/impl/section-property-assignments/resource.ts` | `sectionPropertyAssignmentsOps` |
| `packages/simplycms/test-harness/pg/__tests__/catalog-dictionaries-schema.test.ts` | DDL-інваріанти Е4-1, Е4-6 |
| `packages/simplycms/test-harness/pg/__tests__/admin-catalog-dictionaries.test.ts` | CRUD ресурсів і іменовані операції проти живої БД |
| `packages/simplycms/src/admin/features/catalog-dictionaries/price-types/**` | список + картка типу ціни |
| `packages/simplycms/src/admin/features/catalog-dictionaries/sections/**` | список + картка розділу |
| `packages/simplycms/src/admin/features/catalog-dictionaries/properties/**` | список властивостей, картка властивості з опціями, картка опції |
| `packages/simplycms/src/admin/features/catalog-dictionaries/assignments/**` | панель «властивості розділу» (для товарів / для модифікацій) |
| `tests/admin-server-first/registry.ts`, `tests/admin-server-first-registry.test.ts` | реєстр винятків К3-2 (Е4-4) |
| `scripts/live-smoke/admin-dictionaries.mjs` | крок живого прогону довідників |

**Змінюються**

| Шлях | Що |
|---|---|
| `packages/simplycms/migrations/0001_init.sql`, `src/schema/schema.ts`, `drizzle/0000_init.sql`, `drizzle/meta/0000_snapshot.json`, `migrations/demo/demo-seed.sql` | 🔴 ПРАВКА BASELINE (Е4-1, Е4-6); копії — `pnpm template:sync` |
| `packages/simplycms/src/admin-server/impl/resource.ts`, `resource-schemas.ts` (+ `__tests__/resource.test.ts`) | `insertOnly` (Е4-5) |
| `packages/simplycms/src/domain/index.ts` | реекспорт `slug.ts` |
| `packages/simplycms/src/admin/features/products/edit/product-form-schema.ts`, `.../modifications/modification-form-schema.ts` | `SLUG_RE` з `simplycms/domain` |
| `packages/simplycms/src/admin-server/impl/index.ts`, `admin-server/index.ts` | нові ops і serverFn; `catalog-read/` видаляється |
| `packages/simplycms/src/admin-data/collections/{sections,price-types,section-properties,property-options,section-property-assignments}.ts` | `persistenceHandlers` |
| `packages/simplycms/src/admin/pages/{Sections,SectionEdit,PriceTypes,PriceTypeEdit,Properties,PropertyEdit,PropertyOptionEdit}.tsx` | реекспорт / диспетчер |
| `packages/simplycms/src/admin/index.ts` | прибрати `SectionPropertiesManager`, `SectionPropertiesTable` |
| `packages/simplycms/src/admin/layouts/LegacySupabaseBoundary.tsx` (+ тест) | посилання на живі розділи |
| `packages/simplycms/src/i18n/catalogs/{uk,en}/admin/{sections,prices,properties,common}.ts` | нові ключі |
| `tests/admin-inserts-need-id.test.ts` | `KNOWN_WITHOUT_ID` ↓ до факту |
| `scripts/live-smoke.mjs` | виклик кроку довідників |
| `docs/tasks/platform-roadmap.md`, `docs/tasks/v2-state-map.md`, `CLAUDE.md` | стан після Е4 |

**Видаляються:** `packages/simplycms/src/admin-server/impl/catalog-read/resources.ts`, `packages/simplycms/src/admin/components/SectionPropertiesManager.tsx`, `packages/simplycms/src/admin/components/SectionPropertiesTable.tsx`.

---

## Task 1: Правка baseline — RESTRICT цін і глобальний slug властивості (Е4-1, Е4-6)

**Files:**
- Create: `packages/simplycms/test-harness/pg/__tests__/catalog-dictionaries-schema.test.ts`
- Modify: `packages/simplycms/migrations/0001_init.sql`, `packages/simplycms/src/schema/schema.ts`, `packages/simplycms/drizzle/0000_init.sql`, `packages/simplycms/drizzle/meta/0000_snapshot.json`, `packages/simplycms/migrations/demo/demo-seed.sql`
- Modify: 🔴 `tests/fixtures/dev-stand/catalog-sample.mjs`, `tests/dev-stand-seed.test.ts` *(ред.2 — аудит Codex, знахідка 1)*: фікстура навмисно моделює двох глобальних «близнюків» зі slug `warranty` (`catalog-sample.mjs:17-26`, `:80-100`), а тест вимагає обидва у виводі (`dev-stand-seed.test.ts:157-168`). Під Е4-6 такий сід не накотиться. Справжній `scripts/dev-stand/seed-demo.sql` дублікатів не має (виміряно 2026-10-03: 10 властивостей, усі slug різні) — правиться лише синтетична фікстура
- Run: `pnpm template:sync` і коміт копій

**Interfaces:**
- Produces: FK `product_prices_price_type_id_fkey … ON DELETE restrict`; обмеження `section_properties_slug_key UNIQUE(slug)` замість `section_properties_section_id_code_key`.

- [ ] **Step 1: Харнес-тест інваріантів (червоний)**

Шапка — як `property-values-multiselect.test.ts` (привілейоване `dbUrl`, канон без `app_runtime`; фікстури — SQL у `beforeAll`, з явними `id`).

```ts
describe('довідники каталогу: інваріанти baseline (Е4-1, Е4-6)', () => {
  it('тип ціни з цінами не видаляється — 23503, ціни цілі', async () => {
    // фікстури: тип 'wholesale', товар, ціна товару цього типу
    await expect(
      queryRows(dbUrl, 'delete from public.price_types where id = $1', [PT]),
    ).rejects.toMatchObject({ code: '23503' });
    const [{ n }] = await queryRows(dbUrl,
      'select count(*)::int n from public.product_prices where price_type_id = $1', [PT]);
    expect(n).toBe(1);
  });
  it('тип ціни без цін видаляється', async () => { /* інший тип без цін → delete OK */ });
  it('дві глобальні властивості з однаковим slug — 23505', async () => {
    await insertProperty({ sectionId: null, slug: 'kolir' });
    await expect(insertProperty({ sectionId: null, slug: 'kolir' }))
      .rejects.toMatchObject({ code: '23505' });
  });
  it('той самий slug у різних розділах — теж 23505 (вітрина шукає лише за slug)', async () => {
    await insertProperty({ sectionId: S1, slug: 'vaga' });
    await expect(insertProperty({ sectionId: S2, slug: 'vaga' }))
      .rejects.toMatchObject({ code: '23505' });
  });
});
```

Run: `pnpm test:schema -- packages/simplycms/test-harness/pg/__tests__/catalog-dictionaries-schema.test.ts`
Expected: FAIL. Перший кейс видаляє тип (CASCADE), третій і четвертий вставляють дубль.

- [ ] **Step 2: Правка пʼяти джерел**

`0001_init.sql` і `drizzle/0000_init.sql`: у рядку `ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_price_type_id_fkey" …` замінити `ON DELETE cascade` на `ON DELETE restrict`; рядок `CONSTRAINT "section_properties_section_id_code_key" UNIQUE("section_id","slug")` замінити на `CONSTRAINT "section_properties_slug_key" UNIQUE("slug")`. Над кожним — SQL-коментар із номером рішення (`-- Е4-1: …`, `-- Е4-6: …`), як у Е3-13.

`schema.ts`: у FK `product_prices_price_type_id_fkey` написати `.onDelete("restrict")`; у `sectionProperties` — `unique("section_properties_slug_key").on(table.slug)` з коментарем `// Е4-6`.

`drizzle/meta/0000_snapshot.json`: відповідні записи `onDelete` і `uniqueConstraints` (форма — як у сусідніх записах снапшота).

`demo-seed.sql`: `on conflict (section_id, slug) do nothing` → `on conflict (slug) do nothing` (розділ 6).

dev-stand: близнюк `GLOBAL_PROPERTY_TWIN_ID` отримує власний slug `warranty-extended`; коментар фікстури (рядки 17-26) переписати: «дві глобальні властивості з `section_id: null` і РІЗНИМИ slug — Е4-6 забороняє однаковий; NULL у `section_id` і далі не арбітр `on conflict`, тому генератор бере `id`». Тест `дві глобальні властивості з одним слагом` перейменувати на `дві глобальні властивості (section_id null) — обидві у виводі`, асерт `match(/'warranty'/g)?.length === 2` замінити на наявність обох id і обох slug; тест «дочірній рядок не осиротів» лишається як є. Перевірка, що синтетика не протухла проти нової схеми: `rg -c "'warranty'" tests/fixtures/dev-stand/catalog-sample.mjs` → 1.

- [ ] **Step 3: Тест зелений + гейт парності джерел схеми**

Run: `pnpm test:schema`
Expected: PASS увесь контур, зокрема `catalog-dictionaries-schema.test.ts`, `demo-seed.test.ts`, `baseline.test.ts`.

Run: `pnpm vitest run tests/schema-sources-parity.test.ts tests/dev-stand-seed.test.ts`
Expected: PASS. Якщо `schema-sources-parity` червоний, джерела розійшлися — звести, а не послаблювати тест.

- [ ] **Step 4: Синк копій**

Run: `pnpm template:sync && git status --short`
Expected: змінені копії міграцій у шаблоні скаффолдера, `packages/cli/host/` не зачеплено.

- [ ] **Step 5: Коміт**

```bash
git add packages/simplycms/migrations packages/simplycms/src/schema/schema.ts packages/simplycms/drizzle packages/simplycms/test-harness/pg/__tests__/catalog-dictionaries-schema.test.ts packages/create-simplycms-store/template tests/fixtures/dev-stand/catalog-sample.mjs tests/dev-stand-seed.test.ts
git commit -m "feat(k3-e4): RESTRICT цін за типом і глобальний slug властивості (правка baseline)"
```

---

## Task 2: Фабрика ресурсу — `insertOnly` і формат slug у T1 (Е4-5, Е4-7)

**Files:**
- Create: `packages/simplycms/src/domain/slug.ts`, `packages/simplycms/src/domain/__tests__/slug.test.ts`
- Modify: `packages/simplycms/src/domain/index.ts`, `packages/simplycms/src/admin-server/impl/resource.ts`, `packages/simplycms/src/admin-server/impl/resource-schemas.ts`, `packages/simplycms/src/admin-server/impl/__tests__/resource.test.ts`, `packages/simplycms/src/admin/features/products/edit/product-form-schema.ts`, `packages/simplycms/src/admin/features/products/modifications/modification-form-schema.ts`

**Interfaces:**
- Produces:
  - `export const SLUG_RE: RegExp` (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, без змін), `export const PRICE_TYPE_CODE_RE: RegExp` (`/^[a-z0-9_]+$/`) — `simplycms/domain`.
  - `defineAdminResource({ …, insertOnly?: readonly I[] })`, де `const I extends ColumnName<T> = never`. Exhaustiveness: `Exclude<ColumnName<T>, W | R | I>` порожній. Перетини `Extract<W, R>`, `Extract<I, W | R>` заборонені фантомними полями `__overlappingColumns`.
  - `buildResourceSchemas(table, writable, refine?, insertOnly?)`: insert-схема бере `W ∪ I` (+ `id`), update-схема — лише `W`.

- [ ] **Step 1: Тести (червоні)**

`domain/__tests__/slug.test.ts`:

```ts
it.each(['mono', 'tip-paneli', 'a1-b2'])('SLUG_RE приймає %s', (s) => expect(SLUG_RE.test(s)).toBe(true));
it.each(['', 'Тип-панелі', 'Mono', 'a--b', '-a', 'a b'])('SLUG_RE відкидає %j', (s) => expect(SLUG_RE.test(s)).toBe(false));
it.each(['retail', 'b2b_wholesale'])('PRICE_TYPE_CODE_RE приймає %s', (s) => expect(PRICE_TYPE_CODE_RE.test(s)).toBe(true));
it.each(['', 'Retail', 'b2b-wholesale', 'оптова'])('PRICE_TYPE_CODE_RE відкидає %j', (s) => expect(PRICE_TYPE_CODE_RE.test(s)).toBe(false));
```

`admin-server/impl/__tests__/resource.test.ts` — новий `describe('insertOnly (Е4-5)')` на `sectionProperties`:

```ts
const ops = defineAdminResource({
  entity: ENTITY.sectionProperties, table: sectionProperties, operation: 'catalog.write',
  mode: 'on-demand', filterable: ['id'], sortable: ['name'],
  writable: ['name', 'slug', 'isRequired', 'isFilterable', 'hasPage', 'sortOrder'],
  insertOnly: ['propertyType'],
  readonly: ['id', 'sectionId', 'options', 'createdAt'],
});
it('insert приймає propertyType', () => {
  expect(ops.insertSchema.parse([{ id: UUID, name: 'n', slug: 's', propertyType: 'select' }])[0])
    .toMatchObject({ propertyType: 'select' });
});
it('update відкидає patch лише з propertyType — порожній після strip', () => {
  expect(() => ops.updateSchema.parse([{ id: UUID, patch: { propertyType: 'text' } }])).toThrow();
});
it('update зберігає writable і мовчки зрізає propertyType', () => {
  expect(ops.updateSchema.parse([{ id: UUID, patch: { name: 'x', propertyType: 'text' } }])[0].patch)
    .toEqual({ name: 'x' });
});
it('статично: propertyType відсутній в update-patch', () => {
  type Patch = z.infer<typeof ops.updateSchema>[number]['patch'];
  expectTypeOf<Patch>().not.toHaveProperty('propertyType');
});
// негативні контролі типів (ts-expect-error): колонка в insertOnly І writable;
// колонка, якої немає в жодному списку.
```

Run: `pnpm vitest run packages/simplycms/src/domain/__tests__/slug.test.ts packages/simplycms/src/admin-server/impl/__tests__/resource.test.ts`
Expected: FAIL (модуля `slug` немає; `insertOnly` невідомий параметр).

- [ ] **Step 2: Реалізація**

`domain/slug.ts` + реекспорт у `domain/index.ts`. `product-form-schema.ts` перестає оголошувати `SLUG_RE` і імпортує його з `simplycms/domain`; щоб не правити споживачів, лишає `export { SLUG_RE }`.

`resource-schemas.ts`: четвертий параметр `insertOnly: readonly I[] = []`; `pickInsert` = ключі `writable ∪ insertOnly`, `pickWritable` для update — як було. Статичний тип insert — `SafePick<InsertShape, W | I>` (той самий прийом касту результату `.pick()`, що й зараз; новий обхід не потрібен — маркер `UPSTREAM:DZOD-1` уже стоїть).

`resource.ts`: генерик `const I extends ColumnName<T> = never`, поле `insertOnly?: readonly I[]`, exhaustiveness і перетини — за інтерфейсом вище. Без `insertOnly` поведінка всіх наявних ресурсів не змінюється.

- [ ] **Step 3: Зелене + регрес наявних ресурсів**

Run: `pnpm vitest run packages/simplycms/src/domain packages/simplycms/src/admin-server packages/simplycms/src/admin/features/products && pnpm typecheck`
Expected: PASS. Наявні тести `resource.test.ts` зелені без правок (доказ, що без `insertOnly` нічого не змінилось).

- [ ] **Step 4: Гейт і коміт**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build:packages`
Expected: 0 errors, ≤ 8 warnings; тести зелені; збірка пакетів зелена.

```bash
git add packages/simplycms/src/domain packages/simplycms/src/admin-server/impl packages/simplycms/src/admin/features/products
git commit -m "feat(k3-e4): insertOnly у фабриці ресурсу і SLUG_RE у simplycms/domain"
```

---

## Task 3: Записувані ресурси довідників і топ-рівневі serverFn

**Files:**
- Create: `packages/simplycms/src/admin-server/impl/{sections,section-properties,property-options,section-property-assignments}/resource.ts`, `packages/simplycms/src/admin-server/impl/price-types/resource.ts`, `packages/simplycms/test-harness/pg/__tests__/admin-catalog-dictionaries.test.ts`
- Modify: `packages/simplycms/src/admin-server/impl/index.ts`, `packages/simplycms/src/admin-server/index.ts`
- Delete: `packages/simplycms/src/admin-server/impl/catalog-read/resources.ts`

**Interfaces:**
- Consumes: `defineAdminResource` з `insertOnly` (Task 2); `SLUG_RE`, `PRICE_TYPE_CODE_RE` (Task 2).
- Produces (усі `operation: 'catalog.write'`; `filterable`/`sortable`/`defaultOrder`/`mode` — як у видаленому `catalog-read/resources.ts`):

| ops | writable | insertOnly | readonly | інше |
|---|---|---|---|---|
| `sectionsOps` | `slug, name, description, imageUrl, sortOrder, isActive, metaTitle, metaDescription` | — | `id, parentId, createdAt, updatedAt` | `touch: 'updatedAt'`; `refine.slug` → `SLUG_RE` |
| `priceTypesOps` | `name, code, sortOrder` | — | `id, isDefault, createdAt` | `refine.code` → `PRICE_TYPE_CODE_RE` |
| `sectionPropertiesOps` | `name, slug, isRequired, isFilterable, hasPage, sortOrder` | `propertyType` | `id, sectionId, options, createdAt` | `refine.slug` → `SLUG_RE` |
| `propertyOptionsOps` | `name, slug, sortOrder, description, imageUrl, metaTitle, metaDescription` | `propertyId` | `id, createdAt` | `filterable: ['propertyId', 'id']`; `refine.slug` → `SLUG_RE` |
| `sectionPropertyAssignmentsOps` | `sortOrder` | `sectionId, propertyId, appliesTo` | `id, createdAt` | `refine.appliesTo` → `z.enum(['product','modification'])`; `filterable: ['sectionId', 'appliesTo', 'propertyId']` |

- serverFn у `admin-server/index.ts` (кожен — топ-рівневий `const`, `inputValidator(ops.<x>Schema)`, `handler(ops.<x>)`). `list*` уже існують і перепідключаються на нові ops:
  `listSections`, `insertSections`, `updateSections`, `removeSections`;
  `listPriceTypes`, `insertPriceTypes`, `updatePriceTypes` (remove і setDefault — Task 4);
  `listSectionProperties`, `insertSectionProperties`, `updateSectionProperties`, `removeSectionProperties`;
  `listPropertyOptions`, `insertPropertyOptions`, `updatePropertyOptions`, `removePropertyOptions`;
  `listSectionPropertyAssignments`, `insertSectionPropertyAssignments`, `updateSectionPropertyAssignments`, `removeSectionPropertyAssignments`.
- Перейменування `*ReadOps` → `*Ops`: споживачі — лише `admin-server/index.ts` (перевірити `rg ReadOps packages`).

- [ ] **Step 1: Харнес-тест (червоний)**

Шапка — як `admin-catalog.test.ts` (мок `requireGrant` → admin, мок `@tanstack/react-start/server` `setResponseStatus`, `app_runtime`, `afterAll` з `closeDbPool()` ПЕРШИМ). Операції — з `simplycms/admin-server/impl`.

```ts
describe('довідники каталогу: CRUD ресурсів (Е4, Task 3)', () => {
  it('розділ: insert з клієнтським id, update ставить updatedAt', async () => { /* touch */ });
  it('розділ: дубль slug → AdminConflictError unique (constraint містить slug)', async () => {
    await expect(sectionsOps.insert({ data: [section({ slug: 'dup' })] })).resolves.toHaveLength(1);
    await expect(sectionsOps.insert({ data: [section({ slug: 'dup' })] }))
      .rejects.toMatchObject({ name: 'AdminConflictError', kind: 'unique' });
  });
  it('розділ: кириличний slug відбивається схемою до транзакції', async () => {
    await expect(sectionsOps.insert({ data: [section({ slug: 'розділ' })] })).rejects.toThrow();
  });
  it('розділ з товаром видаляється, товар лишається з section_id NULL', async () => { /* Review Focus 5 */ });
  it('розділ: parentId у payload мовчки зрізається (Е4-3)', async () => { /* parent_id IS NULL */ });
  it('властивість: propertyType пишеться insert-ом і НЕ змінюється update-ом', async () => {
    const [row] = await sectionPropertiesOps.insert({ data: [prop({ propertyType: 'select' })] });
    await sectionPropertiesOps.update({ data: [{ id: row.id, patch: { name: 'x', propertyType: 'text' } as never }] });
    expect((await readProp(row.id)).property_type).toBe('select');
  });
  it('властивість: видалення каскадно зносить опції і значення в товарах', async () => { /* Review Focus 5, факт для тексту попередження */ });
  it('опція: propertyId незмінний update-ом; дубль (propertyId, slug) → unique', async () => {});
  it('призначення: друге для тієї ж пари розділ/властивість з іншим appliesTo → unique', async () => {
    await sectionPropertyAssignmentsOps.insert({ data: [assign({ appliesTo: 'product' })] });
    await expect(sectionPropertyAssignmentsOps.insert({ data: [assign({ appliesTo: 'modification' })] }))
      .rejects.toMatchObject({ name: 'AdminConflictError', kind: 'unique' });
  });
  it('призначення: appliesTo поза переліком відбивається схемою', async () => {});
  it('тип ціни: кириличний code відбивається схемою; isDefault у payload зрізається', async () => {});
});
```

Run: `pnpm test:schema -- packages/simplycms/test-harness/pg/__tests__/admin-catalog-dictionaries.test.ts`
Expected: FAIL (ops не існують).

- [ ] **Step 2: Ресурси, барель, serverFn**

Пʼять `resource.ts` за таблицею Interfaces. `impl/index.ts`: прибрати `catalog-read`, експортувати нові ops. `admin-server/index.ts`: serverFn за переліком. Коментар над блоком — номер задачі й рішення, як у Е3.

- [ ] **Step 3: Зелене**

Run: `pnpm test:schema && pnpm typecheck`
Expected: PASS, разом з `admin-catalog.test.ts` (читальний ресурс розділів Е3, рядок ~285 — тепер на `sectionsOps`; якщо тест імпортує `sectionsReadOps`, перейменувати імпорт — це не послаблення асерту).

- [ ] **Step 4: Gate C на клієнтській межі**

Run: `pnpm build:packages && pnpm pilot:pack --skip-build`
Expected: Gate C і Gate IP зелені. Нові serverFn не тягнуть `drizzle-orm`/`pg` у клієнтський бандл.

- [ ] **Step 5: Гейт і коміт**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: зелено, ≤ 8 warnings.

```bash
git add -A packages/simplycms/src/admin-server packages/simplycms/test-harness/pg/__tests__/admin-catalog-dictionaries.test.ts
git commit -m "feat(k3-e4): записувані ресурси довідників каталогу і їхні serverFn"
```

---

## Task 4: Іменовані операції типу ціни — дефолт і guarded remove (Е4-1, Е4-2)

**Files:**
- Create: `packages/simplycms/src/admin-server/impl/price-types/set-default.ts`, `packages/simplycms/src/admin-server/impl/price-types/remove.ts`
- Modify: `packages/simplycms/src/admin-server/impl/index.ts`, `packages/simplycms/src/admin-server/index.ts`, `packages/simplycms/test-harness/pg/__tests__/admin-catalog-dictionaries.test.ts`

**Interfaces:**
- Consumes: `runAdmin`, `lockCatalogTarget` (`impl/catalog-lock.ts`).
- Produces:
  - `setDefaultPriceTypeInput = z.object({ id: z.uuid() })`; `setDefaultPriceTypeOp({ data }) → Promise<{ rows: PriceType[] }>` — усі змінені рядки (знятий дефолт + новий).
  - `removePriceTypesInput = z.array(z.object({ id: z.uuid() })).min(1).max(100)`; `removeManyPriceTypesOp({ data }) → Promise<{ count: number }>`.
  - serverFn: `setDefaultPriceType`, `removePriceTypes`.

- [ ] **Step 1: Тести (червоні) — дописати в `admin-catalog-dictionaries.test.ts`**

```ts
describe('типи цін: іменовані операції (Е4-2)', () => {
  it('setDefault знімає дефолт з retail і ставить новому; повертає обидва рядки', async () => {
    const { rows } = await setDefaultPriceTypeOp({ data: { id: WHOLESALE } });
    expect(rows.map((r) => [r.id, r.isDefault]).sort()).toEqual([[RETAIL, false], [WHOLESALE, true]].sort());
  });
  it('setDefault на вже дефолтному — no-op без 23505', async () => {});
  it('два одночасні setDefault різних типів → рівно один дефолт', async () => {
    await Promise.all([
      setDefaultPriceTypeOp({ data: { id: A } }),
      setDefaultPriceTypeOp({ data: { id: B } }),
    ]);
    const [{ n }] = await queryRows(dbUrl, 'select count(*)::int n from public.price_types where is_default');
    expect(n).toBe(1);
  });
  it('remove дефолтного — помилка, нічого не видалено (увесь batch)', async () => {
    await expect(removeManyPriceTypesOp({ data: [{ id: RETAIL }, { id: SPARE }] })).rejects.toThrow(/дефолт/);
    expect(await exists(SPARE)).toBe(true);
  });
  it('remove типу з цінами → AdminConflictError reference, ціни цілі (Review Focus 1)', async () => {
    await expect(removeManyPriceTypesOp({ data: [{ id: WHOLESALE_WITH_PRICES }] }))
      .rejects.toMatchObject({ name: 'AdminConflictError', kind: 'reference' });
    expect(await priceCount(WHOLESALE_WITH_PRICES)).toBe(1);
  });
  it('remove типу без посилань — count 1', async () => {});
  it('remove неіснуючого id — помилка, без часткового видалення', async () => {});
  // 🔴 ред.2 (аудит Codex, знахідка 2): гонка, яку зразки Е1б/Е3 пропускають.
  it('setDefault(X) паралельно з remove(X) → завжди рівно один дефолт', async () => {
    for (let i = 0; i < 20; i++) {
      const X = await freshPriceType();          // не дефолтний, без цін
      await Promise.allSettled([
        setDefaultPriceTypeOp({ data: { id: X } }),
        removeManyPriceTypesOp({ data: [{ id: X }] }),
      ]);
      const [{ n }] = await queryRows(dbUrl, 'select count(*)::int n from public.price_types where is_default');
      expect(n, `ітерація ${i}`).toBe(1);
    }
  });
  it('setDefault неіснуючого id — помилка, старий дефолт лишився', async () => {});
});
```

Run: `pnpm test:schema -- packages/simplycms/test-harness/pg/__tests__/admin-catalog-dictionaries.test.ts`
Expected: FAIL (операцій немає).

- [ ] **Step 2: Реалізація**

🔴 *(ред.2 — аудит Codex, знахідка 2)* Зразки Е1б/Е3 тут НЕ копіюються дослівно: `product-modifications/set-default.ts:29-55` читає ціль ДО локу і не перевіряє результат `UPDATE`, а `order-statuses/remove.ts` локів advisory не бере. Тоді `remove(X)` міг завершитись між читанням `X` і `UPDATE … set is_default = true where id = X`: старий дефолт уже знято, ціль оновлює нуль рядків, дефолту немає. Обидві операції мусять мати однаковий порядок:

1. `lockCatalogTarget(db, 'price-type-default')` — ПЕРШИЙ запит транзакції в обох операціях.
2. `setDefault`: `select … where id = $id for update` → рядка немає, кидаємо `Error`. Якщо ціль уже дефолтна — повернути `{ rows: [ціль] }` (no-op). Далі зняти дефолт з інших (`is_default = true and id <> $id`) → поставити цілі. Якщо `UPDATE` цілі повернув 0 рядків, кидаємо `Error`, і транзакція відкочує зняття.
3. `remove`: `select … where id in (…) order by id for update` → відсутні id або дефолтний серед них, кидаємо `Error('[admin-server] дефолтний тип ціни видалити не можна — призначте інший дефолт')` → `delete … returning`.

Advisory-lock на рівні довідника, а не рядка, — свідомо: він серіалізує обидві операції незалежно від того, чи рядок-ціль ще існує. Порядок «advisory → рядкові локи» той самий, що в `catalog-lock.ts`, тож циклу очікування з вітриною немає: вітрина рядки `price_types` не блокує. 23503 (RESTRICT, Е4-1) перетворює на `AdminConflictError` сам `runAdmin`; власного мапінгу не писати.

serverFn — топ-рівневі `const` з коментарем «remove ЦІЄЇ сутності — guarded, не фабричний».

- [ ] **Step 3: Зелене**

Run: `pnpm test:schema && pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 4: Коміт**

```bash
git add packages/simplycms/src/admin-server packages/simplycms/test-harness/pg/__tests__/admin-catalog-dictionaries.test.ts
git commit -m "feat(k3-e4): setDefault і guarded remove для типів цін"
```

---

## Task 5: Колекції довідників — запис через канон `persistenceHandlers`

**Files:**
- Modify: `packages/simplycms/src/admin-data/collections/{sections,price-types,section-properties,property-options,section-property-assignments}.ts`, `packages/simplycms/src/admin-data/__tests__/catalog-collections.test.tsx`
- Create: `packages/simplycms/src/admin-data/__tests__/on-demand-full-slice.test.tsx` (ред.2)

**Interfaces:**
- Consumes: serverFn із Task 3/4.
- Produces: ті самі `sectionsCollection`, `priceTypesCollection`, `sectionPropertiesCollection`, `propertyOptionsCollection`, `sectionPropertyAssignmentsCollection` (імена й ENTITY без змін), тепер з `onInsert`/`onUpdate`/`onDelete`. Для `priceTypesCollection` `remove` = `removePriceTypes` (guarded), для решти — фабричний `remove*`.

- [ ] **Step 1: Тести (червоні)**

У `catalog-collections.test.tsx` — за зразком `order-statuses-collection.test.ts` (мок serverFn модулем `simplycms/admin-server`):

```ts
it.each([
  ['sections', sectionsCollection, 'insertSections'],
  ['price_types', priceTypesCollection, 'insertPriceTypes'],
  ['section_properties', sectionPropertiesCollection, 'insertSectionProperties'],
  ['property_options', propertyOptionsCollection, 'insertPropertyOptions'],
  ['section_property_assignments', sectionPropertyAssignmentsCollection, 'insertSectionPropertyAssignments'],
])('%s: insert викликає serverFn з УСІМА рядками транзакції і пише серверний рядок', async (_e, def, fn) => {
  /* дві мутації в одній транзакції → один виклик з масивом із 2; write-back без refetch */
});
it('price_types: delete іде через removePriceTypes (guarded), не фабричний', async () => {});
it('price_types: відмова сервера відкочує оптимістичне видалення', async () => {});
```

🔴 *(ред.2 — аудит Codex, знахідка 6)* Е4-9 спирається на поведінку, якої наявні контрактні тести не покривають: `on-demand-contract.test.tsx:91-201` перевіряє фільтр, пагінацію, `findOne` і join, але не live-запит БЕЗ `where` разом із записом. Новий `admin-data/__tests__/on-demand-full-slice.test.tsx` — на СПРАВЖНІЙ `@tanstack/db` і одному спільному `QueryClient` (шапка й стаб serverFn — як `on-demand-contract.test.tsx`; стаб `listSectionProperties` фільтрує фікстурний масив за переданим subset, а не ігнорує його):

```ts
it('useLiveQuery без where над on-demand колекцією отримує ВЕСЬ довідник', async () => {
  // 3 властивості у стабі → у результаті 3, порядок за name
});
it('insert через колекцію з’являється у повному зрізі без refetch', async () => {});
it('після unmount/повторного mount повний зріз включає записаний рядок (write-back живе в кеші)', async () => {});
it('паралельний зріз where id = X (картка) і повний зріз (список) узгоджені після update', async () => {});
```

Якщо бібліотека поводиться інакше (наприклад, повний зріз не викликає `loadSubset`), це **точка зупинки**: повідомити замовника, Е4-9 переглядається. Сторінку на здогадку не будувати.

Run: `pnpm vitest run packages/simplycms/src/admin-data`
Expected: FAIL (`collection.insert` на колекції без хендлерів кидає).

- [ ] **Step 2: Реалізація**

У кожному файлі — `ref`-комірка й `...persistenceHandlers<Row>(() => ref.current!, { entity, insert, update, remove })` за зразком `order-statuses.ts`. Для on-demand колекцій — те саме поверх `onDemandCollectionOptions`. Докстрінги «Довідник на ЧИТАННЯ … БЕЗ persistenceHandlers» замінити на «Запис — Е4 (Task 5)».

- [ ] **Step 3: Зелене + гейт канону хендлерів**

Run: `pnpm vitest run packages/simplycms/src/admin-data tests/handler-canon.test.ts`
Expected: PASS. `handler-canon` сам знаходить нові хендлери в `admin-data`, правок у тесті немає.

- [ ] **Step 4: Регрес картки товару Е3**

Run: `pnpm vitest run packages/simplycms/src/admin/features/products`
Expected: PASS без правок — має бути ЗЕЛЕНИМ одразу (картка лише читає ці колекції).

- [ ] **Step 5: Гейт і коміт**

Run: `pnpm lint && pnpm typecheck && pnpm test`

```bash
git add packages/simplycms/src/admin-data
git commit -m "feat(k3-e4): запис у колекціях довідників через persistenceHandlers"
```

---

## Task 6: Типи цін — список і картка

**Files:**
- Create: `packages/simplycms/src/admin/features/catalog-dictionaries/price-types/{PriceTypesPage.tsx,PriceTypeEditPage.tsx,price-type-form-schema.ts,usePriceTypeDefault.ts}` + `__tests__/`
- Modify: `packages/simplycms/src/admin/pages/PriceTypes.tsx`, `packages/simplycms/src/admin/pages/PriceTypeEdit.tsx`, `packages/simplycms/src/i18n/catalogs/{uk,en}/admin/prices.ts`

**Interfaces:**
- Consumes: `priceTypesCollection`; `setDefaultPriceType`; `PRICE_TYPE_CODE_RE`; `reportTxError`, `adminErrorKey`.
- Produces:
  - `priceTypeFormSchema` (zod): `name: string.trim.min(1)`, `code: string.trim.regex(PRICE_TYPE_CODE_RE)`, `sortOrder: coerce.number.int.min(0)`, `isDefault: boolean`.
  - `usePriceTypeDefault(): (id: string) => Promise<void>` — кличе `setDefaultPriceType` і робить write-back повернутих `rows` (`collection.utils.writeBatch` + `writeUpsert`) — це синк для `mutation-cache-sync`.
  - `pages/PriceTypes.tsx` → `export { default } from '../features/catalog-dictionaries/price-types/PriceTypesPage'`; `pages/PriceTypeEdit.tsx` → реекспорт `PriceTypeEditPage` (сторінка сама розрізняє `new`/id через `useParams`, як легасі).
- Нові i18n-ключі (якщо рівного за змістом ключа ще немає — перевірити `rg` у `catalogs/uk/admin`): `admin.prices.defaultLocked` («Дефолтний тип ціни видалити не можна»), `admin.prices.codeFormat` («Лише латиниця, цифри й _»).

- [ ] **Step 1: Тести (червоні)**

```ts
// price-type-form-schema.test.ts
it('code: кирилиця й дефіс відбиваються', () => {
  expect(priceTypeFormSchema.safeParse({ ...ok, code: 'оптова' }).success).toBe(false);
  expect(priceTypeFormSchema.safeParse({ ...ok, code: 'b2b-x' }).success).toBe(false);
});
// PriceTypesPage.test.tsx (стаб двигуна — як features/products/edit/__tests__/test-engine-stub.ts)
it('кнопка видалення дефолтного типу disabled', () => {});
it('відмова видалення з 409 reference → тост admin.errors.conflictReference, рядок повертається', async () => {});
// PriceTypeEditPage.test.tsx
it('створення: collection.insert з crypto id; isDefault=true → після персисту setDefaultPriceType', async () => {});
it('зняти перемикач у дефолтного неможливо — контрол disabled із підказкою', () => {});
it('невалідний code → помилка біля поля, insert не викликано', async () => {});
```

Run: `pnpm vitest run packages/simplycms/src/admin/features/catalog-dictionaries/price-types`
Expected: FAIL.

- [ ] **Step 2: Реалізація**

Список: `useLiveQuery` по `priceTypesCollection`, `orderBy sortOrder`; видалення — `collection.delete(id)` + `reportTxError` на `tx.isPersisted.promise`. Картка: react-hook-form + `zodResolver(priceTypeFormSchema)`. Створення/збереження — `collection.insert`/`update` (без `isDefault` у patch: колонка readonly); якщо форма каже `isDefault` і рядок ще не дефолтний — після `isPersisted` викликати `usePriceTypeDefault()`. Двофазність чесна, як у `OrderStatuses.tsx`: падіння setDefault — окремий тост, рядок уже створено. Роут-лоадери не змінюються (eager-колекцію прогріває loader `products`; для `/admin/price-types` додати `preload()` у роут-файл лише якщо без нього блимає порожня таблиця — записати факт у звіт).

- [ ] **Step 3: Зелене + лінт**

Run: `pnpm vitest run packages/simplycms/src/admin/features/catalog-dictionaries && pnpm lint && pnpm typecheck`
Expected: PASS; i18n-селектори без помилок; `mutation-cache-sync` без помилок.

- [ ] **Step 4: Коміт**

```bash
git add packages/simplycms/src/admin packages/simplycms/src/i18n
git commit -m "feat(k3-e4): сторінки типів цін на колекції з setDefault"
```

---

## Task 7: Розділи — список і картка (зображення, SEO)

**Files:**
- Create: `packages/simplycms/src/admin/features/catalog-dictionaries/sections/{SectionsPage.tsx,SectionEditPage.tsx,section-form-schema.ts}` + `__tests__/`
- Modify: `packages/simplycms/src/admin/pages/Sections.tsx`, `packages/simplycms/src/admin/pages/SectionEdit.tsx`, `packages/simplycms/src/i18n/catalogs/{uk,en}/admin/{sections,common}.ts`

**Interfaces:**
- Consumes: `sectionsCollection`; `ImageUpload` (`entityType="section"`, `maxImages={1}`, `entityId={id}`); `RichTextEditor`; `SLUG_RE`.
- Produces:
  - `sectionFormSchema`: `name: min(1)`, `slug: regex(SLUG_RE)`, `description`, `metaTitle`, `metaDescription` (trim, порожнє → `null` при записі), `sortOrder: coerce int ≥ 0`, `isActive: boolean`, `images: string[]` (0..1; ↔ `imageUrl`).
  - `toSectionPatch(v)` / `toSectionDraft(v, id, now)` — за зразком `toProductPatch`/`toProductDraft` (`parentId` у draft завжди `null`, Е4-3).
  - Слот для панелі призначень: `SectionEditPage` рендерить `<SectionPropertyAssignmentsPanel sectionId={id} />` лише для наявного розділу. Компонент створює Task 8; до того — рядок не додається (Task 8 додає його сам).
- i18n: `admin.sections.deleteWarning` («Товари цього розділу лишаться без розділу»), `admin.common.slug`, `admin.common.seo`, `admin.common.metaTitle`, `admin.common.metaDescription` (якщо рівних ще немає).

- [ ] **Step 1: Тести (червоні)**

```ts
it('slug з кирилицею → помилка, insert не викликано', async () => {});
it('створення: insert з crypto id, parentId null, imageUrl з першого референсу', async () => {});
it('картинку прибрано → patch imageUrl: null', async () => {});
it('діалог видалення містить admin.sections.deleteWarning', async () => {}); // Review Focus 5
it('дубль slug → тост admin.errors.slugTaken, форма лишається з введеним', async () => {});
```

Run: `pnpm vitest run packages/simplycms/src/admin/features/catalog-dictionaries/sections`
Expected: FAIL.

- [ ] **Step 2: Реалізація**

Список: `useLiveQuery` по `sectionsCollection`, `orderBy sortOrder, name`; мініатюра — `resolveMediaUrl(section.imageUrl)` з `simplycms/domain/media`, як `ProductRow.tsx:21` (не `<img src={imageUrl}>`: це референс, не URL, Е2-1). Картка — react-hook-form; після створення — навігація на список (як легасі); `pages/SectionEdit.tsx` — диспетчер `new`/id за зразком `pages/ProductEdit.tsx`.

- [ ] **Step 3: Зелене + лінт, коміт**

Run: `pnpm vitest run packages/simplycms/src/admin/features/catalog-dictionaries && pnpm lint && pnpm typecheck && pnpm test`

```bash
git add packages/simplycms/src/admin packages/simplycms/src/i18n
git commit -m "feat(k3-e4): сторінки розділів на колекції із зображенням через порт сховища"
```

---

## Task 8: Властивості, опції й призначення властивостей розділу

**Files:**
- Create: `packages/simplycms/src/admin/features/catalog-dictionaries/properties/{PropertiesPage.tsx,PropertyEditPage.tsx,PropertyOptionEditPage.tsx,PropertyOptionsTable.tsx,property-form-schema.ts,option-form-schema.ts}` + `__tests__/`; `packages/simplycms/src/admin/features/catalog-dictionaries/assignments/{SectionPropertyAssignmentsPanel.tsx,AddAssignmentDialog.tsx,available-properties.ts}` + `__tests__/`
- Modify: `packages/simplycms/src/admin/pages/{Properties,PropertyEdit,PropertyOptionEdit}.tsx`, `packages/simplycms/src/admin/features/catalog-dictionaries/sections/SectionEditPage.tsx`, `packages/simplycms/src/admin/index.ts`, `packages/simplycms/src/i18n/catalogs/{uk,en}/admin/properties.ts`
- Delete: `packages/simplycms/src/admin/components/SectionPropertiesManager.tsx`, `packages/simplycms/src/admin/components/SectionPropertiesTable.tsx`

**Interfaces:**
- Consumes: `sectionPropertiesCollection`, `propertyOptionsCollection`, `sectionPropertyAssignmentsCollection`; `ImageUpload` (`entityType="property_option"`); `SLUG_RE`.
- Produces:
  - `propertyFormSchema`: `name: min(1)`, `slug: regex(SLUG_RE)`, `propertyType: enum(7 значень enum-у БД)`, `isRequired`, `isFilterable`, `hasPage: boolean`, `sortOrder: coerce int ≥ 0`.
  - `optionFormSchema`: `name: min(1)`, `slug: regex(SLUG_RE)`, `sortOrder`, `description`, `metaTitle`, `metaDescription`, `images: string[]` (0..1 ↔ `imageUrl`).
  - `availableProperties(all: SectionProperty[], assigned: SectionPropertyAssignment[]): SectionProperty[]` — виключає БУДЬ-ЯКУ вже призначену цьому розділу властивість, незалежно від `appliesTo` (унікальність `(section_id, property_id)`, Review Focus 3).
  - `SectionPropertyAssignmentsPanel({ sectionId }: { sectionId: string })` — дві таблиці (для товарів / для модифікацій), додавання з `sortOrder = довжина відповідного списку`, видалення.
- Поведінка картки властивості: у режимі редагування `propertyType` показаний як текст, контролу немає (Е4-5); блок опцій — лише для `select`/`multiselect`; нова опція отримує `sortOrder` = кількість опцій властивості (з колекції, не `count` з БД). 🔴 *(ред.2 — аудит Codex, знахідка 4)* Кожен рядок `PropertyOptionsTable` має видалення опції з підтвердженням (`propertyOptionsCollection.delete(id)`; помилка → `reportTxError`, бібліотека відкочує рядок) — як `deleteOptionMutation` легасі (`PropertyEdit.tsx:150-162`, `:392-408`). Діалог попереджає: значення цієї опції в товарах стануть порожніми (`product_property_values.option_id` / `modification_property_values.option_id` — ON DELETE SET NULL).
- i18n: `admin.properties.deleteWarning` («Значення цієї властивості в усіх товарах буде видалено»), `admin.properties.typeImmutable` («Тип не змінюється після створення»), `admin.properties.options.deleteWarning` («Значення цієї опції в товарах стануть порожніми»).

- [ ] **Step 1: Тести (червоні)**

```ts
// available-properties.test.ts
it('властивість, призначена для товарів, не доступна і для модифікацій', () => {
  expect(availableProperties([P1, P2], [assign(P1, 'product')]).map((p) => p.id)).toEqual([P2.id]);
});
// PropertyEditPage.test.tsx
it('у режимі редагування немає контролу типу; update не несе propertyType', async () => {});
it('блок опцій відсутній для text/number/boolean', () => {});
it('діалог видалення містить admin.properties.deleteWarning', async () => {});
// PropertyOptionEditPage.test.tsx
it('нова опція: insert з propertyId з роута і sortOrder = кількість опцій', async () => {});
// PropertyOptionsTable.test.tsx (ред.2)
it('видалення опції: підтвердження → collection.delete(id); відмова сервера → тост, рядок повернувся', async () => {});
it('кириличний slug → помилка біля поля', async () => {});
// SectionPropertyAssignmentsPanel.test.tsx
it('додавання: insert з crypto id, appliesTo режиму діалогу', async () => {});
it('сервер 409 unique → тост admin.errors.conflictUnique, рядок відкочено', async () => {});
```

Run: `pnpm vitest run packages/simplycms/src/admin/features/catalog-dictionaries`
Expected: FAIL.

- [ ] **Step 2: Реалізація**

Список властивостей: `useLiveQuery` по on-demand `sectionPropertiesCollection` без `where`, `orderBy name` (Е4-9). Створення — у діалозі, як легасі, але на react-hook-form + `propertyFormSchema`. Опції в картці — `useLiveQuery` з `where propertyId = id` (зріз on-demand, як у картці товару Е3). Панель призначень: призначення — `where sectionId`; назви властивостей — з колекції властивостей у тому ж live-запиті (join) або окремим запитом (на вибір виконавця). `SectionEditPage` (Task 7) рендерить панель для наявного розділу. Прибрати `SectionPropertiesManager`/`SectionPropertiesTable` і їхні рядки в `src/admin/index.ts`; перевірити `rg "SectionPropertiesManager|SectionPropertiesTable" packages tests` → порожньо.

- [ ] **Step 3: Зелене + лінт**

Run: `pnpm vitest run packages/simplycms/src/admin && pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 4: Коміт**

```bash
git add -A packages/simplycms/src/admin packages/simplycms/src/i18n
git commit -m "feat(k3-e4): властивості, опції й призначення властивостей розділу на колекціях"
```

---

## Task 9: Гейти етапу — ратчет id, реєстр винятків К3-2, заглушка легасі

**Files:**
- Create: `tests/admin-server-first/registry.ts`, `tests/admin-server-first-registry.test.ts`
- Modify: `tests/admin-inserts-need-id.test.ts`, `packages/simplycms/src/admin/layouts/LegacySupabaseBoundary.tsx` (+ `__tests__/LegacySupabaseBoundary.test.tsx`), `packages/simplycms/src/i18n/catalogs/{uk,en}/admin/legacy.ts` (якщо підписам посилань потрібні ключі)

**Interfaces:**
- Produces *(ред.2 — аудит Codex, знахідки 5 і 7)*:
  - `SERVER_FIRST_EXCEPTIONS: ReadonlyArray<{ file: string; entities: readonly EntityName[]; operations: readonly string[]; reason: string; wave: 'Е5' | 'Е6' | 'Е7' }>` — свідомі винятки К3-2 (сутності й операції, а не лише файл). Перший запис: `{ file: 'packages/simplycms/src/admin/pages/PriceValidator.tsx', entities: [ENTITY.profiles, ENTITY.userCategories, ENTITY.priceTypes, ENTITY.products, ENTITY.productModifications, ENTITY.productPrices, ENTITY.discounts, ENTITY.discountGroups], operations: ['explainPrice: читання дефолтного типу ціни, цін товару, знижок і груп знижок для пояснення розрахунку'], reason: 'обчислення ціни, не сутність (К3-2)', wave: 'Е6' }`. Імена ключів ENTITY звірити з `contracts/entities.ts`; якщо якогось немає — записати рядком таблиці й повідомити у звіті.
  - `PENDING_LEGACY: ReadonlyArray<{ file: string; wave: 'Е5' | 'Е6' | 'Е7' }>` — решта файлів `src/admin/**` з `useSupabaseClient` після Е4. Хвилю брати з `v2-state-map.md` §3.1/§6: замовлення й `AddProductToOrder` — Е5; `LegacySupabaseBoundary` і його тест — Е7; решта — Е6.

- [ ] **Step 1: Ратчет id — до виміряного факту**

`admin-inserts-need-id.test.ts` друкує кількість лише в повідомленні ПРОВАЛЕНОГО асерту (`:122-125`), тож зелений прогін числа не покаже. Вимір: тимчасово поставити `KNOWN_WITHOUT_ID = 0` → `pnpm vitest run tests/admin-inserts-need-id.test.ts` → взяти `вставок без id: N` з виводу FAIL → поставити `KNOWN_WITHOUT_ID = N` з коментарем «Е4: −(27−N) (довідники каталогу)» → прогін PASS. Очікувано `N = 21` (−6: `SectionEdit`, `PriceTypeEdit`, `Properties`, `PropertyOptionEdit`, `SectionPropertiesManager`, `SectionPropertiesTable`). Обидва виводи — у звіт задачі. Якщо `N ≠ 21`, розібратися, який файл не врахований, а не підганяти.

- [ ] **Step 2: Реєстр легасі й винятків — тест (червоний) і реалізація**

```ts
const actual = filesWithUseSupabaseClient('packages/simplycms/src/admin'); // той самий скан, що й rg -l
const registered = [...SERVER_FIRST_EXCEPTIONS, ...PENDING_LEGACY].map((e) => e.file);

it('кожен легасі-файл адмінки зареєстрований (виняток К3-2 або хвиля)', () => {
  expect(actual.filter((f) => !registered.includes(f))).toEqual([]);
});
it('у реєстрі немає протухлих записів (файл існує і ще легасі)', () => {
  expect(registered.filter((f) => !actual.includes(f))).toEqual([]);
});
it('винятки К3-2 називають сутності, операції й причину', () => {
  for (const e of SERVER_FIRST_EXCEPTIONS) {
    expect(e.entities.length).toBeGreaterThan(0);
    expect(e.operations.length).toBeGreaterThan(0);
    expect(e.reason.length).toBeGreaterThan(10);
  }
});
it('файл не стоїть в обох списках і не дублюється', () => {});
```

Негативні контроли (вивід кожного червоного прогону — у звіт): (а) прибрати запис `PriceValidator` → червоніє перший тест («незареєстрований»); (б) дописати запис із файлом, якого немає, → червоніє другий тест; (в) тимчасово додати `useSupabaseClient` у будь-яку сторінку `features/**` → червоніє перший тест. Після кожного контролю повернути як було.

- [ ] **Step 3: Заглушка легасі**

`LegacySupabaseBoundary`: до посилань «товари» і «статуси замовлень» додати «розділи», «типи цін», «властивості». Тест заглушки перевіряє наявність п'яти посилань (`href` через `adminPath`).

- [ ] **Step 4: Лічильник легасі**

Run: `rg -l useSupabaseClient packages/simplycms/src/admin | wc -l`
Expected: `34` (було 43: −7 сторінок, −2 видалені компоненти; `PriceValidator` уже був серед 43 і лишається). Це число = `SERVER_FIRST_EXCEPTIONS.length + PENDING_LEGACY.length`, і тест Step 2 стереже його в обидва боки.

Run: `rg -l useSupabaseClient packages/simplycms/src/admin/features`
Expected: порожньо.

- [ ] **Step 5: Повна перевірка гейтів етапу**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:schema && pnpm build:packages && pnpm pilot:pack --skip-build`
Expected: усе зелене; lint 0 errors / ≤ 8 warnings; Gate C зелений.

- [ ] **Step 6: Коміт**

```bash
git add tests packages/simplycms/src/admin/layouts packages/simplycms/src/i18n
git commit -m "test(k3-e4): ратчет id, реєстр server-first винятків К3-2 і заглушка легасі"
```

---

## Task 10: Живий прогін — власник наповнює довідники, вітрина їх бачить; доки й повний ланцюг

**Files:**
- Create: `scripts/live-smoke/admin-dictionaries.mjs`, `scripts/live-smoke/owner-session.mjs`
- Modify: `scripts/live-smoke.mjs`, `scripts/live-smoke/admin-catalog.mjs`, `scripts/live-smoke/admin-sql.mjs` (SQL-хелпери за потреби), `docs/tasks/platform-roadmap.md`, `docs/tasks/v2-state-map.md`, `CLAUDE.md`, цей план (розділ «Факти виконання»)

**Interfaces** *(ред.2 — аудит Codex, знахідка 3: сьогодні `runAdminCatalogStep` сам створює контекст і закриває його в `finally`, `admin-catalog.mjs:29-52`, `:140-148`, тож наступному кроку залогіненої сесії не дістати)*:
- Produces:
  - `openOwnerSession({ browser, base, storeEnv }) → Promise<{ context: BrowserContext }>` (`owner-session.mjs`): випуск запрошення через `owner-invite.mts` → пароль → `waitForURL(${base}/admin)`. Це винесений без змін блок входу з `admin-catalog.mjs:36-~70` разом із константою `PASSWORD`.
  - `runAdminCatalogStep({ context, base, dbUrl, check })` — сигнатура змінюється: `browser`/`storeEnv` → готовий `context`. Крок відкриває власну сторінку `context.newPage()` з власним лічильником `pageerror` і **не закриває** контекст.
  - `runAdminDictionariesStep({ context, base, dbUrl, check })` — те саме правило: своя сторінка, свій лічильник, контекст не закриває.
- Виклик у `live-smoke.mjs` (замість рядка 122):
  ```js
  const owner = await openOwnerSession({ browser, base, storeEnv: env });
  try {
    await runAdminCatalogStep({ context: owner.context, base, dbUrl, check });
    await runAdminDictionariesStep({ context: owner.context, base, dbUrl, check });
  } finally {
    await owner.context.close();
  }
  ```
- Регрес: крок каталогу Е3 дає ті самі рядки `check`, що й до рефакторингу. Звірити таблицю виводу з «Фактами виконання» плану Е3.

- [ ] **Step 1: Крок живого прогону**

Сценарій (кожен рядок — `check('адмін: …' | 'вітрина: …', умова)`):
1. `/admin/sections/new` → розділ `live-dict-section`, активний, із зображенням → SQL: рядок є, `image_url` — референс сховища → `/catalog` на вітрині показує розділ.
2. Повторне створення з тим самим slug → тост `admin.errors.slugTaken` (текст uk), другого рядка в БД немає.
3. `/admin/properties` → властивість `live-dict-prop`, тип `select`, `hasPage`, `isFilterable` → картка: контролу типу немає → опція `live-dict-opt` → SQL: опція з `property_id` властивості.
4. Картка розділу → призначити властивість «для товарів» → SQL: рядок призначення з `applies_to = 'product'`; у діалозі «для модифікацій» властивість відсутня.
5. Вітрина: `/properties/live-dict-prop` віддає 200 і містить назву опції.
6. `/admin/price-types` → тип `live_dict_type` → видалити → рядка немає; кнопка видалення `retail` (дефолт) disabled; спроба видалити тип, яким ціновано демо-товар (поставити ціну через картку товару або SQL-фікстурою кроку), → тост `admin.errors.conflictReference`, ціни на місці.
7. Прибирання: видалити розділ → SQL: розділу немає; призначення зникло каскадом.
8. `pageerror` адмін-контексту = 0.

Run: `PG_HARNESS_URL=<кластер> pnpm live:smoke`
Expected: `live-smoke: ЗЕЛЕНИЙ`, усі рядки кроку OK. Вивід цілком — у «Факти виконання».

- [ ] **Step 2: Ручний прогін (браузер, `pnpm db:demo` → `pnpm build && pnpm start`)**

Пункти «пункт — факт»: редагування дефолтного типу ціни і перемикання дефолту на інший тип (вітрина гостя показує ціну нового дефолту, якщо в товару вона є); зміна порядку розділів числовим полем; multiselect-властивість з трьома опціями — значення в картці товару Е3 виставляються; відкат оптимістичного запису при зупиненому сервері; англійська локаль `/admin/properties` без кирилиці.

- [ ] **Step 3: Доки**

`v2-state-map.md`: §1 (новий абзац К3-Е4), §2.5 (вивід `live:smoke`), §3.1 (виняток Е4: живі довідники; лічильник 34; `PriceValidator` → Е6), §6 (Е4 ✅, наступне — Е5). `platform-roadmap.md`: «Поточний стан» і черга К3 (Е4 ✅, «Наступні — Е5»); у «Відкриті борги» — хвіст «ручний in_stock при нульовому залишку» (з Е3) і дерево розділів (Е4-3). `CLAUDE.md`: перелік живих сторінок адмінки (абзац «Стан на 0.5.0»/К3), лічильник 34, правки baseline Е4-1/Е4-6 у розділі БД не потрібні, якщо там немає переліку обмежень (перевірити).

- [ ] **Step 4: Повний ланцюг**

Run:
```bash
pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm build && pnpm typecheck && pnpm test && pnpm test:schema && pnpm build:packages && pnpm typecheck:template && pnpm test:packaging && pnpm pilot:pack --skip-build
```
Expected: кожен крок зелений; lint 0 errors / ≤ 8 warnings. Вивід — у «Факти виконання».

- [ ] **Step 5: Коміт**

```bash
git add -A scripts docs CLAUDE.md
git commit -m "docs(k3-e4): живий прогін довідників, карта стану й роадмап"
```

---

## DoD етапу Е4

1. `pnpm live:smoke` зелений з кроком довідників (Task 10, Step 1); вивід у «Факти виконання».
2. Ручний прогін (Task 10, Step 2) — кожен пункт із фактом.
3. `pnpm test:schema` доводить RESTRICT цін, глобальний slug властивості, атомарний дефолт типу ціни і guarded remove (Tasks 1, 3, 4).
4. Негативні контролі: гейт `schema-sources-parity` (Task 1), реєстр винятків (Task 9) — вивід червоного прогону в звіті.
5. Повний ланцюг + `pilot:pack --skip-build` зелений; lint 0 / ≤ 8.
6. `rg -l useSupabaseClient packages/simplycms/src/admin | wc -l` = 34; у `features/` — 0.
7. Доки оновлено: `v2-state-map.md`, `platform-roadmap.md`, `CLAUDE.md`.

## Точка передачі

Повернутись на валідацію з артефактами: вивід повного ланцюга; вивід `live:smoke`; факти ручного прогону; виводи негативних контролів; `git log --oneline` етапу. Наступний план — **Е5: замовлення** (`Orders`, `OrderDetail`, `AddProductToOrder`; scope `'own'` для покупця — окремий хелпер, не `runAdmin`).
