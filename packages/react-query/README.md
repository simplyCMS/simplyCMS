# @simplycms/react-query

TanStack Query-хуки й фабрики query-опцій для рушія SimplyCMS. Дані беруться
виключно з портів `EngineContext` (`CatalogRepository`, `OrderRepository`) —
пакет ніколи не імпортує Supabase напряму.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/react-query
```

`react` (18/19) і `@tanstack/react-query` (5.x) — peer-залежності.

## Що всередині

| Subpath | Що дає |
|---------|--------|
| `@simplycms/react-query` | `EngineProvider` / `useEngine` — інжекція `EngineContext` у дерево React; `CartProvider` / `useCart` + тип `CartItem` — клієнтський кошик у `localStorage` (SSR-safe); хуки `useProduct`, `useProducts`, `useSections`, `useProperties`, `useStockInfo`, `useOrder`, `useOrders` |
| `@simplycms/react-query/queries` | `catalogQueries` / `orderQueries` — фабрики query-опцій поверх портів; `catalogKeys` / `orderKeys` — стабільний namespace ключів кешу. React не потрібен — придатне для лоадерів і тестів |

## Приклад

```tsx
// src/engine-provider.tsx магазину — монтування рушія в дереві React
import { EngineProvider } from '@simplycms/react-query';

export function ClientEngineProvider({ children }: { children: ReactNode }) {
  const client = useSupabaseClient();
  const engine = useMemo(() => buildClientEngine(client), [client]);
  return <EngineProvider value={engine}>{children}</EngineProvider>;
}

// Будь-який компонент нижче бере дані лише через порт-хуки:
const { data: product } = useProduct('widget');
const { items, addItem, totalPrice } = useCart();
```

## 🔴 Порт `orders` — опційний

`useOrder` / `useOrders` кидають `OrderRepository is not configured in
EngineContext`, якщо адаптер замовлень не переданий (`orders?:` у контракті).
`useEngine` поза `<EngineProvider>` теж кидає — мовчазного дефолту немає.

## Ліцензія

MIT
