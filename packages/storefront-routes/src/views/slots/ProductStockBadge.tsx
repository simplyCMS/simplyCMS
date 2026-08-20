import { PRODUCT_DETAIL_REQUISITES } from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { Badge } from '@simplycms/ui/badge';
import { cn } from '@simplycms/ui/utils';

export interface ProductStockBadgeProps {
  className?: string;
  /** Статус наявності товару або обраної модифікації. */
  stockStatus: string | null;
}

/**
 * Реквізит «бейдж наявності»: «під замовлення» / «немає в наявності».
 *
 * 🔴 Корінь слота — `display: contents` (клас `contents`): маркер існує
 * завжди, а бокса елемент не створює, тож у flex-ряду бейджі лишаються
 * прямими flex-item-ами і `gap` не зʼїдає порожній слот. Так реквізит видно
 * conformance-у навіть у стані «товар у наявності», коли бейджа немає.
 */
export function ProductStockBadge({
  className,
  stockStatus,
}: ProductStockBadgeProps) {
  const t = useT();
  const isInStock = stockStatus === 'in_stock' || stockStatus === 'on_order';

  return (
    <div
      data-simplycms-requisite={PRODUCT_DETAIL_REQUISITES.StockBadge}
      className={cn('contents', className)}
    >
      {stockStatus === 'on_order' && (
        <Badge
          variant="outline"
          className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20"
        >
          {t('product.onOrder')}
        </Badge>
      )}
      {!isInStock && stockStatus !== 'on_order' && (
        <Badge variant="secondary">{t('product.outOfStock')}</Badge>
      )}
    </div>
  );
}
