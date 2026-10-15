import { describe, expect, it } from 'vitest';
import { createTranslator } from 'simplycms/i18n';
import { MAIL_KINDS } from 'simplycms/mail';

// Картка хвостів будує ключ `admin.settings.mail.kind.<kind>` динамічно: новий
// вид листа без підпису показав би в адмінці сирий ключ. Джерело переліку —
// сам `MAIL_KINDS`, не дубль.
describe.each(['uk', 'en'] as const)('підписи видів листів, %s', (locale) => {
  const t = createTranslator(locale);
  it.each([...MAIL_KINDS])('вид %s має підпис у каталозі', (kind) => {
    const key = `admin.settings.mail.kind.${kind}`;
    // @ts-expect-error — ключ складено динамічно, типізований переклад його не знає
    const label: string = t(key);
    expect(label).not.toBe(key);
    expect(label.trim()).not.toBe('');
  });
});
