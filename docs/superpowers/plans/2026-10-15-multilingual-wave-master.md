# Хвиля мультимовності даних — майстер-план (контракти й карта підхвиль)

> **For agentic workers:** це НЕ план задач. Задачі з TDD-кроками живуть у планах підхвиль
> (`2026-10-15-multilingual-m1-foundation-product.md` і наступні). Кожен план підхвилі посилається на цей
> документ і не перевизначає його контрактів. Зміна контракту = правка ЦЬОГО файлу з погодженням архітектора.

**Goal:** Модель «OpenCart» для всіх видимих покупцю текстів, мова лише з URL, реєстр адрес з історією 301,
серверний каталог над проєкцією, реєстр операцій з адмінкою на serverFn і публічним `POST /api/v1/<op>` — до
заморожування схеми в `1.0.0-rc.1`.

**Architecture:** Базові таблиці тримають мовонезалежне, кожен текст кожної мови — рівно в одному рядку
`<entity>_translations`. Мова джерела — завжди основна мова магазину. Адреси сторінок живуть у `url_paths`,
мовні токени (модифікації, властивості, опції) — у `slug_tokens`. Обидва реєстри мають один генератор, історію й
суфікси колізій. Вітрина читає товари з проєкції, яку синхронно оновлює команда реєстру операцій. Решта даних
вітрини йде через одну функцію читання з fallback. Будь-який запис — це операція реєстру з двома тонкими
транспортами: serverFn для адмінки й HTTP для токенів.

**Tech Stack:** TypeScript 6 strict, TanStack Start (server routes + serverFn), Drizzle + PostgreSQL 17,
Zod 4 (`z.toJSONSchema`, `draft-2020-12` → OpenAPI 3.1), Vitest + харнес `test:schema`.

**Spec:** `docs/superpowers/specs/2026-10-14-multilingual-wave-design.md` (схвалено власником 2026-10-15).
Журнал рішень — `2026-10-14-content-multilingual-design.md`, доказова база —
`docs/superpowers/research/2026-10-13-multilingual/`.

**Головний архітектор:** сесія `dashboard-design-spec`. Розвилки Р1–Р18 вирішено 2026-10-15 (таблиця нижче).

---

## 1. Розвилки (вирішено архітектором 2026-10-15)

| # | Розвилка | Рішення |
|---|---|---|
| Р1 | Форма хешів полів | `source_hashes jsonb NOT NULL DEFAULT '{}'` + CHECK `jsonb_typeof = 'object'` + `updated_at` у кожному рядку перекладу. Хеш рахує ОДНА функція ядра (TS) в операції, не тригер. Для rich-text хешується вже санітизований HTML. Ключі — лише перекладні поля типу; тест на кожну таблицю: ключі ⊆ поля |
| Р2 | Ключ перекладу | Композитний PK `(<entity>_id, locale)` без окремого id. Складені FK там, де потрібен батько (модифікація → `product_id`, опція → `property_id`). Колекції `admin-data` — складений `getKey` |
| Р3 | Обов'язковий рядок основної мови | ОДНА узагальнена функція `public.require_source_translation()` з `TG_ARGV`. Аргументи потрапляють у SQL лише через `format('%I')`. Конвенції (власник, `SECURITY`, `search_path`, `REVOKE … FROM PUBLIC`) — дзеркало `require_default_shipping_zone` у `0004_functions.sql:45-72`. Тест під КОЖНОЮ рантайм-роллю (`app_user`, `app_admin`) доводить, що RLS не дає хибної відмови на коміті. Негативний контроль: прибрати тригер → червоний |
| Р4 | `languages` | `id uuid` PK + `code` UNIQUE як ціль FK. `code` — канонічний BCP 47, CHECK `^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$`. Сегмент URL = `lower(code)`, UNIQUE і за `code`, і за `lower(code)`. `status` enum `draft`/`published`/`disabled` замість `is_active`, `sort_order`. `is_default` і `code` незмінні. Основна мова лише `published`. Основну видалити не можна (тригер з ясною помилкою). Мову, на яку не посилається жоден рядок, видалити МОЖНА. Будь-яке посилання блокує FK `RESTRICT`: переклади, а з М2 — `orders.locale`, `profiles.locale`, `product_reviews.locale`. `languages.remove` ловить `23503` навколо свого DELETE → 409 `language_in_use` з i18n. **Р4(б) свідомо звужує раннє рішення «мови не видаляються»** (журнал §1.2, спека §4 рядок 92, модель даних рядок 45); усі три носії виправлено з посиланням сюди (аудит Codex 2026-10-15, К1) |
| Р5 | Зображення | Таблиці `product_images` (+ модифікації через складений FK) і `product_image_translations(alt, storage_key NULL = спільне)`. Для сутностей з одним зображенням — `image_ref`/`image_alt` у рядку перекладу (NULL = спільне з бази). Облік `media` — на рядок фото й на рядок перекладу з власним `storage_key`. Видалення — «об'єкт → рядок», як у Е6д |
| Р6 | Снапшоти drizzle | Скрипт `scripts/rebaseline-drizzle.mjs` + злиття `0005_mail_outbox` у `0001_init`. Скрипт детермінований: два прогони поспіль дають нульовий диф. `schema-sources-parity` лишається гейтом. У CHANGELOG — «перестворити БД» |
| Р7 | Основна мова при створенні магазину | Джерело — поле `primaryLocale` у `simplycms.config.ts` магазину. `simplycms create` питає мову й пише її туди. Значення читає ЛИШЕ `bootstrapStore` при порожній `languages`, в одній транзакції з текстовими довідниками з мовного пакета. Після цього правда — БД. Розбіжність конфігу з БД: `doctor` дає warn, старт не падає, БД не переписується. Основна мова без мовного пакета інтерфейсу → відмова з переліком доступних пакетів. `scripts/start.mjs` (host-шим під `simplycms update`) прапорця НЕ несе |
| Р8 | `products.return_policy` / `shipping_details` | Зносяться: мертві дані без читача. CHANGELOG BREAKING |
| Р9 | `pickup_points.working_hours` | Структура `{monday…sunday: {open:'HH:MM', close:'HH:MM'} \| null}`. Перекладне поле-примітка `hours_note` у рядку перекладу точки |
| Р10 | `banners.buttons` | `banner_buttons(id, banner_id, sort_order, variant, target_blank, link_kind, <тип>_id типізовані FK + CHECK, external_url)` + `banner_button_translations(text)`. Типізовані FK — `ON DELETE RESTRICT`: видалення цілі → 409 `reference` «використовується в банері» |
| Р11 | Профіль магазину | Синглтон `store_profile` (фіксований id + CHECK) + `store_profile_translations` |
| Р12 | Посадкові сторінки властивостей і опцій | Плоско `/<path>` у тому самому `url_paths`. Авто-slug опції = `slugify("<властивість> <опція>")`. `/properties/` — службовий сегмент |
| Р13 | Заміна `/catalog` | Службовий сегмент `/catalog` = той самий серверний каталог над усім каталогом без розділу |
| Р14 | Версія агрегата | `version integer NOT NULL DEFAULT 1` на кореневій таблиці. Покриває агрегат ОПИСУ: тексти всіх мов, властивості, зображення, модифікації. Будь-який запис у нього (і переклад) збільшує `version`. Ціни й залишки — окремі команди, `version` НЕ чіпають. ETag = `"v<version>"` |
| Р15 | Токени API | Своя таблиця `api_tokens` (Better Auth `apiKey` ходить своїм адаптером повз `withActor`). Сервісний обліковий запис — користувач без рядка `accounts`. Хеш — sha256 високоентропійного секрету, пошук за UNIQUE хешем. Ключ показується раз, є `revoked_at` і `last_used_at`. Права = роль ∩ scopes, перевірка в `requireOperation` |
| Р16 | Права перекладу | Scopes токена — ідентифікатори ОПЕРАЦІЙ реєстру. Право ролі для операцій перекладу = право сутності (`catalog.write` тощо), нових понять у `AUTHZ_MATRIX` немає. Токен «лише переклади» = scopes лише з операцій перекладу. Ідентифікатори операцій — публічний контракт: перейменування = BREAKING |
| Р17 | Мовні токени | Реєстр `slug_tokens` замість колонки `slug` у перекладі й `*_slug_history`. **§5.3 спеки реалізовано реєстром**: «токен у рядку перекладу» означає прив'язку до мови й батька. Політика історії — як у `url_paths`. Видалення сутності → її токени каскадно. Старий `?mod=` чи фільтр з токеном видаленої сутності ігнорується: сторінка без вибору, а не 404 |
| Р18 | Тип значення властивості | Декларативно, без тригера: `value_kind` + складений FK `(property_id, value_kind) → section_properties(id, property_type)` `ON UPDATE RESTRICT`, CHECK «рівно потрібна колонка», частковий UNIQUE для не-multiselect, `UNIQUE(owner, property_id, option_id)` для multiselect. Складений FK `(property_id, option_id) → property_options(property_id, id)`. Зміна типу з наявними значеннями → 409 з i18n |

