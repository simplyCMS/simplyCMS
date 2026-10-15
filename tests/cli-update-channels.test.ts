import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { needsDatabaseRecreation } from '../packages/cli/src/update-target.mjs';
import { run } from '../packages/cli/src/update.mjs';
import { compatBoundaryOf } from '../packages/cli/src/versions.mjs';
import { scaffold } from '../packages/create-simplycms-store/src/scaffold.mjs';

// update і канали релізів (T16): RC не даунгрейдиться до latest, межа сумісності
// (мажорна з 1.0, мінорна для 0.x) без --to не перетинається. Реєстр і `pnpm add` — фейковий `deps.exec`, мережі нема.
type Tags = Record<string, string>;

async function storeOn(version: string) {
  const name = `upd-chan-${version.replace(/\W/g, '')}`;
  const target = join(mkdtempSync(join(tmpdir(), 'cli-chan-')), name);
  await scaffold({
    templateDir: 'packages/create-simplycms-store/template',
    targetDir: target,
    storeName: name,
    version,
  });
  // Поточну версію ядра читаємо зі встановленого пакета, як у справжньому магазині.
  const installed = join(target, 'node_modules', 'simplycms');
  mkdirSync(installed, { recursive: true });
  writeFileSync(
    join(installed, 'package.json'),
    JSON.stringify({ name: 'simplycms', version }),
  );
  // Після `pnpm add` update передає керування CLI магазину (Р21) — його bin потрібен.
  const cli = join(target, 'node_modules', '@simplycms', 'cli');
  mkdirSync(cli, { recursive: true });
  writeFileSync(
    join(cli, 'package.json'),
    JSON.stringify({
      name: '@simplycms/cli',
      bin: { simplycms: 'src/index.mjs' },
    }),
  );
  return target;
}

function fakeRegistry(tags: Tags) {
  const calls: string[][] = [];
  const exec = (command: string, args: string[]) => {
    calls.push([command, ...args]);
    if (args[0] === 'view') return JSON.stringify(tags);
    return undefined;
  };
  const adds = () => calls.filter((c) => c[1] === 'add');
  return { exec, calls, adds };
}

describe('compatBoundaryOf / needsDatabaseRecreation', () => {
  it('межа: мажорна з 1.0, мінорна для 0.x', () => {
    expect(compatBoundaryOf('1.2.3')).toBe('1');
    expect(compatBoundaryOf('1.0.0-rc.1')).toBe('1');
    expect(compatBoundaryOf('0.14.9')).toBe('0.14');
    expect(compatBoundaryOf('0.15.0')).toBe('0.15');
  });

  it('база перестворюється лише при переході через 0.15.0 знизу', () => {
    expect(needsDatabaseRecreation('0.14.0', '0.15.0')).toBe(true);
    expect(needsDatabaseRecreation('0.14.5', '1.0.0')).toBe(true);
    expect(needsDatabaseRecreation('0.15.0', '0.15.1')).toBe(false);
    expect(needsDatabaseRecreation('0.14.0', '0.14.1')).toBe(false);
    expect(needsDatabaseRecreation('1.2.0', '1.3.0')).toBe(false);
  });
});

