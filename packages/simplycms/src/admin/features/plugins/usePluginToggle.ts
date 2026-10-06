import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { setPluginActive, type PluginRow } from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { useT } from 'simplycms/i18n';
import { syncPluginHooks } from 'simplycms/plugins';
import { reportTxError } from '../../lib/report-tx-error';

const KEY = entityKey(ENTITY.plugins).all();

/** `register` модуля впав — БД уже повернуто в «вимкнено». */
class HookSyncError extends Error {
  readonly pluginName: string;
  constructor(pluginName: string, cause: unknown) {
    super(`Plugin "${pluginName}" failed to register hooks`, { cause });
    this.name = 'HookSyncError';
    this.pluginName = pluginName;
  }
}

interface ToggleVars {
  name: string;
  isActive: boolean;
}

/**
 * Перемикання плагіна (Е6б-17): serverFn `setPluginActive` → `syncPluginHooks`.
 *
 * 🔴 Порядок — спершу БД, потім реєстр вкладки: відмова сервера лишає
 * `HookRegistry` незмінним. Якщо ж упала реєстрація хуків, серверний рядок
 * уже «увімкнено», і без відкату БД і вкладка розійшлися б — тому другий
 * виклик `isActive: false` і тост. Кожну відповідь сервера пишемо в кеш
 * (write-back), щоб перемикач показував стан БД, а не намір.
 */
export function usePluginToggle() {
  const t = useT();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ name, isActive }: ToggleVars) => {
      const row = await setPluginActive({ data: { name, isActive } });
      queryClient.setQueryData<PluginRow[]>(KEY, (old) =>
        old?.map((plugin) => (plugin.name === name ? row : plugin)),
      );
      try {
        await syncPluginHooks(name, isActive);
      } catch (error) {
        const rolledBack = await setPluginActive({
          data: { name, isActive: false },
        });
        queryClient.setQueryData<PluginRow[]>(KEY, (old) =>
          old?.map((plugin) => (plugin.name === name ? rolledBack : plugin)),
        );
        throw new HookSyncError(name, error);
      }
      return row;
    },
    onSuccess: (row) =>
      toast.success(
        t(
          row.isActive
            ? 'admin.plugins.activated'
            : 'admin.plugins.deactivated',
        ),
        {
          description: t(
            row.isActive
              ? 'admin.plugins.activatedHint'
              : 'admin.plugins.deactivatedHint',
            { name: row.displayName },
          ),
        },
      ),
    onError: (error) =>
      error instanceof HookSyncError
        ? toast.error(
            t('admin.plugins.registerFailed', { name: error.pluginName }),
          )
        : reportTxError(t, error),
  });

  return {
    toggle: (vars: ToggleVars) => mutation.mutate(vars),
    togglingPlugin: mutation.isPending
      ? (mutation.variables?.name ?? null)
      : null,
  };
}
