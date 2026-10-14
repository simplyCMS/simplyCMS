# API-інтеграції та мультимовність даних: стан SimplyCMS, практика платформ, висновки для вибору моделі

Дата: 2026-10-13. Знімок коду: `~/simplycms-accept`, коміт `cd2d18d5`, лише читання.
Позначки: **[підтв.]** — перевірено в першоджерелі (посилання в тексті); **[не підтв.]** — не вдалося
підтвердити, стверджую з обережністю; **[з коду]** — прочитано в знімку.
Усі посилання зведено в §10. Де веб-сторінка віддала лише огляд, а деталі — у типі/схемі на GitHub,
я брав GitHub (RAML/GraphQL/XSD) як першоджерело.

---

## 0. Короткий підсумок

1. **Публічного API в SimplyCMS немає.** Є ~125 `createServerFn` адмінки (`admin-server/index.ts`) — це
   same-origin RPC для самого застосунку, під cookie-сесію Better Auth, без токенів, вебхуків,
   імпорту/експорту, ідемпотентності, версіонування. Офіційна документація TanStack Start прямо каже:
   серверні функції призначені для виклику самим застосунком, а для зовнішніх викликів треба server routes
   [підтв.]. Тобто основою **зовнішнього** API мають стати не самі `serverFn`, а ядра під ними.
2. **Придатні для повторного використання саме ядра**: `defineAdminResource` віддає `insertIn/updateIn/removeIn(db, input)`
   (спільне тіло в транзакції викликача, без HTTP і без гранта) — у коментарях прямо названо «майбутній
   MCP-сервер магазину» [з коду]. Zod-валідація, `AuthzError`/`ValidationError`/`AdminConflictError` з
   вайтлістом кодів, `lock → guard → запис` — усе вже є.
3. **«GUID 1С = наш id» у коді вже майже готове**: усі 37 доменних таблиць мають `uuid` PK без `DEFAULT`,
   `id` задає викликач (виняток — 4 таблиці Better Auth). Три речі, які це ламають або ускладнюють: (а)
   фабрика валідує id через `z.uuid()` (строгий RFC: версія 1–8, варіант 8/9/a/b) — це **відсікає GUID
   інших форм**, `z.guid()` приймає будь-які 8-4-4-4-12; (б) немає upsert за id — `insert` на існуючий id
   дає 409 (23505), `update` неіснуючого — звичайний `Error`; (в) пакет ≤ 100 елементів, оновлення
   рядок-за-рядком. Окремий нетривіальний випадок — **модифікація**: у CommerceML пропозиція має складений
   `Ид` «товар#характеристика» (§3.3), тож один GUID 1С не обов'язково дорівнює одному `product_modifications.id`.
4. **Форма API від моделі зберігання майже не залежить** — це головний висновок частини 2. Sylius зберігає
   за патерном B, а в API віддає/приймає `translations: { en_US: {...} }` (мапа локалей в об'єкті)
   [підтв.]; commercetools — `LocalizedString`-мапа в кожному полі; Shopify — окремий ресурс перекладу
   з `digest` і `outdated`; Shopware — обидва способи одночасно з формальним пріоритетом. Отже вибір
   A/B/D слід робити за **операційними** властивостями (конкурентні правки різних локалей, облік
   «застарілості», інваріант «мова за замовчуванням завжди є», пошук), а не за формою JSON.
5. **Для двох нових вимог власника** (завантаження однією мовою + переклади окремо; перейменування):
   найближча до індустрії практика — Shopify: переклад — окремий запис із `digest` оригіналу, після зміни
   оригіналу стає `outdated: true`, переробляє його не платформа, а той, хто пише переклади; slug при
   зміні — **явний** `redirectNewHandle` у мутації. Жодна з розглянутих платформ (Saleor, commercetools,
   Sylius) не веде історії slug «з коробки» [не підтв. як відсутність, але не знайдено]. У нас історії
   slug теж немає, а 301 є лише для нормалізації сегмента розділу (`domain/product-path.ts:46-52`).
6. **До заморозки схеми реально дорого виправляти** лише одне: форма ключа таблиць перекладів
   відносно конвенції «`id` скрізь» (§9.1). Решта — `updated_at`, `version`, tombstones, історія slug,
   `source_hash` перекладу — додається міграціями адитивно.

---

## 1. Частина 1 — поточний стан SimplyCMS (з коду)

### 1.1. Серверний шар даних

| Шар | Що це | Якір |
|---|---|---|
| Транспорт | `createServerFn`, топ-рівневі const, один модуль на весь пакет; ~125 serverFn (grep `createServerFn` дає 126 збігів з урахуванням імпорту) | `packages/simplycms/src/admin-server/index.ts` (напр. `listProducts` ~210; докблок «лише serverFn» над `listOrderStatuses`) |
| Межа гранта | `runAdminTransactions(operation, fn)`: `requireGrant` → `withActor(actor)` → мапінг помилок у 409/400; `runAdmin` = одна операція — одна транзакція | `admin-server/impl/run.ts:35-72` |
| Фабрика ресурсу | `defineAdminResource({entity, table, operation, filterable, sortable, writable, readonly, omit, touch, richHtml, media, lock, guard, maxLimit})` → `list/insert/update/remove` + `insertIn/updateIn/removeIn` | `admin-server/impl/resource.ts` (весь), `resource-write-ops.ts:137-140` |
| Схеми | `insertSchema/updateSchema/removeSchema` = масиви **1…100**; `id: z.uuid()` | `admin-server/impl/resource-schemas.ts:105-123` |
| Читання | «subset»: `filters` (≤20; eq/gt/gte/lt/lte/in/isNull), `sorts` (≤5), `limit ≤ 500`, `offset` — позиційна пагінація; курсору немає | `admin-server/impl/subset-schema.ts:60-76`, `subset.ts` |
| Запис | `insertResourceRows` — один `INSERT … VALUES (...)` усього пакета; `updateResourceRows` — **цикл** по елементах, по одному `UPDATE … WHERE id` | `admin-server/impl/resource-write.ts:28-77` |
| `updated_at` | штампує фабрика (`touch`), тригера в каноні немає | `resource-config.ts:68-73`, `resource-write.ts:66-68` |
| Іменовані операції | усе з інваріантом (`setDefault`, `reorder`, `saveProductPrices`, `saveStock`, зміна статусу замовлення, знижки…) — руками в `impl/<entity>/` | `admin-server/index.ts` (коментарі «🔴 … іменовані операції») |
| Колекції адмінки | `admin-data` — TanStack DB колекції, `getKey: row => row.id` | `admin-data/collections/products.ts:33` |
| Контракти | `contracts/entities.ts` — реєстр імен таблиць (`ENTITY`, 36 значень), `contracts/objects/*` — доменні об'єкти для вітрини (`Product.name: string`, одномовні), `contracts/ports` — `CatalogRepository` з необов'язковим `upsertProduct?(Partial<Product> & {id?})` — це лише тип-заготовка | `contracts/entities.ts:16-53`, `contracts/ports/index.ts:41` |
| Плагіни | `plugin-sdk/server`: `pluginTableList/Insert/Update/Remove` (лише скалярні клітинки, `eq`-фільтр, адмін-перевірка `requireAdmin`) — не REST, теж serverFn | `plugin-sdk/server/index.ts:25-80` |

### 1.2. Авторизація

- Два рубежі: типізований `AUTHZ_MATRIX` (роль × операція → `own|any`) і роль БД `app_user`/`app_admin`
  через `SET LOCAL ROLE` в `withActor` (`auth/authz.ts:66-110`, `db/actor.ts:15`). Ролей БД дві.
- Ролі доменні дві: `admin`, `user` (`AppRole`, `authz.ts`); 18 операцій (`catalog.write`, `order.manage`,
  `media.write`, `settings.manage`, …). Є заготовка під «менеджер замовлень/контент-редактор» (коментарі до
  `order.manage`, `banner.manage`), самих ролей немає.
- Суб'єкт береться **лише з сесії** Better Auth + таблиця `user_roles` (`auth/session.ts:48-65`,
  `auth/authz-request.ts:31-44`): ролі навмисно не в токені, щоб відкликання діяло одразу.
