import { and, eq, getTableColumns, type Column, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Table } from 'drizzle-orm';
import type { ColumnName } from './resource-schemas';
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
 * - `exclude` — колонки таблиці, яких у read-model немає;
 * - `computed` — поле рядка → скалярний підзапит від `id` ресурсу (мініатюра товару —
 *   головне фото агрегата, `mainImageSql`): дані з дочірньої таблиці без JOIN, що множив
 *   би рядки сторінки. Такі поля не фільтруються й не сортуються.
 *
 * `INNER JOIN` перекладу основної мови: рядок БЕЗ нього — дефект даних (І4 це забороняє
 * тригером; фікстури без перекладу — виняток). Такий ресурс у `list` НЕ потрапляє, а не
 * з'являється з порожньою назвою (`name` в усіх споживачів — не `null`); сам стан
 * неможливий — constraint-тригер І4 відмовляє такому рядку на COMMIT.
 */
export interface ReadModelSpec<T extends Table = Table> {
  /** Таблиця перекладів (`<entity>_translations`) з колонками `locale` і FK-власником. */
  readonly translations: PgTable;
  /** FK перекладу на `id` ресурсу. */
  readonly owner: Column;
  readonly fields: Readonly<Record<string, Column>>;
  readonly required?: readonly string[];
  /** Колонки таблиці ресурсу, яких немає в read-model (імена перевіряє typecheck). */
  readonly exclude?: readonly ColumnName<T>[];
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

/** Тип поля read-model: дані колонки перекладу, без `null` для `required`. */
type FieldValue<RM extends ReadModelSpec, K extends keyof RM['fields']> =
  K extends RequiredField<RM>
    ? NonNullable<RM['fields'][K]['_']['data']>
    : RM['fields'][K]['_']['data'];

/**
 * Опційні ключі спеки — через `infer`, а не `NonNullable<RM['exclude']>`: у конфігу без
 * ключа індексований доступ бере тип з обмеження `ReadModelSpec` (усі колонки), і
 * `Omit` прибрав би з рядка все.
 */
type Excluded<RM> = RM extends { exclude: readonly (infer E extends string)[] }
  ? E
  : never;
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

/** Рядок read-model: рядок таблиці без `exclude` і перекритих полів + поля перекладу й обчислені. */
export type ReadRow<
  Row,
  RM extends ReadModelSpec | undefined,
> = RM extends ReadModelSpec
  ? Omit<Row, Excluded<RM> | Extract<keyof RM['fields'], string>> & {
      [K in keyof RM['fields']]: FieldValue<RM, K>;
    } & ComputedRow<RM>
  : Row;

/** Вибірка SELECT read-model: проєкція таблиці без `exclude` + поля перекладу й обчислені. */
export function readSelection(
  picked: Record<string, Column>,
  spec: ReadModelSpec,
  ownerId: Column,
): Record<string, Column | SQL.Aliased> {
  const hidden = new Set(spec.exclude ?? []);
  return {
    ...Object.fromEntries(
      Object.entries(picked).filter(([k]) => !hidden.has(k)),
    ),
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
