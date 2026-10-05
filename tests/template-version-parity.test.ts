import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Парність ВЕРСІЙ залежностей: корінь ↔ шаблон `create-simplycms-store` ↔
 * пілотний оверлей. `create-store-template-parity.test.ts` звіряє лише набори
 * файлів і ключів; версії могли розходитись роками (шаблон лишався на
 * `lucide ^0.563`, коли корінь ішов на `1.x`), тож магазин стартував на тому,
 * чого ми не тестуємо. Тепер кожна СПІЛЬНА залежність (є і в корені, і в
 * шаблоні/оверлеї) мусить мати той самий рядок діапазону.
 *
 * Свідомі розбіжності — лише явними списками нижче, КОЖНА з причиною:
 *   - `DIFFERS` — розбіжність із фіксованим очікуваним значенням: дрейф
 *     шаблону від ЦЬОГО значення так само червоніє, а запис, що став зайвим
 *     (значення збіглось із коренем), теж червоніє — щоб список не гнив;
 *   - `DEFERRED` — пара, версії якої бампаються окремим етапом: порівняння
 *     пропускається, доки етап не виконано (тоді запис видаляють).
 *
 * Залежності лише в шаблоні (`simplycms`, `@simplycms/cli` — плейсхолдери
 * версії) чи лише в корені — поза порівнянням: «спільна» означає присутня в
 * обох.
 */

const ROOT = resolve(import.meta.dirname, '..');

type Deps = Record<string, string>;
const readDeps = (file: string): Deps => {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, file), 'utf8')) as {
    dependencies?: Deps;
    devDependencies?: Deps;
  };
  return { ...manifest.dependencies, ...manifest.devDependencies };
};

const TARGETS = {
  template: 'packages/create-simplycms-store/template/package.json.tpl',
  pilot: 'tests/pilot/store-template/package.json',
} as const;

type Target = keyof typeof TARGETS;

/** Свідомі відмінності: імʼя → цільовий файл → очікуваний рядок + причина. */
const DIFFERS: Record<
  string,
  Partial<Record<Target, { expected: string; reason: string }>>
> = {
  'drizzle-orm': {
    template: {
      expected: '^0.45.3',
      reason:
        'у корені точний пін (0.45.3), а магазину потрібен діапазон: peer ядра — ^0.45.0, точний пін у проєкті магазину ламав би його власне оновлення drizzle',
    },
    pilot: {
      expected: '^0.45.3',
      reason: 'те саме, що в шаблоні: оверлей відтворює проєкт магазину',
    },
  },
};

/** Пари, версії яких бампаються окремим етапом (порівняння пропущено). */
const DEFERRED: Record<string, string> = {
  '@tanstack/react-db':
    'бампається етапом TanStack DB (спека 2026-10-04, тема 4) разом із коренем і peer-діапазонами ядра; після етапу запис прибрати',
  '@tanstack/query-db-collection':
    'те саме: пара пов’язана точними версіями з @tanstack/react-db',
};

const rootDeps = readDeps('package.json');

describe.each(Object.keys(TARGETS) as Target[])(
  'версії корінь ↔ %s',
  (target) => {
    const deps = readDeps(TARGETS[target]);
    const shared = Object.keys(deps)
      .filter((name) => name in rootDeps && !(name in DEFERRED))
      .sort();

    it('має спільні залежності (захист від порожнього порівняння)', () => {
      expect(shared.length).toBeGreaterThan(50);
    });

    it.each(shared)('%s', (name) => {
      const differs = DIFFERS[name]?.[target];
      if (differs) {
        expect(deps[name], `${name}: ${differs.reason}`).toBe(differs.expected);
        // Запис, що став зайвим, — пастка: список винятків мусить відображати
        // реальні розбіжності.
        expect(
          differs.expected,
          `${name}: запис у DIFFERS більше не потрібен — збігається з коренем`,
        ).not.toBe(rootDeps[name]);
        return;
      }
      expect(
        deps[name],
        `${name}: у ${TARGETS[target]} «${deps[name]}», у корені «${rootDeps[name]}». Вирівняйте шаблон з коренем або додайте обґрунтований запис у DIFFERS`,
      ).toBe(rootDeps[name]);
    });
  },
);

describe('списки винятків не гниють', () => {
  it('кожен запис DIFFERS і DEFERRED — реальна залежність кореня', () => {
    for (const name of [...Object.keys(DIFFERS), ...Object.keys(DEFERRED)]) {
      expect(rootDeps, `${name} відсутній у корені`).toHaveProperty(name);
    }
  });
});
