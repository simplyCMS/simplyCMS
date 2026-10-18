import { and, eq, getTableColumns, type Column } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Table } from 'drizzle-orm';
import type { ColumnName } from './resource-schemas';
import type { ActorDb } from 'simplycms/db';
import { primaryLocaleCode } from 'simplycms/translations';

/**
 * Read-model ресурсу (М1, Task 16 фікс-раунд 1): читальна вибірка `list`, яка НЕ збігається
 * з рядком таблиці. Потрібна ресурсам, чиї текстові колонки — тимчасове дзеркало основної
 * мови (`products.name`, `product_modifications.name`): колекції адмінки читають назву з
 * таблиці ПЕРЕКЛАДІВ основної мови, а дзеркальні колонки з читальної форми зникають, тож
 * Task 17 зносить їх без сюрпризів у споживачах.
 *
 * - `fields` — поле рядка → колонка таблиці перекладів; перекриває однойменну колонку
 *   таблиці у SELECT, фільтрі, сортуванні й `defaultOrder` (ОДНЕ місце, не латки в споживачах);
 * - `required` — поля з `NOT NULL` за інваріантом (І4: назва основної мови): тип без `null`;
 * - `exclude` — колонки таблиці, яких у read-model немає (решта дзеркал).
 *
 * `INNER JOIN` перекладу основної мови: рядок БЕЗ нього — дефект даних (І4 це забороняє
 * тригером; фікстури без перекладу — виняток). Такий ресурс у `list` НЕ потрапляє, а не
 * з'являється з порожньою назвою (`name` в усіх споживачів — не `null`). До Task 17 він
 * невидимий у колекції: лічильника у списку немає, але й створити такий стан через API
 * не можна (лише прямим SQL); з Task 17 його робить неможливим constraint-тригер І4.
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
}

/** Імена полів read-model: їх можна називати в `filterable`/`sortable`/`defaultOrder`, хоч колонки з таким іменем у таблиці вже може не бути (Task 17). */
export type ReadFieldName<RM> = RM extends ReadModelSpec
  ? Extract<keyof RM['fields'], string>
  : never;

/**
 * Гард конфігу: `required` називає лише поля read-model (одрук ловить typecheck, а не мовчить).
 */
export type ReadModelGuards<RM> = RM extends ReadModelSpec
  ? [Exclude<NonNullable<RM['required']>[number], keyof RM['fields']>] extends [
      never,
    ]
    ? unknown
    : {
        __unknownRequiredFields: Exclude<
          NonNullable<RM['required']>[number],
          keyof RM['fields']
        >;
      }
  : unknown;

/** Тип поля read-model: дані колонки перекладу, без `null` для `required`. */
type FieldValue<
  RM extends ReadModelSpec,
  K extends keyof RM['fields'],
> = K extends NonNullable<RM['required']>[number]
  ? NonNullable<RM['fields'][K]['_']['data']>
  : RM['fields'][K]['_']['data'];

/** Рядок read-model: рядок таблиці без `exclude` і перекритих полів + поля перекладу. */
export type ReadRow<
  Row,
  RM extends ReadModelSpec | undefined,
> = RM extends ReadModelSpec
  ? Omit<
      Row,
      NonNullable<RM['exclude']>[number] | Extract<keyof RM['fields'], string>
    > & { [K in keyof RM['fields']]: FieldValue<RM, K> }
  : Row;

/** Вибірка SELECT read-model: проєкція таблиці без `exclude` + поля перекладу. */
export function readSelection(
  picked: Record<string, Column>,
  spec: ReadModelSpec,
): Record<string, Column> {
  const hidden = new Set(spec.exclude ?? []);
  return {
    ...Object.fromEntries(
      Object.entries(picked).filter(([k]) => !hidden.has(k)),
    ),
    ...spec.fields,
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
