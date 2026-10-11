import { requireGrant } from 'simplycms/auth';
import { runAdmin } from '../run';
import {
  listMediaErasures,
  retryMediaErasures,
  type MediaErasure,
} from 'simplycms/storage';

/**
 * Хвости двофазного стирання (Е6д-20) для картки «Сховище» в налаштуваннях.
 * `media.write` — та сама ручка, що й завантаження/видалення файлів.
 */
export const listMediaErasuresOp = (): Promise<MediaErasure[]> =>
  runAdmin('media.write', (db) => listMediaErasures(db));

/**
 * Повторити стирання хвостів (кнопка в адмінці). Фонового шедулера немає, тож
 * саме це — другий шлях добору, окрім опортуністичного. `requireGrant` — той самий рубіж, що й у `runAdmin`, але без
 * порожньої транзакції: анонім до `driver.delete` не доходить.
 */
export const retryMediaErasuresOp = async (): Promise<{
  done: number;
  failed: number;
}> => {
  await requireGrant('media.write');
  return retryMediaErasures();
};
