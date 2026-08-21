// simplycms/data-supabase — Tier 2 Supabase-реалізації портів (DI, без singleton).

export { createSupabaseCatalogRepository } from './catalogRepository';
export { createSupabaseOrderRepository } from './orderRepository';
export { createSupabaseIdentityProvider } from './identityProvider';
export { singleTenantScope, hubScope, SCOPE_COLUMN } from './scope';
export * as mappers from './mappers';