- Better Auth створюється **без плагінів** («Плагінів — нуль, B3: CVE-поверхня», `auth/instance.ts:29`).
  Токена інтеграції (API key / bearer) немає. У Better Auth існує плагін API-ключів як окремий пакет
  `@better-auth/api-key` (версія 1.7.7 в npm, збігається з ядром) з `permissions`, `expiresIn`,
  `enableSessionForAPIKeys` (ключ імітує сесію користувача) [підтв.: npm + документація]. Це **рішення
  суперечить чинному принципу «нуль плагінів»**; альтернатива — власна таблиця `api_tokens` (хеш,
  суб'єкт, scope, `expires_at`, `last_used_at`) і розв'язання суб'єкта в `resolveRequestGrant` другою гілкою.
  Це продуктове/безпекове рішення власника, не дослідження.
- **CSRF**: `csrfMiddleware` відкидає будь-який POST/PUT/PATCH/DELETE без `Sec-Fetch-Site: same-origin` /
  `Origin` / `Referer` — для server-функцій і server routes; виняток тільки `CSRF_EXEMPT_PREFIXES = ['/api/auth/']`
  (`runtime/csrf.ts:12`, `docs/architecture/rendering-and-routing.md:50-65`). Для API з Bearer-токеном
  потрібен свідомий виняток-префікс (наприклад `/api/v1/`) з власною автентифікацією — тобто **зміна ядра**,
  а не конфіг магазину. Дерево роутів збирає `routes.ts` (virtual routes), змонтований лише `src/routes/my/`
  (`AGENTS.md`), тож API-роути постачає пакет ядра.
- Статус відповіді ставить **тільки межа** (`run.ts`, `validation.ts`), ядра статус не чіпають і тому
  викликаються поза HTTP (`docs/architecture/data-layer.md:420-431`; коментар `core-actor.ts` називає
  «майбутній MCP-сервер магазину»). `CoreActor = {kind:'admin',userId} | {kind:'system'}` (`core-actor.ts`)
  — готова ідентичність для CLI/MCP/імпорту.

### 1.3. Чого немає (перевірено grep по `src`, `docs/architecture`)

- REST/GraphQL/OpenAPI: немає. Єдині HTTP-поверхні — `/_serverFn/<id>`, `/api/auth/*` (Better Auth), health.
- Токени доступу для інтеграцій: немає. Вебхуки: у спеках лише для платежів/пошти (`2026-10-06-commerce-providers-design.md:39,69,189-193` — «вебхук-роут плагіна: немає»).
- Імпорт/експорт каталогу: немає (є `db:demo`, `db:showcase` — сід через ядра).
- Ідемпотентність: ключів `Idempotency-Key` немає; є лише «ідемпотентний delete» драйвера сховища та лічильник у `inventory/order-stock.ts`.
- Версіонування рядків: немає `version`/`etag`; оптимістичного блокування немає. `updated_at` — `Date` (мс), у PG
  `timestamptz` має мікросекунди, тож порівняння як ETag було б нестабільним **[з кодової конвенції `mode:'date'`, `data-layer.md §6`; саме
  втрату µs у драйвері не перевіряв]**.
- Версіонування API: немає. Адреса серверної функції має вигляд `/_serverFn/<id>` (`test-contours.md:1022`) і не є публічним контрактом: документація TanStack призначає їх для самого застосунку [підтв.].
- Два заплановані треки: «MCP-сервер магазину» — поза скоупом v2 (`2026-08-19-backend-contract-v2-design.md:390-392`) і
  не-ціль частини Б toolkit-спеки (`2026-10-12-shop-agent-toolkit-design.md:53`); MCP/UCP-адаптер «поверх того самого порту» пошуку —
  `2026-08-25-storefront-search-design.md §11` (з застереженням «схему UCP не вшивати в ядро»).

### 1.4. Придатність серверних функцій як основи зовнішнього API

| Критерій | Стан | Висновок |
|---|---|---|
| Валідація | Zod 4 на вході, вайтліст кодів у відповіді (`sanitizeValidationIssues`) | Готово, повторно використовується |
| Контракти помилок | `AuthzError` 403, `ValidationError` 400, `AdminConflictError` 409 (23505→`unique`, 23503→`reference`, `errors.ts:74-75`); `update` неіснуючого — голий `Error` (`resource-write.ts:70-72`) без 404 | Потрібен тип «not found» |
| Пагінація | offset/limit ≤ 500; жодного keyset-курсору | Для вивантаження каталогу в 1С потрібен keyset по `(updated_at,id)` |
| Пакетність | ≤100 елементів, UPDATE у циклі | Для масового імпорту — окремий set-based шлях (§9.3) |
| Upsert | немає; id від клієнта обов'язковий | Додати `upsertIn` (`INSERT … ON CONFLICT (id) DO UPDATE`) — не змінює схему |
| Ідемпотентність | немає | Для 1С: ідемпотентною робить upsert за GUID; для замовлень/POST-дій — `Idempotency-Key` + таблиця (адитивно) |
| Версіонування | немає | Версіонувати треба **зовнішній** шар (префікс `/api/v1`), не serverFn |
| Seroval | serverFn серіалізуються seroval (`Date` їде як `Date`) | Зовнішній API — JSON ISO-рядки; окремий серіалізатор на межі |
| Транспорт | same-origin RPC; CSRF відкидає виклик без `Origin` | Для зовнішніх клієнтів — server routes + Bearer + CSRF-виняток |

**Висновок частини 1.** Основа для API — шар «ядер» (`*In(db, input)`, іменовані операції) + схеми Zod; зверху
додаються (1) HTTP-адаптер (server routes) з токенами, (2) тонкі `upsert/bulk/changed-since/by-id` операції,
(3) CLI/MCP як ще один адаптер над тими самими ядрами. Саме serverFn перевикористовувати як зовнішній контракт
не слід (документація TanStack, непублічний `/_serverFn/<id>`, CSRF, seroval).

---

## 2. Частина 2 — як платформи подають переклади в API

### 2.1. Зведена таблиця

| Платформа | Форма локалізованого поля | Окремий ресурс перекладу? | Часткове оновлення однієї локалі | Ідентифікація для інтеграцій | Bulk | Позначка застарілості |
|---|---|---|---|---|---|---|
| commercetools | `LocalizedString` = мапа `{ "de": "...", "en": "..." }` у кожному такому полі | ні | **ні**: `setDescription` приймає весь `LocalizedString`, «якщо пропущено — значення видаляється» (RAML) | `key` (юзер-визначений, унікальний) + `id`; `version` для оптимістичного блокування | Import API: upsert за `key`, ≤20 ресурсів/запит, асинхронно | немає (знайдено лише `staged` vs `current`) |
| Shopify | поле в базовому типі = мова за замовчуванням; переклади через `translatableResource` | **так**: `Translation{key,locale,market,outdated,updatedAt,value}` | **так**: `translationsRegister(resourceId, [{locale,key,value,translatableContentDigest,marketId}])` | `id`, `handle`, `customId` (метаполе) у `productSet` | `bulkOperationRunMutation` JSONL ≤100 МБ, ≤24 год | **так**: `digest` + `outdated` |
| Saleor | базові поля (мова за замовчуванням); на типах `translation(languageCode)` | так: `ProductTranslation` | так: `productTranslate(id, languageCode, input)` та `productBulkTranslate` | `id`, `externalReference` (на Product, Variant та ін.), `slug` | `productBulkCreate`, `productBulkTranslate(errorPolicy)` | немає (у схемі не знайдено) |
| Medusa v2 | модуль translation: запис `{reference_id, reference, locale_code, translations: {поле: рядок}}` | так | так (create/delete запису) | `id` | UI-bulk; REST-batch не знайдено | не знайдено |
| Akeneo PIM | `values: { name: [ {locale, scope, data} ] }` | ні (елемент масиву в значеннях) | **так**: PATCH зливає по парі `locale/scope`, `data:null` стирає | `identifier`/`uuid` | PATCH колекції, ≤100, JSON-lines ≤1 000 000 символів/рядок | немає; є completeness по локалі |
| Sylius | `translations: { en_US: { name, slug, … } }` в тілі товару (сховище — патерн B) | також є під-ресурс `/admin/products/{code}/translations/{localeCode}` | так (ключ локалі в мапі) | `code` (identifier=true), `id` не ідентифікатор | стандартні операції API Platform | не знайдено |
| Shopware 6 | у відповіді `name` (рядок для мови контексту) + `translated.name` (з успадкуванням); запис — `translations` або мапа за iso-кодом | так (асоціація) | так: за iso-кодом/language-id; формальний пріоритет | клієнтський UUID у `id` (генерується скриптом при створенні), `productNumber` | Sync API `/api/_action/sync` | немає |
| Payload (D) | `?locale=`, `locale=all` → поле як мапа | ні | не описано в прочитаній сторінці | `id` | — | — |

### 2.2. commercetools

- **Форма.** `LocalizedString` — «JSON object where the keys are of type Locale, and the values are the strings used for the corresponding language»;
  ключі — IETF BCP 47 (`en`, `en-US`, `zh-Hans-SG`); RAML-патерн ключа для рядка `^[a-z]{2}(-[A-Z]{2})?$` [підтв., GitHub RAML].
  `slug` товару — теж `LocalizedString`, унікальний у проєкті, може збігатися між локалями, патерн `[A-Za-z0-9_-]{2,256}`.
- **Локалі проєкту та фолбек.** `Project.languages` — список локалей (RAML); для `ProductProjection`: «If no translation is found on a given field for the
  specified locales, the API checks the Project languages in their configured order and uses the first localized value it finds» [підтв.].
  `localeProjection` лишає в проєкції тільки потрібні локалі.
- **Часткове оновлення.** `setDescription.description: LocalizedString — Value to set. If omitted, any existing value is removed` [підтв.]. Тобто **заміна
  всієї мапи**: два редактори різних локалей без `version` затруть один одного; commercetools вирішує це `version` на ресурсі:
  «When updating or deleting a resource, you must include the current version… ConcurrentModification» [підтв.].
- **Слаг/перейменування.** `changeSlug` «Produces the ProductSlugChanged Message» [підтв.] — подія для підписників; історії slug у прочитаному немає.
- **Ідентифікація.** `key` — «unique key identifier that you can set yourself»; Import API робить **upsert за key**: «If a resource with the given key exists, it is updated. If not, a new one is created»; ≤20 ресурсів/запит, асинхронна обробка, `ImportOperation`
  живе 48 год, невирішені посилання перепробовуються до 5 разів [підтв.]. Ліміти звичайного API: `limit` 0–500, `offset` ≤10000; для повного обходу
  радять сортувати за `id` і фільтрувати `id>` (keyset) [підтв.].
- **Пошук/фільтри з локаллю.** Для локалізованих полів настанова — Product Search API; Query ProductProjections призначено для нелокалізованих
  полів (`id`, `key`), сортування по `name.en` допускається [підтв.]. Деталей `text.{locale}` на прочитаній сторінці немає [не підтв.].
- **MCP.** `commercetools/commerce-mcp`: інструменти read/create/update (`read_products`, `update_products`, `read_product_search`…), автентифікація
  client_credentials або bearer на запит; про локалі в README нічого [підтв.].

### 2.3. Shopify

- **Модель.** Базова мова — поля самого ресурсу; переклади — окремий шар. `translatableResource(resourceId)` → `translatableContent{key,value,digest,locale}`
  + `translations(locale, marketId, outdated)`; вкладені ресурси (`nestedTranslatableResources`, напр. `ProductVariant`) [підтв.].
- **Запис.** `translationsRegister(resourceId, translations: [TranslationInput!]!)` — `locale`, `key`, `value`, `translatableContentDigest`,
  опційно `marketId`; «Each translation requires a digest value from the resource's translatable content»; scope `write_translations` [підтв.].
  Ліміту кількості в одному виклику сторінка не називає [не підтв.].
- **Застарілість.** `Translation.outdated: Boolean! — Whether the original content has changed since this translation was updated`;
  `Translation.updatedAt`; фільтр `translations(outdated: true)` [підтв.]. Тобто платформа **позначає**, а не переробляє.
- **Storefront.** `@inContext(language: ES)` (з API 2022-04): повертає переклади, лише якщо мова ввімкнена в налаштуваннях Markets для країни;
  непідтримувані значення не дають помилки — «the response will fall back to supported values»; `localization` перелічує доступні мови [підтв., пошук].
  Є повідомлення спільноти, що пошуковий `query` матчить лише мову за замовчуванням [не підтв. офіційно].
- **Ідентифікація.** `productSet(identifier: ProductSetIdentifiers{id, handle, customId})` — upsert за id/handle/кастомним унікальним метаполем [підтв.];
  для списків (`variants`, `collections`, `metafields`) — «створює нові, оновлює наявні й видаляє відсутні у вхідних» [підтв.].
- **Bulk.** `bulkOperationRunMutation` + JSONL (`stagedUploadsCreate`), будь-яка мутація крім самих bulk, ≤100 МБ, ≤24 год, ≥5 паралельних з API 2026-01;
  чи працює `translationsRegister` у bulk — сторінка не каже [не підтв.].
- **MCP.** Storefront MCP: `https://{shop}/api/mcp`; інструменти `search_catalog`, `get_product_details`, `get_cart`, `update_cart`,
  `search_shop_policies_and_faqs`. Мова — в об'єкті `context` (country, language, currency, intent) за даними пошуку (shopify.dev + UCP-спека), але
  сторінка-першоджерело про параметри мовчить і подекуди каже, що каталог/кошик-інструменти «removed» (перенесені в Catalog/UCP) —
  схема нестабільна [не підтв.; усередині UCP `context` — «provisional»]. Це підтверджує наявний висновок спеки пошуку: **схему агентного протоколу не вшивати в ядро**.

### 2.4. Saleor (GraphQL-схема з GitHub, `saleor/saleor@main`)

- На типі `Product`: `translation(languageCode: LanguageCodeEnum!): ProductTranslation` («Returns translated product fields for the given language code»);
  `ProductTranslation{ language, name, slug, description (JSON, EditorJS), seoTitle, seoDescription }` — **перекладається і `slug`**.
- Запис: `productTranslate(id, languageCode, input: TranslationInput{slug,seoTitle,seoDescription,name,description})`; масово —
  `productBulkTranslate(errorPolicy, translations:[{id | externalReference, languageCode, translationFields}])` → `count`, `results`, `errors` [підтв.].
  Права `MANAGE_TRANSLATIONS`; події вебхуків `TRANSLATION_CREATED/UPDATED`.
- `externalReference: String` — на Product (рядок схеми ~4270) і на багатьох інших типах; `productBulkTranslate` приймає `externalReference` замість id [підтв.].
- `TranslatableKinds`: ATTRIBUTE, ATTRIBUTE_VALUE, CATEGORY, COLLECTION, MENU_ITEM, PAGE, PRODUCT, PRODUCT_MEDIA, PROMOTION, PROMOTION_RULE, SALE,
  SHIPPING_METHOD, VARIANT, VOUCHER — тобто переклади довідників (значення атрибутів, способи доставки) — штатні [підтв.].
- Поля `outdated`/`digest` у схемі **не знайдено** (grep по всій схемі); механізму редиректів на старі slug у схемі теж не знайдено [не підтв. як відсутність у продукті].
- Фільтр за часом: `updatedAt: DateTimeRangeInput` у фільтрах [підтв., рядок схеми ~4502].

### 2.5. Medusa v2

- Модуль Translation (з v2.12.3, за feature-flag): `createTranslations({reference_id, reference, locale_code, translations:{title,description…}})` — **рядок на
  (сутність, локаль) з JSON-мапою полів** [підтв.]. Це «A з упакованими полями», окремий від A/B/D варіант.
- Store API: `?locale=` (пріоритетний) або `x-medusa-locale`; фолбек — «If no translations exist for the requested locale, the original content is returned»;
  переклад лише для маршрутів, що викликають `applyLocale`/`graph({locale})`; кошик/замовлення/клієнт **не** перекладаються [підтв.].
- Адмін-bulk — UI «Settings → Translations»; REST-batch для перекладів не знайдено [не підтв.]. Офіційний MCP — лише для документації, спільнотні
  MCP — для JS SDK; про локалі нічого [підтв., пошук].

### 2.6. Akeneo PIM (часто стоїть між 1С і магазином)

- `values: { attrCode: [ {locale, scope, data} ] }`; локалізований атрибут — по одному значенню на локаль (`scope: null`), скопований — на канал, обидва — на пару [підтв.].
- PATCH: «Any data in non specified properties will be left untouched»; пари `locale/scope` зливаються — відправлений `fr_FR` заміняє лише французьке,
  `en_US` лишається; стерти значення — той самий запис із `"data": null` [підтв.]. **Це найдетальніша семантика часткового оновлення однієї локалі.**
- Колекції: PATCH до 100 елементів на запит, рядок JSON-lines ≤1 000 000 символів, відповідь по рядках [підтв.: `rest-api/responses.md`]; ліміт 100 запитів/с на інстанс (`good-practices.md`).
- Фільтри: `updated` (`>`, `SINCE LAST N DAYS`…), `locales=en_US,fr_FR` для обмеження повернених локалей, `search_locale`; `IN` по ідентифікаторах ≤100 [підтв.].
- Застарілості перекладу в прочитаних сторінках немає; є completeness по локалі/каналу [підтв. як фільтр].
- Є офіційний Akeneo MCP Server (читання/зміна товарів, атрибутів, довідників; у прикладах `localeCode/localeValue`, `locale/data` — дзеркало REST) [підтв.].
- Місце в ланцюжку: PIM тримає **кілька мов і сам керує перекладами**, 1С/ERP віддає йому джерело — це і є паттерн «джерело однією мовою, переклади окремо».

### 2.7. Sylius, Shopware

- **Sylius (API Platform, конфіги в репо).** Для `Product` `identifier="true"` має поле `code`, а `id` — `identifier="false"`; `translations` —
  `readable/writable` властивість з прикладом `{en_US:{name,slug,description,shortDescription,metaKeywords,metaDescription}}`; окремий
  під-ресурс `/admin/products/{code}/translations/{localeCode}` (`ProductTranslation.locale identifier=true`). Мова відповіді шоп-API — `Accept-Language`
  (`AcceptLanguageHeaderDocumentationModifier`). Є `GetProductBySlugAction` → `301` на IRI (пошук за slug, не історія slug) [підтв.].
  **Урок:** схема за патерном B (усі тексти в `*_translation`) не заважає API з мапою локалей у тілі товару.
- **Shopware 6.** `sw-language-id` змінює мову відповіді; `name` — лише явно збережене («null, якщо мова не має власного перекладу»), `translated.name` — з
  ланцюжком успадкування (EN→DE→AT); запис — на самому полі (рядок = мова контексту), мапою за iso-кодом/language-id або в асоціації
  `translations`; ADR 2022-03-29 формалізує пріоритет: iso-код > language-id, `translations` > поле, і рекомендує iso-коди — payload переносний між системами. Для масових
  операцій — Sync API `POST /api/_action/sync` (заголовок `sw-skip-trigger-flow`); у прикладах створення товару **клієнт генерує UUID** (`uuidgen | tr -d '-'`) [підтв.].
  Поділ «збережене vs розв'язане» (`name` vs `translated.name`) — готовий шаблон для нашого API: адмінка/інтеграція бачить сховане, вітрина — розв'язане.

### 2.8. Payload (модель D для порівняння)

`?locale=xx`, `?fallback-locale=` (або `none`), `locale=all`/`*` повертає кожне локалізоване поле як мапу локаль→значення; зберігається «як об'єкт усіх локалей»
[підтв.]. Часткове оновлення однієї локалі на прочитаній сторінці не описане [не підтв.].

---

## 3. 1С / CommerceML

### 3.1. Протокол обміну з сайтом (офіційний, 1С + 1С-Бітрікс)

Джерело: https://v8.1c.ru/edi/edi_stnd/131/ [підтв.]. Ініціатор — завжди 1С. Два блоки: (1) вивантаження каталогу, залишків, цін (`type=catalog`), (2) обмін замовленнями
(`type=sale`). Кроки: `mode=checkauth` (cookie) → `mode=init` (zip, максимальний обсяг пакета) → `mode=file&filename=…` (POST файлів/частин, відповідь
`success`) → `mode=import&filename=…` (відповіді `progress`/`success`/`failure`); для замовлень `mode=query` (сайт віддає CommerceML-замовлення) і
`mode=success`. Обмін **ітеративний і з пакетами**, а не REST — тому «зовнішній API для 1С» — це, по суті, реалізація цього протоколу (адаптер), а не наш REST.

### 3.2. Схема CommerceML 2.10 (XSD; копія у `dobromyslov/commerceml-parser`, офіційну `v8.1c.ru/.../*.xsd` не отримав — 404)

- `Ид` — `ИдентификаторГлобальныйТип` = `xsd:string`, `maxLength 40`, «рекомендуется использовать GUID» — тобто **не гарантований GUID**.
- `Наименование` товару — `НаименованиеТип` = `xsd:string`, `maxLength 255`. У всій схемі **немає** атрибутів/елементів мови (grep `lang|язык|xml:` — порожньо):
  **мультимовності в CommerceML 2.10 немає** [підтв. по XSD цієї версії; офіційне формулювання стандарту не перевірено].
- Характеристики: у `Предложение` є `ИдХарактеристики` (опційно) і `ХарактеристикиТовара/ХарактеристикаТовара{Ид?, Наименование, Значение}`.
- Свойства: `Свойство{Ид, Наименование, ВариантыЗначений/Справочник{ИдЗначения, Значение}}`; групи — `Группы`; `ТипыЦен`/`ТипЦены`; `Склады`/`Склад`.
- Інкрементальність: атрибут `СодержитТолькоИзменения` (каталог/пакет предложений) та `ДатаФормирования` кореня [підтв.].
- Приклад `Ид` з офіційної сторінки: `f8c9ef49-47e1-11e5-8073-74d02b7dfd8c` (версія 1, варіант 8) і `33fc4cb7-9333-45bc-863f-9f7274af7a22` (версія 4) — **обидва проходять `z.uuid()`**.
  Але вибірка з двох GUID не доводить, що **усі** GUID 1С відповідають RFC-варіанту; пустий `00000000-…` Zod приймає окремо. Перевіряти на реальній базі пілота [не підтв.].

### 3.3. Складений `Ид` пропозиції

За обговоренням на Infostart: «Ид с # — это номенклатура+характеристика» — у `offers.xml` `Ид` пропозиції може бути `<guid товару>#<guid характеристики>` (73 символи > 40 з XSD, тобто практика
виходить за схему) [підтв. як практика (форум), не як частина стандарту]. Тому для `product_modifications` GUID 1С **не** тотожний `id`
автоматично: або `id = ИдХарактеристики` (прийнятно, лише якщо характеристика належить конкретній номенклатурі, а не виду номенклатури й GUID унікальний; предметні
знання 1С — [не підтв.]), або детермінований UUID v5 від рядка `товар#характеристика` (проходить `z.uuid()`, але вже не «ідентичний» GUID 1С). Це **єдине місце**, де правило власника
«GUID 1С = id» потребує окремого рішення.

