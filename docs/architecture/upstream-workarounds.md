# Обходи дефектів і обмежень залежностей (моніторинг апгрейдів)

> **ЄДИНИЙ файл на весь проєкт.** Кожен обхід, який ми тримаємо в коді
> через дефект, обмеження або недокументовану поведінку сторонньої
> бібліотеки, записується СЮДИ — не в коментар, не в план етапу, не в
> пам'ять сесії. План/спека можуть посилатися на запис за ID, але не
> дублюють його.
>
> **Навіщо.** Обхід живе довше за контекст, у якому його знайшли. Коли
> бібліотеку оновлять і дефект виправлять, обхід стане зайвим кодом — а
> часто й шкідливим (наприклад, `gcTime: 0` коштує повторного запиту на
> кожне повернення до списку). Без реєстру ніхто не згадає, що саме
> прибирати, і як перевірити, що виправлення справжнє.

## Як користуватися

**При апгрейді будь-якої залежності зі списку нижче** (`pnpm up`,
Renovate/Dependabot, ручний бамп у `package.json` чи
`template/package.json.tpl`):

1. Знайти записи цієї бібліотеки (колонка «Бібліотека» / пошук за іменем).
2. Для кожного — виконати «Перевірку виправлення» на НОВІЙ версії.
3. Якщо виправлено — зробити кроки «Коли виправлять», прибрати маркери
   `UPSTREAM:<ID>` з коду і перенести запис у розділ «Закриті» з датою й
   версією.
4. Якщо ні — оновити в записі «Перевірено на версії» (дата + версія), щоб
   було видно, що перевірку зроблено, а не пропущено.

**Маркер у коді.** Кожне місце обходу позначається коментарем
`UPSTREAM:<ID>` (напр. `// UPSTREAM:TSDB-1 — див. docs/architecture/upstream-workarounds.md`).
Повний перелік місць обходу — `git grep -n "UPSTREAM:TSDB-1"`. Запис без
маркерів у коді або маркер без запису — дефект реєстру.

**Новий запис** — ID `<ПРЕФІКС>-<N>` (префікс бібліотеки, номер наскрізний),
усі поля обовʼязкові; «корінь» — з якорем на ВИХІДНИЙ код бібліотеки
(`node_modules/.pnpm/<pkg>@<ver>/…/src/<file>:<line>`), а не переказ доків.

---

## Активні

### TSDB-1 · write-back колекції перезаписує ВСІ ключі під префіксом

| Поле | Значення |
|---|---|
| Бібліотека | `@tanstack/query-db-collection` |
| Знайдено на | 1.2.11 (2026-09-23); той самий код у 1.2.15 (`src/query.ts:2269`) |
| Перевірено на версії | 1.2.11 — 2026-09-23 |
| Статус апстріму | не повідомлено (рішення власника) |

**Симптом.** (а) Власник перейменував товар у картці адмінки → повернувся
у список → у списку лише перейменований товар; F5 показує всі. (б) Ключ
вітрини під префіксом `[entity, 'list', …]` (напр. рекомендовані товари
головної) після збереження в адмінці містить адмінські рядки чужої форми.

**Корінь.** `writeUpsert`/`writeDelete` → `manual-sync.ts:225`
`ctx.updateCacheData(updatedData)` → `src/query.ts:2211`
`queryClient.getQueryCache().findAll({ queryKey: baseKey })` — ПРЕФІКСНИЙ
пошук, активні Й неактивні записи — і `setQueryData(key, items)` у кожен,
де `items` — весь поточний synced-набір колекції. Коментар бібліотеки: захист
від ghost items при повторному підхопленні стейл-кешу. Коректно для
`eager` (synced = повний набір). Для `on-demand` synced = лише рядки
АКТИВНИХ зрізів, тож неактивний demand-ключ (список, розмонтований на час
картки, живий у кеші до `gcTime`) отримує обрізаний набір як свіжий.

**Наш обхід.**
- Е3-15′ (К3-Е3): сегмент `'list'` — виключно колекціям `admin-data`
  (`collectionKey()`; `entityKey()` без `list()`); правило
  `eslint-rules/no-collection-key-outside-admin-data.mjs` і кейс
  `bareListSegment` у `eslint-rules/query-key-from-entity.mjs`. Лікує (б).
