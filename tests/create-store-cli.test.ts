import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveOptions } from '../packages/create-simplycms-store/src/args.mjs';
import {
  renderTemplate,
  scaffold,
} from '../packages/create-simplycms-store/src/scaffold.mjs';
import { findPlaceholders } from '../scripts/pilot-pack/placeholder-scan.mjs';

// Чисті функції CLI-скаффолдера: розбір аргументів, підстановки в манифест,
// розгортання шаблону. Ті самі функції викликає `src/index.mjs`.
describe('create-store CLI', () => {
  it('resolveOptions: прапорці перекривають промпти', () => {
    const o = resolveOptions(
      [
        'my-shop',
        '--supabase-url',
        'https://x.supabase.co',
        '--supabase-key',
        'sb_pk',
        '--no-install',
        '--no-git',
      ],
      {},
      // 🔴 isTTY = true: інакше клаузула `!isTTY` сама дає yes:true й ховає
      // будь-яку регресію в решті джерел цього прапорця.
      true,
    );
    expect(o).toMatchObject({
      storeName: 'my-shop',
      supabaseUrl: 'https://x.supabase.co',
      supabaseKey: 'sb_pk',
      install: false,
      git: false,
      yes: false,
    });
  });

  // Три НЕЗАЛЕЖНІ джерела `yes`. Перевіряти їх разом не можна: у сумарному
  // кейсі кожне маскує падіння двох інших.
  it('resolveOptions: CI ⇒ yes навіть у TTY', () => {
    expect(resolveOptions([], { CI: 'true' }, true).yes).toBe(true);
  });

  it('resolveOptions: --yes ⇒ yes', () => {
    expect(resolveOptions(['--yes'], {}, true).yes).toBe(true);
    expect(resolveOptions(['-y'], {}, true).yes).toBe(true);
  });

  it('resolveOptions: не-TTY ⇒ yes', () => {
    expect(resolveOptions([], {}, false).yes).toBe(true);
  });

  it('resolveOptions: значення прапорця не з’їдає позиційний аргумент', () => {
    const o = resolveOptions(
      ['--supabase-url', 'https://x.supabase.co', '../shops/my-shop'],
      {},
      true,
    );
    expect(o.storeName).toBe('../shops/my-shop');
    expect(o.supabaseUrl).toBe('https://x.supabase.co');
    expect(o.yes).toBe(false);
    expect(o.install).toBe(true);
    expect(o.git).toBe(true);
  });

  it('resolveOptions: невідомий прапорець — помилка', () => {
    expect(() => resolveOptions(['--wat'], {}, true)).toThrow(/--wat/);
  });

  it('resolveOptions: прапорець не ковтає наступний прапорець', () => {
    expect(() =>
      resolveOptions(
        ['my-shop', '--supabase-url', '--no-git', '--supabase-key', 'sb_x'],
        {},
        true,
      ),
    ).toThrow(/--supabase-url потребує значення/);
  });

  it('resolveOptions: прапорець не з’їдає інший прапорець і не краде теку', () => {
    expect(() =>
      resolveOptions(
        ['--supabase-url', '--supabase-key', 'sb_x', 'shop'],
        {},
        true,
      ),
    ).toThrow(/--supabase-url потребує значення/);
  });

  it('resolveOptions: прапорець без значення в кінці argv — помилка', () => {
    expect(() =>
      resolveOptions(['my-shop', '--supabase-key'], {}, true),
    ).toThrow(/--supabase-key потребує значення/);
  });

  it('renderTemplate підставляє імʼя і версію в усі @simplycms/*', () => {
    const tpl =
      '{"name":"__STORE_NAME__","dependencies":{"@simplycms/ui":"__SIMPLYCMS_VERSION__"}}';
    const out = JSON.parse(
      renderTemplate(tpl, { storeName: 'shop', version: '0.1.0' }),
    );
    expect(out.name).toBe('shop');
    expect(out.dependencies['@simplycms/ui']).toBe('0.1.0');
  });

  it('scaffold: перейменовує tpl/gitignore/env.example і пише .env.local', async () => {
    const target = join(mkdtempSync(join(tmpdir(), 'css-')), 'demo');
    await scaffold({
      templateDir: 'packages/create-simplycms-store/template',
      targetDir: target,
      storeName: 'demo',
      version: '0.1.0',
      supabaseUrl: 'https://x.supabase.co',
      supabaseKey: 'sb_pk',
    });
    expect(existsSync(join(target, 'package.json'))).toBe(true);
    expect(existsSync(join(target, '.gitignore'))).toBe(true);
    expect(existsSync(join(target, '.env.example'))).toBe(true);
    expect(existsSync(join(target, 'package.json.tpl'))).toBe(false);
    expect(readFileSync(join(target, '.env.local'), 'utf8')).toContain(
      'VITE_SUPABASE_URL=https://x.supabase.co',
    );
    const manifest = JSON.parse(
      readFileSync(join(target, 'package.json'), 'utf8'),
    );
    expect(manifest.name).toBe('demo');

    // 🔴 СПРАВЖНІЙ `package.json.tpl`, а не синтетичний рядок: файл рукописний
    // (`template:sync` його не чіпає), тож літеральна версія, дописана рукою
    // разом із новою залежністю, інакше доїхала б у реліз — магазин ставив би
    // `@simplycms/ui@0.1.0` поруч із двадцятьма `@simplycms/*@0.2.0`.
    const core = Object.entries(manifest.dependencies as Record<string, string>)
      .filter(([name]) => name.startsWith('@simplycms/'))
      .map(([, range]) => range);
    expect(core.length).toBeGreaterThan(0);
    expect(core).toEqual(core.map(() => '0.1.0'));
  });

  it('scaffold: у згенерованому магазині не лишається плейсхолдерів', async () => {
    const target = join(mkdtempSync(join(tmpdir(), 'css-')), 'demo');
    await scaffold({
      templateDir: 'packages/create-simplycms-store/template',
      targetDir: target,
      storeName: 'demo',
      version: '0.1.0',
    });
    // project_id тримає імена контейнерів локального стеку: спільний на два
    // магазини = спільна БД, тому підстановка тут не менш важлива за manifest.
    expect(
      readFileSync(join(target, 'supabase/config.toml'), 'utf8'),
    ).toContain('project_id = "demo"');
    expect(findPlaceholders(target)).toEqual([]);
  });

  it('scaffold: без ключів Supabase .env.local не створюється', async () => {
    const target = join(mkdtempSync(join(tmpdir(), 'css-')), 'demo');
    await scaffold({
      templateDir: 'packages/create-simplycms-store/template',
      targetDir: target,
      storeName: 'demo',
      version: '0.1.0',
    });
    expect(existsSync(join(target, '.env.local'))).toBe(false);
    expect(existsSync(join(target, '.env.example'))).toBe(true);
  });
});
