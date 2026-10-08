// К3-Е6г, Task 5 (Е6г-14): тригер `sessions_refuse_banned` у ОБОХ порядках
// гонки «вставка сесії ↔ бан». Клієнти — окремі `pg.Client` як `app_runtime`,
// після `begin` — `set local role app_admin` (роль `nologin`), тобто той самий
// шлях, що в drizzle-proxy. Детерміновано: `stillPending`, не `Promise.all`.
import pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { stillPending } from './fixtures/advisory-lock';
import * as F from './fixtures/customer-categories';
import * as H from '../apply.mjs';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: F.ADMIN_ID, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { setCustomerBanOp } from 'simplycms/admin-server/impl';

describe('тригер sessions_refuse_banned (Е6г-14)', () => {
  const db = F.useCustomersDb('simplycms_ban_trigger');
  const url = () => db.url();

  /** Клієнт у відкритій транзакції під `app_admin`. */
  const open = async () => {
    const c = new pg.Client({
      connectionString: H.withUser(url(), 'app_runtime'),
    });
    await c.connect();
    await c.query('begin');
    await c.query('set local role app_admin');
    return c;
  };
  const insertSession = (c: pg.Client, userId: string) =>
    c.query(
      `insert into public.sessions (id, user_id, token, expires_at)
       values ($1, $2, $3, now() + interval '1 day')`,
      [crypto.randomUUID(), userId, crypto.randomUUID()],
    );
  const sessions = async (userId: string) =>
    Number(
      (
        await F.rows(
          url(),
          `select count(*) as n from public.sessions where user_id = $1`,
          [userId],
        )
      )[0]!.n,
    );

  it('(1) бан не закомічений → вставка чекає, після commit падає, сесій 0', async () => {
    const id = await F.seedCustomer(url());
    const b = await open();
    const a = await open();
    try {
      await b.query(`update public.users set banned_at = now() where id = $1`, [
        id,
      ]);
      const insert = insertSession(a, id);
      insert.catch(() => {});
      expect(await stillPending(insert, 300)).toBe(true);
      await b.query('commit');
      await expect(insert).rejects.toThrow(/is banned/);
      expect(await sessions(id)).toBe(0);
    } finally {
      await a.query('rollback').catch(() => {});
      await b.query('rollback').catch(() => {});
      await a.end();
      await b.end();
    }
  });

  it('(2) вставка не закомічена → бан чекає, після commit сесію видалено', async () => {
    const id = await F.seedCustomer(url());
    const a = await open();
    try {
      await insertSession(a, id);
      const op = setCustomerBanOp({ data: { userId: id, banned: true } });
      op.catch(() => {});
      expect(await stillPending(op, 300)).toBe(true);
      await a.query('commit');
      await expect(op).resolves.toMatchObject({ bannedAt: expect.any(Date) });
      expect(await sessions(id)).toBe(0);
    } finally {
      await a.query('rollback').catch(() => {});
      await a.end();
    }
  });

  it('незабаненому вставка проходить', async () => {
    const id = await F.seedCustomer(url());
    const a = await open();
    try {
      await insertSession(a, id);
      await a.query('commit');
      expect(await sessions(id)).toBe(1);
    } finally {
      await a.end();
    }
  });
});
