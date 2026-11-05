// Хелпер таблиці перекладів (М2, майстер §3.1, Р19–Р28): форма ОДНА для всіх
// сутностей — складений PK `(<власник>, locale)` без власного `id`, FK мови
// `ON DELETE RESTRICT`, `source_hashes` і `updated_at`. Ручне повторення цих рядків
// у кожній таблиці — клас розсинхрону (забутий індекс мови чи CHECK хешів), тож
// спільне живе тут, а таблиця описує лише своє: колонки власника, FK власника,
// перекладні колонки й додаткові CHECK.
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  type AnyPgColumn,
  type PgColumn,
  type PgColumnBuilderBase,
} from 'drizzle-orm/pg-core';
import { languages } from './schema';

/**
 * FK власника (завжди `ON DELETE CASCADE`: рядок перекладу живе і помирає разом із
 * власником, майстер §3.1; слайс, якому потрібне інше, змінює хелпер свідомо): імена колонок власника в цій таблиці → колонки сутності. Ім'я
 * обмеження явне (`…_modification_fkey`, `…_image_id_fkey`): вивести його з
 * колонок механічно не можна, а baseline уже зафіксував історичні імена.
 */
export interface OwnerFk<TOwnerKey extends string = string> {
  readonly columns: readonly TOwnerKey[];
  /** Thunk — щоб порядок оголошення таблиць у файлі не мав значення. */
  readonly foreignColumns: () => readonly AnyPgColumn[];
  readonly name: string;
}

type Check = ReturnType<typeof check>;

const SOURCE_HASHES_IS_OBJECT = (c: AnyPgColumn) =>
  sql`jsonb_typeof(${c}) = 'object'`;

export function translationTable<
  TName extends string,
  TOwner extends Record<string, PgColumnBuilderBase>,
  TText extends Record<string, PgColumnBuilderBase>,
>(
  name: TName,
  spec: {
    readonly owner: TOwner;
    /** Колонки власника, що разом із `locale` складають PK. */
    readonly pk: readonly (keyof TOwner & string)[];
    readonly ownerFks: readonly OwnerFk<keyof TOwner & string>[];
    readonly text: TText;
    readonly checks?: (
      t: Record<
        | (keyof TOwner & string)
        | (keyof TText & string)
        | 'locale'
        | 'sourceHashes'
        | 'updatedAt',
        PgColumn
      >,
    ) => readonly Check[];
  },
) {
  return pgTable(
    name,
    {
      ...spec.owner,
      locale: text().notNull(),
      ...spec.text,
      sourceHashes: jsonb('source_hashes')
        .$type<Record<string, string>>()
        .default({})
        .notNull(),
      updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
        .defaultNow()
        .notNull(),
    },
    (table) => {
      const t = table as unknown as Record<string, PgColumn>;
      return [
        primaryKey({
          columns: [...spec.pk, 'locale'].map((k) => t[k]!) as [
            PgColumn,
            ...PgColumn[],
          ],
          name: `${name}_pkey`,
        }),
        ...spec.ownerFks.map((fk) =>
          foreignKey({
            columns: fk.columns.map((k) => t[k]!) as [PgColumn, ...PgColumn[]],
            foreignColumns: [...fk.foreignColumns()] as [
              AnyPgColumn,
              ...AnyPgColumn[],
            ],
            name: fk.name,
          }).onDelete('cascade'),
        ),
        foreignKey({
          columns: [t.locale!],
          foreignColumns: [languages.code],
          name: `${name}_locale_fkey`,
        }).onDelete('restrict'),
        index(`idx_${name}_locale`).on(t.locale!),
        check(
          `${name}_source_hashes_object`,
          SOURCE_HASHES_IS_OBJECT(t.sourceHashes!),
        ),
        ...(spec.checks?.(t as never) ?? []),
      ];
    },
  );
}
