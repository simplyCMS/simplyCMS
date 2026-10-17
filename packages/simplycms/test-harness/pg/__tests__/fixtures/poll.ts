// Єдиний примітив опитування для тестів конкуренції (14б): дедлайн і крок спільні для
// `until`, очікувача дерева блокування і `waitForBlockedBy`, щоб не було трьох копій циклу.
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const DEADLINE_MS = 5_000;
export const STEP_MS = 50;

export interface PollOptions {
  readonly deadlineMs?: number;
  readonly stepMs?: number;
  /** Викликається на БУДЬ-ЯКІЙ невдачі (дедлайн, помилка запиту), перед тим як кинути її далі. */
  readonly onFail?: () => void;
}

/**
 * Викликає `probe`, поки той не поверне значення (не `undefined`); дедлайн — «не дочекались:
 * <what>». `what` може бути функцією, щоб текст помилки містив останній побачений стан.
 */
export async function poll<T>(
  what: string | (() => string),
  probe: () => Promise<T | undefined> | T | undefined,
  { deadlineMs = DEADLINE_MS, stepMs = STEP_MS, onFail }: PollOptions = {},
): Promise<T> {
  try {
    const end = Date.now() + deadlineMs;
    while (Date.now() < end) {
      const got = await probe();
      if (got !== undefined) return got;
      await sleep(stepMs);
    }
    throw new Error(
      `не дочекались: ${typeof what === 'function' ? what() : what}`,
    );
  } catch (e) {
    onFail?.();
    throw e;
  }
}

/** Чекає на умову до 5 с; інакше падає — тест не зависає на бажаній події. */
export async function until(
  what: string,
  pred: () => boolean | Promise<boolean>,
): Promise<void> {
  await poll(what, async () => ((await pred()) ? true : undefined));
}
