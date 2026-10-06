import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { AGGREGATE, ENTITY, entityKey } from 'simplycms/contracts/entities';

// Persistence-хендлери чотирьох колекцій доставки (Е6а-14). Named-операції
// (setDefault, remove) інвалідують у хуках UI (Е6а-22) — тут лише колекції.
const m = vi.hoisted(() => ({
  list: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  other: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listPickupPoints: m.list,
    insertPickupPoints: m.insert,
    updatePickupPoints: m.update,
    removePickupPoints: m.remove,
    listShippingMethods: vi.fn(async () => []),
    insertShippingMethods: m.other,
    listShippingZones: vi.fn(async () => []),
    insertShippingZones: m.other,
    listShippingRates: vi.fn(async () => []),
    insertShippingRates: m.other,
  }),
);

import { getCollection } from '../registry';
import { pickupPointsCollection } from '../collections/pickup-points';
import { shippingMethodsCollection } from '../collections/shipping-methods';
import { shippingZonesCollection } from '../collections/shipping-zones';
import { shippingRatesCollection } from '../collections/shipping-rates';

const points = entityKey(ENTITY.pickupPoints);
const STOCK = [...AGGREGATE.stockInfo.key, null, 'PRODUCT'];
const KEYS = {
  active: points.variant('active'),
  directory: AGGREGATE.shippingDirectory.key,
  stock: STOCK,
};
const row = { id: 'p1', name: 'Точка' };

async function setup() {
  const qc = new QueryClient();
  m.list.mockResolvedValue([row]);
  const c = getCollection(qc, pickupPointsCollection);
  await c.preload();
  // Вітринні кеші вже «прогріті» — інвалідація лишає стан isInvalidated.
  for (const k of Object.values(KEYS)) qc.setQueryData([...k], { warm: true });
  const invalidated = () =>
    Object.fromEntries(
      Object.entries(KEYS).map(([n, k]) => [
        n,
        qc.getQueryState([...k])?.isInvalidated,
      ]),
    );
  return { qc, c, invalidated };
}
const ALL = { active: true, directory: true, stock: true };

describe('колекції доставки: інвалідація довідника і складів', () => {
  beforeEach(() => vi.clearAllMocks());

  it('insert точки: write-back + інвалідація без refetch колекції', async () => {
    const { c, invalidated } = await setup();
    m.insert.mockImplementation(async ({ data }) => data);
    expect(invalidated()).toEqual({
      active: false,
      directory: false,
      stock: false,
    });
    await c.insert({ id: 'p2', name: 'Нова' } as never).isPersisted.promise;
    expect(c.get('p2')?.name).toBe('Нова');
    expect(invalidated()).toEqual(ALL);
    expect(m.list).toHaveBeenCalledTimes(1);
  });

  it('update точки: write-back + інвалідація без refetch колекції', async () => {
    const { c, invalidated } = await setup();
    m.update.mockResolvedValue([{ ...row, name: 'Інша' }]);
    await c.update('p1', (d) => void (d.name = 'Інша')).isPersisted.promise;
    expect(c.get('p1')?.name).toBe('Інша');
    expect(invalidated()).toEqual(ALL);
    expect(m.list).toHaveBeenCalledTimes(1);
  });

  it('remove точки: іменований guarded remove + інвалідація без refetch', async () => {
    const { c, invalidated } = await setup();
    m.remove.mockResolvedValue({ count: 1 });
    await c.delete('p1').isPersisted.promise;
    expect(m.remove).toHaveBeenCalledWith({ data: [{ id: 'p1' }] });
    expect(c.get('p1')).toBeUndefined();
    expect(invalidated()).toEqual(ALL);
    expect(m.list).toHaveBeenCalledTimes(1);
  });

  it('409 від guarded remove не ковтається і не інвалідує', async () => {
    const { c, invalidated } = await setup();
    m.remove.mockRejectedValue(new Error('conflict'));
    await expect(c.delete('p1').isPersisted.promise).rejects.toThrow(
      'conflict',
    );
    expect(invalidated().directory).toBe(false);
  });

  it.each([
    ['способи', shippingMethodsCollection],
    ['зони', shippingZonesCollection],
    ['тарифи', shippingRatesCollection],
  ] as const)('%s: insert інвалідує довідник і склади', async (_n, def) => {
    const qc = new QueryClient();
    qc.setQueryData([...AGGREGATE.shippingDirectory.key], 1);
    qc.setQueryData(STOCK, 1);
    m.other.mockImplementation(async ({ data }) => data);
    const c = getCollection(qc, def as never) as {
      preload(): Promise<void>;
      insert(r: unknown): { isPersisted: { promise: Promise<unknown> } };
    };
    await c.preload();
    await c.insert({ id: 'x' }).isPersisted.promise;
    expect(
      qc.getQueryState([...AGGREGATE.shippingDirectory.key])?.isInvalidated,
    ).toBe(true);
    expect(qc.getQueryState(STOCK)?.isInvalidated).toBe(true);
  });
});
