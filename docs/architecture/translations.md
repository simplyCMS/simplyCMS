# Переклади даних, адреси й проєкція

Канон мультимовності ДАНИХ (тексти сутностей, адреси, мовні токени, фото по мовах).
Інтерфейсні рядки — окремо, [`i18n.md`](./i18n.md). Незворотні контракти (таблиці, URL,
семантика запису, машина станів мов) зафіксовано в майстер-плані хвилі §3
([`2026-10-15-multilingual-wave-master.md`](../superpowers/plans/2026-10-15-multilingual-wave-master.md));
цей файл описує, як їх тримає КОД, і посилається на §3 замість переказу. Запис —
лише операціями реєстру ([`operations-api.md`](./operations-api.md)).

Стан: М1 (мови, товар наскрізно — переклади, модифікації, значення властивостей, фото,
адреси, токени, проєкція тексту, сторінка товару). Решта сутностей переходить у М2 за тим
самим каноном.

---

## 1. Модель

- **Мови** — таблиця `languages` (майстер §3.1): код BCP 47, `status`
  `draft | published | disabled`, рівно одна основна (`is_default`, лише `published`). Інваріанти
  тримає БД: тригер `languages_guard` (код і `is_default` незмінні, основну не видалити),
  частковий UNIQUE, CHECK формату. Формат коду — одне джерело `LANGUAGE_CODE_FORMAT`
  (`simplycms/domain/translations`), парність із CHECK доводить
  `language-code-format-parity.test.ts`.
- **Переклад сутності `E`** — таблиця `E_translations` з PK `(<e>_id, locale)`, перекладними
  полями й `source_hashes` (форма й перелік таблиць — §3.1). Основна мова — ДЖЕРЕЛО: її рядок
  обов'язковий, переклади інших мов рахуються відносно нього.
- **Реєстр перекладних сутностей** — `TRANSLATABLE` (`simplycms/translations/specs.ts`): таблиця,
  FK, поля (імена колонок БД — вони ж ключі `source_hashes`, І10), обов'язкові поля, rich-поля.
  Хелпери запису й читання беруть адресу таблиці лише звідси; на дроті поля camelCase
  (`fieldToWire`/`fieldFromWire`).
- 🔴 **Обов'язковий рядок джерела (І4)** тримає БД: constraint-тригери `require_source_translation`
  (ВІДКЛАДЕНІ, на коміт) на базовій таблиці й на перекладах; підключення — одна процедура
  `attach_source_translation_triggers` (`0004_functions.sql`). Для значень властивостей умова в
  аргументах тригера — `value_kind=text` (І5): числове значення тексту не вимагає. Операція нормалізує
  першою, тригер — страховка для прямого SQL.

## 2. Семантика запису (майстер §3.4)

- Чиста логіка — `simplycms/domain/translations` (T1, клієнтобезпечний — її імпортує й
  адмінка): `normalizeTextInput` (`undefined` — не чіпати; `null`, `''`, самі пробіли → очистити),
  `planTranslationWrite` (сценарії 1–3: які колонки й які `source_hashes` пишуться),
  статуси `fieldStatus`/`rowStatus` (`missing`/`outdated`/`current`) відносно `SourceRow`
  (`toSourceRow`), «перекладено для SEO» — `isTranslatedForSeo`.
- 🔴 **Порожнеча rich-поля — за розміткою, не за пробілами.** `hasRichText`: після зняття тегів і
  `&nbsp;`/невидимих символів порожньо й немає `<img`/`<video`/`<iframe` → поле порожнє (`<p></p>`
  очищеного редактора — `null`). Яке поле rich — каже `spec` (`isRichField`, `fieldHasText`); у
  `hasText(text, rich)` параметр обов'язковий, щоб пропуск не рахував розмітку текстом.
- **Хеш джерела** — `sourceFieldHash` (sha256 від `NFC` + `trim`) лише в server-only
  `simplycms/translations`; доменний шар отримує його інжекцією (клієнтський бандл без
  `node:crypto` — гейт `domain-translations-client-safe.test.ts`).
- **Запис у БД** — `applyTranslationPlan`: `INSERT … ON CONFLICT DO UPDATE` лише НАДІСЛАНИХ
  колонок; DELETE у ньому немає за побудовою (І11) — мова поза запитом недоторкана. Видалення
  мови перекладу — окрема `deleteTranslation` (основну не можна).
