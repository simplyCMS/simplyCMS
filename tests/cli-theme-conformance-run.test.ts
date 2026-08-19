import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ThemeModule } from '@simplycms/themes/types';
import { installStoreDom } from '../packages/cli/src/theme-conformance-dom.mjs';
import { createStoreRunner } from '../packages/cli/src/theme-conformance-env.mjs';

// ЩАСЛИВИЙ шлях канонічного каналу гейта: installStoreDom → createStoreRunner
// → runner.import(тема) → runner.import(kit) → зелений прогін.
//
// 🔴 Gate TOOL пілота доводить ІНШЕ і замінити цей файл не може: він ганяє
// команду з опублікованого tarball-а на ГОЛОМУ скаффолді й вимагає падіння
// (exit 1) з інструкцією `pnpm add -D jsdom`. Тобто до kit-а той смоук не
// доїжджає навмисно — робочий ланцюг доводиться тут.
//
// Тема — СИНТЕТИЧНА і пишеться на диск у межах тесту: реальна доводила б лише
// «сьогодні все добре», а тем із `views` у репо немає. Тека фікстур лежить
// УСЕРЕДИНІ кореня монорепо (`node_modules/.…`) не з ліні: vite резолвить
// `react`/`react-dom` від теки імпортера, тож із os-tmpdir фікстура не
// зібралася б.

interface StoreEnv {
  runner: { import: (spec: string) => Promise<Record<string, unknown>> };
  close: () => Promise<void>;
}

type AssertConformance = (theme: ThemeModule) => Promise<string[]>;

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_REL = 'node_modules/.simplycms-conformance-fixture';
const FIXTURE_DIR = join(REPO, FIXTURE_REL);

/** Валідний кошик: реквізити на місці, порожній стан — структурно без них. */
const GOOD_CART = `<div>
      <slots.Items />
      <slots.Summary />
      <slots.Checkout />
    </div>`;

/** Дефект: тема загубила перехід до оформлення — воронка обірвана мовчки. */
const BROKEN_CART = `<div>
      <slots.Items />
      <slots.Summary />
    </div>`;

function themeSource(name: string, cart: string): string {
  return `import type { CartViewModel } from '@simplycms/objects/views';

function Stub() {
  return <div />;
}

function Cart({ itemCount, slots }: CartViewModel) {
  if (itemCount === 0) return <div data-testid="empty-cart" />;
  return (
    ${cart}
  );
}

export default {
  manifest: {
    name: '${name}',
    displayName: '${name}',
    version: '1.0.0',
    engines: { simplycms: '>=0.0.0' },
  },
  tokens: {},
  components: { Header: Stub, Footer: Stub },
  views: { Cart },
};
`;
}

describe('cli theme:conformance: живий прогін ланцюга', () => {
  let environment: StoreEnv;

  beforeAll(async () => {
    mkdirSync(FIXTURE_DIR, { recursive: true });
    writeFileSync(
      join(FIXTURE_DIR, 'good.tsx'),
      themeSource('conformance-run-good', GOOD_CART),
    );
    writeFileSync(
      join(FIXTURE_DIR, 'broken.tsx'),
      themeSource('conformance-run-broken', BROKEN_CART),
    );
    // Без DOM kit падає ще до рендеру — installStoreDom тут частина ланцюга,
    // що перевіряється, а не підготовка оточення.
    await installStoreDom(REPO);
    environment = (await createStoreRunner(REPO)) as StoreEnv;
  }, 60_000);

  afterAll(async () => {
    await environment?.close();
    rmSync(FIXTURE_DIR, { recursive: true, force: true });
  });

  async function importTheme(file: string): Promise<ThemeModule> {
    const module = await environment.runner.import(`/${FIXTURE_REL}/${file}`);
    return module.default as ThemeModule;
  }

  async function importKit(): Promise<AssertConformance> {
    const module = await environment.runner.import(
      '@simplycms/themes/conformance',
    );
    return module.assertThemeViewsConformance as AssertConformance;
  }

  it('тема з views проходить гейт і повертає прогнані сторінки', async () => {
    const assertConformance = await importKit();
    await expect(
      assertConformance(await importTheme('good.tsx')),
    ).resolves.toEqual(['Cart']);
  }, 30_000);

  it('той самий ланцюг червоніє на загубленому реквізиті', async () => {
    const assertConformance = await importKit();
    await expect(
      assertConformance(await importTheme('broken.tsx')),
    ).rejects.toThrow(/cart\.checkout/);
  }, 30_000);
});
