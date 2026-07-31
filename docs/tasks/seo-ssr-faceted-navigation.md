# Task: SEO / SSR storefront + Faceted Navigation (DB-driven SEO domain)

> **Паралельний продуктовий трек** роадмапу платформи ([`platform-roadmap.md`](./platform-roadmap.md)). Після Фази 0 фільтри/SEO живуть у канонічних сторінках `@simplycms/storefront-routes` (spec §11) — імплементувати вже там.

> **Статус:** окрема продуктова задача. Повністю замінює та переписує колишню `migration-phase6-seo-domain-expansion.md` (видалена) і виносить «Phase 6 — DB-driven SEO» із загального міграційного документа `simplycms_tanstack_start_migration_task.md`.
>
> **Execution note:** це кодова задача поверх вже-завершеної TanStack Start архітектури (Phases 0–7 міграції закриті; проєкт повністю Start-native, див. `CLAUDE.md`). Тут не повертаємось до framework-міграції — будуємо SEO/SSR-контур і faceted navigation поверх наявної архітектури.
>
> **Ключова відмінність від старого Phase 6:** стара постановка покривала лише DB-поля + `seoResolver` + admin-панелі. Ця задача додає **faceted navigation** (фільтри каталогу → URL → SSR → індексованість) як рівноправний контур, бо саме він є найбільшою SEO-дірою storefront.

---

## 1. Контекст і поточний стан (факти з кодової бази)

Storefront працює в SSR на TanStack Start. SEO-метадані наразі генеруються вузько і з бізнес-полів, фільтри каталогу — суто клієнтські. Зафіксований стан:

### 1.1 Фільтрація каталогу — клієнтська, без URL
- `packages/simplycms/core/src/pages/CatalogSection.tsx:54` — стан фільтрів це суто клієнтський `useState`:
  ```ts
  const [filters, setFilters] = useState<Record<string, FilterValue>>({});
  // FilterValue = boolean | number | string[] | undefined
  ```
- **Немає** `validateSearch` / `useSearch` / синхронізації з URL — фільтри не відображаються в адресі, не шеряться, не SSR-яться, не індексуються.
- Ключі фільтрів — **slug властивості** (`color`, `brand`); значення — **масиви UUID опцій** (`property_options.id`, тобто GUID-и). Спец-ключі: `priceMin`/`priceMax` (number), `inStockOnly` (boolean), `${propertySlug}Min`/`${propertySlug}Max` (range).
- `packages/simplycms/core/src/components/catalog/FilterSidebar.tsx` — тягне фільтровані властивості через `section_property_assignments → section_properties WHERE is_filterable = true`, далі `property_options` для типів `select`/`multiselect`/`color`.
- Фактична фільтрація — клієнтський `useMemo` (`CatalogSection.tsx:257–344`) після клієнтського re-fetch товарів через React Query.

### 1.2 Single-facet лендинги вже існують (глобальні, не секційні)
- Роут `src/routes/_storefront/properties/$propertySlug/$optionSlug.tsx` + серверна функція `getPropertyOption` (`src/server/properties.ts:44-90`).
- Товари фільтруються **на сервері** через PostgREST join: `products → product_modifications!inner → modification_property_values!inner.option_id = option.id`, `is_active = true`.
- SEO цих сторінок бідне: `head` дає лише `title`; **немає** `description`, `canonical`, JSON-LD — попри те що `property_options` має колонки `meta_title`/`meta_description` (не споживаються).

