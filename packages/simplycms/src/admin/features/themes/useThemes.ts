import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import {
  activateTheme,
  listThemes,
  saveThemeSettings,
  type ThemeRow,
} from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';

const KEY = entityKey(ENTITY.themes).all();

/** Плоский словник налаштувань теми — форма, яку приймає `saveThemeSettings`. */
export type ThemeSettingsValues = Record<string, string | number | boolean>;

/**
 * Теми адмінки (Е6б-15/16/19): короткий список — `useQuery`, не колекція.
 * Мутації пишуть ВІДПОВІДЬ сервера в кеш (write-back): активація повертає весь
 * список, бо зміна зачіпає два рядки, і бейдж переїжджає без refetch.
 *
 * Е6б-22: після успіху — `router.invalidate()`, бо лоадер `_storefront` має
 * staleTime 5 хв і перехід на вітрину в цій вкладці показав би стару тему.
 * Fire-and-forget (`void`): збій скидання кешу роутера не робить успішне
 * збереження помилкою для `mutateAsync`.
 */
export function useThemes() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const query = useQuery({ queryKey: KEY, queryFn: () => listThemes() });

  const activate = useMutation({
    mutationFn: async (name: string) => {
      const rows = await activateTheme({ data: { name } });
      queryClient.setQueryData<ThemeRow[]>(KEY, rows);
      return rows;
    },
    onSuccess: () => {
      void router.invalidate();
    },
  });

  const saveSettings = useMutation({
    mutationFn: async (data: {
      name: string;
      settings: ThemeSettingsValues;
    }) => {
      const row = await saveThemeSettings({ data });
      queryClient.setQueryData<ThemeRow[]>(KEY, (old) =>
        old?.map((theme) => (theme.name === row.name ? row : theme)),
      );
      return row;
    },
    onSuccess: () => {
      void router.invalidate();
    },
  });

  return { query, activate, saveSettings };
}
