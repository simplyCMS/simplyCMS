import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const { listOrderStatuses } = vi.hoisted(() => ({
  listOrderStatuses: vi.fn(async () => [
    {
      id: '00000001-0000-4000-8000-000000000001',
      name: 'Новий',
      code: 'new',
      color: '#3B82F6',
      sortOrder: 0,
      isDefault: true,
      version: 2,
    },
  ]),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({ listOrderStatuses }),
);

import { getCollection } from '../registry';
import { orderStatusesCollection } from '../collections/order-statuses';

describe('колекція order_statuses (лише читання, М2б Р19)', () => {
  it('id колекції — з ENTITY (значення "order_statuses" з реєстру, не довільне)', () => {
    expect(orderStatusesCollection.id).toBe('order_statuses');
  });

  it('читає список операцією order-statuses.list (eager, вхід {})', async () => {
    const c = getCollection(new QueryClient(), orderStatusesCollection);
    await c.preload();
    expect(listOrderStatuses).toHaveBeenCalledWith({ data: {} });
    expect(c.get('00000001-0000-4000-8000-000000000001')?.version).toBe(2);
  });

  it('запису через колекцію немає: insert/update/delete відмовляють без хендлерів', async () => {
    const c = getCollection(new QueryClient(), orderStatusesCollection);
    await c.preload();
    expect(() =>
      c.insert({ id: crypto.randomUUID(), name: 'X' } as never),
    ).toThrow();
    expect(() =>
      c.update('00000001-0000-4000-8000-000000000001', (d) => {
        d.color = '#000000';
      }),
    ).toThrow();
    expect(() => c.delete('00000001-0000-4000-8000-000000000001')).toThrow();
  });
});
