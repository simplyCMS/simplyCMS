import { useT } from 'simplycms/i18n';
import { cn } from 'simplycms/ui/utils';

export interface PricesFailureProps {
  /** Повторити запит середовища цін (`useDiscountEnvironment().refetch`). */
  onRetry: () => void;
  className?: string;
}

/**
 * Збій середовища цін вітрини (F1 фінального рев'ю К3-Е6в): видиме
 * повідомлення й «Повторити» — дзеркало `QuoteFailure` кошика.
 *
 * 🔴 Замість ціни, а не поруч із базовою: база за дефолтним типом для
 * покупця з іншою категорією розійшлася б із кошиком і чеком, а вічна
 * SSR-сітка мовчки вимикала б фільтри й сортування каталогу.
 */
export function PricesFailure({ onRetry, className }: PricesFailureProps) {
  const t = useT();
  return (
    <div
      role="alert"
      className={cn(
        'flex items-center justify-between gap-2 text-sm text-destructive',
        className,
      )}
    >
      <span>{t('catalog.pricesFailed')}</span>
      <button
        type="button"
        onClick={onRetry}
        className="px-3 py-1 border rounded-md text-foreground hover:bg-muted"
      >
        {t('catalog.pricesRetry')}
      </button>
    </div>
  );
}
