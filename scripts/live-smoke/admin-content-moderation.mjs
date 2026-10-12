/**
 * Модерація кроку контенту К3-Е6д (`./admin-content.mjs`): бейдж «очікують» у
 * сайдбарі, картка з фото через `/media` (Е6д-11), масове схвалення відгуку
 * покупця й засіяного SQL-ем (Д-4) → вітрина показує обидва, а відповідь
 * `getProductReviews` не несе внутрішньої примітки (Д-1).
 */
import {
  poll,
  reviewStatuses,
  seedPendingReview,
  setAdminComment,
} from './admin-content-sql.mjs';
import { captureServerFns } from './admin-content-reviews.mjs';

export async function moderationPart({
  page,
  contexts,
  base,
  dbUrl,
  check,
  fx,
  st,
}) {
  st.seededId = await seedPendingReview(dbUrl, {
    productId: st.productId,
    title: fx.seededTitle,
    content: fx.seededText,
  });
  await setAdminComment(dbUrl, st.reviewId, fx.adminNote);

  // Бейдж сайдбару: лічильник `pending` (≥ 2 — відгук покупця й засіяний).
  await page.goto(`${base}/admin/reviews`, { waitUntil: 'networkidle' });
  const badge = page.locator('[data-sidebar="menu-badge"]').first();
  const count = Number(
    (await badge.textContent({ timeout: 10_000 }).catch(() => '0')) ?? '0',
  );
  check(
    'контент: сайдбар власника — бейдж «очікують» ≥ 1',
    count >= 1,
    `${count}`,
  );

  // Картка: фото з референсу → `/media/<key>` і реальна роздача.
  await page.goto(`${base}/admin/reviews/${st.reviewId}`, {
    waitUntil: 'networkidle',
  });
  const src = await page
    .locator('img[alt="Фото 1"]')
    .first()
    .getAttribute('src', { timeout: 10_000 })
    .catch(() => null);
  const served = src ? (await page.request.get(`${base}${src}`)).status() : 0;
  check(
    'контент: картка відгуку — <img src="/media/…"> віддається 200',
    src === `/media/${st.reviewRef}` && served === 200,
    `${src} → ${served}`,
  );

  // Масове схвалення двох рядків.
  await page.goto(`${base}/admin/reviews`, { waitUntil: 'networkidle' });
  for (const title of [fx.reviewTitle, fx.seededTitle])
    await page
      .getByRole('row')
      .filter({ hasText: title })
      .getByRole('checkbox', { name: 'Вибрати відгук' })
      .click();
  await page.getByRole('button', { name: 'Схвалити вибрані' }).click();
  const ids = [st.reviewId, st.seededId];
  const statuses = await poll(
    () => reviewStatuses(dbUrl, ids),
    (v) => ids.every((id) => v[id] === 'approved'),
  );
  check(
    'контент: масове схвалення — обидва відгуки approved у БД',
    ids.every((id) => statuses[id] === 'approved'),
    JSON.stringify(statuses),
  );

  // Вітрина (новий гість): обидва відгуки, фото покупця, payload без примітки.
  const ctx = await contexts.browser.newContext();
  try {
    const guest = await ctx.newPage();
    guest.on('pageerror', (e) => st.errors.guest.push(String(e)));
    const fns = captureServerFns(guest);
    await guest.goto(st.productUrl, { waitUntil: 'networkidle' });
    const both = await guest
      .getByText(fx.seededText)
      .first()
      .waitFor({ timeout: 10_000 })
      .then(() =>
        guest
          .getByText(fx.reviewText)
          .first()
          .waitFor({ state: 'visible', timeout: 10_000 })
          .then(() => true),
      )
      .catch(() => false);
    const photo = await guest
      .locator(`img[src="/media/${st.reviewRef}"]`)
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    check(
      'контент: вітрина показує обидва схвалені відгуки, фото відгуку покупця видно',
      both && photo,
      `обидва ${both}, фото ${photo}`,
    );
    const reviews = fns.filter((r) => r.pathname === st.reviewsFnPath);
    const leaked = reviews.some(
      (r) =>
        /admin_comment|adminComment/.test(r.body) ||
        r.body.includes(fx.adminNote),
    );
    check(
      'контент: відповідь getProductReviews не містить admin_comment (Д-1)',
      reviews.some((r) => r.body.includes(st.reviewId)) && !leaked,
      `відповідей ${reviews.length}, з відгуком ${reviews.some((r) => r.body.includes(st.reviewId))}, витік ${leaked}`,
    );
  } finally {
    await ctx.close();
  }
}
