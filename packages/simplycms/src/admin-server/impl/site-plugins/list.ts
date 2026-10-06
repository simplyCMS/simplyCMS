import { asc } from 'drizzle-orm';
import { plugins } from 'simplycms/schema';
import type { JsonValue, Plugin } from 'simplycms/schema/types';
import { runAdmin } from '../run';

/**
 * Рядок плагіна для адмінки (Е6б-17). Без `hooks`: реєстрацію хуків веде
 * браузер (`syncPluginHooks`), сервер її не змінює і не показує.
 */
export type PluginRow = {
  id: Plugin['id'];
  name: Plugin['name'];
  displayName: Plugin['displayName'];
  version: Plugin['version'];
  description: Plugin['description'];
  author: Plugin['author'];
  isActive: boolean;
  config: Record<string, JsonValue>;
  updatedAt: Plugin['updatedAt'];
};

export const PLUGIN_COLUMNS = {
  id: plugins.id,
  name: plugins.name,
  displayName: plugins.displayName,
  version: plugins.version,
  description: plugins.description,
  author: plugins.author,
  isActive: plugins.isActive,
  config: plugins.config,
  updatedAt: plugins.updatedAt,
};

/**
 * `is_active` і `config` у схемі nullable з дефолтами: `null` (ручний SQL)
 * читається як «вимкнено» і порожній конфіг, а не як третій стан у UI.
 */
export const toPluginRow = (
  row: Omit<PluginRow, 'isActive' | 'config'> & {
    isActive: boolean | null;
    config: unknown;
  },
): PluginRow => ({
  ...row,
  isActive: row.isActive === true,
  config:
    row.config !== null &&
    typeof row.config === 'object' &&
    !Array.isArray(row.config)
      ? (row.config as Record<string, JsonValue>)
      : {},
});

/** Список плагінів для сторінки адмінки. */
export const listPluginsOp = async (): Promise<PluginRow[]> =>
  runAdmin('settings.manage', async (db) =>
    (
      await db.select(PLUGIN_COLUMNS).from(plugins).orderBy(asc(plugins.name))
    ).map(toPluginRow),
  );
