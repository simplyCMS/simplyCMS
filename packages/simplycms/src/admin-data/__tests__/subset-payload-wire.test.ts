import { describe, expect, it } from 'vitest';
import { and, gte, IR, lt } from '@tanstack/react-db';
import { fromJSON, toJSONAsync } from 'seroval';
import { toSubsetPayload } from '../subset-payload';

// 🔴 0.11.3: toExpression приймає за IR лише побудовані екземпляри — обʼєктний
// літерал `{ type: 'ref' }` тепер лічиться значенням користувача.
const ref = (field: string) =>
  new IR.PropRef([field]) as unknown as Parameters<typeof gte>[0];

/** Той самий цикл, що й у GET-виклику serverFn: клієнт кодує seroval-ом у
 *  JSON-рядок, сервер розбирає назад (serverFnFetcher → server-functions-handler). */
const wire = async <T>(payload: T): Promise<unknown> =>
  fromJSON(JSON.parse(JSON.stringify(await toJSONAsync(payload))));

describe('toSubsetPayload: Date через межу serverFn', () => {
  it('Date у value переживає seroval-цикл і проходить subsetInputSchema', async () => {
    const d = new Date('2026-01-01T00:00:00.123Z');
    const payload = toSubsetPayload({
      where: and(
        gte(ref('createdAt'), d),
        lt(ref('createdAt'), new Date(d.getTime() + 1)),
      ),
    });
    // Динамічний імпорт: статичний на server-only субшлях у цій теці забороняє
    // лінт-межа клієнт/сервер, а схему сервера тут перевіряє саме тест.
    const { subsetInputSchema } =
      await import('simplycms/admin-server/impl/subset');
    const parsed = subsetInputSchema.parse(await wire(payload));
    const filters = parsed.subset!.filters!;
    expect(filters.map((f) => f.operator)).toEqual(['gte', 'lt']);
    expect(filters[0]!.value).toBeInstanceOf(Date);
    expect((filters[0]!.value as Date).getTime()).toBe(d.getTime());
    expect((filters[1]!.value as Date).getTime()).toBe(d.getTime() + 1);
  });
});
