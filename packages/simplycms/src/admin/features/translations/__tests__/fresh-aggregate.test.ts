import { describe, expect, it } from 'vitest';
import { freshAggregate } from '../fresh-aggregate';

describe('freshAggregate', () => {
  it('успішне перечитування → дані', () => {
    expect(freshAggregate({ status: 'success', data: { v: 2 } })).toEqual({
      v: 2,
    });
  });

  it('збій перечитування зі СТАРИМИ data (поведінка TanStack) → undefined', () => {
    expect(freshAggregate({ status: 'error', data: { v: 1 } })).toBeUndefined();
  });
});
