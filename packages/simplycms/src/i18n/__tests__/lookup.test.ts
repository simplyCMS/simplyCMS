import { describe, expect, it } from 'vitest';
import { lookupMessage } from '../lookup';

describe('lookupMessage (І42): єдиний ланцюг каталогів', () => {
  it('перший каталог, що має ключ, виграє', () => {
    expect(lookupMessage([{ k: 'перший' }, { k: 'другий' }], 'k')).toBe(
      'перший',
    );
  });

  it('ключ лише в другому каталозі — значення другого; undefined-каталог пропускається', () => {
    expect(lookupMessage([{}, { k: 'другий' }], 'k')).toBe('другий');
    expect(lookupMessage([undefined, { k: 'другий' }], 'k')).toBe('другий');
  });

  it('ключа немає ніде — сам ключ', () => {
    expect(lookupMessage([{ a: 'x' }, undefined], 'k')).toBe('k');
    expect(lookupMessage([], 'k')).toBe('k');
  });

  it('підставляє {n} у знайдений шаблон', () => {
    expect(lookupMessage([{ k: 'Товари ({n})' }], 'k', { n: 3 })).toBe(
      'Товари (3)',
    );
  });
});
