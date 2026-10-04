# Оновлення залежностей, безпека і агентний тулінг — дизайн

> **Статус:** брейншторм триває. Теми 1, 2, 3, 4, 5, 6.1–6.4, 8а, 8б — **затверджені**
> власником (2026-10-04). Відкриті: спайк tsgo (6.3), тема 7; рішення дописуються в цей файл у міру
> закриття. Імплементаційного плану ще немає.
>
> **Вихідне дослідження (2026-10-04):** `pnpm outdated -r`, `pnpm audit`,
> вихідний код нових версій бібліотек (tarball-и), GitHub advisories, реєстр
> [`upstream-workarounds.md`](../../architecture/upstream-workarounds.md),
> порівняння з MetaHub (`~/github/metahub`). Ключові твердження перевірені по
> вихідному коду, а не за changelog-ами — якорі нижче.
>
> **Рамка:** магазинів на SimplyCMS немає — жодної зворотної сумісності, шимів
> чи окремих «безпекових» релізів. Зміни лягають у `main` і їдуть найближчим
> релізом.

## Порядок тем

| # | Тема | Шлях | Стан |
|---|---|---|---|
| 1 | Безпекові оновлення | точкова | ✅ затверджено |
| 2 | CSRF-захист запитів, що змінюють стан | точкова | ✅ затверджено |
| 3 | `inputValidator` → `validator` + лінт-заборона | точкова | ✅ затверджено |
| 4 | TanStack DB 0.11.3 і обходи TSDB-* | спайк → точкова | ✅ спайк виконано, дизайн затверджено (окремий захід) |
| 5 | Пакет мінорних оновлень + дати перевірки в реєстрі | точкова | ✅ затверджено (один захід із темою 1) |
| 6 | React 19.3, vitest 5, tsdown+tsgo, версії шаблону | кожне окремо | 6.1 ✅, 6.2 ✅, 6.3 ✅ бамп / ⏳ спайк tsgo, 6.4 ✅ |
| 7 | Drizzle: `relations.ts`, drizzle-zod, спайк 1.0 RC, умова перегляду | 7а точкова, 7б/7в спайк | ⏳ |
| 8а | Правила й Copilot-артефакти за моделлю MetaHub | архітектурна (доки) | ✅ затверджено |
| 8б | Рушій `codebase-research`: graphify → codebase-memory-mcp + `orient --map` | архітектурна (тулінг) | ✅ затверджено |

---

## Тема 1 · Безпекові оновлення ✅

**Факти.**
- `better-auth` 1.7.1 вразливий до 1.7.7: GHSA-965c-763c-88jm (critical, OAuth
  state як Magic Link), GHSA-r4xp-prcw-77qf (high, OAuth Proxy),
  GHSA-44jh-23m7-hpcf (low, rate-limit на PG у drizzle-адаптері). Наша
  конфігурація (`packages/simplycms/src/auth`) не вмикає ні `magicLink`, ні
  `oauthProxy`, ні власного `rateLimit` — прямо не зачіпає, але пакет у
  `dependencies` опублікованого `simplycms`.
- `pnpm audit`: 23 знахідки (9 high, 0 critical). Закриваються: tiptap ≥3.31.4
  (proto/ReDoS у `@tiptap/core`, XSS prosemirror-view, кольори collab), jsdom
  ≥30.1.2 (undici; 30.1.0 має регресії focus/perf), vitest 4.1.11 (path
  traversal), транзитиви `js-yaml`, `nanoid`, `brace-expansion`.
- Залишиться `esbuild` через `drizzle-kit` (`@esbuild-kit/*`) — dev-only, у нас
  не виправляється.

**Рішення.**
- `better-auth` → `1.7.7`, **точний пін** у `packages/simplycms/package.json`
  лишається (спека B3: версія піниться, advisories відстежуються).
- tiptap → `^3.31.4`: сім пакетів у корені + дві прямі залежності ядра
  (`@tiptap/extension-image`, `@tiptap/extension-text-align`). Шаблон магазину —
  тема 6.
