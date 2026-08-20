import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  conformanceSummary,
  parseThemeConformanceArgs,
  themeSpec,
} from '../packages/cli/src/theme-conformance.mjs';
import { tsconfigAliases } from '../packages/cli/src/theme-conformance-env.mjs';

// simplycms theme:conformance — канонічний канал запуску conformance-гейта
// тем v3 (амендмент до Р8). Тут — ЧИСТІ ФУНКЦІЇ команди (парсер, резолв теми з
// конфігу, підсумок звіту, аліаси з tsconfig).
//
// 🔴 Живий ланцюг (jsdom + раннер vite + kit) сюди не входить, і Gate TOOL
// пілота його теж не доводить: той смоук ганяє команду з tarball-а на ГОЛОМУ
// скаффолді й ВИМАГАЄ падіння (exit 1) з інструкцією `pnpm add -D jsdom`.
// Щасливий шлях — tests/cli-theme-conformance-run.test.ts.

const CONFIG = `import { defineConfig } from 'simplycms/runtime';

export default defineConfig({
  plugins: [],
  themes: {
    default: () => import('@themes/default/index'),
    solar: () => import('simplycms-theme-solar'),
  },
});
`;

describe('cli theme:conformance: парсер', () => {
  it('приймає рівно одне позиційне імʼя', () => {
    expect(parseThemeConformanceArgs(['aurora'])).toEqual({ name: 'aurora' });
    expect(() => parseThemeConformanceArgs([])).toThrow(/Не задано тему/);
    expect(() => parseThemeConformanceArgs(['a', 'b'])).toThrow(
      /Зайвий аргумент/,
    );
    expect(() => parseThemeConformanceArgs(['--strict'])).toThrow(
      /Невідомий прапорець/,
    );
  });
});

describe('cli theme:conformance: тема з конфігу', () => {
  it('резолвить специфікатор за КЛЮЧЕМ запису, а не за іменем пакета', () => {
    expect(themeSpec(CONFIG, 'default')).toBe('@themes/default/index');
    // Ключ через `--name` може не збігатися з іменем пакета — резолвиться
    // саме запис конфігу.
    expect(themeSpec(CONFIG, 'solar')).toBe('simplycms-theme-solar');
  });

  it('невідома тема — помилка з переліком наявних ключів', () => {
    expect(() => themeSpec(CONFIG, 'nope')).toThrow(
      /Теми «nope» немає[\s\S]*«default», «solar»/,
    );
  });

  it('відсутній якір themes — окрема чесна помилка', () => {
    expect(() => themeSpec('export default {};\n', 'default')).toThrow(
      /Якір «themes: \{» не знайдено/,
    );
  });
});

describe('cli theme:conformance: підсумок звіту', () => {
  // 🔴 Джерело рядка — те, що ПОВЕРНУВ kit, а не `Object.keys(theme.views)`:
  // заявлений view, для якого в `conformance/cases.tsx` немає блоку, не
  // прогониться, і звіт по заявленому показував би неіснуючий прогін.
  it('перелічує саме прогнані сторінки', () => {
    expect(conformanceSummary(['Catalog', 'Cart'])).toBe(
      'Conformance пройдено: views Catalog, Cart',
    );
  });

  it('порожній прогін називає себе порожнім, а не «пройдено»', () => {
    expect(conformanceSummary([])).not.toMatch(/пройдено/);
  });
});

describe('cli theme:conformance: аліаси з tsconfig', () => {
  function withTsconfig(content: string) {
    const dir = mkdtempSync(join(tmpdir(), 'cli-conf-'));
    writeFileSync(join(dir, 'tsconfig.json'), content);
    return dir;
  }

  // 🔴 Фікстура навмисно НЕ використовує реальні scope-шляхи ядра:
  // `audit-exports` збирає специфікатори регекспом по лапках, тож
  // wildcard-ключ tsconfig зарахувався б за справжній імпорт неіснуючого
  // subpath-а і завалив би гейт.
  it('перетворює compilerOptions.paths на аліаси vite, довші — першими', () => {
    const dir = withTsconfig(
      JSON.stringify({
        compilerOptions: {
          paths: {
            '@themes/*': ['./themes/*'],
            '@pkg/objects': ['./packages/objects/src'],
            '@pkg/objects/*': ['./packages/objects/src/*'],
          },
        },
      }),
    );
    expect(tsconfigAliases(dir)).toEqual([
      {
        find: '@pkg/objects',
        replacement: join(dir, 'packages/objects/src'),
      },
      { find: '@themes', replacement: join(dir, 'themes') },
    ]);
  });

  it('без tsconfig.json — порожній список, а не падіння', () => {
    expect(tsconfigAliases(mkdtempSync(join(tmpdir(), 'cli-conf-')))).toEqual(
      [],
    );
  });

  it('битий tsconfig.json — чесне падіння з причиною', () => {
    expect(() => tsconfigAliases(withTsconfig('{ // коментар\n}'))).toThrow(
      /Не вдалося розібрати/,
    );
  });
});