### 3.4. Як готові модулі зберігають зовнішні id і переклади

- **OpenCart (ocStore, форк exchange1c v1.6 для oc2.3).** Окремі мапінгові таблиці `product_to_1c(product_id, guid)`, `category_to_1c`, `attribute_to_1c_category`… (код модуля);
  режим синхронізації: товар вважається новим, якщо не знайдений за `Ид (GUID)` або `Артикул (SKU)`. **Мова**: усі записи йдуть у `*_description` із
  `language_id = getLanguageId(config('config_language'))` — тобто **обмін заповнює лише одну (основну) мову**, інші заповнюють вручну (рядки ~1304-1420 `admin/model/extension/exchange1c.php`) [підтв., GitHub].
- **WooCommerce (`sgtpep/woocommerce-1c`).** GUID — у `postmeta` ключ `_wc1c_guid`; пошук `wc1c_post_id_by_meta('_wc1c_guid', $guid)`; той самий ключ і на замовленнях
  (`update_post_meta($order, '_wc1c_guid', $document['Ид'])`) [підтв., GitHub]. Мультимовності (WPML/Polylang) модуль не стосується — не знайдено.
- **1С-Бітрікс.** Протокол розроблено спільно 1С і 1С-Бітрікс (v8.1c.ru/edi/edi_stnd/131). Що GUID лежить у `XML_ID` елемента інфоблоку — [не підтв. першоджерелом]; внутрішній документ `docs/tasks/seo-ssr-faceted-navigation.md:65` лише згадує, що значення властивості у ЧПУ-фільтрі — `XML_ID` (з 1С — UUID).

