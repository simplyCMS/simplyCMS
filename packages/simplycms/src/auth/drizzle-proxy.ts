import { drizzle } from 'drizzle-orm/pg-proxy';
import { withActor } from 'simplycms/db';

/**
 * Міст «Better Auth → Postgres» через `withActor` (Task 7, В2-К1а).
 *
 * 🔴 Чому proxy-драйвер, а не звичайний `drizzle(pool)`. Контракт B5″ каже:
 * зʼєднання беруться ЛИШЕ через `withActor` (голий пул повертає обидва тихі
 * режими відмови, тому імпорт `simplycms/db/client` — помилка лінту). Але
 * `drizzleAdapter` хоче ОДИН довгоживучий db-обʼєкт, а `withActor` живе рівно
 * одну транзакцію. `drizzle-orm/pg-proxy` знімає протиріччя: він не тримає
 * зʼєднання взагалі, а віддає кожен згенерований SQL у колбек — тож кожен
 * запит адаптера стає власною короткою транзакцією під `app_admin`.
 *
 * Ціна відома й прийнята: одна транзакція на запит замість однієї на
 * операцію. Це auth-шлях (реєстрація, вхід, читання сесії), а не гаряча
 * траєкторія каталогу; вимірювана ціна тут дешевша за четверту роль БД або
 * за дірку в лінт-зоні.
 *
 * 🔴 Роль — `app_admin`, бо саме їй видані гранти на таблиці Better Auth
 * (0002_grants.sql, §6): контракт v2 знає рівно дві акторські ролі. Шлях
 * мусить лишатись ВУЗЬКИМ — це не привід відкривати `app_admin` запиту
 * загалом, і поза цим модулем `app_admin` вмикається лише після
 * `requireOperation` (див. `./authz`).
 */

/** Роль, під якою виконуються ВСІ запити auth-контуру. */
const AUTH_ROLE = 'app_admin' as const;

/**
 * Драйвер pg-proxy кличе колбек із `method`, і форма відповіді від нього
 * ЗАЛЕЖИТЬ: для `'execute'` рядки віддаються як обʼєкти, для решти (`'all'`,
 * `'values'`, `'get'`) drizzle сам мапить їх за ПОЗИЦІЄЮ колонки, тобто чекає
 * масиви. Помилка тут не падає — вона тихо дає `undefined` у кожному полі,
 * тому режим вибирається явно, а не «як вийде».
 */
const arrayMode = (method: string): boolean => method !== 'execute';

/** Транзакції proxy-драйвер не підтримує — див. докблок нижче. */
export type AuthDb = ReturnType<typeof createAuthDb>;

/**
 * Drizzle-інстанс для `drizzleAdapter`.
 *
 * 🔴 `drizzle-orm/pg-proxy` кидає на `db.transaction()`. Для нас це безпечно й
 * перевірено: у `@better-auth/drizzle-adapter@1.7.1` усі виклики
 * `db.transaction` стоять під `config.provider === 'mysql'`, а сам адаптер
 * конфігурується з `transaction: false` (дефолт). Якщо апстрім це змінить,
 * ми дізнаємось падінням тесту, а не тихою втратою атомарності — і це
 * рівно та поведінка, якої ми хочемо від піну версії (B3).
 */
export function createAuthDb() {
  return drizzle(async (sql, params, method) => {
    const rows = await withActor({ role: AUTH_ROLE }, async (_db, client) => {
      // 🔴 Дві гілки, а не один обʼєкт із `rowMode: undefined`: у типах `pg`
      // масивний режим — ОКРЕМИЙ перевантажений виклик (`QueryArrayConfig`),
      // і опційне поле в спільному літералі не типізується взагалі.
      if (arrayMode(method)) {
        const result = await client.query<unknown[]>({
          text: sql,
          values: params,
          rowMode: 'array',
        });
        return result.rows;
      }
      const result = await client.query({ text: sql, values: params });
      return result.rows as unknown[];
    });
    return { rows };
  });
}
