# Зміни

Формат — [Keep a Changelog](https://keepachangelog.com/uk/1.1.0/).

Проєкт дотримується semver з 1.0: злам сумісності коду магазину, тем чи
плагінів → мажорна версія; нове без зламу → minor; виправлення → patch.

🔴 **Версія у SimplyCMS синхронна:** усі публіковані пакети завжди мають один
номер. Отже підняття версії **не** означає, що змінився кожен пакет — розділи
нижче називають, що саме змінилось і в кому. Процес випуску —
[`docs/architecture/release-process.md`](docs/architecture/release-process.md).

🔴 **Кількість пакетів змінилась у `0.4.0`:** до `0.3.x` їх було 26 (25
`@simplycms/*` + unscoped `create-simplycms-store`), з `0.4.0` — **5**
(unscoped `simplycms` + `@simplycms/{cli,theme-solarstore,plugin-faq}` +
`create-simplycms-store`). Записи про версії `0.1.0`–`0.3.0` нижче називають
пакети СТАРИМИ іменами — так вони й лежать у реєстрі; мапа старих імен на
субшляхи — у [`packages/README.md`](packages/README.md).

Дати — це дати **публікації в реєстрі npm**, а не коміту.

---

## [Unreleased]

Хвиля мультимовності даних (М1, фундамент): спека
[`2026-10-14-multilingual-wave-design.md`](docs/superpowers/specs/2026-10-14-multilingual-wave-design.md),
майстер-план
[`2026-10-15-multilingual-wave-master.md`](docs/superpowers/plans/2026-10-15-multilingual-wave-master.md).
Магазинів на SimplyCMS немає — без зворотної сумісності.

**Зведення М1** (реалізовано, чекає приймання архітектора; реліз — з кінця хвилі): мови з машиною станів
у БД (`languages`, операції `languages.*`); товар наскрізно в перекладах — тексти, модифікації, значення
властивостей і фото по мовах з обов'язковим перекладом основної мови на коміті; реєстри адрес
(`url_paths`) і мовних токенів (`slug_tokens`) з історією й рівно одним 301; реєстр операцій з єдиним
виконавцем, serverFn-обгортками й HTTP API `/api/v1` (токени, `Idempotency-Key`, problem+json, OpenAPI);
проєкція тексту товару `catalog_product_texts`; сторінка товару `/<path>` і `/<мова>/<path>` з hreflang,
`noindex` і canonical; картка товару в адмінці з вкладками мов. Канон —
`docs/architecture/translations.md` і `docs/architecture/operations-api.md`. Решта сутностей — М2.

### 🔴 BREAKING для магазинів

- **Адмінка товару — на командах агрегата** (`simplycms/admin-server`, `simplycms/admin-data`): картка з вкладками мов;
  модифікації, значення властивостей і фото зберігаються одним `products.saveDescription` разом із текстами (кнопка
  «Зберегти»), адреса мови — `products.setPath`, ціни й залишки — `products.savePrices`/`products.saveStock`, видалення —
  `products.remove` з версією. Прибрано serverFn-обгортки `insertProducts`/`updateProducts`/`removeProducts`,
  `insert|update|remove` для `ProductModifications`, `ProductPropertyValues`, `ModificationPropertyValues`,
  `setDefaultProductModification`, `reorderProductModification` і старі `saveProductPrices`/`saveStock`; колекції товару,
  модифікацій і значень властивостей `admin-data` — лише читання (без `persistenceHandlers`). Ручний статус наявності
  модифікації — поле `stockStatus` у `modifications.upsert` і у виході `products.get` (як `base.stockStatus` товару); `saveStock` далі виводить його з залишків. 412 при збереженні — діалог «Товар змінив хтось інший».
- **Решта читачів товару — на перекладах і проєкції** (`simplycms/storefront/loaders`, `simplycms/storefront-routes`,
  `simplycms/commerce`, `simplycms/catalog-ui`, `simplycms/contracts`): лістинги, головна, посекційні добірки, сторінка значення
  характеристики, кошик, чекаут і знімок `order_items.name` читають назву, адресу й короткий опис товару мовою запиту з
  `catalog_product_texts` (модифікації — переклад мови, інакше основна). Лоадери й `quoteCartFor`/`quoteCheckoutFor`/`placeOrderFor`/
  `priceItems`/`priceCart`/`loadCatalog` дістали обов'язковий параметр `text: TextLocale` (`{ locale, primary }`, тип у
  `simplycms/domain/translations`); серверні функції `getCatalogPageData`, `getSectionPageData`, `getCatalogProducts`,
  `getHomePageData`, `getFeaturedProducts`, `getNewProducts`, `getSectionProducts`, `getPropertyOption`, `quoteCart`,
  `quoteCheckout`, `placeOrder` приймають `locale`; невідома чи неопублікована мова читається основною (`resolveTextLocale`).
  `slug` картки списку — поточна адреса ЦІЄЇ мови (`/en/<path en>`), `ProductCardViewModel`/`ProductCard` дістали
  `name_lang`/`short_description_lang` (fallback-текст має `lang` основної мови; тема з власною карткою мусить їх застосувати).
  Ключ квоти кошика — `[…AGGREGATE.cartQuote.keyFor(locale), userId, …]`. `FallbackText` переїхав у `simplycms/ui/fallback-text`.
  Адмін-читачі (позиції замовлення, діагностика ціни, відгуки) читають назву основною мовою; пошук товару для замовлення —
  за назвою будь-якою мовою й артикулом; `AdminReviewCard.productSlug` → `productPath` (шлях основної мови або `null`).
  Знімок замовлення одномовний (мова запиту); двомовний знімок і `orders.locale` — М2.
  `placeOrder` відмовляє (помилка валідації) для мови, що не `published`; читання з невідомою/неопублікованою мовою
  віддають основну. `CartQuoteLine` дістав `productName`/`modificationName` окремо та `productNameLang`/`modificationNameLang`;
  позиція кошика в localStorage — `namesLocale` (мова збережених назв): видимий кошик показує назви з квоти, а кеш — лише
  коли його мова = мова сторінки (інакше скелетон). `useCart` дістав `syncNames`; слот `ProductAddToCart` ставить `namesLocale`.
  Колекції адмінки `products`/`product_modifications` читають назву з перекладу ОСНОВНОЇ мови (read-model фабрики ресурсу:
  `readModel` у конфігу `defineAdminResource`; рядок `list` без `slug`, описів і `meta_*`, типи `ProductReadRow`/
  `ProductModificationReadRow`); товар без перекладу основної мови в колекцію не потрапляє. Рядки значень характеристик у
  вибірці каталогу не несуть `value` (фільтри читають `option_id`/`bool_value`/`numeric_value`).
- **Сторінка товару — за адресою з реєстру** (`simplycms/storefront-routes`, `simplycms/domain`, `simplycms/contracts`):
  товар відкривається на `/<path>` і `/<мова>/<path>` (роут сутності `routes/storefront/_storefront/$path.tsx`); прибрано роут
  `/catalog/$sectionSlug/$productSlug`, редірект сегмента розділу та зарезервований slug розділу `all` (`NO_SECTION_SLUG`,
  `isReservedSectionSlug`, `productRedirectTarget`). `productPath({ path, locale?, primary? })` замість
  `productPath({ slug, sectionSlug })`, `LinkResolver.product({ path })`, `getProduct({ locale, path })`,
  `getModificationData({ productId, locale })`, `loadProduct(db, { locale, path }, viewer)`; `?mod=` — токен поточної мови
  (`slug_tokens`). Історична адреса й історичний `?mod=` дають ОДИН 301 разом із префіксом основної мови, слешем і формою
  query; `title`/`description`/`og:*` беруть `meta_title`/`meta_description` (опис без HTML-тегів), `robots`, hreflang з
  `x-default`, `og:locale` — мовою версії; sitemap товарів — рядок на опубліковану мову з `<xhtml:link>`. View-моделі
  `ProductDetailSummary`/`ProductDetailDescription`/`BreadcrumbItem` дістали необов'язкові `nameLang`, `shortDescriptionLang`,
  `lang` (fallback-фрагменти мають `lang` основної мови); тема, що підмінює view, мусить їх застосувати.
- **Baseline змінено — базу перестворити** (до `1.0.0-rc.1` baseline `0000…0004` не заморожено):
  `mail_outbox` злито в `0001_init.sql`, окремий `0005_mail_outbox.sql` прибрано;
  `languages` перебудовано (`code text` з CHECK формату BCP 47, `status` замість
  `is_active`, `sort_order`, `UNIQUE(lower(code))`, тригер `languages_guard`);
  нові таблиці `url_paths` і `slug_tokens` (+ `UNIQUE(product_id, id)` на `product_modifications`, функції й тригери наявності
  поточної адреси/токена в `0004_functions.sql`);
  тригер `languages_require_lock` (`0004_functions.sql`): запис у `languages` лише під ексклюзивним замком `languages-set`;
  `0003_seed.sql` бере цей замок перед вставкою основної мови;
  `0002_grants.sql` видає `app_admin` права на `mail_outbox`;
  тригер `addresses_require_languages_lock` (SQLSTATE `SC004`, `0004_functions.sql`): запис у `url_paths` і `slug_tokens` (INSERT/UPDATE) лише під замком `languages-set` (спільним або ексклюзивним), спільна SQL-функція `advisory_lock_held` (на неї переведено й `languages_require_lock`; EXECUTE видано `app_*`);
  нові таблиці `api_tokens` (лише sha256-хеш токена), `idempotency_keys` (складений PK, без `id`) і `service_accounts` (PK `user_id`), права лише `app_admin`; тригери `accounts_refuse_service`/`service_accounts_refuse_human` (`0004_functions.sql`);
  переклади товару (expand, М1 Task 10): нові таблиці `product_translations`, `product_modification_translations`
  (складений FK на `(product_id, id)` модифікації), `product_images`, `product_image_translations`,
  `product_property_value_translations`, `modification_property_value_translations` (PK `(<e>_id, locale)` без `id`,
  `locale → languages(code) ON DELETE RESTRICT`, `source_hashes`, права `app_user` SELECT / `app_admin` CRUD);
  у `product_property_values` і `modification_property_values` — `value_kind NOT NULL`, `bool_value`,
  `color_value` (обмеження Р18 — див. пункт «Contract товару» нижче), `modification_property_values.numeric_value` →
  `numeric(15,4)`; `products.version`; `UNIQUE(id, property_type)` на `section_properties` і `UNIQUE(property_id, id)`
  на `property_options`; демо-сід пише переклад основною мовою, адресу й токен для товарів і модифікацій;
  проєкція тексту товару (М1 Task 14, І23): нова таблиця `catalog_product_texts` (PK `(product_id, locale)`, CASCADE на товар і мову,
  індекс `(locale, path)`, права `app_user` SELECT / `app_admin` CRUD) і CHECK `product_translations_{name,short_description,meta_title,meta_description}_text`
  (плоске перекладне поле — `NULL` або з непорожнім текстом; `''` і самі пробіли в обхід команди відхиляються);
  колонка `fallback_fields text[] NOT NULL DEFAULT '{}'` (Task 15: поля тексту, узяті з основної мови; рахує той самий SQL-будівник, що й текст, звіряє `reconcile`; вітрина обгортає їх `lang`);
  демо-сід пише проєкцію основної мови;
  Локально — порожня БД і
  `pnpm simplycms db:apply`, на сервері — новий порожній екземпляр БД.
- **Contract товару (М1 Task 17): старі колонки знесено, форму тримає БД** (`simplycms/schema`, `simplycms/admin-server`,
  `simplycms/storefront`, `simplycms/domain`): з `products` прибрано `slug`, `name`, `short_description`, `description`,
  `meta_title`, `meta_description`, `images`, а також `return_policy`/`shipping_details` (Р8: мертві дані без
  читача); з `product_modifications` —
  `slug`, `name`, `images`; з `*_property_values` — `value`. Тексти — лише в перекладах, адреса товару — `url_paths`
  (сторінка `/<path>`), токен модифікації — `slug_tokens`, фото — `product_images` (вітрина й мініатюра адмінки читають
  галерею `productGallerySql`/`modificationGallerySql`/`mainImageSql` з `simplycms/translations`; read-model фабрики
  дістав обчислені поля `computed`, рядок колекції товарів — `mainImage` замість `images`). Значення властивостей:
  складені FK `(property_id, value_kind) → section_properties(id, property_type)` (`ON UPDATE RESTRICT`: тип властивості
  з наявними значеннями не змінюється) і `(property_id, option_id) → property_options(property_id, id)` (`ON DELETE
  CASCADE`), CHECK «рівно одна колонка за `value_kind`» і формату кольору, частковий UNIQUE `(власник, property_id)
  WHERE value_kind <> 'multiselect'`. Увімкнено constraint-тригери обов'язкового перекладу основної мови (товар,
  модифікація, текстове значення) і наявності поточної адреси/токена на базі (рядок товару без перекладу основної мови
  чи без поточної адреси в кожній мові `draft`/`published` не комітиться). Узагальнений CRUD товару, модифікацій і
  значень (`productsOps`, `productModificationsOps`, `*PropertyValuesOps`) — лише читання й видалення; тип медіа
  `product_modification` прибрано з `MEDIA_ENTITY_TYPES`; `SLUG_RE` (`simplycms/domain`) → `SLUG_FORMAT`
  (`simplycms/domain/slugs`); `isForeignKeyViolation(error, constraint?)` і новий `isCheckViolation(error, constraint?)`
  (`simplycms/db`) розпізнають обмеження за іменем. Фабрика `defineAdminResource` (`simplycms/admin-server/impl`): опція
  `media` приймає лише `text`-колонки (jsonb-масив референсів — помилка конфігу; каскад `cascadeMedia` jsonb лишається),
  поле `readModel.exclude` знесено (споживача не лишилось), поле перекладу без `required` типізоване з `null`.
- **Фото товару мовою сторінки (М1 Task 17б)** (`simplycms/contracts/views`, `simplycms/translations`,
  `simplycms/storefront/loaders`, `simplycms/storefront-routes`, `simplycms/catalog-ui`): сторінка товару, галерея
  модифікації й мініатюри лістингів показують перевизначення файлу мови (`product_image_translations.storage_key`) і alt
  мови сторінки, інакше alt основної мови з `lang`, а без жодного — `alt=""` (не назва товару). `images` у
  `ProductCardViewModel`, `ProductDetailGallery`, рядках лоадерів товару й модифікації — масив
  `ProductImageViewModel` (`{ url, alt, alt_lang? }`) замість рядків URL; тема з власним view рендерить
  `<img src={url} alt={alt} lang={alt_lang}>`. `productGallerySql`/`modificationGallerySql` приймають `(owner, locale,
  primary)`; декодер галереї — `toGallery` (`toImageList` лишився для фото відгуків); `productBaseColumns` і
  `homeProductColumns` — функції мови; `loadProduct`/`loadProductPageBase` дістали обов'язковий параметр `primary`
  (основна мова з `loadLocaleSet()` на межі — галерея в тому самому запиті, що й мовна версія);
  `ProductListItem.imageUrl` → `image`; `ProductGallery` без пропа `productName`, мініатюри мають `aria-label` (новий
  ключ `product.galleryThumb`). Кошик: рядок квоти (`AvailableCartQuoteLine.image`) несе мініатюру мовою запиту
  (`lineImageSql`: перше фото модифікації, інакше товару), `CartItem.image` у localStorage — `ProductImageViewModel` під
  міткою `namesLocale` (кеш іншої мови до квоти — скелетон, після квоти оновлюється); старий рядок URL відкидається.
  У даних alt `''` — явно декоративне в мові (без fallback), `null` — перекладу немає (alt основної).
- **Псевдоніми замків прибрано:** `ADMIN_ROLES_LOCK` (`simplycms/auth`), `CUSTOMER_CONFIG_LOCK` і
  `DISCOUNT_CONFIG_LOCK` (`simplycms/admin-server/impl`) та внутрішні `*_LOCK` модулів видалено; ключі
  беруться з реєстру: `LOCK_KEYS.adminRoles`, `LOCK_KEYS.customerConfig`, `LOCK_KEYS.discountConfig` тощо
  (`simplycms/db/lock-keys`).
- **serverFn віддає вихід, розібраний схемою операції:** поля поза `output` відсікаються (раніше serverFn
  віддавав сирий результат `run`, а HTTP — відсічений); обидва транспорти беруть одне значення.
