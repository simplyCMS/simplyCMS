import { PRODUCT_DETAIL_REQUISITES } from 'simplycms/contracts/views';
import { useFormatPrice } from 'simplycms/react-query';
import { cn } from 'simplycms/ui/utils';

export interface ProductPriceBlockProps {
  className?: string;
  /** Поточна ціна; `undefined` — ціни немає (купівля теж недоступна). */
  price?: number;
  /** Ціна до знижки; показується лише коли більша за поточну. */
  oldPrice?: number | null;
}

/**
 * Реквізит «ціна товару». Форматування прибіндженe до конфігу магазину
 * (`useFormatPrice` → locale/currency з EngineContext), тому темі лишається
 * саме оформлення: розкладка й типографіка.
 */
export function ProductPriceBlock({
  className,
  price,
  oldPrice,
}: ProductPriceBlockProps) {
  const formatPrice = useFormatPrice();

  return (
    <div
      data-simplycms-requisite={PRODUCT_DETAIL_REQUISITES.PriceBlock}
      className={cn('flex items-baseline gap-3', className)}
    >
      {price !== undefined && (
        <span className="text-4xl font-bold text-primary">
          {formatPrice(price)}
        </span>
      )}
      {oldPrice && price && oldPrice > price && (
        <span className="text-xl text-muted-foreground line-through">
          {formatPrice(oldPrice)}
        </span>
      )}
    </div>
  );
}
