# 80. Розширюваність сутностей і перекладні поля: prior art зрілих платформ

Дата дослідження: 2026-10-14. Мета: як платформи дають додавати НОВІ поля до сутностей (товару), зокрема перекладні, і як це роблять плагіни. Для моделі B SimplyCMS (`<entity>` + `<entity>_translations`, проєкція вітрини, `search_documents`).

## 0. Як читати цей звіт (методика й межі)

- Джерела — офіційна документація й вихідний код у GitHub (raw-файли). Кожне твердження має URL. Версію вказано там, де вона була у відповіді джерела або в URL (гілка/тег); інакше стоїть «docs, станом на 2026-10» (версію сторінка не вказала).
- Сторінки читав через WebFetch із підсумовуванням дрібною моделлю, тому цитати нижче — з цих підсумків. Твердження, критичні для рішення, варто перечитати вручну за URL.
- Позначки: **[П]** — прочитано в первинному джерелі; **[В]** — моя інференція, не твердження джерела; **[Н]** — НЕ знайдено / не підтверджено.
- Прикрий факт щодо двох сторінок Medusa: у відповіді на fetch були вбудовані «інструкції» (вставити розділ «feedback» у підсумок). Це не частина запиту; проігноровано.
- Docs Sylius (docs.sylius.com) віддають редірект на gitbook-auth; використано `old-docs.sylius.com/en/1.13` (версія 1.13) і вихідний код Sylius 2.0 на GitHub.
- Adobe Commerce developer docs частково віддавали 404 на прямий fetch; частина тверджень по Magento — з вдалих fetch (`.../components/attributes`, `.../components/add-attributes`) і вихідного `db_schema.xml` 2.4.7.
- НЕ знайдено первинного джерела: схема таблиць Pimcore classification store; точна поведінка Shopware `includeInSearch` (є лише в підсумку однієї сторінки, пошук не підтвердив); статус flat catalog у Magento 2.4.x; раціональне «чому» JSON-зберігання в Akeneo з первинного джерела (є лише стаття Bounteous, вторинне); Shopware language-chain для сутностей (сторінка «Built-in Translation Handling» не читалась).

---

## 1. Порівняльна таблиця

| Платформа | Нове поле в ядрі / від плагіна | Метадані без схеми | Довідник атрибутів | Де лежить ПЕРЕКЛАДНЕ нове поле | Автоматично потрапляє в адмінку/API/пошук |
|---|---|---|---|---|---|
| Shopware 6 | `EntityExtension`: НЕ можна додавати колонку в `product`; плагін додає окрему таблицю, `OneToOneAssociationField` | `customFields` JSON-колонка (скаляри); набір/поля описуються в `custom_field_set` | custom field sets + options | Колонка в `<entity>_translation` (розширення) або `customFields` у translation-рядку (`TranslatedField('customFields')`) | Custom fields — в адмінку тільки після опису в сеті; в API без валідації, поки нема опису; у пошук — окремі кроки |
| Sylius | Підклас сутності (override) + Doctrine-міграція; для перекладного — підклас `*Translation` | Нема | `ProductAttribute` + `ProductAttributeValue` (EAV, типізовані колонки, `locale_code`) | Колонка в `*_translation` (підклас) АБО рядок атрибута з `locale_code` | Ні: форма розширюється вручну |
| Saleor | Міграція Django; нова колонка = зміна ядра | `metadata`/`private_metadata` JSONB + GIN | Attributes + AttributeValue (+ переклади) | `AttributeValueTranslation` (рядок на мову); для колонок — `*Translation` таблиці (`unique (language_code, entity)`) | Метадані — не типізовані; атрибути — типізовані, через GraphQL |
| PrestaShop 8/9 | Модуль: свій ALTER/таблиця або Doctrine-сутність; хуки форми | Нема (feature = довідник) | Features / Attributes (комбінації) | `<table>_lang` (composite id + `id_lang`) | Ні: модуль сам вішає поле в форму хуком і сам зберігає |
| OpenCart 4 | Core: нова колонка; модуль: події (event) або OCMOD-патч | Нема | `attribute` + `product_attribute(product_id, attribute_id, language_id, text)` | `product_description(product_id, language_id, …)` — колонка на мову | Ні: подія/OCMOD змінює шаблон і модель |
| Magento 2 / Adobe Commerce | EAV-атрибут через data patch; або extension attribute (join у `extension_attributes.xml` + плагін) | Нема | EAV, значення по типових таблицях зі `store_id` | Значення в EAV-таблицях по `store_id` (store view = мова); у extension attribute — своя таблиця | EAV-атрибути — в адмінці; extension attributes — «не з'являються в Admin», є в Web API |
| Akeneo PIM | Атрибути — конфігурація, не код | — | Attribute з `localizable`/`scopable`; значення — JSON `values[attr][].{locale,scope,data}` | В JSON значення з `locale` | Так: атрибут автоматично в UI/API/експорті (за конфігом); `localizable`/`scopable` після створення не змінюються |
| commercetools | ProductType: AttributeDefinition (рівень product/variant) | Custom Types/Fields — для інших ресурсів; для Product «use Product Types» | ProductType attributes | `LocalizedString` (JSON-мапа locale→текст), `localizable text`, `localized enum` | Так, через API; пошук — лише з `isSearchable`; зміна ProductType тригерить повний реіндекс |
| Medusa v2 | Модуль + `defineLink` (окрема link-таблиця без FK); не змінює чужу модель | `metadata` JSON на моделях | — (опції/категорії/теги) | Translation Module: `translation(reference, reference_id, locale_code, translations JSON)`; `model.text().translatable()` | Для кастомної моделі з `.translatable()` — з'являється в Settings → Translations |
| Shopify | — (платформа закрита) | Metafields (з definition: типізовані, фільтровані) та metaobjects | Metafield definitions | Translations API: переклад по `key` + `digest`, `outdated` | Definition дає типізований редактор, валідацію, пошук/фільтр |
| Pimcore | Class definition → генерація таблиць | — | Classification Store (групи/ключі) | Localized fields (`object_localized_data_<id>`, `…query_<id>_<lang>`); store — локалізація опційна | Так: з class editor |

