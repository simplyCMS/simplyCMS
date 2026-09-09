import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../hooks/useAuth';
import { CartProvider } from '../hooks/useCart';

interface CMSProviderProps {
  children: React.ReactNode;
  /**
   * `QueryClient` ззовні — на практиці той самий інстанс, що `getRouter()`
   * (`src/router.tsx`) поклав у router context: колекції TanStack DB (Е1б)
   * memoізуються по інстансу клієнта й потрібні в `loader` роуту, тобто поза
   * React-деревом, де клієнт, народжений усередині провайдера, недосяжний.
   *
   * Якщо не передано — провайдер створює власний клієнт сам (тести,
   * storybook-подібні точки входу без роутера).
   */
  customQueryClient?: QueryClient;
}

export function CMSProvider({ children, customQueryClient }: CMSProviderProps) {
  const [client] = useState(
    () =>
      customQueryClient ||
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <CartProvider>{children}</CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