### 1.3 SEO-інфраструктура — мінімальна
- **`seoResolver` не існує** взагалі.
- Тільки сторінка товару (`src/routes/_storefront/catalog/$sectionSlug/$productSlug.tsx`) має повний набір (canonical, og, JSON-LD Product, 301 на канонічну секцію). Решта роутів (`catalog/index`, `$sectionSlug/index`, `properties/*`) — **без canonical**, часто без `description`.
- `meta_title`/`meta_description` на `products` і `sections` **не споживаються** роутами (хардкод-фолбеки).
- `src/seo/sitemap.ts` (`buildSitemapXml`): `/`, `/catalog`, `/properties`, `/catalog/$sectionSlug`, `/catalog/$sectionSlug/$productSlug`. **Не включає** жодних property/option лендингів і жодних filter-URL.
- `src/seo/robots.txt` (`buildRobotsTxt`): Allow `/`, Disallow `/admin/`, `/api/`, `/auth/callback`. **Не керує** параметрами фільтрів/сортування/пагінації.
- `simplycms.config.ts` `seo`: лише `siteName`, `defaultTitle`, `titleTemplate`. **Немає** `defaultDescription`, `baseUrl`, `ogImage` — потрібно для fallback-ланцюжка resolver-а.

### 1.4 Модель даних (з `supabase/types.ts`)
- `sections`: `id, slug, name, description, parent_id, image_url, meta_title, meta_description, ...` — є `meta_*`; **немає** `is_filterable/has_page/property_type`.
- `section_properties`: `id, slug, name, property_type, is_filterable, has_page, is_required, section_id, options(Json), sort_order` — є `is_filterable/has_page/property_type/slug`; **немає** `meta_*`. `property_type` ∈ `text|number|select|multiselect|range|color|boolean`.
- `section_property_assignments`: `section_id, property_id, applies_to, sort_order` — M2M секція↔властивість.
- `property_options`: `id, slug, name, property_id, sort_order, description, image_url, meta_title, meta_description` — є `slug, meta_*`.
- Товар↔опція: **дві** таблиці — `product_property_values(product_id, property_id, option_id, value, numeric_value)` та `modification_property_values(modification_id, property_id, option_id, ...)`. Обидві треба врахувати при серверній фільтрації.

---

## 2. Дослідницька база (чому саме так)

Faceted-navigation SEO — вирішена індустрією задача з усталеними патернами. Зведення (повні джерела — §11).

### 2.1 Офіційні правила Google (Crawling December 2024)
- Індексувати filter-URL варто **лише за наявності самостійного пошукового попиту** і відмінного від базової категорії контенту. Утиліті-фільтри (sort, price, наявність, view, пагінація) — **не індексувати**; контент-визначальні (категорія, бренд, тип) — можна.
- Для НЕ-індексованих фільтрів **первинний інструмент — `robots.txt disallow`** (бо `noindex` все одно витрачає crawl budget). `rel=canonical` на базу — вторинний, повільніший hint. URL-фрагменти (`#`) Google не кравлить.
- Path-фільтри: **сталий порядок сегментів, без дублів**; порожні/безглузді комбінації → **404**. Параметри — стандартний `&`.
- Faceted navigation — «найпоширеніше джерело overcrawl»: шкодить і навантаженням сервера, і сповільненням індексації нового контенту.

### 2.2 Як це зроблено в інших платформах
| Платформа | URL фільтра | Слаги чи ID | Single-facet | Multi-facet | Canonical/robots |
|---|---|---|---|---|---|
| **Shopify** | `?filter.p.vendor=nike`; tag-path `/collections/x/red` | слаги (variant-опції з квіт.2026 — GID, спільнота критикує) | без вбудованого розрізнення | combinatorial → noindex/robots | `canonical_url` зрізає query → база |
| **1C-Bitrix** | `/section/filter/{CODE}-is-{XML_ID}/apply/` (ЧПУ-path) | property=CODE-слаг, value=XML_ID (з 1С — UUID, погано) | індексують single-facet з кастом-мета (self-canonical) | **noindex,nofollow + canonical→секція** | дефолт усе `index` (баг); SEO-модулі дають правила |
| **OpenCart** | core `?filter=ID`; модулі `/shoes/color-red/` | core = числові ID; платні модулі = слаги | лендинги лише через модулі | незареєстровані → noindex/AJAX без URL | per-combo canonical у модулях |
| **WooCommerce** | архів `/color/red/`; layered-nav `?filter_color=red` | слаги (`pa_` лише внутрішньо) | архів атрибута індексований (Yoast) | combos **не окремі сторінки**; Yoast → noindex/nofollow + canonical→база | архіви в sitemap, фільтри ні |

