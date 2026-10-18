import { eq } from 'drizzle-orm';
import {
  AdminNotFoundError,
  ValidationError,
} from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';
import { currentPaths } from 'simplycms/addressing';
import {
  fieldStatus,
  isRichField,
  rowStatus,
  toSourceRow,
} from 'simplycms/domain/translations';
import { products } from 'simplycms/schema';
import { knownLocales } from './children-common';
import { loadChildren } from './children-read';
import type { TextsRow } from './schemas';
import {
  TRANSLATABLE,
  fieldToWire,
  loadTranslations,
  primaryLocaleCode,
  sourceFieldHash,
  type StoredTranslation,
} from 'simplycms/translations';

const SPEC = TRANSLATABLE.product;

// Замки кореня й порядок замків агрегата — `lock-order.ts` (тут реекспорт для викликачів).
export { lockProduct, lockProductForRemove } from './lock-order';

/**
 * Мови, що існують у магазині (будь-який статус): запис у невідому дав би сирий FK-збій.
 * Набір мов читає ОДИН запит (`knownLocales`) і повертається викликачу — дочірні кроки
 * агрегата беруть той самий набір, а не перечитують його.
 */
export async function assertKnownLocales(
  db: ActorDb,
  locales: readonly string[],
  at: (locale: string) => readonly string[],
): Promise<Set<string>> {
  const known = await knownLocales(db);
  const bad = locales.filter((l) => !known.has(l));
  if (bad.length > 0)
    throw new ValidationError(
      bad.map((l) => ({ path: at(l), code: 'invalid_value' as const })),
    );
  return known;
}

/** Рядки перекладів товару: основна мова окремо від решти (вхід плану запису). */
export async function loadState(db: ActorDb, id: string) {
  const primary = await primaryLocaleCode(db);
  const all = (await loadTranslations(db, SPEC, [id])).get(id) ?? new Map();
  const byLocale = new Map<string, StoredTranslation>(all);
  byLocale.delete(primary);
  return { primary, source: all.get(primary) ?? null, byLocale };
}

const asFlags = <T>(values: Readonly<Record<string, T>>): Record<string, T> =>
  Object.fromEntries(
    Object.entries(values).map(([f, v]) => [fieldToWire(f), v]),
  );

/** `products.get` (без блокування): база, тексти зі статусами полів, поточні адреси. */
export async function getProductAggregate(db: ActorDb, id: string) {
  const [row] = await db.select().from(products).where(eq(products.id, id));
  if (!row) throw new AdminNotFoundError('товар');
  const { primary, source, byLocale } = await loadState(db, id);
  const src = toSourceRow(SPEC, source?.values ?? {}, sourceFieldHash);
  const texts: Record<string, TextsRow> = {};
  const rows = new Map(byLocale);
  if (source)
    rows.set(primary, { values: source.values, hashes: src.currentHashes });
  for (const [locale, stored] of rows) {
    const perField = Object.fromEntries(
      SPEC.fields.map((f) => [
        f,
        fieldStatus(
          stored.values[f] ?? null,
          stored.hashes[f],
          src.currentHashes[f] ?? null,
          isRichField(SPEC, f),
        ),
      ]),
    );
    texts[locale] = {
      ...(asFlags(stored.values) as Omit<TextsRow, 'status' | 'fieldStatus'>),
      status: rowStatus(SPEC, src, stored),
      fieldStatus: asFlags(perField),
    };
  }
  return {
    id,
    version: row.version,
    base: {
      sectionId: row.sectionId,
      sku: row.sku,
      isActive: row.isActive,
      isFeatured: row.isFeatured,
      hasModifications: row.hasModifications,
      stockStatus: row.stockStatus,
    },
    texts,
    paths: Object.fromEntries(await currentPaths(db, { kind: 'product', id })),
    ...(await loadChildren(db, id, primary)),
  };
}
