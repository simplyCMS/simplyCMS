# SimplyCMS Core → Headless Commerce Engine: дизайн перерозподілу пакетів

> **[AMENDMENT 2026-07-30]** MetaHub-сценарії (№2 HUB, №3 Marketplace) **скасовано** — MetaHub реалізує домен «Продукти» власним шляхом. Tier-архітектура, порти та розподіл пакетів **лишаються чинними**; цільові споживачі тепер — повнозбірний магазин SimplyCMS та екосистема платформи (сторонні магазини, плагіни, теми). Наступний крок еволюції цього дизайну — архітектура платформи (OpenCart-подібна модель поставки/розширень), див. design doc у `docs/superpowers/specs/` після затвердження.
>
> Статус: дизайн-чернетка для обговорення (частково реалізована — див. `../tasks/core-engine-extraction-implementation.md`).
> Мета: перетворити `simplycms-core` з «магазину під ключ» на **embeddable commerce engine** з визначеними об'єктами та контрактами, придатний для:
> 1. simplyCMS — повна збірка (запуск інтернет-магазинів);
> 2. ~~MetaHub HUB — домен «Продукти»~~ (скасовано, див. amendment);
> 3. ~~MetaHub Marketplace — публічна вітрина~~ (скасовано, див. amendment);
> 4. інші проєкти — підмножина механізмів навколо визначених об'єктів.

---

## 1. Поточний стан (факти з кодобази)

### 1.1. Пакети та обсяги

| Пакет | Файлів | LOC | Природа | Чистота |
|---|--:|--:|---|---|
| `@simplysoftua/core` | 76 | 11 833 | **god-package**: об'єкти+типи, pure-логіка (pricing/discount/shipping/stock), data-hooks, singleton-клієнт, UI (catalog/cart/checkout/reviews/profile), pages, providers | змішана |
| `@simplysoftua/admin` | 56 | 15 448 | admin CRUD pages + form-компоненти (products/sections/properties/stock/prices/discounts/shipping/orders/user-categories/banners/plugins) | data-coupled |
| `@simplysoftua/ui` | 50 | 4 025 | shadcn/Radix примітиви | ✅ чистий, без домену |
| `@simplysoftua/theme-system` | 6 | 646 | ThemeRegistry / Resolver / SSR / Context | ✅ чистий рушій |
| `@simplysoftua/plugins` | 6 | 786 | HookRegistry / PluginLoader / PluginSlot + 30+ хук-поінтів | ✅ чистий, 0 deps |
| app `src/server` | — | 476 | `createServerFn`: getProducts/getProduct/getSections/getProperties/getHomePageData/themes/auth | в app-shell |
| app `src/seo` | — | 159 | sitemap / robots / vite-plugin | в app-shell |
| app `src/routes` | — | 1 216 | storefront / protected / admin / api композиція | app-specific |

### 1.2. Аудит зв'язаності (обсяг переробки)

| # | Зв'язок | Масштаб | Наслідок |
|---|---|---|---|
| A | Глобальний singleton `export const supabase` + прямий `import { supabase }` | **~83 місця всього; 31 файл у core** (hooks, lib/supabase, lib/shipping/findZone, **і UI-компоненти** FilterSidebar/CatalogLayout/checkout/profile) | Дата-шар «вшитий» у компоненти → блокує і мультитенантність, і subset-adoption. **Головний рефакторинг.** |
| B | `import.meta.env.VITE_*` у core | 6 місць | Легко централізувати у ConfigProvider |
| C | Хардкод маршрутів (`/admin`,`/catalog`,`/profile`…) | 38+14+8+7+3+2+2 | Потрібен `LinkResolver` (host задає URL-схему) |
| D | Auth/`profiles`/`user_roles`/`useAuth` | 22 файли | Потрібен `IdentityProvider` (host підставляє свою auth) |
| E | Single-tenant схема (немає `store_id`/`tenant_id`) | вся БД | Потрібен `ScopeResolver` + reference-схема з опційним scope-стовпцем |

**Висновок:** головна проблема — не якість логіки (вона зріла), а **архітектурні межі**: `core` змішує 5 рівнів чистоти, дата-доступ вшитий у компоненти, оточення (client/env/routes/auth/scope) хардкоджене замість ін'єкції.

---

## 2. Цільова архітектура: рівні (tiers) + порти

