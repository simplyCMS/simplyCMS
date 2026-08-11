import { expect, test } from './support/console-guard';
import { loginAsOwner } from './support/auth';
import { adminRoutePaths } from './support/admin-routes';
import { scanForOverflow } from './support/overflow';

/**
 * Обхід вітрини, `/auth` і всієї адмінки з виміром переповнення верстки.
 * Viewport (1280×900 / 390×844) задає Playwright-проєкт
 * (`playwright.config.ts`) — тут лише сам обхід, без хардкоду розмірів.
 *
 * Один тест на весь обхід, а не тест на роут: логін і компіляція dev-сервера
 * коштують дорого, а мета — знайти ВСІ переповнення за прогін, а не впасти
 * на першому.
 */

const GUEST_ROUTES = ['/', '/catalog', '/auth'];

test('жоден роут не обрізає текст і не тягне зайвий горизонтальний скрол', async ({
  page,
}) => {
  const viewportWidth = page.viewportSize()?.width ?? 0;
  const violationsByRoute: Record<string, string[]> = {};

  const visit = async (route: string, allowScrollableOverflow: boolean) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {
      // Деякі сторінки тримають live-зʼєднання — не блокуємо вимір через це.
    });
    const violations = await scanForOverflow(page, { allowScrollableOverflow });
    if (violations.length > 0) violationsByRoute[route] = violations;
  };

  for (const route of GUEST_ROUTES) {
    // Вітрина й /auth — без винятку на скрол за жодного viewport.
    await visit(route, false);
  }

  await loginAsOwner(page);

  // 🔴 Поріг саме "390px + адмінка": див. коментар у `support/overflow.ts`.
  const allowOnAdmin = viewportWidth <= 390;
  for (const route of adminRoutePaths()) {
    await visit(route, allowOnAdmin);
  }

  const report = Object.entries(violationsByRoute)
    .map(([route, list]) => `${route}:\n  ${list.join('\n  ')}`)
    .join('\n\n');
  expect(violationsByRoute, `Переповнення верстки:\n${report}`).toEqual({});
});
