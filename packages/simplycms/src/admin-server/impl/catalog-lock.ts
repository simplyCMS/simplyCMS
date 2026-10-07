import { advisoryXactLock, type ActorDb } from 'simplycms/db';

/**
 * Транзакційний advisory-lock, ключований ціллю операції (знахідка аудиту
 * Codex 2026-09-23): FOR UPDATE на НАЯВНИХ рядках не серіалізує першу
 * вставку (рядка ще немає — блокувати нічого), тож дві паралельні
 * транзакції падали б 23505 на частковому unique-індексі.
 *
 * 🔴 Чому advisory, а не FOR UPDATE рядка товару: вітрина при оформленні
 * блокує СПЕРШУ рядки залишку, ПОТІМ пише рядок товару (setTargetStatus);
 * адмінка, що блокувала б товар першим, дала б зворотний порядок і
 * дедлок 40P01. Advisory-lock у порядку рядкових локів не бере участі.
 *
 * 🔴 SQL і хешування ключа живуть в `advisoryXactLock` (`simplycms/db`,
 * Е6в-15) — тут лише виклик: той самий ключ з адмінки й з `commerce` мусить
 * давати той самий лок.
 */
export async function lockCatalogTarget(
  db: ActorDb,
  key: string,
): Promise<void> {
  await advisoryXactLock(db, key);
}