Принцип: **залежності тільки вниз по рівнях**; кожен рівень — окремо споживаний; оточення приходить через **порти**, які реалізує host.

```
Tier 0  CONTRACTS      @simplysoftua/objects        (типи об'єктів + інтерфейси портів) — 0 deps
                          ▲
Tier 1  DOMAIN LOGIC   @simplysoftua/domain         (pricing, discounts, shipping-calc, inventory) — pure, deps: objects
                          ▲
Tier 2  DATA ACCESS    @simplysoftua/data-supabase  (репозиторії на Supabase, інжектять client+scope)
                       @simplysoftua/react-query    (TanStack-Query хуки поверх репозиторіїв)
                          ▲
Tier 3  UI PRIMITIVES  @simplysoftua/ui             (shadcn, без домену)
                          ▲
Tier 4  RENDERING      @simplysoftua/theme-system   (SSR теми)        ── object-agnostic
                       @simplysoftua/plugins        (hook/slot движок)
                       @simplysoftua/storefront     (SSR-loaders + SEO/sitemap) ← НОВИЙ, з app-shell
                          ▲
Tier 5  FEATURE UI     @simplysoftua/catalog-ui, cart-ui, checkout-ui, reviews-ui, profile-ui
                       @simplysoftua/admin          (admin-kit, на репозиторіях+LinkResolver)
                          ▲
Tier 6  ASSEMBLY       @simplysoftua/runtime        (defineConfig: wiring адаптерів+модулів+теми+плагінів)
```

### 2.1. Визначені об'єкти (Tier 0 — серце концепції)

`@simplysoftua/objects` — стабільні контракти, **незалежні від форми рядка БД** (zod-схеми + TS-типи):

- `Product`, `ProductModification`, `Section` (категорія), `Property` + `PropertyOption`, `PropertyValue`
- `PriceType`, `PriceEntry`, `UserCategory` (B2B-група)
- `Discount`, `DiscountGroup`, `DiscountCondition`, `DiscountTarget`
- `StockItem`, `PickupPoint`
- `Order`, `OrderItem`, `OrderStatus`, `Cart`, `CartItem`
- `ShippingMethod`, `ShippingZone`, `ShippingRate`
- `Review`, `Banner`

> Тут і реалізується «придатність для різних задач»: об'єкти декларовані явно, host знає, що саме він отримує і як розширювати.

### 2.2. Порти (контракти, які реалізує host) — заміна singleton

| Порт | Абстрагує | simplyCMS | HUB | Marketplace |
|---|---|---|---|---|
| `CatalogRepository` | читання/запис об'єктів | Supabase-адаптер, глоб. клієнт | `@kit/supabase` + `hub_id` | read-only адаптер |
| `OrderRepository` | замовлення/кошик | Supabase | (опц.) hub-orders | guest-order |
| `ScopeResolver` | тенантність | `() => undefined` | `() => hubId` | `() => hubId` |
| `IdentityProvider` | хто користувач/ролі | simplyCMS auth | MetaHub `authz_*` | MetaHub authz |
| `LinkResolver` | побудова URL | `/catalog/:slug` | `/hub/products/:id` | `/m/:hub/:slug` |
| `MediaProvider` | сховище медіа | Supabase Storage | `@kit/storage` | CDN |
| `ConfigProvider` | env/locale/currency/seo | `import.meta.env` | hub-settings | marketplace-settings |

Ядро викликає `repo.getProduct(id)`, не `supabase.from('products')`. Той самий `useProductsWithStock` працює і single-tenant, і hub-scoped — різниця лише в реалізації порту.

> **Стрижень усієї схеми (наслідок прийнятих рішень):** оскільки HUB пише **власний репозиторій** на `@kit/supabase`, а Marketplace бере **повну вітрину**, — всередині MetaHub існує **одна репозиторій-імплементація (scoped по `hub_id`), що обслуговує і admin-домен «Продукти», і Marketplace**. `@simplysoftua/data-supabase` лишається імплементацією **тільки для simplyCMS**. Тому реально-крос-проєктним контрактом є `@simplysoftua/objects` (порти+типи) + `@simplysoftua/domain` (pure-логіка). Хуки та feature-ui **зобов'язані** брати репозиторій з `RepositoryProvider` (контекст), а кожен host інжектить свою реалізацію порту. Це підвищує важливість DI-рефакторингу хуків/компонентів (вони — спільні; дата — хостова).

