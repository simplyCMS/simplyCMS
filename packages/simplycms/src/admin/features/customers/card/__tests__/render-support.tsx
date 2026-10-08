import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import CustomerCardPage from '../CustomerCardPage';

export { mocks, ui } from './mocks';
export { stubDom } from '../../../shipping/methods/__tests__/render-support';

export const USER_ID = 'u0000000-0000-4000-8000-000000000001';
export const CAT = {
  id: 'a0000000-0000-4000-8000-000000000002',
  name: 'Опт',
  code: 'opt',
  description: null,
  isDefault: false,
  createdAt: new Date(),
  priceTypeId: null,
};
export const VIP = {
  ...CAT,
  id: 'a0000000-0000-4000-8000-000000000003',
  name: 'VIP',
  code: 'vip',
};

export const card = (over: Record<string, unknown> = {}) => ({
  userId: USER_ID,
  email: 'buyer@shop.test',
  emailVerified: true,
  firstName: 'Іван',
  lastName: 'Петренко',
  phone: '+380671234567',
  createdAt: new Date(Date.UTC(2026, 0, 1)),
  avatarRef: null,
  authProviders: ['credential', 'google'],
  utmSource: 'facebook',
  utmCampaign: 'autumn-sale',
  stats: { ordersCount: 3, totalPurchasesCents: 150000 },
  category: { id: CAT.id, name: CAT.name, locked: false },
  isAdmin: false,
  bannedAt: null,
  banReason: null,
  history: [
    {
      id: 'h1',
      fromName: 'Роздріб',
      toName: 'Опт',
      reason: 'Сума покупок',
      byRule: true,
      changedByEmail: null,
      createdAt: new Date(Date.UTC(2026, 5, 1)),
    },
    {
      id: 'h2',
      fromName: 'Опт',
      toName: 'VIP',
      reason: 'Ручна зміна',
      byRule: false,
      changedByEmail: 'boss@shop.test',
      createdAt: new Date(Date.UTC(2026, 6, 1)),
    },
  ],
  ...over,
});

export const order = (n: number) => ({
  id: `o000000${n}-0000-4000-8000-000000000001`,
  orderNumber: `ORD-${n}`,
  userId: USER_ID,
  total: `${100 * n}.00`,
  createdAt: new Date(Date.UTC(2026, 8, n)),
});

/** Клієнт доступний тестам: перевіряємо інвалідацію префікса `[profiles]`. */
export const clientRef = { current: new QueryClient() };

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={clientRef.current}>
    <EngineProvider value={ENGINE}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </EngineProvider>
  </QueryClientProvider>
);

export const renderCard = () => {
  clientRef.current = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<CustomerCardPage />, { wrapper });
};
