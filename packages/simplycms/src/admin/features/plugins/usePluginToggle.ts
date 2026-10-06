import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listPlugins,
  setPluginActive,
  type PluginRow,
} from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { useT } from 'simplycms/i18n';
import { syncPluginHooks } from 'simplycms/plugins';
import { reportTxError } from '../../lib/report-tx-error';

const KEY = entityKey(ENTITY.plugins).all();

/**
 * `register` модуля впав. `rolledBack` — чи вдалося повернути БД у
 * «вимкнено»: якщо ні, плагін лишився увімкненим у БД без хуків у вкладці,
 * і власник мусить вимкнути його вручну.
 */
class HookSyncError extends Error {
  readonly pluginName: string;
  readonly rolledBack: boolean;
  constructor(pluginName: string, rolledBack: boolean, cause: unknown) {
    super(`Plugin "${pluginName}" failed to register hooks`, { cause });
    this.name = 'HookSyncError';
    this.pluginName = pluginName;
    this.rolledBack = rolledBack;
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
 * виклик `isActive: false` і тост; упав і відкат — окремий тост «вимкніть
 * вручну» й перечитаний список. Кожну відповідь сервера пишемо в кеш
 * (write-back), щоб перемикач показував стан БД, а не намір.
 */
export function usePluginToggle() {
  const t = useT();
  const queryClient = useQueryClient();

  /**
   * Відкат після збою реєстрації. Якщо впав і він, стан рядка невідомий —
   * перечитуємо список, щоб перемикач показував БД, а не намір. Повертає,
   * чи БД повернуто в «вимкнено».
   */
  const rollback = async (name: string): Promise<boolean> => {
    try {
      const row = await setPluginActive({ data: { name, isActive: false } });
      queryClient.setQueryData<PluginRow[]>(KEY, (old) =>
        old?.map((plugin) => (plugin.name === name ? row : plugin)),
      );
      return true;
    } catch {
      try {
        queryClient.setQueryData<PluginRow[]>(KEY, await listPlugins());
      } catch {
        // Мережа лягла цілком — лишаємо кеш; тост однаково просить власника
        // перевірити плагін вручну.
      }
      return false;
    }
  };

  const mutation = useMutation({
    mutationFn: async ({ name, isActive }: ToggleVars) => {
      const row = await setPluginActive({ data: { name, isActive } });
      queryClient.setQueryData<PluginRow[]>(KEY, (old) =>
        old?.map((plugin) => (plugin.name === name ? row : plugin)),
      );
      try {
        await syncPluginHooks(name, isActive);
      } catch (error) {
        throw new HookSyncError(name, await rollback(name), error);
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
            t(
              error.rolledBack
                ? 'admin.plugins.registerFailed'
                : 'admin.plugins.registerFailedStuck',
              { name: error.pluginName },
            ),
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
