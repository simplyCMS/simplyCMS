import { useQuery } from '@tanstack/react-query';
import { listLanguages } from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import type { LanguageInfo } from './translation-context';

/** Мови магазину для вкладок картки/діалогу (вимкнені не показуємо), основна — за позначкою. */
export function useCardLanguages() {
  // cache-sync-ok: це читання (queryFn), а не мутація
  return useQuery({
    queryKey: entityKey(ENTITY.languages).variant('admin-card-languages'),
    queryFn: async (): Promise<LanguageInfo[]> => {
      const rows = await listLanguages({ data: {} });
      return rows
        .filter((l) => l.status !== 'disabled')
        .map((l) => ({ code: l.code, name: l.name, isDefault: l.isDefault }));
    },
    staleTime: 60_000,
  });
}