Висновок: **усі** поширені модулі мають зовнішній ключ окремо (мапінг-таблиця або мета), бо їхня PK — автоінкремент; у нас id задає викликач, і мапінг не потрібен — рішення власника
«GUID = id» знімає цілий клас помилок розсинхрону (`product_to_1c` без запису → дубль товару). І **усі** модулі обміну заповнюють одну мову — це підтверджує вимогу «завантаження однією мовою».

### 3.5. Як 1С нашої схеми «бачить»

| Сутність CommerceML | Наша таблиця | Ключ 1С → id | Зауваження |
|---|---|---|---|
| Товар `Ид` | `products` | GUID = `products.id` | `slug` обов'язковий, унікальний, формат `SLUG_RE` — 1С його не знає, його має генерувати імпорт-адаптер |
| Група | `sections` | GUID = `sections.id` | `parent_id` самопосилання; slug унікальний глобально |
| Характеристика/пропозиція | `product_modifications` | див. §3.3 | `unique (product_id, slug)`; slug обов'язковий |
| Свойство | `section_properties` | GUID = `id` | прив'язка до розділу через `section_property_assignments` |
| Значення довідника свойства | `property_options` | `ИдЗначения` = `id` | `unique(property_id, slug)` |
| ТипЦены | `price_types` | GUID = `id` | є унікальний `code` |
| Цена/Остаток | `product_prices`, `stock_by_pickup_point` | немає власного GUID у 1С | натуральний ключ: унікальні індекси є (`schema.ts:894`, `:581-583`) → upsert за `(price_type, product, modification)` / `(pickup_point, product|modification)` |
| Склад | `pickup_points` | GUID = `id` | лише точки видачі; складської сутності окремо немає |
| Контрагент | `profiles` | GUID = `profiles.id` можливий, **але** `profiles.user_id NOT NULL` (`schema.ts`, таблиця `profiles` з рядка 608) → потрібен рядок `users` Better Auth з `DEFAULT gen_random_uuid()` | контрагент без входу в систему створити не можна — продуктове питання |
| Документ-замовлення | `orders` | `orders.id` = `randomUUID()` сайту (`order-create.ts:49`), 1С отримує його як `Ид` документа — **напрямок сайт→1С працює вже зараз** | `orders.user_id` nullable (гість) |
| Статус | `order_statuses` | зіставлення по `code` (унікальний), не по GUID | відповідає принципу власника «довідник, не вільний текст» |
| Способи доставки | `shipping_methods` | `code` | — |

---

## 4. Одномовне джерело + окремі переклади (вимога власника №5)

**Як це виглядає в індустрії.**

