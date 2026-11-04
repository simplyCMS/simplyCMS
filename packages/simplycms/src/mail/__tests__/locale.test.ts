import { describe, expect, it } from 'vitest';
import { cl } from '../../../test-harness/locale';
import { loadMailTranslator, resolveMailUiLocale } from '../locale';

// Основна мова магазину в усіх кейсах — `uk` (§19.9). Мова листа визначається однією
// функцією, тож кожна гілка одержувача має власний рядок.
const PRIMARY = cl('uk');

describe('resolveMailUiLocale (§19.9)', () => {
  it('order-customer: мова замовлення, якщо в неї є пакет', () => {
    expect(
      resolveMailUiLocale(
        { kind: 'order-customer', orderLocale: cl('en') },
        PRIMARY,
      ),
    ).toBe('en');
  });

  it('order-customer: мова без пакета → основна (деградований режим, §19.15)', () => {
    expect(
      resolveMailUiLocale(
        { kind: 'order-customer', orderLocale: cl('pl') },
        PRIMARY,
      ),
    ).toBe('uk');
  });

  it('user: збережений ui_locale має перевагу', () => {
    expect(
      resolveMailUiLocale(
        { kind: 'user', uiLocale: 'en', locale: null },
        PRIMARY,
      ),
    ).toBe('en');
  });

  it('user: без ui_locale → мова контенту, якщо задана, інакше основна', () => {
    expect(
      resolveMailUiLocale(
        { kind: 'user', uiLocale: null, locale: null },
        PRIMARY,
      ),
    ).toBe('uk');
    expect(
      resolveMailUiLocale(
        { kind: 'user', uiLocale: null, locale: cl('en') },
        PRIMARY,
      ),
    ).toBe('en');
  });

  it('user: ui_locale без пакета → основна, а не помилка', () => {
    expect(
      resolveMailUiLocale(
        { kind: 'user', uiLocale: 'xx', locale: null },
        PRIMARY,
      ),
    ).toBe('uk');
  });

  it('store і invitee: завжди основна мова магазину', () => {
    expect(resolveMailUiLocale({ kind: 'store' }, PRIMARY)).toBe('uk');
    expect(resolveMailUiLocale({ kind: 'invitee' }, PRIMARY)).toBe('uk');
    expect(resolveMailUiLocale({ kind: 'store' }, cl('en'))).toBe('en');
  });
});

describe('loadMailTranslator', () => {
  it('віддає каталог мови одержувача (base + mail)', async () => {
    const en = await loadMailTranslator(
      { kind: 'user', uiLocale: 'en', locale: null },
      PRIMARY,
    );
    const uk = await loadMailTranslator({ kind: 'store' }, PRIMARY);
    expect(en('mail.reset.subject', { storeName: 'S' })).toBe(
      'Password reset — S',
    );
    expect(uk('mail.reset.subject', { storeName: 'S' })).not.toContain(
      'Password',
    );
  });
});
