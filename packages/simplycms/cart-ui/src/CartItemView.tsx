import { Minus, Plus, X } from "lucide-react";
import type { CartItem as CartItemType } from "@simplysoftua/react-query";

// Presentational-компонент позиції кошика: лише props, без data/стану.
// HUB може реюзати його зі своїм контейнером.
export interface CartItemViewProps {
  item: CartItemType;
  onChangeQuantity: (quantity: number) => void;
  onRemove: () => void;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    minimumFractionDigits: 0,
  }).format(value);
}

export function CartItemView({ item, onChangeQuantity, onRemove }: CartItemViewProps) {
  return (
    <div className="flex gap-4 py-4 border-b last:border-0">
      {/* Image */}
      <div className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-muted">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <span className="text-2xl">&#x1F4E6;</span>
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
              <p className="text-xs text-muted-foreground">Арт: {item.sku}</p>
            )}
          </div>
          <button
            className="h-6 w-6 -mr-2 -mt-1 flex items-center justify-center rounded hover:bg-muted"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-2">
          {/* Quantity controls */}
          <div className="flex items-center gap-1">
            <button
              className="h-7 w-7 flex items-center justify-center border rounded"
              onClick={() => onChangeQuantity(item.quantity - 1)}
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-8 text-center text-sm font-medium">
              {item.quantity}
            </span>
            <button
              className="h-7 w-7 flex items-center justify-center border rounded"
              onClick={() => onChangeQuantity(item.quantity + 1)}
            >
              <Plus className="h-3 w-3" />
            </button>
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
                {formatPrice(item.price)} &times; {item.quantity}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