**Дрібне (прийнято архітектором):**
- FK значення на опцію — `ON DELETE CASCADE`. Адмінка попереджає про видалення з підрахунком.
- `section_properties.options` зноситься разом із полем `options` у `PropertyRow`
  (`storefront/loaders/entities/property.ts:32,45`). Зараз читач лише прокидає jsonb у рядок, і поле `.options`
  ніхто не читає (grep по `storefront-routes`, `catalog-ui`, `admin` дає порожньо). Опції вітрина бере з
  `property_options`. Після зносу це покриває `typecheck`: зникле поле не скомпілюється в жодному споживачі.
- slugify:
  - `uk` — офіційна схема КМУ 2010 власною таблицею;
  - латинське письмо без таблиці — NFKD, зняття діакритики, мала мапа `ł ø ß æ œ đ þ`;
  - нелатинське письмо без таблиці — авто-slug не генерується, поле обов'язкове вручну.
  - Тест на кожну гілку.
- Ключ процесного кешу `createReadCache` — мапа за локаллю.
- Хардкоди `'uk-UA'` (`OrderSuccess.tsx:97`, `Profile.tsx:56`, `ProductMetaCard.tsx:26,30`) правляться в М2.

## 2. Розбіжності спеки з кодом (факти розвідки, `a4aa566e`)

| # | Спека | Факт | Що робить план |
|---|---|---|---|
| а | §4: таблиця `languages` як нова | Таблиця вже є (`schema.ts:155`: `id, code varchar(10), name, is_default, is_active`), рантайм-читачів нуль, `/admin/languages` — заглушка | М1 перебудовує її за Р4 |
| б | §4: `slugify` у мовному пакеті | Коду slugify немає. Slug вводять вручну, формат `SLUG_RE` (`domain/slug.ts:8`) | М1 створює генератор |
| в | §8: «розділ показує товари підрозділів» | Вітрина показує лише кореневі розділи (`loaders/sections.ts:47`), фільтрує за точним `sectionId`, пагінації немає, фільтрація клієнтська (`useCatalogController.ts`) | М4 |
| г | §7.1: плоскі адреси | Адреси `/catalog/<розділ>/<товар>`. Товар шукається лише за slug, розділ в адресі — декор + 301 (`product-path.ts:38,51`) | М1 (товар), М2 (розділ), М4 (`/catalog`) |
| д | §7.4: head бере `meta_*` | `meta_title` / `meta_description` на вітрині мертві. hreflang і `og:locale` відсутні. sitemap і robots — інтерсептор `src/server.ts:65-82`, не роут | М1 (товар), М5 |
| е | §5.1: «контент Е6д (сторінки, меню тощо)» | Таблиць сторінок і меню немає. Контент Е6д = `banners`, `product_reviews`. Плюс `store_profile` jsonb у `system_settings` | М2: банери, відгуки, профіль (Р11) |
| є | §5.4: «мертва колонка `section_properties.options`» | Її вибирає `entities/property.ts:32`, але поле ніхто не читає | Знос у М2, див. «Дрібне» |
| ж | §9: «близько 126 serverFn» | 136: 125 у `admin-server/index.ts` + 6 у `plugin-sdk/server` + 3 у `plugins/server` + 2 у `themes/server`. Плагінні й темні йдуть через `isAdminRequest` повз `AUTHZ_MATRIX` | М3 |
| з | §9: «колекції admin-data лишаються для читання» | Колекції ПИШУТЬ через `persistenceHandlers` (`admin-data/handlers.ts`) | М1 (товар), М3 (решта) |
| и | §9: суб'єкт явним параметром | `runAdminTransactions` бере суб'єкта з `getRequest()` і сам ставить статус (`run.ts:35-62`, `authz-request.ts:30-55`, `validation.ts:24`) | М1 |
| і | §10: `doctor` про таблиці видалених плагінів, `simplycms plugin check` | Ні перевірки, ні команди немає | М2 (команда), М5 (doctor) |
| ї | §15: «генератора `exp/` у репо немає» | Генератор `exp/gen.mjs` тепер у репо (`567d7b30`), але під ЕКСПЕРИМЕНТАЛЬНУ схему | М5 пише генератор під нову схему; формулювання спеки правиться в М5 |
| й | AGENTS.md: «7 warnings (`react-hooks/*`, `no-unused-vars`)» | Усі 7 — `react-hooks/*` і React Compiler, `no-unused-vars` серед них немає | М5 разом із нормою 0/3 |
| к | §18.7: «часові події перераховує планувальник ядра» | Планувальника немає. Знижки з датами рахуються на льоту від `env.now` (`domain/discounts/discount.ts:21-26`) | М4 будує мінімальний планувальник для проєкції цін |
| л | Р6 | Снапшоти drizzle в 0.15.0 правили вручну. `mail_outbox` має окремі `drizzle/0001` і `migrations/0005` | М1 Task 1 |
| м | §3: `id` генерує викликач | Скрізь `crypto.randomUUID()` (v4), утиліти v7 немає | Так і лишається |

## 3. Незворотні контракти

Фіксуються ТУТ і однаково для всіх підхвиль. План підхвилі на них посилається й не перевизначає.

### 3.1 БД: таблиці, ключі, зв'язки

**Мови.**
- `languages(id uuid PK, code text NOT NULL, name text NOT NULL, status language_status NOT NULL, is_default boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`.
- `language_status` = `'draft' | 'published' | 'disabled'`.
- Обмеження: `UNIQUE(code)`, `UNIQUE(lower(code))`, CHECK формату (Р4), частковий UNIQUE `is_default` (наявний `idx_languages_single_default`), CHECK `NOT is_default OR status = 'published'`.

**Форма перекладу.** Для кожної перекладної сутності `E`:
- `E_translations(<e>_id uuid NOT NULL REFERENCES E(id) ON DELETE CASCADE, locale text NOT NULL REFERENCES languages(code) ON DELETE RESTRICT, <перекладні поля>, source_hashes jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(source_hashes) = 'object'), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (<e>_id, locale))`.
- Там, де потрібен батько (модифікація, опція), рядок несе батьківський ключ зі складеним FK на `(parent_id, id)` бази.
- Плагіни: `plg_<name>_<entity>_translations`, та сама форма.

