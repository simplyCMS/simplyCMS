import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MailItem, MailMessage } from 'simplycms/mail';
import {
  inviteIdentifier,
  issueOwnerInvite,
  OwnerInviteError,
  verifyOwnerInvite,
  type OwnerInviteStore,
} from '../invite';

// Invite власника (Task 7, В2-К1а) — заміна механіки `inviteUserByEmail`.
//
// 🔴 Доводиться все, крім SMTP: транспорт у цьому оточенні недосяжний і
// лишається боргом. Саме тому лист — чиста функція, а доставка — колбек.

interface TokenRow {
  valueHash: string;
  expiresAt: Date;
}

/** Фейкове сховище: рівно те, що описує порт, і ЖОДНОГО Postgres. */
function createFakeStore() {
  const usersByEmail = new Map<string, string>();
  const tokens = new Map<string, TokenRow>();
  const adminRoles = new Set<string>();
  const banned = new Set<string>();
  const verified = new Set<string>();
  let nextId = 1;

  const store: OwnerInviteStore = {
    findUserIdByEmail: async (email) => usersByEmail.get(email) ?? null,
    createUser: async ({ email }) => {
      const id = `u-${nextId++}`;
      usersByEmail.set(email, id);
      return id;
    },
    // Р19: випуск лишає лише токен; на бані не лягає нічого.
    issueAdminInvite: async ({ identifier, userId, valueHash, expiresAt }) => {
      if (banned.has(userId)) return 'banned';
      tokens.set(identifier, { valueHash, expiresAt });
      return 'issued';
    },
    grantAdminRole: async ({ userId }) => {
      if (banned.has(userId)) return 'banned';
      adminRoles.add(userId);
      return 'granted';
    },
    isEmailVerified: async (userId) => verified.has(userId),
    consumeToken: async (identifier) => {
      const row = tokens.get(identifier) ?? null;
      tokens.delete(identifier);
      return row;
    },
  };

  return { store, usersByEmail, tokens, adminRoles, banned, verified };
}

const NOW = new Date('2026-08-23T10:00:00Z');
const ENV = { VITE_SITE_URL: 'https://shop.example/' };

