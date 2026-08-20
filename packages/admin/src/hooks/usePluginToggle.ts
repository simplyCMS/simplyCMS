import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { activatePlugin, deactivatePlugin } from '@simplycms/plugins';
import type { Plugin } from '@simplycms/plugins/types';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useToast } from '@simplycms/core/hooks/use-toast';
import { useT } from 'simplycms/i18n';

/** Спільний ключ кешу списку плагінів (сторінка + мутація toggle). */
export const PLUGINS_QUERY_KEY = ['plugins'] as const;

interface ToggleVars {
  name: string;
  activate: boolean;
}

interface ToggleContext {
  previous: Plugin[] | undefined;
}

/**
 * Перемикання плагіна. Єдиний механізм — lifecycle-функції ядра
 * (`activatePlugin`/`deactivatePlugin`), які пишуть у БД і мутують HookRegistry.
 * Прямий `supabase.from('plugins').update()` лишав би реєстр незмінним, і
 * `PluginSlot` не оновлювався б до перезавантаження сторінки.
 */
export function usePluginToggle() {
  const t = useT();
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [togglingPlugin, setTogglingPlugin] = useState<string | null>(null);

  const mutation = useMutation<void, Error, ToggleVars, ToggleContext>({
    mutationFn: async ({ name, activate }) => {
      const ok = activate
        ? await activatePlugin(supabase, name)
        : await deactivatePlugin(supabase, name);

      if (!ok) throw new Error(t('admin.plugins.toggleFailed', { name }));
    },
    onMutate: async ({ name, activate }) => {
      setTogglingPlugin(name);
      await queryClient.cancelQueries({ queryKey: PLUGINS_QUERY_KEY });

      // Оптимістично: перемикач реагує миттєво…
      const previous = queryClient.getQueryData<Plugin[]>(PLUGINS_QUERY_KEY);
      queryClient.setQueryData<Plugin[]>(PLUGINS_QUERY_KEY, (old) =>
        (old ?? []).map((plugin) =>
          plugin.name === name ? { ...plugin, is_active: activate } : plugin,
        ),
      );

      return { previous };
    },
    onError: (_error, _vars, context) => {
      // …і відкочується, якщо БД відмовила (реєстр при цьому не змінювався).
      if (context?.previous) {
        queryClient.setQueryData(PLUGINS_QUERY_KEY, context.previous);
      }
      toast({
        title: t('common.error'),
        description: t('admin.plugins.toggleFailedShort'),
        variant: 'destructive',
      });
    },
    onSuccess: (_data, { name, activate }) => {
      toast({
        title: t(
          activate ? 'admin.plugins.activated' : 'admin.plugins.deactivated',
        ),
        description: t(
          activate
            ? 'admin.plugins.activatedHint'
            : 'admin.plugins.deactivatedHint',
          { name },
        ),
      });
    },
    onSettled: () => {
      setTogglingPlugin(null);
      void queryClient.invalidateQueries({ queryKey: PLUGINS_QUERY_KEY });
    },
  });

  return { togglePlugin: mutation.mutate, togglingPlugin };
}
