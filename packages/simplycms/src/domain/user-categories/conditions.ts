// Оцінка умов автоправила (Е6в-19) — окремо від `engine.ts`, щоб рушій
// читався як послідовність кроків, а не потопав у деталях операторів.
// Чиста функція винятків не кидає: непарсибельне значення чи невідомий
// оператор — хибна умова (fail-closed).

import type {
  CategoryRuleCondition,
  CategoryRuleConditions,
  CategoryRuleOperator,
  UserCategoryStats,
} from './types';

function compareNumeric(
  statValue: number,
  operator: CategoryRuleOperator,
  rawValue: string,
): boolean {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return false;
  switch (operator) {
    case '>=':
      return statValue >= value;
    case '>':
      return statValue > value;
    case '<=':
      return statValue <= value;
    case '<':
      return statValue < value;
    case '=':
      return statValue === value;
    default:
      return false;
  }
}

/** Мітки немає (`null`) — умова хибна, а не помилка. */
function compareText(
  statValue: string | null,
  operator: CategoryRuleOperator,
  rawValue: string,
): boolean {
  if (statValue === null) return false;
  switch (operator) {
    case '=':
      return statValue === rawValue;
    case 'contains':
      return statValue.includes(rawValue);
    default:
      return false;
  }
}

function evaluateCondition(
  item: CategoryRuleCondition,
  stats: UserCategoryStats,
): boolean {
  switch (item.field) {
    case 'total_purchases':
      return compareNumeric(stats.totalPurchases, item.operator, item.value);
    case 'registration_days':
      return compareNumeric(stats.registrationDays, item.operator, item.value);
    case 'orders_count':
      return compareNumeric(stats.ordersCount, item.operator, item.value);
    case 'email_domain':
      return compareText(stats.emailDomain, item.operator, item.value);
    case 'utm_source':
      return compareText(stats.utmSource, item.operator, item.value);
    case 'utm_campaign':
      return compareText(stats.utmCampaign, item.operator, item.value);
    case 'auth_provider':
      // Будь-який рядок `accounts` покупця має `provider_id = X` (Е6в-19).
      return item.operator === '=' && stats.authProviders.includes(item.value);
    default:
      return false;
  }
}

/**
 * Умови правила → true/false. `any` — АБО, `all` — І (Е6в-19).
 *
 * 🔴 Порожній список умов — `false` (ред.2): «вакуумна істина» колишнього
 * порту при «Запустити всі правила» перевела б увесь магазин.
 */
export function conditionsMatch(
  conditions: CategoryRuleConditions,
  stats: UserCategoryStats,
): boolean {
  if (conditions.rules.length === 0) return false;
  const met = (item: CategoryRuleCondition) => evaluateCondition(item, stats);
  if (conditions.type === 'any') return conditions.rules.some(met);
  if (conditions.type === 'all') return conditions.rules.every(met);
  return false;
}