- **Агрегат товару через реєстр операцій (М1, Task 11):** `products.create` (ідемпотентна), `products.get`,
  `products.saveDescription`, `products.saveTranslation`, `products.deleteTranslation`, `products.setPath`,
  `products.remove` + serverFn-обгортки (`createProduct`, `getProduct`, …). Кожна команда: `FOR NO KEY UPDATE` кореня →
  версія (412) → хеш джерела (409) → запис → `version + 1`. Поля текстів на дроті camelCase (`shortDescription`),
  ключі `source_hashes` у БД — колонки (`short_description`). `simplycms/translations`: `TRANSLATABLE`,
  `loadTranslations`, `applyTranslationPlan`, `deleteTranslation`, `withFallback`. `If-Match` приймає лише
  операція з `expectedVersion` у вході (інакше 400); відповіді версіонованих операцій, у т.ч. ідемпотентний
  replay, несуть `ETag: "v<n>"`. `hasText`/`normalizeTextInput`/`fieldStatus` (`simplycms/domain/translations`)
  тепер вимагають аргумент `rich`; `hasRichText` розбирає розмітку токенайзером, а не регексом.
  Фікс-раунд: `products.get` вимагає `catalog.write` (не `catalog.read`, який має покупець); новий код
  валідації `path_required` (`VALIDATION_ISSUE_CODES`, ключі uk/en); `OperationContext.afterCommit` — хвіст
  після коміту (`products.remove` стирає файли); `saveTranslation` вимагає хеш у `expectedSourceHashes` для
  кожного надісланого поля з непорожнім джерелом; валідація входу команд іде перед перевіркою версії;
  невидимі символи (`&ensp;`, `&#00160;`, U+200B…U+FEFF) — не вміст поля.
- **`setExplicitPath`/`setExplicitToken`** самі беруть спільний замок `languages-set`.
- **Проєкція тексту товару (М1 Task 14):** новий субшлях `simplycms/catalog-projection` (server-only) —
  `refreshProductTexts` (синхронно в транзакції команд товару, спільний замок `languages-set`),
  `buildMissingProjection` (етап `languages.fill`, лише `DO NOTHING`), `dropLocaleProjection`,
  `reconcileProductTexts`/`localeProjectionMismatches` (звірка з джерелом, паритет SQL-предиката
  `is_translated` з `isTranslatedForSeo`). `languages.setStatus` знімає проєкцію мови при `disabled` і
  дозбирає при поверненні, а відмова `language_incomplete` називає товари й етап
  (`['products', id, 'path'|'token'|'projection']`); `languages.fill` будує проєкцію лише з адрес,
  закомічених попереднім викликом (пакет, що скопіював адресу, повертає `done: false` без проєкції —
  інакше паралельна команда лишала б рядок мови застарілим, І23); `languages.fill` і звірка беруть на товарах і модифікаціях лише `FOR KEY SHARE`
  (за id, корінь раніше за модифікації). Порядок замків агрегата — `languages-set` -> корені -> дочірні: замок кореня
  (`lockAggregateRoots`: команди `FOR NO KEY UPDATE`, `products.remove` — `FOR UPDATE`, пакетний remove модифікацій) сам
  бере спільний `languages-set` перед рядком кореня; рядки `product_modifications` видаляє лише `deleteModifications`
  (`FOR UPDATE ORDER BY id`, хук ресурсу `deleteRows`; узагальнений DELETE фабрики на цій таблиці відмовляє); fill
  пропускає вже наявну поточну адресу/токен мови (`ON CONFLICT` на частковий UNIQUE), а команда, що програла таку
  паралельну вставку, отримує 409 `state: concurrent_change` («повторіть»), не `path_taken`/`slug_taken`; fill і
  `setStatus` відмовляють з переліком id, якщо пакет не просувається;
  `completeness.missingProjection` — кількість усіх розбіжностей звірки.
- **`pnpm gates`:** повний ланцюг гейтів + `pilot` одним переліком з `pnpm release`, відмовляє на брудному
  дереві (до і після прогону), пише `.gates-stamp.json`. У релізі `test:schema` тепер стоїть на місці з
  `AGENTS.md` (гейт `test:schema`, раніше `schema` після `test:packaging`).
- **Класи доменних помилок переїхали:** `ValidationError`, `AdminConflictError`, `AdminNotFoundError` і `stateConflict`
  імпортуються з `simplycms/contracts/domain-errors` (раніше `simplycms/admin-server/impl`, звідки реекспорт прибрано).
  Новий код поля `reserved` (`VALIDATION_ISSUE_CODES`) для зарезервованої адреси.
- **`createPathsForEntity`/`createTokensForEntity` без параметра `locales`:** самі беруть спільний замок
  `languages-set` і читають мови `draft`/`published` після нього (Review Focus 1).
- **`shouldValidateCsrf(method, pathname, headers)`:** запит `/api/v1/` з `Authorization: Bearer` CSRF не
  перевіряє (cookie-запит і `Authorization: Basic` — як і раніше). Статус помилки serverFn обчислюється з
  `toProblem` (єдина карта «доменна помилка → (status, kind)»): `CodedError` тепер дає 400.
- **`toAdminConflict` переїхав у `simplycms/db`** (`pg-errors`: також `isUniqueViolation`,
  `isForeignKeyViolation`; єдиний розбір `.cause`, UPSTREAM:DRZ-1); `admin-server/impl/errors.ts` видалено.
  Тип `CoreActor` — з `simplycms/auth` (раніше з `simplycms/admin-server/impl`).
- **i18n: відкритий `Locale`, `createTranslator(locale, fallback)`, `normalizeLocale` знесено:** `Locale` —
  відкритий рядок BCP 47 (мови додає власник магазину, а не ядро). `createTranslator` приймає ДРУГИМ
  аргументом обов'язкову fallback-мову (основна мова магазину, не обов'язково `uk`); ланцюг — «каталог
  мови → каталог fallback → ключ». `normalizeLocale` видалено. Для `config.locale` з регіоном (`uk-UA`) є тимчасовий міст
  `languageOfConfigLocale` (`uk-UA` → `uk`; невідому мову не підміняє, регіон кодів мов магазину
  вона зрізати не призначена — зникне разом із `config.locale` у М2). Код магазину, що кличе
  `createTranslator(x)` чи `normalizeLocale(x)`, переходить на
  `createTranslator(languageOfConfigLocale(x), 'uk')`.
  Файли `src/routes/__root.tsx`, `src/route-error.tsx`, `src/server.ts` у шаблоні магазину вже
  оновлено. `ThemeMessages` і `PluginMessages` тепер з ключем-рядком (раніше `'uk' | 'en'`).
- **Мовний контекст запиту вітрини** (Task 9): мова — лише з першого сегмента URL. Host-файли
  `src/server.ts` (обгортка `withStorefrontNormalize` усередині `withRequestContext`), `src/router.tsx`
  (`createRouterLocale()`: `rewrite` + `context.locales`), `src/routes/__root.tsx`
  (`loadStorefrontRoot`, `RootNotFound`, `<html {...htmlLangAttrs(locale)}>`, скрипт
  `serializeLocalesScript`, `fallback` у `I18nProvider`) і `src/route-error.tsx` (`useRequestTranslator`)
  оновлено в шаблоні; магазин без цих правок падає на старті роутера. `RouterContext` має обов'язкове
  `locales`; `StorefrontRootData` — `languages`, а `locale` тепер код мови сторінки (не тег `uk-UA`);
  `I18nProvider` приймає `fallback` (основна мова), `useFallbackLocale()`. Ключі кешу вітрини з
  мовою: `entityKey(entity, locale)`, `AGGREGATE.<x>.keyFor(locale)`, `catalogKeys.sectionProducts(id,
  locale, q)`; `createReadCache.get(load, { variant })`. `/<основна>/x` і `/x/` віддають 301, префікс
  неопублікованої мови — 404. Лінт забороняє літерал `accept-language` у зоні вітрини.

### Додано

- HTTP API операцій `/api/v1`: `POST /api/v1/<op>` (конверт майстра §3.3: `application/problem+json`, `If-Match` ↔
  `expectedVersion`, `Idempotency-Key`), `GET /api/v1/openapi.json` (OpenAPI 3.1 з реєстру; лише автентифікованому
  адміну; знімок ядра — `packages/simplycms/api/openapi.core.json`, регенерація `pnpm api:snapshot`).
  `simplycms/operations/server`: `handleApiRequest(request, op, lookup)` — реєстр передає роут, `subjectFromToken`,
  `buildOpenApi`. Токени `Authorization: Bearer scms_<prefix>_<secret>` (у БД лише хеш; права = роль ∩ scopes;
  `last_used_at` з тротлінгом), операції `api-tokens.{create,revoke,list}` і `service-accounts.create` (лише з
  cookie-сесії, право `apiToken.manage`). Ідемпотентність — рядок ключа в транзакції команди (К5, лише 2xx, 24 год).
  `GET /api/v1/openapi.json`: валідний Bearer або cookie-сесія з `admin.access`. Сервісний запис — рядок `service_accounts`; `OwnerInviteError('email_taken')` для пошти сервісного запису. `languages.add` має `idempotent: 'create'`. Id операцій токенів — з дефісом (`api-tokens.*`): формат id майстра
  (`^[a-z][a-z-]*(\.…)`) не допускає великої літери в першому сегменті.
- `simplycms/operations` (server-only) — реєстр операцій і виконавець з явним суб'єктом
  (`defineOperation`, `executeOperation`, `assertVersionThenHash`), `simplycms/operations/server` —
  `invokeFromServerFn`; `AuthzSubject.scopes`/`tokenId`, `requireOperation(subject, op, operationId?)`,
  `subjectFromCookie()`. Операції мов `languages.{list,add,setStatus,fill,reorder,remove}` (serverFn:
  `listLanguages`, `addLanguage`, `setLanguageStatus`, `fillLanguage`, `reorderLanguages`, `removeLanguage`),
  реєстр `CORE_OPERATIONS`/`getOperation` у `admin-server/impl`, `languagesCache`/`readLanguages` у `site`.
  Нові доменні помилки `VersionMismatchError`, `SourceChangedError`, `InUseError`, код поля `language_incomplete`.
- `simplycms/domain/translations` — чиста логіка перекладів (T1, клієнтобезпечна): `fieldStatus`,
  `rowStatus` (джерело — `SourceRow` з хешами поточного тексту, збирає `toSourceRow`),
  `isTranslatedForSeo`, `normalizeTextInput`, `planTranslationWrite` (сценарії 1–3 запису
  перекладів, функція хешу інжектується). Порожній rich-текст (`<p></p>`, `<p>&nbsp;</p>`,
  `<p><br></p>`) вважається порожнім полем, а не текстом.
- `simplycms/translations` (server-only) — `sourceFieldHash`: sha256 від `NFC` + `trim` тексту поля
  джерела.
- `simplycms/domain/slugs` — один генератор адрес і токенів: `slugify` (власна таблиця КМУ 2010 для
  `uk`, латиниця з діакритикою, `null` для письма без таблиці), `allocateSlug` (`base`, `base-2`…),
  `SLUG_FORMAT`, службові сегменти `RESERVED_SEGMENTS`/`RESERVED_QUERY_KEYS`, `isReservedPath`,
  `isReservedPropertyToken`.
- `simplycms/i18n`: мовні пакети `LANGUAGE_PACKS` (`uk`, `en`), `getLanguagePack(code)` (`null` для
  мови без пакета), тип `LanguagePack`, тимчасовий міст `languageOfConfigLocale` (знос у М2).
- **Реєстри адрес і мовних токенів** (Мультимовність М1): таблиці `url_paths` і `slug_tokens`
  (унікальність у мові, історія адрес, одна поточна на сутність і мову, складений FK області
  токена), відкладені тригери наявності поточної адреси/токена (`require_current_address`,
  `require_current_token`; на `products`/`product_modifications` увімкнено в Task 17) і
  `simplycms/addressing` (server-only): `createPathsForEntity`, `setExplicitPath`,
  `copyPathsForLocale`, `resolvePath`, `currentPaths` та дзеркальні для токенів, `publicNames`.
- `simplycms/vite`: `simplycmsPublicManifest()` пише `dist/client/.simplycms-public.json` — верхньорівневі
  імена `public/`, яким не може дорівнювати адреса сутності.
- Лінт `server-fn-top-level`: реекспорт `createServerFn` — помилка в усіх формах: специфікатором
  (`export { createServerFn } from '@tanstack/react-start'`, `export * from …`, `export { mk as csf }`) і
  оголошенням (`export const csf = createServerFn`, `export default createServerFn`, `export const x =
  rs.createServerFn`) — компілятор Start не трансформує виклик через модуль-хелпер; трекер аліасів бачить
  присвоєння (`let f; f = createServerFn`) і `ns.createServerFn`.
- Гейт `test:packaging` `dist-theme-plugin-external`: ядро `simplycms/*` лишається зовнішнім у dist
  референс-теми й плагіна (без власної копії контексту запиту).

### Виправлено

- Картка товару в адмінці: після власного збереження введене ПІСЛЯ відправки лишається зміною (форма
  dirty), а елемент колекції, якого користувач не чіпав, бере стан БД замість перезапису наступним
  збереженням. Елемент, який користувач змінив, а інший редактор паралельно видалив, лишається з правкою
  (не губиться мовчки); конфлікт проявляє наступне збереження через версію агрегата (412).

---

## [0.15.0] — 2026-10-15

Мінорний реліз лінії 0.x (npm-тег `latest`): до 1.0 злам сумісності піднімає мінорну версію, а
`simplycms update` без `--to` її не перетинає. `1.0.0-rc.1` із заморожуванням baseline — після хвилі
мультимовності даних.
К3-Е8 (частини А і Б): готовність до пілоту й агентний супровід магазину — спеки
[А](docs/superpowers/specs/2026-10-12-pilot-readiness-design.md) і
[Б](docs/superpowers/specs/2026-10-12-shop-agent-toolkit-design.md) (розділ «Амендмент (план,
2026-10-12)»); план
[`2026-10-12-k3-e8-pilot-readiness-agent-toolkit.md`](docs/superpowers/plans/2026-10-12-k3-e8-pilot-readiness-agent-toolkit.md).
З 1.0 діє чесний semver: злам коду магазину, тем чи плагінів піднімає мажорну версію.

### 🔴 BREAKING для магазинів

- **Node ≥ 24 (Е8-Р1):** `engines.node` — `>=24` у всіх п'яти пакетах і в шаблоні магазину;
  `scripts/start.mjs` без `process.execve` (Node < 23.11) падає з поясненням, фолбеку немає.
  Магазин на Node 22 мусить перейти на 24.
- **База перестворюється (baseline змінено, Е8-Р3):** `users` має
  `CHECK (email = lower(email))`, `products`/`product_modifications.stock_status` — `NOT NULL`, нові
  індекси `orders(created_at)` і keyset покупців, колонка `user_category_history.source`
  (`'manual'|'rule'`), нова таблиця `mail_outbox` (`0005_mail_outbox.sql`). Базу без журналу міграцій
  платформа не адоптує (`UnjournaledDatabaseError`): базу 0.14 створюють заново — локально порожня БД і
  `pnpm simplycms db:apply`, на сервері новий порожній екземпляр БД. `simplycms update` з 0.14.x без
  `--to 0.15.0` не оновлює: для 0.x межа сумісності — мінорна версія.
- **Baseline міграцій ще не заморожено:** baseline `0000…0005` до 1.0 ще може змінюватися; базу магазину,
  створену на 0.15.0, після релізу зі зміненим baseline треба створити заново. Накочена, але змінена міграція → `MigrationChecksumError`,
  контейнер не стартує, і ця помилка називає дію (створити базу заново).
- **Накат міграцій — лише `simplycms db:apply` або старт контейнера:** `psql`-цикл знесено з усіх
  носіїв. Журнал `public.simplycms_migrations` (sha256, advisory-лок, кожен файл в одній транзакції);
  `concurrently` і власні `begin`/`commit` у файлі відкидаються. Файли плагінів — `<timestamp>_plg_*`
  (шаблон `simplycms create plugin` кладе таку назву), інакше вони ставали б між `0001_init` і `0002_grants`.
- **Прод-старт — `node scripts/start.mjs`** (накат під `MIGRATION_DATABASE_URL`, далі `process.execve` на
  `server.mjs` БЕЗ цієї змінної). Скрипт `start:prod` прибрано, `pnpm start` — лише локальний запуск, не для
  проду. `server.mjs` завжди виставляє `NODE_ENV=production` і `.env*` для `MIGRATION_DATABASE_URL` не читає.
- **Прод-старт і запрошення власника — у пакеті, у магазині лише шими під `simplycms update`:** логіка
  старту — `simplycms/prod-start` (`runStart`, `startStore`, `STRIPPED_ENV`), `owner:invite` —
  `simplycms/auth/owner-invite-cli`; `scripts/start.mjs` і `scripts/owner-invite.mjs` — host-файли
  (`update --write` їх пише, doctor №6 бачить дрейф). Крок магазину: `pnpm simplycms update --write`, далі
  видалити осиротілий `scripts/owner-invite-core.mjs` — `update` файлів поза каноном не прибирає.
- **Групи env «все або нічого» (`simplycms/env`):** частково задана група `S3_*` (5 ключів) або
  `SMTP_URL`+`MAIL_FROM` валить старт і називає відсутні ключі; обов'язкових ключів лишається рівно три.
  `VITE_SITE_URL` має бути абсолютним `http(s):` URL, інакше `server.mjs` виходить з кодом 1.
- **`nodemailer` — peer ядра** (точний пін `10.1.0`) і пряма залежність магазину: існуючий магазин
  додає `pnpm add nodemailer@10.1.0` (doctor №14).
