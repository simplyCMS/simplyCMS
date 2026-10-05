import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm';
import { z } from 'zod';
import { columnsToZod } from './columns-to-zod';

/** Імена колонок Drizzle-таблиці (TS-ключі, camelCase). */
export type ColumnName<T extends Table> = Extract<
  keyof T['_']['columns'],
  string
>;

/**
 * Форма `refine` ресурсу: ключ — імʼя колонки, значення — ФУНКЦІЯ
 * `(defaultSchema) => ZodType`. 🔴 Саме функція, не голий `ZodType`:
 * `columnsToZod` навішує `.nullable()/.optional()` ПОВЕРХ результату
 * функції, тож колонка без `.notNull()` лишається необовʼязковою в patch-і
 * (кожен `update` інакше мусив би нести поле, якого не чіпає).
 */
export type ResourceRefine = Record<string, (schema: never) => z.ZodType>;

/**
 * Єдиний каст ОГОЛОШЕННЯ типу виходу (ще один — типовий, при виклику refine
 * у `columns-to-zod.ts`). Оголошує, що `z.object(shape)` дає значення типу
 * `Out` (`InferInsertModel`/`InferSelectModel` з Drizzle, звужені до
 * writable/omit). Компілятор цього довести не може: форма будується в
 * рантаймі з generic-таблиці. 🔴 Чому не `.pipe(z.custom<Out>(() => true))`:
 * така форма БЕЗ касту компілюється (за `Out extends Record<string,
 * unknown>`), але вхідний тип стає `{[k: string]: unknown}` і послаблює
 * типізацію входу валідаторів `createServerFn` на клієнті; каст
 * `ZodType<Out, Out>` лишає вхід = `Out`.
 * Межа доказу: гейт паритету доводить рантайм-еквівалентність
 * `columnsToZod` ≡ drizzle-zod (оракул) для всіх колонок ресурсних таблиць;
 * відповідність ОГОЛОШЕНОГО типу (InferInsertModel/InferSelectModel)
 * рантайм-формі він доводить лише опосередковано — оракул і тип Drizzle
 * виводять optional/nullable за тими самими правилами колонки. Не покрито:
 * колонки з `$type<>` (jsonb — оголошений тип вужчий за рантайм-валідацію) і
 * результати refine проти типу колонки; їх стережуть expectTypeOf і рев'ю.
 * `ZodObject`: невідомі ключі мовчки відкидаються (так само в drizzle-zod
 * 0.8.3: `handleColumns` повертає `z.object`, не `strictObject`).
 */
function declareSchema<Out>(
  shape: Record<string, z.ZodType>,
): z.ZodType<Out, Out> {
  return z.object(shape) as unknown as z.ZodType<Out, Out>;
}

/**
 * Колонки з `InferInsertModel`, відфільтровані за ключами `K`. Мапінг з `as`,
 * а не `Pick<M, K & keyof M>`: на generic-`T` `keyof InferInsertModel<T>`
 * губить необовʼязкові ключі (відкладене обчислення умовних типів), а `Pick`
 * вимагає `K ⊆ keyof M`, чого TS генерично не доводить («завжди
 * згенеровані» колонки в insert-моделі відсутні). Це обмеження TypeScript
 * на генеричному `Pick`, не бібліотеки. Опційність зберігається.
 */
type InsertPick<T extends Table, K> = {
  [
    P in keyof InferInsertModel<T> as P extends K ? P : never
  ]: InferInsertModel<T>[P];
};

/** Підмножина форми за ключами (звичайний `Pick` над обʼєктом схем). */
function pickKeys(
  shape: Record<string, z.ZodType>,
  keys: readonly string[],
): Record<string, z.ZodType> {
  return Object.fromEntries(
    keys.flatMap((k) => (shape[k] ? [[k, shape[k]]] : [])),
  );
}

/**
 * Zod-схеми ресурсу адмінки, виведені з Drizzle-таблиці через власний
 * генератор `columnsToZod`: rowSchema для читання, insert/update/remove для
 * запису, звужені до `writable`. Pick/omit/extend виконуються над формою ДО
 * `declareSchema`, тож статичні типи — оголошені, а не виведені з generic-таблиці.
 */
export function buildResourceSchemas<
  T extends Table,
  W extends ColumnName<T>,
  I extends ColumnName<T> = never,
  O extends ColumnName<T> = never,
>(
  table: T,
  writable: readonly W[],
  refine?: ResourceRefine,
  // 🔴 Е4-5: колонки, які пишуться ЛИШЕ при створенні рядка — входять у
  //   insert-схему, але НЕ в update-patch.
  insertOnly: readonly I[] = [],
  // 🔴 Е5-7: приховані колонки — їх немає в rowSchema (у insert/update їх і
  //   так немає: вони не writable/insertOnly).
  omit: readonly O[] = [],
) {
  const selectShape = columnsToZod(table, 'select');
  const rowKeys = Object.keys(selectShape).filter(
    (k) => !(omit as readonly string[]).includes(k),
  );
  const rowSchema = declareSchema<Omit<InferSelectModel<T>, O>>(
    pickKeys(selectShape, rowKeys),
  );

  const insertRowSchema = declareSchema<InsertPick<T, W | I> & { id: string }>({
    ...pickKeys(columnsToZod(table, 'insert', refine), [
      ...writable,
      ...insertOnly,
    ]),
    id: z.uuid(), // 🔴 Е0: ключ генерує клієнт; z.uuid() — канон Zod 4
  });
  const patchSchema = declareSchema<Partial<InsertPick<T, W>>>(
    pickKeys(columnsToZod(table, 'update', refine), writable),
  ).refine((p) => Object.keys(p).length > 0, {
    // 🔴 Порожній patch — 400 на межі, не «No values to set» з drizzle:
    // усі писані поля optional, тож `{ id, patch: {} }` без цього refine
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
