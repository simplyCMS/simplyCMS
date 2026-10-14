# 82. Інвентар кодової бази SimplyCMS для хвилі мультимовності даних

Знімок: гілка `claude/k3-e8-live-npm`, HEAD 2249106d, дерево чисте. Лише читання.
Шляхи відносно `~/github/simplyCMS`; `P` = `packages/simplycms`, `S` = `P/src`.
Метод: схема, адмінка, loader-и і plugin-sdk прочитано напряму (`Read`/`grep`); «хто кличе» для серверних
функцій доведено грепом по імпортах, не графом (барелі `simplycms/*` бреше граф). Усе, що названо «немає»,
доведено грепом по `S/` і `P/migrations/` (названо в кожному пункті).

---

## 1. Перекладні колонки

Усього таблиць у `0001_init.sql`: 43 (37 у `S/schema/schema.ts` + 4 auth `S/schema/auth.ts:43,81,111,148` + 2 media
`S/schema/media.ts:43,82`); плюс `mail_outbox` у `0005_mail_outbox.sql` (`S/schema/mail.ts:22`). Таблиць
`*_translations` НЕМАЄ (`grep -ri translations S/schema` — порожньо; migrations — теж).

### 1.1 Таблиця «таблиця → перекладні → мовонезалежні → примітки»

