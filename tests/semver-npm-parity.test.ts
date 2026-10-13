import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { satisfies } from '../packages/simplycms/src/contracts/semver/index';

// `satisfies` — власна мінімальна реалізація; еталон поведінки — npm-semver
// (devDependency лише для цього тесту). `require`: у пакета немає типів.
const npm = createRequire(import.meta.url)('semver') as {
  satisfies: (version: string, range: string) => boolean;
};

const VERSIONS = [
  '0.14.0',
  '0.14.1',
  '0.15.0',
  '1.0.0-rc.1',
  '1.0.0-rc.2',
  '1.0.0-rc.10',
  '1.0.0',
  '1.7.0',
  '1.1.0-rc.1',
  '2.0.0-rc.1',
  '2.0.0',
];
const RANGES = [
  '^1.0.0-0',
  '^1.0.0',
  '^1.1.0-0',
  '^0.14.0',
  '~1.0.0',
  '~1.0.0-0',
  '>=1.0.0-rc.1',
  '>=1.0.0-0',
  '>=0.1.0',
  '>=1.0.0',
  '1.0.0-rc.1',
  '1.0.0',
];

describe('satisfies ≡ npm-semver на матриці версій × діапазонів', () => {
  for (const range of RANGES) {
    it(`діапазон ${range}`, () => {
      for (const version of VERSIONS) {
        expect(satisfies(version, range), `${version} vs ${range}`).toBe(
          npm.satisfies(version, range),
        );
      }
    });
  }

  it('п’ять колишніх розбіжностей зникли', () => {
    const pairs: [string, string][] = [
      ['1.1.0-rc.1', '^1.0.0-0'],
      ['1.1.0-rc.1', '>=1.0.0-rc.1'],
      ['2.0.0-rc.1', '>=1.0.0-rc.1'],
      ['1.1.0-rc.1', '>=1.0.0-0'],
      ['2.0.0-rc.1', '>=1.0.0-0'],
    ];
    for (const [v, r] of pairs) expect(satisfies(v, r)).toBe(false);
  });
});
