import { eq, inArray, asc, desc, type SQL, type Table } from 'drizzle-orm';
import type { z } from 'zod';
import type { Operation, RequestGrant } from 'simplycms/auth';
import type { ActorDb } from 'simplycms/db';
import {
  subsetInputSchema,
  toDrizzleSubset,
  type SubsetAllow,
  type SubsetPayload,
} from './subset';
import { buildResourceSchemas, type ColumnName } from './resource-schemas';
import { runAdmin } from './run';

/**
 * Фабрика ОПЕРАЦІЙ і схем ресурсу адмінки (К3-4′). serverFn НЕ створює:
 * компілятор Start вимагає топ-рівневих const (а fast-path нетоплевел
 * виклик мовчки пропускає) — обгортки пише Task-модуль сутності явно.
 *
 * 🔴 Розріз «фабрика vs іменована операція» — ПО ОПЕРАЦІЯХ: усе з
 * доменним інваріантом (setDefault, reorder, remove-з-перевіркою)
 * пишеться руками в impl/<entity>/. DSL запитів немає — складніше за
 * subset = useLiveQuery на клієнті або іменована операція.
 *
 * 🔴 Exhaustiveness (вимога спеки): кожна колонка мусить бути у
 * writable АБО readonly — інакше конфіг не типізується (фантомне поле
 * __missingColumns називає пропущені).
 */
export function defineAdminResource<
  T extends Table,
  const W extends ColumnName<T>,
  const R extends ColumnName<T>,
