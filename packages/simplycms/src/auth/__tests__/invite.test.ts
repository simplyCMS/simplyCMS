import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderInviteEmail } from '../invite-email';
import type { InviteEmail } from '../invite-email';
import {
  inviteIdentifier,
  issueOwnerInvite,
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
  let nextId = 1;

  const store: OwnerInviteStore = {
    findUserIdByEmail: async (email) => usersByEmail.get(email) ?? null,
    createUser: async ({ email }) => {
      const id = `u-${nextId++}`;
      usersByEmail.set(email, id);
      return id;
    },
    storeToken: async ({ identifier, valueHash, expiresAt }) => {
      tokens.set(identifier, { valueHash, expiresAt });
    },
    consumeToken: async (identifier) => {
      const row = tokens.get(identifier) ?? null;
      tokens.delete(identifier);
      return row;
    },
    grantAdminRole: async (userId) => {
      adminRoles.add(userId);
    },
  };

  return { store, usersByEmail, tokens, adminRoles };
}

const NOW = new Date('2026-08-23T10:00:00Z');
const SITE = 'https://shop.example/';

describe('issueOwnerInvite', () => {
  let fake: ReturnType<typeof createFakeStore>;
  const sent: InviteEmail[] = [];
  const sendEmail = async (message: InviteEmail) => {
    sent.push(message);
  };

  beforeEach(() => {
    fake = createFakeStore();
    sent.length = 0;
  });

  it('створює користувача, закріплює admin і шле лист із токеном', async () => {
    const result = await issueOwnerInvite({
      store: fake.store,
      sendEmail,
      email: 'Owner@Example.Test',
      siteUrl: SITE,
      now: NOW,
      token: 'tok-abc',
    });

    expect(result.created).toBe(true);
    // Пошта нормалізується в нижній регістр — інакше `Owner@` і `owner@`
    // дали б двох різних власників.
    expect(fake.usersByEmail.has('owner@example.test')).toBe(true);
    expect(fake.adminRoles.has(result.userId)).toBe(true);
    expect(result.url).toBe(
      'https://shop.example/auth/invite?email=owner%40example.test&token=tok-abc',
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain(result.url);
  });

  it('у БД лягає ХЕШ, а не сам токен', async () => {
    await issueOwnerInvite({
      store: fake.store,
      sendEmail,
      email: 'owner@example.test',
      siteUrl: SITE,
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
      sendEmail,
      email: 'owner@example.test',
      siteUrl: SITE,
      now: NOW,
      token: 'tok-1',
    });
    const second = await issueOwnerInvite({
      store: fake.store,
      sendEmail,
      email: 'owner@example.test',
      siteUrl: SITE,
      now: NOW,
      token: 'tok-2',
    });

    expect(second.userId).toBe(first.userId);
    expect(second.created).toBe(false);
    expect(fake.usersByEmail.size).toBe(1);
    expect(fake.adminRoles.size).toBe(1);
  });
});

describe('verifyOwnerInvite', () => {
  const sendEmail = async () => {};

  const issued = async (token: string, ttlMs?: number) => {
    const fake = createFakeStore();
    await issueOwnerInvite({
      store: fake.store,
      sendEmail,
      email: 'owner@example.test',
      siteUrl: SITE,
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

describe('renderInviteEmail', () => {
  it('посилання ціле, TTL у годинах, HTML екранований', () => {
    const email = renderInviteEmail({
      to: 'owner@example.test',
      url: 'https://shop.example/auth/invite?email=a&token=b',
      storeName: 'Магазин "Сонце" <тест>',
      ttlMs: 24 * 3_600_000,
    });

    expect(email.to).toBe('owner@example.test');
    expect(email.subject).toContain('Магазин "Сонце" <тест>');
    expect(email.text).toContain(
      'https://shop.example/auth/invite?email=a&token=b',
    );
    expect(email.text).toContain('24 год');
    // 🔴 Ім'я магазину — вільний рядок із конфігу; неекранований він розʼїхав
    // би розмітку листа, а в поштовому клієнті це виглядало б як «лист битий».
    expect(email.html).toContain('&quot;Сонце&quot;');
    expect(email.html).toContain('&lt;тест&gt;');
    expect(email.html).not.toContain('<тест>');
  });
});
