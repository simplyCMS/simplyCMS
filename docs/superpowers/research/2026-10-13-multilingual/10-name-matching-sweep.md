# Розвідка: бізнес-логіка, що зіставляє за назвою / довільним текстом людини

Знімок: `~/simplycms-accept`, коміт `cd2d18d5`. Лише читання.

**Метод і межі.** Знімок лежить за іншим абсолютним шляхом, ніж проіндексований
код-шар, тож усе доведено `Grep`/`Read`, а не графом. Проходи: усі `pgTable` у
`packages/simplycms/src/schema/schema.ts`; грепи по `ilike|like(|toLowerCase|
localeCompare|normalize`, по `.find/.some/.filter/===` із `name|title|label|city|
address`, по порівняннях `message`, по `where … name/title =`; повне читання
шляху доставки, фільтрів каталогу, правил категорій і знижок, сідів
(`scripts/showcase`, `migrations/demo`, `scripts/dev-stand`), FAQ-плагіна, тем,
CLI. Файли `__tests__`, `dist/`, `node_modules`, копії `template/` і
`packages/cli/host/` виключено. Тести/збірки не запускались: усі твердження про
поведінку — з читання коду (де це важливо, позначено «з читання»).

Позначки: **Д** — дефект (логіка залежить від тексту людини), **Р** — ризик
(вільний текст там, де має бути довідник, логіка ще не стоїть на ньому), **О** —
ок (технічний ідентифікатор / показ).

---

## 1. Зведена таблиця

