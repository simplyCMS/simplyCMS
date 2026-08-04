import { describe, it, expect } from 'vitest';
import {
  mapProduct,
  mapSection,
  mapOrder,
  buildDiscountTree,
} from '../mappers';

describe('mapProduct', () => {
  it('maps a full product row to the domain shape', () => {
    const row = {
      id: 'p1',
      slug: 'widget',
      name: 'Widget',
      description: null,
      section_id: 's1',
      stock_status: 'in_stock',
      has_modifications: true,
      product_modifications: [
        {
          id: 'm1',
          sku: 'SKU1',
          stock_status: 'in_stock',
          is_default: true,
          sort_order: 0,
        },
      ],
      product_prices: [
        {
          price_type_id: 'retail',
          price: '100',
          old_price: '120',
          modification_id: null,
        },
      ],
      images: ['/a.jpg'],
    };
    const p = mapProduct(row);
    expect(p.id).toBe('p1');
    expect(p.modifications[0].sku).toBe('SKU1');
    expect(p.prices[0].price).toBe(100);
    expect(p.prices[0].old_price).toBe(120);
    expect(p.stock_status).toBe('in_stock');
  });

  it('normalizes invalid stock_status to null and defaults arrays', () => {
    const p = mapProduct({
      id: 'p2',
      slug: 'x',
      name: 'X',
      stock_status: 'weird',
    });
    expect(p.stock_status).toBeNull();
    expect(p.modifications).toEqual([]);
    expect(p.prices).toEqual([]);
    expect(p.has_modifications).toBe(false);
  });
});

describe('mapSection', () => {
  it('maps a section row', () => {
    const s = mapSection({
      id: 's1',
      slug: 'cat',
      name: 'Cat',
      parent_id: null,
      sort_order: 2,
    });
    expect(s).toMatchObject({
      id: 's1',
      slug: 'cat',
      name: 'Cat',
      sort_order: 2,
      is_active: true,
    });
  });
});

describe('mapOrder', () => {
  it('maps an order row with joined status and items', () => {
    const o = mapOrder({
      id: 'o1',
      order_number: '0001',
      order_statuses: { code: 'new', name: 'New' },
      first_name: 'John',
      last_name: 'Doe',
      email: 'j@x.com',
      phone: '123',
      subtotal: 100,
      total: 110,
      shipping_cost: 10,
      shipping_method_id: 'm1',
      delivery_city: 'Kyiv',
      order_items: [
        {
          product_id: 'p1',
          modification_id: null,
          name: 'Widget',
          quantity: 2,
          price: 50,
        },
      ],
      created_at: '2026-01-01',
      user_id: 'u1',
    });
    expect(o.number).toBe('0001');
    expect(o.status).toBe('new');
    expect(o.customer.name).toBe('John Doe');
    expect(o.items).toHaveLength(1);
    expect(o.shipping?.methodId).toBe('m1');
    expect(o.shipping?.city).toBe('Kyiv');
  });

  it('returns null shipping when no method', () => {
    const o = mapOrder({ id: 'o2', order_number: '2', first_name: 'A' });
    expect(o.shipping).toBeNull();
  });
});

describe('buildDiscountTree', () => {
  it('nests child groups under parents and attaches discounts', () => {
    const discounts = [
      {
        id: 'd1',
        name: 'D1',
        discount_type: 'percent',
        discount_value: 10,
        group_id: 'child',
        priority: 0,
        is_active: true,
        discount_targets: [],
        discount_conditions: [],
      },
    ];
    const groups = [
      {
        id: 'root',
        name: 'Root',
        operator: 'and',
        is_active: true,
        priority: 0,
        parent_group_id: null,
      },
      {
        id: 'child',
        name: 'Child',
        operator: 'or',
        is_active: true,
        priority: 0,
        parent_group_id: 'root',
      },
    ];
    const tree = buildDiscountTree(discounts, groups);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('root');
    expect(tree[0].children[0].id).toBe('child');
    expect(tree[0].children[0].discounts[0].id).toBe('d1');
    expect(tree[0].children[0].discounts[0].discount_value).toBe(10);
  });
});
