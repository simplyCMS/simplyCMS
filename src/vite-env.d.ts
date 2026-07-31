/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  /** Новий нейминг публічного ключа Supabase (має пріоритет). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Legacy-нейминг публічного ключа — fallback для наявних інсталяцій. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
