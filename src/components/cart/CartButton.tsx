import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";

export function CartButton() {
  const { totalItems, setIsOpen } = useCart();

  return (
    <Button
      size="sm"
      className="gradient-brand text-white border-0 gap-2 relative"
      onClick={() => setIsOpen(true)}
    >
      <ShoppingCart className="h-4 w-4" />
      <span className="hidden sm:inline">Кошик</span>
      {totalItems > 0 && (
        <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs font-medium flex items-center justify-center">
          {totalItems > 99 ? "99+" : totalItems}
        </span>
      )}
    </Button>
  );
}
