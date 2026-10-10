/**
 * Guard модуля сіду (С-7, С-16б): сід пише лише в базу «щойно після db:demo».
 *
 * 🔴 Команда свою базу перестворює за позначкою (`showcase-db.mts`), але
 * `seedShowcase` кличуть і напряму (гейт, майбутні порти) — з довільною
 * `DATABASE_URL`. Без цієї перевірки прямий виклик дописав би демо-покупців і
 * замовлення в чужий робочий магазин. `--force` немає свідомо: повтор — це
 * `pnpm db:showcase` заново.
 */
import { sql } from 'drizzle-orm';
import type { ActorDb } from '../../packages/simplycms/src/db/index.ts';

/** База не порожня — сід нічого не записав. */
export class ShowcaseNotPristineError extends Error {
  constructor(users: number, orders: number) {
    super(
      `[showcase] Сід пише лише в чисту базу після db:demo, а тут уже є ` +
        `користувачів: ${users}, замовлень: ${orders}. Нічого не записано. ` +
        'Демо-базу перестворює команда `pnpm db:showcase`.',
    );
    this.name = 'ShowcaseNotPristineError';
  }
}

/** `users` і `orders` порожні, інакше — `ShowcaseNotPristineError`. */
export async function assertPristine(db: ActorDb): Promise<void> {
  const result = await db.execute<{ users: number; orders: number }>(sql`
    select (select count(*)::int from public.users) as users,
           (select count(*)::int from public.orders) as orders
  `);
  const row = result.rows[0];
  if (!row) throw new Error('[showcase] guard: порожня відповідь count(*)');
  if (row.users > 0 || row.orders > 0) {
    throw new ShowcaseNotPristineError(row.users, row.orders);
  }
}
