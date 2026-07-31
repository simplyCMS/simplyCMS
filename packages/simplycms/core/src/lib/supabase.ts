import { getSupabaseBrowserClient } from "@simplycms/supabase/browser-client";

// Auth helper functions (client-side). Клієнт беремо з браузерної фабрики,
// а не з глобального singleton.
export async function signUp(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function resetPassword(email: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { data, error };
}

export async function updatePassword(newPassword: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { data, error };
}

// Get current session
export async function getSession() {
  const supabase = getSupabaseBrowserClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
}

// Get current user
export async function getUser() {
  const supabase = getSupabaseBrowserClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}
