import { and, eq, isNull, useLiveQuery } from '@tanstack/react-db';
import {
  productModificationsCollection,
  productsCollection,
  stockCollection,
  useCollection,
} from 'simplycms/admin-data';
import { saveStockCommand } from 'simplycms/admin-server';
import type { StockStatus } from 'simplycms/contracts';

/**
 * Ручний облік залишків — команда `products.saveStock` (кількості + гвардований
 * перехід `stockStatus` цілі в одній транзакції). Відповідь не несе рядків, тож
 * після збереження колекції лише для читання (залишки, цільовий товар чи
 * модифікація) перечитуються: інакше бейдж статусу лишався б застарілим.
 * Версію агрегата команда не чіпає.
 */
export function useStock(productId: string, modificationId: string | null) {
  const stock = useCollection(stockCollection);
  const products = useCollection(productsCollection);
  const mods = useCollection(productModificationsCollection);
  const { data: rows } = useLiveQuery({
    query: (q) =>
      q
        .from({ s: stock })
        .where(({ s }) =>
          modificationId
            ? eq(s.modificationId, modificationId)
            : and(eq(s.productId, productId), isNull(s.modificationId)),
        ),
  });

  /** `null` — кількості невалідні; інакше новий статус наявності цілі. */
  const save = async (
    quantities: Record<string, string>,
  ): Promise<{ stockStatus: StockStatus } | null> => {
    const parsed = Object.entries(quantities).map(([pickupPointId, raw]) => ({
      pickupPointId,
      quantity: raw.trim() === '' ? 0 : Number(raw),
    }));
    if (parsed.some((q) => !Number.isInteger(q.quantity) || q.quantity < 0))
      return null;
    const res = await saveStockCommand({
      data: {
        productId: modificationId ? null : productId,
        modificationId,
        quantities: parsed,
      },
    });
    await Promise.all([
      stock.utils.refetch(),
      modificationId ? mods.utils.refetch() : products.utils.refetch(),
    ]);
    return { stockStatus: res.stockStatus };
  };

  return { rows, save };
}
