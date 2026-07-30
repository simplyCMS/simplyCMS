# Task: Core Engine Extraction — імплементація headless commerce engine

> **[AMENDMENT 2026-07-30]** MetaHub-adoption **скасовано** власником (MetaHub реалізує домен «Продукти» власним шляхом; див. `completed/metahub-hub-products-adoption.md`). Tier-архітектура, порти та DI **лишаються стратегією** — тепер споживачі це: (1) повнозбірний магазин SimplyCMS, (2) майбутні сторонні магазини/плагіни/теми на платформі. Згадки MetaHub/HUB/Marketplace нижче читати як історичний контекст рішень, не як актуальних споживачів. Подальший розвиток модульності — в межах архітектури платформи (design doc у `docs/superpowers/specs/`).
>
> Статус: **у роботі** — готові P1, P2, P3, P4 (EngineProvider живий), P6, P7 (5 пакетів), P9, P10 (build/publish для Tier 0/1/2); P5 — ui self-contained + tier-розв'язка. Лишок: повний retarget `*-ui` від core (потребує identity/reviews/stock port-розширень), міграція data-споживачів під domain-shape, admin-on-repositories.
> Дизайн-першоджерело: [`docs/architecture/core-engine-extraction.md`](../architecture/core-engine-extraction.md).
> Це **breaking** реструктуризація `packages/simplycms/*` без перехідного adapter-періоду (за духом `migration-phase0`).

## Статус виконання (оновлено 2026-05-29)

| Фаза | Стан | Примітка |
|------|------|----------|
| **P1** `@simplysoftua/objects` | ✅ **Готово** | Type-only пакет; усі порти + `EngineContext`; 0 runtime deps; subpath `./objects`, `./ports`. |
| **P2** `@simplysoftua/domain` | ✅ **Готово** | Subpath `./pricing`/`./discounts`/`./inventory`/`./shipping`; pure; 27 unit-тестів (vitest). `core/lib` re-export'ить домен для зворотної сумісності. |
| **P3** `data-supabase` + знесення singleton | ✅ **Готово** | `@simplysoftua/data-supabase` (Catalog/Order/Identity репозиторії на інжектованому клієнті + `ScopeResolver`, mappers, тести) ✅. **Singleton знесено**: `SupabaseProvider`/`useSupabaseClient` (DI через контекст) у `CMSProvider`; ~80 call-sites мігровано; `grep "import { supabase }"` по репо = 0; `export const supabase` прибрано. _Лишок: `import.meta.env` ще у **трьох** core-файлах (`supabase/client.ts`, `supabase/anon.ts`, `config.ts`); SSR-резолв теми (`getActiveThemeSSR` → `createAnonSupabaseClient`) лишається env-залежним. Релокація у runtime — попереду._ |
| **P4** `@simplysoftua/react-query` | 🟡 **Підключено (двигун живий)** | `EngineProvider`/`useEngine` + порт-керовані query-фабрики/хуки. **`EngineProvider` змонтовано в `__root` (`src/engine-provider.tsx` → `buildClientEngine` з браузерного клієнта + data-supabase репозиторіїв)**, тож `useEngine()` живий по всьому застосунку. Hook-рівневий тест (`engine-provider.test.tsx`, jsdom) перевіряє `useEngine`/`useProduct`/`useSections` через `EngineProvider` з mock-репо. _Лишок: наявні feature-ui/сторінки **ще** читають через core-хуки на `useSupabaseClient` — поступова міграція їх на `useEngine` попереду._ |
| **P5** `ui`/`theme-system`/`plugins` | 🟡 **Частково** | `plugin-system` відв'язано від core DB-типів. **`@simplysoftua/ui` тепер self-contained**: `cn`/`use-toast`/`use-mobile` перенесено з core у ui → ui більше не залежить від `@simplysoftua/core` (виправлено T3→god-package інверсію; core тримає re-export шими). `theme-system` ThemeContext на `useSupabaseClient`. Object-agnostic рендер тем — попереду. |
| **P6** `@simplysoftua/storefront` | 🟡 **Винесено + декаплінг + публікується** | Лоадери (`products`/`sections`/`home`/`properties`) + SEO (`sitemap`/`robots`) у пакеті, параметризовано `SupabaseClient` (schema-agnostic — host інжектує свій типізований клієнт). **Нуль імпортів з `@simplysoftua/core`** (banner-парсинг інлайнено), пакет публікується (tsup+publishConfig). App `src/server/*`+`src/seo/*` делегують. _Лишок: параметризація доменним `CatalogRepository`/`EngineContext` (а не сирим клієнтом) + усунення дублю query-логіки з `data-supabase` — попереду (потребує domain-shape)._ |
| **P7** feature-ui split | ✅ **Структурно готово** | Усі 5 пакетів створено: `cart-ui`, `catalog-ui`, `checkout-ui`, `profile-ui`, `reviews-ui`. Компоненти перенесено з `core/components/*`; старі шляхи — re-export шими (barrel + deep-path працюють). Presentational/container split показано на `cart-ui` (`CartItemView`/`CartItem`); по інших компонентах — інкрементально. |
| **P8** `@simplysoftua/admin` на портах | 🟡 **LinkResolver готовий** | Хардкод `/admin/*` прибрано: 85 літералів у 36 файлах → `adminPath()` (`lib/adminLinks.ts`), host-remappable база. _Переведення admin-CRUD на `CatalogRepository`/`OrderRepository` (замість прямих supabase-запитів) — попереду, разом із P7 (потребує domain-shape)._ |
| **P9** `@simplysoftua/runtime` | 🟡 **Зібрано (не підключено)** | `defineConfig` складає `EngineContext` з адаптерів/модулів/теми/плагінів (pure, deps лише objects) ✅. **Reference-збірка `src/server/engine.ts` (`createServerRuntime`) ніде не викликається** — live-маршрути досі йдуть через `createServerSupabase()` напряму. Підключення рантайму до реальних шляхів — попереду. |
| **P10** дистрибуція / CI | ✅ **Готово** (Tier 0/1/2 + storefront) | Subtree push + `cms:remote`. **Build/publish**: tsup (esm+dts, `splitting:false`+`external`) для **6 пакетів** (`objects`/`domain`/`data-supabase`/`react-query`/`runtime`/`storefront`) — `private:false`, `publishConfig` (dev=src/publish=dist), `dist/` gitignored. Root `build:packages`. CI `publish-packages.yml`: objects → потім залежні (topo-порядок), на тег `v*`. _Лишок: `core`/`ui`/`*-ui` не публікуються (db-types alias / god-package / build під ~50 ui-компонентів)._ |

