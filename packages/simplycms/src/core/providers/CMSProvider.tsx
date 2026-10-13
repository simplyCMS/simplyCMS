import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../hooks/useAuth';
import { CartProvider } from '../hooks/useCart';

interface CMSProviderProps {
  children: React.ReactNode;
  /**
   * `QueryClient` роутера — той самий інстанс, що `getRouter()`
   * (`src/router.tsx`) поклав у router context: колекції TanStack DB (Е1б)
   * memoізуються по інстансу клієнта й потрібні в `loader` роуту, тобто поза
   * React-деревом, де клієнт, народжений усередині провайдера, недосяжний.
   *
   * 🔴 Обовʼязковий, запасного власного клієнта немає: другий `QueryClient`
   * на вітрині обходив би скидання кешу цін глядача (`useViewerPriceSync`,
   * Р29) — його б не бачили ні лоадери, ні це скидання.
   */
  queryClient: QueryClient;
}

export function CMSProvider({ children, queryClient }: CMSProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>{children}</CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
