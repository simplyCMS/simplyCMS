/**
 * Правка відгуку покупцем і модерація проти версії кроку контенту К3-Е6д
 * (`./admin-content.mjs`, Е6д-23). Іде ПІСЛЯ `moderationPart`: відгук уже
 * `approved`. Адмін відкриває картку (версія зафіксована), покупець редагує
 * відгук (→ `pending`, фото лишене), «застаріла» дія адміна дає 409 з тостом і
 * НЕ змінює статус, а після перечитування схвалення проходить.
 */
import { poll, reviewByTitle } from './admin-content-sql.mjs';
import { waitToast } from './wait.mjs';

export async function editPart({ page, pages, base, dbUrl, check, fx, st }) {
  const buyer = pages.buyer;
  await page.goto(`${base}/admin/reviews/${st.reviewId}`, {
    waitUntil: 'networkidle',
  });
  await page
    .getByRole('button', { name: 'Відхилити' })
    .waitFor({ timeout: 10_000 });

  await buyer.goto(st.productUrl, { waitUntil: 'networkidle' });
  await buyer.getByRole('button', { name: 'Редагувати' }).first().click();
  await buyer.locator('#review-title').fill(fx.editedTitle);
  await buyer.getByRole('button', { name: 'Зберегти зміни' }).click();
  const row = await poll(
    () => reviewByTitle(dbUrl, fx.editedTitle),
    (r) => r?.status === 'pending',
  );
  check(
    'контент: покупець відредагував схвалений відгук → pending, фото лишилось',
    row?.status === 'pending' &&
      Array.isArray(row.images) &&
      row.images[0] === st.reviewRef,
    JSON.stringify(row),
  );

  // Застаріла картка: версія в браузері адміна — до правки покупця.
  await page.getByRole('button', { name: 'Відхилити' }).click();
  const toast = await waitToast(page, 'Відгук змінився');
  const after = await reviewByTitle(dbUrl, fx.editedTitle);
  check(
    'контент: застаріла дія модератора → 409 «Відгук змінився», статус pending',
    toast && after?.status === 'pending',
    `тост ${toast}, статус ${after?.status}`,
  );

  // Після перечитування картки схвалення проходить із новою версією.
  await page.goto(`${base}/admin/reviews/${st.reviewId}`, {
    waitUntil: 'networkidle',
  });
  await page.getByRole('button', { name: 'Затвердити' }).click();
  const approved = await poll(
    () => reviewByTitle(dbUrl, fx.editedTitle),
    (r) => r?.status === 'approved',
  );
  check(
    'контент: після перечитування схвалення з новою updatedAt → approved',
    approved?.status === 'approved',
    JSON.stringify(approved),
  );
}
