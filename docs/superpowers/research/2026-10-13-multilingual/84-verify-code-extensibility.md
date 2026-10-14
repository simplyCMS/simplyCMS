# 84. Верифікація звітів 82 (код) і 80 (prior art) + позиція щодо розширюваності

Скептик, 2026-10-14. Репо `~/github/simplyCMS`, гілка `claude/k3-e8-live-npm`, HEAD `2249106d`, лише читання.
`S` = `packages/simplycms/src`, `P` = `packages/simplycms`. Докази по коду — прямим `Read`/`grep` (граф
codebase-memory як доказ не використовувався: «хто кличе» тут перевірено читанням викликів, а не графом).
Первинні джерела 80 — `curl` сирих файлів GitHub і сторінок документації (без підсумовувача), де можливо;
решта — WebFetch з дослівними цитатами.

Шкала: **ПІДТВЕРДЖЕНО / СПРОСТОВАНО / ЧАСТКОВО / НЕ ВДАЛОСЯ**.

---

## Частина 1. Звіт 82 проти коду

### (а) Фільтри застосовуються на клієнті в пам'яті; працюють лише option_id і числові діапазони — ПІДТВЕРДЖЕНО, з уточненнями й дефектом

- Застосування: `filterAndSortProducts` (`S/storefront-routes/pages/catalog/filtering.ts:102-117`) викликається лише з
  `useCatalogController` (`useCatalogController.ts:88`) — React-хук у браузері. Серверних предикатів за властивостями немає:
  `loadCatalogProducts` фільтрує тільки `is_active` і `section_id` (`S/storefront/loaders/catalog-products.ts:59,77`).
- Крім option_id і числових діапазонів працюють ще **ціна** (`matchesPriceFilter`, `filter-predicates.ts:68-80`) і
  **`inStockOnly`** (`filtering.ts:110`). 82 про ціну згадав, про `inStockOnly` — ні; суттєво для проєкції (наявність теж має бути колонкою проєкції).
- **Пропущене 82 №1 — стан фільтрів не в URL:** `useState<CatalogFiltersState>({})` (`useCatalogController.ts:51`).
  Фільтри не мають адреси: ні SSR-сторінок фільтрів, ні посилань, ні індексованих фасетних URL. Для Р-ML-12/13 це
  окрема розвилка (які комбінації фасетів мають URL, canonical/noindex для решти).
- **Пропущене 82 №2 — без пагінації:** сторінка `/catalog` тягне ВСІ активні товари з модифікаціями, цінами, значеннями й
  залишками одним викликом (`useCatalogProductsQuery.ts` докблок + `getCatalogProducts`, `S/storefront-routes/server/catalog.ts:85-92`;
  у `catalog-products.ts` немає `limit`/`offset`). Розділ — лише прямі товари розділу (`eq(products.sectionId, …)`, :59), без нащадків
  `parent_id`. Тобто «перенести фільтри в SQL» = також ввести пагінацію і семантику піддерева розділів.
- **Новий дефект (не мультимовний, але в зоні Р-ML-13):** фільтр boolean-властивості спустошує вибірку. Панель рендерить
  чекбокс і пише `filters[property.slug] = true` (`S/catalog-ui/FilterSidebar.tsx:318-331`). `matchesOptionFilters` для
  ключа зі скалярним значенням доходить до `product.propertyValues.some(pv => … if (!pv.option_id || !Array.isArray(value)) return false)`
  (`filter-predicates.ts:59`) → `false` для кожного товару. Boolean-значення лежить у `value='true'`, а не в `option_id`.
  Тест `S/storefront-routes/__tests__/catalog-filtering.test.ts` boolean-кейсу не має. Впевненість 90 (логіка однозначна; живим
  прогоном не перевіряв). Коментар «мультивибір зберігає кілька option_id через кому» (`filter-predicates.ts:60`) і тест
  «кому-роздільний список» — залишок до Е3-13 (тепер рядок на опцію).

### (б) Пошуку на вітрині немає, `search_documents` немає — ПІДТВЕРДЖЕНО

