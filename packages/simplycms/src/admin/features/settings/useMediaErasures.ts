import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listMediaErasures, retryMediaErasures } from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';

const KEY = entityKey(ENTITY.mediaErasures).all();

/**
 * Хвости стирання файлів (Е6д-20): одиничний список — `useQuery`, не колекція
 * `admin-data`. Повтор інвалідує список, а не пише в кеш: після нього треба
 * побачити, що саме лишилось, і це знає лише сервер.
 */
export function useMediaErasures() {
  const queryClient = useQueryClient();
  // cache-sync-ok: це читання (queryFn), а не мутація; правило ловить його лише за іменем без префікса list*
  const query = useQuery({ queryKey: KEY, queryFn: () => listMediaErasures() });
  const retry = useMutation({
    mutationFn: () => retryMediaErasures(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
  return { query, retry };
}
