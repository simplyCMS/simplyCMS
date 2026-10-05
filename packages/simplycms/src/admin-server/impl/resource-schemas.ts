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
 * Єдина межа між РУНТАЙМ-формою і ОГОЛОШЕНИМ типом: перевіряє `z.object(shape)`
 * (strip: невідомі ключі відкидає), а тип задає `Out`, виведений з Drizzle
 * (`InferInsertModel`/`InferSelectModel`). Каст тут єдиний у шляху схем:
 * `.pipe(z.custom<Out>())` не компілюється (вхід `custom` — `Out`, а
 * `pipe` вимагає вхід = вихід обʼєкта), тож тип оголошується явно.
 * Відповідність типу формі стереже гейт паритету
 * (`columns-to-zod-parity.test.ts`) — компілятор її не бачить.
 */
function declared<Out>(shape: Record<string, z.ZodType>): z.ZodType<Out, Out> {
  return z.object(shape) as unknown as z.ZodType<Out, Out>;
}

/**
 * Колонки з `InferInsertModel`, відфільтровані за ключами `K`. 🔴 Саме
 * мапінг з `as`, а не `Pick<M, K & keyof M>`: `keyof InferInsertModel<T>`
 * під generic-`T` губить необовʼязкові ключі (перевірено проби), а `Pick`
 * вимагає `K ⊆ keyof M`, чого TS генерично не доводить («завжди
 * згенеровані» колонки в insert-моделі відсутні). Опційність зберігається.
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
 * `declared`, тож статичні типи — оголошені, а не виведені з generic-таблиці.
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
  const rowSchema = declared<Omit<InferSelectModel<T>, O>>(
    pickKeys(selectShape, rowKeys),
  );

  const insertRowSchema = declared<InsertPick<T, W | I> & { id: string }>({
    ...pickKeys(columnsToZod(table, 'insert', refine), [
      ...writable,
      ...insertOnly,
    ]),
    id: z.uuid(), // 🔴 Е0: ключ генерує клієнт; z.uuid() — канон Zod 4
  });
  const patchSchema = declared<Partial<InsertPick<T, W>>>(
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
