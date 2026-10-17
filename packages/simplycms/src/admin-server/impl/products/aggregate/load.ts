import { eq, sql } from 'drizzle-orm';
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

/**
 * Корінь агрегата під `FOR NO KEY UPDATE` — ПЕРШИЙ запит кожної команди: усі записи
 * опису й перекладів серіалізуються на ньому (версія, хеш джерела, І13/І14).
 * 🔴 Саме NO KEY UPDATE, а не UPDATE: ключ рядка команди не міняють, а `FOR UPDATE`
 * конфліктує з `FOR KEY SHARE`, який бере FK при вставці дочірніх рядків — зокрема
 * рядків проєкції в `fill`/`setStatus` під `languages-set`; команда (рядок товару ->
 * `languages-set` у refresh) і вони (`languages-set` -> FK на рядок товару) давали
 * б цикл блокувань 40P01. Команди між собою серіалізуються й так.
 *
 * Ієрархія замків агрегата (порушення дає 40P01 або 23503):
 * (а) ЯВНІ рядкові замки коренів (`products`), сильніші за KEY SHARE, бере лише код
 *     агрегата: `lockProduct` (команда, ОДИН корінь, NO KEY UPDATE), `lockProductForRemove`
 *     і знімок каскадних медіа в `products.remove` (FOR UPDATE одного кореня),
 *     `lockOnRemove` модифікацій (кілька коренів, NO KEY UPDATE за id). Неявні UPDATE
 *     інших записувачів (каскад `SET NULL` розділу, `setTargetStatus` на checkout) беруть
 *     NO KEY UPDATE — сумісний із KEY SHARE fill і звірки. Тести «команда <-> setStatus»,
 *     «команда <-> fill» (`catalog-projection-locks`; мутація `FOR UPDATE` у `lockProduct`
 *     -> 40P01, раунд 1).
 * (б) рядки `product_modifications` видаляє лише `deleteModifications` (`FOR UPDATE ...
 *     ORDER BY id`, потім DELETE): опис товару, `remove` ресурсу модифікацій (хук
 *     `deleteRows`), `products.remove` (хук `deleteRows` ресурсу товарів, до DELETE
 *     товару). Сканер `modifications-deleter.test.ts`; мутація `ORDER BY id DESC` ->
 *     40P01 у «fill <-> saveDescription ... (засувка на меншому id)»
 *     (`catalog-projection-order`).
 * (в) хто тримає ЕКСКЛЮЗИВНИЙ `languages-set` (`setStatus`, add/remove/reorder мов,
 *     `reconcileProductTexts`), рядкових замків коренів сильніших за KEY SHARE не бере
 *     (лише KEY SHARE через FK і вибірки), але може ВИДАЛЯТИ рядки проєкції
 *     (`setStatus` -> `disabled`, `languages.remove` каскадом, зайві рядки у звірці):
 *     команда пише проєкцію лише під спільним `languages-set`, тож чекає цих власників,
 *     не тримаючи нічого з того, що вони блокують (KEY SHARE сумісний з її NO KEY UPDATE).
 *     Тест «команда <-> setStatus»; мутація «спільний замок у звірці» -> застарілий
 *     рядок у «reconcile (виправлення) проти команди».
 * (г) `languages.fill` і звірка беруть на `products` і модифікаціях не сильніше за
 *     `FOR KEY SHARE`, кожен рівень за id, і корінь РАНІШЕ за його модифікації
 *     (`copyTokensForLocale`); видалені паралельно рядки пропускають. Тести «fill <->
 *     видалення розділу» (мутація `FOR SHARE` -> 40P01), «products.remove <-> fill
 *     (адреса в мові вже є…)» (мутація «модифікації без кореня» -> 40P01), «fill <->
 *     saveDescription, що видаляє дві модифікації» (мутація `ORDER BY id DESC` у fill ->
 *     40P01), «reconcile проти видалення товару» (без KEY SHARE -> 23503).
 * (д) порядок завжди «корінь -> модифікації»; видалення кореня бере `FOR UPDATE` кореня
 *     ПЕРШИМ кроком (`lockProductForRemove`), а не посилює слабший замок після
 *     модифікацій. Знімок каскадних медіа і так посилює корінь до FOR UPDATE раніше за
 *     модифікації, тож мутація «NO KEY UPDATE у remove» тестом не ловиться — пункт тримає
 *     порядок явно, а не на побічному ефекті знімка.
 */
export async function lockProduct(db: ActorDb, id: string): Promise<number> {
  return lockRoot(db, id, 'no key update');
}

/** Корінь під `FOR UPDATE` — перший крок `products.remove` (ієрархія, пункт (д)). */
export async function lockProductForRemove(
  db: ActorDb,
  id: string,
): Promise<number> {
  return lockRoot(db, id, 'update');
}

async function lockRoot(
  db: ActorDb,
  id: string,
  strength: 'no key update' | 'update',
): Promise<number> {
  const [row] = await db
    .select({ version: products.version })
    .from(products)
    .where(eq(products.id, id))
    .for(strength);
  if (!row) throw new AdminNotFoundError('товар');
  return row.version;
}

/** Мови, що існують у магазині (будь-який статус): запис у невідому дав би сирий FK-збій. */
export async function assertKnownLocales(
  db: ActorDb,
  locales: readonly string[],
  at: (locale: string) => readonly string[],
): Promise<void> {
  if (locales.length === 0) return;
  const res = await db.execute<{ code: string }>(
    sql`select code from public.languages`,
  );
  const known = new Set(res.rows.map((r) => r.code));
  const bad = locales.filter((l) => !known.has(l));
  if (bad.length > 0)
    throw new ValidationError(
      bad.map((l) => ({ path: at(l), code: 'invalid_value' as const })),
    );
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
