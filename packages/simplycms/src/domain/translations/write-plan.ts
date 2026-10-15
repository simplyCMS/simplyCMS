// Чистий план запису перекладів (майстер §3.4, сценарії 1–3): що саме писати в
// рядки мов, які хеші джерела стампувати, чи не змінилось джерело, поки
// перекладач працював. IO немає: поточний стан приходить аргументом, а
// функцію хешу інжектує сервер (`sourceFieldHash`) — тут `node:crypto` не можна.
import {
  fieldHasText,
  toSourceRow,
  type TranslatableSpec,
  type TranslationRow,
} from './status';
import {
  TranslationValidationError,
  issue,
  mergeHashes,
  normalizePatch,
} from './write-parts';

/** Вхід плану. `patch` містить ЛИШЕ мови, які клієнт надіслав. */
export interface TranslationWriteInput {
  readonly spec: TranslatableSpec;
  readonly current: {
    /** Рядок основної мови; `null` — сутність ще створюється. */
    readonly source: Pick<TranslationRow, 'values'> | null;
    /** Наявні рядки інших мов (з їхніми `source_hashes`). */
    readonly byLocale: ReadonlyMap<string, TranslationRow>;
  };
  /** Код основної мови магазину. */
  readonly primary: string;
  readonly patch: ReadonlyMap<
    string,
    Readonly<Partial<Record<string, string | null>>>
  >;
  /** Сценарій 3: що перекладач бачив у джерелі, мова → поле → хеш. */
  readonly expectedSourceHashes?: ReadonlyMap<
    string,
    Readonly<Record<string, string>>
  >;
  readonly hash: (text: string) => string;
}

export interface TranslationUpsert {
  readonly locale: string;
  /** Лише надіслані поля; `null` очищує. */
  readonly values: Record<string, string | null>;
  /** Повний набір `source_hashes` рядка після запису (⊆ `spec.fields`). */
  readonly sourceHashes: Record<string, string>;
}

export interface TranslationWritePlan {
  /** Лише надіслані мови: видалень немає за типом (І11). */
  readonly upserts: TranslationUpsert[];
  /** Джерело змінилось → 409 `source_changed`; тоді `upserts` порожні. */
  readonly sourceChanged: null | {
    readonly locale: string;
    readonly current: Record<string, string>;
  };
}

/** Сценарій 3: перший розбіжний `expected` проти ЗБЕРЕЖЕНОГО джерела. */
function findSourceChange(
  input: TranslationWriteInput,
  sentLocales: ReadonlyMap<string, unknown>,
): TranslationWritePlan['sourceChanged'] {
  const { spec, current, primary, expectedSourceHashes, hash } = input;
  if (!expectedSourceHashes) return null;
  const stored = toSourceRow(
    spec,
    current.source?.values ?? {},
    hash,
  ).currentHashes;
  for (const [locale, expected] of expectedSourceHashes) {
    if (locale === primary || !sentLocales.has(locale)) continue;
    const unknown = Object.keys(expected).filter(
      (f) => !spec.fields.includes(f),
    );
    if (unknown.length > 0)
      throw new TranslationValidationError(
        unknown.map((f) => issue([locale, f], 'unrecognized_keys')),
      );
    if (Object.entries(expected).some(([field, h]) => stored[field] !== h))
      return { locale, current: stored };
  }
  return null;
}

/**
 * План запису агрегата перекладів. Мова без жодного надісланого поля в
 * `upserts` не потрапляє, як і мова поза `patch`.
 *
 * @throws TranslationValidationError невідоме поле, `null`/порожнє для
 *   обов'язкового, основна мова без обов'язкового поля.
 */
export function planTranslationWrite(
  input: TranslationWriteInput,
): TranslationWritePlan {
  const { spec, current, primary, patch, hash } = input;

  const sent = new Map<string, Record<string, string | null>>();
  for (const [locale, fields] of patch) {
    const values = normalizePatch(spec, locale, fields);
    if (Object.keys(values).length > 0) sent.set(locale, values);
  }

  const primaryValues = sent.get(primary);
  const newSource: TranslationRow['values'] = {
    ...current.source?.values,
    ...primaryValues,
  };
  if (primaryValues) {
    const missing = spec.required.filter(
      (f) => !fieldHasText(spec, f, newSource[f]),
    );
    if (missing.length > 0)
      throw new TranslationValidationError(
        missing.map((f) => issue([primary, f], 'too_small')),
      );
  }

  const sourceChanged = findSourceChange(input, sent);
  if (sourceChanged) return { upserts: [], sourceChanged };

  const upserts: TranslationUpsert[] = [];
  if (primaryValues)
    // Рядок джерела хешів джерела не має: він сам — джерело.
    upserts.push({ locale: primary, values: primaryValues, sourceHashes: {} });
  for (const [locale, values] of sent) {
    if (locale === primary) continue;
    upserts.push({
      locale,
      values,
      sourceHashes: mergeHashes(
        spec,
        current.byLocale.get(locale)?.hashes,
        values,
        newSource,
        hash,
      ),
    });
  }
  return { upserts, sourceChanged: null };
}
