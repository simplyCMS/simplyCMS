import { describe, expect, it } from 'vitest';
import {
  sanitizeValidationIssues,
  VALIDATION_ISSUE_CODES,
} from '../domain-errors';

// Е6г-1: `taken` — код помилки поля, який знає лише операція (зайнятий email).
describe('domain-errors: код taken', () => {
  it('є в переліку кодів і проходить білий список', () => {
    expect(VALIDATION_ISSUE_CODES).toContain('taken');
    expect(
      sanitizeValidationIssues([{ path: ['email'], code: 'taken' }]),
    ).toEqual([{ path: ['email'], code: 'taken' }]);
  });
});
