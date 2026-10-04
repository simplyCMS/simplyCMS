import { toast } from 'sonner';
import {
  orderItemsCollection,
  ordersCollection,
  useCollection,
} from 'simplycms/admin-data';
import {
  addOrderItem,
  removeOrderItem,
  updateOrderItemQuantity,
} from 'simplycms/admin-server';
import { useT } from 'simplycms/i18n';
import { reportTxError } from '../../../lib/report-tx-error';

type Action =
  | {
      kind: 'add';
      productId: string;
      modificationId: string | null;
      quantity: number;
    }
  | { kind: 'quantity'; orderItemId: string; quantity: number }
  | { kind: 'remove'; orderItemId: string };

/**
 * Редагування позицій замовлення (Е5б-11): serverFn рахує ціну, доставку й
 * залишок, відповідь — write-back у обидві колекції однією `writeBatch` на
 * колекцію. Оптимістичного стану немає; помилка → тост, колекції незмінні.
 * Один `run` на всі три дії: правило `mutation-cache-sync` вимагає синк у
 * ТІЙ САМІЙ функції, що кличе serverFn. Повертає `true`, якщо зміну збережено.
 */
export function useOrderItemsEdit(orderId: string) {
  const t = useT();
  const orders = useCollection(ordersCollection);
  const items = useCollection(orderItemsCollection);

  const run = async (a: Action): Promise<boolean> => {
    try {
      const res =
        a.kind === 'add'
          ? await addOrderItem({
              data: {
                orderId,
                productId: a.productId,
                modificationId: a.modificationId,
                quantity: a.quantity,
              },
            })
          : a.kind === 'quantity'
            ? await updateOrderItemQuantity({
                data: {
                  orderId,
                  orderItemId: a.orderItemId,
                  quantity: a.quantity,
                },
              })
            : await removeOrderItem({
                data: { orderId, orderItemId: a.orderItemId },
              });
      orders.utils.writeBatch(() => {
        orders.utils.writeUpsert(res.order);
      });
      items.utils.writeBatch(() => {
        for (const row of res.upserted) items.utils.writeUpsert(row);
        for (const id of res.removedIds) items.utils.writeDelete(id);
      });
      toast.success(
        t(
          a.kind === 'add'
            ? 'admin.orders.itemAdded'
            : a.kind === 'remove'
              ? 'admin.orders.itemRemoved'
              : 'admin.orders.updated',
        ),
      );
      return true;
    } catch (e) {
      reportTxError(t, e);
      return false;
    }
  };

  return {
    add: (input: {
      productId: string;
      modificationId: string | null;
      quantity: number;
    }) => run({ kind: 'add', ...input }),
    setQuantity: (orderItemId: string, quantity: number) =>
      run({ kind: 'quantity', orderItemId, quantity }),
    remove: (orderItemId: string) => run({ kind: 'remove', orderItemId }),
  };
}