### 2.3 Консенсус-патерн (SEJ / Ahrefs / Aleyda Solis / Oncrawl / Sitebulb)
1. **Single-facet із попитом (особливо категорія + бренд/тип)** → окремі SSR-лендинги на **чистих слаг-path**, indexable, **self-canonical**, унікальні title/H1/description, у sitemap, з внутрішніми лінками.
2. **Multi-facet / довільні комбінації + утиліті-фільтри** → **query-параметри**, **`noindex,follow`** + **canonical→база**, або robots.txt disallow. Не плодити ЧПУ.
3. **Критерії індексації (Aleyda Solis):** попит + достатньо товарів (не thin) + унікальний контент/мета.
4. **ID/GUID в URL — антипатерн** (нема keyword-сигналу, ламається при зміні даних). Завжди стабільні **слаги**.
5. Глибина indexable-path — **1–2 фасети** максимум. Пагінація >1, sort, view → `noindex,follow` / клієнт / robots-disallow.

---

## 3. Цілі та межі (scope)

**У scope:**
- Перенести фільтрацію каталогу з клієнтського стану в **URL + серверний loader** (слаги, не GUID).
- Запровадити **політику індексованості**: single-facet → indexable clean-URL SSR-лендинг; multi-facet/утиліті → query-параметри + `noindex,follow` + canonical→секція.
- Завершити **DB-driven SEO-домен** (поля + `seoResolver`) для products/sections/properties/property_options/filter-landings.
- Привести **canonical/robots/sitemap/JSON-LD** у відповідність до §2.
- Додати **розділ адмінки** для керування SEO-полями та faceted-лендингами.

**Поза scope (окремі задачі / дослідження):**
- Production transport для `sitemap.xml`/`robots.txt` — окрема задача `production-seo-routes-tanstack-start.md` (тут лише **розширюємо склад** sitemap/robots, не чіпаємо транспорт).
- Механізм «правил» адмін-конфіг → автогенерація лендингу/URL — див. §9 (потребує додаткового дослідження).

---

## 4. Архітектурні рішення (прийняті за замовчуванням)

### 4.1 URL-схема
- **Multi-facet та утиліті (основний робочий стан фільтра секції):**
  `/catalog/$sectionSlug?brand=nike&color=red&priceMin=100` — значення **слаги опцій** (не GUID), стандартний `&`. SSR-список (працює без JS, шериться). `robots: noindex, follow`, `canonical → /catalog/$sectionSlug`. Порожня комбінація → 404.
- **Single-facet indexable лендинг (секція × одна властивість-опція):** clean slug-path, SSR, **self-canonical**, унікальні title/H1/description, у sitemap. **Точна форма path — відкрите рішення (§8, бо колізує з наявним `/catalog/$sectionSlug/$productSlug`).** Рекомендований дефолт — зарезервований сегмент, напр. `/catalog/$sectionSlug/filter/$propertySlug/$optionSlug` (Bitrix-style, без колізій).
- **Глобальні `/properties/$propertySlug/$optionSlug`** залишаються як taxonomy-хаби (крос-секційні), з canonical-дисципліною, щоб не конкурували з секційними лендингами.

### 4.2 Політика індексованості (за замовчуванням)
| Тип сторінки | robots | canonical |
|---|---|---|
| Секція `/catalog/$sectionSlug` | index, follow | self |
| Товар `/catalog/$sectionSlug/$productSlug` | index, follow | self (вже є) |
| Single-facet лендинг (секція×опція, `is_filterable` + достатньо товарів) | index, follow | self |
| Multi-facet / query-параметри | noindex, follow | → секція |
| Сортування / view / пагінація >1 | noindex, follow | → стор.1 / база |
| Порожня filter-комбінація | — | HTTP 404 |

