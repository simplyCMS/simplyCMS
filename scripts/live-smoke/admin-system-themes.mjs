/**
 * Підкроки 4, 4б і 5 кроку «система» К3-Е6б (`./admin-system.mjs`): теми і
 * плагіни. Окремим модулем за каноном 150 рядків.
 *
 * 4 — новий запит вітрини (повне завантаження) бачить активовану тему:
 * скидання серверного `activeThemeCache` операцією (кеш прогріто заздалегідь).
 * 4б — ТА САМА вкладка власника, клієнтська навігація «На сайт»
 * (`AdminLayout.tsx`, `navigate({ to: '/' })`): лоадер `_storefront` має
 * `staleTime` 5 хв, тож нову тему показує лише `router.invalidate()` після
 * активації (Е6б-22). Маркер `window.__e6bNoReload` доводить, що сторінка не
 * перезавантажувалась — інакше тест перевіряв би повне завантаження, а не кеш
 * роутера.
 */
import { pollUntil } from './admin-shipping-sql.mjs';
import { waitText } from './selectors.mjs';
import * as q from './admin-system-sql.mjs';

/** Шапка solarstore — `sticky top-0` (`simplycms-theme-solarstore` Header.tsx); у default її немає. */
const SOLAR_HEADER = 'header.sticky.top-0';

/** Активує тему з `/admin/themes` (картка → діалог) і чекає рядок у БД. */
async function activateViaUi({ page, dbUrl }, name) {
  const label = await q.themeDisplayName(dbUrl, name);
  if (!label) throw new Error(`[live-smoke] у БД немає теми «${name}»`);
  await page
    .getByRole('group', { name: label, exact: true })
    .getByRole('button', { name: 'Активувати' })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Активувати' })
    .click();
  await waitText(page, 'Тему активовано');
  return pollUntil(
    () => q.activeTheme(dbUrl),
    (v) => v === name,
  );
}

/** Тема, яку бачить новий запит головної (інлайн-скрипт SSR). */
async function storefrontTheme(buyerPage, base) {
  await buyerPage.goto(`${base}/`, { waitUntil: 'networkidle' });
  return buyerPage.evaluate(() => window.__SIMPLYCMS_ACTIVE_THEME__);
}

/** 4. Активація solarstore і повернення default → новий запит вітрини. */
export async function themesPart(args) {
  const { page, buyerPage, base, check } = args;
  const warm = await storefrontTheme(buyerPage, base);
  await page.goto(`${base}/admin/themes`, { waitUntil: 'networkidle' });
  const solar = await activateViaUi(args, 'solarstore');
  const seenSolar = await storefrontTheme(buyerPage, base);
  check(
    'система: активовано solarstore — новий запит вітрини бачить її',
    warm === 'default' && solar === 'solarstore' && seenSolar === 'solarstore',
    `прогрів ${warm}, БД ${solar}, вітрина ${seenSolar}`,
  );
  const back = await activateViaUi(args, 'default');
  const seenDefault = await storefrontTheme(buyerPage, base);
  check(
    'система: повернуто default — новий запит вітрини бачить її',
    back === 'default' && seenDefault === 'default',
    `БД ${back}, вітрина ${seenDefault}`,
  );
}

/** «На сайт» в шапці адмінки → вітрина; повертає, чи шапка — solarstore. */
async function toSite(page, base, expectSolar) {
  await page.getByRole('button', { name: 'На сайт' }).click();
  await page.waitForURL(`${base}/`, { timeout: 10_000 });
  // `header.w-full` — шапка вітрини в обох темах; у шапки адмінки цього класу немає.
  await page.locator('header.w-full').first().waitFor({ timeout: 10_000 });
  if (expectSolar)
    await page
      .locator(SOLAR_HEADER)
      .first()
      .waitFor({ timeout: 10_000 })
      .catch(() => {});
  return (await page.locator(SOLAR_HEADER).count()) > 0;
}

/** 4б. Та сама вкладка: «На сайт» → назад → активувати → «На сайт». */
export async function sameTabPart(args) {
  const { page, base, check } = args;
  await page.goto(`${base}/admin/themes`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.__e6bNoReload = 1;
  });
  const firstSolar = await toSite(page, base, false);
  await page.goBack();
  await page.waitForURL(`${base}/admin/themes`, { timeout: 10_000 });
  const solar = await activateViaUi(args, 'solarstore');
  const secondSolar = await toSite(page, base, true);
  const alive = await page.evaluate(() => window.__e6bNoReload === 1);
  check(
    'система: та сама вкладка — «На сайт» після активації показує solarstore без перезавантаження',
    !firstSolar && solar === 'solarstore' && secondSolar && alive,
    `до: solarstore=${firstSolar}; БД ${solar}; після: solarstore=${secondSolar}; маркер живий=${alive}`,
  );
  await page.goBack();
  await page.waitForURL(`${base}/admin/themes`, { timeout: 10_000 });
  const back = await activateViaUi(args, 'default');
  check(
    'система: після 4б повернуто default',
    back === 'default',
    `БД ${back}`,
  );
}

/**
 * 5. Плагін `faq`: вимкнути → `is_active = false`; увімкнути назад.
 * Демо реєструє плагіни НЕАКТИВНИМИ (встановлення не вмикає — `plugins/server`),
 * тож неактивний `faq` спершу вмикається тим самим перемикачем.
 */
export async function pluginsPart({ page, base, dbUrl, check }) {
  const before = await q.pluginRow(dbUrl, q.FAQ_PLUGIN);
  if (!before) throw new Error('[live-smoke] у БД немає плагіна «faq»');
  await page.goto(`${base}/admin/plugins`, { waitUntil: 'networkidle' });
  const toggle = page
    .getByRole('group', { name: before.display_name, exact: true })
    .getByRole('switch');
  const flip = async (target) => {
    await toggle.click();
    const row = await pollUntil(
      () => q.pluginRow(dbUrl, q.FAQ_PLUGIN),
      (r) => r?.is_active === target,
    );
    return row?.is_active;
  };
  const start = before.is_active ? true : await flip(true);
  const off = await flip(false);
  const on = await flip(true);
  check(
    'система: плагін faq вимкнено (is_active = false) й увімкнено назад',
    start === true && off === false && on === true,
    `у демо ${before.is_active}; активний ${start} → вимкнено ${off} → увімкнено ${on}`,
  );
}
