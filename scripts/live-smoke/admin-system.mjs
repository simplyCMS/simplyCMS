/**
 * Крок «система» К3-Е6б — ЄДИНИЙ доказ, що адмін-serverFn і вітринний
 * serverFn ділять ОДИН екземпляр модуля `simplycms/site` (кеш профілю й теми)
 * і що `declareBuiltThemes` host-а виконано до першої активації (Е6б-23):
 * прогін працює на зібраному `server.mjs`. Режими `pnpm dev` і `vite preview`
 * цим не покриті (`docs/architecture/test-contours.md`).
 *
 * Підкроки: 1 профіль (назва, телефон, логотип, соцмережа) → вітрина й
 * `/cart`; 2 заміна логотипа → рівно один `store_logo`; 3 склад вимкнено →
 * замовлення не списує; 4 тема на новому запиті; 4б тема в тій самій вкладці
 * (`router.invalidate()`, Е6б-22); 5 плагін `faq`. Дії — у
 * `./admin-system-profile.mjs`, `./admin-system-stock.mjs` і
 * `./admin-system-themes.mjs`, SQL —
 * `./admin-system-sql.mjs`.
 *
 * 🔴 Крок ОСТАННІЙ у прогоні: `finally` відновлює знімок SQL-ом, а SQL оминає
 * кеш процесу (Е6б-9) — крок після нього в тому ж сервері бачив би старий
 * профіль до 5 хв. Файли логотипів у `MEDIA_ROOT` стенда лишаються сиротами
 * без рядка (sweep — К4).
 */
import * as q from './admin-system-sql.mjs';
import { logoReplacePart, profilePart } from './admin-system-profile.mjs';
import { stockPart } from './admin-system-stock.mjs';
import {
  pluginsPart,
  sameTabPart,
  themesPart,
} from './admin-system-themes.mjs';

const FX = {
  name: 'Е6б Крамниця',
  phone: '+380 50 777 66 55',
  telegram: 'https://t.me/e6b_kramnytsia',
};

/** Повертає знімок і доводить SQL-ом, що стан демо такий, як до кроку. */
async function restorePart({ dbUrl, check }, snap) {
  const removed = await q.restoreSystem(dbUrl, snap);
  const now = await q.snapshotSystem(dbUrl);
  check(
    'система: finally — знімок відновлено, логотипи кроку стерто з media',
    JSON.stringify(now) === JSON.stringify(snap),
    `стерто рядків media: ${removed.length} (файли лишились у MEDIA_ROOT — sweep К4)`,
  );
}

export async function runAdminSystemStep({
  context,
  buyerPage,
  base,
  dbUrl,
  check,
}) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const buyerErrors = [];
  const onBuyerError = (e) => buyerErrors.push(String(e));
  buyerPage.on('pageerror', onBuyerError);
  const snap = await q.snapshotSystem(dbUrl);
  const args = { page, buyerPage, base, dbUrl, check, fx: FX };
  try {
    const firstRef = await profilePart(args);
    await logoReplacePart({ ...args, firstRef });
    await stockPart(args);
    await themesPart(args);
    await sameTabPart(args);
    await pluginsPart(args);
  } catch (e) {
    check('система: крок дійшов до кінця', false, `виняток: ${e.message}`);
  } finally {
    await restorePart(args, snap).catch((e) =>
      check('система: finally — відновлення', false, `виняток: ${e.message}`),
    );
    buyerPage.off('pageerror', onBuyerError);
    await page.close();
  }
  check(
    'адмін pageerror за весь крок «система»',
    errors.length === 0,
    errors.length === 0 ? '0' : errors.join(' | '),
  );
  check(
    'покупець pageerror за весь крок «система»',
    buyerErrors.length === 0,
    buyerErrors.length === 0 ? '0' : buyerErrors.join(' | '),
  );
}
