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

  it('language_incomplete (публікація неповної мови) проходить білий список', () => {
    expect(
      sanitizeValidationIssues([
        { path: ['code'], code: 'language_incomplete' },
      ]),
    ).toEqual([{ path: ['code'], code: 'language_incomplete' }]);
  });
});

describe('domain-errors: код path_required', () => {
  it('є в переліку кодів і проходить білий список', () => {
    expect(VALIDATION_ISSUE_CODES).toContain('path_required');
    expect(
      sanitizeValidationIssues([{ path: ['path'], code: 'path_required' }]),
    ).toEqual([{ path: ['path'], code: 'path_required' }]);
  });
});
