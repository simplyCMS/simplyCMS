// Оцінка окремих умов правила — винесено з `engine.ts`, щоб файл-рушій
// лишався коротким і читався як послідовність кроків алгоритму
// `check_category_rules`, а не потопав у деталях кожного оператора.

import type {
  CategoryRuleCondition,
  CategoryRuleConditions,
  UserCategoryStats,
} from './types';

/** Порівняння для числових полів (`total_purchases`, `registration_days`,
 *  `orders_count`). Оригінал робив `v_value::numeric`/`::integer` і впав би
 *  винятком на непарсибельному значенні — чиста функція винятків не кидає
 *  (контракт T1: нуль побічних ефектів), тож непарсибельне значення трактуємо
 *  як хибну умову (fail-closed), а не як «правило не існує». */
function compareNumeric(
  statValue: number,
  operator: string,
  rawValue: string,
): boolean {
  const value = Number(rawValue);
  if (Number.isNaN(value)) return false;

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
      // Невідомий оператор — CASE … ELSE false в оригіналі.
      return false;
  }
}

/** Порівняння для текстових полів з підтримкою `contains` (`email_domain`,
 *  `utm_source`, `utm_campaign`). `NULL` у SQL порівнюється в NULL (хибно
 *  в IF) — тут те саме через явний null-guard. */
function compareText(
  statValue: string | null,
  operator: string,
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

/** Одна умова з `conditions->'rules'[]` → true/false. */
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
    case 'auth_provider':
      // 🔴 Оригінал ІГНОРУЄ operator для цього поля — завжди пряма рівність
      // (`v_stats.auth_provider = v_value`, без CASE по оператору). Повторюємо
      // буквально, хоч це і виглядає непослідовно порівняно з рештою полів.
      return stats.authProvider === item.value;
    case 'utm_source':
      return compareText(stats.utmSource, item.operator, item.value);
    case 'utm_campaign':
      return compareText(stats.utmCampaign, item.operator, item.value);
    default:
      // Невідоме поле — CASE … ELSE false в оригіналі: уся умова провалена.
      return false;
  }
}

/** Усі умови правила → true/false.
 *
 * 🔴 Оригінал ЗАВЖДИ рахує AND по всіх умовах, незалежно від `conditions.type`:
 * `type = 'all'` лише вмикає дострокове переривання циклу на першій хибній
 * умові (`EXIT` в plpgsql), `type = 'any'`/будь-що інше просто не перериває
 * цикл раніше — але семантика AND лишається тією самою (нема жодного OR-гілки
 * в коді). Це фактично мертва/непрацююча "any"-гілка оригіналу; порт
 * відтворює її буквально, а не додає OR, якого в SQL не було.
 *
 * Порожній список умов (`conditions.rules = []`, дефолт стовпця в БД) —
 * цикл по нулю елементів не змінює початкове `true`, тож правило вважається
 * УМОВНО ВИКОНАНИМ («вакуумна істина»). Це навмисно, не хиба порту. */
export function conditionsMatch(
  conditions: CategoryRuleConditions,
  stats: UserCategoryStats,
): boolean {
  let met = true;
  for (const item of conditions.rules) {
    met = met && evaluateCondition(item, stats);
    if (!met && conditions.type === 'all') break;
  }
  return met;
}
