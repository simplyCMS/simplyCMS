import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAddArgs } from '../packages/cli/src/add.mjs';
import {
  configPluginNames,
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
      dryRun: true,
    });
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
    expect(configPluginNames(source)).toEqual(['wishlist', 'hello-world']);
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
    expect(configThemeKeys(source)).toEqual(['solar', 'default', 'solarstore']);
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
    expect(configThemeKeys(hostConfig)).toEqual(['default', 'solarstore']);
    expect(configPluginNames(templateConfig)).toEqual(['hello-world']);
    expect(configThemeKeys('export default {}')).toBeNull();
    expect(configPluginNames('export default {}')).toBeNull();
  });
});
