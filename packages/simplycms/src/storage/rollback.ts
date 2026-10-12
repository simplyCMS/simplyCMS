import type { MediaStorageDriver } from './driver';
import { completeMediaErasures, scheduleMediaErasures } from './erasures';

/**
 * Виконати `run`, що публікує файли ДО COMMIT, і при будь-якій відмові
 * прибрати вже опубліковані через outbox (Е6д-20б): `scheduleMediaErasures`
 * (видимий хвіст, якщо диск збоїть) + `completeMediaErasures`.
 *
 * `run` кличе `track(ref)` одразу після кожного `writeMedia` — це єдиний
 * момент, коли файл уже на диску, а транзакція ще може впасти. Обидві
 * функції прибирання не кидають, тож первинна помилка не маскується.
 * Другу фазу для успішного шляху (стирання прибраних) викликач робить сам
 * ПІСЛЯ повернення — `catch` тут її не чіпає, щоб не прибрати вже
 * закомічені файли.
 *
 * Межа: неоднозначний COMMIT (сервер закомітив, зʼєднання обірвалось до
 * відповіді) виглядає для `catch` як відмова й прибере файли ЖИВИХ рядків.
 * Рідкісний випадок, свідомо прийнятий.
 *
 * @param discardWith драйвер прибирання (лише харнес; порожньо = типовий).
 */
export async function withPublishedRollback<T>(
  run: (track: (ref: string) => void) => Promise<T>,
  discardWith?: MediaStorageDriver,
): Promise<T> {
  const published: string[] = [];
  try {
    return await run((ref) => {
      published.push(ref);
    });
  } catch (error) {
    if (published.length > 0) {
      await scheduleMediaErasures(published);
      await completeMediaErasures(published, discardWith);
    }
    throw error;
  }
}
