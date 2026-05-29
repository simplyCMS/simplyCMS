import type { ThemeModule } from '@simplycms/themes/types';
import type { PluginModule } from '@simplycms/plugins/types';

export interface SimplyCMSConfig {
  supabase?: { url?: string; anonKey?: string };
  seo?: { siteName?: string; defaultTitle?: string; titleTemplate?: string };
  locale?: string;
  currency?: string;
  theme?: ThemeModule;
  plugins?: PluginModule[];
}

export function defineConfig(config: SimplyCMSConfig): SimplyCMSConfig {
  return {
    ...config,
    supabase: {
      url: config.supabase?.url || import.meta.env.VITE_SUPABASE_URL!,
      anonKey: config.supabase?.anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY!,
    },
  };
}
