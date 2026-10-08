import { describe, it, expect } from 'vitest';
import type { NewShippingSnapshot } from 'simplycms/contracts/shipping-providers';
import { parseShippingSnapshot } from '../shipping';

const pickup = {
  methodName: 'Самовивіз',
  provider: 'core:pickup',
  pricing: 'rates',
  destination: {
    kind: 'pickup-point',
    pointId: 'p1',
    name: 'Склад у Києві',
    address: 'вул. Сонячна, 1',
    city: 'Київ',
  },
};

describe('parseShippingSnapshot', () => {
  it('приймає валідний знімок самовивозу', () => {
    expect(parseShippingSnapshot(pickup)).toEqual(pickup);
  });

  it('приймає адресну доставку з address: null', () => {
    const snap = {
      methodName: 'Кур’єр',
      provider: 'core:address',
      pricing: 'carrier',
      destination: { kind: 'address', city: 'Львів', address: null },
    };
    expect(parseShippingSnapshot(snap)).toEqual(snap);
  });

  it('порожній обʼєкт і не-обʼєкти дають null без throw', () => {
    expect(parseShippingSnapshot({})).toBeNull();
    expect(parseShippingSnapshot(null)).toBeNull();
    expect(parseShippingSnapshot('x')).toBeNull();
  });

  it('невідомий provider дає null', () => {
    expect(
      parseShippingSnapshot({ ...pickup, provider: 'np:warehouse' }),
    ).toBeNull();
  });

  it("pricing 'plugin' дає null", () => {
    expect(parseShippingSnapshot({ ...pickup, pricing: 'plugin' })).toBeNull();
  });

  it('точка без імені або з невідомим kind дає null', () => {
    expect(
      parseShippingSnapshot({
        ...pickup,
        destination: { ...pickup.destination, name: undefined },
      }),
    ).toBeNull();
    expect(
      parseShippingSnapshot({ ...pickup, destination: { kind: 'locker' } }),
    ).toBeNull();
  });

  // Сміття в jsonb (ручні правки, старі рядки) — читач отримує null, не падає.
  it.each([
    ['address — число', { kind: 'address', city: 'Львів', address: 5 }],
    ['destination — null', null],
    // Масив із полями точки: без `Array.isArray` у guard-і пройшов би.
    ['destination — масив', Object.assign([], pickup.destination)],
    ['pointId — не рядок', { ...pickup.destination, pointId: 42 }],
  ])('%s дає null', (_case, destination) => {
    expect(parseShippingSnapshot({ ...pickup, destination })).toBeNull();
  });

  // Знеособлення (Е6г-10): `kind` лишається, `city`/`address` обнулені.
  it('приймає знеособлену адресу: city null, address null', () => {
    const snap = {
      methodName: 'Кур’єр',
      provider: 'core:address',
      pricing: 'carrier',
      destination: { kind: 'address', city: null, address: null },
    };
    expect(parseShippingSnapshot(snap)).toEqual(snap);
  });

  it('city не рядок і не null (5) дає null', () => {
    expect(
      parseShippingSnapshot({
        methodName: 'Кур’єр',
        provider: 'core:address',
        pricing: 'carrier',
        destination: { kind: 'address', city: 5, address: null },
      }),
    ).toBeNull();
  });

  it('тип запису забороняє city: null (послаблена лише читальна сторона)', () => {
    const write: NewShippingSnapshot = {
      methodName: 'Кур’єр',
      provider: 'core:address',
      pricing: 'carrier',
      // @ts-expect-error — запис знімка вимагає непорожній рядок city
      destination: { kind: 'address', city: null, address: null },
    };
    expect(write.destination.kind).toBe('address');
  });
});
