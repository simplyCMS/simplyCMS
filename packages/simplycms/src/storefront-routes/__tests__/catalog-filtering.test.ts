import { describe, it, expect } from 'vitest';
import {
  computeNumericRanges,
  computePriceRange,
  filterAndSortProducts,
  type FilterableProduct,
} from '../pages/catalog/filtering';
import type { BooleanProperty, NumericProperty } from '../pages/catalog/types';

/**
 * Вибірка каталогу після спліту (Фаза 4) — ОДНА для каталогу й сторінки
 * розділу. Тест закриває саме те, що злиття могло зіпсувати: звуження
 * розділом, кожен вид фільтра і сортування.
 */
const power: NumericProperty = {
  id: 'prop-power',
  slug: 'power',
  property_type: 'number',
  is_filterable: true,
};

function product(
  id: string,
  overrides: Partial<FilterableProduct> = {},
): FilterableProduct & { id: string } {
  return {
    id,
    price: 100,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    isAvailable: true,
    section: { id: 'sec-1' },
    propertyValues: [],
    ...overrides,
  };
}

const wifi: BooleanProperty = { id: 'pB', slug: 'has-wifi' };

/** Значення boolean-властивості: сервер зберігає рядки 'true' / 'false'. */
function boolValue(value: string) {
  return {
    property_id: wifi.id,
    value,
    bool_value: value === 'true',
    numeric_value: null,
    option_id: null,
  };
}

const base = {
  filters: {},
  sortBy: 'popular' as const,
  sectionId: null,
  numericProperties: [power],
};

