import { PRODUCT_DETAIL_REQUISITES } from 'simplycms/contracts/views';
import { StockDisplay } from '@simplycms/core/components/catalog/StockDisplay';
import { ProductReviews } from '@simplycms/core/components/reviews/ProductReviews';
import { cn } from '@simplycms/ui/utils';

export interface ProductStockAvailabilityProps {
  className?: string;
  /** Товар без модифікацій; для товару з модифікаціями — `null`. */
  productId: string | null;
  /** Обрана модифікація; для товару без модифікацій — `null`. */
  modificationId: string | null;
}

/**
 * Реквізит «наявність по точках видачі». Запит робить сам `StockDisplay` —
 * слот віддає лише ідентифікатори, тому тема не може лишити покупця без
 * інформації про залишки.
 */
export function ProductStockAvailability({
  className,
  productId,
  modificationId,
}: ProductStockAvailabilityProps) {
  return (
    <div
      data-simplycms-requisite={PRODUCT_DETAIL_REQUISITES.StockAvailability}
      className={cn('contents', className)}
    >
      <StockDisplay productId={productId} modificationId={modificationId} />
    </div>
  );
}

export interface ProductReviewsBlockProps {
  className?: string;
  productId: string;
}

/** Реквізит «відгуки»: список і форма; дані тягне сам `ProductReviews`. */
export function ProductReviewsBlock({
  className,
  productId,
}: ProductReviewsBlockProps) {
  return (
    <div
      data-simplycms-requisite={PRODUCT_DETAIL_REQUISITES.Reviews}
      className={cn('contents', className)}
    >
      <ProductReviews productId={productId} />
    </div>
  );
}
