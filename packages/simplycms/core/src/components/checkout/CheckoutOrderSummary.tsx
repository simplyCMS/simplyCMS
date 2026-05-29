
import { ShoppingBag, Loader2 } from "lucide-react";
import { type CartItem } from "../../hooks/useCart";
import { formatShippingCost } from "../../lib/shipping";

interface CheckoutOrderSummaryProps {
  items: CartItem[];
  totalPrice: number;
  shippingCost?: number;
  notes: string;
  onNotesChange: (notes: string) => void;
  isSubmitting: boolean;
}

export function CheckoutOrderSummary({
  items,
  totalPrice,
  shippingCost = 0,
  notes,
  onNotesChange,
  isSubmitting,
}: CheckoutOrderSummaryProps) {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const totalWithShipping = totalPrice + shippingCost;

  return (
    <div className="border rounded-lg sticky top-24">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          Ваше замовлення
        </h3>
      </div>
      <div className="p-4 space-y-4">
        {/* Items list */}
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={`${item.productId}-${item.modificationId}`}
              className="flex justify-between text-sm"
            >
              <div className="flex-1">
                <div className="font-medium line-clamp-1">{item.name}</div>
                {item.modificationName && (
                  <div className="text-muted-foreground text-xs">
                    {item.modificationName}
                  </div>
                )}
                <div className="text-muted-foreground">
                  {item.quantity} &times; {formatPrice(item.price)}
                </div>
              </div>
              <div className="font-medium ml-4">
                {formatPrice(item.price * item.quantity)}
              </div>
            </div>
          ))}
        </div>

        <hr />

        {/* Totals */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Товари ({items.length})</span>
            <span>{formatPrice(totalPrice)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Доставка</span>
            <span>{formatShippingCost(shippingCost)}</span>
          </div>
        </div>

        <hr />

        <div className="flex justify-between font-semibold text-lg">
          <span>Разом</span>
          <span className="text-primary">{formatPrice(totalWithShipping)}</span>
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-medium mb-1 block">Коментар до замовлення</label>
          <textarea
            placeholder="Додаткова iнформацiя..."
            className="w-full px-3 py-2 border rounded-md text-sm resize-none"
            rows={3}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          className="w-full py-3 bg-primary text-primary-foreground rounded-md text-sm font-medium flex items-center justify-center"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Оформлення...
            </>
          ) : (
            "Пiдтвердити замовлення"
          )}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          Натискаючи кнопку, ви погоджуєтесь з умовами обслуговування
        </p>
      </div>
    </div>
  );
}
