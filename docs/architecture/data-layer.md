# Шар даних

Канон доступу до даних SimplyCMS: єдиний канал до Postgres, правила вітрини й
адмінки, контракти ключів кешу, id і дат, конвеєр міграцій. Механіка — у коді
(`packages/simplycms/src/{db,storefront,admin-server,admin-data,schema}`), тут —
інваріанти й причини, чому вони такі.

Рішення напряму — [`2026-08-19-backend-contract-v2-design.md`](../superpowers/specs/2026-08-19-backend-contract-v2-design.md)
(читати з амендментом B3′/B5″/B13). Поточний стан реалізації — `docs/tasks/v2-state-map.md`.

## 1. Модель

- Дані — **Drizzle поверх чистого PostgreSQL 17** (`pg`-пул), auth — **Better Auth**
  (`simplycms/auth`). Supabase — лише один із можливих провайдерів Postgres.
- Браузер до БД не звертається: усе через серверні функції (`createServerFn`).
- 🔴 Єдиний спосіб дістати зʼєднання — **`withActor`** (`simplycms/db`): транзакція +
  GUC актора (`app.user_id`, `app.order_token`) + `SET LOCAL ROLE app_user|app_admin`.
  Застосунок логіниться роллю `app_runtime` без прямих грантів, тож забутий
  `SET LOCAL ROLE` падає з `permission denied`, а не тихо працює з правами власника
  таблиць (fail-closed). Гола фабрика пулу (`db/client`) закрита лінт-зоною
  (`eslint.db-client-zone.mjs`) і не має субшляху в `exports`.
- `fn` у `withActor` отримує drizzle над зʼєднанням САМЕ цієї транзакції, не над
  пулом: «взяти `db` глобально» неможливо за побудовою.

## 2. Вітрина (SSR)

- Дані — у route `loader` через `createServerFn` (`simplycms/storefront-routes/server/*`),
  який делегує в `simplycms/storefront/loaders`.
- 🔴 Лоадери ходять у БД **лише** через обгортки з `simplycms/storefront/loaders`
  (над `withActor`). Кожен лоадер приймає `ActorDb` першим аргументом, тож уся
  сторінка збирається в **одній транзакції** (один знімок БД, без водоспаду).

  | Обгортка | Актор | Для чого |
  |---|---|---|
  | `withStorefrontDb` | `app_user` без `userId` | публічне читання (каталог) |
  | `withCustomerDb(userId, fn(db, operator))` | `app_user` + `app.user_id` | дані залогіненого покупця |
  | `withOrderTokenDb(token, fn(db, operator))` | `app_user` + `app.order_token` | гостьове замовлення за токеном |
  | `withSessionDb(fn(db, userId, operator))` | `app_user` власника поточної сесії | кабінет; без сесії кидає, а не повертає порожнє |
  | `withStoreOperatorDb` | `app_admin` | службова мутація, яку ініціює сервер або адмінка (реєстр плагінів, конфіг, модерація) |

- 🔴 Лоадери — **server-only дерево** за декларацією `contracts/server-only`:
  serverFn-модулі імпортують їх лише bare-субшляхом (`simplycms/storefront/loaders`),
  ніколи відносним шляхом. Живий не-serverFn експорт, підтягнутий відносно,
  бандлер піднімає в спільний чанк, і весь value-граф лоадерів (drizzle, пул)
  потрапляє в клієнтський бандл. Стережуть правило `server-only-relative`, гейт
  `tests/dist-server-boundary.test.ts`, Import Protection магазину, Gate C пілота.
- 🔴 `userId` у `withCustomerDb` приходить **лише** з серверної сесії
  (`readSessionSubject`), ніколи з параметра клієнта: підставлений чужий id RLS
  не зупинить, вона звірятиме рядки з тим, кого їй назвали.
- 🔴 **Ескалація ролі покупцем.** Службова дія, яку **ініціює покупець** у власній
  транзакції (списання й повернення залишку, скасування свого замовлення),
  виконується через `operator(fn)`: `SET LOCAL ROLE app_admin` рівно на час `fn`,
  **після** того, як RLS уже прийняла читання чи запис покупця в цій транзакції,
  і лише над обліком магазину — ніколи для чужих рядків. «Спершу перевірити в
  одній транзакції, потім писати з іншої ролі в другій» — заборонена форма: між
  ними вікно. Дію, яку можна натиснути двічі, всередині ескалації прикриває
  блокування рядка (`lockOrderStatus`): `READ COMMITTED` двох однакових
  скасувань не розрізняє. `operator` після завершення транзакції кидає помилку
  (захоплене замикання могло б захопити чуже зʼєднання пулу). Гейти —
  `test-harness/pg/__tests__/order-stock.test.ts`, `storefront-personal-data.test.ts`.
- 🔴 **Видимість фільтрує КОД.** На каталозі RLS немає: `app_user` має SELECT на
  всю таблицю, бо «активність» — правило показу, а не право доступу. Кожен
  публічний запит несе предикат явно (`is_active = true`, `has_page = true`).
  Забутий предикат не падає — він виводить чернетки у вітрину.
- Приклад серверної функції (зразок — `storefront-routes/server/catalog.ts`):

  ```typescript
  export const getSectionPageData = createServerFn({ method: 'GET' })
    .validator(z.object({ slug: z.string().min(1) }))
    .handler(async ({ data }) => {
      const { slug } = data as { slug: string };
      return withStorefrontDb(async (db) => {
        const section = await loadSectionBySlug(db, slug);
        return section ? { section, products: await loadProductList(db, section.id) } : null;
      });
    });
  ```

  🔴 `createServerFn` — лише топ-рівнева константа модуля (правило
  `eslint-rules/server-fn-top-level.mjs`): ланцюг, прихований у властивості
  чи функції, трансформація тихо не підхоплює. Валідатор — `.validator(…)`;
  `.inputValidator(…)` застарів.
- Типи рядків для нового серверного коду — з `simplycms/schema/types` (виведені з
  Drizzle). `packages/simplycms/src/supabase/database.ts` — **заморожений**
  baseline типів легасі-адмінки: не оновлювати і не «прибирати дублювання».
