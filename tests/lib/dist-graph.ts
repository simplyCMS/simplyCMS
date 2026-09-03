import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// Обхід зібраного `dist` — спільний для гейтів packaging-suite
// (`dist-import-meta`, `dist-server-boundary`). Читає ФАЙЛИ на диску, а не
// tarball: у `.tgz` лягає той самий `dist/`, а його присутність там доводить
// `published-exports-parity`.

/** Усі JS-модулі всередині `dir` (рекурсивно), абсолютні шляхи. */
export const distFiles = (dir: string): string[] => {
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
 * Відносні специфікатори модуля (`./x`, `../x`) у ВСІХ трьох формах.
 *
 * 🔴 Динамічний `import("./chunk")` не менш важливий за статичний: саме ним
 * Rolldown виносить код в окремий чанк навіть за одного входу. І `from`
 * покриває обидві форми — `import x from` та `export * from`.
 */
export const relativeImports = (code: string): string[] => {
  const found = new Set<string>();
  const patterns = [
    /\bfrom\s*["'](\.[^"']*)["']/g,
    /^\s*import\s*["'](\.[^"']*)["']/gm,
    /\bimport\s*\(\s*["'](\.[^"']*)["']/g,
  ];
  for (const rx of patterns) {
    for (const match of code.matchAll(rx)) found.add(match[1]);
  }
  return [...found];
};

/** Транзитивне замикання по відносних імпортах від набору файлів. */
export const closure = (entries: Iterable<string>): Set<string> => {
  const seen = new Set<string>(entries);
  const queue = [...seen];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    for (const spec of relativeImports(readFileSync(file, 'utf8'))) {
      const next = resolve(dirname(file), spec);
      if (existsSync(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
};