---

## 3. Перерозподіл пакетів (центральна задача)

### 3.1. Розщеплення god-package `core`

`@simplysoftua/core` (11.8k LOC) ріжеться **за рівнем чистоти**, а не за фічами:

| Звідки (поточний core/...) | Куди | Tier | Що зробити при переносі |
|---|---|---|---|
| `types/`, частина hook-типів | `@simplysoftua/objects` | 0 | відв'язати типи від `Database` (рядків БД) → доменні контракти + zod |
| `lib/priceUtils`, `lib/discountEngine` | `@simplysoftua/domain/pricing`, `/discounts` | 1 | вже pure — перенести як є |
| `lib/shipping/*` | `@simplysoftua/domain/shipping` | 1 | `findZone` робить IO → винести запит у репозиторій, лишити чистий розрахунок |
| `hooks/useProductsWithStock` (calc-частина) | `@simplysoftua/domain/inventory` | 1 | `calculateProductAvailability/enrich*` — pure, перенести |
| `supabase/client.ts`, `lib/supabase.ts` | `@simplysoftua/data-supabase` | 2 | **прибрати singleton** → фабрика `createRepository(client, scope)` |
| `hooks/*` (data-частина) | `@simplysoftua/react-query` | 2 | хуки приймають repo з контексту, а не `import { supabase }` |
| `components/catalog/*` | `@simplysoftua/catalog-ui` | 5 | розділити на presentational (props-only) + container (repo) |
| `components/cart/*` | `@simplysoftua/cart-ui` | 5 | те саме |
| `components/checkout/*` | `@simplysoftua/checkout-ui` | 5 | те саме |
| `components/reviews/*` | `@simplysoftua/reviews-ui` | 5 | те саме |
| `components/profile/*` | `@simplysoftua/profile-ui` | 5 | залежить від IdentityProvider |
| `providers/CMSProvider`, `config.ts` | `@simplysoftua/runtime` | 6 | розширити `defineConfig` адаптерами+модулями |
| `pages/*` | **лишити в app-shell** (або `themes/`) | — | сторінки — це композиція, не движок |

### 3.2. Нові пакети з app-shell (для маркетплейсу)

| Звідки | Куди | Що зробити |
|---|---|---|
| `src/server/*.ts` (createServerFn) | `@simplysoftua/storefront/loaders` | параметризувати репозиторієм; зробити object-agnostic |
| `src/seo/*` (sitemap/robots/plugin) | `@simplysoftua/storefront/seo` | генерувати з зареєстрованих об'єктів, не хардкод товарів |

### 3.3. Пакети, що лишаються майже як є

- `@simplysoftua/ui` (Tier 3) — чистий, лише, можливо, прибрати випадкові доменні домішки.
- `@simplysoftua/theme-system` (Tier 4) — чистий; зробити рендер object-agnostic (тема рендерить будь-який зареєстрований тип, не лише товар).
- `@simplysoftua/plugins` (Tier 4) — чистий движок; хук-поінти лишаються — це backbone розширення для всіх збірок.

### 3.4. Підсумкова карта пакетів (target)

```
@simplysoftua/objects        T0  контракти+порти          0 deps          (фундамент)
@simplysoftua/domain         T1  pricing|discounts|        objects         (pure)
                              shipping|inventory  (subpath exports)
@simplysoftua/data-supabase  T2  репозиторії               objects, @supabase/*
@simplysoftua/react-query    T2  TanStack-Query хуки        objects, react, @tanstack/react-query
@simplysoftua/ui             T3  shadcn примітиви           react, radix
@simplysoftua/theme-system   T4  SSR теми                   react
@simplysoftua/plugins        T4  hook/slot движок           react (peer)
@simplysoftua/storefront     T4  SSR-loaders + SEO          objects, @tanstack/react-start
@simplysoftua/catalog-ui     T5  ProductCard/Gallery/...    objects, react-query, ui
@simplysoftua/cart-ui        T5                              ...
@simplysoftua/checkout-ui    T5                              ...
@simplysoftua/reviews-ui     T5                              ...
@simplysoftua/profile-ui     T5                              objects, identity
@simplysoftua/admin          T5  admin-kit                  ui, react-query, links
@simplysoftua/runtime        T6  defineConfig/wiring        усі обрані
```