`grep -iE "search_documents|tsvector|pg_trgm|to_tsquery|websearch|unaccent"` по `S/`, `P/migrations/`, `src/` — порожньо.
Пошукового UI немає ні у вітрині ядра, ні в `simplycms-theme-solarstore/src`; маршрутів пошуку в `P/routes/storefront/_storefront/` немає.
Уточнення: «єдиний пошук — `searchProductsForOrderOp`» неточне — є ще пошук покупців (`S/admin-server/impl/customers/find.ts:33-47`,
`customers/list-sql.ts:18-26`, `ilike`). На мультимовність впливає лише `search-for-order.ts:62-68` (`ilike` по `products.name`,
`product_modifications.name`): після переносу назв у `*_translations` його треба переписати (якою мовою шукає адмін?).

### (в) `meta_title`/`meta_description` не потрапляють у head — ПІДТВЕРДЖЕНО + новий дефект

- Вибираються: `S/storefront/loaders/entities/product.ts:22-23`, `section.ts:24-25`, `property.ts:70-71`. Поза цим — жодного читача
  (grep по `S/` без admin/schema/admin-server). `productHead` бере `title: product.name` і `product.description || t('product.metaDescription')`
  (`S/storefront-routes/head/product.ts:50-54`); розділ — `name`/`description` (`P/routes/storefront/_storefront/catalog/$sectionSlug/index.tsx:25-29`).
- **Новий дефект:** `products.description` — rich HTML (`richHtml: { description: 'content' }`, `S/admin-server/impl/products/resource.ts:52`),
  і він іде без очищення в `<meta name="description">`, `og:description` (`head/product.ts:52,78`) і JSON-LD `description` (:68).
  Хелпера html→text у `S/` немає. Те саме для опису розділу. Prior art: Shopware тримає в `product_translation` похідне
  `description_teaser` — «Read-only, HTML-stripped excerpt of the description, derived on write» (ProductTranslationDefinition.php, trunk).
  Для нас це аргумент мати в проєкції (товар, локаль) готовий plain-text опис.
- `<html lang>` = `normalizeLocale(config.locale)` (`src/routes/__root.tsx:41,95`); hreflang/og:locale відсутні.

### (г) ~190 `createServerFn`, 125 в `admin-server/index.ts`, `defineAdminResource`, `CoreActor` — ПІДТВЕРДЖЕНО

Підрахунок `grep -c "createServerFn("` по файлах `S/` без тестів: сума 190; `S/admin-server/index.ts` — 125; поза `S/` (корінь `src/`,
плагін, тема) — 0. `defineAdminResource` — `S/admin-server/impl/resource.ts:35`; `CoreActor` — `S/admin-server/impl/core-actor.ts:13`
(докблок прямо називає «майбутній MCP-сервер магазину»). `resource-projection.ts` — не проєкція даних, а `pickColumns` (SELECT без `omit`).

### (д) Збереження картки товару не атомарне — ПІДТВЕРДЖЕНО

`useProductSave.update` пише лише рядок `products` через колекцію (`S/admin/features/products/edit/useProductSave.ts:70-84`,
`Object.assign(draft, patch)` — всі поля форми щоразу). Панелі модифікацій/простого товару/властивостей рендеряться як `children`
ПОЗА `<form>` (`ProductForm.tsx:132-133` — `</form>{children}`; `ProductEditPage.tsx:116-136`) зі своїми збереженнями.
Додаток: TanStack DB-колекції адмінки мають форму ТАБЛИЦІ (рядок `products`), а не агрегату — складений ресурс «товар з перекладами»
не ляже на `productsCollection` без зміни моделі `admin-data`. Це розвилка Р-ML-14, якої в рамці немає явно: колекції лишаються для
списків, а запис картки йде командою над агрегатом поза колекцією?

### (е) Ядро не емітить хуків подій плагінам — ПІДТВЕРДЖЕНО

Імена — `S/plugins/hooks.ts:77-91`, `S/plugins/types.ts:185-190`; `HookRegistry.execute` (`S/plugins/HookRegistry.ts:76-94`) кличе лише
`PluginSlot`; `S/plugin-sdk/types.ts:26-31` прямо: «ядро НЕ емить бізнес-подій». Додаток: `HookRegistry` — клієнтський реєстр, помилки
обробника ковтає `console.error`. Для проєкції/перекладача/вебхуків потрібен **серверний** механізм, що працює всередині транзакції
запису ядра (або outbox після COMMIT) — це інший механізм, а не «почати емітити» наявні хуки.

