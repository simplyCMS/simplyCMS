import { cn } from '@simplycms/ui/utils';
import { Check } from 'lucide-react';
import { useT } from '@simplycms/i18n';

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
  const t = useT();

  if (modifications.length <= 1) {
    return null;
  }

  const getModificationAvailability = (mod: Modification) => {
    const stockInfo = stockByModification[mod.id];
    if (stockInfo) {
      return {
        isAvailable: stockInfo.isAvailable,
        totalQuantity: stockInfo.totalQuantity,
        isOnOrder: mod.stock_status === 'on_order',
      };
    }
    return {
      isAvailable: mod.stock_status !== 'out_of_stock',
      totalQuantity: 0,
      isOnOrder: mod.stock_status === 'on_order',
    };
  };

  return (
    <div className="space-y-3">
      <label className="text-base font-medium">
        {t('product.modification')}
      </label>
      <div className="grid gap-3">
        {modifications.map((mod) => {
          const availability = getModificationAvailability(mod);
          const isUnavailable =
            !availability.isAvailable && !availability.isOnOrder;
          const modPrice = prices[mod.id];
          const isSelected = selectedId === mod.id;

          return (
            <label
              key={mod.id}
              htmlFor={mod.id}
              className={cn(
                'flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50',
                isUnavailable && 'opacity-50 bg-muted/30',
              )}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="modification"
                  value={mod.id}
                  id={mod.id}
                  checked={isSelected}
                  onChange={() => onSelect(mod.id)}
                  className="sr-only"
                />
                <div
                  className={cn(
                    'h-4 w-4 rounded-full border-2 flex items-center justify-center',
                    isSelected
                      ? 'border-primary'
                      : 'border-muted-foreground/50',
                  )}
                >
                  {isSelected && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
                <div>
                  <div
                    className={cn(
                      'font-medium',
                      isUnavailable && 'text-muted-foreground',
                    )}
                  >
                    {mod.name}
                  </div>
                  {mod.sku && (
                    <div className="text-xs text-muted-foreground">
                      {t('product.sku', { sku: mod.sku })}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isUnavailable && (
                  <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {t('product.outOfStock')}
                  </span>
                )}
                {availability.isOnOrder && (
                  <span className="text-xs px-2 py-0.5 rounded border border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
                    {t('product.onOrder')}
                  </span>
                )}
                {availability.isAvailable &&
                  !availability.isOnOrder &&
                  availability.totalQuantity > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded border border-green-500 text-green-600 bg-green-50 dark:bg-green-950/20 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      {t('product.unitsCount', {
                        count: availability.totalQuantity,
                      })}
                    </span>
                  )}

                {modPrice && (
                  <div className="text-right">
                    <div
                      className={cn(
                        'font-bold',
                        isUnavailable
                          ? 'text-muted-foreground'
                          : 'text-primary',
                      )}
                    >
                      {formatPrice(modPrice.price)}
                    </div>
                    {modPrice.oldPrice &&
                      modPrice.oldPrice > modPrice.price && (
                        <div className="text-sm text-muted-foreground line-through">
                          {formatPrice(modPrice.oldPrice)}
                        </div>
                      )}
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