---

## 2. Розділи по платформах

### 2.1 Shopware 6

**Механізм.**
- Колонку в `product` плагін додавати НЕ має: «Since you must not extend the `product` table with a new column, you'll have to add a new table.» Для цього — `EntityExtension` + окрема таблиця, `OneToOneAssociationField` з `autoload`; міграція створює таблицю з FK `ON DELETE CASCADE`. [П] https://developer.shopware.com/docs/guides/plugins/plugins/framework/data-handling/add-complex-data-to-existing-entities.html (docs, 2026-10; `BulkEntityExtension` — з 6.6.10.0)
- Є також розширення без БД: підписка на `ProductEvents::PRODUCT_LOADED_EVENT` + `addExtension()` зі struct. [П] там само.
- Custom fields: значення лежать у JSON-колонці `custom_fields`; «can only be used to store scalar values». Сутності потрібні `EntityCustomFieldsTrait`, поле `CustomFields` у дефініції та міграція. [П] https://developer.shopware.com/docs/guides/plugins/plugins/framework/custom-field/add-custom-field.html
- Опис сету (`custom_field_set` з масивом `customFields`) не обов'язковий для запису: «there is no need to define a custom field set and its fields first». Опис потрібен для редагування в адмінці й валідації; без нього «there is no validation happening here yet». [П] там само.
- Декларативний варіант `Resources/config/custom-fields.xml` — з 6.7.13.0. [П] там само.

**Перекладне поле.**
- Таблиця `<entity>_translation` із складеним PK `(<entity>_id, language_id)`; в дефініції `EntityTranslationDefinition` оголошуються лише перекладні поля; на батьку — `TranslatedField` + `TranslationsAssociationField`. [П] https://developer.shopware.com/docs/guides/plugins/plugins/framework/data-handling/add-data-translations.html
- У ядрі `product_translation` має колонки `name`, `description`, `meta_title`, … **і поле `CustomFields` (JSON)**, `slot_config` (JSON). Усі перекладні поля товару мають флаг `Inherited` (варіант успадковує від батька). [П] https://raw.githubusercontent.com/shopware/shopware/trunk/src/Core/Content/Product/ProductDefinition.php, https://raw.githubusercontent.com/shopware/shopware/trunk/src/Core/Content/Product/Aggregate/ProductTranslation/ProductTranslationDefinition.php (гілка trunk)
- Мітки сетів/полів — масив `locale → label` з обов'язковим записом для системної мови. [П] сторінка custom field вище.
- Читання: у вітрині `entity.translated.field`; «plain» поле порожнє, якщо нема явного перекладу. [П] сторінки add-data-translations та fallback-language-selection.
- Ланцюжок мов для сутностей: [Н] (сторінка «Built-in Translation Handling» не читалась; `fallback-language-selection` описує лише snippets).

**Автоматичність.**
- Адмінка: custom field з'являється лише після опису в сеті; тип поля визначає інпут. [П]
- Пошук: за підсумком сторінки custom field — `includeInSearch: true`, потрібен реіндекс. [П, одна сторінка; пошуком не підтверджено]. Для ES/OpenSearch: розширити ES-дефініцію → `es:mapping:update` (з 6.5.4.0) → реіндекс → зареєструвати в search config міграцією; в налаштуваннях пошуку адмінки доступні лише custom fields типів number і text. [П, з результатів пошуку по developer.shopware.com/docs/v6.6/…/elasticsearch/ та docs.shopware.com; сторінку напряму не вдалося відкрити]

**Видалення.** Для custom fields — видалити сет через репозиторій; **значення залишаються в JSON-колонці**, рекомендовано `JSON_REMOVE` пачками. [П] Для плагіна: при `keepUserData() === true` персистентні дані видаляти не можна; сутності, на які посилаються замовлення, краще деактивувати. Окремо про таблиці — не сказано. [П] https://developer.shopware.com/docs/guides/plugins/plugins/plugin-fundamentals/plugin-lifecycle.html

