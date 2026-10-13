import { getRequest, setResponseHeader } from '@tanstack/react-start/server';
import { readSessionSubject } from 'simplycms/auth';
import type { ViewerPriceTypes } from 'simplycms/commerce';
import type { ActorDb } from './db';
import { withViewerPricesDb } from './viewer-prices-db';

/**
 * Транзакція ПУБЛІЧНОГО лоадера з цінами від імені глядача сесії (Р29).
 *
 * 🔴 Глядача визначає лише серверна сесія — параметра від клієнта немає й не
 * буде: хто називає свою категорію, той називає й свій прайс.
 *
 * 🔴 Відповідь залогіненому персоналізована (його вид цін), тож вона
 * `private, no-store`: спільний кеш перед магазином (CDN, проксі) не має
 * віддати гуртовий прайс наступному відвідувачу. Заголовок лягає і на
 * відповідь serverFn, і на SSR-HTML — під час SSR serverFn виконується в тому
 * самому запиті. Гостьова відповідь однакова для всіх і лишається без нього.
 */
export async function withViewerDb<T>(
  fn: (db: ActorDb, viewer: ViewerPriceTypes) => Promise<T>,
): Promise<T> {
  const subject = await readSessionSubject(getRequest().headers);
  if (subject) setResponseHeader('cache-control', 'private, no-store');
  return withViewerPricesDb(subject?.userId ?? null, fn);
}
