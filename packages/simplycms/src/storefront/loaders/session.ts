import { getRequest } from '@tanstack/react-start/server';
import { readSessionSubject } from 'simplycms/auth';
import { withCustomerDb } from './db';
import type { ActorDb } from './db';

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
 * 🔴 Чому це ЛОАДЕРИ, а не `storefront-routes/server` (звідки воно переїхало
 * 2026-08-24, Gate C пілота). Живий не-serverFn експорт, який serverFn-модулі
 * тягнуть ВІДНОСНИМ шляхом, tsup при `splitting: true` піднімає у спільний
 * чанк — а сторінки кабінету імпортують ті самі serverFn-модулі теж відносно
 * й дістають цей чанк у КЛІЄНТСЬКИЙ граф. Start вирізає з чанка лише тіла
 * serverFn; звичайний експорт лишається живим і затягує весь value-граф
 * лоадерів (drizzle, пул) у бандл браузера. Барель лоадерів імпортується
 * bare-специфікатором `simplycms/storefront/loaders`, який у tsup зовнішній
 * (`external`) — у чанки він не потрапляє за побудовою, тож тут цей клас
 * витоку неможливий структурно, а не за домовленістю.
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
    // інтерфейсу — користувач її не бачить, а зона i18n-скану кирилицю в
    // літералах не пропускає.
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