- Е3-17 (К3-Е3, коміт `674198af`): єдина фабрика `onDemandCollectionOptions`
  (`packages/simplycms/src/admin-data/`) ставить `syncMode: 'on-demand'`,
  `gcTime: 0` і індекс сортування (TSDB-2); `syncMode: 'on-demand'` поза
  фабрикою забороняє `admin-data/__tests__/on-demand-factory-only.test.ts`.
  Лікує (а). Ціна: повернення до списку завжди йде на сервер.

**Виміряно (2026-09-23).** Два одночасно АКТИВНІ зрізи + write-back:
надмножина рядків у кеші активного ключа в живих запитах НЕ видна (where
застосовується на рівні live-query) — шкоди немає. `useLiveInfiniteQuery`
під `gcTime: 0` сторінок не губить і вже видимих не перезапитує. Тест (а)
на старому коді червонів іншою маніфестацією («3 рядки, але один зі стейл
іменем»), ніж у власника («лише перейменований») — механізм той самий.

**Перевірка виправлення.** Контрольні кейси, що фіксують механіку
бібліотеки (мусять ЧЕРВОНІТИ, коли її виправлять):
- `packages/simplycms/src/admin-data/__tests__/collection-key-storefront-isolation.test.ts`
  — кейс «ключ під `[...collectionKey, 'featured']` ПЕРЕЗАПИСАНО»;
- тест Е3-17 «розмонтований зріз A → активний B → write-back → повторний
  mount A» — прогнати БЕЗ `gcTime: 0` у фабриці: якщо A показує повний набір
  — виправлено.

**Коли виправлять.** Прибрати `gcTime: 0` з фабрики on-demand (лишити
фабрику — вона тримає й індекс TSDB-2). Е3-15′ НЕ прибирати: розділення
ключів колекцій і вітрини — правильна гігієна незалежно від бібліотеки
(інакше форма рядка адмінки й вітрини змішується в одному ключі).

---

### START-2 · Start серіалізує будь-який `Error` лише як `message`

| Поле | Значення |
|---|---|
| Бібліотека | `@tanstack/router-core` (серіалізатор SSR/RPC TanStack Start) |
| Знайдено на | `@tanstack/router-core` 1.168.15 / `@tanstack/start-client-core` 1.167.17 (2026-09-24, live:smoke К3-Е3) |
| Перевірено на версії | ті самі — 2026-09-24 |
| Статус апстріму | не повідомлено; ймовірно, свідомий дизайн (не протікати серверні поля), а не дефект |

**Симптом.** Помилка serverFn доходить у браузер як `new Error(message)`:
`name` і власні поля (`kind`, `constraint`, `operation`) зникають. Конфлікт
«такий slug уже зайнятий» показувався технічним текстом; відмову authz на
клієнті неможливо відрізнити від будь-якої іншої помилки.

**Корінь.** `src/ssr/serializer/ShallowErrorPlugin.ts` (тег `$TSR/Error`):
`test: value instanceof Error`, parse — лише `{ message }`, deserialize —
`new Error(message)`.

**Наш обхід.** `domainErrorAdapter` (`packages/simplycms/src/runtime/domain-error-adapter.ts`,
client-safe) — `createSerializationAdapter` для закритого переліку імен
доменних помилок (`packages/simplycms/src/contracts/domain-errors.ts`) із
whitelist полів; реєстрація `serializationAdapters: [domainErrorAdapter]` у
host `src/start.ts` (+ канон `packages/cli/host/`, шаблон магазину).
Адаптери Start ідуть ПЕРЕД дефолтними плагінами (`getDefaultSerovalPlugins`),
seroval бере перший плагін, чий `test()` збігся. Маркери — `git grep -n "UPSTREAM:START-2"`.

**Перевірка виправлення.** `packages/simplycms/src/runtime/__tests__/domain-error-adapter.test.ts`
— контрольний кейс «без адаптера → голий `Error(message)`»: коли Start почне
зберігати `name`/поля сам, кейс червоніє.

**Коли виправлять.** Адаптер можна прибрати, лише якщо Start зберігатиме і
`name`, і довільні поля; інакше лишити — він же й фільтр того, які поля
взагалі дозволено передати клієнту (whitelist).

---

