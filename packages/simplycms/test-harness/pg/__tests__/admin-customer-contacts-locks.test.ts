// К3-Е6г, Task 6 + хвиля фінального рев'ю (Е6г-1, Е6г-22): контакти покупця —
// гонка 23505, лок customer-category, дедлок-клас, customer_not_found. Гонка `23505` доводиться детерміновано: незакомічений insert з окремого
// клієнта тримає унікальний індекс, тож перевірка «зайнято» його не бачить.
import pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import * as H from '../apply.mjs';
import { holdAdvisoryLock, stillPending } from './fixtures/advisory-lock';
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

describe('admin: контакти покупця — локи й гонки (Е6г-1/22)', () => {
  const db = F.useCustomersDb('simplycms_admin_contacts_locks');
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
  const { user } = C.contactHelpers(url);

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
      setStatus.mockClear();
      const op = call(id, { email: 'race@x.test' });
      op.catch(() => {});
      expect(await stillPending(op, 400)).toBe(true);
      await rival.query('commit');
      await expect(op).rejects.toMatchObject(taken);
      expect(setStatus).toHaveBeenLastCalledWith(400);
    } finally {
      await rival.query('rollback').catch(() => {});
      await rival.end();
    }
    expect((await user(id)).email).toBe('before@x.test');
  });

  it('неіснуючий покупець → customer_not_found', async () => {
    await expect(
      call('00000000-0000-4000-8000-0000000000aa'),
    ).rejects.toMatchObject(F.conflict('state', 'customer_not_found'));
  });

  it('стоїть, поки зовнішній тримає customer-category:<id>; після release завершується', async () => {
    const id = await F.seedCustomer(url(), { email: 'lock@x.test' });
    const lock = await holdAdvisoryLock(url(), `customer-category:${id}`);
    try {
      const op = call(id, { email: 'lock2@x.test' });
      op.catch(() => {});
      expect(await stillPending(op, 400)).toBe(true);
      expect((await user(id)).email).toBe('lock@x.test');
      await lock.release();
      await expect(op).resolves.toEqual({ email: 'lock2@x.test' });
    } finally {
      await lock.cleanup();
    }
  });

  it('клас дедлоку: конкурент тримає profiles FOR UPDATE + insert історії → операція чекає на advisory-лок, не 40P01', async () => {
    const id = await F.seedCustomer(url(), { email: 'dl@x.test' });
    const rival = new pg.Client({
      connectionString: H.withUser(url(), 'app_runtime'),
    });
    await rival.connect();
    try {
      await rival.query('begin');
      await rival.query('set local role app_admin');
      // Як applyCategoryRules: лок категорії, профіль, потім історія (KEY SHARE на users).
      await rival.query(
        `select pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`customer-category:${id}`],
      );
      await rival.query(
        `select 1 from public.profiles where user_id = $1 for update`,
        [id],
      );
      await rival.query(
        `insert into public.user_category_history (id, user_id, to_category_name)
         values ($1, $2, 'Тест')`,
        [crypto.randomUUID(), id],
      );
      const op = call(id, { email: 'dl2@x.test' });
      op.catch(() => {});
      expect(await stillPending(op, 400)).toBe(true);
      const waiting = await F.rows(
        url(),
        `select locktype from pg_locks where not granted and locktype = 'advisory'`,
      );
      expect(waiting).toHaveLength(1);
      await rival.query('commit');
      await expect(op).resolves.toEqual({ email: 'dl2@x.test' });
    } finally {
      await rival.query('rollback').catch(() => {});
      await rival.end();
    }
  });
});
