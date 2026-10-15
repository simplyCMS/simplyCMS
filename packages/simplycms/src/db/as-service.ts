import { withActor, type ActorDb } from './with-actor';

/**
 * Службова транзакція: коротка, під роллю `app_admin` і БЕЗ `userId`.
 *
 * 🔴 Системний актор, а не адмін-користувач (Е6д-20а): `withActor` не має
 * окремого `{ kind: 'system' }`, тож `app.user_id` лишається порожнім і дія
 * не приписується людині, чия транзакція породила хвіст. Для outbox-ів
 * (`media_erasures`, `mail_outbox`) гранти є лише в `app_admin`, тому роль одна.
 * Один помічник на ядро: дубль у кожному outbox розійшовся б на першій зміні ролі.
 */
export function asService<T>(fn: (db: ActorDb) => Promise<T>): Promise<T> {
  return withActor({ role: 'app_admin' }, (db) => fn(db));
}
