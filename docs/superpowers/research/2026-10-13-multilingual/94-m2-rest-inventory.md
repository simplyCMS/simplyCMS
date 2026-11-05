# Інвентар для плану М2 «решта сутностей» (read-only розвідка)

Знімок: гілка `claude/m2a-closeout` (HEAD `d8b364d7`), що збігається з `main` за вмістом коду (`071d2a03` + один докс-коміт; локального `origin/main` як ref немає — `git rev-parse origin/main` не резолвиться, звірено за `git log`). Тести, збірку, гейти не запускав. Усе нижче — читання коду; граф код-шару не використовував (пошук текстовий: `grep`/`Read`), тож «немає» означає «не знайдено грепом по `packages/`, `scripts/`, `docs/`».

Скорочення шляхів: `S/` = `packages/simplycms/src/`, `M/` = `packages/simplycms/migrations/`.

---

## 0. Що вже є (контекст: М1 + блок 1 М2) і чого немає

Є:
- Таблиці мов, переклади й реєстри адрес для ТОВАРУ: `product_translations` (`S/schema/schema.ts:489`), `url_paths` (`:660`), `slug_tokens` (`:690`), `catalog_product_texts` (`:723`), `products.version` (`:438`) — єдина `version integer` у схемі (інші `version` — це varchar плагіна/теми, `:756`, `:1313`).
- Реєстр перекладних сутностей `TRANSLATABLE` (`S/translations/specs.ts:18`) з коментарем «М2 доповнює реєстр»; читання з fallback `withFallback` (`S/translations/read.ts:~60`); запис `applyTranslationPlan` (`S/translations/upsert.ts:20`), без DELETE.
- Тригери БД: `require_source_translation` (І4; `M/0004_functions.sql:288`, хелпер `attach_source_translation_triggers` з умовою `col=value`), `require_current_address` (`:541`), `require_current_token` (`:709`). Підключені лише до товару/модифікації/значень: `0004_functions.sql:875-884`.
- Generic CRUD-ресурс адмінки `defineAdminResource` з `readModel` (`S/admin-server/impl/resource-read-model.ts:28`): назва з перекладу основної мови через INNER JOIN. Використано тільки для `products` (`impl/products/resource.ts`).
- Реєстр операцій: 21 операція (`impl/operations-registry.ts:32-54`), з них сутностей каталогу лише `products.*`; решта — мови, токени, профіль `ui_locale`, ціни, залишки.
- Мовний пакет `LanguagePack` має `ui` + `content: { slugify }` (`S/i18n/packs/uk.ts:16`, `S/i18n/types.ts:61-75`) — БЕЗ текстів системних довідників.
- Блок 1 М2 (осі мови) прийнято й влито (PR #64, `071d2a03`): `UiLocale`/`ContentLocale`, `profiles.ui_locale` (`schema.ts:~1016`), `resolveMailUiLocale` з `MailRecipient` (`S/mail/locale.ts:12-47`), `config.locale`/`VITE_LOCALE` знесено, хардкодів `'uk-UA'` у `S/` не лишилось (grep).
- Допоміжні точки під М2, вже залишені М1: `commerce/price-cart-catalog.ts:36` («двомовний знімок — М2»), `commerce/price-items.ts` (параметр `text: TextLocale`), `domain/translations` `TextLocale`, `PATH_TARGET_COLUMNS` з `satisfies` (`S/addressing/paths.ts:31`), `currentPathOwners` будує гілки з того ж носія (`addressing/owners.ts`), `RESERVED_SEGMENTS` уже містить `catalog`, `properties`, `assets` (`S/domain/slugs/reserved.ts:10-26`).

Немає (grep по `packages/`, `scripts/`):
- Жодної таблиці `*_translations` для сутностей М2, `store_profile`, `banner_buttons`, `banner_*`.
- `bootstrapStore`, `primaryLocale` у конфігу, `SYSTEM_SEED_IDS` (є лише `MAIN_SHIPPING_ZONE_ID`, `S/schema/seed-ids.ts:9`), `create … --locale`.
- `orders.locale`, `profiles.locale`, `product_reviews.locale`, `order_items.name_default`, `*_default` у jsonb-знімках.
- `version` на корінних таблицях М2; `section_id/property_id/option_id` у `url_paths`; `property_id/option_id` у `slug_tokens`.
- `simplycms plugin check`; перекладні таблиці FAQ; конвенція/порт перекладів у `plugin-sdk`.

---

## 1. Таблиця по сутностях

Умовно: «пише» = хто змінює дані; «читає» = споживачі тексту. Кількість файлів — грубо, `src` без каталогів i18n і схеми / `tests` (юніти + pg-харнес + скрипти), підрахунок за іменами таблиць/Drizzle-символів, тож завищує там, де слово «sections»/«orders» трапляється як змінна.

### 1.1 Розділи — `sections`
| Аспект | Факт |
|---|---|
| Таблиця зараз | `schema.ts:90`: `slug varchar(255) UNIQUE`, `name NOT NULL`, `description`, `image_url`, `meta_title`, `meta_description`, `parent_id` (плоский список, Е4-3), `is_active`, `updated_at`. Немає `version`. |
| Сід | Немає в `0003_seed.sql`. Демо: `M/demo/demo-seed.sql:51-72` (3 вставки з `slug`, `name`, `description`). |
| Пише | Легасі serverFn (`list/insert/update/removeSections` у `legacy-admin-server-fns.json`) → generic `sectionsOps` (`impl/sections/resource.ts`, режим `eager`, `writable` включає `slug/name/description/imageUrl/meta*`, `media: {entityType:'section'}`, `cascadeMedia` на фото опцій). Реєстр операцій: нічого. |
| Адмінка | `S/admin/features/catalog-dictionaries/sections/*` (SectionsPage, SectionEditPage, SectionRow, SectionMainCards, SectionSideCards, useSectionCard, section-form-schema + 4 тести), колекція `admin-data/collections/sections.ts`, вибір розділу в товарі/банері/знижці (ProductSidebar, ProductsFilters, BannerSideCards, SectionTargetSelect, useTargetLabels). |
| Читає вітрина | `storefront/loaders/sections.ts` (3 функції, без локалі), `entities/section.ts` (мапа колонок snake_case, `image_url` → `resolveMediaUrl`), `product-page.ts:58` / `product-detail.ts` (breadcrumb-розділ, join), `catalog-products.ts:100`, `home.ts:89`, `home-sections.ts`, `catalog-filter-scope.ts`, `sitemap.ts` (slug для `/catalog/<slug>`), `storefront/seo/sitemap.ts:22`; сторінки `routes/storefront/_storefront/catalog/$sectionSlug/index.tsx`, `CatalogSection.tsx`, `CatalogSectionChips.tsx`, `Home.tsx`. Листи: ні. API: ні (реєстр операцій не має розділів). |
| Адреса зараз | Є сторінка: `/catalog/<sectionSlug>` (окремий файловий роут), slug = колонка `sections.slug`. У реєстрі адрес розділу немає (`PATH_TARGET_COLUMNS` лише `product`). |
| Залежності | FK у `products.section_id`, `banners.section_id`, `section_property_assignments`, `section_properties.section_id`, `discount_targets.target_id` (м'яка), `discount` ціль `section`. Медіа-реєстр: `domain/media.ts:~240` (`sections.image_url`). |
| Обсяг | ~67 src / ~55 tests. Найважчий за кількістю читачів (вітрина + SEO + адмінка + товар/банер/знижка). |

### 1.2 Властивості розділів — `section_properties`
| Аспект | Факт |
|---|---|
| Таблиця зараз | `schema.ts:113`: `name NOT NULL`, `slug varchar(100) UNIQUE` (глобально), `property_type`, `is_required`, `is_filterable`, `has_page`, `sort_order`, `options jsonb` (мертва, читається в `entities/property.ts`, не використовується), `section_id` nullable (readonly; прив'язка через `section_property_assignments`, `schema.ts:400`). Одиниці виміру (`unit`) колонки НЕМАЄ. Немає `version`. |
| Сід | Немає. Демо: `demo-seed.sql:233`. |
| Пише | Легасі serverFn (`list/insert/update/removeSectionProperties`, + `…SectionPropertyAssignments`) → `sectionPropertiesOps` (`on-demand`, `insertOnly: propertyType`, `writable name/slug/isRequired/isFilterable/hasPage/sortOrder`). Нова операція: немає. |
| Адмінка | `admin/features/catalog-dictionaries/properties/*` (PropertiesPage, PropertyEditPage, PropertyFields, PropertyRow, PropertyCreateDialog, usePropertyCard, property-form-schema + тести), `assignments/*` (4 файли), колонка `admin-data/collections/section-properties.ts`, панель значень у товарі (`products/properties/*`). |
| Читає вітрина | `loaders/properties.ts` (список `has_page`), `property-values.ts`, `modification-values.ts`, `catalog-filters.ts`, `catalog-filter-scope.ts`, `product-detail.ts`, `entities/property.ts`; UI: `catalog-ui/FilterSidebar.tsx`, `ProductCharacteristics.tsx`, `Properties.tsx`, `PropertyPage.tsx`, `PropertyDetail.tsx`, `useCatalogQueries.ts`. Клієнтська фільтрація каталогу за slug (`useActiveFilters`, `active-filter-chips`). |
| Адреса зараз | Сторінка лише якщо `has_page = true`: `/properties` (список) і `/properties/<propertySlug>` (роути `_storefront/properties/index.tsx`, `$propertySlug/index.tsx`). Slug — колонка. Токена для query-фільтра немає (фільтр — клієнтський, М4 переводить на URL). |
| Залежності | Батько для `property_options` (FK CASCADE) і для значень товарів/модифікацій (складений FK `(property_id, value_kind)`, `schema.ts:341`, `:304`). |
| Обсяг | ~32 src / ~33 tests (властивості) + опції окремо. |

### 1.3 Опції властивостей — `property_options`
| Аспект | Факт |
|---|---|
| Таблиця зараз | `schema.ts:376`: `name NOT NULL`, `slug varchar(255)` UNIQUE у межах властивості, `description`, `image_url`, `meta_title`, `meta_description`, `sort_order`. Ціль складених FK `(property_id, id)` вже є (`:394`). Немає `version`. |
| Сід | Немає. Демо: `demo-seed.sql:257`. |
| Пише | Легасі (`list/insert/update/removePropertyOptions`) → `propertyOptionsOps` (`on-demand`, `insertOnly: propertyId`, `richHtml: description`, `media: property_option`). |
| Адмінка | `properties/PropertyOptionEditPage.tsx`, `PropertyOptionsTable.tsx`, `OptionPageCards.tsx`, `usePropertyOptionCard.ts`, `option-form-schema.ts`, колекція `property-options.ts`. |
| Читає вітрина | `loaders/property-option.ts` (сторінка опції, товари з опцією на товарі АБО модифікації), `property-values.ts`, `modification-values.ts`, `catalog-filters.ts`, `product-detail.ts`; UI `PropertyDetail.tsx`, `PropertyPage.tsx`, `ProductCharacteristics.tsx:90` (лінк `/properties/$propertySlug/$optionSlug`). |
| Адреса зараз | Сторінка при `has_page` батька: `/properties/<propertySlug>/<optionSlug>` (`routes/storefront/_storefront/properties/$propertySlug/$optionSlug.tsx`). Master Р12 переводить на плоский `/<path>` у `url_paths`. |
| Залежності | Від властивості (ON DELETE CASCADE; значення-select каскадом — І9 «видалення опції прибирає значення» проти FK значень, уже CASCADE у М1). Складений FK `(property_id,id)` — ціль для `property_option_translations` і `slug_tokens`. |
| Обсяг | ~35 src / ~23 tests (перетин з властивостями ≈ половина). |

### 1.4 Банери й кнопки — `banners` (+ `banner_buttons` ще НЕ існує)
| Аспект | Факт |
|---|---|
| Таблиця зараз | `schema.ts:1457`: `title NOT NULL`, `subtitle`, `image_url NOT NULL`, `desktop_image_url`, `mobile_image_url`, `placement`, `section_id` (FK SET NULL), **`buttons jsonb`** (масив `{text,url,target,variant}`, до 3, `BANNER_MAX_BUTTONS` у `domain/banner.ts:19`), розклад, анімація. Таблиці кнопок немає; `url` — вільний рядок (`/шлях` або `http(s)://`, `domain/banner.ts:36`), зв'язку з сутністю немає. Немає `version`, немає `alt`. |
| Сід | Немає. Демо: `demo-seed.sql:327, :342` (з `buttons` jsonb). |
| Пише | Легасі (`list/insert/update/removeBanners`) → `bannersOps` (`impl/banners/resource.ts`, `eager`, writable включає `buttons`, 3 media-колонки) + `guard.ts` (перехресні правила розкладу/placement). |
| Адмінка | `admin/features/banners/*` (20 файлів: BannerMainCard, BannerButtonsCard, BannerImageField, BannerScheduleCard, BannerSideCards, banner-form-schema/mapping + тести), `admin-data/collections/banners.ts`. |
| Читає вітрина | `loaders/banners.ts`, `loaders/home.ts`, `entities/banner.ts` (`toBanner`, фільтр кнопок через `isBannerButton`), `core/hooks/useBanners.ts`, `storefront-routes/components/BannerSlider.tsx`, `views/HomeView.tsx`, `contracts/views/home.ts`, `contracts/objects/banner.ts`, теми (hero через `HeroBannerView`). Листи/SEO: ні. |
| Адреса | Не має сторінки. |
| Залежності | Кнопка з типізованою ціллю (Р10, І32) → ціль = товар / розділ / властивість / опція ⇒ потрібні `url_paths` усіх видів і резолвер посилання за мовою; `banner_buttons` ← `banners` CASCADE. Медіа-реєстр: 3 колонки (`domain/media.ts:224-236`) переїжджають у `banner_translations.*_ref`. |
| Обсяг | ~41 src / ~28 tests. Новий пласт: таблиця кнопок + UI вибору цілі. |

### 1.5 Статуси замовлень — `order_statuses`
| Аспект | Факт |
|---|---|
| Таблиця зараз | `schema.ts:74`: `name NOT NULL`, `code UNIQUE` (контракт воронки), `color`, `sort_order`, `is_default` (частковий UNIQUE). Немає `version`. |
| Сід | `0003_seed.sql:22-31`: 6 рядків, id `00000001-…01…06`, назви українською. Master §3.6: у `0003` перекладних довідників бути не може (відкладений І4 відхилить коміт при порожній `languages`). |
| Пише | Легасі (`insert/update/removeOrderStatuses`, `reorderOrderStatus`, `setDefaultOrderStatus`) → `impl/order-statuses/{resource,remove,reorder,set-default}.ts`; `changeOrderStatus` (`impl/orders/change-status.ts`). |
| Адмінка | `admin/pages/OrderStatuses.tsx` (сторінка-моноліт), колекція `order-statuses.ts`, `admin/features/orders/*` (список/деталі показують назву). |
| Читає | `storefront/loaders/order-statuses.ts`, `orders.ts`, `entities/order.ts:55`, `ProfileOrders.tsx`; `commerce/customer-stats.ts` (за `code`). Листи: назви статусу в листах не знайдено (`mail/render/order.ts` — без статусу). |
| Адреса | Немає. |
| Залежності | `orders.status_id` (FK, без CASCADE). Бере участь у `bootstrapStore` (6 фіксованих id + переклади з пакета — у пакеті цих текстів ще немає). |
| Обсяг | ~31 src / ~16 tests. |

### 1.6 Способи доставки / тарифи / зони / точки видачі
| Аспект | Факт |
|---|---|
| Таблиці зараз | `shipping_methods` (`schema.ts:768`: `name NOT NULL`, `description`, `code UNIQUE`, `provider NOT NULL`, `pricing`, `config jsonb`, `icon`); `shipping_rates` (`:804`: `name NOT NULL`, `estimated_days varchar(50)`, FK method/zone CASCADE); `shipping_zones` (`:787`: `name NOT NULL`, `description`, `is_default` + CHECK `not is_default or is_active`); `pickup_points` (`:933`: `name`, `address`, `city` — усі NOT NULL, `working_hours jsonb` (форма `WorkingHours`: рядки `monday?: string…`, `contracts/objects/shipping.ts:78`), `phone`, FK method RESTRICT, zone SET NULL). Немає `version`. |
| Сід | Лише основна зона: `0003_seed.sql:115` (id `00000007-…01`, «Основна зона»; інваріант тримають часткові індекс/CHECK у 0001 і відкладений тригер `require_default_shipping_zone`, `0004_functions.sql:53`). Способів, тарифів, точок у сіді НЕМАЄ (комент у `0003` це прямо каже) — master §3.6 перелічує «способи доставки» серед bootstrap-рядків: розбіжність. Демо: `demo-seed.sql:358, :380, :386`. |
| Пише | Легасі: `insert/update/remove` для кожної з чотирьох (+`setDefaultShippingZone`) → `impl/shipping-{methods,rates,zones}/*`, `impl/pickup-points/*` (guards). Операцій реєстру немає. |
| Адмінка | `admin/features/shipping/{methods,zones,pickup-points}/*` (39 файлів, у т.ч. тарифи як діалог/таблиця всередині методу), колекції `shipping-*.ts`, `pickup-points.ts`, `admin-data/shipping-cache.ts`. `working_hours` у адмінці readonly (`pickup-points/resource.ts:35`; створення пише `{}`, `usePickupPointCard.ts:104`) — Р9 вимагає нової структури й редактора. |
| Читає | Один публічний довідник: `commerce/shipping-directory.ts` (`loadShippingDirectory`, 4 запити; тір `commerce` не смі імпортувати `translations`) + `commerce/pickup-points.ts`; `core/hooks/useShippingDirectory.ts`; чекаут `checkout-ui/CheckoutDeliveryForm.tsx:335` (показує `estimated_days` тарифу), `ShippingSnapshotLines.tsx`; `storefront/loaders/stock-info.ts:72` (`point_name`), `prepare-checkout.ts:38`. Листи: адреса/метод у листі — зі знімка замовлення. |
| Адреса | Немає. |
| Залежності | method ← rates (CASCADE), method ← points (RESTRICT); zone ← rates (CASCADE), zone ← points (SET NULL); обидві → `orders.shipping_*_id` (SET NULL); знімок `orders.shipping_data` (див. §2). |
| Обсяг | методи ~18 src / ~34 tests, тарифи ~13 / ~14, зони ~18 / ~17, точки ~26 / ~35. Сума з урахуванням перетину ≈ 45–55 src. |

### 1.7 Знижки, групи знижок
| Аспект | Факт |
|---|---|
| Таблиці зараз | `discounts` (`schema.ts:1391`: `name NOT NULL`, `description`, `group_id` CASCADE, `price_type_id`), `discount_groups` (`:1338`: `name NOT NULL`, `description`, самопосилання `parent_group_id` CASCADE); діти `discount_targets` (`:1359`), `discount_conditions` (`:1374`, `value jsonb` — тексту немає). Немає `version`. |
| Сід | Немає; в демо немає. |
| Пише | Легасі: `list/insert/update/removeDiscountGroups`, `getDiscount`, `saveDiscount`, `listDiscounts`, `removeDiscounts` → `impl/discounts/{get,save,save-input,remove,resource}.ts`, `impl/discount-groups/*`. Це вже «агрегат» (знижка + цілі + умови одним `saveDiscount`) — найближчий до товарного зразок. |
| Адмінка | `admin/features/discounts/**` (40 файлів: дерево, групи, картка знижки, цілі, умови, валідатор цін), колекції `discounts.ts`, `discount-groups.ts`. |
| Читає | Рушій цін: `commerce/discount-rules.ts` (сирий SQL `json_agg` з `g.name`, `description`, `:29`) → `discount-rules-parse`/`discount-row-parsers.ts` → `domain/discounts/*`; `AppliedDiscount {id,name,type,value,calculatedAmount,groupName}` (`contracts/objects/discount.ts:74`) показується в кошику (`cart-ui/CartLinePrice.tsx:72`) і адмінці замовлення (`OrderItemsTable.tsx:17`); клієнтський перерахунок через `core/hooks/useDiscountEnvironment` ← `storefront/loaders/discount-environment.ts`; `PriceValidator` (адмін). |
| Адреса | Немає. |
| Залежності | Назви знижки й групи потрапляють у `order_items.discount_data` (знімок, §2). Контекст цін кешується/ділиться клієнтом ⇒ мова в ключі (І36). |
| Обсяг | ~62 src / ~45 tests (найбільше після замовлень). |

### 1.8 Категорії покупців — `user_categories`
| Аспект | Факт |
|---|---|
| Таблиця зараз | `schema.ts:138`: `name NOT NULL`, `code UNIQUE`, `description`, `is_default` (частковий UNIQUE), `price_type_id` (SET NULL). Немає `version`. Є й `user_category_history` (знімки назв `*_category_name`, SET NULL FK; `schema.ts:1055`) — у перелік master не входить (бачить лише адмін). |
| Сід | `0003_seed.sql:54-62`: «Роздріб», id `00000004-…01`, `price_type_id` підзапитом за `code='retail'`. |
| Пише | Легасі: `insert/update/removeUserCategories`, `setDefaultUserCategory`, `assignCustomerCategory`, `countCustomersByCategory`; `impl/user-categories/{resource,remove,set-default,counts}.ts`; провізія профілю бере дефолтну категорію підзапитом (`auth/provision.ts:34`). |
| Адмінка | `admin/features/customer-categories/**` (24 файли; правила `category_rules` — внутрішні, не перекладаються). |
| Читає | Вітрина: лише `storefront/loaders/profile.ts:42` (`category.name` у профілі покупця); `commerce/categories.ts`. |
| Залежності | Цільовий довідник для bootstrap. `price_types` тут — сусід без перекладів (див. «Розбіжності» п. 3). |
| Обсяг | ~31 src / ~25 tests. |

### 1.9 Профіль магазину
| Аспект | Факт |
|---|---|
| Зараз | НЕ таблиця: рядок `system_settings` з ключем `store_profile` (jsonb: `name, homeTitle, description, contacts{phone,email,address,hours}, logo, socials[]`; тип `contracts/store-profile.ts:20-40`, парсер `domain/store-profile.ts`). Сід: `0003_seed.sql:64-71` (id `00000005-…003`, `"name":"Мій магазин"`). Master: синглтон `store_profile` з id `00000008-…01` — префікс `00000008` у сіді вільний (займані 01–07; `00000005` — system_settings). |
| Пише | Легасі `saveStoreProfile` → `impl/settings/save-profile.ts` (115 рядків: логотип через `media`, замок `LOCK_KEYS.storeProfile`, `bumpCacheGeneration`). |
| Адмінка | `admin/features/settings/*` (18 файлів: StoreProfileForm, ProfileFields, LogoCard, SocialsCard, SettingsPage, useSystemSettings, settings-form-schema). |
| Читає | `site/store-profile.ts` (`readStoreProfile`), `site/read-cache.ts:102` (`storeProfileCache`, ключ покоління `store-profile`), `storefront/loaders/store-profile.ts`, `storefront-routes/server/root.ts`, `head/head.ts`, `head/organization.ts` (JSON-LD), `Checkout.tsx`, `Auth.tsx`; листи: `storefront/loaders/order-mail.ts` (назва, email власника), `auth/mail-support.ts`; CLI-канал: `migrate/store-facts.ts:19` (читає jsonb напряму для `status`/`doctor`). Логотип у реєстрі медіа: `domain/media.ts:274` (`LOGO_MEDIA_REFERENCE`, `system_settings.value.logo`) + `storage/references.ts:51`. |
| Адреса | Немає. |
| Обсяг | ~12–15 src / ~13 tests; але торкається медіа-реєстру, CLI-фактів, кеша покоління. |

### 1.10 Плагін FAQ — `plg_faq_items`
| Аспект | Факт |
|---|---|
| Зараз | `packages/simplycms-plugin-faq/migrations/20260814120000_plg_faq_items.sql`: `id uuid PK` (без default), `product_id uuid` (link без FK), `question NOT NULL`, `answer NOT NULL`, `sort_order`, `is_active`, гранти `app_user` select / `app_admin` CRUD. Переклад-таблиці немає. |
| Пише | `usePluginTable('faq','plg_faq_items')` (`src/pages/FaqAdmin.tsx:22`, `src/FaqSlot.tsx:22`) → serverFn `pluginTable*` (`S/plugin-sdk/server/table-db.ts`; усі 6 — у легасі-переліку), гард `assertOwnTable` (`plugin-sdk/server/guard.ts`) пропускає лише `plg_<імʼя>[_…]`, плагін відомий за рядком `plugins`. |
| Читає | `FaqSlot.tsx` на сторінці товару (list `eq {product_id, is_active}`), без локалі. Контекст слота локалі не несе; `usePluginT` уже працює через `useUiLocalePair` (блок 1). |
| Лінт SQL | `packages/cli/src/db-diff.mjs:179` `lintPluginMigrationSql`: усі `REFERENCES <ident>` мусять починатись з `plg_<імʼя>_` (`:211`) ⇒ `REFERENCES public.languages(code)` зараз — порушення. Виняток (спека §18.8, І35) треба додавати + негативні тести. `CALL public.attach_…` у міграції плагіна цим лінтом не ловиться (регекси лише `create/alter/drop/references/trigger/function`). `plugin check` — команди немає (`commands.mjs:6-17`). |
| Обсяг | ~8 файлів плагіна + ядро `plugin-sdk` (порт, `table-db.ts`, `usePluginTable`, типи) + CLI (лінт, `plugin check`) + документація `docs/architecture/plugins.md`. Порт — нова публічна поверхня SDK (minor/BREAKING). |

---

## 2. Замовлення, профілі, відгуки

### 2.1 `orders` і знімки
- Таблиця `orders` (`schema.ts:1161`): колонок `locale` немає. Знімок доставки: `shipping_data jsonb default {}` (`:1181`); тип `ShippingSnapshot = { methodName, provider, pricing, destination }`, де `destination` = `{kind:'address', city, address}` | `{kind:'pickup-point', pointId, name, address, city}` (`contracts/shipping-providers.ts:~70-95`, парсер `domain/shipping-snapshot.ts:50`). Тексти, що потребують `*_default`: `methodName`, `destination.name`, `destination.address`, `destination.city` (пункт видачі). Адресна доставка — дані покупця, не переклад. Знеособлення чіпає `shipping_data.destination` (`commerce/order-privacy.ts:59`, `jsonb_set` за `destination.kind='address'`) — форма знімка впливає й на нього.
- Пише знімок: `storefront/loaders/order-create.ts:74` (`shippingData: {...shippingSnapshot}`, джерело `commerce/shipping-choice.ts:39`, `prepare-checkout.ts:38`); оновлює `impl/order-items/totals.ts:115` (змінює лише `pricing`).
- Читає: `ShippingSnapshotLines.tsx` (OrderSuccess/ProfileOrderDetail), `admin/features/orders/detail/OrderDeliveryCard.tsx`, `OrderTotals.tsx`.
- `order_items` (`schema.ts:238`): `name text NOT NULL`, `discount_data jsonb`, колонки `name_default` немає. `name` = `${товар} - ${модифікація}` (`commerce/price-cart-catalog.ts:~124`), мовою запиту (М1). `discount_data = { applied: AppliedDiscount[] }` з `name` та `groupName` (`commerce/price-items.ts:61`, `contracts/objects/discount.ts:74`) — тексти, що потребують двомовності: `applied[].name`, `applied[].groupName`.
- Пишуть позиції: чекаут (`order-create.ts:98-103`), адмінка додає позицію (`impl/order-items/add.ts:76,106` — зараз бере `primaryLocaleCode`; за master §18.8 має брати `orders.locale`), демо/showcase-скрипти.
- Читають: `storefront/loaders/entities/order.ts`, `orders.ts`, `OrderItemsTable.tsx` (адмінка, `discountData.applied`), листи (`order-mail.ts:toOrderMailData` — `items[].name` із запису).
- Листи: `enqueueOrderMails` (`order-mail.ts`) уже мовно-свідомий (`ctx.text`, `resolveMailUiLocale`), але мова замовлення береться «опублікована мова чекауту»; колонки немає (Д9 блоку 1 це зафіксував). Нова колонка лише підміняє джерело.
- І31 («`*_default` заповнене ⇔ мова замовлення не основна») — потрібен CHECK/тригер: тест `order-snapshot-locale.test.ts` ще не існує.
- RLS: політики `orders_insert_own`, `orders_select_own_or_token` (`schema.ts:~1235`) — NOT NULL колонка `locale` потребує, щоб покупець її передавав при вставці (FK на `languages(code)` — читання `languages` для `app_user` дозволено).
- Обсяг: `orders` ~105 src / ~112 tests (за ім'ям; реально зачеплених — десятки): чекаут, place-order, order-create, admin order items, листи, екрани замовлення, демо/showcase, ~35 pg-тестів що вставляють замовлення.

### 2.2 `profiles.locale`
- `profiles` (`schema.ts:999`) має `ui_locale` (мова адмінки, без FK, блок 1) і НЕ має `locale`. Master: `profiles.locale text NULL REFERENCES languages(code)` — мова вітрини при реєстрації (для листів, спека §19.9: `resolveMailUiLocale({kind:'user', uiLocale, locale})` вже приймає `locale`, `mail/locale.ts:16`).
- Пишуть профіль: `auth/provision.ts:27` (`writeProvision`, `onConflictDoNothing`, виклик із Better Auth `user.create.after` хука + самовідновлення при вході) і `impl/customers/contacts.ts:96`. Мови запиту в хуці немає — потрібен канал `locale` реєстрації → `ProvisionUser` (`auth/hooks.ts`).
- Обсяг: ~5–8 src + pg-тести профілів (~53 файли згадують `profiles`, більшість не зачеплена).

### 2.3 `product_reviews.locale`
- `product_reviews` (`schema.ts:1421`): `title`, `content`, `admin_comment`, `images jsonb`, `status`; `locale` немає; `UNIQUE(product_id,user_id)`; RLS-політики вставки/оновлення покупцем (`:~1438`). Показуються всі, мовою сторінки першими (рішення 18) — ця сортування в `storefront/loaders/reviews.ts` ще не існує.
- Пишуть: `storefront/loaders/reviews-write.ts`, `reviews-edit.ts`; адмін — `impl/reviews/{status,delete,list,card}.ts`. Читає: `reviews.ts`, `core/hooks/useProductReviews.ts`, `core/lib/reviews.ts`, `core/lib/review-form.ts`, `contracts/objects/review.ts`.
- Обсяг: ~10 src / ~36 tests (багато pg-тестів відгуків з вставками, NOT NULL колонка ламає фікстури).

---

## 3. `bootstrapStore` / `primaryLocale` / `create --locale` / `SYSTEM_SEED_IDS`: що є

| Елемент | Стан |
|---|---|
| `bootstrapStore(primaryLocale)` | Немає. Мова сіється в `0003_seed.sql:40-45` (рядок `uk`, коментар: «переїде в `bootstrapStore` у М2»), під `pg_advisory_xact_lock('languages-set')`. |
| `primaryLocale` у `defineConfig` | Немає. `SimplyCmsConfig` = `{ currency, plugins?, themes? }` (`S/runtime/config.ts:20-26`, коментар: поле `locale` знесено блоком 1). Шаблон `packages/create-simplycms-store/template/simplycms.config.ts` — лише `currency: 'UAH'`. |
| `SYSTEM_SEED_IDS` | Немає; `S/schema/seed-ids.ts` має одну константу. id сіду розкидані літералами в `0003_seed.sql` і ~23 файлах тестів/скриптів (`MAIN_SHIPPING_ZONE_ID`, `00000001-…`, `00000004-…`). |
| `create --locale` | Розбіжність із майстром: `simplycms create` (`packages/cli/src/create.mjs`) — це скаффолд ПЛАГІНА/ТЕМИ (`create (plugin\|theme) <name>`), не магазину. Магазин створює `create-simplycms-store` (`src/args.mjs`: `--database-url`, `--no-install`, `--no-git`, `--yes`; інтерактив `steps.mjs` на `@clack/prompts`). `--locale` — нове в `create-simplycms-store`. |
| Місце виклику | Прод-старт: `S/prod-start/run-start.ts:67` (`migrate(...)` під `MIGRATION_DATABASE_URL`, далі `execve server.mjs`), `packages/cli/src/db-apply.mjs:75` (`core.applyMigrations`). Читання `simplycms.config.ts` у цих каналах: CLI редагує/читає конфіг текстовими якорями (`cli/src/config-edit.mjs`); прод-старт конфіг не читає взагалі. Як `bootstrapStore` дізнається `primaryLocale` у проді — відкрите питання (§5). |
| Пакет мови | `LanguagePack.content` = `{ slugify }` лише (`i18n/types.ts:75`, `packs/uk.ts:16`). Текстів системних довідників (6 статусів, «Роздрібна», «Роздріб», «Основна зона», профіль «Мій магазин») у пакеті немає: master §3.6 вимагає їх додати; це нова частина пакета (`content.dictionaries`?) + для `en`. |
| Нова мова | `languages.add` (`impl/languages/operations.ts`) і `languages.fill` (`impl/languages/fill.ts`, 139 рядків; `FILL_BATCH=500`) обробляють лише адреси/токени/проєкцію ТОВАРІВ (`pendingFill`, `completeness.ts`: стадії `path/token/projection`). Дозаповнення перекладів довідників з пакета — немає; `languages.setStatus` (`status.ts`) перевіряє повноту лише товарів. |
| Тести | `test:schema`: накат на чисту БД без bootstrap (`test-harness/pg/apply.mjs`, `baseline.test.ts`); тест основної зони `shipping-zone-invariant.test.ts` працює на сіді. Усі тести, що розраховують на сід (статуси/категорія/тип ціни/зона/мова `uk`), зламаються без bootstrap у харнесі. |

---

## 4. Адреси: що доведеться розширити для розділів/властивостей/опцій

- `url_paths`: колонка лише `product_id` (`schema.ts:660-688`); CHECK `url_paths_one_target = num_nonnulls(product_id)=1`; частковий UNIQUE `idx_url_paths_current_product`. Потрібні `section_id/property_id/option_id` + FK + CHECK + 3 часткові UNIQUE (форма — master §3.1).
- `slug_tokens`: тільки `modification_id`; `token_kind` згенерований з `ELSE 'unknown'` (`schema.ts:~704`, master: `'property'`/`'option'`); `one_target` CHECK; складений FK модифікації. Для опції — `(scope_id, option_id) → property_options(property_id,id)` (ціль уже є); для властивості — `property_id` + CHECK `property_id IS NULL OR scope_id IS NULL`.
- Тригери: `attach_current_address_triggers`/`attach_current_token_triggers` викликаються лише для product/modification (`0004:875-876`); хелпери БЕЗ параметра умови (на відміну від `attach_source_translation_triggers`, що має `condition`). Сторінка існує лише за `has_page` (властивість і її опції) — а І16/І21 вимагають поточну адресу для КОЖНОЇ сутності. Якщо адреса потрібна лише для `has_page`, хелпер треба розширити умовою; якщо для всіх властивостей/опцій — URL-простір дістануть і властивості без сторінки (див. §5).
- Код: `AddressTarget`/`TokenTarget` — union з одним видом (`addressing/paths.ts:23`, `tokens.ts:19`); `PATH_TARGET_COLUMNS` (`paths.ts:31`); `pathCandidates`/`tokenCandidates` (`copy-candidates.ts`) і `copyPathsForLocale/copyTokensForLocale` — для product-only; `currentPathOwners` вже узагальнено за реєстром колонок.
- Резолвер вітрини: `loadEntityPage` (`storefront-routes/pages/entity-route.ts`) і роут `_storefront/$path.tsx` повертають лише товар (`getProduct`/`getMovedProductPath`); нормалізація `storefront-routes/seo/normalize.ts`, `history.ts`, `entity-history.ts` — product-only. Роути `catalog/$sectionSlug`, `properties/…` досі за slug-колонками.
- Службові сегменти: `properties` у `RESERVED_SEGMENTS` вже є; після заміни форми адрес опцій сегмент лишається службовим (Р12).

---

## 5. Залежності й пропонований порядок блоків

Жорсткі залежності:
1. Фундамент (baseline-правки) — спільний для всіх: `schema.ts` + `rebaseline` + `0002_grants`/`fixtures/grants.ts` + `0003`/`0004` + `template:sync`. Кожна нова таблиця = рядок у `0002_grants` (дві секції `:65-97`, `:152-198`) і `attach_source_translation_triggers` у `0004`.
2. `bootstrapStore` + `SYSTEM_SEED_IDS` + розширення `LanguagePack` + `primaryLocale` у конфігу/`create-simplycms-store` — ДО (або разом із) першою перекладною таблицею довідника, що сіється (статуси, категорія, зона, профіль): інакше `0003` порушує І4, а `test:schema` без bootstrap не накочується. Усі ~23 файли з літералами id сіду й харнес переходять на `SYSTEM_SEED_IDS` + bootstrap.
3. Розділи → властивості → опції (опція має складений FK на властивість; токен опції має `scope_id` = властивість; сторінки опцій — під `has_page` батька). Розділи незалежні від властивостей, але потрібні банерам (ціль) і товарам.
4. Розширення `addressing` (нові види цілей, `url_paths`/`slug_tokens`, тригери, `languages.fill/completeness/setStatus`, резолвер `/<path>` для розділів/опцій, sitemap) — спільна підсистема блоку 3; має бути готова до першої сутності з адресою.
5. Банери+кнопки — після (3) і (4): ціль кнопки = товар/розділ/властивість/опція (типізовані FK RESTRICT), посилання на мову розв'язує резолвер адрес.
6. Доставка (способи → тарифи/зони/точки) і знижки (групи → знижки), категорії покупців, статуси — між собою незалежні (крім method→rate/point), але ВСІ — до замовлень.
7. Замовлення (`orders.locale`, `order_items.name_default`, `*_default` у `discount_data`/`shipping_data`) — після перекладів доставки й знижок (знімок читає основну мову обох) і після `bootstrapStore` (мова замовлення = FK на `languages`).
8. Профіль магазину, `profiles.locale`, `product_reviews.locale` — дрібні, незалежні; профіль магазину залежить від bootstrap (сід назви) і медіа-реєстру (логотип).
9. Плагіни (порт, FAQ, лінт, `plugin check`) — незалежні від сутностей ядра за даними, але залежать від «форми» перекладної таблиці й від машини станів мов; можна останніми.

Пропонований порядок блоків (кожен — окрема гілка/ревізія за SDD):
- **Блок 2 «Системні довідники й bootstrap»:** `SYSTEM_SEED_IDS`, `primaryLocale` у конфігу й `create-simplycms-store --locale`, `bootstrapStore` (прод-старт, `db:apply`, харнес, `db:demo`, `db:showcase`, pilot), тексти довідників у пакеті, переклади `order_statuses`, `user_categories`, `shipping_zones` (+ `store_profile` синглтон з перекладами), `languages.add` дозаповнює довідники. Закриває І40.
- **Блок 3 «Розділи, властивості, опції + адреси»:** `section_translations`, `section_property_translations`, `property_option_translations`, розширення `url_paths`/`slug_tokens`/тригерів/addressing/fill/completeness, агрегатні операції, вітрина (сторінки, фасети-читачі, sitemap), адмінка, знос `section_properties.options`/колонок `slug` і текстів.
- **Блок 4 «Банери»:** `banner_buttons`, `banner_translations`, `banner_button_translations`, `version`, UI вибору цілі.
- **Блок 5 «Доставка й знижки»:** способи, тарифи, зони, точки (+структура `working_hours`), знижки/групи; оновлення `shipping-directory`, `discount-rules`, discount-environment.
- **Блок 6 «Замовлення, профілі, відгуки»:** `orders.locale`, знімки, листи, `profiles.locale`, `product_reviews.locale`, І31, `languages-remove-referenced`.
- **Блок 7 «Плагіни»:** конвенція, агрегатний порт (І35), виняток лінту, FAQ, `plugin check`, `docs/architecture/plugins.md`.
(Блоки 4–5 можна міняти місцями; 2 краще першим через вплив на харнес.)

Орієнтир масштабу: М1 (фундамент + товар) = 729 змінених файлів / +35k −7k рядків (`git diff --stat 8145370b..c8109c45`). Один агрегат товару в адмін-сервері — 25 файлів `admin-server/impl/products/aggregate/*` (2224 рядки) для найскладнішої сутності.

---

## 6. Розбіжності майстра з кодом

| № | Очікувалось (майстер) | Фактично | Доказ |
|---|---|---|---|
| 1 | `banner_buttons` як таблиця з типізованими FK (Р10); у §3.1 колонки кнопок не названо | Кнопки — `banners.buttons jsonb` `{text,url,target,variant}`; `url` вільний рядок, зв'язку із сутністю немає; колонки `link_kind/<тип>_id/external_url/target_blank` — нові, форму фіксує план М2 | `schema.ts:1466`, `domain/banner.ts:19,36-49`, master Р10 `:42` |
| 2 | `simplycms create --locale <code>` | `simplycms create` створює лише плагін/тему; магазин — пакет `create-simplycms-store` без `--locale` | `cli/src/create.mjs:1-76`, `create-simplycms-store/src/args.mjs:46-60` |
| 3 | §3.6: bootstrap сіє «вид ціни» разом з перекладами, а `price_types` не мають перекладної таблиці | Спека §5.1 і майстер §3.1 виводять `price_types` з перекладів (внутрішні назви), але сід містить `name='Роздрібна'` українською (`0003:47`); при незалежній від мови назві тип ціни все одно дістає укр. текст у не-укр. магазині. Треба рішення: переклад/нейтральне ім'я/сід за пакетом без таблиці | `0003_seed.sql:47-49`, master `:297` vs `:105-118` |
| 4 | §3.6: bootstrap сіє «способи доставки» | Сід має лише основну зону; методів/тарифів/точок немає і не мають бути (комент `0003:4-8`) | `0003_seed.sql:115-117` |
| 5 | Перелік М2 включає «Знос `VITE_LOCALE`/`declareStoreLocale`/`config.locale`» і «Хардкоди `'uk-UA'`» | Уже зроблено блоком 1 (PR #64); `config.locale` знесено, хардкодів у `S/` немає | `runtime/config.ts:14-19`, CHANGELOG `[Unreleased]`, grep `uk-UA` порожній |
| 6 | Master §2/ж: «136 serverFn» | Легасі-перелік містить 120 імен (109 + 6 + 3 + 2); решта вже на реєстрі/знесені | `eslint-rules/legacy-admin-server-fns.json`, roadmap `platform-roadmap.md:~55` |
| 7 | І16/І21: для кожної сутності й мови поточна адреса/токен | Сторінки властивостей/опцій існують лише при `has_page`; хелпери `attach_current_*_triggers` умови не мають. Майстер не вказує, чи адресується кожна властивість/опція, чи лише `has_page`; токен фільтра потрібен лише `is_filterable` | `schema.ts:123`, `loaders/properties.ts` (предикат `hasPage`), `0004_functions.sql:875-876` |
| 8 | `section_property_translations(name, unit)`, «одиниця виміру (нове поле)» | `unit` у `section_properties` колонки немає; вона з'являється лише в перекладі (нова функція адмінки/вітрини) | `schema.ts:113-130` |
| 9 | `store_profile` — синглтон-таблиця з `phone, email, logo_ref, socials` | Зараз `system_settings['store_profile']` jsonb; логотип у медіа-реєстрі через спеціальну гілку `LOGO_MEDIA_REFERENCE`; `migrate/store-facts.ts` читає jsonb напряму (CLI-канал без домену) — потрібні правки в трьох місцях | `contracts/store-profile.ts:20`, `domain/media.ts:274`, `migrate/store-facts.ts:19` |
| 10 | Версія агрегата «на кореневих таблицях М2 (розділ, властивість, банер, точка, спосіб доставки тощо)» | Перелік відкритий («тощо»); невизначено: опція — окремий корінь чи дитина властивості (має власні адресу, токен, медіа, адмін-сторінку); тарифи — діти методу; знижка/група/статус/категорія/зона/профіль магазину | master `:166`, `schema.ts:376` |
| 11 | `pickup_point_translations(name, address, city, hours_note)` + Р9 структура `working_hours` | `working_hours` зараз типізований як `{monday?: string…}`, у адмінці readonly і завжди `{}`; нова структура `{open,close}` і її редактор — нова функція, не міграція даних | `contracts/objects/shipping.ts:78`, `pickup-points/resource.ts:35`, `usePickupPointCard.ts:104` |
| 12 | `property_option_translations (+property_id)` має `image_ref`, `image_alt` | Медіа-реєстр (`MEDIA_COLUMNS`) прив'язаний до колонок баз (`sections.image_url`, `property_options.image_url`, 3 колонки банера, `:224-247`); тест парності з реєстром (`media-columns-coverage`) і sweep-гейт змушують переписати реєстр під колонки перекладів (форма `idExpression` для складеного PK уже є для `product_image_translations`) | `domain/media.ts:199-250` |
| 13 | Master §3.6: `0003` сіє лише НЕпереклaдні таблиці | Також сіє `languages` (`uk`), `system_settings` (`store_profile` з укр. назвою), `cache_generations`, `themes`; `languages` і `store_profile` переїжджають у bootstrap, `system_settings.store_profile` зникає. Тест `seed-ids.test.ts` читає `0003` | `0003_seed.sql:40,64,84,93`; `schema/__tests__/seed-ids.test.ts:13` |

---

## 7. Відкриті питання для власника/архітектора (з інвентаря)

1. `price_types.name`: переклад, нейтральний код чи сід з пакета без перекладної таблиці (розбіжність №3).
2. Адресність властивостей/опцій: усі чи лише `has_page` (№7); токени — усі чи лише `is_filterable`. Від цього залежить, чи розширювати хелпери тригерів умовою.
3. Опція — окремий агрегат (власний `version`, команди) чи дитина властивості (№10).
4. Як `bootstrapStore` дізнається `primaryLocale` у проді (`prod-start` не читає `simplycms.config.ts`; CLI читає його текстовими якорями) — env, читання TS-конфігу чи інше. Майстер Р7 фіксує «у конфігу» й «`start.mjs` прапорця не несе».
5. Форма `banner_buttons` (колонки цілі) — майстер лише описує загалом; і чи лишається вільний `url` для зовнішніх посилань.
6. `user_category_history.*_category_name` (знімок назви категорії в історії переведень) — мовою якої писати знімок (основна; видима лише адміну), у перелік master не входить.
7. Узагальнення замість 14 копій: окремі агрегати на кожну сутність (як `products.*`, 25 файлів) чи спільний «простий перекладний агрегат» над `defineAdminResource` (`readModel` уже є, а `translations`-запис — ні).
