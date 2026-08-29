# simplycms/react-query

Мінімальний DI-шар рушія SimplyCMS для React-дерева: `EngineContext`
(посилання + конфіг магазину), клієнтський кошик і формат цін.

🔴 **Шар портів/query-хуків знесений (0.4.1).** Дані вітрини браузер більше
не тягне сам — вони приходять серверними лоадерами `simplycms/storefront`
через `simplycms/db` (`withActor`). `EngineContext` звузився до
`{ links, config }`: жодних `CatalogRepository`/`OrderRepository`, жодного
Supabase-клієнта в цьому шарі.

Шар ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремим пакетом він більше не
постачається: усе ядро приходить одним npm-пакетом `simplycms`, а магазин
створюється скаффолдером `pnpm create simplycms-store`.

## Встановлення

```bash
pnpm add simplycms
```

Вхід цього шару — субшлях `simplycms/react-query`.

`react` (18/19) і `@tanstack/react-query` (5.x, peer для клієнтів, що самі
ведуть кеш) — peer-залежності.

## Що всередині

| Subpath | Що дає |
|---------|--------|
| `simplycms/react-query` | `EngineProvider` / `useEngine` — інжекція `EngineContext` (`links`+`config`) у дерево React; `CartProvider` / `useCart` + тип `CartItem` — клієнтський кошик у `localStorage` (SSR-safe); `useFormatPrice` |
| `simplycms/react-query/queries` | `catalogKeys` — стабільний namespace ключів React Query, яким лоадер і клієнтський кеш домовляються про одну комірку. React не потрібен |

## Приклад

```tsx
// src/engine-provider.tsx магазину — монтування рушія в дереві React
import { EngineProvider } from 'simplycms/react-query';
import type { EngineContext } from 'simplycms/contracts';
import { appLinks, appConfig } from './engine.shared';

export function buildClientEngine(): EngineContext {
  return { links: appLinks, config: appConfig };
}

export function ClientEngineProvider({ children }: { children: ReactNode }) {
  const engine = useMemo(() => buildClientEngine(), []);
  return <EngineProvider value={engine}>{children}</EngineProvider>;
}

// Будь-де нижче:
const { links } = useEngine();
const { items, addItem, totalPrice } = useCart();
```

## Ліцензія

MIT