Поріг «достатньо товарів» (anti-thin) — конфігурований, дефолт ≥ N (узгодити, напр. 3). Лендинг генерується/індексується лише для властивостей з `is_filterable = true` (опційно `has_page`).

### 4.3 Рендеринг
- Уся фільтрація — **серверна** (loader/`createServerFn`), як уже зроблено в `getPropertyOption`. Клієнтський `useMemo`-фільтр прибрати; UI лише змінює URL-search, дані приходять з loader-а.
- Уся SEO-логіка — через `seoResolver` (чиста функція в `@simplycms/core`); route `head` лише передає її результат.

---

## 5. Робочі блоки (вимоги)

### Блок A — Розширення SEO-домену в БД
- [ ] Додати SEO-поля в `products`: `seo_h1, canonical_url, meta_keywords|seo_tags, og_title, og_description, og_image, twitter_title, twitter_description, twitter_image, robots, schema_json (jsonb)`.
- [ ] Аналогічні (без `schema_json`) у `sections`.
- [ ] У `section_properties` додати `meta_title, meta_description, seo_h1, canonical_url, og_title, og_description, robots` (зараз SEO-полів немає).
- [ ] У `property_options` додати `seo_h1, canonical_url, meta_keywords|seo_tags, og_description, twitter_description, robots` (вже є `meta_title/meta_description`).
- [ ] Supabase migration + `pnpm db:generate-types`.
- [ ] `schema_json` — **JSONB**, не TEXT.

### Блок B — `seoResolver`
- [ ] `packages/simplycms/core/src/lib/seoResolver.ts` — чиста функція `(entity, defaults) → SEOResult`; **без** імпортів TanStack/Next.
- [ ] Fallback-ланцюжок (приклад для product): `title`: meta_title→name→site_title; `description`: meta_description→short_description→description→site_description; `og:image`: og_image→images[0]→site_og_image; `robots`: robots→`index, follow`; `twitter:card`: `summary_large_image`; `canonical`: canonical_url→computed-URL.
- [ ] Підтримати entity-типи: `product | section | property | property_option | filter_landing`.
- [ ] JSON-LD: Product (з offers) для товару; CollectionPage для секції/лендингів; override через `schema_json`.
- [ ] Розширити `simplycms.config.ts.seo`: додати `defaultDescription`, `baseUrl`, `defaultOgImage` (потрібні як корінь fallback).

### Блок C — Faceted filtering → URL + SSR (ядро)
- [ ] Додати `validateSearch` (Zod) до `/catalog/$sectionSlug` — схема фільтрів **на слагах**: мультиселект-властивості як `?<propertySlug>=<optionSlug>[,<optionSlug>]`, `priceMin/priceMax`, `inStockOnly`. Сталий порядок ключів.
- [ ] Серверна функція `getFilteredSectionProducts({ sectionId, filters })` — фільтрує через `product_property_values` **та** `modification_property_values` (option_id), ціну, наявність. Маппінг **slug↔option_id** на сервері (фронт ніколи не оперує GUID у URL).
- [ ] Перевести `CatalogSection.tsx` на дані з loader-а: прибрати клієнтський `useMemo`-фільтр і `useState`-стан як джерело істини; UI оновлює URL-search (`useNavigate`), loader повертає відфільтровані товари. `FilterSidebar` читає активні фільтри з search-params.
- [ ] Multi-facet / будь-який query-стан фільтра: `head` → `robots: noindex, follow` + `canonical → /catalog/$sectionSlug`.
- [ ] Порожня/безглузда комбінація → `notFound()` (404), не редірект на загальну.

