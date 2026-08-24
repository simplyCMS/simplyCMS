import { getRequest } from '@tanstack/react-start/server';
import { readSessionSubject } from 'simplycms/auth';
import { withCustomerDb, type ActorDb } from 'simplycms/storefront/loaders';

/**
 * Транзакція від імені ВЛАСНИКА поточної сесії.
 *
 * 🔴 `userId` береться з `readSessionSubject`, тобто з cookie Better Auth, і
 * НІКОЛИ з параметра serverFn. Це не стиль, а єдиний рубіж, який тут узагалі
 * є: RLS звіряє рядки з тим id, який їй назвав сервер, тож id, прийнятий від
 * клієнта, вона перевірити не може за побудовою — вона стане на його бік.
 *
 * Без сесії кидає: сторінки кабінету за роутом `_protected` і так недосяжні
 * анонімно, а тихе `null` перетворило б відсутність входу на «даних немає».
 *
 * 🔴 Модуль існує ОКРЕМО від файлів із serverFn-ами й не має жодного
 * не-serverFn експорту в них: трансформація Start вирізає тіла хендлерів
 * разом із їхніми імпортами, а живий експортований символ затягнув би
 * серверний auth-контур і пул Postgres у клієнтський бандл (див. `./is-admin`).
 */
export async function withSessionDb<T>(
  fn: (db: ActorDb, userId: string) => Promise<T>,
): Promise<T> {
  const userId = await requireSessionUserId();
  return withCustomerDb(userId, (db) => fn(db, userId));
}

/** Id власника сесії або виняток. */
export async function requireSessionUserId(): Promise<string> {
  const subject = await readSessionSubject(getRequest().headers);
  if (!subject) {
    // 🔴 Текст англійською свідомо: це серверна діагностика, а не рядок
    // інтерфейсу — користувач її не бачить, а зона i18n-скану (`storefront-routes`)
    // кирилицю в літералах не пропускає.
    throw new Error(
      '[simplycms] Sign-in required: no session for this request.',
    );
  }
  return subject.userId;
}

/** Id власника сесії або `null` — для сторінок, доступних і гостю. */
export async function optionalSessionUserId(): Promise<string | null> {
  const subject = await readSessionSubject(getRequest().headers);
  return subject?.userId ?? null;
}