- **Гонка «переклад проти зміни джерела» (І13, Review Focus 4):** команда бере корінь агрегата
  `FOR NO KEY UPDATE` через `lockAggregateRoots` (`lockProduct`), далі `assertVersionThenHash`:
  стара версія → 412, свіжа версія зі старими хешами → 409 `source_changed`. Переклад ніколи не
  стає `current` щодо джерела, якого перекладач не бачив (`translation-race.test.ts`).
- Порядок замків агрегата товару — JSDoc `lock-order.ts` (`admin-server/impl/products/aggregate`):
  `languages-set` → корені за id → дочірні; деталі й тести — [`data-layer.md`](./data-layer.md) §15.

## 3. Реєстри адрес і мовних токенів (майстер §3.1–3.2)

- **`url_paths`** — шлях сутності в мові (один сегмент, `SLUG_FORMAT`), історія (`is_current`),
  унікальність `(locale, path)` через усі типи (І15). **`slug_tokens`** — токени модифікацій
  (`?mod=`), область — складеним FK `(scope_id, modification_id)` + явні CHECK (К2).
- API — `simplycms/addressing` (server-only): `createPathsForEntity`/`createTokensForEntity`
  (самі беруть СПІЛЬНИЙ `languages-set` і читають мови `draft`/`published` після нього, Review
  Focus 1), `setExplicitPath`/`setExplicitToken` (явна зміна; власна історична адреса знову
  поточна, чужа → 409, І18), `copyPathsForLocale`/`copyTokensForLocale` (пакетне заповнення нової
  мови), `resolvePath`/`resolveToken`/`currentPaths`, `publicNames` (верхньорівневі імена
  `public/` збірки, яким адреса дорівнювати не може).
- Один генератор slug для обох реєстрів (І22) — `simplycms/domain/slugs`: `slugify` (таблиця
  мовного пакета; `null` для письма без таблиці), `allocateSlug` (`base`, `base-2`…),
  `RESERVED_SEGMENTS`/`RESERVED_QUERY_KEYS` (І19).
- 🔴 **І19 у зворотному напрямку:** `languages.add` під ексклюзивним `languages-set` відмовляє 409
  (`state`/`language_code_taken`, `conflicts` у problem+json: тип, id, адреса), якщо `lower(code)` —
  ПОТОЧНА адреса основної мови будь-якої сутності реєстру (`currentPathOwners`). Інакше розбір
  префікса вважав би `/it` мовою (навіть `draft`), і товар з адресою `it` зникав би з вітрини в момент
  додавання мови. Історичні адреси не блокують (історія не видаляється — інакше мову з таким кодом
  не додати ніколи); ціна — старе посилання `/it` після додавання мови `it` веде на сторінку мови, а
  не 301 на поточну адресу товару. Кейс — `language-code-address.test.ts`.
- 🔴 **Повнота (І16/І21)** — відкладені тригери `require_current_address`/`require_current_token`:
  сутність у кожній мові `draft`/`published` має рівно одну поточну адресу й токен на коміті.
  Переклад і його видалення адресу не змінюють (І17): адресу міняє лише створення й явна зміна.
  Запис у реєстри без замка `languages-set` відхиляє тригер `addresses_require_languages_lock`
  (SC004).

## 4. Проєкція тексту товару (І23)

- Таблиця `catalog_product_texts` (товар × мова `draft`/`published`): текст кожного поля
  `coalesce(мова, джерело)`, поточна адреса, `is_translated`, `fallback_fields text[]` — поля,
  узяті з основної мови. Ознака fallback — з ДАНИХ (у мові порожньо, у джерелі є), а не з
  порівняння текстів: переклад, буквально рівний джерелу, fallback не є. TS-двійник —
  `fallbackFieldsOf`.
- **Один будівник** очікуваного стану — `expectedRows` (`catalog-projection/expected.ts`): з нього
  беруть і `refreshProductTexts` (синхронно в транзакції кожної команди товару), і
  `buildMissingProjection` (етап `languages.fill`, лише `DO NOTHING`), і звірка
  `findProjectionMismatches`/`localeProjectionMismatches`/`reconcileProductTexts`. Три читачі однієї
  істини не розходяться між собою.
- Парність SQL-предиката `is_translated` і `fallback_fields` з доменними
  `isTranslatedForSeo`/`fallbackFieldsOf` перевіряє звірка (`parity.ts`): плоскі поля зводить CHECK у
  БД, rich-поле SQL бачить лише як `IS NULL`.
- Мова `disabled` — проєкцію знімає `dropLocaleProjection`; повернення в `published` —
  дозаповнення адрес, токенів і проєкції після звірки (машина станів — §3.5 майстра).
  `languages.setStatus` у `published` відмовляє, доки звірка не дасть 0 розбіжностей; відмова
  `language_incomplete` називає товари й етап (`['products', id, 'path'|'token'|'projection']` у
  `path` проблеми — єдине, що несуть і problem+json, і serverFn; до 20 прикладів).
