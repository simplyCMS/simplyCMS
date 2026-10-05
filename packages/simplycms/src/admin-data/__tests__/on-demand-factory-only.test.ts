import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Е3-17: структурний гейт фабрики. Жоден файл `admin-data/collections/**`
 * не ставить `syncMode` НАПРЯМУ (рядок лишається лише у самій фабриці,
 * `on-demand-options.ts`) — інакше нова on-demand колекція могла б забути
 * індекс сортування (TSDB-2) та інші інваріанти фабрики.
 */
const COLLECTIONS_DIR = resolve(import.meta.dirname, '../collections');

describe('Е3-17: syncMode лише у фабриці', () => {
  it('жоден файл collections/** не містить syncMode напряму', () => {
    const offenders: string[] = [];
    for (const name of readdirSync(COLLECTIONS_DIR)) {
      if (!name.endsWith('.ts')) continue;
      const src = readFileSync(resolve(COLLECTIONS_DIR, name), 'utf8');
      if (/\bsyncMode\s*:/.test(src)) offenders.push(name);
    }
    expect(offenders).toEqual([]);
  });

  it('11 on-demand колекцій ідуть через onDemandCollectionOptions (Е5: + orders, order_items)', () => {
    let count = 0;
    for (const name of readdirSync(COLLECTIONS_DIR)) {
      if (!name.endsWith('.ts')) continue;
      const src = readFileSync(resolve(COLLECTIONS_DIR, name), 'utf8');
      if (src.includes('onDemandCollectionOptions')) count++;
    }
    expect(count).toBe(11);
  });
});