### TSDB-2 · `useLiveInfiniteQuery` без індексу сортування мовчки не довантажує сторінки

| Поле | Значення |
|---|---|
| Бібліотека | `@tanstack/db` (через `@tanstack/react-db` `useLiveInfiniteQuery`) |
| Знайдено на | `@tanstack/db` 0.8.6 / `@tanstack/react-db` 0.3.6 (2026-09-23) |
| Перевірено на версії | ті самі — 2026-09-23 |
| Статус апстріму | не повідомлено; можливо — задокументована вимога, не дефект (не знайдено в доках пакета) |

**Симптом.** Над on-demand колекцією `fetchNextPage()` НЕ робить другого
`loadSubset`: видно лише рядки першої сторінки + peek-рядок,
`hasNextPage` падає в `false`. Жодної помилки чи попередження.

**Корінь.** Довантаження йде через `requestLimitedSnapshot` у
`src/collection/subscription.ts` (≈900–990), який бере ключі з індексу
(`index.take(...)`). Без індексу на полі `orderBy` шлях не спрацьовує.
З `autoIndex: 'eager'` + `defaultIndexType: BTreeIndex` друга сторінка
йде окремим запитом `{ limit, offset, cursor }` (виміряно ізольованим
прогоном).

**Наш обхід.** Індекс сортування (`autoIndex: 'eager'`,
`defaultIndexType: BTreeIndex`) ставить єдина фабрика
`onDemandCollectionOptions` (`packages/simplycms/src/admin-data/`, рішення
Е3-16 → Е3-17) — колекція не може бути on-demand без неї.

**Перевірка виправлення.**
`packages/simplycms/src/admin-data/__tests__/on-demand-contract.test.tsx`,
кейс (2б) «БЕЗ індексу друга сторінка не вантажиться» — коли почне
вантажити без індексу, кейс червоніє.

**Коли виправлять.** Індекс можна лишити (він прискорює локальні запити)
або прибрати з колекцій, де він не потрібен ні для чого, крім пагінації.

---

### TSDB-3 · `parseLoadSubsetOptions` губить `offset`; доки розходяться з кодом

| Поле | Значення |
|---|---|
| Бібліотека | `@tanstack/db` (реекспорт у `@tanstack/query-db-collection`) |
| Знайдено на | 0.8.6 (2026-09-23) |
| Перевірено на версії | 0.8.6 — 2026-09-23 |
| Статус апстріму | не повідомлено |

**Симптом.** Offset-пагінація з on-demand колекції вічно вантажила б
першу сторінку, якщо брати результат `parseLoadSubsetOptions` як є.

**Корінь.** `src/query/expression-helpers.ts:499-522` повертає рівно
`{ filters, sorts, limit }` — без `offset` і `cursor`, хоча
`skills/db-core/collection-setup/references/query-adapter.md:264` того ж
пакета обіцяє `{ filters, sorts, limit, offset }`. Там же (:269) `or`
заявлено серед підтримуваних операторів, а `extractSimpleComparisons`
на `or` кидає (`expression-helpers.ts:398-419`).

**Наш обхід.** `packages/simplycms/src/admin-data/subset-payload.ts`
(`toSubsetPayload`) бере `offset` напряму з `LoadSubsetOptions`; `or` у
серверному контракті subset свідомо немає.

**Перевірка виправлення.** `parseLoadSubsetOptions({ limit: 3, offset: 3 })`
повертає `offset: 3` → обхід можна спростити; юніт
`admin-data/__tests__/subset-payload.test.ts` лишається зеленим.

**Коли виправлять.** Брати `offset` з результату парсера; `or` —
окреме рішення (серверний контракт subset, П6 пошуку).

---

### TSDB-4 · `LoadSubsetOptions` не експортується з `@tanstack/query-db-collection`

| Поле | Значення |
|---|---|
| Бібліотека | `@tanstack/query-db-collection` |
| Знайдено на | 1.2.11 (2026-09-23) |
| Перевірено на версії | 1.2.11 — 2026-09-23 |
| Статус апстріму | не повідомлено |

**Симптом / корінь.** Тип є в `@tanstack/db`, але `query-db-collection`
його не реекспортує (`dist/*.d.ts`). Прямої залежності на `@tanstack/db` ми
свідомо не маємо (К3-10′: дві peer-залежності, не три).

