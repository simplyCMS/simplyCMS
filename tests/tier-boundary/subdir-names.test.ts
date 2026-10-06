import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, restrictedImports } from './lint';

/**
 * Е6б-26: підтеки нутрощів T2 не називаються як теки тірів `src/`.
 *
 * 🔴 `eslint.tier-relative.mjs` матчить РЯДОК специфікатора, а не
 * резолвлений модуль: `../themes/x` усередині `admin-server/impl` правило
 * читає як імпорт теки тем T4. Тека-тезка змушує обходити правило барелем —
 * тобто маскувати саме правило. Тому збіг імен заборонено гейтом.
 */
const SRC = join(REPO, 'packages/simplycms/src');

/** Теки з власними підтеками операцій/лоадерів, де діє відносний імпорт. */
const NESTED_ROOTS = ['admin-server/impl', 'storefront/loaders'];

const subdirs = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== '__tests__')
    .map((e) => e.name);

describe('тір-зони: імена підтек нутрощів T2 (Е6б-26)', () => {
  const tiers = new Set(subdirs(SRC));

  it('множина тек src/ непорожня (гейт не порожній за побудовою)', () => {
    expect(tiers.has('themes')).toBe(true);
    expect(tiers.has('plugins')).toBe(true);
  });

  it.each(NESTED_ROOTS)(
    '%s: жодна підтека не збігається з текою src/',
    (root) => {
      const clashes = subdirs(join(SRC, root)).filter((name) =>
        tiers.has(name),
      );
      expect(clashes).toEqual([]);
    },
  );

  // Позитивний контроль причини: тека-тезка справді спрацьовує на правилі.
  it('відносний ../themes/x усередині impl правило читає як імпорт T4', async () => {
    const errors = await restrictedImports(
      '../themes/list',
      'packages/simplycms/src/admin-server/impl/settings/__probe.ts',
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});
