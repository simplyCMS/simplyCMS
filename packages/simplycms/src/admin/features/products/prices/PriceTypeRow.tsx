import { Input } from 'simplycms/ui/input';
import { TableCell, TableRow } from 'simplycms/ui/table';
import { useT } from 'simplycms/i18n';
import type { PriceDraft } from './usePrices';

interface Props {
  readonly priceTypeId: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly value: PriceDraft[string];
  readonly hasError: boolean;
  readonly onChange: (field: 'price' | 'oldPrice', value: string) => void;
}

/** Один рядок редактора цін (Task 8, Step 1) — виніс із `PricesEditor.tsx` (канон 150 рядків). */
export function PriceTypeRow({
  priceTypeId,
  name,
  isDefault,
  value,
  hasError,
  onChange,
}: Props) {
  const t = useT();
  return (
    <TableRow>
      <TableCell className="font-medium">
        {name}
        {isDefault && (
          <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
            {t('common.byDefaultShort')}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Input
          id={`price-${priceTypeId}`}
          type="text"
          inputMode="decimal"
          value={value.price}
          onChange={(e) => onChange('price', e.target.value)}
          placeholder="0"
          className={`w-32 ${hasError ? 'border-destructive' : ''}`}
        />
        {hasError && (
          <p className="text-xs text-destructive mt-1">
            {t('admin.products.prices.invalid')}
          </p>
        )}
      </TableCell>
      <TableCell>
        <Input
          id={`old-price-${priceTypeId}`}
          type="text"
          inputMode="decimal"
          value={value.oldPrice}
          onChange={(e) => onChange('oldPrice', e.target.value)}
          placeholder="0"
          className="w-32"
        />
      </TableCell>
    </TableRow>
  );
}