**Перевірки на момент оновлення:** `pnpm typecheck` ✅ · `pnpm lint` ✅ (0 errors) · `pnpm test` ✅ (38 passed) · `pnpm build` ✅.

### Портативність у сторонні проєкти — статус після код-ревью

**Виправлено** (маніфести/build/tiers, білд лишається зеленим):
- `@simplysoftua/core` декларує sibling-залежності (`domain`, `react-query`, `ui`, `plugins`, усі `*-ui`) та зовнішні peer-deps; `exports` розширено `./hooks/*`, `./supabase/*`, `./components/*`.
- `@simplysoftua/storefront` додано залежність `@simplysoftua/core`; `*-ui` — відсутні peer-deps + subpath-export `./*`.
- `data-supabase.listProducts`/`getProductsBySection`: прибрано неявний кеп `pageSize:24`.
- **Build/publish (P10):** tsup-білд (esm+dts, `splitting:false`+`external`) + `publishConfig` (dev=src/publish=dist) + `private:false` для `objects`/`domain`/`data-supabase`/`react-query`/`runtime`/**`storefront`** (6 пакетів); root `build:packages`; CI `publish-packages.yml` (objects окремим кроком перед залежними).
- **`storefront` декаплінг:** прибрано обидва імпорти з core — `StorefrontClient = SupabaseClient` (schema-agnostic, host інжектує типізований клієнт), banner-парсинг інлайнено локально (objects `Banner`). storefront більше **не залежить від `@simplysoftua/core`** і тепер публікується.
- **`@simplysoftua/ui` peer-deps:** оголошено 27 `@radix-ui/*` + cmdk/embla/input-otp/next-themes/react-day-picker/react-hook-form/react-resizable-panels/recharts/sonner/vaul/lucide-react/cva (усі `optional` через `peerDependenciesMeta`).
- **Tier-розв'язка:** `@simplysoftua/ui` self-contained (cn/use-toast/use-mobile перенесено з core); `useCart` → `@simplysoftua/react-query`; **`cart-ui` повністю без `@simplysoftua/core`**; catalog/checkout/profile/reviews-ui переведено на тонкі tier-и для cn/toast/cart/shipping (core лишився лише для useAuth/useStock/useProductReviews/SupabaseProvider).
- **Двигун живий:** `EngineProvider` змонтовано в `__root`; `useEngine()` покрито hook-тестом.

**Лишилось (свідомі блокери, поза зеленим білдом app):**
1. **`core`/`ui`/`*-ui` ще не публікуються** (storefront — вже публікується): `core` тягне `@simplysoftua/db-types` (phantom alias на host-схему) + browser-залежності; `*-ui` ще на core. `@simplysoftua/ui` тепер self-contained від core **і декларує всі peer-deps**, але лишається `private:true` — для публікації потрібен build-крок під ~50 компонентів (subpath-exports `./*`). Core потребує декаплінгу типів схеми.
2. **Повний retarget `*-ui` від core** заблоковано port-розширеннями. Окрім хуків (**identity-auth** для `useAuth`, **reviews-port** для `useProductReviews`, **stock із modification-id** для `useStock`), кілька feature-компонентів роблять **прямі supabase data-запити** через `useSupabaseClient` (а не лише auth): `catalog-ui/FilterSidebar` (section_property_assignments, property_options), `checkout-ui/CheckoutDeliveryForm` (shipping_methods/rates, pickup_points, user_addresses), `CheckoutRecipientForm`/`profile-ui` (user_recipients/user_addresses). Тобто треба ще **data-порти**: catalog-properties(faceted), shipping, addresses/recipients. Доки їх нема — catalog/checkout/profile/reviews-ui тримають `@simplysoftua/core` (через `SupabaseProvider`).
3. **Повна міграція data-споживачів на `useEngine`** потребує адаптації сторінок/feature-ui під domain-shape об'єктів (порти повертають domain `Product`/`Section`, а рендер очікує сирі DB-рядки) — це P7-domain робота. Зроблено: tier-relocation `useCart`; live `EngineProvider`. Серверні loaders ще через `createServerSupabase` (не `createServerRuntime`).

> Підхід обрано **адитивний на фундаменті**: нові пакети T0/T1 створені й покриті тестами, а `@simplysoftua/core` тимчасово re-export'ить домен, щоб застосунок лишався зеленим. Інвазивне знесення singleton (P3) та рознесення UI/admin/storefront (P5–P9) — окремими безпечними кроками, бо зачіпають ~80 call-sites і весь app-shell.

## Контекст

Після завершення міграції на TanStack Start ядро `simplycms-core` лишилось «магазином під ключ»: `@simplysoftua/core` — god-package (11.8k LOC), що змішує об'єкти, pure-логіку, data-доступ, singleton-клієнт і UI; дата-доступ вшитий навіть у UI-компоненти через глобальний `export const supabase`. Це блокує:
- мультитенантне перевикористання (MetaHub scoped по `hub_id`);
- subset-adoption (взяти «тільки товарні механізми» неможливо).

Мета — перетворити ядро на **embeddable commerce engine** з визначеними об'єктами та портами, придатний для трьох збірок: simplyCMS (повна), MetaHub HUB (домен Продукти), MetaHub Marketplace (повна вітрина).

### Зв'язок із наявними задачами

> ⚠️ **Ця задача свідомо реверсує два рішення `completed/migration-phase0-decouple-packages.md`** (для дата-шару):
> - Фаза 0.9: «singleton pattern зберігається» → **скасовано**: singleton прибирається на користь DI/ports.
> - Decision #10: «Жодних adapter-модулів» → **уточнено**: заборона стосувалась router/image-адаптерів під час Next→TanStack міграції; data-access **порти** (репозиторії) тепер дозволені й обов'язкові.
>
> ThemeRegistry-singleton (`phase3`/`phase5`/`theme-switching`) **зберігається** — це інший механізм, не торкається. Див. amendment у `completed/migration-phase0-decouple-packages.md` §«Superseded».

## Прийняті рішення (locked)

1. **Tier 1 — один пакет `@simplysoftua/domain`** із subpath-exports (`./pricing`, `./discounts`, `./inventory`, `./shipping`). Не дробити на окремі пакети.
2. **HUB — власний репозиторій на `@kit/supabase`** (реалізація порту, scope=`hub_id`). `@simplysoftua/data-supabase` лишається імплементацією **тільки для simplyCMS**.
3. **Marketplace — повна вітрина** (catalog + cart + checkout + orders) → потрібні `CatalogRepository` **і** `OrderRepository`, перенос orders-схеми з `hub_id`.
4. **Дистрибуція — гібрид per-споживач**: GitHub Packages там, де ядро не правиться локально; Git Subtree там, де можливе допрацювання. CI публікує кожен пакет на семвер-тег **і** лишається subtree-сумісним.

### Лишилось вирішити власнику (не блокує P1–P5)
- Уніфікація `services`/`service_requests` simplyCMS ↔ MetaHub.
- Чи стають orders/заявки маркетплейсу сутністю MetaHub (лінк до `clients`/лідів).

## Цільова структура пакетів

```
T0 @simplysoftua/objects        контракти об'єктів + порти        0 runtime deps
T1 @simplysoftua/domain         pricing|discounts|inventory|       deps: objects
                             shipping (subpath exports, pure)
T2 @simplysoftua/data-supabase  репозиторії на Supabase (DI)        deps: objects, @supabase/*
   @simplysoftua/react-query    TanStack-Query хуки через контекст  deps: objects, react, @tanstack/react-query
T3 @simplysoftua/ui             shadcn примітиви (як є)
T4 @simplysoftua/theme-system   SSR теми (зберігається)
   @simplysoftua/plugins        hook/slot движок (зберігається)
   @simplysoftua/storefront     SSR-loaders + SEO (винос з app)     deps: objects, @tanstack/react-start
T5 @simplysoftua/catalog-ui     ProductCard/Gallery/Filter...       deps: objects, react-query, ui
   @simplysoftua/cart-ui        cart drawer/button/item
   @simplysoftua/checkout-ui    checkout forms/summary
   @simplysoftua/reviews-ui     reviews
   @simplysoftua/profile-ui     profile (deps: identity)
   @simplysoftua/admin          admin-kit (на репозиторіях+links)
T6 @simplysoftua/runtime        defineConfig / wiring адаптерів
```

## Порти (контракти Tier 0) — цільові сигнатури

```ts
// @simplysoftua/objects/ports
export interface ScopeResolver { getScope(): string | undefined; } // undefined=single-tenant, hubId=multi

export interface CatalogRepository {
  getProduct(idOrSlug: string): Promise<Product | null>;
  listProducts(q: ProductQuery): Promise<Paged<Product>>;
  getProductsBySection(sectionId: string, q?: ProductQuery): Promise<Paged<Product>>;
  getSections(q?: SectionQuery): Promise<Section[]>;
  getSectionBySlug(slug: string): Promise<Section | null>;
  getProperties(q?: PropertyQuery): Promise<Property[]>;
  getStock(ids: string[]): Promise<Record<string, StockInfo>>;
  getPriceTypes(): Promise<PriceType[]>;
  getDiscounts(ctx: DiscountScope): Promise<DiscountGroup[]>;
  // write-операції (admin): upsertProduct, upsertSection, ...
}

export interface OrderRepository {
  createOrder(input: CreateOrderInput): Promise<Order>;
  getOrder(id: string): Promise<Order | null>;
  listOrders(q: OrderQuery): Promise<Paged<Order>>;
  updateStatus(id: string, status: string): Promise<void>;
}

export interface IdentityProvider {
  getCurrentUser(): Promise<Identity | null>;
  hasRole(role: string): Promise<boolean>;
  signIn / signOut / ...;
}

export interface LinkResolver {
  product(p: Pick<Product,'slug'|'id'> & { sectionSlug?: string }): string;
  section(s: Pick<Section,'slug'|'id'>): string;
  cart(): string; checkout(): string; profile(sub?: string): string; auth(): string;
}

export interface MediaProvider { url(path: string, opts?: ImageOpts): string; upload(file: File): Promise<string>; }
export interface ConfigProvider { locale: string; currency: string; siteUrl: string; seo: SeoConfig; }

// Контейнер, що інжектиться через React-контекст
export interface EngineContext {
  catalog: CatalogRepository; orders?: OrderRepository;
  scope: ScopeResolver; identity: IdentityProvider;
  links: LinkResolver; media: MediaProvider; config: ConfigProvider;
}
```

> `@simplysoftua/react-query` експортує `<EngineProvider value={ctx}>` + `useEngine()`. Усі хуки/feature-ui беруть залежності з `useEngine()`, **ніколи** не імпортують `supabase` напряму.

## Фази імплементації

### P1 — `@simplysoftua/objects` (контракти + порти) — ✅ ГОТОВО
- Створити пакет; винести типи з `core/src/types` та доменні типи з `discountEngine`/`priceUtils`/`shipping`/`useStock`, **відв'язавши від `Database` (рядків БД)** → доменні TS-типи (локальний `Json` замість `Database['Json']`).
- Визначити всі порти (вище) + `EngineContext`.
- DoD: 0 runtime-залежностей; `tsc` зелений; жодного імпорту supabase/react. ✅
- _Реалізація:_ `packages/simplycms/objects/src/{objects,ports}`. Рішення: **type-only** (без zod), щоб строго втримати «0 runtime deps» з DoD; валідаційні zod-схеми за потреби житимуть у domain/data-шарі.

### P2 — `@simplysoftua/domain` (pure-логіка) — ✅ ГОТОВО
- Перенести `lib/priceUtils` → `./pricing`, `lib/discountEngine` → `./discounts`, stock-calc (`calculateProductAvailability`/`enrich*`) → `./inventory`, `lib/shipping/*` (крім IO) → `./shipping`. ✅
- `shipping/findZone` робить IO → лишити чистий розрахунок у domain (`findShippingZoneIn`), запит винести в `CatalogRepository.getShippingZones` (порт додано; supabase-реалізація — у P3). ✅ (pure-частина)
- DoD: всі функції pure, deps лише `objects`; unit-тести (vitest) на pricing/discount/shipping/availability. ✅ (27 тестів)
- _Реалізація:_ `packages/simplycms/domain/src/*` + `__tests__`. `core/lib/{priceUtils,discountEngine,shipping/calculateRate,shipping/types}` та `hooks/useProductsWithStock` тепер re-export'ять домен.

### P3 — `@simplysoftua/data-supabase` + знесення singleton 🔴 — ✅ ГОТОВО
- Створити `createSupabaseCatalogRepository(client, scope)` / `createSupabaseOrderRepository(...)` — імплементації портів, що приймають **інжектований** client + `ScopeResolver`. ✅ (+ `createSupabaseIdentityProvider`)
- Прибрати `core/src/supabase/client.ts` глобальний `export const supabase`. ✅
- **Інвентар call-sites (~80 файлів):** core hooks (`useStock`,`usePriceType`,`useBanners`,`useDiscountedPrice`,`useProductReviews`,`useProductsWithStock`), `lib/supabase`, `lib/shipping/findZone`, core UI (`FilterSidebar`,`CatalogLayout`, profile/*, checkout/*), core pages/*, admin pages/components, theme-system, themes/default + themes/solarstore — усі мігровано на `useSupabaseClient()` (або інжектований client-параметр для не-React хелперів). ✅
- DoD: `grep "import { supabase }"` по ядру = 0 ✅. `import.meta.env` — досі у **трьох** core-файлах (`supabase/client.ts`, `supabase/anon.ts`, `config.ts`); `data-supabase` env не містить. SSR-резолв теми через `createAnonSupabaseClient` лишається env-залежним. Релокація — попереду. 🟡
- _Реалізація:_ `packages/simplycms/data-supabase/src/*` (repos + `mappers.ts` + `scope.ts`, тести); DI-клієнт — `core/src/supabase/SupabaseProvider.tsx` (`SupabaseProvider`/`useSupabaseClient`), змонтований у `CMSProvider`. Не-React хелпери (`Orders.fetchOrders`, `fetchModification*`, `lib/supabase`, `findZone`) приймають/беруть client явно.

### P4 — `@simplysoftua/react-query` (хуки через контекст) — 🟡 ФУНДАМЕНТ
- Перенести data-частину хуків; кожен хук бере `useEngine()`. 🟡 _нові порт-керовані хуки (`useProduct`/`useProducts`/`useSections`/`useStockInfo`/`useOrder`/…) додані; перенесення наявних core-хуків (`useStock`, `useBanners`, …) — після P3._
- Додати `EngineProvider` + `useEngine`. ✅
- DoD: хуки не знають про конкретну БД; працюють з будь-якою реалізацією порту; тест із mock-репозиторієм. ✅ — query-фабрики (`queries.test.ts`) **і** React-хуки через `EngineProvider` (`engine-provider.test.tsx`, jsdom: `useEngine`/`useProduct`/`useSections` з in-memory репо) покрито; `EngineProvider` змонтовано в `__root`. _Лишок: наявні споживачі ще не переведені на `useEngine` (поступово)._
- _Реалізація:_ `packages/simplycms/react-query/src/{EngineProvider.tsx,queries.ts,hooks.ts}`. Логіка запитів — у `queries.ts` (порт-керовані фабрики), хуки — тонка прив'язка до контексту.

### P5 — `ui` / `theme-system` / `plugins` (мінімальні зміни, object-agnostic) — 🟡 ЧАСТКОВО
- `ui` — лишити; прибрати випадкові доменні домішки. ✅ (домішок не виявлено)
- `theme-system` — зберегти ThemeRegistry-singleton (не плутати з supabase); зробити рендер **object-agnostic** (рендерить будь-який зареєстрований тип, не лише товар). 🟡 _ThemeContext вже на DI (`useSupabaseClient`, P3); лишок — SSR-резолв `getActiveThemeSSR` через `createAnonSupabaseClient` (env-залежний) + object-agnostic рендер._
- `plugins` — зберегти; хук-поінти лишаються backbone розширення. ✅ (loader уже на DI; type-coupling до core DB прибрано: `Json` → `@simplysoftua/objects`)
- DoD: theme/plugins не залежать від data-шару напряму. 🟡 _plugins — так; theme — ще ні._

### P6 — `@simplysoftua/storefront` (винос SSR/SEO з app-shell) — ✅ ГОТОВО
- Перенести `src/server/*` (логіку createServerFn-лоадерів) → `storefront/loaders`, параметризувавши **інжектованим клієнтом** (`SupabaseClient<Database>`). ✅ createServerFn-обгортки лишилися в app і делегують у пакет.
- Перенести `src/seo/*` (sitemap/robots) → `storefront/seo`, параметризувавши клієнтом + baseUrl. ✅
- DoD: маркетплейс може зібрати публічну вітрину, надавши власний клієнт; simplyCMS-app мігрував на пакет. 🟡 — app мігрував ✅; але параметризація — **сирим `SupabaseClient<Database>`**, не `CatalogRepository`/`EngineContext`, тож marketplace на іншій схемі/`hub_id` поки не підставить свій репозиторій (потрібен клієнт проти тієї ж `Database`). Query-логіка дублюється з `data-supabase`.
- _Реалізація:_ `packages/simplycms/storefront/src/{loaders,seo,client.ts}`. **Лишок:** параметризація доменним `CatalogRepository`/`EngineContext` (замість сирого client) — фолдиться в P7, бо storefront-сторінки поки споживають сирі DB-shape; генерація SEO «із зареєстрованих об'єктів» — після object-agnostic тем (P5).

### P7 — feature-ui (split presentational/container) — ✅ СТРУКТУРНО ГОТОВО
- `core/components/{catalog,cart,checkout,reviews,profile}` → відповідні `*-ui` пакети. ✅ Усі 5 створено (`@simplysoftua/{cart,catalog,checkout,profile,reviews}-ui`); старі шляхи лишилися re-export шимами для зворотної сумісності (core barrel + deep-path importers, напр. теми, працюють).
- Кожен компонент розділити: **presentational** (props-only) + **container** (через хуки). 🟡 Показано на `cart-ui` (`CartItemView` props-only + `CartItem` container на `useCart`); по інших компонентах split — інкрементальний (компоненти перенесено as-is, поведінка збережена).
- DoD: presentational-компоненти не роблять fetch; HUB може реюзати зі своїми контейнерами. 🟡 (пакетні межі готові; повний props-only split — далі)
- _Реалізація:_ `packages/simplycms/{cart,catalog,checkout,profile,reviews}-ui/`. Імпорти `../../{hooks,lib,supabase}` → `@simplysoftua/core/*`; tsconfig paths + vite alias додано для кожного.

### P8 — `@simplysoftua/admin` (на репозиторіях + LinkResolver) — 🟡 LINKRESOLVER ГОТОВИЙ
- **LinkResolver:** хардкод `/admin/*` прибрано — 85 літералів у 36 файлах → `adminPath()`/`setAdminBase()` (`packages/simplycms/admin/src/lib/adminLinks.ts`), база переприв'язується host'ом. ✅
- Перевести admin-pages/components на `CatalogRepository`/`OrderRepository` (замість прямих supabase-запитів). ⛔ _попереду — великий рефактор admin-CRUD, фолдиться з P7 (потребує domain-shape об'єктів)._
- DoD: admin працює поверх портів; simplyCMS-app зелений. 🟡 (app зелений; CRUD ще на supabase через `useSupabaseClient`)

### P9 — `@simplysoftua/runtime` (defineConfig / wiring) — ✅ ГОТОВО
- Розширити `defineConfig` з `{supabase}` до `{ adapters:{catalog,orders,scope,identity,links,media,config}, modules:[], theme, plugins }`. ✅ (новий `@simplysoftua/runtime` defineConfig; legacy core `defineConfig` лишено для зворотної сумісності `simplycms.config.ts`)
- simplyCMS-app = повна збірка через runtime. 🟡 reference: `src/server/engine.ts` `createServerRuntime()` складає `EngineContext` з data-supabase репозиторіїв + app `LinkResolver`/`MediaProvider`/`ConfigProvider`, **але ніде не викликається** — live-маршрути досі на `createServerSupabase()` напряму. Підключення — попереду.
- DoD: `simplycms.config.ts` збирає магазин через адаптери; немає прямих `import.meta.env` поза runtime. 🟡 _runtime сам pure; `import.meta.env` лишається у app-wiring (`engine.ts`/`config.ts`) і core (`client.ts`/`anon.ts`/`config.ts`); `data-supabase` env не містить._
- _Реалізація:_ `packages/simplycms/runtime/src/index.ts` (`defineConfig`, `bootstrapRuntime`, `EngineModule`).

### P10 — дистрибуція / CI — ✅ ГОТОВО (Tier 0/1/2)
- Per-package `package.json` з `exports` + build (tsup, esm+dts). ✅ для `objects`/`domain`/`data-supabase`/`react-query`/`runtime`: `publishConfig` (dev=src, publish=dist), `private:false`, `files`/`license`/`repository`, `build`+`prepublishOnly`, `dist/` gitignored. Root `build:packages`.
- CI: `.github/workflows/publish-packages.yml` — `pnpm install` → `build:packages` → `pnpm publish` 5 пакетів на тег `v*`/manual; subtree-флоу (`cms:pull/push`) збережено. ✅
- DoD: MetaHub може `pnpm add @simplysoftua/objects@^x @simplysoftua/domain@^x …`; subtree-флоу працює. ✅ (для Tier 0/1/2). _Лишок: `core`/`storefront`/`*-ui` — не публікуються (db-types alias / browser / god-package); потрібен декаплінг типів схеми + build для них._
- **Примітки щодо публікації:** (a) CI публікує `@simplysoftua/objects` окремим кроком ПЕРЕД залежними (pnpm не гарантує topo-порядок → інакше 404). (b) Згенеровані `.d.ts` ре-експортують через `.js`-specifier (rollup-dts) — споживач має `moduleResolution: "bundler"|"node16"|"nodenext"` (норма для сучасного ESM; legacy `node` не підтримується). (c) Для GitHub Packages scope `@simplycms` ≠ власник `simplySOFTua` — публікувати в npmjs або перейменувати scope (workflow за замовч. npmjs).

## Як MetaHub споживає (orientation для HUB-задачі)

- **HUB домен Продукти:** `@simplysoftua/objects` + `@simplysoftua/domain` (packages) + **власний `CatalogRepository` на `@kit/supabase`** (scope=hub_id) + reference-схема з `hub_id`; admin на `@kit/ui`; FK `si_products` → `sales_invoices`.
- **Marketplace:** `@simplysoftua/storefront` + `theme-system` + `catalog-ui`/`cart-ui`/`checkout-ui` + `react-query` поверх того самого metahub-репозиторію (`Catalog`+`Order`, scope=hub_id).

## Антипатерни (уникати)

- ❌ Лишати `export const supabase` як «тимчасовий компроміс» — це і є джерело зв'язаності.
- ❌ Хуки/компоненти, що імпортують клієнт напряму замість `useEngine()`.
- ❌ Над-узагальнювати pricing/stock у «generic object engine» — домен переважує; генерик лише для storefront/SEO/listing.
- ❌ Нав'язувати схему рантаймом — reference-схема постачається як версіонований blueprint, host адаптує scope.
- ❌ Дублювати orders-домен між simplyCMS і MetaHub без рішення по тенантності (див. open question).

## Definition of Done (overall)

- [x] `@simplysoftua/objects` з усіма портами; 0 runtime deps.
- [x] `@simplysoftua/domain` (single, subpath) — pure, з тестами.
- [x] `grep "import { supabase }"` по ядру = 0; singleton прибрано. _(P3 — ✅; ~80 call-sites на `useSupabaseClient`)_
- [x] `@simplysoftua/react-query` з `EngineProvider`/`useEngine`; тест із mock-repo. _(пакет+фабрики+hook-тест через EngineProvider ✅; провайдер змонтовано в `__root`; міграція наявних споживачів на useEngine — поступово)_
- [~] `storefront` пакет з loaders+seo; simplyCMS-app на ньому. _(пакет+міграція app ✅; параметризація сирим client, не repo/EngineContext)_
- [x] feature-ui розділено на 5 `*-ui` пакетів. _(P7 — структурно ✅; presentational/container split — `cart-ui` готово, решта інкрементально)_
- [~] `admin` на портах+LinkResolver. _(P8 — LinkResolver ✅ хардкод прибрано; admin-on-repositories — разом із P7)_
- [~] `runtime`/`defineConfig` збирає simplyCMS повністю; `typecheck`/`lint`/`build`/`test` зелені. _(пакет `@simplysoftua/runtime` + reference-збірка `src/server/engine.ts` ✅; checks зелені; але runtime ще не підключено до live-маршрутів)_
- [x] CI публікує пакети (Packages) + subtree-флоу робочий. _(tsup-build + `publish-packages.yml` для Tier 0/1/2 + `cms:remote` репоінт ✅; `core`/`storefront`/`*-ui` — окремий крок)_
- [x] `completed/migration-phase0-decouple-packages.md` має amendment про superseded singleton-рішення.

## Пов'язана документація

- `docs/architecture/core-engine-extraction.md` — дизайн (першоджерело)
- `docs/tasks/completed/migration-phase0-decouple-packages.md` — superseded singleton/adapter рішення (див. amendment)
- `.github/instructions/data-access.instructions.md` — Supabase client patterns (оновити під DI)
- `.github/instructions/architecture-core.instructions.md`
