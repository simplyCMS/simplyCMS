// Спільний дедлайн `status`: усі асинхронні кроки гоняться з одним таймером, а крок,
// що кинув чи не вклався, стає записом `unknown`, а не зникає.

export const TIMED_OUT = Symbol('timed-out');

export const reason = (error) =>
  error instanceof Error ? error.message : String(error);

/** Один спільний дедлайн на всі асинхронні кроки; таймер не тримає процес. */
export function createDeadline(ms) {
  let timer;
  const expired = new Promise((resolve) => {
    timer = setTimeout(resolve, ms, TIMED_OUT);
    timer.unref();
  });
  return {
    race: (promise) => Promise.race([promise, expired]),
    clear: () => clearTimeout(timer),
  };
}

/**
 * Виконати завдання `{ label, run }` паралельно, кожне — у гонці з дедлайном. `run`
 * повертає перевірку або їх масив (завдання БД віддає кілька).
 * @param {{ label: string, run: (ctx: unknown) => unknown }[]} tasks
 * @param {unknown} ctx
 * @param {ReturnType<typeof createDeadline>} deadline
 * @param {number} timeoutMs для тексту
 * @returns {Promise<{ checks: import('./ui.mjs').Check[], unknown: string[] }>}
 */
export async function runRaced(tasks, ctx, deadline, timeoutMs) {
  const settled = await Promise.all(
    tasks.map(async ({ label, run }) => {
      try {
        const result = await deadline.race(
          Promise.resolve().then(() => run(ctx)),
        );
        return result === TIMED_OUT
          ? { unknown: `${label}: не вклалась у ${timeoutMs} мс` }
          : { checks: [result].flat() };
      } catch (error) {
        return { unknown: `${label}: ${reason(error)}` };
      }
    }),
  );
  return {
    checks: settled.flatMap((item) => item.checks ?? []),
    unknown: settled.flatMap((item) => (item.unknown ? [item.unknown] : [])),
  };
}