describe('issueOwnerInvite', () => {
  let fake: ReturnType<typeof createFakeStore>;
  const sent: MailMessage[] = [];
  const schedule = async (items: readonly MailItem[]) => {
    sent.push(...items.map((item) => item.message));
    return items.map((_, i) => `mail-${i}`);
  };

  beforeEach(() => {
    fake = createFakeStore();
    sent.length = 0;
  });

  it('створює користувача й шле лист із токеном; ролі admin від випуску немає', async () => {
    const result = await issueOwnerInvite({
      store: fake.store,
      schedule,
      email: 'Owner@Example.Test',
      env: ENV,
      now: NOW,
      token: 'tok-abc',
    });

    expect(result.created).toBe(true);
    // Пошта нормалізується в нижній регістр — інакше `Owner@` і `owner@`
    // дали б двох різних власників.
    expect(fake.usersByEmail.has('owner@example.test')).toBe(true);
    // Р19: роль видає лише прийняття запрошення.
    expect(fake.adminRoles.size).toBe(0);
    expect(result.existingUnverified).toBe(false);
    expect(result.url).toBe(
      'https://shop.example/auth/invite?email=owner%40example.test&token=tok-abc',
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain(result.url);
  });

  it('у БД лягає ХЕШ, а не сам токен', async () => {
    await issueOwnerInvite({
      store: fake.store,
      schedule,
      email: 'owner@example.test',
      env: ENV,
      now: NOW,
      token: 'tok-abc',
    });

    const row = fake.tokens.get(inviteIdentifier('owner@example.test'));
    expect(row?.valueHash).toBe(
      createHash('sha256').update('tok-abc').digest('hex'),
    );
    expect(row?.valueHash).not.toContain('tok-abc');
  });

  it('повторний invite наявного користувача НЕ дублює його', async () => {
    const first = await issueOwnerInvite({
      store: fake.store,
      schedule,
      email: 'owner@example.test',
      env: ENV,
      now: NOW,
      token: 'tok-1',
    });
    const second = await issueOwnerInvite({
      store: fake.store,
      schedule,
      email: 'owner@example.test',
      env: ENV,
      now: NOW,
      token: 'tok-2',
    });

    expect(second.userId).toBe(first.userId);
    expect(second.created).toBe(false);
    expect(fake.usersByEmail.size).toBe(1);
    expect(fake.adminRoles.size).toBe(0);
  });

  it('existingUnverified: лише для наявного непідтвердженого акаунта', async () => {
    const run = (token: string) =>
      issueOwnerInvite({
        store: fake.store,
        schedule,
        email: 'owner@example.test',
        env: ENV,
        now: NOW,
        token,
      });
    expect((await run('tok-1')).existingUnverified).toBe(false); // новий
    expect((await run('tok-2')).existingUnverified).toBe(true); // наявний, не підтверджений
    fake.verified.add(fake.usersByEmail.get('owner@example.test')!);
    expect((await run('tok-3')).existingUnverified).toBe(false); // підтверджений
  });
});

describe('issueOwnerInvite: забанений (Е6г-19)', () => {
  it('відмова OwnerInviteError(banned): URL немає, листа немає, ролі й токена немає', async () => {
    const fake = createFakeStore();
    const sent: MailMessage[] = [];
    const schedule = async (items: readonly MailItem[]) => {
      sent.push(...items.map((item) => item.message));
      return [];
    };
    const first = await issueOwnerInvite({
      store: fake.store,
      schedule,
      email: 'owner@example.test',
      env: ENV,
      now: NOW,
      token: 'tok-1',
    });
    // Свіжий стан: роль і токен прибираємо, бан ставимо.
    fake.adminRoles.clear();
    fake.tokens.clear();
    fake.banned.add(first.userId);
    sent.length = 0;

    const attempt = issueOwnerInvite({
      store: fake.store,
      schedule,
      email: 'owner@example.test',
      env: ENV,
      now: NOW,
      token: 'tok-2',
    });

    await expect(attempt).rejects.toBeInstanceOf(OwnerInviteError);
    await expect(attempt).rejects.toMatchObject({ code: 'banned' });
    expect(sent).toHaveLength(0);
    expect(fake.adminRoles.size).toBe(0);
    expect(fake.tokens.size).toBe(0);
  });
});

describe('verifyOwnerInvite', () => {
  const schedule = async () => [];

  const issued = async (token: string, ttlMs?: number) => {
    const fake = createFakeStore();
    await issueOwnerInvite({
      store: fake.store,
      schedule,
      email: 'owner@example.test',
      env: ENV,
      now: NOW,
      token,
      ttlMs,
    });
    return fake;
  };

  it('правильний токен приймається один раз — другий уже ні', async () => {
    const fake = await issued('tok-ok');
    const args = {
      store: fake.store,
      email: 'owner@example.test',
      token: 'tok-ok',
      now: NOW,
    };

    expect(await verifyOwnerInvite(args)).toEqual({
      ok: true,
      userId: 'u-1',
    });
    expect(await verifyOwnerInvite(args)).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('чужий токен — mismatch, протермінований — expired', async () => {
    const wrong = await issued('tok-ok');
    expect(
      await verifyOwnerInvite({
        store: wrong.store,
        email: 'owner@example.test',
        token: 'tok-інший',
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: 'mismatch' });

    const stale = await issued('tok-ok', 3_600_000);
    expect(
      await verifyOwnerInvite({
        store: stale.store,
        email: 'owner@example.test',
        token: 'tok-ok',
        now: new Date(NOW.getTime() + 2 * 3_600_000),
      }),
    ).toEqual({ ok: false, reason: 'expired' });
  });
});