- Cross-request кеш серверних даних — `createReadCache` модуля **`simplycms/site`**
  (§12): TTL 5 хв + лічильник поколінь. ISR і `revalidatePath` не існують;
  інвалідація — скидання кешу САМОЮ операцією адмінки після COMMIT +
  `router.invalidate()` у клієнті + `staleTime` лоадера.
- `head` на кожній SSR-сторінці (title, description, og:*, canonical, JSON-LD де доречно).

## 3. Адмінка

- Адмінка — client-side SPA на серверному шарі **`simplycms/admin-server`**
  (`defineAdminResource` — фабрика операцій з інваріантами; публічна поверхня
  `index.ts` — лише топ-рівневі `createServerFn`, нутрощі — bare-субшлях `./impl`)
  і колекціях **`simplycms/admin-data`** (TanStack DB; колекції без `schema`).
- Легасі-шар на `supabase-js` (`useSupabaseClient()` у `src/admin/**`) ще живий і
  переписується на `admin-server`; `SupabaseProvider` ніде не монтується, тож
  код сидить на модульному singleton-і браузерного клієнта. Нові сторінки адмінки
  пишуться на колекціях `admin-data`/операціях `admin-server`, а не на
  `supabase-js`. Реєстр переписаного — `tests/admin-server-first/registry.ts`,
  поточний перелік — `docs/tasks/v2-state-map.md`. Вітрина `supabase-js` не імпортує.
- Серверний subset (`admin-server/impl/subset*.ts`) — allowlist колонок ресурсу:
  `eq/gt/gte/lt/lte` — колонки `filterable` ∪ `sortable` (курсор пагінації
  відсортованої колонки; безпеки не знижує — значення клієнт і так бачить),
  `in/isNull` — лише `filterable`; значення діапазонних операторів — скаляр або
  `Date` (переживає межу serverFn як `Date`, доводить `tests/admin-subset-wire.test.ts`).
  Пагінація на рівних мітках часу — `live:smoke`, `admin-lists-pagination.mjs`.
- Після мутації адмінки — два шляхи за типом сторінки. Сторінки на `useQuery` +
  serverFn (одиничний рядок чи короткий список: налаштування, теми, плагіни —
  К3-Е6б, Е6б-19) пишуть відповідь сервера в кеш через `setQueryData` (write-back,
  К3-7): операція вже повернула актуальний стан, і повторний запит його лише
  продублював би. `invalidate` відповідних ключів (§4) — для колекцій `admin-data`
  і для споживачів вітрини, чиї дані мутація зачепила.

## 4. Контракт ключів кешу (React Query)

🔴 **`queryKey` не пишеться літералом.** Сегмент 0 завжди з реєстру
`simplycms/contracts/entities`, а не з довільного рядка (`'admin'`, `'catalog'`):
інакше одна сутність отримує різні ключі в різних місцях, і мутація в одному не
інвалідовує кеш іншого (виміряно: `pickup_points` жила під чотирма ключами до
реєстру). Механізми:

- **`entityKey(ENTITY.x)`** — однотабличний ключ: `.all()` / `.detail(id)` /
  `.scoped(relation, parentId)` (FK-зріз) / `.variant(qualifier, id?)` (форма чи
  скоуп тієї самої сутності).
- **`collectionKey(ENTITY.x)`** → `[entity, 'list']` — 🔴 лише колекції
  `simplycms/admin-data`. Вітрина й адмінка ділять один `QueryClient`, а write-back
  колекції (`query-db-collection`) шукає ключі за ПРЕФІКСОМ: eager-колекція
  ПЕРЕЗАПИСУЄ всі, що під ним, своїм набором рядків, on-demand (1.3.x) —
  ревалідує активні, необсервовані ВИДАЛЯЄ, а ті, що мають чужого
  спостерігача, перезапитує. Ціна — після збереження перезапитується кожна завантажена
  сторінка активного списку + кожна закешована картка (eq id), повернення до
  списку — по запиту на сторінку ЛИШЕ після спливу `staleTime` (5 хв,
  `src/router.tsx`) або після інвалідації (запису); без запису в межах
  `staleTime` список віддається з кешу БЕЗ запиту, тож зміни інших
  користувачів (нові замовлення) зʼявляються із запізненням до `staleTime`
  (числа й умова перегляду — TSDB-1). Тому поза `admin-data` жоден ключ не сміє
  починатися з `[entity, 'list']` — ні голим `.list()` (методу немає), ні спредом,
  ні літералом.
- **`AGGREGATE.x`** (`aggregateKey`) — запит, що за один похід читає кілька
  таблиць: `.key` — стабільний префікс для інвалідації, `.deps` — повний список
  читаних таблиць (саме звідси інвалідація бере, що скидати).
- **`SESSION_KEY`** — похідний/сесійний стан, що не належить жодній таблиці.

Стережуть: `eslint-rules/query-key-from-entity.mjs` (зона — `core/`, `*-ui/`,
`react-query/`, `storefront-routes/` пакета ядра; `src/admin/**` — виїмка, доки
сторінки не переписані), `eslint-rules/no-collection-key-outside-admin-data.mjs`,
тест парності `schema/__tests__/entity-parity.test.ts` (реєстр ↔ схема),
`admin-data/__tests__/collection-key-storefront-isolation.test.ts`.

## 5. Контракт id: ключ генерує ВИКЛИКАЧ, не БД

🔴 У таблицях «Категорії A» (усі, крім чотирьох таблиць Better Auth) знято
`DEFAULT gen_random_uuid()`, тож **кожен** шлях вставки передає `id` явно:

```typescript
// сервер (SSR-лоадери, server fns, auth-провізія, реєстри тем/плагінів)
import { randomUUID } from 'node:crypto';
await db.insert(userAddresses).values({ id: randomUUID(), userId, ...input });

// клієнт (сторінки адмінки, плагіни через usePluginTable)
await port.insert({ id: crypto.randomUUID(), question, answer });
```

Чому не DEFAULT: оптимістичний рядок у клієнтському кеші мусить мати **той самий**
ключ, що й рядок у БД, інакше після відповіді сервера кеш ловить дубль. Пропущений
`id` падає гучно (`23502 not_null_violation`), а не розходиться тихо — не
«лагодь» це поверненням `.defaultRandom()` у схему.

