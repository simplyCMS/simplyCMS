import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Негативний контроль тір-зон напрямку шарів (ПК3, трек К0).
 *
 * 🔴 Зелений `pnpm lint` доводить лише «у чинному коді порушень немає» — він НЕ
 * доводить, що зона налаштована й ловить порушення: правило, що мовчки
 * відвалилось (одруківка в глобі, зʼїдений `ignores` шлях, порожня група),
 * теж дає зелений лінт. До К0 напрямок шарів стерегла межа npm-пакета плюс
 * `audit-deps`; після злиття 26 пакетів в один стереже ЛИШЕ конфіг — тож
 * контроль обовʼязковий. Прийом той самий, що довів межу довіри плагінів і
 * контракт серверного env: ESLint годується СИНТЕТИЧНИМ порушенням із
 * filePath усередині зони й поза нею.
 *
 * Таблиця зон — `eslint.tier-zones.mjs`; тут очікування задані РУКАМИ, щоб
 * тест не переказував ту саму структуру, з якої зібраний конфіг.
 */

// [тека зони, заборонений специфікатор, легальний специфікатор]
const ZONES: ReadonlyArray<readonly [string, string, string]> = [
  ['packages/simplycms/src/contracts', 'simplycms/domain/pricing', 'react'],
  ['packages/simplycms/src/domain', 'simplycms/schema', 'simplycms/contracts'],
  [
    'packages/simplycms/src/schema',
    'simplycms/supabase',
    'simplycms/contracts',
  ],
  [
    'packages/simplycms/src/supabase',
    'simplycms/data-supabase',
    'simplycms/contracts',
  ],
  [
    'packages/simplycms/src/data-supabase',
    'simplycms/supabase/browser-client',
    'simplycms/contracts/ports',
  ],
  [
    'packages/simplycms/src/react-query',
    'simplycms/supabase',
    'simplycms/domain/money',
  ],
  [
    'packages/simplycms/src/runtime',
    'simplycms/ui/button',
    'simplycms/contracts',
  ],
  [
    'packages/simplycms/src/i18n',
    'simplycms/react-query',
    'simplycms/contracts',
  ],
  [
    'packages/simplycms/src/storefront',
    'simplycms/supabase/server-client',
    'simplycms/contracts',
  ],
  ['packages/simplycms/src/ui', 'simplycms/react-query', 'simplycms/ui/utils'],
  [
    'packages/simplycms/src/themes',
    'simplycms/admin/pages/Themes',
    'simplycms/supabase/anon-client',
  ],
  [
    'packages/simplycms/src/plugins',
    'simplycms/plugin-sdk',
    'simplycms/contracts/semver',
  ],
  [
    'packages/simplycms/src/plugin-sdk',
    'simplycms/admin',
    'simplycms/plugins/types',
  ],
  [
    'packages/simplycms/src/cart-ui',
    'simplycms/core/hooks/useCart',
    'simplycms/react-query',
  ],
  [
    'packages/simplycms/src/catalog-ui',
    'simplycms/storefront-routes/pages/Catalog',
    'simplycms/core/hooks/useAuth',
  ],
  [
    'packages/simplycms/src/checkout-ui',
    'simplycms/admin',
    'simplycms/core/hooks/useAuth',
  ],
  [
    'packages/simplycms/src/profile-ui',
    'simplycms/storefront-routes/pages/Profile',
    'simplycms/core/hooks/useAuth',
  ],
  [
    'packages/simplycms/src/reviews-ui',
    'simplycms/admin',
    'simplycms/core/hooks/useAuth',
  ],
  [
    'packages/simplycms/src/core',
    'simplycms/storefront-routes/pages/Home',
    'simplycms/themes/ThemeContext',
  ],
  [
    'packages/simplycms/src/admin',
    'simplycms/storefront-routes/pages/Home',
    'simplycms/core/hooks/use-toast',
  ],
  [
    'packages/simplycms/src/storefront-routes',
    'simplycms/admin/pages/Products',
    'simplycms/core/hooks/useAuth',
  ],
  [
    'packages/simplycms/routes/storefront',
    'simplycms/admin/pages/Products',
    'simplycms/storefront-routes/pages/Home',
  ],
  [
    'packages/simplycms/routes/admin',
    'simplycms/core/hooks/useAuth',
    'simplycms/admin/pages/Products',
  ],
];

// Контрольна точка ПОЗА всіма тір-зонами: host-код магазину. Той самий
// синтетичний імпорт тут має бути чистим — інакше зона не зона, а глобальна
// заборона.
const OUTSIDE = 'src/__tier-fixture.ts';

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: REPO });
});

async function restrictedImports(
  specifier: string,
  filePath: string,
): Promise<string[]> {
  const [result] = await eslint.lintText(
    `import { probe } from '${specifier}';\nexport const used = probe;\n`,
    { filePath: join(REPO, filePath), warnIgnored: true },
  );
  // Файл, зʼїдений ignores, дав би 0 повідомлень і хибно-зелений тест —
  // тому скоупінг зон окремо асертиться останнім кейсом.
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === 'no-restricted-imports')
    .map((m) => m.message);
}

describe('тір-зони напрямку шарів (no-restricted-imports)', () => {
  it.each(ZONES)(
    '%s — порушення ловиться, легальний імпорт чистий',
    async (dir, forbidden, allowed) => {
      const fixture = `${dir}/__tier-fixture.ts`;

      const errors = await restrictedImports(forbidden, fixture);
      expect(errors, `${forbidden} у ${dir}`).toHaveLength(1);
      expect(errors[0]).toContain('Тір-зона ПК3');

      expect(
        await restrictedImports(allowed, fixture),
        `${allowed} у ${dir}`,
      ).toEqual([]);

      // Той самий код поза зоною — чистий.
      expect(
        await restrictedImports(forbidden, OUTSIDE),
        `${forbidden} поза зоною`,
      ).toEqual([]);
    },
  );

  it.each(ZONES)(
    '%s — кореневий барель simplycms заборонений зсередини пакета',
    async (dir) => {
      const errors = await restrictedImports(
        'simplycms',
        `${dir}/__tier-fixture.ts`,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('цикл модулів');
    },
  );

  it('кореневий барель поза пакетом легальний (host магазину)', async () => {
    expect(await restrictedImports('simplycms', OUTSIDE)).toEqual([]);
  });

  it('жодну зону не зʼїв ignores (страховка скоупінгу)', async () => {
    for (const [dir] of ZONES) {
      expect(
        await eslint.isPathIgnored(join(REPO, `${dir}/__tier-fixture.ts`)),
        dir,
      ).toBe(false);
    }
    expect(await eslint.isPathIgnored(join(REPO, OUTSIDE))).toBe(false);
  });

  it('тип-імпорт і export-from теж під зоною (не лише value-import)', async () => {
    const fixture = join(
      REPO,
      'packages/simplycms/src/domain/__tier-fixture.ts',
    );
    for (const code of [
      "import type { X } from 'simplycms/admin';\n",
      "export { X } from 'simplycms/admin';\n",
    ]) {
      const [result] = await eslint.lintText(code, {
        filePath: fixture,
        warnIgnored: true,
      });
      const errors = (result?.messages ?? []).filter(
        (m) => m.ruleId === 'no-restricted-imports',
      );
      expect(errors, code).toHaveLength(1);
    }
  });
});
