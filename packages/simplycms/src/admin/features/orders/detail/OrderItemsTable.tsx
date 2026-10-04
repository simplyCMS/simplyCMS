import type { OrderItem } from 'simplycms/schema/types';
import { useFormatPrice } from 'simplycms/react-query';
import { useT } from 'simplycms/i18n';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import { toAmount } from '../to-amount';
import { OrderItemQuantity } from './OrderItemQuantity';
import { RemoveOrderItemDialog } from './RemoveOrderItemDialog';
import { useOrderItemsEdit } from './useOrderItemsEdit';

/** Знижка позиції з `discountData.applied`; форму читаємо захисно. */
function appliedDiscounts(data: unknown): { name: string; amount: number }[] {
  const applied = (data as { applied?: unknown } | null)?.applied;
  if (!Array.isArray(applied)) return [];
  return applied.map((d: { name?: string; calculatedAmount?: number }) => ({
    name: String(d.name ?? ''),
    amount: Number(d.calculatedAmount ?? 0),
  }));
}

interface Props {
  readonly orderId: string;
  readonly items: OrderItem[];
  /** `false` для скасованого замовлення (Е5б-3): жодних контролів. */
  readonly editable: boolean;
}

/** Позиції замовлення; кількість і видалення — лише якщо `editable` (Е5б-11). */
export function OrderItemsTable({ orderId, items, editable }: Props) {
  const t = useT();
  const edit = useOrderItemsEdit(orderId);
  const fmt = useFormatPrice();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('common.name')}</TableHead>
          <TableHead className="text-right">
            {t('admin.orders.basePrice')}
          </TableHead>
          <TableHead className="text-right">{t('common.price')}</TableHead>
          <TableHead className="text-center">{t('common.quantity')}</TableHead>
          <TableHead className="text-right">{t('common.amount')}</TableHead>
          {editable && <TableHead className="w-12" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const base =
            item.basePrice === null ? null : toAmount(item.basePrice);
          return (
            <TableRow key={item.id}>
              <TableCell>
                <div className="font-medium">{item.name}</div>
                {appliedDiscounts(item.discountData).map((d, i) => (
                  <span
                    key={i}
                    className="inline-block text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded px-1.5 py-0.5 mr-1 mt-1"
                  >
                    {d.name}: -{fmt(d.amount)}
                  </span>
                ))}
              </TableCell>
              <TableCell className="text-right">
                {base !== null && base > toAmount(item.price) ? (
                  <span className="text-muted-foreground line-through">
                    {fmt(base)}
                  </span>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell className="text-right">
                {fmt(toAmount(item.price))}
              </TableCell>
              <TableCell className="text-center">
                {editable ? (
                  <OrderItemQuantity
                    quantity={item.quantity}
                    name={item.name}
                    onCommit={(q) => edit.setQuantity(item.id, q)}
                  />
                ) : (
                  item.quantity
                )}
              </TableCell>
              <TableCell className="text-right font-medium">
                {fmt(toAmount(item.total))}
              </TableCell>
              {editable && (
                <TableCell>
                  {items.length > 1 && (
                    <RemoveOrderItemDialog
                      name={item.name}
                      onConfirm={() => edit.remove(item.id)}
                    />
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
