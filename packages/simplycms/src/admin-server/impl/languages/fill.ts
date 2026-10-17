import { copyPathsForLocale, copyTokensForLocale } from 'simplycms/addressing';
import { buildMissingProjection } from 'simplycms/catalog-projection';
import type { ActorDb } from 'simplycms/db';

/** Розмір пакета за виклик: довга транзакція на 10k сутностей тримала б локи. */
export const FILL_BATCH = 500;

/**
 * Один пакет заповнення мови: адреси, токени, потім проєкція тексту (вона йде
 * останньою: будується з адрес, щойно створених у цій транзакції). Ідемпотентне —
 * копіюються лише сутності без поточного запису в мові; наявні рядки проєкції fill
 * не перезаписує (їх оновлює лише команда, І23). Для мови `disabled` проєкції нема.
 * `done`: усі три вибірки вичерпались (менше за ліміт); клієнт кличе, доки
 * `done` не стане `true`. Остаточну істину дає `completeness`.
 */
export async function fillBatch(
  db: ActorDb,
  code: string,
  batch: number = FILL_BATCH,
): Promise<{ inserted: number; done: boolean }> {
  const paths = await copyPathsForLocale(db, code, batch);
  const tokens = await copyTokensForLocale(db, code, batch);
  const texts = await buildMissingProjection(db, code, batch);
  return {
    inserted: paths + tokens + texts,
    done: paths < batch && tokens < batch && texts < batch,
  };
}
