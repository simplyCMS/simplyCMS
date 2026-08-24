import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  authClient,
  type AuthSession,
  type AuthUser,
} from '../lib/auth-client';
import { fetchIsAdmin } from '../lib/auth-session';

/**
 * Контекст автентифікації вітрини (К1′б: Better Auth замість GoTrue).
 *
 * Форма контексту навмисно збережена з попереднього контуру — компоненти
 * читають `user.id`/`user.email`, і переписувати їх заміна провайдера не
 * зобовʼязана. Змінилися лише ТИПИ: `user`/`session` тепер із Better Auth.
 */
interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  isLoading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isAdmin: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Джерело правди про сесію — атом клієнта Better Auth. Власного стану тут
  // немає свідомо: другий стан довелося б синхронізувати з ним вручну, і
  // саме на цій синхронізації жили гонки старого `onAuthStateChange`.
  const { data, isPending } = authClient.useSession();
  const user = data?.user ?? null;
  const session = data?.session ?? null;

  // Роль — окремий серверний запит (див. докблок `fetchIsAdmin`). Ключ
  // містить id користувача, тож вихід і вхід іншим акаунтом не лишають
  // чужого `isAdmin` у кеші.
  const { data: isAdmin } = useQuery({
    queryKey: ['auth', 'is-admin', user?.id ?? null],
    queryFn: () => fetchIsAdmin(),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });

  const signOut = useCallback(async () => {
    await authClient.signOut();
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading: isPending,
      isAdmin: isAdmin ?? false,
      signOut,
    }),
    [user, session, isPending, isAdmin, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
