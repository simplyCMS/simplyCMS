import { expect, test as base } from '@playwright/test';

/**
 * Патерни консольних помилок, які свідомо ігноруємо.
 *
 * Порожньо навмисно: жодного відомого шумного джерела на момент написання
 * специфікацій немає. Якщо зʼявиться — додавай запис із коментарем ЧОМУ саме
 * він не є регресією, а не мовчки розширюй список.
 */
const ALLOWLIST: RegExp[] = [];

/**
 * `test`, розширений автоматичною (`auto: true`) перевіркою: якщо браузер за
 * час тесту вивів консольну помилку або необроблений виняток сторінки —
 * тест падає. Автотест — не туристичний прогін по УІ: мовчки проковтнута
 * помилка мала б бути видимою десь, і саме тут.
 */
export const test = base.extend<{ forEachTestConsoleGuard: void }>({
  forEachTestConsoleGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];

      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        if (ALLOWLIST.some((pattern) => pattern.test(text))) return;
        errors.push(text);
      });
      page.on('pageerror', (error) => {
        errors.push(`pageerror: ${error.message}`);
      });

      await use();

      expect(
        errors,
        `Консольні помилки браузера:\n${errors.join('\n')}`,
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
