// Supabase-реалізація IdentityProvider (DI client).

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IdentityProvider,
  Identity,
  SignInResult,
} from '@simplycms/objects';

type Row = Record<string, unknown>;

export function createSupabaseIdentityProvider(
  client: SupabaseClient,
): IdentityProvider {
  async function loadIdentity(): Promise<Identity | null> {
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return null;

    // Категорія користувача — з profiles; ролі — з окремої таблиці user_roles.
    const { data: profile } = await client
      .from('profiles')
      .select('category_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const profileRow = (profile as Row | null) ?? {};

    const { data: roleRows } = await client
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const metaRoles =
      (user.app_metadata?.roles as string[] | undefined) ??
      (user.user_metadata?.roles as string[] | undefined) ??
      [];
    const dbRoles = ((roleRows as Row[] | null) ?? []).map((r) =>
      String(r.role),
    );
    const roles = [...new Set([...metaRoles, ...dbRoles])];

    return {
      id: user.id,
      email: user.email ?? null,
      roles,
      categoryId: (profileRow.category_id as string | null) ?? null,
      metadata: user.user_metadata,
    };
  }

  return {
    getCurrentUser: loadIdentity,

    async hasRole(role: string): Promise<boolean> {
      const identity = await loadIdentity();
      return identity?.roles.includes(role) ?? false;
    },

    async signIn(email: string, password: string): Promise<SignInResult> {
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { identity: null, error: error.message };
      return { identity: await loadIdentity(), error: null };
    },

    async signOut(): Promise<void> {
      await client.auth.signOut();
    },
  };
}