Дві іменовані виїмки:

| Виїмка | Чому | Хто стереже |
|---|---|---|
| `users`, `sessions`, `accounts`, `verifications` | Better Auth з `generateId: 'uuid'` не кладе `id` в INSERT | `test-harness/pg/__tests__/id-defaults.test.ts` |
| `packages/simplycms/src/admin/**` | легасі-шар на `supabase-js`, переписується | `tests/admin-inserts-need-id.test.ts` — ратчет, число лише зменшується |

Гейт інваріанта — `test-harness/pg/__tests__/explicit-ids.test.ts`
(`pnpm test:schema`): **дискаверить** усі вставки в `packages/simplycms/src/**`,
а не звіряється зі списком, тож нова вставка без `id` червонить його одразу.

## 6. Контракт дат

Усі `timestamp` доменної схеми — `mode: 'date'`: у застосунку дата — `Date`.
Рядком вона стає лише на межі виводу, де формат диктує зовнішній контракт
(`toISOString()` у `storefront/seo/sitemap.ts`, `Intl.DateTimeFormat` у UI). Пул
`simplycms/db` ставить `DateStyle=ISO,YMD`/`TimeZone=UTC` на кожне зʼєднання
(`db/client.ts`), тож текст драйвера не залежить від кластера. Через loader-payload
і serverFn `Date` проходить як `Date`. 🔴 `new Date(рядок)` у коді вітрини — сигнал,
що межу перетнули не там. Гейти: `seo/__tests__/sitemap.test.ts`,
`test-harness/pg/__tests__/storefront-loaders.test.ts`, `db-session-options.test.ts`.

## 7. Міграції

Джерело правди схеми — `packages/simplycms/src/schema/schema.ts` (Drizzle + RLS у TS).

```bash
# 1. правка packages/simplycms/src/schema/schema.ts
pnpm db:diff <name>       # 2. drizzle-kit generate → packages/simplycms/migrations/NNNN_<name>.sql
#                            3. РЕВʼЮ згенерованого SQL (git diff) — обовʼязково
pnpm test:schema          # 4. накат УСЬОГО канону на чисту БД харнеса + поведінка RLS
```

- Канон застосовного SQL — `packages/simplycms/migrations/`: baseline
  (`0000_prelude` → `0004_functions`) плюс усе, що додав `db:diff`. Порядок накату — за
  числовим префіксом імені. Теки `supabase/migrations/` немає.
- 🔴 Ручні функції/тригери — лише в ручних файлах канону (`0000_prelude`,
  `0004_functions`), `0001_init` — чистий генерат (парність із drizzle-kit повна,
  без винятків за маркером); множину функцій і тригерів стереже гейт
  `functions-allowlist.test.ts`.
- 🔴 Ревʼю SQL обовʼязкове: drizzle-kit не бачить перейменувань (генерує
  `DROP`+`ADD`) і не діфить ролі, гранти й функції.
- Журнал і snapshot Drizzle — окремо, у `packages/simplycms/drizzle/` (подвійна
  бухгалтерія навмисна, комітяться обидві теки; нумерація в них своя). Schema-тулінг
  (`drizzle/`, `drizzle.config.ts`, `seed-migrations/`) живе на рівні ПАКЕТА, не в
  `src/schema/`. `drizzle/meta/*` вручну не правиться; виняток — точкова правка
  baseline (`drizzle/0000_init.sql` + `meta/0000_snapshot.json`, синхронно з каноном і
  `schema.ts`), після якої `drizzle-kit generate` мусить сказати «No schema changes».
- Копію канону для магазину везе шаблон скаффолдера
  (`template/supabase/migrations/`, `pnpm template:sync`); `simplycms db:diff` у
  магазині докочує з неї нове поверх baseline.
- 🔴 `pnpm db:migrate` — файл-надгробок, падає з поясненням. **Не** застосовуй
  міграції через Supabase MCP (`apply_migration`/`execute_sql`): MCP лише для
  інспекції (`list_tables`, `SELECT`, `get_advisors`). Не пиши SQL повз `db:diff`.
- `DATABASE_URL` (з `.env.local`) — джерело тулінгу `db:pull`/`db:diff` і рантайм-пул
  `simplycms/db`. Генератора типів БД немає.

## 8. Заборони

- Не використовуй `DEFAULT gen_random_uuid()` як страховку (§5).
- Не імпортуй гола фабрику пулу `simplycms/db/client` — лише `withActor`.
- Не роби DB-виклики в серверних функціях без обробки помилок.
- Не вставляй розмітку контенту в DOM інакше, ніж `<RichHtml>`, і не пиши
  `as SanitizedHtml` поза фікстурами: тип — доказ серверної санітизації (§9).
- Не виконуй зміну стану в GET-обробнику й не додавай префікс у
  `CSRF_EXEMPT_PREFIXES` «щоб працювало»: мутації (POST/PUT/PATCH/DELETE) вже
  під `csrfMiddleware` (див. `rendering-and-routing.md` §2); виняток — лише
  свідомий, для зовнішнього виклику з власною автентифікацією.
- Не хардкодь query keys і не заводи ключ, що починається з `[entity, 'list']`
  поза `admin-data` (§4).
- Не читай секрети й `MEDIA_ROOT` на модуль-рівні — лише в рантаймі (контракт
  серверного env, `docs/development/ENVIRONMENT.md`).

## 9. Rich HTML: санітизація (Тема 9)

Колонки з розміткою rich-text редакторів — `product_reviews.content` (редактор
відгуків, профіль `review`) і `description` у `products`, `sections`,
`property_options` (редактор адмінки, профіль `content`). Редактор — НЕ межа
довіри: server function можна викликати напряму, а форма відгуку без
`renderEditor` — звичайний `<textarea>`. Тому розмітка очищується **на сервері
двічі**:

1. **Рубіж 1 — запис.** Відгук: `insertProductReview` санітизує перед INSERT.
   Адмін-ресурси: у `defineAdminResource` колонки оголошуються як
   `richHtml: { description: 'content' }`, generic-write (`resource-write.ts`)
   санітизує значення ПІСЛЯ парсингу схеми (insert і update-патч). Схеми
   `columnsToZod` не змінюються — санітизація не частина схеми (парність схем з
   Drizzle-таблицею лишається). Ключі `richHtml` типізовано лише записуваними
   колонками.
