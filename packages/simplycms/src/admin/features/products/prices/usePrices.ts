import { and, eq, isNull, useLiveQuery } from '@tanstack/react-db';
import {
  priceTypesCollection,
  productPricesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { saveProductPrices } from 'simplycms/admin-server';
import { isMoney, normalizeMoneyInput } from 'simplycms/domain/money';

export type PriceDraft = Record<string, { price: string; oldPrice: string }>;

/**
 * Ціни пари товар/модифікація (Task 8, Step 1). Читання — on-demand зріз
 * (`productId eq` + `modificationId eq`/`isNull`, обидва push-down — Е3-14);
 * запис — ОДИН атомарний `saveProductPrices` (Е3-10) і write-back рядків.
 * Колекція цін — на читання (`admin-data/collections/product-prices.ts`):
 * без `persistenceHandlers`, запис лише цим хуком.
 */
export function usePrices(productId: string, modificationId: string | null) {
  const prices = useCollection(productPricesCollection);
  const types = useCollection(priceTypesCollection);
  const { data: priceTypes } = useLiveQuery((q) =>
    q.from({ t: types }).orderBy(({ t }) => t.sortOrder, 'asc'),
  );
  const { data: rows } = useLiveQuery(
    (q) =>
      q
        .from({ p: prices })
        .where(({ p }) =>
          and(
            eq(p.productId, productId),
            modificationId
              ? eq(p.modificationId, modificationId)
              : isNull(p.modificationId),
          ),
        ),
    [productId, modificationId],
  );

  /** `null` — валідно й збережено; рядок — id типу ціни з невалідним полем. */
  const save = async (draft: PriceDraft): Promise<string | null> => {
    const input: Array<{
      priceTypeId: string;
      price: string;
      oldPrice: string | null;
    }> = [];
    for (const [priceTypeId, v] of Object.entries(draft)) {
      const price = normalizeMoneyInput(v.price);
      // Порожнє поле = «ціни цього типу немає» — рядок у вхід не йде,
      // сервер видалить наявний (Review Focus 4).
      if (price === '') continue;
      const oldPrice = normalizeMoneyInput(v.oldPrice);
      if (!isMoney(price) || (oldPrice !== '' && !isMoney(oldPrice)))
        return priceTypeId;
      input.push({
        priceTypeId,
        price,
        oldPrice: oldPrice === '' ? null : oldPrice,
      });
    }
    const res = await saveProductPrices({
      data: { productId, modificationId, prices: input },
    });
    prices.utils.writeBatch(() => {
      for (const id of res.removedIds) prices.utils.writeDelete(id);
      for (const row of res.rows) prices.utils.writeUpsert(row);
    });
    return null;
  };

  return { priceTypes, rows, save };
}
