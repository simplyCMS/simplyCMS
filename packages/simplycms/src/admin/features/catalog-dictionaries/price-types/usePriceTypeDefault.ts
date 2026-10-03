import { priceTypesCollection, useCollection } from 'simplycms/admin-data';
import { setDefaultPriceType } from 'simplycms/admin-server';

/**
 * Призначення дефолтного типу ціни: іменована операція міняє N рядків
 * (знятий дефолт + новий) і повертає їх усі — write-back без refetch.
 */
export function usePriceTypeDefault(): (id: string) => Promise<void> {
  const types = useCollection(priceTypesCollection);
  return async (id) => {
    const { rows } = await setDefaultPriceType({ data: { id } });
    types.utils.writeBatch(() => {
      for (const row of rows) types.utils.writeUpsert(row);
    });
  };
}
