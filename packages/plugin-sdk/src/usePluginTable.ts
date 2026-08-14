import { useMemo } from 'react';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';

/**
 * Порт даних плагіна: вузький CRUD-фасад над ВЛАСНИМИ таблицями
 * (`plg_<name>_*`, спека §7/§9).
 *
 * Це і є межа довіри в дії: плагін НЕ імпортує `@simplycms/supabase`
 * (dependency-lint це забороняє) — клієнт бере SDK, довірений код ядра,
 * а назовні віддає лише перелічувану поверхню. Гард префікса `plg_` —
 * рантаймний: чужі таблиці цим портом недосяжні за іменем.
 *
 * Типи рядків — generic-параметр викликача: таблиці плагіна свідомо НЕ
 * входять у core-baseline (`packages/supabase/src/database.ts`), тож
 * узгодженість типу з реальною схемою — відповідальність автора плагіна.
 */

/** Результат PostgREST-запиту — мінімальна форма, яку споживає порт. */
interface PortResult<T> {
  data: T | null;
  error: { message: string } | null;
}

interface ListBuilder<Row> extends PromiseLike<PortResult<Row[]>> {
  eq(column: string, value: unknown): ListBuilder<Row>;
  order(column: string, options?: { ascending?: boolean }): ListBuilder<Row>;
}

/**
 * Структурний тип рівно тих ланцюжків supabase-js, які використовує порт.
 * Повний `SupabaseClient<Database>` тут не годиться: його `from()` замкнений
 * на таблиці core-схеми, а плагінні `plg_*` у ній відсутні за визначенням.
 */
interface PortClient {
  from(table: string): {
    select(columns?: string): ListBuilder<Record<string, unknown>>;
    insert(row: Record<string, unknown>): {
      select(): { single(): PromiseLike<PortResult<Record<string, unknown>>> };
    };
    update(patch: Record<string, unknown>): {
      eq(
        column: string,
        value: unknown,
      ): {
        select(): {
          single(): PromiseLike<PortResult<Record<string, unknown>>>;
        };
      };
    };
    delete(): {
      eq(
        column: string,
        value: unknown,
      ): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

export interface PluginTablePort<Row extends Record<string, unknown>> {
  list(options?: {
    orderBy?: string;
    ascending?: boolean;
    eq?: Partial<Row>;
  }): Promise<Row[]>;
  insert(row: Partial<Row>): Promise<Row>;
  update(id: string, patch: Partial<Row>): Promise<Row>;
  remove(id: string): Promise<void>;
}

function fail(operation: string, table: string, message?: string): never {
  throw new Error(
    `[plugin-sdk] ${operation} ${table}: ${message ?? 'порожня відповідь'}`,
  );
}

/** CRUD-порт до однієї таблиці плагіна. Кидає, якщо таблиця не `plg_*`. */
export function usePluginTable<Row extends Record<string, unknown>>(
  table: string,
): PluginTablePort<Row> {
  if (!table.startsWith('plg_')) {
    throw new Error(
      `[plugin-sdk] usePluginTable("${table}"): порт працює лише з власними ` +
        `таблицями плагіна (префікс plg_, спека §7)`,
    );
  }

  // Подвійний каст свідомий: типізований клієнт замкнений на core-схему,
  // а порт працює з таблицями поза нею (див. коментар до PortClient).
  const client = useSupabaseClient() as unknown as PortClient;

  return useMemo<PluginTablePort<Row>>(
    () => ({
      async list(options) {
        let query = client.from(table).select('*');
        for (const [column, value] of Object.entries(options?.eq ?? {})) {
          query = query.eq(column, value);
        }
        if (options?.orderBy) {
          query = query.order(options.orderBy, {
            ascending: options.ascending ?? true,
          });
        }
        const { data, error } = await query;
        if (error) fail('list', table, error.message);
        return (data ?? []) as Row[];
      },
      async insert(row) {
        const { data, error } = await client
          .from(table)
          .insert(row)
          .select()
          .single();
        if (error || data === null) fail('insert', table, error?.message);
        return data as Row;
      },
      async update(id, patch) {
        const { data, error } = await client
          .from(table)
          .update(patch)
          .eq('id', id)
          .select()
          .single();
        if (error || data === null) fail('update', table, error?.message);
        return data as Row;
      },
      async remove(id) {
        const { error } = await client.from(table).delete().eq('id', id);
        if (error) fail('remove', table, error.message);
      },
    }),
    [client, table],
  );
}
