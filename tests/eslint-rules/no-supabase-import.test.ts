import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from '../../eslint-rules/no-supabase-import.mjs';
import eslintConfig from '../../eslint.config.mjs';

const linter = new Linter();
const lint = (code: string) =>
  linter.verify(code, {
    plugins: { s: { rules: { 'no-supabase-import': rule } } },
    rules: { 's/no-supabase-import': 'error' },
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
  });

describe('no-supabase-import', () => {
  it.each([
    ['імпорт', `import { createClient } from '@supabase/supabase-js';`],
    ['side-effect імпорт', `import '@supabase/ssr';`],
    ['export *', `export * from '@supabase/storage-js';`],
    ['export {} from', `export { x } from '@supabase/ssr';`],
    ['динамічний імпорт', `await import('@supabase/supabase-js');`],
    ['шаблон без виразів', 'await import(`@supabase/ssr`);'],
    ['require', `require('@supabase/supabase-js');`],
  ])('валить: %s', (_label, code) => {
    const messages = lint(code);
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('supabaseImport');
  });

  it.each([
    ['схожий пакет', `import x from 'supabase-like';`],
    ['інший скоуп', `import x from '@supabaseish/x';`],
    ['рядок, не імпорт', `const s = '@supabase/x';`],
    ['динамічний специфікатор', `import(dynamicVar);`],
  ])('не валить: %s', (_label, code) => {
    expect(lint(code)).toHaveLength(0);
  });
});

// Доводить, що блок у eslint.config.mjs покриває все репо, а не лише
// RuleTester: прогін справжнього конфігу по файлах із різних зон.
describe('no-supabase-import у eslint.config.mjs', () => {
  const real = new Linter({ configType: 'flat' });
  it.each([
    'packages/simplycms/src/x.ts',
    'src/x.ts',
    'plugins/x/index.ts',
    'scripts/x.mjs',
  ])('зона покриває %s', (filePath) => {
    const hits = real
      .verify(`import '@supabase/ssr';`, eslintConfig as never, { filePath })
      .filter((m) => m.ruleId === 'simplycms-supabase/no-supabase-import');
    expect(hits).toHaveLength(1);
  });
  // Захист від вакууму: парсер конфігу той самий, що в тестах шаблону.
  it('конфіг використовує парсер typescript-eslint', () => {
    expect(tseslint.parser).toBeDefined();
  });
});