| # | Місце (`файл:рядок`) | Що з чим зіставляється | Звідки текст | Наслідок | Ступінь |
|---|---|---|---|---|---|
| 1 | `domain/shipping.ts:205-223`, виклик `commerce/shipping-choice.ts:66`, `core/hooks/useShippingDirectory.ts:45` | `lower+trim+squash(deliveryCity)` === `lower+trim+squash(zone.cities[i])`, потім так само `zone.regions[i]` | місто вводить покупець (`CheckoutDeliveryForm.tsx:423-432`); списки зон вводить адмін комою (`useShippingZoneCard.ts:73-74`, `shipping-zone-form-schema.ts:4-9`) | «Kyiv»/«Киев»/«м. Київ»/опечатка → дефолтна зона → інший тариф, без помилки. Інша мова інтерфейсу ламає збіг | **Д** |
| 2 | `domain/shipping.ts:217-222` | `regions` порівнюється з МІСТОМ покупця, не з регіоном | та сама пара полів | У чекауті немає поля «регіон/область» (grep `region|oblast|country|postal` у src — порожньо), тож колонка `shipping_zones.regions` (`schema.ts:492`) працює лише як ще один список міст | **Д** |
| 3 | `schema.ts:491-492`, `migrations/0001_init.sql:438-439` + `domain/shipping.ts:212,217` | `cities`/`regions` мають `DEFAULT '{""}'`; порожнє місто нормалізується в `''` | будь-який insert зони без `cities` (сід, плагін, скрипт; форма адмінки дає `[]`) | Для самовивозу і при порожньому місті `findShippingZoneIn(zones,'')` (`shipping-choice.ts:66`: `input.deliveryCity ?? ''`) збігається з ПЕРШОЮ не-дефолтною зоною, чиї `cities` = `[""]`. Латентно: у формі адмінки `splitList` відфільтровує порожні, але схема цього не гарантує | **Д** (латентний) |
| 4 | `domain/shipping.ts:127` | якщо зона не знайдена й дефолтної зони немає, `zone = null`, а фільтр `!zone \|\| r.zone_id === zone.id` пропускає тарифи БУДЬ-ЯКОЇ зони | наслідок п.1 | Мовчки береться перший тариф способу з довільної зони (`sort_order`), а не «доставка недоступна» | **Д** (наслідок) |
| 5 | `pickup_points.zone_id` (`schema.ts:548`), адмінка `PickupPointFields.tsx:91`, `usePickupPointCard.ts:95` | Адмін обирає зону для точки видачі зі списку (FK), але ціна самовивозу її не читає: `zone_id` лише мапиться (`pickup-points.ts:56`, `shipping-directory.ts:128`) | — | Для самовивозу зона = `findShippingZoneIn(zones, deliveryCity ?? '')`. Місто, залишене у формі від вкладки «адреса», впливає на тариф самовивозу (`resolveDestination` для pickup місто не відкидає, `shipping-providers.ts:44-57`); обрана точка — ні | **Д** |
| 6 | `schema.ts:788-789` (`orders.shipping_zone_id`, `shipping_rate_id`) + `admin-server/impl/order-items/totals.ts:77-83` | колонки FK є, але ніде не пишуться (`order-create.ts:48-80` їх не ставить; grep лише `resource.ts` readonly і `order-privacy.ts`) | — | Замовлення не пам'ятає, яку зону/тариф застосовано. Перерахунок після правки позицій у адмінці знову матчить СИРЕ `orders.delivery_city` проти ПОТОЧНИХ `cities` — якщо адмін змінив список міст зони, тариф старого замовлення мовчки зміниться | **Д** |
| 7 | `catalog-ui/FilterSidebar.tsx:290-294` | `style={{ backgroundColor: option.name }}` для властивості типу `color` — НАЗВА опції стає CSS-кольором | `property_options.name` вводить адмін | Переклад назви («Червоний») ламає колір; назва = значення. Водночас `hasOptions` для `color` = false (`property-form-schema.ts:31-32`), значення кольору зберігається вільним hex-рядком у `value` (`ColorPropertyInput.tsx`, `PropertyInput.tsx:124-130`), тож гілка фільтра `color` у сайдбарі фактично мертва | **Д** (мертвий код, але закладений принцип «назва = колір») |
| 8 | `schema.ts:311,277` (`product_/modification_property_values.value text`) | вільний `value` поруч з `option_id`/`numeric_value`; `select`/`multiselect` пишуть `value=null` (`PropertyInput.tsx:73-82`), тож для них це вже довідник | адмін | Для `text` і `color` значення — вільний рядок (не перекладається, не нормалізується). Для `boolean` — рядок `'true'`/`'false'` (`PropertyInput.tsx:107-111`, `ProductCharacteristics.tsx:43-44`, `themes/default/views/product/ProductHighlights.tsx:14-15`) | **Р** |
| 9 | `catalog-filters.ts`, `filter-predicates.ts:47-65`, `FilterSidebar.tsx:174-180` | фільтри вітрини: `option_id`, `property.slug`, `numeric_value` — НЕ текст значень | — | Правильно. Побічна знахідка (не про назви): `filter-predicates.ts:59-62` для boolean-фільтра (`value === true`) повертає `false` для кожного товару (з читання), і лишився артефакт `option_id.split(',')`, хоч після Е3-13 рядок має один uuid | **О** (+ окремий баг boolean) |
| 10 | `domain/user-categories/conditions.ts:54-97`, `parse.ts:49`, `commerce/customer-stats.ts:49-52` | правила категорій покупців: `email_domain`, `utm_source`, `utm_campaign` (`=`/`contains`) і `auth_provider` порівнюються після `trim+lower` | вводить адмін у `<Input>` (`RuleConditionRow.tsx:89`) | `email_domain` / `utm_*` — ЗОВНІШНІ ідентифікатори, не назви: нормально (`contains` для домену вже обмежено піддоменом). Але `auth_provider` — закрита множина (`accounts.provider_id`), а вводиться текстом: опечатка = правило тихо не спрацьовує. `utm_*` ніхто не пише (`registration_utm` лише читається, grep порожній) — умова мертва | `email_domain`, `utm_*` — **О**; `auth_provider` — **Р** |
| 11 | `domain/discounts/built-in-conditions.ts:42-57`, `schema.ts:965-979` | умови знижок: `user_category` — по `ids`, цілі — `target_id uuid` + `target_type` enum | адмін обирає зі списку | Правильна модель | **О** |
| 12 | `commerce/customer-categories.ts:33,56-60`, `schema.ts:666-667`, `admin-server/impl/customers/card.ts:82` | `user_category_history.from/to_category_name` — знімок назви | пише код | Читається лише для показу картки (`card.ts:82`); логіка йде по `*_category_id`/`source` | **О** |
| 13 | `domain/user-categories/engine.ts:49` | `reason: \`Автоматично за правилом: ${rule.name}\`` — кириличний літерал + назва правила пишуться в `user_category_history.reason` | код | Не ключ, але мова і назва зашиті в дані; не перекладається | **Р** (мова) |
| 14 | `schema.ts:232` + `commerce/price-cart-catalog.ts:71`, `schema.ts:238`, `contracts/shipping-providers.ts:71`, `shipping-choice.ts:67-72` | `order_items.name` (`"товар - модифікація"`), `discount_data.applied[].name`, `shipping_data.methodName`, `destination.name/city/address` — знімки | код | Назад ключем НЕ читаються: лише показ (`OrderItemsTable.tsx:60`, `ShippingSnapshotLines.tsx:22`, `OrderDeliveryCard.tsx:20`, листи `mail/render/order.ts:66`). Знімок мовою на момент замовлення — норма | **О** |
| 15 | `schema.ts:73-87` `order_statuses`, `order-status-codes` | логіка йде по `code` (`ORDER_STATUS_CODE.new/cancelled`: `order-cancel.ts:43`, `customer-stats.ts:70`, `dashboard/summary.ts:26-38`, `useOrderLocked.ts:21`), `code` — `insertOnly` (`order-statuses/resource.ts:24`) | — | Зразок правильного підходу. `name` лише показ. Дрібниця: форма генерує `code` з назви (`order-statuses/form-data.ts:17-22`, регістр кирилиці дозволено) | **О** |
| 16 | `schema.ts:780`, `storefront-routes/server/checkout-input.ts:39`, `OrderCustomerCard.tsx:63` | `orders.payment_method` — `text`; на вході `z.enum(['cash'])`, порівняння з `'cash'` | код | Код, не назва; але колонка без CHECK/довідника — коли з'являться оплати, їх треба робити довідником/провайдером (Ц1–Ц4), не рядком | **О** (з увагою на майбутнє) |
| 17 | `schema.ts:547,749,867,779` (`pickup_points.city`, `user_recipients.city`, `user_addresses.city`, `orders.delivery_city`), `schema.ts:546`, `749-750` (`address`) | вільний текст міста/адреси; на цьому тексті стоїть лише п.1. Пошук/сортування по ньому — у UI (`AddressSelectorPopup.tsx:41-55`, `RecipientSelectorPopup.tsx:44-57`) | покупець / адмін | Окремо від п.1: немає довідника населених пунктів, країни, відділень; індекс `idx_pickup_points_city` (`schema.ts:557`) готує вибірку по тексту. Ніхто з цих полів не є ключем, крім п.1 | **Р** |
| 18 | `checkout-ui/CheckoutDeliveryForm.tsx:109-111`, `CheckoutRecipientForm.tsx:83-84` | `currentCity !== originalAddress.city` — чи змінив покупець збережену адресу | покупець | Лише стан UI («показати Зберегти зміни»), не бізнес-логіка | **О** |
| 19 | `packages/simplycms-plugin-faq/src/pages/FaqAdmin.tsx:27,45,103-106`, міграція `plg_faq_items.product_id uuid` без FK | адмін ВПИСУЄ uuid товару руками в текстове поле (`productId.trim()`) | адмін | Зв'язок за id, але вибір — вільним текстом: помилка в uuid = FAQ нікому не показується, перевірки немає (FK навмисно відсутній). Показ у `FaqSlot.tsx:42-46` — по `product_id` (правильно) | **Р** |
| 20 | `admin/features/banners/banner-form-schema.ts:36-41`, `BannerSlider.tsx:181-192`, `demo-seed.sql:270,285` | `buttons[].url` — довільний рядок (шлях `/catalog/<slug>`) | адмін | Посилання на розділ/товар зашите текстом slug; перейменування slug ламає банер. Це URL, а не назва, тож не мова, але вибір «куди веде» — довідник (розділ/товар/сторінка) | **Р** |
| 21 | `migrations/demo/demo-seed.sql:347` | `join public.pickup_points pp on pp.name = 'Склад у Києві'` — залишки прив'язано до точки за назвою; коментар (`:336-339`) каже, що це свідомо | сід | Перейменована точка → join порожній → залишки мовчки не вставляються. Решта сіду зв'язана по `slug`/`code` (`:68,125,140,155,208,233`, `where m.code='pickup'`, `z.is_default`), тобто саме це місце — виняток. Сід їде в пакеті (`migrations/demo/`) | **Д** (сід) |
| 22 | `migrations/demo/demo-seed.sql:275-277,290-292` | ідемпотентність банерів: `where not exists (select 1 from banners where title = '…')` при фіксованому id | сід | Після перейменування банера повторний накат намагається вставити той самий `id` → помилка PK, а не «пропустити». Правильний ключ — `on conflict (id) do nothing` | **Д** (сід, низький) |
| 23 | `core/hooks/useProductReviews.ts:77` | `err.message === t('product.review.notAuthorized')` — розрізнення «власна помилка» за ПЕРЕКЛАДЕНИМ текстом | код | Ідентифікація помилки за локалізованим рядком; ламається, якщо текст/мова зміниться між throw і catch, або будь-яка інша помилка збігається з текстом. Інші гілки (`SUBMIT_ERROR_KEY[err.message]`) — по кодах `review/*`, нормально | **Д** (низький) |
| 24 | `admin/lib/admin-error.ts:105,118`, `runtime/stale-chunk.ts:30-37`, `contracts/masked-error.ts:21-24` | регекс/префікси по тексту помилок браузера й власного маскованого повідомлення | рушій / сервер | Це не дані людини, а тексти рушіїв/своєї константи (`MASKED_ERROR_TEXT`); не перекладаються | **О** |
| 25 | `admin-server/impl/customers/find.ts:44-47`, `list-sql.ts:24-26`, `products/search-for-order.ts:62-68`, `AddressSelectorPopup.tsx` | пошук `ilike` по `email/first_name/last_name/phone`, `products.name/sku`, `modifications.name/sku` | адмін шукає | Це пошук, не зіставлення; користувач сам вирішує. Для багатомовності пошук по `products.name`/`modifications.name` треба буде розширити на переклади | **О** (з приміткою) |
| 26 | `schema.ts:122`, `section-properties/resource.ts:35` | `section_properties.options jsonb` | — | `readonly`, ніхто не пише і не читає логікою (лише наскрізний `entities/property.ts:32`) — мертва колонка, не ключ | **О** |
| 27 | `schema.ts:451,918`, `plugins/bootstrap.ts:54-94`, `plugin-sdk/server/guard.ts:20,67`, `themes/ThemeRegistry.ts`, `admin-server/impl/site-plugins/set-active.ts:32`, `site-themes/list.ts:56`, `config.themes` | `plugins.name`, `themes.name`, префікс таблиць `plg_<name>` | manifest / код | Технічні ідентифікатори (`displayName` окремо). НЕ проблема | **О** |
| 28 | `schema.ts:469-471` `shipping_methods.code/provider`, `commerce/shipping-providers.ts:35` | поведінку визначає `provider` (реєстр `SHIPPING_PROVIDERS`), не `code`/`name` (Е6а-9); `isShippingProviderId` | — | Правильно | **О** |
| 29 | `schema.ts:132-136` `price_types.code`, `user_categories.code/is_default`, `categories.ts` | дефолтна категорія/тип ціни — по `is_default`, зв'язки по id | — | Правильно | **О** |
| 30 | `scripts/showcase/*` | товар→розділ, опція→властивість, статус→`code`, дефолтна зона→`is_default`, самовивіз→`code='pickup'`, системна точка→`is_system` | сід | Зв'язано кодами/slug/прапорами, не назвами (`shipping.mts:44-63`, `orders.mts:100`, `catalog.mts:45-74`) | **О** |
| 31 | `scripts/live-smoke/*`, `scripts/pilot-pack/gate-b.mjs` | перевірки `r.name === n`, `html.includes(name)` | тест-фікстури | Тестові скрипти, не продакшн-логіка | **О** |

