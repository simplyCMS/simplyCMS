// Тема 12: Zod-відмова на межі адмін-serverFn → ValidationError (400) з issues
// крізь білий список. Перетин самої межі serverFn — runtime/__tests__/
// domain-error-adapter.test.ts; тут — серверне перетворення.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const status = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock('@tanstack/react-start/server', () => ({
  setResponseStatus: status.set,
}));

import { adminInput, parseAdminInput } from '../validation';
import { ValidationError } from '../errors';
import { saveStockInput } from '../stock/save';

const PRODUCT = '0e300000-0000-4000-8000-000000000011';
const POINT = '0e300000-0000-4000-8000-000000000012';

function catchError(fn: () => unknown): ValidationError {
  try {
    fn();
  } catch (e) {
    return e as ValidationError;
  }
  throw new Error('очікувалась помилка');
}

describe('parseAdminInput / adminInput', () => {
  beforeEach(() => status.set.mockClear());

  it('валідний вхід — повертає розібране значення, статус не чіпає', () => {
    const v = adminInput(z.object({ n: z.coerce.number() }));
    expect(v({ n: '3' } as never)).toEqual({ n: 3 });
    expect(status.set).not.toHaveBeenCalled();
  });

  it('залишок 1 000 001 → ValidationError(400) з path/code/params, без сирого тексту', () => {
    const err = catchError(() =>
      adminInput(saveStockInput)({
        productId: PRODUCT,
        modificationId: null,
        quantities: [{ pickupPointId: POINT, quantity: 1_000_001 }],
      }),
    );
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.name).toBe('ValidationError');
    expect(status.set).toHaveBeenCalledWith(400);
    expect(err.issues).toEqual([
      {
        path: ['quantities', 0, 'quantity'],
        code: 'too_big',
        params: { origin: 'number', maximum: 1_000_000 },
      },
    ]);
    // Жодних сирих повідомлень Zod у payload і в `message`.
    expect(JSON.stringify(err.issues)).not.toMatch(/Too big|expected/i);
    expect(err.message).not.toMatch(/1000001/);
  });

  it('відлуння вводу не потрапляє в issues', () => {
    const err = catchError(() =>
      parseAdminInput(z.object({ email: z.email() }), {
        email: 'таємний-ввід-користувача',
      }),
    );
    expect(err.issues).toEqual([
      {
        path: ['email'],
        code: 'invalid_format',
        params: { format: 'email', origin: 'string' },
      },
    ]);
    expect(JSON.stringify(err)).not.toContain('таємний');
  });

  it('refine на об’єкті (без поля) → issue з порожнім path', () => {
    const err = catchError(() =>
      adminInput(saveStockInput)({
        productId: null,
        modificationId: null,
        quantities: [{ pickupPointId: POINT, quantity: 1 }],
      }),
    );
    expect(err.issues).toEqual([{ path: [], code: 'custom' }]);
  });

  it('Zod-помилка НЕ просочується сирою: кидається лише ValidationError', () => {
    const err = catchError(() => adminInput(z.string())(5 as never));
    expect(err).not.toBeInstanceOf(z.ZodError);
    expect(err).toBeInstanceOf(ValidationError);
  });
});
