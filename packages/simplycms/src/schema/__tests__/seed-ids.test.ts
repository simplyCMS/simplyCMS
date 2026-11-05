import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SYSTEM_SEED_IDS } from '../seed-ids';

const read = (rel: string): string =>
  readFileSync(resolve(__dirname, '../../../../..', rel), 'utf8');

// Id основної зони в двох місцях (TS і node-скрипт без збірки): розсинхрон мовчки
// зламав би live-smoke, тож рівність стережемо тестом. Сам сід зони тепер у
// `bootstrapStore`, його доводить `bootstrap-store.test.ts`.
describe('SYSTEM_SEED_IDS.mainShippingZone', () => {
  it('збігається з константою live-smoke', () => {
    expect(read('scripts/live-smoke/admin-shipping-sql.mjs')).toContain(
      `const MAIN_SHIPPING_ZONE_ID = '${SYSTEM_SEED_IDS.mainShippingZone}';`,
    );
  });
});

describe('SYSTEM_SEED_IDS', () => {
  it('усі id унікальні', () => {
    const { orderStatuses, ...rest } = SYSTEM_SEED_IDS;
    const all = [...Object.values(orderStatuses), ...Object.values(rest)];
    expect(new Set(all).size).toBe(all.length);
  });
});
