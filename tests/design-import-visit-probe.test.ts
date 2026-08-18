/**
 * Юніти ЧИСТОЇ частини контент-верифікації візиту (інкремент Б.3, Фаза 3,
 * план Р5): `detectVisitMismatch` із `lib/visit-probe.mjs`. Браузер тут не
 * потрібен принципово — саме заради цього зняття вимірів
 * (`browserVisitProbe`, виконується в сторінковому контексті) і їх
 * інтерпретація розведені по різних експортах одного модуля.
 */
import { describe, expect, it } from 'vitest';
import { FANOUT_MIN_CHILDREN } from '../.agents/skills/redesign-from-reference/scripts/lib/classify-structure.mjs';
import {
  detectVisitMismatch,
  GRID_CARDS_MIN,
  SPARSE_CARDS_MAX,
} from '../.agents/skills/redesign-from-reference/scripts/lib/visit-probe.mjs';

describe('lib/visit-probe.mjs — detectVisitMismatch: тип product', () => {
  it('сітка карток без Product-розмітки — mismatch (кейс deo)', () => {
    expect(
      detectVisitMismatch('product', {
        jsonLdTypes: ['CollectionPage', 'ItemList'],
        cardLinks: 12,
      }),
    ).toBe(true);
  });

  it('сітка карток, але сторінка розмічена як Product — НЕ mismatch', () => {
    // Картка товару зі стрічкою «схожі товари» і власною розміткою: розмітка
    // б'є лічильник, бо вона пряме твердження сторінки про себе.
    expect(
      detectVisitMismatch('product', {
        jsonLdTypes: ['BreadcrumbList', 'Product'],
        cardLinks: 20,
      }),
    ).toBe(false);
  });

  it('поріг карток: нижче — ні, від порога — так', () => {
    expect(
      detectVisitMismatch('product', {
        jsonLdTypes: [],
        cardLinks: GRID_CARDS_MIN - 1,
      }),
    ).toBe(false);
    expect(
      detectVisitMismatch('product', {
        jsonLdTypes: [],
        cardLinks: GRID_CARDS_MIN,
      }),
    ).toBe(true);
  });

  it('Product у вигляді URL схеми зараховується (`https://schema.org/Product`)', () => {
    expect(
      detectVisitMismatch('product', {
        jsonLdTypes: ['https://schema.org/Product'],
        cardLinks: 30,
      }),
    ).toBe(false);
  });
});

describe('lib/visit-probe.mjs — detectVisitMismatch: тип listing', () => {
  it('Product-розмітка і майже нуль карток — mismatch', () => {
    expect(
      detectVisitMismatch('listing', {
        jsonLdTypes: ['Product'],
        cardLinks: SPARSE_CARDS_MAX - 1,
      }),
    ).toBe(true);
  });

  it('Product-розмітка, але карток достатньо — НЕ mismatch', () => {
    // Штатна вітрина: `Product` вкладені в `ItemList`, картки на місці.
    expect(
      detectVisitMismatch('listing', {
        jsonLdTypes: ['ItemList', 'Product', 'Product'],
        cardLinks: SPARSE_CARDS_MAX,
      }),
    ).toBe(false);
  });

  it('CollectionPage/ItemList — не Product, mismatch немає навіть без карток', () => {
    expect(
      detectVisitMismatch('listing', {
        jsonLdTypes: ['CollectionPage', 'ItemList'],
        cardLinks: 0,
      }),
    ).toBe(false);
  });

  it('правило все ще спрацьовує на справжній картці товару', () => {
    // Захист від вихолощення: сторінка, що Є ВИКЛЮЧНО товаром (Product +
    // крихти, жодної колекційної розмітки, нуль карток), помилково названа
    // listing — саме її правило й має ловити.
    expect(
      detectVisitMismatch('listing', {
        jsonLdTypes: ['BreadcrumbList', 'Product', 'Offer'],
        cardLinks: 0,
      }),
    ).toBe(true);
  });
});

describe('lib/visit-probe.mjs — detectVisitMismatch: виняток на колекційну розмітку', () => {
  // 🔴 Другий фікс рев'ю (дефект 2): `hasProduct` на КОРЕКТНОМУ індексі
  // каталогу істинний за проєктом — вітрини штатно вкладають `Product` в
  // `ItemList`. Тому колекційний тип у розмітці знімає правило `listing`
  // повністю, незалежно від лічильника карток: це другий запобіжник, який не
  // залежить від того, чи побачив проб сітку.
  for (const collectionType of [
    'CollectionPage',
    'ItemList',
    'https://schema.org/ItemList',
    'http://schema.org/CollectionPage',
    'itemlist',
  ]) {
    it(`${collectionType} поруч із Product знімає правило listing`, () => {
      expect(
        detectVisitMismatch('listing', {
          jsonLdTypes: [collectionType, 'Product'],
          cardLinks: 0,
        }),
      ).toBe(false);
    });
  }

  it('на тип product виняток не поширюється — там колекція, навпаки, доказ', () => {
    expect(
      detectVisitMismatch('product', {
        jsonLdTypes: ['CollectionPage', 'ItemList'],
        cardLinks: GRID_CARDS_MIN,
      }),
    ).toBe(true);
  });
});

describe('lib/visit-probe.mjs — detectVisitMismatch: межі', () => {
  it('відсутній або порожній проб — НЕ mismatch (пробу не проводили)', () => {
    // Чесність каналу: «не міряли» ≠ «виміряли й нічого не знайшли».
    expect(detectVisitMismatch('product', undefined)).toBe(false);
    expect(detectVisitMismatch('listing', null)).toBe(false);
    expect(detectVisitMismatch('product', {})).toBe(false);
    expect(detectVisitMismatch('listing', {})).toBe(false);
  });

  it('биті поля проба не валять функцію', () => {
    expect(
      detectVisitMismatch('product', {
        jsonLdTypes: 'Product',
        cardLinks: 'багато',
      }),
    ).toBe(false);
  });

  it('решта типів не верифікується змістом взагалі', () => {
    for (const type of ['home', 'cart', 'checkout', 'about', 'contact']) {
      expect(
        detectVisitMismatch(type, {
          jsonLdTypes: ['Product'],
          cardLinks: 99,
        }),
      ).toBe(false);
    }
  });
});

// 🔴 Інваріант порогів (фікс ревʼю): «мінімальний список» в інструменті ОДИН.
// Структурний fan-out читає його як «≥3 дітей — уже індекс колекції», проб —
// як «<3 карток — уже не список». Два незалежні літерали розійшлися б при
// першій правці одного з них, і сторінка з трьома картками одночасно була б
// і списком (для класифікатора), і не-списком (для проба).
describe('lib/visit-probe.mjs — поріг списку спільний зі структурним fan-out', () => {
  it('SPARSE_CARDS_MAX виведено з FANOUT_MIN_CHILDREN', () => {
    expect(SPARSE_CARDS_MAX).toBe(FANOUT_MIN_CHILDREN);
    // Межа з обох боків та сама: рівно FANOUT_MIN_CHILDREN карток — це вже
    // список, тому mismatch на `listing` не спрацьовує.
    expect(
      detectVisitMismatch('listing', {
        jsonLdTypes: ['Product'],
        cardLinks: FANOUT_MIN_CHILDREN,
      }),
    ).toBe(false);
    expect(
      detectVisitMismatch('listing', {
        jsonLdTypes: ['Product'],
        cardLinks: FANOUT_MIN_CHILDREN - 1,
      }),
    ).toBe(true);
  });
});
