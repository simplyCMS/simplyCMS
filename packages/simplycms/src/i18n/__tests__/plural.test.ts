import { describe, expect, it } from 'vitest';
import { createLookupTranslator, createTranslator } from '../translator';
import type { LookupCatalog } from '../lookup';
import type { UiLocale } from 'simplycms/contracts';
import { plural } from '../plural';
import { messages as ukBase } from '../catalogs/uk/base';
import { messages as enBase } from '../catalogs/en/base';
import { ui } from '../../../test-harness/locale';

/** Одна ланка ланцюга: каталог і його мова. */
const link = (locale: UiLocale, catalog?: LookupCatalog) => ({
  locale,
  catalog,
});

const uk = createTranslator([ukBase], ui('uk'));
const en = createTranslator([enBase], ui('en'));

describe('plural — правила мови з Intl.PluralRules', () => {
  it('uk: товар / товари / товарів (1, 2, 5, 21, 0)', () => {
    expect([1, 2, 5, 21, 0].map((n) => plural(uk, 'cart.items', n))).toEqual([
      '1 товар',
      '2 товари',
      '5 товарів',
      '21 товар',
      '0 товарів',
    ]);
  });

  it('uk: 11–14 — many, а не few (mod-100 перед mod-10)', () => {
    expect([11, 12, 14, 22].map((n) => plural(uk, 'cart.items', n))).toEqual([
      '11 товарів',
      '12 товарів',
      '14 товарів',
      '22 товари',
    ]);
  });

  it('en: one / other', () => {
    expect([1, 2].map((n) => plural(en, 'cart.items', n))).toEqual([
      '1 item',
      '2 items',
    ]);
  });

  it('{count} підставлено автоматично, інші параметри — також', () => {
    const t = createLookupTranslator<string, 'k'>(
      [
        link(ui('en'), {
          k: { one: '{count} {what}', other: '{count} {what}s' },
        }),
      ],
      ui('en'),
    );
    expect(plural(t, 'k', 3, { what: 'box' })).toBe('3 boxs');
  });

  it('категорії, якої немає у формах, відповідає other', () => {
    const t = createLookupTranslator<string, 'k'>(
      [link(ui('uk'), { k: { other: '{count} шт.' } })],
      ui('uk'),
    );
    expect(plural(t, 'k', 1)).toBe('1 шт.');
  });

  it('ключа-множини немає — сам ключ; t() на ключ-множину теж віддає ключ', () => {
    const t = createLookupTranslator<string, string>(
      [link(ui('uk'), {})],
      ui('uk'),
    );
    expect(plural(t, 'nope', 2)).toBe('nope');
    const forms = createLookupTranslator<string, string>(
      [link(ui('uk'), { k: { other: 'x' } })],
      ui('uk'),
    );
    expect(forms('k')).toBe('k');
  });
});

describe('plural — транслятор теми з PluralForms тією ж функцією', () => {
  it('ланцюг каталогів: форми беруться з першого каталогу, що їх має', () => {
    const own = { 'theme.n': { one: '{count} штука', other: '{count} штук' } };
    const primary = {
      'theme.n': { other: 'fallback' },
      'theme.m': { other: 'm' },
    };
    const t = createLookupTranslator<string, string>(
      [link(ui('uk'), own), link(ui('uk'), primary)],
      ui('uk'),
    );
    expect(plural(t, 'theme.n', 1)).toBe('1 штука');
    // `many` немає у формах теми — вибір падає на `other`.
    expect(plural(t, 'theme.n', 5)).toBe('5 штук');
    expect(plural(t, 'theme.m', 2)).toBe('m');
  });
});

describe('plural — форми з fallback-каталогу множаться за правилами ЙОГО мови', () => {
  // Тема має лише uk-форми, інтерфейс en: правила en дали б «5 товару» і «21 товару».
  const forms = {
    'theme.n': {
      one: '{count} товар',
      few: '{count} товари',
      many: '{count} товарів',
      other: '{count} товару',
    },
  };

  it('інтерфейс en, форми лише в uk: 5 → товарів, 21 → товар', () => {
    const t = createLookupTranslator<string, string>(
      [link(ui('en'), undefined), link(ui('uk'), forms)],
      ui('en'),
    );
    expect(plural(t, 'theme.n', 5)).toBe('5 товарів');
    expect(plural(t, 'theme.n', 21)).toBe('21 товар');
  });

  it('власна мова теми виграє: en-форми множаться за правилами en', () => {
    const t = createLookupTranslator<string, string>(
      [
        link(ui('en'), {
          'theme.n': { one: '{count} item', other: '{count} items' },
        }),
        link(ui('uk'), forms),
      ],
      ui('en'),
    );
    expect(plural(t, 'theme.n', 21)).toBe('21 items');
  });
});
