import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ROOT,
  lintSnippet,
  lintTemplateFile,
  manifestFiles,
  supabaseDeps,
  supabaseRefsInJson,
  supabaseRefsInYaml,
  templateCodeFiles,
} from './no-supabase-manifests/files';

// Ратчет К3-Е7 (Р2): `@supabase/*` не повертається ні в маніфести, ні в lock,
// ні в код шаблону магазину (він поза основним лінтом).
describe('маніфести без @supabase/*', () => {
  const files = manifestFiles();

  it('множина файлів не вакуумна', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(files).toContain('package.json');
    expect(files.some((f) => f.endsWith('.tpl'))).toBe(true);
    expect(files).toContain('tests/pilot/store-template/package.json');
    expect(files).toContain('packages/simplycms/package.json');
  });

  it.each(files)('%s', (rel) => {
    expect(supabaseDeps(rel)).toEqual([]);
  });

  it('pnpm-workspace.yaml: overrides без @supabase/*', () => {
    const yaml = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
    expect(yaml).toContain('packages:'); // не вакуумно: файл справжній
    expect(supabaseRefsInYaml(yaml)).toEqual([]);
  });

  // 🔴 Мутацію lock доводити через `npx vitest`: будь-який `pnpm <script>`
  // (зокрема `pnpm test`) перед запуском переписує lock за supply-chain
  // policy pnpm 11 і викидає осиротілий рядок, тож `pnpm test` до локальної
  // мутації lock нечутливий (у CI lock і так береться з коміту).
  it('pnpm-lock.yaml не містить @supabase/', () => {
    const lock = readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8');
    expect(lock).toContain('lockfileVersion'); // не вакуумно: файл справжній
    expect(lock.includes('@supabase/')).toBe(false);
  });
});

// Негативні контролі форми перевірки: `@supabase/*` не сховати в `overrides`,
// `pnpm.overrides`, `resolutions`, `peerDependenciesMeta` і `overrides`
// pnpm-workspace.yaml (інакше lock знову тягне пакет повз `dependencies`).
describe('supabaseRefsInJson / supabaseRefsInYaml', () => {
  it.each([
    ['overrides', { overrides: { '@supabase/x': '1.0.0' } }],
    ['pnpm.overrides', { pnpm: { overrides: { '@supabase/x': '1.0.0' } } }],
    ['resolutions', { resolutions: { '@supabase/x': '1.0.0' } }],
    [
      'peerDependenciesMeta',
      { peerDependenciesMeta: { '@supabase/x': { optional: true } } },
    ],
    [
      'значення overrides (npm: аліас)',
      { overrides: { foo: 'npm:@supabase/x' } },
    ],
    ['вкладений override', { overrides: { foo: { '@supabase/x': '1.0.0' } } }],
    ['dependencies', { dependencies: { '@supabase/x': '1.0.0' } }],
  ])('%s → знайдено', (_name, json) => {
    expect(supabaseRefsInJson(json)).toEqual(['@supabase/x']);
  });

  it('чистий маніфест → порожньо', () => {
    expect(
      supabaseRefsInJson({
        dependencies: { react: '1' },
        overrides: { foo: '1' },
        peerDependenciesMeta: { pg: { optional: true } },
      }),
    ).toEqual([]);
  });

  it('overrides у pnpm-workspace.yaml → знайдено', () => {
    const yaml = "packages:\n  - 'a/*'\noverrides:\n  '@supabase/x': 1.0.0\n";
    expect(supabaseRefsInYaml(yaml)).toEqual(['@supabase/x']);
  });

  it('@supabase/ поза overrides yaml (коментар, інший ключ) не рахується', () => {
    const yaml =
      "# @supabase/x знесено\npackages:\n  - 'a/*'\noverrides:\n  foo: 1.0.0\n";
    expect(supabaseRefsInYaml(yaml)).toEqual([]);
  });
});

describe('код шаблону магазину без імпортів @supabase/*', () => {
  const files = templateCodeFiles();

  it('множина файлів не вакуумна', () => {
    expect(files).toContain(
      'packages/create-simplycms-store/template/vite.config.ts',
    );
    expect(files).toContain(
      'packages/create-simplycms-store/template/simplycms.config.ts',
    );
    expect(files.some((f) => f.startsWith('tests/pilot/store-template/'))).toBe(
      true,
    );
  });

  it('парсинг справжній: TS і TSX дають 0 повідомлень, не fatal', () => {
    const ts = lintSnippet(
      'const x: Record<string, number> = {}; type T = { a?: string };',
      'a.ts',
    );
    const tsx = lintSnippet('export const A = () => <div a="1" />;', 'a.tsx');
    expect(ts).toEqual([]);
    expect(tsx).toEqual([]);
    // Негативний контроль: ламаний синтаксис дає fatal, а не мовчазні 0.
    expect(lintSnippet('const = ;', 'b.ts').some((m) => m.fatal)).toBe(true);
    // Правило справді спрацьовує на цьому парсері.
    expect(lintSnippet(`import '@supabase/ssr';`, 'c.ts')).toHaveLength(1);
  });

  it('жоден файл не імпортує @supabase/* і не падає парсером', () => {
    const bad = files.flatMap((rel) =>
      lintTemplateFile(rel).map((m) => `${rel}: ${m.message}`),
    );
    expect(bad).toEqual([]);
  });
});
