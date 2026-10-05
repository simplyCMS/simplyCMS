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
- Cross-request кеш серверних даних — in-memory TTL у модулі лоадера (еталон —
  `storefront/loaders/theme-record.ts`, 5 хв для активної теми). ISR і
  `revalidatePath` не існують; інвалідація — `staleTime` + `router.invalidate()` +
  скидання TTL-кешу відповідною мутацією.
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
- Після мутації адмінки — інвалідація відповідних ключів (§4); `setQueryData` для
  складних випадків не використовується — `invalidate` замість нього.

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
  (`0000_prelude` → `0003_seed`) плюс усе, що додав `db:diff`. Порядок накату — за
  числовим префіксом імені. Теки `supabase/migrations/` немає.
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
