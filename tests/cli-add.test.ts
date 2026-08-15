import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parseAddArgs } from '../packages/cli/src/add.mjs';
import {
  assertThemeKeyFree,
  configPluginNames,
  configThemeEntries,
  configThemeKeys,
  deriveKey,
  entryLine,
  hasPackage,
  insertEntry,
} from '../packages/cli/src/config-edit.mjs';

// Якірне редагування simplycms.config.ts — на РЕАЛЬНИХ конфігах (шаблон
// скаффолдера і корінь монорепо): вони джерело правди якорів «plugins: [»
// і «themes: {», і зміна форми конфігу має валити саме ці тести.
const templateConfig = readFileSync(
  'packages/create-simplycms-store/template/simplycms.config.ts',
  'utf8',
);
const hostConfig = readFileSync('simplycms.config.ts', 'utf8');

// Однорядкові форми, у які pinned prettier згортає ПОРОЖНІ блоки (наприклад,
// «plugins: [],» після видалення демо-плагіна з шаблону).
const collapsedConfig = templateConfig
  .replace(/plugins: \[[^]*?\],/, 'plugins: [],')
  .replace(/themes: \{[^]*?\},/, 'themes: {},');

// Однорядкова НЕПОРОЖНЯ форма масиву plugins — безпечної точки вставки немає.
const inlineFullConfig = templateConfig.replace(
  /plugins: \[[^]*?\],/,
  "plugins: [{ name: 'demo', module: () => import('demo-pkg') }],",
);

/** Синтаксичні діагностики TS: transpileModule парсить без semantic-перевірок. */
function syntaxErrors(code: string) {
  const { diagnostics } = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
  });
  return (diagnostics ?? []).map((d) =>
    ts.flattenDiagnosticMessageText(d.messageText, ' '),
  );
}

