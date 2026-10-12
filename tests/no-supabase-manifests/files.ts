import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import noSupabaseImport from '../../eslint-rules/no-supabase-import.mjs';

export const ROOT = join(__dirname, '..', '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);
const CODE_EXT = /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/;

/** Рекурсивний обхід без node_modules/dist; шляхи відносно кореня репо. */
export function walk(dir: string, accept: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, accept));
    else if (accept(name)) out.push(relative(ROOT, full));
  }
  return out;
}

/** Globs workspace з pnpm-workspace.yaml (рядки `- 'x/*'` у `packages:`). */
function workspaceGlobs(): string[] {
  const text = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
  const block = text.split(/^packages:\s*$/m)[1] ?? '';
  const globs: string[] = [];
  for (const line of block.split('\n')) {
    const m = /^\s*-\s*['"]?([^'"#\s]+)['"]?/.exec(line);
    if (m) globs.push(m[1]);
    else if (/^\S/.test(line)) break; // наступний топ-рівневий ключ
  }
  return globs;
}

/** package.json кореня й усіх workspace-пакетів + два шаблонні маніфести. */
export function manifestFiles(): string[] {
  const files = ['package.json'];
  for (const glob of workspaceGlobs()) {
    // Лише форма `<тека>/*` — інших у workspace немає; нова форма має впасти.
    const m = /^([^*]+)\/\*$/.exec(glob);
    if (!m) throw new Error(`Непідтримуваний glob workspace: ${glob}`);
    for (const name of readdirSync(join(ROOT, m[1]))) {
      const rel = `${m[1]}/${name}/package.json`;
      try {
        statSync(join(ROOT, rel));
        files.push(rel);
      } catch {
        /* тека без маніфеста */
      }
    }
  }
  files.push(
    'packages/create-simplycms-store/template/package.json.tpl',
    'tests/pilot/store-template/package.json',
  );
  // Вкладені пакети шаблону (тема/плагін) — теж маніфести чужого проєкту.
  for (const sub of ['plugins/hello-world', 'themes/default']) {
    const rel = `packages/create-simplycms-store/template/${sub}/package.json`;
    if (existsSync(join(ROOT, rel))) files.push(rel);
  }
  return files;
}

const DEP_KEYS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

// Секції, де `@supabase/*` ховається повз `dependencies`: підміна версій і
// мета peer-ів. У них перевіряються і ключі, і значення (`npm:@supabase/x`),
// і вкладені обʼєкти — тому текстовий пошук по серіалізованій секції.
const OVERRIDE_KEYS = ['overrides', 'resolutions', 'peerDependenciesMeta'];
const SUPABASE_REF = /@supabase\/[\w.-]+/g;

/** Усі згадки `@supabase/*` у залежностях і підмінах маніфеста (унікальні). */
export function supabaseRefsInJson(json: Record<string, unknown>): string[] {
  const deps = DEP_KEYS.flatMap((k) =>
    Object.keys((json[k] as Record<string, string> | undefined) ?? {}),
  ).filter((n) => n.startsWith('@supabase/'));
  const pnpm = (json.pnpm ?? {}) as Record<string, unknown>;
  const sections = [
    ...OVERRIDE_KEYS.map((k) => json[k]),
    ...OVERRIDE_KEYS.map((k) => pnpm[k]),
  ].filter((v) => v !== undefined);
  const refs = sections.flatMap(
    (v) => JSON.stringify(v).match(SUPABASE_REF) ?? [],
  );
  return [...new Set([...deps, ...refs])];
}

/** `@supabase/*` у топ-рівневому блоці `overrides:` pnpm-workspace.yaml. */
export function supabaseRefsInYaml(text: string): string[] {
  const block =
    /^overrides:[^\n]*\n((?:[ \t].*\n?|\n)*)/m.exec(text)?.[0] ?? '';
  return [...new Set(block.match(SUPABASE_REF) ?? [])];
}

/** Імена залежностей і підмін маніфеста; `.tpl` парситься текстом (плейсхолдери). */
export function supabaseDeps(rel: string): string[] {
  const text = readFileSync(join(ROOT, rel), 'utf8');
  if (rel.endsWith('.tpl')) return text.match(SUPABASE_REF) ?? [];
  return supabaseRefsInJson(JSON.parse(text) as Record<string, unknown>);
}

/** Код шаблону магазину — поза основним лінтом (ігнори eslint.config.mjs). */
export function templateCodeFiles(): string[] {
  const accept = (n: string) => CODE_EXT.test(n);
  return [
    ...walk(join(ROOT, 'packages/create-simplycms-store/template'), accept),
    ...walk(join(ROOT, 'tests/pilot/store-template'), accept),
  ];
}

const linter = new Linter({ configType: 'flat' });

// Явний список розширень: `**/*` flat config не вважає «явним» збігом і для
// .ts/.tsx відповідає «No matching configuration».
export const templateLintConfig = [
  {
    files: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    plugins: {
      'simplycms-supabase': {
        rules: { 'no-supabase-import': noSupabaseImport },
      },
    },
    // Той самий парсер, що в основному eslint.config.mjs.
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: { 'simplycms-supabase/no-supabase-import': 'error' },
  },
] as Parameters<Linter['verify']>[1];

/** Лінт одного файла шаблону єдиним правилом, без конфіг-ігнорів. */
export const lintSnippet = (code: string, filename: string) =>
  linter.verify(code, templateLintConfig, { filename });

export const lintTemplateFile = (rel: string) =>
  lintSnippet(readFileSync(join(ROOT, rel), 'utf8'), rel);
