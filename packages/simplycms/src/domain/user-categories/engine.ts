// Рушій автоправил категорій покупців (Е6в-19) — чиста T1-функція.
//
// 🔴 Чому не в БД. Колишні `check_category_rules` / `check_all_users_
// category_rules` були SECURITY DEFINER без перевірки прав і викликні роллю
// `anon` (борг №12 роадмапу). У v2 логіка живе тут, а хто має право її
// запустити — вирішує серверний шар (`commerce/customer-categories.ts`,
// операції `customer.manage`), а не «хто вгадав назву RPC».

import { conditionsMatch } from './conditions';
import type {
  CategoryRule,
  CategoryTransitionResult,
  UserCategoryStats,
} from './types';

/**
 * Перехід категорії за правилами. Нуль IO: правила, поточна категорія й
 * статистика — на вході; запис — відповідальність виклику.
 *
 * @param currentCategoryId Поточна категорія покупця. 🔴 Не-null (Е6в-19):
 *   профіль з `category_id NULL` виклик оцінює як дефолтну категорію —
 *   колишній SQL tri-state (`NULL` → жодне правило не спрацьовує) знесено.
 */
export function evaluateCategoryRules(
  rules: readonly CategoryRule[],
  currentCategoryId: string,
  stats: UserCategoryStats,
): CategoryTransitionResult {
  // Array#sort стабільний (ES2019+): рівний пріоритет зберігає вхідний порядок.
  const eligible = rules
    .filter((rule) => rule.isActive)
    .filter(
      (rule) =>
        rule.fromCategoryId === null ||
        rule.fromCategoryId === currentCategoryId,
    )
    .slice()
    .sort((a, b) => b.priority - a.priority);

  for (const rule of eligible) {
    if (!conditionsMatch(rule.conditions, stats)) continue;
    // Правило в ту саму категорію — не перехід; оцінюється наступне.
    if (rule.toCategoryId === currentCategoryId) continue;
    return {
      changed: true,
      ruleId: rule.id,
      fromCategoryId: currentCategoryId,
      toCategoryId: rule.toCategoryId,
      reason: `Автоматично за правилом: ${rule.name}`,
    };
  }

  return { changed: false };
}
