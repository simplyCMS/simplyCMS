import { describe, expect, it } from 'vitest';
import { evaluateCategoryRules } from '../engine';
import type { CategoryRule, UserCategoryStats } from '../types';

const baseStats: UserCategoryStats = {
  totalPurchases: 0,
  ordersCount: 0,
  registrationDays: 0,
  emailDomain: null,
  authProvider: null,
  utmSource: null,
  utmCampaign: null,
};

const alwaysMatchingConditions = { type: 'all', rules: [] } as const;

const rule = (overrides: Partial<CategoryRule>): CategoryRule => ({
  id: 'rule-default',
  name: 'Правило за замовчуванням',
  fromCategoryId: null,
  toCategoryId: 'vip',
  conditions: alwaysMatchingConditions,
  isActive: true,
  priority: 0,
  ...overrides,
});

describe('evaluateCategoryRules — базові переходи', () => {
  it('немає активних правил → без переходу', () => {
    expect(evaluateCategoryRules([], 'retail', baseStats)).toEqual({
      changed: false,
    });
  });

  it('жодне правило не спрацювало (умови не виконані) → без переходу', () => {
    const rules = [
      rule({
        conditions: {
          type: 'all',
          rules: [
            { field: 'total_purchases', operator: '>=', value: '100000' },
          ],
        },
      }),
    ];
    expect(evaluateCategoryRules(rules, 'retail', baseStats)).toEqual({
      changed: false,
    });
  });

  it('єдине активне правило зі спрощеними умовами дає перехід + причину', () => {
    const rules = [
      rule({ id: 'r1', name: 'VIP за сумою покупок', toCategoryId: 'vip' }),
    ];
    expect(evaluateCategoryRules(rules, 'retail', baseStats)).toEqual({
      changed: true,
      ruleId: 'r1',
      fromCategoryId: 'retail',
      toCategoryId: 'vip',
      reason: 'Автоматично за правилом: VIP за сумою покупок',
    });
  });

  it('неактивне правило (is_active = false) ігнорується', () => {
    const rules = [rule({ id: 'r1', isActive: false })];
    expect(evaluateCategoryRules(rules, 'retail', baseStats)).toEqual({
      changed: false,
    });
  });
});

describe('evaluateCategoryRules — фільтр from_category_id', () => {
  it('правило з конкретним from_category_id застосовується лише з тієї категорії', () => {
    const rules = [
      rule({ id: 'r1', fromCategoryId: 'retail', toCategoryId: 'vip' }),
    ];
    expect(evaluateCategoryRules(rules, 'wholesale', baseStats)).toEqual({
      changed: false,
    });
    expect(evaluateCategoryRules(rules, 'retail', baseStats).changed).toBe(
      true,
    );
  });

  it('from_category_id = null застосовується з будь-якої поточної категорії', () => {
    const rules = [
      rule({ id: 'r1', fromCategoryId: null, toCategoryId: 'vip' }),
    ];
    expect(evaluateCategoryRules(rules, 'wholesale', baseStats).changed).toBe(
      true,
    );
  });
});

describe('evaluateCategoryRules — пріоритети', () => {
  it('вищий priority виграє незалежно від порядку у вхідному масиві', () => {
    const rules = [
      rule({ id: 'low', toCategoryId: 'silver', priority: 1 }),
      rule({ id: 'high', toCategoryId: 'gold', priority: 10 }),
    ];
    const result = evaluateCategoryRules(rules, 'retail', baseStats);
    expect(result).toMatchObject({ changed: true, ruleId: 'high' });
  });

  it('рівний priority — застосовується перше за вхідним порядком', () => {
    const rules = [
      rule({ id: 'first', toCategoryId: 'silver', priority: 5 }),
      rule({ id: 'second', toCategoryId: 'gold', priority: 5 }),
    ];
    const result = evaluateCategoryRules(rules, 'retail', baseStats);
    expect(result).toMatchObject({ changed: true, ruleId: 'first' });
  });

  it('правило, що не змінює категорію, пропускається — оцінюється наступне за пріоритетом', () => {
    // Правило вищого пріоритету веде в ТУ САМУ категорію — оригінал у цьому
    // випадку продовжує цикл (EXIT лише в гілці зі зміною), тож має
    // спрацювати наступне за пріоритетом правило, а не "без переходу".
    const rules = [
      rule({ id: 'noop', toCategoryId: 'retail', priority: 10 }),
      rule({ id: 'real', toCategoryId: 'vip', priority: 1 }),
    ];
    const result = evaluateCategoryRules(rules, 'retail', baseStats);
    expect(result).toMatchObject({ changed: true, ruleId: 'real' });
  });
});

describe('evaluateCategoryRules — NULL-евий tri-state оригіналу', () => {
  it('поточна категорія null → переходу немає НАВІТЬ якщо правило формально підходить', () => {
    // 🔴 Відтворює SQL tri-state: `to_category_id != NULL` завжди NULL (хибно
    // в IF). Це узгоджена з БД поведінка, не хиба порту — див. коментар в engine.ts.
    const rules = [
      rule({ id: 'r1', fromCategoryId: null, toCategoryId: 'vip' }),
    ];
    expect(evaluateCategoryRules(rules, null, baseStats)).toEqual({
      changed: false,
    });
  });
});

describe('evaluateCategoryRules — no-op при співпадінні категорій', () => {
  it('to_category_id === поточна категорія → без переходу', () => {
    const rules = [rule({ id: 'r1', toCategoryId: 'retail' })];
    expect(evaluateCategoryRules(rules, 'retail', baseStats)).toEqual({
      changed: false,
    });
  });
});
