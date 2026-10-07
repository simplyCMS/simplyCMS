import { Link } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';

export interface CheckoutActionProps {
  /** У кошику є недоступна позиція — оформлення заблоковано. */
  blocked: boolean;
  onNavigate: () => void;
}

const BUTTON =
  'flex-1 text-center px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm';

/**
 * Перехід до оформлення з drawer'а. Недоступна позиція (Е6в-13) — кнопка
 * вимкнена: сервер однаково відмовив би `not_purchasable`, а пояснення під
 * кнопкою каже, що прибрати.
 */
export function CheckoutAction({ blocked, onNavigate }: CheckoutActionProps) {
  const t = useT();
  if (!blocked) {
    return (
      <Link to="/checkout" onClick={onNavigate} className={BUTTON}>
        {t('cart.summary.checkout')}
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled
      className={`${BUTTON} opacity-50 cursor-not-allowed`}
    >
      {t('cart.summary.checkout')}
    </button>
  );
}
