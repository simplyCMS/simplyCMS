import type { Discount, DiscountGroup } from 'simplycms/schema/types';

export {
  stubDom,
  wrapper,
} from '../../shipping/methods/__tests__/render-support';
export { stateConflict } from '../../shipping/zones/__tests__/render-support';

const id = (n: number) => `e0000000-0000-4000-8000-00000000000${n}`;
const at = new Date('2026-01-01T00:00:00Z');

const group = (
  n: number,
  name: string,
  parent: number | null,
): DiscountGroup => ({
  id: id(n),
  name,
  description: null,
  operator: 'and',
  parentGroupId: parent === null ? null : id(parent),
  isActive: true,
  priority: n,
  startsAt: null,
  endsAt: null,
  createdAt: at,
  updatedAt: at,
});

/** Літо → {Взуття, Одяг}; Зима — окремий корінь. */
export const GROUPS = [
  group(1, 'Літо', null),
  group(2, 'Взуття', 1),
  group(3, 'Одяг', 1),
  group(5, 'Зима', null),
];
/** Те саме дерево з онуком Літа: Літо → Взуття → Кеди. */
export const GROUPS_WITH_GRANDCHILD = [...GROUPS, group(4, 'Кеди', 2)];
export const GROUP_ID = { summer: id(1), shoes: id(2), winter: id(5) };

const discount = (n: number, name: string, groupN: number): Discount => ({
  id: `f0000000-0000-4000-8000-00000000000${n}`,
  name,
  description: null,
  groupId: id(groupN),
  discountType: 'percent',
  discountValue: '10',
  priority: 0,
  isActive: true,
  startsAt: null,
  endsAt: null,
  createdAt: at,
  updatedAt: at,
  priceTypeId: null,
});

/** По знижці в кожній групі Літа (3) і одна в Зимі. */
export const DISCOUNTS = [
  discount(1, 'Мінус 10', 1),
  discount(2, 'Кеди -10', 2),
  discount(3, 'Футболки', 3),
  discount(4, 'Пуховики', 5),
];