- **Shopify** — канонічний приклад. Джерело — базові поля ресурсу (одна мова). Переклади — окремі записи `Translation`, кожен прив'язаний до `digest` оригінального значення
  (хеш поля, віддається в `translatableContent`) [підтв.]. Запис без актуального digest неможливий («Each translation requires a digest value…»), а коли оригінал змінюється,
  `Translation.outdated` стає `true` — платформа лише **позначає** (запит `translations(outdated: true)` повертає чергу на переробку) [підтв.]. Той, хто перекладає (людина,
  застосунок-перекладач, плагін), сам вирішує, переробляти чи підтвердити без змін (повторний `translationsRegister` з новим digest знімає позначку). Скільки застосунків
  автоматично перекладають за подіями — поза прочитаним [не підтв.].
- **Akeneo** — 1С/ERP віддає атрибути у PIM однією мовою (або кількома), решту локалей ведуть редактори/сервіси. PATCH по парі `locale/scope` не чіпає інші локалі; позначки
  застарілості в прочитаному немає, є completeness по локалі [підтв.].
- **commercetools** — `LocalizedString` оновлюється **цілком** (`setDescription` без `description` видаляє значення), окремого «переклад-застарів» немає; зміни
  іншої локалі при цьому не відрізнити від зміни тієї самої без `version`-контролю. Імпорт-API (`key`-upsert) приймає `LocalizedString` у чернетці, тож «одна мова» = мапа з однією
  ключовою локаллю; решту доповнюють іншим викликом, але **стирає** якщо передати мапу без них [висновок з RAML, прямо не описано в прочитаній сторінці імпорту].
- **Saleor** — базові поля + `productBulkTranslate` (адресація `id` або `externalReference`); `outdated`/digest у схемі немає [підтв. grep]. Застарілість треба вести самим (вебхук
  `PRODUCT_UPDATED` → ваш сервіс).
- **OpenCart-модулі 1С** — пишуть лише в мову за замовчуванням (§3.4).

**Що з цього випливає для SimplyCMS.**

1. Імпорт/API пише лише базову мову: у моделі A це «пиши базові колонки і не чіпай `*_translations`»; у B — «пиши рядок `locale = default`»; у D — «пиши ключ `default` у мапі,
   не перезаписуй решту» (потрібен `jsonb ||`, а не заміна колонки).
2. Щоб відрізнити «переклад актуальний» від «оригінал змінився», кожному запису перекладу потрібен **знімок оригіналу, з яким він узгоджений**: або хеш (Shopify `digest`), або мітка часу
   `source_updated_at`. Найпростіше — колонка в таблиці перекладів `source_hash` (на рядок) чи `…_hash` на поле. У A/B це природне місце (рядок перекладу має свої колонки й свій `updated_at`);
   у D метадані довелося б класти всередину JSON (`{uk:{v,h}}`) або в окрему таблицю — тобто D перестає бути «простою мапою».
3. Позначку «застарілий» краще **обчислювати** (порівняння `source_hash` перекладу з хешем поточного оригіналу), а не ставити прапор тригером: тоді її не можна забути, і переробка
   плагіном-перекладачем читає чергу запитом. Шопіфай зберігає прапор, але поводиться еквівалентно (digest). Це рішення архітектора; обидва варіанти адитивні.
4. Хто оновлює: платформа лише відображає (бейдж у адмінці, фільтр «застарілі»); автоматичний переклад — функція плагіна, що читає чергу й пише переклади тим самим API. Так
   «окреме рішення в магазині» (вимога власника) стає клієнтом того самого API, що й 1С — вимога №8 про цілісність.
5. Інваріант «мова за замовчуванням завжди присутня»: A дає його безкоштовно (NOT NULL базові колонки); B і D потребують окремого механізму (CHECK/тригер/конвенція, що рядок
   дефолтної мови створюється атомарно з сутністю) — інакше завантаження «однією мовою» без дефолтної локалі лишає порожню сутність.

---

## 5. Команда перейменування по API (вимога власника №6)

### 5.1. Практика платформ

| Питання | Shopify | Saleor | commercetools | Sylius | SimplyCMS зараз |
|---|---|---|---|---|---|
| Перекладам після зміни оригіналу | `outdated: true` (позначка, переклад збережений) [підтв.] | перекладів не чіпає, позначки немає [підтв. grep схеми] | не чіпає; нема позначки [не підтв. повністю] | не знайдено | не застосовно (перекладів ще немає) |
| Slug/handle | `productUpdate.redirectNewHandle` — «If true, the old handle is redirected to the new one automatically» [підтв.]; окремо `urlRedirectCreate`; у UI галочка «Create a URL redirect» | `slug` — поле, перекладається окремо; історії/редиректів у схемі не знайдено | `changeSlug` породжує `ProductSlugChanged` Message (подія для підписників); історії не знайдено | `GetProductBySlugAction` → 301 на IRI (пошук за поточним slug); історії не знайдено | немає історії; 301 лише для нормалізації сегмента розділу (`domain/product-path.ts:46-52`), невідомий slug = 404 |
| Пошуковий індекс | не підтв. | вебхук `PRODUCT_UPDATED` → зовнішній індексатор [підтв. наявність події] | Messages/подія | — | спека пошуку (`2026-08-25-storefront-search-design.md`): ключ `(entity_type, entity_id, locale)` — перебудова документа за id; реалізації ще нема |
| Знімки в замовленнях | вже оформлені позиції зберігають `title` знімком (загальновідомо, не перевірено) [не підтв.] | — | line items мають знімок (загальновідомо) [не підтв.] | — | **є**: `order_items.name`, `discount_data`, `shipping_data` — знімки мовою моменту (`schema.ts:232`, `10-name-matching-sweep.md` п.14) |

Запозичена Shopify-ом ідея важлива: **редирект — явна опція операції перейменування, а не побічний ефект**. Це зручно для API (1С може підтверджувати зміну назви без зміни slug), і небезпечно за
замовчуванням у масовому імпорті (Matrixify-кейс: у bulk-імпорті редиректи довелося генерувати окремо — [не підтв., сторонній застосунок]).

### 5.2. Що це означає для вибору моделі

1. **Назва та slug — різні події.** Перейменування назви (`name`, тексти) не повинно автоматично змінювати slug — інакше кожне виправлення опечатки в 1С ламає URL. У CommerceML slug
   взагалі відсутній (тільки `Наименование`), тож його створює адаптер **один раз** (при створенні) і далі не чіпає. Зміна slug — окрема операція (`changeSlug`-подібна) з опцією `redirect=true`.
2. **Історія slug** — таблиця `slug_redirects(locale, old_slug, entity_type, entity_id, created_at)` з унікальністю `(entity_type, locale, old_slug)`; вона нейтральна до A/B/D, але в B/D локалізований
   slug робить ключем `(locale, slug)` — отже історія природно «по локалі». Адитивна (нова таблиця + 301-гілка в роуті), **не потрібна до заморозки**.
3. **Колізії slug** між перекладеним slug товару A і базовим slug товару B вже розібрано у `00-draft-pattern-A.md §4.1`; для API це означає, що валідація унікальності slug мусить бути
   єдиною серверною (не лише `unique` констрейнт), і її помилка — типізована (409 `slug_taken`).
4. **Пошуковий індекс**: перейменування = подія «перебудувати документ(и) сутності»; ключ `(entity_type, entity_id, locale)` дозволяє перебудувати лише змінені локалі. Для A/B/D це однаково, якщо
   зміна проходить через єдину точку запису (ядро), а не прямим SQL — аргумент проти «імпорт прямим SQL повз ядро».
5. **Знімки замовлень** вже стійкі до перейменування (§5.1). Листи з `mail_outbox` — відрендеровані на момент постановки.
6. **Переклади після перейменування оригіналу**: у A/B кожен переклад — свій рядок з `source_hash` → хеш оригіналу змінився → переклад «застарілий», текст зберігається (§4). Не перевиконувати
   автоматично: автоматичний переклад — функція плагіна, не ядра, і не повинна відбуватись на кожну правку.
7. **Атомарність**: «перейменувати товар + оновити slug + додати редирект + позначити переклади» — одна транзакція в іменованій операції (за прецедентом `saveProductPrices`/`saveStock`, `lock → guard → запис`).

---

## 6. Ідентифікатори: перевірка «GUID 1С = id» (вимога власника №4)

### 6.1. Які таблиці мають `id`, що задає викликач

Усі доменні таблиці `schema.ts` (37 `pgTable` без Better Auth) мають `id: uuid().primaryKey().notNull()` **без** `DEFAULT` [з коду, awk по `schema.ts`; рядок `id:` кожної таблиці], а чинний
контракт — `docs/architecture/data-layer.md §5` і `schema/README.md:12-18`: у 41 таблиці «Категорії A» дефолту немає, пропущений id дає `23502`, гейт `explicit-ids.test.ts` дискаверить усі INSERT. Виняток —
чотири таблиці Better Auth (`users`, `sessions`, `accounts`, `verifications`) з `DEFAULT gen_random_uuid()` (`0001_init.sql:551-593`).

