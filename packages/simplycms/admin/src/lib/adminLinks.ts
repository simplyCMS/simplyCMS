// Централізований резолвер admin-посилань (LinkResolver для admin-зони).
// Прибирає хардкод "/admin/*" по сторінках: host може переприв'язати базовий
// префікс (напр. MetaHub монтує admin під іншим шляхом) одним викликом.

let adminBase = "/admin";

/** Переприв'язати базовий префікс admin-зони (host wiring). */
export function setAdminBase(base: string): void {
  adminBase = base.replace(/\/+$/, "") || "/";
}

/**
 * Побудувати admin-шлях. `adminPath()` → база; `adminPath("products")` →
 * `/admin/products`; `adminPath(\`products/${id}\`)` → `/admin/products/<id>`.
 */
export function adminPath(sub?: string): string {
  if (!sub) return adminBase;
  return `${adminBase}/${sub.replace(/^\/+/, "")}`;
}

/** LinkResolver-обʼєкт для admin-зони. */
export const adminLinks = {
  base: (): string => adminBase,
  to: adminPath,
};
