import { expect, test } from '../support/console-guard';
import { loginAsOwner } from '../support/auth';

/**
 * §8.3: вимикання/вмикання плагіна `hello-world` без перезавантаження —
 * `PluginSlot` читає HookRegistry в памʼяті вкладки, тож перевірка ловить
 * регресію самого контуру плагінів, а не лише прапорець у БД.
 *
 * Текст віджета й назва плагіна — дані сіду й коду плагіна
 * (`plugins/hello-world/index.ts`), НЕ з i18n-каталогу — однакові на uk/en.
 *
 * 🔴 Перемикач адресується через КАРТКУ плагіна за назвою, а не «єдиний
 * switch на сторінці»: з Фази 3 магазин везе два плагіни (hello-world і
 * faq), і рядок faq зʼявляється в БД асинхронно (bootstrap upsert-ить його
 * при першому візиті адміна) — глобальний лічильник switch-ів був би
 * гонкою за визначенням.
 */
const WIDGET_TEXT = 'Hello, World!';
const PLUGIN_CARD_NAME = 'Hello World';

test('плагін hello-world вимикається і вмикається без reload', async ({
  page,
}) => {
  await loginAsOwner(page);

  await page.goto('/admin');
  await expect(page.getByText(WIDGET_TEXT)).toBeVisible();

  await page.locator('a[href="/admin/plugins"]').first().click();
  await expect(page).toHaveURL('/admin/plugins');
  const helloSwitch = page
    .locator('div.bg-card', { hasText: PLUGIN_CARD_NAME })
    .getByRole('switch');
  await expect(helloSwitch).toHaveCount(1);
  await expect(helloSwitch).toBeChecked();

  await helloSwitch.click();
  await expect(helloSwitch).not.toBeChecked();

  await page.locator('a[href="/admin"]').first().click();
  await expect(page).toHaveURL('/admin');
  await expect(page.getByText(WIDGET_TEXT)).toHaveCount(0);

  await page.locator('a[href="/admin/plugins"]').first().click();
  await helloSwitch.click();
  await expect(helloSwitch).toBeChecked();

  await page.locator('a[href="/admin"]').first().click();
  await expect(page.getByText(WIDGET_TEXT)).toBeVisible();
});
