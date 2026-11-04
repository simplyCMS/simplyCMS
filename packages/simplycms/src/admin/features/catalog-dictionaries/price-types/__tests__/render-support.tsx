import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { TestI18nProvider } from '../../../../../../test-harness/i18n';

export const ROWS = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    name: 'Роздріб',
    code: 'retail',
    isDefault: true,
    sortOrder: 0,
    createdAt: new Date(),
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    name: 'Опт',
    code: 'wholesale',
    isDefault: false,
    sortOrder: 1,
    createdAt: new Date(),
  },
];

export function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <TestI18nProvider>{children}</TestI18nProvider>
    </QueryClientProvider>
  );
}
