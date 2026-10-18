import { describe, expect, it } from 'vitest';
import {
  isCheckViolation,
  isForeignKeyViolation,
  isUniqueViolation,
  pgErrorInfo,
  toAdminConflict,
} from '../pg-errors';

// Drizzle перезагортає помилку драйвера: код і обмеження — у `.cause`
// (UPSTREAM:DRZ-1). Один розбір обслуговує всі три предикати.
const wrapped = (code: string, constraint?: string) =>
  Object.assign(new Error('Failed query: …'), {
    cause: Object.assign(new Error('driver'), { code, constraint }),
  });

describe('pg-errors (єдиний розбір DRZ-1)', () => {
  it('pgErrorInfo читає code/constraint із .cause, а за його відсутності — з самої помилки', () => {
    expect(pgErrorInfo(wrapped('23505', 'k'))).toEqual({
      code: '23505',
      constraint: 'k',
    });
    expect(pgErrorInfo({ code: '23503' }).code).toBe('23503');
    expect(pgErrorInfo(null)).toEqual({
      code: undefined,
      constraint: undefined,
    });
  });

  it('isUniqueViolation: лише 23505, за потреби — на названому обмеженні', () => {
    expect(isUniqueViolation(wrapped('23505', 'k'))).toBe(true);
    expect(isUniqueViolation(wrapped('23505', 'k'), 'k')).toBe(true);
    expect(isUniqueViolation(wrapped('23505', 'k'), 'other')).toBe(false);
    expect(isUniqueViolation(wrapped('23503'))).toBe(false);
  });

  it('isForeignKeyViolation: лише 23503, за потреби — на названому обмеженні', () => {
    expect(isForeignKeyViolation(wrapped('23503', 'fk'))).toBe(true);
    expect(isForeignKeyViolation(wrapped('23503', 'fk'), 'fk')).toBe(true);
    expect(isForeignKeyViolation(wrapped('23503', 'fk'), 'other')).toBe(false);
    expect(isForeignKeyViolation(wrapped('23505'))).toBe(false);
  });

  it('isCheckViolation: лише 23514, за потреби — на названому обмеженні', () => {
    expect(isCheckViolation(wrapped('23514', 'c'))).toBe(true);
    expect(isCheckViolation(wrapped('23514', 'c'), 'c')).toBe(true);
    expect(isCheckViolation(wrapped('23514', 'c'), 'other')).toBe(false);
    expect(isCheckViolation(wrapped('23505', 'c'), 'c')).toBe(false);
  });

  it('toAdminConflict: 23505 → unique, 23503 → reference, інакше null', () => {
    expect(toAdminConflict(wrapped('23505', 'k'))).toMatchObject({
      kind: 'unique',
      constraint: 'k',
    });
    expect(toAdminConflict(wrapped('23503', 'fk'))).toMatchObject({
      kind: 'reference',
    });
    expect(toAdminConflict(wrapped('42P01'))).toBeNull();
    expect(toAdminConflict(new Error('x'))).toBeNull();
  });
});
