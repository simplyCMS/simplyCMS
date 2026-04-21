# Task: Phase 6 — Розширення SEO-домену (DB schema, admin UI, resolver)

> Execution note: ця фаза не є стартовою. Її потрібно запускати лише після робочих SSR storefront routes, admin UI і стабілізованих providers/theme flows з Phase 3-5.
> Це кодова фаза. Не використовувати її для повернення до framework migration; тут уже розширюється SEO-домен поверх TanStack Start архітектури.
> Clarify-пункти з позначкою «Прийняте рішення» або з явно рекомендованим варіантом вважати дефолтними.

## Контекст

Після Phase 5 весь проєкт працює на TanStack Start. SEO metadata для storefront сторінок генерується з бізнес-полів (product.name → title, product.description → description, product.images → og:image). Але SEO-поля в БД обмежені:

### Поточний стан SEO-полів в БД

| Таблиця | Наявні поля | Чого не вистачає |
|---------|-------------|------------------|
| `products` | `meta_title`, `meta_description` | seo_h1, canonical_url, meta_keywords або seo_tags, og_title, og_description, og_image, twitter_title, twitter_description, twitter_image, robots, schema_json |
| `sections` | `meta_title`, `meta_description` | seo_h1, canonical_url, meta_keywords або seo_tags, og_title, og_description, og_image, twitter_title, twitter_description, twitter_image, robots |
| `properties` | обмежений або відсутній SEO-контур | seo_h1, canonical_url, meta_keywords або seo_tags, og_title, og_description, robots |
| `property_options` | `meta_title`, `meta_description` | seo_h1, canonical_url, meta_keywords або seo_tags, og_description, twitter_description |

### Бажаний стан

Повноцінне SEO-управління з адмінки — можливість задавати title, description, OG-теги, canonical URL, robots, JSON-LD для кожної сторінки. З fallback-ланцюжком: SEO-поля → бізнес-поля → site defaults.

У цій фазі **site defaults стандартизуються через `simplycms.config.ts`**. Окрема `site_settings` таблиця не вводиться в межах цієї міграції.

Ця фаза **не є повністю незалежною** від Phases 0-5. DB-міграцію можна підготувати окремо, але повноцінне завершення фази залежить щонайменше від:

- SSR storefront routes з Phase 3;
- admin routes і форми редагування з Phase 4;
- стабілізованого theme/provider/request lifecycle з Phase 5.

## Вимоги

### Database schema expansion

- [ ] Додати SEO-поля до таблиці `products`:
  - `seo_h1` (text, nullable) — заголовок H1 на сторінці (якщо відрізняється від name)
  - `canonical_url` (text, nullable) — канонічний URL
  - `meta_keywords` або `seo_tags` (text або text[], nullable) — ключові слова / SEO теги, якщо вирішено підтримувати
  - `og_title` (text, nullable) — Open Graph title (fallback на meta_title → name)
  - `og_description` (text, nullable) — Open Graph description (fallback на meta_description → description)
  - `og_image` (text, nullable) — Open Graph image URL (fallback на перше зображення)
  - `twitter_title` (text, nullable) — fallback на og_title → meta_title → name
  - `twitter_description` (text, nullable) — fallback на og_description → meta_description → description
  - `twitter_image` (text, nullable) — fallback на og_image → перше зображення
  - `robots` (text, nullable) — robots meta (index/noindex, follow/nofollow)
  - `schema_json` (jsonb, nullable) — custom JSON-LD override (якщо потрібна ручна корекція)
- [ ] Додати аналогічні SEO-поля до таблиці `sections` (без schema_json)
- [ ] Додати SEO-поля до таблиці `properties`:
  - `seo_h1`
  - `canonical_url`
  - `meta_keywords` або `seo_tags`
  - `og_title`
  - `og_description`
  - `robots`
- [ ] Додати SEO-поля до таблиці `property_options`:
  - `seo_h1`, `canonical_url`, `meta_keywords` або `seo_tags`, `og_description`, `twitter_description`
- [ ] Створити Supabase migration для нових полів
- [ ] Згенерувати оновлені TypeScript типи: `pnpm db:generate-types`

### SEO resolver layer

- [ ] Створити `seoResolver` utility в `@simplycms/core`:
  - Приймає entity (product/section/property/property_option) і site defaults
  - Повертає повний SEO обʼєкт з fallback-ланцюжком:
    1. Явні SEO-поля (meta_title, og_title, etc.)
    2. Бізнес-поля (name, description, images)
    3. Site defaults (з CMS конфігурації)
  - Повертає обʼєкт придатний для прямого використання в route `head`
  - Повертає `canonical`, `h1`, `keywords/tags`, `og:*`, `twitter:*`, `robots`, `JSON-LD`
- [ ] seoResolver має генерувати JSON-LD:
  - Для products: schema.org Product з offers
  - Для sections: schema.org CollectionPage
  - Для properties / property options: узгоджений CollectionPage або taxonomy-like schema, якщо він реально потрібен для індексації
  - Можливість override через `schema_json` поле

### Admin UI для SEO

- [ ] Додати SEO-секцію (collapse panel) до форми редагування продукту:
  - Поля: meta_title, meta_description, seo_h1, canonical_url, og_title, og_description, og_image, robots, schema_json
  - Показувати preview як виглядатиме в Google Search (SERP preview)
  - Показувати автоматичні значення (fallback) поки поле порожнє
- [ ] Додати аналогічну SEO-секцію до форми секції
- [ ] Додати SEO-секцію до форми property
- [ ] Додати SEO-поля до форми property option (менший набір)

### Оновлення storefront routes

