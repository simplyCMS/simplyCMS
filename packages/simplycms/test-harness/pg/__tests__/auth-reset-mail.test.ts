// К3-Е8, Task 11: лист скидання пароля йде через outbox і порт пошти, назва
// магазину — з профілю, локаль — від хоста, база посилання — з env (Р18а).
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createAuth } from 'simplycms/auth';
import { closeDbPool } from 'simplycms/db';
import type { MailMessage, MailTransport } from 'simplycms/mail';
import { declareStoreLocale, resetStoreLocale } from 'simplycms/site';
import * as F from './fixtures/customer-categories';

const SITE = 'https://shop.example';
const STORE = 'Сонячний <магазин>';

describe('скидання пароля через порт пошти (Е8-Т11)', () => {
  const db = F.useCustomersDb('simplycms_reset_mail');
  const url = () => db.url();
  const sent: MailMessage[] = [];
  /** Транспорт, який чекає ручного дозволу: так «раніше за транспорт» доводиться без годинника. */
  let gate: Promise<void> = Promise.resolve();
  let transportDone: Promise<void> = Promise.resolve();
  const transport: MailTransport = {
    driver: 'smtp',
    send: async (m) => {
      await gate;
      sent.push(m);
    },
  };
  let auth: ReturnType<typeof createAuth>;

  const outboxKinds = async () =>
    (
      await F.rows(url(), `select kind from public.mail_outbox order by kind`)
    ).map((r) => String((r as { kind: string }).kind));
  const waitFor = async (cond: () => Promise<boolean> | boolean) => {
    for (let i = 0; i < 100; i++) {
      if (await cond()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('waitFor: умова не виконалась');
  };

  beforeAll(async () => {
    process.env.VITE_SITE_URL = SITE;
    await F.rows(
      url(),
      `insert into public.system_settings (id, key, value) values ($1, 'store_profile', $2::jsonb)
       on conflict (key) do update set value = excluded.value`,
      [crypto.randomUUID(), JSON.stringify({ name: STORE })],
    );
    // baseURL НЕ передано: база має прийти з VITE_SITE_URL (Р18а).
    auth = createAuth({
      secret: 'integration-secret-not-a-real-one',
      mailTransport: transport,
    });
  });
  afterEach(() => {
    sent.length = 0;
    gate = Promise.resolve();
    resetStoreLocale();
  });
  afterAll(async () => {
    delete process.env.VITE_SITE_URL;
    await closeDbPool();
  });

  it('рядок password_reset з’являється в mail_outbox і зникає після доставки; лист несе назву магазину', async () => {
    declareStoreLocale('uk');
    await F.seedCustomer(url(), { email: 'reset-ok@x.test' });
    let release!: () => void;
    gate = new Promise((r) => (release = r));
    await auth.api.requestPasswordReset({ body: { email: 'reset-ok@x.test' } });

    expect(await outboxKinds()).toEqual(['password_reset']);
    release();
    await waitFor(async () => (await outboxKinds()).length === 0);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('reset-ok@x.test');
    expect(sent[0]!.subject).toContain(STORE);
    expect(sent[0]!.html).toContain('&lt;магазин&gt;');
    expect(sent[0]!.text).toContain(`${SITE}/api/auth/reset-password/`);
  }, 15_000);

  it('локаль хоста en → англійський лист', async () => {
    declareStoreLocale('en');
    await F.seedCustomer(url(), { email: 'reset-en@x.test' });
    await auth.api.requestPasswordReset({ body: { email: 'reset-en@x.test' } });
    await waitFor(() => sent.length === 1);
    expect(sent[0]!.subject).toBe(`Password reset — ${STORE}`);
  });

  it('таймінг (Е8-О1): відповідь не чекає транспорт, рядок в outbox уже є', async () => {
    declareStoreLocale('uk');
    await F.seedCustomer(url(), { email: 'reset-slow@x.test' });
    let release!: () => void;
    gate = new Promise((r) => (release = r));
    let finished = false;
    transportDone = gate.then(() => {
      finished = true;
    });

    await auth.api.requestPasswordReset({
      body: { email: 'reset-slow@x.test' },
    });

    // Повернулись, а транспорт ще не завершився; лист уже в черзі.
    expect(finished).toBe(false);
    expect(await outboxKinds()).toEqual(['password_reset']);
    release();
    await transportDone;
    await waitFor(async () => (await outboxKinds()).length === 0);
  }, 15_000);

  it('Р18а: підроблені Host / X-Forwarded-Host / URL запиту не змінюють базу посилання', async () => {
    declareStoreLocale('uk');
    await F.seedCustomer(url(), { email: 'reset-evil@x.test' });
    const response = await auth.handler(
      new Request('http://evil.example/api/auth/request-password-reset', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          host: 'evil.example',
          'x-forwarded-host': 'evil.example',
          'x-forwarded-proto': 'https',
        },
        body: JSON.stringify({ email: 'reset-evil@x.test' }),
      }),
    );
    expect(response.status, await response.clone().text()).toBe(200);
    await waitFor(() => sent.length === 1);
    expect(sent[0]!.text).toContain(`${SITE}/api/auth/reset-password/`);
    expect(sent[0]!.text).not.toContain('evil.example');
    expect(sent[0]!.html).not.toContain('evil.example');
  });
});
