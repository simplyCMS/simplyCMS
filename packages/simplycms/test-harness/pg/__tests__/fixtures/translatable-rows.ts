// Загальна фабрика рядків «база + переклади» для харнесу (М2, Р24): та сама форма,
// що в графі товару, але без жодної прив'язки до товару — перша нова перекладна
// сутність (статуси замовлень) і всі наступні беруть її як є. Графовий
// `product-graph-rows.ts` лишається тонкою обгорткою над нею.
//
// 🔴 Замок `languages-set` бере НЕ тут: оператори віддаються масивом, а блок
// під замком збирає `inLockedBlock` (`product-graph.ts`) — ОДИН `do`, тож
// замок живе рівно стільки, скільки запис.
import { lit } from './sql-literal';
import { GUARDED_TABLES } from './writer-guard';

/** Основна мова — підзапит до `languages.is_default`, не літерал. */
export const PRIMARY = '(select code from public.languages where is_default)';
export type Row = Record<string, string | undefined>;

export const insertInto = (table: string, row: Row): string => {
  const entries = Object.entries(row).filter(([, v]) => v !== undefined);
  return `insert into public.${table} (${entries.map(([k]) => k).join(', ')}) values (${entries.map(([, v]) => v).join(', ')})`;
};

/**
 * Рядок перекладних колонок: `columns` — поле → колонка БД, `texts` — значення
 * (`undefined` — колонку не пишемо, `null` — пишемо `null`).
 */
export const textRowOf = (
  columns: Readonly<Record<string, string>>,
  texts: Readonly<Record<string, string | null | undefined>>,
): Row =>
  Object.fromEntries(
    Object.entries(columns)
      .filter(([field]) => texts[field] !== undefined)
      .map(([field, column]) => [column, lit(texts[field])]),
  );

/**
 * Оператори сутності: рядок бази, далі рядки перекладів — основна мова (ключ
 * `PRIMARY`) першою, бо тригер джерела (І4) вимагає її на COMMIT.
 */
export function translatableStatements(spec: {
  table: string;
  base: Row;
  translationTable: string;
  ownerColumn: string;
  id: string;
  texts: Readonly<
    Record<string, Readonly<Record<string, string | null | undefined>>>
  >;
  textColumns: Readonly<Record<string, string>>;
}): string[] {
  // Імена таблиць тут — звичайні поля, тож гард єдиного записувача графа товару
  // (регекси над текстом) цей шлях не бачить; захист — відмова під час виконання.
  for (const t of [spec.table, spec.translationTable])
    if (GUARDED_TABLES.includes(t))
      throw new Error(
        `translatableStatements: «${t}» пише лише граф товару — використай productGraphStatements / modificationSql / valueSql (fixtures/product-graph*.ts)`,
      );
  const locales = Object.keys(spec.texts).sort(
    (a, b) => Number(b === PRIMARY) - Number(a === PRIMARY),
  );
  return [
    insertInto(spec.table, { id: lit(spec.id), ...spec.base }),
    ...locales.map((locale) =>
      insertInto(spec.translationTable, {
        [spec.ownerColumn]: lit(spec.id),
        locale: locale === PRIMARY ? PRIMARY : lit(locale),
        ...textRowOf(spec.textColumns, spec.texts[locale]!),
      }),
    ),
  ];
}
