// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLiveQuery } from '@tanstack/react-db';
import type { ReactNode } from 'react';
import { shippingZonesCollection, useCollection } from 'simplycms/admin-data';
import { AGGREGATE, ENTITY, entityKey } from 'simplycms/contracts/entities';
import { I18nProvider } from 'simplycms/i18n';
import { ZONES } from './render-support';

const m = vi.hoisted(() => ({
  listShippingZones: vi.fn(),
  setDefaultShippingZone: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import { useShippingZoneDefault } from '../useShippingZoneDefault';

const points = entityKey(ENTITY.pickupPoints);
const KEYS = {
  directory: AGGREGATE.shippingDirectory.key,
  stock: [...AGGREGATE.stockInfo.key, null, 'PRODUCT'],
  active: points.variant('active'),
  count: points.variant('count'),
};

beforeEach(() => {
  vi.clearAllMocks();
  m.listShippingZones.mockResolvedValue(ZONES);
});

describe('useShippingZoneDefault', () => {
  it('пише знятий і новий дефолт у колекцію без refetch та інвалідує вітринні кеші (Е6а-14)', async () => {
    const qc = new QueryClient();
    for (const k of Object.values(KEYS)) qc.setQueryData([...k], { warm: 1 });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>
        <I18nProvider locale="uk">{children}</I18nProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(
      () => {
        const col = useCollection(shippingZonesCollection);
        const { data } = useLiveQuery({ query: (q) => q.from({ z: col }) });
        return { apply: useShippingZoneDefault(), data };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toHaveLength(3));
    m.setDefaultShippingZone.mockResolvedValue({
      rows: [
        { ...ZONES[0]!, isDefault: false },
        { ...ZONES[1]!, isDefault: true },
      ],
    });
    await result.current.apply(ZONES[1]!.id);
    await waitFor(() =>
      expect(result.current.data.map((z) => [z.name, z.isDefault])).toEqual(
        expect.arrayContaining([
          ['Київ', false],
          ['Львів', true],
        ]),
      ),
    );
    expect(m.setDefaultShippingZone).toHaveBeenCalledWith({
      data: { id: ZONES[1]!.id },
    });
    expect(m.listShippingZones).toHaveBeenCalledTimes(1);
    for (const [name, k] of Object.entries(KEYS))
      expect([name, qc.getQueryState([...k])?.isInvalidated]).toEqual([
        name,
        true,
      ]);
  });
});
