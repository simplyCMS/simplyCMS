// simplycms/domain/user-categories — публічна поверхня рушія автоправил
// категорій покупців (Е6в-19).

export { evaluateCategoryRules } from './engine';
export {
  CATEGORY_RULE_FIELD_OPERATORS,
  MAX_CATEGORY_RULE_CONDITIONS,
  parseCategoryRuleConditions,
} from './parse';
export type {
  CategoryRule,
  CategoryRuleCondition,
  CategoryRuleConditions,
  CategoryRuleField,
  CategoryRuleOperator,
  CategoryTransitionResult,
  NumericRuleField,
  TextRuleField,
  UserCategoryStats,
} from './types';
