import { sql, type SQL } from 'drizzle-orm';
import {
  withStorefrontDb,
  withStoreOperatorDb,
  type ActorDb,
  type JsonValue,
} from 'simplycms/storefront/loaders';
import { assertColumn, assertKnownPlugin, assertOwnTable } from './guard';

/**
 * Виконання запитів до ВЛАСНОЇ таблиці плагіна (рішення B9).
 *
 * 🔴 SQL тут будується рядком, а не Drizzle-схемою, і це неминуче: таблиці
 * `plg_*` живуть у міграціях плагіна, ядро їхніх колонок не знає за
 * визначенням. Тому кожен ідентифікатор проходить `assertOwnTable`/
 * `assertColumn`, а кожне ЗНАЧЕННЯ їде параметром — інтерполяції значень у
 * цьому модулі немає жодної.
 */

/** Скаляр, який порт погоджується покласти в колонку плагіна. */
export type PluginCell = string | number | boolean | null;

/**
 * Рядок таблиці плагіна, як його бачить ядро: плоский і нетипізований.
 *
 * 🔴 Значення саме `JsonValue`, а не `unknown`: результат serverFn їде на
 * клієнт серіалізацією, і `unknown` там — не «поки не знаю тип», а «може не
 * пережити дорогу». TanStack Start це перевіряє типом і не дає зібратись.
 */
export type PluginRow = Record<string, JsonValue>;

export interface PluginListQuery {
  eq?: Record<string, PluginCell>;
  orderBy?: string;
  ascending?: boolean;
}

/** `select * from <таблиця плагіна>` із простими фільтрами. */
export async function selectPluginRows(
  pluginName: string,
  table: string,
  query: PluginListQuery = {},
): Promise<PluginRow[]> {
  const name = await guardedTable(pluginName, table);

  const parts: SQL[] = [sql`select * from ${sql.identifier(name)}`];

  const conditions = Object.entries(query.eq ?? {}).map(
    ([column, value]) =>
      sql`${sql.identifier(assertColumn(column))} = ${value}`,
  );
  if (conditions.length > 0) {
    parts.push(sql` where ${sql.join(conditions, sql` and `)}`);
  }

  if (query.orderBy) {
    const direction = query.ascending === false ? sql`desc` : sql`asc`;
    parts.push(
      sql` order by ${sql.identifier(assertColumn(query.orderBy))} ${direction}`,
    );
  }

  return withStorefrontDb((db) => run(db, sql.join(parts, sql``)));
}

/**
 * Вставка рядка. Пише роль `app_admin`, і лише після серверної перевірки
 * ролі викликача — див. `./index`.
 */
export async function insertPluginRow(
  pluginName: string,
  table: string,
  row: Record<string, PluginCell>,
): Promise<PluginRow> {
  if (typeof row.id !== 'string' || row.id.length === 0) {
    throw new Error(
      `[plugin-sdk] insert у ${table} (плагін ${pluginName}) без id. ` +
        'Ключ генерує КЛІЄНТ (randomUUID) — інакше розійдеться з оптимістичним рядком.',
    );
  }
  const name = await guardedTable(pluginName, table);
  const columns = Object.keys(row).map(assertColumn);
  if (columns.length === 0) {
    throw new Error('[plugin-sdk] insert без жодної колонки');
  }

  const query = sql`insert into ${sql.identifier(name)} (${sql.join(
    columns.map((column) => sql.identifier(column)),
    sql`, `,
  )}) values (${sql.join(
    columns.map((column) => sql`${row[column]}`),
    sql`, `,
  )}) returning *`;

  return one(await withStoreOperatorDb((db) => run(db, query)), 'insert');
}

/** Оновлення рядка за `id`. */
export async function updatePluginRow(
  pluginName: string,
  table: string,
  id: string,
  patch: Record<string, PluginCell>,
): Promise<PluginRow> {
  const name = await guardedTable(pluginName, table);
  const columns = Object.keys(patch).map(assertColumn);
  if (columns.length === 0) {
    throw new Error('[plugin-sdk] update без жодної колонки');
  }

  const query = sql`update ${sql.identifier(name)} set ${sql.join(
    columns.map((column) => sql`${sql.identifier(column)} = ${patch[column]}`),
    sql`, `,
  )} where ${sql.identifier('id')} = ${id} returning *`;

  return one(await withStoreOperatorDb((db) => run(db, query)), 'update');
}

/** Видалення рядка за `id`. */
export async function deletePluginRow(
  pluginName: string,
  table: string,
  id: string,
): Promise<void> {
  const name = await guardedTable(pluginName, table);
  await withStoreOperatorDb((db) =>
    run(
      db,
      sql`delete from ${sql.identifier(name)} where ${sql.identifier('id')} = ${id}`,
    ),
  );
}

/** Обидва рубежі межі даних плагіна разом — щоб їх не можна було забути. */
async function guardedTable(
  pluginName: string,
  table: string,
): Promise<string> {
  const name = assertOwnTable(pluginName, table);
  await assertKnownPlugin(pluginName);
  return name;
}

async function run(db: ActorDb, query: SQL): Promise<PluginRow[]> {
  const result = await db.execute(query);
  return result.rows as PluginRow[];
}

function one(rows: PluginRow[], operation: string): PluginRow {
  const [row] = rows;
  if (!row) {
    throw new Error(`[plugin-sdk] ${operation}: порожня відповідь`);
  }
  return row;
}
