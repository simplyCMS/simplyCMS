import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAIN_SHIPPING_ZONE_ID } from '../seed-ids';

const read = (rel: string): string =>
  readFileSync(resolve(__dirname, '../../../../..', rel), 'utf8');

// Один id у трьох місцях (TS, SQL-сід, node-скрипт без збірки): розсинхрон
// мовчки зламав би live-smoke або сід, тож рівність стережемо тестом.
describe('MAIN_SHIPPING_ZONE_ID', () => {
  it('збігається з сідом міграції', () => {
    expect(read('packages/simplycms/migrations/0003_seed.sql')).toContain(
      `('${MAIN_SHIPPING_ZONE_ID}', 'Основна зона'`,
    );
  });

  it('збігається з константою live-smoke', () => {
    expect(read('scripts/live-smoke/admin-shipping-sql.mjs')).toContain(
      `const MAIN_SHIPPING_ZONE_ID = '${MAIN_SHIPPING_ZONE_ID}';`,
    );
  });
});
