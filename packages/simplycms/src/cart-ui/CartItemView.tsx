import type { ReactNode } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { MAX_LINE_QUANTITY } from 'simplycms/contracts/cart-limits';
import type { CartQuoteLine } from 'simplycms/contracts';
import type { CartItem as CartItemType } from 'simplycms/react-query';
import { useT } from 'simplycms/i18n';
import { CartLinePrice } from './CartLinePrice';

// Presentational-компонент позиції кошика: лише props, без data/стану.
// HUB може реюзати його зі своїм контейнером.
export interface CartItemViewProps {
  item: CartItemType;
  /**
   * Рядок серверної квоти (Е6в-13): ціна, база, знижки. `null` — квоти ще
   * немає. Квоту дає T5-контейнер: `cart-ui` serverFn не імпортує.
   */
  line: CartQuoteLine | null;
  /** Порогові підказки рядка — готовий вузол від T5-контейнера. */
  hints?: ReactNode;
  onChangeQuantity: (quantity: number) => void;
  onRemove: () => void;
}

export function CartItemView({
  item,
  line,
  hints,
  onChangeQuantity,
  onRemove,
}: CartItemViewProps) {
  const t = useT();

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
              <p className="text-xs text-muted-foreground">
                {t('cart.itemSku', { sku: item.sku })}
              </p>
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
              className="h-7 w-7 flex items-center justify-center border rounded disabled:opacity-50"
              disabled={item.quantity >= MAX_LINE_QUANTITY}
              onClick={() => onChangeQuantity(item.quantity + 1)}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <CartLinePrice line={line} hints={hints} />
        </div>
      </div>
    </div>
  );
}