Для сутностей, що синхронізуються з обліковою системою:

| Сутність | Таблиця | `id` від викликача? | Складний ключ/зауваження |
|---|---|---|---|
| Товар | `products` | так | `slug` unique (`schema.ts:421`); `sku` **не** унікальний (`:401`) — Артикул 1С теж не гарантовано унікальний, що правильно |
| Модифікація | `product_modifications` | так | `unique(product_id, slug)`, `idx_..._single_default`; див. §3.3 про складний `Ид` |
| Розділ | `sections` | так | `unique(slug)` глобально |
| Властивість | `section_properties` | так | `unique(slug)`, `section_id` nullable |
| Значення довідника | `property_options` | так | `unique(property_id, slug)` |
| Значення властивості товару | `product_property_values` | так | `unique(product, property, option) NULLS NOT DISTINCT` — натуральний ключ |
| Вид ціни | `price_types` | так | `unique(code)` |
| Ціна | `product_prices` | так (але в 1С свого GUID немає) | натуральний ключ `(price_type_id, product_id, COALESCE(modification_id, 0000…))` — **вираз**, не колонка: `ON CONFLICT` має повторювати вираз |
| Залишок | `stock_by_pickup_point` | так (у 1С свого GUID немає) | два часткових унікальних індекси; `ON CONFLICT` потребує вказати предикат індексу |
| Склад/точка | `pickup_points` | так | — |
| Покупець | `profiles` | так, але `user_id NOT NULL` → вимагає `users` (БД-дефолт id) | див. §3.5 |
| Замовлення | `orders` | так (`randomUUID()` в `order-create.ts:49`) | `user_id` nullable |
| Статус | `order_statuses` | так | зіставлення по `code` |
| Спосіб доставки | `shipping_methods` | так | `unique(code)` |
| Мови | `languages` | так | `unique(code)` |

Складених PK без власного `id` в доменній схемі **немає** (перевірено: жодного `primaryKey({columns:…})` у `schema.ts` для доменних таблиць); природні ключі — `UNIQUE`-індекси при `id`-PK.
Таблиці перекладів (`<entity>_translations(entity_id, locale)`) були б **першими** без `id`.

### 6.2. Що потрібно, щоб API приймав id від клієнта (upsert за id)

1. **Валідація формату.** `id: z.uuid()` (`resource-schemas.ts:105,118,122`; `columns-to-zod.ts:79`) — Zod 4.6.5 `uuid()` відкидає все, крім `[1-8]` у позиції версії та `[89abAB]` у позиції
   варіанту (плюс nil/max) [підтв.: `node_modules/zod/v4/core/regexes.js:23-29`, документація Zod]. Postgres-тип `uuid` приймає будь-які 32 hex. Рішення: на межі **зовнішнього** API валідувати `z.guid()`
   (формат 8-4-4-4-12, [підтв.]) і нормалізувати до нижнього регістру; фабрику адмінки лишити на `z.uuid()` (клієнт адмінки генерує `crypto.randomUUID()`). Приймати також «без дефіса» (Shopware-стиль,
   32 hex) — на межі, з нормалізацією. GUID 1С у верхньому регістрі — нормалізація обов'язкова, інакше `eq` по рядку/кешу розійдеться.
2. **Семантика upsert.** Зараз: `insert` на існуючий id → 23505 → `AdminConflictError` 409; `update` неіснуючого → `Error('рядка … не існує')` (не 404). Потрібна операція
   `upsertIn(db, rows)` = `INSERT … ON CONFLICT (id) DO UPDATE SET <лише передані колонки>, updated_at = now()`; поведінка «передані vs відсутні поля» — як у Shopify `productSet`/Akeneo (відсутні не чіпати)
   — зафіксувати контрактом. Для даних зі списків (`images`, `buttons`) потрібне явне правило «заміна цілком».
3. **Ідемпотентність.** upsert за GUID сам по собі ідемпотентний (повтор — no-op за змістом). Для операцій без природного ключа (створення замовлення з API, відправка листа) — `Idempotency-Key`
   + таблиця ключів з унікальним `(token_id, key)` і збереженою відповіддю (адитивно).
4. **Конфлікти.** Другий унікальний ключ (slug, code, натуральний ключ ціни) при upsert за id: `ON CONFLICT (id)` не ловить конфлікт slug — він піде як 23505 на **іншому** індексі →
   409 `unique`. Сутність з тим самим slug, але іншим GUID — типова ситуація (товар перестворений у 1С під новим GUID): API має віддавати типізовану помилку з назвою поля.
