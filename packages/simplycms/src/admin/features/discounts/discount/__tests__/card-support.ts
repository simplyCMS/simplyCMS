import { afterAll, type Mock } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { DISCOUNTS, GROUPS } from '../../__tests__/render-support';

/**
 * Пояс із переходом на зимовий час для файлу тесту: друга «03:30» Києва
 * існує лише в ньому — без нього тест дат вакуумний. Node підхоплює TZ у
 * рантаймі; після файлу пояс відновлюється.
 */
export function withKyivTimeZone() {
  const previous = process.env.TZ;
  process.env.TZ = 'Europe/Kyiv';
  afterAll(() => {
    // Присвоєння `undefined` записало б рядок 'undefined' — тож delete.
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  });
}

export const ROW = DISCOUNTS[0]!;
/** Друга «03:30» ночі 2026-10-25 у Києві (перша — 00:30Z). */
export const SECOND_0330 = new Date('2026-10-25T01:30:00.000Z');
export const ALL_TARGET = {
  id: 'a1',
  discountId: ROW.id,
  targetType: 'all',
  targetId: null,
};
export const cond = (
  conditionType: string,
  operator: string,
  value: unknown,
) => ({
  id: `c-${conditionType}`,
  discountId: ROW.id,
  conditionType,
  operator,
  value,
});

interface CardMocks {
  readonly listDiscountGroups: Mock;
  readonly listDiscounts: Mock;
  readonly getDiscount: Mock;
  readonly saveDiscount: Mock;
}

/** Дефолти сервера: знижка ROW зі startsAt = друга «03:30», ціль «усі». */
export function seedServer(m: CardMocks) {
  m.listDiscountGroups.mockResolvedValue(GROUPS);
  m.listDiscounts.mockResolvedValue(DISCOUNTS);
  m.getDiscount.mockResolvedValue({
    discount: { ...ROW, startsAt: SECOND_0330 },
    targets: [ALL_TARGET],
    conditions: [],
  });
  m.saveDiscount.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      discount: { ...ROW, ...data, discountValue: String(data.discountValue) },
      targets: [],
      conditions: [],
    }),
  );
}

/** `data` першого виклику `saveDiscount`. */
export const savedData = (m: CardMocks) =>
  (m.saveDiscount.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;

export const submit = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));
