import type { Table } from 'drizzle-orm';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-zod';
import { z } from 'zod';

/** Імена колонок Drizzle-таблиці (TS-ключі, camelCase). */
export type ColumnName<T extends Table> = Extract<
  keyof T['_']['columns'],
  string
>;

/**
 * Форма `refine` ресурсу (m3, рев'ю хвилі B): ключ — імʼя колонки, значення —
 * ФУНКЦІЯ `(defaultSchema) => ZodType`. 🔴 Саме функція, не голий `ZodType`:
 * рантайм drizzle-zod (`handleColumns`, `index.mjs`) для голого `ZodType`
 * робить `continue` ДО блоку `.nullable()/.optional()` — колонка без
 * `.notNull()` стала б обовʼязковою в patch-і (кожен `update` мусив би нести
 * поле, якого не чіпає). Функція той блок не пропускає: nullable/optional
 * лишаються тими, що дає сама колонка (`insertConditions`/`updateConditions`).
 */
export type ResourceRefine = Record<string, (schema: never) => z.ZodType>;

/**
 * Zod-схеми ресурсу адмінки, виведені з Drizzle-таблиці (винесено з
 * `defineAdminResource` — Task 1, амендмент К3-9′): rowSchema для
 * читання, insert/update/remove для запису, звужені до `writable`.
 *
 * 🔴 `refine` (m3) передається БУКВАЛЬНО другим аргументом
 * `createInsertSchema`/`createUpdateSchema` — nullable/optional (і
 * `generatedAlwaysAs*` → `never`) рахує сам рушій drizzle-zod
 * (`insertConditions`/`updateConditions`, `handleColumns` у `index.mjs`),
 * а не ручне відтворення цієї формули збоку. Пряма передача впирається у
 * СТАТИЧНИЙ інференс, не в рантайм: генеричний `TRefine`, виведений із
 * loosely-типізованого `ResourceRefine`, ламає інстанціацію типу для ВСІХ
 * колонок одразу (TS2589 «excessively deep»), а `refine as any` на
 * аргументі розвалює `.pick()` нижче на несумісний union перевантажень
 * (TS2349) — той самий клас нерозвʼязного інференсу, що вже задокументований
 * нижче для `.pick()`. Обхід — каст самої ФУНКЦІЇ `createInsertSchema`/
 * `createUpdateSchema`, не аргументу: `plainInsert`/`plainUpdate` фіксують
 * СТАТИЧНИЙ тип повернення (той самий `BuildSchema<…, undefined, …>`, що й
 * без refine — генерик бібліотеки за параметром `T` тут НЕ виводиться,
 * тому й береться прямо з реального виклику без refine), після чого сама
 * функція кастується до сигнатури з цим фіксованим поверненням і
 * `ResourceRefine` другим аргументом. РАНТАЙМ викликає справжній
 * `createInsertSchema(table, refine)` — рефайнмент і nullable/optional
 * рахує сам рушій; СТАТИЧНИЙ тип лишається тим самим, що й без refine
 * (ціна — тип рефайненої колонки лишається дефолтним `jsonSchema`, а не
 * звуженим до, наприклад, `z.array(z.string())` — рантайм-валідації це не
 * стосується). `createSelectSchema` рефайнмент НЕ отримує — читання рядків
 * (`rowSchema`) лишається дефолтним виведенням drizzle-zod.
 */
export function buildResourceSchemas<T extends Table, W extends ColumnName<T>>(
  table: T,
  writable: readonly W[],
  refine?: ResourceRefine,
) {
  const pickWritable = Object.fromEntries(writable.map((c) => [c, true])) as {
    [K in W]: true;
  };

  const rowSchema = createSelectSchema(table);

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
  // 🔴 Каст ФУНКЦІЇ (не аргументу) — див. докстрінг вище. `plainInsert`/
  // `plainUpdate` фіксують тип `ReturnType` (схема БЕЗ refine), до якого
  // кастується сигнатура реального виклику з `refine`; БЕЗ `refine` каст
  // узагалі не потрібен — ГІЛКА `else` викликає `plainInsert`/`plainUpdate`
  // напряму (той самий виклик, що йде під капотом типу), тож обидві функції
  // лишаються СПРАВЖНІМ значенням для лінту, а не лише джерелом типу.
  const plainInsert = () => createInsertSchema(table);
  const insertSchemaFull = refine
    ? (
        createInsertSchema as unknown as (
          t: T,
          r: ResourceRefine,
        ) => ReturnType<typeof plainInsert>
      )(table, refine)
    : plainInsert();
  const plainUpdate = () => createUpdateSchema(table);
  const updateSchemaFull = refine
    ? (
        createUpdateSchema as unknown as (
          t: T,
          r: ResourceRefine,
        ) => ReturnType<typeof plainUpdate>
      )(table, refine)
    : plainUpdate();
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

  return { rowSchema, insertSchema, updateSchema, removeSchema };
}
