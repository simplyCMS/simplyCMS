import { useT } from 'simplycms/i18n';
import { CreditCard, Banknote } from 'lucide-react';

interface CheckoutPaymentFormProps {
  selectedMethod: 'cash';
  onMethodChange: (method: 'cash') => void;
}

/**
 * Єдиний спосіб оплати — накладений платіж (Е6а-3): до К5 «онлайн» нічого не
 * робить, тож і опції немає. Список лишився радіо-групою, щоб К5 додала
 * провайдерів оплати без зміни розмітки.
 */
export function CheckoutPaymentForm({
  selectedMethod,
  onMethodChange,
}: CheckoutPaymentFormProps) {
  const t = useT();

  return (
    <div className="border rounded-lg">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {t('profile.order.paymentMethod')}
        </h3>
      </div>
      <div className="p-4">
        <div className="grid gap-3">
          <label
            htmlFor="checkout-payment-cash"
            className={`flex items-center gap-4 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
              selectedMethod === 'cash'
                ? 'border-primary'
                : 'border-muted hover:bg-accent'
            }`}
          >
            <input
              type="radio"
              id="checkout-payment-cash"
              name="paymentMethod"
              value="cash"
              checked={selectedMethod === 'cash'}
              onChange={() => onMethodChange('cash')}
              className="sr-only"
            />
            <Banknote className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium">{t('checkout.payment.cash')}</div>
              <div className="text-sm text-muted-foreground">
                {t('checkout.payment.cashDescription')}
              </div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
