/** Значення enum `shipping_calculation_type` з ключами підписів (каталог ядра). */
export const RATE_CALC_LABEL = {
  flat: 'admin.shipping.rates.calc.flat',
  weight: 'admin.shipping.rates.calc.weight',
  order_total: 'admin.shipping.rates.calc.percent',
  free_from: 'admin.shipping.rates.calc.freeFrom',
} as const;

export const SHIPPING_CALCULATION_TYPES = [
  'flat',
  'weight',
  'order_total',
  'free_from',
] as const;
