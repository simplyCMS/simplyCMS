import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';

/** Заглушки DOM, яких Radix Select/Dialog потребує в jsdom. */
export function stubDom() {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.scrollIntoView = () => {};
}

export const METHODS = [
  {
    id: 'b0000000-0000-4000-8000-000000000001',
    code: 'courier',
    name: "Кур'єр",
    description: null,
    provider: 'core:address',
    pricing: 'rates' as const,
    isActive: true,
    sortOrder: 0,
    config: {},
    icon: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'b0000000-0000-4000-8000-000000000002',
    code: 'pickup',
    name: 'Нова пошта',
    description: null,
    provider: 'core:pickup',
    pricing: 'carrier' as const,
    isActive: false,
    sortOrder: 1,
    config: {},
    icon: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const ZONES = [
  {
    id: 'c0000000-0000-4000-8000-000000000001',
    name: 'Київ',
    description: null,
    isActive: true,
    isDefault: true,
    sortOrder: 0,
    createdAt: new Date(),
    cities: [],
    regions: [],
  },
];

export const RATES = [
  {
    id: 'd0000000-0000-4000-8000-000000000001',
    methodId: METHODS[0]!.id,
    zoneId: ZONES[0]!.id,
    name: 'Стандарт',
    calculationType: 'flat' as const,
    baseCost: '50.00',
    perKgCost: null,
    minWeight: null,
    freeFromAmount: null,
    minOrderAmount: null,
    maxOrderAmount: null,
    estimatedDays: null,
    isActive: true,
    sortOrder: 0,
    config: {},
    createdAt: new Date(),
  },
];

export function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider locale="uk">
        <EngineProvider value={ENGINE}>{children}</EngineProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
