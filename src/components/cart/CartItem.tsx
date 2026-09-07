import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartItem as CartItemType, useCart } from "@/hooks/useCart";

interface CartItemProps {
  item: CartItemType;
}

export function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart();

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex gap-4 py-4 border-b last:border-0">
      {/* Image */}
      <div className="w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-muted">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <span className="text-2xl">📦</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-medium text-sm leading-tight line-clamp-2">
              {item.name}
            </h4>
            {item.modificationName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.modificationName}
              </p>
            )}
            {item.sku && (
              <p className="text-xs text-muted-foreground">
                Арт: {item.sku}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mr-2 -mt-1"
            onClick={() => removeItem(item.productId, item.modificationId)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between mt-2">
          {/* Quantity controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                updateQuantity(item.productId, item.modificationId, item.quantity - 1)
              }
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-8 text-center text-sm font-medium">
              {item.quantity}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                updateQuantity(item.productId, item.modificationId, item.quantity + 1)
              }
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Price */}
          <div className="text-right">
            <div className="font-semibold text-sm">
              {formatPrice(item.price * item.quantity)}
            </div>
            {item.basePrice && item.basePrice > item.price && (
              <div className="text-xs text-muted-foreground line-through">
                {formatPrice(item.basePrice * item.quantity)}
              </div>
            )}
            {item.quantity > 1 && (
              <div className="text-xs text-muted-foreground">
                {formatPrice(item.price)} × {item.quantity}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
