// К3-Е8, Task 11: лист скидання пароля йде через outbox і порт пошти, назва
// магазину — з профілю, локаль — від хоста, база посилання — з env (Р18а).
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createAuth } from 'simplycms/auth';
import { closeDbPool } from 'simplycms/db';
import type { MailMessage, MailTransport } from 'simplycms/mail';
import { declareStoreLocale } from 'simplycms/site';
import * as F from './fixtures/customer-categories';
import {
  rejectBadRequest,
  sendWebResponse,
  toWebRequest,
} from '../../../../../server-runtime.mjs';

const SITE = 'https://shop.example';
const STORE = 'Сонячний <магазин>';

describe('скидання пароля через порт пошти (Е8-Т11)', () => {
  const db = F.useCustomersDb('simplycms_reset_mail');
  const url = () => db.url();
  const sent: MailMessage[] = [];
  /** Транспорт, який чекає ручного дозволу: так «раніше за транспорт» доводиться без годинника. */
  let gate: Promise<void> = Promise.resolve();
  /** Ставиться ВСЕРЕДИНІ транспорту, після воріт: «send завершився». */
  let sendFinished = false;
  const transport: MailTransport = {
    driver: 'smtp',
    send: async (m) => {
      await gate;
      sendFinished = true;
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
    sendFinished = false;
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

    // Ворота закриті, тож «await deliverMail» ніколи б не повернувся: гонка з
    // короткою межею перетворює таке зависання на швидкий червоний, а не на
    // 15-секундний таймаут. Межа не є частиною доказу — доказ у `sendFinished`.
    const outcome = await Promise.race([
      auth.api
        .requestPasswordReset({ body: { email: 'reset-slow@x.test' } })
        .then(() => 'returned' as const),
      new Promise<'hung'>((r) => setTimeout(() => r('hung'), 3000)),
    ]);
    try {
      expect(outcome).toBe('returned');
      // Повернулись, а транспорт ще не завершив send; лист уже в черзі.
      expect(sendFinished).toBe(false);
      expect(await outboxKinds()).toEqual(['password_reset']);
    } finally {
      release();
    }
    await waitFor(() => sendFinished);
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

  it('Р18(в): через справжній раннер — X-Forwarded-Host і request-target //evil не змінюють базу посилання', async () => {
    declareStoreLocale('uk');
    await F.seedCustomer(url(), { email: 'reset-runner@x.test' });
    const urls: string[] = [];
    const server = createServer((req, res) => {
      // Одне джерело з `server.mjs`: `rejectBadRequest` (400 на поганий
      // request-target, 413 за Content-Length), далі `toWebRequest`.
      if (rejectBadRequest(req, res, '/_serverFn/')) return;
      const request = toWebRequest(req, res, {
        origin: SITE,
        serverFnBase: '/_serverFn/',
      });
      urls.push(request.url);
      void auth.handler(request).then((r) => sendWebResponse(res, r));
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const evil = await fetch(
        `${base}//evil.example/api/auth/request-password-reset`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'reset-runner@x.test' }),
        },
      );
      expect(evil.status).toBe(400);
      expect(sent).toHaveLength(0);

      const response = await fetch(`${base}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-host': 'evil.example',
          'x-forwarded-proto': 'https',
        },
        body: JSON.stringify({ email: 'reset-runner@x.test' }),
      });
      expect(response.status, await response.clone().text()).toBe(200);
      await waitFor(() => sent.length === 1);
      expect(sent[0]!.text).toContain(`${SITE}/api/auth/reset-password/`);
      expect(sent[0]!.text).not.toContain('evil.example');
      // Origin запиту, який бачить auth, — з конфігу, а не з заголовків клієнта.
      expect(urls).toEqual([`${SITE}/api/auth/request-password-reset`]);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('M1: redirectTo на чужий origin відхиляється 403 (trustedOrigins з env, origin-check увімкнено)', async () => {
    await F.seedCustomer(url(), { email: 'reset-redir@x.test' });
    const post = (origin: string, redirectTo: string) =>
      auth.handler(
        new Request(`${origin}/api/auth/request-password-reset`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin },
          body: JSON.stringify({ email: 'reset-redir@x.test', redirectTo }),
        }),
      );
    // Запит «із evil»: за базою із запиту його origin був би довіреним.
    const evil = await post('http://evil.example', 'http://evil.example/reset');
    expect(evil.status).toBe(403);
    // Свій origin + чужий redirectTo — теж 403.
    const redirect = await post(SITE, 'http://evil.example/reset');
    expect(redirect.status).toBe(403);
    expect(sent).toHaveLength(0);
  });
});