**Критика/ризики.** Рекомендація «таблиця розширення» дає JOIN на кожне читання (автозавантаження); custom fields не підтримують складні типи й асоціації. Джерела дають це як обмеження, а не як скаргу спільноти. [В щодо «JOIN»]

### 2.2 Sylius

- **Нове поле = підклас сутності** + Doctrine mapping + міграція; для перекладного — підклас `ProductTranslation` і делегування через `getTranslation()`; класи реєструються у `sylius_product.resources.product.classes.model` / `...translation.classes.model`. Форма: «the form on which you will add the new field should be the TranslationType». [П] https://old-docs.sylius.com/en/1.13/customization/model.html (1.13; на цій сторінці приклад не Product, а ShippingMethod)
- **Наслідок для плагінів** [В]: оскільки в конфігу вказується ОДИН клас моделі, два плагіни, що розширюють `Product`, змушені композитись через спільний підклас/трейт. Сторінка цього прямо не каже; це моя інференція зі схеми реєстрації.
- Переклад: «each entity is bound with a translation entity, that has it's own table»; fallback-локаль: якщо перекладу в обраній локалі нема — береться fallback (`setFallbackLocale()`). [П] https://old-docs.sylius.com/en/1.13/book/architecture/translations.html
- `sylius_product_translation`: `name`, `slug`, `description`, `meta_*`; унікальність `(locale, slug)`. [П] https://raw.githubusercontent.com/Sylius/Sylius/2.0/src/Sylius/Bundle/ProductBundle/Resources/config/doctrine/model/ProductTranslation.orm.xml (2.0)
- Атрибути (EAV): `sylius_attribute_value` має `locale_code` (nullable), `text_value`, `boolean_value`, `integer_value`, `float_value`, `datetime_value`, `date_value`, `json_value` (jsonb); у mapped-superclass **немає unique-обмежень**. [П] https://raw.githubusercontent.com/Sylius/Sylius/2.0/src/Sylius/Bundle/AttributeBundle/Resources/config/doctrine/model/AttributeValue.orm.xml (2.0). FK: `product_id` ON DELETE CASCADE, `attribute_id`. [П] ProductAttributeValue.orm.xml.
- Прапорець translatable в атрибута: вимкнення «will erase attribute values in all locales». [П] https://old-docs.sylius.com/en/1.13/book/products/attributes.html. Типи: 8 штук (text, checkbox, integer, percent, textarea, date, datetime, select). Як додати свій тип — сторінка не пояснює [Н].
- Видалення плагіна/поля, фільтри, імпорт: [Н] у прочитаних джерелах.

### 2.3 Saleor

- **Метадані**: `metadata` і `private_metadata` — `JSONField`, GIN-індекси (`%(class)s_meta_idx`, `%(class)s_p_meta_idx`). Публічні видимі неавторизованим; приватні — staff/apps з правами. Метадані — «untyped key-value structure intended for apps and integrations», атрибути — «strict structure with data types, validation, schema». [П] https://raw.githubusercontent.com/saleor/saleor/main/saleor/core/models.py ; https://docs.saleor.io/developer/attributes/overview ; пошук по https://docs.saleor.io/api-usage/metadata (сторінку напряму не читав)
- Дані застосунку: `privateMetadata`; при видаленні застосунку дані зникають автоматично (метадані застосунку лежать на ньому). [П, по пошуковому підсумку] https://docs.saleor.io/developer/extending/apps/developing-apps/apps-patterns/persistence-with-metadata-manager
- **Атрибути**: типи вводу — dropdown, multiselect, file, reference, numeric (з одиницею), rich/plain text, swatch, boolean, date, date time. Атрибути групуються в Product/Content Types. [П] https://docs.saleor.io/developer/attributes/overview
- Модель: `AttributeValue` має типізовані колонки (`plain_text`, `rich_text`, `boolean`, `date_time`, `numeric`, `file_url`, `sort_order`), nullable FK на product/variant/…; індекси GIN-trgm `attribute_search_gin` (name, slug), btree `attribute_value_numeric_idx`; `unique_together (slug, attribute)`. [П] https://raw.githubusercontent.com/saleor/saleor/main/saleor/attribute/models/base.py (main)
- **Переклади**: окремі таблиці `ProductTranslation` (`name`, `description`, SEO, `unique (language_code, product)`, `unique (language_code, slug)`), `ProductVariantTranslation`, `AttributeTranslation`, `AttributeValueTranslation` (`name`, `rich_text`, `plain_text`; `unique (language_code, attribute_value)`). Тобто для атрибутів переклад — **рядок на мову в окремій таблиці значення**. [П] https://raw.githubusercontent.com/saleor/saleor/main/saleor/product/models.py ; base.py
- Пошук: `Product.search_document`, `search_vector`, `search_index_dirty` (db_index) — індекс оновлюється асинхронно по dirty-флагу. [П] product/models.py. Це близько до нашого `search_documents`, але без локалі [В: у прочитаному коді локалі нема].
- Без локалі в ядрі Saleor: назва/слаг товару — базові колонки (мова за замовчуванням), переклади — додаткові таблиці. Тобто Saleor — **не** модель B, а патерн A. [В, із структури моделей]
- Нове поле в ядрі товару = міграція Django. Окремого «entity extension» для плагінів немає; рекомендований шлях — атрибути або метадані [П, з overview].

