// Рушій категорійних правил — чистий порт plpgsql-функції
// `check_category_rules(p_user_id)` (git-історія
// 6ea5b55:supabase/migrations/20260204155230_a2d0d1ec-6669-4b37-be2e-22a4ce63077f.sql).
//
// 🔴 Чому воно взагалі тут, а не в БД. Оригінальні `check_category_rules` і
// `check_all_users_category_rules` були SECURITY DEFINER БЕЗ перевірки прав
// усередині й викликні напряму через PostgREST роллю `anon` — тобто будь-хто
// без автентифікації міг перезаписати категорію будь-якому користувачу
// магазину (борг №12 роадмапу). У v2 такої функції в БД просто немає: логіка
// живе тут як чиста T1-функція, а хто має право її викликати — вирішує
// authz-шар serverFn (К3), а не «хто зумів угадати назву RPC».
//
// Це ПОРТ, а не покращення: оцінка окремих умов (`conditions.ts`) навмисно
// повторює особливості оригіналу, які виглядають як вади, — вони
// задокументовані по місцю й закриті тестами (`__tests__/`), щоб майбутній
// рефакторинг не «полагодив» їх мовчки і не змінив бізнес-поведінку, яку
// правила магазину вже очікують.

import { conditionsMatch } from './conditions';
import type {
  CategoryRule,
  CategoryTransitionResult,
  UserCategoryStats,
} from './types';

/**
 * Чиста функція обчислення переходу категорії — заміна
 * `check_category_rules(p_user_id)`. Нуль IO: усі дані (правила, поточна
 * категорія, статистика) передаються на вхід, запис у БД — відповідальність
 * виклику (serverFn К3).
 *
 * @param rules            Рядки `category_rules` (фільтр/сортування — робота
 *                          цієї функції, як робив і оригінальний SQL-курсор).
 * @param currentCategoryId Поточна `profiles.category_id` користувача.
 * @param stats            Результат, еквівалентний `get_user_stats`.
 */
export function evaluateCategoryRules(
  rules: readonly CategoryRule[],
  currentCategoryId: string | null,
  stats: UserCategoryStats,
): CategoryTransitionResult {
  // WHERE is_active = true AND (from_category_id IS NULL OR from_category_id = current)
  // ORDER BY priority DESC — Array#sort стабільний (ES2019+), тож рівний
  // пріоритет зберігає вхідний порядок (те саме, що робить SQL за замовчуванням
  // на практиці, хоч формально ORDER BY без тайбрейка порядок не гарантує).
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

    // 🔴 SQL tri-state: `v_rule.to_category_id != v_current_category_id` при
    // NULL-евій поточній категорії дає NULL, а `IF NULL THEN` в plpgsql —
    // хибно (не помилка, просто «не виконати»). Наслідок оригіналу: якщо в
    // користувача ЩЕ немає категорії (`profiles.category_id IS NULL`),
    // жодне правило НІКОЛИ не переведе його автоматично — навіть те, що
    // формально підходить. У JS null-порівняння строге (`!==`), тому тут
    // явний guard, який відтворює саме цю (небажану, але узгоджену з БД)
    // поведінку, а не «покращує» її.
    if (currentCategoryId === null) continue;
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
