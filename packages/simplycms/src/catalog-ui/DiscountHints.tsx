import type { ThresholdHint } from 'simplycms/contracts';
import { useT } from 'simplycms/i18n';
import { useFormatPrice } from 'simplycms/react-query';
import { cn } from 'simplycms/ui/utils';

export interface DiscountHintsProps {
  hints: readonly ThresholdHint[];
  className?: string;
}

/**
 * Рядки порогових підказок (Е6в-12): «від 3 шт — 900 ₴/шт (−10%)».
 *
 * 🔴 Головне — ЦІНА на порозі, яку рушій уже порахував (`finalPrice`).
 * Відсоток іде вторинно й лише коли домен його дав (`percentOff !== null` —
 * рівно одна знижка `percent`): −50 ₴, переведені у відсоток, вводять в оману.
 * Компонент нічого не рахує — інакше рядок розійшовся б із квотою кошика.
 *
 * Спільний для картки каталогу, сторінки товару й рядка кошика.
 */
export function DiscountHints({ hints, className }: DiscountHintsProps) {
  const t = useT();
  const formatPrice = useFormatPrice();
  if (hints.length === 0) return null;

  return (
    <ul className={cn('space-y-0.5 text-xs text-muted-foreground', className)}>
      {hints.map((hint) => {
        const price = formatPrice(hint.finalPrice);
        const line =
          hint.kind === 'quantity'
            ? t('product.discountHint.quantity', {
                threshold: hint.threshold,
                price,
              })
            : t('product.discountHint.cartTotal', {
                amount: formatPrice(hint.threshold),
                price,
              });
        const percent =
          hint.percentOff === null
            ? ''
            : t('product.discountHint.percent', { percent: hint.percentOff });
        return (
          <li key={`${hint.kind}:${hint.threshold}`}>
            {line}
            {percent}
          </li>
        );
      })}
    </ul>
  );
}
