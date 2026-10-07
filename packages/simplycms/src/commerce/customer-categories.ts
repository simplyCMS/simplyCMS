import { randomUUID } from 'node:crypto';
import { asc, eq, sql } from 'drizzle-orm';
import { advisoryXactLock, type ActorDb } from 'simplycms/db';
import {
  evaluateCategoryRules,
  parseCategoryRuleConditions,
  type CategoryRule,
} from 'simplycms/domain';
import { categoryRules, profiles, userCategoryHistory } from 'simplycms/schema';
import { loadDefaultUserCategoryId } from './categories';
import { loadCustomerStats } from './customer-stats';

/**
 * Advisory-ключ категорії одного покупця (Е6в-15): будь-яка зміна його
 * категорії — вручну (`assignCustomerCategory`) чи правилом — серіалізована
 * ним. Живе в `commerce`, бо ним користуються і вітрина, і адмінка.
 */
export function customerCategoryLock(userId: string): string {
  return `customer-category:${userId}`;
}

export interface CategoryChange {
  userId: string;
  fromCategoryId: string | null;
  toCategoryId: string;
  reason: string | null;
  ruleId: string | null;
  /** Адмін, що призначив вручну; `null` — автоправило. */
  changedBy: string | null;
}

const categoryName = (id: string) =>
  sql<string>`(select name from public.user_categories where id = ${id})`;

/**
 * Запис переходу: `profiles.category_id` + рядок `user_category_history` зі
 * знімком назв (Е6в-2) — історія переживає видалення категорії. Викликач
 * тримає `customerCategoryLock` і рядок профілю `FOR UPDATE`.
 */
export async function writeCategoryChange(
  db: ActorDb,
  change: CategoryChange,
): Promise<void> {
  const updated = await db
    .update(profiles)
    .set({ categoryId: change.toCategoryId, updatedAt: new Date() })
    .where(eq(profiles.userId, change.userId))
    .returning({ id: profiles.id });
  if (updated.length === 0)
    throw new Error(`[commerce] профілю покупця ${change.userId} не існує`);
  await db.insert(userCategoryHistory).values({
    id: randomUUID(),
    userId: change.userId,
    fromCategoryId: change.fromCategoryId,
    toCategoryId: change.toCategoryId,
    fromCategoryName:
      change.fromCategoryId === null
        ? null
        : categoryName(change.fromCategoryId),
    toCategoryName: categoryName(change.toCategoryId),
    reason: change.reason,
    ruleId: change.ruleId,
    changedBy: change.changedBy,
  });
}

/** Умови правила або `null`; розбір рядка не кидає ніколи (Е6в-25). */
function safeConditions(raw: unknown) {
  try {
    return parseCategoryRuleConditions(raw);
  } catch {
    return null;
  }
}

/**
 * Активні правила з розібраними умовами — РЯДОК ЗА РЯДКОМ (Е6в-25: один
 * пошкоджений рядок правил не ламає розрахунок магазину). Правило з
 * невалідним jsonb (вписане SQL-ем в обхід Zod: ключ прототипу, порожні
 * умови, невідоме поле чи оператор) пропускається з `console.error`, решта
 * оцінюється як звичайно — fail-closed (Е6в-19 ред.2).
 */
async function loadActiveRules(db: ActorDb): Promise<CategoryRule[]> {
  const rows = await db
    .select()
    .from(categoryRules)
    .where(eq(categoryRules.isActive, true))
    // Рівний пріоритет рушій лишає у вхідному порядку — порядок детермінований.
    .orderBy(asc(categoryRules.id));
  return rows.flatMap((row) => {
    const conditions = safeConditions(row.conditions);
    if (conditions) return [{ ...row, conditions }];
    // Службовий лог (не рядок інтерфейсу), з id — щоб власник знайшов рядок.
    console.error(
      `[simplycms/commerce] category rule ${row.id} skipped: conditions do not parse`,
    );
    return [];
  });
}

export type CategoryRulesOutcome = 'changed' | 'unchanged' | 'skipped';

/**
 * Автоправила для одного покупця (Е6в-19) у транзакції викликача.
 *
 * 1. `customerCategoryLock(userId)` — ПЕРШИЙ запит.
 * 2. Профіль `FOR UPDATE`. Немає профілю або `category_locked` (ручне
 *    призначення, Е6в-20) → `'skipped'`.
 * 3. `category_id NULL` оцінюється як дефолтна категорія.
 * 4. Статистика, активні правила, рушій; перехід → профіль + історія з
 *    `rule_id` і без `changed_by`.
 */
export async function applyCategoryRules(
  db: ActorDb,
  userId: string,
): Promise<CategoryRulesOutcome> {
  await advisoryXactLock(db, customerCategoryLock(userId));
  const [profile] = await db
    .select({
      categoryId: profiles.categoryId,
      locked: profiles.categoryLocked,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .for('update');
  if (!profile || profile.locked) return 'skipped';

  const current = profile.categoryId ?? (await loadDefaultUserCategoryId(db));
  if (current === null) return 'unchanged';
  const stats = await loadCustomerStats(db, userId, new Date());
  if (!stats) return 'skipped';

  const result = evaluateCategoryRules(
    await loadActiveRules(db),
    current,
    stats,
  );
  if (!result.changed) return 'unchanged';
  await writeCategoryChange(db, {
    userId,
    fromCategoryId: result.fromCategoryId,
    toCategoryId: result.toCategoryId,
    reason: result.reason,
    ruleId: result.ruleId,
    changedBy: null,
  });
  return 'changed';
}
