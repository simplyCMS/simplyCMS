import { z } from 'zod';
import type { MessageKey } from 'simplycms/i18n';
import type { ShippingRate } from 'simplycms/schema/types';
import { SHIPPING_CALCULATION_TYPES } from './rate-calculation-types';

/** Грошове/ваговe поле numeric(10,2): порожнє = NULL, інакше число з ≤2 знаками. */
const optionalDecimal = z
  .string()
  .trim()
  .regex(/^(\d{1,8}(\.\d{1,2})?)?$/);

/**
 * Форма тарифу (Е6а-1): усі редаговані колонки `shipping_rates`, крім
 * `config` (службовий JSON плагінів К5 — у вбудованих провайдерів порожній).
 * `numeric` в Drizzle — рядок, тож і форма тримає рядки.
 */
export const shippingRateFormSchema = z.object({
  zoneId: z.string().min(1),
  name: z.string().trim().min(1),
  calculationType: z.enum(SHIPPING_CALCULATION_TYPES),
  baseCost: optionalDecimal.min(1),
  perKgCost: optionalDecimal,
  minWeight: optionalDecimal,
  freeFromAmount: optionalDecimal,
  minOrderAmount: optionalDecimal,
  maxOrderAmount: optionalDecimal,
  estimatedDays: z.string().trim().max(50),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
});

export type ShippingRateFormInput = z.input<typeof shippingRateFormSchema>;
export type ShippingRateFormValues = z.output<typeof shippingRateFormSchema>;

/** Числові поля діалогу: колонка → ключ підпису. */
export const RATE_DECIMAL_FIELDS = [
  ['baseCost', 'admin.shipping.rates.baseCost'],
  ['perKgCost', 'admin.shipping.rates.perKgCost'],
  ['minWeight', 'admin.shipping.rates.minWeight'],
  ['freeFromAmount', 'admin.shipping.rates.freeFrom'],
  ['minOrderAmount', 'admin.shipping.rates.minOrder'],
  ['maxOrderAmount', 'admin.shipping.rates.maxOrder'],
] as const satisfies readonly (readonly [string, MessageKey])[];

/** Початкові значення форми: рядок тарифу або порожній новий (NULL → ''). */
export function rateDefaults(rate: ShippingRate | null): ShippingRateFormInput {
  return {
    zoneId: rate?.zoneId ?? '',
    name: rate?.name ?? '',
    calculationType: rate?.calculationType ?? 'flat',
    baseCost: rate?.baseCost ?? '0',
    perKgCost: rate?.perKgCost ?? '',
    minWeight: rate?.minWeight ?? '',
    freeFromAmount: rate?.freeFromAmount ?? '',
    minOrderAmount: rate?.minOrderAmount ?? '',
    maxOrderAmount: rate?.maxOrderAmount ?? '',
    estimatedDays: rate?.estimatedDays ?? '',
    isActive: rate?.isActive ?? true,
    sortOrder: rate?.sortOrder ?? 0,
  };
}
