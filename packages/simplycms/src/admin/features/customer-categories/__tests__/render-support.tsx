import type { CategoryRule, UserCategory } from 'simplycms/schema/types';

export {
  stubDom,
  wrapper,
} from '../../shipping/methods/__tests__/render-support';
export { stateConflict } from '../../shipping/zones/__tests__/render-support';

const at = new Date('2026-01-01T00:00:00Z');

const category = (
  n: number,
  name: string,
  isDefault = false,
): UserCategory => ({
  id: `a0000000-0000-4000-8000-00000000000${n}`,
  name,
  code: `code_${n}`,
  description: null,
  isDefault,
  createdAt: at,
  priceTypeId: null,
});

/** Роздріб — дефолтна, Опт і VIP — звичайні. */
export const CATEGORIES = [
  category(1, 'Роздріб', true),
  category(2, 'Опт'),
  category(3, 'VIP'),
];
export const CATEGORY_ID = {
  retail: CATEGORIES[0]!.id,
  wholesale: CATEGORIES[1]!.id,
  vip: CATEGORIES[2]!.id,
};

/** Покупців: Роздріб 5 (разом з NULL-профілями), Опт 2, VIP 0. */
export const COUNTS = [
  { categoryId: CATEGORY_ID.retail, customers: 5 },
  { categoryId: CATEGORY_ID.wholesale, customers: 2 },
  { categoryId: CATEGORY_ID.vip, customers: 0 },
];

export const RULES: CategoryRule[] = [
  {
    id: 'b0000000-0000-4000-8000-000000000001',
    name: 'VIP за сумою',
    description: null,
    fromCategoryId: null,
    toCategoryId: CATEGORY_ID.vip,
    conditions: {
      type: 'all',
      rules: [{ field: 'total_purchases', operator: '>=', value: '1000' }],
    },
    isActive: true,
    priority: 10,
    createdAt: at,
  },
];
