import { and, eq, getTableColumns, type Column, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { ActorDb } from 'simplycms/db';
import { primaryLocaleCode } from 'simplycms/translations';

/**
 * Read-model ресурсу (М1, Task 16 фікс-раунд 1): читальна вибірка `list`, яка НЕ збігається
 * з рядком таблиці. Потрібна перекладним ресурсам (товар, модифікація): текстових колонок у
 * базі немає, і колекції адмінки читають назву з таблиці ПЕРЕКЛАДІВ основної мови.
 *
 * - `fields` — поле рядка → колонка таблиці перекладів; перекриває однойменну колонку
 *   таблиці у SELECT, фільтрі, сортуванні й `defaultOrder` (ОДНЕ місце, не латки в споживачах);
 * - `required` — поля з `NOT NULL` за інваріантом (І4: назва основної мови): тип без `null`;
 * - `computed` — поле рядка → скалярний підзапит від `id` ресурсу (мініатюра товару —
 *   головне фото агрегата, `mainImageSql`): дані з дочірньої таблиці без JOIN, що множив
 *   би рядки сторінки. Такі поля не фільтруються й не сортуються.
 *
 * Решта колонок таблиці (`picked`, без `omit` ресурсу) лишається в рядку як є: поле
 * «виключити колонку з read-model» знесено разом з останньою дзеркальною колонкою (М1,
 * Task 17) — без споживача воно лише множило гілки типу `ReadRow`.
 *
 * `INNER JOIN` перекладу основної мови: рядок БЕЗ нього — дефект даних (І4 це забороняє
 * тригером; фікстури без перекладу — виняток). Такий ресурс у `list` НЕ потрапляє, а не
 * з'являється з порожньою назвою (`name` в усіх споживачів — не `null`); сам стан
 * неможливий — constraint-тригер І4 відмовляє такому рядку на COMMIT.
 */
export interface ReadModelSpec {
  /** Таблиця перекладів (`<entity>_translations`) з колонками `locale` і FK-власником. */
  readonly translations: PgTable;
  /** FK перекладу на `id` ресурсу. */
  readonly owner: Column;
  readonly fields: Readonly<Record<string, Column>>;
  readonly required?: readonly string[];
  readonly computed?: Readonly<Record<string, (ownerId: Column) => SQL>>;
}

/** Імена полів read-model: їх можна називати в `filterable`/`sortable`/`defaultOrder`, хоч колонки з таким іменем у таблиці немає (`products.name` знесено, М1). */
export type ReadFieldName<RM> = RM extends ReadModelSpec
  ? Extract<keyof RM['fields'], string>
  : never;

/**
 * Гард конфігу: `required` називає лише поля read-model (одрук ловить typecheck, а не мовчить).
 */
export type ReadModelGuards<RM> = RM extends ReadModelSpec
  ? [Exclude<RequiredField<RM>, keyof RM['fields']>] extends [never]
    ? unknown
    : {
        __unknownRequiredFields: Exclude<RequiredField<RM>, keyof RM['fields']>;
      }
  : unknown;

/**
 * Тип поля read-model: дані колонки перекладу; `required` — без `null` (І4), інакше `null`
 * за nullability колонки. 🔴 `_['data']` Drizzle `null` НЕ містить (його додає `notNull`),
 * тож без цієї гілки nullable-поле перекладу було б типізоване як завжди заповнене.
 */
type FieldValue<RM extends ReadModelSpec, K extends keyof RM['fields']> =
  K extends RequiredField<RM>
    ? RM['fields'][K]['_']['data']
    : RM['fields'][K]['_']['notNull'] extends true
      ? RM['fields'][K]['_']['data']
      : RM['fields'][K]['_']['data'] | null;

/**
 * Опційні ключі спеки — через `infer`, а не `NonNullable<RM['required']>`: у конфігу без
 * ключа індексований доступ бере тип з обмеження `ReadModelSpec` (`string`), і кожне поле
 * стало б `required` (той самий клас дефекту вже раз прибрав з `ReadRow` усі колонки).
 */
type RequiredField<RM> = RM extends { required: readonly (infer R)[] }
  ? R
  : never;
type Computed<RM> = RM extends { computed: infer C } ? C : Record<never, never>;

/** Тип обчисленого поля — дані його SQL-виразу. */
type ComputedRow<RM> = {
  [K in keyof Computed<RM>]: Computed<RM>[K] extends (
    ...args: never[]
  ) => SQL<infer D>
    ? D
    : never;
};

/** Рядок read-model: рядок таблиці без перекритих полів + поля перекладу й обчислені. */
export type ReadRow<
  Row,
  RM extends ReadModelSpec | undefined,
> = RM extends ReadModelSpec
  ? Omit<Row, Extract<keyof RM['fields'], string>> & {
      [K in keyof RM['fields']]: FieldValue<RM, K>;
    } & ComputedRow<RM>
  : Row;

/** Вибірка SELECT read-model: проєкція таблиці + поля перекладу (перекривають) й обчислені. */
export function readSelection(
  picked: Record<string, Column>,
  spec: ReadModelSpec,
  ownerId: Column,
): Record<string, Column | SQL.Aliased> {
  return {
    ...picked,
    ...spec.fields,
    ...Object.fromEntries(
      // Псевдонім обов'язковий: Drizzle не дає посилатися на сирий SQL без `.as()`.
      Object.entries(spec.computed ?? {}).map(([k, f]) => [
        k,
        f(ownerId).as(k),
      ]),
    ),
  };
}

/** Умова JOIN перекладу основної мови; основну читаємо з БД, не літералом. */
export async function readJoinOn(
  db: ActorDb,
  spec: ReadModelSpec,
  ownerId: Column,
) {
  const locale = getTableColumns(spec.translations)['locale'];
  if (!locale)
    throw new Error(
      '[admin-server] read-model: у таблиці перекладів немає `locale`',
    );
  return and(eq(spec.owner, ownerId), eq(locale, await primaryLocaleCode(db)));
}
