import type { DiscountRejectionReason } from 'simplycms/contracts';
import type { MessageKey } from 'simplycms/i18n';

/**
 * Текст причини відхилення (Е6в-6). 🔴 `Record` по всьому юніону: новий код
 * причини в T0 не зберається, доки для нього немає рядка в діагностиці —
 * власник бачить пояснення, а не сирий код.
 */
export const REJECTION_REASON_KEY: Record<DiscountRejectionReason, MessageKey> =
  {
    inactive: 'admin.validator.reason.inactive',
    out_of_dates: 'admin.validator.reason.out_of_dates',
    group_inactive: 'admin.validator.reason.group_inactive',
    group_out_of_dates: 'admin.validator.reason.group_out_of_dates',
    target_mismatch: 'admin.validator.reason.target_mismatch',
    condition_failed: 'admin.validator.reason.condition_failed',
    condition_unknown: 'admin.validator.reason.condition_unknown',
    condition_invalid: 'admin.validator.reason.condition_invalid',
    discount_invalid: 'admin.validator.reason.discount_invalid',
    lost_to_operator: 'admin.validator.reason.lost_to_operator',
    exceeds_price: 'admin.validator.reason.exceeds_price',
  };
