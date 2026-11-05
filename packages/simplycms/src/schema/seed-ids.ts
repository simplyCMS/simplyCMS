/**
 * Id рядків сіду чистого магазину: їх вставляє `bootstrapStore` (`simplycms/migrate`,
 * мова й довідники) і `migrations/0003_seed.sql` (рядки без тексту).
 *
 * 🔴 Окремий модуль без залежностей: константи читають і тести харнесу, і код,
 * що мусить посилатися на системний рядок, не вгадуючи його за `is_default`.
 * Node-скрипти без збірки (`scripts/live-smoke`) TS не імпортують і тримають
 * власну копію — її парність стереже `seed-ids.test.ts`.
 */

/** Коди статусів замовлень, що засіває `bootstrapStore` (порядок = `sort_order`). */
export const SEED_ORDER_STATUS_CODES = [
  'new',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const;

export type SeedOrderStatusCode = (typeof SEED_ORDER_STATUS_CODES)[number];

export const SYSTEM_SEED_IDS = {
  language: '00000002-0000-4000-8000-000000000001',
  orderStatuses: {
    new: '00000001-0000-4000-8000-000000000001',
    confirmed: '00000001-0000-4000-8000-000000000002',
    processing: '00000001-0000-4000-8000-000000000003',
    shipped: '00000001-0000-4000-8000-000000000004',
    delivered: '00000001-0000-4000-8000-000000000005',
    cancelled: '00000001-0000-4000-8000-000000000006',
  },
  priceTypeRetail: '00000003-0000-4000-8000-000000000001',
  customerCategoryRetail: '00000004-0000-4000-8000-000000000001',
  storeProfileSetting: '00000005-0000-4000-8000-000000000003',
  /**
   * Зона, яку сід робить основною. Інваріант — рівно одна основна зона, а не саме
   * цей рядок: після заміни основної він стає звичайною зоною й видаляється.
   */
  mainShippingZone: '00000007-0000-4000-8000-000000000001',
} as const satisfies {
  orderStatuses: Record<SeedOrderStatusCode, string>;
} & Record<string, string | Record<string, string>>;
