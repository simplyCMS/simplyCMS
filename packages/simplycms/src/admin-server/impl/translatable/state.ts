import type { ContentLocale } from 'simplycms/contracts';
import type { ActorDb } from 'simplycms/db';
import {
  fieldStatus,
  isRichField,
  rowStatus,
  toSourceRow,
  type FieldStatus,
  type TranslatableSpec,
} from 'simplycms/domain/translations';
import {
  loadTranslations,
  primaryLocaleCode,
  sourceFieldHash,
  type StoredTranslation,
  type TranslatableEntity,
} from 'simplycms/translations';
import { toWireKeys } from './wire';

/** Рядки перекладів сутності: основна мова окремо від решти (вхід плану запису). */
export async function loadTextState(
  db: ActorDb,
  spec: TranslatableEntity,
  id: string,
): Promise<{
  primary: ContentLocale;
  source: StoredTranslation | null;
  byLocale: Map<string, StoredTranslation>;
}> {
  const primary = await primaryLocaleCode(db);
  const all = (await loadTranslations(db, spec, [id])).get(id) ?? new Map();
  const byLocale = new Map<string, StoredTranslation>(all);
  byLocale.delete(primary);
  return { primary, source: all.get(primary) ?? null, byLocale };
}

/**
 * Значення полів мов зі статусами відносно рядка основної мови (формула `textsRow`).
 * Ключі `fields` — дротові; `values` — поля реєстру, як у сховищі.
 */
export function textStatuses(
  spec: TranslatableSpec,
  rows: ReadonlyMap<string, StoredTranslation> | undefined,
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
      fields: toWireKeys(
        Object.fromEntries(
          spec.fields.map((f) => [
            f,
            fieldStatus(
              stored.values[f] ?? null,
              target.hashes?.[f],
              src.currentHashes[f] ?? null,
              isRichField(spec, f),
            ),
          ]),
        ),
      ),
    };
  }
  return out;
}

/**
 * Адаптер під форму `get` агрегата: рядок мови = дротові поля + `status` + `fieldStatus`.
 * Порядок мов: решта за стабільним порядком `byLocale`, основна — останньою.
 */
export function textRows(
  spec: TranslatableSpec,
  state: {
    primary: string;
    source: StoredTranslation | null;
    byLocale: ReadonlyMap<string, StoredTranslation>;
  },
) {
  const rows = new Map(state.byLocale);
  if (state.source) rows.set(state.primary, state.source);
  return Object.fromEntries(
    Object.entries(textStatuses(spec, rows, state.primary)).map(([l, r]) => [
      l,
      { ...toWireKeys(r.values), status: r.status, fieldStatus: r.fields },
    ]),
  );
}