5. **Порядок залежностей.** FK (`section_id`, `property_id`, `price_type_id`): 1С шле групи/свойства/види цін перед товарами; пакет обробляти в порядку залежностей або в одній транзакції з
   відкладеними перевірками (FK `NOT DEFERRABLE` за замовчуванням — з'ясувати) [не перевірено].
6. **Пакети.** Ліміт 100 (`resource-schemas.ts:117-123`) і `updateResourceRows` у циклі — для імпорту десятків тисяч позицій потрібен окремий set-based шлях (`INSERT … SELECT FROM unnest(...)`) і
   чанкування 1С-адаптером; для порівняння: commercetools Import API — 20/запит, Akeneo — 100, Shopify bulk — 100 МБ JSONL, Shopware Sync — пакетний ендпоінт.

### 6.3. Таблиці перекладів `(entity_id, locale)` без власного `id`

- **Для API/синхронізації достатньо**: природний ключ `(entity_id, locale)` ідентифікує переклад однозначно, upsert — `ON CONFLICT (entity_id, locale)` (так робить Saleor: `id | externalReference` + `languageCode`;
  Shopify: `resourceId` + `locale` + `key`; Medusa: `reference_id` + `locale_code`). Власний `id` перекладу потрібен лише зовнішнім клієнтам, які хочуть адресувати переклад як окремий ресурс — жодна з
  прочитаних платформ цього від 1С не вимагає (1С GUID для перекладу взагалі не існує, CommerceML мови не знає).
- **Але ламає внутрішню конвенцію**: `defineAdminResource` жорстко прив'язана до колонки `id` (`resource-write.ts:28` `idColumn`, `update` за `eq(id)`, `removeSchema {id}`, `rowSchema.id`), колекція TanStack DB —
  `getKey: row.id`, гейт `explicit-ids` та парність `ENTITY` вважають таблицю «Категорії A». Тому для таблиць перекладів реалістичні два шляхи: (i) **іменована операція «зберегти переклади сутності»**
  (як `saveProductPrices`: атомарна заміна набору рядків сутності; фабрика не потрібна), (ii) surrogate `id` + `UNIQUE (entity_id, locale)` (повний збіг з конвенцією, але ключ-дублікат і
  потенційний розсинхрон: два ключі однієї сутності). Рекомендація дослідника: (i) — API лишається «переклад як вкладений набір сутності», без нового виду ресурсів у фабриці; питання конвенції
  `id` скрізь — рішення архітектора.
- **Каскад і порядок**: `ON DELETE CASCADE` від сутності; `ON CONFLICT (entity_id, locale)` потребує саме PK/UNIQUE на цій парі.

---

## 7. MCP / агентні інтерфейси

| Система | Що надає | Як подає локалізований контент | Джерело |
|---|---|---|---|
| Shopify Storefront MCP | `search_catalog`, `get_product_details`, `get_cart`, `update_cart`, політики; `https://{shop}/api/mcp` | через `context` (country/language/currency/intent) у запиті; схема нестабільна («search_shop_catalog» → «search_catalog», частина інструментів «removed») | shopify.dev, UCP spec [не підтв. деталі] |
| commercetools MCP | read/create/update ресурсів, окремо `read_product_search` | у README про локалі нічого | GitHub README [підтв.] |
| Akeneo MCP | читання/зміна товарів, атрибутів, довідників; `locale` вказується в значеннях | дзеркало REST: `{locale, scope, data}` | `pim-api-docs/content/mcp` [підтв.] |
| Saleor MCP | офіційний, **лише читання**, `mcp.saleor.app` | не відомо [не підтв.] | пошук |
| Medusa | офіційний MCP — лише для документації (Cloud); спільнотні — SDK | не відомо | пошук |
| Sylius | не знайдено | — | пошук |

Спостереження: агентний інтерфейс просто дзеркалить REST/GraphQL-форму платформи і додає `locale` як параметр запиту або частину контексту; жодна система не вигадує окремого представлення. Для SimplyCMS
висновок збігається з §11 спеки пошуку: **адаптер MCP тонкий і окремий від ядра**, а ядро має віддавати «розв'язане» (`translated`) і «збережене» (як Shopware `name`/`translated.name`) представлення.

---

## 8. Частина 3 — як моделі A/B/D/A′ лягають на сценарії

Умовні позначення: ◎ природно / нейтрально; ○ можливо, але з додатковою роботою; ✕ незручність або N+1 / ризик.

| Сценарій | A (база + `*_translations`) | B (усе в `*_translations`) | D (JSONB-мапа) | A′ (гібрид) |
|---|---|---|---|---|
| (1) API «мапа локалей в полі» (`name:{uk,en}`) | ○ збирається в завантажувачі: базова колонка + агрегат рядків перекладу (`jsonb_object_agg`) — **один** додатковий join/підзапит на список, не N+1, якщо будується в SQL | ○ те саме; дефолт теж у рядку перекладу (Sylius робить саме так) | ◎ колонка вже мапа; `?locale=` — `->>` або `->`; віддача всіх локалей безкоштовна | ○ залежить від того, що в гібриді |
| (2) «переклад як окремий ресурс» (Shopify/Saleor/Medusa) | ◎ рядок = ресурс; `source_hash`, `updated_at`, права окремо | ◎ те саме | ✕ «ресурс» — ключ у JSON; метадані (хеш, час, автор) нікуди покласти без вкладеної структури або сателітної таблиці | ◎ |
| (3) Bulk-upsert з 1С, часткові переклади | ◎ 1С пише лише базові колонки (одна мова); переклади — окремий потік `ON CONFLICT (entity_id, locale)`; потоки не перетинаються | ○ 1С пише рядок `default`; інваріант «дефолтна локаль існує» потребує механізму | ○ `UPDATE … SET name = name || jsonb_build_object($lang,$v)`: працює, але читання-модифікація-запис по всьому полю; без версії конкурентні записи різних потоків губляться (`||` на рівні ключа вирішує, заміна колонки — ні) | ◎ |
| (4) Зовнішні id | нейтрально: `id` сутності = GUID; для перекладу `(entity_id, locale)` | нейтрально | нейтрально | нейтрально |
| (5) Агентний MCP/CLI | ◎ інструменти `set_translation(entity,locale,fields)`, `list_outdated(locale)` — рядкові операції; відповіді малі | ◎ те саме | ○ агент мусить читати/писати всю мапу; більший ризик перезапису | ◎ |
| Конкурентні правки різних локалей | ◎ різні рядки — без конфлікту | ◎ | ✕ потрібен `||` по ключу або `version`; commercetools вирішує це `version` на всьому ресурсі | ◎ |
| «Застарілість» перекладу | ◎ колонка `source_hash` на рядок | ◎ | ✕ метадані в JSON | ◎ |
| Інваріант «дефолтна мова є» | ◎ `NOT NULL` базових колонок | ✕ потрібен тригер/конвенція | ✕ CHECK на ключ | ◎ |
| Пошук/сортування по локалі | ○ join + COALESCE (або матеріалізація в пошуковий документ `(entity,id,locale)`) | ○ join | ○ вирази/generated columns на локаль; індекс на локаль = DDL при новій мові | ○ |
| Нова мова | ◎ нові рядки | ◎ | ◎ нові ключі | ◎ |
| Міграція з поточної схеми | ◎ адитивно | ✕ перенесення колонок (міграція даних) | ✕ text→jsonb переписує таблицю | залежить |
| Відповідність конвенції `id` скрізь | ○ нові таблиці без `id` (§6.3) | ○ те саме | ◎ жодних нових таблиць | ○ |

**Де модель БД змушує API до незручностей.**

- **D** — основний носій незручностей для «переклад як ресурс» і для «застарілості»: метаданих на рівні локалі немає. Також `locale=all` дешевий, але повний PATCH одного ключа потребує
  гарантованого `||`, який фабрика (`updateResourceRows` — `SET col = $value`) не вміє: пішов би окремий шлях.
- **B** — для API нейтральна (Sylius доводить), але вимагає «рядок дефолтної мови завжди існує» і зміщує вимогу власника №5: завантаження «однією мовою» стає «одним рядком перекладу».
- **A** — найкраще лягає на «джерело однією мовою + переклади окремо»: розділення на рівні таблиць збігається з розділенням на рівні потоків (1С пише базу, плагін-перекладач — переклади), що
  відповідає Shopify/Saleor/Medusa. Ціна: список із усіма локалями потребує агрегації; N+1 виникає лише якщо збирати мапу в JS, а не в SQL.
- **N+1** взагалі: ризик у загальному випадку — не модель, а місце збирання. У будь-якій моделі завантажувач вітрини/API має брати переклади тим самим запитом (join/lateral/агрегат) з
  фільтром видимості; тримати це правилом шару `*In`/лоадерів, а не «кожен виклик сам».
- **Пошук**: спека пошуку вже будується від `(entity_type, entity_id, locale)`; модель БД майже не впливає на швидкість пошуку, бо він ходить в окремий індекс. Це знімає тиск «моментальний пошук різними
  мовами» з вибору A/B/D (твердження — з спеки; бенчмарки пошуку тут не вимірювались).

**Окремо про форму API.** Рекомендована форма зовнішнього контракту, нейтральна до сховища (за Sylius/Shopware): читання — `?locale=xx` повертає **розв'язане** значення + `translated`-прапорець (або
`?locale=all` — мапа локаль→значення збереженого); запис — `PATCH` з `translations: { en: {name:…} }` (часткове злиття по парі локаль/поле, `null` стирає — семантика Akeneo) і окрема
вкладена ручка `PUT /products/{id}/translations/{locale}`. Така форма однаково відображається на A/B/D (A/B: upsert рядка; D: `jsonb ||`).

---

## 9. Що закласти ЗАРАЗ (до заморозки схеми) і що можна додати пізніше

### 9.1. Потрібно до заморозки, бо потім дорого

Чесно: **дуже мало.** Усе нижче адитивне на рівні DDL; «дорого» означає, що змінюється контракт коду або перебудова вже наявних даних.

1. **Форма ключа таблиць перекладів** (§6.3). Це не міграція, а рішення про конвенцію (`id` скрізь vs природний ключ для залежних таблиць) — кожна нова таблиця ядра й плагінів (`plg_*_translations`) успадкує
   його, а гейт `explicit-ids`, `ENTITY`-парність, фабрика й колекції TanStack DB мають бути вирішені один раз. Змінювати конвенцію після того, як плагіни почнуть її копіювати, дорожче.
2. **Рішення «id = GUID 1С» для модифікацій** (§3.3): якщо правило `id = ИдХарактеристики` не годиться для реальної бази, потрібен інший механізм (UUID v5). Дані ще не створені — зараз дешево,
   після пілоту id стануть частиною зовнішніх посилань.
