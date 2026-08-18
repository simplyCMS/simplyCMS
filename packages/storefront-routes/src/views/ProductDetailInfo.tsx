import { Heart, Share2 } from 'lucide-react';
import type {
  ProductDetailSlots,
  ProductDetailSummary,
} from '@simplycms/objects/views';
import { useT } from '@simplycms/i18n';
import { Badge } from '@simplycms/ui/badge';
import { Button } from '@simplycms/ui/button';
import { Separator } from '@simplycms/ui/separator';

/**
 * Права колонка картки: назва, бейджі, ціна, короткий опис, вибір
 * модифікації й дії. Усе комерційне — у реквізитах (`slots`).
 */
export function ProductDetailInfo({
  summary,
  slots,
}: {
  summary: ProductDetailSummary;
  slots: ProductDetailSlots;
}) {
  const t = useT();

  return (
    <div className="space-y-6">
      {/* Реквізит: точка розширення плагінів перед блоком інформації */}
      <slots.PluginBefore />

      {/* Title and badges */}
      <div>
        {summary.discountPercent && (
          <Badge variant="destructive" className="mb-2">
            -{summary.discountPercent}%
          </Badge>
        )}
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold">{summary.name}</h1>
          <div className="flex items-center gap-2 shrink-0 pt-1">
            {/* Реквізити: бейдж наявності + бейджі плагінів */}
            <slots.StockBadge />
            <slots.PluginBadges />
          </div>
        </div>
        {summary.sku && (
          <p className="text-sm text-muted-foreground mt-1">
            {t('product.sku', { sku: summary.sku })}
          </p>
        )}
      </div>

      {/* Реквізит: ціна */}
      <slots.PriceBlock />

      <Separator />

      {/* Short description */}
      {summary.short_description && (
        <p className="text-muted-foreground">{summary.short_description}</p>
      )}

      {/* Реквізит: вибір модифікації */}
      <slots.ModificationSelector />

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {/* Реквізит: додавання в кошик */}
        <slots.AddToCart />
        <Button size="lg" variant="outline">
          <Heart className="h-5 w-5" />
        </Button>
        <Button size="lg" variant="outline">
          <Share2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
