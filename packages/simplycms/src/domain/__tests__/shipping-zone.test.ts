import { describe, expect, it } from 'vitest';
import { resolveShippingZone } from '../shipping-zone';

const MAIN = { id: 'main', is_default: true };
const K = { id: 'k', is_default: false };
const zones = [K, MAIN];

describe('resolveShippingZone', () => {
  it('адресна доставка → основна зона (місто на зону не впливає)', () => {
    expect(resolveShippingZone(zones, { kind: 'address' })).toBe(MAIN);
  });

  it('самовивіз з zoneId null → основна зона', () => {
    expect(
      resolveShippingZone(zones, { kind: 'pickup-point', zoneId: null }),
    ).toBe(MAIN);
  });

  it('самовивіз з zoneId серед зон → саме ця зона', () => {
    expect(
      resolveShippingZone(zones, { kind: 'pickup-point', zoneId: 'k' }),
    ).toBe(K);
  });

  it('самовивіз з zoneId поза активними зонами (Р6) → null', () => {
    expect(
      resolveShippingZone(zones, { kind: 'pickup-point', zoneId: 'gone' }),
    ).toBeNull();
  });

  it('довідник без основної зони → null, а не перша-ліпша', () => {
    expect(resolveShippingZone([K], { kind: 'address' })).toBeNull();
  });
});