### (є) `languages` нічим не читається; локаль — змінна процесу — ПІДТВЕРДЖЕНО

Посилання на `languages`: схема (`S/schema/schema.ts:155-166`), тип, `ENTITY.languages`, пункт сайдбару й заглушка. Локаль:
модульна змінна `storeLocale` (`S/site/store-locale.ts:8-31`), задається `declareStoreLocale(normalizeLocale(config.locale))`
(`src/server.ts:31`), `config.locale = import.meta.env.VITE_LOCALE ?? 'uk-UA'` (`simplycms.config.ts`). Читачі: листи (`S/auth/*-mail.ts`,
`invite.ts`) і `place-order.ts:50` (контекст листа замовлення).
**Пропущене 82 і рамкою (важливо):** `Locale = 'uk' | 'en'` — ЗАМКНЕНИЙ union (`S/i18n/types.ts:4`), і на ньому стоять каталоги
теми (`ThemeModule.messages`, `S/themes/types.ts:167`) і плагіна (`PluginMessages`, `S/plugin-sdk/types.ts:22`). Рамка каже «мультимовність
даних, не інтерфейсу», але на вітрині з перемикачем мови інтерфейсні рядки («Так/Ні» у характеристиках — `t('common.yes')`, кнопки,
підписи фільтрів, назви статусів наявності) мусять іти тією ж мовою, що й контент, інакше сторінка змішана. Довільна мова даних (`pl`)
при UI-каталогах лише `uk|en` → змішана сторінка. Це незадана розвилка: «мова chrome вітрини = мова контенту запиту» і що робити, коли
каталогу UI для мови немає.

### (ж) Slug: глобально унікальний, латиниця, ключ фільтрів; URL `/catalog/<section>/<product>` — ПІДТВЕРДЖЕНО

`SLUG_RE` (`S/domain/slug.ts:8`); унікальність: `sections_slug_key` (:108), `section_properties_slug_key` (:131), `products_slug_key` (:421),
`(property_id, slug)` (:359), `(product_id, slug)` (:443). Ключ фільтра — `property.slug` (`FilterSidebar.tsx:271,330`; `${slug}Min/Max`
у `filter-predicates.ts:27-28`). `productPath` (`S/domain/product-path.ts:38-45`). Уточнення для Р-ML-12: сегмент розділу косметичний —
товар шукається лише за slug товару (`getProduct({ slug })`, роут `$productSlug.tsx`), неканонічний сегмент → 301. Таблиці історії адрес
немає (список таблиць схеми — 37, жодної redirects/slug_history): зміна slug товару = 404.

### (з) Повнота переліку перекладних колонок — В ЦІЛОМУ ПОВНИЙ, але бракує класифікації й кількох носіїв

Що 82 пропустив або подав неточно:
1. **Плагінні дані:** `plg_faq_items.question/answer` (`packages/simplycms-plugin-faq/migrations/*.sql`) — перекладний текст референс-плагіна.
   Це перший реальний споживач «підходу A» з 80, а 82 згадав таблицю лише як приклад DDL.
2. **Змішана колонка `*_property_values.value`:** для `text` — людський текст, для `boolean` — код `'true'|'false'`, для `color` — hex
   (82 це описав, але не зробив висновку): при переході в модель B колонку треба РОЗЩЕПИТИ на мовонезалежний код і перекладний текст,
   інакше переклад boolean/color стане можливим помилково.
3. **Одиниць виміру немає:** у `section_properties` немає `unit`; число виводиться `String(numeric_value)` (82 п.2). На практиці одиницю
   кладуть у назву («Потужність, Вт») — тобто перекладна одиниця сьогодні живе в `name`. Розвилка: окреме поле `unit` (перекладне?).
