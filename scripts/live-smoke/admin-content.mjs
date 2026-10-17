/**
 * Крок К3-Е6д — ЄДИНИЙ живий доказ контенту в реальному браузері на
 * production-збірці: банери (`./admin-content-banners.mjs`: створення з PNG
 * і кнопкою → головна, заміна картинки з двофазним стиранням, видалення),
 * відгук покупця з фото та ізоляція `pending` від гостя
 * (`./admin-content-reviews.mjs`, Е6д-17), модерація з бейджем, карткою й
 * масовим схваленням (`./admin-content-moderation.mjs`).
 *
 * Покупець — НОВИЙ (`register`) у власному `browser.newContext()`; вітрину
 * банерів дивиться окремий гість, ізоляцію — ще один, щойно створений.
 * Сторінка воронки тут не потрібна — `buyerPage` лише лічить `pageerror`,
 * щоб покриття не звузилось. Усе створене прибирається у `finally`
 * (`./admin-content-cleanup.mjs`). Іде ПІСЛЯ покупців і ПЕРЕД «системою».
 */
import { register } from './register.mjs';
import { bannersPart } from './admin-content-banners.mjs';
import { isolationPart, submitPart } from './admin-content-reviews.mjs';
import { moderationPart } from './admin-content-moderation.mjs';
import { editPart } from './admin-content-edit.mjs';
import { bodyLimitPart } from './body-limit.mjs';
import { cleanupContentStep } from './admin-content-cleanup.mjs';
import { userByEmail } from './admin-customers-sql.mjs';
import { sql } from './sql.mjs';
import { productIdByPath } from './product-address.mjs';

const SLUG = 'sonyachna-panel-600w-bifacial';
const TAG = Date.now().toString(36);

const FX = {
  bannerTitle: `Е6д банер ${TAG}`,
  bannerButton: `До каталогу ${TAG}`,
  reviewTitle: `Е6д відгук ${TAG}`,
  reviewText: `Е6д: відгук із фото, живий прогін ${TAG}`,
  editedTitle: `Е6д відгук (правка) ${TAG}`,
  seededTitle: `Е6д засіяний ${TAG}`,
  seededText: `Е6д: засіяний pending-відгук ${TAG}`,
  adminNote: `Е6д: внутрішня примітка ${TAG}`,
};

export async function runAdminContentStep({
  context,
  buyerPage,
  base,
  dbUrl,
  check,
}) {
  const page = await context.newPage();
  const browser = context.browser();
  const contexts = {
    browser,
    buyer: await browser.newContext(),
    visitor: await browser.newContext(),
    guest: null,
  };
  const pages = {
    buyer: await contexts.buyer.newPage(),
    visitor: await contexts.visitor.newPage(),
  };
  const errors = { admin: [], buyer: [], guest: [], funnel: [] };
  page.on('pageerror', (e) => errors.admin.push(String(e)));
  pages.buyer.on('pageerror', (e) => errors.buyer.push(String(e)));
  pages.visitor.on('pageerror', (e) => errors.guest.push(String(e)));
  const onFunnelError = (e) => errors.funnel.push(String(e));
  buyerPage?.on('pageerror', onFunnelError);
  const st = { errors, mediaKeys: [] };
  const args = { page, pages, contexts, base, dbUrl, check, fx: FX, st };
  try {
    st.productUrl = `${base}/${SLUG}`;
    const [product] = await sql(
      dbUrl,
      `select id from public.products where id = ${productIdByPath('$1')}`,
      [SLUG],
    );
    st.productId = product.id;
    await bannersPart({ ...args, guest: pages.visitor });
    const email = await register(pages.buyer, base);
    st.buyerId = (await userByEmail(dbUrl, email))?.id ?? null;
    await submitPart(args);
    await isolationPart(args);
    await moderationPart(args);
    await editPart(args);
    await bodyLimitPart(args);
  } catch (e) {
    check('контент: крок дійшов до кінця', false, `виняток: ${e.message}`);
  } finally {
    await cleanupContentStep(args);
    buyerPage?.off('pageerror', onFunnelError);
    await Promise.all([
      contexts.buyer.close(),
      contexts.visitor.close(),
      contexts.guest?.close(),
      page.close(),
    ]);
  }
  for (const [who, list] of [
    ['адмін', errors.admin],
    ['покупець', errors.buyer],
    ['гість', errors.guest],
    ['покупець воронки', errors.funnel],
  ])
    check(
      `${who}: pageerror за весь крок контенту`,
      list.length === 0,
      list.length === 0 ? '0' : list.join(' | '),
    );
}