---

## 2. Пояснення за дефектами й ризиками та як має бути

### 2.1. Зони доставки (п.1-6) — головний кластер

**Що не так насправді.** Це не одна помилка, а три шари:
1. *Ключ — текст покупця.* Зона визначається вільним полем «Місто» проти списків тексту в зоні (п.1, 2).
2. *Дані зони мають пастки.* `DEFAULT '{""}'` (п.3) робить порожній рядок «валідним містом»; відсутність дефолтної зони перетворює «не знайдено» на «будь-який тариф» (п.4).
3. *Правильний FK вже є, але не використовується.* `pickup_points.zone_id` (п.5) вказує зону для точки видачі, а тариф самовивозу бере зону з міста; `orders.shipping_zone_id/shipping_rate_id` (п.6) існують, але порожні, тож замовлення не фіксує обрану зону.

**Як має бути.**
- *Довідник населених пунктів.* Таблиця `locations`/`settlements` (id, батьківський id для області → район → місто, код КОАТУУ/КАТОТТГ або власний `code`; назви — через переклади). Зона посилається на нього зв'язною таблицею `shipping_zone_locations(zone_id, location_id)`, а не масивами тексту.
- *Вибір, а не введення.* Покупець у чекауті обирає населений пункт зі списку/автокомпліту, у замовлення пишеться `delivery_location_id` (+ знімок назви для показу). Адмін у зоні додає пункти/області з того ж довідника (вибір дерева), не друкує слова.
- *Область як рівень дерева,* а не друга колонка тексту: зона «Київська область» = вузол довідника з нащадками; збіг — «пункт або його предок належить зоні» (замінює `regions`, п.2).
- *Самовивіз:* зона береться з `pickup_points.zone_id` обраної точки (або взагалі без зони), місто форми для нього ігнорується (п.5).
- *Явні правила відмови:* «зона не знайдена й дефолтної немає» → `shipping_unavailable`, а не тариф довільної зони (п.4); схема забороняє `""` у списках (CHECK/зв'язна таблиця прибирає п.3).
- *Замовлення* пише `shipping_zone_id` і `shipping_rate_id` при оформленні й перерахунок у адмінці (`totals.ts`) бере їх, а не матчить заново (п.6).
- Якщо власник не готовий вести довідник населених пунктів: мінімальний варіант — довідник «міста доставки» самого магазину (id, `code`), покупець обирає лише з нього, інше → «за домовленістю»/дефолтна зона явно, з позначкою в замовленні.

### 2.2. Властивості товарів (п.7, 8)
- `option.name` як CSS-колір (п.7): колір має бути атрибутом опції (`property_options.color_hex`/окрема колонка), а `name` — лише підписом, що перекладається. Альтернатива для типу `color` — або опції з hex-колонкою (тоді `hasOptions('color')=true`, фільтр працює по `option_id`), або тип лишається вільним hex і сайдбар для нього не малює опцій. Зараз гілка змішує обидва підходи.
- Вільний `value` (п.8): для `text` значення — це контент, його треба перекладати (таблиця перекладів значень або `jsonb {uk,en}`), але ключем воно бути не має — і не є (фільтри по `option_id`/`numeric_value`). Для `boolean` правильний носій — не `'true'` у тексті, а типізоване значення (колонка `boolean_value` або `numeric_value` 0/1). Для `color` — hex у виділеній колонці. Це **ризик**, що виросте з багатомовністю: `text`-значення стануть єдиним місцем властивості товару, яке неможливо перекласти без зміни моделі.

### 2.3. Правила категорій (п.10)
- `email_domain`, `utm_source`, `utm_campaign` — зовнішні ідентифікатори; текст тут і є ключем, переклад їх не торкається. Залишити, лише порівнювати точно (зараз `contains` для UTM — підрядок: дозволяє «google» ловити «google-ads»; це ознака дизайну, не мови).
- `auth_provider`: адмін має ВИБИРАТИ з переліку налаштованих провайдерів входу (`credential`, `google`, …), список бере з конфігурації Better Auth / `accounts.provider_id`; значення зберігається як код провайдера.
- UTM-умова мертва, поки реєстрація не пише `profiles.registration_utm` (пише лише читач `customer-stats.ts:49-52`). Це не про назви, але правило «utm_source» зараз завжди хибне.

### 2.4. Сід і демо (п.21, 22)
- Зв'язати залишки з точкою за її стабільним ключем: або id із таблиці-першоджерела (як у решті сіду), або за прапором `is_system=true` (як у `shipping.mts`), або за `(method.code='pickup' and is_system)`. Банери — `on conflict (id) do nothing` замість `not exists … title`.

### 2.5. FAQ-плагін і банери (п.19, 20)
- FAQ: вибір товару — пікер за каталогом (пошук по назві → зберігається `product_id`), а не вставка uuid; у плагіна лишається link-поле без FK за моделлю Medusa, тож валідацію існування треба робити у порту (`usePluginTable`/серверна дія), інакше помилка мовчки.
- Банер: `buttons[].target` має бути типізованим посиланням `{kind: 'section'|'product'|'page'|'url', id | url}`; для `kind=url` — вільний рядок (зовнішнє посилання) допустимий.

### 2.6. Рядки помилок (п.23)
- Власну помилку авторизації хук має кидати типізованим класом/кодом (`review/not-authorized`, як решта `review/*`), а не перекладеним рядком, який потім порівнюється з `t()`.

---

## 3. Що перевірено й НЕ є проблемою (щоб не шукати вдруге)
- Каталог: фільтри (`option_id`, `slug`, `numeric_value`), сторінки опцій (`property-option.ts`: `slug`), вибір модифікації (`?mod=<slug>`, `useModificationSelection.ts:37`), хлібні крихти (slug), товари на головній (id розділів).
- Ціни/знижки: типи цін за id/`is_default`, категорія покупця за id, цілі й умови знижок — uuid; `name` у знижках, групах, правилах — лише для показу й діагностики.
- Статуси замовлень — `code` + `insertOnly`.
- Імпорту товарів/розділів у ядрі немає (за списком файлів `packages/cli/src` і `scripts/`: імпортерів CSV/XLS не видно; вміст не читався повністю); showcase і demo-сід зв'язують по slug/code/прапорах, крім п.21-22.
- Теми й плагіни: нічого, що б зіставляло дані за текстом; `themes/default`, `simplycms-theme-solarstore` читають `slug`/`property_type`; `plugins/hello-world` не відкривався (демо-плагін, у грепах по `plugins/` збігів не дав).
- CLI (`packages/cli/src`): зіставлення за іменем пакетів/файлів/плагінів — технічні ідентифікатори.
- Кошик (`react-query/cart-normalize.ts`): `name`/`modificationName` у localStorage — лише показ; ціну й назву сервер рахує по `productId/modificationId` (`price-cart-catalog.ts`).

## 4. Відкриті питання для власника
1. Довідник населених пунктів: імпортований офіційний (КАТОТТГ) чи власний «міста доставки» магазину? Від цього залежить дизайн `shipping_zone_locations` і те, чи область — рівень дерева.
2. Чи потрібна взагалі зона для самовивозу (беремо `pickup_points.zone_id`) і чи лишається для нього тариф «безкоштовно» без зон (як у демо)?
3. Поведінка «зона не знайдена»: відмова чи дефолтна зона з позначкою? Зараз — дефолтна мовчки (п.1), а без дефолтної — тариф довільної зони (п.4).
4. Тип `color`: опції з hex чи вільний hex у значенні?
5. Багатомовність: назви довідників (`order_statuses`, `user_categories`, `shipping_methods/zones/rates`, `price_types`, властивості/опції, розділи, товари) — таблиці перекладів чи `jsonb` по мовах; усі ці довідники вже мають `code`/`slug`, крім `shipping_zones` і `shipping_rates` (їм ключем служить id — для логіки цього достатньо).

## 5. Дрібні побічні знахідки (не про назви)
- `filter-predicates.ts:55-62`: boolean-фільтр відсіює всі товари (з читання коду, не запускалось).
- `orders.shipping_zone_id/shipping_rate_id` не пишуться (п.6) — окремий борг, навіть без ребрендингу довідника міст.
