import { describe, expect, it } from 'vitest';
import { conditionsMatch } from '../conditions';
import type {
  CategoryRuleCondition,
  CategoryRuleConditions,
  UserCategoryStats,
} from '../types';

// Базова статистика — кожен тест перевизначає лише потрібне поле.
const baseStats: UserCategoryStats = {
  totalPurchases: 0,
  ordersCount: 0,
  registrationDays: 0,
  emailDomain: null,
  authProviders: [],
  utmSource: null,
  utmCampaign: null,
};

const conditions = (
  rules: readonly CategoryRuleCondition[],
  type: CategoryRuleConditions['type'] = 'all',
): CategoryRuleConditions => ({ type, rules });

describe('conditionsMatch — числові поля (>=, >, <=, <, =)', () => {
  it.each([
    ['>=', 100, 100, true],
    ['>=', 100, 99, false],
    ['>', 100, 101, true],
    ['>', 100, 100, false],
    ['<=', 100, 100, true],
    ['<=', 100, 101, false],
    ['<', 100, 99, true],
    ['<', 100, 100, false],
    ['=', 100, 100, true],
    ['=', 100, 100.01, false],
  ] as const)(
    'total_purchases %s %d при значенні %d → %s',
    (operator, ruleValue, statValue, expected) => {
      const stats = { ...baseStats, totalPurchases: statValue };
      const result = conditionsMatch(
        conditions([
          { field: 'total_purchases', operator, value: String(ruleValue) },
        ]),
        stats,
      );
      expect(result).toBe(expected);
    },
  );

  it('registration_days і orders_count підтримують ті самі оператори', () => {
    const stats = { ...baseStats, registrationDays: 30, ordersCount: 5 };
    expect(
      conditionsMatch(
        conditions([
          { field: 'registration_days', operator: '>=', value: '30' },
          { field: 'orders_count', operator: '<', value: '10' },
        ]),
        stats,
      ),
    ).toBe(true);
  });

  it('непарсибельне значення → умова хибна (fail-closed, без винятку)', () => {
    const broken = conditions([
      { field: 'total_purchases', operator: '>=', value: 'not-a-number' },
    ]);
    expect(() => conditionsMatch(broken, baseStats)).not.toThrow();
    expect(conditionsMatch(broken, baseStats)).toBe(false);
  });
});

describe('conditionsMatch — текстові поля (=, contains)', () => {
  it('email_domain = і contains', () => {
    const stats = { ...baseStats, emailDomain: 'corp.example.com' };
    const match = (operator: '=' | 'contains', value: string) =>
      conditionsMatch(
        conditions([{ field: 'email_domain', operator, value }]),
        stats,
      );
    expect(match('=', 'corp.example.com')).toBe(true);
    expect(match('=', 'example.com')).toBe(false);
    expect(match('contains', 'example')).toBe(true);
  });

  it('utm_source/utm_campaign: = і contains; мітки немає (null) → false', () => {
    const utm = conditions([
      { field: 'utm_source', operator: '=', value: 'google' },
      { field: 'utm_campaign', operator: 'contains', value: 'summer' },
    ]);
    const stats = {
      ...baseStats,
      utmSource: 'google',
      utmCampaign: 'summer-1',
    };
    expect(conditionsMatch(utm, stats)).toBe(true);
    expect(conditionsMatch(utm, baseStats)).toBe(false);
  });
});

describe('conditionsMatch — auth_provider (Е6в-19)', () => {
  const google = conditions([
    { field: 'auth_provider', operator: '=', value: 'google' },
  ]);

  it.each([
    [['credential', 'google'], true],
    [['credential'], false],
  ])(
    'auth_provider = google при authProviders %j → %s',
    (providers, expected) => {
      expect(
        conditionsMatch(google, { ...baseStats, authProviders: providers }),
      ).toBe(expected);
    },
  );
});

describe('conditionsMatch — режими any/all і порожнє правило (Е6в-19)', () => {
  const stats = { ...baseStats, totalPurchases: 500, ordersCount: 3 };
  const oneOfTwo: CategoryRuleCondition[] = [
    { field: 'total_purchases', operator: '>=', value: '100' },
    { field: 'orders_count', operator: '>=', value: '10' }, // не виконано
  ];

  it('any: дві умови, виконана одна → правило спрацювало (АБО)', () => {
    expect(conditionsMatch(conditions(oneOfTwo, 'any'), stats)).toBe(true);
  });

  it('all: дві умови, виконана одна → ні (І)', () => {
    expect(conditionsMatch(conditions(oneOfTwo, 'all'), stats)).toBe(false);
  });

  it('any: жодна не виконана → ні', () => {
    expect(conditionsMatch(conditions(oneOfTwo, 'any'), baseStats)).toBe(false);
  });

  it('ред.2: порожнє правило (rules: []) → false в обох режимах (fail-closed)', () => {
    expect(conditionsMatch(conditions([], 'all'), stats)).toBe(false);
    expect(conditionsMatch(conditions([], 'any'), stats)).toBe(false);
  });
});
