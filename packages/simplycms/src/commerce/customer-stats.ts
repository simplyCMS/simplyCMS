import { and, eq, sql } from 'drizzle-orm';
import { ORDER_STATUS_CODE } from 'simplycms/contracts/order-status-codes';
import type { ActorDb } from 'simplycms/db';
import type { UserCategoryStats } from 'simplycms/domain';
import {
  accounts,
  orderStatuses,
  orders,
  profiles,
  users,
} from 'simplycms/schema';

const DAY_MS = 86_400_000;

/** Домен email або `null`, якщо `@` немає. */
function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  return at < 0 || at === email.length - 1 ? null : email.slice(at + 1);
}

/**
 * Статистика покупця для автоправил (Е6в-19) або `null`, якщо профілю немає.
 *
 * - Сума й кількість — замовлення покупця, крім `cancelled`. `LEFT JOIN`
 *   статусів: замовлення з `status_id NULL` РАХУЄТЬСЯ (внутрішній join тихо
 *   викинув би його, і поріг «2 замовлення» спрацьовував би пізніше).
 * - Email — `users.email` (джерело Better Auth), не копія в `profiles`.
 * - Провайдери входу — усі `accounts.provider_id` (умова «будь-який рядок має X»).
 * - UTM — `registration_utm->>'utm_source'`/`'utm_campaign'` (ред.3): порожній
 *   рядок, відсутній ключ чи не-обʼєкт → `null`.
 * - Днів від реєстрації — від `profiles.created_at` до переданого `now`.
 *
 * 🔴 Читає `accounts`/`users`, доступні лише `app_admin`: викликач — операція
 * адмінки або службова транзакція вітрини (`withStoreOperatorDb`).
 */
export async function loadCustomerStats(
  db: ActorDb,
  userId: string,
  now: Date,
): Promise<UserCategoryStats | null> {
  const [profile] = await db
    .select({
      createdAt: profiles.createdAt,
      email: users.email,
      utmSource: sql<
        string | null
      >`nullif(${profiles.registrationUtm} ->> 'utm_source', '')`,
      utmCampaign: sql<
        string | null
      >`nullif(${profiles.registrationUtm} ->> 'utm_campaign', '')`,
    })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile) return null;

  const [totals] = await db
    .select({
      total: sql<string>`coalesce(sum(${orders.total}), 0)::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .leftJoin(orderStatuses, eq(orderStatuses.id, orders.statusId))
    .where(
      and(
        eq(orders.userId, userId),
        sql`${orderStatuses.code} is distinct from ${ORDER_STATUS_CODE.cancelled}`,
      ),
    );

  const providers = await db
    .selectDistinct({ providerId: accounts.providerId })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    // Порядок має бути детермінованим: його бачить картка покупця.
    .orderBy(accounts.providerId);

  return {
    totalPurchases: Number(totals?.total ?? 0),
    ordersCount: totals?.count ?? 0,
    registrationDays: Math.max(
      0,
      Math.floor((now.getTime() - profile.createdAt.getTime()) / DAY_MS),
    ),
    emailDomain: emailDomain(profile.email),
    authProviders: providers.map((p) => p.providerId),
    utmSource: profile.utmSource,
    utmCampaign: profile.utmCampaign,
  };
}
