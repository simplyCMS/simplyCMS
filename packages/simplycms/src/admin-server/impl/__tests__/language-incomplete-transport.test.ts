// Фінальне рев'ю М1 (I-1, UX власника): відмова `language_incomplete` називає товар і етап,
// і ці деталі переживають ОБИДВА транспорти — problem+json `/api/v1` (лише path і code)
// і межу serverFn: її адаптер (`runtime/domain-error-adapter`) пропускає issues лише через
// білий список `sanitizeValidationIssues` з обох боків (саму межу seroval для ValidationError
// доводить `domain-error-adapter.test.ts`; імпорт адаптера сюди заборонено тір-зоною).
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sanitizeValidationIssues } from 'simplycms/contracts/domain-errors';
import { toProblem } from '../../../operations/http/problem';
import {
  INCOMPLETE_SAMPLE,
  languageIncompleteError,
} from '../languages/completeness';

const product = randomUUID();
const other = randomUUID();
const error = () =>
  languageIncompleteError([
    { productId: product, stage: 'projection' },
    { productId: other, stage: 'path' },
  ]);
const expected = [
  { path: ['status'], code: 'language_incomplete' },
  { path: ['products', product, 'projection'], code: 'language_incomplete' },
  { path: ['products', other, 'path'], code: 'language_incomplete' },
];

describe('language_incomplete: товар і етап у відмові (I-1)', () => {
  it('problem+json /api/v1: errors несуть id товару й етап', () => {
    const { status, body } = toProblem(error(), 'languages.setStatus');
    expect(status).toBe(400);
    expect((body as { errors?: unknown }).errors).toEqual(expected);
  });

  it('serverFn: білий список адаптера пропускає id товару й етап без втрат', () => {
    expect(sanitizeValidationIssues(error().issues)).toEqual(expected);
  });

  it('межа прикладів вміщається в білий список (до 50 проблем)', () => {
    const items = Array.from({ length: INCOMPLETE_SAMPLE }, () => ({
      productId: randomUUID(),
      stage: 'token' as const,
    }));
    const issues = languageIncompleteError(items).issues;
    expect(sanitizeValidationIssues(issues)).toEqual(issues);
  });
});