3. **Мова/ключ `slug` у переклади** (розгляд — `00-draft-pattern-A.md §4.1`): унікальність slug між базою й перекладами — це не DDL-дрібниця, а інваріант, що міняє ключі URL; після публікації
   адрес із SEO виправляти дорого (301 і історія slug пом'якшують).
4. **Джерело мови за замовчуванням** (`languages.is_default` vs `VITE_LOCALE`, `00-draft-pattern-A.md §4.3`): для API це параметр «яку мову вважати базовою при записі без `locale`». Якщо два джерела —
   інтеграція отримає неоднозначність.

### 9.2. Можна додати адитивно пізніше (нова міграція, без переробки даних)

| Пункт | Чому адитивно | Нюанс |
|---|---|---|
| `external_id`/`source` | **не потрібні** за рішенням власника (GUID = id) | якщо з'явиться другий облік із власними ключами — тоді таблиця відповідності `entity_external_refs(entity_type, entity_id, source, ref)` (нова таблиця) |
| `updated_at` на таблицях, де його ще немає | `ADD COLUMN … DEFAULT now() NOT NULL` — метаданий DDL у PG 11+; старі рядки отримають час міграції | немає на: `property_options`, `section_properties`, `section_property_assignments`, `product_property_values`, `modification_property_values`, `pickup_points`, `price_types`, `shipping_rates`, `shipping_zones`, `order_items`, `order_statuses`, `user_categories`, `user_addresses`, `category_rules` (таблиця по `schema.ts`). Для інкрементальної синхронізації з 1С важливі перші п'ять і `price_types`. Штампування — тригер (`touch` у фабриці не покриває прямий SQL/імпорт-шлях) |
| `version int` для оптимістичного блокування | нова колонка `DEFAULT 1` + `UPDATE … WHERE version = $v` | `updated_at` як ETag ненадійний (мс у `Date` vs µs у `timestamptz`) — [припущення, не вимірювано]; commercetools використовує `version` у тілі, не ETag-заголовок [підтв.] |
| Soft-delete / tombstones | журнал `deleted_entities(entity, id, deleted_at)` через тригер `AFTER DELETE` — для «що видалено з часу X» (Akeneo/CT це вирішують фільтром `updated`+видаленнями окремо) | `is_active` уже є на товарах/розділах і відповідає `Статус=Удален` 1С; справжній `deleted_at` змінив би всі `WHERE is_active` лоадерів і часткові унікальні індекси — дорожче, тому тільки журнал |
| Історія slug/редиректи | нова таблиця (§5.2) | потребує гілки 301 у роуті |
| `source_hash`/`translated_from` у таблицях перекладів | колонки нових таблиць | рішення про «застарілість» (§4) — заздалегідь закласти в схему *нових* таблиць перекладів, а не додавати згодом |
| Ідемпотентність (`idempotency_keys`) | нова таблиця | — |
| Токени інтеграцій (`api_tokens`) | нова таблиця + гілка в `resolveRequestGrant` | рішення про `@better-auth/api-key` проти власної таблиці — власнику; CSRF-виняток — зміна ядра |
| Вебхуки вихідні | нові таблиці `webhook_endpoints`, `webhook_deliveries` (+ outbox за зразком `mail_outbox`) | поточні вебхуки лише вхідні (платежі) |
| Keyset-пагінація | код, не схема; потрібні індекси `(updated_at, id)` на синхронізованих таблицях | індекси — адитивні |
| `orders.locale` | описано у `00-draft-pattern-A.md §4.4` | бекфіл точний лише поки мова магазину не змінювалась |

### 9.3. Рекомендований мінімум шару API (поза схемою)

Один раз, у ядрі: `upsertIn(db, entity, rows)` (set-based, за `id` або натуральним ключем, часткові поля), `changedSince(entity, cursor)` (keyset по `(updated_at,id)`), типізована
помилка `NotFound`/`SlugTaken`/`Stale`, адаптер HTTP (`/api/v1/*`, Bearer, `Idempotency-Key`, CSRF-виняток), адаптер CommerceML (checkauth/init/file/import/query/success) — як окремий пакет/плагін
над тими самими ядрами; CLI/MCP — ще один адаптер. Це відповідає «ядро не знає про протокол» зі спеки пошуку §11 і вимозі власника №8.

---

## 10. Недоведене / відкриті питання власнику

1. Чи всі GUID реальної бази 1С проходять `z.uuid()` (версія 1–8, варіант 8–b)? Зразки з офіційної сторінки проходять, вибірка мала. Рішення: на межі API `z.guid()` + нормалізація; перевірити на тестовій базі пілота.
2. Модифікації: `id = ИдХарактеристики` чи складений `товар#характеристика` → UUID v5? Потрібна перевірка структури реальної номенклатури (характеристики видів номенклатури).
3. Контрагенти без входу (B2B): чи потрібні у `profiles` записи без `users`? Зараз `profiles.user_id NOT NULL`.
4. Токени інтеграцій: `@better-auth/api-key` (відступ від «нуль плагінів BA») чи власна таблиця; scope-модель (за операціями `AUTHZ_MATRIX`).
5. CSRF-виняток для зовнішнього префікса — свідоме рішення в ядрі (`CSRF_EXEMPT_PREFIXES`).
6. Конвенція ключа для таблиць перекладів (§6.3) — до першого коду перекладів.
7. Не перевірено в цьому дослідженні: DEFERRABLE FK для порядку завантаження; втрата µs у `Date`; реальний вигляд `offers.xml` з Ид «#» на живій базі; поведінка OpenCart-модуля з кількома мовами у новіших версіях; чи є у Sylius історія slug (не знайдено, але не доведено відсутність); офіційне формулювання мультимовності в стандарті CommerceML (перевірено лише XSD 2.10).

---

## 11. Джерела

**Код і документи SimplyCMS (знімок `cd2d18d5`):** `packages/simplycms/src/admin-server/{index.ts,impl/run.ts,impl/resource.ts,impl/resource-schemas.ts,impl/resource-write.ts,impl/resource-write-ops.ts,impl/subset-schema.ts,impl/validation.ts,impl/errors.ts,impl/core-actor.ts}`,
`src/auth/{authz.ts,authz-request.ts,session.ts,instance.ts}`, `src/runtime/csrf.ts`, `src/contracts/{entities.ts,ports/index.ts}`, `src/plugin-sdk/server/index.ts`, `src/schema/{schema.ts,README.md}`, `src/domain/product-path.ts`,
`docs/architecture/{data-layer.md §5,§6, rendering-and-routing.md,plugins.md}`, `docs/superpowers/specs/{2026-08-19-backend-contract-v2-design.md,2026-08-25-storefront-search-design.md,2026-10-12-shop-agent-toolkit-design.md,2026-10-06-commerce-providers-design.md}`,
`docs/superpowers/research/2026-10-13-multilingual/{00-draft-pattern-A.md,01-owner-requirements.md,10-name-matching-sweep.md}`.

**commercetools:** https://docs.commercetools.com/api/types (LocalizedString) · https://docs.commercetools.com/api/general-concepts (key, version, limit/offset, Import API) ·
https://docs.commercetools.com/api/projects/productProjections (localeProjection, фолбек) · https://docs.commercetools.com/import-export/overview (Import API) ·
RAML на GitHub: https://github.com/commercetools/commercetools-api-reference/blob/main/api-specs/api/types/common/LocalizedString.raml, `.../common/Locale.raml`, `.../product/updates/ProductSetDescriptionAction.raml`, `.../product/updates/ProductChangeSlugAction.raml`, `.../product/ProductData.raml`, `.../project/updates/ProjectChangeLanguagesAction.raml` ·
MCP: https://github.com/commercetools/commerce-mcp

**Shopify:** https://shopify.dev/docs/api/admin-graphql/latest/mutations/translationsRegister · .../objects/Translation · .../queries/translatableResource · .../queries/translatableResources · .../mutations/productSet · .../input-objects/ProductSetIdentifiers ·
.../input-objects/ProductUpdateInput (`redirectNewHandle`) · .../mutations/urlRedirectCreate · https://shopify.dev/docs/api/usage/bulk-operations/imports ·
https://shopify.dev/changelog/storefront-api-incontext-directive-supports-languages (через пошук) · https://shopify.dev/docs/apps/build/storefront-mcp/servers/storefront · https://ucp.dev/draft/specification/catalog/mcp/

**Saleor:** https://github.com/saleor/saleor/blob/main/saleor/graphql/schema.graphql (`ProductTranslation`, `productTranslate`, `productBulkTranslate`, `ProductBulkTranslateInput`, `TranslationInput`, `TranslatableKinds`, `externalReference`, `updatedAt: DateTimeRangeInput`).

**Medusa:** https://docs.medusajs.com/resources/commerce-modules/translation · https://docs.medusajs.com/learn/fundamentals/api-routes/localization · https://docs.medusajs.com/resources/commerce-modules/translation/custom-data-models

**Akeneo:** https://api.akeneo.com/concepts/products.html · https://api.akeneo.com/documentation/update.html · https://api.akeneo.com/documentation/filter.html ·
https://github.com/akeneo/pim-api-docs/blob/master/content/rest-api/responses.md (ліміти 100) · `.../rest-api/good-practices.md` · `.../mcp/overview.md`, `.../mcp/use-cases.md`

**Sylius:** https://github.com/Sylius/Sylius/tree/2.3/src/Sylius/Bundle/ApiBundle/Resources/config/api_platform (`properties/Product.xml`, `resources/admin/ProductTranslation.xml`, `serialization/Product.xml`),
`src/Sylius/Bundle/ApiBundle/Controller/GetProductBySlugAction.php`, `.../OpenApi/Documentation/AcceptLanguageHeaderDocumentationModifier.php`

**Shopware:** https://github.com/shopware/docs — `guides/development/integrations-api/request-headers.md`, `.../flows/create-product.md`, `concepts/framework/translations/plain-vs-translated-fields.md`, `resources/references/adr/2022-03-29-specify-priority-of-translations-in-dal-write-payloads.md`

**Payload:** https://payloadcms.com/docs/configuration/localization

**1С / CommerceML:** https://v8.1c.ru/edi/edi_stnd/131/ (протокол обміну з сайтом) · XSD 2.10: https://github.com/dobromyslov/commerceml-parser/blob/master/doc/commerceml-2.10.xsd (копія; офіційний URL XSD повернув 404) ·
Infostart (Ид з «#»): обговорення на https://forum.infostart.ru/ (знайдено пошуком; точний топік не зафіксовано, див. також https://forum.infostart.ru/forum15/topic205212/ про формування offers.xml) · Infostart про GUID/ссылки: https://infostart.ru/1c/tools/127208/ (через пошук) ·
OpenCart exchange1c: https://github.com/KirilLoveVE/exchange1c_v1.6_oc2.3 (`upload/admin/model/extension/exchange1c.php`) · WooCommerce: https://github.com/sgtpep/woocommerce-1c (`exchange/offers.php`, `exchange/orders.php`, `admin.php`)

**Better Auth / Zod / TanStack:** https://better-auth.com/docs/plugins/api-key (+ `/reference`), npm `@better-auth/api-key@1.7.7` · Zod 4 `regexes` (`node_modules/zod/v4/core/regexes.js`, https://github.com/colinhacks/zod/blob/main/packages/zod/src/v4/core/regexes.ts) ·
https://tanstack.com/start/latest/docs/framework/react/guide/server-functions.md («Same-Origin Requests», «use server routes»), `.../server-routes.md`