### Блок D — Single-facet indexable лендинги (секція × опція)
- [ ] Роут single-facet лендингу за обраною формою (§8). SSR через `getFilteredSectionProducts` з одним фасетом.
- [ ] `head` через `seoResolver(entity: filter_landing)`: self-canonical, унікальні title/H1/description (з SEO-полів властивості/опції або шаблону), JSON-LD CollectionPage.
- [ ] Генерувати/індексувати лендинг лише коли `section_properties.is_filterable = true` і кількість товарів ≥ порогу (anti-thin).
- [ ] Догенерувати SEO на наявних глобальних `/properties/$propertySlug` та `/properties/$propertySlug/$optionSlug` (canonical + description + JSON-LD через resolver).

### Блок E — Crawl-менеджмент (sitemap / robots / canonical)
- [ ] `src/seo/sitemap.ts`: додати в sitemap **indexable single-facet лендинги** (секція×опція за `is_filterable` + поріг) і property/option-сторінки за `has_page`. **Не включати** multi-facet/query-URL.
- [ ] `src/seo/robots.txt`: Disallow параметрів утиліті-фільтрів/сортування/пагінації (узгодити перелік, напр. `*?*sort=`, `*?*page=`, `*?*view=`, цінові діапазони), зберігши доступ до indexable-лендингів.
- [ ] Додати відсутні `canonical`/`robots` на роути `catalog/index`, `catalog/$sectionSlug/index`, `properties/*` через resolver.

### Блок F — Адмінка: керування SEO та faceted-лендингами
- [ ] SEO collapse-панель (shadcn `Collapsible`/`Accordion`) у формах: продукт, секція, **властивість** (нова), опція. Поля: meta_title, meta_description, seo_h1, canonical_url, og_*, robots, (schema_json для продукту). SERP-preview + показ fallback-значень поки поле порожнє.
- [ ] Керування фільтр-лендингами: для властивості секції — перемикач «генерувати indexable-лендинги для опцій» (мапиться на `is_filterable`/`has_page`), показ цільового URL кожної опції (computed) і статусу index/noindex/thin.
- [ ] **Розділ «SEO / Faceted landings»** в адмінці (огляд): список згенерованих лендингів секція×опція з колонками URL / статус індексації / кількість товарів / редагування SEO. Це MVP; повноцінний «конструктор правил» — §9.

### Блок G — Внутрішня перелінковка
- [ ] Лінкувати indexable-лендинги звичайними HTML-`<a>` (хаб «фільтри/бренди» на сторінці секції), щоб вони не лишались orphan за JS-фільтром.
- [ ] Лінки на noindex/canonical-варіанти не «змішувати» — посилатися на canonical-URL.

---

## 6. Антипатерни (уникати)
- ❌ **GUID/ID опцій у URL.** Лише стабільні слаги; маппінг slug↔id на сервері.
- ❌ Клієнтська-only фільтрація як джерело істини (поточний `useMemo`) — фільтр має бути в URL+SSR.
- ❌ Хардкод SEO-тегів у route components — усе через `seoResolver`.
- ❌ Порожнє SEO-поле = відсутній тег: завжди fallback на бізнес-поля → site defaults.
- ❌ Індексувати multi-facet/утиліті-комбінації або плодити для них ЧПУ.
- ❌ `schema_json` як TEXT (має бути JSONB).
- ❌ Resolver, прив'язаний до фреймворка (імпорти TanStack/Next) — чиста функція в `@simplycms/core`.
- ❌ Чіпати транспорт sitemap/robots (це окрема задача) — тут лише склад/контент.

---

## 7. Clarify — відкриті рішення перед імплементацією
- [ ] **DB-схема SEO:** поля прямо в таблицях (рекоменд., простіше) vs окрема `seo_metadata(entity_type, entity_id, …)`.
- [ ] **Поріг anti-thin** для індексації single-facet лендингу (дефолт ≥3 товари — підтвердити).
- [ ] **Перелік параметрів** для robots-disallow (sort/page/view/price — фіксований список).
- [ ] **Маркер індексованості лендингу:** використовувати наявний `is_filterable`, чи окреме `has_page`/нове поле на властивості/опції?

