import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/hooks/useCart";
import { CartItem } from "./CartItem";

export function CartDrawer() {
  const { items, totalItems, totalPrice, isOpen, setIsOpen } = useCart();

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Кошик
            {totalItems > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({totalItems} {totalItems === 1 ? "товар" : totalItems < 5 ? "товари" : "товарів"})
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">Кошик порожній</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Додайте товари для оформлення замовлення
            </p>
            <Button variant="outline" onClick={() => setIsOpen(false)} asChild>
              <Link to="/catalog">Перейти до каталогу</Link>
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-0">
                {items.map((item) => (
                  <CartItem
                    key={`${item.productId}-${item.modificationId}`}
                    item={item}
                  />
                ))}
              </div>
            </ScrollArea>

            <div className="mt-auto pt-4">
              <Separator className="mb-4" />
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Сума</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between font-medium text-lg">
                  <span>До сплати</span>
                  <span className="text-primary">{formatPrice(totalPrice)}</span>
                </div>
              </div>

              <SheetFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsOpen(false)}
                  asChild
                >
                  <Link to="/cart">Переглянути кошик</Link>
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setIsOpen(false)}
                  asChild
                >
                  <Link to="/checkout">Оформити замовлення</Link>
                </Button>
              </SheetFooter>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
