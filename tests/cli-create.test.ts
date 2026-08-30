import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
    expect(() => parseCreateArgs(['widget', 'x'])).toThrow(/лише/);
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

  it('скаффолджений плагін несе міграцію власної таблиці БЕЗ DEFAULT на id', () => {
    // Контракт К3-Е0: id генерує клієнт, тому scaffold-DDL не сміє мати
    // DEFAULT gen_random_uuid() — інакше перший сторонній плагін одразу
    // ловить розбіжність ключів між оптимістичним і серверним рядком.
    const target = join(mkdtempSync(join(tmpdir(), 'cli-create-')), 'my-faq');
    const created = scaffoldPlugin({
      templateDir: templatePluginDir(),
      targetDir: target,
      pluginName: 'my-faq',
      coreRange: '>=0.3.0',
    });

    expect(created).toContain('migrations/0001_plg_my_faq_init.sql');
    const migration = readFileSync(
      join(target, 'migrations/0001_plg_my_faq_init.sql'),
      'utf8',
    );
    expect(migration).toContain('plg_my_faq_items');
    expect(migration).not.toContain('default gen_random_uuid()');
  });

  it('імена міграцій скаффолду не колізують із каноном ядра', () => {
    // 🔴 Регресія C1: шаблон плагіна називався `0001_init.sql` — тим самим
    // іменем, що й baseline ядра. `compareMigrationsMulti` бачив «одне імʼя,
    // різний вміст у двох канонах» → `collision`, і `simplycms db:diff` падав
    // з exitCode 1 ДО копіювання будь-чого: магазин після `create plugin` не
    // міг забрати навіть міграції ядра (`doctor` №7 — error). Фікс — рендер
    // плейсхолдерів в ІМЕНАХ файлів (`scaffoldTree`), тож імʼя унікальне на
    // плагін. Гейт стереже саме цю властивість, а не конкретне імʼя.
    const coreNames = readdirSync(
      resolve(import.meta.dirname, '../packages/simplycms/migrations'),
    ).filter((name) => name.endsWith('.sql'));
    expect(coreNames.length).toBeGreaterThan(0);

    const target = join(mkdtempSync(join(tmpdir(), 'cli-create-')), 'my-faq');
    const created = scaffoldPlugin({
      templateDir: templatePluginDir(),
      targetDir: target,
      pluginName: 'my-faq',
      coreRange: '>=0.3.0',
    });
    const scaffolded = created
      .filter((rel) => rel.startsWith('migrations/'))
      .map((rel) => rel.slice('migrations/'.length));
    expect(scaffolded.length).toBeGreaterThan(0);

    const clashes = scaffolded.filter((name) => coreNames.includes(name));
    expect(
      clashes,
      `імена міграцій плагіна збігаються з каноном ядра: ${clashes.join(', ')}`,
    ).toEqual([]);

    // Плейсхолдер в імені мусить бути розгорнутий, а не поїхати як є.
    for (const name of scaffolded) {
      expect(name).not.toContain('__');
      expect(name).toContain('plg_my_faq_');
    }
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
