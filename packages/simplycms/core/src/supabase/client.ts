import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_ANON_KEY!
  );
}

// Singleton browser client for use in client components
let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createClient();
  }
  return browserClient;
}

// Re-export a default supabase instance for backward compatibility
export const supabase = typeof window !== "undefined"
  ? getSupabaseBrowserClient()
  : (null as unknown as ReturnType<typeof createClient>);
