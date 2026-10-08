// К3-Е6г, Task 3: dashboardSummary — кожне число звірене з прямим SQL.
import { describe, expect, it, vi } from 'vitest';
import * as F from './fixtures/customer-categories';
import * as R from './fixtures/admin-customers-read';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: F.ADMIN_ID, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { dashboardSummaryOp } from 'simplycms/admin-server/impl';

const ago = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

describe('admin: dashboardSummary (Е6г-5, Е6г-12)', () => {
  const db = F.useCustomersDb('simplycms_admin_dashboard');
  const url = () => db.url();

  it('нові / виручка 7д і 30д / останні — збігаються з прямим SQL', async () => {
    const o = (
      statusId: string | null,
      total: string,
      days: number,
      erased = false,
    ) => R.seedOrder(url(), { statusId, total, createdAt: ago(days), erased });
    await o(R.STATUS_NEW, '100.00', 0.01);
    await o(R.STATUS_CANCELLED, '500.00', 0.01);
    await o(null, '20.00', 3);
    await o(R.STATUS_NEW, '7.00', 8);
    await o(null, '1000.00', 31);
    const erasedId = await o(null, '0.00', 40, true);

    const s = await dashboardSummaryOp();
    expect(s.newStatusId).toBe(R.STATUS_NEW);
    const [sql] = await F.rows(
      url(),
      `select
         (select count(*)::int from public.orders o join public.order_statuses s on s.id = o.status_id
           where s.code = 'new') as new_orders,
         (select round(coalesce(sum(o.total), 0) * 100)::int from public.orders o
           where o.created_at >= now() - interval '7 days'
             and o.status_id is distinct from '${R.STATUS_CANCELLED}') as r7,
         (select round(coalesce(sum(o.total), 0) * 100)::int from public.orders o
           where o.created_at >= now() - interval '30 days'
             and o.status_id is distinct from '${R.STATUS_CANCELLED}') as r30`,
    );
    expect(s.newOrders).toBe(sql!.new_orders);
    expect(s.revenue7dCents).toBe(sql!.r7);
    expect(s.revenue30dCents).toBe(sql!.r30);
    expect(s.revenue7dCents).toBe(12000);
    expect(s.revenue30dCents).toBe(12700);
    expect(s.newOrders).toBe(2);

    expect(s.recentOrders).toHaveLength(6);
    expect(s.recentOrders[0]!.createdAt.getTime()).toBeGreaterThan(
      s.recentOrders[5]!.createdAt.getTime(),
    );
    const erased = s.recentOrders.find((r) => r.id === erasedId)!;
    expect(erased).toMatchObject({
      customerName: null,
      erased: true,
      totalCents: 0,
    });
    expect(s.recentOrders[1]!.customerName).toBe('Іван Іванов');
  });
});
