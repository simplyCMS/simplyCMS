import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { themes } from 'simplycms/schema';
import { activeThemeCache, isBuiltTheme } from 'simplycms/site';
import { lockCatalogTarget } from '../catalog-lock';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';
import { selectThemeRows, type ThemeRow } from './list';

export const activateThemeInput = z.object({
  name: z.string().min(1).max(100),
});

/**
 * Advisory-ключ активної теми (Е6б-15): серіалізує дві вкладки, що
 * активують різні теми одночасно.
 */
export const SITE_THEME_LOCK = 'site-theme';

/**
 * Активувати тему (Е6б-15). Порядок у транзакції — канон:
 *
 * 1. Лок `site-theme` ПЕРШИМ. Частковий унікальний індекс
 *    `themes_active_idx` не deferrable: без локу дві вкладки впали б 23505
 *    або лишили б активною випадкову тему.
 * 2. Тема мусить бути у збірці (`isBuiltTheme`) — рядок лишається після
 *    видалення пакета, а активована «тема-привид» поклала б вітрину.
 *    Інакше `theme_not_built`, 409.
 * 3. Рядок за `name` існує, інакше `theme_unknown`, 409.
 * 4. Уже активна — no-op.
 * 5. Зняти прапорець з інших, ПОТІМ поставити цілі: зворотний порядок дав
 *    би два `true` під індексом → 23505.
 *
 * Повертає ВЕСЬ список (зміна зачіпає два рядки) — write-back без refetch.
 * Кеш активної теми скидається ПІСЛЯ `runAdmin` (після COMMIT, Е6б-9).
 */
export const activateThemeOp = async ({
  data,
}: {
  data: z.input<typeof activateThemeInput>;
}): Promise<ThemeRow[]> => {
  const { name } = parseAdminInput(activateThemeInput, data);
  const rows = await runAdmin('settings.manage', async (db) => {
    await lockCatalogTarget(db, SITE_THEME_LOCK);
    if (!isBuiltTheme(name))
      stateConflict(ADMIN_STATE_CONSTRAINT.themeNotBuilt);
    const [target] = await selectThemeRows(db, name);
    if (!target) stateConflict(ADMIN_STATE_CONSTRAINT.themeUnknown);
    if (!target.isActive) {
      await db
        .update(themes)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(themes.isActive, true), ne(themes.name, name)));
      await db
        .update(themes)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(themes.name, name));
    }
    return selectThemeRows(db);
  });
  activeThemeCache.invalidate();
  return rows;
};
