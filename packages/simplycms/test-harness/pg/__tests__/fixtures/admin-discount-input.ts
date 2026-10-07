// Вхід `saveDiscount` для харнес-тестів адмінки знижок (К3-Е6в, Task 5).

type Target = {
  targetType: 'all' | 'product' | 'modification' | 'section';
  targetId: string | null;
};

/** Валідний вхід `saveDiscount`: знижка −10 % на все, без умов. */
export const discountInput = (
  groupId: string,
  over: Record<string, unknown> = {},
) => ({
  id: crypto.randomUUID(),
  groupId,
  name: 'Знижка Е6в',
  description: null,
  discountType: 'percent' as const,
  discountValue: 10,
  priceTypeId: null,
  priority: 0,
  isActive: true,
  startsAt: null,
  endsAt: null,
  targets: [{ targetType: 'all', targetId: null }] as Target[],
  conditions: [] as {
    conditionType: string;
    operator: string;
    value: unknown;
  }[],
  ...over,
});

/** Матчер 400 (`ValidationError`, Тема 12). */
export const invalid = { name: 'ValidationError' };
