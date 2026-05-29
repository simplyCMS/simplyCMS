# Task: Core Engine Extraction — імплементація headless commerce engine

> Статус: **у роботі** — фундамент закладено (P1, P2, P4-foundation), інвазивні фази (P3, P5–P9) попереду.
> Дизайн-першоджерело: [`docs/architecture/core-engine-extraction.md`](../architecture/core-engine-extraction.md).
> Це **breaking** реструктуризація `packages/simplycms/*` без перехідного adapter-періоду (за духом `migration-phase0`).

## Статус виконання (оновлено 2026-05-29)

| Фаза | Стан | Примітка |
|------|------|----------|
| **P1** `@simplycms/objects` | ✅ **Готово** | Type-only пакет; усі порти + `EngineContext`; 0 runtime deps; subpath `./objects`, `./ports`. |
| **P2** `@simplycms/domain` | ✅ **Готово** | Subpath `./pricing`/`./discounts`/`./inventory`/`./shipping`; pure; 27 unit-тестів (vitest). `core/lib` re-export'ить домен для зворотної сумісності. |
| **P3** `data-supabase` + знесення singleton | ⛔ **Не почато** | Найінвазивніша фаза (31 core + ~50 admin call-sites). Singleton `export const supabase` досі на місці. |
| **P4** `@simplycms/react-query` | 🟡 **Фундамент** | `EngineProvider`/`useEngine` + порт-керовані query-фабрики/хуки + mock-repo тест. Перенесення наявних core-хуків на контекст — попереду (залежить від P3). |
| **P5** `ui`/`theme-system`/`plugins` | ⛔ **Не почато** | — |
| **P6** `@simplycms/storefront` | ⛔ **Не почато** | — |
| **P7** feature-ui split | ⛔ **Не почато** | — |
| **P8** `@simplycms/admin` на портах | ⛔ **Не почато** | 38 хардкодів `/admin/*` ще на місці. |
| **P9** `@simplycms/runtime` | ⛔ **Не почато** | — |
| **P10** дистрибуція / CI | 🟡 **Частково** | Subtree push-команди + `cms:remote` (репоінт на `simplySOFTua`) готові; per-package publish CI — попереду. |

**Перевірки на момент оновлення:** `pnpm typecheck` ✅ · `pnpm lint` ✅ (0 errors) · `pnpm test` ✅ (32 passed) · `pnpm build` ✅.

> Підхід обрано **адитивний на фундаменті**: нові пакети T0/T1 створені й покриті тестами, а `@simplycms/core` тимчасово re-export'ить домен, щоб застосунок лишався зеленим. Інвазивне знесення singleton (P3) та рознесення UI/admin/storefront (P5–P9) — окремими безпечними кроками, бо зачіпають ~80 call-sites і весь app-shell.

## Контекст

Після завершення міграції на TanStack Start ядро `simplycms-core` лишилось «магазином під ключ»: `@simplycms/core` — god-package (11.8k LOC), що змішує об'єкти, pure-логіку, data-доступ, singleton-клієнт і UI; дата-доступ вшитий навіть у UI-компоненти через глобальний `export const supabase`. Це блокує:
- мультитенантне перевикористання (MetaHub scoped по `hub_id`);
- subset-adoption (взяти «тільки товарні механізми» неможливо).

Мета — перетворити ядро на **embeddable commerce engine** з визначеними об'єктами та портами, придатний для трьох збірок: simplyCMS (повна), MetaHub HUB (домен Продукти), MetaHub Marketplace (повна вітрина).

### Зв'язок із наявними задачами

> ⚠️ **Ця задача свідомо реверсує два рішення `migration-phase0-decouple-packages.md`** (для дата-шару):
> - Фаза 0.9: «singleton pattern зберігається» → **скасовано**: singleton прибирається на користь DI/ports.
> - Decision #10: «Жодних adapter-модулів» → **уточнено**: заборона стосувалась router/image-адаптерів під час Next→TanStack міграції; data-access **порти** (репозиторії) тепер дозволені й обов'язкові.
>
> ThemeRegistry-singleton (`phase3`/`phase5`/`theme-switching`) **зберігається** — це інший механізм, не торкається. Див. amendment у `migration-phase0-decouple-packages.md` §«Superseded».

