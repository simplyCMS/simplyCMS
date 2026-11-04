import { expect } from 'vitest';
/**
 * Два протилежні очікування щодо list-стабу після запису.
 *
 * `expectNoRefetch` — канон write-back (TanStack DB 1.0 / query-db-collection
 * 1.5): запис патчить кеш зрізів БЕЗ мережі, тож «правду сервера» в кеші
 * доводить серверне поле з відповіді операції, а не перезапит. Ревалідація
 * після запису (M1 TSDB-1 на qdc 1.3.x) зникла — повернення перезапиту
 * тест має помітити.
 *
 * `awaitRevalidation` — для ЯВНОГО перечитування кодом продукту
 * (`utils.refetch()` після відмови сервера): дочекатись виклику list-стабу
 * після `before` і застосування його відповіді.
 * `before` береться ДО дії, що пише: `const before = list.mock.calls.length`.
 */
import { act, waitFor } from '@testing-library/react';
import type { Mock } from 'vitest';

type ListMock = Mock<(...args: never[]) => unknown>;

export async function awaitRevalidation(list: ListMock, before: number) {
  await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(before));
  await act(async () => {
    await Promise.allSettled(list.mock.results.map((r) => r.value));
    // Застосування відповіді queryCollection — окремі задачі після резолву.
    await new Promise((r) => setTimeout(r, 0));
  });
}

export async function expectNoRefetch(list: ListMock, before: number) {
  // Перевірка ВІДСУТНОСТІ події: чекати нема на що, тож пауза свідома —
  // відкладений перезапит після write-back вклався б у ці 30 мс.
  await act(() => new Promise((r) => setTimeout(r, 30)));
  expect(list.mock.calls.length, 'запис спричинив перезапит зрізу').toBe(
    before,
  );
}
