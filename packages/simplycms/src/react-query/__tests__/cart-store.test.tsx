// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
} from 'simplycms/contracts/cart-limits';
import { CartProvider, useCart } from '../useCart';

/**
 * Кошик зі сховища (Е6в-13, Review Focus 3): localStorage — це ввід, а не
 * довірені дані. Старий формат (`price`, `basePrice`, `discountData`) і сміття
 * не валять кошик; межі однакові з квотою й чекаутом.
 */
const KEY = 'simplycms-cart';
const P1 = '10000002-0000-4000-8000-000000000001';
const P2 = '10000002-0000-4000-8000-000000000002';
const M1 = '10000003-0000-4000-8000-000000000001';
const uuid = (i: number) =>
  `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

const wrapper = ({ children }: { children: ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);
const store = (rows: unknown) =>
  localStorage.setItem(KEY, JSON.stringify(rows));
const mount = () => renderHook(() => useCart(), { wrapper });

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('cart-store: читання сховища', () => {
  it('старий формат — зайві поля відкинуто, кількість лишилась', () => {
    store([
      {
        productId: P1,
        modificationId: null,
        name: 'Панель',
        price: 999,
        basePrice: 1200,
        discountData: { applied: [{ name: 'Стара акція' }] },
        quantity: 2,
      },
    ]);
    const { result } = mount();
    expect(result.current.items).toEqual([
      { productId: P1, modificationId: null, name: 'Панель', quantity: 2 },
    ]);
  });

  it('сміття відкидається рядками, без винятку', () => {
    const ok = { productId: P1, modificationId: M1, name: 'A', quantity: 1 };
    store([
      {},
      'рядок',
      null,
      { ...ok, quantity: -1 },
      { ...ok, quantity: 1.5 },
      { ...ok, quantity: MAX_LINE_QUANTITY + 1 },
      { ...ok, productId: 'x' },
      { ...ok, modificationId: 'y' },
      { productId: P2, modificationId: null, quantity: 1 },
      ok,
    ]);
    const { result } = mount();
    expect(result.current.items).toEqual([ok]);
  });

  it('не масив і битий JSON — порожній кошик', () => {
    localStorage.setItem(KEY, '{"a":1}');
    expect(mount().result.current.items).toEqual([]);
    cleanup();
    localStorage.setItem(KEY, '[{');
    expect(mount().result.current.items).toEqual([]);
  });

  it(`150 рядків → ${MAX_CART_LINES}`, () => {
    store(
      Array.from({ length: 150 }, (_, i) => ({
        productId: uuid(i + 1),
        modificationId: null,
        name: `T${i}`,
        quantity: 1,
      })),
    );
    expect(mount().result.current.items).toHaveLength(MAX_CART_LINES);
  });

  it('дві однакові пари по 999 → один рядок на 999', () => {
    const row = { productId: P1, modificationId: null, name: 'A' };
    store([
      { ...row, quantity: MAX_LINE_QUANTITY },
      { ...row, quantity: MAX_LINE_QUANTITY },
    ]);
    expect(mount().result.current.items).toEqual([
      { ...row, quantity: MAX_LINE_QUANTITY },
    ]);
  });
});

describe('cart-store: дії тримають межі', () => {
  it('ціни в кошику немає: totalPrice прибрано', () => {
    expect('totalPrice' in mount().result.current).toBe(false);
  });

  it('updateQuantity(…, 1000) → 999', () => {
    store([{ productId: P1, modificationId: null, name: 'A', quantity: 1 }]);
    const { result } = mount();
    act(() => result.current.updateQuantity(P1, null, 1000));
    expect(result.current.items[0].quantity).toBe(MAX_LINE_QUANTITY);
  });

  it('addItem: наявна позиція лише збільшує кількість → added', () => {
    store([{ productId: P1, modificationId: null, name: 'A', quantity: 1 }]);
    const { result } = mount();
    let outcome = '';
    act(() => {
      outcome = result.current.addItem({
        productId: P1,
        modificationId: null,
        name: 'A',
      });
    });
    expect(outcome).toBe('added');
    expect(result.current.items).toEqual([
      { productId: P1, modificationId: null, name: 'A', quantity: 2 },
    ]);
  });

  it('addItem на 999 шт → limit_reached, кількість та сама', () => {
    const row = { productId: P1, modificationId: null, name: 'A' };
    store([{ ...row, quantity: MAX_LINE_QUANTITY }]);
    const { result } = mount();
    let outcome = '';
    act(() => {
      outcome = result.current.addItem(row);
    });
    expect(outcome).toBe('limit_reached');
    expect(result.current.items[0].quantity).toBe(MAX_LINE_QUANTITY);
  });

  it(`addItem нової позиції на ${MAX_CART_LINES} рядках → limit_reached`, () => {
    store(
      Array.from({ length: MAX_CART_LINES }, (_, i) => ({
        productId: uuid(i + 1),
        modificationId: null,
        name: `T${i}`,
        quantity: 1,
      })),
    );
    const { result } = mount();
    let outcome = '';
    act(() => {
      outcome = result.current.addItem({
        productId: P1,
        modificationId: null,
        name: 'Новий',
      });
    });
    expect(outcome).toBe('limit_reached');
    expect(result.current.items).toHaveLength(MAX_CART_LINES);
    expect(result.current.items.some((i) => i.productId === P1)).toBe(false);
  });
});
