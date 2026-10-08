// К3-Е6г, Task 6 (Е6г-1, Е6г-2, Review Focus 1): контакти й email покупця.
// Гонка `23505` доводиться детерміновано: незакомічений insert з окремого
// клієнта тримає унікальний індекс, тож перевірка «зайнято» його не бачить.
import pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import * as H from '../apply.mjs';
import { stillPending } from './fixtures/advisory-lock';
import * as C from './fixtures/customer-contacts';
import * as F from './fixtures/customer-categories';

const setStatus = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-start/server', () => ({
  setResponseStatus: setStatus,
}));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: F.ADMIN_ID, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { updateCustomerContactsOp } from 'simplycms/admin-server/impl';

describe('admin: контакти й email покупця (Е6г-1/2)', () => {
  const db = F.useCustomersDb('simplycms_admin_contacts');
  const url = () => db.url();
  const taken = {
    name: 'ValidationError',
    issues: [{ path: ['email'], code: 'taken' }],
  };
  const call = (userId: string, over: Record<string, unknown> = {}) =>
    updateCustomerContactsOp({
      data: {
        userId,
        firstName: 'Іван',
        lastName: 'Петренко',
        phone: '+380501112233',
        email: 'buyer@x.test',
        ...over,
      },
    });
  const { user, profile, token, identifiers } = C.contactHelpers(url);

  it('контакти без зміни email: профіль і users.name, email не скинуто', async () => {
    const id = await F.seedCustomer(url(), { email: 'buyer@x.test' });
    await expect(call(id)).resolves.toEqual({ email: 'buyer@x.test' });
    expect(await profile(id)).toEqual({
      first_name: 'Іван',
      last_name: 'Петренко',
      phone: '+380501112233',
      email: 'buyer@x.test',
    });
    expect(await user(id)).toMatchObject({
      name: 'Іван Петренко',
      email_verified: true,
    });
  });

  it('зміна email: нижній регістр, непідтверджений, сесії на місці, токени цього покупця видалено', async () => {
    const id = await F.seedCustomer(url(), { email: 'old@x.test' });
    const other = await F.seedCustomer(url());
    await F.rows(
      url(),
      `insert into public.sessions (id, user_id, token, expires_at)
       values ($1, $2, $3, now() + interval '1 day')`,
      [crypto.randomUUID(), id, crypto.randomUUID()],
    );
    await token('reset-password:mine', id);
    await token('reset-password:foreign', other);
    await token('owner-invite:old@x.test', 'hash');
    await expect(call(id, { email: ' New@X.test ' })).resolves.toEqual({
      email: 'new@x.test',
    });
    expect(await user(id)).toMatchObject({
      email: 'new@x.test',
      email_verified: false,
    });
    expect((await profile(id)).email).toBe('new@x.test');
    const ids = await identifiers();
    expect(ids).not.toContain('reset-password:mine');
    expect(ids).not.toContain('owner-invite:old@x.test');
    expect(ids).toContain('reset-password:foreign');
    expect(
      await F.rows(url(), `select 1 from public.sessions where user_id = $1`, [
        id,
      ]),
    ).toHaveLength(1);
  });

  it('власний email в іншому регістрі — не конфлікт, записано нижній', async () => {
    const id = await F.seedCustomer(url(), { email: 'same@x.test' });
    await call(id, { email: 'Same@X.test' });
    expect((await user(id)).email).toBe('same@x.test');
  });

  it('зайнятий Buyer@Shop.test при buyer@shop.test → taken/400, у БД нічого не змінилось', async () => {
    await F.seedCustomer(url(), { email: 'buyer@shop.test' });
    const id = await F.seedCustomer(url(), { email: 'mine@x.test' });
    await token('reset-password:keep', id);
    setStatus.mockClear();
    await expect(
      call(id, { email: 'Buyer@Shop.test', firstName: 'Інший' }),
    ).rejects.toMatchObject(taken);
    expect(setStatus).toHaveBeenCalledWith(400);
    expect(await user(id)).toMatchObject({
      email: 'mine@x.test',
      email_verified: true,
    });
    expect((await profile(id)).first_name).not.toBe('Інший');
    expect(await identifiers()).toContain('reset-password:keep');
  });

  it('гонка 23505: незакомічений insert з тим самим email → після commit taken, email старий', async () => {
    const id = await F.seedCustomer(url(), { email: 'before@x.test' });
    const rival = new pg.Client({
      connectionString: H.withUser(url(), 'app_runtime'),
    });
    await rival.connect();
    try {
      await rival.query('begin');
      await rival.query('set local role app_admin');
      await rival.query(
        `insert into public.users (id, name, email) values ($1, 'Гонщик', 'race@x.test')`,
        [crypto.randomUUID()],
      );
      const op = call(id, { email: 'race@x.test' });
      op.catch(() => {});
      expect(await stillPending(op, 400)).toBe(true);
      await rival.query('commit');
      await expect(op).rejects.toMatchObject(taken);
    } finally {
      await rival.query('rollback').catch(() => {});
      await rival.end();
    }
    expect((await user(id)).email).toBe('before@x.test');
  });
});
