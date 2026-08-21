// Централізований резолвер admin-посилань (LinkResolver для admin-зони).
// Прибирає хардкод "/admin/*" по сторінках адмінки.

const ADMIN_BASE = '/admin';

/**
 * Побудувати admin-шлях. `adminPath()` → база; `adminPath("products")` →
 * `/admin/products`; `adminPath(\`products/${id}\`)` → `/admin/products/<id>`.
 */
export function adminPath(sub?: string): string {
  if (!sub) return ADMIN_BASE;
  return `${ADMIN_BASE}/${sub.replace(/^\/+/, '')}`;
}

/** LinkResolver-обʼєкт для admin-зони. */
export const adminLinks = {
  base: (): string => ADMIN_BASE,
  to: adminPath,
};
