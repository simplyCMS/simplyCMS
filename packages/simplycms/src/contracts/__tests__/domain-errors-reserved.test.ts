import { describe, expect, it } from 'vitest';
import {
  sanitizeValidationIssues,
  VALIDATION_ISSUE_CODES,
} from '../domain-errors';

// М1 Task 5: `reserved` — код поля, яке дорівнює службовому сегменту, коду мови
// чи імені з public/ (І19). Його знає лише операція запису адреси.
describe('domain-errors: код reserved', () => {
  it('є в переліку кодів і проходить білий список', () => {
    expect(VALIDATION_ISSUE_CODES).toContain('reserved');
    expect(
      sanitizeValidationIssues([{ path: ['path'], code: 'reserved' }]),
    ).toEqual([{ path: ['path'], code: 'reserved' }]);
  });
});
