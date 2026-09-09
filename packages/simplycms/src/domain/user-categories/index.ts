// simplycms/domain/user-categories — публічна поверхня рушія категорійних
// правил. Порт `check_category_rules` (див. `engine.ts`).

export { evaluateCategoryRules } from './engine';
export type {
  CategoryRule,
  CategoryRuleCondition,
  CategoryRuleConditions,
  CategoryTransitionResult,
  UserCategoryStats,
} from './types';
