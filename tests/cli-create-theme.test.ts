import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  parseCreateArgs,
  renderThemeTemplate,
  scaffoldTheme,
  templateThemeDir,
  themeDisplayName,
} from '../packages/cli/src/create.mjs';

// simplycms create theme (Фаза 4, Р6): скаффолд теми в themes/ магазину з
// template-theme/ пакета CLI. Методика — та сама, що cli-create.test.ts:
// чисті функції напряму, без spawn.

const PLACEHOLDERS = [
  '__THEME_NAME__',
  '__THEME_DISPLAY_NAME__',
  '__CORE_RANGE__',
];

function scaffoldInTemp(themeName: string) {
  const target = join(mkdtempSync(join(tmpdir(), 'cli-theme-')), themeName);
  const created = scaffoldTheme({
    templateDir: templateThemeDir(),
    targetDir: target,
    themeName,
    coreRange: '>=0.3.0',
  });
  return { target, created };
}

describe('cli create theme: парсер', () => {
  it('create theme <name> [--dry-run]', () => {
    expect(parseCreateArgs(['theme', 'aurora'])).toEqual({
      kind: 'theme',
      name: 'aurora',
      dryRun: false,
    });
    expect(parseCreateArgs(['theme', 'aurora', '--dry-run']).dryRun).toBe(true);
    expect(() => parseCreateArgs(['theme', 'Bad_Name'])).toThrow(
      /Невалідне імʼя/,
    );
    expect(() => parseCreateArgs(['theme'])).toThrow(/create theme <name>/);
  });
});

describe('cli create theme: скаффолд', () => {
  it('рендерить плейсхолдери і перейменовує package.json.tpl', () => {
    const { target, created } = scaffoldInTemp('solar-store');

    expect(created).toContain('package.json');
    expect(created).not.toContain('package.json.tpl');
    // Контракт v2 у повному складі: паспорт, токени, каталог, обидва
    // обовʼязкові компоненти.
    for (const file of [
      'index.ts',
      'manifest.ts',
      'tokens.ts',
      'messages.ts',
      'components/Header.tsx',
      'components/Footer.tsx',
      'README.md',
    ]) {
      expect(created, `у шаблоні немає ${file}`).toContain(file);
    }
    for (const rel of created) {
      const text = readFileSync(join(target, rel), 'utf8');
      for (const placeholder of PLACEHOLDERS) {
        expect(text, `${rel} містить нерозгорнутий плейсхолдер`).not.toContain(
          placeholder,
        );
      }
    }

    const manifest = JSON.parse(
      readFileSync(join(target, 'package.json'), 'utf8'),
    ) as { name: string; private: boolean };
    // Локальна форма теми (як themes/default): private, конвенційне імʼя.
    expect(manifest.name).toBe('simplycms-theme-solar-store');
    expect(manifest.private).toBe(true);

    const themeManifest = readFileSync(join(target, 'manifest.ts'), 'utf8');
    expect(themeManifest).toContain("name: 'solar-store'");
    expect(themeManifest).toContain("displayName: 'Solar Store'");
    expect(themeManifest).toContain("simplycms: '>=0.3.0'");
    expect(existsSync(join(target, 'components/Header.tsx'))).toBe(true);
  });

  it('скаффолджені модулі — валідний TypeScript/TSX', () => {
    const { target, created } = scaffoldInTemp('demo');
    for (const file of created.filter((rel) => /\.tsx?$/.test(rel))) {
      const output = ts.transpileModule(
        readFileSync(join(target, file), 'utf8'),
        {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
          },
          fileName: file,
          // Без прапорця transpileModule НІКОЛИ не збирає діагностик і асерт
          // нижче тривіально зелений (знахідка ревʼю Фази 3).
          reportDiagnostics: true,
        },
      );
      expect(
        output.diagnostics ?? [],
        `${file} не транспілюється`,
      ).toHaveLength(0);
    }
  });

  it('themeDisplayName: ключ → людське імʼя для адмінки', () => {
    expect(themeDisplayName('aurora')).toBe('Aurora');
    expect(themeDisplayName('solar-store')).toBe('Solar Store');
  });

  it('renderThemeTemplate: підставляє всі три плейсхолдери', () => {
    expect(
      renderThemeTemplate(
        '__THEME_DISPLAY_NAME__/__THEME_NAME__/__CORE_RANGE__',
        {
          themeName: 'aurora',
          displayName: 'Aurora',
          coreRange: '>=1.0.0',
        },
      ),
    ).toBe('Aurora/aurora/>=1.0.0');
  });
});