4. **Брендів як сутності немає** (рамка Р-ML-4 їх перелічує): у 37 таблицях немає `brands`. Бренд реалізується властивістю типу select з
   `has_page` (сторінки `/properties/<prop>/<option>`). Тобто «бренди» = `property_options` + переклад опцій; окрема таблиця не потрібна,
   якщо це рішення свідоме.
5. **Меню, сторінок, шаблонів листів у БД немає**: навігація — з розділів, листи — шаблони в коді + UI-каталоги (`createTranslator(getStoreLocale())`).
   «Контент Е6д» — це медіа/відгуки (порт сховища), а не CMS-сторінки; у `media` немає `alt` (82 вірно).
6. **Неклієнтські vs клієнтські назви:** 82 позначив перекладними всі `name` однаково. У вітрину реально потрапляють: `order_statuses.name`
   (`S/storefront/loaders/entities/order.ts`), `user_categories.name` (`profile.ts`), `pickup_points.*` (`stock-info.ts`), назви доставки
   (`S/commerce/shipping-directory.ts:49-129`), назви знижок (`discount-rules.ts:30,52` → `cart-ui/CartLinePrice.tsx`). НЕ потрапляють:
   `price_types.name`, `category_rules.*`, `discount_groups.description` (лише адмінка). Для адмін-лише сутностей переклад — питання
   мови інтерфейсу адмінки, а не даних; варто вирішити явно, щоб не множити `*_translations`.
7. **`system_settings`**: у коді живі лише ключі `store_profile` і `stock_management`; згадані в коментарі схеми (:403-412)
   `commerce.return_policy`/`commerce.shipping_details` ще не існують. `store_profile` (jsonb з `name/homeTitle/description/address/hours`)
   — перекладний документ у k/v-таблиці: модель B для нього — окрема `store_profile_translations` чи винятковий jsonb-за-мовами; розвилка.
8. Оплата — лише `'cash'` у коді (`checkout-input.ts:39`), назва в UI-каталогах; таблиці способів оплати немає.

### Додаткова знахідка цілісності довідника властивостей (важлива для «шару B»)

`product_property_values.option_id` і `modification_property_values.option_id` мають FK `ON DELETE SET NULL` (`P/migrations/0001_init.sql:635,656`)
при `UNIQUE (owner, property, option_id) NULLS NOT DISTINCT` (`schema.ts:301-303,334-336`). Видалення опції перетворює значення на
«порожній» рядок `(owner, property, NULL)`; для multiselect друге видалення опції того ж власника впаде на унікальності (23505 → 409),
а для select лишається рядок-сирота без значення. Операція видалення опції — голий фабричний `remove` без очистки значень
(`S/admin-server/impl/property-options/resource.ts`). Впевненість 85 (поведінка PG стандартна; живим прогоном не перевіряв).
Висновок для дизайну: у шарі значень FK на опцію — `CASCADE` або `RESTRICT`, не `SET NULL`.

---

## Частина 2. Звіт 80 проти первинних джерел