2. **Рубіж 2 — віддача.** Лоадери вітрини (`loadProduct`, `toSectionRow`,
   `toOptionRow`, `loadProductReviews`) і операції читання адмінки (`list` та
   RETURNING фабрики ресурсу, `getAdminReviewContent`) санітизують те, що
   віддають клієнту, — це закриває старі рядки, сід і демо-дані. Список
   каталогу опису товару не віддає (`description: null`). Сторінка модерації
   відгуку читає рядок легасі-шляхом `supabase-js` з браузера, тож розмітку для
   показу бере із серверної операції `getAdminReviewContent` (грант
   `review.moderate`).

**Тип.** `sanitizeRichHtml(html, profile): SanitizedHtml` (`simplycms/sanitize`,
server-only: модуль і `sanitize-html` — у `contracts/server-only`) — ЄДИНИЙ
виробник брендованого `SanitizedHtml` (T0, `simplycms/contracts`). Поля rows
лоадерів і view-model-ів (`simplycms/contracts/views`) мають цей тип, а в DOM
його виводить лише `<RichHtml>` (`ui.md` §3, `themes.md` §2.1). Приведення
`as SanitizedHtml` допустиме тільки у фікстурах.

**Профілі.** Білі списки збігаються з виводом редакторів. `review`: `p br strong
em s u code ul ol li a`. `content`: те саме + `h1-h3 blockquote pre hr img`,
`style` лише `text-align: left|center|right|justify` на `p`/`h1-h3`, класи лише
ті, що кладуть самі розширення (`text-primary underline cursor-pointer` на `a`,
`max-w-full h-auto rounded-lg` на `img`, `language-*` на `code`). Посилання —
`http`, `https`, `mailto` (у `content` ще внутрішні шляхи `/…`, не `//…`); у
`review` примусово `target="_blank" rel="nofollow ugc noopener noreferrer"`;
`img src` — `http(s)` або `/media/…`. Усе інше (`script`, `style`, `svg`,
`iframe`, обробники подій, `javascript:`/`data:`, сторонні класи й `style`)
відкидається.

**Нова колонка з розміткою** = (а) `richHtml` у ресурсі, (б) санітизація в
лоадері/операції читання, (в) поле типу `SanitizedHtml` у row/vm, (г) вивід лише
`<RichHtml>`. Докази — `tests/rich-html-roundtrip.test.ts` (редактори без втрат),
`sanitize/__tests__/rich-html-vectors.test.ts` (вектори),
`test-harness/pg/__tests__/html-sanitization.test.ts` (обидва рубежі проти БД) і
крок `review-xss` у `pnpm live:smoke`.

## 10. Помилки валідації адмін-serverFn (Тема 12)

Відмова Zod на межі адмін-serverFn — НЕ сирий JSON у тості, а типізована доменна
помилка, яку клієнт розкладає по полях форми.

**Контракт.** `ValidationError` — четверта в закритому реєстрі
`contracts/domain-errors` (`AdminConflictError`, `AuthzError`, `ValidationError`).
Payload — `issues: { path: (string|number)[], code, params? }[]`, пропущені крізь
БІЛИЙ СПИСОК `sanitizeValidationIssues` (T0): коди — `VALIDATION_ISSUE_CODES`
(коди Zod + `invalid_decimal`, невідомий → `custom`), `params` — лише властивості
схеми (`expected`, `origin`, `minimum`, `maximum`, `format`, `multipleOf`,
`precision`, `scale`). Сирі повідомлення Zod, `input`, `pattern` і будь-яке
відлуння введеного значення за межу не летять. Статус відповіді — 400.

**Межа serverFn.** `domainErrorAdapter` (UPSTREAM:START-2) везе `issues` окремим
каналом поруч із `fields` і пропускає їх через білий список з обох боків
(сервер — перед відправкою, клієнт — після прийому). Без адаптера клієнт бачить
голий `Error(message)` (контроль у `domain-error-adapter.test.ts`); реєстрацію в
`createStart` стереже `tests/domain-error-adapter-registered.test.ts`.

**Де сервер перетворює.** ОДНЕ місце — `admin-server/impl/validation.ts`:
`parseAdminInput(schema, data)` (Zod → `ValidationError` + `setResponseStatus(400)`)
і `adminInput(schema)` — валідатор serverFn: `.validator(adminInput(schema))`
замість `.validator(schema)` (так у кожному serverFn `admin-server/index.ts`).
Повторні парси `defineAdminResource` та іменованих операцій викликають
`parseAdminInput` напряму. 🔴 Чому не middleware: `execValidator` Start для
будь-якої Standard-схеми кидає `new Error(JSON.stringify(issues))`, тож до
middleware доходить лише рядок — відновлення issues з `message` крихке й
неоднозначне. Повноту застосування `adminInput` стереже
`admin-server/impl/__tests__/admin-validators-wrapped.test.ts`: гард читає ВСІ
не-тестові файли `admin-server/**` (glob), кожен `.validator(...)` там — `adminInput(...)`
або імʼя з явного списку не-схемних валідаторів (`uploadFormInput` — FormData
завантаження; виняток за іменем функції, не регексом по тексту).

**Свідомо НЕ загорнуті валідатори поза `admin-server`** (їхні помилки далі йдуть
як `Error(JSON)`; перелік у тому ж гарді — новий файл із `.validator(` без запису
червоний): `themes/server` і `plugins/server` — bootstrap-синхронізація, не
форми адмінки; `plugin-sdk/server` — зовнішній контракт plugin-sdk (плагін
отримує звичайний `Error`, форма полів тут не передбачена); вітрина й кабінет
(`core/lib/*`, `storefront-routes/server/*`) — не адмін-форми.

