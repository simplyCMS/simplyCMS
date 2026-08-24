import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { readSessionSubject } from 'simplycms/auth';

/**
 * Чи має власник поточної сесії роль `admin` (К1′б).
 *
 * 🔴 Роль питається ОКРЕМИМ запитом, а не читається з сесії: сесійний токен
 * Better Auth ролей не несе, і це навмисно — відкликана роль мусить діяти з
 * наступного ж запиту, а не після протермінування cookie.
 *
 * 🔴 Це друга точка входу того самого питання (перша —
 * `storefront-routes/server/auth#isAdmin`), і дублювання тут свідоме: тір-зони
 * забороняють `core` (T5) імпортувати `storefront-routes` (T5), а спускати
 * serverFn у нижчий тір означало б тягнути туди роутер-рантайм. Дешевше
 * тримати чотири рядки двічі, ніж прорізати дірку в напрямку шарів.
 */
export const fetchIsAdmin = createServerFn({ method: 'GET' }).handler(
  async (): Promise<boolean> => {
    const subject = await readSessionSubject(getRequest().headers);
    return subject?.roles.includes('admin') ?? false;
  },
);
