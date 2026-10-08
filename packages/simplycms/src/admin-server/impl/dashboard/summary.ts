import { sql } from 'drizzle-orm';
import type { AdminDashboardSummary } from 'simplycms/contracts';
import { ORDER_STATUS_CODE } from 'simplycms/contracts/order-status-codes';
import { runAdmin } from '../run';
import { isoTs, toDate } from '../sql-timestamps';

const RECENT_LIMIT = 10;

type Totals = { newOrders: number; r7: number; r30: number };
type Recent = Omit<
  AdminDashboardSummary['recentOrders'][number],
  'createdAt'
> & { createdAt: string };

/**
 * Зведення дашборду (`order.manage`, Е6г-12): нові замовлення, виручка за
 * 7/30 днів і 10 останніх. Вікна — від серверного `now()`; виручка не
 * рахує скасовані, але рахує `status_id NULL` (умова `loadCustomerStats`).
 * Стерте замовлення (`personal_data_erased_at`) → `customerName: null`.
 */
export const dashboardSummaryOp = async (): Promise<AdminDashboardSummary> =>
  runAdmin('order.manage', async (db) => {
    const [status] = (
      await db.execute<{ id: string }>(sql`
        select id from public.order_statuses
         where code = ${ORDER_STATUS_CODE.new}`)
    ).rows;
    const newStatusId = status?.id ?? null;

    const [totals] = (
      await db.execute<Totals>(sql`
        select count(*) filter (where o.status_id = ${newStatusId})::int as "newOrders",
               round(coalesce(sum(o.total) filter (where
                 o.created_at >= now() - interval '7 days'
                 and s.code is distinct from ${ORDER_STATUS_CODE.cancelled}), 0) * 100)::float8 as r7,
               round(coalesce(sum(o.total) filter (where
                 o.created_at >= now() - interval '30 days'
                 and s.code is distinct from ${ORDER_STATUS_CODE.cancelled}), 0) * 100)::float8 as r30
          from public.orders o
          left join public.order_statuses s on s.id = o.status_id`)
    ).rows;

    const recent = await db.execute<Recent>(sql`
      select o.id, o.order_number as "orderNumber",
             case when o.personal_data_erased_at is null
               then nullif(trim(concat_ws(' ', o.first_name, o.last_name)), '') end as "customerName",
             (o.personal_data_erased_at is not null) as erased,
             round(o.total * 100)::float8 as "totalCents",
             o.status_id as "statusId", ${isoTs(sql`o.created_at`)} as "createdAt"
        from public.orders o
       order by o.created_at desc, o.id desc
       limit ${RECENT_LIMIT}`);

    return {
      newOrders: totals?.newOrders ?? 0,
      newStatusId,
      revenue7dCents: totals?.r7 ?? 0,
      revenue30dCents: totals?.r30 ?? 0,
      recentOrders: recent.rows.map((r) => ({
        ...r,
        createdAt: toDate(r.createdAt),
      })),
    };
  });
