import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

// Plugin manifest structure
export interface PluginManifest {
  name: string;
  displayName: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  hooks?: PluginHookDefinition[];
  migrations?: string[];
  settings?: Record<string, PluginSettingDefinition>;
}

export interface PluginHookDefinition {
  name: string;
  priority?: number;
}

export interface PluginSettingDefinition {
  type: "boolean" | "string" | "number" | "select";
  default: unknown;
  label: string;
  options?: { value: string; label: string }[];
}

// Database plugin record (with Json types from Supabase)
export interface Plugin {
  id: string;
  name: string;
  display_name: string;
  version: string;
  description: string | null;
  author: string | null;
  is_active: boolean;
  config: unknown;
  hooks: unknown;
  migrations_applied: unknown;
  installed_at: string;
  updated_at: string;
}

// Parsed plugin with typed fields
export interface ParsedPlugin extends Omit<Plugin, 'config' | 'hooks' | 'migrations_applied'> {
  config: Record<string, unknown>;
  hooks: PluginHookDefinition[];
  migrations_applied: string[];
}

// Helper to parse plugin from database
export function parsePlugin(plugin: Plugin): ParsedPlugin {
  return {
    ...plugin,
    config: (plugin.config as Record<string, unknown>) || {},
    hooks: (plugin.hooks as PluginHookDefinition[]) || [],
    migrations_applied: (plugin.migrations_applied as string[]) || [],
  };
}

// Hook system types
export type HookHandler<TContext = unknown, TResult = unknown> = (
  context: TContext
) => TResult | Promise<TResult>;

export interface RegisteredHook<TContext = unknown, TResult = unknown> {
  pluginName: string;
  handler: HookHandler<TContext, TResult>;
  priority: number;
}

// Sidebar item hook result
export interface SidebarItemHookResult {
  title: string;
  url: string;
  icon: LucideIcon;
  priority?: number;
}

// Dashboard widget hook result
export interface DashboardWidgetHookResult {
  id: string;
  title: string;
  component: ReactNode;
  priority?: number;
}

// Form fields hook result
export interface FormFieldsHookResult {
  id: string;
  component: ReactNode;
  priority?: number;
}

// Plugin slot context types
export interface AdminSidebarContext {
  collapsed: boolean;
}

export interface ProductFormContext {
  productId?: string;
  form: unknown;
}

export interface ProductDetailContext {
  productId: string;
  product: unknown;
}

export interface OrderActionsContext {
  orderId: string;
  order: unknown;
}

// Available hook names
export type HookName =
  // Admin hooks
  | "admin.sidebar.items"
  | "admin.dashboard.stats"
  | "admin.dashboard.widgets"
  | "admin.product.form.before"
  | "admin.product.form.fields"
  | "admin.product.form.after"
  | "admin.product.form.sidebar"
  | "admin.shipping.method.settings"
  | "admin.discount.form.fields"
  // Public product hooks
  | "product.detail.before"
  | "product.detail.after"
  | "product.card.badges"
  // Checkout & shipping hooks
  | "checkout.steps"
  | "checkout.shipping.before"
  | "checkout.shipping.methods"
  | "checkout.shipping.rates"
  | "checkout.shipping.form"
  | "checkout.shipping.validate"
  | "checkout.shipping.after"
  // Discount hooks
  | "discount.conditions.evaluate"
  | "discount.before_apply"
  | "discount.after_apply"
  | "discount.types"
  // Order hooks
  | "order.actions"
  | "order.created"
  | "order.status_changed"
  | "order.shipping.process"
  // Backend hooks
  | "product.before_save"
  | "user.registered";

// Plugin module interface
export interface PluginModule {
  manifest?: PluginManifest;
  register: (registry: HookRegistryInterface) => void;
  unregister?: (registry: HookRegistryInterface) => void;
}

// Hook registry interface
export interface HookRegistryInterface {
  register<TContext = unknown, TResult = unknown>(
    hookName: string,
    pluginName: string,
    handler: HookHandler<TContext, TResult>,
    priority?: number
  ): void;
  unregister(hookName: string, pluginName: string): void;
  execute<TContext = unknown, TResult = unknown>(
    hookName: string,
    context: TContext
  ): Promise<TResult[]>;
  getHandlers<TContext = unknown, TResult = unknown>(
    hookName: string
  ): RegisteredHook<TContext, TResult>[];
  clear(): void;
}
