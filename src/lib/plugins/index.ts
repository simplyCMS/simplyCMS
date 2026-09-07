// Core exports
export { hookRegistry } from "./HookRegistry";
export {
  loadPlugins,
  activatePlugin,
  deactivatePlugin,
  getAllPlugins,
  updatePluginConfig,
  installPlugin,
  uninstallPlugin,
  registerPluginModule,
  getRegisteredPluginModules,
} from "./PluginLoader";

// Type exports
export type {
  Plugin,
  PluginManifest,
  PluginModule,
  PluginHookDefinition,
  PluginSettingDefinition,
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
} from "./types";

// Component exports
export { PluginSlot, usePluginSlot, getPluginSlotCount } from "@/components/plugins/PluginSlot";