- **Пошта на порту `simplycms/mail`:** типи `SendAuthEmail` і `SendInviteEmail` та заглушка
  `stubSendAuthEmail` прибрано (`InviteEmail` → `MailMessage`); без `SMTP_URL`/`MAIL_FROM` працює драйвер
  `log` (у проді друкує лише «Кому / Тема / тип листа», без тіла й посилань).
- **`pnpm owner:invite` (Е8-С2):** посилання друкується лише з драйвером `log` поза продом або з
  `--print-link`; зі SMTP — «лист надіслано»; у проді без SMTP і без прапорця — код 1. Без `VITE_SITE_URL`
  — код 1 (фолбеку на `localhost` немає).
- **`simplycms update --check` — чиста перевірка без install і мережі** (Е8-Р12); коди виходу
  `status` і кожного `--check`: `0` гаразд, `3` є що робити, `1` помилка. `update` після `pnpm add`
  передає керування новому CLI (host-файли звіряються з каноном НОВОЇ версії), не знижує версію без явного
  `--to`, відмовляє без відомої цільової версії, а на мажорній межі без `--to` зупиняється (код 3).
- **Доставка: зони без міст і областей (Д1–Д4, baseline змінено → базу перестворити):**
  `shipping_zones.cities` і `shipping_zones.regions` зносено (схема, контракт, адмінка, i18n, сіди). Зону
  більше не визначає текст міста: кур'єр бере основну зону, самовивіз — зону точки (`pickup_points.zone_id`;
  `NULL` → основна; неактивна → відмова). Рівно одна основна зона гарантує БД: сід «Основна зона»
  (`00000007-0000-4000-8000-000000000001`), відкладений constraint-тригер `shipping_zones_require_default`,
  `CHECK (NOT is_default OR is_active)`. Для способів із тарифами по зонах (`rates`) відсутність активного
  тарифу в зоні — відмова `shipping_unavailable`, а не тариф іншої зони. Для самовивозу `orders.delivery_city`
  тепер `NULL` (гарантує сервер). **Як перестворити базу:** порожня БД + `pnpm simplycms db:apply` (на
  сервері — новий порожній екземпляр БД); існуючу базу цією зміною не накотити.
- **Замовлення пам'ятає зону й тариф (Д5):** `placeOrder` пише `orders.shipping_zone_id` і
  `shipping_rate_id`; перерахунок позицій в адмінці бере записану зону (для `carrier` записана зона не
  змінюється; неактивна зона — 409 `order_shipping_unavailable`).
- **Скіл `redesign-from-reference` → `simplycms-redesign`** (також `/редизайн-за-референсом`); `update`
  прибирає старий лінк.
- **Діапазони `engines.simplycms`** референс-пакетів і `simplycms create` — `^<мажорна>.0.0` (для RC —
  `^X.Y.Z-0`), а не відкрите `>=`; `satisfies` вирівняно з npm на пререлізах. `engines.simplycms` плагіна
  чи теми, що не покриває встановлене ядро, — error у `doctor` №17 (bootstrap лише попереджає).
- **Host-файли змінено, потрібен `simplycms update --write`:** `src/server.ts` експортує `SERVER_FN_BASE`
  (раннер без нього виходить з кодом 1), нові `server-origin.mjs`, `server-body-limit.mjs`,
  `server-headers.mjs`, `src/route-error.tsx`; `src/start.ts` — маскування помилок; `src/router.tsx` —
  `defaultErrorComponent`.
- **Раннер будує URL запиту з `VITE_SITE_URL`** (Р18): `Host` і `X-Forwarded-*` ігноруються,
  request-target `//…` → 400; Better Auth `baseURL` = `BETTER_AUTH_URL ?? VITE_SITE_URL` завжди.
- **Лоадери вітрини `simplycms/storefront/loaders` вимагають `viewer`** (А6.3): ціни повертаються лише
  для виду цін глядача; `loadProductList` теж вимагає `viewer`; персоналізовані відповіді —
  `Cache-Control: private, no-store`.
- **`CMSProvider` — проп `queryClient` обов'язковий** (А6.4): запасного `QueryClient` немає, а проп
  `customQueryClient` перейменовано на `queryClient`. Кастомний хост (`src/routes/__root.tsx` магазину)
  мусить передати клієнт роутера під новим іменем; `simplycms update --write` оновлює host-копію.
- **Канонічний шлях товару** (Р25): товар без розділу живе на `/catalog/all/<slug>`, slug розділу
  `all` зарезервовано; інші сегменти → 301; sitemap і адмінка дають той самий `productPath`.
- **Поведінка безпеки змінилась:** роль `admin` видається при ПРИЙНЯТТІ запрошення (раніше при
  випуску); скидання пароля гасить усі сесії; зі SMTP реєстрація вимагає підтвердження пошти; правило
  категорії `email_domain` довіряє лише підтвердженій пошті, `contains` для доменів → точний домен чи
  `.піддомен`; у проді непередбачені помилки serverFn і SSR маскуються (`Internal server error [ref <id>]`);
  `MEDIA_ROOT=""` означає «не задано».

### Додано

- **Журнал міграцій і `simplycms/migrate`** (server-only): `applyMigrations`, `listMigrationFiles`,
  `readJournal`, `MigrationChecksumError`; пароль `app_runtime` синхронізується клієнтським верифікатором
  SCRAM-SHA-256 (лише друкований ASCII; відкритий пароль на сервер не йде). `simplycms db:apply`
  (`--dry-run`, `--check`) і `doctor --online` (журнал, `shared-cluster`: кожен магазин — власний
  екземпляр Postgres).
- **`simplycms/env`:** `resolveDriverEnv`, `checkDriverEnvOnStart`, `isProductionRuntime`.
- **Прод-старт:** `simplycms/prod-start` (server-only) і шим `scripts/start.mjs`, `/api/health` з ідентифікатором збірки (`BUILD_ID` → `SOURCE_COMMIT`
  → git → час), сторож застарілих чанків (одне перезавантаження), прекомпресія статики (`.br`/`.gz`) і
  413/411 без закриття з'єднання.
- **Драйвер сховища `s3`** (`aws4fetch`; `S3_ENDPOINT/REGION/BUCKET/ACCESS_KEY/SECRET_KEY`), контрактний
  набір для `local-fs` і `s3` проти Garage; збій драйвера в `/media/<key>` — 503 з одним логом, а не 404.
- **Порт пошти `simplycms/mail`:** драйвери `smtp` (nodemailer) і `log`, outbox `mail_outbox` з доставкою
  після COMMIT; листи скидання пароля, запрошення, підтвердження пошти, замовлення покупцю й власнику;
  картка хвостів у налаштуваннях адмінки (повтор, право `settings.manage`); `doctor --production` і
  перевірки №14–№16 (nodemailer, пошта, підтвердження пошти).
- **Агентний супровід магазину:** `simplycms status` (етапи `not-created|not-configured|local|deployed`,
  наступний скіл), `simplycms smoke <url>`, `simplycms deploy:record get|set` (`.simplycms/deploy.json` без
  секретів), керований блок `AGENTS.md` і `CLAUDE.md` у шаблоні, хук старту сесії
  (`.claude/hooks/session-start.mjs`, exec-форма через `${CLAUDE_PROJECT_DIR}`; Claude Code ≥ 2.1.139
  (поле `args` у хуках); перевірено на 2.1.296), doctor №17 (engines) і №18 (файли агента),
  скіли `simplycms-onboarding` (його скрипти попереджають, якщо `DOKPLOY_URL` не `https:` і не loopback, і не
  цитують не-JSON відповідь Dokploy у помилці), `simplycms-update`, `simplycms-diagnose` (+ перейменований
  `simplycms-redesign`), скаффолдер із фінальним «одним реченням» для власника.
- **Реліз:** `CHANGELOG.md` їде в tarball ядра (`simplycms-update` читає BREAKING між версіями), крок
  `pnpm release` `readme-tag`, пререліз `X.Y.Z-rc.N` під тегом `next`, гейт `schema` (`test:schema`
  обов'язковий у релізі) і доказ оновлюваності `upgrade-1x`.
- **Безпека (аудит 2026-10-12):** базові заголовки на всіх відповідях (`nosniff`, `Referrer-Policy`,
  `X-Frame-Options`/`frame-ancestors 'self'`, HSTS лише для https, `Permissions-Policy`), стеля тіла 1 МіБ
  на всі запити (26 МіБ — multipart serverFn), `simplycms/server-guard`.

### Змінено

- Boolean-фільтр каталогу порівнює значення за `property_id` (бейдж фільтра й його зняття працюють);
  `FilterSidebar` не зациклюється, якщо тема опускає `numericPropertyRanges`.
- `UPSTREAM:START-BODY-1` лишається чинним, але обхід посилено: стеля тіла діє в раннері на всі запити
  (chunked — лічильник байтів), а не лише на serverFn.
- `/auth/invite` поверх активної сесії виходить із неї перед прийняттям запрошення.
- Заглушки секретів в `env.example` — порожні значення; `doctor` вважає відомі заглушки помилкою.
- Банер головної береться за розміщенням і розкладом; помилка запиту на вітрині (профіль, замовлення,
  `OrderSuccess`) більше не показується як «порожньо».
- Гейти ізольовані від `.env*` розробника (`envDir: false`); `HARNESS_SMTP_URL` береться з env CI.
- Канон оновлено: `docs/architecture/{cli,storage,release-process,test-contours,data-layer,
  repository-layout,upstream-workarounds}.md`, `docs/development/{ENVIRONMENT,TOOLING}.md`, `AGENTS.md`.

### Виправлено

- Каталог без розділу показує бокові фільтри: `FilterSidebar` і лоадери `loadSectionFilters` /
  `loadSectionFilterProperties` приймають `sectionId: string | null`; корінь — об'єднання
  фільтровних характеристик активних розділів без дублів, лише тих, що мають значення в активних
  товарах (або їхніх модифікаціях).
- Чекбокси бокових фільтрів, оформлення замовлення й профілю — `Checkbox` з `simplycms/ui` у
  кольорах теми (раніше сирий `<input type="checkbox">` фарбувався за `color-scheme` браузера й
  виглядав чорним при темній системній схемі); проп `renderCheckbox` теми працює (контракт
  `{ id, checked, onCheckedChange }`).

### Видалено

- `psql`-цикл накату, скрипт `start:prod`, `stubSendAuthEmail`, `SendAuthEmail`, `SendInviteEmail`,
  запасний `QueryClient` у `CMSProvider`.

### Закрито борги

- К3-Е6г-5, К3-Е6г-6, К3-Е6г-9, К3-Е6г-13, К2-Е0-1 (baseline); 0.4.1-6…9 (старт, накат, пароль
  `app_runtime`). К3-Е6г-12 (повторний бан) лишається.

### Відомі обмеження

Пілот на Dokploy ще не проведено: пілот — після хвилі мультимовності й `1.0.0-rc.1`.
Доставку у реальну поштову скриньку доводить лише Е8 (у CI — Mailpit). Стан помилок «не порожньо»
(Р26) покриває вітрину, не весь адмін-інтерфейс (54 файли — планове посилення). Помилка, кинута поза
serverFn (прямий код лоадера), не маскується в payload — усі лоадери вітрини ходять у БД через serverFn.

---

## [0.14.0] — 2026-10-12

К3-Е6д: контент — банери й відгуки на серверному шарі (спека
[`2026-10-10-content-banners-reviews-design.md`](docs/superpowers/specs/2026-10-10-content-banners-reviews-design.md);
план
[`2026-10-10-v2-k3-e6d-content.md`](docs/superpowers/plans/2026-10-10-v2-k3-e6d-content.md)).
Магазинів на SimplyCMS немає — без зворотної сумісності.

К3-Е7: повний знос Supabase (спека
[`2026-10-11-v2-k3-e7-supabase-removal-design.md`](docs/superpowers/specs/2026-10-11-v2-k3-e7-supabase-removal-design.md);
план
[`2026-10-11-v2-k3-e7-supabase-removal.md`](docs/superpowers/plans/2026-10-11-v2-k3-e7-supabase-removal.md)).
Легасі на `supabase-js` — 0.

### 🔴 BREAKING для магазинів

- **`pg` — peer ядра і пряма залежність магазину (К3-Е7, Task 11):** `simplycms` більше не тягне
  `pg` у `dependencies`, а очікує його як `peerDependencies` (точний пін `8.23.1`); шаблон і
  `create-simplycms-store` додають `"pg": "8.23.1"` у залежності магазину. **Існуючий магазин
  мусить додати `pnpm add pg@8.23.1`.** `simplycms doctor` (№13) вимагає декларації і версії в
  межах peer, `simplycms update` версію `pg` не переписує — лише підказує.
- **Виправлено старт свіжого магазину з 0.7.0:** серверний бандл падав на старті
  (`TypeError: Class extends value #<Object> is not a constructor or null` у `BoundPool extends Pool`).
  Причина — дефект import-protection плагіна `@tanstack/start-plugin-core` ≥1.171 (приїхав через `@tanstack/react-start` 1.168.60, коміт 24e2836a) + вклеєний транзитивний `pg`
  ([`UPSTREAM:START-IP-1`](docs/architecture/upstream-workarounds.md)). Опубліковані 0.7–0.13 не
  виправляються. Реліз тепер ганяє повний `pnpm pilot` (Gate B), а пілот — новий Gate SB (драйвер не
  вклеєний + allowlist вклеєних пакетів).
- **Тека магазину `supabase/` → `db/` (К3-Е7, скаффолдер):** міграції лежать у
  `db/migrations`, накат — psql-цикл по цій теці; `supabase/config.toml` і
  `supabase/templates/invite.html` більше не генеруються. Наявний магазин переносить теку
  `git mv supabase/migrations db/migrations`; `simplycms doctor` (№7) і `simplycms update`
  повідомляють про відсутню `db/migrations` (раніше doctor хибно казав «всі міграції нові»).
- **Канон міграцій змінено точковою правкою baseline (Е6д-8)**: базу магазину
  перестворити (`pnpm db:demo`). `product_reviews` отримала CHECK-и
  `product_reviews_status_check` (`pending`/`approved`/`rejected`) і
  `product_reviews_rating_check` (1…5) у `0001_init.sql`; нової міграції немає.
  `0002_grants.sql`: `app_user` на `product_reviews` — `SELECT, INSERT, DELETE` +
  колонковий `UPDATE (rating, title, content, images, status, updated_at)` замість
  табличного (Е6д-16 б, розширено Е6д-23); INSERT звужує політика RLS
  `product_reviews_insert_own` (`status = 'pending'`, `admin_comment IS NULL`;
  К3-Е6д-7), оновлення — `product_reviews_update_own`.
- **Доробка К3-Е6д (2026-10-11)**: базу магазину знову перестворити (`pnpm db:demo`):
  нова таблиця `media_erasures` (outbox стирання, Е6д-20), `media.entity_id` —
  `NOT NULL` (власник обовʼязковий, К3-Е6д-4); `uploadMedia` без `entityId` → 400
  (виняток — логотип, власник `STORE_LOGO_OWNER_ID`).
- **Канон сховища: двофазне стирання (Е6д-14).** Транзакція видаляє лише рядки
  `media`; файли стираються ПІСЛЯ COMMIT (`completeMediaErasures`, outbox Е6д-20). Новий
  `eraseMediaRows(db, refs, owner)` у `simplycms/storage` з обовʼязковим власником
  (Е6д-16 а). `deleteCustomer` повертає `discard` (аватар разом із фото відгуків), тож
  обрив `driver.delete` більше не відкочує видалення акаунта (переписує Е6г-15).
- **Відгук із фото — одним запитом (Е6д-6):** `submitProductReview` — FormData-serverFn
  (текст + до 5 файлів по 5 МБ); проп `renderImageUpload` у `reviews-ui` — на `File[]`
  (`{ files, onFilesChange, maxFiles, accept, maxBytes }`), штатний пікер
  `ReviewImagePicker` увімкнено за замовчуванням.
- `simplycms/storage`: тип `AvatarStorageOptions` (вітрина) замінено нейтральним
  `MediaStorageOptions` (`{ driver?, discardWith? }`), спільним для аватара й відгуків.
- Адмінка: `getAdminReviewContent` знесено — його поглинає `getReviewCard` (Е6д-11).

### Видалено

- **Supabase (К3-Е7):** шар `simplycms/supabase` і весь його публічний API — шість
  експортів `simplycms/supabase*` та дзеркало в `publishConfig`; `LegacySupabaseBoundary`
  з тестом і монтуванням, i18n `admin.legacy.*`; peer'и й залежності `@supabase/*` (ядро,
  шаблон магазину, пілотний шаблон); `PEER_SCOPES` в `scripts/audit-deps*`.
- Реєстр `tests/admin-server-first` (його замінює бан лінтом), гілку `supabase` в
  `explicit-ids`/`insert-scan`, `tests/admin-inserts-need-id.test.ts`, виїмку `EXEMPT_DIRS`.
- Кореневий `supabase/` (`config.toml`, `seed.sql`), ланцюг сіду пілота (`pilot-seed`,
  `seed-sql`, `seed-fixtures`) і команда `pnpm pilot:seed`; `pnpm db:migrate`
  (`scripts/db-migrate.mjs`); `tools/content-loader-mcp` із записом `mcpServers.content-loader`
  у `.claude/settings.json`.

