// Core exports
export { hookRegistry } from './HookRegistry';
export { default as HookRegistry } from './HookRegistry';
export {
  loadPlugins,
  registerPluginModule,
  getRegisteredPluginModules,
} from './PluginLoader';
// Синхронізація хуків вкладки після serverFn `setPluginActive` (Е6б-17):
// запис у БД — справа сервера, реєстр браузера — клієнта.
export { syncPluginHooks } from './sync-hooks';

// Bootstrap (конфіг магазину → реєстр → БД)
export { bootstrapPlugins } from './bootstrap';
export type { PluginRegistration } from './bootstrap';

// Валідація модуля плагіна (ідіом validateThemeModule: throw + console.warn;
// мʼякість §8 забезпечує bootstrap своїм catch). Живе тут, а не в plugin-sdk:
// bootstrap кличе її сам, а SDK лише реекспортує — зворотна залежність
// plugin-system → plugin-sdk була б циклом.
export { validatePluginModule } from './validatePluginModule';

// Component exports
export { PluginSlot, usePluginSlot, getPluginSlotCount } from './PluginSlot';

// Hook point constants
export {
  HOOK_ADMIN_SIDEBAR_ITEMS,
  HOOK_ADMIN_DASHBOARD_STATS,
  HOOK_ADMIN_DASHBOARD_WIDGETS,
  HOOK_ADMIN_PRODUCT_FORM_BEFORE,
  HOOK_ADMIN_PRODUCT_FORM_FIELDS,
  HOOK_ADMIN_PRODUCT_FORM_AFTER,
  HOOK_ADMIN_PRODUCT_FORM_SIDEBAR,
  HOOK_PRODUCT_DETAIL_BEFORE,
  HOOK_PRODUCT_DETAIL_AFTER,
  HOOK_PRODUCT_CARD_BADGES,
  HOOK_CHECKOUT_STEPS,
  HOOK_CHECKOUT_SHIPPING_BEFORE,
  HOOK_CHECKOUT_SHIPPING_METHODS,
  HOOK_CHECKOUT_SHIPPING_RATES,
  HOOK_CHECKOUT_SHIPPING_FORM,
  HOOK_CHECKOUT_SHIPPING_VALIDATE,
  HOOK_CHECKOUT_SHIPPING_AFTER,
  HOOK_ORDER_ACTIONS,
  HOOK_ORDER_CREATED,
  HOOK_ORDER_STATUS_CHANGED,
  HOOK_ORDER_SHIPPING_PROCESS,
  HOOK_PRODUCT_BEFORE_SAVE,
  HOOK_USER_REGISTERED,
  ALL_HOOKS,
} from './hooks';

// Type exports
export type {
  Plugin,
  ParsedPlugin,
  PluginManifest,
  PluginModule,
  PluginHookDefinition,
  HookHandler,
  HookRegistryInterface,
  RegisteredHook,
  HookName,
  SidebarItemHookResult,
  DashboardWidgetHookResult,
  FormFieldsHookResult,
  AdminSidebarContext,
  ProductFormContext,
  ProductDetailContext,
  OrderActionsContext,
} from './types';

export { parsePlugin } from './types';
