import { useMemo } from 'react';
import {
  pluginTableInsert,
  pluginTableList,
  pluginTableRemove,
  pluginTableUpdate,
} from 'simplycms/plugin-sdk/server';

/**
 * Порт даних плагіна: вузький CRUD-фасад над ВЛАСНИМИ таблицями
 * (`plg_<name>_*`, спека §7/§9, рішення B9).
 *
 * Це і є межа довіри в дії: плагін не імпортує ні Supabase, ні `simplycms/db`
 * (dependency-lint це забороняє) — він називає таблицю й фільтри, а транспорт
 * лишається справою ядра. Форма порту НЕ дзеркалить жодного бекенда: у v1 під
 * ним був PostgREST, зараз — serverFn поверх Postgres, і жоден плагін від цієї
 * заміни не змінився.
 *
 * 🔴 Імʼя плагіна — ОБОВʼЯЗКОВИЙ перший аргумент, і не для зручності:
 * без нього сервер не може відрізнити «власну» таблицю від сусідньої. Гард
 * `plg_`-префікса в браузері нічого не вартий — рішення ухвалює хендлер
 * (`plugin-sdk/server/guard.ts`).
 *
 * Типи рядків — generic-параметр викликача: таблиці плагіна свідомо НЕ
 * входять у схему ядра, тож узгодженість типу з реальною схемою —
 * відповідальність автора плагіна.
 */

/** Скаляр, який порт погоджується покласти в колонку. */
type Cell = string | number | boolean | null;

export interface PluginTablePort<Row extends Record<string, unknown>> {
  list(options?: {
    orderBy?: string;
    ascending?: boolean;
    eq?: Partial<Row>;
  }): Promise<Row[]>;
  /** 🔴 `id` генерує викликач: ключ мусить бути відомий до відповіді сервера. */
  insert(row: Partial<Row> & { id: string }): Promise<Row>;
  update(id: string, patch: Partial<Row>): Promise<Row>;
  remove(id: string): Promise<void>;
  /**
   * Ключ кешу React Query для ЦІЄЇ таблиці — той самий, яким порт іменує
   * власні запити всередині (борг Е1а №8, Е3-12, П.1 доопрацювання).
   * Стабільний між рендерами (та сама пам'ять `useMemo`, що й решта порту),
   * тож придатний як `queryKey` без окремого `useMemo` у виклику.
   */
  readonly queryKey: readonly [string, string];
}

/** Звузити довільний обʼєкт рядка до скалярів, які приймає транспорт. */
function toCells(row: Record<string, unknown>): Record<string, Cell> {
  return Object.fromEntries(
    Object.entries(row).map(([column, value]) => [
      column,
      (value ?? null) as Cell,
    ]),
  );
}

/**
 * Ключ кешу для власної таблиці плагіна — префіксується імʼям плагіна
 * (борг Е1а №8, Е3-12): таблиця плагіна (`plg_*`) не входить у `ENTITY`
 * (реєстр — лише таблиці ядра, `contracts/entities.ts`), а зона правила
 * `query-key-from-entity` накриває й референс-плагін.
 *
 * 🔴 НЕ публічна поверхня (не реекспортується з `plugin-sdk/index.ts`,
 * П.1): дві функції, що обидві приймають `(pluginName, table)` і мають
 * узгодити один рядок, — це друга копія тієї самої правди. Єдине джерело
 * ключа — сам порт (`PluginTablePort.queryKey`), автор плагіна бере його
 * звідти, а не будує повторно.
 */
function pluginTableKey(
  pluginName: string,
  table: string,
): readonly [string, string] {
  return [`plugin.${pluginName}`, table] as const;
}

/** CRUD-порт до однієї таблиці плагіна. */
export function usePluginTable<Row extends Record<string, unknown>>(
  pluginName: string,
  table: string,
): PluginTablePort<Row> {
  return useMemo<PluginTablePort<Row>>(
    () => ({
      queryKey: pluginTableKey(pluginName, table),
      async list(options) {
        const rows = await pluginTableList({
          data: {
            plugin: pluginName,
            table,
            eq: options?.eq ? toCells(options.eq) : undefined,
            orderBy: options?.orderBy,
            ascending: options?.ascending,
          },
        });
        return rows as Row[];
      },
      async insert(row) {
        const created = await pluginTableInsert({
          data: { plugin: pluginName, table, row: toCells(row) },
        });
        return created as Row;
      },
      async update(id, patch) {
        const updated = await pluginTableUpdate({
          data: { plugin: pluginName, table, id, patch: toCells(patch) },
        });
        return updated as Row;
      },
      async remove(id) {
        await pluginTableRemove({ data: { plugin: pluginName, table, id } });
      },
    }),
    [pluginName, table],
  );
}
