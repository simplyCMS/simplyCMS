import { expect, test } from '../support/console-guard';
import { loginAsOwner } from '../support/auth';

/**
 * §8.3: вимикання/вмикання плагіна `hello-world` без перезавантаження —
 * `PluginSlot` читає HookRegistry в памʼяті вкладки, тож перевірка ловить
 * регресію самого контуру плагінів, а не лише прапорець у БД.
 *
 * Текст віджета й назва плагіна — дані сіду й коду плагіна
 * (`plugins/hello-world/index.ts`), НЕ з i18n-каталогу — однакові на uk/en.
 */
const WIDGET_TEXT = 'Hello, World!';

test('плагін hello-world вимикається і вмикається без reload', async ({
  page,
}) => {
  await loginAsOwner(page);

  await page.goto('/admin');
  await expect(page.getByText(WIDGET_TEXT)).toBeVisible();

  // Сід ставить рівно один плагін — перемикач на сторінці один, шукати його
  // картку за (локалізованою) назвою не потрібно.
  await page.locator('a[href="/admin/plugins"]').first().click();
  await expect(page).toHaveURL('/admin/plugins');
  await expect(page.getByRole('switch')).toHaveCount(1);
  await expect(page.getByRole('switch')).toBeChecked();

  await page.getByRole('switch').click();
  await expect(page.getByRole('switch')).not.toBeChecked();

  await page.locator('a[href="/admin"]').first().click();
  await expect(page).toHaveURL('/admin');
  await expect(page.getByText(WIDGET_TEXT)).toHaveCount(0);

  await page.locator('a[href="/admin/plugins"]').first().click();
  await page.getByRole('switch').click();
  await expect(page.getByRole('switch')).toBeChecked();

  await page.locator('a[href="/admin"]').first().click();
  await expect(page.getByText(WIDGET_TEXT)).toBeVisible();
});
