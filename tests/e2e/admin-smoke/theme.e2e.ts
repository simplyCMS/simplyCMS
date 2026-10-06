import type { Page } from '@playwright/test';
import { expect, test } from '../support/console-guard';
import { loginAsOwner } from '../support/auth';
import { t } from '../support/i18n';

/**
 * §8.3 + §8.5: активація іншої теми в адмінці й перехід на вітрину В МЕЖАХ
 * застосунку (не F5) має одразу змінити палітру. Тест існує саме тому, що
 * це один раз уже ламалося мовчки: клієнтський кеш (`staleTime: 5 * 60_000`)
 * лишав стару тему до пʼяти хвилин, а тост стверджував протилежне
 * (`docs/architecture/test-contours.md` §8.5). Фікс з К3-Е6б: серверний кеш
 * скидає сама операція `activateTheme` (Е6б-15), кеш роутера —
 * `router.invalidate()` у `admin/features/themes/useThemes.ts` (Е6б-22).
 */

async function readPrimaryToken(page: Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--primary')
      .trim(),
  );
}

/** Активувати першу неактивну тему (кнопка + підтвердження в діалозі). */
async function activateOtherTheme(page: Page): Promise<void> {
  const activateButton = page
    .getByRole('button', { name: t('common.activate'), exact: true })
    .first();
  await activateButton.click();

  const dialog = page.getByRole('alertdialog');
  await dialog
    .getByRole('button', { name: t('common.activate'), exact: true })
    .click();

  // Дочекатись тосту успіху (відповідь `activateTheme` уже в кеші, скидання
  // кешу роутера запущено), а не лише закриття діалогу — інакше тест не ловить
  // саме той дефект, заради якого написаний. `.first()`: тост може
  // дублюватись у `aria-live`-регіоні для скрінрідерів — без нього Playwright
  // падає у strict mode на двох збігах.
  await expect(
    page.getByText(t('admin.themes.activated')).first(),
  ).toBeVisible();
}

test('активація іншої теми міняє палітру на вітрині без reload', async ({
  page,
}) => {
  await page.goto('/');
  const before = await readPrimaryToken(page);

  await loginAsOwner(page);
  await page.goto('/admin/themes');
  await activateOtherTheme(page);

  await page.getByRole('button', { name: t('admin.common.toSite') }).click();
  await expect(page).toHaveURL('/');

  const after = await readPrimaryToken(page);
  expect(after, 'палітра не змінилась після активації іншої теми').not.toBe(
    before,
  );

  // Прибирання: повернути активною ту тему, яку щойно вимкнули (рівно 2 теми
  // в сіді — друга з "Активувати" тепер саме вона), щоб інші прогони й
  // ручні смоки стартували з очікуваного стану (`SEED_THEME = 'default'`).
  await page.goto('/admin/themes');
  await activateOtherTheme(page);
});