- 🔴 **`languages.fill` будує проєкцію лише з адрес, закомічених ПОПЕРЕДНІМ викликом:** пакет, що
  скопіював хоч одну адресу, етап проєкції пропускає (`done: false`). Інакше паралельна команда товару
  незакоміченої адреси не бачила б, рядка мови не писала б, і fill закомітив би текст зі знімка до
  команди — застарілий назавжди (І23). З закоміченою адресою fill пише `DO NOTHING`, команда —
  `DO UPDATE`: за будь-якого порядку комітів перемагає свіжий текст. Кейс —
  `fill-projection-race.test.ts`.

## 5. Читання на вітрині

- 🔴 **П7: вітрина товару читає текст лише з проєкції** (`catalog_product_texts`): сторінка товару,
  лістинги, головна, кошик, чекаут і знімок `order_items.name`. Переклади товару напряму вітрина не
  читає — інакше fallback і «перекладено» рахувалися б у кількох місцях по-різному.
- Сутності поза проєкцією (модифікації, текстові значення властивостей) — `withFallback`
  (`simplycms/translations`): пара LEFT JOIN `t_loc`/`t_src`, текст `coalesce`, ознака fallback із
  даних.
- **Мова читання** — `resolveTextLocale` (невідома чи не `published` мова з клієнта → основна, не
  помилка) і `requirePublishedTextLocale` (оформлення замовлення: лише `published`, інакше
  відмова). Обидва дають брендований `TextLocale` (`checkedTextLocale`), тож лоадер не приймає
  неперевірений рядок.
- **Видимість** — один предикат `pageVisible()` (мова `published` ∧ товар `is_active`): лоадер
  сторінки, sitemap і резолв історичної адреси. Інакше 301 з історії неактивного товару розкрив би
  його поточну адресу.
- **Розмітка fallback (І37):** фрагмент, узятий з основної мови, має `lang` основної —
  `FallbackText` (`simplycms/ui/fallback-text`); view-моделі несуть `*_lang`/`nameLang`.
- **Фото мовою сторінки** — один читач `simplycms/translations/gallery.ts`: порядок `GALLERY_ORDER`
  (канон і для live-smoke, парність — `live-smoke-gallery-order.test.ts`), `productGallerySql`/
  `modificationGallerySql`/`mainImageSql`/`lineImageSql`; декодер `toGallery`, view
  `ProductImageViewModel` (`{ url, alt, alt_lang? }`). Семантика: файл — перевизначення мови, інакше
  спільний; alt — мови, інакше основної з `alt_lang`; `''` у рядку мови — ЯВНО декоративне (без
  fallback), `null` — перекладу немає (alt основної).
- **Ключі кешів містять локаль (І36):** `entityKey(entity, locale)`, `AGGREGATE.<x>.keyFor(locale)`,
  `createReadCache` з `variant: locale` ([`i18n.md`](./i18n.md)).

## 6. Адмінка

- Запис — лише командами агрегата (`products.saveDescription`, `products.saveTranslation`,
  `products.setPath`, …), не фабричним CRUD: колекції товару, модифікацій і значень у `admin-data`
  лише читають.
- Колекції читають назву з перекладу ОСНОВНОЇ мови — `readModel` фабрики `defineAdminResource`
  (INNER JOIN на переклад, обчислені поля `computed`, напр. `mainImage`): товар без перекладу
  основної мови в колекцію не потрапляє.
- Картка товару після власного збереження перечитує агрегат: введене ПІСЛЯ відправки лишається
  значенням користувача й зміною форми (навіть коли інший редактор той елемент видалив — конфлікт
  проявить версія агрегата, 412), елемент колекції, якого він не чіпав, бере стан БД
  (`resetAfterSave`/`rebase`, `admin/features/products/edit/product-rebase.ts`).

## 7. Тести-власники (матриця майстра §4)

`languages-invariants`, `source-translation-required`, `property-values-shape`,
`translations-hash-keys`, `product-aggregate`, `translation-race`, `url-paths`, `slug-tokens`,
`languages-add-concurrency`, `catalog-projection*` (`test-harness/pg/__tests__/`),
`domain/translations/__tests__`, `domain/slugs/__tests__`, `storefront-routes/__tests__/path-normalize`,
`lang-attrs`, `storefront/seo/__tests__/index-policy`. Як тести гонок розводять учасників без пауз —
[`test-contours.md`](./test-contours.md) §14.
