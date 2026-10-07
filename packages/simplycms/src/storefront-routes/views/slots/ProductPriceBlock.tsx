import { DiscountHints } from 'simplycms/catalog-ui/DiscountHints';
import type { ThresholdHint } from 'simplycms/contracts';
import { PRODUCT_DETAIL_REQUISITES } from 'simplycms/contracts/views';
import { useFormatPrice } from 'simplycms/react-query';
import { cn } from 'simplycms/ui/utils';

export interface ProductPriceBlockProps {
  className?: string;
  /** Поточна ціна; `undefined` — ціни немає (купівля теж недоступна). */
  price?: number;
  /** Ціна до знижки; показується лише коли більша за поточну. */
  oldPrice?: number | null;
  /** Порогові підказки знижок (Е6в-12): «від 3 шт — 900 ₴/шт». */
  hints?: readonly ThresholdHint[];
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
  hints = [],
}: ProductPriceBlockProps) {
  const formatPrice = useFormatPrice();

  return (
    <div
      data-simplycms-requisite={PRODUCT_DETAIL_REQUISITES.PriceBlock}
      className={cn('flex flex-wrap items-baseline gap-x-3', className)}
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
      {/* Підказки — окремим рядком під ціною, а не в її базовій лінії. */}
      <DiscountHints hints={hints} className="basis-full mt-1 text-sm" />
    </div>
  );
}
