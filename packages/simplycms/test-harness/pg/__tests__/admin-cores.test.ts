// Showcase Task 3 (С-2, С-15): ядра цін, складу, знижок і статусу замовлення
// поза HTTP-запитом — у транзакції викликача під `withActor({ role: 'app_admin' })`,
// без `requireGrant`, — дають той самий результат, що й операція. Операцію
// кличемо через мок гранта (патерн admin-orders.test.ts) на ДВІЙНИКУ цілі
// (інший товар / замовлення / id знижки) і порівнюємо нормалізований вихід.
import { describe, expect, it, vi } from 'vitest';
import { discountInput, seedGroup } from './fixtures/admin-discounts';
import {
  CANCELLED,
  CONFIRMED,
  strip,
  useCoresDb,
} from './fixtures/admin-cores';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { setResponseStatus } from '@tanstack/react-start/server';
import { withActor, type ActorDb } from 'simplycms/db';
import * as A from 'simplycms/admin-server/impl';

const asAdmin = <T>(fn: (db: ActorDb) => Promise<T>) =>
  withActor({ role: 'app_admin' }, fn);
const VOLATILE = ['id', 'createdAt', 'updatedAt'];

describe('ядра адмін-операцій поза запитом (showcase Task 3)', () => {
  const db = useCoresDb('simplycms_admin_cores');

  it('saveProductPrices = saveProductPricesOp', async () => {
    const input = async (slug: string) => ({
      productId: await db.product(slug),
      modificationId: null,
      prices: [
        { priceTypeId: db.ids.retail, price: '123.45', oldPrice: '150.00' },
      ],
    });
    const core = A.saveProductPricesInput.parse(
      await input('akumulyator-lifepo4-200ah'),
    );
    const viaCore = await asAdmin((tx) => A.saveProductPrices(tx, core));
    const viaOp = await A.saveProductPricesOp({
      data: await input('stantsiya-nakopychennya-10kwh'),
    });
    const keys = [...VOLATILE, 'productId'];
    expect(strip(viaCore.rows, keys)).toEqual(strip(viaOp.rows, keys));
    expect(viaCore.rows).toMatchObject([{ productId: core.productId }]);
    expect(viaCore.removedIds).toEqual(viaOp.removedIds);
  });

  it('saveStock = saveStockOp (вставка залишку + перерахунок статусу)', async () => {
    const input = async (slug: string) => ({
      productId: await db.product(slug),
      modificationId: null,
      quantities: [{ pickupPointId: db.ids.point, quantity: 0 }],
    });
    const core = A.saveStockInput.parse(
      await input('sonyachna-panel-600w-bifacial'),
    );
    const viaCore = await asAdmin((tx) => A.saveStock(tx, core));
    const viaOp = await A.saveStockOp({
      data: await input('akumulyator-lifepo4-200ah'),
    });
    const keys = [...VOLATILE, 'productId'];
    expect(strip(viaCore.rows, keys)).toEqual(strip(viaOp.rows, keys));
    expect(viaCore.target.stockStatus).toBe(viaOp.target.stockStatus);
    expect(viaCore.target.stockStatus).toBe('out_of_stock');
  });

  it('saveDiscount = saveDiscountOp', async () => {
    const group = await seedGroup(db.url());
    const over = {
      conditions: [{ conditionType: 'min_quantity', operator: '>=', value: 3 }],
    };
    const core = A.saveDiscountInput.parse(discountInput(group, over));
    const viaCore = await asAdmin((tx) => A.saveDiscount(tx, core));
    const viaOp = await A.saveDiscountOp({
      data: discountInput(group, over) as never,
    });
    const keys = [...VOLATILE, 'discountId'];
    const pick = (o: typeof viaCore) => ({
      discount: strip([o.discount], keys),
      targets: strip(o.targets, keys),
      conditions: strip(o.conditions, keys),
    });
    expect(pick(viaCore)).toEqual(pick(viaOp));
    expect(viaCore.discount.id).toBe(core.id);
  });

  it('changeOrderStatus = changeOrderStatusOp (підтвердження)', async () => {
    const untracked = await db.product('invertor-gibrydnyi-8kw');
    const a = await db.place(untracked, 1);
    const b = await db.place(untracked, 1);
    const viaCore = await asAdmin((tx) =>
      A.changeOrderStatus(tx, { orderId: a, statusId: CONFIRMED }),
    );
    const viaOp = await A.changeOrderStatusOp({
      data: { orderId: b, statusId: CONFIRMED },
    });
    const keys = [...VOLATILE, 'orderNumber'];
    expect(strip([viaCore.order], keys)).toEqual(strip([viaOp.order], keys));
    expect(viaCore.order).toMatchObject({ id: a, statusId: CONFIRMED });
  });

  it('changeOrderStatus на cancelled повертає залишок; повтор — AdminConflictError без статусу відповіді', async () => {
    const panel = await db.product('sonyachna-panel-450w-mono');
    const before = await db.stock(panel);
    const orderId = await db.place(panel, 2);
    expect(await db.stock(panel)).toBe(before - 2);
    const out = await asAdmin((tx) =>
      A.changeOrderStatus(tx, { orderId, statusId: CANCELLED }),
    );
    expect(out.order.statusId).toBe(CANCELLED);
    expect(await db.stock(panel)).toBe(before);
    const reserved = await db.one<{ r: number }>(
      `select sum(stock_reserved)::int as r from public.order_items where order_id = $1`,
      [orderId],
    );
    expect(reserved.r).toBe(0);
    vi.mocked(setResponseStatus).mockClear();
    await expect(
      asAdmin((tx) =>
        A.changeOrderStatus(tx, { orderId, statusId: CONFIRMED }),
      ),
    ).rejects.toBeInstanceOf(A.AdminConflictError);
    expect(setResponseStatus).not.toHaveBeenCalled();
  });
});
