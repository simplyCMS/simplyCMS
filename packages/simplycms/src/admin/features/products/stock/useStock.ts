import { and, eq, isNull, useLiveQuery } from '@tanstack/react-db';
import {
  productModificationsCollection,
  productsCollection,
  stockCollection,
  useCollection,
} from 'simplycms/admin-data';
import { saveStock } from 'simplycms/admin-server';
import type { Product, ProductModification } from 'simplycms/schema/types';

/**
 * Ручний облік залишків (Task 8, Step 2) — `saveStock` (Е3-3) в одній
 * транзакції пише кількості й гвардовано перераховує `stockStatus` цілі.
 * Write-back іде у ДВІ колекції: залишки і — обовʼязково — рядок цілі
 * (товар або модифікація), інакше бейдж статусу лишався б застарілим без
 * refetch.
 */
export function useStock(productId: string, modificationId: string | null) {
  const stock = useCollection(stockCollection);
  const products = useCollection(productsCollection);
  const mods = useCollection(productModificationsCollection);
  const { data: rows } = useLiveQuery(
    (q) =>
      q
        .from({ s: stock })
        .where(({ s }) =>
          modificationId
            ? eq(s.modificationId, modificationId)
            : and(eq(s.productId, productId), isNull(s.modificationId)),
        ),
    [productId, modificationId],
  );

  const save = async (quantities: Record<string, string>): Promise<boolean> => {
    const parsed = Object.entries(quantities).map(([pickupPointId, raw]) => ({
      pickupPointId,
      quantity: raw.trim() === '' ? 0 : Number(raw),
    }));
    if (parsed.some((q) => !Number.isInteger(q.quantity) || q.quantity < 0))
      return false;
    const res = await saveStock({
      data: {
        productId: modificationId ? null : productId,
        modificationId,
        quantities: parsed,
      },
    });
    stock.utils.writeBatch(() => {
      for (const row of res.rows) stock.utils.writeUpsert(row);
    });
    // 🔴 Статус цілі змінився гвардом на сервері (Е3-3) — пишемо рядок цілі
    // туди, звідки його читає картка, інакше бейдж показав би старий статус.
    // `preload()` СТАРТУЄ sync (як у `useProductSave.create`) — на відміну
    // від `stock` (синк уже стартував власним `useLiveQuery` цього хука),
    // цільова колекція тут лише отримана через `useCollection`, без гарантії
    // підписки.
    // UPSTREAM:TSDB-B1 — docs/architecture/upstream-workarounds.md
    if (modificationId) {
      await mods.preload();
      mods.utils.writeUpsert(res.target as ProductModification);
    } else {
      await products.preload();
      products.utils.writeUpsert(res.target as Product);
    }
    return true;
  };

  return { rows, save };
}
