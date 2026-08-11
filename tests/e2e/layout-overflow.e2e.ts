import { expect, test } from './support/console-guard';
import { loginAsOwner } from './support/auth';
import { adminRoutePaths, skippedAdminRoutes } from './support/admin-routes';
import { scanForOverflow } from './support/overflow';

/**
 * Обхід вітрини, `/auth` і всієї адмінки з виміром переповнення верстки.
 * Viewport (1280×900 / 390×844) задає Playwright-проєкт
 * (`playwright.config.ts`) — тут лише сам обхід, без хардкоду розмірів.
 *
 * Один тест на весь обхід, а не тест на роут: логін і компіляція dev-сервера
 * коштують дорого, а мета — знайти ВСІ переповнення за прогін, а не впасти
 * на першому.
 *
 * 🔴 Але КОЖЕН роут відкривається у СВІЖІЙ сторінці того самого контексту.
 * З однією сторінкою на всі ~45 навігацій Chromium стабільно вмирав на
 * ~40-й із `net::ERR_INSUFFICIENT_RESOURCES`: у dev-режимі Vite віддає сотні
 * незібраних модулів на роут, і сокети/памʼять сторінки не встигають
 * звільнятися. Сесія від цього не губиться — cookies і localStorage живуть у
 * КОНТЕКСТІ, а не в сторінці, тож логін лишається чинним.
 */

const GUEST_ROUTES = ['/', '/catalog', '/auth'];

// 🔴 Свій ліміт, а не глобальні 30 с із `playwright.config.ts`: це не
// взаємодія з однією сторінкою, а СВІП по ~45 роутах, кожен із яких у
// dev-режимі ще й компілюється Vite на першому заході. Глобальний ліміт тут
// означав би не «щось зависло», а «обхід не встиг» — тобто червоний тест без
// жодного дефекту в продукті.
test.setTimeout(300_000);

test('жоден роут не обрізає текст і не тягне зайвий горизонтальний скрол', async ({
  context,
  page,
}) => {
  const viewportWidth = page.viewportSize()?.width ?? 0;
  const violationsByRoute: Record<string, string[]> = {};

  const visit = async (route: string, allowScrollableOverflow: boolean) => {
    // Свіжа сторінка на роут — див. 🔴 у шапці файлу. Консольний гард стежить
    // за КОНТЕКСТОМ, тож ці сторінки теж під наглядом.
    const target = await context.newPage();
    try {
      await target.goto(route);
      await target
        .waitForLoadState('networkidle', { timeout: 5_000 })
        .catch(() => {
          // Деякі сторінки тримають live-зʼєднання — не блокуємо вимір.
        });
      const violations = await scanForOverflow(target, {
        allowScrollableOverflow,
      });
      if (violations.length > 0) violationsByRoute[route] = violations;
    } finally {
      await target.close();
    }
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

  // Прогалину покриття називаємо вголос: мовчазне «top-N» читалося б як
  // «обійшли все».
  console.log(
    `[layout-overflow] не покрито (потрібен реальний запис): ${skippedAdminRoutes().join(', ')}`,
  );

  const report = Object.entries(violationsByRoute)
    .map(([route, list]) => `${route}:\n  ${list.join('\n  ')}`)
    .join('\n\n');
  expect(violationsByRoute, `Переповнення верстки:\n${report}`).toEqual({});
});
