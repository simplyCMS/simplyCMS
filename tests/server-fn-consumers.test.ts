import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Серверна функція без споживача — мертвий код, який лишається публічною
 * поверхнею: `deleteMedia` пережив свого єдиного викликача (Е6д) і був би
 * знесений лише випадково. Тест вимагає, щоб кожен
 * `export const <імʼя> = createServerFn(…)` мав хоча б одного імпортера.
 *
 * Хто рахується споживачем: файл ПОЗА `__tests__`, `*.test.*`, `test-harness`,
 * `tests/` і моками (усе, що підміняє модуль у тестах, зокрема
 * `admin-server-mock`) та поза файлом, що визначає функцію, який імпортує
 * ім'я з модуля, що веде до визначення, — напряму або крізь барель
 * (`export { n } from` / `export * from`), через `import * as ns` + `ns.n`,
 * чи динамічним `import()` з згадкою імені. Барель, що лише реекспортує, —
 * не споживач: він пересилає, а не викликає.
 *
 * Винятки — `SERVER_FN_NO_CONSUMER_ALLOWLIST` (ключ `<файл>#<імʼя>`, причина
 * обовʼязкова), як `STORAGE_DIRECT_CALL_EXEMPTIONS`: список лише скорочується,
 * мертвий запис (функція зникла чи з'явився споживач) червоніє.
 *
 * Це НЕ парсер TS: імпорти розбираються регулярками, перейменування в
 * реекспорті (`export { a as b } from`) не відстежується — для serverFn
 * репо їх немає, а з'явиться — функція стане «без споживача», тест
 * покличе людину переглянути.
 */

const ROOT = resolve(import.meta.dirname, '..');

export const SERVER_FN_NO_CONSUMER_ALLOWLIST: Readonly<Record<string, string>> =
  {};

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

function collect(root = ROOT): SourceFile[] {
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

// ---------- тести ----------

describe('серверні функції мають споживача', () => {
  const files = collect();
  const defs = serverFnDefinitions(files);
  const orphans = withoutConsumers(files);

  it('скан бачить публічні serverFn (не порожній)', () => {
    expect(defs.length).toBeGreaterThan(100);
    expect(
      defs.some(
        (d) => d.file === 'packages/simplycms/src/admin-server/index.ts',
      ),
    ).toBe(true);
  });

  it('кожна serverFn має імпортера поза тестами й моками, або запис в allowlist з причиною', () => {
    expect(
      orphans.filter((k) => !(k in SERVER_FN_NO_CONSUMER_ALLOWLIST)),
      'serverFn без споживача: прибери її (мертва поверхня) або додай у SERVER_FN_NO_CONSUMER_ALLOWLIST з причиною (напр. публічний порт для плагінів)',
    ).toEqual([]);
  });

  it('allowlist без мертвих записів і з причинами', () => {
    const dead = Object.keys(SERVER_FN_NO_CONSUMER_ALLOWLIST).filter(
      (k) => !orphans.includes(k),
    );
    expect(
      dead,
      'функція зникла або споживач зʼявився — прибери запис, список лише скорочується',
    ).toEqual([]);
    expect(
      Object.values(SERVER_FN_NO_CONSUMER_ALLOWLIST).filter(
        (r) => r.trim().length < 10,
      ),
    ).toEqual([]);
  });
});

describe('негативний контроль', () => {
  const def: SourceFile = {
    path: 'pkg/src/api/index.ts',
    text: "export const usedFn = createServerFn({ method: 'GET' }).handler(async () => 1);\nexport const deadFn = createServerFn({ method: 'GET' }).handler(async () => 2);\n",
  };
  const consumer: SourceFile = {
    path: 'pkg/src/ui/Widget.tsx',
    text: "import { usedFn } from '../api';\nusedFn();\n",
  };

  it('фіктивна serverFn без імпортера червоніє, використана — ні', () => {
    expect(withoutConsumers([def, consumer])).toEqual([
      'pkg/src/api/index.ts#deadFn',
    ]);
  });

  it('імпортер лише у тесті чи моку не рахується', () => {
    const inTest: SourceFile = {
      path: 'pkg/src/ui/__tests__/w.test.tsx',
      text: "import { deadFn } from '../../api';",
    };
    const inMock: SourceFile = {
      path: 'pkg/src/ui/admin-server-mock.ts',
      text: "import { deadFn } from '../api';",
    };
    expect(withoutConsumers([def, consumer, inTest, inMock])).toEqual([
      'pkg/src/api/index.ts#deadFn',
    ]);
  });

  it('барель, що лише реекспортує, не споживач; імпорт крізь барель — споживач', () => {
    const barrel: SourceFile = {
      path: 'pkg/src/index.ts',
      text: "export * from './api';\n",
    };
    const throughBarrel: SourceFile = {
      path: 'pkg/src/ui/B.tsx',
      text: "import { deadFn } from '..';\ndeadFn();\n",
    };
    expect(withoutConsumers([def, consumer, barrel])).toEqual([
      'pkg/src/api/index.ts#deadFn',
    ]);
    expect(withoutConsumers([def, consumer, barrel, throughBarrel])).toEqual(
      [],
    );
  });

  it('import * as ns + ns.імʼя і type-імпорт', () => {
    const ns: SourceFile = {
      path: 'pkg/src/ui/N.ts',
      text: "import * as api from '../api';\napi.deadFn();\n",
    };
    expect(withoutConsumers([def, consumer, ns])).toEqual([]);
  });

  it('імʼя іншої функції з тим самим словом не рахується', () => {
    const other: SourceFile = {
      path: 'pkg/src/other/index.ts',
      text: 'export const deadFn = 1;\n',
    };
    const importsOther: SourceFile = {
      path: 'pkg/src/ui/O.ts',
      text: "import { deadFn } from '../other';",
    };
    expect(withoutConsumers([def, consumer, other, importsOther])).toEqual([
      'pkg/src/api/index.ts#deadFn',
    ]);
  });
});