**Наш обхід.** Тип береться з `@tanstack/react-db` у
`admin-data/subset-payload.ts`.

**Перевірка / коли виправлять.** Якщо `import type { LoadSubsetOptions } from '@tanstack/query-db-collection'`
компілюється — перейти на нього (тип поруч з `queryCollectionOptions`).

---

### TSDB-B1 · ручний sync-запис на щойно отриманій on-demand колекції кидає `SyncNotInitializedError`

| Поле | Значення |
|---|---|
| Бібліотека | `@tanstack/query-db-collection` (ручні sync-хелпери `createWriteUtils`) |
| Знайдено на | 1.2.11 (2026-09-23, К3-Е3 Tasks 6/8) |
| Перевірено на версії | 1.2.11 — 2026-09-23 |
| Статус апстріму | не повідомлено |

**Симптом.** Сторінка «новий товар» не монтує жодного `useLiveQuery` над
`productsCollection` (список товарів — інша сторінка), тож колекція
лишається без sync-контексту. Оптимістичний `products.insert()` минає, але
write-back persistence-хендлера (`onInsert` → `target().utils.writeUpsert`
ПІСЛЯ відповіді сервера, `admin-data/handlers.ts`) кидає `Collection must
be in 'ready' state for manual sync operations. Sync not initialized yet.`
— insert відкочується, власник бачить тост-помилку замість збереженого
товару. Той самий клас — `useStock.save`: пише статус ЦІЛІ
(`productsCollection`/`productModificationsCollection`) у колекцію, яка на
сторінці картки товару могла не отримати жодної власної підписки
`useLiveQuery` (підписана лише `stockCollection`, під яку й побудований
хук). І `usePropertyValues` (Task 10, автозбереження): колекції значень
властивостей ПІДПИСАНІ безумовно, але старт синку від `useLiveQuery`
асинхронний — перший `saveScalar` одразу після монтування хука встигає
раніше, ніж сформується sync-контекст.

**Корінь.** `createWriteUtils` (`src/manual-sync.ts:236-242` пакета) кличе
`ensureContext()`, який кидає `SyncNotInitializedError`
(`src/errors.ts:48-53`), якщо `SyncContext` для колекції ще не створено.
Контекст зʼявляється лише коли колекція РЕАЛЬНО почала синк — перша
підписка (`useLiveQuery`) або явний `preload()`. `syncMode: 'on-demand'`
(Е3-17) сам по собі синку не запускає: простий `useCollection()` лише
дістає інстанс з реєстру `admin-data`, без підписки.

**Наш обхід.** `await collection.preload()` ПЕРЕД будь-якою мутацією
(оптимістичний `insert`, і ручний `writeUpsert` у ЦІЛЬОВУ колекцію), якщо
ця колекція не гарантовано підписана активним `useLiveQuery` на тій самій
сторінці: `useProductSave.create`, `useStock.save` (`mods.preload()` /
`products.preload()` — не сама `stock`, вона вже підписана власним
`useLiveQuery` хука). `preload()` на вже готовій колекції — no-op (доки
пакета), повторний виклик безпечний. Для `usePropertyValues` (безумовна
підписка, без явного `preload()`) — тести черги чекають ready-стану
(`waitFor`) ПЕРЕД першою мутацією, щоб гонка старту синку не змішувалась із
гонкою самої черги (Е3-19). Маркери —
`git grep -n "UPSTREAM:TSDB-B1"`.

**Перевірка виправлення.** Прибрати `await products.preload()` з
`useProductSave.create` → `useProductSave.test.tsx` (сценарій «нова картка
без змонтованого списку») мусить лишитися ЗЕЛЕНИМ на новій версії (сьогодні
падає без preload, бо `writeUpsert` після серверної відповіді б'є по
неготовій колекції).

**Коли виправлять.** Прибрати точкові `preload()`-виклики в
`useProductSave.create` і `useStock.save`, коли `syncMode: 'on-demand'`
(або `writeUpsert`) сам гарантує готовий контекст до першого ручного
запису. `waitFor` у тестах черги Task 10 можна лишити — там причина ширша
за цей дефект (Е3-19: серіалізація самої черги).

---

### DZOD-1 · `.pick()` і refinements drizzle-zod не типізуються для генеричної таблиці

