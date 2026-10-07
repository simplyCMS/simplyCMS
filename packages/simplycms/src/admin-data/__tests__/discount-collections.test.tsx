import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { AGGREGATE } from 'simplycms/contracts/entities';

// Колекції знижок і категорій (Е6в-10): write-back без refetch колекції +
// скидання середовища цін і квоти в кеші адміна.
const m = vi.hoisted(() => ({
  listGroups: vi.fn(),
  insertGroups: vi.fn(),
  updateGroups: vi.fn(),
  removeGroups: vi.fn(),
  listDiscounts: vi.fn(),
  removeDiscounts: vi.fn(),
  listCats: vi.fn(),
  insertCats: vi.fn(),
  updateCats: vi.fn(),
  removeCats: vi.fn(),
  listRules: vi.fn(),
  insertRules: vi.fn(),
  updateRules: vi.fn(),
  removeRules: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listDiscountGroups: m.listGroups,
    insertDiscountGroups: m.insertGroups,
    updateDiscountGroups: m.updateGroups,
    removeDiscountGroups: m.removeGroups,
    listDiscounts: m.listDiscounts,
    removeDiscounts: m.removeDiscounts,
    listUserCategories: m.listCats,
    insertUserCategories: m.insertCats,
    updateUserCategories: m.updateCats,
    removeUserCategories: m.removeCats,
    listCategoryRules: m.listRules,
    insertCategoryRules: m.insertRules,
    updateCategoryRules: m.updateRules,
    removeCategoryRules: m.removeRules,
  }),
);

import { getCollection } from '../registry';
import { discountGroupsCollection } from '../collections/discount-groups';
import { discountsCollection } from '../collections/discounts';
import { userCategoriesCollection } from '../collections/user-categories';
import { categoryRulesCollection } from '../collections/category-rules';

const ENV = [...AGGREGATE.discountEnvironment.key, 'u1'];
const QUOTE = [...AGGREGATE.cartQuote.key, null, []];

function warm(qc: QueryClient) {
  qc.setQueryData(ENV, { warm: true });
  qc.setQueryData(QUOTE, { warm: true });
  return () => ({
    env: qc.getQueryState(ENV)?.isInvalidated,
    quote: qc.getQueryState(QUOTE)?.isInvalidated,
  });
}
const BOTH = { env: true, quote: true };

describe('discount-cache: invalidateDiscountConsumers', () => {
  it('скидає обидва префікси і не чіпає чужого', async () => {
    const { invalidateDiscountConsumers } = await import('../discount-cache');
    const qc = new QueryClient();
    const state = warm(qc);
    qc.setQueryData(['other'], 1);
    await invalidateDiscountConsumers(qc);
    expect(state()).toEqual(BOTH);
    expect(qc.getQueryState(['other'])?.isInvalidated).toBe(false);
  });
});

