/**
 * Реєстр i18n-міграції: що ще не переведено і що переводити не треба.
 *
 * 🔴 Навіщо це поверх ESLint. Селектори `no-restricted-syntax` бачать лише
 * `JSXText` і атрибути `placeholder|title|aria-*`, тобто ~64 % роботи: toast,
 * повідомлення Zod, тернарники, мапи ярликів і рядки в обʼєктах їм не видні.
 * Зелений лінт тому НЕ доводить завершеність міграції — доводить цей файл,
 * зведений до порожнього `PENDING_FILES`.
 */

/** Рядки, що не є інтерфейсом і лишаються українськими навмисно. */
export const ALLOWLIST: Record<string, string> = {
  // Логи розробника в серверному коді: їх читає той, хто тримає термінал, а не
  // покупець. Правило проєкту вимагає української саме для документації й
  // діагностики.
  'packages/storefront-routes/src/server/auth.ts': 'console.error — лог',
  'packages/storefront-routes/src/server/themes.ts': 'console.error — лог',
  'packages/storefront-routes/src/seo/interceptor.ts': 'console.error — лог',
};

/**
 * Файли, ще не мігровані. Список лише скорочується; етап вважається закритим,
 * коли його файли звідси зникли, а гейти зелені.
 *
 * Тест падає і на зайвому записі: файл без жодного кириличного рядка тут
 * лишатися не може, інакше реєстр тихо перетворився б на список-вигадку.
 */
export const PENDING_FILES: readonly string[] = [
  'packages/admin/src/components/AddProductToOrder.tsx',
  'packages/admin/src/components/AllProductProperties.tsx',
  'packages/admin/src/components/ImageUpload.tsx',
  'packages/admin/src/components/InstallPluginDialog.tsx',
  'packages/admin/src/components/ProductModifications.tsx',
  'packages/admin/src/components/ProductPricesEditor.tsx',
  'packages/admin/src/components/ProductPropertyValues.tsx',
  'packages/admin/src/components/RichTextEditor.tsx',
  'packages/admin/src/components/SectionPropertiesManager.tsx',
  'packages/admin/src/components/SectionPropertiesTable.tsx',
  'packages/admin/src/components/SimpleProductFields.tsx',
  'packages/admin/src/components/StockByPointManager.tsx',
  'packages/admin/src/components/StockStatusSelect.tsx',
  'packages/admin/src/pages/BannerEdit.tsx',
  'packages/admin/src/pages/Banners.tsx',
  'packages/admin/src/pages/DiscountEdit.tsx',
  'packages/admin/src/pages/DiscountGroupEdit.tsx',
  'packages/admin/src/pages/Discounts.tsx',
  'packages/admin/src/pages/OrderDetail.tsx',
  'packages/admin/src/pages/OrderStatuses.tsx',
  'packages/admin/src/pages/Orders.tsx',
  'packages/admin/src/pages/PickupPointEdit.tsx',
  'packages/admin/src/pages/PickupPoints.tsx',
  'packages/admin/src/pages/PluginSettings.tsx',
  'packages/admin/src/pages/Plugins.tsx',
  'packages/admin/src/pages/PriceTypeEdit.tsx',
  'packages/admin/src/pages/PriceTypes.tsx',
  'packages/admin/src/pages/PriceValidator.tsx',
  'packages/admin/src/pages/ProductEdit.tsx',
  'packages/admin/src/pages/Products.tsx',
  'packages/admin/src/pages/Properties.tsx',
  'packages/admin/src/pages/PropertyEdit.tsx',
  'packages/admin/src/pages/PropertyOptionEdit.tsx',
  'packages/admin/src/pages/ReviewDetail.tsx',
  'packages/admin/src/pages/Reviews.tsx',
  'packages/admin/src/pages/SectionEdit.tsx',
  'packages/admin/src/pages/Sections.tsx',
  'packages/admin/src/pages/Settings.tsx',
  'packages/admin/src/pages/Shipping.tsx',
  'packages/admin/src/pages/ShippingMethodEdit.tsx',
  'packages/admin/src/pages/ShippingMethods.tsx',
  'packages/admin/src/pages/ShippingZoneEdit.tsx',
  'packages/admin/src/pages/ShippingZones.tsx',
  'packages/admin/src/pages/ThemeSettings.tsx',
  'packages/admin/src/pages/Themes.tsx',
  'packages/admin/src/pages/UserCategories.tsx',
  'packages/admin/src/pages/UserCategoryEdit.tsx',
  'packages/admin/src/pages/UserCategoryRuleEdit.tsx',
  'packages/admin/src/pages/UserCategoryRules.tsx',
  'packages/admin/src/pages/UserEdit.tsx',
  'packages/admin/src/pages/Users.tsx',
];
