import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Гейт «ядро зовнішнє в dist референс-теми й референс-плагіна» (рішення
// архітектора №156, Task 18 п. 11).
//
// 🔴 Чому це інваріант: контекст запиту ядра (`site/request-context`,
// `AsyncLocalStorage`) мусить бути ОДНИМ на процес магазину. Тема чи плагін, у
// чий dist вклеєно `simplycms/*`, несли б власну копію ALS під власним id —
// лоадер теми читав би порожній контекст, і жоден гейт ядра цього не бачить:
// `checkRequestContextSingle` пілота рахує лише модулі `site/request-context.*`.
//
// Що доводить: (1) кожен `simplycms/*`-імпорт джерела лишився bare-імпортом у
// dist (бандлер його не розв'язав); (2) sourcemap dist не містить жодного
// джерела поза власним `src/` пакета; (3) у dist немає `AsyncLocalStorage` /
// `async_hooks`. Потребує свіжого `pnpm build:packages` — місце в packaging-сюїті
// (на порожньому dist гейт падає явно, а не проходить вакуумно).

const ROOT = resolve(import.meta.dirname, '..');
const PACKAGES = [
  'packages/simplycms-theme-solarstore',
  'packages/simplycms-plugin-faq',
];
const CORE_SPEC = /^(?:simplycms(?:\/[^'"]*)?|@simplycms\/[^'"]+)$/;

function walk(dir: string, ext: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(full, ext);
    return ext.test(e.name) ? [full] : [];
  });
}

/** Bare-специфікатори ядра в `from '…'` / `import('…')` зібраного коду. */
function coreSpecifiers(code: string): Set<string> {
  const out = new Set<string>();
  for (const m of code.matchAll(
    /(?:\bfrom\s*|\bimport\s*\(\s*)(['"])([^'"]+)\1/g,
  ))
    if (CORE_SPEC.test(m[2]!)) out.add(m[2]!);
  return out;
}

/**
 * Специфікатори ядра, що в джерелі імпортують ЗНАЧЕННЯ: `import type` і
 * `import { type A }` у dist законно зникають, тож їх не рахуємо.
 */
function coreValueImports(code: string): Set<string> {
  const out = new Set<string>();
  const re =
    /\b(?:import|export)\s+(type\s+)?([^;]*?)\s*from\s*(['"])([^'"]+)\3/g;
  for (const m of code.matchAll(re)) {
    if (!CORE_SPEC.test(m[4]!) || m[1]) continue;
    const braces = /\{([^}]*)\}/.exec(m[2]!)?.[1];
    const outside = m[2]!.replace(/\{[^}]*\}/, '').replace(/[\s,]/g, '');
    const typeOnly =
      braces !== undefined &&
      outside === '' &&
      braces
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .every((x) => x.startsWith('type '));
    if (!typeOnly) out.add(m[4]!);
  }
  return out;
}

describe.each(PACKAGES)('dist %s: ядро зовнішнє', (pkg) => {
  const dir = resolve(ROOT, pkg);
  const dist = join(dir, 'dist');
  const js = () => walk(dist, /\.js$/);

  it('dist зібрано', () => {
    expect(
      existsSync(dist),
      `немає ${pkg}/dist — спершу pnpm build:packages`,
    ).toBe(true);
    expect(js().length).toBeGreaterThan(0);
  });

  it('🔴 кожен simplycms-імпорт значення з джерела лишився bare-імпортом у dist', () => {
    const src = new Set(
      walk(join(dir, 'src'), /\.tsx?$/).flatMap((f) => [
        ...coreValueImports(readFileSync(f, 'utf8')),
      ]),
    );
    const built = new Set(
      js().flatMap((f) => [...coreSpecifiers(readFileSync(f, 'utf8'))]),
    );
    expect(src.size).toBeGreaterThan(0);
    expect([...src].filter((s) => !built.has(s))).toEqual([]);
  });

  it('🔴 sourcemap dist — лише власні джерела пакета', () => {
    const foreign = walk(dist, /\.js\.map$/).flatMap((map) => {
      const { sources } = JSON.parse(readFileSync(map, 'utf8')) as {
        sources: string[];
      };
      return sources
        .map((s) => resolve(join(map, '..'), s))
        .filter((s) => !s.startsWith(join(dir, 'src') + '/'))
        .map((s) => `${relative(dist, map)} ← ${relative(ROOT, s)}`);
    });
    expect(foreign).toEqual([]);
  });

  it('🔴 у dist немає власного AsyncLocalStorage', () => {
    const hits = js().filter((f) =>
      /AsyncLocalStorage|async_hooks/.test(readFileSync(f, 'utf8')),
    );
    expect(hits.map((f) => relative(ROOT, f))).toEqual([]);
  });
});
