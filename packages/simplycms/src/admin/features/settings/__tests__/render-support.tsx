import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import type { StoreProfile } from 'simplycms/contracts/store-profile';

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
        <I18nProvider locale="uk">{children}</I18nProvider>
      </QueryClientProvider>
    );
  };
}
