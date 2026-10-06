import { ENTITY, type EntityName } from 'simplycms/contracts/entities';

/**
 * Реєстр легасі-адмінки на `useSupabaseClient` (трек К3). Дзеркалить
 * ФАКТИЧНИЙ скан `rg -l useSupabaseClient packages/simplycms/src/admin`:
 * файл зʼявляється тут, поки лишається легасі, і ЗНИКАЄ, коли сторінку
 * переписано на server-first (`admin-server` + `admin-data`). Двосторонню
 * звірку з диском тримає `tests/admin-server-first-registry.test.ts`.
 */
export type LegacyWave = 'Е5' | 'Е6' | 'Е7';

/**
 * Свідомі винятки К3-2: файл лишається на supabase-js, бо це не CRUD
 * сутності, а обчислення. Кожен виняток називає сутності, операції й причину.
 */
export const SERVER_FIRST_EXCEPTIONS: ReadonlyArray<{
  file: string;
  entities: readonly EntityName[];
  operations: readonly string[];
  reason: string;
  wave: LegacyWave;
}> = [
  {
    file: 'packages/simplycms/src/admin/pages/PriceValidator.tsx',
    entities: [
      ENTITY.profiles,
      ENTITY.userCategories,
      ENTITY.priceTypes,
      ENTITY.products,
      ENTITY.productModifications,
      ENTITY.productPrices,
      ENTITY.discounts,
      ENTITY.discountGroups,
    ],
    operations: [
      'explainPrice: читання дефолтного типу ціни, цін товару, знижок і груп знижок для пояснення розрахунку',
    ],
    reason: 'обчислення ціни, не сутність (К3-2)',
    wave: 'Е6',
  },
];

/** Решта легасі-файлів адмінки: хвиля, у якій їх переписують. */
export const PENDING_LEGACY: ReadonlyArray<{ file: string; wave: LegacyWave }> =
  [
    {
      file: 'packages/simplycms/src/admin/hooks/usePluginToggle.ts',
      wave: 'Е6',
    },
    {
      file: 'packages/simplycms/src/admin/hooks/useThemeActivate.ts',
      wave: 'Е6',
    },
    {
      file: 'packages/simplycms/src/admin/layouts/LegacySupabaseBoundary.tsx',
      wave: 'Е7',
    },
    {
      file: 'packages/simplycms/src/admin/layouts/__tests__/LegacySupabaseBoundary.test.tsx',
      wave: 'Е7',
    },
    { file: 'packages/simplycms/src/admin/pages/BannerEdit.tsx', wave: 'Е6' },
    { file: 'packages/simplycms/src/admin/pages/Banners.tsx', wave: 'Е6' },
    { file: 'packages/simplycms/src/admin/pages/Dashboard.tsx', wave: 'Е6' },
    { file: 'packages/simplycms/src/admin/pages/DiscountEdit.tsx', wave: 'Е6' },
    {
      file: 'packages/simplycms/src/admin/pages/DiscountGroupEdit.tsx',
      wave: 'Е6',
    },
    { file: 'packages/simplycms/src/admin/pages/Discounts.tsx', wave: 'Е6' },
    {
      file: 'packages/simplycms/src/admin/pages/PickupPointEdit.tsx',
      wave: 'Е6',
    },
    { file: 'packages/simplycms/src/admin/pages/PickupPoints.tsx', wave: 'Е6' },
    {
      file: 'packages/simplycms/src/admin/pages/PluginSettings.tsx',
      wave: 'Е6',
    },
    { file: 'packages/simplycms/src/admin/pages/Plugins.tsx', wave: 'Е6' },
    { file: 'packages/simplycms/src/admin/pages/ReviewDetail.tsx', wave: 'Е6' },
    { file: 'packages/simplycms/src/admin/pages/Reviews.tsx', wave: 'Е6' },
    { file: 'packages/simplycms/src/admin/pages/Settings.tsx', wave: 'Е6' },
    { file: 'packages/simplycms/src/admin/pages/Shipping.tsx', wave: 'Е6' },
    {
      file: 'packages/simplycms/src/admin/pages/ShippingZoneEdit.tsx',
      wave: 'Е6',
    },
    {
      file: 'packages/simplycms/src/admin/pages/ShippingZones.tsx',
      wave: 'Е6',
    },
    {
      file: 'packages/simplycms/src/admin/pages/ThemeSettings.tsx',
      wave: 'Е6',
    },
    { file: 'packages/simplycms/src/admin/pages/Themes.tsx', wave: 'Е6' },
    {
      file: 'packages/simplycms/src/admin/pages/UserCategories.tsx',
      wave: 'Е6',
    },
    {
      file: 'packages/simplycms/src/admin/pages/UserCategoryEdit.tsx',
      wave: 'Е6',
    },
    {
      file: 'packages/simplycms/src/admin/pages/UserCategoryRuleEdit.tsx',
      wave: 'Е6',
    },
    {
      file: 'packages/simplycms/src/admin/pages/UserCategoryRules.tsx',
      wave: 'Е6',
    },
    { file: 'packages/simplycms/src/admin/pages/UserEdit.tsx', wave: 'Е6' },
    { file: 'packages/simplycms/src/admin/pages/Users.tsx', wave: 'Е6' },
  ];
