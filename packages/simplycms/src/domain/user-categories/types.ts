// Типи автоправил категорій покупців (Е6в-19). Колишній порт plpgsql
// `check_category_rules` приймав довільний текст у `field`/`operator` і
// мовчки трактував невідоме як хибну умову; з Е6в форму умов звужує
// `parseCategoryRuleConditions` (`parse.ts`) — і при записі (Zod адмінки), і
// при читанні правила з БД (зламаний jsonb → правило не спрацьовує).

/** Числові поля статистики (`>=`/`>`/`<=`/`<`/`=`). */
export type NumericRuleField =
  'total_purchases' | 'orders_count' | 'registration_days';

/** Текстові поля (`=`/`contains`). */
export type TextRuleField = 'email_domain' | 'utm_source' | 'utm_campaign';

/** Поле умови; `auth_provider` — лише `=` (ред.5). */
export type CategoryRuleField =
  NumericRuleField | TextRuleField | 'auth_provider';

export type CategoryRuleOperator = '>=' | '>' | '<=' | '<' | '=' | 'contains';

/** Одна умова з `conditions.rules[]`. Значення — рядок (так його пише форма). */
export interface CategoryRuleCondition {
  readonly field: CategoryRuleField;
  readonly operator: CategoryRuleOperator;
  readonly value: string;
}

/**
 * `category_rules.conditions`. `any` = АБО, `all` = І (Е6в-19); порожній
 * `rules` — невалідний (fail-closed на всіх рівнях, ред.2).
 */
export interface CategoryRuleConditions {
  readonly type: 'all' | 'any';
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

/**
 * Статистика покупця (Е6в-19). Обчислення — `commerce/customer-stats.ts`;
 * тут лише готові значення.
 */
export interface UserCategoryStats {
  /** Сума замовлень, крім скасованих. */
  readonly totalPurchases: number;
  /** Кількість замовлень, крім скасованих. */
  readonly ordersCount: number;
  readonly registrationDays: number;
  readonly emailDomain: string | null;
  /** Усі `accounts.provider_id` покупця: умова — «будь-який рядок має X». */
  readonly authProviders: readonly string[];
  readonly utmSource: string | null;
  readonly utmCampaign: string | null;
}

/** Рішення рушія. `changed: true` несе все для запису профілю й історії. */
export type CategoryTransitionResult =
  | {
      readonly changed: false;
    }
  | {
      readonly changed: true;
      readonly ruleId: string;
      readonly fromCategoryId: string;
      readonly toCategoryId: string;
      /** Текст для `user_category_history.reason`. */
      readonly reason: string;
    };