describe('filterAndSortProducts', () => {
  it('без фільтрів віддає вибірку в порядку джерела', () => {
    const products = [product('a'), product('b')];

    expect(filterAndSortProducts(products, base).map((p) => p.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('звужує вибірку розділом', () => {
    const products = [
      product('a'),
      product('b', { section: { id: 'sec-2' } }),
      product('c', { section: null }),
    ];

    const result = filterAndSortProducts(products, {
      ...base,
      sectionId: 'sec-1',
    });

    expect(result.map((p) => p.id)).toEqual(['a']);
  });

  it('не мутує вихідний масив під час сортування', () => {
    const products = [
      product('a', { price: 300 }),
      product('b', { price: 100 }),
    ];

    filterAndSortProducts(products, { ...base, sortBy: 'price_asc' });

    expect(products.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('inStockOnly лишає тільки доступні товари', () => {
    const products = [product('a', { isAvailable: false }), product('b')];

    const result = filterAndSortProducts(products, {
      ...base,
      filters: { inStockOnly: true },
    });

    expect(result.map((p) => p.id)).toEqual(['b']);
  });

  it('фільтр-опція читає кому-роздільний список option_id', () => {
    const withOption = product('a', {
      propertyValues: [
        {
          property_id: 'prop-color',
          value: null,
          numeric_value: null,
          option_id: 'o1,o2',
        },
      ],
    });
    const products = [withOption, product('b')];

    const result = filterAndSortProducts(products, {
      ...base,
      filters: { color: ['o2'] },
    });

    expect(result.map((p) => p.id)).toEqual(['a']);
  });

  it('числовий діапазон відсіює товари поза межами й без характеристики', () => {
    const products = [
      product('in', {
        propertyValues: [
          {
            property_id: power.id,
            value: null,
            numeric_value: 500,
            option_id: null,
          },
        ],
      }),
      product('out', {
        propertyValues: [
          {
            property_id: power.id,
            value: null,
            numeric_value: 900,
            option_id: null,
          },
        ],
      }),
      product('none'),
    ];

    const result = filterAndSortProducts(products, {
      ...base,
      filters: { powerMin: 400, powerMax: 600 },
    });

    expect(result.map((p) => p.id)).toEqual(['in']);
  });

  it('фільтр ціни лишає товари без ціни', () => {
    const products = [
      product('cheap', { price: 50 }),
      product('dear', { price: 500 }),
      product('nullish', { price: null }),
    ];

    const result = filterAndSortProducts(products, {
      ...base,
      filters: { priceMax: 100 },
    });

    expect(result.map((p) => p.id)).toEqual(['cheap', 'nullish']);
  });

  it.each([
    ['price_asc', ['cheap', 'dear']],
    ['price_desc', ['dear', 'cheap']],
  ] as const)('сортування %s', (sortBy, expected) => {
    const products = [
      product('dear', { price: 500 }),
      product('cheap', { price: 50 }),
    ];

    const result = filterAndSortProducts(products, { ...base, sortBy });

    expect(result.map((p) => p.id)).toEqual([...expected]);
  });

  it('сортування newest — за спаданням дати створення', () => {
    const products = [
      product('old', { created_at: new Date('2025-01-01T00:00:00.000Z') }),
      product('new', { created_at: new Date('2026-06-01T00:00:00.000Z') }),
    ];

    const result = filterAndSortProducts(products, {
      ...base,
      sortBy: 'newest',
    });

    expect(result.map((p) => p.id)).toEqual(['new', 'old']);
  });
});

describe('похідні діапазони вибірки', () => {
  it('computePriceRange ігнорує товари без ціни', () => {
    const products = [
      product('a', { price: 120 }),
      product('b', { price: null }),
      product('c', { price: 40 }),
    ];

    expect(computePriceRange(products)).toEqual({ min: 40, max: 120 });
  });

  it('computePriceRange для вибірки без цін віддає undefined', () => {
    expect(computePriceRange([product('a', { price: null })])).toBeUndefined();
  });

  it('computeNumericRanges рахує межі лише по товарах розділу', () => {
    const products = [
      product('a', {
        propertyValues: [
          {
            property_id: power.id,
            value: null,
            numeric_value: 300,
            option_id: null,
          },
        ],
      }),
      product('b', {
        section: { id: 'sec-2' },
        propertyValues: [
          {
            property_id: power.id,
            value: null,
            numeric_value: 900,
            option_id: null,
          },
        ],
      }),
    ];

    expect(computeNumericRanges(products, [power], 'sec-1')).toEqual({
      power: { min: 300, max: 300 },
    });
  });

  describe('boolean-фільтр (verify/boolfilter)', () => {
    const products = [
      product('A', { propertyValues: [boolValue('true')] }),
      product('B', { propertyValues: [boolValue('false')] }),
      product('C'),
    ];
    const withBool = { ...base, booleanProperties: [wifi] };

    it('позначений фільтр лишає лише товари зі значенням true', () => {
      const result = filterAndSortProducts(products, {
        ...withBool,
        filters: { 'has-wifi': true },
      });

      expect(result.map((p) => p.id)).toEqual(['A']);
    });

    it('без фільтра вибірка не звужується', () => {
      expect(
        filterAndSortProducts(products, withBool).map((p) => p.id),
      ).toEqual(['A', 'B', 'C']);
      expect(
        filterAndSortProducts(products, {
          ...withBool,
          filters: { 'has-wifi': undefined },
        }).map((p) => p.id),
      ).toEqual(['A', 'B', 'C']);
    });

    it('значення true у модифікації тримає товар у вибірці', () => {
      const mixed = [
        product('A', {
          propertyValues: [boolValue('false'), boolValue('true')],
        }),
      ];

      expect(
        filterAndSortProducts(mixed, {
          ...withBool,
          filters: { 'has-wifi': true },
        }).map((p) => p.id),
      ).toEqual(['A']);
    });

    it('boolean разом з опцією: звужують обидва', () => {
      const both = [
        product('A', {
          propertyValues: [
            boolValue('true'),
            {
              property_id: 'prop-color',
              value: null,
              numeric_value: null,
              option_id: 'o1',
            },
          ],
        }),
        product('B', { propertyValues: [boolValue('true')] }),
      ];

      expect(
        filterAndSortProducts(both, {
          ...withBool,
          filters: { 'has-wifi': true, color: ['o1'] },
        }).map((p) => p.id),
      ).toEqual(['A']);
    });

    it('зіставлення за property_id, а не за slug', () => {
      const other = [
        product('X', {
          propertyValues: [{ ...boolValue('true'), property_id: 'has-wifi' }],
        }),
      ];

      expect(
        filterAndSortProducts(other, {
          ...withBool,
          filters: { 'has-wifi': true },
        }),
      ).toEqual([]);
    });
  });
});
