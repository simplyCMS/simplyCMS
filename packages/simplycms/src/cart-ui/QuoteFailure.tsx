import { useT } from 'simplycms/i18n';
import { cn } from 'simplycms/ui/utils';

export interface QuoteFailureProps {
  /** Повторити запит квоти (`useCartQuote().refetch`). */
  onRetry: () => void;
  className?: string;
}

/**
 * Збій серверної квоти (Е6в-13): видиме повідомлення й «Повторити».
 *
 * 🔴 Не скелет: скелет обіцяє, що число от-от зʼявиться, а після збою
 * мережі чи 500 воно не зʼявиться ніколи — покупець має бачити, що ціну
 * отримати не вдалося, і мати як спробувати ще раз.
 */
export function QuoteFailure({ onRetry, className }: QuoteFailureProps) {
  const t = useT();
  return (
    <div
      role="alert"
      className={cn(
        'flex items-center justify-between gap-2 text-sm text-destructive',
        className,
      )}
    >
      <span>{t('cart.quoteFailed')}</span>
      <button
        type="button"
        onClick={onRetry}
        className="px-3 py-1 border rounded-md text-foreground hover:bg-muted"
      >
        {t('cart.quoteRetry')}
      </button>
    </div>
  );
}
