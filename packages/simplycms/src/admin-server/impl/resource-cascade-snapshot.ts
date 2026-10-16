import { asc, inArray } from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { ActorDb } from 'simplycms/db';
import { eraseMediaRows } from 'simplycms/storage';
import { idOf, type ResourceCascadeMedia } from './resource-cascade-media';
import { columnRefs } from './resource-media';

// Знімок медіа дочірніх рядків до `DELETE` батька й стирання їхніх рядків `media`
// після (Е6д-19). Опис опції `cascadeMedia` і її перевірка — `resource-cascade-media.ts`.

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
  for (const { fk, column, entityType, via, owner } of cascade) {
    // Таблиця без `id` (переклад із складеним PK): порядок локів за fk, власник — `owner`.
    const childId = idOf(fk.table) ?? fk;
    // Дворівневий каскад: спершу лочимо проміжні рядки — вставка дочірнього
    // під ними тримає `FOR KEY SHARE` на проміжному і дочекається нашого COMMIT.
    const ownerInVia = !!via && owner?.table === via.table;
    const viaRows = via
      ? await db
          .select({
            id: idOf(via.table)!,
            owner: ownerInVia ? owner! : idOf(via.table)!,
          })
          .from(via.table)
          .where(inArray(via, [...ids]))
          .orderBy(asc(idOf(via.table)!))
          .for('update')
      : [];
    const parents = via ? viaRows.map((row) => String(row.id)) : [...ids];
    if (parents.length === 0) continue;
    const ownerOfParent = new Map(
      viaRows.map((row) => [String(row.id), String(row.owner)]),
    );
    const rows = await db
      .select({
        id: childId,
        value: column,
        parent: fk,
        own: owner && !ownerInVia ? owner : childId,
      })
      .from(fk.table)
      .where(inArray(fk, parents))
      .orderBy(asc(childId))
      .for('update');
    for (const row of rows)
      out.push({
        entityType,
        id: ownerInVia
          ? (ownerOfParent.get(String(row.parent)) ?? String(row.id))
          : String(row.own),
        refs: columnRefs(row.value),
      });
  }
  return out;
}

/**
 * Стирання рядків `media` дочірніх записів, видалених каскадом (Е6д-14):
 * окремий `eraseMediaRows` на рядок з його власником (Е6д-16) — чужий ключ,
 * вписаний у колонку, сховище тихо пропускає. Повертає ключі для
 * `completeMediaErasures` ПІСЛЯ COMMIT.
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