## 8. Clarify — URL-форма single-facet лендингу (потребує рішення)
Колізія: наявний `/catalog/$sectionSlug/$productSlug` робить `/catalog/shoes/nike` неоднозначним (товар чи лендинг бренду?). Варіанти:
- **A (рекоменд.):** зарезервований сегмент — `/catalog/$sectionSlug/filter/$propertySlug/$optionSlug` (Bitrix-style, без колізій, явно SEO).
- **B:** компактний — `/catalog/$sectionSlug/$propertySlug-$optionSlug` (коротший, але парсинг і ризик колізій зі слагами товарів).
- **C:** залишити лише глобальні `/properties/$propertySlug/$optionSlug` (без секційного контексту — слабший SEO для «категорія+бренд»).
Дослідження (§2.3) схиляє до секційного «категорія+бренд» → варіант A.

---

## 9. Потребує додаткового дослідження (Claude research section)

> Цей механізм **не досліджувався** і свідомо винесений в окрему research-секцію. Не імплементувати наосліп — спершу провести дослідження (deep-research + аналіз Bitrix SEO-rules / OpenCart SEO-filter-modules / Yoast) і узгодити з власником.

**Запит власника:** хочемо розділ адмінки, де можна задати правило виду «обрано отаку властивість + отаку + отаку → дає **таку цільову сторінку** з **таким цільовим URL**». Тобто керований **конструктор фільтр-лендингів / SEO-правил**, а не лише per-entity SEO-поля з Блоку F.

**Що треба дослідити й специфікувати окремо:**
- Модель **«SEO-правила для фільтра»** (аналог Bitrix `sotbit.seometa`/Aspro «Умний SEO», OpenCart OCFilter SEO-landings): сутність `filter_seo_rule` з умовою (набір property+option), шаблонами `title/H1/description/canonical` зі змінними (`{section}`, `{property}`, `{value}`, `{city}`…), прапором індексованості, пріоритетом.
- **Скільки фасетів** дозволяти в правилі (1 — безпечно для SEO; 2 — лише за наявним попитом; ≥3 — як правило ні).
- **Цільовий URL правила:** ручний slug vs автогенерований; стабільність і 301 при зміні.
- **Генерація vs match:** правила як whitelist (тільки ці комбінації indexable) — узгодити з політикою §4.2.
- **Sitemap-інтеграція** згенерованих за правилами URL; anti-thin перевірка supply на момент генерації.
- **Адмін-UX:** конструктор умови (property/value pickers), live-preview цільового URL і SERP-сніпета, список згенерованих сторінок зі статусом.
- **Антипатерн:** не дати контент-менеджеру наплодити тисячі thin/duplicate indexable-URL — обов'язкові guard-и (попит/supply/унікальність, ліміт фасетів).

Результат цього дослідження → **окрема задача** `docs/tasks/filter-seo-rules-builder.md` (поза межами поточної). Блок F покриває MVP-керування (per-option toggle + огляд лендингів); конструктор правил — наступний крок.

---

## 10. MCP / інструменти
- **supabase** — міграція SEO-полів + генерація типів; перевірка структур таблиць/join-ів для серверної фільтрації.
- **shadcn** — `Collapsible`/`Accordion`/`Table` для SEO-панелей і огляду лендингів.
- **context7** — schema.org Product/CollectionPage; TanStack Router `validateSearch`/search-params API.
- **deep-research** — для §9 (механізм SEO-правил).

