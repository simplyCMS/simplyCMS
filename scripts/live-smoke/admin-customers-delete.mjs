/**
 * Частини «видалення» і «дашборд» кроку К3-Е6г (`./admin-customers.mjs`).
 *
 * Видалення A (має замовлення й відгук): кнопка неактивна, доки не введено
 * email; після — замовлення є, ПД і `access_token` `NULL`, адреса знімка
 * стерта; відгук лишився з `user_id NULL`, вітрина показує «Колишній
 * покупець»; вхід A неможливий; сиріт немає. Дашборд (ПІСЛЯ видалення, щоб
 * стерте замовлення потрапило до «останніх»): числа на сторінці = прямий SQL.
 */
import { pollUntil } from './admin-shipping-sql.mjs';
import { parseMoney, waitText } from './selectors.mjs';
import * as q from './admin-customers-sql.mjs';
import { reviewById, seedReview } from './admin-customers-seed.mjs';
import { stockSnapshot } from './sql.mjs';
import {
  dashboardFacts,
  orphans,
  existsRows,
} from './admin-customers-facts.mjs';
import * as ui from './admin-customers-owner.mjs';
import * as buyer from './admin-customers-buyer.mjs';

export async function deletePart({ page, pages, base, dbUrl, check, fx, st }) {
  st.reviewId = await seedReview(dbUrl, {
    productId: st.productId,
    userId: st.a.userId,
    content: fx.review,
  });
  const r = await ui.deleteFromCard(page, base, st.a.userId, st.a.email);
  const user = await pollUntil(
    () => q.userByEmail(dbUrl, st.a.email),
    (u) => u === null,
  );
  st.deleted = user === null;
  const order = await q.orderRow(dbUrl, st.a.orderId);
  const review = await reviewById(dbUrl, st.reviewId);
  const gone = await Promise.all(
    [['profiles'], ['sessions'], ['accounts']].map(([t]) =>
      existsRows(dbUrl, t, 'user_id', st.a.userId),
    ),
  );
  check(
    'покупці: видалення A — кнопка неактивна до введення email; замовлення є, ПД і access_token NULL, delivery_* NULL, знімок точки видачі лишився (Е6г-10); users/profiles/sessions/accounts немає',
    r.disabledBefore &&
      r.toast &&
      st.deleted &&
      order?.erased === true &&
      [
        'user_id',
        'first_name',
        'last_name',
        'email',
        'phone',
        'access_token',
        'delivery_address',
        'delivery_city',
      ].every((k) => order[k] === null) &&
      // Демо має лише точку видачі: її знімок знеособлення не чіпає. Стирання
      // адреси `kind: address` доводить харнес Task 7, не цей прогін.
      order.dest_kind === 'pickup-point' &&
      order.dest_address !== null &&
      gone.every((n) => n === 0),
    `кнопка вимкнена ${r.disabledBefore}, тост ${r.toast}; замовлення ${JSON.stringify(order)}; рядків ${gone}`,
  );
  st.erasedNumber = order?.order_number;
  const { section } = await stockSnapshot(dbUrl, fx.slug);
  const url = `${base}/catalog/${section}/${fx.slug}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  const shown = await waitText(page, fx.review);
  const former = await waitText(page, 'Колишній покупець');
  const cannot = await buyer.loginAs(
    pages.a,
    base,
    st.a.email,
    'Невірний email або пароль',
  );
  const found = await orphans(dbUrl);
  check(
    'покупці: після видалення відгук лишився (user_id NULL, рейтинг 5), вітрина показує «Колишній покупець», вхід A неможливий, сиріт немає',
    review?.user_id === null &&
      review.rating === 5 &&
      shown &&
      former &&
      cannot &&
      Object.keys(found).length === 0,
    `відгук ${JSON.stringify(review)}; вітрина ${shown}/${former}; вхід відмовлено ${cannot}; сироти ${JSON.stringify(found)}`,
  );
}

/** Значення картки дашборду за назвою: текст `.text-2xl` у найближчому предку. */
const cardValue = (page, title) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll('h3, div')].find(
      (n) => n.children.length === 0 && n.textContent === t,
    );
    for (let n = el; n; n = n.parentElement) {
      const v = n.querySelector('.text-2xl');
      if (v) return v.textContent;
    }
    return null;
  }, title);

export async function dashboardPart({ page, base, dbUrl, check, st }) {
  await page.goto(`${base}/admin`, { waitUntil: 'networkidle' });
  const read = async () => ({
    news: await cardValue(page, 'Нові замовлення'),
    r7: await cardValue(page, 'Виручка за 7 днів'),
    r30: await cardValue(page, 'Виручка за 30 днів'),
  });
  const shown = await pollUntil(read, (v) => v.news && v.news !== '—');
  const rows = await page
    .locator('tbody tr')
    .evaluateAll((trs) => trs.map((tr) => tr.innerText.replace(/\s+/g, ' ')));
  const sql = await dashboardFacts(dbUrl);
  const cents = (t) => Math.round(parseMoney(t) * 100);
  const erasedRow = rows.find((x) => x.includes(st.erasedNumber ?? '\0'));
  check(
    'дашборд: «Нові замовлення» і виручка за 7/30 днів на сторінці = прямий SQL; останні замовлення — ті самі номери; стерте замовлення A — «Видалений покупець»',
    Number(shown.news) === sql.new_orders &&
      cents(shown.r7) === sql.r7 &&
      cents(shown.r30) === sql.r30 &&
      sql.latest.every((n, i) => rows[i]?.startsWith(n)) &&
      erasedRow?.includes('Видалений покупець'),
    `сторінка ${JSON.stringify(shown)}; SQL нових ${sql.new_orders}, 7д ${sql.r7 / 100}, 30д ${sql.r30 / 100}; рядків ${rows.length}; стерте: ${erasedRow ?? '—'}`,
  );
}
