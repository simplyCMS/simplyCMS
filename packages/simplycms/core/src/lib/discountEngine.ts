// Перенесено в @simplycms/domain/discounts. Re-export для зворотної сумісності.
export { resolveDiscount } from '@simplycms/domain/discounts';
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
  RejectedDiscount,
  DiscountResult,
} from '@simplycms/domain/discounts';
