// simplycms/domain/discounts — рушій знижок: ліс із плоских правил,
// реєстр умов, оцінка з чесним `applied`, порогові підказки (К3-Е6в).

export { resolveDiscount } from './resolve';
export {
  BUILT_IN_DISCOUNT_CONDITIONS,
  getDiscountCondition,
  parseDiscountCondition,
} from './conditions';
export { buildDiscountForest, countGroupSubtree } from './forest';
export { discountThresholdHints } from './hints';
export type {
  DiscountConditionDefinition,
  DiscountGroupRow,
  DiscountRules,
} from './types';

export type {
  DiscountType,
  GroupOperator,
  TargetType,
  DiscountTarget,
  DiscountCondition,
  Discount,
  DiscountGroup,
  DiscountContext,
  AppliedDiscount,
  DiscountRejectionReason,
  RejectedDiscount,
  DiscountResult,
  ThresholdHint,
} from 'simplycms/contracts';
