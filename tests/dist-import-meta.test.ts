import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { publishableDirs } from '../scripts/pack-inspect.mjs';
import { LOWERED_IMPORT_META } from './dist-import-meta/lowered';
import { distFiles } from './lib/dist-graph';

// Гард форми `import.meta` в ОПУБЛІКОВАНОМУ коді (packaging-suite).
//
// 🔴 Причина, а не симптом: лоуерений `import.meta` компілюється тихо, а падає
// вже в магазині — читання `{}.env.VITE_…` дає `undefined` на гідрації, ще до
// будь-якого дружнього throw про відсутнє значення. Форму треба ЗБЕРЕГТИ, щоб
// її підставив бандлер магазину. Виміряно (tsdown/Rolldown): у ESM-виході
// `import.meta` не лоуериться за жодного `target`; лоуерить його формат cjs.
// Тож реальний захист — `format: ['esm']` у `base`, а `target` ні до чого.
//
// Читаємо `dist/` з диска, а не вміст tarball-а: лоуерення стається на
// збірці, а в `.tgz` лягає той самий `dist/` (його присутність там доводить
// `published-exports-parity.test.ts`) — перепаковувати заради того ж байта
// немає сенсу. Тому файл і живе в packaging-suite: `pnpm test:packaging`
// йде після `pnpm build:packages`, тобто `dist/` гарантовано свіжий.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FLAGSHIP = 'simplycms';

/**
 * Пакети ядра, які мають зібраний `dist`.
 *
 * 🔴 Не всі публіковані пакети сюди потрапляють, і це нормально:
 * `@simplycms/cli` — чистий ESM без збірки, теки `dist` у нього немає.
 * Відсутність флагмана, навпаки, — помилка: її асертить окремий тест нижче.
 */
const built = publishableDirs()
  .map((dir) => ({
    dir,
    files: distFiles(join(ROOT, 'packages', dir, 'dist')),
  }))
  .filter((pkg) => pkg.files.length > 0);

describe('опублікований dist: форма import.meta збережена', () => {
  it('флагман зібрано — інакше гейт перевіряв би порожнечу', () => {
    expect(built.map((pkg) => pkg.dir)).toContain(FLAGSHIP);
  });

  // Скан не вакуумний завдяки самоперевірці в tests/dist-import-meta-fixture
  // .test.ts: його cjs-кейс будує фікстур з лоуеренням і мусить матчити той
  // самий LOWERED_IMPORT_META. Позитивного якоря в самому dist немає навмисно:
  // ядро не зобовʼязане містити `import.meta.env`.
  it('жоден dist-модуль не містить лоуереного `import.meta`', () => {
    const offenders = built.flatMap((pkg) =>
      pkg.files
        .filter((file) => LOWERED_IMPORT_META.test(readFileSync(file, 'utf8')))
        .map((file) => `${pkg.dir}: ${file.slice(ROOT.length + 1)}`),
    );

    expect(
      offenders,
      `бандлер злоуерив \`import.meta\` — у конфігах tsdown цих пакетів не ` +
        `\`format: ['esm']\` (лоуерить саме cjs; \`target\` не впливає):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
