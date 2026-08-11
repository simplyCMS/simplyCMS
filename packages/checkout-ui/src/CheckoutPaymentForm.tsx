import { useT } from '@simplycms/i18n';
import { CreditCard, Banknote } from 'lucide-react';

interface CheckoutPaymentFormProps {
  selectedMethod: string;
  onMethodChange: (method: string) => void;
}

export function CheckoutPaymentForm({
  selectedMethod,
  onMethodChange,
}: CheckoutPaymentFormProps) {
  const t = useT();

  // Дані способів оплати залежать від локалі — тож масив будується в
  // компоненті, а не на рівні модуля.
  const paymentMethods = [
    {
      id: 'cash',
      name: t('checkout.payment.cash'),
      description: t('checkout.payment.cashDescription'),
      icon: Banknote,
    },
    {
      id: 'online',
      name: t('checkout.payment.online'),
      description: t('checkout.payment.onlineDescription'),
      icon: CreditCard,
      disabled: true,
    },
  ];

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
          {paymentMethods.map((method) => (
            <label
              key={method.id}
              className={`flex items-center gap-4 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                method.disabled ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                selectedMethod === method.id
                  ? 'border-primary'
                  : 'border-muted hover:bg-accent'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={method.id}
                checked={selectedMethod === method.id}
                onChange={() => !method.disabled && onMethodChange(method.id)}
                disabled={method.disabled}
                className="sr-only"
              />
              <method.icon className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium">{method.name}</div>
                <div className="text-sm text-muted-foreground">
                  {method.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
