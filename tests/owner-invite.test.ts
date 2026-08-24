import { describe, expect, it } from 'vitest';
import { inviteIdentifier, verifyOwnerInvite } from 'simplycms/auth';
import type { OwnerInviteStore } from 'simplycms/auth';
import { runOwnerInvite } from '../packages/create-simplycms-store/template/scripts/owner-invite-core.mjs';

// Юніт скрипта `owner:invite` із шаблону магазину.
//
// 🔴 Мока Supabase тут більше немає: скрипт більше не кличе GoTrue, а
// перевикористовує `issueOwnerInvite` ядра. Підмінюється тому не клієнт, а
// ПОРТ сховища — тобто тест ганяє справжній механізм запрошення, лише без
// Postgres. Що той самий механізм працює й на живій БД, доводить
// `packages/simplycms/test-harness/pg/__tests__/owner-invite-flow.test.ts`.

const EMAIL = 'owner@example.com';
const SITE = 'https://shop.test';

/** Сховище в памʼяті з тією ж семантикою, що й `ownerInviteStore`. */
function makeStore() {
  const users = new Map<string, string>();
  const tokens = new Map<string, { valueHash: string; expiresAt: Date }>();
  const roles: { userId: string; role: string }[] = [];
  let nextId = 1;

  const store: OwnerInviteStore = {
    findUserIdByEmail: async (email) => users.get(email.toLowerCase()) ?? null,
    createUser: async ({ email }) => {
      const id = `user-${nextId++}`;
      users.set(email.toLowerCase(), id);
      return id;
    },
    storeToken: async ({ identifier, valueHash, expiresAt }) => {
      // Перевипуск гасить попередній токен — та сама семантика, що в БД.
      tokens.set(identifier, { valueHash, expiresAt });
    },
    consumeToken: async (identifier) => {
      const record = tokens.get(identifier) ?? null;
      tokens.delete(identifier);
      return record;
    },
    grantAdminRole: async (userId) => {
      if (!roles.some((row) => row.userId === userId && row.role === 'admin')) {
        roles.push({ userId, role: 'admin' });
      }
    },
  };

  return { store, users, tokens, roles };
}

/** Прогін скрипта зі збором того, що він надрукував. */
async function run(store: OwnerInviteStore) {
  const lines: string[] = [];
  const result = await runOwnerInvite({
    email: EMAIL,
    siteUrl: SITE,
    store,
    log: (message: string) => lines.push(message),
  });
  return { result, output: lines.join('\n') };
}

describe('owner-invite (скрипт шаблону)', () => {
  it('новий email: користувач, роль admin і надруковане посилання', async () => {
    const { store, users, roles } = makeStore();

    const { result, output } = await run(store);

    expect(result.created).toBe(true);
    expect(users.size).toBe(1);
    expect(roles).toEqual([{ userId: result.userId, role: 'admin' }]);
    expect(result.url.startsWith(`${SITE}/auth/invite?email=`)).toBe(true);
    // 🔴 Друк посилання — і є доставка: SMTP немає, тож мовчазний прогін
    // залишив би власника без єдиного шляху до адмінки.
    expect(output).toContain(result.url);
    expect(output).toContain('SMTP');
  });

  it('надруковане посилання справді проходить перевірку', async () => {
    const { store } = makeStore();

    const { result } = await run(store);
    const token = new URL(result.url).searchParams.get('token')!;

    expect(await verifyOwnerInvite({ store, email: EMAIL, token })).toEqual({
      ok: true,
      userId: result.userId,
    });
  });

  it('повторний прогін ідемпотентний: той самий користувач, одна роль', async () => {
    const { store, users, roles } = makeStore();

    const first = await run(store);
    const second = await run(store);

    expect(second.result.created).toBe(false);
    expect(second.result.userId).toBe(first.result.userId);
    expect(users.size).toBe(1);
    expect(roles).toHaveLength(1);
  });

  it('перевипуск гасить попереднє посилання', async () => {
    const { store, tokens } = makeStore();

    const first = await run(store);
    const staleToken = new URL(first.result.url).searchParams.get('token')!;
    await run(store);

    // В обігу лишається рівно один токен — інакше в пошті власника жили б
    // два дійсні ключі до адмінки.
    expect(tokens.size).toBe(1);
    expect(tokens.has(inviteIdentifier(EMAIL))).toBe(true);
    expect(
      await verifyOwnerInvite({ store, email: EMAIL, token: staleToken }),
    ).toEqual({ ok: false, reason: 'mismatch' });
  });
});