- `jsdom` → `^30.1.2`, `vitest` → `^4.1.11` — піднімається НИЖНЯ межа, щоб lock
  не міг відкотитись на вразливу версію.
- Транзитиви — `pnpm update <пакет>`; якщо батьківський діапазон не пускає
  виправлену версію — `overrides` у `pnpm-workspace.yaml` з коментарем «чому».
- `CHANGELOG.md`: прибрати застарілий заголовок «0.7.0 — не опубліковано»
  (0.7.0 у npm) + запис про оновлення.

**Доказ.** Повний ланцюг гейтів; **обовʼязково** `test:schema` (з 1.7.3
drizzle-адаптер BA валідує схему на старті; у нас `usePlural` і власні таблиці
в `public`) і `live:smoke` (реєстрація, вхід, адмінка); `pnpm audit` наприкінці —
очікується лише `esbuild` через `drizzle-kit`, будь-що інше — у звіт, не
ігнорувати.

---

## Тема 2 · CSRF-захист ✅ (варіант Б)

**Факти.**
- Start 1.168 додав `createCsrfMiddleware` (`@tanstack/start-client-core`
  1.170.34, `src/createCsrfMiddleware.ts`): перевіряє `Sec-Fetch-Site` →
  `Origin` → `Referer`; без жодного з трьох — відмова
  (`allowRequestsWithoutOriginCheck: false`).
- Дефолтний захист вмикається **лише без `startInstance`**
  (`@tanstack/start-server-core` 1.169.39, `src/createStartHandler.ts`:
  `requestMiddleware: startInstance ? startOptions.requestMiddleware : isServerFnRequest ? [defaultCsrfMiddleware] : undefined`).
  У нас `startInstance` є (`src/start.ts`) → **server functions без
  CSRF-захисту**; у dev Start друкує попередження. Регресії немає: у 1.167
  механізму не було.
- Origin запиту за проксі будується з `x-forwarded-proto` / `x-forwarded-host`
  (`server-runtime.mjs` `toRequestUrl`).
- Жоден скрипт `pilot` / `live:smoke` не звертається до server functions напряму
  по HTTP (Gate B — SQL, воронка — Playwright із `Sec-Fetch-Site`).
