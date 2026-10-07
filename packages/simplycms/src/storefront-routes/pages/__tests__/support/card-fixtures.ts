// Фікстури поверхонь-карток (Е6в-11): один товар, одне середовище — чотири
// поверхні. База — 1000 у «роздробі», 800 в «опті».

import type {
  Discount,
  DiscountEnvironment,
  DiscountGroup,
  PriceEntry,
} from 'simplycms/contracts';
import type { ProductDetailProduct } from '../../product-detail/types';
import type {
  CatalogProductRow,
  PropertyOptionPageData,
} from 'simplycms/storefront/loaders';
import type { HomeProduct } from '../../home/types';

export const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
export const RETAIL = 'retail';
export const WHOLESALE = 'wholesale';

const entry = (price_type_id: string, price: number): PriceEntry => ({
  price_type_id,
  price,
  old_price: null,
  modification_id: null,
});
const prices = [entry(RETAIL, 1000), entry(WHOLESALE, 800)];

const discount = (over: Partial<Discount>): Discount => ({
  id: 'd1',
  group_id: 'g1',
  name: 'D1',
  description: null,
  discount_type: 'percent',
  discount_value: 10,
  priority: 0,
  is_active: true,
  starts_at: null,
  ends_at: null,
  price_type_id: null,
  targets: [{ id: 't1', target_type: 'all', target_id: null }],
  conditions: [],
  ...over,
});

const group = (discounts: Discount[]): DiscountGroup => ({
  id: 'g1',
  name: 'G1',
  description: null,
  operator: 'and',
  is_active: true,
  priority: 0,
  starts_at: null,
  ends_at: null,
  discounts,
  children: [],
});

const minQuantity = (value: number) => ({
  id: `c-${value}`,
  condition_type: 'min_quantity',
  operator: '>=',
  value,
});

export const retailEnv: DiscountEnvironment = {
  forest: [],
  actor: { userId: null, categoryId: 'cat-retail', isLoggedIn: false },
  priceTypeId: RETAIL,
  defaultPriceTypeId: RETAIL,
  now: new Date('2026-01-01T00:00:00.000Z'),
};

/** «Від 3 шт −10%» — на картці (1 шт) лише підказка. */
export const quantityEnv: DiscountEnvironment = {
  ...retailEnv,
  forest: [group([discount({ conditions: [minQuantity(3)] })])],
};

/**
 * −10% до 2025-12-31 включно + «від 5 шт −20%» без дат. Сервер каже
 * 2026-01-01: перша вже не діє, друга дає підказку — доказ, що середовище
 * застосоване.
 */
export const expiredEnv: DiscountEnvironment = {
  ...retailEnv,
  forest: [
    group([
      discount({ ends_at: new Date('2025-12-31T23:59:59.000Z') }),
      discount({
        id: 'd2',
        name: 'D2',
        discount_value: 20,
        priority: 1,
        conditions: [minQuantity(5)],
      }),
    ]),
  ],
};

/** Рядок вибірки лише з полями, які читає ціна картки й сама картка. */
export const catalogRow = {
  id: PRODUCT_ID,
  section_id: 's1',
  slug: 'panel',
  name: 'Панель',
  short_description: null,
  images: [],
  has_modifications: false,
  stock_status: 'in_stock',
  section: { id: 's1', name: 'Панелі', slug: 'panels' },
  modifications: [],
  product_prices: prices,
} as unknown as CatalogProductRow;

export const homeRow: HomeProduct = {
  id: PRODUCT_ID,
  name: 'Панель',
  slug: 'panel',
  images: [],
  short_description: null,
  stock_status: 'in_stock',
  section: { slug: 'panels' },
  section_id: 's1',
  // SSR-база (дефолтний тип) — до гідрації.
  price: 1000,
  old_price: null,
  prices,
};

export const propertyPageData = {
  property: { id: 'p1', name: 'Колір', slug: 'color' },
  option: {
    id: 'o1',
    name: 'Чорний',
    slug: 'black',
    description: null,
    image_url: null,
  },
  products: [catalogRow],
} as unknown as PropertyOptionPageData;

export const detailProduct = {
  ...catalogRow,
  sections: { id: 's1', slug: 'panels', name: 'Панелі' },
  product_property_values: [],
} as unknown as ProductDetailProduct;
