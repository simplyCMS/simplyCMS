import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runOfflineChecks } from '../packages/cli/src/doctor-checks.mjs';
import { checkEngines } from '../packages/cli/src/doctor-engines.mjs';
import { satisfies } from '../packages/simplycms/src/contracts/semver';
import {
  CLI_INDEX,
  CORE,
  STORE_ENV,
  scaffoldFakeStore,
} from './lib/fake-core-store';

// doctor №17 (Р32): `engines.simplycms` плагінів і тем проти встановленого ядра.
// 🔴 Ядро в тесті — СПРАВЖНІЙ `simplycms/contracts/semver` (три TS-файли
// транспільовано в `node_modules/simplycms` скаффолда), а не заглушка: саме npm-вирівняне
// пререліз-правило (`>=0.3.0` НЕ покриває `1.0.0-rc.1`) робить кейси змістовними.
const INDEX = CLI_INDEX;
const ENV = STORE_ENV;
const roots: string[] = [];
afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

const store = (name: string) => scaffoldFakeStore(name, roots);

const PLUGIN = 'plugins/hello-world/index.ts';
const THEME = 'themes/default/manifest.ts';
const ENGINES = /engines: \{ simplycms: '[^']+' \},/;

function setEngines(root: string, file: string, line: string) {
  const path = join(root, file);
  writeFileSync(path, readFileSync(path, 'utf8').replace(ENGINES, line));
}

function doctor(root: string) {
  const r = spawnSync('node', [INDEX, 'doctor'], {
    cwd: root,
    env: { ...process.env, ...ENV, NODE_ENV: '' },
    encoding: 'utf8',
  });
  const out = `${r.stdout}${r.stderr}`;
  return {
    out,
    status: r.status,
    line: out.split('\n').find((l) => l.includes('engines.simplycms')) ?? '',
  };
}

describe('doctor №17 engines (проводка через run(), справжній satisfies ядра)', () => {
  it('шаблонне `>=0.3.0` не покриває пререліз 1.0.0-rc.1 → error для плагіна й теми', async () => {
    const r = doctor(await store('eng-default'));
    expect(r.line).toContain('✗');
    expect(r.out).toContain('hello-world');
    expect(r.out).toContain('«>=0.3.0»');
    expect(r.out).toContain(`ядро ${CORE}`);
    expect(r.out).toContain('онови плагін або відкоти ядро');
    expect(r.out).toContain('тема «default»');
    expect(r.status).toBe(1);
  });

  it.each([
    ['плагін', PLUGIN],
    ['тема', THEME],
  ])(
    '%s: ^2.0.0 при ядрі rc → error, ^1.0.0-0 → ok, без engines → warn',
    async (_k, file) => {
      const root = await store('eng-cases');
      // Другий модуль приводимо до ok, щоб кейс міряв лише тестований.
      const other = file === PLUGIN ? THEME : PLUGIN;
      setEngines(root, other, "engines: { simplycms: '^1.0.0-0' },");

      setEngines(root, file, "engines: { simplycms: '^2.0.0' },");
      const bad = doctor(root);
      expect(bad.line).toContain('✗');
      expect(bad.out).toContain('«^2.0.0»');
      expect(bad.status).toBe(1);

      setEngines(root, file, "engines: { simplycms: '^1.0.0-0' },");
      const good = doctor(root);
      expect(good.line).toContain('✓');
      expect(good.status).toBe(0);

      setEngines(root, file, '');
      const missing = doctor(root);
      expect(missing.line).toContain('!');
      expect(missing.out).toContain('не задано');
      expect(missing.status).toBe(0);
    },
  );

  it('пакет у node_modules: manifest.engines зібраного модуля читається з магазину', async () => {
    const root = await store('eng-pkg');
    setEngines(root, PLUGIN, "engines: { simplycms: '^1.0.0-0' },");
    setEngines(root, THEME, "engines: { simplycms: '^1.0.0-0' },");
    const pkg = join(root, 'node_modules/simplycms-plugin-acme');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, 'package.json'),
      JSON.stringify({
        name: 'simplycms-plugin-acme',
        type: 'module',
        main: 'index.js',
      }),
    );
    writeFileSync(
      join(pkg, 'index.js'),
      "export default { manifest: { name: 'acme', engines: { simplycms: '^2.0.0' } } };\n",
    );
    const cfg = join(root, 'simplycms.config.ts');
    writeFileSync(
      cfg,
      readFileSync(cfg, 'utf8').replace(
        'plugins: [',
        "plugins: [\n    { name: 'acme', module: () => import('simplycms-plugin-acme') },",
      ),
    );
    const r = doctor(root);
    expect(r.line).toContain('✗');
    expect(r.out).toContain('simplycms-plugin-acme');
    expect(r.out).toContain('«^2.0.0»');
  });

  it('runOfflineChecks (список, який перевикористає status) містить engines', async () => {
    const root = await store('eng-list');
    const ids = runOfflineChecks({
      storeRoot: root,
      manifest: {},
      env: ENV,
      cliVersion: CORE,
      hostDir: join(root, 'no-canon'),
      schemaMigrationsDir: join(root, 'none'),
    }).map((c: { id: string }) => c.id);
    expect(ids).toContain('engines');
  });
});

