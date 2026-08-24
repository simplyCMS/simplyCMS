import { and, eq, inArray } from 'drizzle-orm';
import {
  discountConditions,
  discountGroups,
  discountTargets,
  discounts,
} from 'simplycms/schema';
import type { DiscountGroup } from 'simplycms/contracts';
import type { ActorDb } from './db';
import {
  toDiscount,
  toDiscountGroupNode,
  type DiscountGroupRow,
} from './entities/discount';

/** Скільки рівнів предків добираємо, доки дерево не замкнеться. */
const PARENT_DEPTH_LIMIT = 8;

/**
 * Правила знижок для одного типу ціни — деревом, готовим для рушія домену.
 *
 * 🔴 Сервер віддає ДАНІ, а не результат: обчислення лишається в
 * `simplycms/domain/discounts`, бо ціна залежить від кількості й суми кошика,
 * які живуть у клієнті. Перенести формулу в SQL означало б мати дві
 * реалізації правил — а розходяться вони мовчки, різницею в чеку.
 *
 * 🔴 `is_active` (і в знижок, і в груп) фільтрується КОДОМ: RLS на цих
 * таблицях немає, `app_user` має SELECT на всю таблицю, тож забутий предикат
 * не впаде — він тихо роздасть вимкнену акцію.
 */
export async function loadDiscountGroups(
  db: ActorDb,
  priceTypeId: string,
): Promise<DiscountGroup[]> {
  const rows = await db
    .select()
    .from(discounts)
    .where(
      and(eq(discounts.priceTypeId, priceTypeId), eq(discounts.isActive, true)),
    );
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const targets = await db
    .select()
    .from(discountTargets)
    .where(inArray(discountTargets.discountId, ids));
  const conditions = await db
    .select()
    .from(discountConditions)
    .where(inArray(discountConditions.discountId, ids));

  const groups = await loadGroupClosure(
    db,
    Array.from(new Set(rows.map((row) => row.groupId))),
  );
  const nodes = new Map(
    groups.map((row) => [row.id, toDiscountGroupNode(row)]),
  );

  for (const row of rows) {
    nodes
      .get(row.groupId)
      ?.discounts.push(toDiscount(row, targets, conditions));
  }

  const roots: DiscountGroup[] = [];
  for (const row of groups) {
    const node = nodes.get(row.id);
    if (!node) continue;
    const parent = row.parentGroupId ? nodes.get(row.parentGroupId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/**
 * Групи знижок разом із їхніми предками.
 *
 * 🔴 Предки добираються ЦИКЛОМ, а не одним рівнем, як робив браузер: оператор
 * батька (`min`, `not`, …) вирішує долю дочірньої знижки, тож обірване дерево
 * дає інший результат, ніж те саме дерево в адмінці. Ліміт глибини —
 * запобіжник від циклу в даних, а не проєктна межа вкладеності.
 */
async function loadGroupClosure(
  db: ActorDb,
  seedIds: string[],
): Promise<DiscountGroupRow[]> {
  const collected = new Map<string, DiscountGroupRow>();
  let pending = seedIds;

  for (let depth = 0; depth < PARENT_DEPTH_LIMIT; depth++) {
    if (pending.length === 0) break;
    const rows = await db
      .select()
      .from(discountGroups)
      .where(
        and(
          inArray(discountGroups.id, pending),
          eq(discountGroups.isActive, true),
        ),
      );
    for (const row of rows) collected.set(row.id, row);
    pending = rows
      .map((row) => row.parentGroupId)
      .filter((id): id is string => id !== null && !collected.has(id));
  }
  return [...collected.values()];
}
