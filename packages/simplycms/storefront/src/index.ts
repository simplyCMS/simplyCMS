// @simplycms/storefront — SSR-лоадери + SEO-генератори, параметризовані
// інжектованим Supabase-клієнтом. Host надає framework-glue (createServerFn).

export type { StorefrontClient } from "./client";
export * from "./loaders/index";
export * from "./seo/index";
