import { describe, expect, it } from 'vitest';
import { inviteIdentifier, verifyOwnerInvite } from 'simplycms/auth';
import type { OwnerInviteStore } from 'simplycms/auth';
import type { MailItem, MailMessage, MailTransport } from 'simplycms/mail';
import { runOwnerInvite } from '../packages/create-simplycms-store/template/scripts/owner-invite-core.mjs';
import { runOwnerInviteCli } from '../packages/create-simplycms-store/template/scripts/owner-invite-cli.mjs';

// Юніт скрипта `owner:invite` із шаблону магазину.
//
// 🔴 Мока клієнта БД тут більше немає: скрипт більше не кличе GoTrue, а
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
  const banned = new Set<string>();
  const verified = new Set<string>();
  let nextId = 1;

  const store: OwnerInviteStore = {
    findUserIdByEmail: async (email) => users.get(email.toLowerCase()) ?? null,
    createUser: async ({ email }) => {
      const id = `user-${nextId++}`;
      users.set(email.toLowerCase(), id);
      return id;
    },
    issueAdminInvite: async ({ userId, identifier, valueHash, expiresAt }) => {
      if (banned.has(userId)) return 'banned';
      // Перевипуск гасить попередній токен — та сама семантика, що в БД.
      tokens.set(identifier, { valueHash, expiresAt });
      return 'issued';
    },
    grantAdminRole: async ({ userId }) => {
      if (banned.has(userId)) return 'banned';
      if (!roles.some((row) => row.userId === userId && row.role === 'admin')) {
        roles.push({ userId, role: 'admin' });
      }
      return 'granted';
    },
    isEmailVerified: async (userId) => verified.has(userId),
    consumeToken: async (identifier) => {
      const record = tokens.get(identifier) ?? null;
      tokens.delete(identifier);
      return record;
    },
  };

  return { store, users, tokens, roles, banned, verified };
}

/** Фейкова пошта: `schedule` збирає листи, `deliver` віддає їх транспорту. */
function makeMail(opts: { failSend?: boolean } = {}) {
  const queued: MailMessage[] = [];
  const sent: MailMessage[] = [];
  const transport: MailTransport = {
    driver: 'smtp',
    send: async (m) => {
      if (opts.failSend)
        throw new Error('connect ECONNREFUSED smtp://user:pw@mail.test:587');
      sent.push(m);
    },
  };
  const schedule = async (items: readonly MailItem[]) => {
    queued.push(...items.map((i) => i.message));
    return items.map((_, i) => `id-${i}`);
  };
  const deliver = async (_ids: readonly string[], t?: MailTransport) => {
    for (const m of queued) await t!.send(m).catch(() => {});
  };
  return { queued, sent, transport, schedule, deliver };
}

const SMTP_ENV = {
  SMTP_URL: 'smtp://u:p@mail.test:587',
  MAIL_FROM: 'a@b.test',
};

/** Прогін скрипта зі збором того, що він надрукував. */
async function run(
  store: OwnerInviteStore,
  extra: Partial<Parameters<typeof runOwnerInvite>[0]> = {},
  mail = makeMail(),
) {
  const lines: string[] = [];
  const result = await runOwnerInvite({
    email: EMAIL,
    siteUrl: SITE,
    store,
    env: {},
    schedule: mail.schedule,
    deliver: mail.deliver,
    transport: mail.transport,
    log: (message: string) => lines.push(message),
    ...extra,
  });
  return { result, output: lines.join('\n'), mail };
}

