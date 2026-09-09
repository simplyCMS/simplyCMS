/**
 * Available Hook Points for the SimplyCMS Plugin System
 *
 * Based on BRD Section 8.2 — All available hook points that plugins can register handlers for.
 */

// ─── Admin Hooks ────────────────────────────────────────────────────────────

/** Inject additional items into the admin sidebar navigation. */
export const HOOK_ADMIN_SIDEBAR_ITEMS = 'admin.sidebar.items' as const;

/** Inject additional stat cards on the admin dashboard. */
export const HOOK_ADMIN_DASHBOARD_STATS = 'admin.dashboard.stats' as const;

/** Inject additional widgets on the admin dashboard. */
export const HOOK_ADMIN_DASHBOARD_WIDGETS = 'admin.dashboard.widgets' as const;

/** Render content before the admin product form fields. */
export const HOOK_ADMIN_PRODUCT_FORM_BEFORE =
  'admin.product.form.before' as const;

/** Inject additional fields into the admin product form. */
export const HOOK_ADMIN_PRODUCT_FORM_FIELDS =
  'admin.product.form.fields' as const;

/** Render content after the admin product form fields. */
export const HOOK_ADMIN_PRODUCT_FORM_AFTER =
  'admin.product.form.after' as const;

/** Inject content into the admin product form sidebar. */
export const HOOK_ADMIN_PRODUCT_FORM_SIDEBAR =
  'admin.product.form.sidebar' as const;

/** Inject settings UI for shipping methods in admin. */
export const HOOK_ADMIN_SHIPPING_METHOD_SETTINGS =
  'admin.shipping.method.settings' as const;

/** Inject additional fields into the admin discount form. */
export const HOOK_ADMIN_DISCOUNT_FORM_FIELDS =
  'admin.discount.form.fields' as const;

// ─── Public Product Hooks ───────────────────────────────────────────────────

/** Render content before the product detail view on the storefront. */
export const HOOK_PRODUCT_DETAIL_BEFORE = 'product.detail.before' as const;

/** Render content after the product detail view on the storefront. */
export const HOOK_PRODUCT_DETAIL_AFTER = 'product.detail.after' as const;

/** Inject badges onto product cards in catalog/listings. */
export const HOOK_PRODUCT_CARD_BADGES = 'product.card.badges' as const;

// ─── Checkout & Shipping Hooks ──────────────────────────────────────────────

/** Modify or add checkout steps. */
export const HOOK_CHECKOUT_STEPS = 'checkout.steps' as const;

/** Render content before the shipping selection step. */
export const HOOK_CHECKOUT_SHIPPING_BEFORE =
  'checkout.shipping.before' as const;

/** Register additional shipping methods at checkout. */
export const HOOK_CHECKOUT_SHIPPING_METHODS =
  'checkout.shipping.methods' as const;

/** Provide custom shipping rate calculations. */
export const HOOK_CHECKOUT_SHIPPING_RATES = 'checkout.shipping.rates' as const;

/** Inject additional form fields into the shipping step. */
export const HOOK_CHECKOUT_SHIPPING_FORM = 'checkout.shipping.form' as const;

/** Run custom validation on shipping data before proceeding. */
export const HOOK_CHECKOUT_SHIPPING_VALIDATE =
  'checkout.shipping.validate' as const;

/** Render content after the shipping selection step. */
export const HOOK_CHECKOUT_SHIPPING_AFTER = 'checkout.shipping.after' as const;

// ─── Discount Hooks ─────────────────────────────────────────────────────────

/** Evaluate custom discount conditions. */
export const HOOK_DISCOUNT_CONDITIONS_EVALUATE =
  'discount.conditions.evaluate' as const;

/** Run logic before a discount is applied. */
export const HOOK_DISCOUNT_BEFORE_APPLY = 'discount.before_apply' as const;

/** Run logic after a discount is applied. */
export const HOOK_DISCOUNT_AFTER_APPLY = 'discount.after_apply' as const;

/** Register custom discount types. */
export const HOOK_DISCOUNT_TYPES = 'discount.types' as const;

// ─── Order Hooks ────────────────────────────────────────────────────────────

/** Inject additional actions into the order detail view. */
export const HOOK_ORDER_ACTIONS = 'order.actions' as const;

/** Triggered when a new order is created. */
export const HOOK_ORDER_CREATED = 'order.created' as const;

/** Triggered when an order status changes. */
export const HOOK_ORDER_STATUS_CHANGED = 'order.status_changed' as const;

/** Process shipping for an order (e.g., create label, notify carrier). */
export const HOOK_ORDER_SHIPPING_PROCESS = 'order.shipping.process' as const;

// ─── Backend / Server-Side Hooks ────────────────────────────────────────────

/** Run logic before a product is saved (create or update). */
export const HOOK_PRODUCT_BEFORE_SAVE = 'product.before_save' as const;

/** Triggered when a new user registers. */
export const HOOK_USER_REGISTERED = 'user.registered' as const;

/**
 * Complete list of all hook point names for convenient enumeration.
 */
export const ALL_HOOKS = [
  // Admin
  HOOK_ADMIN_SIDEBAR_ITEMS,
  HOOK_ADMIN_DASHBOARD_STATS,
  HOOK_ADMIN_DASHBOARD_WIDGETS,
  HOOK_ADMIN_PRODUCT_FORM_BEFORE,
  HOOK_ADMIN_PRODUCT_FORM_FIELDS,
  HOOK_ADMIN_PRODUCT_FORM_AFTER,
  HOOK_ADMIN_PRODUCT_FORM_SIDEBAR,
  HOOK_ADMIN_SHIPPING_METHOD_SETTINGS,
  HOOK_ADMIN_DISCOUNT_FORM_FIELDS,
  // Public product
  HOOK_PRODUCT_DETAIL_BEFORE,
  HOOK_PRODUCT_DETAIL_AFTER,
  HOOK_PRODUCT_CARD_BADGES,
  // Checkout & shipping
  HOOK_CHECKOUT_STEPS,
  HOOK_CHECKOUT_SHIPPING_BEFORE,
  HOOK_CHECKOUT_SHIPPING_METHODS,
  HOOK_CHECKOUT_SHIPPING_RATES,
  HOOK_CHECKOUT_SHIPPING_FORM,
  HOOK_CHECKOUT_SHIPPING_VALIDATE,
  HOOK_CHECKOUT_SHIPPING_AFTER,
  // Discount
  HOOK_DISCOUNT_CONDITIONS_EVALUATE,
  HOOK_DISCOUNT_BEFORE_APPLY,
  HOOK_DISCOUNT_AFTER_APPLY,
  HOOK_DISCOUNT_TYPES,
  // Order
  HOOK_ORDER_ACTIONS,
  HOOK_ORDER_CREATED,
  HOOK_ORDER_STATUS_CHANGED,
  HOOK_ORDER_SHIPPING_PROCESS,
  // Backend
  HOOK_PRODUCT_BEFORE_SAVE,
  HOOK_USER_REGISTERED,
] as const;
