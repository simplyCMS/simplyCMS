import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useToast } from '@simplycms/core/hooks/use-toast';
import { useT } from 'simplycms/i18n';
import {
  revalidateFailureDescription,
  useRevalidateStorefront,
} from '../lib/revalidateTheme';

/** Спільний ключ кешу списку тем (сторінка + мутація активації). */
export const THEMES_QUERY_KEY = ['admin-themes'] as const;

/**
 * Активація теми: рівно одна тема в БД може бути активною
 * (`themes_active_idx`), тому спершу знімаємо прапорець з решти, а потім
 * ставимо обраній.
 *
 * Після успіху обовʼязкова ПАРА кроків скидання кешу вітрини
 * (`useRevalidateStorefront`) — серверний кеш і кеш роутера; деталі й гард —
 * `__tests__/revalidate-storefront.test.tsx`.
 */
export function useThemeActivate(onActivated: () => void) {
  const t = useT();
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const revalidateStorefront = useRevalidateStorefront();

  const mutation = useMutation<void, Error, string>({
    mutationFn: async (themeId) => {
      const { error: deactivateError } = await supabase
        .from('themes')
        .update({ is_active: false })
        .neq('id', themeId);
      if (deactivateError) throw deactivateError;

      const { error: activateError } = await supabase
        .from('themes')
        .update({ is_active: true })
        .eq('id', themeId);
      if (activateError) throw activateError;
    },
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: THEMES_QUERY_KEY });
      onActivated();

      try {
        await revalidateStorefront();
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('admin.themes.activatedStale'),
          description: revalidateFailureDescription(t, error),
        });
        return;
      }

      toast({
        title: t('admin.themes.activated'),
        description: t('admin.themes.appliedOnSite'),
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || t('admin.themes.activateFailed'),
      });
    },
  });

  return { activateTheme: mutation.mutate, isActivating: mutation.isPending };
}