## 11. Definition of Done
- [ ] SEO-поля додані в `products/sections/section_properties/property_options`; типи перегенеровані.
- [ ] `seoResolver` створено в `@simplycms/core/lib/` з повним fallback-ланцюжком і JSON-LD; `simplycms.config.ts.seo` розширено (`defaultDescription/baseUrl/defaultOgImage`).
- [ ] Фільтри секції живуть в URL (слаги) і застосовуються **на сервері**; клієнтський `useMemo`-фільтр прибрано.
- [ ] Multi-facet/query-стан: `noindex,follow` + canonical→секція; порожня комбінація → 404.
- [ ] Single-facet лендинг (за обраною формою §8): SSR, self-canonical, унікальні title/H1/description, JSON-LD; генерується лише за `is_filterable` + поріг.
- [ ] Усі storefront-роути (catalog/section/product/properties/options/landings) мають коректні title/description/canonical/og/robots/JSON-LD через resolver.
- [ ] sitemap включає indexable-лендинги і property/option-сторінки; robots disallow утиліті-параметрів; multi-facet не в sitemap.
- [ ] Адмінка: SEO-панелі (product/section/property/option) + per-option toggle лендингів + огляд згенерованих лендингів (Блок F).
- [ ] §9 оформлено як окрему research-задачу (не імплементовано тут).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` проходять; View Source ключових сторінок показує повний SEO-набір.

## 12. Джерела дослідження
- Google: [Crawling December 2024 — faceted nav](https://developers.google.com/search/blog/2024/12/crawling-december-faceted-nav), [Managing crawling of faceted navigation URLs](https://developers.google.com/crawling/docs/faceted-navigation)
- Shopify: [Storefront filtering](https://shopify.dev/docs/storefronts/themes/navigation-search/filtering/storefront-filtering), [canonical_url](https://shopify.dev/docs/api/liquid/objects/canonical_url), [changelog — stable filter identifiers](https://changelog.shopify.com/posts/storefront-filter-urls-now-use-stable-identifiers-instead-of-text-values)
- Bitrix: [Умный фільтр](https://dev.1c-bitrix.ru/user_help/components/content/catalog/smart_filter.php), [Sotbit — noindex фільтра](https://www.sotbit.ru/docs/sotbit.seometa/lesson/noindex-nofollow-filters-page/), [Aspro «Умный SEO»](https://aspro.ru/docs/course/course46/chapter02736/)
- OpenCart: [SEO keywords](https://docs.opencart.com/administration/seo/), [OCFilter](https://ocfilter.com/en)
- WooCommerce: [attribute archives](https://woocommerce.com/document/display-product-attribute-archive-links/), [Yoast — layered nav](https://yoast.com/video/ask-yoast-layered-navigation-links/)
- Консенсус: [Search Engine Journal](https://www.searchenginejournal.com/technical-seo/faceted-navigation/), [Ahrefs](https://ahrefs.com/blog/faceted-navigation/), [Aleyda Solis](https://www.aleydasolis.com/en/search-engine-optimization/ecommerce-seo-issues-how-to-fix/), [Oncrawl](https://www.oncrawl.com/technical-seo/managing-faceted-navigation-scale/), [Sitebulb](https://sitebulb.com/resources/guides/guide-to-faceted-navigation-for-seo/)

## 13. Пов'язана документація
- `docs/tasks/simplycms_tanstack_start_migration_task.md` — загальний міграційний документ (Phase 6 винесено сюди).
- `docs/tasks/production-seo-routes-tanstack-start.md` — транспорт sitemap.xml/robots.txt (суміжна задача).
- `docs/tasks/migration-phase3-storefront-ssr-routes.md` — базова SSR-модель storefront routes.
- `.github/instructions/data-access.instructions.md` — патерни data access.
- Код: `packages/simplycms/core/src/pages/CatalogSection.tsx`, `.../components/catalog/FilterSidebar.tsx`, `src/server/properties.ts`, `src/seo/sitemap.ts`, `src/seo/robots.ts`, `simplycms.config.ts`.
