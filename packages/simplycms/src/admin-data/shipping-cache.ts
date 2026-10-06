import type { QueryClient } from '@tanstack/react-query';
import { AGGREGATE, ENTITY, entityKey } from 'simplycms/contracts/entities';

/**
 * Кеш доставки/самовивозу ПОЗА колекціями адмінки (Е6а-14): вітринні запити
 * читають ті самі таблиці, але живуть під власними ключами, тож write-back
 * колекції їх не торкається.
 *
 * 🔴 Ключі точок — ТОЧНІ варіанти (`active`/`count`, ті, що ставить
 * `usePickupPoints`/`usePickupPointsCount` у core/hooks), а НЕ префікс
 * `[pickup_points]`: префікс зачепив би й `[pickup_points,'list']` — саму
 * колекцію, і її refetch скасував би write-back (К3-7).
 * `AGGREGATE.stockInfo.key` — префікс навмисно: запити складів мають вигляд
 * `[...key, modificationId, productId]`.
 * Кличеться з `persistenceHandlers` усіх чотирьох колекцій і з хуків
 * іменованих операцій (setDefault зони, remove способів/зон/точок).
 */
export async function invalidateShippingConsumers(
  queryClient: QueryClient,
): Promise<void> {
  const points = entityKey(ENTITY.pickupPoints);
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: AGGREGATE.shippingDirectory.key,
    }),
    queryClient.invalidateQueries({ queryKey: AGGREGATE.stockInfo.key }),
    queryClient.invalidateQueries({ queryKey: points.variant('active') }),
    queryClient.invalidateQueries({ queryKey: points.variant('count') }),
  ]);
}
