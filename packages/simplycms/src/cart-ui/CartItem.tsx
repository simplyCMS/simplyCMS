import type { ReactNode } from 'react';
import type { CartQuoteLine } from 'simplycms/contracts';
import { type CartItem as CartItemType, useCart } from 'simplycms/react-query';
import { CartItemView } from './CartItemView';

interface CartItemProps {
  item: CartItemType;
  /** Рядок серверної квоти; `null` — квоти ще немає. */
  line: CartQuoteLine | null;
  /** Порогові підказки — від T5-контейнера, що має квоту. */
  hints?: ReactNode;
}

// Container: бере дії з useCart() і делегує рендер presentational-в'ю.
// Ціну не рахує: рядок квоти приходить пропом від T5-контейнера (Е6в-13).
export function CartItem({ item, line, hints }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart();

  return (
    <CartItemView
      item={item}
      line={line}
      hints={hints}
      onChangeQuantity={(quantity) =>
        updateQuantity(item.productId, item.modificationId, quantity)
      }
      onRemove={() => removeItem(item.productId, item.modificationId)}
    />
  );
}
