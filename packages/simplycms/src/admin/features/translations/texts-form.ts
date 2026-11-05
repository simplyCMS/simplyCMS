import type { LocaleStatuses, TranslationStatus } from './translation-context';

/** Тексти за мовами у вигляді форми: кожне поле — рядок (`null` з БД стає ''). */
export type TextsForm<F extends string> = Record<string, Record<F, string>>;

/** Порожній рядок перекладу для набору полів. */
export function emptyRow<F extends string>(
  fields: readonly F[],
): Record<F, string> {
  return Object.fromEntries(fields.map((f) => [f, ''])) as Record<F, string>;
}

/**
 * Тексти агрегата → форма. Мови без рядка перекладу отримують порожні поля
 * (у статусах це «немає перекладу»), мови агрегата поза `locales` теж зберігаються.
 */
export function textsToForm<F extends string>(
  fields: readonly F[],
  texts: Readonly<Record<string, Readonly<Partial<Record<F, string | null>>>>>,
  locales: readonly string[],
): TextsForm<F> {
  const codes = [...new Set([...locales, ...Object.keys(texts)])];
  const out: TextsForm<F> = {};
  for (const l of codes) {
    const row = texts[l];
    out[l] = Object.fromEntries(
      fields.map((f) => [f, row?.[f] ?? '']),
    ) as Record<F, string>;
  }
  return out;
}

/** Статуси рядків перекладу з відповіді агрегата — для вкладок і бейджів полів. */
export function localeStatusesOf(
  texts: Readonly<
    Record<
      string,
      {
        readonly status: string;
        readonly fieldStatus: Readonly<Record<string, string>>;
      }
    >
  >,
): Record<string, LocaleStatuses> {
  return Object.fromEntries(
    Object.entries(texts).map(([l, r]) => [
      l,
      {
        status: r.status as TranslationStatus,
        fieldStatus: r.fieldStatus as Record<string, TranslationStatus>,
      },
    ]),
  );
}
