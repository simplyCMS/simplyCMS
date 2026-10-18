import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { codeOnly } from '../support/source-text';

const ROOT = join(import.meta.dirname, '..', '..');

/** Теки, які не скануємо: залежності, артефакти збірки, агентні worktree, витяги pack. */
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.output',
  '.git',
  '.claude',
  '.superpowers',
  'package',
]);

const RTL_IMPORT =
  /import\s*(?:type\s+)?\{([^}]*)\}\s*from\s*['"]@testing-library\/react['"]/g;

/** Імена, імпортовані з RTL (до `as` — оригінальна назва, після — локальна). */
function rtlImports(src: string): Map<string, string> {
  const out = new Map<string, string>(); // оригінал → локальна назва
  for (const m of src.matchAll(RTL_IMPORT)) {
    for (const part of m[1]!.split(',')) {
      const [orig, local] = part.trim().split(/\s+as\s+/);
      if (orig) out.set(orig, local ?? orig);
    }
  }
  return out;
}

/**
 * Правило 1: файл, що імпортує `render`/`renderHook` з RTL, мусить у
 * `afterEach` викликати `cleanup` (з RTL). Легальні форми: `afterEach(cleanup)`,
 * `afterEach(() => cleanup())`, `afterEach(() => { …; cleanup(); })`.
 * Повертає текст порушення або null.
 */
export function checkCleanup(src: string, fileName: string): string | null {
  // Коментар зі згадкою `cleanup` викликом не є; лексер TS (спільний помічник), а не регекс:
  // `//` у рядку чи вкладеному шаблоні код не ріже.
  const code = codeOnly(src, fileName);
  const imports = rtlImports(code);
  if (!imports.has('render') && !imports.has('renderHook')) return null;
  const cleanup = imports.get('cleanup');
  if (!cleanup) return 'render/renderHook є, а cleanup з RTL не імпортовано';
  const re = new RegExp(
    String.raw`afterEach\(\s*(?:async\s*)?(?:${cleanup}\s*[,)]|\(\s*\)\s*=>\s*(?:${cleanup}\s*\(\s*\)|\{[^}]*\b${cleanup}\s*\(\s*\)))`,
  );
  return re.test(code)
    ? null
    : 'cleanup імпортовано, але не викликається в afterEach';
}

/** Усі тест-файли репо (`*.test.ts(x)`), відносні шляхи. */
export function testFiles(root = ROOT): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.test\.tsx?$/.test(name)) out.push(relative(root, full));
    }
  };
  walk(root);
  return out.sort();
}

export function scanCleanup(root = ROOT): string[] {
  const bad: string[] = [];
  for (const f of testFiles(root)) {
    const why = checkCleanup(readFileSync(join(root, f), 'utf8'), f);
    if (why) bad.push(`${f}: ${why}`);
  }
  return bad;
}

export { ROOT };
