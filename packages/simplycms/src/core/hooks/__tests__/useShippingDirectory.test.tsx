// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useShippingDirectory } from '../useShippingDirectory';

/**
 * Клієнтська гілка зони за призначенням (Д3, А4, Р6): мокається ЛИШЕ серверна
 * функція довідника, сам хук і домен — справжні.
 */
const server = vi.hoisted(() => ({ getShippingDirectory: vi.fn() }));
vi.mock('../../lib/shipping-directory', () => server);

const zone = (id: string, is_default: boolean) => ({
  id,
  name: id,
  description: null,
  is_active: true,
  is_default,
  sort_order: 0,
  created_at: new Date(0),
});
const method = (id: string, provider: string) => ({
  id,
  code: id,
  name: id,
  description: null,
  provider,
  pricing: 'rates',
  is_active: true,
  sort_order: 0,
  icon: null,
  created_at: new Date(0),
  updated_at: new Date(0),
});
const rate = (
  id: string,
  method_id: string,
  zone_id: string,
  base_cost: number,
) => ({
  id,
  method_id,
  zone_id,
  name: id,
  calculation_type: 'fixed',
  base_cost,
  per_kg_cost: null,
  min_weight: null,
  free_from_amount: null,
  min_order_amount: null,
  max_order_amount: null,
  estimated_days: null,
  is_active: true,
  sort_order: 0,
  config: {},
  created_at: new Date(0),
});
const point = (id: string, method_id: string, zone_id: string | null) => ({
  id,
  method_id,
  name: id,
  address: 'a',
  city: 'c',
  zone_id,
  working_hours: {},
  phone: null,
  is_active: true,
  is_system: false,
  sort_order: 0,
  coordinates: null,
  created_at: new Date(0),
});

const DIRECTORY = {
  methods: [
    method('courier', 'core:address'),
    method('pickup', 'core:pickup'),
    method('pickup2', 'core:pickup'),
  ],
  // Активні зони: основна й K. Неактивна 'off' у довідник не потрапляє.
  zones: [zone('main', true), zone('k', false)],
  rates: [
    rate('rc', 'courier', 'main', 300),
    rate('rpm', 'pickup', 'main', 10),
    rate('rpk', 'pickup', 'k', 0),
  ],
  pickupPoints: [
    point('pk', 'pickup', 'k'),
    point('pnull', 'pickup', null),
    point('poff', 'pickup', 'off'),
    point('p2', 'pickup2', 'k'),
  ],
};

function setup(pickupPointId: string | null) {
  server.getShippingDirectory.mockResolvedValue(DIRECTORY);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useShippingDirectory(pickupPointId, 1000), {
    wrapper,
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useShippingDirectory.rateFor — зона за призначенням', () => {
  it('самовивіз із точкою зони K → тариф K', async () => {
    const { result } = setup('pk');
    await waitFor(() => expect(result.current.methods.length).toBe(3));
    expect(result.current.rateFor('pickup')).toMatchObject({
      rateId: 'rpk',
      cost: 0,
    });
  });

  it('точка без зони (zone_id null) → основна зона', async () => {
    const { result } = setup('pnull');
    await waitFor(() => expect(result.current.methods.length).toBe(3));
    expect(result.current.rateFor('pickup')).toMatchObject({
      rateId: 'rpm',
      cost: 10,
    });
  });

  it('самовивіз без обраної точки → undefined (ціни не видно)', async () => {
    const { result } = setup(null);
    await waitFor(() => expect(result.current.methods.length).toBe(3));
    expect(result.current.rateFor('pickup')).toBeUndefined();
  });

  it('точка іншого способу → undefined', async () => {
    const { result } = setup('p2');
    await waitFor(() => expect(result.current.methods.length).toBe(3));
    expect(result.current.rateFor('pickup')).toBeUndefined();
  });

  it('кур’єр → основна зона, незалежно від обраної точки', async () => {
    const { result } = setup('pk');
    await waitFor(() => expect(result.current.methods.length).toBe(3));
    expect(result.current.rateFor('courier')).toMatchObject({
      rateId: 'rc',
      cost: 300,
    });
  });

  it('точка з неактивною зоною (Р6) → null, а не основна', async () => {
    const { result } = setup('poff');
    await waitFor(() => expect(result.current.methods.length).toBe(3));
    expect(result.current.rateFor('pickup')).toBeNull();
  });
});
