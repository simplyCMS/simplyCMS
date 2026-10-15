import { beforeEach, describe, expect, it } from 'vitest';
import { smtpTransport } from 'simplycms/mail';

// 🔴 Без ключів Mailpit тест ПАДАЄ, а не skip: контур `test:schema` вимагає стенд,
// а мовчазний skip зробив би контракт smtp необов'язковим.
function harness() {
  const missing = ['SMTP_URL', 'MAIL_FROM', 'HARNESS_MAILPIT_URL'].filter(
    (k) => !process.env[k],
  );
  if (missing.length > 0)
    throw new Error(
      `Контракт smtp потребує Mailpit стенду: не задано ${missing.join(', ')}. ` +
        'Запусти `pnpm harness:up` (він пише HARNESS_SMTP_URL/HARNESS_MAILPIT_URL у .env.harness).',
    );
  return {
    url: process.env.SMTP_URL!,
    from: process.env.MAIL_FROM!,
    api: process.env.HARNESS_MAILPIT_URL!.replace(/\/+$/, ''),
  };
}

type Address = { Name: string; Address: string };
type Summary = {
  ID: string;
  From: Address;
  To: Address[];
  ReplyTo: Address[];
  Subject: string;
};

describe('smtp-драйвер проти Mailpit', () => {
  const cfg = harness();

  beforeEach(async () => {
    const res = await fetch(`${cfg.api}/api/v1/messages`, { method: 'DELETE' });
    expect(res.ok).toBe(true);
  });

  it('доставляє лист із усіма полями і From = MAIL_FROM', async () => {
    await smtpTransport({ url: cfg.url, from: cfg.from }).send({
      to: 'buyer@shop.test',
      subject: 'Контракт SMTP',
      text: 'Текстова частина',
      html: '<p>HTML частина</p>',
      replyTo: 'support@shop.test',
    });

    const list = (await (await fetch(`${cfg.api}/api/v1/messages`)).json()) as {
      messages: Summary[];
    };
    expect(list.messages).toHaveLength(1);
    const m = list.messages[0]!;
    expect(m.From.Address).toBe(cfg.from);
    expect(m.To.map((a) => a.Address)).toEqual(['buyer@shop.test']);
    expect(m.ReplyTo.map((a) => a.Address)).toEqual(['support@shop.test']);
    expect(m.Subject).toBe('Контракт SMTP');

    const full = (await (
      await fetch(`${cfg.api}/api/v1/message/${m.ID}`)
    ).json()) as { Text: string; HTML: string };
    expect(full.Text.trim()).toBe('Текстова частина');
    expect(full.HTML).toContain('HTML частина');
  });
});
