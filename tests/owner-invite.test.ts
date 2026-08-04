import { describe, expect, it, vi } from 'vitest';
import { runOwnerInvite } from '../packages/create-simplycms-store/template/scripts/owner-invite-core.mjs';

const makeAdmin = ({
  inviteError = null as { code: string; status: number } | null,
  users = [] as { id: string; email: string }[],
} = {}) => {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const generateLink = vi.fn().mockResolvedValue({
    data: { properties: { hashed_token: 'hash123' } },
    error: null,
  });
  return {
    client: {
      auth: {
        admin: {
          inviteUserByEmail: vi
            .fn()
            .mockResolvedValue(
              inviteError
                ? { data: { user: null }, error: inviteError }
                : { data: { user: { id: 'new-id' } }, error: null },
            ),
          // nextPage: null — одна сторінка (тест на кілька сторінок нижче)
          listUsers: vi.fn().mockResolvedValue({
            data: { users, nextPage: null },
            error: null,
          }),
          generateLink,
        },
      },
      from: vi.fn().mockReturnValue({ upsert }),
    },
    upsert,
    generateLink,
  };
};

describe('owner-invite', () => {
  it('новий email: invite (без options) + роль admin', async () => {
    const { client, upsert } = makeAdmin();
    const result = await runOwnerInvite({
      admin: client,
      email: 'o@x.com',
      siteUrl: 'https://s',
      log: () => {},
    });
    expect(result).toMatchObject({
      userId: 'new-id',
      invited: true,
      roleAdded: true,
    });
    expect(client.auth.admin.inviteUserByEmail).toHaveBeenCalledWith('o@x.com');
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'new-id', role: 'admin' },
      { onConflict: 'user_id,role', ignoreDuplicates: true },
    );
  });

  it('email існує: знаходить id через listUsers і дописує роль', async () => {
    const { client } = makeAdmin({
      inviteError: { code: 'email_exists', status: 422 },
      users: [{ id: 'old-id', email: 'o@x.com' }],
    });
    const result = await runOwnerInvite({
      admin: client,
      email: 'o@x.com',
      siteUrl: 'https://s',
      log: () => {},
    });
    expect(result).toMatchObject({
      userId: 'old-id',
      invited: false,
      roleAdded: true,
    });
  });

  it('email існує + --resend: генерує одноразовий confirm-лінк', async () => {
    const { client, generateLink } = makeAdmin({
      inviteError: { code: 'email_exists', status: 422 },
      users: [{ id: 'old-id', email: 'o@x.com' }],
    });
    const result = await runOwnerInvite({
      admin: client,
      email: 'o@x.com',
      siteUrl: 'https://s/',
      resend: true,
      log: () => {},
    });
    expect(generateLink).toHaveBeenCalledWith({
      type: 'magiclink',
      email: 'o@x.com',
    });
    expect(result.resendLink).toBe(
      'https://s/auth/confirm?token_hash=hash123&type=magiclink&next=/auth/set-password',
    );
  });

  it('інший 422 (validation_failed) — кидає, а не маскує під email_exists', async () => {
    const { client } = makeAdmin({
      inviteError: { code: 'validation_failed', status: 422 },
    });
    await expect(
      runOwnerInvite({
        admin: client,
        email: 'bad',
        siteUrl: 'https://s',
        log: () => {},
      }),
      // 🔴 Матчер обовʼязковий: без гарда `code !== 'email_exists'` код пішов
      // би гілкою «вже існує» і впав уже в `findUserIdByEmail` («не знайдено»)
      // — голий `.toThrow()` прийняв би цю помилку за очікувану й лишився б
      // зеленим під мутацією «будь-який 422 = вже існує».
    ).rejects.toThrow(/inviteUserByEmail: /);
  });

  it('пагінація listUsers: іде за nextPage до знахідки', async () => {
    const { client } = makeAdmin({
      inviteError: { code: 'email_exists', status: 422 },
    });
    client.auth.admin.listUsers = vi
      .fn()
      .mockResolvedValueOnce({
        data: { users: [{ id: 'a', email: 'a@x.com' }], nextPage: 2 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { users: [{ id: 'old-id', email: 'o@x.com' }], nextPage: null },
        error: null,
      });
    const result = await runOwnerInvite({
      admin: client,
      email: 'o@x.com',
      siteUrl: 'https://s',
      log: () => {},
    });
    expect(result.userId).toBe('old-id');
  });
});
