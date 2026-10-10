/**
 * Відгук із фото кроку контенту К3-Е6д (`./admin-content.mjs`): покупець
 * подає форму з PNG (Е6д-6) → рядок `pending` з одним референсом і рядком
 * `media` сутності `review`; автор бачить свій відгук із фото й бейджем
 * (Е6д-17), а гість у НОВОМУ context — ні: ні в HTML, ні у відповіді
 * `getProductReviews`, яка ще й `private, no-store`. Крок ловить майбутній
 * prefetch чи лоадер, що потягне відгуки в SSR або спільний кеш.
 */
import { PNG } from './avatar.mjs';
import { mediaKeysOf, poll, reviewByTitle } from './admin-content-sql.mjs';

/** GET-відповіді serverFn сторінки: шлях, заголовки й тіло. */
export function captureServerFns(page) {
  const seen = [];
  page.on('response', async (r) => {
    const { pathname } = new URL(r.url());
    if (r.request().method() !== 'GET' || !pathname.startsWith('/_serverFn/'))
      return;
    const body = await r.text().catch(() => '');
    seen.push({ pathname, headers: r.headers(), body });
  });
  return seen;
}

export async function submitPart({ pages, dbUrl, check, fx, st }) {
  const page = pages.buyer;
  await page.goto(st.productUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Написати відгук' }).click();
  await page.locator('form [role="group"] button').nth(4).click();
  await page.locator('#review-title').fill(fx.reviewTitle);
  await page.locator('#review-content').fill(fx.reviewText);
  await page.setInputFiles('[data-testid="review-images-input"]', {
    name: 'review.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await page.getByRole('button', { name: 'Надіслати відгук' }).click();
  const row = await poll(() => reviewByTitle(dbUrl, fx.reviewTitle));
  st.reviewId = row?.id ?? null;
  const keys = row ? await mediaKeysOf(dbUrl, 'review', row.id) : [];
  st.mediaKeys.push(...keys);
  st.reviewRef = row?.images?.[0] ?? null;
  check(
    'контент: відгук із фото — pending, 1 референс = рядок media сутності review',
    row?.status === 'pending' &&
      row.user_id === st.buyerId &&
      Array.isArray(row.images) &&
      row.images.length === 1 &&
      keys.length === 1 &&
      keys[0] === row.images[0],
    JSON.stringify({ ...row, media: keys }),
  );
}

export async function isolationPart({ pages, contexts, check, fx, st }) {
  // Автор: свій відгук із фото й бейджем «На модерації».
  const author = pages.buyer;
  const authorFns = captureServerFns(author);
  await author.goto(st.productUrl, { waitUntil: 'networkidle' });
  await author.getByText(fx.reviewText).first().waitFor({ timeout: 10_000 });
  const card = author.locator('div.border.rounded-lg', {
    hasText: fx.reviewText,
  });
  const badge = await card.getByText('На модерації').count();
  const src = await card
    .locator('img[alt="Фото 1"]')
    .first()
    .getAttribute('src', { timeout: 10_000 })
    .catch(() => null);
  check(
    'контент: автор бачить свій pending-відгук із фото й бейджем «На модерації»',
    badge > 0 && src === `/media/${st.reviewRef}`,
    `бейдж ${badge}, фото ${src}`,
  );
  // Шлях `getProductReviews` — та відповідь, що несе id відгуку автора: хеш
  // serverFn у збірці непрозорий, а вгадувати його за тілом гостя — коло.
  const own = authorFns.find((r) => r.body.includes(st.reviewId));
  st.reviewsFnPath = own?.pathname ?? null;

  // Гість у НОВОМУ context: ні SSR, ні відповідь serverFn відгуку не несуть.
  contexts.guest = await contexts.browser.newContext();
  const guest = await contexts.guest.newPage();
  guest.on('pageerror', (e) => st.errors.guest.push(String(e)));
  const guestFns = captureServerFns(guest);
  const ssr = await (await guest.request.get(st.productUrl)).text();
  await guest.goto(st.productUrl, { waitUntil: 'networkidle' });
  const dom = await guest.content();
  const reviews = guestFns.filter((r) => r.pathname === st.reviewsFnPath);
  check(
    'контент: гість (новий context) — тексту відгуку немає ні в SSR, ні в DOM',
    !ssr.includes(fx.reviewText) && !dom.includes(fx.reviewText),
    `SSR ${ssr.includes(fx.reviewText)}, DOM ${dom.includes(fx.reviewText)}`,
  );
  check(
    'контент: гість — відповідь getProductReviews без id відгуку, private, no-store',
    st.reviewsFnPath !== null &&
      reviews.length > 0 &&
      reviews.every(
        (r) =>
          !r.body.includes(st.reviewId) &&
          r.headers['cache-control'] === 'private, no-store',
      ),
    `шлях ${st.reviewsFnPath}, відповідей ${reviews.length}, ` +
      reviews.map((r) => r.headers['cache-control']).join(' | '),
  );
  await guest.close();
}
