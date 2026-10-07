// Фінальне рев'ю К3-Е6в, F7: текстові умови автоправил (`email_domain`,
// `utm_source`, `utm_campaign`, `auth_provider`) — `trim` і нижній регістр
// на ЗАПИСІ (розбір) і при ПОРІВНЯННІ (рушій нормалізує й статистику).
import { describe, expect, it } from 'vitest';
import { conditionsMatch } from '../conditions';
import { parseCategoryRuleConditions } from '../parse';
import type { CategoryRuleField, UserCategoryStats } from '../types';

const STATS: UserCategoryStats = {
  totalPurchases: 0,
  ordersCount: 0,
  registrationDays: 0,
  emailDomain: null,
  authProviders: [],
  utmSource: null,
  utmCampaign: null,
};

const one = (field: string, operator: string, value: string) => ({
  type: 'all' as const,
  rules: [{ field, operator, value }],
});

describe('розбір умов: текстові значення нормалізуються (F7)', () => {
  it.each([
    ['email_domain', '=', ' Gmail.COM '],
    ['utm_source', 'contains', 'GOOGLE '],
    ['utm_campaign', '=', '  Spring'],
    ['auth_provider', '=', ' Google'],
  ])('%s %s %j → trim + lower', (field, operator, value) => {
    expect(parseCategoryRuleConditions(one(field, operator, value))).toEqual(
      one(field, operator, value.trim().toLowerCase()),
    );
  });

  it('числове значення не змінюється', () => {
    expect(parseCategoryRuleConditions(one('orders_count', '>=', '2'))).toEqual(
      one('orders_count', '>=', '2'),
    );
  });
});

describe('рушій: порівняння нормалізує обидві сторони (F7)', () => {
  const matches = (
    field: CategoryRuleField,
    operator: '=' | 'contains',
    value: string,
    stats: Partial<UserCategoryStats>,
  ) =>
    conditionsMatch(
      { type: 'all', rules: [{ field, operator, value }] },
      { ...STATS, ...stats },
    );

  it("статистика 'Gmail.com ' збігається з умовою 'gmail.com'", () => {
    expect(
      matches('email_domain', '=', 'gmail.com', { emailDomain: 'Gmail.com ' }),
    ).toBe(true);
  });

  it('умова, записана в обхід розбору (SQL) з регістром, теж збігається', () => {
    expect(matches('utm_source', '=', ' Google', { utmSource: 'google' })).toBe(
      true,
    );
    expect(
      matches('utm_campaign', 'contains', 'SPRING', {
        utmCampaign: 'Big-Spring-Sale',
      }),
    ).toBe(true);
  });

  it('auth_provider: будь-який провайдер покупця після нормалізації', () => {
    expect(
      matches('auth_provider', '=', 'google', {
        authProviders: ['credential', ' Google'],
      }),
    ).toBe(true);
  });

  it('позитивний контроль: інше значення — не збігається', () => {
    expect(
      matches('email_domain', '=', 'gmail.com', { emailDomain: 'gmail.co' }),
    ).toBe(false);
  });
});
