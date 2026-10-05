import { createCollection } from '@tanstack/react-db';
import type { QueryClient } from '@tanstack/react-query';
import { collectionKey, ENTITY } from 'simplycms/contracts/entities';
import type { Order } from 'simplycms/schema/types'; // 🔴 type-only (К3-9′)
import { listOrders } from 'simplycms/admin-server';
import type { CollectionDef } from '../registry';
import { onDemandCollectionOptions } from '../on-demand-options';
import { toSubsetPayload } from '../subset-payload';

/**
 * Рядок замовлення в адмінці — БЕЗ `accessToken` (Е5-7): секрет гостьового
 * доступу сервер не віддає ні в SELECT, ні в типі; тут те саме звуження.
 */
export type AdminOrder = Omit<Order, 'accessToken'>;

/**
 * Замовлення ростуть — on-demand (К3-5, Е5-10), лише на ЧИТАННЯ: без
 * `persistenceHandlers`, тож `collection.insert()` кидає за побудовою
 * бібліотеки. Зміна статусу — іменована операція `changeOrderStatus`, чий
 * повернений рядок пишеться сюди write-back-ом (`writeBatch` +
 * `writeUpsert`, К3-7) у тій самій функції мутації.
 *
 * 🔴 Індекс сортування (дефолт фабрики, Е3-16) обовʼязковий: список
 * гортає `useLiveInfiniteQuery` «Показати ще», а без індексу друга
 * сторінка довантажується префіксом `{limit: offset+limit}` без `offset`
 * (читає зайве, TSDB-2). Ліміт сторінки сервера — `maxLimit` 100
 * (Е5-12), стабільний порядок — тай-брейкер `id` фабрики (Е3-8).
 */
function create(queryClient: QueryClient) {
  return createCollection(
    onDemandCollectionOptions<AdminOrder>({
      id: ENTITY.orders,
      queryClient,
      queryKey: collectionKey(ENTITY.orders),
      getKey: (row) => row.id,
      queryFn: async (ctx) =>
        listOrders({
          data: toSubsetPayload(
            ctx.meta?.loadSubsetOptions as Parameters<
              typeof toSubsetPayload
            >[0],
          ),
        }),
    }),
  );
}

export type OrdersCollection = ReturnType<typeof create>;
export const ordersCollection: CollectionDef<OrdersCollection> = {
  id: ENTITY.orders,
  create,
};
