import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import {
  getSystemSettings,
  saveStockManagement,
  saveStoreProfile,
} from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import type { StoreProfile } from 'simplycms/contracts/store-profile';

type SystemSettings = Awaited<ReturnType<typeof getSystemSettings>>;

const KEY = entityKey(ENTITY.systemSettings).all();

/**
 * Системні налаштування (Е6б-19): одиничний рядок — `useQuery`, не колекція.
 * Мутації пишуть ВІДПОВІДЬ сервера в кеш (write-back), а не інвалідують його:
 * форма не мерехтить рефетчем, а кеш не розходиться з тим, що зберіг сервер.
 */
export function useSystemSettings() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // cache-sync-ok: це читання (queryFn), а не мутація; правило ловить його лише за іменем без префікса list*
  const query = useQuery({ queryKey: KEY, queryFn: () => getSystemSettings() });

  const saveProfile = useMutation({
    mutationFn: async (data: StoreProfile) => {
      const profile = await saveStoreProfile({ data });
      queryClient.setQueryData<SystemSettings>(KEY, (old) =>
        old ? { ...old, profile } : old,
      );
      return profile;
    },
    onSuccess: () => {
      // Е6б-22: лоадер `_storefront` має staleTime 5 хв — без скидання
      // вітрина в цій вкладці покаже старий профіль. Fire-and-forget: збій
      // скидання кешу роутера не робить успішне збереження помилкою
      // `mutateAsync` (форма показала б тост помилки після запису).
      void router.invalidate();
    },
  });

  const saveStock = useMutation({
    mutationFn: async (decreaseOnOrder: boolean) => {
      const stockManagement = await saveStockManagement({
        data: { decreaseOnOrder },
      });
      queryClient.setQueryData<SystemSettings>(KEY, (old) =>
        old ? { ...old, stockManagement } : old,
      );
      return stockManagement;
    },
  });

  return { query, saveProfile, saveStock };
}
