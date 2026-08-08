# @simplycms/cart-ui

React-компоненти кошика SimplyCMS: кнопка з лічильником, висувна панель і
позиція кошика. Контейнери беруть дані й дії з `useCart()`,
presentational-в'ю — лише props, щоб тема могла підмінити рендер.

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/cart-ui
```

Peer-залежності: `react` (18/19), `@tanstack/react-router`, `lucide-react`;
стан кошика приходить із `@simplycms/react-query`.

## Що всередині

| Експорт | Що це |
|---------|-------|
| `CartButton` | Кнопка «Кошик» із бейджем `totalItems` (`99+` при переповненні), відкриває drawer |
| `CartDrawer` | Панель кошика: позиції, сума, порожній стан, переходи на `/cart` і `/checkout` |
| `CartItem` | Контейнер позиції: бере `updateQuantity` / `removeItem` з `useCart()` і делегує рендер |
| `CartItemView`, `CartItemViewProps` | Presentational-в'ю позиції: `item` + `onChangeQuantity` + `onRemove`, без стану й без даних |

Те саме доступне окремими subpath-ами (`exports` має `"./*"`):
`import { CartDrawer } from '@simplycms/cart-ui/CartDrawer'`.

## Приклад

Header теми (`themes/default/components/Header.tsx`) монтує drawer один раз, а
відкриває його через стан кошика:

```tsx
import { CartDrawer } from '@simplycms/cart-ui';
import { useCart } from '@simplycms/react-query';

export function Header() {
  const { totalItems, setIsOpen } = useCart();
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Кошик ({totalItems})</button>
      <CartDrawer />
    </>
  );
}
```

## 🔴 Потрібен `CartProvider`

Усе, крім `CartItemView`, викликає `useCart()` — поза `<CartProvider>`
(`@simplycms/react-query`; у магазині його ставить `CMSProvider`) компонент
кидає `useCart must be used within a CartProvider`. `CartDrawer` ще й лінкує
типізованими `Link` на `/cart`, `/checkout`, `/catalog` — ці роути дає
`@simplycms/storefront-routes`.

## Ліцензія

MIT
