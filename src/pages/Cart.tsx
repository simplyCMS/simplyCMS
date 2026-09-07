import { Link } from "react-router-dom";
import { ChevronRight, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/hooks/useCart";
import { CartItem } from "@/components/cart/CartItem";

export default function Cart() {
  const { items, totalPrice, clearCart } = useCart();

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors">
          Головна
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Кошик</span>
      </nav>

      <h1 className="text-3xl font-bold mb-8">Кошик</h1>

      {items.length === 0 ? (
        <Card className="max-w-lg mx-auto text-center">
          <CardContent className="pt-12 pb-8">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Кошик порожній</h2>
            <p className="text-muted-foreground mb-6">
              Перегляньте наш каталог та додайте товари, які вас цікавлять
            </p>
            <Button asChild>
              <Link to="/catalog">Перейти до каталогу</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart items */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">
                  Товари ({items.length})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={clearCart}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Очистити кошик
                </Button>
              </CardHeader>
              <CardContent>
                {items.map((item) => (
                  <CartItem
                    key={`${item.productId}-${item.modificationId}`}
                    item={item}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Order summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Підсумок замовлення</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Товарів на суму
                  </span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Доставка</span>
                  <span className="text-muted-foreground">
                    Розраховується при оформленні
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>До сплати</span>
                  <span className="text-primary">{formatPrice(totalPrice)}</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" size="lg" asChild>
                  <Link to="/checkout">Оформити замовлення</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
