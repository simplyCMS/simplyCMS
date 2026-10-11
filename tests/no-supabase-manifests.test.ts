import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ROOT,
  lintSnippet,
  lintTemplateFile,
  manifestFiles,
  supabaseDeps,
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
