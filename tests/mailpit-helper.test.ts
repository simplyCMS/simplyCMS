import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { findMail, toWithSubject } from '../scripts/mailpit.mjs';

/** Спільний polling Mailpit (live:smoke і gate-mail): знаходить лист і не кидає на збої мережі. */
let server: Server | undefined;
afterEach(() => server?.close());

const serve = async (messages: unknown[]) => {
  server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify(
        req.url?.startsWith('/api/v1/message/')
          ? { Text: 'тіло https://shop.test/x' }
          : { messages },
      ),
    );
  }).listen(0, '127.0.0.1');
  await new Promise((r) => server!.once('listening', r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

const msg = (to: string, subject: string) => ({
  ID: 'm1',
  To: [{ Address: to }],
  From: { Address: 'shop@x.test' },
  Subject: subject,
});

describe('findMail', () => {
  it('знаходить лист за адресою й темою та читає текст', async () => {
    const api = await serve([msg('a@x.test', 'Скидання пароля — Магазин')]);
    const { mail, error } = await findMail({
      api,
      match: toWithSubject('a@x.test', 'Скидання'),
      timeout: 2000,
    });
    expect(error).toBeNull();
    expect(mail?.from).toBe('shop@x.test');
    expect(mail?.text).toContain('https://shop.test/x');
  });

  it('чужий адресат — null без помилки', async () => {
    const api = await serve([msg('b@x.test', 'Скидання')]);
    const r = await findMail({
      api,
      match: toWithSubject('a@x.test', 'Скидання'),
      timeout: 400,
    });
    expect(r).toEqual({ mail: null, error: null });
  });

  it('мережевий збій — не виняток, а error з причиною', async () => {
    const r = await findMail({
      api: 'http://127.0.0.1:1',
      match: () => true,
      timeout: 400,
    });
    expect(r.mail).toBeNull();
    expect(r.error).toMatch(/Mailpit недоступний/);
  });
});