> Орієнтир: ~3 «чистих» пакети лишаються; god-`core` → ~10 нових; +2 з app-shell. Сумарний LOC майже не зростає — це **перенесення з межами**, не переписування логіки.

---

## 4. Профілі споживання

| Пакет | simplyCMS | HUB «Продукти» | Marketplace | Інший проєкт |
|---|:--:|:--:|:--:|:--:|
| objects | ✅ | ✅ | ✅ | ✅ |
| domain (pricing/discount/inventory) | ✅ | ✅ | ✅ (показ цін) | за потреби |
| data-supabase | ✅ | ❌ власний repo на `@kit/supabase` | ❌ той самий metahub-repo | опц. |
| react-query | ✅ | опц. | ✅ | опц. |
| ui | ✅ | ❌ (hub на `@kit/ui`) | ✅ | опц. |
| theme-system | ✅ | ❌ | ✅ | опц. |
| plugins | ✅ | опц. | ✅ | опц. |
| storefront (SSR/SEO) | ✅ | ❌ | ✅ | опц. |
| catalog-ui/cart-ui/checkout-ui | ✅ | частково (admin-форми) | ✅ | опц. |
| admin | ✅ | mine-as-pattern | ❌ | опц. |
| runtime | ✅ | власне wiring | власне wiring | власне |

**HUB «Продукти» конкретно:** `objects` + `domain` + **власний `CatalogRepository` на `@kit/supabase`** (реалізація порту, scoped по `hub_id`) + reference-схема з доданим `hub_id`. Admin будується на `@kit/ui`/`@kit/cardshell` (а не на `@simplysoftua/admin`), з'єднання з `sales_invoices` через нову таблицю-міст `si_products`. Storefront/cart/checkout/theme **не береться** — це прийде з маркетплейсом.

