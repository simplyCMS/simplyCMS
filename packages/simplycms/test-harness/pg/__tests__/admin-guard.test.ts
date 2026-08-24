// Гейт адмін-доступу наскрізь: сесія Better Auth → ролі з Postgres → рішення
// guard-а (К1′б).
//
// 🔴 Тут міряється саме ПІДКЛЮЧЕНИЙ контур, а не його половини. Юніти
// `authz.test.ts` доводять матрицю на вигаданому субʼєкті, `auth-integration`
// доводить, що signUp пише в БД. Жоден із них не відповідає на питання, яке
// вирішує допуск в адмінку: чи бачить `readSessionSubject` РЕАЛЬНУ роль
// реального користувача за реальною cookie — і чи змінюється відповідь, коли
// роль зʼявляється. Саме на цій відповіді стоїть `adminRequestGuard`
// (`src/start.ts`), тому вона перевіряється проти живої БД, а не мока.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getAuth,
  isAdminRequest,
  readSessionSubject,
  readUserRoles,
  resetAuth,
} from 'simplycms/auth';
import { closeDbPool } from 'simplycms/db';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');
const PASSWORD = 'super-secret-password';

describe('допуск в адмінку по сесії Better Auth', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_guard');
  let dbUrl: string;
  let userId: string;
  let headers: Headers;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(
      dbUrl,
      readdirSync(CANON_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort()
        .map((name) => join(CANON_DIR, name)),
    );

    // 🔴 Env виставляється ДО першого `getAuth()`: guard ходить саме через
    // синглтон процесу, тож тест мусить міряти той самий інстанс, а не
    // власноруч зібраний поруч.
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
    process.env.BETTER_AUTH_SECRET = 'guard-secret-not-a-real-one';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    resetAuth();

    const response = await getAuth().api.signUpEmail({
      body: { email: 'buyer@example.test', password: PASSWORD, name: 'Іван' },
      asResponse: true,
    });
    expect(response.status, await response.clone().text()).toBe(200);

    headers = new Headers({
      cookie: response.headers
        .getSetCookie()
        .map((raw) => raw.split(';')[0])
        .join('; '),
    });
    const subject = await readSessionSubject(headers);
    userId = subject!.userId;
  }, 120_000);

  afterAll(async () => {
    resetAuth();
    await closeDbPool();
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('перший зареєстрований НЕ адмін — інваріант тримається й у підключеному контурі', async () => {
    // Дублює асерт `auth-integration` навмисно: там signUp кличе локальний
    // інстанс, тут — синглтон `getAuth()`, тобто рівно той шлях, яким піде
    // застосунок. Обхід інваріанта підключенням виглядав би саме тут.
    expect(await readUserRoles(userId)).toEqual(['user']);
    expect(await isAdminRequest(headers)).toBe(false);
  });

  it('без cookie доступу немає', async () => {
    expect(await isAdminRequest(new Headers())).toBe(false);
    expect(await readSessionSubject(new Headers())).toBeNull();
  });

  it('видана роль admin відкриває доступ ТІЙ САМІЙ сесії', async () => {
    // Роль видає власник таблиць — так само, як це робить invite власника.
    // Перевипуску cookie немає свідомо: ролі не лежать у токені, тож зміна
    // мусить діяти з наступного ж запиту.
    await queryRows(
      dbUrl,
      `insert into public.user_roles (user_id, role) values ($1, 'admin')`,
      [userId],
    );

    expect(await isAdminRequest(headers)).toBe(true);
    const subject = await readSessionSubject(headers);
    expect([...subject!.roles].sort()).toEqual(['admin', 'user']);
  });

  it('чужа/підроблена cookie доступу не дає', async () => {
    const forged = new Headers({
      cookie: 'better-auth.session_token=not-a-real-token',
    });
    expect(await isAdminRequest(forged)).toBe(false);
  });
});
