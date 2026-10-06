import { describe, it, expect } from 'vitest';
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
});
