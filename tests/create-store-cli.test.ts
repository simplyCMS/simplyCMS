import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
//
// 🔴 Supabase-прапорців у CLI більше немає: магазин отримує підключення до
// Postgres, а не ключі клієнта до чужого HTTP-API.
const DSN = 'postgresql://app_runtime:pw@localhost:5432/postgres';
describe('create-store CLI', () => {
  it('resolveOptions: прапорці перекривають промпти', () => {
    const o = resolveOptions(
      ['my-shop', '--database-url', DSN, '--no-install', '--no-git'],
      {},
      // 🔴 isTTY = true: інакше клаузула `!isTTY` сама дає yes:true й ховає
      // будь-яку регресію в решті джерел цього прапорця.
      true,
    );
    expect(o).toMatchObject({
      storeName: 'my-shop',
      databaseUrl: DSN,
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
      ['--database-url', DSN, '../shops/my-shop'],
      {},
      true,
    );
    expect(o.storeName).toBe('../shops/my-shop');
    expect(o.databaseUrl).toBe(DSN);
    expect(o.yes).toBe(false);
    expect(o.install).toBe(true);
    expect(o.git).toBe(true);
  });

  it('resolveOptions: невідомий прапорець — помилка', () => {
    expect(() => resolveOptions(['--wat'], {}, true)).toThrow(/--wat/);
  });

  it('resolveOptions: прапорець не ковтає наступний прапорець', () => {
    expect(() =>
      resolveOptions(['my-shop', '--database-url', '--no-git'], {}, true),
    ).toThrow(/--database-url потребує значення/);
  });

  it('resolveOptions: прапорець без значення в кінці argv — помилка', () => {
    expect(() =>
      resolveOptions(['my-shop', '--database-url'], {}, true),
    ).toThrow(/--database-url потребує значення/);
  });

  it('renderTemplate підставляє імʼя і версію в пакети ядра', () => {
    const tpl =
      '{"name":"__STORE_NAME__","dependencies":{"simplycms":"__SIMPLYCMS_VERSION__"},' +
      '"devDependencies":{"@simplycms/cli":"__SIMPLYCMS_VERSION__"}}';
    const out = JSON.parse(
      renderTemplate(tpl, { storeName: 'shop', version: '0.1.0' }),
    );
    expect(out.name).toBe('shop');
    expect(out.dependencies.simplycms).toBe('0.1.0');
    expect(out.devDependencies['@simplycms/cli']).toBe('0.1.0');
  });

  it('scaffold: перейменовує tpl/gitignore/env.example і пише .env.local', async () => {
    const target = join(mkdtempSync(join(tmpdir(), 'css-')), 'demo');
    await scaffold({
      templateDir: 'packages/create-simplycms-store/template',
      targetDir: target,
      storeName: 'demo',
      // 🔴 Sentinel, а НЕ поточна версія ядра: якби тут стояло `0.1.0`,
      // літерал `"0.1.0"`, дописаний рукою в `package.json.tpl`, рендерився б
      // у те саме значення — і асерт нижче його не відрізнив би.
      version: '9.9.9-sentinel',
      databaseUrl: DSN,
    });
    expect(existsSync(join(target, 'package.json'))).toBe(true);
    expect(existsSync(join(target, '.gitignore'))).toBe(true);
    expect(existsSync(join(target, '.env.example'))).toBe(true);
    expect(existsSync(join(target, 'package.json.tpl'))).toBe(false);
    const envLocal = readFileSync(join(target, '.env.local'), 'utf8');
    expect(envLocal).toContain(`DATABASE_URL=${DSN}`);
    expect(envLocal).toContain('VITE_SITE_URL=http://localhost:3000');
    // 🔴 Секрет підпису сесій генерується, а не приїжджає літералом: однаковий
    // у всіх магазинів секрет — вразливість, а не налаштування за замовчуванням.
    // 🔴 Довжини НЕДОСТАТНЬО: зашитий літерал на 32+ символи проходив би її
    // так само, як згенерований (доведено мутацією `randomBytes(32)` →
    // константа — тест лишався зеленим). Тому асертимо саме РІЗНІСТЬ між
    // двома скаффолдами плюс форму base64 від 32 байт.
    const secret = /^BETTER_AUTH_SECRET=(.+)$/m.exec(envLocal)?.[1] ?? '';
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(secret).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    const second = mkdtempSync(join(tmpdir(), 'simplycms-secret-'));
    try {
      await scaffold({
        templateDir: 'packages/create-simplycms-store/template',
        targetDir: second,
        storeName: 'demo2',
        version: '9.9.9-sentinel',
        databaseUrl: DSN,
      });
      const secondSecret =
        /^BETTER_AUTH_SECRET=(.+)$/m.exec(
          readFileSync(join(second, '.env.local'), 'utf8'),
        )?.[1] ?? '';
      expect(secondSecret).not.toBe(secret);
    } finally {
      rmSync(second, { recursive: true, force: true });
    }
    expect(envLocal).not.toMatch(/SUPABASE/);
    const manifest = JSON.parse(
      readFileSync(join(target, 'package.json'), 'utf8'),
    );
    expect(manifest.name).toBe('demo');

    // 🔴 СПРАВЖНІЙ `package.json.tpl`, а не синтетичний рядок: файл рукописний
    // (`template:sync` його не чіпає), тож літеральна версія, дописана рукою
    // разом із новою залежністю, інакше доїхала б у реліз — магазин ставив би
    // `simplycms@0.1.0` поруч із `@simplycms/cli@0.2.0`.
    // Секції ДВІ: ядро — unscoped `simplycms` у dependencies, CLI лишається
    // scoped-сателітом у devDependencies; перевірка однієї секції пропустила
    // б рукописний літерал у другій.
    for (const section of ['dependencies', 'devDependencies'] as const) {
      const core = Object.entries(manifest[section] as Record<string, string>)
        .filter(
          ([name]) => name === 'simplycms' || name.startsWith('@simplycms/'),
        )
        .map(([, range]) => range);
      expect(core.length).toBeGreaterThan(0);
      expect(core).toEqual(core.map(() => '9.9.9-sentinel'));
    }
  });

  // 🔴 Магазин налаштований ЛИШЕ під pnpm 11+. Обидва механізми pnpm-специфічні
  // і живуть у різних файлах, тож перевіряємо саме розгорнутий магазин, а не
  // шаблон: `allowBuilds` без цього файлу = ERR_PNPM_IGNORED_BUILDS на install,
  // і далі `pnpm build` (він перезапускає install) теж падає — магазин не
  // збереться взагалі.
  it('scaffold: магазин несе pnpm-конфіг (allowBuilds + packageManager)', async () => {
    const target = join(mkdtempSync(join(tmpdir(), 'css-')), 'pm');
    await scaffold({
      templateDir: 'packages/create-simplycms-store/template',
      targetDir: target,
      storeName: 'pm',
      version: '9.9.9-sentinel',
    });

    const workspace = readFileSync(join(target, 'pnpm-workspace.yaml'), 'utf8');
    expect(workspace).toMatch(/^allowBuilds:/m);
    expect(workspace).toMatch(/^\s+esbuild: true$/m);

    const manifest = JSON.parse(
      readFileSync(join(target, 'package.json'), 'utf8'),
    );
    expect(manifest.packageManager).toMatch(/^pnpm@11\./);
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

  it('scaffold: без DATABASE_URL .env.local не створюється', async () => {
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
