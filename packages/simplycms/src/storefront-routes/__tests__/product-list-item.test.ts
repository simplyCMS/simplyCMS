import { describe, it, expect } from 'vitest';
import {
  toProductListItem,
  type PriceContext,
  type ProductListRow,
} from '../server/product-list-item';

/**
 * Task 16, Step 2: маппер серверного рядка каталогу в DTO для SSR-списку.
 * Фікстура — у формі реального рядка вибірки каталогу (`ProductListRow`):
 * ціни лежать і на продукті (modification_id = null), і на модифікаціях.
 */

const DEFAULT_PRICE_TYPE = 'pt-default';
const OTHER_PRICE_TYPE = 'pt-wholesale';

/** Рядок у формі реального select-у: 2 модифікації + ціни продукту й модифікацій */
function makeRow(overrides: Partial<ProductListRow> = {}): ProductListRow {
  return {
    id: 'prod-1',
    slug: 'invertor-5kw',
    name: 'Інвертор 5 кВт',
    name_lang: null,
    image: { url: 'https://cdn.example.com/invertor.jpg', alt: 'Інвертор' },
    has_modifications: true,
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

/** Тип гостя збігається з глобальним дефолтним — звичайний магазин. */
const GUEST_DEFAULT: PriceContext = {
  priceTypeId: DEFAULT_PRICE_TYPE,
  defaultPriceTypeId: DEFAULT_PRICE_TYPE,
};

describe('toProductListItem', () => {
  it('(а) бере ціну default-модифікації за default-типом ціни', () => {
    const ctx: PriceContext = {
      priceTypeId: DEFAULT_PRICE_TYPE,
      defaultPriceTypeId: DEFAULT_PRICE_TYPE,
    };

    expect(toProductListItem(makeRow(), ctx)).toEqual({
      id: 'prod-1',
      slug: 'invertor-5kw',
      name: 'Інвертор 5 кВт',
      nameLang: null,
      image: { url: 'https://cdn.example.com/invertor.jpg', alt: 'Інвертор' },
      price: 4200,
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

    expect(toProductListItem(row, GUEST_DEFAULT).price).toBe(111);
  });

  it("(а'') товар без модифікацій бере ціну без modification_id", () => {
    const row = makeRow({
      has_modifications: false,
      product_modifications: [],
    });

    expect(toProductListItem(row, GUEST_DEFAULT).price).toBe(1000);
  });

  it('(б) без цін → price: null (решта полів на місці)', () => {
    const row = makeRow({ product_prices: [], image: null });

    expect(toProductListItem(row, GUEST_DEFAULT)).toEqual({
      id: 'prod-1',
      slug: 'invertor-5kw',
      name: 'Інвертор 5 кВт',
      nameLang: null,
      image: null,
      price: null,
    });
  });

  it('(в) defaultPriceTypeId: null → fallback resolvePrice, тобто price: null', () => {
    expect(
      toProductListItem(makeRow(), {
        priceTypeId: null,
        defaultPriceTypeId: null,
      }).price,
    ).toBeNull();
  });

  it('(г) F5b: тип гостя ≠ глобального — ціна за типом гостя; без його ціни — відкат на дефолтний', () => {
    const row = makeRow({
      has_modifications: false,
      product_modifications: [],
      product_prices: [
        {
          price_type_id: DEFAULT_PRICE_TYPE,
          price: 1000,
          old_price: null,
          modification_id: null,
        },
        {
          price_type_id: 'pt-guest',
          price: 800,
          old_price: null,
          modification_id: null,
        },
      ],
    });
    const guest: PriceContext = {
      priceTypeId: 'pt-guest',
      defaultPriceTypeId: DEFAULT_PRICE_TYPE,
    };
    expect(toProductListItem(row, guest).price).toBe(800);
    expect(
      toProductListItem(
        { ...row, product_prices: [row.product_prices[0]!] },
        guest,
      ).price,
    ).toBe(1000);
  });
});

describe('toProductListItem: мова назви', () => {
  it('name_lang рядка їде в nameLang: картка обгорне fallback-назву `lang` основної мови', () => {
    const item = toProductListItem(makeRow({ name_lang: 'uk' }), GUEST_DEFAULT);

    expect(item.nameLang).toBe('uk');
  });
});
