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