## Прийняті рішення (locked)

1. **Tier 1 — один пакет `@simplycms/domain`** із subpath-exports (`./pricing`, `./discounts`, `./inventory`, `./shipping`). Не дробити на окремі пакети.
2. **HUB — власний репозиторій на `@kit/supabase`** (реалізація порту, scope=`hub_id`). `@simplycms/data-supabase` лишається імплементацією **тільки для simplyCMS**.
3. **Marketplace — повна вітрина** (catalog + cart + checkout + orders) → потрібні `CatalogRepository` **і** `OrderRepository`, перенос orders-схеми з `hub_id`.
4. **Дистрибуція — гібрид per-споживач**: GitHub Packages там, де ядро не правиться локально; Git Subtree там, де можливе допрацювання. CI публікує кожен пакет на семвер-тег **і** лишається subtree-сумісним.

### Лишилось вирішити власнику (не блокує P1–P5)
- Уніфікація `services`/`service_requests` simplyCMS ↔ MetaHub.
- Чи стають orders/заявки маркетплейсу сутністю MetaHub (лінк до `clients`/лідів).

## Цільова структура пакетів

```
T0 @simplycms/objects        контракти об'єктів + порти        0 runtime deps
T1 @simplycms/domain         pricing|discounts|inventory|       deps: objects
                             shipping (subpath exports, pure)
T2 @simplycms/data-supabase  репозиторії на Supabase (DI)        deps: objects, @supabase/*
   @simplycms/react-query    TanStack-Query хуки через контекст  deps: objects, react, @tanstack/react-query
T3 @simplycms/ui             shadcn примітиви (як є)
T4 @simplycms/theme-system   SSR теми (зберігається)
   @simplycms/plugins        hook/slot движок (зберігається)
   @simplycms/storefront     SSR-loaders + SEO (винос з app)     deps: objects, @tanstack/react-start
T5 @simplycms/catalog-ui     ProductCard/Gallery/Filter...       deps: objects, react-query, ui
   @simplycms/cart-ui        cart drawer/button/item
   @simplycms/checkout-ui    checkout forms/summary
   @simplycms/reviews-ui     reviews
   @simplycms/profile-ui     profile (deps: identity)
   @simplycms/admin          admin-kit (на репозиторіях+links)
T6 @simplycms/runtime        defineConfig / wiring адаптерів
```

## Порти (контракти Tier 0) — цільові сигнатури

