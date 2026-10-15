# Мультимовність — модель даних (контракт БД), діаграми

> Статус: СХВАЛЕНО власником 2026-10-15 разом із дизайном хвилі. Доповнює дизайн хвилі
> [`2026-10-14-multilingual-wave-design.md`](2026-10-14-multilingual-wave-design.md) §4–§7 і журнал рішень
> [`2026-10-14-content-multilingual-design.md`](2026-10-14-content-multilingual-design.md).
> Рішення власника 12–19 (2026-10-14) внесено. Імена колонок — робочі. Остаточні фіксує план, але форма (які таблиці, ключі, зв'язки, інваріанти) — це
> контракт.

## 1. Одне правило на всю систему

Кожна сутність, яка має видимий у магазині текст, складається з ДВОХ таблиць:

- **базова таблиця `<entity>`** — лише мовонезалежне: id, зв'язки, коди, числа, прапорці, ціни, зображення;
- **таблиця перекладів `<entity>_translations`** — по одному рядку на (сутність, мова), лише тексти.

Рядок основної мови — це «джерело». Він обов'язковий: без нього сутності немає. Решта мов — переклади.

```mermaid
flowchart LR
  subgraph "Сутність «товар»"
    P["products<br/>(id, sku, section_id, is_active, …)<br/>— без жодного тексту"]
    PT_UK["product_translations<br/>locale = uk (основна, ДЖЕРЕЛО)<br/>name, description, meta_…"]
    PT_EN["product_translations<br/>locale = en (переклад)<br/>name, description, meta_…<br/>+ source_hashes"]
    PT_PL["product_translations<br/>locale = pl (переклад)"]
  end
  P --- PT_UK
  P --- PT_EN
  P --- PT_PL
```

## 2. Мови

```mermaid
erDiagram
  languages {
    varchar code PK "ISO 639-1: uk, en, pl"
    text name "назва мови її ж мовою: Українська, English"
    bool is_default "основна; рівно одна; НЕЗМІННА після створення магазину"
    text status "draft | published | disabled — див. §8"
    int sort_order
  }
```

- Основну мову задають при створенні магазину; змінити її не можна, і БД це забороняє.
- Мови не видаляються, лише вимикаються (`disabled`). Їхні переклади лишаються.

## 3. Каталог: товар, модифікація, розділ

```mermaid
erDiagram
  sections ||--o{ section_translations : "тексти"
  sections ||--o{ sections : "parent_id"
  sections ||--o{ products : "section_id"
  products ||--o{ product_translations : "тексти"
  products ||--o{ product_modifications : "модифікації (GUID 1С)"
  product_modifications ||--o{ product_modification_translations : "тексти"
  languages ||--o{ section_translations : "locale"
  languages ||--o{ product_translations : "locale"
  languages ||--o{ product_modification_translations : "locale"

  sections {
    uuid id PK "генерує викликач"
    uuid parent_id FK
    text image
    int sort_order
    bool is_active
    int version "для перевірки конфлікту запису"
  }
  section_translations {
    uuid section_id PK,FK "ON DELETE CASCADE"
    varchar locale PK,FK
    text name "обов'язково в основній мові"
    text description
    text meta_title
    text meta_description
    text seo_h1
    text og_title
    text og_description
    jsonb source_hashes "NULL у рядку основної мови; у перекладі — хеш кожного поля джерела на момент перекладу"
    timestamptz updated_at
  }
  products {
    uuid id PK "GUID 1С"
    uuid section_id FK
    text sku
    bool is_active
    bool is_featured
    jsonb images "референси файлів"
    int version
  }
  product_translations {
    uuid product_id PK,FK "ON DELETE CASCADE"
    varchar locale PK,FK
    text name
    text short_description
    text description
    text meta_title
    text meta_description
    text seo_h1
    text og_title
    text og_description
    jsonb images_override "NULL = фото з products.images; інакше свій набір для мови"
    jsonb image_alts "alt-тексти зображень цією мовою"
    jsonb source_hashes
    timestamptz updated_at
  }
  product_modifications {
    uuid id PK "GUID характеристики 1С"
    uuid product_id FK
    text sku
    bool is_default
    int sort_order
  }
  product_modification_translations {
    uuid modification_id PK,FK
    varchar locale PK,FK
    text name
    text slug "токен для ?mod= ; унікальний у межах товару й мови"
    jsonb source_hashes
  }
```

## 4. Властивості (модель 1С) і їхні значення

Властивість — довідник. Плагіни властивостей не додають, лише використовують. Значення розщеплено за типом:
перекладається лише текстове значення.

```mermaid
erDiagram
  section_properties ||--o{ section_property_translations : "тексти"
  section_properties ||--o{ property_options : "варіанти (select/multiselect)"
  property_options ||--o{ property_option_translations : "тексти"
  section_properties ||--o{ section_property_assignments : "до яких розділів і рівнів"
  products ||--o{ product_property_values : "значення товару"
  product_modifications ||--o{ modification_property_values : "значення модифікації"
  product_property_values ||--o{ product_property_value_translations : "лише для типу text"
  modification_property_values ||--o{ modification_property_value_translations : "лише для типу text"
  property_options ||--o{ product_property_values : "option_id CASCADE"

  section_properties {
    uuid id PK
    text property_type "text | number | range | select | multiselect | boolean | color"
    bool is_filterable
    bool has_page
    int sort_order
  }
  section_property_translations {
    uuid property_id PK,FK
    varchar locale PK,FK
    text name "«Потужність» / «Power»"
    text unit "«кВт» / «kW»"
    text slug "токен фільтра в URL; унікальний у мові"
    jsonb source_hashes
  }
  property_options {
    uuid id PK
    uuid property_id FK
    text color_hex "для color"
    text image
    int sort_order
  }
  property_option_translations {
    uuid option_id PK,FK
    varchar locale PK,FK
    text name "«Червоний» / «Red»"
    text description
    text meta_title
    text meta_description
    text slug "токен значення фільтра; унікальний у межах властивості й мови"
    jsonb source_hashes
  }
  product_property_values {
    uuid id PK
    uuid product_id FK
    uuid property_id FK
    uuid option_id FK "select/multiselect"
    numeric numeric_value "number/range"
    bool bool_value "boolean"
    text color_hex "color"
  }
  product_property_value_translations {
    uuid value_id PK,FK
    varchar locale PK,FK
    text text_value "лише тип text"
    jsonb source_hashes
  }
```

## 5. Адреси сторінок — реєстр

Slug сторінок (товар, розділ, сторінка властивості, сторінка опції) живе ЛИШЕ тут, а не в таблицях сутностей.

```mermaid
erDiagram
  languages ||--o{ url_paths : "locale"
  url_paths {
    varchar locale PK,FK
    text path PK "ecoflow-delta-2 (без префікса мови)"
    text entity_type "product | section | property | option"
    uuid entity_id
    bool is_current "одна поточна на (entity_type, entity_id, locale)"
    timestamptz created_at
  }
```

- `/ecoflow-delta-2` → (`uk`, `ecoflow-delta-2`) → товар X.
- `/en/ecoflow-delta-2` → (`en`, `ecoflow-delta-2`) → той самий товар X. Однакова адреса в різних мовах
  дозволена.
- Стара адреса: рядок з `is_current = false` → 301 на поточну адресу тієї ж сутності й мови.
- Службові сегменти (`cart`, `checkout`, `my`, `api`, `media`, коди мов) зарезервовані: такої адреси
  створити не можна.

## 6. Довідники, контент, замовлення, доступ

```mermaid
erDiagram
  order_statuses ||--o{ order_status_translations : "назва статусу"
  shipping_methods ||--o{ shipping_method_translations : "назва, опис"
  shipping_rates ||--o{ shipping_rate_translations : "назва, терміни"
  pickup_points ||--o{ pickup_point_translations : "назва, адреса"
  discounts ||--o{ discount_translations : "назва, опис"
  banners ||--o{ banner_translations : "заголовок, підзаголовок"
  banners ||--o{ banner_buttons : "кнопки (url мовонезалежний)"
  banner_buttons ||--o{ banner_button_translations : "текст кнопки"
  orders ||--o{ order_items : "позиції"
  languages ||--o{ orders : "locale замовлення"
  profiles }o--|| languages : "locale людини (листи, адмінка)"

  orders {
    uuid id PK
    varchar locale FK "мова оформлення: листи, кабінет"
  }
  order_items {
    uuid id PK
    text name "знімок мовою замовлення"
    text name_default "знімок основною мовою, якщо мова замовлення інша"
  }
  profiles {
    uuid id PK
    varchar locale FK "мова листів покупцю й інтерфейсу адмінки"
  }
  api_tokens {
    uuid id PK
    text name
    text token_hash "сам токен не зберігається"
    text_array scopes "права"
    timestamptz expires_at
    timestamptz revoked_at
    timestamptz last_used_at
  }
```

Зображення (рішення власника 17): будь-яке зображення сутності можна перевизначити для мови в її рядку перекладу
(NULL — спільне), alt-тексти перекладаються. Форму (поле в рядку чи окрема таблиця зображень із мовою) обирає план.

Відгуки: `product_reviews.locale` — мова написання; показуються всі, мовою сторінки першими (рішення 18).

Не перекладаються: `price_types`, `category_rules` (лише адмінка), відгуки (мова автора), дані покупців, ціни,
залишки.

## 7. Плагіни — та сама конвенція

```mermaid
erDiagram
  plg_faq_items ||--o{ plg_faq_item_translations : "тексти"
  languages ||--o{ plg_faq_item_translations : "locale"
  plg_faq_items {
    uuid id PK
    int sort_order
    bool is_active
  }
  plg_faq_item_translations {
    uuid item_id PK,FK "CASCADE"
    varchar locale PK,FK
    text question
    text answer
    jsonb source_hashes
  }
```

Плагін оголошує таблицю засобом SDK (наприклад `defineTranslatableTable`), який створює обидві таблиці
однаково правильно. Контроль — §10 дизайну і розділ «Контроль» у відповіді власнику.

## 8. Як дані створюються й змінюються

### 8.1 Створення товару (адмінка або API — та сама операція)

```mermaid
sequenceDiagram
  autonumber
  participant C as Адмінка / API / 1С
  participant O as Операція реєстру «product.save»
  participant DB as PostgreSQL (одна транзакція)
  C->>O: { id, sku, …, translations: { uk: {name…}, en: {name…}? } }
  O->>O: Zod: є основна мова (uk) з name? права?
  O->>DB: INSERT products (id від викликача)
  O->>DB: UPSERT product_translations (uk) — джерело
  O->>DB: UPSERT product_translations (en) — якщо надіслано; source_hashes = хеші нового джерела
  O->>DB: INSERT url_paths (uk, slugify(name)) — при зайнятості суфікс -2
  O->>DB: INSERT url_paths (en …) — копія основної адреси для кожної активної мови
  O->>DB: оновити проєкцію вітрини для цього товару
  DB-->>DB: COMMIT: відкладені перевірки (рядок основної мови є; адреси унікальні)
  O-->>C: { id, version }
```

### 8.2 Перейменування з 1С (лише основна мова)

```mermaid
sequenceDiagram
  autonumber
  participant C as 1С
  participant O as product.save
  participant DB as PostgreSQL
  C->>O: { id, version, translations: { uk: { name: "Нова назва" } } }
  O->>DB: UPDATE product_translations (uk).name
  Note over DB: en.source_hashes.name ≠ hash(нова uk.name) → поле name в en стає outdated
  Note over DB: url_paths НЕ змінюються (адреса змінюється лише явною дією)
  O->>DB: оновити проєкцію (en показує стару англійську назву, позначену outdated в адмінці)
```

### 8.3 Увімкнення нової мови

```mermaid
sequenceDiagram
  autonumber
  participant A as Власник (сторінка мов)
  participant O as language.activate
  participant DB as PostgreSQL
  A->>O: додати pl (статус draft)
  O->>DB: INSERT languages (pl, draft)
  O->>DB: для кожної сутності зі сторінкою: url_paths (pl) = копія основної адреси
  Note over A,DB: draft — вітрина pl ще не відкрита; перекладачі працюють в адмінці
  A->>O: опублікувати pl (видно індикатор повноти)
  O->>DB: UPDATE languages SET status = published
  Note over DB: вітрина /pl/… відкрита; неперекладені сторінки — noindex
```

## 9. Що з чого читає вітрина

```mermaid
flowchart TB
  URL["/en/ecoflow-delta-2"] --> R["розбір: мова = en (з префікса), path = ecoflow-delta-2"]
  R --> UP["url_paths (en, path) → товар X"]
  UP --> PR["проєкція: catalog_product_texts (X, en)<br/>текст з fallback на основну мову + is_translated"]
  PR --> H{"is_translated?"}
  H -- так --> I["index, self-canonical, hreflang"]
  H -- ні --> N["noindex, canonical на основну мову"]
  R --> T["переклади інтерфейсу: каталог i18n для en<br/>(немає пакета en → основна мова магазину)"]
```
