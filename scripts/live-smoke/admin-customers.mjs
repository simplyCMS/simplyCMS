/**
 * Крок К3-Е6г — ЄДИНИЙ живий доказ «Покупців» і дашборду в реальному браузері
 * на production-збірці: власник знаходить покупця пошуком і міняє контакти й
 * email (`./admin-customers-setup.mjs`), закріплює категорію вручну проти
 * автоправила, видає й знімає роль (`./admin-customers-roles.mjs`), банить
 * (`./admin-customers-ban.mjs`), видаляє акаунт зі знеособленням замовлення
 * й дивиться дашборд (`./admin-customers-delete.mjs`).
 *
 * Покупці A і B — НОВІ, кожен у власному `browser.newContext()` того самого
 * браузера (сесії не змішуються з воронкою й власником). Сторінка воронки
 * тут не потрібна — параметр `buyerPage` лише лічить її `pageerror`, щоб
 * покриття не звузилось. Усе створене прибирається в `finally`
 * (`./admin-customers-cleanup.mjs`); тестові замовлення лишаються. Іде ПІСЛЯ
 * знижок і ПЕРЕД кроком «система» (той лишається останнім).
 */
import { cleanupCustomersStep } from './admin-customers-cleanup.mjs';
import { banPart } from './admin-customers-ban.mjs';
import { dashboardPart, deletePart } from './admin-customers-delete.mjs';
import { rolesPart } from './admin-customers-roles.mjs';
import {
  categoryPart,
  contactsPart,
  prepare,
} from './admin-customers-setup.mjs';

const FX = {
  slug: 'sonyachna-panel-550w-mono',
  newName: 'Змінений',
  newEmail: `Renamed-${Date.now().toString(36)}@Example.test`,
  review: 'Е6г: відгук покупця, якого буде видалено',
  ruleName: 'Е6г: ≥1 замовлення → авто',
  pin: { name: 'Е6г закріплена', code: 'e6g_pin' },
  auto: { name: 'Е6г авто', code: 'e6g_auto' },
};

export async function runAdminCustomersStep({
  context,
  buyerPage,
  base,
  dbUrl,
  check,
}) {
  const page = await context.newPage();
  const browser = context.browser();
  const contexts = {
    a: await browser.newContext(),
    b: await browser.newContext(),
  };
  const pages = {
    a: await contexts.a.newPage(),
    b: await contexts.b.newPage(),
  };
  const errors = { admin: [], a: [], b: [], funnel: [] };
  page.on('pageerror', (e) => errors.admin.push(String(e)));
  pages.a.on('pageerror', (e) => errors.a.push(String(e)));
  pages.b.on('pageerror', (e) => errors.b.push(String(e)));
  const onFunnelError = (e) => errors.funnel.push(String(e));
  buyerPage.on('pageerror', onFunnelError);
  const st = { orders: [] };
  const args = { page, pages, contexts, base, dbUrl, check, fx: FX, st };
  try {
    await prepare(args);
    await contactsPart(args);
    await categoryPart(args);
    await rolesPart(args);
    await banPart(args);
    await deletePart(args);
    await dashboardPart(args);
  } catch (e) {
    check('покупці: крок дійшов до кінця', false, `виняток: ${e.message}`);
  } finally {
    await cleanupCustomersStep(args);
    buyerPage.off('pageerror', onFunnelError);
    await Promise.all([contexts.a.close(), contexts.b.close(), page.close()]);
  }
  for (const [who, list] of [
    ['адмін', errors.admin],
    ['покупець A', errors.a],
    ['покупець B', errors.b],
    ['покупець воронки', errors.funnel],
  ])
    check(
      `${who}: pageerror за весь крок покупців`,
      list.length === 0,
      list.length === 0 ? '0' : list.join(' | '),
    );
}