### Додано

- Правило лінту `simplycms-supabase/no-supabase-import` (на все репо: `import`,
  `export … from`, `import()`, `require`, TS-форми) і тест маніфестів/lock — жодного
  `@supabase/` у `package.json` workspace-пакетів, шаблонах і `pnpm-lock.yaml`.
- Гарди-замінники: незалежний контроль `import.meta.env` у серверних модулях, тест
  `dist-import-meta` на фікстур-збірці з `base` з `tsdown.config.ts` (мутація
  `format: ['cjs']`), юніт `gateBundle` для Gate C.
- `simplycms doctor` (№7) і `simplycms update`: відсутня `db/migrations` — помилка з підказкою
  `git mv supabase/migrations db/migrations`, якщо є стара тека.
- Лінт: адмінка (`src/admin/**`) більше не виїмка з правил a11y-міток (`jsx-a11y`) і
  `query-key-from-entity` (К3-Е7, 9в): виміряно 1 порушення (`BannerScheduleCard` — Radix
  `Checkbox` без `htmlFor`), виправлено; зону стереже `tests/eslint-admin-zones.test.ts`
  (по всіх теках `admin/*`).
- Пілот і реліз (К3-Е7, Task 11): Gate SB пілота (`scripts/pilot-pack/gate-sb.mjs`:
  драйвер БД не вклеєний у серверний бандл + allowlist вклеєних пакетів), крок Gate B
  «sanitize-html на сервері» (оверлей `scripts/pilot-pack/sanitize-probe.sql`), релізний гейт
  `pilot` (`scripts/release/pilot-full.mjs`), розтяжка `UPSTREAM:START-IP-1`.
- Доробка К3-Е6д-1…9 (план
  [`2026-10-11-v2-k3-e6d-finish.md`](docs/superpowers/plans/2026-10-11-v2-k3-e6d-finish.md)):
  - outbox `media_erasures` з `completeMediaErasures`/`scheduleMediaErasures`/
    `retryMediaErasures`, хвости й повтор у налаштуваннях адмінки, помічник
    `withPublishedRollback` (Е6д-20);
  - роздача `/media/<key>` перевіряє рядок `media` і видимість власника (`serveMedia(ctx,
    { lookup })`, `MEDIA_VISIBILITY`); персональні файли — `private, no-cache`, 404/500
    — `no-store` (Е6д-21);
  - `findMediaReferences`/`mediaReferenceExists`, sweep неприв'язаних медіа (≥ 24 год) у
    налаштуваннях, гейти `media-sweep-coverage` і
    `media-cascade-coverage` (з `via` для двоярусного каскаду) (Е6д-22);
  - стеля тіла запиту `bodyLimitMiddleware` (`simplycms/runtime/body-limit`, 413
    `request/payload-too-large`, 411 `request/length-required`; `UPSTREAM:START-BODY-1`);
  - покупець редагує власний відгук (повертається в `pending`), модерація проти побаченої
    версії: `setReviewsStatus({ items: [{ id, updatedAt }] })`, 409 `review_changed`;
    автор бачить `own_photos` лише свого відгуку (Е6д-23);
  - `HeroBanner` обох тем показує текст і кнопки банера (`pickHeroBanner`/`pickHeroImage`/
    `isSafeCssColor` у `simplycms/domain`, `themes.md` §2.2);
  - опція `media` фабрики на jsonb-масивах і ресурсах каталогу (розділи, товари, опції
    властивостей, модифікації), `cascadeMedia` для каталогу.
- Адмінка: `/admin/banners*` — ресурс фабрики з опцією `media` (Е6д-1), перехресні
  правила на злитому рядку (Е6д-2, Е6д-12), безпечні кнопки (`/шлях` або `http(s)://`,
  Е6д-13) і `overlay_color` за `isSafeCssColor` (Е6д-4); право `banner.manage`.
- Адмінка: `/admin/reviews*` — список з keyset і масовою модерацією (`setReviewsStatus`,
  409 `review_not_found` без часткового запису, Е6д-7), картка з фото й внутрішньою
  приміткою (не їде на вітрину, Д-1), бейдж «очікують» у сайдбарі (Д-4); відгуки
  видаленого покупця — «Колишній покупець».
- `defineAdminResource({ media: { entityType, columns } })` — референси медіа-колонок
  перевіряються на власника рядка (409 `media_ref_invalid`), замінене й видалене
  стирається двофазно.
- `defineAdminResource({ cascadeMedia: [{ fk, column, entityType }] })` (Е6д-19) — медіа
  дочірніх рядків, яких знищує FK `ON DELETE CASCADE`: видалення товару стирає фото його
  відгуків (рядки `media` у транзакції, файли — після COMMIT). Гейт класу
  `media-cascade-coverage` звіряє кожну каскадну медіа-колонку з каталогу FK.
- `simplycms/domain`: предикати банера (`isBannerButton`, межі тривалостей,
  `BANNER_MAX_BUTTONS`), `isSafeCssValue`, `normalizeMediaRefs`; константи фото відгуку
  (`REVIEW_MEDIA_ENTITY`, `MAX_REVIEW_IMAGES`, `MAX_REVIEW_IMAGE_BYTES`, Е6д-5).
- Вітрина: автор бачить свій несхвалений відгук разом із фото й бейджем
  «На модерації»; `getProductReviews` відповідає `cache-control: private, no-store`
  (Е6д-17).
- `live:smoke`: крок контенту (`admin-content.mjs`) — банери, відгук із фото, ізоляція
  `pending` від гостя, масова модерація.

### Змінено

- `eraseMedia` і `discardMedia` знесено: аватар і логотип двофазні, serverFn `deleteMedia` знесено (споживачів не лишилось);
  `ImageUpload` більше не стирає файл (проп `eraseOnRemove` прибрано), сироту змітає sweep.
- Легасі `Banners`, `BannerEdit`, `Reviews`, `ReviewDetail` знесено; легасі на
  `supabase-js` — **2** файли `src/admin/**` (`LegacySupabaseBoundary` з тестом; знесено в К3-Е7).
- Сід `db:showcase` схвалює відгуки ядром `setReviewsStatus` замість сирого `UPDATE`.

### Відомі обмеження

Межі канону сховища (`docs/architecture/storage.md`, «Межі»): БД недоступна саме в момент
відкату публікації; ручна вставка `/media/<key>` у rich HTML не створює власності; прямий
виклик serverFn повз UI понад стелю тіла може побачити обрив зʼєднання замість 413; чистий JSON без `Content-Length` (chunked) проходить без стелі, бо Start буферизує його повністю ([`UPSTREAM:START-BODY-1`](docs/architecture/upstream-workarounds.md)).

## [0.13.0] — 2026-10-10

Вітринний стенд `pnpm db:showcase` (план
[`2026-10-08-showcase-seed.md`](docs/superpowers/plans/2026-10-08-showcase-seed.md)):
локальна база з живими даними для ручного тесту вітрини й адмінки. Тулінг монорепо, не
продукт: у магазин не їде, у `packages/simplycms/src` слова «showcase» немає.

### Додано

- `pnpm db:showcase`: `db:demo` + наповнення через доменні ядра під `withActor`
  (8 розділів, 33 товари з PNG, два типи цін, залишки у двох точках, адресна доставка,
  власник і менеджер через invite, 18 покупців, категорія VIP і знижки, 40 замовлень за
  30 днів, схвалені відгуки). Детермінований PRNG; база фіксованого імені
  `simplycms_showcase` перестворюється лише з позначкою `simplycms:showcase`, чужу —
  не чіпає; модуль сіду відмовляє на непорожній базі. Зсув часу узгоджений: реєстрація
  покупців раніша за їхні замовлення, номер замовлення несе дату замовлення. Опис і паролі (лише локалка) —
  `docs/development/TOOLING.md` § 2.
- `scripts/demo-db.mjs`: необовʼязковий `--comment` (позначка бази одразу після
  `CREATE`, до міграцій); без прапорця поведінка `db:demo` та сама.
- Гейт `pnpm typecheck:showcase` — у ланцюгу гейтів, CI (job `typecheck`) і гейтах
  релізу одразу після `typecheck`. Гейт сіду (С-8) — у `test:schema`.
- Гейт `tests/showcase-isolation.test.ts`: слово «showcase» у `packages/simplycms/{src,routes,migrations}`
  і шаблоні магазину червонить `pnpm test` (раніше інваріант тримала лише ручна команда `rg`).

### Змінено

- `simplycms/admin-server` (`./impl`): статус відповіді адмін-помилки (409/400) ставить
  межа операції (`runAdminTransactions`) і валідатор входу; `stateConflict`/`fieldIssue`
  лише кидають — ядро можна кликати поза HTTP-запитом. Гейт
  `set-response-status-scan.test.ts`. Побічно: «Запустити всі правила» категорій більше
  не віддає 409 на успішну відповідь, коли конфлікт одного покупця проковтнуто циклом.
- Фабрика `defineAdminResource` віддає `insertIn/updateIn/removeIn(db, input)`; ядра
  `saveProductPrices`, `saveStock`, `saveDiscount`, `changeOrderStatus`,
  `assignCustomerCategory`, `setCustomerBan`, `deleteCustomer` винесено з операцій без
  зміни поведінки; актор ядра — `CoreActor` (`{ kind: 'admin', userId } | { kind:
  'system' }`). Канон — `docs/architecture/data-layer.md` §10.

## [0.12.0] — 2026-10-08

К3-Е6г: покупці й дашборд на серверному шарі (спека
[`2026-10-07-customers-dashboard-design.md`](docs/superpowers/specs/2026-10-07-customers-dashboard-design.md);
план
[`2026-10-07-v2-k3-e6g-customers-dashboard.md`](docs/superpowers/plans/2026-10-07-v2-k3-e6g-customers-dashboard.md)).
Магазинів на SimplyCMS немає — без зворотної сумісності.

### 🔴 BREAKING для магазинів

- **Канон міграцій змінено**: базу магазину перестворити (`pnpm db:demo`). Нова
  ручна міграція `0004_functions.sql` (тригер `sessions_refuse_banned`, функція
  `refuse_banned_session()`) — ручні функції й тригери живуть лише в ручних файлах
  канону, множину стереже `functions-allowlist.test.ts`. Таблиці `services` і
  `service_requests` та колонка `order_items.service_id` зняті («Послуги» знесено);
  `orders.user_id` — FK `SET NULL` (було `NO ACTION`), `product_reviews.user_id` — новий
  FK на `users` із `SET NULL`.
- **`orders`**: нова колонка `personal_data_erased_at`; реєстр ПД колонок
  (`ORDER_COLUMN_PRIVACY`) — нова колонка без запису в ньому не компілюється.
  `ShippingSnapshot.city` може бути `null` (лише на читанні).
- **Invite власника**: store має один метод `issueAdminInvite` (лок `admin-roles` +
  `FOR SHARE` на бан); `storeToken` і `grantAdminRole` прибрано. `pnpm owner:invite`
  для забаненого відмовляє — «спершу розблокуйте покупця».

### Додано

- Адмінка: `/admin/users` (список покупців з пошуком, фільтрами й «Показати ще»),
  `/admin/users/$userId` (контакти й email, категорія з закріпленням, роль адміна,
  бан, видалення акаунта зі знеособленням замовлень), дашборд `/admin`
  (`dashboardSummary`: нові замовлення з глибоким посиланням у
  `/admin/orders?status=<uuid>`, виручка за 7/30 днів, останні замовлення).
- Бан: хук Better Auth + тригер БД; вхід забаненого дає `BANNED` (тост
  `auth.login.banned`/`bannedContacts`), скидання пароля сесії не створює.
- Вітрина: відгук видаленого покупця — «Колишній покупець»; адмінка — «Видалений
  покупець».
- Код помилки валідації `taken` (`admin.validation.taken`) — зайнятий email у формі.
- Слот плагінів `admin.dashboard.stats`: `context.stats` — `AdminDashboardStats`.
- `live:smoke`: крок покупців (`admin-customers.mjs`).

### Змінено

- Легасі `Dashboard`, `Users`, `UserEdit` знесено; легасі на `supabase-js` — **6**
  файлів `src/admin/**`.
- `live:smoke`: крок «відгук-XSS» кладе старий відгук з `user_id NULL` (FK на `users`).

## [0.11.0] — 2026-10-07

К3-Е6в: знижки й категорії покупців — одна ціна на картці, у кошику й у чеку
(спека
[`2026-10-07-discounts-customer-categories-design.md`](docs/superpowers/specs/2026-10-07-discounts-customer-categories-design.md);
план
[`2026-10-07-v2-k3-e6v-discounts-categories.md`](docs/superpowers/plans/2026-10-07-v2-k3-e6v-discounts-categories.md)).
Магазинів на SimplyCMS немає — без зворотної сумісності.

### 🔴 BREAKING для магазинів

- **Baseline міграцій змінено**: базу магазину перестворити (`pnpm db:demo`).
  `discounts.price_type_id` — nullable («усі типи цін»); FK правил категорій на
  категорії — `RESTRICT`; `user_category_history` зберігає знімок назв
  (`from_category_name`, `to_category_name`) з FK `SET NULL`; `profiles` —
  без `auth_provider`, з `category_locked`; `app_user` оновлює `profiles` лише
  колонковим грантом (категорію змінює тільки `app_admin`).
- **Хуки знижок знесено**: `admin.discount.form.fields`,
  `discount.conditions.evaluate`, `discount.before_apply`, `discount.after_apply`,
  `discount.types`, порт `CatalogRepository.getDiscounts` і тип `DiscountScope`.
  Умови знижок — внутрішній реєстр `DiscountConditionDefinition`; плагінам він
  відкривається в К5.
- **Кошик не зберігає ціну**: `CartItem` без `price`, `basePrice`,
  `discountData` — ціни, знижки й підказки дає серверна квота `quoteCart`.
  Старий формат у `localStorage` читається без помилки, зайві поля ігноруються.
  `usePriceType`, `getPriceTypeContext` і `AGGREGATE.priceTypeContext` знесено.
- **Знижка без цілей не діє** (fail-closed): «на все» — явна ціль `all`.

### Додано / змінено

- Рушій знижок (`simplycms/domain/discounts`): вкладений `DiscountContext` з
  обовʼязковим `now`, реєстр умов (`user_category`, `min_quantity`,
  `min_order_amount`, `user_logged_in`), невідома чи пошкоджена умова —
  fail-closed. Результат групи — лише фактично застосоване; причини відхилення —
  коди (`DiscountRejectionReason`), текст — i18n.
- Серверне ядро ціни `simplycms/commerce`: `loadPricingContext` + `priceCart` для
  картки, кошика, чекауту, редагування позицій і діагностики; ліс знижок одним
  SQL-знімком, пошкоджений рядок виключається (`discount_invalid`), а не валить
  розрахунок. Суми й пороги — центами.
- Вітрина: усі картки (каталог, розділ, головна, сторінка властивості, сторінка
  товару) рахують знижку тим самим рушієм над середовищем цін
  (`staleTime: 0`, ключ з `userId`); порогові підказки «від 3 шт — 900 ₴/шт
  (−10%)» на сторінці товару й у рядку кошика; межі кошика `MAX_CART_LINES` /
  `MAX_LINE_QUANTITY` (`simplycms/contracts/cart-limits`).
- Адмінка на `simplycms/admin-server` + `simplycms/admin-data`: дерево знижок
  (групи з операторами, перемикач активності, видалення з підрахунком каскаду),
  картки групи й знижки (атомарний `saveDiscount`, цілі, умови, дати без зсуву
  часового поясу), категорії покупців (атомарний дефолт, явні відмови
  видалення), автоправила з кнопкою «Запустити всі», діагностика ціни тим самим
  ядром, що чекаут. Права `discount.manage` і `customer.manage`.
- Автоправила категорій запускаються після оформлення замовлення окремою
  транзакцією — збій правил не ламає замовлення; вручну призначена категорія
  (`assignCustomerCategory`) блокує автоправила.
- Локи конфігурації — `advisoryXactLock` (`simplycms/db`), глобальний порядок
  `customer-config` → `discount-config` (канон — `docs/architecture/data-layer.md`
  §13).
- `pnpm live:smoke` отримав крок знижок і категорій
  (`scripts/live-smoke/admin-discounts.mjs`, перед кроком «система»).
- Фінальне рев'ю К3-Е6в: тип ціни — тип категорії покупця (гість і профіль
  без категорії — тип ДЕФОЛТНОЇ категорії, глобальний дефолтний — лише коли в
  категорії типу немає; SSR-база гостя — тим самим правилом,
  `loadGuestPriceTypes`, як і `offers` Product JSON-LD — `Offer` або
  `AggregateOffer` за модифікаціями, без гостьової ціни поле не виводиться);
  збій середовища цін на картках — помилка з
  «Повторити», а не базова ціна; видалення знижок — під `discount-config`;
  текстові умови автоправил регістр-незалежні (`trim` + нижній регістр);
  рядок знижки з ціллю без id, значенням ≤ 0 чи відсотком понад 100 виключається
  як `discount_invalid`.

### Прибрано

