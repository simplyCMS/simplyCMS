// ScopeResolver-хелпери. simplyCMS — single-tenant (scope=undefined);
// MetaHub передає hub_id. Репозиторії застосовують scope лише коли він визначений.

import type { ScopeResolver } from "@simplysoftua/objects";

/** Single-tenant (simplyCMS): без скоупу. */
export const singleTenantScope: ScopeResolver = {
  getScope: () => undefined,
};

/** Multi-tenant (MetaHub): фіксований hub_id. */
export function hubScope(hubId: string): ScopeResolver {
  return { getScope: () => hubId };
}

/** Колонка скоупу за замовчуванням для multi-tenant таблиць. */
export const SCOPE_COLUMN = "hub_id";
