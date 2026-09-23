import { describe, expect, it } from 'vitest';
import { normalizeThrown } from '../normalize-thrown';

describe('normalizeThrown', () => {
  it('genuine Error — повертає той самий обʼєкт, властивості не чіпає', () => {
    const err = Object.assign(new Error('x'), { name: 'AdminConflictError' });
    expect(normalizeThrown(err)).toBe(err);
  });

  it('плоский обʼєкт — instanceof Error, властивості перенесено', () => {
    const raw = {
      name: 'AdminConflictError',
      message: '[admin-server] конфлікт unique: products_slug_key',
      kind: 'unique',
      constraint: 'products_slug_key',
    };
    const err = normalizeThrown(raw);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AdminConflictError');
    expect(err.message).toBe(
      '[admin-server] конфлікт unique: products_slug_key',
    );
    expect((err as unknown as typeof raw).kind).toBe('unique');
    expect((err as unknown as typeof raw).constraint).toBe('products_slug_key');
  });

  it('рядок/примітив — instanceof Error, message = String(value)', () => {
    expect(normalizeThrown('boom').message).toBe('boom');
    expect(normalizeThrown(undefined).message).toBe('undefined');
  });
});