**`numeric`-колонки.** `columnsToZod` перевіряє десятковий формат за
precision/scale колонки: `numeric(10,2)` — необовʼязковий знак, ≤ 8 цілих і ≤ 2
значущих дробових цифр, без експоненти/пробілів/`NaN`; `numeric` без precision —
лише формат. `'abc'` → `invalid_decimal` (400), а не 22P02/500; ненульові
зайві дробові цифри відхиляються, а не округлюються мовчки, а хвостові нулі
понад scale без втрат допустимі (`'1.500'` у `numeric(10,2)`). Клієнт числової
властивості (`numeric(15,4)`) сам шле простий десятковий рядок без експоненти
і не відправляє більше знаків, ніж колонка (`NumberPropertyInput`). Це НАВМИСНЕ розходження з drizzle-zod:
гейт паритету не послаблено, виняток задокументований у
`__tests__/support/parity-diff.ts` (`numericFits` — незалежна реалізація), мутація
`m5` доводить, що повернення до `z.string()` червоніє.

**Клієнт.** `applyServerValidation(error, setError, { t, fieldFor? })`
(`admin/lib/apply-server-validation.ts`): `null` — не помилка валідації (звичайний
шлях `adminErrorKey`); масив — немаплені проблеми (загальний тост
`admin.validation.failed` — лише для них, порожній масив = усе по полях).
Повідомлення — ключі `admin.validation.<code>` (+ `_string`/`_array` для меж за
`origin`) з параметрами схеми. `setError` сумісний із RHF
(`formErrorBinding(form, fields)` — лише поля, чий UI показує серверне
повідомлення) і з локальним станом редакторів без RHF
(`useServerFieldErrors`). Позиційний `path` (`quantities.<i>.quantity`,
`prices.<i>.price`) редактор мапить назад у склад/вид ціни через `fieldFor`.
`adminErrorKey(ValidationError)` → `admin.validation.failed` для місць без полів
(видалення, миттєві контроли, порядок статусів).

**Нова форма адмінки** = помилка збереження йде через `applyServerValidation` (або
`useServerFieldErrors`), поле показує `errors[field].message`; нового серверного
валідатора без `adminInput` не пишемо.

**Прецедент: зайнятий email — помилка поля (К3-Е6г, Е6г-1).** Унікальність, яку
форма може виправити, — це `ValidationError`, а не 409 «дубль»: тост без поля не каже,
що саме міняти. Код `taken` — у закритому переліку `VALIDATION_ISSUE_CODES`, повідомлення —
`admin.validation.taken`. `updateCustomerContacts` нормалізує email
(`trim().toLowerCase()`), у транзакції перевіряє `lower(email)` серед ІНШИХ
користувачів і кидає `ValidationError([{ path: ['email'], code: 'taken' }])` (400);
гонку `23505 users_email_key` перехоплює та сама гілка. Причина: `users_email_key`
чутливий до регістру, а Better Auth і `ownerInviteStore` порівнюють email у нижньому
регістрі — без явної перевірки `Buyer@x` і `buyer@x` стали б двома акаунтами. Власний
email в іншому регістрі — не конфлікт, записується нижній регістр. Нова унікальність,
яку виправляє користувач у формі, повторює цей прецедент (код у переліку + ключ
повідомлення), а не додає окремий state-код.

## 11. Знімок доставки в замовленні (К3-Е6а)

- Спосіб доставки — **провайдер + режим ціни**. Провайдер (`shipping_methods.provider`,
  `core:address` | `core:pickup`) каже, куди везти, і незмінний після створення
  (`insertOnly`). Режим (`shipping_methods.pricing`: `rates` | `provider` | `carrier`)
  обирає власник. Опис провайдерів для клієнта — T0 `simplycms/contracts/shipping-providers`
  (лише типи й константи). Серверна поведінка — `simplycms/commerce`
  (`resolveDestination`). Розгалуження за режимом живе в одному рушії
  `resolveShippingRate`: його ділять показ (`useShippingDirectory.rateFor`) і запис
  (`quoteShippingCost`, `recomputeOrderTotals`). `carrier` — `shipping_cost = 0`,
  `total = subtotal`, підпис «За тарифами перевізника».
- 🔴 **Замовлення зберігає знімок, а не посилання.** `createOrder` пише в
  `orders.shipping_data` тип `ShippingSnapshot` (`simplycms/contracts/shipping-providers`):
  `methodName`, `provider`, `pricing` і `destination`. `destination` — або адреса
  (`city`, `address`), або точка (`pointId`, `name`, `address`, `city`). Знімок будує
  `prepareCheckout` через провайдера. Читачі — картка адмінки (`OrderDeliveryCard`),
  `OrderSuccess`, `ProfileOrderDetail`. Вони розбирають знімок
  `parseShippingSnapshot` (`simplycms/domain/shipping`, ручний type-guard без Zod) і
  живу точку чи спосіб не читають: після перейменування або видалення замовлення
  лишається тим самим. Знімок, що не розібрався (`{}`), вітрина показує як «Не вказано».
- `orders.pickup_point_id` і `orders.shipping_method_id` — `ON DELETE SET NULL`:
  видалення способу чи точки знімка не зачіпає. `orders.delivery_method` видалено
  (дублював код способу). Залишки від видалення стереже БД:
  `pickup_points.method_id` і `stock_by_pickup_point.pickup_point_id` — `ON DELETE
  RESTRICT`. Точку із залишком чи резервом `removePickupPointsOp` відхиляє 409
  `pickup_point_has_stock`.
- Гейти: харнес `pnpm test:schema` (знімок у БД незмінний після `update pickup_points
  set name`), рендер-тести трьох читачів зі знімка, де жива точка інша, і `live:smoke`
  (крок `admin-shipping.mjs`). Негативний контроль `shippingData: {}` у `createOrder`
  валить крок прогону.

## 12. Профіль магазину й кеш процесу `simplycms/site` (К3-Е6б)

- Профіль — рядок `system_settings['store_profile']` (jsonb `StoreProfile`,
  `simplycms/contracts/store-profile`). Розбір **поблажливий** —
  `parseStoreProfile` (`simplycms/domain/store-profile`) ніколи не кидає:
  зіпсоване поле стає дефолтом, щоб ручний SQL чи старий дамп не клав вітрину
  500-ю. Суворість — лише на записі (`saveStoreProfileOp`, межі
  `STORE_PROFILE_LIMITS`, соцмережі лише `https:`).
