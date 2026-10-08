// К3-Е6г, Task 6 (Е6г-1, Е6г-2, Review Focus 1): контакти й email покупця.
// Гонка `23505` доводиться детерміновано: незакомічений insert з окремого
// клієнта тримає унікальний індекс, тож перевірка «зайнято» його не бачить.
import { describe, expect, it, vi } from 'vitest';
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
    expect(await user(id)).toMatchObject({
      email: 'same@x.test',
      email_verified: true,
    });
  });

  it('збережений email у змішаному регістрі — переписано в нижній БЕЗ скидання підтвердження й токенів', async () => {
    const id = await F.seedCustomer(url(), { email: 'Mixed@X.test' });
    await token('owner-invite:mixed@x.test', 'hash');
    await call(id, { email: 'mixed@x.test' });
    expect(await user(id)).toMatchObject({
      email: 'mixed@x.test',
      email_verified: true,
    });
    expect((await profile(id)).email).toBe('mixed@x.test');
    expect(await identifiers()).toContain('owner-invite:mixed@x.test');
  });

  it('профілю немає → створюється з контактами й непорожнім id', async () => {
    const id = await F.seedCustomer(url(), { email: 'noprof@x.test' });
    await F.rows(url(), `delete from public.profiles where user_id = $1`, [id]);
    await call(id, { email: 'noprof@x.test' });
    const rows = await F.rows(
      url(),
      `select id, first_name, last_name, phone, email from public.profiles where user_id = $1`,
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      first_name: 'Іван',
      last_name: 'Петренко',
      phone: '+380501112233',
      email: 'noprof@x.test',
    });
    expect(rows[0]!.id).toBeTruthy();
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
});