- [ ] Оновити route loaders щоб серверні функції повертали SEO-поля для products, sections, properties і property options
- [ ] Оновити route `head` property щоб використовувати `seoResolver()` замість manual mapping
- [ ] JSON-LD в head має використовувати resolver (з можливістю override через schema_json)

## Clarify (питання перед імплементацією)

- [ ] Чи потрібна окрема SEO-таблиця замість додавання полів в існуючі?
  - Чому це важливо: окрема таблиця `seo_metadata (entity_type, entity_id, ...)` — більш normalized, але складніший JOIN
  - Варіант A: Поля напряму в products/sections/properties/property_options (рекомендовано — простіше, менше запитів)
  - Варіант B: Окрема `seo_metadata` таблиця з polymorphic relation
  - Вплив: DB schema, запити, міграції

- [ ] Джерело site defaults для SEO
  - Чому це важливо: seoResolver потребує fallback значень
  - Прийняте рішення: `simplycms.config.ts` є єдиним source of truth для site title, site description і default og:image у межах цієї міграції
  - Вплив: однозначний fallback chain і відсутність додаткового DB-контуру

- [ ] Який формат SERP preview в адмінці?
  - Чому це важливо: Google SERP preview допомагає контент-менеджерам оптимізувати title/description
  - Варіант A: Мінімальний — показати title (max 60 chars), description (max 160 chars), URL
  - Варіант B: Повний Google-style preview з favicon і breadcrumbs
  - Вплив: обсяг UI роботи

## Рекомендовані патерни

### Fallback chain в seoResolver

Resolver приймає raw entity data і повертає normalізований SEO обʼєкт. Кожне поле має fallback chain. Наприклад для product:
- `title`: meta_title → name → site_title
- `description`: meta_description → short_description → description → site_description
- `og:title`: og_title → meta_title → name
- `og:image`: og_image → images[0] → site_og_image
- `robots`: robots → "index, follow" (default)
- `twitter:card`: "summary_large_image" (default)
- `twitter:title`: twitter_title → og_title → meta_title → name
- `twitter:description`: twitter_description → og_description → meta_description → short_description
- `twitter:image`: twitter_image → og_image → images[0] → site_og_image

- Де створювати: `packages/simplycms/core/src/lib/seoResolver.ts`

### SEO collapse panel в admin

Використати shadcn/ui `Collapsible` або `Accordion` для SEO-секції в формах. SEO-поля не відображаються за замовчуванням (collapsed), щоб не перевантажувати форму. Кнопка "SEO налаштування" розгортає секцію.

- Де додавати: `packages/simplycms/admin/src/pages/ProductEdit.tsx` (або відповідний файл форми)

### JSON-LD через seoResolver

Resolver генерує стандартний JSON-LD обʼєкт на основі entity type. Якщо `schema_json` поле заповнене — воно повністю перезаписує автогенерацію (escape hatch для нестандартних випадків).

## Антипатерни (уникати)

### ❌ Хардкодити SEO-значення в route components
Вся SEO-логіка має проходити через resolver. Route `head` property лише передає resolver result — не конструює meta теги вручну.

### ❌ Додавати SEO-поля без fallback
Порожнє SEO-поле не означає відсутній тег. Завжди fallback на бізнес-поля. Сторінка без жодного SEO-поля все одно має мати title і description з name/description.

### ❌ Зберігати JSON-LD як рядок
`schema_json` має бути JSONB колонкою, не TEXT. Це дозволяє валідацію на рівні БД і запити по вмісту.

### ❌ Робити SEO resolver framework-specific
Resolver — чиста функція `(entity, defaults) → SEOResult`. Жодних імпортів з TanStack Start або Next.js. Він живе в `@simplycms/core`.

## Архітектурні рішення

- **В який пакет додавати код:**
  - DB migration → `supabase/migrations/`
  - seoResolver → `@simplycms/core/lib/`
  - Admin SEO UI → `@simplycms/admin/components/`
  - Route head updates → `src/routes/`
- **Rendering стратегія:** SSR (seoResolver виконується в route loader/head на сервері)
- **Залежності:** жодних нових

## MCP Servers (за потреби)

- **supabase** — для створення DB migration (add columns)
- **supabase** — для генерації оновлених TypeScript types після migration
- **shadcn** — для Collapsible/Accordion component для SEO panel в admin
- **context7** — для перевірки schema.org Product/CollectionPage структури

## Пов'язана документація

- `docs/tasks/migration-phase3-storefront-ssr-routes.md` — де SEO head property визначається
- `app/(storefront)/catalog/[sectionSlug]/[productSlug]/page.tsx` — поточний SEO + JSON-LD (Next.js версія)
- `supabase/types.ts` — поточні DB types (для перевірки існуючих полів)
- `.github/instructions/data-access.instructions.md` — data access патерни

## Definition of Done

- [ ] SEO-поля додані в БД (products, sections, properties, property_options) через Supabase migration
- [ ] TypeScript типи оновлені через `pnpm db:generate-types`
- [ ] `seoResolver` utility створено в `@simplycms/core/lib/` з fallback chain
- [ ] Admin UI має SEO collapse panel у формах product, section і property
- [ ] Route `head` property використовує seoResolver для meta, canonical, keywords/tags, og, twitter, robots, JSON-LD
- [ ] JSON-LD для products використовує schema.org Product з offers
- [ ] Порожні SEO-поля fallback-ять на бізнес-поля → site defaults
- [ ] `pnpm typecheck` проходить
- [ ] `pnpm dev` — сторінка товару має повні SEO теги в HTML head (перевірити через View Source)