- **`simplycms/site`** — server-only модуль T2 (upward-виняток лише `db`) з ОДНИМ
  модульним станом для вітрини (читає) і адмінки (скидає): `storeProfileCache`,
  `activeThemeCache` (`createReadCache`, TTL 5 хв + лічильник поколінь),
  `readStoreProfile(db)`, `toStorefrontProfile`, `declareBuiltThemes`/`isBuiltTheme`.
  Власного каналу до БД модуль не відкриває — кожна функція приймає `ActorDb`.
  Вітрина ходить у нього лише через `storefront/loaders` (`loadStoreProfile`,
  `loadActiveTheme`); `admin-server` імпортує його напряму (тір-зони не дають
  адмінці імпортувати лоадери вітрини).
- 🔴 **Скидання — ПІСЛЯ COMMIT, а не в транзакції.** Операції адмінки
  (`saveStoreProfileOp`, `activateThemeOp`, `saveThemeSettingsOp`) кличуть
  `invalidate()` після повернення `runAdmin`. Покоління не дає читанню, що
  стартувало до COMMIT і завершилось після скидання, покласти старе значення в
  кеш ще на 5 хв (Е6б-9). Клієнт адмінки додатково кличе `router.invalidate()`:
  лоадер `_storefront` має `staleTime` 5 хв (Е6б-22).
- 🔴 **SQL оминає кеш.** Прямий `update system_settings`/`themes` (ручний фікс,
  відновлення знімка в `live:smoke`) вітрина того самого процесу побачить лише
  після TTL. Багатоінстансної інвалідації немає: кожен процес тримає свій кеш.
- Вшиті теми знає СЕРВЕР: host `src/server.ts` кличе
  `declareBuiltThemes(Object.keys(config.themes))` на рівні модуля; без декларації
  активація відмовляє `theme_not_built` (fail-closed, Е6б-8).
- Гейти: юніт `createReadCache` (детермінована гонка «читання в польоті +
  скидання»), харнес `readStoreProfile` на відсутньому й зіпсованому рядку і
  операцій під локами `store-profile`/`site-theme`, `live:smoke` (крок
  `admin-system.mjs` на прогрітому кеші) — єдиний доказ, що адмін-serverFn і
  вітринний serverFn ділять один екземпляр модуля (Е6б-23).

## 13. Ціноутворення, знижки й локи конфігурації (К3-Е6в)

- 🔴 **Одне ядро ціни.** Картки вітрини, кошик, чекаут, редагування позицій
  замовлення й діагностика ціни в адмінці рахують ОДНИМ ядром `simplycms/commerce`:
  `loadPricingContext(db, userId, opts?)` будує контекст (ефективна категорія з
  відкатом на дефолтну; тип ціни — тип ЦІЄЇ категорії, лише без нього — глобальний
  дефолтний; ліс знижок; ОДИН `now` на весь розрахунок),
  `priceCart(db, ctx, items)` рахує рядки з `available`, `priceItems` — обгортка
  оформлення (`'not_purchasable'`, якщо хоч один рядок недоступний). Суми й пороги
  — цілими центами (`toCents`). Другої формули ціни (на клієнті, в адмінці чи в
  підказці порогу) бути не може: підказка «від 3 шт — …» проганяє той самий рушій
  на гіпотетичному контексті (Е6в-12).
- **Ліс знижок** читає `loadDiscountRules` ОДНИМ SQL-виразом (CTE + `json_agg`):
  знижка з цілями й умовами — один знімок навіть у READ COMMITTED. Межа «БД →
  домен» — `parseDiscountRules`, порядково fail-closed (Е6в-25): пошкоджений рядок
  виключається з розрахунку з причиною `discount_invalid`, розбір не кидає.
  `buildDiscountForest` будує дерево від коренів: вимкнена група падає РАЗОМ із
  піддеревом (діти не піднімаються в корені), `includeInactive` — лише діагностика.
- 🔴 **Середовище цін вітрини — без серверного кешу.** `discountEnvironmentFor`
  віддає `{ forest, actor, priceTypeId, defaultPriceTypeId, now }` однією
  транзакцією; клієнтський ключ `[...AGGREGATE.discountEnvironment.key, userId]`,
  `staleTime: 0` — категорію покупця змінює адмінка в іншому браузері, тож свіжість
  дає перезапит на кожен mount, а не інвалідація. Збій середовища — помилка з
  «Повторити» на картці (`PricesFailure`), а не базова ціна. Кошик — серверна квота
  (`quoteCart` → `quoteCartFor` → `priceCart`); `CartItem` ціни не зберігає. SSR
  гостьовий: база до гідрації — за типом ціни гостя тим самим `resolvePriceTypes`
  (`loadGuestPriceTypes`), що й `loadPricingContext`; так само `offers` Product
  JSON-LD (`head/product-offers.ts`, типи гостя їдуть у лоадері сторінки товару).
  Персональний тип і знижки SSR не рахує (К3-Е6в-1).
- 🔴 **Локи конфігурації — `advisoryXactLock(db, key)`** (`simplycms/db`, ЄДИНА
  реалізація SQL: `pg_advisory_xact_lock(hashtextextended(key, 0))`;
  `lockCatalogTarget` адмінки — її виклик). Лок береться ПЕРШИМ запитом
  транзакції. Ключі: `discount-config` — запис і видалення груп (guard циклу),
  `saveDiscount`, видалення знижок (`removeDiscountsOp`: фабричний `remove` лок-хука
  не бере); `customer-config` — запис і видалення категорій, `setDefault`,
  запис правил; `customer-category:<userId>` — будь-яка зміна категорії одного
  покупця (вручну чи автоправилом); `admin-roles` — будь-яка зміна «хто адмін»
  і все, що від цього залежить (К3-Е6г, Е6г-4, Е6г-19): `setAdminRole`,
  `setCustomerBan`, `deleteCustomer` і invite власника (`issueAdminInvite`). Ключ
  `ADMIN_ROLES_LOCK` живе в `simplycms/auth` (invite — auth і не може імпортувати
  адмінку), адмінка імпортує його звідти. Перевірки «не адмін», «не я», «не
  останній адмін» і «не забанений» виконуються лише під ним.
