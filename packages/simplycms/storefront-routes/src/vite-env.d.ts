/// <reference types="vite/client" />

// SEO-генератори пакета читають `import.meta.env.VITE_SITE_URL`. Оголошення
// дослівно збігається з host-овим `src/vite-env.d.ts` (див. коментар у
// `@simplycms/supabase/src/vite-env.d.ts`).
interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
}
