import { describe, expect, it } from 'vitest';
import { escapeLike } from '../search-for-order';

describe('escapeLike', () => {
  it('екранує \\, % і _; решту не чіпає', () => {
    expect(escapeLike('50%')).toBe('50\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('AB\\12')).toBe('AB\\\\12');
    expect(escapeLike('панель 450')).toBe('панель 450');
  });

  it('кінцевий \\ стає \\\\ — не екранує % шаблону', () => {
    expect(`%${escapeLike('x\\')}%`).toBe('%x\\\\%');
  });
});
