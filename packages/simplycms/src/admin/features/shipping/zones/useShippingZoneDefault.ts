import { useQueryClient } from '@tanstack/react-query';
import {
  invalidateShippingConsumers,
  shippingZonesCollection,
  useCollection,
} from 'simplycms/admin-data';
import { setDefaultShippingZone } from 'simplycms/admin-server';

/**
 * Призначення дефолтної зони: іменована операція міняє N рядків (знятий
 * дефолт + новий) і повертає їх усі — write-back без refetch. Хук працює
 * ПОЗА колекцією (як `usePriceTypeDefault`), тож persistence-хендлер не
 * інвалідує вітринні кеші за нього: довідник доставки, склади й точки
 * (Е6а-14) інвалідуються тут, одразу після write-back.
 */
export function useShippingZoneDefault(): (id: string) => Promise<void> {
  const zones = useCollection(shippingZonesCollection);
  const queryClient = useQueryClient();
  return async (id) => {
    const { rows } = await setDefaultShippingZone({ data: { id } });
    zones.utils.writeBatch(() => {
      for (const row of rows) zones.utils.writeUpsert(row);
    });
    await invalidateShippingConsumers(queryClient);
  };
}
