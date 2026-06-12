import { type CartItem as CartItemType, useCart } from "@simplysoftua/react-query";
import { CartItemView } from "./CartItemView";

interface CartItemProps {
  item: CartItemType;
}

// Container: бере дії з useCart() і делегує рендер presentational-в'ю.
export function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart();

  return (
    <CartItemView
      item={item}
      onChangeQuantity={(quantity) =>
        updateQuantity(item.productId, item.modificationId, quantity)
      }
      onRemove={() => removeItem(item.productId, item.modificationId)}
    />
  );
}