**Marketplace конкретно (повна вітрина):** `storefront` (SSR+SEO) + `theme-system` + `catalog-ui` + **`cart-ui` + `checkout-ui` + orders** + `react-query`, поверх **того самого metahub-репозиторію** (`CatalogRepository`+`OrderRepository` на `@kit/supabase`, scope=hub_id), що й HUB. Admin не береться.
> Наслідок повної вітрини: потрібен `OrderRepository` на metahub-боці + перенос схеми `orders/order_items/cart` з `hub_id`. Варто одразу вирішити, чи замовлення/заявки маркетплейсу стають сутністю MetaHub (лінк до `clients`/лідів) — щоб «збирати заявки від клієнтів» (план #3) інтегрувалося з CRM хабу.

---

## 5. Reference-схема та тенантність

Гібрид (рекомендація):
1. **Pure-логіка та presentational-UI — schema-agnostic** (не торкаються БД).
2. **Дата-доступ — через host-репозиторій**: ядро не пише сирий SQL у бізнес-коді; `data-supabase` інжектить `client + ScopeResolver`. Host вирішує scope (`undefined` | `hub_id`).
3. **Reference-схема — версіоновані SQL-blueprint'и** (`packages/.../schema/`): simplyCMS застосовує as-is; HUB застосовує з доданим `hub_id` + своїм RLS-шаблоном + FK до `sales_invoices`. Host може розширювати.

> Схема **не нав'язується рантаймом** — постачається як шаблон, який кожна збірка адаптує під свою тенантність.

---

## 6. Core-репозиторій: чистити-наново чи рефакторити in-place?

**Рекомендація: «чистий скелет + перенесення по рівнях», НЕ переписування логіки.**

Оскільки (а) `simplyCMS-core` ще не оновлений (відстає), (б) поточний `core` — god-package, (в) рефакторинг singleton→DI все одно зачіпає майже весь дата-шар — це **ідеальний момент перебудувати структуру репо**:

- ❌ Не викидати ~27k LOC робочої доменної логіки.
- ✅ Створити нову tier-структуру пакетів (порожній скелет за §3.4).
- ✅ Переносити код у **порядку залежностей**, рефакторячи межі на кожному кроці:
  1. `objects` (контракти+порти) →
  2. `domain` (pure, переноситься майже як є) →
  3. `data-supabase` + `react-query` (тут гаситься singleton — найбільша робота) →
  4. `ui` (як є) / `theme-system` / `plugins` (object-agnostic доопрацювання) →
  5. `storefront` (винос з app-shell) →
  6. feature-ui kits (split presentational/container) →
  7. `admin` (на репозиторіях+LinkResolver) →
  8. `runtime` (новий defineConfig).
- На кожному кроці simplyCMS-app мігрує на новий пакет → завжди робочий стан.

---

## 7. Дистрибуція та оновлення через GitHub

| Канал | Коли | Як |
|---|---|---|
**Прийняте рішення: гібрид per-пакет/per-споживач — обидва канали одночасно, вибір за критерієм «чи потрібне локальне допрацювання ядра».**

| Критерій споживання | Канал | Приклади |
|---|---|---|
| Пакет **стабільний**, споживач його **НЕ редагує локально** | **GitHub Packages** (семвер) | MetaHub тягне `@simplysoftua/objects@^1`, `@simplysoftua/domain@^1`, `@simplysoftua/ui`, `@simplysoftua/theme-system`, `@simplysoftua/plugins`, `@simplysoftua/storefront`, feature-ui — як readonly-залежності |
| Можливе **локальне допрацювання ядра** / активна спільна розробка | **Git Subtree** (як зараз `cms:pull/push`) | фаза екстракції; simplyCMS-app; будь-який пакет, який MetaHub-команда мусить правити й повертати назад (`cms:push`) |

Один і той самий пакет може спочатку йти через subtree (поки правиться), потім «застигати» у Packages. Залежність строго одностороння: усі споживають ядро, ядро не знає про споживачів.

> **Практичний наслідок:** core-репо має паралельно (а) публікувати кожен пакет у GitHub Packages через CI на семвер-тег, і (б) лишатися subtree-сумісним. Споживач у `package.json` змішує: частина залежностей — з registry, частина — workspace-пакети, підтягнуті subtree.

---

## 8. Оцінка зусиль та ризики

| Блок | Зусилля | Ризик |
|---|---|---|
| Tier 0 `objects` (контракти+порти) | 🟡 | визначити стабільний API — головна проєктна робота |
| Tier 1 `domain` (перенос pure) | 🟢 | майже нульовий |
| Tier 2 singleton→DI (31 файл core + 83 загалом) | 🔴 | найбільший; зачіпає й «розумні» UI-компоненти |
| split presentational/container (feature-ui) | 🟡 | компоненти зараз fetch'ать самі |
| `storefront` винос SSR/SEO + object-agnostic | 🟡 | прив'язка до TanStack Start |
| reference-схема + RLS-шаблони (hub_id) | 🟡 | переписати RLS, нумерацію документів |
| HUB-інтеграція (`si_products`, admin на @kit/ui) | 🟡 | звірити дублювання `services`/`service_requests` |

**Ключові ризики:** (1) над-узагальнення — НЕ робити генеричними pricing/stock (домен переважує); генерик лише для storefront/SEO/listing. (2) UI ядра перевикористають лише проєкти на тому ж стеку (HUB/Marketplace — так); «інші проєкти на іншому стеку» візьмуть лише framework-agnostic частину (`objects`+`domain`+схема). (3) тест-матриця на ОБИДВА режими scope (`undefined`/`hub_id`) — обов'язкова.

---

## 9. Рішення (зафіксовано) та що лишилось

| # | Питання | Рішення |
|---|---|---|
| 1 | Структура domain (Tier 1) | ✅ **Один `@simplysoftua/domain`** із subpath-exports (`./pricing`, `./discounts`, `./inventory`, `./shipping`) |
| 2 | Дата-доступ HUB | ✅ **Власний репозиторій на `@kit/supabase`** (реалізація порту, scope=hub_id); `data-supabase` лишається лише для simplyCMS |
| 3 | Обсяг marketplace на старті | ✅ **Повна вітрина з кошиком/checkout** → потрібен `OrderRepository` + перенос orders-схеми з `hub_id` |
| 5 | Канал дистрибуції | ✅ **Гібрид per-споживач**: Packages там, де ядро не правиться локально; subtree там, де можливе допрацювання |

**Лишилось вирішити:**
- (4) Уніфікувати `services`/`service_requests` між simplyCMS і MetaHub чи лишити окремими доменами?
- (нове, з рішення #3) Чи стають замовлення/заявки маркетплейсу сутністю MetaHub із лінком до `clients`/лідів (інтеграція з CRM хабу)?
