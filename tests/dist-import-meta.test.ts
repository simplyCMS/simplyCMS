import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { publishableDirs } from '../scripts/pack-inspect.mjs';
import { distFiles } from './lib/dist-graph';

// Гард форми `import.meta` в ОПУБЛІКОВАНОМУ коді (packaging-suite).
//
// 🔴 Причина, а не симптом: бандлер бере таргет із tsconfig (`ES2017`), якщо
// його не задано явно, а за таргета нижче ES2020 ЛОУЕРИТЬ `import.meta` у змінну
// `var import_meta = {}`. Компілюється воно тихо — падає вже в магазині:
// читання `({}).env.VITE_…` дає `undefined` на гідрації, ще до будь-якого
// дружнього throw про відсутнє значення. Форму треба ЗБЕРЕГТИ, щоб її
// підставив бандлер магазину; лікує це `target: 'esnext'` у `base` кожного
// конфігу tsdown.
//
// Читаємо `dist/` з диска, а не вміст tarball-а: лоуерення стається на
// збірці, а в `.tgz` лягає той самий `dist/` (його присутність там доводить
// `published-exports-parity.test.ts`) — перепаковувати заради того ж байта
// немає сенсу. Тому файл і живе в packaging-suite: `pnpm test:packaging`
// йде після `pnpm build:packages`, тобто `dist/` гарантовано свіжий.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FLAGSHIP = 'simplycms';

/**
 * 🔴 Ловимо ІДЕНТИФІКАТОР, а не імʼя чанка: імена хешовані
 * (`chunk-6O6OQ3BT.js`) і пливуть від збірки до збірки, а от `import_meta`
 * у вихідному коді ядра не існує — його породжує рівно одне: лоуерення
 * esbuild. Суфікс цифрою — форма для другого й далі модуля в одному чанку.
 */
const LOWERED = /\bimport_meta\d*\b/;

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

  // Скан не вакуумний, лише поки доведено, що за цього `base` справжній
  // `import.meta.env` виживає збірку: це доводить позитивний контроль —
  // tests/dist-import-meta-fixture.test.ts (будує фікстур тим самим `base`,
  // і мутація `target: 'es2017'` червонить саме його). Позитивного якоря в
  // самому dist немає навмисно: ядро не зобовʼязане містити `import.meta.env`.
  it('жоден dist-модуль не містить лоуереного `import.meta`', () => {
    const offenders = built.flatMap((pkg) =>
      pkg.files
        .filter((file) => LOWERED.test(readFileSync(file, 'utf8')))
        .map((file) => `${pkg.dir}: ${file.slice(ROOT.length + 1)}`),
    );

    expect(
      offenders,
      `бандлер злоуерив \`import.meta\` — у конфігах tsdown цих пакетів бракує ` +
        `\`target: 'esnext'\`:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
