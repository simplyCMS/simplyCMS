import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listMailOutbox, retryMailOutbox } from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';

const KEY = entityKey(ENTITY.mailOutbox).all();

/**
 * Хвости пошти (Е8-Р10): одиничний список — `useQuery`, не колекція
 * `admin-data`. Повтор інвалідує список, а не пише в кеш: що саме лишилось
 * після нього, знає лише сервер.
 */
export function useMailOutbox() {
  const queryClient = useQueryClient();
  // cache-sync-ok: це читання (queryFn), а не мутація; правило ловить його лише за іменем без префікса list*
  const query = useQuery({ queryKey: KEY, queryFn: () => listMailOutbox() });
  const retry = useMutation({
    mutationFn: () => retryMailOutbox(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
  return { query, retry };
}