### 2.4 PrestaShop 8/9

- `ObjectModel`: `multilang => true` + `lang => true` у полях → companion-таблиця `<table>_lang` з `id_<entity>`, `id_lang` і перекладними полями. [П, через результат пошуку по https://devdocs.prestashop-project.org/9/development/components/database/objectmodel/]. Для магазинів — `multilang_shop`/`multishop`. `ps_product_lang` — «one row per product per language per shop». [П, вторинне: https://mypresta.rocks/faq/prestashop-tips/prestashop-database-key-tables-store-owner-guide ; офіційний devdocs: `ps_product_lang` як приклад]
- Модульна Doctrine-сутність: база + `*_lang` (OneToMany з `cascade persist/remove`), створення рядка на кожну встановлену мову; **формального fallback у доках нема** — fallback на `en` лише у фікстурі; `getQuoteContent()` повертає «перший» елемент колекції. [П] https://devdocs.prestashop-project.org/9/modules/concepts/doctrine/how-to-handle-multi-lang-doctrine-entity/
- Форма товару (8.1+): старі хуки `displayAdminProducts*` прибрано; лишився `displayAdminProductsExtra` (не рекомендований). Новий шлях — `actionProductFormBuilderModifier` (Symfony `FormBuilderModifier`, `addAfter`); поле, додане прямо в builder, стає вкладкою. Збереження — хуки `actionAfterCreate/Update<FormName>FormHandler`. **Як обробляти ПЕРЕКЛАДНІ значення — сторінка не пояснює; куди модуль складає дані — не пояснює.** [П] https://devdocs.prestashop-project.org/9/modules/sample-modules/extend-product-page/
- Видалення модуля: [Н] (сторінка module-class цього не покриває).
- Скарги: комбінації множать рядки (`ps_product_attribute` — по рядку на комбінацію; приклад 10×15×4 = 600). Це вторинне джерело: https://mypresta.rocks/faq/troubleshooting/prestashop-combinations-kill-performance-limits-workarounds [П, вторинне]. Офіційний бенчмарк 1.7: ~1 904 товарів і 16,5 млн комбінацій (вендорські цифри). [П] https://build.prestashop-project.org/news/2016/prestashop-1-7-performances/

### 2.5 OpenCart 4

- Схема (4.1.0.3): `product_description(product_id, language_id, name, description, tag, meta_title, meta_description, meta_keyword)` PK `(product_id, language_id)`; `product_attribute(product_id, attribute_id, language_id, text)`; `attribute_description`, `option_value_description` — так само по `language_id`. Тобто **OpenCart — це саме модель B**, а довідник атрибутів перекладається окремою таблицею. [П] https://raw.githubusercontent.com/opencart/opencart/4.1.0.3/upload/system/helper/db_schema.php
- `editProduct` робить `deleteDescriptions` + вставку рядка на кожну мову з форми, тож **мова, якої нема у відправленій формі, втрачає рядок**; `addProduct` без `isset`-гарда. [П] https://raw.githubusercontent.com/opencart/opencart/4.1.0.3/upload/admin/model/catalog/product.php. Це пряма пастка для плагіна: колонка, що живе в `product_description`, затирається при збереженні форми, яке плагін не контролює [В].
- Розширення: події `namespace/action/stage` (`catalog|admin|extension`, `before|after`), реєстрація в `install()` через `addEvent()`, зняття в `uninstall()`; listener отримує `&$route, &$data, &$output`. OCMOD — XML-патчі файлів (`search`/`add`), «Prefer events over OCMOD when possible»; після інсталяції — Refresh. [П] https://docs.opencart.com/developer-guide/events.md ; https://docs.opencart.com/developer-guide/extensions.md
- DB-зміни від розширення: офіційний посібник не показує створення таблиць в `install()` і видалення в `uninstall()`: «If your extension adds tables, you would need to write both methods yourself». [П, там само]
- Версія самої сторінки docs: не вказана; схема — тег 4.1.0.3.

### 2.6 Magento 2 / Adobe Commerce

- EAV: значення в таблицях за типом (`catalog_product_entity_varchar/text/int/decimal/datetime`) з унікальністю `(entity_id, attribute_id, store_id)`. Scope: global/website/store view (для Customer — лише global). [П] https://raw.githubusercontent.com/magento/magento2/2.4.7/app/code/Magento/Catalog/etc/db_schema.xml (2.4.7) ; https://developer.adobe.com/commerce/php/development/components/attributes/ (docs, 2026-10)
- Локаль — не вимір значення, а **store view**: «переклад» = значення в `store_id` конкретного вью [В]; `locale` окремою колонкою нема.
- Extension attributes: декларуються в `<Module>/etc/extension_attributes.xml`; `join` зв'язує поле з таблицею/колонкою; «do not appear in the Admin»; поля можна обмежити правами. Наповнення — after-плагіни на `save/get/getList` репозиторію; в Web API з'являються в `extension_attributes`. [П] те саме + https://developer.adobe.com/commerce/php/development/components/add-attributes
- Поточний стан flat catalog у 2.4.x — [Н] (є лише вторинні блоги, які суперечать одне одному).
- Критика EAV: «many joins» — лише вторинні джерела (mgt-commerce, kualo); офіційного кількісного джерела не знайшов. [П, вторинне]

### 2.7 Akeneo PIM

- Атрибут: прапорці `localizable`, `scopable`, `unique`, `available_locales`; значення в стандартному форматі: `values[attr] = [{locale, scope, data}]`, `locale = null`, якщо не localizable. [П] https://api.akeneo.com/concepts/products.html (docs, 2026-10); https://api.akeneo.com/concepts/catalog-structure.html
- **Незмінність**: за help center прапорці локалізації/скопабельності, код і `unique` після створення не редагуються. [П, через пошуковий підсумок help.akeneo.com v3/v4/v6/v7 «Manage your attributes»; сторінку напряму не відкривав]
- Зберігання: JSON-документ у колонці `raw_values` таблиці `pim_catalog_product`; ціна — **втрачений індексований пошук по значенню**, його компенсує Elasticsearch. [П, вторинне: https://www.bounteous.com/insights/2019/11/25/akeneo-turducken-product-information-management/ (2019)]. Первинне підтвердження зі схеми (`Product.orm.yml`) — [Н] (404). В Akeneo 4.0 docs модель описана як «Entity-Attribute-Value». [П] https://docs.akeneo.com/4.0/technical_overview/product_information/index.html
- Кастомні типи атрибутів: у 1.x потрібно було замінювати клас `ProductValue` і оновлювати схему Doctrine; сучасний механізм — [Н].
- Інше: сімейства (набір атрибутів, обов'язковість), completeness — **окремо на пару (канал, локаль)**; варіанти через product models / family variants, спільні атрибути на рівні моделі. [П] https://api.akeneo.com/concepts/products.html

### 2.8 commercetools

- ProductType з `AttributeDefinition`; рівень атрибута: product або variant; локалізовані: `AttributeLocalizableTextType`, `AttributeLocalizedEnumType`. [П] https://docs.commercetools.com/api/projects/productTypes (назва `AttributeLocalizedStringType` у джерелі не знайдена)
- `LocalizedString` — JSON-мапа `locale → text` (приклад `{"de":…, "en":…}`); fallback у докс цієї сторінки не описано. [П] https://docs.commercetools.com/api/types
- Custom Types/Fields — для інших ресурсів (клієнт, замовлення тощо); для Product docs кажуть «To extend a Product, use Product Types to define custom Attributes». Перелік `ResourceTypeId` на тій сторінці не навели. [П] https://docs.commercetools.com/api/projects/types
- Обмеження: додавання обов'язкового атрибута «can make existing Products and ProductVariants inconsistent»; ProductType видаляється лише без посилань; зміни ProductType «cannot be staged». [П] productTypes.
- Пошук (Product Projection Search, deprecated): атрибут варіанта індексується лише з `isSearchable: true`; для facet — теж; product-level атрибути не підтримуються; локалізований текст шукається лише по `text.{language}`; **зміна конфігурації (локалі, додавання атрибута в ProductType) запускає повний реіндекс**. [П] https://docs.commercetools.com/api/projects/products-search (за змістом — сторінка Product Projection Search; сторінка Product Search самостійно не читалась [Н])

### 2.9 Medusa v2

- Розширення чужої моделі: **не можна** додати поле/зв'язок напряму; `defineLink` створює окрему link-таблицю (`product_product_blog_post`) лише з ID-колонками, **без FK**. Видалення — прибрати файл link + `db:migrate`. [П] https://docs.medusajs.com/learn/fundamentals/module-links
- `metadata` JSON на моделях Commerce-модулів; оновлення зливає ключі верхнього рівня; «not suitable for structured data that requires strict validation»; для повторно використовуваних даних — окрема модель + link. [П] https://docs.medusajs.com/learn/fundamentals/data-models/json-properties
- **Переклади**: Translation Module (потрібен Medusa ≥ 2.12.3/2.12.4 і feature flag): запис `reference` + `reference_id` + `locale_code` + JSON `translations`; **один переклад на локаль**; fallback — оригінальне значення з моделі; `null`/порожнє ігнорується; оновлення зливають JSON. [П] https://docs.medusajs.com/resources/commerce-modules/translation/concepts
- Для власної моделі: `model.text().translatable()` (≥ 2.13.0) — модель автоматично з'являється в Settings → Translations. Локаль у запиті — `?locale=` або `x-medusa-locale`. [П] https://docs.medusajs.com/resources/commerce-modules/translation/custom-data-models
- Тобто Medusa пішла **за EAV-подібною схемою для перекладів** (окрема таблиця перекладів із JSON на пару (сутність, локаль)), а не за колонками. Цей висновок мій [В]; лише підтверджено, що база тримає «оригінал».
- Статус outdated/source_hash: [Н] (сторінка concepts: «Status: This page doesn't cover translation status»).

### 2.10 Shopify

- Metafield **definition**: ім'я, namespace, тип, валідація. «A defined metafield gets a typed editor in the admin, validation on write, and support for search and filtering.» Без definition: «stored as a plain string that merchants can't search or validate.» Застосунок володіє definition через зарезервований namespace. [П] https://shopify.dev/docs/apps/build/custom-data
- Переклади — окремий Translations API: `translatableContent` має `key`, `value`, `digest`; `translationsRegister` приймає digest; у `Translation` є `outdated`: «whether the original content has changed since this translation was last updated». [П] https://shopify.dev/docs/api/admin-graphql/latest/queries/translatableResource ; пошукові підсумки по https://shopify.dev/docs/api/admin-graphql/2026-04/objects/Translation
- Метафілди перекладаються; тип `METAFIELD` у `TranslatableResourceType` **deprecated**, з API 2026-10 — через `translatable` на метафілді власника; фільтрувати метафілди за `translatable` не можна, один запит на всі не існує. [П] https://shopify.dev/docs/apps/build/markets/migrate-translatable-metafields (через пошуковий підсумок)
- Відома проблема: digest змінюється, поки тривають переклади → помилка «Translatable content hash is invalid»; лікування — перечитати digest. [П] https://community.shopify.com/t/unable-to-update-theme-translations-to-shopify-if-the-digest-changes-before-translations-are-ready/88642
- Видалення метафілдів/definition — сторінка custom-data це не покриває [Н].
- Ліміти — на окремих сторінках, не читав [Н].

### 2.11 Pimcore

- Класи генерують таблиці: `object_store_<id>` (плоскі дані), `object_query_<id>` (для запитів з урахуванням успадкування), `object_relations_<id>`, view `object_<id>`; локалізовані: `object_localized_data_<id>`, `object_localized_query_<id>_<lang>`, view `object_localized_<id>_<lang>`. Таблиці «created and modified dynamically during the configuration of the object data model». [П] https://docs.pimcore.com/platform/Pimcore/Development_Details/Database_Model
- Перекладні поля — тільки ті, що в контейнері Localized Fields; «not all field types are supported»; **перенесення звичайного поля в локалізований контейнер → втрата даних у всіх об'єктах класу**; fallback: спершу вертикально (батьківський об'єкт), потім fallback-мова. Обов'язковість — по мовах. [П] https://docs.pimcore.com/platform/Pimcore/Objects/Object_Classes/Data_Types/Localized_Fields
- Classification Store: ключі/групи/колекції, кілька ізольованих store; «Individual keys currently cannot be added to the object. Instead, the corresponding groups added»; fallback горизонтально (на відміну від localized fields); «not all settings are respected (e.g. `indexed`)». Таблиці: `classificationstore_stores/_groups/_keys/_relations/_collections/_collectionrelations` (спільні, не під клас). [П] https://docs.pimcore.com/platform/Pimcore/Objects/Object_Classes/Data_Types/Classification_Store ; Database_Model. Схему значень (`classificationstore_data_*`) — [Н].
- Відновлення query-таблиць: перезберегти всі об'єкти з вимкненим dirty detection. [П] Database_Model.

---

## 3. Крос-платформенні закономірності

1. **Три шари розширення скрізь однакові**: (а) типізована колонка/таблиця (потребує міграції, швидка), (б) типізований довідник атрибутів (EAV або JSON, налаштовується в адмінці), (в) нетипізований JSON-мішок (metadata/customFields). Shopware, Saleor, Medusa, Shopify прямо радять тримати (в) для малого й рідко запитуваного; структуроване — у (а) або (б). [П] Shopware custom field; Saleor overview; Medusa json-properties; Shopify custom-data.
2. **Плагіну майже ніколи не дозволяють додавати колонку в таблицю ядра**: Shopware забороняє прямо, Medusa забороняє за побудовою (link-таблиця), Magento — extension attributes через join, Saleor/Sylius/PrestaShop/OpenCart допускають, бо там плагін — це код з доступом до всього (і це джерело конфліктів). [П] + [В] щодо причини.
3. **Перекладні розширення розподіляються на три конструкції**:
   - колонка в `*_translation` (Shopware, Sylius, Saleor, OpenCart, PrestaShop) — потребує міграції, швидко читати;
   - рядок значення з локаллю (Sylius `locale_code`, Saleor `AttributeValueTranslation`, OpenCart `product_attribute.language_id`, Akeneo елемент JSON) — не потребує міграції;
   - JSON-мапа `locale → text` (commercetools `LocalizedString`, Medusa `translations`, Shopware `customFields` у translation-рядку).
4. **Індекс і кеш ніде не оновлюються «автоматично й безкоштовно»**: Shopware — `es:mapping:update` + реіндекс; commercetools — повний реіндекс при зміні ProductType; Saleor — `search_index_dirty`; Akeneo — Elasticsearch. [П]
5. **Видалення плагіна/поля майже скрізь лишає дані**: Shopware — значення JSON лишаються; Medusa — link видаляється міграцією; OpenCart — розробник мусить писати `uninstall()` сам; Sylius — вимкнення translatable стирає значення всіх локалей. [П]

---

## 4. Висновки для SimplyCMS (модель B + плагіни)

Вимоги: колонка кожної мови — у `<entity>_translations(entity_id, locale, …)`; `is_source`, `source_hash`; проєкція вітрини (денормалізована на (товар, локаль)); `search_documents` з локаллю; плагіни ставляться як npm-пакети з власними міграціями.

### Підхід 1. Сателітна таблиця плагіна 1:1, окрема для базових полів і окрема `*_translations` для перекладних (Shopware EntityExtension / Medusa link / OpenCart-схема)
- Суть: плагін створює `<plugin>_product_ext(product_id PK, …)` і `<plugin>_product_ext_translations(product_id, locale, …)`; ядро нічого не знає про колонки.
- Сильні: типізація й `NOT NULL` на рівні PG; FK з `ON DELETE CASCADE` (Shopware це рекомендує); власні міграції пакета; чисте видалення (DROP двох таблиць); без конфліктів між плагінами.
- Слабкі: проєкції й `search_documents` мусять збирати дані з усіх таких таблиць — або явна реєстрація «внесків» у проєкцію, або JOIN на читанні; адмінку/API/імпорт плагін підключає сам.
- Ризики швидкодії: кожне нове поле в проєкції = ще одна таблиця в перебудові; не додає фасетів автоматично.
- Ризики цілісності: **затирання рядків при збереженні форми** (OpenCart `editProduct` = delete+insert); потрібен контракт «плагін відповідає за свої рядки».

### Підхід 2. Типізований довідник «визначень полів» + значення (EAV із `locale`) — Sylius/Saleor/Akeneo/Shopify definition
- Суть: ядро має `field_definitions(entity, key, type, translatable, searchable, facetable, …)` і значення `field_values(entity_id, definition_id, locale NULL, <типізовані колонки>)`; плагін лише реєструє визначення (міграції не потрібні).
- Сильні: нове поле — рядок конфігурації; адмінка, API-схема, експорт, фільтри генеруються з визначення автоматично; один механізм для ядра, тем і плагінів; саме так роблять Saleor (типізовані колонки у `AttributeValue`) та Akeneo/Shopify (definition дає редактор, валідацію, фільтр).
- Слабкі: слабка типізація на рівні БД (CHECK/тригер), JOIN-и або пивот на читанні; Magento — застережний приклад (від EAV відмовляються прямими індексаторами) [В; вторинні джерела]; зміна `translatable` після створення небезпечна (Akeneo: заборонено; Sylius: стирає значення; Pimcore: втрата даних).
- Швидкодія: **нормально лише за умови, що читання йде з проєкції**, а EAV є джерелом правди для запису; фасети — з окремої матеріалізації (як Akeneo → Elasticsearch, Saleor → GIN/btree по `numeric`, `attribute_search_gin`). У ядрі SimplyCMS довідник властивостей уже є (модель 1С) — тут це розширення того самого механізму.
- Цілісність: потрібні обмеження `UNIQUE (entity_id, definition_id, locale)` — у Sylius `attribute_value` їх немає [П], що є слабкістю; при видаленні визначення треба явно чистити значення (Shopware залишає сміття в JSON).

### Підхід 3. JSON-мішок у базовому рядку й у translation-рядку (Shopware `customFields`, Medusa `metadata`, Saleor `metadata`)
- Суть: `custom jsonb` у `<entity>` і `custom jsonb` у `<entity>_translations`; опис полів (схема) — окремо, опційно.
- Сильні: нуль міграцій, найпростіший для плагіна; Shopware/Saleor дають GIN-індекс; значення міграції не потребують; `source_hash` рахується по JSON легко.
- Слабкі: типізація лише на прикладному рівні (Shopware: до опису «no validation happening here yet»); без опису поле не з'являється в адмінці; «not suitable for structured data requiring strict validation» (Medusa); скаляри лише (Shopware); видалення поля лишає дані (Shopware — `JSON_REMOVE`).
- Швидкодія: добре для читання через проєкцію; погано для фасетів і сортування без експресійних індексів; для проєкції на (товар, локаль) JSON просто копіюється.
- Цілісність: нема FK і CHECK на вміст; два плагіни можуть сперечатись за ключі (потрібні namespaces — Shopify має зарезервований namespace застосунку [П]).

**Які підходи реально конкурують.** Для плагінів з власними npm-міграціями: (1) сателіти — для складних структурованих даних плагіна; (2) довідник визначень — для полів, які мають бути видимі в адмінці, фільтрах, пошуку й експорті; (3) JSON — як нижній шар для «просто збережи». Практика платформ — гібрид 2 + 3 + 1 (Shopware: extension-таблиця + custom fields; Saleor: attributes + metadata; Medusa: link-таблиця + metadata).

### Що небезпечне саме для проєкції й фасетів
- Будь-яке поле, яке має потрапити у фільтр/фасет, мусить мати **явне оголошення** (`searchable`/`facetable`), як `isSearchable` у commercetools і `includeInSearch` у Shopware [П; Shopware — з однієї сторінки]. Інакше фасети зламаються мовчки.
- Зміна набору полів — це подія реіндексу/перебудови проєкції (commercetools: повний реіндекс при зміні ProductType [П]). Потрібна версія «схеми проєкції», а не «перебудуй усе вручну».
- Перекладні фасети (значення опцій по мовах): фасет має ключуватись по стабільному коду значення, а не по тексту (EAV Magento/Sylius-значення з локаллю — це відомий клас розсинхрону, про що я знайшов лише непрямі згадки [В]).
- Саме фасетні/числові поля потребують типізованих колонок або експресійних індексів (Saleor тримає `numeric` у btree [П]); JSON-мішок цього не дає.

### Що небезпечне для цілісності
- **Затирання при збереженні форми** (OpenCart delete+insert [П]) — для моделі B це головний ризик: форма редагування однієї мови не повинна переписувати чужі рядки; `UPSERT` по `(entity_id, locale)` і окремий контракт на плагінні рядки.
- **Заборона/ризик зміни `translatable` після створення** (Akeneo — заборонено, Sylius — стирає, Pimcore — втрата) → у SimplyCMS це має бути міграція з явною процедурою, а не перемикач.
- **`is_source`/`source_hash` для плагінних полів**: hash має покривати і плагінні перекладні поля, інакше статус outdated бреше (Shopify `digest`/`outdated` показує, що проблема реальна й дає збої в процесі [П]). Рекомендація: hash рахується по канонічному об'єднанню всіх перекладних значень сутності, зареєстрованих через реєстр полів [В].
- **Видалення плагіна**: за практикою платформ дані або лишаються (Shopware `keepUserData`), або їх чистить сам плагін (OpenCart). Потрібне правило: DROP лише за явного підтвердження + дамп.
- Пастка власного дизайну (не з джерел): плагіни, які пишуть колонки у ЯДРОВИХ таблицях, ламають заморожені міграції й тест парності.

### Відкриті питання
1. Чи плагін може оголошувати **перекладні** поля тільки через реєстр (підхід 2/3), чи також власною `*_translations` таблицею (підхід 1)? Чи платформа тоді гарантує `is_source`/`source_hash` для таких таблиць, і як?
2. Як проєкція дізнається про плагінні поля: декларація в маніфесті плагіна (колонка проєкції з типом) чи generic `extra jsonb`? Чи фасети дозволяються лише для зареєстрованих типізованих полів?
3. Політика видалення плагіна: значення лишити (як Shopware) чи видалити (як Saleor з метаданими застосунку)?
4. Валідація обов'язковості по мовах: чи відрізняти «обов'язкове в мові джерела» від «обов'язкове в усіх активних мовах» (Pimcore дає по мовах, Medusa/commercetools — ні, у прочитаному) — [Н] для більшості платформ.
5. Чи потрібен fallback на читанні (Sylius `fallbackLocale`, Medusa — оригінал, Pimcore — вертикальний+fallback-мова) і де він живе — у запиті, у проєкції (запікання) чи в ядрі читання? Для проєкції «на (товар, локаль)» відповідь — запікати при перебудові; це моя пропозиція [В].
6. Імпорт/експорт 1С: плагінні поля мають мапитись у 1С-реквізити; жодна з платформ не дала прикладу автоматичного мапінгу — [Н] у прочитаних джерелах.
7. Що саме Shopware робить при відсутності перекладу в ланцюжку мов сутності — [Н] (не прочитано «Built-in Translation Handling»).

## 5. Перелік не знайденого (чесно)
- Pimcore classification store: схема таблиць значень.
- Akeneo: первинне підтвердження `raw_values` (є лише Bounteous, 2019) і сучасний механізм кастомного типу атрибута.
- Magento: статус flat catalog у 2.4.x; офіційні числа про вартість EAV.
- Shopware: `includeInSearch` (одна сторінка), ланцюжок мов сутностей.
- Sylius: механізм додавання нового типу атрибута; поведінка при видаленні.
- Saleor: ліміти метаданих (сторінка `docs.saleor.io/developer/metadata` віддала 404).
- PrestaShop: поведінка при видаленні модуля; обробка перекладних значень у новій формі товару.
- Shopify: ліміти метафілдів і видалення.
- Імпорт/експорт у всіх платформ — у прочитаному не розкрито.
