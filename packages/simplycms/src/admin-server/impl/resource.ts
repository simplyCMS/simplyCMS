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
import {
  buildResourceSchemas,
  type ColumnName,
  type ResourceRefine,
} from './resource-schemas';
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
    /** m3 (рев'ю хвилі B): рефайнменти drizzle-zod для колонок без власної
     *  форми (jsonb без `.$type<>()` — `resource-schemas.ts`). */
    refine?: ResourceRefine;
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
    buildResourceSchemas(config.table, config.writable, config.refine);

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
        // 🔴 `.from(config.table as never)` вище — обхід генеричного `T` у
        // drizzle-білдері, що й у insert/update/remove нижче — зводить
        // РЕЗУЛЬТУЮЧИЙ тип рядка `q` до `never` (TS2339 на першому ж
        // `.field` виклику споживача). Явний каст awaited-результату — той
        // самий рантайм-масив з SELECT, лише названий конкретним типом.
        //
        // 🔴 Ціль касту — `T['$inferSelect'][]` (не `z.infer<typeof
        // rowSchema>[]`, як робив обхід Task 3): jsonb-колонки БЕЗ
        // `.$type<>()` у schema.ts давали Drizzle-у `unknown`, а `unknown`
        // не проходить перевірку серіалізовності createServerFn
        // (`ValidateSerializable`). Тепер усі jsonb-колонки, потрібні
        // адмінці, типізовані в джерелі (`schema/json.ts`, `JsonValue`, і
        // конкретні форми на кшталт `string[]` для `images`) — `$inferSelect`
        // сам серіалізовний, і додатковий шар через drizzle-zod більше не
        // потрібен. Рантайм не змінився: каст іде на той самий масив із
        // SELECT/RETURNING, різниця лише в тому, яким типом його назвати.
        return (await q) as T['$inferSelect'][];
      }),

    // 🔴 А2 (фікс архітектора після Task 4): фабрика сама парсить вхід
    // СВОЄЮ ж схемою, ДО `run` (тобто до першого рубежу/транзакції).
    // `inputValidator` serverFn з admin-server/index.ts (Task 3) робить те
    // саме на межі HTTP, але інваріант «readonly-поле не пишеться
    // generic-write» мусить тримати ОПЕРАЦІЯ, а не лише межа —
    // інакше прямий виклик `ops.insert(...)` повз serverFn (харнес-тести,
    // майбутні internal-виклики) проносить readonly-поле аж до `.values()`.
    // Zod-схема БЕЗ `.strict()` (дефолтний режим "strip") сама відкидає
    // невідомі ключі — саме так `isDefault` у payload insert мовчки зникає,
    // не падає помилкою.
    insert: async ({ data }: { data: z.infer<typeof insertSchema> }) => {
      const parsed = insertSchema.parse(data);
      return run(async (db) => {
        // 🔴 batch: УСІ рядки транзакції, не [0] — інакше решта оптимістичних
        // мутацій «підтвердяться» локально без запису в БД.
        // 🔴 Подвійний каст через `unknown`: генеричний `T["$inferSelect"]`
        // insert-білдера і `T['$inferSelect']` самої таблиці — надто різні
        // форми, щоб TS визнав їх «достатньо перетинними» напряму (TS2352);
        // той самий приймальний прийом, що вже застосовано в
        // resource-schemas.ts.
        const rows = (await db
          .insert(config.table)
          .values(parsed as never)
          .returning()) as unknown as T['$inferSelect'][];
        return rows;
      });
    },

    update: async ({ data }: { data: z.infer<typeof updateSchema> }) => {
      // 🔴 `patchSchema` (resource-schemas.ts) пікає лише writable-ключі й
      // РЕФАЙНИТЬ непорожність ПІСЛЯ strip: patch, що складається лише з
      // readonly-полів (напр. `{ isDefault: true }`), стає `{}` і валить
      // `.parse()` тут ЖЕ, ще ДО `run` — readonly-патч ніколи не доходить
      // до транзакції.
      const parsed = updateSchema.parse(data);
      return run(async (db) => {
        // 🔴 Відхилення від брифа (typecheck), знахідка Task 8 (build:packages,
        // тобто `tsc -p tsconfig.dts.json`): `const out = []` — «evolving
        // array» — під ЦИМ прогоном (emitDeclarationOnly) TS звужує елемент
        // до `never` ще ДО першого `push`, тож `out.push(row)` дає TS2345
        // (`T['$inferSelect']` не підходить під `never`). Кореневий
        // `pnpm typecheck` (звичайний `tsc --noEmit`) цю розбіжність не
        // бачить — той самий код у ньому чистий; мінімальний фікс — явна
        // анотація типу масиву замість покладання на evolving-inference.
        const out: T['$inferSelect'][] = [];
        for (const { id, patch } of parsed) {
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
      });
    },

    remove: async ({ data }: { data: z.infer<typeof removeSchema> }) => {
      const parsed = removeSchema.parse(data);
      return run(async (db) => {
        const ids = parsed.map((d) => d.id);
        const rows = await db
          .delete(config.table)
          .where(inArray(columns['id'], ids as never))
          .returning();
        return { count: rows.length };
      });
    },
  };
}

export type AdminResourceOps<T extends Table> = ReturnType<
  typeof defineAdminResource<T, ColumnName<T>, ColumnName<T>>
>;
