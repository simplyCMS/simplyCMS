import { builtinEnvironments } from 'vitest/runtime';

/**
 * jsdom-середовище, що ДЕТЕРМІНОВАНО ставить teardown у найгірше місце гонки
 * «робота React після знесення jsdom» (хвиля Е8-E): запит, що пережив тест
 * (сесія Better Auth), завершується, React комітить оновлення, а teardown
 * jsdom виконується ще ДО `setImmediate` планувальника, який читає
 * `window.event`. Далі воркер тримається живим (`RACE_LINGER_MS`), як під
 * навантаженням повного прогону, щоб пізню помилку було кому зібрати.
 *
 * Без цього гонка недетермінована (~1 з 3-4 повних прогонів): гард-тест не мав
 * би чого довести.
 */
const jsdom = builtinEnvironments.jsdom;

export default {
  ...jsdom,
  name: 'race-teardown-jsdom',
  async setup(global: typeof globalThis, options: Record<string, unknown>) {
    const env = await jsdom.setup(global, options);
    const origFetch = global.fetch;
    let settled: Promise<unknown> | null = null;
    // Ворота: відповідь запиту віддаємо лише тоді, коли teardown готовий.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    global.fetch = ((...a: Parameters<typeof fetch>) => {
      const p = origFetch(...a).then(
        async (r) => (await gate, r),
        async (e) => {
          await gate;
          throw e;
        },
      );
      settled = p.then(
        () => undefined,
        () => undefined,
      );
      return p;
    }) as typeof fetch;
    return {
      async teardown(g: typeof globalThis) {
        // Даємо таймеру `setTimeout(0)` атома сесії стартувати запит.
        await new Promise((r) => setTimeout(r, 50));
        release();
        if (settled) await settled;
        // Мікрозадачі: React комітить оновлення, але setImmediate ще не пройшов.
        for (let i = 0; i < 50; i++) await Promise.resolve();
        await env.teardown(g);
        await new Promise((r) =>
          setTimeout(r, Number(process.env.RACE_LINGER_MS ?? 300)),
        );
      },
    };
  },
};
