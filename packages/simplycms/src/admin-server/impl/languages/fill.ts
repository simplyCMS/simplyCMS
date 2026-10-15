import { copyPathsForLocale, copyTokensForLocale } from 'simplycms/addressing';
import type { ActorDb } from 'simplycms/db';

/** Розмір пакета за виклик: довга транзакція на 10k сутностей тримала б локи. */
export const FILL_BATCH = 500;

/**
 * Один пакет заповнення мови: адреси, потім токени (з Task 14 — ще й проєкція).
 * Ідемпотентне — копіюються лише сутності без поточного запису в мові.
 * `done`: обидві вибірки вичерпались (менше за ліміт); клієнт кличе, доки
 * `done` не стане `true`. Остаточну істину дає `completeness`.
 */
export async function fillBatch(
  db: ActorDb,
  code: string,
  batch: number = FILL_BATCH,
): Promise<{ inserted: number; done: boolean }> {
  const paths = await copyPathsForLocale(db, code, batch);
  const tokens = await copyTokensForLocale(db, code, batch);
  return { inserted: paths + tokens, done: paths < batch && tokens < batch };
}