- 🔴 **Глобальний порядок локів: `customer-config` → `discount-config`.** Жодна
  операція не бере їх навпаки: `saveDiscount` з умовою `user_category` бере
  `customer-config`, потім `discount-config` (перевірка, що категорії умови
  існують, — під обома). Нова операція, якій потрібні обидва, бере їх у цьому
  порядку; зворотний порядок — дедлок (Postgres розірве одну транзакцію, `40P01`).
- 🔴 **Порядок локів покупця: `customer-category:<userId>` → `admin-roles`.**
  Видалення покупця бере їх саме так (спершу не дає правилу категорій писати профіль,
  що зникає, потім серіалізує з видачею ролі); зворотного порядку не бере ніхто.
  `admin-roles` — кінцевий для цього ланцюга: він не береться перед
  `customer-config` чи `discount-config`, і з жодним із них операція покупців його не
  комбінує.
- 🔴 **Клас «рішення Better Auth окремими транзакціями».** BA виконує кожен свій
  запит окремою транзакцією (`drizzle-proxy.ts`), тож між «перевірили» і «записали»
  в самого BA є вікно, яке advisory-лок адмін-операції не бачить. Закриття — на
  стороні БД або в колбеку, не в хуку: (1) тригер `sessions_refuse_banned`
  (`BEFORE INSERT ON sessions`, функція `refuse_banned_session()`, ручний файл
  `0004_functions.sql`, Е6г-14): `SELECT banned_at FROM users WHERE id = NEW.user_id
  FOR SHARE` — БЕЗУМОВНО за `id` (умова `banned_at IS NULL` у `WHERE` ламала б
  `FOR SHARE` у READ COMMITTED), значення перевіряється ПІСЛЯ читання; хук
  `createSessionBanHook` лишається і дає чистий код `BANNED` у звичайному випадку,
  а в гонці клієнт отримує загальну помилку створення сесії; (2) guard у
  `sendResetPassword` (`auth/reset-guard.ts`, Е6г-18): BA вставляє
  `reset-password:<token>` окремим запитом ПЕРЕД викликом колбека, тому колбек
  безумовно читає `email` користувача `FOR SHARE` і, якщо рядка немає чи email
  розійшовся зі знімком BA, видаляє токен і не шле листа (назовні винятку немає: BA і
  так відповідає однаково). Новий випадок цього класу закривається так само —
  `FOR SHARE` у точці запису, а не ще одна перевірка перед нею.
- 🔴 **Invite власника і бан: лок закриває одне, `FOR SHARE` — інше.**
  `issueAdminInvite` (одна транзакція `app_admin`) бере `admin-roles`, потім
  `select banned_at from users where id = $1 for share`. Лок закриває порядок
  «invite першим»: роль без коміту невидима для бану, а лок змушує бан зачекати й
  побачити видану роль (бан адміна відмовляє). `FOR SHARE` закриває лише порядок «бан
  першим»: забанений не отримує ні ролі, ні токена (`banned`, нічого не записано).
  Одне не замінює другого. CLI `owner:invite` на `banned` друкує «спершу
  розблокуйте покупця».
- 🔴 **Межа узгодженості розрахунків поверх кількох агрегатів** (канон для ВСІХ
  таких розрахунків, не лише знижок; рішення Е6в-8 ред.3): Узгодженість
  гарантується в межах агрегата, що пишеться ОДНІЄЮ транзакцією (знижка з цілями й
  умовами — один SQL-знімок). Між незалежними агрегатами (категорія покупця, тип
  ціни, ціни товарів, правила знижок), які змінюються окремими операціями,
  розрахунок може поєднати стани з різних моментів, зокрема комбінацію, якої не
  існувало в жоден момент. Жодного інваріанта це не порушує: записане в
  замовлення = пораховане сервером в одній транзакції оформлення (`priceItems`),
  квоти перераховуються щоразу (`staleTime: 0`), грошових балансів між агрегатами
  немає.
  REPEATABLE READ для чекауту відхилено: `40001` у записуваному шляху.
- Автоправила категорій: після COMMIT оформлення `placeOrderFor` кличе
  `applyCategoryRules` в ОКРЕМІЙ транзакції `withStoreOperatorDb` у `try/catch`:
  збій правил не ламає замовлення (Е6в-19). Скасування замовлення категорію не
  перераховує. `category_id`/`category_locked` профілю змінює лише `app_admin`
  (колонковий грант `app_user`, Е6в-24).
- Гейти: харнес `test:schema` (атомарність `saveDiscount`, локи детерміновано
  хелперами `holdAdvisoryLock`/`stillPending`, видалення категорії з історією,
  правила після оформлення), юніти рушія й підказок, `live:smoke` (крок
  `admin-discounts.mjs`: поріг у картці, кошику й `order_items`, вимкнений батько
  стримує дитину, автоправило змінює ціну).

## 14. Покупці: роль, бан, видалення (К3-Е6г)

Канон операцій адмінки над акаунтом покупця: `setAdminRole`, `setCustomerBan`,
`updateCustomerContacts`, `deleteCustomer` (`admin-server/impl/customers/*`) і зведення
`dashboardSummary`. Читання покупців — не колекція `admin-data`, а серверні `listCustomers`
(keyset `(created_at desc, id desc)`, сторінка 50, `useInfiniteQuery`) і `getCustomerCard`:
база — `users LEFT JOIN profiles`, тож власник, створений CLI `owner:invite` без
`profiles`, у списку є, а його статистика — `null` («—»). Спека —
[`2026-10-07-customers-dashboard-design.md`](../superpowers/specs/2026-10-07-customers-dashboard-design.md).

