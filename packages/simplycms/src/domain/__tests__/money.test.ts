import { describe, it, expect } from 'vitest';
import { formatPrice } from '../money';

const UA = { locale: 'uk-UA', currency: 'UAH' };

describe('formatPrice', () => {
  /**
   * 🔴 ЦЕЙ ТЕСТ СТЕРЕЖЕ КОНКРЕТНИЙ БАГ, а не «форматування взагалі».
   *
   * `new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' })`
   * бере символ валюти з CLDR-даних, вшитих у рушій, а вони РІЗНІ:
   *   Node 24 (SSR)        → "4 200 ₴"   (U+20B4)
   *   Chromium 149 (клієнт) → "4 200 грн" (кирилиця)
   * Через це кожна картка товару давала гідраційний мисматч; зловив
   * `pnpm test:e2e` на першому прогоні.
   *
   * Тому асертимо саме СИМВОЛ. Якщо колись «спростять» модуль назад до
   * `style: 'currency'` — цей тест впаде на Node ще до того, як баг доїде
   * в браузер. Не замінювати асерт на `toContain('4 200')`.
   */
  it('символ валюти НЕ залежить від CLDR рушія', () => {
    const out = formatPrice(4200, UA);

    expect(out).toContain('₴');
    expect(out).not.toContain('грн');
    expect(out).not.toContain('UAH');
  });

  /**
   * Дефолти 0/2 обрано, щоб зберегти видимий результат 14 кол-сайтів, які
   * передавали лише `minimumFractionDigits: 0`. Кожен рядок нижче — реальний
   * вивід старого коду, знятий прогоном перед міграцією.
   */
  it.each([
    [4200, '4 200 ₴'],
    [4200.5, '4 200,5 ₴'],
    [4200.55, '4 200,55 ₴'],
    [4200.555, '4 200,56 ₴'],
    [0, '0 ₴'],
    [99.9, '99,9 ₴'],
  ])('%p → %p (побайтова парність зі старим Intl)', (value, expected) => {
    expect(formatPrice(value, UA)).toBe(expected);
  });

  it('роздільник між числом і символом — NBSP, не звичайний пробіл', () => {
    // Пробіл U+0020 тут був би видимою регресією: рядок став би переноситись
    // між сумою і символом валюти.
    expect(formatPrice(1000, UA)).toBe('1 000 ₴');
    expect(formatPrice(1000, UA)).not.toContain(' ₴');
  });

  it('явні знаки після коми перекривають дефолт', () => {
    expect(formatPrice(4200, UA, { minimumFractionDigits: 2 })).toBe(
      '4 200,00 ₴',
    );
  });

  it('невідома валюта показує свій ISO-код, а не зникає', () => {
    expect(formatPrice(100, { locale: 'uk-UA', currency: 'PLN' })).toContain(
      'PLN',
    );
  });

  it('код валюти нечутливий до регістру', () => {
    expect(formatPrice(100, { locale: 'uk-UA', currency: 'uah' })).toContain(
      '₴',
    );
  });

  it('локаль впливає на групування розрядів', () => {
    // en-US групує комою, uk-UA — нерозривним пробілом. Це та частина Intl,
    // що між рантаймами НЕ розходиться, тож її лишаємо рушію.
    expect(formatPrice(4200, { locale: 'en-US', currency: 'USD' })).toBe(
      '4,200 $',
    );
  });
});
