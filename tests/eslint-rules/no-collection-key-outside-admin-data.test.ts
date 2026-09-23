import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { REPO, eslint } from '../tier-boundary/lint';

/**
 * Зона (файли, де правило АКТИВНЕ) і саме правило перевіряються РАЗОМ,
 * через повний flat-config `ESLint` (`tests/tier-boundary/lint.ts`) — той
 * самий прийом, що довів межу довіри плагінів і контракт серверного env:
 * правило само по собі шляхів не знає, зону тримає `eslint.config.mjs`
 * (`files`/`ignores`), тож «заборонено в X, дозволено в admin-data» доводить
 * лише прогін по РЕАЛЬНОМУ файлу цієї зони.
 */
const RULE_ID = 'simplycms-collection-key/no-collection-key-outside-admin-data';

async function ruleErrors(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, {
    filePath: join(REPO, filePath),
    warnIgnored: true,
  });
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === RULE_ID)
    .map((m) => m.message);
}

const IMPORT =
  "import { collectionKey } from 'simplycms/contracts/entities';\n";

describe('collectionKey — лише admin-data (Е3-15′)', () => {
  it.each([
    ['вітрина', 'packages/simplycms/src/storefront-routes/__fixture.ts'],
    ['адмінка', 'packages/simplycms/src/admin/__fixture.ts'],
    ['референс-тема', 'packages/simplycms-theme-solarstore/src/__fixture.ts'],
    ['референс-плагін', 'packages/simplycms-plugin-faq/src/__fixture.ts'],
  ])('заборонено: %s', async (_label, filePath) => {
    expect(await ruleErrors(IMPORT, filePath)).toHaveLength(1);
  });

  it('дозволено: колекція admin-data', async () => {
    expect(
      await ruleErrors(
        IMPORT,
        'packages/simplycms/src/admin-data/collections/__fixture.ts',
      ),
    ).toEqual([]);
  });

  it('дозволено: __tests__ (юніт самої функції, напр. entity-key.test.ts)', async () => {
    expect(
      await ruleErrors(
        IMPORT,
        'packages/simplycms/src/contracts/__tests__/__fixture.ts',
      ),
    ).toEqual([]);
  });

  it('заборонено: import type', async () => {
    const code =
      "import type { collectionKey } from 'simplycms/contracts/entities';\n";
    expect(
      await ruleErrors(
        code,
        'packages/simplycms/src/storefront-routes/__fixture.ts',
      ),
    ).toHaveLength(1);
  });

  it('заборонено: inline type-специфікатор', async () => {
    const code =
      "import { type collectionKey } from 'simplycms/contracts/entities';\n";
    expect(
      await ruleErrors(
        code,
        'packages/simplycms/src/storefront-routes/__fixture.ts',
      ),
    ).toHaveLength(1);
  });

  it('заборонено: реекспорт', async () => {
    const code =
      "export { collectionKey } from 'simplycms/contracts/entities';\n";
    expect(
      await ruleErrors(
        code,
        'packages/simplycms/src/storefront-routes/__fixture.ts',
      ),
    ).toHaveLength(1);
  });

  it('заборонено: відносна форма специфікатора', async () => {
    const code = "import { collectionKey } from './entities';\n";
    expect(
      await ruleErrors(code, 'packages/simplycms/src/contracts/__fixture.ts'),
    ).toHaveLength(1);
  });

  it('не валить сусідів collectionKey (ENTITY, entityKey)', async () => {
    const code =
      "import { ENTITY, entityKey } from 'simplycms/contracts/entities';\n";
    expect(
      await ruleErrors(
        code,
        'packages/simplycms/src/storefront-routes/__fixture.ts',
      ),
    ).toEqual([]);
  });
});
