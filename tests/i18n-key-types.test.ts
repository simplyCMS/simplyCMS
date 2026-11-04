import { describe, expect, it } from 'vitest';
import { plural, type PluralTranslator } from 'simplycms/i18n';
import { ukT } from '../packages/simplycms/test-harness/i18n';

/**
 * Контракт ключів (спека §19.8): `t()` приймає лише рядкові ключі, `plural` — лише ключі
 * множини; виводяться з каталогу `uk` за видом значення. Доказ — typecheck: зайвий
 * `@ts-expect-error` теж падає, тож розширення `MessageKey` до всіх ключів не пройде непомітно.
 */
describe('типи ключів: t() ↔ plural', () => {
  it('рядковий ключ — у t(), ключ множини — у plural()', () => {
    expect(ukT('cart.title')).toBe('Кошик');
    expect(plural(ukT, 'cart.items', 2)).toBe('2 товари');
  });

  it('t() не приймає ключ множини', () => {
    // @ts-expect-error — `cart.items` це PluralForms, його приймає лише plural
    expect(ukT('cart.items')).toBe('cart.items');
  });

  it('plural() не приймає рядковий ключ', () => {
    // @ts-expect-error — `cart.title` це рядок, а не PluralForms
    expect(plural(ukT, 'cart.title', 2)).toBe('cart.title');
  });

  it('знесені суфіксні ключі не є ключами', () => {
    // @ts-expect-error — `cart.itemsOne` замінено на множину `cart.items`
    expect(ukT('cart.itemsOne')).toBe('cart.itemsOne');
  });

  it('транслятор теми: ключі множини окремо від рядкових', () => {
    const themeT = ukT as unknown as PluralTranslator<'theme.a', 'theme.n'>;
    expect(typeof themeT).toBe('function');
    // @ts-expect-error — `theme.a` рядковий ключ теми, plural його не приймає
    plural(themeT, 'theme.a', 1);
    plural(themeT, 'theme.n', 1);
  });
});