describe('cli add', () => {
  it('parseAddArgs: повний набір прапорців', () => {
    const options = parseAddArgs([
      '@acme/simplycms-plugin-wishlist',
      '--plugin',
      '--name',
      'wl',
      '--no-install',
      '--dry-run',
    ]);
    expect(options).toEqual({
      pkg: '@acme/simplycms-plugin-wishlist',
      type: 'plugin',
      name: 'wl',
      install: false,
      copy: false,
      dryRun: true,
    });
  });

  it('parseAddArgs: --copy — лише для теми і лише з install', () => {
    expect(
      parseAddArgs(['@acme/simplycms-theme-aurora', '--theme', '--copy']).copy,
    ).toBe(true);
    expect(() => parseAddArgs(['pkg', '--plugin', '--copy'])).toThrow(
      /--copy — лише для тем/,
    );
    expect(() =>
      parseAddArgs(['pkg', '--theme', '--copy', '--no-install']),
    ).toThrow(/взаємовиключні/);
  });

  it('parseAddArgs: порушення контракту — гучні помилки', () => {
    expect(() => parseAddArgs(['pkg', '--plugin', '--theme'])).toThrow(
      /взаємовиключні/,
    );
    expect(() => parseAddArgs(['pkg'])).toThrow(/--plugin або --theme/);
    expect(() => parseAddArgs(['--plugin'])).toThrow(/Не задано пакет/);
    expect(() => parseAddArgs(['pkg', '--plugin', '--name'])).toThrow(
      /--name потребує значення/,
    );
    expect(() => parseAddArgs(['pkg', '--plugin', '--wat'])).toThrow(/--wat/);
    expect(() => parseAddArgs(['pkg', 'zayvyi', '--plugin'])).toThrow(
      /Зайвий аргумент/,
    );
  });

  it('deriveKey: без scope і префіксів simplycms-plugin-/simplycms-theme-', () => {
    expect(deriveKey('@acme/simplycms-plugin-wishlist')).toBe('wishlist');
    expect(deriveKey('simplycms-theme-solar')).toBe('solar');
    expect(deriveKey('plain-pkg')).toBe('plain-pkg');
    // Scoped-конвенція референс-пакетів ядра: ключ = manifest.name = 'faq'.
    // Без цього документований flow «add @simplycms/plugin-faq → db:diff»
    // давав би ключ 'plugin-faq' і валив лінт меж (знахідка рев'ю Фази 3).
    expect(deriveKey('@simplycms/plugin-faq')).toBe('faq');
    expect(deriveKey('@simplycms/theme-solar')).toBe('solar');
    expect(deriveKey('@acme/simplycms-plugin-wishlist', 'explicit')).toBe(
      'explicit',
    );
    expect(() => deriveKey("@acme/weird'name")).toThrow(/--name/);
  });

  it('insertEntry: плагін стає одразу після якоря шаблонного конфігу', () => {
    const { source, line } = insertEntry(templateConfig, {
      type: 'plugin',
      key: 'wishlist',
      pkg: '@acme/simplycms-plugin-wishlist',
    });
    expect(line).toBe(
      "    { name: 'wishlist', module: () => import('@acme/simplycms-plugin-wishlist') },",
    );
    // Новий запис вище наявного hello-world, hello-world не постраждав.
    expect(source.indexOf('wishlist')).toBeLessThan(
      source.indexOf('hello-world'),
    );
    expect(configPluginNames(source)).toEqual([
      'wishlist',
      'hello-world',
      'faq',
    ]);
  });

  it('insertEntry: тема вставляється і в конфіг кореня монорепо', () => {
    const { source } = insertEntry(hostConfig, {
      type: 'theme',
      key: 'solar',
      pkg: '@acme/simplycms-theme-solar',
    });
    expect(source).toContain(
      "'solar': () => import('@acme/simplycms-theme-solar'),",
    );
    expect(configThemeKeys(source)).toEqual([
      'solar',
      'deo',
      'default',
      'solarstore',
    ]);
  });

  it('insertEntry: однорядковий порожній plugins розгортається у валідний TS', () => {
    expect(collapsedConfig).toContain('plugins: [],');
    const { source, line } = insertEntry(collapsedConfig, {
      type: 'plugin',
      key: 'wishlist',
      pkg: '@acme/simplycms-plugin-wishlist',
    });
    expect(source).toContain(
      '  plugins: [\n' +
        "    { name: 'wishlist', module: () => import('@acme/simplycms-plugin-wishlist') },\n" +
        '  ],',
    );
    expect(line).toBe(
      "    { name: 'wishlist', module: () => import('@acme/simplycms-plugin-wishlist') },",
    );
    expect(configPluginNames(source)).toEqual(['wishlist']);
    expect(syntaxErrors(source)).toEqual([]);
  });

  it('insertEntry: однорядковий порожній themes розгортається у валідний TS', () => {
    expect(collapsedConfig).toContain('themes: {},');
    const { source } = insertEntry(collapsedConfig, {
      type: 'theme',
      key: 'solar',
      pkg: '@acme/simplycms-theme-solar',
    });
    expect(source).toContain(
      "  themes: {\n    'solar': () => import('@acme/simplycms-theme-solar'),\n  },",
    );
    expect(configThemeKeys(source)).toEqual(['solar']);
    expect(syntaxErrors(source)).toEqual([]);
  });

  it('insertEntry: однорядковий непорожній блок — виняток із рядком для ручної вставки', () => {
    const entry = entryLine('plugin', 'x', 'pkg-x');
    const insert = () =>
      insertEntry(inlineFullConfig, { type: 'plugin', key: 'x', pkg: 'pkg-x' });
    expect(insert).toThrow(entry);
    expect(insert).toThrow(/файл не змінено/);
  });

  it('add: однорядковий непорожній блок — exit 1, конфіг байт-у-байт незмінний', () => {
    const store = mkdtempSync(join(tmpdir(), 'cli-add-'));
    writeFileSync(
      join(store, 'package.json'),
      JSON.stringify({
        name: 's',
        dependencies: { '@simplycms/core': '0.0.0' },
      }),
    );
    const configPath = join(store, 'simplycms.config.ts');
    writeFileSync(configPath, inlineFullConfig);
    const cli = fileURLToPath(
      new URL('../packages/cli/src/index.mjs', import.meta.url),
    );
    const run = spawnSync(
      process.execPath,
      [cli, 'add', 'pkg-x', '--plugin', '--no-install'],
      { cwd: store, encoding: 'utf8' },
    );
    expect(run.status).toBe(1);
    expect(`${run.stdout}${run.stderr}`).toContain('файл не змінено');
    expect(readFileSync(configPath, 'utf8')).toBe(inlineFullConfig);
  });

  it('assertThemeKeyFree: той самий spec — true, інший — виняток, вільний — false', () => {
    const copyWired = templateConfig.replace(
      'themes: {',
      "themes: {\n    'aurora': () => import('@themes/aurora/index'),",
    );
    expect(
      assertThemeKeyFree(copyWired, 'aurora', '@themes/aurora/index'),
    ).toBe(true);
    expect(() =>
      assertThemeKeyFree(copyWired, 'aurora', '@acme/simplycms-theme-aurora'),
    ).toThrow(/--name/);
    expect(assertThemeKeyFree(copyWired, 'solar', 'pkg-solar')).toBe(false);
  });

  it('add --theme: ключ зайнято copy-in-темою — exit 1, конфіг незмінний, pnpm НЕ викликано', () => {
    // Дзеркальний до copy-гілки напрямок колізії: тема вже вкопійована в
    // themes/aurora, npm-установка з тим самим ключем дала б дубль ключа.
    // 🔴 Запуск БЕЗ --no-install і зі stub-pnpm попереду PATH: інваріант Р5
    // «незворотні дії після валідацій» тримається лише якщо гард стоїть ДО
    // execFileSync('pnpm', ['add', …]) — порожній журнал stub-а доводить
    // саме порядок, а не тільки exit-код (мутаційно перевірено: перенесення
    // гарда під install валить рівно цей асерт).
    const store = mkdtempSync(join(tmpdir(), 'cli-add-theme-'));
    writeFileSync(
      join(store, 'package.json'),
      JSON.stringify({
        name: 's',
        dependencies: { '@simplycms/core': '0.0.0' },
      }),
    );
    const configPath = join(store, 'simplycms.config.ts');
    const copyWired = templateConfig.replace(
      'themes: {',
      "themes: {\n    'aurora': () => import('@themes/aurora/index'),",
    );
    writeFileSync(configPath, copyWired);
    const binDir = mkdtempSync(join(tmpdir(), 'cli-stub-pnpm-'));
    const logPath = join(binDir, 'pnpm-calls.log');
    writeFileSync(
      join(binDir, 'pnpm'),
      `#!/bin/sh\necho "$@" >> ${logPath}\n`,
      { mode: 0o755 },
    );
    const cli = fileURLToPath(
      new URL('../packages/cli/src/index.mjs', import.meta.url),
    );
    const run = spawnSync(
      process.execPath,
      [cli, 'add', '@acme/simplycms-theme-aurora', '--theme'],
      {
        cwd: store,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
      },
    );
    expect(run.status).toBe(1);
    expect(`${run.stdout}${run.stderr}`).toContain('--name');
    expect(readFileSync(configPath, 'utf8')).toBe(copyWired);
    expect(existsSync(logPath)).toBe(false);
  });

  it('insertEntry: без якоря — виняток із точним рядком, без змін файлу', () => {
    const alien = 'export default defineConfig({});\n';
    const entry = entryLine('plugin', 'x', 'pkg-x');
    expect(() =>
      insertEntry(alien, { type: 'plugin', key: 'x', pkg: 'pkg-x' }),
    ).toThrow(entry);
    expect(() =>
      insertEntry(alien, { type: 'plugin', key: 'x', pkg: 'pkg-x' }),
    ).toThrow(/файл не змінено/);
  });

  it('hasPackage: основа ідемпотентності — import(<pkg>) уже в конфізі', () => {
    expect(hasPackage(templateConfig, '@plugins/hello-world')).toBe(true);
    expect(hasPackage(templateConfig, '@acme/simplycms-plugin-wishlist')).toBe(
      false,
    );
  });

  it('парсери конфігу читають реальні ключі; без якоря — null', () => {
    expect(configThemeKeys(templateConfig)).toEqual(['default']);
    expect(configThemeKeys(hostConfig)).toEqual([
      'deo',
      'default',
      'solarstore',
    ]);
    expect(configPluginNames(templateConfig)).toEqual(['hello-world', 'faq']);
    expect(configThemeKeys('export default {}')).toBeNull();
    expect(configPluginNames('export default {}')).toBeNull();
  });

  it('configThemeEntries: ключ + специфікатор import() — обидві форми запису', () => {
    // Саме специфікатор, а не ключ, резолвить doctor: локальна тека і пакет —
    // різні місця на диску, а через --name ключ може не збігатися з жодним.
    expect(configThemeEntries(hostConfig)).toEqual([
      { key: 'deo', spec: '@themes/deo/index' },
      { key: 'default', spec: '@themes/default/index' },
      { key: 'solarstore', spec: '@simplycms/theme-solarstore' },
    ]);
    expect(configThemeEntries('export default {}')).toBeNull();
  });
});
