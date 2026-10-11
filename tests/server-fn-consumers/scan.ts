import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * Збір файлів, розбір імпортів і пошук serverFn без споживача для
 * `server-fn-consumers.test.ts` (що стереже і чому — у шапці тесту). Тут лише
 * логіка; жодних `describe`/`it`.
 */

const ROOT = resolve(import.meta.dirname, '../..');

// ---------- збір файлів ----------

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.claude',
  'docs',
  'coverage',
  '.output',
]);
const SOURCE_EXT = /\.(?:tsx?|mts|cts|mjs|cjs|js)$/;
const NON_PRODUCTION =
  /(?:^|\/)(?:__tests__|test-harness|tests|e2e)\/|\.test\.|\.e2e\.|mock/i;

export type SourceFile = { path: string; text: string };

export function collect(root = ROOT): SourceFile[] {
  const out: SourceFile[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(full);
      } else if (SOURCE_EXT.test(e.name)) {
        const path = relative(root, full).replaceAll('\\', '/');
        out.push({ path, text: readFileSync(full, 'utf8') });
      }
    }
  };
  walk(root);
  return out;
}

// ---------- резолв специфікаторів у «ідентифікатор модуля» ----------

/** Аліаси репо: `simplycms[/x]` → `packages/simplycms/src[/x]` тощо. */
const ALIASES: readonly [prefix: string, target: string][] = [
  ['simplycms', 'packages/simplycms/src'],
  ['@simplycms/plugin-faq', 'packages/simplycms-plugin-faq/src'],
  ['@simplycms/theme-solarstore', 'packages/simplycms-theme-solarstore/src'],
];

const stripExt = (p: string): string =>
  p.replace(/\.(?:tsx?|mts|cts|mjs|cjs|js)$/, '');
const normalize = (p: string): string => {
  const parts: string[] = [];
  for (const seg of p.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return parts.join('/');
};

/** Модуль = файл без розширення; `…/index` зводиться до теки. */
export const moduleId = (filePath: string): string =>
  stripExt(filePath).replace(/\/index$/, '');

function specToModule(spec: string, fromPath: string): string | null {
  if (spec.startsWith('.'))
    return moduleId(normalize(`${dirname(fromPath)}/${spec}`));
  for (const [prefix, target] of ALIASES) {
    if (spec === prefix) return normalize(target);
    if (spec.startsWith(`${prefix}/`))
      return normalize(`${target}/${spec.slice(prefix.length + 1)}`);
  }
  return null;
}

// ---------- розбір імпортів ----------

type Edge = {
  from: string;
  module: string;
  /** Імена, що імпортуються (або реекспортуються); `*` — зірка/простір імен. */
  names: string[];
  reexport: boolean;
  namespace?: string;
  dynamic?: boolean;
};

const NAMED_IMPORT =
  /\b(import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
const NS_IMPORT = /\bimport\s+\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g;
const STAR_EXPORT = /\bexport\s+\*(?:\s+as\s+\w+)?\s+from\s*['"]([^'"]+)['"]/g;
const DYNAMIC = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

function edgesOf(file: SourceFile): Edge[] {
  const edges: Edge[] = [];
  for (const m of file.text.matchAll(NAMED_IMPORT)) {
    const module = specToModule(m[3] as string, file.path);
    if (!module) continue;
    const names = (m[2] as string)
      .split(',')
      .map(
        (part) =>
          part
            .trim()
            .replace(/^type\s+/, '')
            .split(/\s+as\s+/)[0] as string,
      )
      .filter(Boolean);
    edges.push({ from: file.path, module, names, reexport: m[1] === 'export' });
  }
  for (const m of file.text.matchAll(NS_IMPORT)) {
    const module = specToModule(m[2] as string, file.path);
    if (module)
      edges.push({
        from: file.path,
        module,
        names: ['*'],
        reexport: false,
        namespace: m[1],
      });
  }
  for (const m of file.text.matchAll(STAR_EXPORT)) {
    const module = specToModule(m[1] as string, file.path);
    if (module)
      edges.push({ from: file.path, module, names: ['*'], reexport: true });
  }
  for (const m of file.text.matchAll(DYNAMIC)) {
    const module = specToModule(m[1] as string, file.path);
    if (module)
      edges.push({
        from: file.path,
        module,
        names: ['*'],
        reexport: false,
        dynamic: true,
      });
  }
  return edges;
}

// ---------- логіка ----------

const DEFINITION = /^export const (\w+)\s*=\s*createServerFn\s*\(/gm;

export type ServerFnDef = { file: string; name: string };

export function serverFnDefinitions(
  files: readonly SourceFile[],
): ServerFnDef[] {
  return files
    .filter((f) => !NON_PRODUCTION.test(f.path))
    .flatMap((f) =>
      [...f.text.matchAll(DEFINITION)].map((m) => ({
        file: f.path,
        name: m[1] as string,
      })),
    );
}

/** Серверні функції, в яких немає жодного споживача, — ключі `<файл>#<імʼя>`. */
export function withoutConsumers(files: readonly SourceFile[]): string[] {
  const production = files.filter((f) => !NON_PRODUCTION.test(f.path));
  const edges = production.flatMap(edgesOf);
  const byPath = new Map(production.map((f) => [f.path, f.text]));
  const orphans: string[] = [];

  for (const def of serverFnDefinitions(files)) {
    // Модулі, крізь які імʼя видно назовні: власний + баррелі-реекспортери.
    const visible = new Set([moduleId(def.file)]);
    for (let grew = true; grew;) {
      grew = false;
      for (const e of edges) {
        if (
          !e.reexport ||
          visible.has(moduleId(e.from)) ||
          !visible.has(e.module)
        )
          continue;
        if (e.names.includes('*') || e.names.includes(def.name)) {
          visible.add(moduleId(e.from));
          grew = true;
        }
      }
    }
    const word = new RegExp(`\\b${def.name}\\b`);
    const consumed = edges.some((e) => {
      if (e.reexport || e.from === def.file || !visible.has(e.module))
        return false;
      if (e.names.includes(def.name)) return true;
      const text = byPath.get(e.from) ?? '';
      if (e.dynamic) return word.test(text);
      return (
        Boolean(e.namespace) &&
        new RegExp(`\\b${e.namespace}\\.${def.name}\\b`).test(text)
      );
    });
    if (!consumed) orphans.push(`${def.file}#${def.name}`);
  }
  return orphans;
}
