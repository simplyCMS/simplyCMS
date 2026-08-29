// simplycms/storefront — SSR-лоадери (`withStorefrontDb` над Drizzle,
// `withActor`) + SEO-генератори; без Supabase. Host надає framework-glue
// (createServerFn).

export type { StorefrontClient } from './client';
export * from './loaders/index';
export * from './seo/index';
