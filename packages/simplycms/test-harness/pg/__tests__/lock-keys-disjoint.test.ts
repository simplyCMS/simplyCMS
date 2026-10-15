// М1 Task 2: ключі advisory-замків не перетинаються. Рядковий ключ хешується
// `hashtextextended(key, 0)` у bigint, ключ накату — число; простір один на
// базу, тож збіг двох ключів означав би мовчазне серіалізування не тих
// операцій (або взаємний дедлок). Перелік береться з реєстру, а не пишеться
// тут: новий ключ, доданий у `LOCK_KEYS`, потрапляє під перевірку сам.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import { resolveHarness } from '../up.mjs';
import { queryRows } from '../apply.mjs';

/** Префікс має хвіст-ідентифікатор: перевіряємо реальну форму ключа. */
const SAMPLE_ID = '00000000-0000-4000-8000-000000000000';

const allKeys: [string, string | bigint][] = Object.entries(LOCK_KEYS);
const stringKeys: [string, string][] = allKeys.flatMap(([name, value]) =>
  typeof value === 'string'
    ? [
        [name, value.endsWith(':') ? `${value}${SAMPLE_ID}` : value] as [
          string,
          string,
        ],
      ]
    : [],
);

describe('реєстр ключів advisory-замків: непересічність', () => {
  let harness: { url: string; teardown: () => Promise<void> };

  beforeAll(async () => {
    harness = await resolveHarness();
  }, 60_000);

  afterAll(async () => {
    await harness?.teardown();
  });

  it('рядкові ключі попарно різні й не дорівнюють ключу накату', async () => {
    const hashes = new Map<string, string>();
    for (const [name, key] of stringKeys) {
      const [row] = (await queryRows(
        harness.url,
        'select hashtextextended($1, 0)::text as h',
        [key],
      )) as { h: string }[];
      expect(
        hashes.get(row!.h),
        `${name} збігається з ${hashes.get(row!.h)}`,
      ).toBeUndefined();
      hashes.set(row!.h, name);
    }
    expect(hashes.size).toBe(stringKeys.length);
    expect(hashes.has(LOCK_KEYS.migration.toString())).toBe(false);
  });
});
