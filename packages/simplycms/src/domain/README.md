# @simplycms/domain

Чиста комерційна логіка SimplyCMS: вибір ціни за типом ціни, дерево знижок, наявність
на складі, розрахунок доставки. Tier 1 — жодного IO, Supabase чи React: на вході вже
завантажені дані, на виході число або DTO.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/domain
```

## Що всередині

| Subpath | Ключові функції |
|---------|-----------------|
| `@simplycms/domain` | Реекспорт усіх чотирьох модулів |
| `@simplycms/domain/pricing` | `resolvePrice(prices, priceTypeId, defaultPriceTypeId, modificationId?)` — ціна за типом ціни користувача з відкатом на дефолтний тип |
| `@simplycms/domain/discounts` | `resolveDiscount(basePrice, groups, context)` — обчислює дерево знижок (оператори `and`/`or`/`not`/`min`/`max`), повертає `finalPrice`, застосовані й відхилені |
| `@simplycms/domain/inventory` | `calculateProductAvailability`, `enrichProductsWithAvailability` — та сама семантика, що в RPC `get_stock_info` |
| `@simplycms/domain/shipping` | `calculateShippingCost`, `calculateShipping`, `formatShippingCost`, `findShippingZoneIn` |

Доменні типи реекспортуються з `@simplycms/objects` — тягнути його окремо не обов'язково.

## Приклад

SSR-мапінг рядка каталогу в `@simplycms/storefront-routes` — ціну для списку обирає та сама функція, що й клієнт:

```ts
import { resolvePrice } from '@simplycms/domain/pricing';

const { price } = resolvePrice(
  row.product_prices ?? [],
  ctx.defaultPriceTypeId,
  ctx.defaultPriceTypeId,
  defaultMod?.id ?? null,
);
```

## 🔴 `calculateShippingCost` повертає `-1`, а не `null`

`-1` означає «тариф недоступний для цього замовлення» (сума кошика поза
`min_order_amount`/`max_order_amount` або `calculation_type: 'plugin'`) — це не нульова
вартість. Перевіряйте `cost >= 0`, як це робить `calculateShipping`; `formatShippingCost`
трактує будь-яке від'ємне значення як «За тарифами».

## Ліцензія

MIT