- 🔴 **Бан живе в хуку Better Auth і в БД (Е6г-13, Е6г-14).** `setCustomerBan`
  одним рядком транзакції під `admin-roles` ставить `users.banned_at`/`ban_reason` і
  `DELETE FROM sessions` — вікна, де забанений має живу сесію, немає. Нову сесію
  відсікають два шари: хук `session.create.before` кидає
  `APIError.from('FORBIDDEN', { code: 'BANNED' })` (повернення `false` заборонене:
  клієнт отримав би загальний `FAILED_TO_CREATE_SESSION`; тест через реальний
  `auth.handler` обовʼязковий) і тригер `sessions_refuse_banned` (§13, клас «рішення BA
  окремими транзакціями»). Скидання пароля забаненого проходить, але сесії не створює:
  вхід відмовляє з `BANNED` (вітрина показує `auth.login.banned`/`bannedContacts`).
  Відкрита вкладка забаненого після перезавантаження — гостьова, `/admin` для нього
  редіректить на `/auth` (guard не змінюється, Е6г-3). Взаємовиключність «адмін ↔
  бан» тримається з обох боків під одним локом: бан адміна → 409
  `customer_is_admin`, роль забаненому → 409 `admin_role_banned` (Е6г-11). Бан
  блокує ОБЛІКОВИЙ ЗАПИС, а не особу: гостьове оформлення замовлення він не зупиняє.
- 🔴 **Порядок `deleteCustomer` (Е6г-15) — одна транзакція `runAdmin`, не
  `runAdminTransactions`:** `customer-category:<id>` → `admin-roles` →
  `users`/`profiles` `FOR UPDATE` → перевірки (існує, не я, не адмін, введений email
  збігається без регістру) → ref аватара читається ДО знеособлення → знеособлення
  замовлень → відгуки анонімні (`user_id NULL`, рейтинг і текст лишаються) →
  `revokeUserVerifications` → `DELETE users` (каскад решти графа) → `eraseMedia(tx, ref)`
  ОСТАННІМ кроком перед COMMIT. Рядок `media` переживає каскад, бо `uploaded_by` має
  `SET NULL`. Збій `driver.delete` відкочує все (покупець, замовлення з ПД, відгук і
  `media` на місці), повтор завершує видалення; збій самого COMMIT лишає лише «файл
  зник, рядок є», що лікується повтором (`local-fs` вважає `ENOENT` успіхом).
  Окремої транзакції для аватара немає: інакше роль, видана між перевіркою й стиранням,
  стерла б аватар нового адміна при відмові видалення.
- 🔴 **Реєстр ПД `orders` (Е6г-7)** — `commerce/order-privacy.ts`:
  `ORDER_COLUMN_PRIVACY: { readonly [K in keyof Order]: 'personal' | 'operational' }`.
  Нова drizzle-колонка без запису червонить `typecheck`; харнес звіряє реєстр з
  `information_schema`. `personal` стираються (`NULL`): імʼя, email, телефон, адреса,
  місто, нотатки, дані отримувача, `userId`, посилання на збережені адреси/отримувачів,
  `accessToken`; `shippingData` — частково (нижче). `operational` (номер, суми, статус,
  точка видачі, дати) лишаються. Знеособлюються ЛИШЕ замовлення з `user_id` покупця.
- **Знімок доставки після стирання (Е6г-10).** Адресна доставка: `destination` стає
  `{ kind: 'address', city: null, address: null }`; точка видачі (`kind: 'pickup-point'`)
  і зіпсований `{}` знеособлення не змінює. Контракт `ShippingSnapshot.city` — `string |
  null`, а `null` допускає лише ЧИТАЛЬНА сторона (три читачі показують «Не вказано»):
  запис знімка (`prepareCheckout`/`placeOrder`, `order-items/totals.ts`) будує
  `destination` з непорожнім `city`, тест «чекаут відхиляє порожнє місто» це стереже.
- **Стерте замовлення не редагується (Е6г-16).** `lockEditableOrder` відмовляє позиціям
  409 `order_personal_data_erased` (поруч з `order_cancelled_final`): перерахунок
  доставки читав би `orders.delivery_city = NULL` і дав би `shipping_unavailable`.
  Зміна статусу й скасування дозволені. `loadOrderDetail` фільтра стертих НЕ має
  (Е6г-17): стерте замовлення недосяжне за побудовою (`user_id NULL`, `access_token
  NULL`), доступ вирішує RLS-роль. Адмінка показує «Видалений покупець» (картка,
  список замовлень, останні замовлення дашборду), вітрина — «Колишній покупець»
  у відгуку (`reviews.formerCustomer`).
- **`revokeUserVerifications(db, { userId, email })` (Е6г-2).** Видаляє
  `verifications` з `identifier LIKE 'reset-password:%' AND value = userId` та рядок
  `owner-invite:<lower(email)>`. Кличуть зміна email (зі СТАРИМ email) і видалення.
- **FK-граф `users`.** Каскадом зникають `accounts`, `sessions`, `profiles`, `user_roles`,
  `user_addresses`, `user_recipients`, `wishlists`, `comparisons`, `user_category_history`;
  `SET NULL` — `orders.user_id`, `product_reviews.user_id`, `media.uploaded_by`,
  `*.changed_by`. «Сиріт» (посилання на `users(id)` у нікуди) після видалення немає: це
  доводить спільний `findOrphans` (`test-harness/pg/__tests__/fixtures/orphans.ts`) і
  живий прогін.
- 🔴 **Межі.** (1) Гостьове замовлення — не акаунт: замовлення без `user_id`, навіть з
  тим самим email, видалення не знеособлює (борг К3-Е6г-1). (2) Бан не зупиняє
  гостьове оформлення. (3) Тимчасового бану й ролей персоналу немає: бан безстроковий,
  роль одна — `admin`; операції `customer.delete` і `user.role.assign` розділені під
  це наперед.
- **Дашборд.** `dashboardSummary` (`order.manage`): нові замовлення, виручка за 7/30
  днів від серверного `now()` (скасовані не рахуються, `status_id NULL` рахуються),
  10 останніх; слот `admin.dashboard.stats` отримує рівно `AdminDashboardStats`. Фільтр
  замовлень живе в URL (`/admin/orders?status=<uuid>`, Е6г-5).
- Гейти: харнес `test:schema` (`admin-customer-*`, `user-graph`, реєстр ПД, `baseline`
  з тригером і allowlist `functions-allowlist`), юніти, `live:smoke` (крок
  `admin-customers.mjs`: контакти й email, закріплена категорія проти автоправила, видача
  й зняття ролі з 403 адмін-serverFn, бан із гостьовою вкладкою, видалення зі
  знеособленням, дашборд = прямий SQL; негативні контролі — без `delete from sessions`
  у бані і без `eraseOrderPersonalData` у видаленні).
