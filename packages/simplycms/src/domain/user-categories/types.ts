// Типи категорійних правил — порт `category_rules`/`get_user_stats` з
// колишньої plpgsql-логіки (`check_category_rules`, git-історія
// 6ea5b55:supabase/migrations/20260204155230_*.sql). Форми навмисно близькі
// до жовтня jsonb-стовпців БД: `conditions` — те, що лежить у
// `category_rules.conditions`, без нормалізації полем-enum-ом, бо оригінал
// теж приймав довільний текст у `field`/`operator` і мовчки трактував
// невідоме як хибну умову (CASE … ELSE false).

/** Одна умова з `conditions->'rules'[]`. Значення завжди текстові — так їх
 *  віддає `jsonb ->> 'value'` в оригіналі; парсинг у число/дату — на совісті
 *  конкретного поля (`engine.ts`). */
export interface CategoryRuleCondition {
  readonly field: string;
  readonly operator: string;
  readonly value: string;
}

/** `category_rules.conditions` — jsonb-стовпець. `type` в оригіналі впливав
 *  ЛИШЕ на дострокове переривання циклу умов, не на семантику AND/OR (борг
 *  оригіналу — див. коментар в `engine.ts`, повторюємо як є). */
export interface CategoryRuleConditions {
  readonly type?: string;
  readonly rules: readonly CategoryRuleCondition[];
}

/** Рядок `category_rules`, звужений до полів, потрібних рушію переходу. */
export interface CategoryRule {
  readonly id: string;
  readonly name: string;
  readonly fromCategoryId: string | null;
  readonly toCategoryId: string;
  readonly conditions: CategoryRuleConditions;
  readonly isActive: boolean;
  readonly priority: number;
}

/** Статистика користувача — те, що повертав `get_user_stats(p_user_id)`.
 *  Обчислення (JOIN по orders/order_statuses, EXTRACT з profiles.created_at)
 *  лишається serverFn-шару К3 — тут лише готові значення. */
export interface UserCategoryStats {
  readonly totalPurchases: number;
  readonly ordersCount: number;
  readonly registrationDays: number;
  readonly emailDomain: string | null;
  readonly authProvider: string | null;
  readonly utmSource: string | null;
  readonly utmCampaign: string | null;
}

/** Рішення рушія. Коли `changed: true` — достатньо даних, щоб виклик (К3)
 *  зробив `UPDATE profiles.category_id` + `INSERT user_category_history`
 *  без повторного звернення до правил. */
export type CategoryTransitionResult =
  | {
      readonly changed: false;
    }
  | {
      readonly changed: true;
      readonly ruleId: string;
      readonly fromCategoryId: string | null;
      readonly toCategoryId: string;
      /** Той самий текст, що писав оригінал у `user_category_history.reason`. */
      readonly reason: string;
    };
