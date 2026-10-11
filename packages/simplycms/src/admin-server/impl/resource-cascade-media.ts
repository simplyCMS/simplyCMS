import { asc, getTableColumns, getTableName, inArray } from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { ActorDb } from 'simplycms/db';
import { eraseMediaRows } from 'simplycms/storage';
import { columnRefs } from './resource-media';

/**
 * Опція `cascadeMedia` фабрики (Е6д-19): дочірня таблиця, рядки якої FK
 * `ON DELETE CASCADE` видаляє разом із батьком, а вони несуть медіа. Каскад
 * БД рядків `media` не бачить: без опції видалення батька лишало б їх (і
 * файли) живими — публічно доступними за URL і недосяжними для подальших
 * стирань (напр. фото відгуків після видалення товару).
 *
 * `fk` — колонка дочірньої таблиці, що посилається на `id` батька; `column` —
 * медіа-колонка тієї ж таблиці (`text` або `jsonb`-масив референсів);
 * власник рядка `media` — `{ entityType, <id дочірнього рядка> }` (Е6д-16).
 */
export type ResourceCascadeMedia = {
  readonly fk: PgColumn;
  /** Дворівневий каскад (К3-Е6д-1, `sections → section_properties →
   *  property_options`): колонка проміжної таблиці, що посилається на `id`
   *  батька. Тоді `fk` дочірньої таблиці посилається на `id` ПРОМІЖНОЇ. */
  readonly via?: PgColumn;
  readonly column: PgColumn;
  readonly entityType: string;
};

/** Опис покриття для гейта класу (`media-cascade-coverage`): хто кого стирає. */
export type CascadeMediaCoverage = {
  readonly parent: string;
  readonly child: string;
  readonly column: string;
  /** Проміжна таблиця дворівневого каскаду. */
  readonly via?: string;
};

const idOf = (table: PgTable) => getTableColumns(table)['id'];

/** Рантайм-рубіж конфігу: обидві колонки з однієї дочірньої таблиці з `id`. */
export function assertCascadeMedia(
  table: Table,
  cascade: readonly ResourceCascadeMedia[],
): readonly ResourceCascadeMedia[] {
  for (const { fk, column, via } of cascade) {
    const child = getTableName(fk.table);
    // Збіг ланцюжка з реальними FK доводить гейт `media-cascade-coverage`.
    const viaBroken = via && (via.table === table || !idOf(via.table));
    if (
      viaBroken ||
      column.table !== fk.table ||
      !idOf(fk.table) ||
      fk.table === table
    )
      throw new Error(
        `[admin-server] ${getTableName(table)}: cascadeMedia ${child}.${column.name} — fk і колонка мусять бути з однієї дочірньої таблиці з id`,
      );
  }
  return cascade;
}

export const cascadeCoverage = (
  table: Table,
  cascade: readonly ResourceCascadeMedia[],
): readonly CascadeMediaCoverage[] =>
  cascade.map(({ fk, column, via }) => ({
    parent: getTableName(table),
    child: getTableName(fk.table),
    column: column.name,
    ...(via && { via: getTableName(via.table) }),
  }));

type ChildRefs = { entityType: string; id: string; refs: string[] };

/**
 * Знімок медіа дочірніх рядків ДО `DELETE` батька: після нього каскад їх уже
 * знищив. 🔴 Спершу `FOR UPDATE` батьків (`ORDER BY id`): вставка дочірнього
 * рядка тримає `FOR KEY SHARE` на батькові, тож та, що вже пройшла FK-перевірку,
 * закомітиться до нашого знімка (і потрапить у нього), а пізніша дочекається
 * нашого COMMIT і впаде на FK. Без цього лока відгук, вставлений між знімком і
 * `DELETE`, пішов би каскадом разом зі своїми фото, а рядки `media` лишились.
 */
export async function snapshotCascadeMedia(
  db: ActorDb,
  table: Table,
  cascade: readonly ResourceCascadeMedia[],
  ids: readonly string[],
): Promise<ChildRefs[]> {
  if (ids.length === 0 || cascade.length === 0) return [];
  const parentId = idOf(table as PgTable)!;
  await db
    .select({ id: parentId })
    .from(table as PgTable)
    .where(inArray(parentId, [...ids]))
    .orderBy(asc(parentId))
    .for('update');
  const out: ChildRefs[] = [];
  for (const { fk, column, entityType, via } of cascade) {
    const childId = idOf(fk.table)!;
    // Дворівневий каскад: спершу лочимо проміжні рядки — вставка дочірнього
    // під ними тримає `FOR KEY SHARE` на проміжному і дочекається нашого COMMIT.
    const parents = via
      ? (
          await db
            .select({ id: idOf(via.table)! })
            .from(via.table)
            .where(inArray(via, [...ids]))
            .orderBy(asc(idOf(via.table)!))
            .for('update')
        ).map((row) => String(row.id))
      : [...ids];
    if (parents.length === 0) continue;
    const rows = await db
      .select({ id: childId, value: column })
      .from(fk.table)
      .where(inArray(fk, parents))
      .orderBy(asc(childId))
      .for('update');
    for (const row of rows)
      out.push({ entityType, id: String(row.id), refs: columnRefs(row.value) });
  }
  return out;
}

/**
 * Стирання рядків `media` дочірніх записів, видалених каскадом (Е6д-14):
 * окремий `eraseMediaRows` на рядок з його власником (Е6д-16) — чужий ключ,
 * вписаний у колонку, сховище тихо пропускає. Повертає ключі для
 * `discardMedia` ПІСЛЯ COMMIT.
 */
export async function eraseCascadeMedia(
  db: ActorDb,
  children: readonly ChildRefs[],
): Promise<string[]> {
  const discard: string[] = [];
  for (const { entityType, id, refs } of children) {
    if (refs.length === 0) continue;
    discard.push(
      ...(await eraseMediaRows(db, refs, { entityType, entityId: id })),
    );
  }
  return discard;
}