**Перелік перекладних таблиць** (обов'язкові поля — жирним):

| Таблиця | Поля | Підхвиля |
|---|---|---|
| `product_translations` | **name**, short_description, description, meta_title, meta_description | М1 |
| `product_modification_translations` (+ `product_id`) | **name** | М1 |
| `product_images` / `product_image_translations` | alt, storage_key — обов'язкових полів НЕМАЄ, тригера джерела (І4) немає, рядок перекладу необов'язковий (К6) | М1 |
| `product_property_value_translations`, `modification_property_value_translations` | **value** (лише `value_kind = 'text'`) | М1 |
| `section_translations` | **name**, description, meta_title, meta_description, image_ref, image_alt | М2 |
| `section_property_translations` | **name**, unit | М2 |
| `property_option_translations` (+ `property_id`) | **name**, description, meta_title, meta_description, image_ref, image_alt | М2 |
| `banner_translations` | **title**, subtitle, image_ref, desktop_image_ref, mobile_image_ref, image_alt | М2 |
| `banner_button_translations` | **text** | М2 |
| `order_status_translations`, `shipping_method_translations`, `shipping_rate_translations` (estimated_days), `shipping_zone_translations`, `pickup_point_translations` (name, address, city, hours_note), `discount_translations`, `discount_group_translations`, `user_category_translations` | **name** + наявні тексти | М2 |
| `store_profile_translations` | **name**, home_title, description, address, hours | М2 |
| `plg_faq_items_translations` | **question**, **answer** | М2 |

Точні колонки таблиць М2 фіксує план М2 за цим переліком. Новий рядок у переліку = правка цього файлу.

**Реєстр адрес.**
- `url_paths(id uuid PK, locale text NOT NULL REFERENCES languages(code) ON DELETE CASCADE, path text NOT NULL, product_id uuid NULL REFERENCES products ON DELETE CASCADE, section_id uuid NULL …, property_id uuid NULL …, option_id uuid NULL …, is_current boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`.
- Обмеження:
  - CHECK `num_nonnulls(product_id, section_id, property_id, option_id) = 1`;
  - CHECK `path ~ '^[a-z0-9]+(-[a-z0-9]+)*$'` — один сегмент;
  - `UNIQUE(locale, path)`;
  - частковий UNIQUE `(locale, <тип>_id) WHERE is_current AND <тип>_id IS NOT NULL` — по одному на тип.
- Колонки `section_id` / `property_id` / `option_id` з'являються в М2. Форма — ця.

**Реєстр мовних токенів.**
- `slug_tokens(id uuid PK, locale text NOT NULL REFERENCES languages(code) ON DELETE CASCADE, scope_id uuid NULL, slug text NOT NULL, modification_id uuid NULL, property_id uuid NULL, option_id uuid NULL, is_current boolean NOT NULL, created_at …)`.
- Обмеження:
  - CHECK `num_nonnulls(modification_id, property_id, option_id) = 1`;
  - область через складені FK:
    - для модифікації `scope_id` = товар (`(scope_id, modification_id) → product_modifications(product_id, id) ON DELETE CASCADE`);
    - для опції `scope_id` = властивість (`(scope_id, option_id) → property_options(property_id, id) ON DELETE CASCADE`).
  - Складений FK за `MATCH SIMPLE` рядок із `scope_id IS NULL` не перевіряє, тому явні CHECK (К2): `modification_id IS NULL OR scope_id IS NOT NULL`, `option_id IS NULL OR scope_id IS NOT NULL`, `property_id IS NULL OR scope_id IS NULL`;
  - згенерована колонка `token_kind text GENERATED ALWAYS AS (CASE WHEN modification_id IS NOT NULL THEN 'modification' WHEN property_id IS NOT NULL THEN 'property' ELSE 'option' END) STORED`;
  - `UNIQUE NULLS NOT DISTINCT (locale, token_kind, scope_id, slug)` — по всіх рядках, включно з історією. Простори токенів товару й властивості не змішуються навіть за збігу UUID;
  - частковий UNIQUE поточного на (сутність, мова);
  - формат slug — той самий CHECK, що в `url_paths`.

**Значення властивостей** (Р18), для товару й модифікації однаково:
- `product_property_values(id uuid PK, product_id uuid NOT NULL → products CASCADE, property_id uuid NOT NULL, value_kind property_type NOT NULL, option_id uuid NULL, numeric_value numeric(15,4) NULL, bool_value boolean NULL, color_value text NULL)`.
- Складені FK:
  - `(property_id, value_kind) → section_properties(id, property_type) ON UPDATE RESTRICT ON DELETE CASCADE`;
  - `(property_id, option_id) → property_options(property_id, id) ON DELETE CASCADE`.
- CHECK «рівно одна колонка за `value_kind`»:
  - `select`/`multiselect` → `option_id`;
  - `number`/`range` → `numeric_value`;
  - `boolean` → `bool_value`;
  - `color` → `color_value` (CHECK `^#[0-9a-f]{6}$`);
  - `text` → жодної, текст у перекладі.
- UNIQUE:
  - частковий `(product_id, property_id) WHERE value_kind <> 'multiselect'`;
  - `(product_id, property_id, option_id)` для multiselect.
- Колонка `value` зноситься.
- `numeric_value` модифікації — `numeric(15,4)`, як у товару (зараз голий `numeric`).

**Зображення товару.**
- `product_images(id uuid PK, product_id uuid NOT NULL → products CASCADE, modification_id uuid NULL, storage_key text NOT NULL, sort_order integer NOT NULL, created_at …)`.
- Складений FK `(product_id, modification_id) → product_modifications(product_id, id) ON DELETE CASCADE`.
- jsonb `images` у `products` і `product_modifications` зноситься.

**Версії агрегатів:** `version integer NOT NULL DEFAULT 1` на `products` (М1), на кореневих таблицях М2 (розділ, властивість, банер, точка, спосіб доставки тощо).

**API:**
- `api_tokens(id uuid PK, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, name text NOT NULL, token_prefix text NOT NULL, token_hash bytea NOT NULL UNIQUE, scopes text[] NOT NULL, expires_at timestamptz NULL, revoked_at timestamptz NULL, last_used_at timestamptz NULL, created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL, created_at …)`.
- `idempotency_keys(subject_key text NOT NULL, operation text NOT NULL, key text NOT NULL, fingerprint bytea NOT NULL, status integer NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (subject_key, operation, key))`.
  - `subject_key` = `token:<api_tokens.id>` для Bearer-запиту, `user:<uuid>` для cookie-сесії. Два токени одного сервісного користувача мають різні області.
  - Зберігається ЛИШЕ відповідь 2xx (`response` — дані відповіді). Помилка ключа не «витрачає»: виправлене тіло з тим самим ключем виконується.
  - Рядки, старші за 24 год, вважаються відсутніми. Кожен запис ключа в тій самій транзакції прибирає обмежену порцію протухлих: `DELETE … WHERE ctid IN (SELECT ctid … WHERE created_at < now() - interval '24 hours' LIMIT 100)`.

**Замовлення й профілі (М2):**
- `orders.locale text NOT NULL REFERENCES languages(code)`; `profiles.locale text NULL REFERENCES languages(code)`; `product_reviews.locale text NOT NULL REFERENCES languages(code)`.
- Двомовний знімок:
  - `order_items.name` + `order_items.name_default text NULL`;
  - аналогічні `*_default` у `discount_data` і `shipping_data` (форма jsonb-знімка — в плані М2).
  - Інваріант: `name_default` заповнене ⇔ мова замовлення не основна.

**Профіль магазину:** синглтон `store_profile(id uuid PK CHECK (id = '00000008-0000-4000-8000-000000000001'), phone, email, logo_ref, socials jsonb)`. Значення id — наступний вільний префікс сіду, план М2 його звіряє.

### 3.2 URL

- **Основна мова** — без префікса. **Інші мови** — `/<lower(code)>/…` для ВСІХ маршрутів вітрини: сторінок, кошика, чекауту, `auth/`, `my/`, `profile/`, `order-success/`.
- **Сторінка сутності:** `/<path>` (основна мова) і `/<lower(code)>/<path>`. Тип сутності визначає реєстр, а не форма адреси.
- **Службові сегменти** — одна константа ядра `RESERVED_SEGMENTS`: `admin, api, assets, auth, cart, catalog, checkout, my, media, order-success, profile, properties, search, sitemap.xml, robots.txt`, плюс `lower(code)` кожної мови. `assets` резервується, бо статика з `/assets/` віддається раніше за роутер (`server.mjs:125`). Шлях і токен властивості не можуть дорівнювати жодному з них. Перевірка — в резолвері й в операції запису.
- **Верхньорівневі імена в `public/` магазину** константою не покрити. Операція запису шляху звіряє шлях із переліком верхньорівневих імен `public/` збірки (маніфест, який пише збірка). `doctor` звіряє наявні адреси з `public/` і попереджає про конфлікт.
- **CHECK формату шляху й токена — лише ASCII.** Розширити його пізніше (наприклад, на IDN-сегменти) можна адитивно, це не BREAKING.
- **Явна зміна адреси на ВЛАСНИЙ історичний шлях дозволена:** історичний рядок знову стає поточним, колишній поточний іде в історію. Чужий історичний чи поточний шлях → 409 `conflict`.
- **Нормалізація** (рівно ОДИН 301, дозволені query-параметри зберігаються):
  - `/<основна>/x` → `/x`;
  - історичний шлях → поточний шлях сутності в тій самій мові;
  - історичний токен у `?mod=` чи фільтрі → URL з поточним токеном;
  - усе це складається в одну кінцеву адресу.
- **Query сторінки товару:** `?mod=<токен модифікації>`.
- **Query каталогу** (`/<розділ>` і `/catalog`):
  - `?<токен властивості>=<токен опції>[,<токен опції>…]` — опції;
  - `?<токен властивості>=<min>..<max>`, `=<min>..`, `=..<max>` — число й діапазон. Число — десяткове з крапкою, без розділювачів тисяч, без знаку `+`;
  - `?<токен властивості>=1` — boolean;
  - `?<токен властивості>=<hex6>[,<hex6>…]` — кольори, hex без `#`, нижній регістр;
  - `?price=<min>..<max>` (і відкриті форми), `?in_stock=1`, `?sort=<price-asc|price-desc|name|new>`, `?page=<n≥2>`.
  - **Канонізація:**
    - `page=1` і `sort=<типове>` → 301 без них;
    - `page` більше за останню сторінку → 404;
    - генератор URL пише ключі й опції в канонічному порядку (`sort_order` властивостей, потім опцій). Сервер приймає будь-який порядок і 301 за порядок НЕ робить (фасетні комбінації однаково `noindex`);
    - невідомі ключі (`utm_*`, `gclid` тощо) фільтр ігнорує (не 404) і зберігає в 301.
  - **Зарезервовані ключі query** `mod, page, sort, price, in_stock, q, limit, view` входять у перевірку токенів властивостей. `q`, `limit`, `view` резервуються під пошук наступної хвилі.
- **Мова** визначається лише з першого сегмента шляху. Без cookie, сесії, `Accept-Language`, без `Vary: Accept-Language`.

### 3.3 Конверт API

- **Вхід:** `POST /api/v1/<op>`, де `<op>` — ідентифікатор операції реєстру, формат `^[a-z][a-z-]*(\.[a-z][a-zA-Z]*)+$` (напр. `languages.add`, `products.saveDescription`). Інші методи → 405 з `Allow: POST`.
- **Автентифікація:** `Authorization: Bearer scms_<prefix>_<secret>`, де prefix — 8 hex, secret — 32 випадкові байти base64url. Сесійний cookie на `/api/v1` теж працює, але з перевіркою Origin (CSRF): Bearer-запит Origin не перевіряє, cookie-запит перевіряє.
- **Тіло й відповідь:** тіло — JSON вхідної схеми операції. Відповідь 200 — JSON вихідної схеми. Дати на дроті — рядки ISO 8601 (`z.iso.datetime()`); перетворення Date ↔ рядок робить адаптер за дротовою схемою типу колонки.
- **Версія агрегата:** `If-Match: "v<n>"` ↔ поле `expectedVersion`. Якщо задано обидва й вони різні → 400. Відповідь команди агрегата несе `ETag: "v<n>"`.
- **`Idempotency-Key`:** 1–255 символів, лише для операцій із прапорцем `idempotent: 'create'`. Область — (`subject_key`, операція, ключ), де `subject_key` = `token:<id>` для Bearer і `user:<uuid>` для cookie (§3.1). Зберігаються лише відповіді 2xx.
  - повтор із тим самим відбитком (sha256 канонічного JSON тіла) → збережений статус і тіло;
  - інший відбиток → 422 `idempotency_mismatch`;
  - конкурентний дубль чекає на PK (див. наступний пункт); 409 `idempotency_in_flight` — лише якщо очікування перевищило `lock_timeout` транзакції;
  - 🔴 рядок ключа пишеться в ТІЙ САМІЙ транзакції, що й команда, без окремої «pending»-транзакції. Дубль чекає на PK: після коміту першої команди повертає збережене, після її відкату (не-2xx) виконується сам;
  - механізм (К5):
    - першою дією транзакції — `INSERT … ON CONFLICT DO NOTHING RETURNING` з placeholder-відповіддю. `unique_violation` не ловиться: Postgres абортує транзакцію після помилки;
    - 0 рядків → SELECT збереженого: інший відбиток → 422, інакше replay;
    - відповідь 2xx записується `UPDATE` того самого рядка ПЕРЕД комітом. Закомічений placeholder — дефект;
    - очікування на вставці обмежене `SET LOCAL lock_timeout` = константа `IDEMPOTENCY_LOCK_TIMEOUT_MS` поруч із механізмом; перевищення → 409 `idempotency_in_flight`;
  - строк — 24 год.
- **Помилки** — `application/problem+json` (RFC 9457): `{ type: 'urn:simplycms:problem:<kind>', title, status, detail?, kind, operation, errors? }`. `title` — стабільний англійський текст `kind`. `errors` — лише для 400: `[{ path, code }]` без сирого вводу.

  | status | kind |
  |---|---|
  | 400 | `validation` |
  | 401 | `unauthenticated` |
  | 403 | `forbidden` |
  | 404 | `unknown_operation` / `not_found` |
  | 405 | `method_not_allowed` |
  | 409 | `conflict` / `reference` / `language_in_use` / `source_changed` (+ `currentSourceHashes`) / `idempotency_in_flight` |
  | 412 | `version_mismatch` (+ `currentVersion`) |
  | 415 | `unsupported_media_type` |
  | 422 | `idempotency_mismatch` |
  | 500 | `internal` — без деталей |

- **Порядок перевірок:** автентифікація (401) → права й scopes (403) → валідація (400) → версія (412) → хеш джерела (409). Версія й хеш перевіряються атомарно в транзакції запису з `SELECT … FOR UPDATE` кореня агрегата.
- **Multipart** (`multipart/form-data`) приймають лише операції з прапорцем `transport: 'multipart'`. Їх перелік тримає тест паритету.
- **Лише сесія:** операції з `sessionOnly: true` (керування токенами й сервісними записами) виконуються тільки з cookie-сесії. Bearer → 403 `forbidden` незалежно від scopes. Токен випускається лише для себе або для сервісного облікового запису.
- **OpenAPI 3.1:** генерується з реєстру при збірці магазину (`z.toJSONSchema`, `target: 'draft-2020-12'`, `io: 'input'` для входу). Віддається `GET /api/v1/openapi.json` ЛИШЕ автентифікованому суб'єкту: перелік операцій розкриває встановлені плагіни магазину.
- **Інший метод** → 405 `application/problem+json`, `kind: 'method_not_allowed'`, заголовок `Allow: POST` (для `openapi.json` — `Allow: GET`).
- **`last_used_at`** оновлюється з тротлінгом: не частіше раза на хвилину на токен (`UPDATE … WHERE last_used_at IS NULL OR last_used_at < now() - interval '1 minute'`).

### 3.4 Семантика запису перекладів (§18.2–18.3 спеки, точно)

- **Частковий запис:** поле, відсутнє в запиті, не змінюється, і його текст і хеш лишаються як були. `null` очищує поле; для обов'язкового поля → 400. Порожній рядок і рядок із самих пробілів нормалізуються до `null`. Rich-text поле без текстового вмісту (після зняття тегів і `&nbsp;`/пробілів порожньо й немає `<img`/`<video`/`<iframe`, напр. `<p></p>` очищеного редактора) теж `null` — один предикат у `simplycms/domain/translations` (рішення контролера М1 Task 3 за спекою §18.2).
- **Хеш поля джерела:** `sha256(text.normalize('NFC').trim())` hex. Для rich-text береться вже санітизований HTML. Функція одна — `sourceFieldHash(text: string): string` у server-only `simplycms/translations` (`node:crypto`); чистий `simplycms/domain/translations` отримує хеш інжекцією, бо його імпортує й клієнт адмінки (рішення архітектора за рев'ю М1).
- **Статус поля не-джерела:**
  - `missing` — немає тексту;
  - `outdated` — `source_hashes[field] ≠ sourceFieldHash(поточне джерело)`;
  - `current` — інакше.
- **Статус рядка:**
  - `missing` — рядка немає або порожнє обов'язкове поле;
  - `outdated` — є `outdated`-поле;
  - `current` — інакше.
- **«Перекладено» для SEO:** кожне поле, НЕПОРОЖНЄ в джерелі, непорожнє і в мові (`outdated` рахується перекладеним). Назва англійською з описом українською — НЕ перекладено: змішана мова в індекс не потрапляє.
- **Сценарій 1** — запис лише джерела: рядки інших мов не змінюються, їхні поля стають `outdated` за формулою.
- **Сценарій 2** — джерело разом із перекладами: для кожного НАДІСЛАНОГО поля перекладу `source_hashes[field]` = хеш НОВОГО джерела. Ненадіслані поля зберігають свій хеш.
- **Сценарій 3** — переклад з `expectedSourceHashes: Record<field, hash>`: рядок джерела блокується `FOR UPDATE`. Якщо хеш хоч одного названого поля не збігається → 409 `source_changed` з поточними хешами. Інакше записуються НАДІСЛАНІ поля, `source_hashes[field] = expected` лише для них; поле, назване в `expectedSourceHashes`, але не надіслане, тільки перевіряється — його хеш не змінюється (як у сценарії 2: актуальним стає лише надіслане поле, спека §18.2).
- **Видалення перекладу мови** — окрема операція. Запис агрегата ніколи не видаляє рядків мов поза запитом. Видалити рядок основної мови не можна.
- **Версія:** будь-яка команда агрегата опису збільшує `version` кореня на 1 у тій самій транзакції.

### 3.5 Машина станів мов (§18.4)

| Перехід | Умова | Побічні дії |
|---|---|---|
| — → `draft` (`languages.add`) | код за Р4; мовний пакет НЕ обов'язковий | Вставка рядка під ексклюзивним advisory-замком `languages-set` → коміт → пакетне заповнення адрес і токенів для всіх сутностей (ідемпотентне, `INSERT … WHERE NOT EXISTS`) → побудова проєкції мови |
| `draft` → `published` | повнота: кожна сутність має поточну адресу й токени в мові, проєкція мови повна (команда звірки дає 0 розбіжностей) | Інвалідація процесних кешів за локаллю |
| `published` → `disabled` | мова не основна | Вітрина мови → 404 (свідоме рішення: пошуковик має прибрати сторінки, 301 на основну мову цього не дав би). Адреси, токени й переклади зберігаються. Проєкція мови не підтримується |
| `disabled` → `published` | та сама повнота після звірки | Дозаповнення адрес і токенів для сутностей, створених поки мова була `disabled`, перебудова проєкції мови |
| `draft` → `disabled`, `disabled` → `draft` | мова не основна | — |
| видалення (`languages.remove`) | не основна; на мову не посилається жоден рядок (переклади, а з М2 замовлення, профілі, відгуки; будь-який `23503` навколо DELETE мови операція сама мапить у 409 `language_in_use`) | Адреси й токени мови видаляються каскадно |

- **Замок `languages-set`.** СПІЛЬНИМ його беруть усі операції, що створюють адреси чи токени: створення сутності, нова модифікація, нова опція, явна зміна адреси чи токена. Вони створюють адреси й токени для мов у `draft` і `published`. Ексклюзивний замок беруть ВСІ записи в `languages`: `add`, кожна зміна статусу (`draft`/`published`/`disabled` у будь-якому напрямку), `reorder`, `remove` і будь-яка інша зміна рядка мови. Одне правило без таблиці переходів; замок — ПЕРШИЙ крок транзакції, до читання рядка мови. Він чекає завершення транзакцій, що створюють адреси й токени, тож пакетне заповнення бачить усі закомічені сутності, а творець не ловить хибну відмову відкладеної перевірки (`23514`) чи `409` через мову, що змінилась під ним. Генератори адрес і токенів самі беруть спільний замок і читають набір мов `draft`/`published` ПІСЛЯ нього. Правило тримає тригер БД `languages_require_lock` (`0004_functions.sql`, `BEFORE INSERT OR UPDATE OR DELETE`, SQLSTATE `SC001`): запис без ексклюзивного замка `languages-set` у поточному бекенді відхиляється; сід `0003_seed.sql` і фікстури харнеса беруть той самий замок.
- **Ключі advisory-замків** — один реєстр `simplycms/db/lock-keys` разом із ключем накату `MIGRATION_LOCK_KEY` (`migrate/apply.ts:28`). Тест доводить непересічність ключів (`hashtextextended` рядкових ключів ≠ жодному числовому).
- **Основна мова:** лише `published`, переходів немає. Створюється тільки `bootstrapStore`.

### 3.6 Створення магазину (Р7)

- **Конфіг магазину:** `simplycms.config.ts` → `defineConfig({ primaryLocale: '<code>', … })`. `simplycms create --locale <code>` (інтерактивно — питання) пише значення туди.
- **`bootstrapStore(primaryLocale)`** — ідемпотентний крок прод-старту й `simplycms db:apply`, ПІСЛЯ міграцій:
  - якщо `languages` порожня — в ОДНІЙ транзакції вставляє основну мову (`published`, `is_default`), а також базові рядки ПЕРЕКЛАДНИХ системних довідників разом із їхніми перекладами з мовного пакета (статуси замовлень, вид ціни, основна зона доставки `00000007-…01`, способи доставки, категорія покупця тощо). Фіксовані id беруться з константи ядра `SYSTEM_SEED_IDS` (`simplycms/schema/seed-ids`);
  - якщо не порожня — нічого не пише. Розбіжність `primaryLocale` з основною мовою БД → warn у `doctor`.
- **`0003_seed.sql`** сіє ЛИШЕ рядки таблиць, що не мають перекладної таблиці (наприклад, `system_settings` без тексту, `themes`). Базових рядків перекладних довідників у ньому немає: на момент накату `languages` порожня, і відкладений тригер І4 відхилив би коміт.
- **Хто викликає `bootstrapStore` після накату:** прод-старт (`simplycms/prod-start`), `simplycms db:apply`, харнес `test:schema` (одноразово на кластер), `pnpm db:demo`, `pnpm db:showcase` і `pilot`. Тест інваріанту основної зони (`shipping-zone-invariant.test.ts`) працює на базі після bootstrap.
- **Нова мова (`languages.add`)** у тій самій пакетній фазі після коміту дозаповнює переклади системних довідників (рядки з фіксованими id) з мовного пакета, якщо він є. Без пакета переклади довідників лишаються `missing`.
- **Мовний пакет основної мови обов'язковий:** без нього → відмова з переліком доступних пакетів.

## 4. Матриця інваріантів

Кожен рядок закритий, лише коли його тест існує й мутація доведено валить тест (рядок «мутація → червоний →
відкат → зелений» у звіті задачі). Колонка «Хв.» — підхвиля, що закриває рядок.

| № | Інваріант | Механізм | Тест (файл у `test-harness/pg/__tests__/`, якщо не вказано) | Мутація | Хв. |
|---|---|---|---|---|---|
| І1 | Рівно одна основна мова; `code` і `is_default` незмінні; основна лише `published` | частковий UNIQUE + CHECK + BEFORE UPDATE тригер `languages_guard` | `languages-invariants.test.ts` | прибрати гілку `is_default` у тригері | М1 |
| І2 | Основну мову не видалити; мову з будь-яким посиланням — 409 `language_in_use` | BEFORE DELETE у `languages_guard` + FK `RESTRICT` + `languages.remove` локально ловить `23503` навколо свого DELETE (Postgres кладе в `TABLE NAME` таблицю, що посилається, тож мапінг за таблицею неможливий) | `languages-invariants.test.ts`, `languages-operations.test.ts`; М2 — `languages-remove-referenced.test.ts` (замовлення мовою L) | прибрати гілку DELETE; мапити за `error.table = 'languages'` → 500 | М1, М2 |
| І3 | Формат коду BCP 47, унікальність без урахування регістру | CHECK + UNIQUE(lower(code)) | `languages-invariants.test.ts` | прибрати UNIQUE(lower) → `en-GB`/`en-gb` проходить | М1 |
| І4 | Кожна перекладна сутність має рядок основної мови з обов'язковими полями на коміті; поле порожнє, якщо `nullif(btrim(col), '') IS NULL` (К3); каскад батька дозволено | `require_source_translation()` (Р3): constraint-тригери на базу (INSERT; за заданої умови — ще й UPDATE колонки умови, інакше UPDATE обходить І5) і переклади (DELETE, UPDATE обов'язкових, `locale`, FK); підключення — одна процедура `attach_source_translation_triggers`; операція нормалізує першою, тригер — страховка для прямого SQL | `source-translation-required.test.ts` (по таблиці на тип; під `app_user` і `app_admin`) | прибрати тригер на перекладах | М1 (товар), М2 (решта) |
| І5 | Обов'язковість тексту значення — лише для `value_kind='text'` | Р3 з умовою в `TG_ARGV` | `property-values-shape.test.ts` | прибрати умову → числове значення вимагає тексту | М1 |
| І6 | Колонка значення відповідає типу властивості | складений FK `(property_id, value_kind)` + CHECK | `property-values-shape.test.ts` | (а) прибрати складений FK; (б) прибрати CHECK | М1 |
| І7 | Опція значення належить своїй властивості | складений FK `(property_id, option_id)` | `property-values-shape.test.ts` | замінити на простий FK `option_id` | М1 |
| І8 | `select` — один рядок, `multiselect` — рядок на опцію | частковий UNIQUE + UNIQUE | `property-values-shape.test.ts` | прибрати частковий UNIQUE | М1 |
| І9 | Видалення опції прибирає її значення | FK `ON DELETE CASCADE` | `property-values-shape.test.ts` | `SET NULL` | М2 |
| І10 | Ключі `source_hashes` ⊆ перекладних полів типу | хелпер запису + тест на кожну таблицю | `translations-hash-keys.test.ts` | хелпер пише хеш `slug` | М1 |
| І11 | Запис агрегата не видаляє рядків мов поза запитом | `upsertTranslations` без DELETE | `product-aggregate.test.ts` | хелпер видаляє відсутні мови | М1 |
| І12 | Частковий запис і хеші за §3.4 (відсутнє не змінюється, `null` очищує, `''` → `null`, сценарії 1–3) | `domain/translations` + хелпер | `domain/translations/__tests__/*.test.ts` + `product-aggregate.test.ts` | сценарій 2 оновлює хеші ненадісланих полів | М1 |
| І13 | Сценарій 3: гонка «переклад проти зміни джерела» не дає `current` на застарілому джерелі | `FOR UPDATE` рядка джерела | `translation-race.test.ts` (дві паралельні транзакції) | прибрати `FOR UPDATE` | М1 |
| І14 | Версія: неспівпадіння → 412; ціни й залишки версію не чіпають; порядок права → версія → хеш | виконавець операцій + `FOR UPDATE` кореня | `product-aggregate.test.ts`, `operations/__tests__/check-order.test.ts` | поміняти місцями перевірки версії й хешу | М1 |
| І15 | Шлях унікальний у мові через усі типи | `UNIQUE(locale, path)` | `url-paths.test.ts` | прибрати UNIQUE | М1 (М2 — між типами) |
| І16 | Для кожної (сутність, мова в `draft`/`published`) — рівно одна поточна адреса; переклад і його видалення адресу не змінюють; `disabled` — адреси зберігаються, дозаповнення при повторному ввімкненні | частковий UNIQUE (≤1) + ВІДКЛАДЕНА перевірка наявності (спека §18.1, К4): constraint-тригер на INSERT бази перевіряє всі мови `draft`/`published` зі свого знімка; на DELETE / UPDATE OF `is_current`, `path` реєстру — лише (сутність, ту мову), і першим кроком `RETURN NULL`, якщо мови чи сутності вже немає (каскади `languages.remove` і видалення сутності) або мова не в `draft`/`published`; вставка мови тригер не запускає, повноту нової мови дає звірка перед публікацією; ЗМІНА набору мов (`add`, статус, `reorder`, `remove`) іде під ексклюзивним замком `languages-set` (тригер `languages_require_lock`) | `url-paths.test.ts` (створення, перейменування, нова мова, повторне ввімкнення, коміт товару без адреси → відмова; товар у транзакції, що конкурує з `languages.add`, зміною статусу чи `remove`, комітиться без хибної відмови; `languages-lock.test.ts` — запис у `languages` без замка → SC001) | (а) операція створення не пише адресу для `draft`-мови; (б) прибрати тригер → коміт без адреси проходить | М1 |
| І17 | Адреса не змінюється сама: перейменування, перенесення й поява перекладу її не чіпають | операції не викликають генератор поза створенням і явною зміною | `product-aggregate.test.ts` | збереження опису перегенеровує шлях | М1 |
| І18 | Колізія авто-адреси → детермінований суфікс; явна зміна на чужу зайняту (поточну чи історичну) → 409; на ВЛАСНУ історичну → вона знову поточна | генератор `allocateSlug` + операція явної зміни | `domain/slugs/__tests__/allocate.test.ts`, `url-paths.test.ts` | (а) генератор без суфікса; (б) власна історична → 409 | М1 |
| І19 | Зарезервовані сегменти й коди мов не можуть бути шляхом чи токеном властивості | `RESERVED_SEGMENTS` у генераторі, операції й резолвері | `domain/slugs/__tests__/reserved.test.ts` (по елементу) | прибрати один сегмент | М1 |
| І20 | Рівно ОДИН 301 на будь-яку неканонічну адресу; історія видаленої сутності → 404 | резолвер `resolveStorefrontPath` | `storefront-routes/__tests__/path-normalize.test.ts` | двокроковий редирект `/uk/old` → `/old` → `/new` | М1 |
| І21 | Для кожної (сутність, мова в `draft`/`published`) — рівно один поточний токен; переклад і його видалення токен не змінюють; `disabled` — токени зберігаються, дозаповнення при повторному ввімкненні | частковий UNIQUE (≤1) + відкладена перевірка наявності дзеркально І16 (К4) + явні CHECK області і `token_kind` у ключі (К2) | `slug-tokens.test.ts` (створення, зміна назви, нова мова, видалення перекладу, токен модифікації без області → відмова) | (а) операція не створює токен; (б) прибрати CHECK `modification_id → scope_id NOT NULL` → рядок без області проходить | М1 (модифікації), М2 (властивості, опції) |
| І22 | `url_paths` і `slug_tokens` дають однаковий slug на однакових входах | один модуль `domain/slugs` | `domain/slugs/__tests__/parity.test.ts` | окремий slugify для токенів | М1 |
| І23 | Проєкція = функція джерела після кожної команди | синхронне оновлення в транзакції команди + команда звірки | `catalog-projection.test.ts` (звірка після кожної команди товару) | команда пропускає оновлення проєкції | М1 (текст), М4 (фасети й ціни) |
| І24 | Кожна операція реєстру має serverFn-обгортку і доступна через HTTP | тест паритету | `operations/__tests__/registry-parity.test.ts` | не зареєструвати операцію | М1 |
| І25 | serverFn адмін-зони не має логіки й делегує операції; `*In`/`withActor` не викликаються поза операцією | лінт `simplycms-ops/thin-server-fn` + `simplycms-ops/no-core-outside-operation` | `tests/eslint-rules/*.test.ts` | serverFn з тілом | М1 (перенесені), М3 (уся зона) |
| І26 | Кожна serverFn адмін-зони має операцію з рядком в `AUTHZ_MATRIX` (і плагінні, і темні) | лінт + паритет | як І24/І25 | serverFn через `isAdminRequest` | М3 |
| І27 | Токен: у БД лише хеш; відкликаний чи прострочений → 401; права = роль ∩ scopes; дія атрибутується суб'єкту; токен — лише для себе чи сервісного запису; керування токенами — лише з сесії | `api_tokens` + `subjectFromToken` + `requireOperation` | `api-tokens.test.ts`, `operations/__tests__/http-auth.test.ts` | ігнорувати scopes | М1 |
| І28 | `Idempotency-Key`: повтор → той самий результат; інший відбиток → 422; конкурентний дубль чекає на PK і повертає збережене (409 лише за `lock_timeout`); область — токен (Bearer) чи користувач (cookie), два токени одного користувача не ділять результат; зберігається лише 2xx; протухлі прибираються обмеженою порцією | `idempotency_keys` PK + запис у транзакції команди | `idempotency.test.ts` | (а) `subject_key` = користувач для Bearer; (б) зберігати 4xx; (в) пропустити `UPDATE` відповіді → повтор отримує placeholder; (г) без `lock_timeout` → утримана перша транзакція вішає дубль | М1 |
| І29 | problem+json не витікає сирим вводом, стеком чи текстом БД | мапер помилок адаптера | `operations/__tests__/http-problem.test.ts` | віддати `error.message` для 500 | М1 |
| І30 | Мова вітрини лише з URL | `resolveRequestLocale(pathname)` — єдине джерело; лінт забороняє `accept-language` у зоні вітрини | `storefront-routes/__tests__/request-locale.test.ts` | читати `Accept-Language` | М1 |
| І31 | `orders.locale` NOT NULL; `*_default`-знімок заповнений ⇔ мова замовлення не основна | NOT NULL + CHECK/тригер (план М2) | `order-snapshot-locale.test.ts` | знімок без основної мови | М2 |
| І32 | Видалення цілі кнопки банера → 409 | FK `RESTRICT` | `banner-buttons.test.ts` | `SET NULL` | М2 |
| І33 | Одна політика індексації: «перекладено» = кожне непорожнє в джерелі поле непорожнє в мові (§3.4); неперекладене → `noindex` + canonical на основну, поза hreflang і sitemap; ручний `robots` не перекриває | `indexPolicy()` | `storefront/seo/__tests__/index-policy.test.ts` + тести HTML | (а) hreflang на неперекладену версію; (б) індексація лише за `name` | М1 (товар), М5 (усе) |
| І34 | Фасетні комбінації — `noindex, follow`; robots.txt їх не блокує; пагінація self-canonical | `indexPolicy()` + robots | `index-policy.test.ts`, `robots.test.ts` | `Disallow: /*?` | М4/М5 |
| І35 | Плагін не пише в перекладну таблицю сирим `usePluginTable` | агрегатний порт + заборона в `table-db.ts` | `plugin-sdk/__tests__/translations-port.test.ts` | дозволити сирий запис | М2 |
| І36 | Ключі кешів (queryKey вітрини, `createReadCache`, майбутній кеш сторінок) містять локаль; дві мови не ділять запис | сегмент локалі в `entityKey`/`aggregateKey` вітрини + мапа за локаллю в `createReadCache` | `contracts/__tests__/locale-keys.test.ts`, `site/__tests__/read-cache-locale.test.ts` | прибрати локаль з ключа | М1 |
| І37 | `<html lang>` = мова сторінки; fallback-фрагменти мають `lang=<основна>`; `dir` — з `new Intl.Locale(code).getTextInfo().direction` (Node ≥ 24), без колонки; hreflang `x-default` = основна мова | root-контекст мови + компонент `FallbackText` | `storefront-routes/__tests__/lang-attrs.test.tsx` | fallback-текст без `lang` | М1 |
| І38 | Рішення власника 21: товар проходить фільтр, лише якщо ОДНА модифікація задовольняє всі умови разом із властивостями товару; у лістингу ціна, наявність і посилання (`?mod=`) найдешевшої з підхожих | проєкція фасетів (товар × модифікація) + запит каталогу | `catalog-facets.test.ts` | умови, задоволені різними модифікаціями, пропускають товар | М4 |
| І39 | Рішення власника 10: ціна каталогу (фільтр, сортування) = вид ціни глядача + загальні знижки; персональних знижок немає | проєкція цін за видами + запит | `catalog-prices.test.ts` (два види цін, акція з датами) | сортування за роздрібною для гуртового глядача | М4 |
| І40 | Накат канону на чисту БД + `bootstrapStore` → І4 і інваріант основної зони зелені; повторний bootstrap нічого не пише | `0003` без перекладних довідників + `bootstrapStore` в одній транзакції | `bootstrap-store.test.ts` | `0003` вставляє статус замовлення без перекладу → накат червоний | М2 |

Нагадування для М5 (не інваріанти, а застарілі формулювання): AGENTS.md «0/7 … `no-unused-vars`»; спека §15
«генератора немає».

## 5. Карта підхвиль

Порядок суворий: наступна підхвиля стартує після приймання попередньої архітектором (повний ланцюг гейтів +
мутації рядків матриці в його worktree). Реліз — лише з кінця хвилі. Проміжний стан гілки (сутності ще на старих
колонках) допустимий, але гейти зелені на кожному коміті.

| Підхвиля | Що | DoD | Рядки матриці |
|---|---|---|---|
| **М1** Фундамент і наскрізний товар | Ребазлайн drizzle. Мови (таблиця, машина станів, операції). `domain/translations`, `domain/slugs`. Реєстри `url_paths` і `slug_tokens`. Реєстр операцій + виконавець + HTTP + токени + Idempotency + OpenAPI + паритет + лінт. Агрегат товару (переклади, модифікації, значення властивостей товару й модифікації, зображення) з версією. Ціни й залишки командами. Проєкція тексту товару. Мовний контекст запиту вітрини. Сторінка товару `/<path>` з head, hreflang, noindex і canonical. Sitemap товарів. Картка товару в адмінці з вкладками мов | Товар створюється, перекладається й читається обома транспортами. `/en/<path>` віддає переклад або fallback із `noindex`. Гейти зелені | І1–І8, І10–І25 (перенесені операції), І27–І30, І33 (товар), І36, І37 |
| **М2** Решта сутностей | Розділи, властивості, опції, банери й кнопки, доставка, точки, статуси, знижки, категорії, профіль магазину. `reviews.locale`. `orders.locale` + двомовні знімки. `profiles.locale`. Листи мовою. Знос `VITE_LOCALE` / `declareStoreLocale` / `config.locale`. `bootstrapStore` + `primaryLocale` + `create --locale`. Плагіни (конвенція, агрегатний порт, виняток SQL-лінту `REFERENCES public.languages(code)`, FAQ, `simplycms plugin check`). Хардкоди `'uk-UA'` | Усі тексти §3.1 у перекладах, жодної текстової колонки в базових таблицях переліку | І4, І9, І21, І31, І32, І35, І40 |
| **М3** Повна адмінка й API | Усі 136 serverFn на реєстрі. Лінт на всю адмін-зону. Сторінка мов з індикатором повноти. Список «потребує перекладу». Сторінка токенів і сервісних облікових записів. Колекції `admin-data` лише читають. Пошук списків будь-якою мовою й за артикулом | Паритет 100%, лінт без винятків | І24–І26 |
| **М4** Каталог на сервері | Проєкція фасетів (товар × модифікація, рішення власника 21) і цін (вид ціни глядача + загальні знижки). Мінімальний планувальник ядра для меж акцій зі звіркою пропуску при старті. Фільтри в URL за §3.2, SSR, пагінація, підрозділи, `/catalog` | Каталог без клієнтської фільтрації; бюджет розділу на стенді М5 | І23, І34, І38, І39 |
| **М5** SEO й експлуатація | `indexPolicy` для всіх сторінок. sitemap кожної мови. Генератор стенда 50k × 5 під нову схему + бюджети §15 і §18.7. Команда звірки проєкції. `doctor` про таблиці видалених плагінів. `doctor`: відсутній маніфест `public/` у збірці + конфлікт наявних адрес з `public/`. Норма лінту 0/3 (§15a). Канон `docs/architecture/*`, CHANGELOG, носії стану, застарілі формулювання | Бюджети виміряно у звіті; повний ланцюг + `live:smoke` + `pilot-full` | І33, І34 + регрес усієї матриці |

Заморожування baseline — поза хвилею, крок `1.0.0-rc.1`.

## 6. Процес і Global Constraints (для всіх підхвиль)

- Відповіді, коментарі й доки — українською; коментар пояснює **чому**.
- **Гілка й дерево:** гілка `claude/multilingual-wave`. Спільне дерево `/home/vsydorenko/github/simplyCMS`, протокол «вікно відкрите/закрите» з архітектором (він працює у `~/simplycms-accept`). Імплементери роблять `git add` лише явних шляхів.
- **Коміти, push, PR** — лише за вказівкою власника. Після кожного коміту субагента:
  `git log --format=%B origin/main..HEAD | grep -ciE "co-authored|generated with"` = `0`.
- **Моделі:** виконання — SDD (`superpowers:subagent-driven-development`). Імплементерам — явний `model: sonnet`, рев'юерам і верифікаторам — `model: opus`. Fable — ніде.
- **БЛ** = `pnpm install --frozen-lockfile → format:check → lint → build → typecheck → typecheck:showcase → test → test:schema → build:packages → typecheck:template → test:packaging`.
  - «Прогнати перед комітом» = БЛ + названі тести. Проміжні TDD-кроки — вибірковий тест.
  - 🔴 Docs-коміти теж проганяють повний `pnpm test`: `doc-symbols-exist` уже ламав реліз 0.15.0.
  - Задача, що чіпає сід чи назви довідників, ганяє `pnpm live:smoke`.
- **Негативний контроль:** кожен новий тест має негативний контроль прогоном. У звіті рядок «мутація → червоний → відкат → зелений» з назвою тесту. Мутує лише одна сесія чи worktree.
- **Виняток baseline,** а не нові міграції: синхронно `schema.ts`, `migrations/{0001_init,0002_grants,0003_seed,0004_functions}.sql`, `drizzle/` (скриптом Р6), `0002_grants` + `test-harness/pg/__tests__/fixtures/grants.ts`. Потім `pnpm template:sync`. Нова функція чи тригер → `functions-allowlist.test.ts`. Новий INSERT у сід → `seed-determinism.test.ts`.
- **Нові теки `src/*`** реєструються в `eslint.tier-zones.mjs`, у `exports` пакета й у таблиці `packages/README.md`.
- **Норма лінту** до М5 — 0 errors / 7 warnings; після М5 — 0 / 3.
- **Бібліотечні API** перевіряються через context7, а не з пам'яті.
- **Розмір модуля:** ~150 рядків. У звіті задачі — `wc -l` змінених файлів коду; понад 150 — поділ або обґрунтування.
- **CHANGELOG:** лише розділ `[Unreleased]`. Кожна підхвиля додає свої BREAKING. Обов'язковий рядок «перестворити БД».
- **Docker-контейнери тестів** — з tmpfs; прибирати `docker rm -fv`.

## 7. Review Focus (для всієї хвилі; кожен рядок має тест у підхвилі-власниці)

1. **Магазин із 10k товарів додає другу мову, а адмін у цей час створює товари.** Очікування: кожен товар, створений до й під час додавання, має адресу в новій мові. Публікація мови недоступна, доки звірка не дасть 0. Тест — М1 (`languages-add-concurrency.test.ts`).
2. **Два товари з однаковою назвою; мова з копіюванням адрес, де копія зайнята рядком історії.** Очікування: суфікси `-2`, `-3` без падіння. Явне редагування на чужу зайняту адресу → 409 `conflict`. Повернення товару на його ВЛАСНУ колишню адресу проходить: вона знову поточна, а попередня стає історією з 301. Тест — М1.
3. **Інтеграція повторює створення після тайм-ауту з тим самим `Idempotency-Key`; друга інтеграція того самого сервісного користувача (інший токен) шле той самий ключ; перша спроба впала з 400, виправлене тіло йде з тим самим ключем.** Очікування: один товар і той самий результат для повтору. Другий токен має власну область і отримує власний результат. Після 400 ключ не «витрачено» — виправлене тіло виконується. Тест — М1.
4. **Адмін змінює опис джерела, поки перекладач через API пише переклад зі старим `expectedSourceHashes`.** Очікування: 409 `source_changed`, переклад не стає `current`. Тест — М1 (І13).
5. **Відвідувач відкриває `/en/x` неперекладеного товару, `/uk/x`, стару адресу з `?mod=` старим токеном.** Очікування:
   - перший випадок — текст `uk`, інтерфейс `en` (або основна мова за відсутності пакета), `noindex`, canonical на `/x`;
   - другий — рівно один 301 на `/x`;
   - третій — рівно один 301 на поточну адресу з поточним токеном.

   Тест — М1.
