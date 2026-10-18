// К3-Е8, Task 12: листи замовлення покупцю й власнику через outbox пошти.
// Транспорт — фейк (Mailpit тут не потрібен: доводимо чергу в транзакції).
import { join } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { closeDbPool, withActor } from 'simplycms/db';
import type { PlaceOrderInput } from 'simplycms/contracts';
import {
  listMailOutbox,
  type MailMessage,
  type MailTransport,
} from 'simplycms/mail';
import { declareStoreCurrency } from 'simplycms/site';
import { placeOrderFor } from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import {
  applyCanon,
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';
import { blockCommitOn } from './fixtures/commit-block';
import { UK } from './fixtures/text-locale';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../migrations');

// `deliverMail` у режимі `fake` іде у справжню доставку з фейк-транспортом, у
// режимі `noop` — не робить нічого (довести, що рядки вже є ДО доставки).
const delivery = vi.hoisted(() => ({
  mode: 'fake' as 'fake' | 'noop',
  transport: null as unknown,
}));
vi.mock('simplycms/mail', async (orig) => {
  const real = await orig<typeof import('simplycms/mail')>();
  return {
    ...real,
    deliverMail: (ids: readonly string[]) =>
      delivery.mode === 'noop'
        ? Promise.resolve()
        : real.deliverMail(ids, delivery.transport as MailTransport),
  };
});

const input = (overrides: Partial<PlaceOrderInput>): PlaceOrderInput => ({
  firstName: 'Тест',
  lastName: 'Покупець',
  email: 'buyer@example.test',
  phone: '+380000000000',
  shippingMethodId: '',
  deliveryCity: null,
  deliveryAddress: null,
  pickupPointId: null,
  paymentMethod: 'cash',
  notes: null,
  hasDifferentRecipient: false,
  recipientFirstName: null,
  recipientLastName: null,
  recipientPhone: null,
  recipientEmail: null,
  recipientCity: null,
  recipientAddress: null,
  recipientNotes: null,
  saveRecipient: false,
  savedRecipientId: null,
  savedAddressId: null,
  items: [],
  ...overrides,
});

type OutboxRow = { kind: string; attempts: number; last_error: string | null };

describe('листи замовлення через outbox (Е8-Р10, Task 12)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_e8_order_mail');
  let dbUrl = '';
  let pickup = '';
  let point = '';
  let product = '';
  let userId = '';

  const sent: MailMessage[] = [];
  let failWith: Error | null = null;
  delivery.transport = {
    driver: 'log',
    send: async (m: MailMessage) => {
      if (failWith) throw failWith;
      sent.push(m);
    },
  } satisfies MailTransport;

  const outbox = () =>
    queryRows(
      dbUrl,
      `select kind, attempts, last_error from public.mail_outbox order by kind`,
    ) as Promise<OutboxRow[]>;
  const ordersCount = async () =>
    (
      (await queryRows(
        dbUrl,
        `select count(*)::int as c from public.orders`,
      )) as { c: number }[]
    )[0]!.c;
  const setOwnerEmail = (email: string | null) =>
    queryRows(
      dbUrl,
      `insert into public.system_settings (id, key, value)
       values (gen_random_uuid(), 'store_profile', $1::jsonb)
       on conflict (key) do update set value = excluded.value`,
      [
        JSON.stringify({
          name: 'Тест-магазин',
          homeTitle: null,
          description: null,
          contacts: { phone: null, email, address: null, hours: null },
          logo: null,
          socials: [],
        }),
      ],
    );
  const place = (overrides: Partial<PlaceOrderInput> = {}, user?: string) =>
    placeOrderFor(
      input({
        shippingMethodId: pickup,
        pickupPointId: point,
        items: [{ productId: product, modificationId: null, quantity: 1 }],
        ...overrides,
      }),
      user ?? null,
      UK,
    );

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applyCanon(dbUrl);
    await applySqlFiles(dbUrl, [join(MIGRATIONS_DIR, 'demo/demo-seed.sql')]);
    const id = async (sql: string) =>
      ((await queryRows(dbUrl, sql)) as { id: string }[])[0]!.id;
    pickup = await id(
      `select id from public.shipping_methods where code = 'pickup'`,
    );
    point = await id(
      `select id from public.pickup_points where name = 'Склад у Києві'`,
    );
    // Товар без обліку залишку: тест не залежить від порядку списань.
    product = await id(
      `select u.product_id as id from public.url_paths u where u.is_current and u.product_id is not null and u.locale = (select code from public.languages where is_default) and u.path = 'invertor-gibrydnyi-8kw'`,
    );
    userId = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.users (id, name, email, email_verified) values ($1, 'Реєстрований', 'reg@example.test', true)`,
      [userId],
    );
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
    process.env.VITE_SITE_URL = 'https://shop.example.test/some/path';
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.VITE_SITE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  beforeEach(async () => {
    delivery.mode = 'fake';
    failWith = null;
    sent.length = 0;
    await queryRows(dbUrl, 'delete from public.mail_outbox');
    await setOwnerEmail('owner@shop.test');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    declareStoreCurrency('UAH');
  });

  it('гість: два листи (покупцю й власнику) доставлено, рядків немає', async () => {
    const result = await place();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    await vi.waitFor(async () => expect(await outbox()).toEqual([]));
    expect(sent.map((m) => [m.kind, m.to]).sort()).toEqual([
      ['order_customer', 'buyer@example.test'],
      ['order_owner', 'owner@shop.test'],
    ]);
    const owner = sent.find((m) => m.kind === 'order_owner')!;
    // Р18(в): посилання — origin з VITE_SITE_URL + id замовлення.
    expect(owner.text).toContain(
      `https://shop.example.test/admin/orders/${result.order.id}`,
    );
    expect(owner.text).toContain(result.order.orderNumber);
  });

  it('сума в листах — у валюті магазину (declareStoreCurrency), не ₴ за замовчуванням', async () => {
    declareStoreCurrency('USD');
    expect((await place()).ok).toBe(true);
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    for (const mail of sent) {
      expect(mail.text).toContain('$');
      expect(mail.text).not.toContain('₴');
    }
  });

  it('відсутній VITE_SITE_URL відмовляє ДО транзакції: замовлення немає, рядків немає', async () => {
    const saved = process.env.VITE_SITE_URL;
    delete process.env.VITE_SITE_URL;
    const before = await ordersCount();
    try {
      await expect(place()).rejects.toThrow(/VITE_SITE_URL/);
    } finally {
      process.env.VITE_SITE_URL = saved;
    }
    expect(await ordersCount()).toBe(before);
    expect(await outbox()).toEqual([]);
  });

  it('покупець (userId): листи теж доставлено', async () => {
    const result = await place({}, userId);
    expect(result.ok).toBe(true);
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(await outbox()).toEqual([]);
  });

  it('профіль без email → один лист (покупцю)', async () => {
    await setOwnerEmail(null);
    expect((await place()).ok).toBe(true);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.kind).toBe('order_customer');
    expect(await outbox()).toEqual([]);
  });

  it('Д2: телефон без email покупця → замовлення є, листа order_customer немає ніде', async () => {
    delivery.mode = 'noop';
    const before = await ordersCount();
    const result = await place({ email: '' });
    expect(result.ok).toBe(true);
    expect(await ordersCount()).toBe(before + 1);
    // У outbox лише лист власнику; жодного на порожню адресу.
    expect((await outbox()).map((r) => r.kind)).toEqual(['order_owner']);
    delivery.mode = 'fake';
    await place({ email: '   ' });
    await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0));
    expect(sent.some((m) => m.kind === 'order_customer')).toBe(false);
    expect(sent.some((m) => !m.to.trim())).toBe(false);
  });

  it('транспорт кидає → замовлення є, два рядки з attempts = 1', async () => {
    failWith = new Error('smtp down');
    const before = await ordersCount();
    const result = await place();
    expect(result.ok).toBe(true);
    expect(await ordersCount()).toBe(before + 1);
    await vi.waitFor(async () => {
      const rows = await outbox();
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.attempts === 1)).toBe(true);
    });
    expect(sent).toEqual([]);
  });

  it('🔴 хвости для картки адмінки: вид і вік є, тіла листа (message) немає', async () => {
    failWith = new Error('smtp down');
    expect((await place()).ok).toBe(true);
    await vi.waitFor(async () => expect(await outbox()).toHaveLength(2));
    const rows = await withActor({ role: 'app_admin' }, (db) =>
      listMailOutbox(db),
    );
    expect(rows.map((r) => r.kind).sort()).toEqual([
      'order_customer',
      'order_owner',
    ]);
    for (const row of rows) {
      expect(Object.keys(row)).not.toContain('message');
      expect(JSON.stringify(row)).not.toContain('admin/orders');
      expect(row.requestedAt).toBeInstanceOf(Date);
    }
  });

  it('🔴 ROLLBACK замовлення (нестача залишку) → листів і рядків немає', async () => {
    const tracked = (
      (await queryRows(
        dbUrl,
        `select u.product_id as id from public.url_paths u where u.is_current and u.product_id is not null and u.locale = (select code from public.languages where is_default) and u.path = 'sonyachna-panel-450w-mono'`,
      )) as { id: string }[]
    )[0]!.id;
    const before = await ordersCount();
    const result = await place({
      items: [{ productId: tracked, modificationId: null, quantity: 999 }],
    });
    expect(result).toEqual({ ok: false, reason: 'not_purchasable' });
    expect(await ordersCount()).toBe(before);
    expect(await outbox()).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('🔴 ROLLBACK на COMMIT (після постановки листа) → ні замовлення, ні рядків', async () => {
    delivery.mode = 'noop';
    const before = await ordersCount();
    const unblock = await blockCommitOn(
      (q) => queryRows(dbUrl, q),
      'orders',
      'insert',
    );
    try {
      await expect(place()).rejects.toThrow();
    } finally {
      await unblock();
    }
    expect(await ordersCount()).toBe(before);
    expect(await outbox()).toEqual([]);
  });

  it('🔴 атомарність: збій запису листа → замовлення НЕМАЄ', async () => {
    await queryRows(
      dbUrl,
      `create or replace function public.e8_order_mail_fail() returns trigger
         language plpgsql as $$ begin raise exception 'outbox down'; end $$`,
    );
    await queryRows(
      dbUrl,
      `create trigger e8_order_mail_fail before insert on public.mail_outbox
         for each row execute function public.e8_order_mail_fail()`,
    );
    const before = await ordersCount();
    try {
      await expect(place()).rejects.toThrow();
    } finally {
      await queryRows(
        dbUrl,
        'drop trigger e8_order_mail_fail on public.mail_outbox',
      );
      await queryRows(dbUrl, 'drop function public.e8_order_mail_fail()');
    }
    expect(await ordersCount()).toBe(before);
    expect(await outbox()).toEqual([]);
  });

  it('deliverMail = no-op → обидва рядки є в таблиці одразу після COMMIT', async () => {
    delivery.mode = 'noop';
    expect((await place()).ok).toBe(true);
    expect((await outbox()).map((r) => r.kind)).toEqual([
      'order_customer',
      'order_owner',
    ]);
    expect(sent).toEqual([]);
  });
});
