import { asc, eq } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { themes } from 'simplycms/schema';
import type { JsonValue, Theme } from 'simplycms/schema/types';
import { runAdmin } from '../run';

/** Рядок теми для адмінки (Е6б-15/16). Без службових дат — UI їх не показує. */
export type ThemeRow = {
  id: Theme['id'];
  name: Theme['name'];
  displayName: Theme['displayName'];
  version: Theme['version'];
  description: Theme['description'];
  author: Theme['author'];
  previewImage: Theme['previewImage'];
  isActive: Theme['isActive'];
  settings: Record<string, JsonValue>;
};

export const THEME_COLUMNS = {
  id: themes.id,
  name: themes.name,
  displayName: themes.displayName,
  version: themes.version,
  description: themes.description,
  author: themes.author,
  previewImage: themes.previewImage,
  isActive: themes.isActive,
  settings: themes.settings,
};

/**
 * `settings` — jsonb без `$type`: рядок могли записати ручним SQL, тож
 * не-обʼєкт (масив, рядок, `null`) стає порожнім обʼєктом, а не падінням форми.
 */
export const toThemeRow = (
  row: Omit<ThemeRow, 'settings'> & { settings: unknown },
): ThemeRow => ({
  ...row,
  settings:
    row.settings !== null &&
    typeof row.settings === 'object' &&
    !Array.isArray(row.settings)
      ? (row.settings as Record<string, JsonValue>)
      : {},
});

/** Усі теми (або одна за `name`) у тій самій транзакції — спільне для операцій. */
export async function selectThemeRows(
  db: ActorDb,
  name?: string,
): Promise<ThemeRow[]> {
  const rows = await db
    .select(THEME_COLUMNS)
    .from(themes)
    .where(name === undefined ? undefined : eq(themes.name, name))
    .orderBy(asc(themes.name));
  return rows.map(toThemeRow);
}

/** Список тем для сторінки адмінки. */
export const listThemesOp = async (): Promise<ThemeRow[]> =>
  runAdmin('settings.manage', (db) => selectThemeRows(db));