describe('checkEngines (юніт)', () => {
  const ctx = (
    items: { label: string; kind?: string; range?: string; error?: string }[],
  ) => ({
    engines: {
      coreVersion: CORE,
      satisfies,
      items: items.map((item) => ({ kind: 'plugin', ...item })),
    },
  });

  it('без ядра — skip', () => {
    expect(checkEngines({ engines: null }).status).toBe('skip');
  });

  it('error перемагає warn, текст має пакет, діапазон, версію ядра і дію', () => {
    const r = checkEngines(
      ctx([{ label: 'плагін «a»', range: '^2.0.0' }, { label: 'тема «b»' }]),
    );
    expect(r.status).toBe('error');
    expect(r.details).toContain('плагін «a»');
    expect(r.details).toContain('«^2.0.0»');
    expect(r.details).toContain(CORE);
    expect(r.details).toContain('онови плагін або відкоти ядро');
    expect(r.details).toContain('тема «b»');
  });

  it('error для теми несе примітку про можливу неактивність', () => {
    const r = checkEngines(
      ctx([{ label: 'тема «b»', kind: 'theme', range: '^2.0.0' }]),
    );
    expect(r.details).toContain('може бути неактивною');
  });

  it('нерозбірливий діапазон — warn, а не error', () => {
    const r = checkEngines(ctx([{ label: 'x', range: '>=1.0.0 <2.0.0' }]));
    expect(r.status).toBe('warn');
    expect(r.details).toContain('не розпарсився');
  });

  it('порожній набір модулів — ok', () => {
    expect(checkEngines(ctx([])).status).toBe('ok');
  });
});

describe('buildOfflineContext (спільний для doctor і status)', () => {
  it('повертає engines для магазину з плагіном; пошкоджений манифест ядра → null', async () => {
    const { buildOfflineContext } =
      await import('../packages/cli/src/doctor.mjs');
    const root = await store('eng-ctx');
    const ctx = await buildOfflineContext(root);
    expect(ctx.engines?.coreVersion).toBe(CORE);
    expect(ctx.engines?.items.map((i: { label: string }) => i.label)).toEqual(
      expect.arrayContaining([expect.stringContaining('hello-world')]),
    );
    // Те саме ядро + контекст → №17 рахується, а не skip.
    expect(
      runOfflineChecks(ctx).find((c: { id: string }) => c.id === 'engines')
        ?.status,
    ).toBe('error');

    writeFileSync(join(root, 'node_modules/simplycms/package.json'), '{oops');
    expect((await buildOfflineContext(root)).engines).toBeNull();
  });
});
