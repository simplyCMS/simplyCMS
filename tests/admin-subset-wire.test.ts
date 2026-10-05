import { describe, expect, it } from 'vitest';
import { and, gte, IR, lt } from '@tanstack/react-db';
import { startSerovalPlugins as plugins } from '../packages/simplycms/src/runtime/__tests__/support/start-seroval-plugins';
import { fromJSON, toJSONAsync } from 'seroval';
import { subsetInputSchema } from '../packages/simplycms/src/admin-server/impl/subset';
import { toSubsetPayload } from '../packages/simplycms/src/admin-data/subset-payload';

// Крос-тірний контракт клієнт→сервер: лежить у tests/, бо клієнтська тека
// не може статично імпортувати server-only схему (no-server-only-in-client).
// 🔴 0.11.3: toExpression приймає за IR лише побудовані екземпляри — обʼєктний
// літерал `{ type: 'ref' }` тепер лічиться значенням користувача.
const ref = (field: string) =>
  new IR.PropRef([field]) as unknown as Parameters<typeof gte>[0];

// Плагіни Start: клієнт кодує payload GET з ними (serverFnFetcher), сервер
// розбирає тими самими.
/** Той самий цикл, що й у GET-виклику serverFn: seroval у JSON-рядок і назад
 *  (serverFnFetcher → server-functions-handler), з плагінами Start. */
const wire = async <T>(payload: T): Promise<unknown> =>
  fromJSON(
    JSON.parse(JSON.stringify(await toJSONAsync(payload, { plugins }))),
    {
      plugins,
    },
  );

describe('toSubsetPayload: Date через межу serverFn', () => {
  it('Date у value переживає seroval-цикл і проходить subsetInputSchema', async () => {
    const d = new Date('2026-01-01T00:00:00.123Z');
    const payload = toSubsetPayload({
      where: and(
        gte(ref('createdAt'), d),
        lt(ref('createdAt'), new Date(d.getTime() + 1)),
      ),
    });
    const parsed = subsetInputSchema.parse(await wire(payload));
    const filters = parsed.subset!.filters!;
    expect(filters.map((f) => f.operator)).toEqual(['gte', 'lt']);
    expect(filters[0]!.value).toBeInstanceOf(Date);
    expect((filters[0]!.value as Date).getTime()).toBe(d.getTime());
    expect((filters[1]!.value as Date).getTime()).toBe(d.getTime() + 1);
  });
});
