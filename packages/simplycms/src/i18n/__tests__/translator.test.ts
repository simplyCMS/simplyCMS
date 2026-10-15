import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTranslator } from '../translator';

describe('createTranslator', () => {
  it('віддає українське повідомлення для локалі uk', () => {
    expect(createTranslator('uk', 'uk')('cart.title')).toBe('Кошик');
  });

  it('віддає англійське повідомлення для локалі en', () => {
    expect(createTranslator('en', 'uk')('cart.title')).toBe('Cart');
  });

  it('підставляє параметри у плейсхолдери {name}', () => {
    expect(createTranslator('uk', 'uk')('cart.items', { count: 5 })).toBe(
      'Товари (5)',
    );
    expect(createTranslator('en', 'uk')('cart.items', { count: 5 })).toBe(
      'Items (5)',
    );
  });

  it('повертає сам ключ, якщо повідомлення немає в жодному каталозі', () => {
    const t = createTranslator('uk', 'uk');
    // Ключ поза каталогом — рантайм-страховка на випадок розсинхрону типів.
    expect(t('missing.key' as Parameters<typeof t>[0])).toBe('missing.key');
  });
});

describe('createTranslator — fallback-мова', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('бере українське повідомлення, якщо ключа немає в en-каталозі', async () => {
    // Мокаємо en-каталог неповним — так перевіряємо сам механізм fallback,
    // не псуючи реальні каталоги штучно неперекладеними ключами.
    vi.doMock('../catalogs/en/index', () => ({
      messages: { 'cart.title': 'Cart' },
    }));
    const { createTranslator: create } = await import('../translator');

    const t = create('en', 'uk');
    expect(t('cart.title')).toBe('Cart');
    expect(t('cart.empty.title')).toBe('Кошик порожній');
  });
});

describe('createTranslator — конкурентність (без глобального стану)', () => {
  it('два транслятори з різними локалями не впливають один на одного', async () => {
    const uk = createTranslator('uk', 'uk');
    const en = createTranslator('en', 'uk');

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
