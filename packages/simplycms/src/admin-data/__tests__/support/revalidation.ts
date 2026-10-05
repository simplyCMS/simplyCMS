import { expect } from 'vitest';
/**
 * Дочекатись РЕВАЛІДАЦІЇ зрізу після запису (TSDB-1), а не вгадувати час:
 * (1) list-стаб викликано ще раз після `before` (зріз справді перезапитано);
 * (2) відповіді всіх викликів приземлились і застосовані (мікро- та
 * макро-черга після відповіді, у `act`). Лише після цього тест перевіряє,
 * що стан запису пережив авторитетну відповідь сервера.
 * `before` береться ДО дії, що пише: `const before = list.mock.calls.length`.
 */
import { act, waitFor } from '@testing-library/react';
import type { Mock } from 'vitest';

export async function awaitRevalidation(
  list: Mock<(...args: never[]) => unknown>,
  before: number,
) {
  await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(before));
  await act(async () => {
    await Promise.allSettled(list.mock.results.map((r) => r.value));
    // Застосування відповіді queryCollection — окремі задачі після резолву.
    await new Promise((r) => setTimeout(r, 0));
  });
}
