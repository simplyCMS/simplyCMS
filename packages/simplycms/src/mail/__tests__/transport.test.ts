import { afterEach, describe, expect, it, vi } from 'vitest';
import { logTransport, smtpTransport } from '..';

const LINK = 'https://shop.test/auth/set-password?token=T0K3N';
const letter = {
  to: 'owner@shop.test',
  subject: 'Запрошення власника',
  text: `Перейдіть за посиланням: ${LINK}`,
  html: `<a href="${LINK}">Задати пароль</a>`,
  kind: 'owner-invite',
} as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('logTransport', () => {
  it('поза продом друкує Кому, Тему і text (dev-канал)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const lines: string[] = [];
    await logTransport((l) => lines.push(l)).send(letter);
    const out = lines.join('\n');
    expect(out).toContain('Кому: owner@shop.test');
    expect(out).toContain('Тема: Запрошення власника');
    expect(out).toContain(LINK);
  });

  it('у проді друкує лише Кому, Тему і тип — без тіла й посилань', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const lines: string[] = [];
    await logTransport((l) => lines.push(l)).send(letter);
    const out = lines.join('\n');
    expect(out).toContain('Кому: owner@shop.test');
    expect(out).toContain('Тема: Запрошення власника');
    expect(out).toContain('Тип: owner-invite');
    expect(out).not.toContain('T0K3N');
    expect(out).not.toContain('https://');
    expect(out).not.toContain('Задати пароль');
  });

  it('прод-режим визначається на кожному листі, а не при створенні', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const lines: string[] = [];
    const transport = logTransport((l) => lines.push(l));
    vi.stubEnv('NODE_ENV', 'production');
    await transport.send(letter);
    expect(lines.join('\n')).not.toContain('T0K3N');
  });
});

describe('getMailTransport', () => {
  async function fresh() {
    vi.resetModules();
    return (await import('..')).getMailTransport;
  }

  it('без SMTP_URL/MAIL_FROM → log', async () => {
    vi.stubEnv('SMTP_URL', '');
    vi.stubEnv('MAIL_FROM', '');
    expect((await fresh())().driver).toBe('log');
  });

  it('з SMTP_URL і MAIL_FROM → smtp', async () => {
    vi.stubEnv('SMTP_URL', 'smtp://localhost:2525');
    vi.stubEnv('MAIL_FROM', 'shop@shop.test');
    expect((await fresh())().driver).toBe('smtp');
  });

  it('часткова група кидає помилку, а не мовчки лишає log', async () => {
    vi.stubEnv('SMTP_URL', 'smtp://localhost:2525');
    vi.stubEnv('MAIL_FROM', '');
    expect(await fresh()).toThrow(/MAIL_FROM/);
  });

  it('мемоізує інстанс', async () => {
    vi.stubEnv('SMTP_URL', '');
    vi.stubEnv('MAIL_FROM', '');
    const get = await fresh();
    expect(get()).toBe(get());
  });
});

describe('smtpTransport', () => {
  it('недоступний порт → помилка `SMTP: <code>` без пароля й URL', async () => {
    const transport = smtpTransport({
      url: 'smtp://user:s3cr3tpw@127.0.0.1:1',
      from: 'shop@shop.test',
    });
    const error = await transport.send(letter).then(
      () => null,
      (e: unknown) => e as Error,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error!.message).toMatch(/^SMTP: [A-Z_]+$/);
    expect(JSON.stringify(error)).not.toContain('s3cr3tpw');
    expect(error!.message).not.toContain('127.0.0.1');
    expect(error!.cause).toBeUndefined();
  });
});
