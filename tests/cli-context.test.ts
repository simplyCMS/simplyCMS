import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  coreDependencies,
  findStoreRoot,
  readStoreEnv,
  readStoreManifest,
} from '../packages/cli/src/context.mjs';
import { scaffold } from '../packages/create-simplycms-store/src/scaffold.mjs';

// Контекст CLI @simplycms/cli: пошук кореня магазину і читання env — на
// реальному скаффолді шаблону (той самий, що ставить користувач), без мережі.
async function scaffoldStore(name: string) {
  const target = join(mkdtempSync(join(tmpdir(), 'cli-ctx-')), name);
  await scaffold({
    templateDir: 'packages/create-simplycms-store/template',
    targetDir: target,
    storeName: name,
    version: '9.9.9-sentinel',
  });
  return target;
}

describe('cli context', () => {
  it('findStoreRoot: знаходить корінь із вкладеної теки магазину', async () => {
    const store = await scaffoldStore('ctx-root');
    expect(findStoreRoot(join(store, 'src', 'routes'))).toBe(store);
  });

  it('findStoreRoot: проміжний package.json без @simplycms/* не зупиняє пошук', async () => {
    const store = await scaffoldStore('ctx-nested');
    const sub = join(store, 'tools');
    mkdirSync(sub);
    writeFileSync(join(sub, 'package.json'), JSON.stringify({ name: 'sub' }));
    expect(findStoreRoot(sub)).toBe(store);
  });

  // Р9 (інкремент Б.2): у кореневому package.json монорепо залежностей
  // `@simplycms/*` РІВНО НУЛЬ — пакети живуть у workspace, — тож перший
  // маркер його не бачив і `simplycms create theme` у самому репо падав.
  it('findStoreRoot: корінь монорепо (pnpm-workspace.yaml + simplycms.config.ts) без @simplycms/*', () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-ctx-monorepo-'));
    writeFileSync(
      join(root, 'pnpm-workspace.yaml'),
      "packages:\n  - 'packages/*'\n",
    );
    writeFileSync(join(root, 'simplycms.config.ts'), 'export default {};\n');
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'simplycms-monorepo', devDependencies: {} }),
    );
    const nested = join(root, 'packages', 'ui');
    mkdirSync(nested, { recursive: true });
    expect(findStoreRoot(root)).toBe(root);
    expect(findStoreRoot(nested)).toBe(root);
  });

  it('findStoreRoot: сам по собі pnpm-workspace.yaml коренем НЕ робить', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-ctx-workspace-only-'));
    writeFileSync(
      join(dir, 'pnpm-workspace.yaml'),
      "packages:\n  - 'apps/*'\n",
    );
    expect(() => findStoreRoot(dir)).toThrow(/simplycms\.config\.ts/);
  });

  it('findStoreRoot: поза магазином — гучна помилка з діагностикою', () => {
    const outside = mkdtempSync(join(tmpdir(), 'cli-ctx-outside-'));
    expect(() => findStoreRoot(outside)).toThrow(/@simplycms/);
  });

  it('readStoreManifest: битий JSON — гучна помилка, а не тихий пропуск', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-ctx-broken-'));
    writeFileSync(join(dir, 'package.json'), '{ broken');
    expect(() => readStoreManifest(dir)).toThrow(/Битий JSON/);
  });

  it('coreDependencies: збирає @simplycms/* з dependencies і devDependencies', () => {
    const manifest = {
      dependencies: { '@simplycms/ui': '0.3.0', react: '19.0.0' },
      devDependencies: { '@simplycms/cli': '0.3.0', typescript: '5.9.0' },
    };
    expect(coreDependencies(manifest)).toEqual({
      '@simplycms/ui': '0.3.0',
      '@simplycms/cli': '0.3.0',
    });
  });

  it('readStoreEnv: пріоритет process.env > .env.local > .env', async () => {
    const store = await scaffoldStore('ctx-env');
    writeFileSync(join(store, '.env'), 'A=file\nB=file\nC=file\n');
    writeFileSync(join(store, '.env.local'), 'B=local\nD=local\n');
    const processEnv = { C: 'proc', E: 'proc' };
    const env = readStoreEnv(store, processEnv);
    expect(env).toMatchObject({
      A: 'file', // лише .env
      B: 'local', // .env.local виграє у .env
      C: 'proc', // process.env виграє у .env
      D: 'local',
      E: 'proc',
    });
    // Джерела не мутуються: ні переданий env-обʼєкт, ні глобальний process.env.
    expect(processEnv).toEqual({ C: 'proc', E: 'proc' });
    expect(process.env.A).toBeUndefined();
  });

  it('readStoreEnv: без env-файлів повертає копію process.env-джерела', async () => {
    const store = await scaffoldStore('ctx-noenv');
    const env = readStoreEnv(store, { ONLY: 'proc' });
    expect(env).toEqual({ ONLY: 'proc' });
  });
});
