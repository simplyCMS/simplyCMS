import { emptyRow, type TextsForm } from './texts-form';

/**
 * Свіжі тексти БД + те, що користувач змінив ПІСЛЯ відправки запиту: поле, що
 * відрізняється між відправленим (`sent`) і поточним (`now`), лишається
 * поточним, решту бере БД. Так перечитування після власного збереження не
 * затирає введене під час запиту.
 */
export function rebaseTexts<F extends string>(
  fields: readonly F[],
  fresh: TextsForm<F>,
  sent: TextsForm<F>,
  now: TextsForm<F>,
): TextsForm<F> {
  const out: TextsForm<F> = structuredClone(fresh);
  for (const [locale, row] of Object.entries(now))
    for (const f of fields)
      if (row[f] !== (sent[locale]?.[f] ?? '')) {
        out[locale] ??= emptyRow(fields);
        out[locale][f] = row[f];
      }
  return out;
}

/** Поле, чию правку користувач зробив після відправки запиту. */
export interface TextEdit<F extends string> {
  readonly locale: string;
  readonly field: F;
  readonly value: string;
}

/**
 * Правки користувача ПІСЛЯ відправки, що відрізняються від свіжого знімка БД.
 * Форма після `reset(fresh)` накладає їх через `setValue(..., { shouldDirty: true })`,
 * тож введене лишається зміною, а не «збереженим» значенням; спільне для картки
 * товару (`resetAfterSave`) і `useTranslatableTexts`.
 */
export function textsEdits<F extends string>(
  fields: readonly F[],
  fresh: TextsForm<F>,
  sent: TextsForm<F>,
  now: TextsForm<F>,
): TextEdit<F>[] {
  const next = rebaseTexts(fields, fresh, sent, now);
  const out: TextEdit<F>[] = [];
  for (const [locale, row] of Object.entries(next))
    for (const field of fields)
      if (row[field] !== (fresh[locale]?.[field] ?? ''))
        out.push({ locale, field, value: row[field] });
  return out;
}