- Легасі-сторінки знижок і категорій на `supabase-js` (`Discounts`,
  `DiscountEdit`, `DiscountGroupEdit`, `PriceValidator`, `UserCategories`,
  `UserCategoryEdit`, `UserCategoryRules`, `UserCategoryRuleEdit`). Лічильник
  `useSupabaseClient` у `src/admin/**` — 17 → 9.

---

## [0.10.0] — 2026-10-06

К3-Е6б: профіль магазину й система (налаштування, теми, плагіни) на серверному
шарі (спека
[`2026-10-06-store-profile-system-design.md`](docs/superpowers/specs/2026-10-06-store-profile-system-design.md);
план
[`2026-10-06-v2-k3-e6b-store-profile-system.md`](docs/superpowers/plans/2026-10-06-v2-k3-e6b-store-profile-system.md)).
Магазинів на SimplyCMS немає — без зворотної сумісності.

### 🔴 BREAKING для магазинів

- **Baseline міграцій змінено**: базу магазину перестворити (`pnpm db:demo`).
  Таблицю `plugin_events` і колонку `plugins.migrations_applied` видалено; рядок
  сіду `system_settings['active_theme']` замінено рядком `store_profile`.
- **`seo` і `siteUrl` прибрано з `defineConfig` і `ConfigProvider`.** Назва
  магазину, заголовок головної й опис — профіль у БД (адмінка), URL сайту —
  env `VITE_SITE_URL` на сервері.
- **Host `src/routes/__root.tsx` і `src/server.ts` змінено** (синхронізуються
  `simplycms update`): кореневий лоадер повертає
  `{ ...(await getStorefrontRoot()), locale }` і монтує `StoreProfileProvider`;
  `src/server.ts` кличе `declareBuiltThemes(...)` — без нього активація теми
  відмовляє `theme_not_built`.
- **Теми беруть бренд із профілю**: ключ `theme.brand` видалено, назва й логотип
  — `useStoreProfile()` (`simplycms/themes/store-profile`). Так само шаблон
  теми `simplycms create theme`.
- **`/api/revalidate-theme` знесено** разом із `useRevalidateStorefront`;
  кеш вітрини скидає сама операція адмінки. `/api/health` реєструє `HEAD`
  явно (той самий статус і заголовки, що `GET`, без тіла — незалежно від
  версії Start), а на будь-який інший метод відповідає 405 з `Allow: GET, HEAD`.
- **Плагіни:** з `simplycms/plugins` прибрано `adminLifecycle` і
  `pluginRepository`; запис конфігу (`pluginConfigWrite`) вимагає права
  `settings.manage` і має стелю 64 КБ (400); `usePluginConfig.save` повертає
  `false` лише на відмову права. Кнопки «Видалити плагін» в адмінці немає.

### Додано / змінено

- Профіль магазину — `system_settings['store_profile']`: назва, заголовок
  головної, опис, контакти, логотип (референс порту сховища, `store_logo`),
  до 10 соцмереж (`https:`). Нові субшляхи `simplycms/contracts/store-profile`
  (T0), `simplycms/domain/store-profile` (поблажливий `parseStoreProfile`),
  `simplycms/themes/store-profile`, `simplycms/storefront-routes/head/*`.
- Новий server-only модуль `simplycms/site`: процесний кеш профілю й активної
  теми (TTL 5 хв + покоління, скидання після COMMIT), реєстр вшитих тем.
- Вітрина: `<title>` «Сторінка — Назва» через i18n локалі магазину, опис за
  замовчуванням із профілю, Organization JSON-LD на головній; теми `default` і
  `solarstore` показують логотип, контакти й соцмережі профілю.
- Адмінка на `simplycms/admin-server` під authz-операцією `settings.manage`:
  `/admin/settings` (профіль, логотип, соцмережі, склад), `/admin/themes*`
  (активація лише вшитої теми під локом, налаштування ≤ 16 КБ),
  `/admin/plugins*` (вмикання, конфіг). Після збережень — `router.invalidate()`.
- `pnpm live:smoke` отримав крок «система» (`scripts/live-smoke/admin-system.mjs`,
  ОСТАННІЙ у прогоні).
- Норма `pnpm lint` — 0 errors / 7 warnings.

### Прибрано

- Легасі-сторінки й хуки системи на `supabase-js` (`Settings`, `Themes*`,
  `Plugin*`, `useThemeActivate`, `usePluginToggle`). Лічильник
  `useSupabaseClient` у `src/admin/**` — 24 → 17.

## [0.9.0] — 2026-10-06

К3-Е6а: доставка «провайдер + режим ціни» на серверному шарі адмінки (спека
[`2026-10-06-commerce-providers-design.md`](docs/superpowers/specs/2026-10-06-commerce-providers-design.md),
частина 1; план
[`2026-10-06-v2-k3-e6a-shipping-providers.md`](docs/superpowers/plans/2026-10-06-v2-k3-e6a-shipping-providers.md)).
Магазинів на SimplyCMS немає — без зворотної сумісності.

### 🔴 BREAKING для магазинів

- **Baseline міграцій змінено**: базу магазину перестворити (`pnpm db:demo`),
  окремої міграції немає. `shipping_methods` втратив `type` і `plugin_name` і
  отримав `provider text NOT NULL` (`core:address` | `core:pickup`) та
  `pricing shipping_pricing NOT NULL DEFAULT 'rates'`. Enum
  `shipping_method_type` видалено, з `shipping_calculation_type` прибрано
  `'plugin'`. `orders.delivery_method` видалено: доставку описує знімок в
  `orders.shipping_data`. FK `pickup_points.method_id` і
  `stock_by_pickup_point.pickup_point_id` тепер `ON DELETE RESTRICT`.
- **Оплата `online` прибрана**: чекаут приймає лише `paymentMethod: 'cash'`,
  `online` відхиляє валідатор serverFn.
- **Слот плагінів `admin.shipping.method.settings` видалено.** Налаштування
  провайдерів плагінів будує ядро в К5.

### Додано / змінено

- Новий публічний субшлях `simplycms/contracts/shipping-providers` (T0, лише
  типи й константи): `SHIPPING_PROVIDER`, `SHIPPING_PROVIDERS`,
  `ShippingPricing`, `ShippingSnapshot`. `parseShippingSnapshot` — у
  `simplycms/domain/shipping`.
- Режим ціни в рушії `resolveShippingRate`: `rates` — тариф зони, `carrier` —
  `shipping_cost = 0`, `total = subtotal`, підпис «За тарифами перевізника» в
  чекауті (список способів і підсумок квоти) і в замовленні.
- Замовлення зберігає знімок доставки (`methodName`, `provider`, `pricing`,
  адреса або точка). Картка адмінки, `order-success` і кабінет показують назву
  точки на момент оформлення, а не uuid.
- Адмінка доставки на `simplycms/admin-server` + `simplycms/admin-data`:
  `/admin/shipping/methods*` (тарифи за зонами в картці способу),
  `/admin/shipping/zones*` (дефолт — `setDefaultShippingZone` під
  advisory-lock; дефолтну зону не вимкнути й не видалити),
  `/admin/shipping/pickup-points*`. `/admin/shipping` перенаправляє на
  способи. Права — нова authz-операція `shipping.manage`.
- `defineAdminResource` отримав опційні `lock` і `guard`: інваріанти запису
  перевіряються над усім пакетом insert/update під advisory-lock. Відмова —
  409 `state` з тостом.
- Після мутацій доставки інвалідуються довідник чекауту, склади (`useStock`)
  і ключі точок видачі.
- `pnpm live:smoke` отримав крок доставки (`scripts/live-smoke/admin-shipping.mjs`).

### Прибрано

- Сім легасі-сторінок доставки на `supabase-js` (`Shipping*`,
  `PickupPoint*`). Лічильник `useSupabaseClient` у `src/admin/**` — 31 → 24.

## [0.8.0] — 2026-10-05

Захід оновлень залежностей, безпеки й тулінгу (спека
[`2026-10-04-deps-security-tooling-design.md`](docs/superpowers/specs/2026-10-04-deps-security-tooling-design.md))
плюс трек «Стандарти індустрії» (CSRF, санітизація HTML, помилки валідації).
Магазинів на SimplyCMS немає — без зворотної сумісності, шимів немає.

### 🔴 BREAKING для магазинів

- **Baseline міграцій змінено** (`accounts.issuer` прибрано): базу магазину
  перестворити (`pnpm db:demo`), окремої міграції немає.
- **Нові host-файли** (`start.ts`, `routes/__root.tsx`, `tsconfig.json`): у
  `requestMiddleware` першим стоїть `csrfMiddleware` (`simplycms/runtime/csrf`);
  `ErrorBoundary` у `__root.tsx` типізований `ErrorComponentProps` (`error` —
  `unknown`); з `tsconfig.json` прибрано `baseUrl` (TypeScript 6). Магазин
  має перенести зміни з канону host (`packages/cli/host`).
- **Прибрано публічний субшлях** `simplycms/schema/relations`. Додано субшляхи
  `simplycms/sanitize` (server-only) і `simplycms/runtime/csrf`.
- **Теми рендерять розмітку контенту лише через `RichHtml`** — поля view-model-ів
  (`CatalogSectionInfo.description`, `ProductDetailDescription.html`) тепер типу
  `SanitizedHtml`; сирий `dangerouslySetInnerHTML` заборонено лінт-правилом.
- **Залежності магазину** (шаблон): TypeScript `^6.0.3`, React/ReactDOM
  `^19.3.0`, `@tanstack/react-db` 0.5.3 (+ `@tanstack/query-db-collection`
  1.3.4), `better-auth` 1.7.7, `sanitize-html` (залежність ядра), `dotenv` 18.
  Peer `react` пакетів лишається `^18.0.0 || ^19.0.0` (не змінено).
- **Серверні функції:** `.inputValidator()` → `.validator()` (див. нижче);
  помилки валідації адмін-serverFn тепер `ValidationError` (400), а не сирий
  `ZodError`.

### Додано / змінено

- **`inputValidator` → `validator`** у всіх серверних функціях і коментарях;
  ESLint-правило `no-input-validator` забороняє застарілий `.inputValidator()`.
- **TypeScript 6.0.3** (прибрано `baseUrl`, без `ignoreDeprecations`; TS 7
  блокує лише peer `typescript-eslint` — реєстр `UPSTREAM:TSESL-1`); `tsx` —
  у `devDependencies` (`live:smoke` у чистому клоні).
- **Агентний тулінг і доки:** `AGENTS.md` за моделлю MetaHub, `CLAUDE.md` =
  `@AGENTS.md` + лише Claude Code; канон підсистем — `docs/architecture/*`,
  `docs/development/{TOOLING,ENVIRONMENT,CODEBASE_MEMORY}.md`; код-шар —
  `codebase-memory-mcp` + `orient --map` замість graphify; артефакти Copilot
  прибрано; дисципліна git (коміти лише від імені власника).
- **Помилки валідації адмін-serverFn → помилки полів** (тема 12 спеки стандартів
  індустрії, борг №15): Zod-відмова на межі serverFn більше не показується сирим
  JSON у тості. Нова доменна помилка `ValidationError` (закритий реєстр
  `contracts/domain-errors`) несе `issues` (`path` + код + параметри схеми) крізь
  білий список — без сирих повідомлень Zod і відлуння вводу; `domainErrorAdapter`
  везе її через межу serverFn. Серверне перетворення — в одному місці
  (`adminInput`/`parseAdminInput`, 400), клієнтський `applyServerValidation`
  розкладає issues по полях (StockEditor, PricesEditor, форми модифікації й
  товару; загальний локалізований тост — лише для проблем без поля).
  Ключі `admin.validation.*` у каталогах uk і en. Контракт — `data-layer.md` §10.
- `numeric`-колонки в `columnsToZod`: десятковий формат за precision/scale —
  `'abc'` і надлишок цифр дають 400 замість `22P02`/500 від БД. Навмисний виняток
  із паритету з drizzle-zod (гейт не послаблено).
- Нові тести форм — на `@testing-library/user-event` (devDependency).

### Безпека

- `better-auth` 1.7.1 → **1.7.7** (точний пін): закрито GHSA-965c-763c-88jm
  (critical, OAuth state як Magic Link), GHSA-r4xp-prcw-77qf (high, OAuth
  Proxy), GHSA-44jh-23m7-hpcf (low, rate-limit на PG у drizzle-адаптері). Наша
  конфігурація не вмикає `magicLink`/`oauthProxy`, але пакет — у `dependencies`
  опублікованого `simplycms`.
- tiptap → `^3.31.4` (7 пакетів у корені + `extension-image` і
  `extension-text-align` у `dependencies` ядра); `jsdom` → `^30.1.2`; `vitest`
  → `^4.1.11` (піднято нижню межу); транзитиви `js-yaml`, `nanoid`,
  `brace-expansion`, `@tiptap/core` — оновлено в `pnpm-lock.yaml`.
- `pnpm audit`: лишається лише `esbuild` через `drizzle-kit` (dev-only).

- **CSRF-захист** (тема 2 спеки): Start вмикає дефолтний захист лише без
  `startInstance`, а в нас він є — тож server functions і POST-роути були без
  перевірки origin. Новий субшлях `simplycms/runtime/csrf`
  (`csrfMiddleware`, `CSRF_EXEMPT_PREFIXES = ['/api/auth/']`) стоїть першим у
  `requestMiddleware` усіх трьох `start.ts` (host, канон CLI, шаблон):
  мутуючий запит без same-origin (`Sec-Fetch-Site` → `Origin` → `Referer`) —
  403. `live:smoke` доводить 403 на справжній server function і на
  `/api/revalidate-theme`.

- **Збережений XSS у відгуках і описах** (тема 9 спеки): розмітка відгуку
  покупця писалася сервером без очищення й виводилась через
  `dangerouslySetInnerHTML` у вітрині (`ReviewCard`) і в адмінці
  (`ReviewDetail` — перехоплення сесії власника); так само сирими виводились
  описи розділів, опцій характеристик і товарів. Тепер:
  - новий server-only модуль `simplycms/sanitize` (`sanitizeRichHtml(html,
    'review' | 'content')` на `sanitize-html`; залежність ядра) з білими
    списками, що збігаються з виводом редакторів; брендований тип
    `SanitizedHtml` у `simplycms/contracts`;
  - рубіж 1 (запис): відгук і generic-write адмін-ресурсів (`richHtml` у
    `defineAdminResource`; товари, розділи, опції характеристик);
  - рубіж 2 (віддача): лоадери вітрини й читання адмінки очищують розмітку
    (старі рядки, сід, демо); нова серверна операція `getAdminReviewContent`
    для сторінки модерації;
  - компонент `simplycms/ui/rich-html` (`<RichHtml html={SanitizedHtml}/>`) —
    єдине місце `dangerouslySetInnerHTML` для контенту; поля view-model-ів
    (`CatalogSectionInfo.description`, `ProductDetailDescription.html`) мають
    тип `SanitizedHtml`: **теми рендерять розмітку лише через `RichHtml`**;
  - ESLint-правило `simplycms-rich-html/no-dangerously-set-inner-html`
    (винятки — `<style>` токенів теми, `ui/chart`, інлайн-скрипти `__root.tsx`);
  - тести: вектори атак, round-trip зі справжніми Tiptap-редакторами, харнес
    проти БД, крок `review-xss` у `live:smoke`.

### Залежності (мінорні)

- До останніх версій у межах поточних мажорних: vite 8.3.2 + `@vitejs/plugin-react`
  6.1.1, zod 4.6.5, prettier 3.9.9 (форматування репо не змінилось), eslint
  10.12 + typescript-eslint 8.71, react-hook-form 7.89, `@hookform/resolvers`
  5.9.1, `@tanstack/react-query` 5.104.1, lucide-react 1.51, pg 8.23.1,
  drizzle-orm 0.45.3 / drizzle-kit 0.31.11, `@clack/prompts` 1.8.1, UI-патчі,
  testing-library, `@types/node`, `@supabase/*`.
- React 19.2.8 → **19.3.0** (`react`, `react-dom`, `@types/react*`; корінь і
  `apps/www`). Нові API (`<ViewTransition />` тощо) не впроваджено.
- tsdown 0.22.14 → **0.23.0** (JS у `dist` побайтово той самий; перевірено
  `build:packages`, `test:packaging`, `pilot:pack`).
- Шаблон магазину і пілотний оверлей вирівняно за версіями з коренем (було: lucide
  0.563, react 19.2.4, zod 4.3.6, tiptap ^3.19…). Новий тест
  `tests/template-version-parity.test.ts` стереже парність версій корінь ↔
  шаблон ↔ оверлей; свідомі розбіжності — явним списком із причиною (пара
  TanStack DB бампається окремим етапом; `react-day-picker` лишається на ^9, бо
  `ui/calendar.tsx` ядра написаний під API v9).
- vitest 4.1.11 → **5.0.3** (поломок тестів немає: 1867/1867 і 352/352 без правок
  тестів і без compat-налаштувань).
- dotenv 17 → 18: `config({ quiet: true })` у `drizzle.config.ts` і
  `dump-demo-data.mjs` (18 друкує «injected env» у stderr).

### Видалено