describe('simplycms update: канали релізів', () => {
  const initialExitCode = process.exitCode;
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = initialExitCode;
  });

  async function runUpdate(
    store: string,
    argv: string[],
    registry: ReturnType<typeof fakeRegistry>,
  ) {
    let out = '';
    vi.spyOn(process, 'cwd').mockReturnValue(store);
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      out += String(chunk);
      return true;
    });
    process.exitCode = undefined;
    await run(argv, { exec: registry.exec });
    return { out, code: process.exitCode };
  }

  it('RC-магазин бере max(next, latest): rc.1 → rc.2', async () => {
    const store = await storeOn('1.0.0-rc.1');
    const reg = fakeRegistry({ latest: '0.14.0', next: '1.0.0-rc.2' });
    await runUpdate(store, [], reg);
    expect(reg.adds().length).toBeGreaterThan(0);
    expect(reg.adds()[0].join(' ')).toContain('simplycms@1.0.0-rc.2');
  });

  it('RC не даунгрейдиться: latest 0.14.0, next = поточний → «новішого немає», pnpm add не викликано', async () => {
    const store = await storeOn('1.0.0-rc.1');
    const reg = fakeRegistry({ latest: '0.14.0', next: '1.0.0-rc.1' });
    const { out } = await runUpdate(store, [], reg);
    expect(reg.adds()).toEqual([]);
    expect(out).toContain('Новішого релізу немає');
  });

  it('стабільний магазин бере latest, next ігнорує', async () => {
    const store = await storeOn('0.14.0');
    const reg = fakeRegistry({ latest: '0.14.1', next: '1.0.0-rc.2' });
    await runUpdate(store, [], reg);
    expect(reg.adds()[0].join(' ')).toContain('simplycms@0.14.1');
  });

  it('межа 0.x: 0.14.0 + latest 0.15.0 без --to → код 3, текст називає 0.15.0, BREAKING і --to 0.15.0, pnpm add не викликано', async () => {
    const store = await storeOn('0.14.0');
    const reg = fakeRegistry({ latest: '0.15.0' });
    const { out, code } = await runUpdate(store, [], reg);
    expect(code).toBe(3);
    expect(reg.adds()).toEqual([]);
    expect(out).toContain('0.15.0');
    expect(out).toContain('поза межею сумісності 0.14.0');
    expect(out).toContain('BREAKING');
    expect(out).toContain('simplycms update --to 0.15.0');
  });

  it('текст зупинки 0.14 → 0.15 попереджає про перестворення бази', async () => {
    const store = await storeOn('0.14.0');
    const reg = fakeRegistry({ latest: '0.15.0' });
    const { out } = await runUpdate(store, [], reg);
    expect(out).toContain('UnjournaledDatabaseError');
    expect(out).toContain('pnpm simplycms db:apply');
    expect(out).toContain('новий порожній екземпляр');
  });

  it('межа 0.x: 0.14.0 + latest 1.0.0 без --to → код 3, текст називає 1.0.0 і --to, pnpm add не викликано', async () => {
    const store = await storeOn('0.14.0');
    const reg = fakeRegistry({ latest: '1.0.0' });
    const { out, code } = await runUpdate(store, [], reg);
    expect(code).toBe(3);
    expect(reg.adds()).toEqual([]);
    expect(out).toContain('1.0.0');
    expect(out).toContain('--to 1.0.0');
    expect(out).toContain('BREAKING');
  });

  it('0.14.0 + --to 0.15.0 → ставить і друкує про перестворення бази 0.14 з посиланням на BREAKING', async () => {
    const store = await storeOn('0.14.0');
    const reg = fakeRegistry({ latest: '0.15.0' });
    const { out, code } = await runUpdate(store, ['--to', '0.15.0'], reg);
    expect(code).not.toBe(3);
    expect(reg.adds()[0].join(' ')).toMatch(/simplycms@0\.15\.0(\s|$)/);
    expect(out).toContain('UnjournaledDatabaseError');
    expect(out).toContain('без журналу міграцій');
    expect(out).toContain('BREAKING');
  });

  it('0.15.0 → 0.15.1 ставить без попередження про базу', async () => {
    const store = await storeOn('0.15.0');
    const reg = fakeRegistry({ latest: '0.15.1' });
    const { out } = await runUpdate(store, [], reg);
    expect(reg.adds()[0].join(' ')).toContain('simplycms@0.15.1');
    expect(out).not.toContain('UnjournaledDatabaseError');
  });

  it('1.2.0 → 1.3.0 ставить (мажорна межа з 1.0)', async () => {
    const store = await storeOn('1.2.0');
    const reg = fakeRegistry({ latest: '1.3.0' });
    const { code } = await runUpdate(store, [], reg);
    expect(code).not.toBe(3);
    expect(reg.adds()[0].join(' ')).toContain('simplycms@1.3.0');
  });

  it('1.2.0 + latest 2.0.0 без --to → код 3, pnpm add не викликано', async () => {
    const store = await storeOn('1.2.0');
    const reg = fakeRegistry({ latest: '2.0.0' });
    const { out, code } = await runUpdate(store, [], reg);
    expect(code).toBe(3);
    expect(reg.adds()).toEqual([]);
    expect(out).toContain('--to 2.0.0');
    expect(out).not.toContain('UnjournaledDatabaseError');
  });

  it('1.0.0-rc.1 → 1.0.0 ставить (RC → фінальний тієї ж межі)', async () => {
    const store = await storeOn('1.0.0-rc.1');
    const reg = fakeRegistry({ latest: '1.0.0', next: '1.0.0-rc.1' });
    await runUpdate(store, [], reg);
    expect(reg.adds()[0].join(' ')).toMatch(/simplycms@1\.0\.0(\s|$)/);
  });

  it('поточна версія невідома (немає node_modules і піну) → код 3, порада --to, pnpm add не викликано', async () => {
    const store = await storeOn('1.0.0');
    rmSync(join(store, 'node_modules'), { recursive: true });
    const manifestPath = join(store, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.dependencies.simplycms = 'workspace:*';
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const reg = fakeRegistry({ latest: '1.0.1' });
    const { out, code } = await runUpdate(store, [], reg);
    expect(code).toBe(3);
    expect(reg.adds()).toEqual([]);
    expect(out).toContain('--to 1.0.1');
  });

  it('з --to 1.0.0 мажорну межу перетинає', async () => {
    const store = await storeOn('0.14.0');
    const reg = fakeRegistry({ latest: '1.0.0' });
    const { code } = await runUpdate(store, ['--to', '1.0.0'], reg);
    expect(code).not.toBe(3);
    expect(reg.adds()[0].join(' ')).toMatch(/simplycms@1\.0\.0(\s|$)/);
  });

  it('1.0.0-rc.2 + latest 1.0.0 → ставить (RC → фінальний тієї ж мажорної не межа)', async () => {
    const store = await storeOn('1.0.0-rc.2');
    const reg = fakeRegistry({ latest: '1.0.0', next: '1.0.0-rc.2' });
    await runUpdate(store, [], reg);
    expect(reg.adds()[0].join(' ')).toMatch(/simplycms@1\.0\.0(\s|$)/);
  });
});
