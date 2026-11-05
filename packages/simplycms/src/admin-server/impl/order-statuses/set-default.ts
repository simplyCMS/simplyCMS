import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { AdminNotFoundError } from 'simplycms/contracts/domain-errors';
import { assertVersionThenHash, defineOperation } from 'simplycms/operations';
import { orderStatuses } from 'simplycms/schema';
import { lockRoots, bumpVersion } from '../translatable/roots';
import { expectedVersion, versionOut } from '../translatable/wire';
import { ORDER_STATUS_ROOT } from './root';

/**
 * Дефолт рівно один. 🔴 Порядок під частковим unique-індексом: СПОЧАТКУ зняти з
 * колишнього, ПОТІМ поставити цільовий — зворотний порядок дав би два true й 23505.
 *
 * 🔴 Замки: колишній дефолт відомий лише з БД, а читання «хто дефолтний» до замка гонилось
 * би з паралельним `setDefault`. Тому беруться ВСІ рядки довідника одним `lockRoots`
 * (відсортовані id — спільний порядок із `reorder` і `remove`, цикл неможливий); таблиця
 * мала (десятки рядків). Версію піднімають обидва записані рядки (Д7): ETag колишнього
 * дефолту теж застарів. Уже дефолтний → нічого не пишемо.
 */
export const orderStatusesSetDefault = defineOperation({
  id: 'order-statuses.setDefault',
  permission: 'catalog.write',
  versioned: true,
  input: z.object({ id: z.uuid(), expectedVersion }),
  output: versionOut,
  async run({ db }, input) {
    const all = await db.select({ id: orderStatuses.id }).from(orderStatuses);
    const versions = await lockRoots(
      db,
      ORDER_STATUS_ROOT,
      all.map((r) => r.id),
      'no key update',
    );
    const version = versions.get(input.id);
    if (version === undefined)
      throw new AdminNotFoundError('статус замовлення');
    assertVersionThenHash(version, input.expectedVersion, () => undefined);
    const previous = await db
      .select({ id: orderStatuses.id })
      .from(orderStatuses)
      .where(
        and(eq(orderStatuses.isDefault, true), ne(orderStatuses.id, input.id)),
      );
    const [self] = await db
      .select({ isDefault: orderStatuses.isDefault })
      .from(orderStatuses)
      .where(eq(orderStatuses.id, input.id));
    if (self?.isDefault && previous.length === 0) return { version };
    for (const { id } of previous)
      await bumpVersion(db, ORDER_STATUS_ROOT, id, { isDefault: false });
    return {
      version: await bumpVersion(db, ORDER_STATUS_ROOT, input.id, {
        isDefault: true,
      }),
    };
  },
});
