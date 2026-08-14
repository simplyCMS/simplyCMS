import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  parseCreateArgs,
  renderPluginTemplate,
  scaffoldPlugin,
  templatePluginDir,
} from '../packages/cli/src/create.mjs';

// simplycms create plugin (Фаза 3, Р9): скаффолд плагіна в plugins/ магазину
// з template-plugin/ пакета CLI. Чисті функції — напряму, без spawn.

describe('cli create: парсер', () => {
  it('create plugin <name> [--dry-run]', () => {
    expect(parseCreateArgs(['plugin', 'my-faq'])).toEqual({
      kind: 'plugin',
      name: 'my-faq',
      dryRun: false,
    });
    expect(parseCreateArgs(['plugin', 'x', '--dry-run']).dryRun).toBe(true);
  });

  it('невідома суб-команда, відсутнє чи невалідне імʼя — гучна помилка', () => {
    expect(() => parseCreateArgs(['theme', 'x'])).toThrow(/лише/);
    expect(() => parseCreateArgs(['plugin'])).toThrow(/Не задано імʼя/);
    expect(() => parseCreateArgs(['plugin', 'Bad_Name'])).toThrow(
      /Невалідне імʼя/,
    );
    expect(() => parseCreateArgs(['plugin', 'x', '--wat'])).toThrow(/--wat/);
  });
});

describe('cli create: скаффолд', () => {
  it('рендерить плейсхолдери і перейменовує package.json.tpl', () => {
    const target = join(mkdtempSync(join(tmpdir(), 'cli-create-')), 'my-faq');
    const created = scaffoldPlugin({
      templateDir: templatePluginDir(),
      targetDir: target,
      pluginName: 'my-faq',
      coreRange: '>=0.3.0',
    });

    // package.json.tpl → package.json; плейсхолдерів не лишилось ніде.
    expect(created).toContain('package.json');
    expect(created).not.toContain('package.json.tpl');
    for (const rel of created) {
      const text = readFileSync(join(target, rel), 'utf8');
      for (const placeholder of [
        '__PLUGIN_NAME__',
        '__CORE_RANGE__',
        '__PLUGIN_TABLE_PREFIX__',
      ]) {
        expect(text, `${rel} містить нерозгорнутий плейсхолдер`).not.toContain(
          placeholder,
        );
      }
    }

    const manifest = JSON.parse(
      readFileSync(join(target, 'package.json'), 'utf8'),
    ) as { name: string; private: boolean };
    expect(manifest.name).toBe('simplycms-plugin-my-faq');
    expect(manifest.private).toBe(true);

    const index = readFileSync(join(target, 'index.ts'), 'utf8');
    expect(index).toContain("name: 'my-faq'");
    expect(index).toContain("simplycms: '>=0.3.0'");
    expect(existsSync(join(target, 'messages.ts'))).toBe(true);
  });

  it('скаффолджені index.ts і messages.ts — валідний TypeScript', () => {
    const target = join(mkdtempSync(join(tmpdir(), 'cli-create-')), 'demo');
    scaffoldPlugin({
      templateDir: templatePluginDir(),
      targetDir: target,
      pluginName: 'demo',
      coreRange: '>=0.3.0',
    });
    for (const file of ['index.ts', 'messages.ts']) {
      const output = ts.transpileModule(
        readFileSync(join(target, file), 'utf8'),
        {
          compilerOptions: { module: ts.ModuleKind.ESNext },
          fileName: file,
          // Без цього прапорця transpileModule НІКОЛИ не збирає діагностик
          // і асерт нижче тривіально зелений (знахідка рев'ю Фази 3).
          reportDiagnostics: true,
        },
      );
      expect(
        output.diagnostics ?? [],
        `${file} не транспілюється`,
      ).toHaveLength(0);
    }
  });

  it('ключі каталогу скаффолда несуть префікс plugin.<name>.', () => {
    const target = join(mkdtempSync(join(tmpdir(), 'cli-create-')), 'shop-x');
    scaffoldPlugin({
      templateDir: templatePluginDir(),
      targetDir: target,
      pluginName: 'shop-x',
      coreRange: '>=0.3.0',
    });
    const messages = readFileSync(join(target, 'messages.ts'), 'utf8');
    expect(messages).toContain("'plugin.shop-x.title'");
    // Префікс таблиць для імені з дефісом — з підкресленнями (SQL-ідентифікатор).
    const readme = readFileSync(join(target, 'README.md'), 'utf8');
    expect(readme).toContain('plg_shop_x_');
    expect(readme).not.toContain('plg_shop-x');
  });

  it('renderPluginTemplate підставляє обидва плейсхолдери', () => {
    expect(
      renderPluginTemplate('__PLUGIN_NAME__/__CORE_RANGE__/__PLUGIN_NAME__', {
        pluginName: 'a',
        coreRange: '>=1.0.0',
      }),
    ).toBe('a/>=1.0.0/a');
  });
});