describe.each([
  ['групи', discountGroupsCollection, 'Groups', m.listGroups, 'g'],
  ['категорії', userCategoriesCollection, 'Cats', m.listCats, 'c'],
  ['правила', categoryRulesCollection, 'Rules', m.listRules, 'r'],
] as const)('колекція %s', (_n, def, k, list, p) => {
  const ins = m[`insert${k}` as 'insertGroups'];
  const upd = m[`update${k}` as 'updateGroups'];
  const rem = m[`remove${k}` as 'removeGroups'];
  const row = { id: `${p}1`, name: 'Один' };
  async function setup() {
    const qc = new QueryClient();
    list.mockResolvedValue([row]);
    const c = getCollection(qc, def as never) as unknown as {
      preload(): Promise<void>;
      get(id: string): { name: string } | undefined;
      insert(r: unknown): { isPersisted: { promise: Promise<unknown> } };
      update(
        id: string,
        cb: (d: { name: string }) => void,
      ): { isPersisted: { promise: Promise<unknown> } };
      delete(id: string): { isPersisted: { promise: Promise<unknown> } };
    };
    await c.preload();
    return { qc, c, state: warm(qc) };
  }
  beforeEach(() => vi.clearAllMocks());

  it('insert: write-back + інвалідація без refetch колекції', async () => {
    const { c, state } = await setup();
    ins.mockImplementation(async ({ data }) => data);
    expect(state()).toEqual({ env: false, quote: false });
    await c.insert({ id: `${p}2`, name: 'Нова' }).isPersisted.promise;
    expect(c.get(`${p}2`)?.name).toBe('Нова');
    expect(state()).toEqual(BOTH);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('update: write-back + інвалідація без refetch колекції', async () => {
    const { c, state } = await setup();
    upd.mockResolvedValue([{ ...row, name: 'Інша' }]);
    await c.update(row.id, (d) => void (d.name = 'Інша')).isPersisted.promise;
    expect(c.get(row.id)?.name).toBe('Інша');
    expect(state()).toEqual(BOTH);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('remove: write-back + інвалідація без refetch колекції', async () => {
    const { c, state } = await setup();
    // Групи повертають `{ removed }`, решта — `{ count }`.
    rem.mockResolvedValue({ removed: [row.id], count: 1 });
    await c.delete(row.id).isPersisted.promise;
    expect(rem).toHaveBeenCalledWith({ data: [{ id: row.id }] });
    expect(c.get(row.id)).toBeUndefined();
    expect(state()).toEqual(BOTH);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('відмова сервера при remove не інвалідує і лишає рядок', async () => {
    const { c, state } = await setup();
    rem.mockRejectedValue(new Error('conflict'));
    await expect(c.delete(row.id).isPersisted.promise).rejects.toThrow(
      'conflict',
    );
    expect(state()).toEqual({ env: false, quote: false });
    expect(c.get(row.id)).toBeDefined();
  });
});

describe('колекція знижок', () => {
  beforeEach(() => vi.clearAllMocks());

  it('remove: серверний removeDiscounts + write-back + інвалідація', async () => {
    const qc = new QueryClient();
    m.listDiscounts.mockResolvedValue([{ id: 'd1', groupId: 'g1' }]);
    const c = getCollection(qc, discountsCollection);
    await c.preload();
    const state = warm(qc);
    m.removeDiscounts.mockResolvedValue({ count: 1 });
    await c.delete('d1').isPersisted.promise;
    expect(m.removeDiscounts).toHaveBeenCalledWith({ data: [{ id: 'd1' }] });
    expect(c.get('d1')).toBeUndefined();
    expect(state()).toEqual(BOTH);
    expect(m.listDiscounts).toHaveBeenCalledTimes(1);
  });
});

describe('видалення групи з піддеревом', () => {
  beforeEach(() => vi.clearAllMocks());

  it('прибирає нащадків і каскадні знижки write-back-ом, без refetch', async () => {
    const qc = new QueryClient();
    m.listGroups.mockResolvedValue([
      { id: 'g1', parentGroupId: null },
      { id: 'g2', parentGroupId: 'g1' },
      { id: 'g3', parentGroupId: null },
    ]);
    m.listDiscounts.mockResolvedValue([
      { id: 'd1', groupId: 'g1' },
      { id: 'd2', groupId: 'g2' },
      { id: 'd3', groupId: 'g3' },
    ]);
    const groups = getCollection(qc, discountGroupsCollection);
    const discounts = getCollection(qc, discountsCollection);
    await Promise.all([groups.preload(), discounts.preload()]);
    const state = warm(qc);
    m.removeGroups.mockResolvedValue({ removed: ['g1', 'g2'] });
    await groups.delete('g1').isPersisted.promise;
    expect(m.removeGroups).toHaveBeenCalledWith({ data: [{ id: 'g1' }] });
    expect(groups.get('g2')).toBeUndefined();
    expect(groups.get('g3')).toBeDefined();
    expect(discounts.get('d1')).toBeUndefined();
    expect(discounts.get('d2')).toBeUndefined();
    expect(discounts.get('d3')).toBeDefined();
    expect(state()).toEqual(BOTH);
    expect(m.listGroups).toHaveBeenCalledTimes(1);
    expect(m.listDiscounts).toHaveBeenCalledTimes(1);
  });

  it('колекція знижок ще не завантажена — не падає, лишає її на refetch', async () => {
    const qc = new QueryClient();
    m.listGroups.mockResolvedValue([{ id: 'g1', parentGroupId: null }]);
    const groups = getCollection(qc, discountGroupsCollection);
    await groups.preload();
    m.removeGroups.mockResolvedValue({ removed: ['g1'] });
    await groups.delete('g1').isPersisted.promise;
    expect(groups.get('g1')).toBeUndefined();
  });
});
