import { z } from 'zod';
import type {
  AdminCustomerCursor,
  AdminCustomerPage,
  AdminCustomerRow,
} from 'simplycms/contracts';
import { runAdmin } from '../run';
import { toDate, toDateOrNull } from '../sql-timestamps';
import { parseAdminInput } from '../validation';
import { buildCustomersListSql } from './list-sql';

export const CUSTOMERS_PAGE_SIZE = 50;

export const listCustomersInput = z.object({
  search: z.string().trim().min(2).max(100).optional(),
  categoryId: z.uuid().optional(),
  role: z.enum(['admin', 'customer']).optional(),
  banned: z.boolean().optional(),
  cursor: z.object({ createdAt: z.date(), id: z.uuid() }).optional(),
});

type Raw = Omit<AdminCustomerRow, 'bannedAt' | 'createdAt'> & {
  bannedAt: string | null;
  createdAt: string;
  createdAtKey: string;
};

/**
 * Список покупців для адмінки (`customer.manage`), keyset за
 * `(created_at desc, id desc)` (Е6г-6). База — `users LEFT JOIN profiles`:
 * власник, створений CLI, профілю не має, але в списку є (Review Focus 5).
 *
 * - Категорія ефективна (`coalesce(p.category_id, дефолтна)`), фільтр — за нею.
 * - Агрегати замовлень — та сама умова, що в `loadCustomerStats`: скасовані
 *   не рахуються, `status_id NULL` рахується.
 * - 🔴 Порядок і курсор по `date_trunc('milliseconds', created_at at time zone
 *   'UTC')`: курсор приходить як JS `Date` (мс), а в БД мікросекунди —
 *   порівняння з неусіченим значенням пропускало б рядки на межі сторінок.
 *   Вираз збігається з індексом `users_created_ms_id_idx` дослівно (`at time
 *   zone 'UTC'` потрібен, щоб вираз індексу був IMMUTABLE) — інакше
 *   планувальник індексу не візьме.
 * - `pageSize` — тестовий шов операції; серверна функція його не передає,
 *   тож клієнт розміром сторінки не керує.
 */
export const listCustomersOp = async ({
  data,
  pageSize = CUSTOMERS_PAGE_SIZE,
}: {
  data: z.input<typeof listCustomersInput>;
  pageSize?: number;
}): Promise<AdminCustomerPage> => {
  const f = parseAdminInput(listCustomersInput, data);
  const query = buildCustomersListSql(f, pageSize);
  return runAdmin('customer.manage', async (db) => {
    const result = await db.execute<Raw>(query);
    const page = result.rows.slice(0, pageSize);
    const last = page[page.length - 1];
    const nextCursor: AdminCustomerCursor | null =
      result.rows.length > pageSize && last
        ? { createdAt: toDate(last.createdAtKey), id: last.userId }
        : null;
    return {
      rows: page.map(({ createdAtKey: _key, ...row }) => ({
        ...row,
        bannedAt: toDateOrNull(row.bannedAt),
        createdAt: toDate(row.createdAt),
      })),
      nextCursor,
    };
  });
};
