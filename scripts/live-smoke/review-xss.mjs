/**
 * Крок «збережений XSS у відгуку» (Тема 9, санітизація HTML) — живий доказ на
 * справжньому збереженому сервері, у справжньому браузері.
 *
 * Що доводить: форма відгуку без `renderEditor` — звичайний `<textarea>`, тож
 * покупець (або будь-хто, хто викликає server function напряму) надсилає
 * довільний HTML. Тут ЧЕРЕЗ ФОРМУ йде `<img onerror>` і `<script>`:
 *   1. РУБІЖ 1 — у `product_reviews.content` лежить уже очищений рядок
 *      (прямий SQL, повз застосунок);
 *   2. РУБІЖ 2 — старий СИРИЙ відгук, покладений у БД прямим SQL (як сід чи
 *      запис до санітизації), віддається вітрині очищеним;
 *   3. у відрендереному DOM картки немає `onerror`/`<script>`, а `alert` не
 *      спрацював (жодного `dialog`).
 *
 * Виклик — у воронці після `register`, поки покупець залогінений.
 */
import { sql, stockSnapshot } from './sql.mjs';
import { PRODUCT_SLUG } from './selectors.mjs';

/** Корисний текст + два класичних вектори. */
const PAYLOAD =
  '<p>Чудова панель, рекомендую</p><img src=x onerror=alert(1)>' +
  '<script>alert(2)</script>';

const UNSAFE = /onerror|<script|javascript:/i;

export async function runReviewXssStep({ page, base, dbUrl, check }) {
  const dialogs = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });

  const { section } = await stockSnapshot(dbUrl, PRODUCT_SLUG);
  const productUrl = `${base}/catalog/${section}/${PRODUCT_SLUG}`;
  const [{ id: productId }] = await sql(
    dbUrl,
    `select id from public.products where slug = $1`,
    [PRODUCT_SLUG],
  );

  // Старий сирий відгук (рубіж 2): кладемо в БД повз застосунок.
  await sql(
    dbUrl,
    `insert into public.product_reviews (id, product_id, user_id, rating, content, status)
     values (gen_random_uuid(), $1, gen_random_uuid(), 4, $2, 'approved')`,
    [productId, '<p>Старий відгук</p>' + PAYLOAD],
  );

  // Новий відгук — через справжню форму.
  await page.goto(productUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Написати відгук' }).click();
  await page.locator('form [role="group"] button').nth(4).click();
  await page.locator('#review-content').fill(PAYLOAD);
  await page.getByRole('button', { name: 'Надіслати відгук' }).click();

  let stored = null;
  for (let i = 0; i < 40 && stored === null; i += 1) {
    const rows = await sql(
      dbUrl,
      `select content from public.product_reviews
        where content like '%Чудова панель%' and status = 'pending'`,
    );
    stored = rows[0]?.content ?? null;
    if (stored === null) await new Promise((r) => setTimeout(r, 250));
  }
  check(
    'відгук-XSS: рубіж 1 — у БД очищений рядок (без onerror/script)',
    stored !== null && !UNSAFE.test(stored),
    JSON.stringify(stored),
  );
  check(
    'відгук-XSS: корисний текст відгуку збережено',
    typeof stored === 'string' && stored.includes('Чудова панель, рекомендую'),
    JSON.stringify(stored),
  );

  // Рубіж 2 + DOM: обидва відгуки (власний pending і старий approved).
  await page.goto(productUrl, { waitUntil: 'networkidle' });
  await page.getByText('Старий відгук').first().waitFor({ timeout: 10_000 });
  const html = await page.evaluate(() => document.body.innerHTML);
  check(
    'відгук-XSS: рубіж 2 — у DOM вітрини немає onerror/script (старий сирий відгук теж)',
    !/onerror=|<script[^>]*>alert/i.test(html) &&
      html.includes('Старий відгук') &&
      html.includes('Чудова панель, рекомендую'),
    /onerror=|<script[^>]*>alert/i.test(html) ? 'ЗНАЙДЕНО' : 'чисто',
  );
  check(
    'відгук-XSS: alert не спрацював',
    dialogs.length === 0,
    dialogs.length === 0 ? '0 dialog' : dialogs.join(' | '),
  );
}