| Твердження | Вердикт | Доказ |
|---|---|---|
| Shopware: «you must not extend the `product` table with a new column» + `EntityExtension` + окрема таблиця `OneToOneAssociationField`, FK `ON DELETE CASCADE`; `BulkEntityExtension` з 6.6.10.0 | **ПІДТВЕРДЖЕНО** | Дослівно на developer.shopware.com/…/add-complex-data-to-existing-entities.html: «Since you must not extend the product table with a new column, you'll have to add a new table…»; приклад SQL з `FOREIGN KEY (product_id, product_version_id) … ON DELETE CASCADE`; «This feature is available since Shopware 6.6.10.0». |
| Shopware: `product_translation` має `CustomFields` | **ПІДТВЕРДЖЕНО** | `ProductTranslationDefinition.php` (trunk): `(new CustomFields())->addFlags(new ApiAware())`; там же `custom_search_keywords` (ListField) і `description_teaser` (похідний plain-text). |
| OpenCart 4: `editProduct` = delete + insert описів; мова, якої немає у відправлених даних, втрачає рядок | **ЧАСТКОВО** (код підтверджено, сценарій «з форми» — ні) | `admin/model/catalog/product.php` @4.1.0.3: :245 `deleteDescriptions($product_id)` = `DELETE … WHERE product_id` (:1353-1354), далі вставка по `$data['product_description']` (:247-249); транзакцій у файлі немає (0 згадок). Але стандартна форма завжди містить усі мови: контролер бере `getLanguages()` (`controller/catalog/product.php:673`), який повертає ВСІ рядки `language` без фільтра статусу (`model/localisation/language.php:584-…`). Втрата реальна для API/імпорту/розширень з частковими даними і для будь-якої ДОДАНОЇ колонки: `addDescription` (:1334-1335) вставляє лише фіксований перелік колонок, тож колонка плагіна в `product_description` скидається на дефолт при кожному збереженні — це доводить [В] з 80 кодом. Без транзакції збій між DELETE і INSERT втрачає всі описи. |
| OpenCart 4 схема `product_description(product_id, language_id, …)`, `product_attribute(…, language_id, text)` | **ПІДТВЕРДЖЕНО** | `system/helper/db_schema.php` @4.1.0.3 :5272, :5363. |
| Medusa Translation Module: ≥2.12.3 + feature flag; `.translatable()` ≥2.13.0; один переклад на локаль; fallback на оригінал; merge при оновленні | **ПІДТВЕРДЖЕНО** | docs.medusajs.com/resources/commerce-modules/translation: «Medusa v2.12.3 or later», «currently behind a feature flag»; custom-data-models: «Medusa v2.12.4 or later», «The translatable method is available since Medusa v2.13.0»; concepts: «A resource may have only one translation per locale», «fall back to the original value», «Medusa merges the translations object». Додатково, чого 80 не сказав: модель — поліморфна `reference` + `reference_id` (без FK), і застереження «rollback … doesn't remove keys that the update added» — задокументований дефект відкату JSON-merge. Medusa — патерн A (оригінал у базовій моделі), а не модель B. |
| Shopify: digest/`outdated`; «Translatable content hash is invalid»; «лікування — перечитати digest» | **ЧАСТКОВО** | `TranslationInput.translatableContentDigest` — «Hash digest representation of the content being translated» (required), `Translation.outdated` — «Whether the original content has changed since this translation was updated» (API 2026-10) — підтверджено. Тред community (2022-01-04) — про переклади **теми**, а не товарів; помилка «Translatable content hash is invalid» є, але **відповідей і рішення в треді немає** — «лікування: перечитати digest» у джерелі відсутнє. Головне: це не «збій», а задумана оптимістична перевірка (не можна зареєструвати переклад до зміненого джерела) — тобто аргумент ЗА `source_hash` у протоколі запису перекладу, а не застереження. |
| Akeneo: `localizable`/`scopable` після створення не змінюються | **ЧАСТКОВО** | help.akeneo.com v6: «Some attribute properties cannot be edited afterwards, such as code, unique value, value per channel and value per locale» — так для v3–v7 (self-hosted). Але Serenity (SaaS, поточна) — «allowing the change from attributes non localizable to localizable (and vice versa) by unitary actions»; що стається зі значеннями — не описано. Отже «заборонено» застаріло; правильно: «змінюється лише окремою дією з міграцією значень». |
| Sylius: вимкнення translatable стирає значення всіх локалей | **ПІДТВЕРДЖЕНО** | old-docs.sylius.com/en/1.13/book/products/attributes.html: «Once the attribute has disabled translatability it will erase attribute values in all locales for this attribute.» |
| Sylius: `attribute_value` без unique; `product_translation` UNIQUE(locale, slug) | **ПІДТВЕРДЖЕНО** | `AttributeValue.orm.xml` @2.0 — колонки `locale_code`, `*_value`, жодного `unique`; `ProductTranslation.orm.xml` — `<unique-constraint columns="locale,slug"/>`; `ProductAttributeValue.orm.xml` — `product_id … on-delete="CASCADE"`. |

Решту тверджень 80 (Saleor, Magento, commercetools, Pimcore, PrestaShop) не перевіряв — у завданні не було.

---

## Частина 3. Оцінка висновків 80 для моделі SimplyCMS і власна позиція

### 3.1 Довідник властивостей 1С — це вже «шар B»

