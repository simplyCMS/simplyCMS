import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { themes } from 'simplycms/schema';
import { activeThemeCache } from 'simplycms/site';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';
import { THEME_COLUMNS, toThemeRow, type ThemeRow } from './list';

/** Межі налаштувань теми (Е6б-16): спека — «обмеження розміру jsonb». */
const MAX_KEYS = 64;
const MAX_KEY = 64;
const MAX_STRING = 1000;
const MAX_BYTES = 16 * 1024;

const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

/**
 * Плоский словник примітивів. 🔴 Схеми налаштувань (`ThemeSettingDefinition`)
 * сервер не знає — модуль теми живе в браузері (Е6б-16, `themes.md`), тож
 * тут стережеться лише ФОРМА: вкладеність і масиви → 400, а `number`
 * лишається числом (`z.number()` не приводить рядки).
 */
export const saveThemeSettingsInput = z.object({
  name: z.string().min(1).max(100),
  settings: z
    .record(
      z.string().min(1).max(MAX_KEY),
      z.union([z.string().max(MAX_STRING), z.number(), z.boolean()]),
    )
    .refine((v) => Object.keys(v).length <= MAX_KEYS, {
      params: { code: 'too_big', maximum: MAX_KEYS },
    })
    .refine((v) => bytes(v) <= MAX_BYTES, {
      params: { code: 'too_big', maximum: MAX_BYTES },
    }),
});

/**
 * Зберегти налаштування теми (Е6б-16). Тема без рядка → `theme_unknown`, 409.
 * Кеш активної теми скидається ПІСЛЯ `runAdmin` (після COMMIT, Е6б-9) —
 * незалежно від того, чи тема активна: зайве скидання дешевше за розсинхрон.
 */
export const saveThemeSettingsOp = async ({
  data,
}: {
  data: z.input<typeof saveThemeSettingsInput>;
}): Promise<ThemeRow> => {
  const { name, settings } = parseAdminInput(saveThemeSettingsInput, data);
  const row = await runAdmin('settings.manage', async (db) => {
    const [updated] = await db
      .update(themes)
      .set({ settings, updatedAt: new Date() })
      .where(eq(themes.name, name))
      .returning(THEME_COLUMNS);
    if (!updated) stateConflict(ADMIN_STATE_CONSTRAINT.themeUnknown);
    return toThemeRow(updated);
  });
  activeThemeCache.invalidate();
  return row;
};
