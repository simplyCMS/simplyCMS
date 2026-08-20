# @simplycms/objects

Контракти доменних об'єктів (`Product`, `Order`, `DiscountGroup`, …), порти рушія —
інтерфейси репозиторіїв та провайдерів, які реалізує шар даних, — і view-model-и
канонічних сторінок вітрини (контракт тем v3). Tier 0: нуль рантайм-залежностей,
без Supabase; `react` — опційний type-only peer лише для slot-типів `./views`.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/objects
```

## Що всередині

| Subpath | Що експортує |
|---------|--------------|
| `@simplycms/objects` | Усе разом — реекспорт `./objects` і `./ports` |
| `@simplycms/objects/objects` | Об'єкти домену: `Product`, `ProductModification`, `Section`, `Property`, `Order`, `CreateOrderInput`, `PriceEntry`, `PriceType`, `Discount`, `DiscountGroup`, `StockInfo`, `ShippingZone`, `ShippingRate`, `PickupPoint`, `Banner`, `Identity`, `SeoConfig`, `Paged<T>` |
| `@simplycms/objects/ports` | Порти: `CatalogRepository`, `OrderRepository`, `IdentityProvider`, `LinkResolver`, `MediaProvider`, `ConfigProvider`, `ScopeResolver` — і контейнер `EngineContext`, який їх зводить докупи |
| `@simplycms/objects/views` | View-model-и пʼятьох сторінок вітрини (`HomeViewModel`, `CatalogViewModel`, `CatalogSectionViewModel`, `ProductDetailViewModel`, `CartViewModel`) + рантайм-константи реквізитів (`REQUISITE_ATTRIBUTE`, `HOME_REQUISITES`, `CATALOG_REQUISITES`, `PRODUCT_DETAIL_REQUISITES`, `CART_REQUISITES`, `REQUIRED_REQUISITES`) |
| `@simplycms/objects/views/fixtures` | Фікстури view-model-ів для conformance-kit-а тем — рантайм-обʼєкти, не типи |

## Приклад

Порт `LinkResolver` (`src/engine.shared.ts` шаблону магазину): маршрути задає магазин, ядро їх лише споживає.

```ts
import type { LinkResolver } from '@simplycms/objects';

export const appLinks: LinkResolver = {
  product: (p) =>
    p.sectionSlug ? `/catalog/${p.sectionSlug}/${p.slug}` : `/catalog/${p.slug}`,
  section: (s) => `/catalog/${s.slug}`,
  cart: () => '/cart',
  checkout: () => '/checkout',
  profile: (sub) => (sub ? `/profile/${sub}` : '/profile'),
  auth: () => '/auth',
  admin: (sub) => (sub ? `/admin/${sub}` : '/admin'),
};
```

## 🔴 Рантайм тут мінімальний, але він є

`./objects` і `./ports` — суто `interface` і `type`: імпортуйте їх через
`import type`. Рантайм-значення живуть лише у двох субшляхах: `./views` віддає
константи реквізитів (їх читає conformance-kit тем), а `./views/fixtures` —
обʼєкти-фікстури. Інваріант тіру це не порушує: рантайм-**залежностей** у
пакеті нуль, `react` лишається опційним type-only peer-ом.

## Ліцензія

MIT