>(
  config: {
    entity: string;
    table: T;
    operation: Operation;
    mode: 'eager' | 'on-demand';
    filterable: readonly ColumnName<T>[];
    sortable: readonly ColumnName<T>[];
    defaultOrder?: { column: ColumnName<T>; direction: 'asc' | 'desc' };
    writable: readonly W[];
    readonly: readonly R[];
    /** Колонка, яку фабрика ставить у new Date() на кожен update (Е3-9:
     *  тригера updated_at у каноні немає). */
    touch?: ColumnName<T>;
  } & ([Exclude<ColumnName<T>, W | R>] extends [never]
    ? unknown
    : { __missingColumns: Exclude<ColumnName<T>, W | R> }) &
    // 🔴 Перетин теж заборонений: колонка в ОБОХ списках — writable
    //   виграв би мовчки (напр., createdAt став би перезаписуваним).
    ([Extract<W, R>] extends [never]
      ? unknown
      : { __overlappingColumns: Extract<W, R> }),
) {
  const allow: SubsetAllow = {
    filterable: config.filterable,
    sortable: config.sortable,
  };
  const columns = config.table as unknown as Record<string, never>;
  const { rowSchema, insertSchema, updateSchema, removeSchema } =
    buildResourceSchemas(config.table, config.writable);

  /**
   * Спільна склейка К3-13 — тепер `runAdmin` (Task 1): перший рубіж →
   * роль від субʼєкта → транзакція → мапінг конфліктів БД у 409.
   *
   * 🔴 Фабрика обслуговує ЛИШЕ admin-поверхню: scope 'own' тут
   * структурно непідтримуваний (немає owner-колонки) — `runAdmin` сам
   * кидає fail-loud, 'own'-ресурси (orders/profiles у Е4+) пишуться
   * іменованими операціями, які scope ЧЕСНО звужують.
   */
  const run = <Out>(fn: (db: ActorDb, grant: RequestGrant) => Promise<Out>) =>
    runAdmin(config.operation, fn);

  return {
    entity: config.entity,
    mode: config.mode,
    rowSchema,
    insertSchema,
    updateSchema,
    removeSchema,
    subsetSchema: subsetInputSchema,

    list: async ({ data }: { data: SubsetPayload }) =>
      run(async (db) => {
        const s = toDrizzleSubset(config.table, allow, data.subset ?? {});
        let q = db
          .select()
          .from(config.table as never)
          .$dynamic();
        if (s.where) q = q.where(s.where);
        // 🔴 Е3-8: стабільний порядок для offset-пагінації. `created_at` не
        // унікальний (сід/масовий імпорт дають однакові мітки) — без
        // тай-брейкера `id` сторінки дублюють або гублять рядки. Один
        // виклик `.orderBy()` на масив: повторний виклик у Drizzle ЗАМІНЯЄ
        // порядок, а не дописує до нього.
        const order: SQL[] = [];
        if (s.orderBy) order.push(...s.orderBy);
        else if (config.defaultOrder) {
          // 🔴 defaultOrder ЗАСТОСОВУЄТЬСЯ (мертвий параметр старої редакції).
          const col = columns[config.defaultOrder.column];
          if (col === undefined)
            throw new Error(
              `[admin-server] ${config.entity}: defaultOrder.column "${config.defaultOrder.column}" немає в таблиці`,
            );
          order.push(
            config.defaultOrder.direction === 'desc' ? desc(col) : asc(col),
          );
        }
        const idCol = columns['id'];
        if (idCol !== undefined) order.push(asc(idCol));
        if (order.length > 0) q = q.orderBy(...order);
        if (s.limit !== undefined) q = q.limit(s.limit);
        if (s.offset !== undefined) q = q.offset(s.offset);
        // 🔴 Відхилення від брифа (typecheck), знахідка Task 8: `.from(config.table
        // as never)` вище — той самий обхід генеричного `T` у drizzle-білдері,
        // що й у insert/update/remove нижче — зводить РЕЗУЛЬТУЮЧИЙ тип рядка
        // `q` до `never` (TS2339 на першому ж `.field` виклику споживача).
        // До Task 8 це лишалось непоміченим: жоден виклик `.list()` досі не
        // типізував результат жорстко (resource.test.ts перевіряє лише
        // rejects/typeof). Явний каст awaited-результату до
        // `T['$inferSelect'][]` — той самий рантайм-масив з SELECT, лише
        // названий конкретним типом; ідентичний прийом уже застосований
        // нижче для `update()`.
        return (await q) as T['$inferSelect'][];
      }),

    insert: async ({ data }: { data: z.infer<typeof insertSchema> }) =>
      run(async (db) =>
        // 🔴 batch: УСІ рядки транзакції, не [0] — інакше решта оптимістичних
        // мутацій «підтвердяться» локально без запису в БД.
        db
          .insert(config.table)
          .values(data as never)
          .returning(),
      ),

    update: async ({ data }: { data: z.infer<typeof updateSchema> }) =>
      run(async (db) => {
        // 🔴 Відхилення від брифа (typecheck), знахідка Task 8 (build:packages,
        // тобто `tsc -p tsconfig.dts.json`): `const out = []` — «evolving
        // array» — під ЦИМ прогоном (emitDeclarationOnly) TS звужує елемент
        // до `never` ще ДО першого `push`, тож `out.push(row)` дає TS2345
        // (`T['$inferSelect']` не підходить під `never`). Кореневий
        // `pnpm typecheck` (звичайний `tsc --noEmit`) цю розбіжність не
        // бачить — той самий код у ньому чистий; мінімальний фікс — явна
        // анотація типу масиву замість покладання на evolving-inference.
        const out: T['$inferSelect'][] = [];
        for (const { id, patch } of data) {
          // 🔴 Відхилення від брифа (typecheck): `db.update(config.table)`
          // з генеричним `T extends Table` не звужує `.returning()` до
          // конкретного масиву — TS2488 на деструктуризації, TS7053 на
          // індексації: обидва боки умовного типу `TReturning extends
          // undefined ? QueryResult : TReturning[]` лишаються нерозвʼязані,
          // бо `T` ще не інстанційовано. Явний каст результату до масиву
          // рядків таблиці (`T['$inferSelect'][]`) — той самий рантайм-масив
          // з `UPDATE … RETURNING`, лише названий конкретним типом.
          const rows = (await db
            .update(config.table)
            .set(
              (config.touch
                ? { ...patch, [config.touch]: new Date() }
                : patch) as never,
            )
            .where(eq(columns['id'], id as never))
            .returning()) as T['$inferSelect'][];
          const row = rows[0];
          if (!row)
            throw new Error(
              `[admin-server] ${config.entity}: рядка ${id} не існує`,
            );
          out.push(row);
        }
        return out;
      }),

    remove: async ({ data }: { data: z.infer<typeof removeSchema> }) =>
      run(async (db) => {
        const ids = data.map((d) => d.id);
        const rows = await db
          .delete(config.table)
          .where(inArray(columns['id'], ids as never))
          .returning();
        return { count: rows.length };
      }),
  };
}

export type AdminResourceOps<T extends Table> = ReturnType<
  typeof defineAdminResource<T, ColumnName<T>, ColumnName<T>>
>;
