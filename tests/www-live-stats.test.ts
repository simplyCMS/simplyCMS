import { describe, expect, it } from 'vitest';
import {
  aggregateNpmSearch,
  computeTsShare,
  formatGrouped,
  isPlatformPackage,
  skeletonFor,
  type NpmSearchObject,
} from '../apps/www/src/lib/live-stats';

/**
 * Агрегатори живих метрик лендінга (apps/www). Форма фікстур — реальна
 * відповідь registry.npmjs.org/-/v1/search (звірено 2026-08-15): downloads
 * лежить ПОРУЧ із package, не всередині нього.
 */

function obj(name: string, version: string, monthly?: number): NpmSearchObject {
  return {
    package: { name, version },
    ...(monthly === undefined ? {} : { downloads: { monthly } }),
  };
}

describe('isPlatformPackage', () => {
  it('впізнає scoped-пакети ядра і unscoped-скаффолдер', () => {
    expect(isPlatformPackage('@simplycms/cli')).toBe(true);
    expect(isPlatformPackage('create-simplycms-store')).toBe(true);
  });

  it('відсікає сторонні пакети з видачі пошуку', () => {
    expect(isPlatformPackage('simplycms-theme-aurora')).toBe(false);
    expect(isPlatformPackage('@acme/simplycms-plugin-faq')).toBe(false);
    expect(isPlatformPackage('simplycms')).toBe(false);
  });
});

describe('aggregateNpmSearch', () => {
  it('рахує лише пакети платформи: кількість, суму downloads, версію', () => {
    const stats = aggregateNpmSearch([
      obj('@simplycms/objects', '0.3.0', 1008),
      obj('@simplycms/cli', '0.3.0', 0),
      obj('create-simplycms-store', '0.3.0', 433),
      obj('simplycms-theme-thirdparty', '9.9.9', 77777),
    ]);
    expect(stats.packageCount).toBe(3);
    expect(stats.monthlyDownloads).toBe(1441);
    expect(stats.version).toBe('0.3.0');
    expect(stats.packages.map((p) => p.name)).not.toContain(
      'simplycms-theme-thirdparty',
    );
  });

  it('версія — найчастіша серед пакетів (хвіст CDN-кеша не перемагає)', () => {
    const stats = aggregateNpmSearch([
      obj('@simplycms/a', '0.4.0', 1),
      obj('@simplycms/b', '0.4.0', 1),
      obj('@simplycms/c', '0.3.0', 1),
    ]);
    expect(stats.version).toBe('0.4.0');
  });

  it('без поля downloads сума — null (стат ховається, а не бреше нулем)', () => {
    const stats = aggregateNpmSearch([
      obj('@simplycms/a', '0.3.0'),
      obj('@simplycms/b', '0.3.0'),
    ]);
    expect(stats.monthlyDownloads).toBeNull();
  });

  it('порожня видача → нульовий підсумок без падіння', () => {
    const stats = aggregateNpmSearch([]);
    expect(stats.packageCount).toBe(0);
    expect(stats.version).toBeNull();
    expect(stats.monthlyDownloads).toBeNull();
  });
});

describe('computeTsShare', () => {
  it('частка TypeScript у відсотках з одним знаком', () => {
    expect(computeTsShare({ TypeScript: 997, CSS: 3 })).toBe(99.7);
  });

  it('порожня мапа мов → null', () => {
    expect(computeTsShare({})).toBeNull();
  });
});

describe('formatGrouped / skeletonFor', () => {
  it('en-US групування і скелетон тієї ж ширини', () => {
    expect(formatGrouped(15429)).toBe('15,429');
    expect(skeletonFor(15429)).toBe('00,000');
    expect(skeletonFor(7)).toBe('0');
  });
});
