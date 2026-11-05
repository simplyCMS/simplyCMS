import { describe, it, expect } from 'vitest';
import { createTranslator } from '../translator';
import { ui } from '../../../test-harness/locale';
import { messages as ukBase } from '../catalogs/uk/base';
import { messages as enBase } from '../catalogs/en/base';

const uk = createTranslator([ukBase], ui('uk'));
const en = createTranslator([enBase], ui('en'));

describe('createTranslator', () => {
  it('віддає українське повідомлення для локалі uk', () => {
    expect(uk('cart.title')).toBe('Кошик');
  });

  it('віддає англійське повідомлення для локалі en', () => {
    expect(en('cart.title')).toBe('Cart');
  });

  it('підставляє параметри у плейсхолдери {name}', () => {
    expect(uk('cart.itemsTitle', { count: 5 })).toBe('Товари (5)');
    expect(en('cart.itemsTitle', { count: 5 })).toBe('Items (5)');
  });

  it('повертає сам ключ, якщо повідомлення немає в жодному каталозі', () => {
    const t = uk;
    // Ключ поза каталогом — рантайм-страховка на випадок розсинхрону типів.
    expect(t('missing.key' as Parameters<typeof t>[0])).toBe('missing.key');
  });
});

describe('createTranslator — порядок каталогів', () => {
  it('перший каталог із ключем виграє, відсутній ключ добирає наступний', () => {
    const t = createTranslator(
      [
        { 'cart.title': 'Перший' },
        { 'cart.title': 'Другий', 'cart.empty.title': 'Лише в другому' },
      ],
      ui('uk'),
    );

    expect(t('cart.title')).toBe('Перший');
    expect(t('cart.empty.title')).toBe('Лише в другому');
  });
});

describe('createTranslator — конкурентність (без глобального стану)', () => {
  it('два транслятори з різними локалями не впливають один на одного', async () => {
    // Interleaved-виклики з поступкою мікрозадачі між ними: якби локаль жила
    // в модульному mutable-стані (setLocale), другий транслятор перебив би перший.
    const results: string[] = [];
    await Promise.all([
      (async () => {
        for (let i = 0; i < 3; i += 1) {
          results.push(uk('cart.title'));
          await Promise.resolve();
        }
      })(),
      (async () => {
        for (let i = 0; i < 3; i += 1) {
          results.push(en('cart.title'));
          await Promise.resolve();
        }
      })(),
    ]);

    expect(results).toEqual([
      'Кошик',
      'Cart',
      'Кошик',
      'Cart',
      'Кошик',
      'Cart',
    ]);
  });
});
