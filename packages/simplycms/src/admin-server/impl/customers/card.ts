import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type {
  AdminCategoryHistoryEntry,
  AdminCustomerCard,
} from 'simplycms/contracts';
import { loadCustomerStats } from 'simplycms/commerce';
import { toCents } from 'simplycms/domain';
import { runAdmin } from '../run';
import { isoTs, toDate, toDateOrNull } from '../sql-timestamps';
import { parseAdminInput } from '../validation';

export const getCustomerCardInput = z.object({ userId: z.uuid() });

/** Скільки останніх записів історії категорій віддає картка. */
export const HISTORY_LIMIT = 50;

type HistoryRaw = Omit<AdminCategoryHistoryEntry, 'createdAt'> & {
  createdAt: string;
};

type CardRow = {
  email: string;
  emailVerified: boolean;
  createdAt: string;
  bannedAt: string | null;
  banReason: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarRef: string | null;
  locked: boolean;
  categoryId: string | null;
  categoryName: string | null;
  isAdmin: boolean;
};

/**
 * Картка покупця (`customer.manage`) або `null`, якщо користувача немає.
 * Власник без `profiles`: `stats` — `null` (не виняток), категорія —
 * ефективна дефолтна з `locked: false`, як у списку.
 *
 * `loadCustomerStats` лишається в гривнях (на ньому пороги автоправил) —
 * центи тут, на межі (Е6г-12). Історія — знімок назв (К3-Е6в-5), новіші
 * зверху; `byRule` — запис зроблено правилом (`rule_id`).
 */
export const getCustomerCardOp = async ({
  data,
}: {
  data: z.input<typeof getCustomerCardInput>;
}): Promise<AdminCustomerCard | null> => {
  const { userId } = parseAdminInput(getCustomerCardInput, data);
  return runAdmin('customer.manage', async (db) => {
    const { rows } = await db.execute<CardRow>(sql`
      select u.email, u.email_verified as "emailVerified", ${isoTs(sql`u.created_at`)} as "createdAt",
             ${isoTs(sql`u.banned_at`)} as "bannedAt", u.ban_reason as "banReason",
             p.first_name as "firstName", p.last_name as "lastName", p.phone,
             p.avatar_url as "avatarRef", coalesce(p.category_locked, false) as locked,
             c.id as "categoryId", c.name as "categoryName",
             exists (select 1 from public.user_roles ur
               where ur.user_id = u.id and ur.role = 'admin') as "isAdmin"
        from public.users u
        left join public.profiles p on p.user_id = u.id
        left join public.user_categories c
          on c.id = coalesce(p.category_id,
            (select id from public.user_categories where is_default limit 1))
       where u.id = ${userId}`);
    const row = rows[0];
    if (!row) return null;

    const stats = await loadCustomerStats(db, userId, new Date());
    // Без профілю stats немає, а провайдери входу в власника є — читаємо напряму.
    const authProviders =
      (stats ? [...stats.authProviders] : undefined) ??
      (
        await db.execute<{ providerId: string }>(sql`
          select distinct provider_id as "providerId" from public.accounts
           where user_id = ${userId} order by 1`)
      ).rows.map((p) => p.providerId);
    const history = await db.execute<HistoryRaw>(sql`
      select h.id, h.from_category_name as "fromName", h.to_category_name as "toName",
             h.reason, (h.rule_id is not null) as "byRule",
             a.email as "changedByEmail", ${isoTs(sql`h.created_at`)} as "createdAt"
        from public.user_category_history h
        left join public.users a on a.id = h.changed_by
       where h.user_id = ${userId}
       order by h.created_at desc, h.id desc
       limit ${HISTORY_LIMIT}`);

    return {
      userId,
      email: row.email,
      emailVerified: row.emailVerified,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      createdAt: toDate(row.createdAt),
      avatarRef: row.avatarRef,
      authProviders,
      utmSource: stats?.utmSource ?? null,
      utmCampaign: stats?.utmCampaign ?? null,
      stats: stats
        ? {
            ordersCount: stats.ordersCount,
            totalPurchasesCents: toCents(stats.totalPurchases),
          }
        : null,
      category:
        row.categoryId && row.categoryName
          ? { id: row.categoryId, name: row.categoryName, locked: row.locked }
          : null,
      isAdmin: row.isAdmin,
      bannedAt: toDateOrNull(row.bannedAt),
      banReason: row.banReason,
      history: history.rows.map((h) => ({
        ...h,
        createdAt: toDate(h.createdAt),
      })),
    };
  });
};