- POST-маршрути поза server functions: `/api/revalidate-theme` (скидання кешу
  теми, адмінка б'є по HTTP), `/api/auth/*` (Better Auth, сам перевіряє origin).
- Три копії `start.ts` ідентичні: host `src/start.ts`, канон
  `packages/cli/host/src/start.ts`, шаблон
  `packages/create-simplycms-store/template/src/start.ts`.

**Рішення.**
- Модуль ядра `packages/simplycms/src/runtime/csrf.ts`, субшлях
  `simplycms/runtime/csrf` (за зразком `domain-error-adapter`): експорт
  `csrfMiddleware` на `createCsrfMiddleware`.
- Фільтр: перевіряється запит, якщо метод ∉ {GET, HEAD, OPTIONS} **і** шлях не
  починається з префікса з `CSRF_EXEMPT_PREFIXES` — **для будь-якого
  `handlerType`** (server functions і server routes). Зараз у списку один
  префікс — `'/api/auth/'` (Better Auth перевіряє origin сам). Коментар біля
  списку: новий виняток (напр. вебхук платіжної системи без `Origin`) додається
  свідомо, з обґрунтуванням.
- Решта — дефолти Start (`secFetchSite: 'same-origin'`, origin = origin запиту,
  fallback на `Referer`, без заголовків — 403).
- Усі три `start.ts`: `requestMiddleware: [csrfMiddleware, adminRequestGuard]` —
  CSRF першим, до читання сесії. Канон — `pnpm template:sync`.

**Тести.**
- Юніт фільтра: методи, префікс винятків.
- Поведінка: same-origin → проходить; `Sec-Fetch-Site: cross-site` → 403; чужий
  `Origin` → 403; жодного заголовка → 403; за проксі (`toRequestUrl` з
  `x-forwarded-*` + `Origin` публічного домену) → проходить; POST на
  `/api/auth/*` → без перевірки.
- **Мутація:** без `csrfMiddleware` у `start.ts` кейс cross-site червоніє.
- `live:smoke`: воронка зелена; `curl` POST на справжню server function і на
  `/api/revalidate-theme` з чужим `Origin` → 403.

**Доки.** Канон host-файлів (`docs/architecture/cli.md`), `plugins.md` (POST-
маршрути плагінів захищені за замовчуванням, вебхук = виняток у ядрі), правило
шару даних (місце — за темою 8а).

---

## Тема 3 · `inputValidator()` → `validator()` ✅

**Факти.**
- `validator` — канонічна назва, `inputValidator` — `@deprecated` аліас того
  самого `setValidator` (`start-client-core` 1.170.34
  `src/createServerFn.ts:88-126, :263-271, :513, :674, :828`;
  `createMiddleware.ts` — так само). Тип `ValidatorFn` і виконання
  (standard-schema → `.parse` → функція) спільні.
- Компілятор Start (`start-plugin-core` 1.171.49
  `src/start-compiler/handleCreateServerFn.ts`) обробляє обидві назви
  однаково, різниця — лише `context.warn`. Кодемода немає.
- 285 попереджень `pnpm build` = **95 викликів × 3 проходи** трансформації
  (`server-fn:client`, `server-fn:ssr`, `?tss-serverfn-split`). Інших
  deprecation-попереджень у збірці немає.

**Рішення.**
- 95 викликів `.inputValidator(` у `packages/simplycms/src` (58 — в
  `admin-server/index.ts`) + ~10 коментарів зі старою назвою.
- `eslint-rules/server-fn-top-level.mjs` — лише коментар (правило матчить
  `createServerFn`, не назву методу); фікстура в
  `tests/eslint-rules/server-fn-top-level.test.ts` → `.validator(`.
- **Лінт-заборона `inputValidator`** — власне імʼя плагіна (CLAUDE.md: кожне
  кастомне правило — власний плагін, бо `no-restricted-syntax` замістив би
  i18n-селектори), з негативним контролем у тесті.
- Правило шару даних оновлюється там, де воно опиниться після теми 8а.
- Історичні `docs/superpowers/{plans,specs}` не чіпаються.

**Доказ.** `pnpm build` — 0 попереджень про `inputValidator`; повні гейти.

---

## Тема 8а · Правила й Copilot-артефакти за моделлю MetaHub ✅

**Факти.**
- `.github/instructions/*` (8 файлів, ~950 рядків) тримаються на `applyTo:`-
  глобах — механізм Copilot. Claude Code їх **автоматично не вантажить
  ніколи**; CLAUDE.md лише посилається на них як на «обовʼязкові». Те саме
  MetaHub зафіксував і прибрав (коміт `7b5b3d3b1`), зміст там уже розійшовся з
  каноном.
- На них посилаються: CLAUDE.md, `AGENTS.md`, скіл `code-review`, агенти
  `code-review`/`code-review-verifier`, команди (`/виконай-задачу`,
  `/граф-онови`, `/перевір-скіли`, …), частина `docs/`.
- Copilot у роботі не використовується (власник).
- Модель MetaHub: ієрархія джерел `AGENTS.md` (стабільні межі й інваріанти,
  спільні для всіх агентів) → `docs/architecture/*` (канон підсистем) →
  `.agents/skills/*` (процедури) → код-шар, `orient`, код (реальний стан);
  суперечність між рівнями — дефект. `CLAUDE.md` = `@AGENTS.md` + лише
  специфічне для Claude Code (скорочено комітом `e6fe6fcfc`).

**Рішення.**
- `.github/instructions/*` видалити. Зміст розкласти: стабільні інваріанти →
  `AGENTS.md`; канон підсистем → `docs/architecture/*` (напр. окремий документ
  шару даних: контракт id, контракт ключів кешу, `withActor`); процедури → скіли.
  Застаріле, що розійшлося з кодом, **не переносити, а видалити**.
- Ієрархію джерел MetaHub прийняти як правило репо.
- `CLAUDE.md` перебудувати: `@AGENTS.md` + лише CC-специфічне; **скоротити** за
  зразком MetaHub (рідкісне — у скіли й доки) — у цій же темі.
- Видалити ВСІ Copilot-артефакти: `.github/copilot-instructions.md`,
  `.github/agents/`, `.github/prompts/` (включно із симлінками на
  `.claude/commands/`). `.github/workflows/` і `.github/ISSUE_TEMPLATE/` —
  лишити.
- Оновити всі посилання (скіли, агенти, команди, доки); розділ «Agent Tooling»
  CLAUDE.md — без згадок Copilot.

---

## Тема 8б · Рушій `codebase-research` ✅

**Факти.**
- Зараз: `orient` на graphify з тихим відкатом на ripgrep; хуки `post-commit` і
  `post-checkout` (на момент написання **вже зламані**: «could not locate a
  Python with graphify installed»); `graphify-out/`, `.graphifyignore`,
  `references/graph-cli.md`, команда `/граф-онови`.
- MetaHub прибрав graphify (`a63799a2c`, `685e8143b`) і перейшов на два шари:
  код — `codebase-memory-mcp` (глобальна установка; на цій машині вже стоїть;
  повна індексація ~9 с, свіжість — watcher; у репо пише лише `.cbmignore`);
  доки — `orient --map "<тема>"`, BM25 по корпусу доків (`map-search.py`), без
  графа, працює й у cloud-сесіях. Канон — `docs/development/CODEBASE_MEMORY.md`
  MetaHub.
- Чесна деградація: без `codebase-memory-mcp` `orient <Символ>` відмовляє, а не
  грепає — заміряно в MetaHub: grep через барелі дав 451 «споживача» проти 60
  реальних викликів.

**Рішення.**
- `.cbmignore` (синтаксис `.gitignore`): `*.md`/`*.mdx` виключені (доки — інший
  шар), плюс наші артефакти збірки й генерати. Індексація репо.
- `orient` і `scripts/map-search.py` — **копія** з MetaHub, адаптована (не
  спільний пакет: зчеплення двох репо — гірше за розходження копій).
  - `<Символ>` — через `codebase-memory-mcp`; без нього — чесна відмова.
  - `--plan` — файлова система + `codebase-memory-mcp` або `rg` по оголошеннях.
  - `--map "<тема>"` — BM25; корпус: `docs/architecture`, `docs/guides`,
    `docs/tasks`, `AGENTS.md`, `packages/README.md` — **без**
    `docs/superpowers/{plans,specs}` (історія засмічує видачу).
  - `--doctor` — під стан індексу `codebase-memory-mcp`.
- Агент `.claude/agents/codebase-research.md`: інструменти
  `codebase-memory-mcp` у `tools` + `mcpServers`, як у MetaHub. Скіл
  `codebase-research` переписати під дві поверхні.
- graphify прибрати повністю: хуки, `graphify-out/`, `.graphifyignore`,
  `references/graph-cli.md`, `/граф-онови`, згадки в CLAUDE.md / AGENTS.md /
  командах.
- Канон тулінгу — `docs/development/CODEBASE_MEMORY.md` (теки
  `docs/development/` зараз немає — місце остаточно визначає тема 8а).

**Доказ.** Старий і новий `orient` на `withActor`, `defineAdminResource` —
порівняти повноту; `orient --map "контракт id"` знаходить відповідний документ.

---

## Тема 4 · TanStack DB 0.11.3 ⏳ (спайк)

**Факти з вихідного коду нових версій** (`@tanstack/db` 0.11.3,
`@tanstack/react-db` 0.5.3, `@tanstack/query-db-collection` 1.3.4; пакети
пов'язані точними версіями — оновлюються разом):
- **TSDB-B1 — виправлено:** write-утиліти обгорнуті `startSyncIfIdle()`
  (`query-db-collection/src/query.ts:3503-3520`), мутації самі кличуть
  `_sync.startSync()`.
- **TSDB-1 — змінено:** для `syncMode: 'on-demand'` `updateCacheData` більше не
  пише весь набір у кожен ключ: активні власні запити перезавантажуються,
  неактивні записи видаляються з кешу (`query.ts:3168+`). Ціна — зайвий
  мережевий запит після кожного запису.
- **TSDB-2 — змінено:** без індексу сторінки довантажуються префіксом, що росте
  (`{orderBy, limit: offset+limit}`, `db/src/query/live/ordered-source-loader.ts`),
  а не `{limit, offset}`.
- **TSDB-3, TSDB-4 — не виправлено.**

**Спайк (2026-10-04, тимчасовий worktree, код не збережено).** База на старих
версіях — 330/330 тестів `admin` + `admin-data` зелені, typecheck чистий. На
нових без змін коду: typecheck чистий, **16 з 330 червоні**. Причини:
1. **Блокер продакшну.** `useLiveInfiniteQuery` після першої сторінки шле
   запит «рівні значення на межі» по першій колонці сортування; для `Date` —
   `and(gte(col, v), lt(col, v+1ms))` (`@tanstack/db` 0.11.3 `src/types.ts`,
   `CursorExpressions.whereCurrent`). Наш сервер відкидає двічі:
   `subsetInputSchema` (`admin-server/impl/subset.ts:59` — `scalar` без `Date`)
   і `filterable` (orders: `['id','statusId','userId']`, products — теж без
   `createdAt`). Списки товарів і замовлень на проді не вантажились би.
2. Тести, що рахують виклики (`catalog-collections` ×3, `on-demand-full-slice`
   ×2, `orders-collections-write`): після запису тепер +N перезапитів.
3. Статичні стаби сервера (`mockResolvedValueOnce`, статичний `SEED`):
   перезапит «відкочує» записаний рядок (`on-demand-active-slices`,
   `on-demand-stale-cache` ×2, `ProductEditPage-panel-switch`, `ProductsPage`,
   `useModifications`); ще ~9 у `admin/features/{orders,catalog-dictionaries}` —
   до кореня не розібрані.
4. `subset-payload.test.ts` ×3 — тест будував `{type:'ref'}` замість
   `new IR.PropRef([field])` (виправлення лише в тесті).

Вердикти по обходах:
- **TSDB-B1 — знімається.** Без `preload()` тести `useProductSave`/`useStock`
  зелені на нових і червоні на старих (дискримінативні); зонди: `writeUpsert`,
  `insert`, `writeBatch` на колекції без синку на старих кидають
  `SyncNotInitializedError`, на нових — ні.
- **TSDB-1 — `gcTime: 0` знімається; фабрика й Е3-15′ лишаються.** Неактивний
  зріз після запису містить повний правильний набір (зонд із `staleTime` 5 хв).
  Старий тест Е3-17 на нових версіях не дискримінує — потрібен новий тест на
  вміст кешу неактивного ключа. Чужий ключ під префіксом колекції тепер
  ВИДАЛЯЄТЬСЯ з кешу, а не перезаписується; контрольний кейс
  `collection-key-storefront-isolation` побудований на eager-колекції й для
  on-demand нічого не доводить.
- **TSDB-2 — лишається як оптимізація.** Без індексу сторінки вантажаться, але
  префіксом (`{limit: 5}` замість `{limit: 2, offset: 3}`) з попередженням
  бібліотеки.
- **TSDB-3, TSDB-4 — лишаються.**
- **Ціна:** +N мережевих запитів після кожного збереження (N — кількість
  активних запитів колекції; зазвичай 1).
- Попутно: форма `useLiveQuery(fn, deps)` задепрекована й зникне в 1.0 —
  36 викликів поза тестами; стаби, що повертають спільні посилання на рядок,
  ламаються (`TransactionError: … changed in place`); шаблон магазину пінить
  1.2.11 / 0.3.6.

**Рішення (окремий захід — змінюється поведінка, не лише версії).**
1. Бамп трьох пакетів: корінь (точні версії), peer-діапазони ядра, шаблон
   магазину; точні піни лишаються.
2. Серверний контракт subset: `Date` дозволено для `gt`/`gte`/`lt`/`lte`;
   колонки з `sortable` допустимі для цих чотирьох операторів (значення
   відсортованої колонки клієнт і так бачить — безпеки не знижує);
   `filterable` для `eq`/`in`/`isNull` — окремий білий список, як і був. Тест на
   запит із `Date` для товарів і замовлень + мутація: без дозволу — червоніє.
3. Обходи: прибрати 3 `preload()` і маркери TSDB-B1 → запис у «Закриті»;
   прибрати `gcTime: 0` → запис TSDB-1 переписати (що лишилось — Е3-15′; нова
   ціна); запис TSDB-2 переписати, тест (2б) → «без індексу — префікс, з
   індексом — offset». Оновити «Перевірено на версії» TSDB-3/4.
4. Тести: «правдиві» стаби сервера (змінний стан); перевірки «0 перезапитів» →
   перевірка результату; новий тест вмісту кешу неактивного ключа;
   on-demand-варіант контрольного кейсу ізоляції ключів; 9 нерозібраних падінь
   — до кореня.
5. 36 викликів `useLiveQuery` → об'єктна форма `useLiveQuery({ query })`.
6. Доказ: повні гейти + `live:smoke` (списки, пагінація, збереження в адмінці
   на реальному сервері).

---

## Тема 5 · Пакет мінорних оновлень ✅

**Виконується ОДНИМ заходом разом із темою 1** (однаковий набір гейтів).

**Рішення.**
- До останніх версій у межах поточних мажорних: vite 8.3.2 +
  `@vitejs/plugin-react` 6.1.1 (корінь і `apps/www`); zod 4.6.5; prettier 3.9.9
  (точний пін); eslint 10.12 + typescript-eslint 8.71 + `@eslint/eslintrc` 3.3.7;
  react-hook-form 7.89, `@hookform/resolvers` 5.9.1, `@tanstack/react-query`
  5.104.1, `@tanstack/virtual-file-routes` 1.162.0; lucide-react 1.51 (усі 119
  імпортованих іконок присутні — перевірено по d.ts); pg 8.23.1 (два точні
  піни); drizzle-orm 0.45.3 / drizzle-kit 0.31.11; `@clack/prompts` 1.8.1
  (`cli` і скаффолдер); UI-патчі (tailwind-merge, sonner, react-day-picker,
  input-otp, react-resizable-panels), testing-library, `@types/node`;
  `@supabase/*` — до останніх (застарілий шар, але бамп дешевий).
- dotenv 18: `config({ quiet: true })` у `packages/simplycms/drizzle.config.ts` і
  `scripts/dev-stand/dump-demo-data.mjs` (18 пише «injected env» у stderr).
- Реєстр обходів — оновити «Перевірено на версії»: DZOD-1 (zod 4.6.5 +
  drizzle-zod 0.8.3 + drizzle-orm 0.45.3 — відтворено, не виправлено), TSESL-1
  (8.71.0, peer `typescript <6.1.0`), TSDOWN-1 (0.22.14; 0.23 — тема 6), DRZ-1
  (0.45.3, рантайм без змін).
- Дифф prettier 3.9.9 — окремим комітом «лише форматування».

**Доказ.** Повні гейти; лінт 0 errors / 8 warnings (зміна числа — з'ясувати
причину); `test:schema` (pg, drizzle); `pilot:pack` (vite).

## Тема 6.1 · React 19.3 ✅

У той самий захід, що й теми 1 і 5, окремим комітом (`react`, `react-dom`,
`@types/react`, `@types/react-dom` — корінь і `apps/www`). Нові API
(`<ViewTransition />` тощо) не впроваджуються — окрема фіча, коли знадобиться.

## Тема 6.2 · vitest 5 ✅

У той самий захід, **останнім кроком**: спершу все зелене на vitest 4.1.11,
потім окремий коміт vitest 5 + виправлення зачеплених тестів. Кожну поломку
розбирати по суті (дефект тесту чи нова суворість раннера), без
compat-налаштувань. Очікувані зачіпки: моки чистяться перед кожним тестом;
`vi.mock`/`vi.hoisted` лише на верхньому рівні; async-assertion без `await`
валить тест; формат повідомлень (pretty-format замість loupe).

## Тема 6.3 · tsdown 0.23 ✅ (бамп) · tsgo ⏳ (спайк)

- **Бамп tsdown 0.22.14 → 0.23.0 — у захід оновлень**, окремим комітом. `dts`
  у нас `false`, тож зміна API `dts` не зачіпає; але змінився дефолт
  `resolveDepSubpath` — обовʼязкові `build:packages`, `test:packaging`,
  `pilot:pack`, `tests/dist-server-boundary.test.ts`.
- **Спайк tsgo** (`@typescript/native-preview`): (А) `tsgo -p tsconfig.dts.json`
  замість кроку `tsc`; (Б) `dts: { generator: 'tsgo' }` у tsdown. Критерій:
  швидше й менше памʼяті за `tsc` (11 с / 1,1 ГБ) **і** зелені
  `typecheck:template`, `test:packaging`, `pilot:pack` — декларації придатні
  магазину, а не просто згенеровані. Результат — у цей розділ.

## Тема 6.4 · Версії шаблону магазину ✅ (варіант А)

- Вирівняти `packages/create-simplycms-store/template/package.json.tpl` і
  `tests/pilot/store-template/package.json` з коренем (зараз `lucide ^0.563`,
  `react ^19.2.4`, `vite ^8.0.9`, `zod ^4.3.6`, TanStack DB 1.2.11 / 0.3.6) —
  магазин стартує на тих версіях, які ми тестуємо.
- Новий тест парності **версій** корінь ↔ шаблон ↔ пілотний оверлей (нинішній
  `tests/create-store-template-parity.test.ts` звіряє лише набори ключів);
  свідомі розбіжності — явним списком із причиною в самому тесті.
- Виконується в заході оновлень (версії TanStack DB у шаблоні — разом із
  темою 4).

## Тема 7 ⏳

Ще не обговорені. Вихідні факти для них:
- **6:** React 19.3 (нові API, сумісність зі Start/Radix не перевірена);
  vitest 5 (моки чистяться за замовчуванням, `vi.mock` лише на верхньому рівні,
  інший формат повідомлень); tsdown 0.23 `dts.generator: 'tsgo'` — спайк проти
  `tsc` (11 с / 1,1 ГБ); шаблон магазину відстає від кореня (`lucide ^0.563`,
  `react ^19.2.4`, `vite ^8.0.9`, `zod ^4.3.6`).
- **7:** Drizzle активний (команда в PlanetScale з 2026-03-03, ~1000 комітів на
  `beta` за 9 міс.), але 1.0 у RC з 2026-04-30, лінія 0.45 майже не
  оновлюється, drizzle-zod 0.8.3 — з 2025-08. Альтернативи, що закривали б наші
  вимоги дешевше, немає (Kysely втрачає схему в TS; MikroORM 7.2 — RLS менше
  місяця; Prisma — без RLS). `schema/relations.ts` (448 рядків) — мертвий код
  (`drizzle(client)` без `schema`, RQB не використовується). Better Auth 1.7.7
  допускає `drizzle-orm >=1.0.0-rc.1`.