| Таблиця (schema.ts) | Перекладні (людський текст) | Мовонезалежні | Примітки |
|---|---|---|---|
| `sections` :89 | `name`, `description` (rich HTML), `meta_title`, `meta_description`; `slug` varchar(255) — рішення (див. 1.3) | `id`, `parent_id`, `image_url`, `sort_order`, `is_active`, часові | `slug` UNIQUE глобально (`sections_slug_key` :108) і формує URL `/catalog/<slug>` |
| `products` :386 | `name`, `short_description`, `description` (rich HTML, санітизується), `meta_title`, `meta_description`; `slug` — рішення | `section_id`, `sku`, `is_active`, `is_featured`, `has_modifications`, `stock_status`, `images` jsonb (масив референсів), `return_policy`/`shipping_details` jsonb (див. 1.4) | `slug` UNIQUE (:421); `description` має `richHtml: {description:'content'}` в ресурсі |
| `product_modifications` :425 | `name`; `slug` — рішення | `product_id`, `sku`, `is_default`, `images`, `sort_order`, `stock_status` | UNIQUE(product_id, slug) :443. У знімок замовлення йде `"<товар> - <модифікація>"` |
| `section_properties` :112 | `name`; `slug` — рішення | `section_id` (nullable, лишок: реальний зв'язок — `section_property_assignments`), `property_type` enum, `is_required`, `is_filterable`, `has_page`, `sort_order`, `options` jsonb | `slug` UNIQUE глобально :131 — це ключ фільтра й URL `/properties/<slug>`. `options` jsonb: у ресурсі `readonly` (`S/admin-server/impl/section-properties/resource.ts:35`), писача немає — мертва колонка |
| `property_options` :340 | `name`, `description` (rich HTML), `meta_title`, `meta_description`; `slug` — рішення | `property_id`, `image_url`, `sort_order` | UNIQUE(property_id, slug) :359; URL `/properties/<prop>/<option>` |
| `product_property_values` :307 | `value` text — ТІЛЬКИ для `property_type='text'` (для boolean це код `'true'|'false'`, для color — hex, для select/multiselect — NULL, значення в `option_id`) | `product_id`, `property_id`, `numeric_value`, `option_id` | значення text — окрема точка переклад-рішення; boolean/color — коди |
| `modification_property_values` :273 | те саме (`value` лише для text) | `modification_id`, `property_id`, `numeric_value`, `option_id` | UNIQUE NULLS NOT DISTINCT (owner, property, option) :301 |
| `section_property_assignments` :362 | — | усе (`applies_to` text 'product'|'modification' — код) | |
| `banners` :1063 | `title`, `subtitle`, `buttons[].text` (jsonb, див. 1.4); `button.url` — рішення (може бути локалізований шлях) | `image_url`, `desktop_image_url`, `mobile_image_url` (картинка може бути мовозалежна — рішення), `placement`, `section_id`, розклад, анімація, `overlay_color`, `text_position` | |
| `order_statuses` :73 | `name` | `code` (унікальний; seed-коди `new/confirmed/...`), `color`, `sort_order`, `is_default` | seed-назви кирилицею в `0003_seed.sql:22-28` |
| `user_categories` :134 | `name`, `description` | `code`, `is_default`, `price_type_id` | |
| `price_types` :932 | `name` | `code`, `is_default`, `sort_order` | seed «Роздрібна» `0003_seed.sql:41` |
| `shipping_methods` :464 | `name`, `description` | `code`, `provider` (код), `pricing` enum, `config` jsonb, `icon`, `is_active` | `config` jsonb — перевірити на текст (не знайдено в коді, див. 1.4) |
| `shipping_zones` :483 | `name`, `description` | `cities text[]`, `regions text[]` (назви НП/міст — дані довідника, не UI; рішення), `is_default` | |
| `shipping_rates` :499 | `name`, `estimated_days` (varchar(50), людський текст «1-2 дні») | суми/ваги/enum, `config` | |
| `pickup_points` :542 | `name`, `address`, `city`; `working_hours` jsonb (за змістом — розклад; текст у ньому рішення) | `phone`, `coordinates`, `zone_id`, `is_system` | `idx_pickup_points_city` по тексту `city` :557 |
| `discounts` :997 | `name`, `description` | числа, enum, дати | `name` потрапляє в `order_items.discount_data` (знімок), див. п.8 |
| `discount_groups` :944 | `name`, `description` | оператор, дати | `groupName` теж у знімку |
| `category_rules` :715 | `name`, `description` | `conditions` jsonb — структура/коди | |
| `languages` :155 | — (це довідник мов) | `code` varchar(10) UNIQUE, `name`, `is_default` (partial unique :166), `is_active` | ІСНУЄ, але без жодного споживача (див. 1.2) |
| `themes` :915 | `display_name`, `description` (метадані реєстру, англ.), `settings` jsonb | `name`, `version`, `is_active` | `settings` — значення налаштувань; тип `text` дозволений (`S/themes/types.ts:78-86`), текст у значеннях можливий |
| `plugins` :448 | `display_name`, `description` (метадані, англ.) | `name`, `version`, `config` jsonb, `hooks` jsonb | `config` — за Zod-схемою плагіна, текст можливий |
| `system_settings` :531 | `key` `store_profile` → jsonb з текстом (1.4) | `stock_management` (`decrease_on_order`) | |
| `product_reviews` :1027 | — (це UGC користувача: `title`, `content`, `admin_comment`; мовою автора) | `rating`, `status`, `images` | не перекладати; можливо `language` — рішення |
| `orders` :767 | — (знімок ПД і адреси: `delivery_address`, `delivery_city`, `notes`, імена) | суми, `payment_method` (код), id | текст вводить покупець |
| `order_items` :227 | — (знімок `name`; НЕ перекладати) | суми | див. п.8 |
| `user_category_history` :661 | — (знімок `from_category_name`/`to_category_name`, `reason`) | | |
| `profiles`, `user_addresses`, `user_recipients`, `users` | — (дані користувача) | | |
| `wishlists`, `comparisons`, `user_roles`, `product_prices`, `stock_by_pickup_point`, `discount_targets`, `discount_conditions` | — | усе | `discount_conditions.value` jsonb: форма за реєстром умов |
| `media` (:43), `media_erasures` | — (немає `alt`/підпису: лише `storage_key`, `mime_type`, `size_bytes`) | | alt-тексту зображень НЕМАЄ ніде |
| `mail_outbox` | `message` jsonb (вже відрендерений лист у локалі магазину) | | |

### 1.2 Звідки береться мова зараз

- Мов даних немає. `languages` — довідник із seed-рядком `uk` (`P/migrations/0003_seed.sql:34-36`, `is_default=true`).
  Читачів нема: у `S/` посилання на `languages` — лише `ENTITY.languages` (`S/contracts/entities.ts:23`),
  nav-заглушка `languages: 'admin.nav.languages'` (`S/admin/pages/PlaceholderPage.tsx:10`) і пункт сайдбару
  (`S/admin/layouts/AdminSidebar.tsx:128`). Колекції адмінки для `languages` немає (`S/admin-data/collections/` — 23 файли, без languages).
  Коментар у схемі: «CRUD ще не реалізований (лише nav-заглушка)» (`schema.ts:164`).
- Локаль UI/листів — тип `Locale = 'uk' | 'en'` (`S/i18n/types.ts:4`), `SUPPORTED`, `DEFAULT_LOCALE='uk'`
  (`S/i18n/translator.ts:14-15`), `normalizeLocale` (`uk-UA`→`uk`, невідоме→`uk`).
- Локаль збірки магазину: `locale: import.meta.env.VITE_LOCALE ?? 'uk-UA'` (`simplycms.config.ts:16`) — запікається
  при `vite build`, ОДНА на весь магазин (`docs/development/ENVIRONMENT.md:55-57`).
- Серверу локаль повідомляє host: `declareStoreLocale(locale)` (`S/site/store-locale.ts:12`), читання
  `getStoreLocale()` (:22) — модульна змінна процесу, не на запит; незадекларована → `uk` з одним warn.
  Користувачі: листи/серверні тексти (`S/site/index.ts:16` експорт). Від запиту (URL/cookie/Accept-Language) мова НЕ залежить ніде.
- Каталогів UI три рівні (ядро/тема/плагін) — `docs/architecture/i18n.md`; це про інтерфейс, не про дані.

### 1.3 Slug — що від нього залежить (для рішення «slug перекладається чи ні»)
- Валідація: `SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/` (`S/domain/slug.ts:8`) — лише латиниця; застосовується у `refine` ресурсів
  products/sections/section-properties/property-options (кирилічний slug відхиляється).
- URL: `/catalog/$sectionSlug`, `/catalog/$sectionSlug/$productSlug`, `/properties/$propertySlug[/$optionSlug]`
  (`P/routes/storefront/_storefront/...`); `productPath` будує `/catalog/<sectionSlug|NO_SECTION_SLUG>/<slug>` (`S/domain/product-path.ts:38-45`);
  некононічний сегмент розділу → 301 (`productRedirectTarget` :52, route `$productSlug.tsx:~22-30`).
- Sitemap: `loadSitemapData` (`S/storefront/loaders/sitemap.ts:45`) + `renderSitemapXml` (`S/storefront/seo/sitemap.ts`); без hreflang/alternates.
- Ключ фільтра: slug властивості — в query-ключах `${prop.slug}Min/Max` (`filter-predicates.ts:27-28`).
- Додатково: slug властивості глобально унікальний, бо «вітрина шукає лише за slug» (`schema.ts:130`).

### 1.4 jsonb-поля з людським текстом
| Місце | Форма | Текст усередині |
|---|---|---|
| `banners.buttons` :1074 | `BannerButton[] {text,url,target,variant}` (`S/contracts/objects/banner.ts:27-32`) | `text`, можливо `url` |
| `system_settings.store_profile` | `StoreProfile` (`S/contracts/store-profile.ts`): `name`, `homeTitle`, `description`, `contacts.{phone,email,address,hours}`, `logo`, `socials[]` | `name`, `homeTitle`, `description`, `address`, `hours`; seed `0003_seed.sql:58-63` |
| `products.return_policy` / `shipping_details` :413-414 | вкладений schema.org-об'єкт (MerchantReturnPolicy/OfferShippingDetails) | коди schema.org; форма адмінки їх НЕ редагує (`toProductDraft` ставить `null`, `product-form-schema.ts:~78`); loader їх не вибирає (`entities/product.ts:9`) |
| `themes.settings` :924 | значення за `ThemeSettingDefinition` (`type:'text'` допустимий; `label`/`description` — у коді теми) | значення text-типу |
| `plugins.config` :456 | Zod-схема плагіна | залежить від плагіна |
| `pickup_points.working_hours` :549 | `JsonValue`, тип у коді не зафіксовано | розклад |
| `shipping_methods.config`, `shipping_rates.config` | `JsonValue` | текст у коді не знайдено |
| `order_items.discount_data` :238 | `AppliedDiscount[] {id,name,type,value,calculatedAmount,groupName}` (`S/contracts/objects/discount.ts:74-81`) | `name`, `groupName` — знімок мовою на момент замовлення |
| `mail_outbox.message` | відрендерений лист | вже в локалі |
| `discount_conditions.value`, `category_rules.conditions` | структури | коди, не текст |

---

## 2. Властивості й модифікації

Таблиці (див. 1.1): `section_properties` (визначення), `property_options` (довідник для select/multiselect),
`section_property_assignments` (властивість ↔ розділ, `applies_to` product|modification), `product_property_values`,
`modification_property_values`. Enum `property_type`: `text, number, select, multiselect, range, color, boolean`
(`schema.ts:67`); `property_type` — `insertOnly` (не змінюється після створення, `section-properties/resource.ts:34`).

Як зберігається значення (колонки `value text`, `numeric_value numeric`, `option_id uuid`):
- `text` → `value`; `number`/`range` → `numeric_value` (product: numeric(15,4), mod: numeric без precision);
  `select` → `option_id` (один рядок); `multiselect` → ПО РЯДКУ НА ОПЦІЮ (Е3-13) з тим самим (owner, property), UNIQUE NULLS NOT DISTINCT
  (`schema.ts:334-336`, `301-303`); `boolean` → `value` = `'true'|'false'`; `color` → `value` = hex.
  Підтверджено вводом адмінки: `S/admin/features/products/properties/PropertyInput.tsx:54-135`
  (number/range → NumberPropertyInput; select → option_id; boolean → `value:'true'|'false'`; color; multiselect; text — дефолт).
- Модифікація НЕ має окремих «осей варіантів»: це самостійний рядок `product_modifications` (name, slug, sku, images, stock_status) +
  значення її властивостей у `modification_property_values`; вибір модифікації на картці — `ModificationSelector`
  (`S/catalog-ui/ModificationSelector.tsx`), стан `useModificationSelection` (`S/storefront-routes/pages/product-detail/useModificationSelection.ts`).

Фільтри (вітрина):
- Панель: `loadSectionFilters` (`S/storefront/loaders/catalog-filters.ts:119-174`): властивості розділу з `is_filterable=true` через
  `section_property_assignments`; для `select|multiselect` додатково опції (`property_options.name/slug/sort_order`).
  Числові: `loadSectionNumericProperties` (:35) — тільки `number|range` + `is_filterable`.
  Назви для бейджів: `loadFilterOptions` (:71) — ВСІ опції без розділу.
- Застосування — НА КЛІЄНТІ, у пам'яті, над уже завантаженим списком: `filterAndSortProducts`
  (`S/storefront-routes/pages/catalog/filtering.ts:~95-117`) з предикатами `matchesOptionFilters`, `matchesNumericFilters`,
  `matchesPriceFilter` (`filter-predicates.ts:21-80`). Фільтр опцій порівнює `option_id`; фільтра за `text`/`boolean`/`color` НЕМАЄ
  (`matchesOptionFilters` перебирає лише ключі стану, що містять масив id; числові — за slug+`Min/Max`).
  SQL-фільтрації товарів за властивостями на сервері немає (`loadCatalogProducts*` у `catalog-products.ts` вибирає за розділом).
- `FilterableProduct.propertyValues` несе `{property_id, numeric_value, option_id}` — текст не бере участі у фільтрах.
- Вітрина читає значення: `propertyValueColumns`/`toPropertyValueViewModel` (`S/storefront/loaders/property-values.ts:~15-105`)
  — віддає `value`, `numeric_value`, `option{id,slug,name}`, `property{id,name,slug,property_type,has_page}`;
  для модифікацій — `modification-values.ts` (`loadModificationValues` :15, `loadProductModificationValues` :52).
- Картка товару: `ProductCharacteristics` (`S/catalog-ui/ProductCharacteristics.tsx`): `formatValue` — boolean→`t('common.yes'|'no')`,
  option→`option.name`, numeric→`String(...)`, інакше `value`; при `has_page` — лінк `/properties/$propertySlug/$optionSlug`.
- Сторінки властивостей: `loadProperties`/`loadPropertyBySlug` (`properties.ts:25,38`), `loadPropertyOption` (`property-option.ts:38`).

Пошук за значеннями властивостей — відсутній (див. п.7).

---

## 3. Серверний шар

### 3.1 Кількість `createServerFn` (grep `createServerFn(` у `S/`, без тестів): ≈190
| Домен | К-сть | Файл(и) |
|---|---|---|
| Адмінка (усе CRUD/операції) | 125 | `S/admin-server/index.ts` — ЄДИНИЙ модуль serverFn (Gate C, стаб-маркер; навмисно > 150 рядків, `index.ts:~203`) |
| Вітрина: каталог/розділи/товари/властивості | 7+2+3+5 | `S/storefront-routes/server/{catalog,products,properties,home}.ts` |
| Вітрина: кошик/чекаут/замовлення/профіль | ≈19 | `S/storefront-routes/server/{checkout,checkout-quote,order-view,profile,profile-orders,invite,auth,root,themes}.ts` |
| Вітрина (core/lib, спільні) | 22 | `S/core/lib/{auth-session,banners,cart-quote,discounts,profile-avatar,review-form,reviews,section-filters,shipping-directory,stock,user-addresses,user-recipients}.ts` |
| Plugin SDK | 6 | `S/plugin-sdk/server/index.ts` (`pluginTable{List,Insert,Update,Remove}`, `pluginConfig{Read,Write}`) |
| Плагіни / теми (реєстр) | 3 + 2 | `S/plugins/server/index.ts`, `S/themes/server/index.ts` |

Адмін-функції за доменами (з імен у `admin-server/index.ts`): статуси замовлень (6), медіа/пошта/sweep (6), товари (4), модифікації (4+2 named),
ціни (2), залишки (2), значення властивостей товару/мод. (8), розділи (4), банери (4), типи цін (6), властивості розділу (4), опції (4),
призначення властивостей (4), замовлення+позиції (7), відгуки (5), доставка: методи/зони/тарифи/точки (≈17), налаштування/теми/плагіни (≈8),
знижки і групи (≈10), категорії покупців/правила (≈11), покупці (≈7), діагностика ціни (1), дашборд (1).

### 3.2 Чи `admin-server` — узагальнений ресурсний шар? ТАК, частково
- Фабрика `defineAdminResource` (`S/admin-server/impl/resource.ts:44-139`): конфіг `{entity, table, operation, mode, filterable, sortable,
  defaultOrder, writable, insertOnly, readonly, omit, maxLimit, touch, refine, richHtml, media, cascadeMedia, lock, guard}`
  (`resource-config.ts:~32-80`) → повертає `{rowSchema, insertSchema, updateSchema, removeSchema, subsetSchema, list, insert, update, remove,
  insertIn, updateIn, removeIn}`.
- Валідатор виводиться з Drizzle-таблиці власним `columnsToZod(table, 'select'|'insert'|'update', refine)`
  (`S/admin-server/impl/columns-to-zod.ts`; паритет з drizzle-zod 0.8.3 доводиться тестами `__tests__/columns-to-zod*.test.ts`) і збирається в
  `buildResourceSchemas` (`resource-schemas.ts:~78-127`). Пакетні insert/update/remove (1..100 елементів); ключ `id` — `z.uuid()` від клієнта;
  порожній patch — відмова.
- `serverFn` фабрика НЕ створює — обгортки пишуться вручну топ-рівневими const (обмеження компілятора Start): патерн
  `createServerFn({method}).validator(adminInput(ops.insertSchema)).handler(ops.insert)` (`index.ts:210-224`). Кожна нова сутність = ≈4 ручні const.
- Читання: `subsetInputSchema` (`impl/subset.ts`): `filterable`/`sortable`-білий список, ops `eq/gt/gte/lt/lte/in/isNull`, курсор, `limit`;
  `like/ilike/or` ЗАБОРОНЕНІ (`admin-data/subset-payload.ts:~38`). `listResourceRows` (`impl/resource-list.ts`).
- Усе з доменним інваріантом — іменовані операції поза фабрикою («розріз по операціях», `resource.ts:~27-33`): setDefault, reorder,
  saveProductPrices, saveStock, changeOrderStatus, add/remove order item, saveDiscount, setCustomerBan тощо.
- Є «ядра без HTTP» для виклику поза запитом: `insertIn/updateIn/removeIn` у транзакції викликача (`resource.ts:131-133`, С-2/С-15) і
  `CoreActor = {kind:'admin',userId}|{kind:'system'}` (`impl/core-actor.ts`, прямо названо «сід, порти, майбутній MCP-сервер магазину»).
  Користувачі `*In` у коді тестів/сіду; HTTP-API поверх них немає.
- Клієнтський споживач: `S/admin-data` — 23 колекції (TanStack DB), `handlers.ts` (write-back через `ops.insert/update/remove`),
  реєстр `registry.ts`; `mode: 'eager'|'on-demand'`.

### 3.3 Авторизація
- Матриця `AUTHZ_MATRIX: Record<Operation, Partial<Record<AppRole, 'own'|'any'>>>` (`S/auth/authz.ts:30-110`); ролі БД `user|admin`
  (`appRole` enum, `schema.ts:63`). Операції: `catalog.read/write`, `order.read/create/manage`, `shipping.manage`, `banner.manage`,
  `settings.manage`, `discount.manage`, `customer.manage/delete`, `profile.read/update`, `review.create/moderate`, `user.role.assign`,
  `media.write`, `admin.access`. Усі запис-операції адмінки зараз `{admin:'any'}` (єдина роль admin; «менеджер» — задуманий, не реалізований).
  Права `*.manage` — саме такі, але `catalog.write`/`review.moderate`/`media.write` — інші формати імен; нової операції для мов/перекладів немає.
- Рубіж 1 (TS): `requireGrant(operation)` → `resolveRequestGrant` читає СЕСІЮ `readSessionSubject(getRequest().headers)` (cookie Better Auth);
  `AuthzError` → 403 (`S/auth/authz-request.ts:30-65`). Субʼєкт ніколи не з клієнта.
- Рубіж 2 (БД): `withActor({role,userId}, fn)` (`S/db/with-actor.ts:41-70`): `BEGIN; set_config('app.user_id',…); set_config('app.order_token',…);
  SET LOCAL ROLE app_user|app_admin; …; COMMIT`; застосунок логіниться як `app_runtime` без прямих грантів. Конфлікти БД → `toAdminConflict` → 409.
- `runAdmin(operation, fn)` / `runAdminTransactions` (`impl/run.ts`): requireGrant → ролі → транзакція(и) → статус 409/400 лише на цій межі.
- API-токенів/Bearer/API-ключів у коді НЕМАЄ (`grep -riE "bearer|apiKey|api-key" S/` — порожньо): єдина ідентичність — cookie-сесія Better Auth
  (`P/routes/storefront/api/auth/$.tsx`). Публічного REST/OpenAPI/MCP/1С-інтеграції НЕМАЄ (`grep -iE "openapi|1c|mcp" S/` — лише коментар у
  `core-actor.ts`). HTTP-роути: `api/health`, `api/auth/$`, `media/$` (`P/routes/storefront/`), `/sitemap.xml`,`/robots.txt` (інтерцептор `S/storefront-routes/seo/interceptor.ts`).
- Для командного шару ПЕРЕВИКОРИСТОВУВАНЕ: (а) `defineAdminResource` і схеми (rowSchema/insert/update) як опис ресурсу + валідатор; (б) `insertIn/updateIn/removeIn` +
  `CoreActor` як транспорт-незалежне ядро; (в) `AUTHZ_MATRIX`/`requireOperation` — але потрібне джерело субʼєкта не з cookie (токен/сервісний акаунт);
  (г) `withActor`; (д) іменовані операції як «команди». НЕ перевикористовується напряму: `createServerFn`-обгортки (RPC-протокол Start,
  не стабільний публічний контракт), `subsetInputSchema` без пошуку.

---

## 4. Форма картки товару в адмінці

- Форма статична, НЕ конфігураційна: `ProductForm` (`S/admin/features/products/edit/ProductForm.tsx:56-134`) — react-hook-form + `zodResolver(productFormSchema)`;
  схема `productFormSchema` (`product-form-schema.ts:10-27`: name, slug, shortDescription, description, metaTitle, metaDescription, sectionId, isActive,
  isFeatured, hasModifications, sku, stockStatus, images) — один Zod-об'єкт, поля захардкоджені в `ProductMainFields`/`ProductSeoFields`/`ProductSidebar`.
- Збереження: `useProductSave` (`useProductSave.ts:24-85`) — через КОЛЕКЦІЮ `productsCollection` (`products.insert/update`) → handlers admin-data →
  `insertProducts/updateProducts`. Тобто основна картка = ОДНА серверна функція (фабричний `productsOps`, `catalog.write`), `toProductPatch`
  (`product-form-schema.ts:44-60`) мапить поля. `returnPolicy/shippingDetails` форма не редагує.
- Сателіти — окремі панелі з ВЛАСНИМИ збереженнями, поза `<form>` (щоб їхні кнопки не сабмітили картку): властивості
  (`PropertyValuesPanel` → insert/update/removeProductPropertyValues), модифікації (`ModificationsPanel`), ціни (`PricesEditor` → `saveProductPrices`),
  залишки (`StockEditor` → `saveStock`), простий товар (`SimpleProductPanel`). Рендер сателітів — `ProductEditPage.tsx` (~:132) сиблінгом форми.
  Тобто збереження картки НЕ атомарне: 1 + N окремих викликів.
- Точки розширення плагінів: слоти (`PluginSlot`) `admin.product.form.before`, `.fields`, `.sidebar` (у `ProductForm.tsx:103,109,117`) і
  `.after` (`NewProductPage.tsx:51`); контекст слота — `{ productId }` (`productId=null` для нового товару). Слот отримує ЛИШЕ id; доступу до значень
  форми/`useFormContext` документовано не гарантується (слот рендериться всередині `<Form>`-провайдера, тож технічно `useFormContext` працює, але
  це не контракт SDK), результату плагіна в `onSubmit` немає, плагінне поле не потрапляє в `productFormSchema`.

---

## 5. Plugin SDK

Публічна поверхня `simplycms/plugin-sdk` (`S/plugin-sdk/index.ts`): `definePlugin`, `validatePluginModule`, `usePluginT`, `usePluginTable`
(+`PluginTablePort`), `usePluginConfig`, типи `PluginDefinition`, `SlotComponent`, `PluginMessages`, `SdkPluginModule`. Межа довіри — лінт
`dependency-lint` в `eslint.config.mjs` (плагін імпортує лише `simplycms/plugin-sdk`).

`PluginDefinition` (`S/plugin-sdk/types.ts:30-60`): `name`, `displayName`, `version`, `engines.simplycms`, `description`, `author`, `settings` (Zod-об'єкт →
форма в адмінці через `z.toJSONSchema`), `slots` (слот → React-компонент), `hooks` (хук → обробник), `messages` (префікс `plugin.<name>.`),
`adminRoutes` (тека), `migrations` (імена SQL), `edgeFunctions`, `buckets` (декларації без автоматизації).

Що реально є:
- Слоти з рендером: admin — `admin.sidebar.items`, `admin.dashboard.stats/widgets`, `admin.product.form.before/fields/sidebar/after`;
  storefront — `product.detail.before/after` (`S/storefront-routes/views/slots/ProductPluginSlots.tsx:28,42,60`), checkout-слоти (`pages/Checkout.tsx:364,427`).
  Список імен `HookName` (`S/plugins/types.ts:~163-195`) ширший за реально рендерені: бекенд-хуки `product.before_save`, `user.registered`,
  `order.created`, `order.status_changed` — у типі є, ядро їх НЕ емить (`types.ts:20-26` докблок: «ядро НЕ емить бізнес-подій»; `execute` кличе лише `PluginSlot`).
- Власні таблиці: `plg_<name>[_*]` через порт `usePluginTable` → serverFn `pluginTable{List,Insert,Update,Remove}` (`S/plugin-sdk/server/index.ts`);
  гард `assertOwnTable`/`assertColumn`/`assertKnownPlugin` (`server/guard.ts`) пускає лише власний префікс; SQL рядком із `sql.identifier` + параметри
  (`server/table-db.ts`); запис — `requireAdmin` (:~108-115); читання йде під `withStorefrontDb` (роль `app_user` — потрібен `grant select` у міграції).
  Фільтри порту: лише `eq` + `orderBy`. Приклад: `P/../simplycms-plugin-faq/migrations/20260814120000_plg_faq_items.sql` (`product_id uuid` БЕЗ FK, `grant select … to app_user`,
  `grant select,insert,update,delete … to app_admin`).
- Міграції плагінів: файли `<YYYYMMDDHHmmss>_plg_<name>_<slug>.sql` у `migrations/` пакета; доставка — `simplycms db:diff [--write]` (копіює в магазин),
  накат `simplycms db:apply` (журнал `simplycms_migrations`); SQL-лінт межі — лише `plg_<name>_*` (`docs/architecture/plugins.md` §5, ~:212-246).
- Налаштування: `pluginConfigRead/Write` (`plugins.config` jsonb, ліміт 64 КБ), `usePluginConfig`.
- Адмін-роути плагіна: монтаж вручну через `physical('', '../../packages/simplycms-plugin-faq/routes')` у `routes.ts`.

Чого бракує, щоб плагін додав ПЕРЕКЛАДНЕ поле до товару:
1. Нема розширюваної схеми форми: слот не повертає значення в `productFormSchema`/`toProductPatch`; `onSubmit` не має хука `product.before_save` (є в типі, не емітиться).
2. Нема контракту «контекст слота = поточна мова + доступ до значень форми»; `context` слота — `{productId}` і не типізований SDK (`SlotComponent`, `types.ts:~15`).
3. Нема порту читання поля у вітрину: loader-и товару (`product-detail.ts`, `entities/product.ts`) не мають розширення; плагінний слот отримує лише контекст
   `ProductPluginSlots` (дані, що передав view), а не плагінні дані; SSR-доступ плагіна до своєї таблиці — через клієнтський хук `usePluginTable` (не в loader).
4. Нема поняття мови в `usePluginTable` (фільтр лише `eq`, мови не додається) і в `plg_*` DDL; нема автоматичної `*_translations` для плагінної сутності.
5. Нема залежності «плагінний запис видаляється з товаром» (link-поле без FK за дизайном), `product_id` осиротіє при видаленні товару.
6. Нема публічного API-контракту, через який 1С/CLI/MCP пишуть плагінні поля (порт працює лише з браузера через RPC під сесією admin).

---

## 6. Вітрина

Loader-и (усі через `withStorefrontDb`/`ActorDb`, `S/storefront/loaders/`), що читають людський текст:
| Loader | Файл:рядок | Тексти |
|---|---|---|
| `loadProduct` | `product-detail.ts:63` | products.* (name, short/description, meta_*), розділ, модифікації |
| `loadProductList` | `products.ts:57` | products.name |
| `loadCatalogProducts`/`…Where` | `catalog-products.ts:51,71` | products.name, mod.name, значення властивостей |
| `loadHomePageData`/`loadHomeProducts` | `home.ts:41,69` | products.* |
| `loadSectionProducts`/`loadOneSectionProducts` | `home-sections.ts:28,98` | products.name, sections.name |
| `loadSections`/`loadSectionBySlug`/`loadRootSections` | `sections.ts:18,29,43` | sections.* (`entities/section.ts:~24`) |
| `loadSectionFilters`/`loadFilterOptions`/`loadSectionNumericProperties` | `catalog-filters.ts:119,71,35` | section_properties.name, property_options.name |
| `loadProperties`/`loadPropertyBySlug`/`loadPropertyOption` | `properties.ts:25,38`, `property-option.ts:38` | properties/options name, description, meta_* |
| `property-values.ts`, `modification-values.ts` | | значення + назви |
| `loadBanners` | `banners.ts:24` | banners.title/subtitle/buttons |
| `loadSitemapData` | `sitemap.ts:45` | slug-и + `updated_at` |
| `loadStockInfo`, shipping-directory (`S/commerce/shipping-directory.ts`), `loadProductReviews` (`reviews.ts:53`), order loaders | | назви способів доставки, пунктів, статусів |
| `readStoreProfile` | `S/site/store-profile.ts` | `store_profile` jsonb |
Серверні функції вітрини, що їх обгортають: п.3.1 (`getProduct`, `getCatalogPageData`, `getSectionPageData`, `getProperties`, …).

Теми і дані: тема постачає `components` і опційно `views` п'яти сторінок (`ThemeModule.views`, `S/themes/types.ts:174`); view-model-и — контрактні
типи `simplycms/contracts/views` (`S/contracts/views/{home,catalog,product-detail,cart,common}.ts`), дані їм дає ядро (loader → page → `views`). Тема
даних не читає; i18n теми — `ThemeModule.messages` (`types.ts:167`).

URL/SEO:
- Маршрути вітрини: `P/routes/storefront/_storefront/{index,cart,checkout,catalog/index,catalog/$sectionSlug/index,catalog/$sectionSlug/$productSlug,properties/*,order-success/$orderId}.tsx`;
  мовного префікса в URL НЕМАЄ. Дерево збирає `routes.ts` (virtualRouteConfig).
- Head: `storefrontHead(matches, builder)` (`S/storefront-routes/head/head.ts:83`) — title/description через `t(...)` + `siteUrl`; `productHead`
  (`head/product.ts:36`) додає og:*, canonical (`siteUrl + productPath`), JSON-LD Product (`productOffers`).
- 🔴 Розбіжність: `meta_title`/`meta_description` товару, розділу й опції ЗАВАНТАЖУЮТЬСЯ (`entities/product.ts:22-23`, `section.ts:24-25`, `property.ts:70-71`),
  але у head НЕ ВИКОРИСТОВУЮТЬСЯ: `productHead` бере `title: product.name`, `description: product.description || t('product.metaDescription')`
  (`head/product.ts:~50-54`), сторінка розділу — `name`/`description` розділу (`catalog/$sectionSlug/index.tsx:25-30`). `grep meta_title|metaTitle` у
  `S/` поза admin/schema/i18n — лише списки колонок loader-ів. Тобто SEO-поля сьогодні мертві на вітрині.
- Sitemap: `/sitemap.xml` (`S/storefront/seo/sitemap.ts`): головна, `/catalog`, `/properties`, розділи, товари; `lastmod`=`updated_at`; без `<xhtml:link hreflang>`.
  `robots.txt` — `S/storefront/seo/robots.ts`. Перехоплення — `createSeoInterceptor` (`S/storefront-routes/seo/interceptor.ts`).
- `<html lang>` / `hreflang`/`og:locale`: у `head.ts` перевірити окремо (не читав повністю); окремої мовної логіки URL немає.

---

## 7. Пошук і проєкції

- Пошуку на вітрині НЕМАЄ: `grep -iE "search|пошук"` по `storefront*`, `catalog-ui`, `contracts/views`, `themes/solarstore` дає лише `useSearch` роутера і плейсхолдери
  вибору адреси/отримувача. Тема solarstore пошукового UI не має.
- `search_documents`, `tsvector`, `pg_trgm`, `to_tsquery`, черги індексації — НЕ існують (`grep` по `S/` і `P/migrations/` порожній; індексів по текстових колонках
  лише `idx_property_options_slug`, `idx_pickup_points_city`).
- Адмінка: список товарів без пошуку (коментар «Жодного like/ilike/or … пошук — П6», `S/admin/features/products/list/useProductsList.ts:31`).
  Єдиний пошук — `searchProductsForOrderOp` (`S/admin-server/impl/products/search-for-order.ts:~40-75`): `ilike` по `products.name`, `sku`, `product_modifications.name/sku`,
  мін. 2 символи, ліміт 20, `order.manage`.
- Денормалізованих таблиць/матеріалізованих проєкцій немає. Похідне: `product_prices` (ціни по типах), `stock_by_pickup_point` (залишки — це первинні дані, не проєкція).
  Агрегати рейтингів — запитом (`loadProductRatings`, `reviews.ts:155`), кеш — `S/site` (покоління, Е6б), не БД.

---

## 8. Знімки в замовленнях

- `order_items.name` (`schema.ts:232`) — текст НА МОМЕНТ замовлення: для товару `product.name`, для модифікації `"<product.name> - <mod.name>"`
  (`S/commerce/price-cart-catalog.ts:~72`), у ТІЙ мові, що лежить у базовій колонці. Вставки: чекаут `order-create.ts:96` і адмін-додавання позиції
  (`S/admin-server/impl/order-items/add.ts:~91`, через той самий `priceItems`).
- `order_items.discount_data` jsonb (`:238`) — `AppliedDiscount[]` з `name`, `groupName` (знімок назв знижок).
- Поза цим у позиції копіюються лише ціни/кількість/`product_id`/`modification_id`/`stock_point_id`; описів, slug, зображень, властивостей у знімок НЕ копіюється.
- `orders`: `first_name,last_name,email,phone,delivery_address,delivery_city,notes,recipient_*` — ПД покупця (вводить користувач); `payment_method` — код;
  `shipping_data` jsonb; назви способу/статусу доставки — НЕ знімок, а live-JOIN (`entities/order.ts:56` — `orderStatuses.name`), тож зміна/переклад статусу
  змінює вигляд старих замовлень. `shipping_method_id/zone/rate/pickup_point_id` — `ON DELETE SET NULL`.
- `user_category_history.from/to_category_name` — знімок назв категорій (`schema.ts:666-667`).
- Листи: відрендерені в локалі магазину (`getStoreLocale`) і лежать у `mail_outbox.message`; `S/storefront/loaders/order-mail.ts` читає `system_settings` і позиції.

---

## 9. Додаткові факти, важливі для проєктування

- Усі `id` генерує викликач (немає `DEFAULT gen_random_uuid()`) — категорія A (`AGENTS.md`, `data-layer.md`); таблиці `*_translations` мусять це зберегти.
- Видимість каталогу фільтрує КОД (`is_active=true`), RLS на каталозі немає (`schema.ts:27-35`); нова `*_translations` теж потребує явних грантів у `0002_grants.sql` (роль `app_user` — select, `app_admin` — повний).
- Міграції `0000…0005` заморожені (журнал `simplycms_migrations` тримає суми; тест `tests/migrations-frozen.test.ts`): переписати baseline = зміна політики AGENTS.md
  («нова схема — лише новий 0006_*»), потрібне явне рішення власника і синхронізація копій `pnpm template:sync` (`P/migrations`, `packages/cli/host`, шаблон).
- Дві копії запису в адмінці: `admin-data` (оптимістичні колекції з write-back) і `admin-server` (операції). Додавання мови в `products` означає зміну колекції,
  handlers, `toProductPatch`, форми, loader-ів, sitemap, head, mail, дашборду (пошуку немає).
- Поряд лежать чернетки: `~/simplycms-drafts/2026-10-13-content-multilingual-draft.md`, `2026-10-14-content-multilingual-base.md` (патерн A) — не читав, не входить у скоуп.
- Існуюча спека «Онбординг і супровід магазину агентом» (`docs/superpowers/specs/2026-10-12-shop-agent-toolkit-design.md`) — про CLI/скіли, не про API даних.

## 10. Покриття доказів
Код-шар (cbm) для цього знімка не використовувався як доказ «хто кличе»: покриття барелів `simplycms/*` недостатнє, висновки з імпортів/викликів — `grep`/`Read`.
Не довів: вміст `head.ts` щодо `lang`/`og:locale`; вміст `config` jsonb доставки; чи є тест паритету колонок `languages` — позначено «не знайдено».
