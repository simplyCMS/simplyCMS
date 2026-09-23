import { describe, expect, it } from 'vitest';
import {
  DOMAIN_ERROR_FIELD_KEYS,
  DOMAIN_ERROR_NAME,
  isDomainErrorName,
} from '../domain-errors';

describe('isDomainErrorName', () => {
  it('визнає обидва імені закритого переліку', () => {
    expect(isDomainErrorName('AdminConflictError')).toBe(true);
    expect(isDomainErrorName('AuthzError')).toBe(true);
  });

  it('відхиляє все, чого немає в переліку', () => {
    expect(isDomainErrorName('Error')).toBe(false);
    expect(isDomainErrorName('SomeOtherError')).toBe(false);
    expect(isDomainErrorName(undefined)).toBe(false);
    expect(isDomainErrorName(42)).toBe(false);
  });
});

describe('DOMAIN_ERROR_FIELD_KEYS', () => {
  it('має запис для кожного імені з DOMAIN_ERROR_NAME', () => {
    for (const name of Object.values(DOMAIN_ERROR_NAME))
      expect(DOMAIN_ERROR_FIELD_KEYS[name]).toBeDefined();
  });

  it('AdminConflictError несе kind і constraint, AuthzError — operation', () => {
    expect(DOMAIN_ERROR_FIELD_KEYS[DOMAIN_ERROR_NAME.adminConflict]).toEqual([
      'kind',
      'constraint',
    ]);
    expect(DOMAIN_ERROR_FIELD_KEYS[DOMAIN_ERROR_NAME.authz]).toEqual([
      'operation',
    ]);
  });
});
