import { Link } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import { useFormatPrice } from 'simplycms/react-query';
import type { Discount } from 'simplycms/schema/types';
import { Badge } from 'simplycms/ui/badge';
import { Button } from 'simplycms/ui/button';
import { cn } from 'simplycms/ui/utils';
import { Pencil, Tag, Trash2 } from 'lucide-react';
import { adminPath } from '../../../lib/adminLinks';

interface Props {
  readonly discount: Discount;
  /** Назва типу ціни; `null` у рядку — знижка для всіх типів (Е6в-2). */
  readonly priceTypeName: string | null;
  readonly onDelete: () => void;
}

/** Знижка під групою: розмір, тип ціни, редагування й видалення. */
export function DiscountRow({ discount, priceTypeName, onDelete }: Props) {
  const t = useT();
  const fmt = useFormatPrice();
  const value = Number(discount.discountValue);
  const amount =
    discount.discountType === 'percent'
      ? `−${value}%`
      : discount.discountType === 'fixed_amount'
        ? `−${fmt(value)}`
        : `= ${fmt(value)}`;
  return (
    <div className="group/discount flex items-center gap-2 py-1.5 pl-6">
      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
      <span
        className={cn(
          'text-sm',
          !discount.isActive && 'text-muted-foreground line-through',
        )}
      >
        {discount.name}
      </span>
      <Badge variant="outline" className="text-xs">
        {amount}
      </Badge>
      <Badge variant="secondary" className="text-xs">
        {discount.priceTypeId === null
          ? t('admin.discounts.allPriceTypes')
          : (priceTypeName ?? t('admin.discounts.missingTarget'))}
      </Badge>
      <div className="ml-auto flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          asChild
          aria-label={t('admin.discounts.editDiscountLabel', {
            name: discount.name,
          })}
        >
          <Link
            to={adminPath('discounts/$discountId')}
            params={{ discountId: discount.id }}
          >
            <Pencil className="h-3 w-3" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label={t('admin.discounts.deleteDiscountLabel', {
            name: discount.name,
          })}
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
