import { useT, type MessageKey } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';

export interface QueryFailureProps {
  /** Ключ пояснення: що саме не завантажилось і що робити. */
  message: MessageKey;
  /** `refetch` запиту сторінки. */
  onRetry: () => void;
}

/**
 * Збій запиту сторінки вітрини (Р26): окремий від «порожньо» / «не знайдено»
 * стан. Без нього відмова мережі чи БД читалась би як «замовлень немає», а
 * після оформлення — як «замовлення не знайдено», і покупець оформлював би
 * його вдруге.
 */
export function QueryFailure({ message, onRetry }: QueryFailureProps) {
  const t = useT();
  return (
    <div role="alert" className="py-12 text-center space-y-4">
      <p className="text-destructive">{t(message)}</p>
      <Button variant="outline" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  );
}
