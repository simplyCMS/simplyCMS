// Гейт книги адрес і отримувачів (В2-К1а, кабінет і чекаут).
//
// 🔴 Доки CRUD робив браузер, належність рядка виражалась предикатом у
// запиті (`eq('user_id', …)`), а видалення взагалі йшло `delete().eq('id')`
// — тобто чужу адресу міг стерти будь-хто, хто знав її uuid. Тепер актора
// задає сервер, і єдиний спосіб це довести — виконати ті САМІ лоадери двома
// різними акторами на одній базі.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import {
  createAddress,
  createRecipient,
  deleteAddress,
  deleteRecipient,
  loadAddresses,
  loadRecipients,
  updateAddress,
  updateRecipient,
  withCustomerDb,
} from 'simplycms/storefront/loaders';
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

const addressOf = (name: string) => ({
  name,
  city: 'Київ',
  address: 'вул. Тестова, 1',
  isDefault: false,
});

const recipientOf = (firstName: string) => ({
  firstName,
  lastName: 'Тестовий',
  phone: '+380000000000',
  email: null,
  city: 'Київ',
  address: 'вул. Тестова, 1',
  notes: null,
  isDefault: false,
});

describe('книга адрес і отримувачів під актором', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_addressbook');
  let dbUrl: string;
  let userA = '';
  let userB = '';

  const createUser = async (email: string): Promise<string> => {
    const [row] = (await queryRows(
      dbUrl,
      `insert into public.users (name, email) values ($1, $2) returning id`,
      [email, email],
    )) as Array<{ id: string }>;
    return row.id;
  };

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
    userA = await createUser('alice@example.test');
    userB = await createUser('bob@example.test');
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('🔴 адреси: список актора A не видно актору B', async () => {
    await withCustomerDb(userA, (db) =>
      createAddress(db, userA, addressOf('Дім Аліси')),
    );

    const mine = await withCustomerDb(userA, (db) => loadAddresses(db, userA));
    // Той самий лоадер, той самий аргумент — інший актор.
    const theirs = await withCustomerDb(userB, (db) =>
      loadAddresses(db, userA),
    );

    expect(mine.map((row) => row.name)).toEqual(['Дім Аліси']);
    expect(mine[0].usage_count).toBe(0);
    expect(theirs).toEqual([]);
  });

  it('🔴 адреси: CRUD чужого рядка відбито', async () => {
    const id = await withCustomerDb(userA, (db) =>
      createAddress(db, userA, addressOf('Робота Аліси')),
    );

    const foreignUpdate = await withCustomerDb(userB, (db) =>
      updateAddress(db, userB, id, addressOf('Зламано')),
    );
    // Навіть із ПРАВИЛЬНИМ userId власника: актором лишається B, і RLS
    // звіряє рядок саме з ним.
    const spoofedUpdate = await withCustomerDb(userB, (db) =>
      updateAddress(db, userA, id, addressOf('Зламано')),
    );
    const foreignDelete = await withCustomerDb(userB, (db) =>
      deleteAddress(db, userB, id),
    );

    expect(foreignUpdate).toBe(false);
    expect(spoofedUpdate).toBe(false);
    expect(foreignDelete).toBe(false);

    const [survivor] = await withCustomerDb(userA, (db) =>
      loadAddresses(db, userA),
    ).then((rows) => rows.filter((row) => row.id === id));
    expect(survivor.name).toBe('Робота Аліси');
  });

  it('адреси: власник оновлює й видаляє свій рядок', async () => {
    const id = await withCustomerDb(userA, (db) =>
      createAddress(db, userA, addressOf('Тимчасова')),
    );

    const updated = await withCustomerDb(userA, (db) =>
      updateAddress(db, userA, id, {
        ...addressOf('Перейменована'),
        isDefault: true,
      }),
    );
    const deleted = await withCustomerDb(userA, (db) =>
      deleteAddress(db, userA, id),
    );

    expect(updated).toBe(true);
    expect(deleted).toBe(true);
  });

  it('🔴 отримувачі: список актора A не видно актору B', async () => {
    await withCustomerDb(userA, (db) =>
      createRecipient(db, userA, recipientOf('Аліса')),
    );

    const mine = await withCustomerDb(userA, (db) => loadRecipients(db, userA));
    const theirs = await withCustomerDb(userB, (db) =>
      loadRecipients(db, userA),
    );

    expect(mine.map((row) => row.first_name)).toEqual(['Аліса']);
    expect(mine[0].usage_count).toBe(0);
    expect(theirs).toEqual([]);
  });

  it('🔴 отримувачі: CRUD чужого рядка відбито', async () => {
    const id = await withCustomerDb(userA, (db) =>
      createRecipient(db, userA, recipientOf('Мама')),
    );

    const foreignUpdate = await withCustomerDb(userB, (db) =>
      updateRecipient(db, userB, id, recipientOf('Зламано')),
    );
    const spoofedUpdate = await withCustomerDb(userB, (db) =>
      updateRecipient(db, userA, id, recipientOf('Зламано')),
    );
    const foreignDelete = await withCustomerDb(userB, (db) =>
      deleteRecipient(db, userB, id),
    );

    expect(foreignUpdate).toBe(false);
    expect(spoofedUpdate).toBe(false);
    expect(foreignDelete).toBe(false);

    const survivors = await withCustomerDb(userA, (db) =>
      loadRecipients(db, userA),
    );
    expect(survivors.some((row) => row.id === id)).toBe(true);
  });
});