describe('owner-invite (скрипт шаблону)', () => {
  it('новий email: користувач і надруковане посилання; ролі admin від випуску немає', async () => {
    const { store, users, roles } = makeStore();

    const { result, output } = await run(store);

    expect(result.created).toBe(true);
    expect(users.size).toBe(1);
    // Р19: роль видає прийняття запрошення, а не випуск.
    expect(roles).toEqual([]);
    expect(output).not.toContain('Увага: акаунт уже існує');
    expect(output).not.toMatch(/закріплена|на місці/);
    expect(result.url.startsWith(`${SITE}/auth/invite?email=`)).toBe(true);
    // Драйвер `log` поза продом: посилання друкується (dev-канал).
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

  it('повторний прогін ідемпотентний: той самий користувач, ролі немає', async () => {
    const { store, users, roles } = makeStore();

    const first = await run(store);
    const second = await run(store);

    expect(second.result.created).toBe(false);
    expect(second.result.userId).toBe(first.result.userId);
    expect(users.size).toBe(1);
    expect(roles).toHaveLength(0);
  });

  const WARNING =
    'Увага: акаунт уже існує й не підтверджений — роль буде видано лише після прийняття запрошення з цієї скриньки.';

  it('Р19: наявний непідтверджений акаунт — попередження дослівно, код виходу 0', async () => {
    const { store, users } = makeStore();
    await store.createUser({ email: EMAIL, name: EMAIL });
    const mail = makeMail();
    const lines: string[] = [];
    const code = await runOwnerInviteCli({
      argv: [],
      env: {
        DATABASE_URL: 'postgres://x',
        OWNER_EMAIL: EMAIL,
        VITE_SITE_URL: SITE,
      },
      log: (m) => lines.push(m),
      error: (m) => lines.push(m),
      run: (opts) =>
        runOwnerInvite({
          ...opts,
          store,
          schedule: mail.schedule,
          deliver: mail.deliver,
          transport: mail.transport,
        }),
    });
    expect(code).toBe(0);
    expect(users.size).toBe(1);
    expect(lines).toContain(WARNING);
  });

  it('Р19: наявний підтверджений акаунт — без попередження', async () => {
    const { store, verified } = makeStore();
    verified.add(await store.createUser({ email: EMAIL, name: EMAIL }));
    const { output } = await run(store);
    expect(output).not.toContain('Увага: акаунт уже існує');
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

  it('забанений: скрипт відмовляє з підказкою «спершу розблокуйте покупця»', async () => {
    const { store, users, roles, tokens, banned } = makeStore();
    const first = await run(store);
    roles.length = 0;
    tokens.clear();
    banned.add([...users.values()][0]!);

    await expect(run(store)).rejects.toMatchObject({
      code: 'banned',
      cause: { code: 'banned' },
    });
    await expect(run(store)).rejects.toThrow(/розблокуйте покупця/);
    expect(roles).toHaveLength(0);
    expect(tokens.size).toBe(0);
    expect(first.result.created).toBe(true);
  });
});

describe('owner-invite: три гілки Е8-С2', () => {
  it('(1) SMTP: «лист надіслано», посилання й токена у виводі немає, лист у транспорті', async () => {
    const { store } = makeStore();
    const { result, output, mail } = await run(store, { env: SMTP_ENV });
    const token = new URL(result.url).searchParams.get('token')!;

    expect(output).toContain(`Лист надіслано на ${EMAIL}`);
    expect(output).not.toContain(result.url);
    expect(output).not.toContain(token);
    expect(output).not.toContain('/auth/invite');
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]!.text).toContain(result.url);
    expect(mail.sent[0]!.kind).toBe('owner_invite');
  });

  it('(1б) SMTP зламаний: код помилки без секретів, посилання не друкується', async () => {
    const { store } = makeStore();
    const lines: string[] = [];
    const attempt = run(
      store,
      { env: SMTP_ENV, log: (m: string) => lines.push(m) },
      makeMail({ failSend: true }),
    );
    await expect(attempt).rejects.toThrow(/не надіслано/);
    await expect(attempt).rejects.not.toThrow(/pw@/);
    expect(lines.join('\n')).not.toContain('/auth/invite');
  });

  it('(2) log поза продом: посилання у виводі', async () => {
    const { store } = makeStore();
    const { result, output } = await run(store, { env: {} });
    expect(output).toContain(result.url);
  });

  it('(3) прод + log без --print-link: відмова ДО випуску токена, текст без посилання', async () => {
    const { store, users, tokens } = makeStore();
    const lines: string[] = [];
    const attempt = run(store, {
      env: { NODE_ENV: 'production' },
      log: (m: string) => lines.push(m),
    });
    await expect(attempt).rejects.toThrow(/SMTP_URL/);
    await expect(attempt).rejects.toThrow(/MAIL_FROM/);
    await expect(attempt).rejects.toThrow(/--print-link/);
    await expect(attempt).rejects.not.toThrow(/auth\/invite/);
    // Нічого не випущено: ні користувача, ні токена.
    expect(users.size).toBe(0);
    expect(tokens.size).toBe(0);
    expect(lines).toHaveLength(0);
  });

  it('(3б) прод + log з --print-link: посилання є', async () => {
    const { store } = makeStore();
    const { result, output } = await run(store, {
      env: { NODE_ENV: 'production' },
      printLink: true,
    });
    expect(output).toContain(result.url);
  });

  it('посилання листа будується від VITE_SITE_URL, а не від чогось іншого', async () => {
    const { store } = makeStore();
    const { result, mail } = await run(store, { env: SMTP_ENV });
    expect(result.url.startsWith(`${SITE}/auth/invite?`)).toBe(true);
    expect(mail.queued[0]!.html).toContain(SITE);
  });
});

describe('owner-invite CLI-обгортка', () => {
  const baseEnv = {
    DATABASE_URL: 'postgres://x',
    OWNER_EMAIL: EMAIL,
    VITE_SITE_URL: SITE,
  };
  const cli = async (argv: string[], env: Record<string, string>) => {
    const calls: Parameters<typeof runOwnerInvite>[0][] = [];
    const errors: string[] = [];
    const code = await runOwnerInviteCli({
      argv,
      env,
      error: (m: string) => errors.push(m),
      run: (async (o: Parameters<typeof runOwnerInvite>[0]) => {
        calls.push(o);
      }) as unknown as typeof runOwnerInvite,
    });
    return { code, calls, errors };
  };

  it('--print-link доходить до ядра; без прапорця — false', async () => {
    expect((await cli(['--print-link'], baseEnv)).calls[0]!.printLink).toBe(
      true,
    );
    expect((await cli([], baseEnv)).calls[0]!.printLink).toBe(false);
  });

  it('прод без SMTP: без прапорця код 1, з прапорцем — посилання (наскрізно через ядро)', async () => {
    const { store } = makeStore();
    const mail = makeMail();
    const env = { ...baseEnv, NODE_ENV: 'production' };
    const lines: string[] = [];
    const errors: string[] = [];
    const real = (argv: string[]) =>
      runOwnerInviteCli({
        argv,
        env,
        log: (m: string) => lines.push(m),
        error: (m: string) => errors.push(m),
        run: (o) =>
          runOwnerInvite({
            ...o,
            store,
            schedule: mail.schedule,
            deliver: mail.deliver,
            transport: mail.transport,
          }),
      });
    expect(await real([])).toBe(1);
    expect(errors.join('\n')).toMatch(/--print-link/);
    expect(lines.join('\n')).not.toContain('/auth/invite');
    expect(await real(['--print-link'])).toBe(0);
    expect(lines.join('\n')).toContain(`${SITE}/auth/invite?`);
  });

  it('Р18г: без VITE_SITE_URL — код 1 з імʼям ключа, ядро не кличеться, фолбеку localhost немає', async () => {
    const env: Record<string, string> = { ...baseEnv };
    delete env.VITE_SITE_URL;
    const { code, calls, errors } = await cli([], env);
    expect(code).toBe(1);
    expect(calls).toHaveLength(0);
    expect(errors.join('\n')).toContain('VITE_SITE_URL');
    expect(errors.join('\n')).not.toContain('localhost');
  });

  /** CLI з реальним ядром і фейковою поштою; повертає надіслане й попередження. */
  const withLocale = async (locale: string | undefined) => {
    const { store } = makeStore();
    const mail = makeMail();
    const errors: string[] = [];
    const env: Record<string, string> = { ...baseEnv, ...SMTP_ENV };
    if (locale !== undefined) env.VITE_LOCALE = locale;
    const code = await runOwnerInviteCli({
      argv: [],
      env,
      log: () => {},
      error: (m: string) => errors.push(m),
      run: (o) =>
        runOwnerInvite({
          ...o,
          store,
          schedule: mail.schedule,
          deliver: mail.deliver,
          transport: mail.transport,
        }),
    });
    return { code, mail, errors };
  };

  it('M3: VITE_LOCALE=en-US — лист запрошення англійською, без попереджень', async () => {
    const { code, mail, errors } = await withLocale('en-US');
    expect(code).toBe(0);
    expect(mail.sent[0]!.subject).toMatch(/^Owner invitation/);
    expect(errors).toHaveLength(0);
  });

  it('M3: невалідна VITE_LOCALE — одне попередження й uk', async () => {
    const { code, mail, errors } = await withLocale('xx-YY');
    expect(code).toBe(0);
    expect(mail.sent[0]!.subject).toMatch(/^Запрошення власника/);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('VITE_LOCALE');
  });

  it('M3: без VITE_LOCALE — uk без попередження', async () => {
    const { mail, errors } = await withLocale(undefined);
    expect(mail.sent[0]!.subject).toMatch(/^Запрошення власника/);
    expect(errors).toHaveLength(0);
  });

  it('невідомий аргумент — код 1', async () => {
    expect((await cli(['--print-lnk'], baseEnv)).code).toBe(1);
  });
});
