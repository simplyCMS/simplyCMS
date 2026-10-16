import { useQuery } from '@tanstack/react-query';
import { getProduct, listLanguages } from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import type { LanguageInfo } from '../../translations/translation-context';

/** Ключ агрегата: варіант `products` (ENTITY — імена таблиць) + id товару. */
export const productAggregateKey = (id: string) =>
  entityKey(ENTITY.products).variant('admin-aggregate', id);

/**
 * Агрегат товару (`products.get`). Без фонових перечитувань: форма живе
 * поверх завантаженого знімка, і мовчазна підміна його під руками дала б
 * хибну різницю при збереженні; перечитує лише сама картка (`refetch`).
 */
export function useProductAggregate(id: string, enabled: boolean) {
  // cache-sync-ok: це читання (queryFn), а не мутація
  return useQuery({
    queryKey: productAggregateKey(id),
    queryFn: () => getProduct({ data: { id } }),
    enabled,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** Мови магазину для вкладок картки (вимкнені не показуємо), основна — перша за позначкою. */
export function useProductLanguages() {
  // cache-sync-ok: це читання (queryFn), а не мутація
  return useQuery({
    queryKey: entityKey(ENTITY.languages).variant('admin-product-card'),
    queryFn: async (): Promise<LanguageInfo[]> => {
      const rows = await listLanguages({ data: {} });
      return rows
        .filter((l) => l.status !== 'disabled')
        .map((l) => ({ code: l.code, name: l.name, isDefault: l.isDefault }));
    },
    staleTime: 60_000,
  });
}
