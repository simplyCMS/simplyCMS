import { describe, expect, it } from 'vitest';
import { createTranslator } from 'simplycms/i18n';
import { renderOwnerInviteMail, renderPasswordResetMail } from 'simplycms/mail';

// Чисті рендери листів auth: тексти з каталогу `mail.*`, обидві локалі.

const URL_ = 'https://shop.example/api/auth/reset-password/tok?callbackURL=%2F';
const STORE = 'Магазин "Сонце" <тест>';

describe.each(['uk', 'en'] as const)('рендер листів, локаль %s', (locale) => {
  const t = createTranslator(locale);

  it('скидання: тема й текст несуть storeName, у тексті є url, у темі його немає', () => {
    const mail = renderPasswordResetMail({
      to: 'a@example.test',
      url: URL_,
      storeName: STORE,
      t,
    });
    expect(mail.to).toBe('a@example.test');
    expect(mail.kind).toBe('password_reset');
    expect(mail.subject).toContain(STORE);
    expect(mail.subject).not.toContain('https://');
    expect(mail.text).toContain(STORE);
    expect(mail.text).toContain(URL_);
    // Каталог справді розв'язано, а не повернуто сирі ключі.
    expect(mail.text).not.toContain('mail.reset.');
    expect(mail.subject).toBe(t('mail.reset.subject', { storeName: STORE }));
  });

  it('запрошення: TTL у годинах, url і storeName в тексті', () => {
    const mail = renderOwnerInviteMail({
      to: 'o@example.test',
      url: 'https://shop.example/auth/invite?email=a&token=b',
      storeName: STORE,
      ttlMs: 24 * 3_600_000,
      t,
    });
    expect(mail.kind).toBe('owner_invite');
    expect(mail.subject).toContain(STORE);
    expect(mail.text).toContain(
      'https://shop.example/auth/invite?email=a&token=b',
    );
    expect(mail.text).toContain('24');
    expect(mail.text).not.toContain('mail.invite.');
  });

  it('HTML екранує < > " у storeName і url', () => {
    const reset = renderPasswordResetMail({
      to: 'a@example.test',
      url: 'https://x.test/?a="b"&c=<d>',
      storeName: STORE,
      t,
    });
    const invite = renderOwnerInviteMail({
      to: 'a@example.test',
      url: URL_,
      storeName: STORE,
      ttlMs: 3_600_000,
      t,
    });
    for (const html of [reset.html!, invite.html!]) {
      expect(html).toContain('&lt;тест&gt;');
      expect(html).toContain('&quot;Сонце&quot;');
      expect(html).not.toContain('<тест>');
    }
    expect(reset.html).not.toContain('"b"');
    expect(reset.html).toContain('&quot;b&quot;');
  });
});

it('локалі дають різні тексти (en не падає на uk)', () => {
  const input = { to: 'a@b.test', url: URL_, storeName: 'S' };
  const uk = renderPasswordResetMail({ ...input, t: createTranslator('uk') });
  const en = renderPasswordResetMail({ ...input, t: createTranslator('en') });
  expect(uk.subject).not.toBe(en.subject);
});
