// Фінальне рев'ю К3-Е6в, F7: форма правила пише текстові умови вже
// нормалізованими (`trim` + нижній регістр) — тим самим правилом, що розбір
// сервера й рушій.
import { describe, expect, it } from 'vitest';
import { categoryRuleFormSchema } from '../category-rule-form-schema';

const form = (rules: { field: string; operator: string; value: string }[]) => ({
  name: 'Gmail',
  description: '',
  fromCategoryId: '__any__',
  toCategoryId: 'c1',
  priority: 0,
  isActive: true,
  conditions: { type: 'all' as const, rules },
});

describe('categoryRuleFormSchema: нормалізація текстових умов (F7)', () => {
  it('email_domain / utm_* / auth_provider → trim + lower; числове — як є', () => {
    const out = categoryRuleFormSchema.parse(
      form([
        { field: 'email_domain', operator: '=', value: ' Gmail.COM ' },
        { field: 'utm_source', operator: 'contains', value: 'Google ' },
        { field: 'utm_campaign', operator: '=', value: ' Spring' },
        { field: 'auth_provider', operator: '=', value: 'GOOGLE' },
        { field: 'orders_count', operator: '>=', value: '2' },
      ]),
    );
    expect(out.conditions.rules.map((r) => r.value)).toEqual([
      'gmail.com',
      'google',
      'spring',
      'google',
      '2',
    ]);
  });
});
