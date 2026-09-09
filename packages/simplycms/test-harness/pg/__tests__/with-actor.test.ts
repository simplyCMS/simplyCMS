// Інтеграційний гейт db-рантайму `simplycms/db` (Task 6, план В2-К1а).
//
// 🔴 Тут викликається САМЕ рантайм, а не тестова копія контракту
// (`../actors.mjs`). Розподіл ролей навмисний і взаємний: `actors.mjs` міряє
// БАЗУ незалежним еталоном форми транзакції (щоб поламаний `withActor` не
// перевіряв сам себе в гейті RLS), а цей файл міряє ОБГОРТКУ проти тієї самої
// бази. Розʼїзд між ними впаде тут — і це знахідка, а не шум.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool, withActor, type Actor } from 'simplycms/db';
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
import {
  countSql,
  GUEST_TOKEN,
  ORDER_GUEST,
  recipientInsert,
  SEED_STATEMENTS,
  USER_A,
  USER_B,
} from './fixtures/rls-actors';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');

const AS_A: Actor = { role: 'app_user', userId: USER_A };
const AS_B: Actor = { role: 'app_user', userId: USER_B };
const AS_ADMIN: Actor = { role: 'app_admin', userId: USER_A };
const AS_ANON: Actor = { role: 'app_user' };

/** Рядки одного SQL — через drizzle-інстанс транзакції, не через голий pg. */
const rowsAs = <T>(actor: Actor, statement: string): Promise<T[]> =>
  withActor(
    actor,
    async (db) => (await db.execute(statement)).rows as unknown as T[],
  );

const countAs = async (actor: Actor, statement: string): Promise<number> =>
  (await rowsAs<{ n: number }>(actor, statement))[0].n;

/** Backend pid транзакції — доказ, що зʼєднання те саме (або вже інше). */
const pidAs = async (actor: Actor): Promise<number> =>
  (
    await rowsAs<{ pid: number }>(actor, 'select pg_backend_pid()::int as pid')
  )[0].pid;

describe('withActor: транзакційна обгортка актора', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_with_actor');
  let dbUrl: string;

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
    for (const statement of SEED_STATEMENTS) await queryRows(dbUrl, statement);
    // Рантайм резолвить `DATABASE_URL` сам — і саме як `app_runtime`: під
    // власником таблиць фейл-клоуз не міряється взагалі.
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('логін як app_runtime, робота — під роллю актора', async () => {
    // Структурний доказ обох половин fail-closed дизайну: процес конектиться
    // роллю БЕЗ грантів, а права зʼявляються лише від `SET LOCAL ROLE`.
    const [who] = await rowsAs<{ session_user: string; current_user: string }>(
      AS_A,
      'select session_user::text, current_user::text',
    );
    expect(who).toEqual({
      session_user: 'app_runtime',
      current_user: 'app_user',
    });
    expect(
      (
        await rowsAs<{ current_user: string }>(
          AS_ADMIN,
          'select current_user::text',
        )
      )[0].current_user,
    ).toBe('app_admin');
  });

  it('ізоляція A/B: кожен бачить лише своє, анонім — нічого', async () => {
    const own = await rowsAs<{ user_id: string }>(
      AS_A,
      'select user_id from public.wishlists',
    );
    expect(own.map((row) => row.user_id)).toEqual([USER_A]);
    expect(await countAs(AS_B, countSql('wishlists'))).toBe(1);
    expect(await countAs(AS_ANON, countSql('wishlists'))).toBe(0);
  });

  it('claims не переживають COMMIT — на ТОМУ САМОМУ зʼєднанні', async () => {
    // 🔴 Кейс має сенс лише тоді, коли транзакції йдуть одним фізичним
    // зʼєднанням: на новому зʼєднанні GUC порожні за побудовою, і витік
    // `local=false` сховався б. Тому pid звіряється явно.
    const pid = await pidAs(AS_A);
    expect(await countAs(AS_ADMIN, countSql('orders'))).toBe(2);
    expect(await pidAs(AS_ADMIN)).toBe(pid);
    expect(await countAs(AS_ANON, countSql('wishlists'))).toBe(0);
    expect(await pidAs(AS_ANON)).toBe(pid);
  });

  it('виняток усередині fn відкочує транзакцію й віддає ПЕРВИННУ помилку', async () => {
    const boom = new Error('навмисний виняток');
    await expect(
      withActor(AS_A, async (db) => {
        await db.execute(recipientInsert(USER_A));
        throw boom;
      }),
    ).rejects.toBe(boom);

    expect(await countAs(AS_A, countSql('user_recipients'))).toBe(0);
  });

  it('зʼєднання повертається в пул навіть після винятку', async () => {
    // Витік зʼєднання не падає — він мовчки виїдає пул до зависання на
    // `connect()`. Доказ повернення: наступна транзакція йде тим самим pid.
    const pid = await pidAs(AS_A);
    await expect(
      withActor(AS_A, async () => {
        throw new Error('ще один виняток');
      }),
    ).rejects.toThrow();
    expect(await pidAs(AS_A)).toBe(pid);
  });

  it('WITH CHECK діє і через drizzle-інстанс транзакції', async () => {
    // 🔴 Drizzle ПЕРЕЗАГОРТАЄ помилку драйвера: назовні летить
    // `Failed query: …`, а текст Postgres лишається в `cause`. Для гейта це
    // деталь, для авторів serverFn-ів К2/К3 — контракт: матчити відмову RLS
    // по повідомленню верхнього рівня не вийде.
    const error = await rowsAs(AS_A, recipientInsert(USER_B)).then(
      () => null,
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as { cause?: Error }).cause?.message).toMatch(
      /row-level security/i,
    );
  });

  it('гостьовий контур: замовлення видно за токеном, з чужим — ні', async () => {
    const guest = countSql('orders', `id = '${ORDER_GUEST}'`);
    const asGuest = (orderToken: string): Actor => ({
      role: 'app_user',
      orderToken,
    });
    expect(await countAs(asGuest(GUEST_TOKEN), guest)).toBe(1);
    expect(await countAs(asGuest('not-a-token'), guest)).toBe(0);
    expect(await countAs(AS_ANON, guest)).toBe(0);
  });
});
