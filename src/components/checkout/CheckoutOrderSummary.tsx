import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { CartItem } from "@/hooks/useCart";
import { ShoppingBag, Loader2 } from "lucide-react";
import { formatShippingCost } from "@/lib/shipping";

interface CheckoutOrderSummaryProps {
  items: CartItem[];
  totalPrice: number;
  shippingCost?: number;
  form: UseFormReturn<any>;
  isSubmitting: boolean;
}

export function CheckoutOrderSummary({
  items,
  totalPrice,
  shippingCost = 0,
  form,
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
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          Ваше замовлення
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
                  {item.quantity} × {formatPrice(item.price)}
                </div>
              </div>
              <div className="font-medium ml-4">
                {formatPrice(item.price * item.quantity)}
              </div>
            </div>
          ))}
        </div>

        <Separator />

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

        <Separator />

        <div className="flex justify-between font-semibold text-lg">
          <span>Разом</span>
          <span className="text-primary">{formatPrice(totalWithShipping)}</span>
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Коментар до замовлення</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Додаткова інформація..."
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Submit button */}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Оформлення...
            </>
          ) : (
            "Підтвердити замовлення"
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Натискаючи кнопку, ви погоджуєтесь з умовами обслуговування
        </p>
      </CardContent>
    </Card>
  );
}
