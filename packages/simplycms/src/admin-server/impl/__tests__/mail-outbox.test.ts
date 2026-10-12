// Е8-Р9: картка хвостів пошти — лише `settings.manage`. Реальний `requireGrant`
// (авторизація не мокається): підмінено лише сесію й зʼєднання з БД.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  subject: null as null | { userId: string; roles: string[] },
}));
const mail = vi.hoisted(() => ({
  retryMail: vi.fn(async () => ({ sent: 0, failed: 0 })),
  listMailOutbox: vi.fn(async () => []),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => ({ headers: new Headers() }),
  setResponseStatus: vi.fn(),
}));
vi.mock('../../../auth/session', () => ({
  readSessionSubject: async () => session.subject,
}));
vi.mock('simplycms/db', () => ({
  withActor: vi.fn(async (_a: unknown, fn: (db: unknown) => unknown) => fn({})),
}));
vi.mock('simplycms/mail', () => mail);

import { listMailOutboxOp, retryMailOutboxOp } from '../mail-outbox/outbox';

describe('операції хвостів пошти: право settings.manage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.subject = { userId: 'u1', roles: ['user'] };
  });

  it('користувач без settings.manage → AuthzError, до outbox не доходить', async () => {
    await expect(listMailOutboxOp()).rejects.toMatchObject({
      name: 'AuthzError',
    });
    await expect(retryMailOutboxOp()).rejects.toMatchObject({
      name: 'AuthzError',
    });
    expect(mail.listMailOutbox).not.toHaveBeenCalled();
    expect(mail.retryMail).not.toHaveBeenCalled();
  });

  it('анонім → AuthzError', async () => {
    session.subject = null;
    await expect(retryMailOutboxOp()).rejects.toMatchObject({
      name: 'AuthzError',
    });
  });

  it('адмін → читання й повтор виконуються', async () => {
    session.subject = { userId: 'a1', roles: ['admin'] };
    await expect(listMailOutboxOp()).resolves.toEqual([]);
    await expect(retryMailOutboxOp()).resolves.toEqual({
      sent: 0,
      failed: 0,
    });
    expect(mail.retryMail).toHaveBeenCalledTimes(1);
  });
});
