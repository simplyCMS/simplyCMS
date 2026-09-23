import { describe, it, expect } from 'vitest';
// 🔴 Бере специфікатором `simplycms/domain/inventory`, а НЕ `../inventory`
// (Е3-5): відносна форма тут ЗБІГАЄТЬСЯ рядком із забороною тір-зони
// `src/domain` на новий сервер-онлі T2 `simplycms/inventory` (обліку
// залишків) — `no-restricted-imports` матчить рядок специфікатора, а не
// резолвлений шлях, і не розрізняє домен-модуль `domain/inventory.ts` від
// однойменної тек-зони. Модуль лишається тим самим — це той самий файл,
// узятий через легальний exports-субшлях замість колізійного рядка.
import {
  calculateProductAvailability,
  enrichProductsWithAvailability,
  isPurchasable,
  schemaOrgAvailability,
} from 'simplycms/domain/inventory';
import type { ProductAvailabilityInput } from 'simplycms/domain/inventory';

describe('isPurchasable — статус є джерелом правди (К2-Е0, Е0-3)', () => {
  it('in_stock — доступний навіть без жодного рядка залишків', () => {
    expect(isPurchasable('in_stock')).toBe(true);
  });
  it('null (статус не заданий) — доступний, як і DEFAULT схеми', () => {
    expect(isPurchasable(null)).toBe(true);
    expect(isPurchasable(undefined)).toBe(true);
  });
  it('on_order — доступний під замовлення', () => {
    expect(isPurchasable('on_order')).toBe(true);
  });
  it('out_of_stock — недоступний, навіть якщо залишки хтось забув обнулити', () => {
    expect(isPurchasable('out_of_stock')).toBe(false);
  });
});

describe('schemaOrgAvailability', () => {
  it('три статуси → три URL schema.org; on_order — BackOrder, не OutOfStock', () => {
    expect(schemaOrgAvailability('in_stock')).toBe(
      'https://schema.org/InStock',
    );
    expect(schemaOrgAvailability('on_order')).toBe(
      'https://schema.org/BackOrder',
    );
    expect(schemaOrgAvailability('out_of_stock')).toBe(
      'https://schema.org/OutOfStock',
    );
    expect(schemaOrgAvailability(null)).toBe('https://schema.org/InStock');
  });
});

describe('calculateProductAvailability', () => {
  it('простий товар: статус, а не кількість', () => {
    const inStock: ProductAvailabilityInput = {
      id: 'p1',
      stock_status: 'in_stock',
      has_modifications: false,
    };
    const out: ProductAvailabilityInput = {
      id: 'p2',
      stock_status: 'out_of_stock',
      has_modifications: false,
      stock_by_pickup_point: [{ quantity: 3 }],
    };
    expect(calculateProductAvailability(inStock)).toBe(true);
    expect(calculateProductAvailability(out)).toBe(false);
  });

  it('товар із модифікаціями: доступний, якщо доступна будь-яка', () => {
    const p: ProductAvailabilityInput = {
      id: 'p1',
      stock_status: 'out_of_stock',
      has_modifications: true,
      product_modifications: [
        {
          id: 'm1',
          stock_status: 'out_of_stock',
          is_default: true,
          sort_order: 0,
        },
        {
          id: 'm2',
          stock_status: 'in_stock',
          is_default: false,
          sort_order: 1,
        },
      ],
    };
    expect(calculateProductAvailability(p)).toBe(true);
  });

  it('товар із модифікаціями, усі out_of_stock — недоступний', () => {
    const p: ProductAvailabilityInput = {
      id: 'p1',
      stock_status: 'in_stock',
      has_modifications: true,
      product_modifications: [
        {
          id: 'm1',
          stock_status: 'out_of_stock',
          is_default: true,
          sort_order: 0,
        },
      ],
    };
    expect(calculateProductAvailability(p)).toBe(false);
  });
});

describe('enrichProductsWithAvailability', () => {
  it('додає прапорець isAvailable за статусом', () => {
    const res = enrichProductsWithAvailability([
      { id: 'p1', stock_status: 'on_order', has_modifications: false },
      { id: 'p2', stock_status: 'out_of_stock', has_modifications: false },
    ]);
    expect(res.map((p) => p.isAvailable)).toEqual([true, false]);
  });
});