| Поле | Значення |
|---|---|
| Бібліотека | `drizzle-zod` |
| Знайдено на | 0.8.3 (з `drizzle-orm` 0.45.2, `zod` 4.4.3), Е1б 2026-09-01; refinements — К3-Е3 2026-09-23 |
| Перевірено на версії | 0.8.3 — 2026-09-23 |
| Статус апстріму | не повідомлено |

**Симптом.** У `defineAdminResource<T extends Table>` виклик
`.pick({[K in W]: true})` не компілюється (TS2345), а каст аргументу до
`never` компілюється, але СТАТИЧНО повертає всю форму без звуження —
readonly-колонки виглядали писаними. Аналогічно refinements другим
аргументом `createInsertSchema/createUpdateSchema` для генеричного `T`
потребують касту функції.

**Корінь.** `M extends Mask<keyof Shape>`, де `Shape` виведений з
генеричного `T['_']['columns']`, — TS не зводить `keyof Shape` до імен
колонок до інстанціювання `T`.

**Наш обхід.** `packages/simplycms/src/admin-server/impl/resource-schemas.ts`
— каст на РЕЗУЛЬТАТ `.pick()` до `SafePick<Shape, W>` (коментар-розбір
поруч, ≈:71–146); refinements — каст функції (коміт `d6c702c4`).
Статичні типи стереже `expectTypeOf` у `impl/__tests__/resource.test.ts`.

**Перевірка виправлення.** Прибрати касти → `pnpm typecheck` і
`build:packages` зелені, `expectTypeOf`-кейси зелені.

**Коли виправлять.** Прибрати касти й `SafePick`, лишити `expectTypeOf`.

---

### TSESL-1 · TypeScript запінено на 5.9: `typescript-eslint` не підтримує 6/7

| Поле | Значення |
|---|---|
| Бібліотека | `typescript-eslint` (обмежує `typescript`) |
| Знайдено на | `typescript-eslint` 8.x (peer `typescript <6.1.0`), 2026-08-04 |
| Перевірено на версії | 8.65.0 з `typescript` 5.9.3 — 2026-09-23 |
| Статус апстріму | запит підтримки TS 7 закрито як **not planned** до стабільного програмного API TS 7 (≥7.1) |

**Симптом / корінь.** Гейт `pnpm lint` — на `typescript-eslint`, чий peer
не допускає TS ≥ 6.1. Спроба TS 6 (2026-08-04) також відкрила `TS5101`
(`baseUrl`) і `TS2209` (корінь проєкту) — окремий міграційний проєкт.
Деталі — `CLAUDE.md`, «Чому TypeScript лишається на 5.9».

**Наш обхід.** `typescript: ^5.9.3` у кореневому `package.json` і в
шаблоні магазину.

**Перевірка виправлення.** `typescript-eslint` оголосив peer з TS 7 →
пробний бамп у гілці + повний ланцюг гейтів.

**Коли виправлять.** Міграція TS — окремим планом (не бамп залежності).

---

### TSDOWN-1 · dts-плагін бандлера вичерпує 3 ГБ heap — декларації емітить `tsc`

| Поле | Значення |
|---|---|
| Бібліотека | `tsdown` (раніше — `tsup`/`rollup-plugin-dts`) |
| Знайдено на | `tsup` 2026-08-24; `tsdown` 0.22.x 2026-09-02 |
| Перевірено на версії | `tsdown` 0.22.14 — 2026-09-02 |
| Статус апстріму | не повідомлено |

**Симптом / корінь.** Dts-плагін тримає повну `ts.Program` і вичерпує
кеп 3 ГБ за ~25 с; `tsc -p tsconfig.dts.json` робить те саме за 11 с /
1,1 ГБ. Деталі — `CLAUDE.md` (`pnpm build:packages`) і
`docs/tasks/v2-state-map.md` §4.3.

**Наш обхід.** `scripts/build-packages.mjs`: JS — `tsdown`, декларації —
`tsc`; структурний тест `tests/dts-toolchain.test.ts`.

**Перевірка виправлення.** Увімкнути `dts` у tsdown на гілці, прогнати
`pnpm build:packages` під кепом 3 ГБ з виміром часу/пам'яті.

