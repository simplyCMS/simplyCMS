import { describe, it, expect } from 'vitest';
import {
  toProductListItem,
  type PriceContext,
  type ProductListRow,
} from '../server/product-list-item';

/**
 * Task 16, Step 2: маппер серверного рядка каталогу в DTO для SSR-списку.
 * Фікстура — у формі реального select-рядка (PRODUCT_LIST_SELECT): ціни лежать
 * і на продукті (modification_id = null), і на модифікаціях.
 */

const DEFAULT_PRICE_TYPE = 'pt-default';
const OTHER_PRICE_TYPE = 'pt-wholesale';

/** Рядок у формі реального select-у: 2 модифікації + ціни продукту й модифікацій */
function makeRow(overrides: Partial<ProductListRow> = {}): ProductListRow {
  return {
    id: 'prod-1',
    slug: 'invertor-5kw',
    name: 'Інвертор 5 кВт',
    images: ['https://cdn.example.com/invertor.jpg'],
    has_modifications: true,
    sections: { slug: 'invertory' },
    product_modifications: [
      { id: 'mod-a', is_default: false, sort_order: 1 },
      { id: 'mod-b', is_default: true, sort_order: 2 },
    ],
    product_prices: [
      // Ціна самого продукту (без модифікації) — не має перемогти модифікаційну
      {
        price_type_id: DEFAULT_PRICE_TYPE,
        price: 1000,
        old_price: null,
        modification_id: null,
      },
      {
        price_type_id: DEFAULT_PRICE_TYPE,
        price: 4200,
        old_price: 4800,
        modification_id: 'mod-b',
      },
      {
        price_type_id: OTHER_PRICE_TYPE,
        price: 3900,
        old_price: null,
        modification_id: 'mod-b',
      },
    ],
    ...overrides,
  };
}

describe('toProductListItem', () => {
  it('(а) бере ціну default-модифікації за default-типом ціни', () => {
    const ctx: PriceContext = { defaultPriceTypeId: DEFAULT_PRICE_TYPE };

    expect(toProductListItem(makeRow(), ctx)).toEqual({
      id: 'prod-1',
      slug: 'invertor-5kw',
      name: 'Інвертор 5 кВт',
      imageUrl: 'https://cdn.example.com/invertor.jpg',
      price: 4200,
      sectionSlug: 'invertory',
    });
  });

  it("(а') без прапорця is_default бере модифікацію з найменшим sort_order", () => {
    const row = makeRow({
      product_modifications: [
        { id: 'mod-b', is_default: false, sort_order: 2 },
        { id: 'mod-a', is_default: false, sort_order: 1 },
      ],
      product_prices: [
        {
          price_type_id: DEFAULT_PRICE_TYPE,
          price: 111,
          old_price: null,
          modification_id: 'mod-a',
        },
        {
          price_type_id: DEFAULT_PRICE_TYPE,
          price: 222,
          old_price: null,
          modification_id: 'mod-b',
        },
      ],
    });

    expect(
      toProductListItem(row, { defaultPriceTypeId: DEFAULT_PRICE_TYPE }).price,
    ).toBe(111);
  });

  it("(а'') товар без модифікацій бере ціну без modification_id", () => {
    const row = makeRow({
      has_modifications: false,
      product_modifications: [],
    });

    expect(
      toProductListItem(row, { defaultPriceTypeId: DEFAULT_PRICE_TYPE }).price,
    ).toBe(1000);
  });

  it('(б) без цін → price: null (решта полів на місці)', () => {
    const row = makeRow({ product_prices: [], images: [] });

    expect(
      toProductListItem(row, { defaultPriceTypeId: DEFAULT_PRICE_TYPE }),
    ).toEqual({
      id: 'prod-1',
      slug: 'invertor-5kw',
      name: 'Інвертор 5 кВт',
      imageUrl: null,
      price: null,
      sectionSlug: 'invertory',
    });
  });

  it('(в) defaultPriceTypeId: null → fallback resolvePrice, тобто price: null', () => {
    expect(
      toProductListItem(makeRow(), { defaultPriceTypeId: null }).price,
    ).toBeNull();
  });
});
