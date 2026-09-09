import { expect, test } from '../support/console-guard';
import { loginAsOwner } from '../support/auth';

/**
 * §8.3 чек-лист (docs/architecture/test-contours.md): guard `/admin` для
 * анонімного, логін власника, доступ до `/profile` під сесією.
 */

test('анонімного редиректить з /admin на /auth', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL('/auth');
});

test('власник логіниться і бачить /admin та /profile', async ({ page }) => {
  await loginAsOwner(page);

  // Протилежна гілка серверного guard-а (src/start.ts): admin-роль → рендер,
  // а не редирект на '/'.
  await page.goto('/admin');
  await expect(page).toHaveURL('/admin');

  await page.goto('/profile');
  await expect(page).toHaveURL('/profile');
});
