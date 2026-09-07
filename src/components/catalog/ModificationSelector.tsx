import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type StockStatus = 'in_stock' | 'out_of_stock' | 'on_order';

export interface ModificationStockInfo {
  totalQuantity: number;
  isAvailable: boolean;
}

interface Modification {
  id: string;
  name: string;
  slug: string;
  stock_status?: StockStatus | null;
  sku?: string | null;
}

interface ModificationSelectorProps {
  modifications: Modification[];
  selectedId: string;
  onSelect: (id: string) => void;
  formatPrice: (price: number) => string;
  prices?: Record<string, { price: number; oldPrice: number | null }>;
  stockByModification?: Record<string, ModificationStockInfo>;
}

export function ModificationSelector({
  modifications,
  selectedId,
  onSelect,
  formatPrice,
  prices = {},
  stockByModification = {},
}: ModificationSelectorProps) {
  if (modifications.length <= 1) {
    return null;
  }

  const getModificationAvailability = (mod: Modification) => {
    const stockInfo = stockByModification[mod.id];
    if (stockInfo) {
      return {
        isAvailable: stockInfo.isAvailable,
        totalQuantity: stockInfo.totalQuantity,
        isOnOrder: mod.stock_status === "on_order",
      };
    }
    return {
      isAvailable: mod.stock_status !== "out_of_stock",
      totalQuantity: 0,
      isOnOrder: mod.stock_status === "on_order",
    };
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Модифікація</Label>
      <RadioGroup
        value={selectedId}
        onValueChange={onSelect}
        className="grid gap-3"
      >
        {modifications.map((mod) => {
          const availability = getModificationAvailability(mod);
          const isUnavailable = !availability.isAvailable && !availability.isOnOrder;
          const modPrice = prices[mod.id];

          return (
            <Label
              key={mod.id}
              htmlFor={mod.id}
              className={cn(
                "flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors",
                selectedId === mod.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50",
                isUnavailable && "opacity-50 bg-muted/30"
              )}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value={mod.id} id={mod.id} />
                <div>
                  <div className={cn("font-medium", isUnavailable && "text-muted-foreground")}>
                    {mod.name}
                  </div>
                  {mod.sku && (
                    <div className="text-xs text-muted-foreground">
                      Артикул: {mod.sku}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isUnavailable && (
                  <Badge variant="secondary" className="text-xs">Немає в наявності</Badge>
                )}
                {availability.isOnOrder && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20 text-xs">
                    Під замовлення
                  </Badge>
                )}
                {availability.isAvailable && !availability.isOnOrder && availability.totalQuantity > 0 && (
                  <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50 dark:bg-green-950/20 text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    {availability.totalQuantity} шт
                  </Badge>
                )}

                {modPrice && (
                  <div className="text-right">
                    <div className={cn("font-bold", isUnavailable ? "text-muted-foreground" : "text-primary")}>
                      {formatPrice(modPrice.price)}
                    </div>
                    {modPrice.oldPrice && modPrice.oldPrice > modPrice.price && (
                      <div className="text-sm text-muted-foreground line-through">
                        {formatPrice(modPrice.oldPrice)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
