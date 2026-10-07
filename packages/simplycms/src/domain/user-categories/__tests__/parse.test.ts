import { describe, expect, it } from 'vitest';
import {
  CATEGORY_RULE_FIELD_OPERATORS,
  parseCategoryRuleConditions,
} from '../parse';

const rule = (field: string, operator: string, value: unknown = '1') => ({
  field,
  operator,
  value,
});

describe('parseCategoryRuleConditions — ручний guard умов правила', () => {
  it('валідні умови → нормалізований обʼєкт (зайві ключі відкинуто)', () => {
    expect(
      parseCategoryRuleConditions({
        type: 'any',
        extra: true,
        rules: [{ ...rule('orders_count', '>=', '2'), note: 'x' }],
      }),
    ).toEqual({
      type: 'any',
      rules: [{ field: 'orders_count', operator: '>=', value: '2' }],
    });
  });

  it('ред.2: порожнє правило (rules: []) → null (fail-closed)', () => {
    expect(parseCategoryRuleConditions({ type: 'all', rules: [] })).toBeNull();
  });

  it('ред.5: auth_provider contains goog → null (лише оператор =)', () => {
    expect(
      parseCategoryRuleConditions({
        type: 'all',
        rules: [rule('auth_provider', 'contains', 'goog')],
      }),
    ).toBeNull();
    expect(
      parseCategoryRuleConditions({
        type: 'all',
        rules: [rule('auth_provider', '=', 'google')],
      }),
    ).not.toBeNull();
  });

  it.each([
    ['total_purchases', ['>=', '>', '<=', '<', '=']],
    ['orders_count', ['>=', '>', '<=', '<', '=']],
    ['registration_days', ['>=', '>', '<=', '<', '=']],
    ['email_domain', ['=', 'contains']],
    ['utm_source', ['=', 'contains']],
    ['utm_campaign', ['=', 'contains']],
    ['auth_provider', ['=']],
  ])('ред.5: допустимі оператори поля %s — рівно %j', (field, operators) => {
    expect(
      CATEGORY_RULE_FIELD_OPERATORS[
        field as keyof typeof CATEGORY_RULE_FIELD_OPERATORS
      ],
    ).toEqual(operators);
    for (const op of ['>=', '>', '<=', '<', '=', 'contains']) {
      const parsed = parseCategoryRuleConditions({
        type: 'all',
        rules: [rule(field, op, '5')],
      });
      expect(parsed === null).toBe(!operators.includes(op));
    }
  });

  it.each([
    ['не обʼєкт', 'all'],
    ['null', null],
    ['невідомий режим', { type: 'some', rules: [rule('orders_count', '>=')] }],
    ['без режиму', { rules: [rule('orders_count', '>=')] }],
    ['rules не масив', { type: 'all', rules: {} }],
    ['невідоме поле', { type: 'all', rules: [rule('karma', '=')] }],
    [
      'значення не рядок',
      { type: 'all', rules: [rule('orders_count', '>=', 2)] },
    ],
    [
      'порожнє значення',
      { type: 'all', rules: [rule('email_domain', '=', ' ')] },
    ],
    [
      'числове поле з текстом',
      { type: 'all', rules: [rule('orders_count', '>=', 'два')] },
    ],
    ['умова не обʼєкт', { type: 'all', rules: ['orders_count'] }],
    [
      'понад 20 умов',
      {
        type: 'all',
        rules: Array.from({ length: 21 }, () => rule('orders_count', '>=')),
      },
    ],
  ])('%s → null', (_label, json) => {
    expect(parseCategoryRuleConditions(json)).toBeNull();
  });
});