```ts
// @simplycms/objects/ports
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

> `@simplycms/react-query` експортує `<EngineProvider value={ctx}>` + `useEngine()`. Усі хуки/feature-ui беруть залежності з `useEngine()`, **ніколи** не імпортують `supabase` напряму.

## Фази імплементації

### P1 — `@simplycms/objects` (контракти + порти) — ✅ ГОТОВО
- Створити пакет; винести типи з `core/src/types` та доменні типи з `discountEngine`/`priceUtils`/`shipping`/`useStock`, **відв'язавши від `Database` (рядків БД)** → доменні TS-типи (локальний `Json` замість `Database['Json']`).
- Визначити всі порти (вище) + `EngineContext`.
- DoD: 0 runtime-залежностей; `tsc` зелений; жодного імпорту supabase/react. ✅
- _Реалізація:_ `packages/simplycms/objects/src/{objects,ports}`. Рішення: **type-only** (без zod), щоб строго втримати «0 runtime deps» з DoD; валідаційні zod-схеми за потреби житимуть у domain/data-шарі.

### P2 — `@simplycms/domain` (pure-логіка) — ✅ ГОТОВО
- Перенести `lib/priceUtils` → `./pricing`, `lib/discountEngine` → `./discounts`, stock-calc (`calculateProductAvailability`/`enrich*`) → `./inventory`, `lib/shipping/*` (крім IO) → `./shipping`. ✅
- `shipping/findZone` робить IO → лишити чистий розрахунок у domain (`findShippingZoneIn`), запит винести в `CatalogRepository.getShippingZones` (порт додано; supabase-реалізація — у P3). ✅ (pure-частина)
- DoD: всі функції pure, deps лише `objects`; unit-тести (vitest) на pricing/discount/shipping/availability. ✅ (27 тестів)
- _Реалізація:_ `packages/simplycms/domain/src/*` + `__tests__`. `core/lib/{priceUtils,discountEngine,shipping/calculateRate,shipping/types}` та `hooks/useProductsWithStock` тепер re-export'ять домен.

### P3 — `@simplycms/data-supabase` + знесення singleton 🔴
- Створити `createSupabaseCatalogRepository(client, scope)` / `createSupabaseOrderRepository(...)` — імплементації портів, що приймають **інжектований** client + `ScopeResolver`.
- Прибрати `core/src/supabase/client.ts` глобальний `export const supabase`.
- **Інвентар call-sites для рефакторингу (31 файл core):** hooks (`useStock`,`usePriceType`,`useAuth`,`useBanners`,`useDiscountedPrice`,`useProductReviews`,`useProductsWithStock`), `lib/supabase`, `lib/shipping/findZone`, UI-компоненти (`FilterSidebar`,`CatalogLayout`, profile/*, checkout/*), pages/*. Усі → беруть repo/identity з контексту.
- DoD: `grep "import { supabase }"` по ядру = 0; `import.meta.env` лишається тільки у `data-supabase` фабриці simplyCMS і `runtime`.

### P4 — `@simplycms/react-query` (хуки через контекст) — 🟡 ФУНДАМЕНТ
- Перенести data-частину хуків; кожен хук бере `useEngine()`. 🟡 _нові порт-керовані хуки (`useProduct`/`useProducts`/`useSections`/`useStockInfo`/`useOrder`/…) додані; перенесення наявних core-хуків (`useStock`, `useBanners`, …) — після P3._
- Додати `EngineProvider` + `useEngine`. ✅
- DoD: хуки не знають про конкретну БД; працюють з будь-якою реалізацією порту; тест із mock-репозиторієм. ✅ (`queries.test.ts` з in-memory `CatalogRepository`/`OrderRepository`)
- _Реалізація:_ `packages/simplycms/react-query/src/{EngineProvider.tsx,queries.ts,hooks.ts}`. Логіка запитів — у `queries.ts` (порт-керовані фабрики), хуки — тонка прив'язка до контексту.

### P5 — `ui` / `theme-system` / `plugins` (мінімальні зміни, object-agnostic)
- `ui` — лишити; прибрати випадкові доменні домішки.
- `theme-system` — зберегти ThemeRegistry-singleton (не плутати з supabase); зробити рендер **object-agnostic** (рендерить будь-який зареєстрований тип, не лише товар).
- `plugins` — зберегти; хук-поінти лишаються backbone розширення.
- DoD: theme/plugins не залежать від data-шару напряму.

### P6 — `@simplycms/storefront` (винос SSR/SEO з app-shell)
- Перенести `src/server/*` (createServerFn loaders) → `storefront/loaders`, параметризувавши репозиторієм.
- Перенести `src/seo/*` (sitemap/robots) → `storefront/seo`, генерувати з зареєстрованих об'єктів.
- DoD: маркетплейс може зібрати публічну вітрину, надавши лише `EngineContext`; simplyCMS-app мігрує на пакет.

### P7 — feature-ui (split presentational/container)
- `core/components/{catalog,cart,checkout,reviews,profile}` → відповідні `*-ui` пакети.
- Кожен компонент розділити: **presentational** (props-only) + **container** (через `useEngine()`/хуки).
- DoD: presentational-компоненти не роблять fetch; HUB може реюзати presentational зі своїми контейнерами.

### P8 — `@simplycms/admin` (на репозиторіях + LinkResolver)
- Перевести admin-pages/components на `CatalogRepository`/`OrderRepository` + `LinkResolver` (прибрати хардкод `/admin/*` — 38 місць).
- DoD: admin працює поверх портів; simplyCMS-app зелений.

### P9 — `@simplycms/runtime` (defineConfig / wiring)
- Розширити `defineConfig` з `{supabase}` до `{ adapters:{catalog,orders,scope,identity,links,media,config}, modules:[], theme, plugins }`.
- simplyCMS-app = повна збірка через runtime.
- DoD: `simplycms.config.ts` збирає магазин через адаптери; немає прямих `import.meta.env` поза runtime.

### P10 — дистрибуція / CI
- Per-package `package.json` з `exports` + (для published) build; семвер.
- CI: workflow публікації кожного пакета в GitHub Packages на тег; subtree-сумісність (`cms:pull/push`) збережена.
- DoD: MetaHub може `pnpm add @simplycms/objects@^x @simplycms/domain@^x ...`; subtree-флоу працює для пакетів у розробці.

## Як MetaHub споживає (orientation для HUB-задачі)

- **HUB домен Продукти:** `@simplycms/objects` + `@simplycms/domain` (packages) + **власний `CatalogRepository` на `@kit/supabase`** (scope=hub_id) + reference-схема з `hub_id`; admin на `@kit/ui`; FK `si_products` → `sales_invoices`.
- **Marketplace:** `@simplycms/storefront` + `theme-system` + `catalog-ui`/`cart-ui`/`checkout-ui` + `react-query` поверх того самого metahub-репозиторію (`Catalog`+`Order`, scope=hub_id).

## Антипатерни (уникати)

- ❌ Лишати `export const supabase` як «тимчасовий компроміс» — це і є джерело зв'язаності.
- ❌ Хуки/компоненти, що імпортують клієнт напряму замість `useEngine()`.
- ❌ Над-узагальнювати pricing/stock у «generic object engine» — домен переважує; генерик лише для storefront/SEO/listing.
- ❌ Нав'язувати схему рантаймом — reference-схема постачається як версіонований blueprint, host адаптує scope.
- ❌ Дублювати orders-домен між simplyCMS і MetaHub без рішення по тенантності (див. open question).

## Definition of Done (overall)

- [x] `@simplycms/objects` з усіма портами; 0 runtime deps.
- [x] `@simplycms/domain` (single, subpath) — pure, з тестами.
- [ ] `grep "import { supabase }"` по ядру = 0; singleton прибрано. _(P3 — не почато)_
- [x] `@simplycms/react-query` з `EngineProvider`/`useEngine`; тест із mock-repo.
- [ ] `storefront` пакет з loaders+seo; simplyCMS-app на ньому. _(P6)_
- [ ] feature-ui розділено presentational/container. _(P7)_
- [ ] `admin` на портах+LinkResolver. _(P8)_
- [~] `runtime`/`defineConfig` збирає simplyCMS повністю; `typecheck`/`lint`/`build`/`test` зелені. _(checks зелені вже зараз; сам `runtime`-пакет — P9)_
- [~] CI публікує пакети (Packages) + subtree-флоу робочий. _(subtree-флоу + `cms:remote` репоінт на `simplySOFTua` готові; publish-CI — попереду)_
- [x] `migration-phase0-decouple-packages.md` має amendment про superseded singleton-рішення.

## Пов'язана документація

- `docs/architecture/core-engine-extraction.md` — дизайн (першоджерело)
- `docs/tasks/migration-phase0-decouple-packages.md` — superseded singleton/adapter рішення (див. amendment)
- `.github/instructions/data-access.instructions.md` — Supabase client patterns (оновити під DI)
- `.github/instructions/architecture-core.instructions.md`
