import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_VERSION, satisfies } from '../semver/index';

describe('satisfies', () => {
  it('точна версія — лише повний збіг', () => {
    expect(satisfies('1.2.3', '1.2.3')).toBe(true);
    expect(satisfies('1.2.4', '1.2.3')).toBe(false);
  });

  it('^ на 1.x — мажор фіксований', () => {
    expect(satisfies('1.9.0', '^1.2.3')).toBe(true);
    expect(satisfies('2.0.0', '^1.2.3')).toBe(false);
    expect(satisfies('1.2.2', '^1.2.3')).toBe(false);
  });

  it('^ на 0.x — мінор фіксований (стандартна semver-семантика)', () => {
    expect(satisfies('0.1.5', '^0.1.0')).toBe(true);
    // Саме цей кейс змусив перевести маніфести тем на `>=`: ^0.1.0 не
    // покриває ядро 0.3.0.
    expect(satisfies('0.3.0', '^0.1.0')).toBe(false);
    expect(satisfies('0.0.4', '^0.0.3')).toBe(false);
    expect(satisfies('0.0.3', '^0.0.3')).toBe(true);
  });

  it('~ — фіксує мажор і мінор', () => {
    expect(satisfies('1.2.9', '~1.2.3')).toBe(true);
    expect(satisfies('1.3.0', '~1.2.3')).toBe(false);
  });

  it('>= — нижня межа без верхньої', () => {
    expect(satisfies('0.3.0', '>=0.1.0')).toBe(true);
    expect(satisfies('2.0.0', '>=0.1.0')).toBe(true);
    expect(satisfies('0.0.9', '>=0.1.0')).toBe(false);
  });

  it('невалідні вхідні — виняток, а не мовчазне false', () => {
    expect(() => satisfies('abc', '^1.0.0')).toThrow(/Невалідна/);
    expect(() => satisfies('1.0.0', '^1.0')).toThrow(/Невалідна/);
    expect(() => satisfies('1.0.0', '>=1.0.0 <2.0.0')).toThrow(/Невалідна/);
  });
});

describe('satisfies: пре-релізи лінії rc', () => {
  it('^1.0.0-0 приймає RC, фінальний 1.0.0 і 1.x', () => {
    expect(satisfies('1.0.0-rc.1', '^1.0.0-0')).toBe(true);
    expect(satisfies('1.0.0-rc.10', '^1.0.0-0')).toBe(true);
    expect(satisfies('1.0.0', '^1.0.0-0')).toBe(true);
    expect(satisfies('1.7.0', '^1.0.0-0')).toBe(true);
  });

  it('^1.0.0-0 відкидає наступну мажорну (і її RC) та 0.x', () => {
    expect(satisfies('2.0.0-rc.1', '^1.0.0-0')).toBe(false);
    expect(satisfies('2.0.0', '^1.0.0-0')).toBe(false);
    expect(satisfies('0.14.0', '^1.0.0-0')).toBe(false);
  });

  it('^1.0.0 без -0 пре-релізів НЕ приймає (згода на RC — явна)', () => {
    expect(satisfies('1.0.0-rc.1', '^1.0.0')).toBe(false);
    expect(satisfies('1.0.0', '^1.0.0')).toBe(true);
  });

  it('~ і >= теж не пускають пре-реліз без пре-релізної бази', () => {
    expect(satisfies('1.0.0-rc.1', '~1.0.0')).toBe(false);
    expect(satisfies('1.0.0-rc.1', '>=0.1.0')).toBe(false);
    expect(satisfies('1.0.0-rc.2', '>=1.0.0-rc.1')).toBe(true);
  });

  it('порядок: -0 < rc.1 < rc.2 < rc.10 < реліз; точний збіг', () => {
    expect(satisfies('1.0.0-rc.1', '>=1.0.0-0')).toBe(true);
    expect(satisfies('1.0.0-rc.9', '>=1.0.0-rc.10')).toBe(false);
    expect(satisfies('1.0.0-rc.1', '1.0.0-rc.1')).toBe(true);
    expect(satisfies('1.0.0-rc.2', '1.0.0-rc.1')).toBe(false);
  });

  it('інші пре-релізи й провідні нулі — невалідні', () => {
    expect(() => satisfies('1.0.0-beta.1', '^1.0.0-0')).toThrow(/Невалідна/);
    expect(() => satisfies('1.0.0-rc.01', '^1.0.0-0')).toThrow(/Невалідна/);
  });
});

describe('CORE_VERSION', () => {
  it('дорівнює version у package.json пакета (синхронна модель версій)', () => {
    // Розсинхрон означає, що бамп пройшов повз scripts/release/bump.mjs —
    // константу оновлює саме він.
    const manifest = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf8'),
    ) as { version: string };
    expect(CORE_VERSION).toBe(manifest.version);
  });
});
