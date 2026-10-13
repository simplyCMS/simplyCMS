import { describe, expect, it } from 'vitest';
import { coreRangeFor as cliCoreRangeFor } from '../packages/cli/src/core-range.mjs';
import { coreRangeFor } from '../packages/simplycms/src/contracts/semver/core-range';

// CLI не залежить від ядра, тож тримає вбудовану копію `coreRangeFor`.
// Розбіжність тихо дала б різні `engines` у `create` і в референс-пакетах.
describe('coreRangeFor: паритет ядра і вбудованої копії CLI', () => {
  const versions = [
    '0.0.3',
    '0.1.0',
    '0.14.0',
    '0.14.7',
    '1.0.0',
    '1.4.2',
    '2.0.0',
  ];

  it.each(versions)('%s: однаковий результат', (version) => {
    expect(cliCoreRangeFor(version)).toBe(coreRangeFor(version));
  });

  it('обидві кидають на невалідному рядку', () => {
    expect(() => cliCoreRangeFor('abc')).toThrow();
    expect(() => coreRangeFor('abc')).toThrow();
  });
});
