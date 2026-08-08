# @simplycms/objects

Контракти доменних об'єктів (`Product`, `Order`, `DiscountGroup`, …) і порти рушія —
інтерфейси репозиторіїв та провайдерів, які реалізує шар даних. Tier 0: тільки типи,
нуль залежностей, без Supabase й React.

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

## 🔴 Рантайм-експортів тут немає жодного

Усе, що віддає пакет, — `interface` і `type`; імпортуйте через `import type`.
Значень, які можна викликати чи покласти в бандл, у ньому не існує.

## Ліцензія

MIT
