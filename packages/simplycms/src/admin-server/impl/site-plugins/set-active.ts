import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { plugins } from 'simplycms/schema';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';
import { PLUGIN_COLUMNS, toPluginRow, type PluginRow } from './list';

export const setPluginActiveInput = z.object({
  name: z.string().min(1).max(100),
  isActive: z.boolean(),
});

/**
 * Увімкнути/вимкнути плагін (Е6б-17) — лише рядок `plugins.is_active`.
 * 🔴 Хуки браузера (`HookRegistry`) серверна операція змінити не може:
 * їх синхронізує клієнт (`syncPluginHooks`) після відповіді, а при збої
 * реєстрації повертає `isActive: false` цією ж операцією.
 * Невідомий плагін → `plugin_unknown`, 409.
 */
export const setPluginActiveOp = async ({
  data,
}: {
  data: z.input<typeof setPluginActiveInput>;
}): Promise<PluginRow> => {
  const { name, isActive } = parseAdminInput(setPluginActiveInput, data);
  return runAdmin('settings.manage', async (db) => {
    const [row] = await db
      .update(plugins)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(plugins.name, name))
      .returning(PLUGIN_COLUMNS);
    if (!row) stateConflict(ADMIN_STATE_CONSTRAINT.pluginUnknown);
    return toPluginRow(row);
  });
};
