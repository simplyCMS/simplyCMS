import type { DiscountType, GroupOperator } from 'simplycms/contracts';
import type { MessageKey } from 'simplycms/i18n';

/** Оператори групи — у порядку select-а (енам БД `discount_group_operator`). */
export const GROUP_OPERATORS = [
  'and',
  'or',
  'not',
  'min',
  'max',
] as const satisfies readonly GroupOperator[];

/** Короткий підпис оператора — бейдж у дереві. */
export const OPERATOR_SHORT: Record<GroupOperator, MessageKey> = {
  and: 'admin.discounts.op.and',
  or: 'admin.discounts.op.or',
  not: 'admin.discounts.op.not',
  min: 'admin.discounts.op.min',
  max: 'admin.discounts.op.max',
};

/** Довгий підпис оператора — пункт select-а картки групи. */
export const OPERATOR_LONG: Record<GroupOperator, MessageKey> = {
  and: 'admin.discounts.op.andLong',
  or: 'admin.discounts.op.orLong',
  not: 'admin.discounts.op.notLong',
  min: 'admin.discounts.op.minLong',
  max: 'admin.discounts.op.maxLong',
};

export const DISCOUNT_TYPES = [
  'percent',
  'fixed_amount',
  'fixed_price',
] as const satisfies readonly DiscountType[];

export const DISCOUNT_TYPE_LABEL: Record<DiscountType, MessageKey> = {
  percent: 'admin.discounts.type.percent',
  fixed_amount: 'admin.discounts.type.fixedAmount',
  fixed_price: 'admin.discounts.type.fixedPrice',
};

/** Службове значення select-а «тип ціни» для `NULL` («усі типи», Е6в-2). */
export const ALL_PRICE_TYPES = '__all__';
