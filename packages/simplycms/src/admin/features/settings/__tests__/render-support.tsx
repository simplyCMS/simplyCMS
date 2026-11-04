import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { StoreProfile } from 'simplycms/contracts/store-profile';
import { TestI18nProvider } from '../../../../../test-harness/i18n';

export const PROFILE: StoreProfile = {
  name: 'Мій магазин',
  homeTitle: null,
  description: null,
  contacts: { phone: '+380501112233', email: null, address: null, hours: null },
  logo: 'store_logo/old.png',
  socials: [{ network: 'instagram', url: 'https://instagram.com/shop' }],
};

export const SETTINGS = {
  profile: PROFILE,
  stockManagement: { decreaseOnOrder: false },
};

/** Один клієнт на тест: кеш потрібен самим асертам (write-back, isInvalidated). */
export function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <TestI18nProvider>{children}</TestI18nProvider>
      </QueryClientProvider>
    );
  };
}
