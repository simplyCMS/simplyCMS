import { ShoppingBag, Loader2 } from 'lucide-react';
import type { QuoteCheckoutResult } from 'simplycms/contracts';
import { useT } from 'simplycms/i18n';
import { CheckoutQuoteDetails } from './CheckoutQuoteDetails';
import { REJECTION_KEY } from './rejection-key';

interface CheckoutOrderSummaryProps {
  /** `null` — квоти ще немає (перший рендер або гейт `hydrated`). */
  quote: QuoteCheckoutResult | null;
  quoting: boolean;
  /** Квота відповідає ПОТОЧНИМ входам (рев'ю #6) — `false` у вікні дебаунсу. */
  matchesCurrent: boolean;
  /** Метод/точку/місто ще не обрано — нема що рахувати (рев'ю I2/I3). */
  blocked: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
  isSubmitting: boolean;
  /** `false` — submit вимкнено: немає доставки, немає свіжої вдалої квоти. */
  canSubmit: boolean;
}

/**
 * Підсумок замовлення — рядки, суми й «до сплати» показує КВОТА сервера, не
 * клієнтський кошик (розділ M рішень архітектора): «показане = записане»
 * тримається за побудовою, бо і квота, і запис рахує та сама
 * `prepareCheckout`. Поки квоти немає — СКЕЛЕТ (не нулі, які виглядали б як
 * реальна відповідь); відмова квоти показується тут-таки, до сабміту, тим
 * самим `REJECTION_KEY`, яким оформлення показує тост на власну відмову.
 */
export function CheckoutOrderSummary({
  quote,
  quoting,
  matchesCurrent,
  blocked,
  notes,
  onNotesChange,
  isSubmitting,
  canSubmit,
}: CheckoutOrderSummaryProps) {
  const t = useT();

  return (
    <div className="border rounded-lg sticky top-24">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          {t('checkout.orderSummary.title')}
        </h3>
      </div>
      <div className="p-4 space-y-4">
        {blocked ? (
          // 🔴 Рев'ю I2/I3: НЕ скелет (нема чого чекати — запит навіть не
          // йде, `useCheckoutQuote` це знає наперед) і НЕ червона відмова
          // (це нормальний проміжний стан заповнення форми, не помилка).
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('checkout.orderSummary.awaitingDelivery')}
          </p>
        ) : quote === null || quoting || !matchesCurrent ? (
          // `!matchesCurrent` — рев'ю #6: без цього у вікні дебаунсу тут
          // показувались би числа ПОПЕРЕДНЬОЇ квоти як актуальні (гроші в
          // безпеці — submit і так заблокований, але показ був би неточний).
          <div className="space-y-3">
            <div className="animate-pulse h-4 w-full bg-muted rounded" />
            <div className="animate-pulse h-4 w-2/3 bg-muted rounded" />
            <div className="animate-pulse h-6 w-1/2 bg-muted rounded" />
          </div>
        ) : quote.ok ? (
          <CheckoutQuoteDetails quote={quote.quote} />
        ) : (
          <p className="text-sm text-destructive" role="alert">
            {t(REJECTION_KEY[quote.reason])}
          </p>
        )}

        {/* Notes */}
        <div>
          <label
            htmlFor="checkout-notes"
            className="text-sm font-medium mb-1 block"
          >
            {t('profile.order.comment')}
          </label>
          <textarea
            id="checkout-notes"
            placeholder={t('checkout.orderSummary.notesPlaceholder')}
            className="w-full px-3 py-2 border rounded-md text-sm resize-none"
            rows={3}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          className="w-full py-3 bg-primary text-primary-foreground rounded-md text-sm font-medium flex items-center justify-center"
          disabled={isSubmitting || !canSubmit}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('checkout.orderSummary.submitting')}
            </>
          ) : (
            t('checkout.orderSummary.submit')
          )}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          {t('checkout.orderSummary.terms')}
        </p>
      </div>
    </div>
  );
}
