import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { publishableDirs } from '../scripts/pack-inspect.mjs';

// Гард форми `import.meta` в ОПУБЛІКОВАНОМУ коді (packaging-suite).
//
// 🔴 Причина, а не симптом: tsup віддає esbuild таргет із tsconfig (`ES2017`),
// а за таргета нижче ES2020 esbuild ЛОУЕРИТЬ `import.meta` у локальну змінну
// `var import_meta = {}`. Компілюється воно тихо — падає вже в магазині:
// `resolveSupabaseKeys(({}).env)` = `resolveSupabaseKeys(undefined)` →
// TypeError на гідрації, ще до дружнього throw про відсутній ключ. Форму
// треба ЗБЕРЕГТИ, щоб її підставив бандлер магазину; лікує це
// `target: 'esnext'` у `base` кожного tsup-конфігу.
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

/** Рекурсивно: усі JS-модулі всередині `dist` пакета (шляхи від кореня репо). */
const distFiles = (dir: string): string[] => {
  const out: string[] = [];
  const walk = (abs: string): void => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const next = join(abs, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (/\.[cm]?js$/.test(entry.name)) out.push(next);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
};

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

/** Транзитивне замикання по ЛОКАЛЬНИХ (`./`, `../`) імпортах entry-модуля. */
const closure = (entry: string): string[] => {
  const seen = new Set<string>([entry]);
  const queue = [entry];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    const code = readFileSync(file, 'utf8');
    for (const [, spec] of code.matchAll(/from\s*["'](\.[^"']*)["']/g)) {
      const next = resolve(dirname(file), spec);
      if (existsSync(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...seen];
};

describe('опублікований dist: форма import.meta збережена', () => {
  it('флагман зібрано — інакше гейт перевіряв би порожнечу', () => {
    expect(built.map((pkg) => pkg.dir)).toContain(FLAGSHIP);
  });

  it('жоден dist-модуль не містить лоуереного `import.meta`', () => {
    const offenders = built.flatMap((pkg) =>
      pkg.files
        .filter((file) => LOWERED.test(readFileSync(file, 'utf8')))
        .map((file) => `${pkg.dir}: ${file.slice(ROOT.length + 1)}`),
    );

    expect(
      offenders,
      `esbuild злоуерив \`import.meta\` — у tsup-конфігах цих пакетів бракує ` +
        `\`target: 'esnext'\`:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('ланцюг браузерного Supabase-клієнта читає саме `import.meta.env`', () => {
    // Позитивний якір, щоб гейт не позеленів «вхолосту»: `browser-client`
    // резолвить ключі з `import.meta.env`, і після splitting цей код лежить
    // у спільному чанку — тому дивимось на замикання, а не на один файл.
    const entry = join(
      ROOT,
      'packages',
      FLAGSHIP,
      'dist/supabase/browser-client.js',
    );
    expect(
      existsSync(entry),
      `немає ${entry} — потрібен pnpm build:packages`,
    ).toBe(true);

    const code = closure(entry)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    expect(code).toContain('import.meta.env');
  });
});