**Коли виправлять.** Лише якщо вимір кращий за `tsc`; інакше лишити —
рішення тоді перестає бути обходом і переходить у CLAUDE.md як вибір.

---

## Поведінка бібліотек, на яку ми спираємося (не дефект, але ламке)

| ID | Бібліотека · версія | На що спираємося | Де в коді | Що зламається, якщо зміниться | Тест-сторож |
|---|---|---|---|---|---|
| DRZ-1 | `drizzle-orm` 0.45.2 + `pg` | Помилка драйвера — у `.cause` (`DrizzleQueryError`), з полями `code` і `constraint` (`pg-protocol`) | `admin-server/impl/errors.ts` (`toAdminConflict`) | Конфлікти 23505/23503 перестануть мапитись у 409 — власник знову побачить SQL-текст | `impl/__tests__/run.test.ts` + харнес `admin-catalog.test.ts` (дубль slug, товар у замовленні) |
| START-1 | `@tanstack/start-server-core` 1.167 | serverFn з `FormData` — тіло повністю буферизоване `await request.formData()` ДО хендлера (`dist/esm/server-functions-handler.js:33`) | `admin-server/impl/media/operations.ts` (розбір файлу всередині `runAdmin`) | Якщо стане потоковим — завантаження триматиме зʼєднання пулу на передачу файлу | — (перевіряти рев'ю при апгрейді Start) |

---

## Закриті

### TSDB-5 · (ЗАКРИТО 2026-09-24) «транзакція губить помилку serverFn» — НЕ дефект бібліотеки

**Висновок.** Хибна модель межі: `commit()` `@tanstack/db` 0.8.6 ЗБЕРІГАЄ `Error` з полями
(`error instanceof Error ? error : …`). «Плаский обʼєкт», з якого робився `Error("[object Object]")`,
існував лише в синтетичному тесті; справжня втрата полів відбувалася раніше — на RPC-межі Start
(**START-2**). Обхід `normalizeThrown` і розгортання `.cause` прибрано (коміт `1d3d5a9a`), маркери
прибрано. Мутація «serverFn кидає плаский обʼєкт» → `'[object Object]'` лишилась у тесті як пояснення,
чому гіпотеза виглядала правдоподібно. Урок — `docs/architecture/test-contours.md` §11.1.

<details><summary>Первісний запис (для історії)</summary>

### TSDB-5 · невдала транзакція губить помилку serverFn: `Error("[object Object]")`

| Поле | Значення |
|---|---|
| Бібліотека | `@tanstack/db` (транзакції колекцій) |
| Знайдено на | 0.8.6 (2026-09-23, К3-Е3 фікс-захід хвилі C) |
| Перевірено на версії | 0.8.6 — 2026-09-23 |
| Статус апстріму | не повідомлено |

**Симптом.** Конфлікт на сервері (дубль slug, товар у замовленнях) мав
показати власнику зрозумілий тост; натомість `tx.isPersisted.promise`
відхиляється `Error` з `message: "[object Object]"`, `name: 'Error'`, без
полів `kind`/`constraint` і без `cause` — `adminErrorKey` нічого не впізнає.

**Корінь.** Помилка serverFn доходить у клієнт ПЛОСКИМ обʼєктом (seroval
не відновлює клас — К3-13), а `src/transactions.ts` у `commit()` робить
`error instanceof Error ? error : new Error(String(error))` — поля плаского
обʼєкта втрачаються.

**Наш обхід.** `packages/simplycms/src/admin-data/normalize-thrown.ts`
(`normalizeThrown`) — у кожному `onInsert`/`onUpdate`/`onDelete`
спільних `handlers.ts` помилка serverFn перетворюється на справжній `Error`
із тими самими полями ДО того, як потрапить у транзакцію; `adminErrorKey`
додатково розгортає `.cause` (друга лінія, сама дефект не лікує).
Маркери — `git grep -n "UPSTREAM:TSDB-5"`.

**Перевірка виправлення.** Прибрати `normalizeThrown` з хендлерів (мутація
«throw e») → тест конфлікту в admin-data мусить лишитися ЗЕЛЕНИМ на новій
версії (сьогодні червоніє).

**Коли виправлять.** Прибрати `normalizeThrown` з хендлерів; розгортання
`.cause` в `adminErrorKey` можна лишити як захист.

</details>