`section_properties` (визначення, тип insert-only, `is_filterable`, `has_page`) + `property_options` (довідник значень) +
`section_property_assignments` (до якого розділу і рівня — товар/модифікація) + `product|modification_property_values`
(типізовані `value`/`numeric_value`/`option_id`) — це той самий типізований EAV, що Sylius attributes / Saleor attributes.
80 у підході 2 пропонує `field_definitions` + `field_values` — **другий паралельний EAV поруч з наявним**. Це хибний шлях: два
механізми з однаковою семантикою, дві проєкції фасетів, два пошукові внески. Правильно — розширити наявний довідник.

Термінологія (за 1С): **реквізит** — фіксоване поле сутності, однакове для всіх товарів магазину, частина схеми (назва, опис,
SEO, артикул); **властивість** (у 1С «додаткові реквізити й відомості») — налаштовуване поле, що задається даними. Звідси межа:
- реквізит додає **ядро міграцією** (колонка в базовій або `*_translations` таблиці);
- власник магазину додає **властивість** в адмінці (рядок довідника), і жодних міграцій;
- плагін — або властивості (декларацією в маніфесті), або власні таблиці (коли даних структурно більше, ніж скаляр).

Чого бракує наявному довіднику, щоб бути повноцінним шаром B:
1. **Мовного виміру для текстових значень:** `property_options` → `property_option_translations`; `section_properties` → `…_translations`;
   текстові значення → таблиця перекладів значення (ключ — `value.id`) з розщепленням `value` на код і текст (див. 1(з) п.2).
2. **Прапорця `is_translatable`, фіксованого при створенні** (як `property_type` уже insert-only): урок Sylius (стирає) і Akeneo
   (окрема дія). Зміна — окрема команда з явною міграцією значень, не перемикач.
3. **Області дії «всі розділи»** (зараз лише через призначення розділу; `section_properties.section_id` — залишок).
4. **Власника визначення** (`core | shop | plugin:<name>`) і простору імен slug: slug глобально унікальний і є ключем фільтра й URL,
   тож властивості плагіна без префікса колізують з властивостями власника.
5. **Типів** rich text / date / url / reference на медіа — за потреби.
6. **FK значень на опцію `CASCADE|RESTRICT`**, не `SET NULL` (знахідка частини 1).

### 3.2 Три підходи 80 проти наших вимог

| Критерій | A: сателіти плагіна з власними `*_translations` | B: довідник визначень + значення (= наш довідник властивостей) | C: jsonb у базовій і translation-таблиці |
|---|---|---|---|
| Фасети/SQL | Не дає фасетів сам; кожна таблиця — окремий внесок у проєкцію | Фасети мовонезалежні за побудовою: `(product, property, option_id)` і `(product, property, numeric)`; мова лише в підписах — збігається з рішенням рамки «фасети за id значень» | Без експресійних індексів не фасетиться; суперечить рішенню власника «jsonb — ні» |
| Цілісність `is_source`/`source_hash` | Плагін мусить відтворити інваріанти ядра → потрібен «набір» від ядра (DDL-конвенція + спільна функція/тригер), інакше кожен плагін робить своє | Інваріанти тримає ядро, один раз | JSON-merge — клас помилок (Medusa: відкат лишає додані ключі) |
| UPSERT замість delete+insert | Контракт плагіна | Ядро | — |
| OpenAPI | Статично: плагін постачає Zod-схему ресурсу, збірка магазину зливає її в документ | Динамічно: властивості — дані, тому в OpenAPI — узагальнений масив `properties[{property, value…}]` (як Akeneo `values`) + опційний ендпойнт схеми магазину | Нетипізований мішок |
| Видалення плагіна | DROP лише явною командою з дампом; FK `ON DELETE CASCADE` на ядро | Деактивувати визначення (сховати з адмінки/вітрини/API), дані лишити; purge — окрема команда | Сміття в JSON (Shopware) |

### 3.3 Позиція (впевненість — 75)

1. **Основний механізм нових полів — наявний довідник властивостей, розширений до шару B** (п. 3.1). Він покриває власника магазину
   й більшість плагінних скалярів, і саме він дає фасети, пошук, форму адмінки й API «безкоштовно». Плагін оголошує властивості
   декларацією в маніфесті (ядро створює/оновлює визначення при `db:apply`), а не DDL.
