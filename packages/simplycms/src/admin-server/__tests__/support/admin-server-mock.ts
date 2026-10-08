/**
 * Спільна фабрика моку `simplycms/admin-server` для тестів (рішення Е4-13).
 *
 * 🔴 Повноту тримає ТИП, а не регулярка: `AdminServerMock` виведено з
 * реального модуля, перелік нижче — явний літерал із `satisfies`. Новий
 * serverFn без запису тут → `pnpm typecheck` червоний (бракує ключа);
 * зайвий або застарілий ключ → excess-property помилка (і в overrides
 * теж). vitest типи не перевіряє — гейт саме `typecheck`.
 *
 * Дефолти: `list*` → `vi.fn(async () => [])`, решта → `vi.fn()`.
 * Overrides тесту мерджаться поверх.
 *
 * Виклик (з урахуванням hoisting `vi.mock`):
 * ```ts
 * const { saveProductPrices } = vi.hoisted(() => ({ saveProductPrices: vi.fn() }));
 * vi.mock("simplycms/admin-server", async () =>
 *   (await import('<відносний шлях>/admin-server/__tests__/support/admin-server-mock'))
 *     .createAdminServerMock({ saveProductPrices }));
 * ```
 *
 * Тека `__tests__` виключена з tsdown і dts (`tsconfig.dts.json`) — у
 * tarball файл не потрапляє. Імʼя без `.test.` — це не тест.
 */
import { vi, type Mock } from 'vitest';
import type * as AdminServer from 'simplycms/admin-server';

export type AdminServerMock = { [K in keyof typeof AdminServer]: Mock };

const list = () => vi.fn(async () => [] as unknown[]);

export function createAdminServerMock(
  overrides: Partial<AdminServerMock> = {},
): AdminServerMock {
  const defaults = {
    listOrderStatuses: list(),
    insertOrderStatuses: vi.fn(),
    updateOrderStatuses: vi.fn(),
    removeOrderStatuses: vi.fn(),
    setDefaultOrderStatus: vi.fn(),
    reorderOrderStatus: vi.fn(),
    uploadMedia: vi.fn(),
    deleteMedia: vi.fn(),
    listProducts: list(),
    insertProducts: vi.fn(),
    updateProducts: vi.fn(),
    removeProducts: vi.fn(),
    listProductModifications: list(),
    insertProductModifications: vi.fn(),
    updateProductModifications: vi.fn(),
    removeProductModifications: vi.fn(),
    setDefaultProductModification: vi.fn(),
    reorderProductModification: vi.fn(),
    listProductPrices: list(),
    saveProductPrices: vi.fn(),
    listStock: list(),
    saveStock: vi.fn(),
    listProductPropertyValues: list(),
    insertProductPropertyValues: vi.fn(),
    updateProductPropertyValues: vi.fn(),
    removeProductPropertyValues: vi.fn(),
    listModificationPropertyValues: list(),
    insertModificationPropertyValues: vi.fn(),
    updateModificationPropertyValues: vi.fn(),
    removeModificationPropertyValues: vi.fn(),
    listSections: list(),
    insertSections: vi.fn(),
    updateSections: vi.fn(),
    removeSections: vi.fn(),
    listPriceTypes: list(),
    insertPriceTypes: vi.fn(),
    updatePriceTypes: vi.fn(),
    removePriceTypes: vi.fn(),
    setDefaultPriceType: vi.fn(),
    listSectionProperties: list(),
    insertSectionProperties: vi.fn(),
    updateSectionProperties: vi.fn(),
    removeSectionProperties: vi.fn(),
    listPropertyOptions: list(),
    insertPropertyOptions: vi.fn(),
    updatePropertyOptions: vi.fn(),
    removePropertyOptions: vi.fn(),
    listSectionPropertyAssignments: list(),
    insertSectionPropertyAssignments: vi.fn(),
    updateSectionPropertyAssignments: vi.fn(),
    removeSectionPropertyAssignments: vi.fn(),
    listOrders: list(),
    listOrderItems: list(),
    changeOrderStatus: vi.fn(),
    addOrderItem: vi.fn(),
    updateOrderItemQuantity: vi.fn(),
    removeOrderItem: vi.fn(),
    searchProductsForOrder: vi.fn(),
    getAdminReviewContent: vi.fn(),
    listShippingMethods: list(),
    insertShippingMethods: vi.fn(),
    updateShippingMethods: vi.fn(),
    removeShippingMethods: vi.fn(),
    listShippingZones: list(),
    insertShippingZones: vi.fn(),
    updateShippingZones: vi.fn(),
    removeShippingZones: vi.fn(),
    setDefaultShippingZone: vi.fn(),
    listShippingRates: list(),
    insertShippingRates: vi.fn(),
    updateShippingRates: vi.fn(),
    removeShippingRates: vi.fn(),
    listPickupPoints: list(),
    insertPickupPoints: vi.fn(),
    updatePickupPoints: vi.fn(),
    removePickupPoints: vi.fn(),
    getSystemSettings: vi.fn(),
    saveStoreProfile: vi.fn(),
    saveStockManagement: vi.fn(),
    listThemes: list(),
    activateTheme: vi.fn(),
    saveThemeSettings: vi.fn(),
    listPlugins: list(),
    setPluginActive: vi.fn(),
    listDiscountGroups: list(),
    insertDiscountGroups: vi.fn(),
    updateDiscountGroups: vi.fn(),
    removeDiscountGroups: vi.fn(),
    listDiscounts: list(),
    getDiscount: vi.fn(),
    saveDiscount: vi.fn(),
    removeDiscounts: vi.fn(),
    listUserCategories: list(),
    insertUserCategories: vi.fn(),
    updateUserCategories: vi.fn(),
    removeUserCategories: vi.fn(),
    setDefaultUserCategory: vi.fn(),
    countCustomersByCategory: vi.fn(),
    listCategoryRules: list(),
    insertCategoryRules: vi.fn(),
    updateCategoryRules: vi.fn(),
    removeCategoryRules: vi.fn(),
    runCategoryRules: vi.fn(),
    assignCustomerCategory: vi.fn(),
    setAdminRole: vi.fn(),
    setCustomerBan: vi.fn(),
    updateCustomerContacts: vi.fn(),
    findCustomers: vi.fn(),
    listCustomers: vi.fn(),
    getCustomerCard: vi.fn(),
    dashboardSummary: vi.fn(),
    diagnosePrice: vi.fn(),
  } satisfies AdminServerMock;
  return { ...defaults, ...overrides };
}