- `simplycms/schema/relations` (`schema/relations.ts`, 39 `relations()`): мертвий
  код — `drizzle(client)` у `withActor` створюється без `schema`, тож `db.query.*`
  неможливий за побудовою. Субшлях прибрано з обох карт `exports`; у Drizzle 1.0
  реляційні запити — інший API (`defineRelations`).

### Змінено

- 🔴 **Власний генератор zod-схем `columnsToZod`** (крок 4 треку оновлень, Етап B):
  схеми ресурсів адмінки будує власний генератор (9 типів колонок, невідомий —
  throw) і більше не залежать від `drizzle-zod`; `SafePick` і касти прибрано,
  `resource-schemas.ts` 182 → ~125 рядків, DZOD-1 закрито, проєкційні касти
  Drizzle виділено в `DRZ-2`. `drizzle-zod` знято з `dependencies` ядра (і з
  `SERVER_ONLY_DEPS`): лишився `devDependency` лише як еталон постійного гейта
  паритету з мутаційним контролем — `test-contours.md` §11.3.
- 🔴 **Baseline міграцій (правка, без нової міграції):** з `accounts` прибрано
  колонку `issuer` і унікальний індекс `(issuer, account_id)`. Їх мала схема
  better-auth 1.7.0–1.7.2; з 1.7.3 їх немає, і drizzle-адаптер 1.7.7 на старті
  падає з `Drizzle schema mismatch` (обовʼязкова колонка, яку BA не пише). Базу
  магазину перестворити (`pnpm db:demo`).
- 🔴 **TanStack DB 0.11.3** (крок 2 треку оновлень; `@tanstack/react-db` 0.5.3 і
  `@tanstack/query-db-collection` 1.3.4 — точні піни в корені й шаблоні, `~` у
  peers ядра). Знято обходи TSDB-B1 (`preload()` перед записом) і `gcTime: 0`
  у фабриці on-demand-колекцій; TSDB-1/2/3/4 у реєстрі переписано за виміряною
  поведінкою. 22 файли адмінки (29 викликів: 27 `useLiveQuery` і 2
  `useLiveInfiniteQuery`) на об'єктну форму `useLiveQuery({ query })` замість
  задепрекованої `(fn, deps)`; ратчет — `live-query-object-form.test.ts`.
- 🔴 **Контракт subset серверного шару адмінки:** `eq/gt/gte/lt/lte` приймають
  колонки `filterable` ∪ `sortable`, а діапазонні оператори — ще й `Date`
  (клієнтський курсор пагінації на рівних `created_at` без цього падав з 400).
  `in`/`isNull` — лише `filterable`. `live:smoke` доводить «Показати ще» для
  `/admin/products` і `/admin/orders` на рівних мітках часу без втрат і дублів.

## [0.7.0] — 2026-10-04

Три етапи треку **V2-К3** одним релізом: **Е4 — довідники каталогу**, **Е5 —
замовлення**, **Е5б — редагування позицій замовлення**. Плани, рішення й
факти виконання:
[`2026-10-03-v2-k3-e4-catalog-dictionaries.md`](docs/superpowers/plans/2026-10-03-v2-k3-e4-catalog-dictionaries.md),
[`2026-10-04-v2-k3-e5-orders.md`](docs/superpowers/plans/2026-10-04-v2-k3-e5-orders.md),
[`2026-10-04-v2-k3-e5b-order-items-edit.md`](docs/superpowers/plans/2026-10-04-v2-k3-e5b-order-items-edit.md).
🔴 **Breaking для магазинів на `0.6.0`** (0.x, D5 — без шимів): змінюється
baseline міграцій (базу магазину перестворити, напр. `pnpm db:demo`), частина
`simplycms/storefront/loaders` переїхала в нову теку `simplycms/commerce`.
Нових пакетів немає — мерж публікує ті самі пʼять.

### Додано

- **Живі довідники каталогу в адмінці** (Е4): `/admin/sections*` (плоский
  список, зображення через порт сховища, призначення властивостей «для
  товарів» / «для модифікацій»), `/admin/price-types*` (атомарний дефолт
  під advisory-lock, guarded видалення) і `/admin/properties*` (з опціями).
- **Живі замовлення в адмінці** (Е5): `/admin/orders` (on-demand колекція,
  «Показати ще», фільтр статусу, серверний `maxLimit`) і
  `/admin/orders/$orderId` (картка; зміна статусу іменованою
  `changeOrderStatus`; «Скасоване» — кінцевий статус).
- **Редагування позицій оформленого замовлення** (Е5б): додавання товару
  вузьким пошуком, зміна кількості, видалення. Ціна нової позиції — серверна,
  для покупця замовлення (його тип ціни, категорія, знижки з контекстом
  складу замовлення); залишок коригується дельтою по позиції; підсумок і
  доставка перераховуються правилами чекауту; гроші — у цілих центах.
- **`simplycms/commerce`** (T2, server-only) — ОДНА копія серверного
  ціноутворення (`priceItems`) і перевірки/розрахунку доставки
  (`validateShippingChoice`, `quoteShippingCost`) для чекауту й адмінки.
- **Облік фактично списаного по позиції замовлення** (`simplycms/inventory`):
  скасування (адміном чи покупцем) повертає рівно списане, рівно один раз;
  дельта залишку при редагуванні позицій.
- **Фабрика ресурсу адмінки:** `insertOnly` (колонки лише при створенні),
  `omit` (колонка не потрапляє ні в SELECT/RETURNING, ні в тип — гостьовий
  `access_token` не йде в браузер адміна), `maxLimit` (серверна межа сторінки).
- Операція authz **`order.manage`**; третій вид конфлікту
  `AdminConflictError` — `state` (кінцеві стани, нестача на складі,
  недоступна доставка, остання позиція, межі сум) з локалізованими тостами.
- **`simplycms/contracts/order-status-codes`** — системні коди статусів
  (`new`, `cancelled`) як контракт T0.
- Реєстр легасі-адмінки й свідомих server-first винятків
  (`tests/admin-server-first/registry.ts`), спільна типізована фабрика моку
  `simplycms/admin-server` для тестів, детерміновані тести локів
  (утримання локу в окремому зʼєднанні замість імовірнісних гонок).
- `live:smoke`: кроки адмінки в одній сесії власника — довідники, замовлення,
  редагування позицій.

### Змінено

- 🔴 **Baseline міграцій:** `product_prices.price_type_id` → `ON DELETE
  RESTRICT` (тип ціни з цінами більше не видаляється разом із ними);
  `section_properties.slug` унікальний глобально; `order_items` отримав
  `stock_point_id` і `stock_reserved`.
- 🔴 **`simplycms/storefront/loaders`:** ціноутворення й доставка
  переїхали в `simplycms/commerce` (реекспорту не лишилось);
  `priceCheckoutItems` → `priceItems`.
- `order_statuses.code` незмінний після створення; системні статуси не
  видаляються; формат slug і коду типу ціни перевіряє і сервер
  (`SLUG_RE`, `PRICE_TYPE_CODE_RE` у `simplycms/domain`).
- Легасі-файлів адмінки на `supabase-js`: 43 → 31 (`PriceValidator` —
  свідомий виняток до Е6). Видалено `AddProductToOrder`,
  `SectionPropertiesManager`, `SectionPropertiesTable`.

### Виправлено

- Гість після оформлення бачив «Замовлення не знайдено» на `order-success`
  (токен знімався з URL і випадав із ключа запиту).
- Скасування замовлення повертало залишок за поточним тумблером, а не за
  фактично списаним (фантомні одиниці для товару без обліку на момент
  оформлення).
- Видалення типу ціни мовчки зносило всі ціни цього типу (тепер 409).
- Дубль slug властивості в різних розділах давав неоднозначну сторінку вітрини.
- 🔴 **Безпека:** TanStack Start оновлено до виправленої версії —
  критична reflected XSS у відповідях server functions
  (GHSA-qx66-fv34-fjm8 / CVE-2026-102989): `@tanstack/react-start`
  1.167.42 → 1.168.60 (`start-server-core` 1.169.39), `@tanstack/react-router`
  1.168.23 → 1.170.41, `@tanstack/router-generator` → 1.167.40. Магазинам —
  оновити ці піни в `package.json` до версій шаблону
  `create-simplycms-store` і перевстановити залежності. Супутня зміна
  бібліотеки: `error` у `errorComponent` тепер `unknown` — кастомні
  error-компоненти магазину мають звужувати тип самі (як `__root.tsx`
  шаблону).

### Відомо, не виправлено

Пункт видачі в картці замовлення показується ідентифікатором (К3-Е5-2, Е6а);
у `live:smoke` немає окремого гостьового кроку; відкладене видалення медіа
до підтвердженого Save форми (борг у роадмапі); `priceColumns` — публічний
API `simplycms/commerce`.

## [0.6.0] — 2026-09-24

Етап **V2-К3-Е3 — каталог адмінки on-demand.** План, рішення Е3-1…Е3-20 і
факти виконання:
[`docs/superpowers/plans/2026-09-23-v2-k3-e3-catalog-on-demand.md`](docs/superpowers/plans/2026-09-23-v2-k3-e3-catalog-on-demand.md).
🔴 **Breaking для магазинів на `0.5.0`** (0.x, D5 — без шимів): змінюються
ключі кешу (`entityKey().list()`), host-файл `src/start.ts` і baseline
міграцій. Нових пакетів немає — мерж публікує ті самі пʼять.

### Додано

- **Живі сторінки адмінки каталогу** на чистому Postgres: `/admin/products`
  (перша on-demand колекція TanStack DB із push-down фільтрів розділ /
  активність / наявність у Drizzle, «Показати ще» через
  `useLiveInfiniteQuery`), `/admin/products/new` і `/admin/products/$productId`
  (розділ, зображення через порт сховища, SEO, модифікації з дефолтом і
  порядком, ціни товару й модифікацій, залишки по точках видачі, значення
  властивостей scalar і multiselect).
- **`simplycms/inventory`** (T2, server-only) — ОДНЕ правило залишку й
  `stock_status` для вітрини й адмінки: обслуговуючі точки
  (`is_system OR is_active`), порядок локів, гвард `on_order`.
- **Серверний шар каталогу:** `runAdmin` (grant → scope → `withActor`),
  ресурси товару й сателітів, іменовані операції `setDefaultProductModification`,
  `reorderProductModification`, `saveProductPrices` (атомарний набір),
  `saveStock` (кількості + статус в одній транзакції), advisory-lock цілі.
- **Контракт помилок через межу serverFn:** `simplycms/contracts/domain-errors`
  (T0, закритий перелік) + `simplycms/runtime/domain-error-adapter`
  (`serializationAdapters` у `createStart`) — `AdminConflictError`
  (`kind`/`constraint`) і `AuthzError` (`operation`) доходять до клієнта
  цілими; конфлікти `23505`/`23503` → 409 → локалізований тост.
- **`PluginTablePort.queryKey`** у `plugin-sdk` — ключ кешу таблиці плагіна
  народжується в порту, поруч із даними.
- Легасі-сторінки адмінки, що ще на `supabase-js`, без Supabase env
  показують заглушку «Розділ ще не перенесено на V2» (`admin.legacy.notMigrated`)
  замість падіння.
- Реєстр обходів дефектів бібліотек —
  [`docs/architecture/upstream-workarounds.md`](docs/architecture/upstream-workarounds.md),
  місця в коді позначено `UPSTREAM:<ID>`.
- Нові гейти: ESLint-правило `no-collection-key-outside-admin-data`, кейс
  `bareListSegment` у `query-key-from-entity` (зона — і тема, і плагін),
  `on-demand-factory-only`, `mutation-cache-sync-coverage`,
  `schema-sources-parity` (`schema.ts` ≡ drizzle snapshot ≡ канон
  міграцій), `explicit-ids` на `admin/features/**`, окремий лічильник
  `pageerror` адмінки в `live:smoke`, крок адміна в `live:smoke`.

### Змінено

- 🔴 **`entityKey(x).list()` прибрано.** Ключ колекції — `collectionKey(entity)`
  (лише `admin-data`, під лінт-правилом); поза адмінкою — `entityKey(x).variant(…)`.
  Причина — write-back `@tanstack/query-db-collection` пише в УСІ ключі під
  префіксом `[entity, 'list']` (TSDB-1).
- 🔴 **Host `src/start.ts`** реєструє `domainErrorAdapter` — наявним
  магазинам `pnpm simplycms update`.
- 🔴 **Baseline міграцій (рамка B13):** унікальність значень властивостей —
  `(власник, property_id, option_id) NULLS NOT DISTINCT`; multiselect —
  рядок на опцію (раніше CSV у uuid-колонці не працював).
- **Контракт тем v3 (адитивно):** `ProductPropertyValueViewModel.option`
  отримав обовʼязкове `name`; назва опції на вітрині — з `property_options`,
  а не з денормалізованого `value`.
- On-demand колекції — лише через `onDemandCollectionOptions` (`gcTime: 0`,
  TSDB-1): інакше повернення на список показувало обрізаний набір.
- Лінт-норма — **0 errors / 8 warnings** (було 10: видалено легасі-компоненти
  властивостей).

### Виправлено

- Після збереження товару список показував лише цей товар до F5.
- Конфлікти (дубль slug, товар у замовленнях) показували технічний рядок
  замість локалізованого тосту.
- Автозбереження значень властивостей губило символи й повертало зняті
  опції (паралельні транзакції) — тепер blur/Enter і черга на властивість.
- Мережевий фейл показував «Failed to fetch» — тепер `admin.errors.network`.

### Відомо, не виправлено

`saveProductPrices` не звіряє `modificationId` ↔ `productId`; дубль
`pickupPointId` у `saveStock` → 409 замість 400; можливий дедлок
`setDefault` ↔ `reorder`; ручне `in_stock` при нульовому залишку —
продуктове питання Е4.

## [0.5.0] — 2026-09-16

