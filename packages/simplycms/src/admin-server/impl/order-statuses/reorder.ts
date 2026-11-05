import { asc, desc, eq, gt, inArray, lt } from 'drizzle-orm';
import { z } from 'zod';
import {
  AdminNotFoundError,
  VersionMismatchError,
} from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';
import { assertVersionThenHash, defineOperation } from 'simplycms/operations';
import { orderStatuses } from 'simplycms/schema';
import { bumpVersion, lockRoots } from '../translatable/roots';
import { expectedVersion } from '../translatable/wire';
import { ORDER_STATUS_ROOT } from './root';

/**
 * Swap `sort_order` із сусідом — В ОДНІЙ транзакції. Сусід шукається в БД за фактичним
 * `sort_order`, не в клієнтському кеші. Краю (немає сусіда) — no-op: версію не піднімаємо.
 *
 * 🔴 Детермінований порядок замків (фінальне рев'ю Е1б, знахідка 1; 40P01 на живому
 * Postgres): обидва рядки беруться ОДНИМ `lockRoots` за відсортованими id — незалежно від
 * напряму свопу, тож циклу очікування з зустрічним `reorder` чи `setDefault` немає. Версію
 * піднімають обидва записані рядки (Д7); `expectedVersion` звіряється для цільового.
 */
export const orderStatusesReorder = defineOperation({
  id: 'order-statuses.reorder',
  permission: 'catalog.write',
  versioned: true,
  input: z.object({
    id: z.uuid(),
    direction: z.enum(['up', 'down']),
    expectedVersion,
  }),
  output: z.object({ version: z.number().int(), swapped: z.boolean() }),
  async run({ db }, input) {
    const up = input.direction === 'up';
    const found = await neighbour(db, input.id, up);
    if (!found) throw new AdminNotFoundError('статус замовлення');
    const versions = await lockRoots(
      db,
      ORDER_STATUS_ROOT,
      found.next ? [input.id, found.next] : [input.id],
      'no key update',
    );
    const version = versions.get(input.id);
    if (version === undefined)
      throw new AdminNotFoundError('статус замовлення');
    assertVersionThenHash(version, input.expectedVersion, () => undefined);
    // Сусіда знайдено ДО замка: паралельний своп іншої пари міг зробити його несуміжним, а
    // версія цільового при цьому не змінилась. Перевірка під замком; розбіжність — 412,
    // клієнт перечитує список.
    const again = await neighbour(db, input.id, up);
    if (again?.next !== found.next) throw new VersionMismatchError(version);
    if (!found.next || !versions.has(found.next))
      return { version, swapped: false };
    // Значення порядку читаються ПІД замком обох рядків.
    const rows = await db
      .select({ id: orderStatuses.id, sortOrder: orderStatuses.sortOrder })
      .from(orderStatuses)
      .where(inArray(orderStatuses.id, [input.id, found.next]));
    const order = new Map(rows.map((r) => [r.id, r.sortOrder]));
    await bumpVersion(db, ORDER_STATUS_ROOT, found.next, {
      sortOrder: order.get(input.id),
    });
    return {
      version: await bumpVersion(db, ORDER_STATUS_ROOT, input.id, {
        sortOrder: order.get(found.next),
      }),
      swapped: true,
    };
  },
});

/** Сусід за фактичним `sort_order` у БД: `null` — рядка немає, `{next: undefined}` — край. */
async function neighbour(db: ActorDb, id: string, up: boolean) {
  const [seen] = await db
    .select({ sortOrder: orderStatuses.sortOrder })
    .from(orderStatuses)
    .where(eq(orderStatuses.id, id));
  if (!seen) return null;
  const [next] = await db
    .select({ id: orderStatuses.id })
    .from(orderStatuses)
    .where(
      up
        ? lt(orderStatuses.sortOrder, seen.sortOrder)
        : gt(orderStatuses.sortOrder, seen.sortOrder),
    )
    .orderBy(up ? desc(orderStatuses.sortOrder) : asc(orderStatuses.sortOrder))
    .limit(1);
  return { next: next?.id };
}
