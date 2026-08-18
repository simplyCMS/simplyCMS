import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Гард СКЛЕЙКИ `run()`: підсумок друкується з того, що ПОВЕРНУВ kit
// (фактично прогнані сторінки), а не з ключів, які тема ЗАЯВИЛА.
//
// 🔴 Це рівно той дефект, який знайшло рев'ю контракту v3: команда друкувала
// `declaredViews(theme)`, тож із випалим блоком `buildConformanceCases`
// рапортувала б «Conformance пройдено: views Home, Catalog…», не відрендеривши
// жодного з них — брехливий успіх на порожньому місці.
//
// Чому окремий файл, а не кейс у `cli-theme-conformance-run.test.ts`: там
// живий ланцюг ганяється БЕЗ моків (справжні jsdom + vite-раннер), і `vi.mock`
// у тому ж файлі підмінив би саме те, що він доводить. Тут навпаки — ланцюг
// замокано навмисно, щоб ізолювати одну склейку: kit → рядок підсумку.

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = join(REPO, 'node_modules/.simplycms-summary-fixture');

/** Тема ЗАЯВЛЯЄ два view, а kit віддає лише один прогнаний. */
const DECLARED = ['Cart', 'Home'];
const ACTUALLY_RAN = ['Cart'];

const successes: string[] = [];

vi.mock('../packages/cli/src/ui.mjs', () => ({
  begin: () => {},
  finish: () => {},
  say: {
    step: () => {},
    success: (message: string) => successes.push(message),
  },
}));

vi.mock('../packages/cli/src/context.mjs', () => ({
  findScaffoldRoot: () => FIXTURE_DIR,
}));

vi.mock('../packages/cli/src/theme-conformance-dom.mjs', () => ({
  installStoreDom: async () => {},
}));

vi.mock('../packages/cli/src/theme-conformance-env.mjs', () => ({
  createStoreRunner: async () => ({
    runner: {
      import: async (spec: string) =>
        spec === '@simplycms/themes/conformance'
          ? { assertThemeViewsConformance: async () => ACTUALLY_RAN }
          : {
              default: {
                manifest: { name: 'fixture' },
                views: Object.fromEntries(DECLARED.map((k) => [k, () => null])),
              },
            },
    },
    close: async () => {},
  }),
}));

beforeAll(() => {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(
    join(FIXTURE_DIR, 'simplycms.config.ts'),
    // Формат — як у справжньому конфігу магазину: запис теми з НОВОГО рядка
    // (саме такий вигляд розбирає `configThemeEntries`).
    [
      'export default defineConfig({',
      '  themes: {',
      "    fixture: () => import('@themes/fixture/index'),",
      '  },',
      '});',
      '',
    ].join('\n'),
  );
});

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

describe('theme:conformance — підсумок = фактично прогнане', () => {
  it('друкує сторінки з kit-а, а НЕ заявлені темою ключі', async () => {
    successes.length = 0;
    const { run } = await import('../packages/cli/src/theme-conformance.mjs');

    await run(['fixture']);

    const summary = successes.join('\n');
    expect(summary, 'підсумок узагалі не надруковано').not.toBe('');
    expect(summary).toContain('Cart');
    // 🔴 Несуче: `Home` тема заявила, але kit його не прогнав — у підсумку
    // його бути не сміє. Саме цей асерт червоніє на відкоті дефекту
    // (`conformanceSummary(Object.keys(theme.views ?? {}))`).
    expect(
      summary,
      'у підсумок протік ЗАЯВЛЕНИЙ, але не прогнаний view',
    ).not.toContain('Home');
  });
});
