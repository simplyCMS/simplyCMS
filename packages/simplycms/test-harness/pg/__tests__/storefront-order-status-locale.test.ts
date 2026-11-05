// М2б Task 7 (Р19, Review Focus 5) проти живого Postgres: назва статусу замовлення на вітрині
// читається мовою запиту (`translatedFieldSql`), а де перекладу немає — основною мовою.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { orderStatusesCreate } from 'simplycms/admin-server/impl';
import {
  loadOrderDetail,
  loadOrderStatuses,
} from 'simplycms/storefront/loaders';
import { useAddressingDb } from './fixtures/addressing-db';
import { exec } from './fixtures/product-aggregate';
import { EN, UK } from './fixtures/text-locale';

describe('назва статусу замовлення на вітрині: мова запиту з fallback на основну', () => {
  const db = useAddressingDb('simplycms_status_locale');
  let sort = 2000;
  const withOrder = async (statusId: string) => {
    const id = randomUUID();
    await db.q(
      `insert into public.orders (id, order_number, status_id, subtotal, total, first_name, last_name, email, phone, payment_method)
       values ($1, $2, $3, 1, 1, 'Т', 'П', 't@example.test', '+380000000000', 'cash')`,
      [id, `SL-${id.slice(0, 8)}`, statusId],
    );
    return id;
  };
  const status = async (texts: Record<string, { name: string }>) => {
    const id = randomUUID();
    await exec(orderStatusesCreate, {
      id,
      code: `sl-${id}`,
      sortOrder: sort++,
      texts,
    });
    return id;
  };

  beforeAll(async () => {
    await db.language('en');
  });

  it('статус без перекладу en: замовлення /en показує назву uk; з перекладом — en', async () => {
    const onlyUk = await status({ uk: { name: 'Лише українська' } });
    const both = await status({
      uk: { name: 'Обидві' },
      en: { name: 'Both' },
    });
    const orderUk = await withOrder(onlyUk);
    const orderBoth = await withOrder(both);

    const read = (id: string, text: typeof EN) =>
      db.admin((tx) => loadOrderDetail(tx, id, text));
    expect((await read(orderUk, EN))?.status?.name).toBe('Лише українська');
    expect((await read(orderBoth, EN))?.status?.name).toBe('Both');
    expect((await read(orderBoth, UK))?.status?.name).toBe('Обидві');
  });

  it('довідник для фільтра: той самий fallback по кожному рядку', async () => {
    const onlyUk = await status({ uk: { name: 'Фільтр лише uk' } });
    const both = await status({
      uk: { name: 'Фільтр обидві' },
      en: { name: 'Filter both' },
    });
    const names = new Map(
      (await db.admin((tx) => loadOrderStatuses(tx, EN))).map((s) => [
        s.id,
        s.name,
      ]),
    );
    expect(names.get(onlyUk)).toBe('Фільтр лише uk');
    expect(names.get(both)).toBe('Filter both');
  });
});
