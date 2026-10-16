import {
  fieldStatus,
  isRichField,
  rowStatus,
  toSourceRow,
  type FieldStatus,
  type TranslatableSpec,
} from 'simplycms/domain/translations';
import {
  fieldToWire,
  sourceFieldHash,
  type StoredTranslation,
} from 'simplycms/translations';

/** Значення полів мов зі статусами відносно рядка основної мови (формула `textsRow`). */
export function withStatuses(
  spec: TranslatableSpec,
  rows: Map<string, StoredTranslation> | undefined,
  primary: string,
) {
  const source = rows?.get(primary);
  const src = toSourceRow(spec, source?.values ?? {}, sourceFieldHash);
  const out: Record<
    string,
    {
      values: StoredTranslation['values'];
      status: FieldStatus;
      fields: Record<string, FieldStatus>;
    }
  > = {};
  for (const [locale, stored] of rows ?? []) {
    const target =
      locale === primary
        ? { values: stored.values, hashes: src.currentHashes }
        : stored;
    out[locale] = {
      values: stored.values,
      status: rowStatus(spec, src, target),
      fields: Object.fromEntries(
        spec.fields.map((f) => [
          fieldToWire(f),
          fieldStatus(
            stored.values[f] ?? null,
            target.hashes?.[f],
            src.currentHashes[f] ?? null,
            isRichField(spec, f),
          ),
        ]),
      ),
    };
  }
  return out;
}
