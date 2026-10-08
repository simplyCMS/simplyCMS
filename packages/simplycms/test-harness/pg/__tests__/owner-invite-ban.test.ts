// К3-Е6г, Task 4 (Е6г-19): invite власника під `admin-roles` з перевіркою бану.
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { inviteIdentifier, ownerInviteStore } from 'simplycms/auth';
import { withUser } from '../apply.mjs';
import { holdAdvisoryLock, stillPending } from './fixtures/advisory-lock';
import * as F from './fixtures/customer-categories';

describe('invite власника: бан і лок (Е6г-19)', () => {
  const db = F.useCustomersDb('simplycms_owner_invite_ban');
  const url = () => db.url();
  const email = () => `owner-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const hash = 'a'.repeat(64);
  const issue = (userId: string, address: string) =>
    ownerInviteStore.issueAdminInvite({
      userId,
      identifier: inviteIdentifier(address),
      valueHash: hash,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
  const state = async (userId: string, address: string) => ({
    roles: (
      await F.rows(
        url(),
        `select role::text from public.user_roles where user_id = $1`,
        [userId],
      )
    ).map((r) => r.role),
    tokens: (
      await F.rows(
        url(),
        `select 1 from public.verifications where identifier = $1`,
        [inviteIdentifier(address)],
      )
    ).length,
  });

  it('незабаненому: роль admin і токен є; повтор перевипускає токен без дубля ролі', async () => {
    const address = email();
    const id = await F.seedCustomer(url(), { email: address });
    await expect(issue(id, address)).resolves.toBe('issued');
    await expect(issue(id, address)).resolves.toBe('issued');
    expect(await state(id, address)).toEqual({ roles: ['admin'], tokens: 1 });
  });

  it('забаненому: відмова banned, ні ролі, ні рядка owner-invite:<email>', async () => {
    const address = email();
    const id = await F.seedCustomer(url(), { email: address });
    await F.rows(
      url(),
      `update public.users set banned_at = now() where id = $1`,
      [id],
    );
    await expect(issue(id, address)).resolves.toBe('banned');
    expect(await state(id, address)).toEqual({ roles: [], tokens: 0 });
  });

  it('стоїть, поки зовнішній тримає admin-roles; після release завершується', async () => {
    const address = email();
    const id = await F.seedCustomer(url(), { email: address });
    const lock = await holdAdvisoryLock(url(), 'admin-roles');
    try {
      const op = issue(id, address);
      op.catch(() => {});
      expect(await stillPending(op, 300)).toBe(true);
      expect(await state(id, address)).toEqual({ roles: [], tokens: 0 });
      await lock.release();
      await expect(op).resolves.toBe('issued');
    } finally {
      await lock.cleanup();
    }
  });

  it('бан ↔ invite: бан під admin-roles без коміту → invite чекає → commit → banned, ролі немає', async () => {
    // КАНОН: лок `admin-roles` потрібен для ЗВОРОТНОГО порядку «invite
    // першим». Invite взяв `FOR SHARE` і вставив роль без коміту; бан без
    // лока не бачить незакоміченої ролі, чекає на рядку `users`, а після
    // коміту забанює вже адміна. `FOR SHARE` цього не закриває, тож лок не
    // «зайвий». Тут перевіряється порядок «бан першим»: конкурентний
    // `UPDATE users` сам блокує `FOR SHARE`, тож цей кейс мутацію «прибрати
    // лок з invite» НЕ ловить — її ловить кейс вище (зовнішній лок).
    const address = email();
    const id = await F.seedCustomer(url(), { email: address });
    const banner = new pg.Client({
      connectionString: withUser(url(), 'app_runtime'),
    });
    await banner.connect();
    try {
      await banner.query('begin');
      await banner.query('set local role app_admin');
      await banner.query(
        `select pg_advisory_xact_lock(hashtextextended('admin-roles', 0))`,
      );
      await banner.query(
        `update public.users set banned_at = now() where id = $1`,
        [id],
      );
      const op = issue(id, address);
      op.catch(() => {});
      expect(await stillPending(op, 300)).toBe(true);
      await banner.query('commit');
      await expect(op).resolves.toBe('banned');
      expect(await state(id, address)).toEqual({ roles: [], tokens: 0 });
    } finally {
      await banner.query('rollback').catch(() => {});
      await banner.end();
    }
  });
});