2. **Сателітні таблиці A — лише для структурованих даних плагіна** (FAQ: 1:N, власна семантика). Ядро постачає набір перекладних
   таблиць (конвенцію DDL `plg_<name>_<x>_translations`, перевірку SQL-лінтом межі, спільну функцію для `is_source`/`source_hash`),
   щоб інваріанти не відтворювались у кожному плагіні. FK на таблиці ядра з `ON DELETE CASCADE` — дозволити (напрям залежності
   плагін → ядро правильний; «без FK» у FAQ лишає сиріт, що 82 і зафіксував).
3. **C (jsonb) — не для перекладних даних.** Лише для непрозорої конфігурації (`plugins.config` уже є). Узгоджено з рішенням власника.
4. **Колонку в таблицю ядра плагін не додає** (Shopware, Medusa; доказ OpenCart: `addDescription` скидає чужі колонки).
5. **`source_hash` — на рівні перекладної одиниці (рядка `*_translations`), а не агрегату.** 80 радить «hash по канонічному об'єднанню
   всіх перекладних значень сутності через реєстр полів» — це зв'язує ядро з плагінами і робить хеш нестабільним при встановленні
   плагіна (усі переклади раптом outdated). Статус агрегату (`outdated`, якщо будь-яка одиниця outdated) — похідний, у представленні.
6. **Проєкція вітрини будується з оголошених внесків** (ядро + властивості + зареєстровані внески плагінів), у транзакції запису
   ядра. Для цього потрібна серверна точка розширення всередині транзакції — не наявний клієнтський `HookRegistry`.

### 3.4 Незадані розвилки (у рамці немає)

1. **Мова chrome вітрини.** Замкнений `Locale = 'uk'|'en'` у каталогах ядра/теми/плагіна проти довільної кількості мов даних; що
   показувати, коли UI-каталогу для мови контенту немає (повна сторінка мовою за замовчуванням? заборона активувати мову без каталогу?).
2. **Гранулярність мови джерела:** одна мова джерела на агрегат «товар» (з модифікаціями, значеннями властивостей) чи окремо для кожної
   сутності/таблиці? Від цього залежить, де живе відкладена перевірка «рівно один `is_source`».
3. **Перекладність текстового значення властивості** — прапорець визначення, фіксований при створенні; процедура зміни.
4. **Простір імен slug властивостей** для плагінів (slug = ключ фільтра й URL).
5. **Модель `admin-data`:** колекції у формі таблиці проти команд над агрегатом для картки товару (Р-ML-14).
6. **Фасетні URL:** фільтри зараз не в адресі; які комбінації отримують індексовані URL і якою мовою (стикується з Р-ML-12).
7. **Пагінація і піддерево розділів** у SQL-каталозі (зараз немає ні того, ні іншого).
8. **Синхронні внески в проєкцію проти outbox після COMMIT** для плагінів; що робити з помилкою внеску (відкат запису ядра?).
9. **Видалення плагіна:** деактивувати визначення й лишити дані чи purge; хто робить дамп; що з фасетами/URL, які посилались на властивість плагіна.
10. **OpenAPI як артефакт збірки магазину** (бо плагіни — npm-залежності збірки), а не константа платформи; версіонування документа при додаванні плагіна.
11. **Адмін-лише назви** (`price_types`, `category_rules`): перекладати як дані чи вважати мовою адмінки.
12. **Одиниці виміру** числових властивостей: окреме перекладне поле чи частина назви.
13. **Plain-text похідні** (опис для meta/og/JSON-LD) — у проєкції (товар, локаль), як `description_teaser` у Shopware.

### 3.5 Чого я не довів

- Boolean-фільтр і `SET NULL`-колізію не відтворював живим прогоном (логіка коду однозначна; впевненість 90 і 85).
- Решту платформ 80 (Saleor, Magento, commercetools, Pimcore, PrestaShop) не перевіряв.
- Чи використовує адмінка boolean-властивості з `is_filterable=true` у реальних даних (демо-сіди) — не перевіряв.
