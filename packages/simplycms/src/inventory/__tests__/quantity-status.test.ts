import { describe, expect, it, vi } from 'vitest';

const setTargetStatus = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../stock-status', () => ({ setTargetStatus }));

import { syncStatusWithQuantity } from '../quantity-status';

const target = { productId: 'p1', modificationId: null };

describe('syncStatusWithQuantity (Е3-3)', () => {
  it('сума > 0 → запит переходу в in_stock (гвард сам пропустить лише з out_of_stock)', async () => {
    await syncStatusWithQuantity({} as never, target, 3);
    expect(setTargetStatus).toHaveBeenLastCalledWith({}, target, 'in_stock');
  });

  it('сума 0 → запит переходу в out_of_stock', async () => {
    await syncStatusWithQuantity({} as never, target, 0);
    expect(setTargetStatus).toHaveBeenLastCalledWith(
      {},
      target,
      'out_of_stock',
    );
  });

  it('відʼємна сума (облік on_order у мінус) → теж out_of_stock-запит; on_order гвард не чіпає', async () => {
    await syncStatusWithQuantity({} as never, target, -2);
    expect(setTargetStatus).toHaveBeenLastCalledWith(
      {},
      target,
      'out_of_stock',
    );
  });

  it('ціль без товару й модифікації → throw, setTargetStatus не викликано', async () => {
    setTargetStatus.mockClear();
    await expect(
      syncStatusWithQuantity(
        {} as never,
        { productId: null, modificationId: null },
        1,
      ),
    ).rejects.toThrow('ціль залишку без товару й модифікації');
    expect(setTargetStatus).not.toHaveBeenCalled();
  });
});
