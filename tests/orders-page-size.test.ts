import { describe, expect, it } from 'vitest';
import { ordersOps } from 'simplycms/admin-server/impl';
import { ORDERS_PAGE_SIZE } from '../packages/simplycms/src/admin/features/orders/list/useOrdersList';

/**
 * Е5-14: `useLiveInfiniteQuery` просить `pageSize + 1` рядків (peek-ahead).
 * Якби це перевищувало серверний `maxLimit`, сервер мовчки урізав би
 * відповідь і «Показати ще» ламалась би.
 */
describe('розмір сторінки списку замовлень (Е5-14)', () => {
  it('maxLimit замовлень визначений', () => {
    expect(ordersOps.maxLimit).toBeDefined();
  });
  it('ORDERS_PAGE_SIZE + 1 <= ordersOps.maxLimit', () => {
    expect(ORDERS_PAGE_SIZE + 1).toBeLessThanOrEqual(ordersOps.maxLimit!);
  });
  it('maxLimit — readonly у типі', () => {
    // @ts-expect-error getter-only: присвоєння заборонене типом
    const assign = () => (ordersOps.maxLimit = 1);
    expect(assign).toThrow();
  });
});
