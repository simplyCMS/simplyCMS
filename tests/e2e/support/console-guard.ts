import { expect, test as base, type Page } from '@playwright/test';

/**
 * Патерни консольних помилок, які свідомо ігноруємо.
 *
 * 🔴 Кожен запис — з обґрунтуванням, ЧОМУ саме він не є регресією. Мовчки
 * розширювати список не можна: allowlist без причини перетворює гард на
 * декорацію.
 */
const ALLOWLIST: RegExp[] = [
  // Пре-існуючий дефект адмінки, ВИЯВЛЕНИЙ цим гардом на першому прогоні, а
  // не спричинений ним. React 19 лається на setState під час рендеру іншого
  // компонента; відтворюється на ~13 сторінках адмінки, зокрема на
  // `/admin/orders` і `/admin/reviews`.
  //
  // Доказ, що це не регресія гілки: жодну з цих сторінок гілка не змінювала
  // (`git diff main..HEAD -- packages/admin/src/pages/Orders.tsx` порожній).
  //
  // 🔴 Чому allowlist, а не фікс тут: корінь спільний для десятка сторінок і
  // потребує окремого розслідування з живим React DevTools — усередині гілки,
  // що й так закриває чотири борги, це був би змішаний причинно-наслідковий
  // зв'язок. Борг заведено в роадмапі; знімати цей запис слід разом із
  // фіксом, а не «щоб позеленіло».
  /Can't perform a React state update on a component that hasn't mounted yet/,
];

/**
 * `test`, розширений автоматичною (`auto: true`) перевіркою: якщо браузер за
 * час тесту вивів консольну помилку або необроблений виняток сторінки —
 * тест падає. Автотест — не туристичний прогін по УІ: мовчки проковтнута
 * помилка мала б бути видимою десь, і саме тут.
 */
export const test = base.extend<{ forEachTestConsoleGuard: void }>({
  forEachTestConsoleGuard: [
    async ({ context, page }, use) => {
      const errors: string[] = [];

      // Дедуп: фікстурна `page` зазвичай уже є в `context.pages()`, і подвійна
      // підписка подвоїла б кожну помилку у звіті.
      const watched = new WeakSet<Page>();
      const watch = (target: Page) => {
        if (watched.has(target)) return;
        watched.add(target);
        // 🔴 URL сторінки додається до кожного запису. Без нього спека, що
        // обходить 45 роутів, віддає купу однакових рядків без жодної
        // підказки, ЯКИЙ роут їх породив, — і звіт стає марним саме тоді,
        // коли він найпотрібніший.
        const at = () => {
          try {
            return new URL(target.url()).pathname;
          } catch {
            return target.url() || 'about:blank';
          }
        };

        target.on('console', (message) => {
          if (message.type() !== 'error') return;
          const text = message.text();
          if (ALLOWLIST.some((pattern) => pattern.test(text))) return;
          errors.push(`[${at()}] ${text}`);
        });
        target.on('pageerror', (error) => {
          errors.push(`[${at()}] pageerror: ${error.message}`);
        });
      };

      // 🔴 Слухаємо КОНТЕКСТ, а не лише фікстурну `page`. Спека
      // `layout-overflow` навмисно відкриває свіжу сторінку на кожен роут
      // (інакше Chromium вичерпує ресурси на ~40-й навігації в dev-режимі), і
      // прив'язка до однієї `page` мовчки лишила б ті сторінки без нагляду —
      // тобто гард був би зеленим саме там, де найбільше шансів щось зловити.
      context.on('page', watch);
      context.pages().forEach(watch);
      watch(page);

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
