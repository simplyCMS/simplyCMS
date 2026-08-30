// Гейт персональних даних вітрини: актор A не бачить дані актора B.
//
// 🔴 Це головний тест контуру «браузер не ходить у базу». Доки профіль і
// замовлення читав браузер, ідентичність їхала В ЗАПИТІ (`eq('user_id', …)`) —
// і підставлений чужий id читав чуже. Тепер id задає СЕРВЕР через актора
// транзакції, і довести це можна лише так: виконати ті самі лоадери двома
// різними акторами на одній БД.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuth } from 'simplycms/auth';
import { closeDbPool } from 'simplycms/db';
import {
  createOrder,
  loadOrderDetail,
  loadProfile,
  loadStatusByCode,
  loadUserOrders,
  loadUserPriceTypeId,
  setOrderStatus,
  updateProfile,
  withCustomerDb,
  withOrderTokenDb,
  withStoreOperatorDb,
  withStorefrontDb,
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
const PASSWORD = 'super-secret-password';

/** Помічники харнеса — `.mjs`, тож форму рядка описуємо на місці. */
interface IdRow {
  id: string;
}

const orderInput = (name: string) => ({
  firstName: name,
  lastName: 'Тестовий',
  email: `${name}@example.test`,
  phone: '+380000000000',
  shippingMethodId: SHIPPING_METHOD_ID,
  deliveryCity: 'Київ',
  deliveryAddress: 'вул. Тестова, 1',
  pickupPointId: null,
  paymentMethod: 'cash',
  notes: null,
  subtotal: 100,
  shippingCost: 20,
  total: 120,
  hasDifferentRecipient: false,
  recipientFirstName: null,
  recipientLastName: null,
  recipientPhone: null,
  recipientEmail: null,
  savedRecipientId: null,
  savedAddressId: null,
  items: [
    {
      productId: null,
      modificationId: null,
      name: 'Позиція',
      price: 100,
      quantity: 1,
      basePrice: null,
      discountData: null,
    },
  ],
});

let SHIPPING_METHOD_ID = '';

describe('персональні дані вітрини під актором', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_personal');
  let dbUrl: string;
  let auth: ReturnType<typeof createAuth>;
  let userA = '';
  let userB = '';

  const signUp = async (email: string, name: string): Promise<string> => {
    const response = await auth.api.signUpEmail({
      body: { email, password: PASSWORD, name },
      asResponse: true,
    });
    expect(response.status, await response.clone().text()).toBe(200);
    const [row] = (await queryRows(
      dbUrl,
      'select id from public.users where email = $1',
      [email],
    )) as IdRow[];
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
    await queryRows(
      dbUrl,
      `insert into public.shipping_methods (id, code, name)
       values (gen_random_uuid(), 'pickup', 'Самовивіз')`,
    );
    [{ id: SHIPPING_METHOD_ID }] = (await queryRows(
      dbUrl,
      `select id from public.shipping_methods where code = 'pickup'`,
    )) as IdRow[];

    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
    auth = createAuth({
      secret: 'personal-data-secret-not-a-real-one',
      baseURL: 'http://localhost:3000',
    });
    userA = await signUp('alice@example.test', 'Аліса Перша');
    userB = await signUp('bob@example.test', 'Борис Другий');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('🔴 профіль: актор A не віддає дані актора B', async () => {
    await withCustomerDb(userA, (db) =>
      updateProfile(db, userA, {
        firstName: 'Аліса',
        lastName: 'Перша',
        phone: '+380111111111',
      }),
    );

    const asA = await withCustomerDb(userA, (db) => loadProfile(db, userA));
    // Той самий лоадер, той самий аргумент — але актор інший.
    const bReadsA = await withCustomerDb(userB, (db) => loadProfile(db, userA));

    expect(asA?.phone).toBe('+380111111111');
    expect(bReadsA).toBeNull();
  });

  it('🔴 профіль: чужий рядок не оновлюється навіть із його userId', async () => {
    await withCustomerDb(userB, (db) =>
      updateProfile(db, userA, {
        firstName: 'Зламано',
        lastName: 'Зламано',
        phone: '+380999999999',
      }),
    );

    const asA = await withCustomerDb(userA, (db) => loadProfile(db, userA));
    expect(asA?.first_name).toBe('Аліса');
  });

  it('тип ціни категорії читається лише власником профілю', async () => {
    const own = await withCustomerDb(userA, (db) =>
      loadUserPriceTypeId(db, userA),
    );
    const foreign = await withCustomerDb(userB, (db) =>
      loadUserPriceTypeId(db, userA),
    );

    expect(own).toEqual(expect.any(String));
    expect(foreign).toBeNull();
  });

  it('🔴 замовлення: список і картка звужені актором', async () => {
    const created = await withCustomerDb(userA, (db) =>
      createOrder(db, userA, null, orderInput('alice')),
    );

    const mine = await withCustomerDb(userA, (db) => loadUserOrders(db, userA));
    const theirs = await withCustomerDb(userB, (db) =>
      loadUserOrders(db, userA),
    );
    const bOpensA = await withCustomerDb(userB, (db) =>
      loadOrderDetail(db, created.id),
    );

    expect(mine.map((row) => row.id)).toEqual([created.id]);
    expect(mine[0].items).toHaveLength(1);
    expect(mine[0].total).toBe(120);
    expect(theirs).toEqual([]);
    expect(bOpensA).toBeNull();
  });

  it('🔴 гостьове замовлення: читається лише за своїм токеном', async () => {
    const token = '11111111-2222-4333-8444-555555555555';
    const created = await withOrderTokenDb(token, (db) =>
      createOrder(db, null, token, orderInput('guest')),
    );

    const byToken = await withOrderTokenDb(token, (db) =>
      loadOrderDetail(db, created.id),
    );
    const byWrongToken = await withOrderTokenDb(
      '00000000-0000-4000-8000-000000000000',
      (db) => loadOrderDetail(db, created.id),
    );
    const byAnonymous = await withStorefrontDb((db) =>
      loadOrderDetail(db, created.id),
    );

    expect(byToken?.order_number).toBe(created.orderNumber);
    expect(byToken?.items).toHaveLength(1);
    expect(byWrongToken).toBeNull();
    expect(byAnonymous).toBeNull();
  });

  it('🔴 скасування: покупець не має UPDATE, операція йде під app_admin', async () => {
    const created = await withCustomerDb(userA, (db) =>
      createOrder(db, userA, null, orderInput('cancel')),
    );
    const cancelled = await withStorefrontDb((db) =>
      loadStatusByCode(db, 'cancelled'),
    );

    // Пряма спроба покупця — саме той fail-closed, на який спирається
    // двоактний serverFn: гранта UPDATE у `app_user` немає.
    //
    // 🔴 Асертиться `cause`, а не `message`: Drizzle загортає помилку драйвера
    // у власний текст «Failed query: …», і збіг по ньому нічого не сказав би
    // про ПРИЧИНУ відмови — саме її тут і треба довести.
    const failure = await withCustomerDb(userA, (db) =>
      setOrderStatus(db, created.id, cancelled!.id),
    ).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).not.toBeNull();
    expect(
      (failure as { cause?: { message?: string } }).cause?.message,
    ).toMatch(/permission denied/i);

    await withStoreOperatorDb((db) =>
      setOrderStatus(db, created.id, cancelled!.id),
    );
    const after = await withCustomerDb(userA, (db) =>
      loadOrderDetail(db, created.id),
    );
    expect(after?.status?.code).toBe('cancelled');
  });
});
