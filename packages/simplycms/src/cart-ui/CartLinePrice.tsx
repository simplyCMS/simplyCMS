import type { ReactNode } from 'react';
import type { CartQuoteLine } from 'simplycms/contracts';
import { useT } from 'simplycms/i18n';
import { useFormatPrice } from 'simplycms/react-query';
import { cn } from 'simplycms/ui/utils';

export interface CartLinePriceProps {
  /** Рядок квоти; `null` — квоти ще немає (скелет, а не 0). */
  line: CartQuoteLine | null;
  /** Квота впала: замість вічного скелета — прочерк (помилка — у підсумку). */
  failed?: boolean;
  /** Порогові підказки — рендерить T5-контейнер (`DiscountHints`). */
  hints?: ReactNode;
}

/** Скелет числа: місце під ціну, доки квота не прийшла. */
export function PriceSkeleton({ className }: { className?: string }) {
  return (
    <span
      aria-busy="true"
      className={cn(
        'inline-block h-4 w-16 animate-pulse rounded bg-muted',
        className,
      )}
    />
  );
}

/**
 * Ціна рядка кошика — лише з серверної квоти (Е6в-13): ціна після знижок,
 * закреслена база, назви застосованих знижок і підказки порогів.
 *
 * 🔴 Сума рядка — `price × quantity` САМОЇ квоти: поки на «+» летить нова
 * квота, показується попередня, внутрішньо узгоджена, а не нова кількість
 * на стару ціну.
 */
export function CartLinePrice({ line, failed, hints }: CartLinePriceProps) {
  const t = useT();
  const formatPrice = useFormatPrice();

  if (line === null)
    return failed ? (
      <span className="text-sm text-muted-foreground">—</span>
    ) : (
      <PriceSkeleton />
    );
  if (!line.available) {
    return (
      <div className="text-xs font-medium text-destructive">
        {t('cart.unavailable')}
      </div>
    );
  }

  return (
    <div className="text-right">
      <div className="font-semibold text-sm">
        {formatPrice(line.price * line.quantity)}
      </div>
      {line.basePrice > line.price && (
        <div className="text-xs text-muted-foreground line-through">
          {formatPrice(line.basePrice * line.quantity)}
        </div>
      )}
      {line.quantity > 1 && (
        <div className="text-xs text-muted-foreground">
          {formatPrice(line.price)} &times; {line.quantity}
        </div>
      )}
      {line.applied.length > 0 && (
        <ul className="text-xs text-primary">
          {line.applied.map((discount, index) => (
            // Назви двох знижок можуть збігатися — ключ з індексом.
            <li key={`${index}:${discount.name}`}>{discount.name}</li>
          ))}
        </ul>
      )}
      {hints}
    </div>
  );
}
