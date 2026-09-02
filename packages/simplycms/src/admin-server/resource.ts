import { eq, inArray, asc, desc, type Table } from 'drizzle-orm';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-zod';
import { z } from 'zod';
import { requireGrant, dbRoleForSubject, type Operation } from 'simplycms/auth';
import { withActor, type ActorDb } from 'simplycms/db';
import {
  subsetInputSchema,
  toDrizzleSubset,
  type SubsetAllow,
  type SubsetPayload,
} from './subset';

/** Імена колонок Drizzle-таблиці (TS-ключі, camelCase). */
type ColumnName<T extends Table> = Extract<keyof T['_']['columns'], string>;

/**
 * Фабрика ОПЕРАЦІЙ і схем ресурсу адмінки (К3-4′). serverFn НЕ створює:
 * компілятор Start вимагає топ-рівневих const (а fast-path нетоплевел
 * виклик мовчки пропускає) — обгортки пише Task-модуль сутності явно.
 *
 * 🔴 Розріз «фабрика vs іменована операція» — ПО ОПЕРАЦІЯХ: усе з
 * доменним інваріантом (setDefault, reorder, remove-з-перевіркою)
 * пишеться руками в operations/. DSL запитів немає — складніше за
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
  const pickWritable = Object.fromEntries(
    config.writable.map((c) => [c, true]),
  ) as {
    [K in W]: true;
  };

  const rowSchema = createSelectSchema(config.table);

  // 🔴 Відхилення від брифа (typecheck), ХВІСТ РЕВʼЮ Task 7 (round 1):
  // `.pick()` drizzle-zod типізований `M extends Mask<keyof Shape>`, де
  // `Shape` — мапований тип, виведений із ГЕНЕРИЧНОГО `T['_']['columns']`.
  // TS не вміє звести `keyof Shape` до конкретних імен колонок, поки `T`
  // не інстанційовано (TS2345: «W could be instantiated with a different
  // subtype…»), тож `{[K in W]: true}` не проходить структурну перевірку
  // АРГУМЕНТУ.
  //
  // 🔴 Перша редакція касту (`pick(pickWritable as never)`) компілювалась,
  // але БУЛА ПОМИЛКОВОЮ: аргумент типу `never` не дає TS сайту інференсу
  // для `M`, тож `M` падає до свого констрейнта `Mask<keyof Shape>` —
  // звідси `Extract<keyof Shape, keyof M> = keyof Shape` і `pick` СТАТИЧНО
  // повертає Shape НЕЗМІНЕНИМ (рантайм не постраждав — `.pick()` усередині
  // самого zod працює з реальним обʼєктом `pickWritable`, це суто питання
  // СТАТИЧНОГО типу виклику). Наслідок: `insertSchema`/`updateSchema`
  // статично приймали ВСІ колонки, включно з `readonly` (isDefault,
  // createdAt) — рівно те, від чого існує exhaustiveness. Емпірично
  // перевірено `expectTypeOf` у тесті ДО і ПІСЛЯ цього фіксу.
  //
  // Правильний фікс: каст на РЕЗУЛЬТАТ `.pick()`, не на аргумент. Явно
  // виводимо Shape повної insert/update-схеми (`InsertShape`/`UpdateShape`
  // через `infer` по `{ shape: infer S }` — так само, як сам zod типізує
  // `.shape` на ZodObject), звужуємо його TS-ом (`Pick<Shape, W>` —
  // справжній структурний Pick, обчислюваний компілятором, а не залежний
  // від інференсу `M`) і кажемо компілятору, що саме такий тип повертає
  // рантайм-виклик `.pick(pickWritable)`. Це ТОЧНО те, що робить рантайм:
  // `pickWritable` містить рівно ключі `W`.
  const insertSchemaFull = createInsertSchema(config.table);
  const updateSchemaFull = createUpdateSchema(config.table);
  type InsertShape = typeof insertSchemaFull extends { shape: infer S }
    ? S
    : never;
  type UpdateShape = typeof updateSchemaFull extends { shape: infer S }
    ? S
    : never;
  // 🔴 `Pick<Shape, W>` напряму не типізується: вбудований `Pick` вимагає
  // `W extends keyof Shape`, а TS не може це довести генерично — insert-
  // shape виключає «завжди згенеровані» колонки (ColumnIsGeneratedAlwaysAs),
  // тож `keyof InsertShape` формально ВУЖЧИЙ за `ColumnName<T>`, з якого
  // виведено `W`. Перетин `W & keyof Shape` знімає обмеження БЕЗ втрати
  // точності: якщо `writable`-колонка колись виявиться «завжди
  // згенерованою», вона так само відсутня в РАНТАЙМ-схемі insert (сам
  // drizzle-zod її не кладе) — тип і рантайм лишаються синхронними.
  //
  // 🔴 Ціна перетину `K & keyof S`: якщо колонка зі списку `writable`
  // колись стане `generatedAlwaysAs`/`generatedAlwaysAsIdentity`, вона
  // МОВЧКИ випаде зі статичної форми `SafePick` — компілятор про це не
  // попередить (перетин просто звужується, `__missingColumns` тут не
  // спрацьовує, бо колонка й далі є валідним членом `W`). Перевірено в
  // рантаймі drizzle-zod: такі колонки `continue`-яться повз
  // `columnSchemas` — і для insert, і для update, — тож `.pick()` однаково
  // не знайшов би їх у Shape. Сьогодні це недосяжно (у schema.ts таких
  // колонок немає), а якби колись спрацювало — тип і рантайм лишились би
  // в згоді: мовчазний no-op запису конкретного поля, а НЕ розбіжність
  // безпеки (readonly/writable розріз не порушується).
  type SafePick<S, K> = Pick<S, K & keyof S>;

  const insertRowSchema = (
    insertSchemaFull.pick(pickWritable as never) as unknown as z.ZodObject<
      SafePick<InsertShape, W>
    >
  ).extend({ id: z.uuid() }); // 🔴 Е0: ключ генерує клієнт. z.uuid() — єдина форма в плані (канон Zod 4)
  const patchSchema = (
    updateSchemaFull.pick(pickWritable as never) as unknown as z.ZodObject<
      SafePick<UpdateShape, W>
    >
  ).refine((p) => Object.keys(p).length > 0, {
    // 🔴 Порожній patch — 400 на межі, не «No values to set» синхронно з
    // drizzle (фінальне рев'ю Е1б, знахідка 2 — той самий клас, що вже
    // сформульовано в 7a4baa9f: межа admin-server відбиває невалідний
    // вхід чітко, а не через SQL-білдер). `createUpdateSchema` робить усі
    // писані поля optional, тож `{ id, patch: {} }` без цього refine
    // проходив би схему і падав на `db.update().set({})`.
    message: 'patch не може бути порожнім',
  });

  const insertSchema = z.array(insertRowSchema).min(1).max(100);
  const updateSchema = z
    .array(z.object({ id: z.uuid(), patch: patchSchema }))
    .min(1)
    .max(100);
  const removeSchema = z
    .array(z.object({ id: z.uuid() }))
    .min(1)
    .max(100);

  /**
   * Спільна склейка К3-13: перший рубіж → роль від субʼєкта → транзакція.
   *
   * 🔴 Grant НЕ відкидається (рев'ю р2: `const { subject } = …` зʼїдав
   * scope, який Task 5 спеціально повертає). Фабрика обслуговує ЛИШЕ
   * admin-поверхню: scope 'own' тут структурно непідтримуваний (немає
   * owner-колонки), тож fail-loud — 'own'-ресурси (orders/profiles у
   * Е4+) пишуться іменованими операціями, які scope ЧЕСНО звужують.
   */
  const run = async <Out>(
    fn: (
      db: ActorDb,
      grant: Awaited<ReturnType<typeof requireGrant>>,
    ) => Promise<Out>,
  ): Promise<Out> => {
    const grant = await requireGrant(config.operation);
    if (grant.scope !== 'any')
      throw new Error(
        `[admin-server] ${config.entity}: операція ${config.operation} дала scope '${grant.scope}' — фабрика обслуговує лише admin-scope 'any'; own-звуження пишеться іменованою операцією`,
      );
    return withActor(
      {
        role: dbRoleForSubject(grant.subject),
        userId: grant.subject.userId ?? undefined,
      },
      (db) => fn(db, grant),
    );
  };

  return {
    entity: config.entity,
    mode: config.mode,
    rowSchema,
    insertSchema,
    updateSchema,
    removeSchema,
    subsetSchema: subsetInputSchema,

    list: async ({ data }: { data: SubsetPayload }) =>
      run(async (db, _grant) => {
        const s = toDrizzleSubset(config.table, allow, data.subset ?? {});
        let q = db
          .select()
          .from(config.table as never)
          .$dynamic();
        if (s.where) q = q.where(s.where);
        if (s.orderBy) q = q.orderBy(...s.orderBy);
        else if (config.defaultOrder) {
          // 🔴 defaultOrder ЗАСТОСОВУЄТЬСЯ (мертвий параметр старої редакції).
          const col = columns[config.defaultOrder.column];
          if (col === undefined)
            throw new Error(
              `[admin-server] ${config.entity}: defaultOrder.column "${config.defaultOrder.column}" немає в таблиці`,
            );
          q = q.orderBy(
            config.defaultOrder.direction === 'desc' ? desc(col) : asc(col),
          );
        }
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
            .set(patch as never)
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
