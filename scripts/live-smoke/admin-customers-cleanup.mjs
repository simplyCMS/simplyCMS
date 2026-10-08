/**
 * Прибирання кроку К3-Е6г (`finally` у `./admin-customers.mjs`): розбанити й
 * видалити A і B SQL-ом (`delete from users`, каскади; A уже видалено
 * операцією, якщо сценарій дійшов), правило й тимчасові категорії, залишок —
 * як до кроку. Тестові замовлення лишаються (`orders.user_id` → NULL).
 *
 * 🔴 Кожна дія у своєму `try`: збій одного не зриває решту, а факти йдуть в
 * один рядок результату.
 */
import { restoreStock } from './admin-discounts-sql.mjs';
import * as q from './admin-customers-sql.mjs';
import { dropRule, dropUser } from './admin-customers-seed.mjs';
import { sql } from './sql.mjs';
import { orphans } from './admin-customers-facts.mjs';

async function attempt(facts, what, action) {
  try {
    const result = await action();
    facts.push(`${what}: ${JSON.stringify(result)}`);
    // Лише `true` — успіх: обʼєкт (напр. сироти) чи `false` червонять рядок.
    return result === true;
  } catch (e) {
    facts.push(`${what}: виняток ${e.message}`);
    return false;
  }
}

export async function cleanupCustomersStep({ dbUrl, check, st }) {
  const facts = [];
  const results = [];
  if (st.reviewId)
    results.push(
      await attempt(facts, 'відгук A', async () => {
        await sql(dbUrl, 'delete from public.product_reviews where id = $1', [
          st.reviewId,
        ]);
        return true;
      }),
    );
  for (const who of ['a', 'b'])
    if (st[who]?.userId)
      results.push(
        await attempt(facts, `покупець ${who}`, async () => {
          await dropUser(dbUrl, st[who].userId);
          return (await q.userByEmail(dbUrl, st[who].email)) === null;
        }),
      );
  if (st.ids)
    results.push(
      await attempt(facts, 'правило й категорії', async () => {
        await dropRule(dbUrl, st.ids);
        return true;
      }),
    );
  if (st.stock)
    results.push(
      await attempt(facts, 'залишок', async () => {
        const r = await restoreStock(dbUrl, st.stock);
        return r.now === st.stock.quantity;
      }),
    );
  results.push(
    await attempt(facts, 'сироти', async () => {
      const found = await orphans(dbUrl);
      facts.push(`сироти (деталі): ${JSON.stringify(found)}`);
      return Object.keys(found).length === 0;
    }),
  );
  check(
    'прибирання покупців: A і B, правило, категорії, залишок — як до кроку; сиріт немає',
    results.every(Boolean),
    facts.join('; '),
  );
}
