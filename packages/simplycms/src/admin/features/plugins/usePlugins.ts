import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listPlugins, type PluginRow } from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { pluginConfigWrite } from 'simplycms/plugin-sdk/server';

const KEY = entityKey(ENTITY.plugins).all();

/**
 * Плагіни адмінки (Е6б-17/19): короткий список — `useQuery`, не колекція.
 *
 * Конфіг пишеться ТИМ САМИМ шляхом, що й `usePluginConfig.save` плагіна —
 * `pluginConfigWrite` під `settings.manage` (Е6б-13): другого каналу запису в
 * `plugins.config` немає. Serverfn нічого не повертає, тож у кеш лягає
 * значення, яке щойно прийняв сервер (write-back без refetch).
 */
export function usePlugins() {
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: KEY, queryFn: () => listPlugins() });

  const saveConfig = useMutation({
    mutationFn: async ({
      name,
      config,
    }: {
      name: string;
      config: PluginRow['config'];
    }) => {
      await pluginConfigWrite({ data: { plugin: name, config } });
      queryClient.setQueryData<PluginRow[]>(KEY, (old) =>
        old?.map((plugin) =>
          plugin.name === name ? { ...plugin, config } : plugin,
        ),
      );
    },
  });

  return { query, saveConfig };
}
