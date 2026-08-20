/// <reference types="vite/client" />

// `import.meta.env.VITE_SITE_URL` читає ізоморфний роут товару
// (`routes/_storefront/catalog/**` — клієнтський контур, значення потрібне в
// бандлі); SEO-генератори (`src/seo/*`) — серверний контур і читають
// `process.env` у рантаймі (контракт серверного env, спека CLI v1 §7).
// Оголошення дослівно збігається з host-овим `src/vite-env.d.ts` (див.
// коментар у `simplycms/supabase/src/vite-env.d.ts`).
interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
}
