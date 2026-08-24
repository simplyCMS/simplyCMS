import { describe, expect, it } from 'vitest';
import { conditionsMatch } from '../conditions';
import type { CategoryRuleConditions, UserCategoryStats } from '../types';

// Базова статистика — кожен тест перевизначає лише потрібне поле.
const baseStats: UserCategoryStats = {
  totalPurchases: 0,
  ordersCount: 0,
  registrationDays: 0,
  emailDomain: null,
  authProvider: null,
  utmSource: null,
  utmCampaign: null,
};

const conditions = (
  rules: CategoryRuleConditions['rules'],
  type: string = 'all',
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

  it('registration_days підтримує ті самі оператори', () => {
    const stats = { ...baseStats, registrationDays: 30 };
    expect(
      conditionsMatch(
        conditions([
          { field: 'registration_days', operator: '>=', value: '30' },
        ]),
        stats,
      ),
    ).toBe(true);
  });

  it('orders_count підтримує ті самі оператори', () => {
    const stats = { ...baseStats, ordersCount: 5 };
    expect(
      conditionsMatch(
        conditions([{ field: 'orders_count', operator: '<', value: '10' }]),
        stats,
      ),
    ).toBe(true);
  });

  it('непарсибельне значення → умова хибна (fail-closed, без винятку)', () => {
    expect(() =>
      conditionsMatch(
        conditions([
          { field: 'total_purchases', operator: '>=', value: 'not-a-number' },
        ]),
        baseStats,
      ),
    ).not.toThrow();
    expect(
      conditionsMatch(
        conditions([
          { field: 'total_purchases', operator: '>=', value: 'not-a-number' },
        ]),
        baseStats,
      ),
    ).toBe(false);
  });

  it('невідомий оператор на числовому полі → false', () => {
    expect(
      conditionsMatch(
        conditions([{ field: 'total_purchases', operator: '!=', value: '0' }]),
        baseStats,
      ),
    ).toBe(false);
  });
});

describe('conditionsMatch — текстові поля (=, contains)', () => {
  it('email_domain = точна відповідність', () => {
    const stats = { ...baseStats, emailDomain: 'gmail.com' };
    expect(
      conditionsMatch(
        conditions([
          { field: 'email_domain', operator: '=', value: 'gmail.com' },
        ]),
        stats,
      ),
    ).toBe(true);
  });

  it('email_domain contains — підрядок', () => {
    const stats = { ...baseStats, emailDomain: 'corp.example.com' };
    expect(
      conditionsMatch(
        conditions([
          { field: 'email_domain', operator: 'contains', value: 'example' },
        ]),
        stats,
      ),
    ).toBe(true);
  });

  it('utm_source/utm_campaign підтримують = і contains', () => {
    const stats = {
      ...baseStats,
      utmSource: 'google',
      utmCampaign: 'summer-sale-2026',
    };
    expect(
      conditionsMatch(
        conditions([{ field: 'utm_source', operator: '=', value: 'google' }]),
        stats,
      ),
    ).toBe(true);
    expect(
      conditionsMatch(
        conditions([
          { field: 'utm_campaign', operator: 'contains', value: 'summer' },
        ]),
        stats,
      ),
    ).toBe(true);
  });

  it('текстове поле = null (не задане в статистиці) → false, а не помилка', () => {
    expect(
      conditionsMatch(
        conditions([{ field: 'email_domain', operator: '=', value: 'x' }]),
        baseStats,
      ),
    ).toBe(false);
  });

  it('невідомий оператор на текстовому полі → false', () => {
    const stats = { ...baseStats, emailDomain: 'gmail.com' };
    expect(
      conditionsMatch(
        conditions([
          { field: 'email_domain', operator: 'startsWith', value: 'g' },
        ]),
        stats,
      ),
    ).toBe(false);
  });

  it('auth_provider ігнорує operator — завжди рівність (як в оригіналі)', () => {
    const stats = { ...baseStats, authProvider: 'google' };
    // Навіть із "неправильним" оператором результат — пряма рівність.
    expect(
      conditionsMatch(
        conditions([
          { field: 'auth_provider', operator: 'contains', value: 'google' },
        ]),
        stats,
      ),
    ).toBe(true);
    expect(
      conditionsMatch(
        conditions([
          { field: 'auth_provider', operator: 'contains', value: 'goog' },
        ]),
        stats,
      ),
    ).toBe(false);
  });
});

describe('conditionsMatch — невідомі поля та AND-семантика', () => {
  it('невідоме поле провалює всю умову (не кидає, не ігнорується мовчки)', () => {
    expect(
      conditionsMatch(
        conditions([{ field: 'unknown_field', operator: '=', value: 'x' }]),
        baseStats,
      ),
    ).toBe(false);
  });

  it('усі умови мають виконатись — AND, незалежно від "type"', () => {
    const stats = { ...baseStats, totalPurchases: 500, ordersCount: 3 };
    const rules = [
      { field: 'total_purchases', operator: '>=', value: '100' },
      { field: 'orders_count', operator: '>=', value: '10' }, // не виконано
    ];
    expect(conditionsMatch(conditions(rules, 'all'), stats)).toBe(false);
    // 🔴 "any" в оригіналі НЕ додає OR — лише не перериває цикл раніше.
    // Семантика лишається AND, тож результат той самий, що й для "all".
    expect(conditionsMatch(conditions(rules, 'any'), stats)).toBe(false);
  });

  it('порожній список умов — вакуумна істина (дефолт стовпця в БД)', () => {
    expect(conditionsMatch(conditions([]), baseStats)).toBe(true);
  });
});
