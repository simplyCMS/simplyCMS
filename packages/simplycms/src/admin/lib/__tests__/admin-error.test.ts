import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminErrorKey } from '../admin-error';

const conflict = (kind: string, constraint: string | null) =>
  Object.assign(new Error('x'), {
    name: 'AdminConflictError',
    kind,
    constraint,
  });

describe('adminErrorKey', () => {
  it('slug — окремий ключ, бо власник виправляє саме поле URL', () => {
    expect(adminErrorKey(conflict('unique', 'products_slug_key'))).toBe(
      'admin.errors.slugTaken',
    );
    // 🔴 Реальні імена (schema.ts:424,446): друге — НЕ за конвенцією *_slug_key.
    expect(
      adminErrorKey(
        conflict('unique', 'product_modifications_product_slug_unique'),
      ),
    ).toBe('admin.errors.slugTaken');
  });
  it('інша унікальність — загальний ключ', () => {
    expect(adminErrorKey(conflict('unique', 'x_key'))).toBe(
      'admin.errors.conflictUnique',
    );
  });
  it('посилання — «є в замовленнях, деактивуйте»', () => {
    expect(
      adminErrorKey(conflict('reference', 'order_items_product_id_fkey')),
    ).toBe('admin.errors.conflictReference');
  });
  it('не конфлікт — null (викликач показує свій загальний тост)', () => {
    expect(adminErrorKey(new Error('boom'))).toBeNull();
    expect(adminErrorKey(undefined)).toBeNull();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('TypeError фейлу fetch (Chrome/Firefox/Safari) — мережевий ключ', () => {
    expect(adminErrorKey(new TypeError('Failed to fetch'))).toBe(
      'admin.errors.network',
    );
    expect(
      adminErrorKey(
        new TypeError('NetworkError when attempting to fetch resource.'),
      ),
    ).toBe('admin.errors.network');
    expect(adminErrorKey(new TypeError('Load failed'))).toBe(
      'admin.errors.network',
    );
  });

  it('голий TypeError без мережевого повідомлення — НЕ мережа', () => {
    expect(adminErrorKey(new TypeError('x is not a function'))).toBeNull();
  });

  it('офлайн (navigator.onLine === false) — мережевий ключ незалежно від тексту', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(adminErrorKey(new Error('щось зламалось'))).toBe(
      'admin.errors.network',
    );
  });
});
