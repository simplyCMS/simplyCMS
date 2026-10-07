import { inArray } from 'drizzle-orm';
import { categoryRules } from 'simplycms/schema';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';
import { stateConflict } from '../errors';
import type { ResourceGuardWrite } from '../resource-config';

interface RuleFields {
  fromCategoryId?: string | null;
  toCategoryId?: string;
}

type RuleWrite = ResourceGuardWrite<RuleFields & { id: string }, RuleFields>;

function assertDistinct(from?: string | null, to?: string) {
  if (from && to && from === to)
    stateConflict(ADMIN_STATE_CONSTRAINT.categoryRuleSameCategory);
}

/**
 * Правило не переводить у ту саму категорію (Е6в-19):
 * `fromCategoryId === toCategoryId` → `category_rule_same_category`.
 * Insert — з рядка; update — злиття ПОТОЧНОГО рядка з patch (patch лише з
 * `toCategoryId`, рівним наявному `from`, інакше пройшов би). Викликається
 * фабрикою після `CUSTOMER_CONFIG_LOCK`, у тій самій транзакції.
 */
export async function guardCategoryRules(
  db: ActorDb,
  write: RuleWrite,
): Promise<void> {
  if (write.kind === 'insert') {
    for (const row of write.rows)
      assertDistinct(row.fromCategoryId, row.toCategoryId);
    return;
  }
  const touched = write.updates.filter(
    (u) =>
      u.patch.fromCategoryId !== undefined ||
      u.patch.toCategoryId !== undefined,
  );
  if (touched.length === 0) return;
  const current = await db
    .select({
      id: categoryRules.id,
      fromCategoryId: categoryRules.fromCategoryId,
      toCategoryId: categoryRules.toCategoryId,
    })
    .from(categoryRules)
    .where(
      inArray(
        categoryRules.id,
        touched.map((u) => u.id),
      ),
    );
  const byId = new Map(current.map((r) => [r.id, r]));
  for (const { id, patch } of touched) {
    const row = byId.get(id);
    assertDistinct(
      patch.fromCategoryId !== undefined
        ? patch.fromCategoryId
        : row?.fromCategoryId,
      patch.toCategoryId ?? row?.toCategoryId,
    );
  }
}
