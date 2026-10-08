import { describe, expect, it } from 'vitest';
import { fromJSON, toJSONAsync } from 'seroval';
import { startSerovalPlugins as plugins } from '../packages/simplycms/src/runtime/__tests__/support/start-seroval-plugins';
import { listCustomersInput } from '../packages/simplycms/src/admin-server/impl/customers/list';

// Крос-тірний контракт клієнт→сервер (як `admin-subset-wire`): курсор
// «Показати ще» несе `Date`, а GET-виклик serverFn кодує payload seroval-ом.
// Тест доводить, що `Date` переживає цикл і проходить `z.date()` схеми.
const wire = async <T>(payload: T): Promise<unknown> =>
  fromJSON(
    JSON.parse(JSON.stringify(await toJSONAsync(payload, { plugins }))),
    { plugins },
  );

describe('listCustomers: курсор через межу serverFn', () => {
  it('cursor.createdAt лишається Date з тими ж мілісекундами', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.123Z');
    const id = '0b0f6f2e-3c7a-4d0e-9a52-6f8d1c2b3a4e';
    const parsed = listCustomersInput.parse(
      await wire({ search: 'ab', cursor: { createdAt, id } }),
    );
    expect(parsed.cursor!.createdAt).toBeInstanceOf(Date);
    expect(parsed.cursor!.createdAt.getTime()).toBe(createdAt.getTime());
    expect(parsed.cursor!.id).toBe(id);
  });
});