Етап **V2-К3-Е2 — порт сховища файлів** (PR #49). План:
[`docs/superpowers/plans/2026-09-13-v2-k3-e2-storage-minimum.md`](docs/superpowers/plans/2026-09-13-v2-k3-e2-storage-minimum.md).
Нових пакетів немає.

### Додано

- **Порт `simplycms/storage`** (T2, server-only): драйвер `local-fs`
  (іммутабельні ключі `ab/<uuid>.<ext>`, атомарна публікація через `link`,
  ідемпотентне видалення); `inspectUpload` — MIME за магічними байтами, SVG
  заборонено, ліміт розміру; `writeMedia`/`eraseMedia` — файл і рядок `media`
  в одній транзакції актора; `serveMedia` + роут `/media/$` з `nosniff` і
  `Cache-Control: immutable`, явні `GET` і `HEAD`.
- `simplycms/domain/media` — `resolveMediaUrl` (у БД лежить референс, не
  URL; зовнішні `https?:`, `data:` і `/…` проходять як є).
- Операція authz `media.write`; опційний серверний ключ env `MEDIA_ROOT`
  (контракт магазину лишається трьома ключами — у `.env.example` він
  закоментований).
- Живий споживач — **аватар покупця** (крок `pnpm live:smoke`).
- ESLint-правила `simplycms-storage/no-direct-storage` і
  `simplycms-client-boundary/no-server-only-in-client`.

### Змінено

- `MediaProvider` (T0) звужено: `upload()` прибрано, `url()` повертає
  `string | null`.
- `ImageUpload` адмінки переведено на порт; лінт-норма 12 → 10 warnings.

### Виправлено

- HEAD на `/media/$` віддавав HTML замість заголовків файлу (Start не
  виводить HEAD із GET).
- Аватар автора відгуку їхав на вітрину сирим ключем; прибирання файла-сироти
  не спрацьовувало.

## [0.4.1] — 2026-08-29

Контур **0.4.1 — «Supabase зі шляху вітрини»** (трек V2, після К1′б). План і
межі:
[`docs/superpowers/plans/2026-08-24-v2-supabase-severance-041.md`](docs/superpowers/plans/2026-08-24-v2-supabase-severance-041.md).
🔴 **Breaking для будь-якого магазину на `0.4.0`** (0.x, D5 — без шимів):
міняється контракт `.env`, зникає субшлях `simplycms/data-supabase` і два
db-скрипти. Нових пакетів не зʼявляється — мерж у `main` публікує ті самі
пʼять.

### Змінено

- 🔴 **Контракт env магазину — рівно ТРИ ключі:** `DATABASE_URL` і
  `BETTER_AUTH_SECRET` (серверні, з `process.env` у рантаймі) +
  `VITE_SITE_URL` (клієнтський). `VITE_SUPABASE_URL`/`_PUBLISHABLE_KEY`/
  `_ANON_KEY`, `SUPABASE_PROJECT_ID` і `SUPABASE_ACCESS_TOKEN` із
  `.env.example` і зі скаффолдера знято; `create-simplycms-store` приймає
  `--database-url` замість `--supabase-url`/`--supabase-key`, сам генерує
  `BETTER_AUTH_SECRET` і показує накат канону через `psql`.
- 🔴 **`EngineContext` = `{ links, config }`.** Порти-репозиторії
  (`catalog`/`orders`/`scope`/`identity`/`media`) більше не інжектяться в
  React-контекст: у браузері даних немає взагалі, читання йде серверними
  лоадерами `simplycms/storefront` через `simplycms/db`. Самі контракти
  портів у `simplycms/contracts` лишились — під майбутній `data-pg`.
- 🔴 **`CMSProvider` не монтує `SupabaseProvider`** — вітрина збирається й
  працює без жодного Supabase-ключа (регресія-тест
  `core/__tests__/cms-provider-no-supabase.test.tsx`).
- **`/api/health` пінгує Postgres** (`select 1` через `withActor`), а не
  Supabase: до цього healthcheck зеленів на магазині з мертвою базою.
- **`AvatarUpload` чесно відмовляє** до порту сховища (К4): показує аватар
  або ініціали, `input[type=file]` вимкнений, причина — видимим текстом із
  каталогу. Заглушки, яка «успішно» нічого не зберігає, свідомо немає.
- **`doctor`:** `checkEnv` гейтить `DATABASE_URL` + `BETTER_AUTH_SECRET`;
  онлайн-перевірки (Supabase REST) знято — HTTP-API до БД у контракті v2
  немає; у звіті лишається видимий skip із причиною й треком К3.
- **Пілот:** env скретча — рівно контракт магазину (раніше підставлялись
  ФІКТИВНІ Supabase-ключі, тож `pilot:pack` зеленів саме на тому класі
  регресії, який ловить реальний магазин); Gate B бере назви товарів прямим
  SQL за `DATABASE_URL`; `SERVER_PAYLOAD` Gate C розширено на
  `simplycms/dist/db`, `drizzle-orm` і `pg`.

### Знято (breaking, 0.x, D5 — без шимів)

- **Субшлях `simplycms/data-supabase`** і весь шар репозиторіїв на Supabase
  (`catalogRepository`, `orderRepository`, `identityProvider`, `mappers`,
  `scope`) — 0 споживачів після К1′б.
- **Роут `/api/guest-order`** — дублював `placeOrder` в обхід нового
  контуру (сервер-first + `withActor`).
- **`pnpm db:generate-types`, `pnpm types:baseline`, `supabase/types.ts`** і
  місток `StoreDatabase`. Джерело типів для нового коду —
  `simplycms/schema/types` (Drizzle, B12); `src/supabase/database.ts`
  заморожений до К3.
- **`pnpm test:e2e`, `pnpm pilot:e2e`, прапорець `--e2e` і Gate E** разом із
  локальним стеком Supabase (`scripts/e2e.mjs`, `scripts/e2e/`,
  `scripts/pilot-pack/e2e.mjs`, `gate-e.mjs`). `--e2e` тепер падає з
  поясненням, а не мовчки ігнорується; специ `tests/e2e/**` і
  `playwright.config.ts` лишились без входу — основа відновлення в К6.

### Документація

- Канон (`.github/instructions/*`, `AGENTS.md`, `packages/README.md`,
  скіл `code-review`, prompt-и) і публіковані README приведені до стану
  після severance; `supabase db push` замінено на реальний psql-накат.
- `CLAUDE.md`, [`test-contours.md`](docs/architecture/test-contours.md)
  (банери DECOMMISSIONED), [`v2-state-map.md`](docs/tasks/v2-state-map.md)
  (§2.1 — результат ОКРЕМОГО живого прогону саме під контракт 0.4.1) і
  [роадмап](docs/tasks/platform-roadmap.md) (борги 0.4.1-1…11, зокрема три
  дефекти безпеки, які цей контур **не** закриває).

### Виправлено за результатами рев'ю контуру

Рев'ю шістьма лінзами + адверсаріальна перевірка кожної знахідки, два кола
фіксів. Три дефекти, доведені живими прогонами (не читанням коду):

- **Gate B пілота ходив у БД голим `select`** за `DATABASE_URL`. За контрактом
  0.4.1 це роль `app_runtime`, у якої прямих грантів немає за побудовою, тож
  гейт падав із `permission denied for table products` рівно тоді, коли
  розробник дотримався власного контракту, і зеленів на привілейованому DSN.
  Тепер запит іде з преамбулою актора (`begin; set local role app_user`) —
  тією самою, що в `withActor`. 🔴 `pnpm pilot:pack` цього не ловив ніколи: він
  Gate B не запускає взагалі.
- **Роль `app_runtime` не може накотити схему** — ні `create schema`, ні
  `alter role`, ні навіть `create table` для міграції плагіна. А **вісім**
  місць документації друкували `psql "$DATABASE_URL"` як команду накату
  (вивід CLI, README шаблону й пакета, кореневий README, `packages/cli/README.md`,
  `cli.md`, `plugins.md`, README обох шаблонів плагіна). Усі переведені на
  підключення власника БД; гарди — на вивід CLI **і** на вміст README шаблону
  (перший фікс закрив лише вивід, README пропустив).
- **Тест генерації `BETTER_AUTH_SECRET` перевіряв лише довжину** — зашитий
  спільний секрет на 32+ символи проходив (доведено мутацією). Тепер
  асертиться різність між двома скаффолдами і форма base64.

Побічно: `src/engine.shared.ts` внесено в `SYNCED_FILES` (копії були
байт-ідентичні, а канон стверджував «навмисно відрізняється» — тримала їх
такими лише ручна правка обох); знесено мертвий `StorefrontClient =
SupabaseClient`; мертвий `simplycms/data-supabase` прибрано з deny-листа межі
довіри плагінів.

---

## [0.4.0] — 2026-08-24

🔴 Реліз топології 5 пакетів: у реєстрі — `simplycms` + сателіти
`@simplycms/{cli,theme-solarstore,plugin-faq}` + `create-simplycms-store`;
усі 22 злитих імені `@simplycms/*` (версії 0.1.0–0.3.0) позначені
`npm deprecate`. Нижче — усе, що приїхало цим релізом: Фази 3 і 4, трек
редизайну за референсом і трек К0.

Фаза 3 роадмапу — Plugin SDK v1. План і межі:
[`docs/superpowers/plans/2026-08-14-phase3-plugin-sdk.md`](docs/superpowers/plans/2026-08-14-phase3-plugin-sdk.md).
🔴 Мерж у `main` опублікує ДВА нові пакети (`@simplycms/plugin-sdk`,
`@simplycms/plugin-faq`) — введення пакета є релізним рішенням у момент мержу.

### Додано

- **`@simplycms/plugin-sdk`** — контракт `definePlugin` (спека §7), порти
  `usePluginTable` (CRUD лише по `plg_*`), `usePluginConfig` (настройки зі
  схемою+дефолтами), `usePluginT` (i18n плагіна, дзеркало `useThemeT`);
  реекспорт `validatePluginModule`.
- **`@simplycms/plugin-faq`** — референс-плагін повного контуру: таблиця
  `plg_faq_items` (міграція в пакеті), adminRoutes `/admin/faq`, слот
  `product.detail.after`, Zod-settings, каталог uk/en.
- **`simplycms create plugin <name>`** — скаффолд плагіна в `plugins/`
  магазину (шаблон — `template-plugin/` у tarball CLI, під Gate TOOL).
- **`simplycms db:diff` — N канонів**: ядро + міграції встановлених плагінів
  (`own` рахується по обʼєднанню), SQL-лінт межі `plg_<name>_*`,
  конфлікт канонів — error; doctor №7 узгоджено.
- **Реальна semver-перевірка `engines.simplycms`** (warn-режим на 0.x):
  `satisfies` + `CORE_VERSION` у `@simplycms/objects/semver` (новий subpath);
  бамп константи вбудовано в release-скрипт, парність — під тестом.
- **dependency-lint межі довіри**: eslint-зона `no-restricted-imports` на
  `plugins/**` і `packages/simplycms-plugin-*/**` (без `@simplycms/supabase`,
  `@simplycms/data-supabase`, `@supabase/*`); негативний контроль —
  `tests/plugin-trust-boundary.test.ts`.
- **i18n плагінів**: `plugins/` і референс-пакети в `SCANNED_ROOTS`;
  парність каталогів — `tests/plugin-messages-parity.test.ts`.

### Змінено

- 🔴 **`@simplycms/plugins`**: `PluginManifest` розширено (`engines`,
  `edgeFunctions`, `buckets`); `bootstrapPlugins` валідує модулі
  (`validatePluginModule`, невалідний → skip) і пише `hooks` у рядок БД;
  форма налаштувань в адмінці рендериться з Zod-схеми зареєстрованого
  модуля (`z.toJSONSchema`), toggle і uninstall — лише через lifecycle.
- 🔴 **`@simplycms/admin`**: peer `zod` звужено до `^4.0.0`
  (`z.toJSONSchema` — Zod-4-only).
- Маніфести тем: `engines.simplycms` — `'>=0.1.0'` (caret на 0.x не
  покривав ядро 0.3.0; warn-перевірку додано у `validateThemeModule`).
- `plugins/hello-world` переписано на `definePlugin` + власний каталог
  `messages` (метадані реєстру — англійською).

### Знято (breaking, 0.x, D5 — без шимів)

- **`PluginSettingDefinition`** і `PluginManifest.settings` — налаштування
  описуються Zod-схемою в `definePlugin({ settings })`.
- **`InstallPluginDialog`** (runtime-встановлення руками) — суперечив
  build-time lifecycle §7 (`simplycms add`).

---

Фаза 4 роадмапу — Теми як пакети + маркетплейс-індекс. План і межі:
[`docs/superpowers/plans/2026-08-14-phase4-themes-as-packages.md`](docs/superpowers/plans/2026-08-14-phase4-themes-as-packages.md).
🔴 Мерж у `main` опублікує НОВИЙ пакет (`@simplycms/theme-solarstore`) —
введення пакета є релізним рішенням у момент мержу (той самий шлях, що
`@simplycms/plugin-sdk`/`@simplycms/plugin-faq` вище й `@simplycms/cli`
раніше).

### Додано

- **`@simplycms/theme-solarstore`** — референс-тема повного контуру як
  npm-пакет (тека `packages/simplycms-theme-solarstore`): manifest, design
  tokens, Header/Footer/HeroBanner/HomeSections, каталог uk/en. Host
  споживає її як звичайну залежність (`solarstore: () => import('@simplycms/theme-solarstore')`).
- **`bootstrapThemes`** (`@simplycms/themes`) — дзеркало плагінного
  `syncPluginRows`: дописує в таблицю `themes` рядки для зареєстрованих,
  але відсутніх у БД тем; без цього адмінка (читає лише БД) не бачила б
  встановлену через конфіг тему.
- **Registry-awareness адмінки тем** — `Themes.tsx` звіряє рядок БД з
  `ThemeRegistry.has(name)`: модуля немає в білді → бейдж «модуль
  відсутній» + disabled «Активувати» (дзеркало `Plugins.tsx`).
- **`simplycms create theme <name>`** — скаффолд теми в `themes/` магазину
  (шаблон — `template-theme/` у tarball CLI, під Gate TOOL).
- **`simplycms add <pkg> --theme --copy`** — друга гілка установки теми зі
  спеки §17.4: копія `src/*` пакета в `themes/<key>/` зі злиттям
  залежностей, пакет знімається (shadcn-модель, повне володіння без
  апстрім-фіксів).
- **Doctor, перевірка №11 (warn)** — записи `themes`-конфігу резолвляться
  + підказка про Tailwind-глоби сторонньої теми.
- **Tailwind-глоби сторонніх тем** у шаблоні скаффолдера:
  `node_modules/simplycms-theme-*/dist/**/*.js` і
  `node_modules/@*/simplycms-theme-*/dist/**/*.js`.
- **Контракт маркетплейс-індексу** — `docs/marketplace/README.md` (вимоги
  подачі + гейт власника щодо ліцензії екосистеми) і
  `docs/marketplace/index.sample.json`, під Zod-схемою
  `tests/marketplace-index.test.ts`.
- **`docs/architecture/themes.md`** — повний механізм тем: пакування
  npm/copy-in, `bootstrapThemes`, conformance-kit, чекліст автора.

### Змінено

- 🔴 **`bump.mjs`** тепер переписує version-літерали маніфестів
  референс-пакетів (`packages/simplycms-plugin-*/src/index.ts`,
  `packages/simplycms-theme-*/src/manifest.ts`), не лише `package.json` —
  наступний реліз більше не падає на власних parity-гейтах через
  розсинхрон літерала.
- Амендменти спеки платформи §5 (Tailwind-скан — `content`-глоби, не
  `@source`-директиви) і §6 (`ThemeManifest` фактично несе `displayName`).

Інкремент Б.2 треку C — шліфування механізму клонування дизайну після
лайв-тесту. Задача і межі:
[`docs/tasks/redesign-mechanism-b2.md`](docs/tasks/redesign-mechanism-b2.md).
Скіл `redesign-from-reference` їде в tarball `create-simplycms-store`
(`pnpm template:sync`), тож зміни нижче видно авторам магазинів.

### Додано

- **Motion-капчер інспекції** — `inspection.json` піднято до
  `schemaVersion: 2` з новою верхньорівневою секцією `motion`: `transitions`
  (кластери property/durationMs/easing/count), `keyframes` (+ чесний
  `inaccessibleSheets`, рекурсія в `@media`/`@supports`/`@import`), `reveal`
  (дифи opacity/transform на ПЕРШОМУ скролі), `hover` (детерміністичний
  прохід Playwright `hover()`, стеля 20 вузлів, лічильник `skipped`),
  `jsLibraries` (GSAP/Framer/Lottie/anime.js) і похідний `jsDrivenSuspected`.
  `map-tokens.mjs` приймає обидві версії; токени теми НЕ розширені — рух
  живе в CSS компонентів.
- **`scripts/dev-stand/`** — санітизований demo-датасет діагностичного
  стенда: allowlist каталожних таблиць і колонок як константа (жодних
  користувачів, замовлень і персональних даних за побудовою), чиста
  генерація ідемпотентного SQL (`on conflict (id) do update`) під тестом на
  фікстурі, `seed-demo.sql` — gitignored. Сід пілота й `scripts/pilot-pack/`
  не чіпані.
- **Фаза 6 скіла «Шліфування»** (опційна) — драбина рішень токен → setting
  теми → кастомна сторінка `src/routes/my/` → свідомо прийняти канон;
  щабель «view теми» позначено як відсутній до треку A.

### Змінено

- 🔴 **`simplycms create theme|plugin` працює в корені монорепо ядра** —
  новий `findScaffoldRoot` визнає маркер `pnpm-workspace.yaml` +
  `simplycms.config.ts`. Радіус навмисно вузький: `doctor`/`add`/`update`/
  `db:diff` користуються старим `findStoreRoot` і в монорепо гучно
  відмовляють — інакше doctor давав би поради по коректних за побудовою
  `routes.ts`/`tailwind.config.ts`, а `update --write` міг би мовчки
  відкотити host-файли (його напрям істини зворотний до `template:sync`).
- **Вага шрифт-сімʼї в інспекції** — сума довжин тексту прямих TEXT_NODE
  (cap 400 символів на вузол) замість кількості елементів; частота лишилась
  tie-break-ом. Численні `<span>`-мітки в моно більше не перебивають
  body-гарнітуру, як це сталося на лайв-тесті.
- **Фаза 5 скіла — обовʼязковий side-by-side** по КОЖНОМУ підтвердженому
  типу sitemap із класифікацією кожної розбіжності (токен-фіксабельна /
  дані / структурна-за-дизайном) і підсумковою таблицею; спека-файли
  компонентів дістали обовʼязкову секцію `## Motion`.

Трек К0 — консолідація пакетів 26 → 5 + доставка агентних скілів. Спека
[`2026-08-20-package-consolidation-design.md`](docs/superpowers/specs/2026-08-20-package-consolidation-design.md),
[план](docs/superpowers/plans/2026-08-20-package-consolidation.md).
🔴 **Breaking для будь-якого магазину, зібраного на `0.3.x`** (0.x, D5 — без
шимів): 22 пакети ядра зникають як окремі імена, їхній код доїжджає
субшляхами одного пакета. Мерж у `main` публікує НОВИЙ unscoped пакет
`simplycms` і незворотно займає це ім'я в глобальному просторі імен npm.

### Додано

- **`simplycms`** — unscoped фреймворк-пакет: увесь T0–T5 теками
  `packages/simplycms/src/*` (`contracts`, `domain`, `schema`, `supabase`,
  `data-supabase`, `react-query`, `runtime`, `i18n`, `storefront`, `ui`,
  `themes`, `plugins`, `plugin-sdk`, пʼять `*-ui`, `core`, `admin`,
  `storefront-routes`), роут-теки `routes/{storefront,admin}`, core-міграції
  `migrations/`, агентні скіли `skills/`. 79 входів `exports`-мапи —
  чинні публічні входи перенесені за правилом 1:1
  (`@simplycms/<pkg>/<sub>` → `simplycms/<тека>/<sub>`).
- **Тір-зони напрямку шарів** — `eslint.tier-zones.mjs` +
  `eslint.tier-relative.mjs`: 23 зони (21 тека `src/` + дві роут-теки),
  кожна заборона у двох формах специфікатора — bare-субшлях
  `simplycms/<тека>` і відносний `../<тека>`. Повертають межу, яку до
  консолідації тримали `dependencies` окремих пакетів. Негативний
  контроль — `tests/tier-boundary.test.ts`.
- **Доставка скілів симлінками** — тека `skills/` пакета `simplycms` замість
  копії в шаблоні: `create-simplycms-store` створює
  `.agents/skills/<name>` і `.claude/skills/<name>` →
  `node_modules/simplycms/skills/<name>` після install, `simplycms update`
  доробляє відсутні й прибирає осиротілі, `doctor` дістав перевірку №12.
  Оновлення ядра тепер оновлює скіл автоматично.
- **`tests/dist-import-meta.test.ts`** (packaging-suite) — гард лоуереного
  `import.meta` у зібраному `dist` (див. «Виправлено»).
- Точні набори замість порогів у реліз-гардах:
  `tests/release-bump-coverage.test.ts` (5 пакетів) і
  `tests/published-exports-parity.test.ts` (4 — `create-simplycms-store`
  відсікається за іменем).

### Змінено

- 🔴 **Специфікатори ядра — субшляхи `simplycms/<тека>`.**
  `@simplycms/objects` → `simplycms/contracts`; решта — імʼя теки
  один-в-один (`@simplycms/ui` → `simplycms/ui`, `@simplycms/plugin-sdk` →
  `simplycms/plugin-sdk` тощо). Роут-теки лишили СТАРІ ключі exports
  (`./storefront-routes/routes/*`, `./admin-routes/routes/*`) при новій
  фізичній теці `routes/{storefront,admin}`.
- 🔴 **Шаблон магазину має ОДНУ залежність ядра** — `simplycms` (+
  `@simplycms/cli` у devDependencies). `routes.ts` монтує підтеки одного
  пакета через `coreRoutes('storefront'|'admin')` зі збереженим
  `realpathSync`; Tailwind дістав глоби `node_modules/simplycms/{dist,routes}`.
- **`@simplycms/plugin-faq` знято з преінсталу шаблону** (ПК7) — ставиться
  штатним `simplycms add <pkg> --plugin`; пілот довстановлює його окремим
  кроком, бо гейти B/E і plugin-тести його потребують.
- **Ядро в сателітах — `peerDependencies` + `devDependencies`** (ПК6), і для
  референс-теми/плагіна теж; `dependencies` там більше немає взагалі.
- **`drizzle-orm` — опційний peer** магазину: його імпортують лише три файли
  `src/schema/` (тулінг drizzle-kit), рантайм і CLI не торкаються.
- **CLI під нову топологію**: розпізнавання ядра — `isCorePackage` (точне
  `simplycms` + префікс `@simplycms/`, 🔴 ніколи префікс `simplycms` — він
  зачепив би сторонні `simplycms-theme-*`); канон міграцій —
  `node_modules/simplycms/migrations`; doctor звіряє нове монтування роутів
  і глоби Tailwind.
- Root-манифест перейменовано `simplycms` → `simplycms-monorepo` (звільняє
  unscoped-ім'я для флагмана; корінь ніде не публікується).

### Знято (breaking, 0.x, D5 — без шимів)

- **22 npm-пакети ядра** — `@simplycms/{objects,domain,schema,supabase,
  data-supabase,react-query,runtime,i18n,storefront,storefront-routes,
  admin-routes,admin,themes,plugins,plugin-sdk,ui,cart-ui,catalog-ui,
  checkout-ui,profile-ui,reviews-ui,core}`. Після появи `simplycms` у
  реєстрі всі 22 позначаються `npm deprecate` (unpublish свідомо НІ — вікно
  72h минуло, пакети взаємозалежні, це поламало б lockfile-и пілотних
  магазинів).
- **Фасадна роль `@simplycms/core`** — шість модулів були реекспортом
  чужого й видалені разом із їхніми export-входами; споживачі переведені на
  джерела (`lib/priceUtils` → `simplycms/domain/pricing`, `lib/utils` →
  `simplycms/ui/utils`, `types/index` → `simplycms/supabase` та ін.).
  Власні провайдери/хуки/компоненти лишились текою `src/core` із субшляхом
  `simplycms/core`; розселення по тірах свідомо поза К0.
- **Аліаси tsconfig/vite/vitest для злитих пакетів** — лишилась пара
  `simplycms` / `simplycms/*` плюс сателіти, `@themes/*`, `@plugins/*`.
- **`template/.claude/`** — копія скіла в шаблоні (замінена симлінками).

### Виправлено

- 🔴 **`target: 'esnext'` загубився при злитті 21 tsup-конфігу** — вцілів
  лише в одному профілі, тож esbuild лоуерив `import.meta` у
  `var import_meta = {}`, і опублікований `dist` читав `({}).env`:
  браузерний Supabase-клієнт магазину падав TypeError на гідрації ще до
  дружнього throw про відсутній ключ. Опцію піднято у спільний `base`
  (профіль задає розкладку entry, а не політику синтаксису); гард —
  `tests/dist-import-meta.test.ts` із позитивним якорем і негативним
  контролем.

---

## [0.3.0] — 2026-08-11

🔴 **Три зміни публічного API** — розділ «Змінено» нижче. Жодна не має відомих
зовнішніх споживачів, але це `0.x`, тож перевірте перед оновленням.

### Додано

- **i18n воронки покупки.** `@simplycms/cart-ui`, `catalog-ui`, `checkout-ui`,
  `profile-ui`, `reviews-ui` і `@simplycms/core` (`useStock`,
  `useProductReviews`) переведено на `t()`. Разом із каркасом магазину
  (`src/routes/__root.tsx` — 404 і error boundary) і обома темами це закриває
  тезу «англійський магазин зміною одного рядка конфіга»: до цього
  `locale: 'en-US'` давав ЗМІШАНИЙ магазин — сторінки англійські, а кошик,
  чекаут, профіль, відгуки та шапка/підвал теми українські.
- **Каталоги перекладів для тем** — `ThemeModule.messages?` (контракт теми
  v2.1, поле **опціональне**, тобто наявні теми не ламаються) + хук
  `useThemeT()` із `@simplycms/themes/useThemeT`. Ланцюжок:
  `theme[locale]` → `theme.uk` → сам ключ.
  🔴 Навмисно окремий механізм, а не розширення core-`MessageKey`: той —
  замкнений union на ~1000 ключів, і домішування чужих ключів убило б
  перевірку одруків для всього ядра. Копірайт теми не місце в каталозі ядра.
- **`useLocale()`** у `@simplycms/i18n` — `I18nProvider` тепер несе локаль у
  контексті поруч із транслятором. Потрібен темам, щоб вибрати свій каталог.
- **`formatPrice`** у `@simplycms/domain/money` + хук `useFormatPrice()` у
  `@simplycms/react-query`.
- **`pnpm test:e2e`** — браузерний контур на Playwright Test.

### Виправлено

- 🔴 **Гідраційний мисматч цін на кожній картці товару.**
  `new Intl.NumberFormat(locale, { style: 'currency', currency })` бере символ
  валюти з CLDR-даних, вшитих у рушій, а вони різні: Node 24 (SSR) віддає
  `"4 200 ₴"`, Chromium 149 (клієнт) — `"4 200 грн"`. SSR-HTML і результат
  гідрації не збігалися, React писав помилку в консоль, користувач бачив
  перерендер. Чотирнадцять кол-сайтів мали власну копію цього виклику; усі
  зведено до `formatPrice`, який форматує ЧИСЛО через `Intl`
  (`style: 'decimal'` — ця частина між рантаймами не розходиться), а символ
  бере з явної мапи. Побічно виправлено й те, що всі 14 копій хардкодили
  `uk-UA`/`UAH`, ігноруючи `simplycms.config.ts`.
  **Знайдено новим e2e-контуром на першому ж прогоні** — жоден із восьми
  гейтів цього не бачив.
- **Гомогліфи в українському тексті.** 174 входження латинської `i`/`I`
  всередині кириличних слів («Мiсто», «Прiзвище», «Iнший отримувач») у пʼяти
  `*-ui`-пакетах виправлено під час міграції — у каталог поїхав чистий текст.
- **Плюралізація лічильників.** `cart-ui` і `reviews-ui` вибирали форму за
  `count < 5`, що давало «12 товари» і «12 відгуки». Замінено на коректне
  правило (mod 100 у 11..14 → many; mod 10 == 1 → one; mod 10 у 2..4 → few).
- **Теги релізів.** CI ставить `vX.Y.Z` після успішної публікації; гард
  `tagExists` читає remote, а не локальні теги.

### Змінено (breaking для прямих споживачів)

- **`getStockStatusLabel(status)` → `getStockStatusLabel(status, t)`**
  (`@simplycms/core`). Функція не є хуком, тож `useT()` у ній неможливий —
  транслятор передається параметром. У репо викликів немає (перевірено
  `git grep`), тому практичного впливу не очікуємо.
- **`pnpm release X.Y.Z` тепер потребує мережі** — гард тегів питає `origin`.
  Офлайн-реліз падає з явним повідомленням; фолбек на локальні теги свідомо
  не робимо, бо саме він і був дефектом.

### Прибрано

- **Тег `v0.1.0` з remote** — указував на `dd822d6` часів scope
  `@simplysoftua`, тобто не позначав жодної публікації й вводив в оману.
  Відновлюється: `git tag v0.1.0 dd822d6 && git push origin v0.1.0`.

## [0.2.2] — 2026-08-08

### Виправлено

- **`create-simplycms-store`: code-splitting магазину під pnpm.**
  `template/routes.ts` тепер розгортає симлінк (`realpathSync`) перед тим, як
  віддати шлях до `routes/` пакета ядра в `physical()`.
  🔴 **Це фікс live-дефекту:** pnpm розкладає залежності ізольовано
  (`node_modules/@simplycms/<pkg>` → симлінк на `.pnpm/…`), Vite симлінки
  резолвить, і code-splitter TanStack Router не знаходив роут у
  `TSR_ROUTES_BY_ID_MAP`, бо генератор заповнив мапу шляхами через симлінк.
  Відмова була **мовчазна**: збірка успішна, гейти зелені, просто весь
  застосунок їхав одним initial-чанком. Заміряно на скретч-магазині: **3 чанки
  замість 207**, уся адмінка (98 модулів) і `@tiptap/*` (22) в initial. Після
  фікса — 207 чанків, initial 19/303, адмінка й tiptap в initial 0.
  **Стосується наявних магазинів — див. «Міграція» нижче.**
- **`@simplycms/admin`: перемикання теми не оновлювало сторінку.** Інвалідація
  зачіпала лише серверний кеш, тож клієнтський кеш роутера показував стару
  тему до ручного перезавантаження. Додано
  `packages/admin/src/lib/revalidateTheme.ts`, задіяно в `Themes` і
  `ThemeSettings`.
- **Обхід `minimumReleaseAge`, описаний у `0.2.1`, не працював.** Радили
  `pnpm install --minimum-release-age=0` — такого прапорця в pnpm 11 немає
  (`Unknown option`), а робочий `--config.minimumReleaseAge=0` задачі не
  розв'язує: `pnpm build` через `runDepsStatusCheck` сам перезапускає install
  уже без прапорця і впирається знову. Єдиний спосіб, що працює наскрізь, —
  тимчасовий `minimumReleaseAge: 0` у `pnpm-workspace.yaml` магазину; саме він
  тепер і описаний у шаблоні.

### Змінено

- **Пілот пакування ставить скретч-магазин через `pnpm`, а не `npm`**
  (`scripts/pilot-pack/build.mjs`). Тим самим менеджером, який декларує
  магазин, — отже політики pnpm 11 (`allowBuilds`, ізольована розкладка
  `node_modules`) уперше опинились **усередині** гейта. Саме цей перехід і
  виявив дефект code-splitting вище.
- **Гард провенансу tarball-ів** (`scripts/pilot-pack/provenance.mjs`): після
  install пілот читає lockfile скретча й падає, якщо хоч один пакет ядра
  приїхав не з `file:`. Потрібен тому, що механізм примусу локальних пакетів
  (`overrides` у `pnpm-workspace.yaml`) під pnpm ламається **мовчки**, а в
  реєстрі лежить та сама версія — тобто пілот міг би зелено перевіряти вже
  опубліковані пакети замість тих, що йдуть на публікацію.

### Документація

- `README.md` для всіх 22 пакетів — це картка пакета на npmjs.
- Актуалізовано `docs/tasks/platform-roadmap.md`,
  `docs/architecture/test-contours.md`,
  `docs/architecture/release-process.md`, `CLAUDE.md`.
- Заведено цей файл.

### 🔴 Міграція наявних магазинів

Фікс `routes.ts` живе в **шаблоні** скаффолдера, а шаблон розгортається один
раз — у момент `pnpm create simplycms-store`. Отже магазин, створений із
`0.2.0` або `0.2.1`, **не отримає цей фікс з оновленням пакетів**: файл
належить магазину, а не ядру.

**Чи вас це стосується.** У теці магазину:

```bash
pnpm build
ls dist/client/assets/*.js | wc -l
```

Одиниці (2–5) — стосується. Близько 200 — ні (магазин ставили не через pnpm).

**Що зробити.** Замінити вміст `routes.ts` у корені магазину на:

```ts
import { realpathSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { physical, rootRoute } from '@tanstack/virtual-file-routes';

const STORE_ROOT = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = resolve(STORE_ROOT, 'src/routes');

const coreRoutes = (name: string) =>
  relative(
    ROUTES_DIR,
    realpathSync(resolve(STORE_ROOT, 'node_modules', name, 'routes')),
  );

export const routes = rootRoute('__root.tsx', [
  physical('', coreRoutes('@simplycms/storefront-routes')),
  physical('', coreRoutes('@simplycms/admin-routes')),
  // Кастомні роути цього магазину.
  physical('', 'my'),
]);
```

Якщо ви додавали власні `physical()`-записи — збережіть їх, змінюється лише
спосіб отримання шляхів до пакетів ядра.

Далі `pnpm build` і та сама перевірка: має бути ~200 чанків. Правка безпечна й
під npm — там `realpathSync` тотожність.

---

## [0.2.1] — 2026-08-04

### Виправлено

- Шаблон `create-simplycms-store` приведено до pnpm 11: конфігурація pnpm
  переїхала в `pnpm-workspace.yaml` (поле `pnpm` у `package.json` pnpm 11 більше
  не читає), додано `allowBuilds` — без нього install обривається
  `ERR_PNPM_IGNORED_BUILDS`. Тоді ж у доки шаблону потрапив опис обходу
  `minimumReleaseAge` — **хибний**, виправлено в `0.2.2`.

### Змінено

- Тулчейн: pnpm 10.26 → 11.20; мажорні оновлення залежностей (ESLint 10,
  lucide 1, `@supabase/ssr` 0.12, react-day-picker 10).

### Документація

- `docs/architecture/test-contours.md` — межі тестування: що доводить кожен
  гейт пілота і які зони лишаються сліпими.

---

## [0.2.0] — 2026-08-04

### Додано

- **`create-simplycms-store`** — CLI-скаффолдер магазину з вбудованим шаблоном
  (`pnpm create simplycms-store my-shop`). Це 22-й публікований пакет і єдиний
  unscoped.
- **Bootstrap власника** — `owner:invite` через `service_role` +  роути
  `/auth/confirm` (`verifyOtp`) і `/auth/set-password` для invite-флоу.
- **Gate E** у пілоті — e2e owner-флоу проти локального стеку Supabase.

### Змінено

- Сплощення `packages/simplycms/*` → `packages/*`: проміжна тека була точкою
  subtree-дзеркала окремого core-репо, а дзеркало вивели з експлуатації ще у
  Фазі 0. Тулінг тепер відрізняє ядро від скаффолдера за **іменем**
  (`@simplycms/`), а не за шляхом.

### Виправлено

- 302-редіректи в auth віддають cookies (замість `Response.redirect`).
- Invite-лист веде на реальну адресу магазину, а не на дефолтний
  `http://localhost:3000`.

---

## [0.1.0] — 2026-08-03

Перша публікація ядра на npmjs: 21 пакет `@simplycms/*`. Підсумок Фаз 0 і 1 —
роути й канонічні сторінки переїхали в пакети, host стиснуто до `__root.tsx` +
`src/routes/my/`, теми переведено на контракт v2 (`manifest + tokens +
components`), схема БД — Drizzle-baseline, заведено пілот пакування і
`pnpm release`.

🔴 Тег `v0.1.0` у репозиторії **не позначає цей реліз**: він указує на коміт
`dd822d6` часів scope `@simplysoftua`, тобто до перейменування і до публікації
на npmjs. Теги релізів у SimplyCMS наразі не ведуться — борг описано в
[`docs/architecture/release-process.md`](docs/architecture/release-process.md).

Посилання ведуть на npmjs, а не на теги GitHub: теги релізів наразі не
створюються (борг, див. `release-process.md`).

[0.2.2]: https://www.npmjs.com/package/@simplycms/objects/v/0.2.2
[0.2.1]: https://www.npmjs.com/package/@simplycms/objects/v/0.2.1
[0.2.0]: https://www.npmjs.com/package/@simplycms/objects/v/0.2.0
[0.1.0]: https://www.npmjs.com/package/@simplycms/objects/v/0.1.0
